import { db } from '@/lib/firebase';
import { assertWritePermission } from '@/lib/readOnlyGuard';
import {
  collection,
  getDocs,
  doc,
  setDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
  addDoc,
  updateDoc,
} from 'firebase/firestore';
import { CompanyHoliday, EmployeeLeave, LeaveStatus, LeaveType } from '@/types/leave';
import { SiteId } from '@/types/site';

const HOLIDAYS_COLLECTION = 'newrelic_holidays';
const LEAVES_COLLECTION = 'newrelic_leaves';

/* ─────────────────────────────────────────────────────────────
 * Company Holiday Calendar Service
 * ──────────────────────────────────────────────────────────── */

export async function getCompanyHolidays(
  year?: number,
  siteId?: string,
  location?: string
): Promise<CompanyHoliday[]> {
  try {
    const coll = collection(db, HOLIDAYS_COLLECTION);
    const snap = await getDocs(coll);
    let holidays: CompanyHoliday[] = [];

    snap.forEach((d) => {
      holidays.push({ id: d.id, ...d.data() } as CompanyHoliday);
    });

    // Filter by year if specified
    if (year) {
      const yearPrefix = `${year}-`;
      holidays = holidays.filter((h) => h.date && h.date.startsWith(yearPrefix));
    }

    // Filter by siteId if specified (allow 'all' or exact match)
    if (siteId && siteId !== 'all') {
      holidays = holidays.filter((h) => h.siteId === 'all' || h.siteId === siteId);
    }

    // Filter by location if specified
    if (location && location !== 'all') {
      holidays = holidays.filter((h) => h.location === 'all' || h.location === location);
    }

    // Sort chronologically
    return holidays.sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  } catch (error) {
    console.error('Error fetching holidays:', error);
    return [];
  }
}

export async function saveCompanyHoliday(
  holiday: Omit<CompanyHoliday, 'id' | 'createdAt'>,
  id?: string
): Promise<string> {
  await assertWritePermission('Saving Company Holiday');
  const coll = collection(db, HOLIDAYS_COLLECTION);
  const data = {
    ...holiday,
    updatedAt: serverTimestamp(),
  };

  if (id) {
    await updateDoc(doc(db, HOLIDAYS_COLLECTION, id), data);
    return id;
  } else {
    const docRef = await addDoc(coll, {
      ...data,
      createdAt: new Date().toISOString(),
    });
    return docRef.id;
  }
}

export async function deleteCompanyHoliday(id: string): Promise<void> {
  await assertWritePermission('Deleting Company Holiday');
  await deleteDoc(doc(db, HOLIDAYS_COLLECTION, id));
}

/** Seed official standard national and regional holidays for Hyderabad & Bangalore */
export async function seedStandardHolidays(
  year: number = new Date().getFullYear(),
  userEmail?: string
): Promise<{ created: number; skipped: number }> {
  await assertWritePermission('Seeding Company Holidays');
  const existing = await getCompanyHolidays(year);
  const existingDates = new Set(existing.map((h) => `${h.date}_${h.location}_${h.siteId}`));

  const templates: Omit<CompanyHoliday, 'id' | 'createdAt'>[] = [
    { name: 'Republic Day', date: `${year}-01-26`, siteId: 'all', location: 'all', isPaid: true },
    { name: 'May Day / Labor Day', date: `${year}-05-01`, siteId: 'all', location: 'all', isPaid: true },
    { name: 'Telangana Formation Day', date: `${year}-06-02`, siteId: 'all', location: 'hyderabad', isPaid: true },
    { name: 'Independence Day', date: `${year}-08-15`, siteId: 'all', location: 'all', isPaid: true },
    { name: 'Gandhi Jayanti', date: `${year}-10-02`, siteId: 'all', location: 'all', isPaid: true },
    { name: 'Dussehra / Vijayadashami', date: `${year}-10-12`, siteId: 'all', location: 'all', isPaid: true },
    { name: 'Karnataka Rajyotsava', date: `${year}-11-01`, siteId: 'all', location: 'bangalore', isPaid: true },
    { name: 'Diwali / Deepavali', date: `${year}-11-01`, siteId: 'all', location: 'hyderabad', isPaid: true },
    { name: 'Christmas Day', date: `${year}-12-25`, siteId: 'all', location: 'all', isPaid: true },
  ];

  let created = 0;
  let skipped = 0;

  for (const t of templates) {
    const key = `${t.date}_${t.location}_${t.siteId}`;
    if (existingDates.has(key)) {
      skipped++;
      continue;
    }
    await addDoc(collection(db, HOLIDAYS_COLLECTION), {
      ...t,
      createdBy: userEmail || 'System Seed',
      createdAt: new Date().toISOString(),
    });
    created++;
  }

  return { created, skipped };
}

/* ─────────────────────────────────────────────────────────────
 * Employee Planned Leave Service
 * ──────────────────────────────────────────────────────────── */

export async function getEmployeeLeaves(
  month?: string, // YYYY-MM
  employeeDocId?: string
): Promise<EmployeeLeave[]> {
  try {
    const coll = collection(db, LEAVES_COLLECTION);
    const snap = await getDocs(coll);
    let leaves: EmployeeLeave[] = [];

    snap.forEach((d) => {
      leaves.push({ id: d.id, ...d.data() } as EmployeeLeave);
    });

    if (employeeDocId) {
      leaves = leaves.filter((l) => l.employeeDocId === employeeDocId);
    }

    if (month) {
      // Return leaves that overlap with the month
      leaves = leaves.filter((l) => {
        if (!l.startDate || !l.endDate) return false;
        const startMonth = l.startDate.substring(0, 7);
        const endMonth = l.endDate.substring(0, 7);
        return startMonth === month || endMonth === month || (l.startDate <= `${month}-31` && l.endDate >= `${month}-01`);
      });
    }

    return leaves.sort((a, b) => (b.startDate || '').localeCompare(a.startDate || ''));
  } catch (error) {
    console.error('Error fetching employee leaves:', error);
    return [];
  }
}

export async function saveEmployeeLeave(
  leave: Omit<EmployeeLeave, 'id' | 'createdAt'>,
  id?: string
): Promise<string> {
  await assertWritePermission('Saving Employee Leave');
  const coll = collection(db, LEAVES_COLLECTION);
  const data = {
    ...leave,
    updatedAt: serverTimestamp(),
  };

  if (id) {
    await updateDoc(doc(db, LEAVES_COLLECTION, id), data);
    return id;
  } else {
    const docRef = await addDoc(coll, {
      ...data,
      createdAt: new Date().toISOString(),
    });
    return docRef.id;
  }
}

export async function updateLeaveStatus(
  id: string,
  status: LeaveStatus,
  approvedBy?: string
): Promise<void> {
  await assertWritePermission('Updating Leave Status');
  await updateDoc(doc(db, LEAVES_COLLECTION, id), {
    status,
    approvedBy: approvedBy || 'Admin',
    updatedAt: serverTimestamp(),
  });
}

export async function deleteEmployeeLeave(id: string): Promise<void> {
  await assertWritePermission('Deleting Employee Leave');
  await deleteDoc(doc(db, LEAVES_COLLECTION, id));
}

/* ─────────────────────────────────────────────────────────────
 * Accurate Payroll & Leave Attendance Adjustment Calculator
 * ──────────────────────────────────────────────────────────── */

export interface AdjustedAttendanceSummary {
  totalDaysInMonth: number;
  presentDays: number;
  halfDays: number;
  paidLeaveDays: number;
  unpaidLeaveDays: number;
  paidHolidaysCount: number;
  effectivePaidDays: number;
  absentDays: number;
  monthlyGross: number;
  earnedSalary: number;
}

export function calculateAdjustedAttendance({
  yearMonth, // YYYY-MM
  employeeDocId,
  siteId,
  location,
  monthlySalary,
  attendanceRecords,
  holidays,
  leaves,
}: {
  yearMonth: string;
  employeeDocId: string;
  siteId: SiteId;
  location: 'hyderabad' | 'bangalore';
  monthlySalary: number;
  attendanceRecords: { date: string; status: string; employeeDocId?: string }[];
  holidays: CompanyHoliday[];
  leaves: EmployeeLeave[];
}): AdjustedAttendanceSummary {
  const [y, m] = yearMonth.split('-').map(Number);
  const totalDaysInMonth = new Date(y, m, 0).getDate();

  // Filter attendance for this employee
  const myRecords = attendanceRecords.filter((r) => r.employeeDocId === employeeDocId);
  const attendedDates = new Set<string>();

  let presentDays = 0;
  let halfDays = 0;

  myRecords.forEach((r) => {
    attendedDates.add(r.date);
    if (r.status === 'present') presentDays++;
    else if (r.status === 'half-day' || r.status === 'missed-checkout') halfDays++;
  });

  // Calculate approved paid leaves in this month
  let paidLeaveDays = 0;
  let unpaidLeaveDays = 0;
  const approvedLeaves = leaves.filter(
    (l) => l.employeeDocId === employeeDocId && l.status === 'approved'
  );

  const leaveDates = new Set<string>();
  approvedLeaves.forEach((l) => {
    // Generate dates between startDate and endDate within this month
    const s = new Date(Math.max(new Date(l.startDate).getTime(), new Date(`${yearMonth}-01`).getTime()));
    const e = new Date(Math.min(new Date(l.endDate).getTime(), new Date(`${yearMonth}-${totalDaysInMonth}`).getTime()));

    for (let d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().substring(0, 10);
      if (!attendedDates.has(dateStr)) {
        leaveDates.add(dateStr);
        if (l.leaveType === 'unpaid') {
          unpaidLeaveDays++;
        } else {
          paidLeaveDays++;
        }
      }
    }
  });

  // Calculate paid holidays in this month (not overlapping with attended days or leaves)
  let paidHolidaysCount = 0;
  holidays.forEach((h) => {
    if (!h.isPaid || !h.date.startsWith(`${yearMonth}-`)) return;
    // Check site and location scope
    if (h.siteId !== 'all' && h.siteId !== siteId) return;
    if (h.location !== 'all' && h.location !== location) return;

    // Only grant paid holiday if staff didn't already work (if worked, presentDays already covers it)
    if (!attendedDates.has(h.date) && !leaveDates.has(h.date)) {
      paidHolidaysCount++;
    }
  });

  // Effective Paid Days: full days + half-days (0.5) + paid leaves + paid holidays
  const rawEffective = presentDays + 0.5 * halfDays + paidLeaveDays + paidHolidaysCount;
  const effectivePaidDays = Math.min(totalDaysInMonth, rawEffective);
  const absentDays = Math.max(0, totalDaysInMonth - effectivePaidDays);

  const earnedSalary =
    totalDaysInMonth > 0
      ? Math.round((effectivePaidDays / totalDaysInMonth) * (monthlySalary || 0))
      : 0;

  return {
    totalDaysInMonth,
    presentDays,
    halfDays,
    paidLeaveDays,
    unpaidLeaveDays,
    paidHolidaysCount,
    effectivePaidDays,
    absentDays,
    monthlyGross: monthlySalary || 0,
    earnedSalary,
  };
}
