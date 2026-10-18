import { db, storage } from '@/lib/firebase';
import { assertWritePermission } from '@/lib/readOnlyGuard';
import {
  collection,
  addDoc,
  getDocs,
  doc,
  updateDoc,
  getDoc,
  serverTimestamp,
  query,
  orderBy,
  where,
  Timestamp,
} from 'firebase/firestore';
import { ref, uploadString, getDownloadURL } from 'firebase/storage';
import { NewRelicAttendance } from '@/types/employee';

const ATTENDANCE_COLLECTION = 'newrelic_attendance';

/** Upload a base64 data-URI selfie and return the download URL */
export async function uploadSelfie(base64DataUri: string, folder: string): Promise<string> {
  await assertWritePermission('Uploading Selfie');
  const timestamp = Date.now();
  const storageRef = ref(storage, `newrelic-selfies/${folder}/${timestamp}.jpg`);
  const uploadPromise = uploadString(storageRef, base64DataUri, 'data_url');
  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('Selfie upload timed out')), 20000)
  );
  const snapshot = await Promise.race([uploadPromise, timeoutPromise]);
  return getDownloadURL(snapshot.ref);
}

/** Get today's attendance record for a given employee (by Firestore doc ID) */
export async function getTodayAttendance(
  employeeDocId: string,
  date: string
): Promise<NewRelicAttendance | null> {
  try {
    const q = query(
      collection(db, ATTENDANCE_COLLECTION),
      where('employeeDocId', '==', employeeDocId),
      where('date', '==', date)
    );
    const snap = await getDocs(q);
    if (snap.empty) return null;
    const d = snap.docs[0];
    return { id: d.id, ...d.data() } as NewRelicAttendance;
  } catch (error) {
    console.warn('Falling back for getTodayAttendance:', error);
    // Fallback: Query by employeeDocId only, then filter date in-memory
    try {
      const fallbackQuery = query(
        collection(db, ATTENDANCE_COLLECTION),
        where('employeeDocId', '==', employeeDocId)
      );
      const snap = await getDocs(fallbackQuery);
      const matched = snap.docs.find((d) => d.data().date === date);
      if (!matched) return null;
      return { id: matched.id, ...matched.data() } as NewRelicAttendance;
    } catch (e2) {
      console.error('Error fetching today attendance:', e2);
      return null;
    }
  }
}

// Shift configuration: Hyderabad starts at 6:00 AM with cutoff at 6:30 AM; 12-hour shift (720 mins)
export interface ShiftRule {
  expectedStart: string; // e.g. '06:00'
  cutoff: string;        // e.g. '06:30' (late deadline)
  expectedEnd: string;   // e.g. '18:00'
  expectedMinutes: number; // e.g. 720
  minWorkHours: number;  // e.g. 4 (minimum hours required before checkout is allowed)
}

export const LOCATION_SHIFT_RULES: Record<string, ShiftRule> = {
  hyderabad: {
    expectedStart: '06:00',
    cutoff: '06:30', // 6:30 AM deadline
    expectedEnd: '18:00',
    expectedMinutes: 720, // 12 hours standard shift
    minWorkHours: 4,      // 4 hours minimum before checkout
  },
  bangalore: {
    expectedStart: '09:00',
    cutoff: '09:30',
    expectedEnd: '21:00',
    expectedMinutes: 720, // 12 hours standard shift
    minWorkHours: 4,      // 4 hours minimum before checkout
  },
};

/** Get global shift rules stored in Firestore, falling back to LOCATION_SHIFT_RULES */
export async function getGlobalShiftRules(): Promise<Record<string, ShiftRule>> {
  try {
    const snap = await getDoc(doc(db, 'site_settings', 'attendance_rules'));
    if (snap.exists()) {
      return { ...LOCATION_SHIFT_RULES, ...snap.data() };
    }
  } catch (err) {
    console.warn('Error fetching global shift rules:', err);
  }
  return LOCATION_SHIFT_RULES;
}

/** Save global shift rules to Firestore */
export async function saveGlobalShiftRules(rules: Record<string, ShiftRule>): Promise<void> {
  const { setDoc } = await import('firebase/firestore');
  await setDoc(doc(db, 'site_settings', 'attendance_rules'), rules, { merge: true });
}

/**
 * Calculates the effective shift rule for an employee, combining global location rules with any per-employee overrides
 */
export function getEffectiveShiftRule(
  employee?: { location?: string; shiftTiming?: import('@/types/employee').EmployeeShiftTiming } | null,
  globalRules?: Record<string, ShiftRule>
): ShiftRule {
  const loc = (employee?.location || 'hyderabad').toLowerCase();
  const baseRule = (globalRules && globalRules[loc]) || LOCATION_SHIFT_RULES[loc] || LOCATION_SHIFT_RULES.hyderabad;

  const expectedStart = employee?.shiftTiming?.expectedStart || baseRule.expectedStart || '06:00';
  const cutoff = employee?.shiftTiming?.cutoff || baseRule.cutoff || '06:30';
  const expectedEnd = employee?.shiftTiming?.expectedEnd || baseRule.expectedEnd || '18:00';
  const minWorkHours = employee?.shiftTiming?.minWorkHours ?? baseRule.minWorkHours ?? 4;

  let expectedMinutes = baseRule.expectedMinutes || 720;
  try {
    const [sH, sM] = expectedStart.split(':').map(Number);
    const [eH, eM] = expectedEnd.split(':').map(Number);
    let diffMins = (eH * 60 + eM) - (sH * 60 + sM);
    if (diffMins <= 0) diffMins += 24 * 60;
    if (diffMins > 0) expectedMinutes = diffMins;
  } catch (e) {
    // Keep fallback
  }

  return {
    expectedStart,
    cutoff,
    expectedEnd,
    expectedMinutes,
    minWorkHours,
  };
}

/**
 * Calculates whether an employee is late based on their check-in time and location/cutoff.
 * Converts timestamp to IST (Asia/Kolkata).
 */
export function evaluateCheckInLate(
  timeIso: string,
  location: string,
  cutoffTime?: string
): { isLate: boolean; lateMinutes: number; cutoff: string } {
  const cutoffStr = cutoffTime || (LOCATION_SHIFT_RULES[location.toLowerCase()] || LOCATION_SHIFT_RULES.hyderabad).cutoff;
  
  // Format checkIn in Asia/Kolkata to extract HH:MM
  const istFormatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const parts = istFormatter.formatToParts(new Date(timeIso));
  const hour = parseInt(parts.find(p => p.type === 'hour')?.value || '0', 10);
  const minute = parseInt(parts.find(p => p.type === 'minute')?.value || '0', 10);
  const checkInMinutes = hour * 60 + minute;

  const [cutoffH, cutoffM] = cutoffStr.split(':').map(Number);
  const cutoffMinutes = cutoffH * 60 + cutoffM;

  if (checkInMinutes > cutoffMinutes) {
    return {
      isLate: true,
      lateMinutes: checkInMinutes - cutoffMinutes,
      cutoff: cutoffStr,
    };
  }

  return {
    isLate: false,
    lateMinutes: 0,
    cutoff: cutoffStr,
  };
}

/** Check in an employee */
export async function checkInEmployee(
  employee: {
    id: string;
    employeeId: string;
    name: string;
    location: string;
    siteId?: string;
    shiftTiming?: import('@/types/employee').EmployeeShiftTiming;
  },
  selfieUrl: string,
  coordinates: { lat: number; lng: number; accuracy?: number } | null,
  date: string,
  globalRules?: Record<string, ShiftRule>
): Promise<{ id: string; isLate: boolean; lateMinutes: number; cutoff: string }> {
  await assertWritePermission('Checking In Employee');
  const now = new Date().toISOString();
  const rule = getEffectiveShiftRule(employee, globalRules);
  const { isLate, lateMinutes, cutoff } = evaluateCheckInLate(now, employee.location, rule.cutoff);

  const data: Omit<NewRelicAttendance, 'id'> = {
    employeeId: employee.employeeId,
    employeeDocId: employee.id,
    employeeName: employee.name,
    siteId: (employee.siteId as any) || 'newrelic',
    location: employee.location as any,
    date,
    checkIn: {
      time: now,
      selfieUrl,
      ...(coordinates ? { coordinates } : {}),
    },
    isLate,
    lateMinutes,
    shiftExpectedStart: rule.expectedStart,
    status: 'present',
    createdAt: serverTimestamp() as any,
    updatedAt: serverTimestamp() as any,
  };
  const docRef = await addDoc(collection(db, ATTENDANCE_COLLECTION), data);
  return { id: docRef.id, isLate, lateMinutes, cutoff };
}

/** Check out an employee — updates existing record, validates minimum work hours, & calculates duration and overtime */
export async function checkOutEmployee(
  attendanceId: string,
  selfieUrl: string,
  coordinates: { lat: number; lng: number; accuracy?: number } | null,
  checkInTime: string,
  location?: string,
  options?: {
    minWorkHours?: number;
    allowEarlyCheckout?: boolean;
    adminOverrideReason?: string;
    expectedMinutes?: number;
  }
): Promise<{ durationMinutes: number; overtimeMinutes: number; status: NewRelicAttendance['status'] }> {
  await assertWritePermission('Checking Out Employee');
  const now = new Date().toISOString();
  const durationMinutes = Math.round(
    (new Date(now).getTime() - new Date(checkInTime).getTime()) / 60000
  );

  const minWorkHours = options?.minWorkHours ?? 4; // Default: 4 hours
  const minRequiredMinutes = Math.round(minWorkHours * 60);

  // Enforce minimum 4 hours of shift unless admin authorized early checkout
  if (durationMinutes < minRequiredMinutes && !options?.allowEarlyCheckout) {
    const remainingMins = minRequiredMinutes - durationMinutes;
    const remainingH = Math.floor(remainingMins / 60);
    const remainingM = remainingMins % 60;
    const remStr = remainingH > 0 ? `${remainingH}h ${remainingM}m` : `${remainingM}m`;
    throw new Error(
      `Early check-out is restricted. A minimum shift of ${minWorkHours} hours is required before check-out is allowed. (Elapsed: ${Math.floor(durationMinutes / 60)}h ${durationMinutes % 60}m. Remaining: ${remStr})`
    );
  }

  const expectedMinutes = options?.expectedMinutes ?? (location ? (LOCATION_SHIFT_RULES[location.toLowerCase()] || LOCATION_SHIFT_RULES.hyderabad).expectedMinutes : 720);
  
  // For 12-hour shift (720 min): half-day threshold is 360 min (6 hrs), full-day is >= 360 min
  const status: NewRelicAttendance['status'] = durationMinutes >= 360 ? 'present' : 'half-day';
  const overtimeMinutes = Math.max(0, durationMinutes - expectedMinutes);

  await updateDoc(doc(db, ATTENDANCE_COLLECTION, attendanceId), {
    checkOut: {
      time: now,
      selfieUrl,
      ...(coordinates ? { coordinates } : {}),
    },
    durationMinutes,
    overtimeMinutes,
    isMissedCheckOut: false,
    status,
    ...(options?.allowEarlyCheckout ? { earlyCheckoutApproved: true, earlyCheckoutReason: options.adminOverrideReason || 'Admin Override' } : {}),
    updatedAt: serverTimestamp(),
  });

  return { durationMinutes, overtimeMinutes, status };
}

/** Check for any unclosed attendance from previous days and mark missed checkout if overdue */
export async function checkAndFlagMissedCheckouts(employeeDocId: string, currentDate: string): Promise<NewRelicAttendance[]> {
  const q = query(
    collection(db, ATTENDANCE_COLLECTION),
    where('employeeDocId', '==', employeeDocId)
  );
  const snap = await getDocs(q);
  const missedList: NewRelicAttendance[] = [];

  for (const docSnap of snap.docs) {
    const data = docSnap.data() as NewRelicAttendance;
    // If it's from a date before today and has checkIn but no checkOut
    if (data.date < currentDate && data.checkIn && !data.checkOut && !data.isMissedCheckOut) {
      await updateDoc(doc(db, ATTENDANCE_COLLECTION, docSnap.id), {
        isMissedCheckOut: true,
        status: 'missed-checkout',
        updatedAt: serverTimestamp(),
      });
      missedList.push({ id: docSnap.id, ...data, isMissedCheckOut: true, status: 'missed-checkout' });
    }
  }

  return missedList;
}

/** Get attendance records for a date range (admin / manager) */
export async function getAttendanceByDateRange(
  startDate: string,
  endDate: string,
  location?: string,
  siteId?: string
): Promise<NewRelicAttendance[]> {
  try {
    const constraints: any[] = [
      where('date', '>=', startDate),
      where('date', '<=', endDate),
    ];
    if (location) constraints.push(where('location', '==', location));
    const q = query(collection(db, ATTENDANCE_COLLECTION), ...constraints);
    const snap = await getDocs(q);
    let list = snap.docs.map((d) => ({
      id: d.id,
      ...d.data(),
      siteId: d.data().siteId || 'newrelic',
    } as NewRelicAttendance));
    if (siteId) {
      list = list.filter((r) => (r.siteId || 'newrelic') === siteId);
    }
    return list.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  } catch (error) {
    console.warn('Falling back for getAttendanceByDateRange:', error);
    try {
      const snap = await getDocs(collection(db, ATTENDANCE_COLLECTION));
      let list = snap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
        siteId: d.data().siteId || 'newrelic',
      } as NewRelicAttendance));
      list = list.filter((r) => r.date >= startDate && r.date <= endDate);
      if (location) {
        list = list.filter((r) => r.location === location);
      }
      if (siteId) {
        list = list.filter((r) => (r.siteId || 'newrelic') === siteId);
      }
      return list.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    } catch (e2) {
      console.error('Error fetching date range attendance:', e2);
      return [];
    }
  }
}

/** Get today's attendance for all employees */
export async function getTodayAllAttendance(date: string, siteId?: string): Promise<NewRelicAttendance[]> {
  try {
    const q = query(
      collection(db, ATTENDANCE_COLLECTION),
      where('date', '==', date)
    );
    const snap = await getDocs(q);
    let list = snap.docs.map((d) => ({
      id: d.id,
      ...d.data(),
      siteId: d.data().siteId || 'newrelic',
    } as NewRelicAttendance));
    if (siteId) {
      list = list.filter((r) => (r.siteId || 'newrelic') === siteId);
    }
    return list.sort((a, b) => (a.employeeName || '').localeCompare(b.employeeName || ''));
  } catch (error) {
    console.warn('Falling back for getTodayAllAttendance:', error);
    try {
      const snap = await getDocs(collection(db, ATTENDANCE_COLLECTION));
      let list = snap.docs
        .map((d) => ({
          id: d.id,
          ...d.data(),
          siteId: d.data().siteId || 'newrelic',
        } as NewRelicAttendance))
        .filter((d) => d.date === date);
      if (siteId) {
        list = list.filter((r) => (r.siteId || 'newrelic') === siteId);
      }
      return list.sort((a, b) => (a.employeeName || '').localeCompare(b.employeeName || ''));
    } catch (e2) {
      console.error('Error fetching today all attendance:', e2);
      return [];
    }
  }
}

/** Get attendance for one employee for a month */
export async function getEmployeeMonthlyAttendance(
  employeeDocId: string,
  yearMonth: string // e.g. '2025-10'
): Promise<NewRelicAttendance[]> {
  const start = `${yearMonth}-01`;
  const end = `${yearMonth}-31`;
  try {
    const q = query(
      collection(db, ATTENDANCE_COLLECTION),
      where('employeeDocId', '==', employeeDocId),
      where('date', '>=', start),
      where('date', '<=', end)
    );
    const snap = await getDocs(q);
    const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as NewRelicAttendance));
    return list.sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  } catch (error) {
    console.warn('Falling back for getEmployeeMonthlyAttendance:', error);
    try {
      // Query by employeeDocId only, filter dates in memory to bypass composite index requirement
      const fallbackQuery = query(
        collection(db, ATTENDANCE_COLLECTION),
        where('employeeDocId', '==', employeeDocId)
      );
      const snap = await getDocs(fallbackQuery);
      const list = snap.docs
        .map((d) => ({ id: d.id, ...d.data() } as NewRelicAttendance))
        .filter((d) => d.date >= start && d.date <= end);
      return list.sort((a, b) => (a.date || '').localeCompare(b.date || ''));
    } catch (e2) {
      console.error('Error fetching monthly attendance:', e2);
      return [];
    }
  }
}

/**
 * Checks if the logged-in user (matched against employee roster by userId or email)
 * has already checked in today.
 * Returns true if:
 * - The employee has an attendance record for today with a valid checkIn.time.
 * - OR the user is not on the cafeteria employee roster (e.g. superadmin).
 * Returns false if:
 * - The user IS a registered employee on the roster but has NOT checked in today.
 */
export async function checkUserCheckedInToday(userId?: string, email?: string): Promise<boolean> {
  try {
    const today = new Date().toISOString().substring(0, 10);
    const employeesSnapshot = await getDocs(collection(db, 'newrelic_employees'));
    const userEmailLower = (email || '').toLowerCase().trim();

    // Match employee by userId or email
    const matchedEmp = employeesSnapshot.docs.find((d) => {
      const data = d.data();
      const empEmail = (data.email || '').toLowerCase().trim();
      return (
        (userId && data.userId === userId) ||
        (userEmailLower && empEmail && empEmail === userEmailLower)
      );
    });

    // If user is not an employee on the roster, don't force attendance
    if (!matchedEmp) {
      return true;
    }

    const todayRecord = await getTodayAttendance(matchedEmp.id, today);
    return Boolean(todayRecord?.checkIn?.time);
  } catch (error) {
    console.warn('Error checking today check-in status:', error);
    return true; // Fail open to avoid blocking users on error
  }
}

