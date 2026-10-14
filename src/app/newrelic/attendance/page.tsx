'use client';

import React, { useEffect, useState, useMemo, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Loader2, Camera, LogIn, LogOut, MapPin, Clock, CheckCircle, AlertCircle, Calendar, Users, IndianRupee, Phone, Mail, CalendarDays, ChevronDown, ChevronUp, User, FileSpreadsheet, Calculator } from 'lucide-react';
import * as XLSX from 'xlsx';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { NewRelicEmployee, NewRelicAttendance, NewRelicSalaryAdvance, NewRelicSalaryPayment } from '@/types/employee';
import { SiteId, resolveSiteId, SITE_OPTIONS, COMPANY_SITES } from '@/types/site';
import {
  getActiveEmployees,
  recordSalaryAdvance,
  getSalaryAdvancesForMonth,
  deleteSalaryAdvance,
  recordSalaryPayment,
  getSalaryPaymentsForMonth,
} from '@/services/newrelicEmployeeService';
import {
  getTodayAttendance,
  checkInEmployee,
  checkOutEmployee,
  uploadSelfie,
  getTodayAllAttendance,
  getAttendanceByDateRange,
  getEmployeeMonthlyAttendance,
  checkAndFlagMissedCheckouts,
  LOCATION_SHIFT_RULES,
} from '@/services/newrelicAttendanceService';
import { SelfieCapture } from '@/components/newrelic/attendance/selfie-capture';
import { triggerHaptic } from '@/lib/haptics';

type AttendanceAction = 'check-in' | 'check-out';

function getTodayDate(): string {
  return new Date().toISOString().substring(0, 10);
}

function formatTime(isoString: string): string {
  return new Date(isoString).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
}

function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

/** Get total calendar days in a YYYY-MM month */
function getDaysInMonth(yearMonth: string): number {
  const [y, m] = yearMonth.split('-').map(Number);
  return new Date(y, m, 0).getDate();
}

/** Get working days in month (excluding Sundays, or default total days if standard) */
function getWorkingDaysInMonth(yearMonth: string, excludeSundays: boolean = false): number {
  const [y, m] = yearMonth.split('-').map(Number);
  const totalDays = new Date(y, m, 0).getDate();
  if (!excludeSundays) return totalDays;
  let working = 0;
  for (let day = 1; day <= totalDays; day++) {
    const d = new Date(y, m - 1, day);
    if (d.getDay() !== 0) working++; // exclude Sunday
  }
  return working;
}

function AttendancePageContent() {
  const { toast } = useToast();
  const { user, role } = useAuth();
  const searchParams = useSearchParams();
  const isOwnerOrAdmin = role === 'admin' || role === 'superadmin';
  const isAdmin = isOwnerOrAdmin; // Strictly restricted to admin and superadmin only

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  // --- Self service state ---
  const [employees, setEmployees] = useState<NewRelicEmployee[]>([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('');
  const [todayRecord, setTodayRecord] = useState<NewRelicAttendance | null>(null);
  const [isLoadingEmployee, setIsLoadingEmployee] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [cameraAction, setCameraAction] = useState<AttendanceAction>('check-in');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // --- Admin state ---
  const [todayAll, setTodayAll] = useState<NewRelicAttendance[]>([]);
  const [isLoadingAdmin, setIsLoadingAdmin] = useState(false);
  const [adminTab, setAdminTab] = useState<'today' | 'history' | 'payroll'>(() => {
    const tabParam = searchParams?.get('tab');
    if (isOwnerOrAdmin && (tabParam === 'payroll' || tabParam === 'salaries')) return 'payroll';
    if (tabParam === 'history') return 'history';
    return 'today';
  });

  useEffect(() => {
    const tabParam = searchParams?.get('tab');
    if (isOwnerOrAdmin && (tabParam === 'payroll' || tabParam === 'salaries')) {
      setAdminTab('payroll');
    } else if (tabParam === 'history') {
      setAdminTab('history');
    } else if (!isOwnerOrAdmin && adminTab === 'payroll') {
      setAdminTab('today');
    }
  }, [searchParams, isOwnerOrAdmin, adminTab]);
  const [adminPayrollMonth, setAdminPayrollMonth] = useState<string>(() => new Date().toISOString().substring(0, 7));
  const [adminPayrollRecords, setAdminPayrollRecords] = useState<NewRelicAttendance[]>([]);
  const [adminAdvances, setAdminAdvances] = useState<NewRelicSalaryAdvance[]>([]);
  const [adminPayments, setAdminPayments] = useState<NewRelicSalaryPayment[]>([]);
  const [isLoadingPayroll, setIsLoadingPayroll] = useState(false);
  const [historyStart, setHistoryStart] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().substring(0, 10);
  });
  const [historyEnd, setHistoryEnd] = useState(getTodayDate());
  const [historyRecords, setHistoryRecords] = useState<NewRelicAttendance[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [expandedRecord, setExpandedRecord] = useState<string | null>(null);

  // Modals for Advances & Salary Payment
  const [advanceModalEmployee, setAdvanceModalEmployee] = useState<NewRelicEmployee | null>(null);
  const [advanceAmount, setAdvanceAmount] = useState<number>(0);
  const [advanceReason, setAdvanceReason] = useState<string>('');
  const [advancePaymentMode, setAdvancePaymentMode] = useState<'cash' | 'upi' | 'bank_transfer'>('upi');
  const [isSubmittingAdvance, setIsSubmittingAdvance] = useState(false);

  const [payModalData, setPayModalData] = useState<{
    employee: NewRelicEmployee;
    summary: any;
  } | null>(null);
  const [payPaymentMode, setPayPaymentMode] = useState<'cash' | 'upi' | 'bank_transfer' | 'cheque'>('bank_transfer');
  const [payReferenceNote, setPayReferenceNote] = useState<string>('');
  const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);

  const assignedSite = user?.assignedSite || 'newrelic';
  const [adminSiteFilter, setAdminSiteFilter] = useState<string>(() => isOwnerOrAdmin ? 'all' : assignedSite);

  useEffect(() => {
    if (!isOwnerOrAdmin) {
      setAdminSiteFilter(user?.assignedSite || 'newrelic');
    }
  }, [user?.assignedSite, isOwnerOrAdmin]);

  const displayTodayAll = useMemo(() => {
    return todayAll.filter(
      (rec) => adminSiteFilter === 'all' || resolveSiteId(rec.siteId) === adminSiteFilter
    );
  }, [todayAll, adminSiteFilter]);

  const payrollEmployees = useMemo(() => {
    return employees.filter(
      (e) => e.isActive && (adminSiteFilter === 'all' || resolveSiteId(e.siteId) === adminSiteFilter)
    );
  }, [employees, adminSiteFilter]);

  /* ── Load employees list and auto-bind logged-in user ── */
  useEffect(() => {
    const siteParam = isOwnerOrAdmin ? undefined : assignedSite;
    getActiveEmployees(undefined, siteParam).then((list) => {
      // For non-admins (user/manager), strictly scope employee list to only their own record
      let scopedList = list;
      if (!isOwnerOrAdmin && user?.email) {
        const userEmailLower = user.email.toLowerCase().trim();
        const matched = list.filter(
          (e) => (e.userId && e.userId === user.id) ||
                 (e.email && e.email.toLowerCase().trim() === userEmailLower)
        );
        if (matched.length > 0) {
          scopedList = matched;
        }
      }

      setEmployees(scopedList);
      if (scopedList.length === 0) return;

      // 1. Try matching by userId or email
      if (user?.email) {
        const userEmailLower = user.email.toLowerCase().trim();
        const matched = scopedList.find(
          (e) => (e.userId && e.userId === user.id) ||
                 (e.email && e.email.toLowerCase().trim() === userEmailLower)
        );
        if (matched?.id) {
          setSelectedEmployeeId(matched.id);
          return;
        }
      }

      // 2. Check localStorage for previously selected employee ID
      const savedId = typeof window !== 'undefined' ? localStorage.getItem('nr_attendance_emp_id') : null;
      if (savedId && scopedList.some(e => e.id === savedId)) {
        setSelectedEmployeeId(savedId);
        return;
      }

      // 3. Select the first available employee in scoped list
      if (!selectedEmployeeId && scopedList[0]?.id) {
        setSelectedEmployeeId(scopedList[0].id);
      }
    });
  }, [user, isOwnerOrAdmin]);

  // Persist selected employee ID in localStorage
  useEffect(() => {
    if (selectedEmployeeId) {
      localStorage.setItem('nr_attendance_emp_id', selectedEmployeeId);
    }
  }, [selectedEmployeeId]);

  // --- Employee Profile & Monthly History ---
  const [selectedMonth, setSelectedMonth] = useState<string>(() => new Date().toISOString().substring(0, 7)); // YYYY-MM
  const [myMonthlyRecords, setMyMonthlyRecords] = useState<NewRelicAttendance[]>([]);
  const [isLoadingMonthly, setIsLoadingMonthly] = useState(false);
  const [showProfileDetails, setShowProfileDetails] = useState(true);
  const [missedCheckouts, setMissedCheckouts] = useState<NewRelicAttendance[]>([]);
  const [currentTime, setCurrentTime] = useState<string>('');

  useEffect(() => {
    const updateTime = () => {
      setCurrentTime(new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }));
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  /* ── Load today's record and monthly log when employee selected ── */
  useEffect(() => {
    if (!selectedEmployeeId) {
      setTodayRecord(null);
      setMyMonthlyRecords([]);
      setMissedCheckouts([]);
      return;
    }
    const today = getTodayDate();
    setIsLoadingEmployee(true);
    getTodayAttendance(selectedEmployeeId, today)
      .then(setTodayRecord)
      .finally(() => setIsLoadingEmployee(false));

    setIsLoadingMonthly(true);
    getEmployeeMonthlyAttendance(selectedEmployeeId, selectedMonth)
      .then(setMyMonthlyRecords)
      .finally(() => setIsLoadingMonthly(false));

    // Check if employee missed checking out on any prior day
    checkAndFlagMissedCheckouts(selectedEmployeeId, today)
      .then(setMissedCheckouts)
      .catch(console.error);
  }, [selectedEmployeeId, selectedMonth]);

  /* ── Admin: load today's all attendance ── */
  useEffect(() => {
    if (!isAdmin) return;
    setIsLoadingAdmin(true);
    const assignedSite = user?.assignedSite || 'newrelic';
    const siteParam = isOwnerOrAdmin ? undefined : assignedSite;
    getTodayAllAttendance(getTodayDate(), siteParam)
      .then(setTodayAll)
      .finally(() => setIsLoadingAdmin(false));
  }, [isAdmin, isOwnerOrAdmin, user?.assignedSite]);

  /* ── Admin: load payroll records, advances, and payments when month changes ── */
  const loadAdminPayroll = async () => {
    if (!isOwnerOrAdmin) return;
    setIsLoadingPayroll(true);
    try {
      const days = getDaysInMonth(adminPayrollMonth);
      const start = `${adminPayrollMonth}-01`;
      const end = `${adminPayrollMonth}-${String(days).padStart(2, '0')}`;
      const [recs, advs, pymts] = await Promise.all([
        getAttendanceByDateRange(start, end),
        getSalaryAdvancesForMonth(adminPayrollMonth),
        getSalaryPaymentsForMonth(adminPayrollMonth),
      ]);
      setAdminPayrollRecords(recs);
      setAdminAdvances(advs);
      setAdminPayments(pymts);
    } catch {
      toast({ variant: 'destructive', title: 'Failed to load payroll records' });
    } finally {
      setIsLoadingPayroll(false);
    }
  };

  useEffect(() => {
    if (isOwnerOrAdmin && adminTab === 'payroll') {
      loadAdminPayroll();
    }
  }, [isOwnerOrAdmin, adminTab, adminPayrollMonth]);

  /* ── Submit Salary Advance ── */
  const handleSaveAdvance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!advanceModalEmployee || advanceAmount <= 0) {
      toast({ variant: 'destructive', title: 'Please enter a valid advance amount' });
      return;
    }
    setIsSubmittingAdvance(true);
    try {
      await recordSalaryAdvance(
        {
          employeeDocId: advanceModalEmployee.id!,
          employeeId: advanceModalEmployee.employeeId,
          employeeName: advanceModalEmployee.name,
          amount: Number(advanceAmount),
          date: getTodayDate(),
          month: adminPayrollMonth,
          reason: advanceReason.trim() || undefined,
          paymentMode: advancePaymentMode,
          status: 'pending',
        },
        user?.email || null
      );
      toast({ title: `Advance of ₹${advanceAmount.toLocaleString('en-IN')} recorded for ${advanceModalEmployee.name}` });
      setAdvanceModalEmployee(null);
      setAdvanceAmount(0);
      setAdvanceReason('');
      loadAdminPayroll();
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Failed to record advance', description: err.message });
    } finally {
      setIsSubmittingAdvance(false);
    }
  };

  /* ── Submit Final Salary Payment ── */
  const handleSaveSalaryPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payModalData) return;
    setIsSubmittingPayment(true);
    try {
      const { employee, summary } = payModalData;
      await recordSalaryPayment(
        {
          employeeDocId: employee.id!,
          employeeId: employee.employeeId,
          employeeName: employee.name,
          month: adminPayrollMonth,
          grossSalary: employee.monthlySalary || 0,
          totalDaysInMonth: summary.totalDaysInMonth,
          presentDays: summary.presentDays,
          halfDays: summary.halfDays,
          absentDays: summary.absentDays,
          paidDays: summary.effectivePaidDays,
          attendanceEarned: summary.attendanceEarned,
          advancesDeducted: summary.advancesTotal,
          netPaidAmount: summary.netPayable,
          paymentDate: getTodayDate(),
          paymentMode: payPaymentMode,
          referenceNote: payReferenceNote.trim() || undefined,
          status: 'paid',
        },
        user?.email || null
      );
      toast({ title: `Salary paid to ${employee.name} (₹${summary.netPayable.toLocaleString('en-IN')})` });
      setPayModalData(null);
      setPayReferenceNote('');
      loadAdminPayroll();
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Payment failed', description: err.message });
    } finally {
      setIsSubmittingPayment(false);
    }
  };

  const selectedEmployee = employees.find((e) => e.id === selectedEmployeeId) || null;

  /* ── Calculations: Individual Employee Monthly Summary ── */
  const myMonthlySummary = useMemo(() => {
    const totalDaysInMonth = getDaysInMonth(selectedMonth);
    const workingDaysInMonth = totalDaysInMonth;
    let presentDays = 0;
    let halfDays = 0;
    let lateDays = 0;
    let overtimeMinutesTotal = 0;

    myMonthlyRecords.forEach((r) => {
      if (r.status === 'present') presentDays++;
      else if (r.status === 'half-day') halfDays++;
      else if (r.status === 'missed-checkout') halfDays++; // count unclosed as half-day
      if (r.isLate) lateDays++;
      if (r.overtimeMinutes) overtimeMinutesTotal += r.overtimeMinutes;
    });

    const effectivePaidDays = presentDays + 0.5 * halfDays;
    const absentDays = Math.max(0, workingDaysInMonth - presentDays - halfDays);
    const monthlyGross = selectedEmployee?.monthlySalary || 0;
    const payableAmount = workingDaysInMonth > 0 
      ? Math.round((effectivePaidDays / workingDaysInMonth) * monthlyGross) 
      : 0;

    return {
      totalDaysInMonth,
      workingDaysInMonth,
      presentDays,
      halfDays,
      absentDays,
      lateDays,
      overtimeMinutesTotal,
      effectivePaidDays,
      payableAmount,
      monthlyGross,
    };
  }, [myMonthlyRecords, selectedMonth, selectedEmployee]);

  /* ── Export Individual Monthly Attendance to Excel ── */
  const exportMyMonthlyExcel = () => {
    if (!isOwnerOrAdmin || !selectedEmployee) return;
    try {
      const siteId = resolveSiteId(selectedEmployee.siteId);
      const siteName = siteId === 'dsm' ? 'DSM' : siteId === 'ntt_data' ? 'NTT Data' : 'NewRelic';
      const rows = myMonthlyRecords.map((r) => ({
        'Date': r.date,
        'Company Site': siteName,
        'Employee ID': r.employeeId,
        'Employee Name': r.employeeName,
        'Location': r.location,
        'Check-In Time': r.checkIn ? formatTime(r.checkIn.time) : 'N/A',
        'Check-Out Time': r.checkOut ? formatTime(r.checkOut.time) : 'Pending',
        'Duration': r.durationMinutes ? formatDuration(r.durationMinutes) : '0m',
        'Late Status': r.isLate ? `Late (+${r.lateMinutes || 0}m)` : 'On-Time',
        'Overtime': r.overtimeMinutes ? formatDuration(r.overtimeMinutes) : '0m',
        'Shift Status': r.status === 'present' ? 'Full Day' : r.status === 'half-day' ? 'Half Day' : r.status,
      }));

      const summaryRows = [
        { 'Metric': 'Employee Name', 'Value': selectedEmployee.name },
        { 'Metric': 'Employee ID', 'Value': selectedEmployee.employeeId },
        { 'Metric': 'Company Site', 'Value': siteName },
        { 'Metric': 'Location', 'Value': selectedEmployee.location },
        { 'Metric': 'Month', 'Value': selectedMonth },
        { 'Metric': 'Total Days in Month', 'Value': myMonthlySummary.totalDaysInMonth },
        { 'Metric': 'Working Days in Month', 'Value': myMonthlySummary.workingDaysInMonth },
        { 'Metric': 'Full Days Present', 'Value': myMonthlySummary.presentDays },
        { 'Metric': 'Half Days', 'Value': myMonthlySummary.halfDays },
        { 'Metric': 'Absent Days', 'Value': myMonthlySummary.absentDays },
        { 'Metric': 'Late Days', 'Value': myMonthlySummary.lateDays },
        { 'Metric': 'Overtime Total', 'Value': formatDuration(myMonthlySummary.overtimeMinutesTotal) },
        { 'Metric': 'Effective Paid Days', 'Value': myMonthlySummary.effectivePaidDays },
        { 'Metric': 'Monthly Salary (INR)', 'Value': myMonthlySummary.monthlyGross },
        { 'Metric': 'Estimated Payable Amount (INR)', 'Value': myMonthlySummary.payableAmount },
      ];

      const wb = XLSX.utils.book_new();
      const wsDetails = XLSX.utils.json_to_sheet(rows);
      const wsSummary = XLSX.utils.json_to_sheet(summaryRows);

      XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary');
      XLSX.utils.book_append_sheet(wb, wsDetails, 'Daily Attendance');
      XLSX.writeFile(wb, `Attendance_${selectedEmployee.name.replace(/\s+/g, '_')}_${selectedMonth}.xlsx`);
      toast({ title: 'Exported attendance successfully' });
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Export failed', description: e.message });
    }
  };

  /* ── Export All Employees Company Payroll to Excel ── */
  const exportAdminPayrollExcel = () => {
    try {
      const totalDaysInMonth = getDaysInMonth(adminPayrollMonth);
      const workingDaysInMonth = totalDaysInMonth;

      const payrollRows = payrollEmployees.map((emp) => {
        const empRecords = adminPayrollRecords.filter(r => r.employeeDocId === emp.id || r.employeeId === emp.employeeId);
        let presentDays = 0;
        let halfDays = 0;
        let lateDays = 0;
        let overtimeMins = 0;

        empRecords.forEach(r => {
          if (r.status === 'present') presentDays++;
          else if (r.status === 'half-day') halfDays++;
          else if (r.status === 'missed-checkout') halfDays++;
          if (r.isLate) lateDays++;
          if (r.overtimeMinutes) overtimeMins += r.overtimeMinutes;
        });

        const effectivePaidDays = presentDays + 0.5 * halfDays;
        const absentDays = Math.max(0, workingDaysInMonth - presentDays - halfDays);
        const grossSalary = emp.monthlySalary || 0;
        const payableAmount = workingDaysInMonth > 0
          ? Math.round((effectivePaidDays / workingDaysInMonth) * grossSalary)
          : 0;

        const empAdvances = adminAdvances.filter(a => a.employeeDocId === emp.id || a.employeeId === emp.employeeId);
        const advancesTotal = empAdvances.reduce((sum, a) => sum + (a.amount || 0), 0);
        const netPayable = Math.max(0, payableAmount - advancesTotal);
        const existingPayment = adminPayments.find(p => p.employeeDocId === emp.id || p.employeeId === emp.employeeId);
        const sId = resolveSiteId(emp.siteId);
        const siteName = sId === 'dsm' ? 'DSM' : sId === 'ntt_data' ? 'NTT Data' : 'NewRelic';

        return {
          'Employee ID': emp.employeeId,
          'Employee Name': emp.name,
          'Company Site': siteName,
          'Location': emp.location,
          'Designation': emp.designation,
          'Monthly Gross (INR)': grossSalary,
          'Total Month Days': totalDaysInMonth,
          'Full Days': presentDays,
          'Half Days': halfDays,
          'Absent Days': absentDays,
          'Late Count': lateDays,
          'Total OT': formatDuration(overtimeMins),
          'Paid Days Count': effectivePaidDays,
          'Attendance Earned (INR)': payableAmount,
          'Advances Deducted (INR)': advancesTotal,
          'Net Payable (INR)': netPayable,
          'Payment Status': existingPayment ? `PAID on ${existingPayment.paymentDate} (${existingPayment.paymentMode})` : 'UNPAID',
        };
      });

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(payrollRows);
      const siteSuffix = adminSiteFilter === 'all' ? 'All_Sites' : adminSiteFilter.toUpperCase();
      XLSX.utils.book_append_sheet(wb, ws, `Payroll_${adminPayrollMonth}`);
      XLSX.writeFile(wb, `Staff_Payroll_${siteSuffix}_${adminPayrollMonth}.xlsx`);
      toast({ title: 'Company payroll exported successfully' });
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Export failed', description: e.message });
    }
  };
  const isSelfMatched = !!(
    selectedEmployee &&
    user?.email &&
    ((selectedEmployee.userId && selectedEmployee.userId === user.id) ||
     (selectedEmployee.email && selectedEmployee.email.toLowerCase().trim() === user.email.toLowerCase().trim()))
  );

  const handleOpenCamera = (action: AttendanceAction) => {
    triggerHaptic('medium');
    setCameraAction(action);
    setShowCamera(true);
  };

  const handleSelfieCapture = async (
    base64Uri: string,
    coordinates: { lat: number; lng: number; accuracy?: number } | null
  ) => {
    if (!selectedEmployee) return;
    setShowCamera(false);
    setIsSubmitting(true);
    try {
      const folder = `${selectedEmployee.employeeId}/${getTodayDate()}`;
      const selfieUrl = await uploadSelfie(base64Uri, folder);

      if (cameraAction === 'check-in') {
        const res = await checkInEmployee(
          {
            id: selectedEmployee.id!,
            employeeId: selectedEmployee.employeeId,
            name: selectedEmployee.name,
            location: selectedEmployee.location,
            siteId: selectedEmployee.siteId,
          },
          selfieUrl,
          coordinates,
          getTodayDate()
        );
        triggerHaptic('success');
        if (res.isLate) {
          toast({
            variant: 'destructive',
            title: `⚠️ Checked In (Late by ${res.lateMinutes} mins)`,
            description: `Shift deadline was ${LOCATION_SHIFT_RULES[selectedEmployee.location.toLowerCase()]?.cutoff || '06:30'} AM. Marked as Late.`,
          });
        } else {
          toast({ title: `✅ Checked in on time — ${formatTime(new Date().toISOString())}` });
        }
      } else {
        if (!todayRecord?.id || !todayRecord.checkIn) {
          triggerHaptic('warning');
          toast({ variant: 'destructive', title: 'No check-in record found' });
          return;
        }
        const outRes = await checkOutEmployee(
          todayRecord.id,
          selfieUrl,
          coordinates,
          todayRecord.checkIn.time,
          selectedEmployee.location
        );
        triggerHaptic('success');
        if (outRes.overtimeMinutes > 0) {
          toast({
            title: `✅ Checked out — ${formatTime(new Date().toISOString())}`,
            description: `Great job! Includes ${formatDuration(outRes.overtimeMinutes)} overtime.`,
          });
        } else {
          toast({ title: `✅ Checked out — ${formatTime(new Date().toISOString())}` });
        }
      }

      // Refresh
      const updated = await getTodayAttendance(selectedEmployee.id!, getTodayDate());
      setTodayRecord(updated);
      getEmployeeMonthlyAttendance(selectedEmployee.id!, selectedMonth).then(setMyMonthlyRecords);
      if (isAdmin) {
        const all = await getTodayAllAttendance(getTodayDate());
        setTodayAll(all);
      }
    } catch (err: any) {
      triggerHaptic('warning');
      toast({ variant: 'destructive', title: err.message || 'Failed to record attendance' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLoadHistory = async () => {
    if (!isOwnerOrAdmin) return;
    setIsLoadingHistory(true);
    try {
      const siteParam = adminSiteFilter === 'all' ? (isOwnerOrAdmin ? undefined : assignedSite) : adminSiteFilter;
      const records = await getAttendanceByDateRange(historyStart, historyEnd, undefined, siteParam);
      setHistoryRecords(records);
    } catch {
      toast({ variant: 'destructive', title: 'Failed to load history' });
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const todayDate = getTodayDate();
  const [displayDate, setDisplayDate] = useState<string>('');

  useEffect(() => {
    setDisplayDate(
      new Date().toLocaleDateString('en-IN', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    );
  }, []);

  /* group history by date */
  const historyByDate = useMemo(() => {
    const map: Record<string, NewRelicAttendance[]> = {};
    historyRecords.forEach((r) => {
      if (!map[r.date]) map[r.date] = [];
      map[r.date].push(r);
    });
    return Object.entries(map).sort(([a], [b]) => b.localeCompare(a));
  }, [historyRecords]);

  if (!mounted) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Loader2 className="h-5 w-5 animate-spin text-[#3b2fc9]" />
          Loading attendance...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-3 sm:px-8 py-4 sm:py-8 space-y-6">

        {/* Date header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-gray-800">
              {isOwnerOrAdmin ? 'Attendance & Payroll' : 'Staff Attendance'}
            </h1>
            <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5" suppressHydrationWarning>
              <Calendar className="h-3.5 w-3.5" /> {displayDate || 'Loading date…'}
            </p>
          </div>

          {/* Quick tab switcher between Mark Attendance and Salaries/Admin tabs */}
          <div className="flex items-center gap-1.5 p-1 bg-gray-100 rounded-xl border border-gray-200">
            <button
              type="button"
              onClick={() => {
                const el = document.getElementById('self-service-section');
                el?.scrollIntoView({ behavior: 'smooth' });
              }}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold text-gray-700 hover:bg-white hover:shadow-xs transition-all flex items-center gap-1.5"
            >
              <Camera className="h-3.5 w-3.5 text-[#3b2fc9]" />
              Mark Attendance
            </button>
            {isOwnerOrAdmin && (
              <button
                type="button"
                onClick={() => {
                  setAdminTab('payroll');
                  const el = document.getElementById('admin-management-panel');
                  el?.scrollIntoView({ behavior: 'smooth' });
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                  adminTab === 'payroll'
                    ? 'bg-[#3b2fc9] text-white shadow-xs'
                    : 'text-gray-700 hover:bg-white hover:shadow-xs'
                }`}
              >
                <Calculator className="h-3.5 w-3.5" />
                Staff Salaries & Advances
              </button>
            )}
          </div>
        </div>

        {/* ── Native Mobile Camera / Selfie Quick-Action Hero Card ── */}
        <div className="sm:hidden">
          {selectedEmployee ? (
            <div className={`rounded-3xl p-6 text-white shadow-xl relative overflow-hidden flex flex-col items-center text-center transition-all ${
              !todayRecord 
                ? 'bg-gradient-to-br from-[#1e1b4b] via-[#312e81] to-[#4338ca]'
                : !todayRecord.checkOut
                ? 'bg-gradient-to-br from-[#064e3b] via-[#047857] to-[#0f766e]'
                : 'bg-gradient-to-br from-gray-900 via-slate-800 to-gray-900'
            }`}>
              {/* Decorative Blur Orbs */}
              <div className="absolute -top-12 -right-12 w-32 h-32 bg-white/10 rounded-full blur-xl pointer-events-none" />
              <div className="absolute -bottom-12 -left-12 w-32 h-32 bg-white/10 rounded-full blur-xl pointer-events-none" />

              {/* Status Pill Badge */}
              <div className="flex items-center gap-2 mb-2 z-10">
                {!todayRecord ? (
                  <span className="bg-white/15 backdrop-blur-md text-indigo-100 text-[11px] font-bold px-3 py-1 rounded-full uppercase tracking-wider flex items-center gap-1.5 border border-white/20">
                    <span className="w-2 h-2 rounded-full bg-amber-400" />
                    Ready to Check In
                  </span>
                ) : !todayRecord.checkOut ? (
                  <span className="bg-white/15 backdrop-blur-md text-emerald-100 text-[11px] font-bold px-3 py-1 rounded-full uppercase tracking-wider flex items-center gap-1.5 border border-white/20">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-300 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400"></span>
                    </span>
                    On Duty Active
                  </span>
                ) : (
                  <span className="bg-white/15 backdrop-blur-md text-gray-200 text-[11px] font-bold px-3 py-1 rounded-full uppercase tracking-wider flex items-center gap-1.5 border border-white/20">
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                    Shift Completed
                  </span>
                )}
              </div>

              {/* Live Digital Clock */}
              <h2 className="text-3xl font-extrabold tracking-tight font-mono text-white mb-1 z-10" suppressHydrationWarning>
                {currentTime || '00:00:00'}
              </h2>
              <p className="text-xs text-white/80 font-medium mb-6 z-10">
                {selectedEmployee.name} ({selectedEmployee.employeeId}) · {selectedEmployee.location.toUpperCase()}
              </p>

              {/* Large Native Camera Shutter Button */}
              {!todayRecord && (
                <div className="flex flex-col items-center z-10">
                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => handleOpenCamera('check-in')}
                    className="w-24 h-24 rounded-full border-4 border-white/60 bg-white/20 hover:bg-white/30 backdrop-blur-md flex items-center justify-center p-2.5 shadow-2xl active:scale-95 transition-all group"
                    aria-label="Capture check-in selfie"
                  >
                    <div className="w-full h-full rounded-full bg-white flex flex-col items-center justify-center text-[#3b2fc9] shadow-md group-hover:scale-105 transition-transform">
                      {isSubmitting ? (
                        <Loader2 className="w-8 h-8 animate-spin text-[#3b2fc9]" />
                      ) : (
                        <Camera className="w-8 h-8 text-[#3b2fc9]" />
                      )}
                    </div>
                  </button>
                  <span className="mt-3 text-xs font-bold text-white tracking-wide">
                    Tap Shutter to Check In
                  </span>
                  <span className="text-[10px] text-white/60 mt-0.5">
                    Shift deadline: {LOCATION_SHIFT_RULES[selectedEmployee.location.toLowerCase()]?.cutoff || '06:30'} AM
                  </span>
                </div>
              )}

              {todayRecord && !todayRecord.checkOut && (
                <div className="flex flex-col items-center z-10">
                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => handleOpenCamera('check-out')}
                    className="w-24 h-24 rounded-full border-4 border-white/60 bg-white/20 hover:bg-white/30 backdrop-blur-md flex items-center justify-center p-2.5 shadow-2xl active:scale-95 transition-all group"
                    aria-label="Capture check-out selfie"
                  >
                    <div className="w-full h-full rounded-full bg-amber-400 flex flex-col items-center justify-center text-amber-950 shadow-md group-hover:scale-105 transition-transform">
                      {isSubmitting ? (
                        <Loader2 className="w-8 h-8 animate-spin text-amber-950" />
                      ) : (
                        <Camera className="w-8 h-8 text-amber-950" />
                      )}
                    </div>
                  </button>
                  <span className="mt-3 text-xs font-bold text-white tracking-wide">
                    Tap Shutter to Check Out
                  </span>
                  <span className="text-[10px] text-white/60 mt-0.5">
                    Checked in at {formatTime(todayRecord.checkIn!.time)}
                  </span>
                </div>
              )}

              {todayRecord?.checkOut && (
                <div className="flex flex-col items-center z-10">
                  <div className="w-16 h-16 rounded-full bg-emerald-500/20 border-2 border-emerald-400 flex items-center justify-center mb-2">
                    <CheckCircle className="w-8 h-8 text-emerald-400" />
                  </div>
                  <p className="text-sm font-bold text-white">Shift Finished for Today</p>
                  <p className="text-xs text-white/70 mt-0.5">
                    Duration: {formatDuration(todayRecord.durationMinutes || 0)} ({todayRecord.status === 'present' ? 'Full Day' : 'Half Day'})
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-gradient-to-br from-indigo-900 to-indigo-950 rounded-3xl p-6 text-white text-center shadow-lg">
              <Camera className="w-10 h-10 mx-auto text-indigo-300 mb-2 opacity-80" />
              <h3 className="font-bold text-base">Select Your Profile Below</h3>
              <p className="text-xs text-indigo-200 mt-1">Choose your name to unlock the 1-tap selfie check-in shutter</p>
            </div>
          )}
        </div>

        {/* ─── Self-service check-in panel ─── */}
        <div id="self-service-section" className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 space-y-4">
          <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
            <Camera className="h-4 w-4 text-[#3b2fc9]" />
            Mark Your Attendance
          </h2>

          {/* Employee selector / Auto-detected user display */}
          {selectedEmployee ? (
            <div className="border border-blue-100 bg-gradient-to-br from-blue-50/60 to-white rounded-xl p-4 space-y-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-full bg-[#3b2fc9] text-white flex items-center justify-center font-bold text-base shadow-sm shrink-0">
                    {selectedEmployee.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-base font-bold text-gray-900">{selectedEmployee.name}</h3>
                      <span className="text-[11px] font-mono bg-white border border-gray-200 text-gray-600 px-2 py-0.5 rounded-md shadow-xs">
                        {selectedEmployee.employeeId}
                      </span>
                      <span className="text-[11px] font-medium bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full capitalize">
                        {selectedEmployee.location}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">{selectedEmployee.designation}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowProfileDetails(!showProfileDetails)}
                    className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:text-gray-800 bg-white hover:bg-gray-50 transition-colors text-xs flex items-center gap-1"
                    title="Toggle profile details"
                  >
                    <User className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Profile</span>
                    {showProfileDetails ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                  </button>
                  {isAdmin && (
                    <button
                      type="button"
                      onClick={() => setSelectedEmployeeId('')}
                      className="text-xs text-[#3b2fc9] hover:underline font-medium px-2 py-1"
                    >
                      Change
                    </button>
                  )}
                </div>
              </div>

              {/* Detailed Profile Grid */}
              {showProfileDetails && (
                <div className={`pt-3 border-t border-blue-100/70 grid grid-cols-2 ${isOwnerOrAdmin ? 'sm:grid-cols-4' : 'sm:grid-cols-3'} gap-3 text-xs`}>
                  {isOwnerOrAdmin && (
                    <div className="bg-white/80 p-2.5 rounded-lg border border-gray-100">
                      <span className="text-gray-400 block text-[10px] uppercase font-medium">Monthly Gross</span>
                      <span className="font-semibold text-gray-900 flex items-center gap-0.5 mt-0.5">
                        <IndianRupee className="h-3 w-3 text-emerald-600" />
                        {(selectedEmployee.monthlySalary || 0).toLocaleString('en-IN')}
                      </span>
                    </div>
                  )}

                  <div className="bg-white/80 p-2.5 rounded-lg border border-gray-100">
                    <span className="text-gray-400 block text-[10px] uppercase font-medium">Join Date</span>
                    <span className="font-semibold text-gray-900 flex items-center gap-1 mt-0.5 truncate">
                      <CalendarDays className="h-3 w-3 text-blue-500 shrink-0" />
                      {selectedEmployee.joinDate ? new Date(selectedEmployee.joinDate).toLocaleDateString('en-IN') : 'N/A'}
                    </span>
                  </div>

                  <div className="bg-white/80 p-2.5 rounded-lg border border-gray-100">
                    <span className="text-gray-400 block text-[10px] uppercase font-medium">Phone</span>
                    <span className="font-medium text-gray-800 flex items-center gap-1 mt-0.5 truncate">
                      <Phone className="h-3 w-3 text-gray-400 shrink-0" />
                      {selectedEmployee.phone || 'Not added'}
                    </span>
                  </div>

                  <div className="bg-white/80 p-2.5 rounded-lg border border-gray-100">
                    <span className="text-gray-400 block text-[10px] uppercase font-medium">Email</span>
                    <span className="font-medium text-gray-800 flex items-center gap-1 mt-0.5 truncate">
                      <Mail className="h-3 w-3 text-gray-400 shrink-0" />
                      {selectedEmployee.email || 'Not added'}
                    </span>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                {isAdmin ? 'Select Employee' : 'Select your name to view profile & mark attendance'}
              </label>
              <select
                value={selectedEmployeeId}
                onChange={(e) => setSelectedEmployeeId(e.target.value)}
                suppressHydrationWarning
                className="w-full h-10 px-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#3b2fc9]/20 focus:border-[#3b2fc9] bg-white"
              >
                <option value="">-- Choose your name --</option>
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name} ({e.employeeId} • {e.location === 'hyderabad' ? 'HYD' : 'BLR'})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Loading indicator */}
          {isLoadingEmployee && (
            <div className="flex items-center gap-2 text-sm text-gray-400">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading…
            </div>
          )}

          {/* Status card */}
          {selectedEmployee && !isLoadingEmployee && (
            <>
              {/* Missed Check-Out Warning Banner */}
              {missedCheckouts.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                  <div className="text-xs">
                    <p className="font-bold text-amber-900">Pending Check-Out Notice</p>
                    <p className="text-amber-700 mt-0.5">
                      You did not check out for {missedCheckouts.map(m => new Date(m.date + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })).join(', ')}.
                      Please notify your supervisor to regularize your shift duration.
                    </p>
                  </div>
                </div>
              )}

              {/* Today's summary */}
              <div className={`rounded-xl p-4 border ${
                !todayRecord ? 'bg-gray-50 border-gray-200'
                  : todayRecord.checkOut ? 'bg-emerald-50 border-emerald-200'
                  : 'bg-blue-50 border-blue-200'
              }`}>
                {!todayRecord ? (
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-gray-700">Not checked in yet today.</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        Shift starts at {LOCATION_SHIFT_RULES[selectedEmployee.location.toLowerCase()]?.expectedStart || '06:00'} AM ·
                        <span className="font-semibold text-amber-700 ml-1">
                          Deadline: {LOCATION_SHIFT_RULES[selectedEmployee.location.toLowerCase()]?.cutoff || '06:30'} AM
                        </span>
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2 text-sm">
                        <LogIn className="h-4 w-4 text-blue-500" />
                        <span className="text-gray-600">Checked in:</span>
                        <span className="font-semibold text-gray-800">{formatTime(todayRecord.checkIn!.time)}</span>
                        {todayRecord.checkIn?.coordinates && (
                          <span className="text-xs text-gray-400 flex items-center gap-0.5">
                            <MapPin className="h-3 w-3" />
                            {todayRecord.checkIn.coordinates.lat.toFixed(4)}, {todayRecord.checkIn.coordinates.lng.toFixed(4)}
                          </span>
                        )}
                      </div>

                      {/* Late Tag */}
                      {todayRecord.isLate ? (
                        <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded-md text-xs font-bold flex items-center gap-1">
                          <Clock className="h-3 w-3" /> Late ({todayRecord.lateMinutes || 0}m after {LOCATION_SHIFT_RULES[selectedEmployee.location.toLowerCase()]?.cutoff || '06:30'})
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-md text-xs font-semibold flex items-center gap-1">
                          <CheckCircle className="h-3 w-3" /> On-Time Check-In
                        </span>
                      )}
                    </div>

                    {todayRecord.checkOut && (
                      <>
                        <div className="flex items-center gap-2 text-sm">
                          <LogOut className="h-4 w-4 text-emerald-500" />
                          <span className="text-gray-600">Checked out:</span>
                          <span className="font-semibold text-gray-800">{formatTime(todayRecord.checkOut.time)}</span>
                          {todayRecord.checkOut?.coordinates && (
                            <span className="text-xs text-gray-400 flex items-center gap-0.5">
                              <MapPin className="h-3 w-3" />
                              {todayRecord.checkOut.coordinates.lat.toFixed(4)}, {todayRecord.checkOut.coordinates.lng.toFixed(4)}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center justify-between flex-wrap gap-2 text-sm pt-1 border-t border-emerald-200/50">
                          <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4 text-amber-500" />
                            <span className="text-gray-600">Duration:</span>
                            <span className="font-semibold text-gray-800">{formatDuration(todayRecord.durationMinutes || 0)}</span>
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                              todayRecord.status === 'present' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                            }`}>
                              {todayRecord.status === 'present' ? 'Full Day' : 'Half Day'}
                            </span>
                          </div>

                          {/* Overtime Tag */}
                          {todayRecord.overtimeMinutes && todayRecord.overtimeMinutes > 0 ? (
                            <span className="px-2 py-0.5 bg-purple-100 text-purple-700 font-semibold rounded-md text-xs">
                              +{formatDuration(todayRecord.overtimeMinutes)} Overtime
                            </span>
                          ) : null}
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* Action buttons */}
              <div className="flex gap-3">
                {!todayRecord && (
                  <button
                    onClick={() => handleOpenCamera('check-in')}
                    disabled={isSubmitting}
                    className="flex-1 py-3 bg-[#3b2fc9] text-white rounded-xl text-sm font-medium hover:bg-[#3b2fc9]/90 disabled:opacity-50 flex items-center justify-center gap-2 shadow-sm"
                  >
                    {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
                    Check In
                  </button>
                )}
                {todayRecord && !todayRecord.checkOut && (
                  <button
                    onClick={() => handleOpenCamera('check-out')}
                    disabled={isSubmitting}
                    className="flex-1 py-3 bg-emerald-600 text-white rounded-xl text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 flex items-center justify-center gap-2 shadow-sm"
                  >
                    {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
                    Check Out
                  </button>
                )}
                {todayRecord?.checkOut && (
                  <div className="flex-1 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-500 flex items-center justify-center gap-2">
                    <CheckCircle className="h-4 w-4 text-emerald-500" />
                    Shift complete for today
                  </div>
                )}
              </div>

              {/* Selfie previews */}
              {(todayRecord?.checkIn?.selfieUrl || todayRecord?.checkOut?.selfieUrl) && (
                <div className="flex gap-3">
                  {todayRecord?.checkIn?.selfieUrl && (
                    <div className="text-center">
                      <img src={todayRecord.checkIn.selfieUrl} alt="Check-in selfie" className="h-20 w-20 rounded-xl object-cover border-2 border-blue-200" />
                      <p className="text-[10px] text-gray-400 mt-1">Check-in</p>
                    </div>
                  )}
                  {todayRecord?.checkOut?.selfieUrl && (
                    <div className="text-center">
                      <img src={todayRecord.checkOut.selfieUrl} alt="Check-out selfie" className="h-20 w-20 rounded-xl object-cover border-2 border-emerald-200" />
                      <p className="text-[10px] text-gray-400 mt-1">Check-out</p>
                    </div>
                  )}
                </div>
              )}

              {/* Monthly Attendance History for Employee */}
              <div className="pt-5 border-t border-gray-100 space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-1.5">
                      <CalendarDays className="h-3.5 w-3.5 text-[#3b2fc9]" />
                      My Monthly Attendance & Payroll Summary
                    </h3>
                    <p className="text-[11px] text-gray-400">
                      Calculated for {selectedMonth} ({myMonthlySummary.totalDaysInMonth} total days)
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="month"
                      value={selectedMonth}
                      onChange={(e) => setSelectedMonth(e.target.value)}
                      className="h-8 px-2.5 text-xs border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-[#3b2fc9]"
                    />
                    {isOwnerOrAdmin && (
                      <button
                        type="button"
                        onClick={exportMyMonthlyExcel}
                        disabled={myMonthlyRecords.length === 0}
                        className="h-8 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white text-xs font-medium flex items-center gap-1.5 shadow-xs transition-colors"
                        title="Download Excel report"
                      >
                        <FileSpreadsheet className="h-3.5 w-3.5" />
                        Export Excel
                      </button>
                    )}
                  </div>
                </div>

                {/* Monthly Aggregates & Payout Card */}
                <div className={`grid grid-cols-2 ${isOwnerOrAdmin ? 'sm:grid-cols-5' : 'sm:grid-cols-4'} gap-2.5 pt-1`}>
                  <div className="bg-blue-50/70 border border-blue-100 rounded-xl p-2.5">
                    <span className="text-[10px] uppercase font-bold text-blue-700 block">Total Days</span>
                    <span className="text-lg font-bold text-blue-900">{myMonthlySummary.totalDaysInMonth}</span>
                    <span className="text-[10px] text-blue-600 block mt-0.5">{myMonthlyRecords.length} logged</span>
                  </div>

                  <div className="bg-emerald-50/70 border border-emerald-100 rounded-xl p-2.5">
                    <span className="text-[10px] uppercase font-bold text-emerald-700 block">Full Days</span>
                    <span className="text-lg font-bold text-emerald-900">{myMonthlySummary.presentDays}</span>
                    <span className="text-[10px] text-emerald-600 block mt-0.5">1.0 credit/day</span>
                  </div>

                  <div className="bg-amber-50/70 border border-amber-100 rounded-xl p-2.5">
                    <span className="text-[10px] uppercase font-bold text-amber-700 block">Half Days</span>
                    <span className="text-lg font-bold text-amber-900">{myMonthlySummary.halfDays}</span>
                    <span className="text-[10px] text-amber-600 block mt-0.5">0.5 credit/day</span>
                  </div>

                  <div className="bg-red-50/70 border border-red-100 rounded-xl p-2.5">
                    <span className="text-[10px] uppercase font-bold text-red-700 block">Absent Days</span>
                    <span className="text-lg font-bold text-red-900">{myMonthlySummary.absentDays}</span>
                    <span className="text-[10px] text-red-600 block mt-0.5">Unworked days</span>
                  </div>

                  {isOwnerOrAdmin && (
                    <div className="col-span-2 sm:col-span-1 bg-purple-50/80 border border-purple-100 rounded-xl p-2.5">
                      <span className="text-[10px] uppercase font-bold text-purple-700 block">Estimated Payout</span>
                      <span className="text-lg font-bold text-purple-900 flex items-center gap-0.5">
                        <IndianRupee className="h-4 w-4" />
                        {myMonthlySummary.payableAmount.toLocaleString('en-IN')}
                      </span>
                      <span className="text-[10px] text-purple-600 block mt-0.5">
                        {myMonthlySummary.effectivePaidDays} paid days
                      </span>
                    </div>
                  )}
                </div>

                {isLoadingMonthly ? (
                  <div className="py-6 flex justify-center text-gray-400">
                    <Loader2 className="h-5 w-5 animate-spin" />
                  </div>
                ) : myMonthlyRecords.length === 0 ? (
                  <div className="py-6 bg-gray-50 rounded-xl text-center border border-dashed border-gray-200 text-xs text-gray-400">
                    No attendance logs found for {selectedMonth}.
                  </div>
                ) : (
                  <div className="divide-y divide-gray-100 border border-gray-100 rounded-xl overflow-hidden bg-white">
                    {myMonthlyRecords.map((r) => (
                      <div key={r.id || r.date} className="p-3 flex items-center justify-between gap-3 text-xs hover:bg-gray-50/80 transition-colors">
                        <div className="min-w-0">
                          <p className="font-semibold text-gray-900">
                            {new Date(r.date + 'T00:00:00').toLocaleDateString('en-IN', {
                              weekday: 'short',
                              day: 'numeric',
                              month: 'short',
                            })}
                          </p>
                          <div className="flex items-center gap-3 text-[11px] text-gray-500 mt-0.5 flex-wrap">
                            {r.checkIn && <span>In: {formatTime(r.checkIn.time)}</span>}
                            {r.checkOut ? (
                              <span>Out: {formatTime(r.checkOut.time)}</span>
                            ) : (
                              <span className="text-amber-600 font-medium">Out: Pending</span>
                            )}
                            {r.durationMinutes && (
                              <span className="font-medium text-gray-700">({formatDuration(r.durationMinutes)})</span>
                            )}
                            {r.isLate && (
                              <span className="text-[10px] text-red-600 font-semibold bg-red-50 px-1.5 py-0.2 rounded">
                                Late (+{r.lateMinutes || 0}m)
                              </span>
                            )}
                            {r.overtimeMinutes && r.overtimeMinutes > 0 ? (
                              <span className="text-[10px] text-purple-600 font-semibold bg-purple-50 px-1.5 py-0.2 rounded">
                                +{formatDuration(r.overtimeMinutes)} OT
                              </span>
                            ) : null}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {r.checkIn?.selfieUrl && (
                            <img
                              src={r.checkIn.selfieUrl}
                              alt="In"
                              className="h-7 w-7 rounded-full object-cover border border-gray-200"
                              title="Check-in selfie"
                            />
                          )}
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                              r.status === 'present'
                                ? 'bg-emerald-100 text-emerald-700'
                                : r.status === 'half-day'
                                ? 'bg-amber-100 text-amber-700'
                                : r.status === 'missed-checkout'
                                ? 'bg-amber-100 text-amber-800 border border-amber-200'
                                : 'bg-red-100 text-red-600'
                            }`}
                          >
                            {r.status === 'present'
                              ? 'Full Day'
                              : r.status === 'half-day'
                              ? 'Half Day'
                              : r.status === 'missed-checkout'
                              ? 'Pending Check-Out'
                              : 'Absent'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* ─── Admin Panel ─── */}
        {isAdmin && (
          <div id="admin-management-panel" className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden scroll-mt-20">
            {/* Admin tabs */}
            <div className="flex border-b border-gray-100">
              <button
                onClick={() => setAdminTab('today')}
                className={`flex-1 py-3 text-sm font-medium transition-colors ${
                  adminTab === 'today' ? 'text-[#3b2fc9] border-b-2 border-[#3b2fc9]' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Today ({displayTodayAll.length})
              </button>
              <button
                onClick={() => setAdminTab('history')}
                className={`flex-1 py-3 text-sm font-medium transition-colors ${
                  adminTab === 'history' ? 'text-[#3b2fc9] border-b-2 border-[#3b2fc9]' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                History Logs
              </button>
              {isOwnerOrAdmin && (
                <button
                  onClick={() => setAdminTab('payroll')}
                  className={`flex-1 py-3 text-sm font-medium transition-colors flex items-center justify-center gap-1.5 ${
                    adminTab === 'payroll' ? 'text-[#3b2fc9] border-b-2 border-[#3b2fc9]' : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <Calculator className="h-4 w-4" />
                  Staff Salaries & Advances
                </button>
              )}
            </div>

            {adminTab === 'today' && (
              <div className="p-4 space-y-3">
                {isOwnerOrAdmin && (
                  <div className="flex items-center gap-2">
                    <label className="text-xs font-semibold text-gray-600">Company Site:</label>
                    <select
                      value={adminSiteFilter}
                      onChange={(e) => setAdminSiteFilter(e.target.value)}
                      className="h-8 px-2.5 text-xs border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-[#3b2fc9]"
                    >
                      <option value="all">All Sites</option>
                      {SITE_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>
                )}
                {isLoadingAdmin ? (
                  <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>
                ) : displayTodayAll.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-8">No attendance marked today yet.</p>
                ) : (
                  <div className="space-y-3">
                    {displayTodayAll.map((rec) => (
                      <AdminAttendanceCard
                        key={rec.id}
                        record={rec}
                        isExpanded={expandedRecord === rec.id}
                        onToggle={() => setExpandedRecord(expandedRecord === rec.id ? null : rec.id!)}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}

            {adminTab === 'history' && (
              <div className="p-4 space-y-4">
                {/* Date range picker */}
                <div className="flex flex-col sm:flex-row gap-3">
                  {isOwnerOrAdmin && (
                    <div className="flex-1">
                      <label className="block text-xs font-medium text-gray-500 mb-1">Company Site</label>
                      <select
                        value={adminSiteFilter}
                        onChange={(e) => setAdminSiteFilter(e.target.value)}
                        className="w-full h-9 px-3 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#3b2fc9]/20 focus:border-[#3b2fc9] bg-white"
                      >
                        <option value="all">All Sites</option>
                        {SITE_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    </div>
                  )}
                  <div className="flex-1">
                    <label className="block text-xs font-medium text-gray-500 mb-1">From</label>
                    <input
                      type="date"
                      value={historyStart}
                      onChange={(e) => setHistoryStart(e.target.value)}
                      className="w-full h-9 px-3 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#3b2fc9]/20 focus:border-[#3b2fc9]"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="block text-xs font-medium text-gray-500 mb-1">To</label>
                    <input
                      type="date"
                      value={historyEnd}
                      onChange={(e) => setHistoryEnd(e.target.value)}
                      className="w-full h-9 px-3 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#3b2fc9]/20 focus:border-[#3b2fc9]"
                    />
                  </div>
                  <div className="flex items-end">
                    <button
                      onClick={handleLoadHistory}
                      className="h-9 px-4 bg-[#3b2fc9] text-white rounded-lg text-sm font-medium hover:bg-[#3b2fc9]/90"
                    >
                      Load
                    </button>
                  </div>
                </div>

                {isLoadingHistory && (
                  <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>
                )}

                {!isLoadingHistory && historyByDate.map(([date, recs]) => (
                  <div key={date}>
                    <p className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wider">
                      {new Date(date + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}
                      <span className="ml-2 text-[#3b2fc9]">{recs.length} record{recs.length !== 1 ? 's' : ''}</span>
                    </p>
                    <div className="space-y-2">
                      {recs.map((rec) => (
                        <AdminAttendanceCard
                          key={rec.id}
                          record={rec}
                          isExpanded={expandedRecord === rec.id}
                          onToggle={() => setExpandedRecord(expandedRecord === rec.id ? null : rec.id!)}
                        />
                      ))}
                    </div>
                  </div>
                ))}

                {!isLoadingHistory && historyByDate.length === 0 && historyRecords.length === 0 && historyStart && (
                  <p className="text-sm text-gray-400 text-center py-8">Click 'Load' to fetch attendance records for the selected range.</p>
                )}
              </div>
            )}

            {/* ─── Admin Payroll & Advances Tab ─── */}
            {isOwnerOrAdmin && adminTab === 'payroll' && (
              <div className="p-4 space-y-4">
                {/* Header controls */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-gray-50/80 p-3.5 rounded-xl border border-gray-200">
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-2">
                      <label className="text-xs font-semibold text-gray-600">Payroll Month:</label>
                      <input
                        type="month"
                        value={adminPayrollMonth}
                        onChange={(e) => setAdminPayrollMonth(e.target.value)}
                        className="h-8 px-2.5 text-xs border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-[#3b2fc9]"
                      />
                    </div>

                    {isOwnerOrAdmin && (
                      <div className="flex items-center gap-2">
                        <label className="text-xs font-semibold text-gray-600">Company Site:</label>
                        <select
                          value={adminSiteFilter}
                          onChange={(e) => setAdminSiteFilter(e.target.value)}
                          className="h-8 px-2.5 text-xs border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-[#3b2fc9]"
                        >
                          <option value="all">All Sites</option>
                          {SITE_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>

                  {isOwnerOrAdmin && (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={exportAdminPayrollExcel}
                        disabled={isLoadingPayroll}
                        className="h-8 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-medium flex items-center gap-1.5 shadow-xs transition-colors"
                      >
                        <FileSpreadsheet className="h-3.5 w-3.5" />
                        Export Company Payroll (.xlsx)
                      </button>
                    </div>
                  )}
                </div>

                {isLoadingPayroll ? (
                  <div className="py-12 flex justify-center text-gray-400">
                    <Loader2 className="h-6 w-6 animate-spin" />
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Employee Salary Mobile Cards (md:hidden) */}
                    <div className="md:hidden space-y-3">
                      {payrollEmployees.length === 0 ? (
                        <div className="p-8 text-center text-sm text-gray-400 bg-white rounded-xl border border-gray-200">
                          No active employees found for the selected site.
                        </div>
                      ) : (
                        payrollEmployees.map((emp) => {
                          const empRecords = adminPayrollRecords.filter(r => r.employeeDocId === emp.id || r.employeeId === emp.employeeId);
                          const totalDaysInMonth = getDaysInMonth(adminPayrollMonth);
                          let presentDays = 0;
                          let halfDays = 0;
                          let lateDays = 0;

                          empRecords.forEach(r => {
                            if (r.status === 'present') presentDays++;
                            else if (r.status === 'half-day' || r.status === 'missed-checkout') halfDays++;
                            if (r.isLate) lateDays++;
                          });

                          const effectivePaidDays = presentDays + 0.5 * halfDays;
                          const gross = emp.monthlySalary || 0;
                          const attendanceEarned = totalDaysInMonth > 0 
                            ? Math.round((effectivePaidDays / totalDaysInMonth) * gross)
                            : 0;

                          const empAdvances = adminAdvances.filter(a => a.employeeDocId === emp.id || a.employeeId === emp.employeeId);
                          const advancesTotal = empAdvances.reduce((sum, a) => sum + (a.amount || 0), 0);
                          const netPayable = Math.max(0, attendanceEarned - advancesTotal);
                          const existingPayment = adminPayments.find(p => p.employeeDocId === emp.id || p.employeeId === emp.employeeId);
                          const sId = resolveSiteId(emp.siteId);

                          const summaryObj = {
                            totalDaysInMonth,
                            presentDays,
                            halfDays,
                            absentDays: Math.max(0, totalDaysInMonth - presentDays - halfDays),
                            effectivePaidDays,
                            attendanceEarned,
                            advancesTotal,
                            netPayable,
                          };

                          return (
                            <div key={emp.id} className="bg-white border border-gray-200 rounded-xl p-4 shadow-xs space-y-3">
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <h4 className="font-bold text-gray-900 text-sm truncate">{emp.name}</h4>
                                    <span className={`text-[10px] px-1.5 py-0.2 rounded font-semibold border ${
                                      sId === 'dsm'
                                        ? 'bg-cyan-50 text-cyan-800 border-cyan-200'
                                        : sId === 'ntt_data'
                                        ? 'bg-amber-50 text-amber-800 border-amber-200'
                                        : 'bg-indigo-50 text-[#3b2fc9] border-indigo-200'
                                    }`}>
                                      {sId === 'dsm' ? 'DSM' : sId === 'ntt_data' ? 'NTT Data' : 'NewRelic'}
                                    </span>
                                  </div>
                                  <p className="text-xs text-gray-400 mt-0.5">
                                    {emp.employeeId} · <span className="capitalize">{emp.location}</span>
                                  </p>
                                </div>
                              {existingPayment ? (
                                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 flex items-center gap-1 shrink-0">
                                  <CheckCircle className="h-3 w-3" /> Paid
                                </span>
                              ) : (
                                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-gray-100 text-gray-600 shrink-0">
                                  Pending
                                </span>
                              )}
                            </div>

                            {/* Metrics Grid */}
                            <div className="grid grid-cols-2 gap-2 text-xs bg-gray-50/80 p-2.5 rounded-lg border border-gray-100">
                              <div>
                                <span className="text-[10px] text-gray-400 font-semibold uppercase block">Gross / Earned</span>
                                <span className="text-gray-500 font-medium">₹{gross.toLocaleString('en-IN')}</span>
                                <span className="text-gray-900 font-bold block">₹{attendanceEarned.toLocaleString('en-IN')}</span>
                              </div>
                              <div className="text-right">
                                <span className="text-[10px] text-gray-400 font-semibold uppercase block">Advances</span>
                                <span className={`font-semibold ${advancesTotal > 0 ? 'text-red-600' : 'text-gray-400'}`}>
                                  {advancesTotal > 0 ? `-₹${advancesTotal.toLocaleString('en-IN')}` : '₹0'}
                                </span>
                                {advancesTotal > 0 && (
                                  <span className="text-[10px] text-gray-400 block">({empAdvances.length} adv)</span>
                                )}
                              </div>
                            </div>

                            {/* Net Payable & Attendance row */}
                            <div className="flex items-center justify-between pt-1">
                              <div>
                                <span className="text-[10px] text-gray-400 uppercase font-semibold block">Net Payable</span>
                                <span className="text-base font-extrabold text-[#3b2fc9]">
                                  ₹{netPayable.toLocaleString('en-IN')}
                                </span>
                              </div>
                              <div className="text-right">
                                <span className="text-[11px] font-medium text-emerald-700">{presentDays} Full</span> · 
                                <span className="text-[11px] font-medium text-amber-700 ml-1">{halfDays} Half</span>
                                <span className="text-[10px] text-gray-400 block">{effectivePaidDays}/{totalDaysInMonth} paid days</span>
                              </div>
                            </div>

                            {/* Action Buttons */}
                            <div className="flex gap-2 pt-1 border-t border-gray-100">
                              <button
                                type="button"
                                onClick={() => {
                                  setAdvanceModalEmployee(emp);
                                  setAdvanceAmount(0);
                                  setAdvanceReason('');
                                }}
                                className="flex-1 py-2 rounded-lg border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-800 text-xs font-medium transition-colors text-center"
                              >
                                + Advance
                              </button>

                              {!existingPayment ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setPayModalData({ employee: emp, summary: summaryObj });
                                    setPayPaymentMode('bank_transfer');
                                    setPayReferenceNote('');
                                  }}
                                  className="flex-1 py-2 rounded-lg bg-[#3b2fc9] hover:bg-[#2d23a0] text-white text-xs font-medium transition-colors text-center shadow-xs"
                                >
                                  Pay Salary
                                </button>
                              ) : (
                                <div className="flex-1 py-2 rounded-lg bg-gray-50 border border-gray-200 text-gray-400 text-xs text-center">
                                  Paid on {existingPayment.paymentDate}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      }))}
                    </div>

                    {/* Desktop Employee Salary Table (hidden md:block) */}
                    <div className="hidden md:block border border-gray-200 rounded-xl overflow-hidden bg-white shadow-xs">
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs min-w-[760px]">
                          <thead className="bg-gray-50 border-b border-gray-200 text-gray-600 font-semibold uppercase tracking-wider text-[10px]">
                            <tr>
                              <th className="p-3">Employee</th>
                              <th className="p-3">Gross Salary</th>
                              <th className="p-3">Attendance Stats</th>
                              <th className="p-3">Earned Salary</th>
                              <th className="p-3">Advances Deducted</th>
                              <th className="p-3">Net Payable</th>
                              <th className="p-3">Status</th>
                              <th className="p-3 text-right">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {payrollEmployees.length === 0 ? (
                              <tr>
                                <td colSpan={8} className="p-8 text-center text-sm text-gray-400">
                                  No active employees found for the selected site.
                                </td>
                              </tr>
                            ) : (
                              payrollEmployees.map((emp) => {
                                const empRecords = adminPayrollRecords.filter(r => r.employeeDocId === emp.id || r.employeeId === emp.employeeId);
                                const totalDaysInMonth = getDaysInMonth(adminPayrollMonth);
                                let presentDays = 0;
                                let halfDays = 0;
                                let lateDays = 0;

                                empRecords.forEach(r => {
                                  if (r.status === 'present') presentDays++;
                                  else if (r.status === 'half-day' || r.status === 'missed-checkout') halfDays++;
                                  if (r.isLate) lateDays++;
                                });

                                const effectivePaidDays = presentDays + 0.5 * halfDays;
                                const gross = emp.monthlySalary || 0;
                                const attendanceEarned = totalDaysInMonth > 0 
                                  ? Math.round((effectivePaidDays / totalDaysInMonth) * gross)
                                  : 0;

                                const empAdvances = adminAdvances.filter(a => a.employeeDocId === emp.id || a.employeeId === emp.employeeId);
                                const advancesTotal = empAdvances.reduce((sum, a) => sum + (a.amount || 0), 0);
                                const netPayable = Math.max(0, attendanceEarned - advancesTotal);
                                const existingPayment = adminPayments.find(p => p.employeeDocId === emp.id || p.employeeId === emp.employeeId);
                                const sId = resolveSiteId(emp.siteId);

                                const summaryObj = {
                                  totalDaysInMonth,
                                  presentDays,
                                  halfDays,
                                  absentDays: Math.max(0, totalDaysInMonth - presentDays - halfDays),
                                  effectivePaidDays,
                                  attendanceEarned,
                                  advancesTotal,
                                  netPayable,
                                };

                                return (
                                  <tr key={emp.id} className="hover:bg-gray-50/70 transition-colors">
                                    <td className="p-3">
                                      <div className="flex items-center gap-1.5 flex-wrap">
                                        <p className="font-bold text-gray-900">{emp.name}</p>
                                        <span className={`text-[10px] px-1.5 py-0.2 rounded font-semibold border ${
                                          sId === 'dsm'
                                            ? 'bg-cyan-50 text-cyan-800 border-cyan-200'
                                            : sId === 'ntt_data'
                                            ? 'bg-amber-50 text-amber-800 border-amber-200'
                                            : 'bg-indigo-50 text-[#3b2fc9] border-indigo-200'
                                        }`}>
                                          {sId === 'dsm' ? 'DSM' : sId === 'ntt_data' ? 'NTT Data' : 'NewRelic'}
                                        </span>
                                      </div>
                                      <p className="text-[11px] text-gray-400">
                                        {emp.employeeId} · <span className="capitalize">{emp.location}</span>
                                      </p>
                                    </td>

                                    <td className="p-3 font-semibold text-gray-800">
                                      ₹{gross.toLocaleString('en-IN')}
                                    </td>

                                    <td className="p-3">
                                      <div className="text-[11px] text-gray-600">
                                        <span className="font-medium text-emerald-700">{presentDays} Full</span> · 
                                        <span className="font-medium text-amber-700 ml-1">{halfDays} Half</span>
                                        <span className="block text-[10px] text-gray-400">
                                          = {effectivePaidDays} / {totalDaysInMonth} paid days
                                          {lateDays > 0 && ` (${lateDays} late)`}
                                        </span>
                                      </div>
                                    </td>

                                    <td className="p-3 font-semibold text-gray-900">
                                      ₹{attendanceEarned.toLocaleString('en-IN')}
                                    </td>

                                    <td className="p-3">
                                      {advancesTotal > 0 ? (
                                        <span className="text-red-600 font-semibold">
                                          -₹{advancesTotal.toLocaleString('en-IN')}
                                          <span className="block text-[10px] text-gray-400 font-normal">({empAdvances.length} advance{empAdvances.length > 1 ? 's' : ''})</span>
                                        </span>
                                      ) : (
                                        <span className="text-gray-400">₹0</span>
                                      )}
                                    </td>

                                    <td className="p-3">
                                      <span className="text-sm font-extrabold text-[#3b2fc9]">
                                        ₹{netPayable.toLocaleString('en-IN')}
                                      </span>
                                    </td>

                                    <td className="p-3">
                                      {existingPayment ? (
                                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 flex items-center gap-1 w-fit">
                                          <CheckCircle className="h-3 w-3" /> Paid
                                        </span>
                                      ) : (
                                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-gray-100 text-gray-600 w-fit">
                                          Pending
                                        </span>
                                      )}
                                    </td>

                                    <td className="p-3 text-right">
                                      <div className="flex items-center justify-end gap-1.5">
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setAdvanceModalEmployee(emp);
                                            setAdvanceAmount(0);
                                            setAdvanceReason('');
                                          }}
                                          className="px-2.5 py-1 rounded-lg border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-800 text-[11px] font-medium transition-colors"
                                        >
                                          + Advance
                                        </button>

                                        {!existingPayment ? (
                                          <button
                                            type="button"
                                            onClick={() => {
                                              setPayModalData({ employee: emp, summary: summaryObj });
                                              setPayPaymentMode('bank_transfer');
                                              setPayReferenceNote('');
                                            }}
                                            className="px-2.5 py-1 rounded-lg bg-[#3b2fc9] hover:bg-[#2d23a0] text-white text-[11px] font-medium transition-colors shadow-xs"
                                          >
                                            Pay Salary
                                          </button>
                                        ) : (
                                          <span className="text-[10px] text-gray-400 italic">
                                            {existingPayment.paymentDate}
                                          </span>
                                        )}
                                      </div>
                                    </td>
                                  </tr>
                                );
                              })
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Salary Advances Log Sub-Section */}
                    <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-bold text-gray-800 uppercase tracking-wider flex items-center gap-1.5">
                          <IndianRupee className="h-3.5 w-3.5 text-amber-600" />
                          Recorded Advances in {adminPayrollMonth} ({adminAdvances.length})
                        </h4>
                      </div>

                      {adminAdvances.length === 0 ? (
                        <p className="text-xs text-gray-400 py-2">No advances recorded for this month.</p>
                      ) : (
                        <div className="divide-y divide-gray-100 text-xs">
                          {adminAdvances.map((adv) => (
                            <div key={adv.id} className="py-2.5 flex items-center justify-between gap-3">
                              <div>
                                <span className="font-semibold text-gray-900">{adv.employeeName}</span>
                                <span className="text-gray-500 ml-2">₹{adv.amount.toLocaleString('en-IN')}</span>
                                <span className="text-[10px] text-gray-400 ml-2 uppercase">({adv.paymentMode})</span>
                                {adv.reason && <span className="text-gray-400 block text-[11px]">Note: {adv.reason}</span>}
                              </div>
                              <div className="flex items-center gap-3">
                                <span className="text-[11px] text-gray-400">{adv.date}</span>
                                <button
                                  type="button"
                                  onClick={async () => {
                                    if (confirm(`Delete advance of ₹${adv.amount} for ${adv.employeeName}?`)) {
                                      await deleteSalaryAdvance(adv.id!);
                                      toast({ title: 'Advance removed' });
                                      loadAdminPayroll();
                                    }
                                  }}
                                  className="text-red-500 hover:text-red-700 text-[11px] hover:underline"
                                >
                                  Delete
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ─── Record Advance Modal ─── */}
      {isOwnerOrAdmin && advanceModalEmployee && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between p-4 border-b border-gray-100">
              <div>
                <h3 className="font-bold text-gray-900 text-sm">Record Salary Advance</h3>
                <p className="text-xs text-gray-500">{advanceModalEmployee.name} ({advanceModalEmployee.employeeId})</p>
              </div>
              <button
                type="button"
                onClick={() => setAdvanceModalEmployee(null)}
                className="text-gray-400 hover:text-gray-600 text-sm p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveAdvance} className="p-4 space-y-3.5 text-xs">
              <div>
                <label className="block font-medium text-gray-700 mb-1">Advance Amount (INR) *</label>
                <div className="relative">
                  <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                  <input
                    type="number"
                    min="1"
                    required
                    value={advanceAmount || ''}
                    onChange={(e) => setAdvanceAmount(Number(e.target.value))}
                    className="w-full h-9 pl-8 pr-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#3b2fc9]/20 focus:border-[#3b2fc9]"
                    placeholder="e.g. 5000"
                  />
                </div>
              </div>

              <div>
                <label className="block font-medium text-gray-700 mb-1">Payment Mode</label>
                <select
                  value={advancePaymentMode}
                  onChange={(e) => setAdvancePaymentMode(e.target.value as any)}
                  suppressHydrationWarning
                  className="w-full h-9 px-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#3b2fc9]/20 focus:border-[#3b2fc9] bg-white"
                >
                  <option value="upi">UPI / GPay</option>
                  <option value="bank_transfer">Bank Transfer / NEFT</option>
                  <option value="cash">Cash</option>
                </select>
              </div>

              <div>
                <label className="block font-medium text-gray-700 mb-1">Reason / Note (Optional)</label>
                <input
                  type="text"
                  value={advanceReason}
                  onChange={(e) => setAdvanceReason(e.target.value)}
                  className="w-full h-9 px-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#3b2fc9]/20 focus:border-[#3b2fc9]"
                  placeholder="e.g. Medical emergency advance"
                />
              </div>

              <div className="p-3 bg-amber-50 rounded-lg border border-amber-200 text-amber-800 text-[11px]">
                ℹ️ This advance will be automatically deducted from the employee's {adminPayrollMonth} salary calculation.
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setAdvanceModalEmployee(null)}
                  className="flex-1 py-2 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingAdvance}
                  className="flex-1 py-2 bg-[#3b2fc9] hover:bg-[#2d23a0] disabled:opacity-50 text-white rounded-lg font-bold"
                >
                  {isSubmittingAdvance ? 'Saving…' : 'Record Advance'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── Pay Salary Modal ─── */}
      {isOwnerOrAdmin && payModalData && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between p-4 border-b border-gray-100">
              <div>
                <h3 className="font-bold text-gray-900 text-sm">Disburse Salary Payment</h3>
                <p className="text-xs text-gray-500">{payModalData.employee.name} · {adminPayrollMonth}</p>
              </div>
              <button
                type="button"
                onClick={() => setPayModalData(null)}
                className="text-gray-400 hover:text-gray-600 text-sm p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveSalaryPayment} className="p-4 space-y-3.5 text-xs">
              {/* Computation Breakdown */}
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 space-y-1.5">
                <div className="flex justify-between text-gray-600">
                  <span>Monthly Gross:</span>
                  <span className="font-medium">₹{(payModalData.employee.monthlySalary || 0).toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>Attendance Credit:</span>
                  <span>{payModalData.summary.effectivePaidDays} / {payModalData.summary.totalDaysInMonth} days</span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>Earned by Attendance:</span>
                  <span className="font-medium">₹{payModalData.summary.attendanceEarned.toLocaleString('en-IN')}</span>
                </div>
                {payModalData.summary.advancesTotal > 0 && (
                  <div className="flex justify-between text-red-600">
                    <span>Less Advances Deducted:</span>
                    <span className="font-medium">-₹{payModalData.summary.advancesTotal.toLocaleString('en-IN')}</span>
                  </div>
                )}
                <div className="pt-2 border-t border-gray-200 flex justify-between font-bold text-sm text-gray-900">
                  <span>Net Payable Amount:</span>
                  <span className="text-[#3b2fc9]">₹{payModalData.summary.netPayable.toLocaleString('en-IN')}</span>
                </div>
              </div>

              <div>
                <label className="block font-medium text-gray-700 mb-1">Disbursement Mode</label>
                <select
                  value={payPaymentMode}
                  onChange={(e) => setPayPaymentMode(e.target.value as any)}
                  suppressHydrationWarning
                  className="w-full h-9 px-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#3b2fc9]/20 focus:border-[#3b2fc9] bg-white"
                >
                  <option value="bank_transfer">Bank Transfer / NEFT</option>
                  <option value="upi">UPI / GPay / PhonePe</option>
                  <option value="cheque">Cheque</option>
                  <option value="cash">Cash</option>
                </select>
              </div>

              <div>
                <label className="block font-medium text-gray-700 mb-1">UTR / Transaction Reference (Optional)</label>
                <input
                  type="text"
                  value={payReferenceNote}
                  onChange={(e) => setPayReferenceNote(e.target.value)}
                  className="w-full h-9 px-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#3b2fc9]/20 focus:border-[#3b2fc9]"
                  placeholder="e.g. UTR #1234567890"
                />
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setPayModalData(null)}
                  className="flex-1 py-2 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingPayment}
                  className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg font-bold"
                >
                  {isSubmittingPayment ? 'Processing…' : `Confirm Pay ₹${payModalData.summary.netPayable.toLocaleString('en-IN')}`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Camera modal */}
      {showCamera && selectedEmployee && (
        <SelfieCapture
          title={cameraAction === 'check-in' ? `Check In — ${selectedEmployee.name}` : `Check Out — ${selectedEmployee.name}`}
          onCapture={handleSelfieCapture}
          onCancel={() => setShowCamera(false)}
        />
      )}
    </div>
  );
}

/* ── Admin Attendance Card ── */
function AdminAttendanceCard({
  record,
  isExpanded,
  onToggle,
}: {
  record: NewRelicAttendance;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const statusColor =
    record.status === 'present'
      ? 'bg-emerald-100 text-emerald-700'
      : record.status === 'half-day'
      ? 'bg-amber-100 text-amber-700'
      : record.status === 'missed-checkout'
      ? 'bg-amber-100 text-amber-800 border border-amber-200'
      : 'bg-red-100 text-red-600';

  return (
    <div className="border border-gray-100 rounded-xl overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 p-3 hover:bg-gray-50 text-left"
      >
        {/* Avatar */}
        <div className="h-8 w-8 rounded-full bg-[#3b2fc9]/10 flex items-center justify-center text-[#3b2fc9] font-bold text-xs shrink-0">
          {record.employeeName.charAt(0)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-medium text-gray-800 truncate">{record.employeeName}</p>
            {(() => {
              const sId = resolveSiteId(record.siteId);
              return (
                <span className={`text-[10px] px-1.5 py-0.2 rounded font-semibold border ${
                  sId === 'dsm'
                    ? 'bg-cyan-50 text-cyan-800 border-cyan-200'
                    : sId === 'ntt_data'
                    ? 'bg-amber-50 text-amber-800 border-amber-200'
                    : 'bg-indigo-50 text-[#3b2fc9] border-indigo-200'
                }`}>
                  {sId === 'dsm' ? 'DSM' : sId === 'ntt_data' ? 'NTT Data' : 'NewRelic'}
                </span>
              );
            })()}
            {record.isLate && (
              <span className="text-[10px] bg-red-100 text-red-700 px-1.5 py-0.2 rounded font-bold">
                Late (+{record.lateMinutes || 0}m)
              </span>
            )}
            {record.overtimeMinutes && record.overtimeMinutes > 0 ? (
              <span className="text-[10px] bg-purple-100 text-purple-700 px-1.5 py-0.2 rounded font-semibold">
                +{formatDuration(record.overtimeMinutes)} OT
              </span>
            ) : null}
          </div>
          <p className="text-xs text-gray-400">
            <span className="capitalize font-medium text-gray-500 mr-1.5">{record.location} ·</span>
            {record.checkIn ? `In: ${new Date(record.checkIn.time).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}` : 'Not checked in'}
            {record.checkOut ? ` · Out: ${new Date(record.checkOut.time).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}` : ''}
            {record.durationMinutes ? ` · ${formatDuration(record.durationMinutes)}` : ''}
          </p>
        </div>
        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium shrink-0 ${statusColor}`}>
          {record.status === 'present'
            ? 'Full Day'
            : record.status === 'half-day'
            ? 'Half Day'
            : record.status === 'missed-checkout'
            ? 'Pending Check-Out'
            : 'Absent'}
        </span>
      </button>

      {isExpanded && (
        <div className="border-t border-gray-100 p-3 bg-gray-50 flex flex-wrap gap-3">
          {record.checkIn?.selfieUrl && (
            <div className="text-center">
              <img src={record.checkIn.selfieUrl} alt="Check-in" className="h-24 w-24 rounded-xl object-cover border-2 border-blue-200" />
              <p className="text-[10px] text-gray-400 mt-1">Check-in selfie</p>
              {record.checkIn.coordinates && (
                <p className="text-[10px] text-gray-400">
                  <MapPin className="inline h-2.5 w-2.5" />
                  {record.checkIn.coordinates.lat.toFixed(4)}, {record.checkIn.coordinates.lng.toFixed(4)}
                </p>
              )}
            </div>
          )}
          {record.checkOut?.selfieUrl && (
            <div className="text-center">
              <img src={record.checkOut.selfieUrl} alt="Check-out" className="h-24 w-24 rounded-xl object-cover border-2 border-emerald-200" />
              <p className="text-[10px] text-gray-400 mt-1">Check-out selfie</p>
              {record.checkOut.coordinates && (
                <p className="text-[10px] text-gray-400">
                  <MapPin className="inline h-2.5 w-2.5" />
                  {record.checkOut.coordinates.lat.toFixed(4)}, {record.checkOut.coordinates.lng.toFixed(4)}
                </p>
              )}
            </div>
          )}
          {!record.checkIn?.selfieUrl && !record.checkOut?.selfieUrl && (
            <p className="text-xs text-gray-400">No selfies recorded</p>
          )}
        </div>
      )}
    </div>
  );
}

export default function AttendancePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Loader2 className="h-5 w-5 animate-spin text-[#3b2fc9]" />
            Loading attendance...
          </div>
        </div>
      }
    >
      <AttendancePageContent />
    </Suspense>
  );
}

