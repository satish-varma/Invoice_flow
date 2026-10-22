'use client';

import React, { useState, useEffect } from 'react';
import {
  CalendarDays,
  Plus,
  Trash2,
  CheckCircle2,
  XCircle,
  Clock,
  Sparkles,
  MapPin,
  Building2,
  User,
  Filter,
  Check,
  X,
  Loader2,
  Calendar,
  AlertTriangle,
} from 'lucide-react';
import { CompanyHoliday, EmployeeLeave, LeaveType, LeaveStatus } from '@/types/leave';
import { NewRelicEmployee } from '@/types/employee';
import { SiteId, SITE_OPTIONS, COMPANY_SITES, resolveSiteId } from '@/types/site';
import {
  getCompanyHolidays,
  saveCompanyHoliday,
  deleteCompanyHoliday,
  seedStandardHolidays,
  getEmployeeLeaves,
  saveEmployeeLeave,
  updateLeaveStatus,
  deleteEmployeeLeave,
} from '@/services/leaveService';
import { triggerHaptic } from '@/lib/haptics';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface Props {
  employees: NewRelicEmployee[];
  userEmail?: string | null;
  isOwnerOrAdmin: boolean;
  activeSiteFilter: string;
  onRefreshAttendance?: () => void;
}

export function LeavesAndHolidaysTab({
  employees,
  userEmail,
  isOwnerOrAdmin,
  activeSiteFilter,
  onRefreshAttendance,
}: Props) {
  const { toast } = useToast();
  const [subTab, setSubTab] = useState<'leaves' | 'holidays'>('leaves');

  // Year filter for holidays
  const [selectedYear, setSelectedYear] = useState<number>(() => new Date().getFullYear());
  const [holidays, setHolidays] = useState<CompanyHoliday[]>([]);
  const [isLoadingHolidays, setIsLoadingHolidays] = useState(false);
  const [isSeedingHolidays, setIsSeedingHolidays] = useState(false);

  // Month filter for leaves
  const [selectedMonth, setSelectedMonth] = useState<string>(() =>
    new Date().toISOString().substring(0, 7)
  );
  const [leaves, setLeaves] = useState<EmployeeLeave[]>([]);
  const [isLoadingLeaves, setIsLoadingLeaves] = useState(false);

  // Leave Modal State
  const [isLeaveModalOpen, setIsLeaveModalOpen] = useState(false);
  const [leaveEmployeeId, setLeaveEmployeeId] = useState('');
  const [leaveType, setLeaveType] = useState<LeaveType>('casual');
  const [leaveStartDate, setLeaveStartDate] = useState(() =>
    new Date().toISOString().substring(0, 10)
  );
  const [leaveEndDate, setLeaveEndDate] = useState(() =>
    new Date().toISOString().substring(0, 10)
  );
  const [leaveReason, setLeaveReason] = useState('');
  const [isSavingLeave, setIsSavingLeave] = useState(false);

  // Holiday Modal State
  const [isHolidayModalOpen, setIsHolidayModalOpen] = useState(false);
  const [holidayName, setHolidayName] = useState('');
  const [holidayDate, setHolidayDate] = useState(() =>
    new Date().toISOString().substring(0, 10)
  );
  const [holidaySite, setHolidaySite] = useState<'all' | SiteId>('all');
  const [holidayLocation, setHolidayLocation] = useState<'all' | 'hyderabad' | 'bangalore'>('all');
  const [holidayIsPaid, setHolidayIsPaid] = useState(true);
  const [isSavingHoliday, setIsSavingHoliday] = useState(false);

  // Auto-bind logged-in employee if leaveEmployeeId is empty
  useEffect(() => {
    if (!leaveEmployeeId && employees.length > 0) {
      if (userEmail) {
        const userEmailLower = userEmail.toLowerCase().trim();
        const matched = employees.find(
          (e) => e.email && e.email.toLowerCase().trim() === userEmailLower
        );
        if (matched?.id) {
          setLeaveEmployeeId(matched.id);
          return;
        }
      }
      if (employees[0]?.id) {
        setLeaveEmployeeId(employees[0].id);
      }
    }
  }, [employees, userEmail, leaveEmployeeId]);

  // Load Holidays
  const loadHolidays = async () => {
    setIsLoadingHolidays(true);
    try {
      const data = await getCompanyHolidays(selectedYear);
      setHolidays(data);
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Error loading holidays', description: e.message });
    } finally {
      setIsLoadingHolidays(false);
    }
  };

  // Load Leaves
  const loadLeaves = async () => {
    setIsLoadingLeaves(true);
    try {
      const data = await getEmployeeLeaves(selectedMonth);
      setLeaves(data);
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Error loading leaves', description: e.message });
    } finally {
      setIsLoadingLeaves(false);
    }
  };

  useEffect(() => {
    loadHolidays();
  }, [selectedYear]);

  useEffect(() => {
    loadLeaves();
  }, [selectedMonth]);

  // Seed Holidays
  const handleSeedHolidays = async () => {
    triggerHaptic('medium');
    setIsSeedingHolidays(true);
    try {
      const res = await seedStandardHolidays(selectedYear, userEmail || undefined);
      await loadHolidays();
      onRefreshAttendance?.();
      toast({
        title: 'Holidays Seeded',
        description: `Added ${res.created} official holidays for ${selectedYear} (${res.skipped} already existed).`,
      });
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Seeding failed', description: e.message });
    } finally {
      setIsSeedingHolidays(false);
    }
  };

  // Save Leave
  const handleSaveLeave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!leaveEmployeeId) {
      toast({ variant: 'destructive', title: 'Select an employee' });
      return;
    }
    const emp = employees.find((x) => x.id === leaveEmployeeId);
    if (!emp) return;

    const s = new Date(leaveStartDate);
    const end = new Date(leaveEndDate);
    if (end < s) {
      toast({ variant: 'destructive', title: 'End date cannot be earlier than start date' });
      return;
    }
    const diffTime = Math.abs(end.getTime() - s.getTime());
    const daysCount = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

    setIsSavingLeave(true);
    try {
      await saveEmployeeLeave({
        employeeDocId: emp.id || '',
        employeeId: emp.employeeId,
        employeeName: emp.name,
        siteId: resolveSiteId(emp.siteId),
        location: emp.location,
        startDate: leaveStartDate,
        endDate: leaveEndDate,
        daysCount,
        leaveType,
        status: isOwnerOrAdmin ? 'approved' : 'pending',
        reason: leaveReason.trim() || undefined,
        approvedBy: isOwnerOrAdmin ? userEmail?.split('@')[0] || 'Admin' : undefined,
      });
      await loadLeaves();
      onRefreshAttendance?.();
      setIsLeaveModalOpen(false);
      setLeaveReason('');
      toast({
        title: 'Leave Recorded',
        description: `Successfully logged ${daysCount} day(s) for ${emp.name}.`,
      });
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Failed to record leave', description: e.message });
    } finally {
      setIsSavingLeave(false);
    }
  };

  // Update Leave Status
  const handleUpdateStatus = async (id: string, status: LeaveStatus) => {
    triggerHaptic('medium');
    try {
      await updateLeaveStatus(id, status, userEmail?.split('@')[0] || 'Admin');
      await loadLeaves();
      onRefreshAttendance?.();
      toast({ title: `Leave marked as ${status}` });
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Failed to update leave', description: e.message });
    }
  };

  // Delete Leave
  const handleDeleteLeave = async (id: string) => {
    if (!confirm('Are you sure you want to delete this leave record?')) return;
    triggerHaptic('medium');
    try {
      await deleteEmployeeLeave(id);
      await loadLeaves();
      onRefreshAttendance?.();
      toast({ title: 'Leave record removed' });
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Failed to delete leave', description: e.message });
    }
  };

  // Save Custom Holiday
  const handleSaveHoliday = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!holidayName.trim()) {
      toast({ variant: 'destructive', title: 'Enter holiday name' });
      return;
    }
    setIsSavingHoliday(true);
    try {
      await saveCompanyHoliday({
        name: holidayName.trim(),
        date: holidayDate,
        siteId: holidaySite,
        location: holidayLocation,
        isPaid: holidayIsPaid,
        createdBy: userEmail?.split('@')[0] || 'Admin',
      });
      await loadHolidays();
      onRefreshAttendance?.();
      setIsHolidayModalOpen(false);
      setHolidayName('');
      toast({ title: 'Holiday Added', description: `${holidayName} on ${holidayDate} saved.` });
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Failed to save holiday', description: e.message });
    } finally {
      setIsSavingHoliday(false);
    }
  };

  // Delete Holiday
  const handleDeleteHoliday = async (id: string) => {
    if (!confirm('Delete this holiday from the calendar?')) return;
    triggerHaptic('medium');
    try {
      await deleteCompanyHoliday(id);
      await loadHolidays();
      onRefreshAttendance?.();
      toast({ title: 'Holiday removed' });
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Failed to delete holiday', description: e.message });
    }
  };

  // Filter leaves by active site if applicable
  const filteredLeaves = leaves.filter((l) => {
    if (activeSiteFilter === 'all') return true;
    return l.siteId === activeSiteFilter;
  });

  // Filter holidays by active site
  const filteredHolidays = holidays.filter((h) => {
    if (activeSiteFilter === 'all') return true;
    return h.siteId === 'all' || h.siteId === activeSiteFilter;
  });

  return (
    <div className="p-4 sm:p-6 space-y-6">
      {/* Header and Subtabs Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
        <div>
          <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
            <CalendarDays className="w-5 h-5 text-teal-600" />
            Leaves &amp; Holiday Management
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Record planned staff leaves and manage official paid public holidays affecting monthly payroll.
          </p>
        </div>

        {/* View Pill Switcher */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-2xl border border-slate-200 dark:border-slate-700 shrink-0">
          <button
            type="button"
            onClick={() => {
              triggerHaptic('light');
              setSubTab('leaves');
            }}
            className={cn(
              "px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer",
              subTab === 'leaves'
                ? "bg-white dark:bg-slate-900 text-teal-700 dark:text-teal-300 shadow-xs"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
            )}
          >
            <span>🏖️ Planned Leaves</span>
            <span className="text-[10px] bg-teal-50 dark:bg-teal-950 text-teal-700 px-1.5 py-0.2 rounded-full border border-teal-200">
              {filteredLeaves.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              triggerHaptic('light');
              setSubTab('holidays');
            }}
            className={cn(
              "px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer",
              subTab === 'holidays'
                ? "bg-white dark:bg-slate-900 text-indigo-700 dark:text-indigo-300 shadow-xs"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
            )}
          >
            <span>📅 Holiday Calendar</span>
            <span className="text-[10px] bg-indigo-50 dark:bg-indigo-950 text-[#3b2fc9] px-1.5 py-0.2 rounded-full border border-indigo-200">
              {filteredHolidays.length}
            </span>
          </button>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          SUB-TAB 1: PLANNED EMPLOYEE LEAVES
          ───────────────────────────────────────────────────────────── */}
      {subTab === 'leaves' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Month:</Label>
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="h-9 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-teal-500/20"
              />
            </div>

            <button
              type="button"
              onClick={() => {
                triggerHaptic('light');
                setIsLeaveModalOpen(true);
              }}
              className="h-10 px-4 rounded-xl bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 text-white text-xs font-bold shadow-md shadow-teal-600/20 flex items-center justify-center gap-1.5 transition-all active:scale-95 cursor-pointer"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              Record Planned Leave
            </button>
          </div>

          {isLoadingLeaves ? (
            <div className="p-12 text-center text-slate-400 flex flex-col items-center justify-center gap-2">
              <Loader2 className="w-6 h-6 animate-spin text-teal-600" />
              <span className="text-xs">Loading leave records…</span>
            </div>
          ) : filteredLeaves.length === 0 ? (
            <div className="p-8 text-center bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 text-slate-400 space-y-1">
              <p className="text-sm font-bold text-slate-700 dark:text-slate-300">No Planned Leaves for {selectedMonth}</p>
              <p className="text-xs">Click &quot;Record Planned Leave&quot; above to log casual, sick, or paid leave.</p>
            </div>
          ) : (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="px-4 py-3 font-bold text-slate-500 uppercase tracking-wider">Employee</th>
                      <th className="px-4 py-3 font-bold text-slate-500 uppercase tracking-wider">Site &amp; Location</th>
                      <th className="px-4 py-3 font-bold text-slate-500 uppercase tracking-wider">Dates</th>
                      <th className="px-4 py-3 font-bold text-slate-500 uppercase tracking-wider">Duration</th>
                      <th className="px-4 py-3 font-bold text-slate-500 uppercase tracking-wider">Type</th>
                      <th className="px-4 py-3 font-bold text-slate-500 uppercase tracking-wider">Status</th>
                      <th className="px-4 py-3 font-bold text-slate-500 uppercase tracking-wider">Reason</th>
                      <th className="px-4 py-3 font-bold text-slate-500 uppercase tracking-wider text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium text-slate-700 dark:text-slate-300">
                    {filteredLeaves.map((l) => {
                      const isApproved = l.status === 'approved';
                      const isPending = l.status === 'pending';
                      const isRejected = l.status === 'rejected';

                      return (
                        <tr key={l.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                          <td className="px-4 py-3">
                            <span className="font-bold text-slate-900 dark:text-white block">{l.employeeName}</span>
                            <span className="text-[10px] text-slate-400 font-mono">{l.employeeId}</span>
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-[11px] font-semibold block">{COMPANY_SITES[l.siteId]?.name || l.siteId}</span>
                            <span className="text-[10px] text-slate-400 capitalize">{l.location}</span>
                          </td>
                          <td className="px-4 py-3 font-mono text-[11px]">
                            {l.startDate === l.endDate ? l.startDate : `${l.startDate} → ${l.endDate}`}
                          </td>
                          <td className="px-4 py-3">
                            <span className="font-bold text-slate-900 dark:text-white">
                              {l.daysCount} Day{l.daysCount !== 1 ? 's' : ''}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={cn(
                                "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border",
                                l.leaveType === 'casual'
                                  ? "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300"
                                  : l.leaveType === 'sick'
                                  ? "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300"
                                  : l.leaveType === 'paid'
                                  ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300"
                                  : "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400"
                              )}
                            >
                              {l.leaveType}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={cn(
                                "px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border flex items-center gap-1 w-fit",
                                isApproved
                                  ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300"
                                  : isPending
                                  ? "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300"
                                  : "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300"
                              )}
                            >
                              {isApproved ? <CheckCircle2 className="w-3 h-3 text-emerald-600" /> : isPending ? <Clock className="w-3 h-3 text-amber-600" /> : <XCircle className="w-3 h-3 text-rose-600" />}
                              {l.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 max-w-[180px] truncate text-slate-500">
                            {l.reason || '—'}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-1">
                              {isPending && isOwnerOrAdmin && (
                                <>
                                  <button
                                    onClick={() => handleUpdateStatus(l.id!, 'approved')}
                                    className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer"
                                    title="Approve Leave"
                                  >
                                    <Check className="w-4 h-4 stroke-[2.5]" />
                                  </button>
                                  <button
                                    onClick={() => handleUpdateStatus(l.id!, 'rejected')}
                                    className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                                    title="Reject Leave"
                                  >
                                    <X className="w-4 h-4 stroke-[2.5]" />
                                  </button>
                                </>
                              )}
                              {isOwnerOrAdmin && (
                                <button
                                  onClick={() => handleDeleteLeave(l.id!)}
                                  className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors cursor-pointer"
                                  title="Delete Record"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          SUB-TAB 2: COMPANY HOLIDAY CALENDAR
          ───────────────────────────────────────────────────────────── */}
      {subTab === 'holidays' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Year:</Label>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="h-9 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              >
                {[selectedYear - 1, selectedYear, selectedYear + 1].map((yr) => (
                  <option key={yr} value={yr}>
                    {yr}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {isOwnerOrAdmin && (
                <button
                  type="button"
                  disabled={isSeedingHolidays}
                  onClick={handleSeedHolidays}
                  className="h-10 px-3.5 rounded-xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50/80 dark:bg-indigo-950/40 text-[#3b2fc9] dark:text-indigo-300 hover:bg-indigo-100 text-xs font-bold flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer disabled:opacity-50"
                  title="Populates official Indian public holidays for Hyderabad & Bangalore"
                >
                  {isSeedingHolidays ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="w-3.5 h-3.5 text-[#3b2fc9]" />
                  )}
                  Seed Official Holidays
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  triggerHaptic('light');
                  setIsHolidayModalOpen(true);
                }}
                className="h-10 px-4 rounded-xl bg-gradient-to-r from-indigo-600 to-[#3b2fc9] hover:from-indigo-700 hover:to-[#2e24a8] text-white text-xs font-bold shadow-md shadow-indigo-600/20 flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer"
              >
                <Plus className="w-4 h-4 stroke-[2.5]" />
                Add Custom Holiday
              </button>
            </div>
          </div>

          {isLoadingHolidays ? (
            <div className="p-12 text-center text-slate-400 flex flex-col items-center justify-center gap-2">
              <Loader2 className="w-6 h-6 animate-spin text-[#3b2fc9]" />
              <span className="text-xs">Loading holiday calendar…</span>
            </div>
          ) : filteredHolidays.length === 0 ? (
            <div className="p-8 text-center bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 text-slate-400 space-y-2">
              <p className="text-sm font-bold text-slate-700 dark:text-slate-300">No Holidays Registered for {selectedYear}</p>
              <p className="text-xs">Click &quot;Seed Official Holidays&quot; to auto-populate national and regional festival dates.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {filteredHolidays.map((h) => {
                const dt = new Date(h.date);
                const dayName = dt.toLocaleDateString('en-US', { weekday: 'short' });
                const monthName = dt.toLocaleDateString('en-US', { month: 'short' });
                const dayNum = dt.getDate();

                return (
                  <div
                    key={h.id}
                    className="p-3.5 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs flex items-center justify-between gap-3 hover:border-indigo-300 transition-all"
                  >
                    <div className="flex items-center gap-3">
                      {/* Date Badge */}
                      <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-100 dark:border-indigo-900/60 flex flex-col items-center justify-center shrink-0">
                        <span className="text-[10px] font-black uppercase text-indigo-500">{monthName}</span>
                        <span className="text-base font-black text-[#3b2fc9] dark:text-indigo-300 leading-none">
                          {dayNum}
                        </span>
                      </div>

                      <div className="min-w-0">
                        <span className="font-bold text-xs text-slate-900 dark:text-white block truncate">
                          {h.name}
                        </span>
                        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                          <span className="text-[10px] text-slate-500 font-medium">
                            {dayName} · {h.date}
                          </span>
                          <span className="text-[9px] font-black uppercase px-1.5 py-0.2 rounded-full border bg-slate-50 text-slate-600 border-slate-200">
                            {h.siteId === 'all' ? 'All Sites' : COMPANY_SITES[h.siteId]?.name || h.siteId}
                          </span>
                          <span className="text-[9px] font-black uppercase px-1.5 py-0.2 rounded-full border bg-emerald-50 text-emerald-700 border-emerald-200">
                            {h.location === 'all' ? 'All Hubs' : h.location}
                          </span>
                        </div>
                      </div>
                    </div>

                    {isOwnerOrAdmin && (
                      <button
                        onClick={() => handleDeleteHoliday(h.id!)}
                        className="p-1.5 text-slate-300 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl transition-colors cursor-pointer shrink-0"
                        title="Delete holiday"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          MODAL: RECORD PLANNED LEAVE
          ───────────────────────────────────────────────────────────── */}
      {isLeaveModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl max-w-md w-full p-6 space-y-4 animate-in fade-in zoom-in-95 duration-200 border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-teal-50 dark:bg-teal-950 text-teal-700 rounded-2xl">
                  <CalendarDays className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-slate-900 dark:text-white text-base">Record Planned Leave</h3>
                  <p className="text-xs text-slate-400">Log employee leave for automated payroll calculations</p>
                </div>
              </div>
              <button
                onClick={() => setIsLeaveModalOpen(false)}
                className="p-1.5 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveLeave} className="space-y-3.5">
              <div>
                <Label className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 block">Employee</Label>
                <select
                  value={leaveEmployeeId}
                  onChange={(e) => setLeaveEmployeeId(e.target.value)}
                  className="w-full h-11 px-3 text-xs font-semibold rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                  required
                >
                  <option value="">-- Select Employee --</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.name} ({emp.employeeId} · {COMPANY_SITES[resolveSiteId(emp.siteId)]?.name} · {emp.location.toUpperCase()})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <Label className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 block">Leave Type</Label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                  {(['casual', 'sick', 'paid', 'unpaid'] as LeaveType[]).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setLeaveType(t)}
                      className={cn(
                        "h-9 rounded-xl text-xs font-bold uppercase transition-all border cursor-pointer",
                        leaveType === t
                          ? "bg-teal-600 text-white border-teal-600 shadow-xs"
                          : "bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700"
                      )}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 block">Start Date</Label>
                  <Input
                    type="date"
                    value={leaveStartDate}
                    onChange={(e) => setLeaveStartDate(e.target.value)}
                    className="h-11 rounded-2xl text-xs font-semibold"
                    required
                  />
                </div>
                <div>
                  <Label className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 block">End Date</Label>
                  <Input
                    type="date"
                    value={leaveEndDate}
                    onChange={(e) => setLeaveEndDate(e.target.value)}
                    className="h-11 rounded-2xl text-xs font-semibold"
                    required
                  />
                </div>
              </div>

              <div>
                <Label className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 block">
                  Reason / Notes (Optional)
                </Label>
                <Input
                  type="text"
                  placeholder="e.g. Family wedding, medical rest..."
                  value={leaveReason}
                  onChange={(e) => setLeaveReason(e.target.value)}
                  className="h-11 rounded-2xl text-xs"
                />
              </div>

              <div className="flex gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsLeaveModalOpen(false)}
                  className="flex-1 h-11 rounded-2xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 transition-all active:scale-95"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingLeave}
                  className="flex-1 h-11 rounded-2xl bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 text-white text-xs font-bold shadow-md shadow-teal-600/20 flex items-center justify-center gap-1.5 transition-all active:scale-95 disabled:opacity-50"
                >
                  {isSavingLeave ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save Leave Record'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          MODAL: ADD CUSTOM HOLIDAY
          ───────────────────────────────────────────────────────────── */}
      {isHolidayModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl max-w-md w-full p-6 space-y-4 animate-in fade-in zoom-in-95 duration-200 border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-indigo-50 dark:bg-indigo-950 text-[#3b2fc9] rounded-2xl">
                  <Calendar className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-slate-900 dark:text-white text-base">Add Company Holiday</h3>
                  <p className="text-xs text-slate-400">Register site or location-specific holiday</p>
                </div>
              </div>
              <button
                onClick={() => setIsHolidayModalOpen(false)}
                className="p-1.5 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveHoliday} className="space-y-3.5">
              <div>
                <Label className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 block">Holiday Name</Label>
                <Input
                  type="text"
                  placeholder="e.g. Kannada Rajyotsava, Ramzan, Christmas..."
                  value={holidayName}
                  onChange={(e) => setHolidayName(e.target.value)}
                  className="h-11 rounded-2xl text-xs font-semibold"
                  required
                />
              </div>

              <div>
                <Label className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 block">Date</Label>
                <Input
                  type="date"
                  value={holidayDate}
                  onChange={(e) => setHolidayDate(e.target.value)}
                  className="h-11 rounded-2xl text-xs font-semibold"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 block">Site Scope</Label>
                  <select
                    value={holidaySite}
                    onChange={(e) => setHolidaySite(e.target.value as any)}
                    className="w-full h-11 px-3 text-xs font-semibold rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  >
                    <option value="all">All Sites</option>
                    {SITE_OPTIONS.map((s) => (
                      <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <Label className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 block">Location</Label>
                  <select
                    value={holidayLocation}
                    onChange={(e) => setHolidayLocation(e.target.value as any)}
                    className="w-full h-11 px-3 text-xs font-semibold rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  >
                    <option value="all">All Hubs</option>
                    <option value="hyderabad">Hyderabad Only</option>
                    <option value="bangalore">Bangalore Only</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="holiday-paid-check"
                  checked={holidayIsPaid}
                  onChange={(e) => setHolidayIsPaid(e.target.checked)}
                  className="w-4 h-4 rounded text-[#3b2fc9] focus:ring-indigo-500"
                />
                <label htmlFor="holiday-paid-check" className="text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer">
                  Paid Public Holiday (Credited into staff monthly payroll)
                </label>
              </div>

              <div className="flex gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsHolidayModalOpen(false)}
                  className="flex-1 h-11 rounded-2xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 transition-all active:scale-95"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingHoliday}
                  className="flex-1 h-11 rounded-2xl bg-gradient-to-r from-indigo-600 to-[#3b2fc9] hover:from-indigo-700 text-white text-xs font-bold shadow-md shadow-indigo-600/20 flex items-center justify-center gap-1.5 transition-all active:scale-95 disabled:opacity-50"
                >
                  {isSavingHoliday ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save Holiday'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
