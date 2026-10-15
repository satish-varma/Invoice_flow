import { db, storage } from '@/lib/firebase';
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
export const LOCATION_SHIFT_RULES: Record<string, { expectedStart: string; cutoff: string; expectedMinutes: number }> = {
  hyderabad: {
    expectedStart: '06:00',
    cutoff: '06:30', // 6:30 AM deadline
    expectedMinutes: 720, // 12 hours standard shift
  },
  bangalore: {
    expectedStart: '09:00',
    cutoff: '09:30',
    expectedMinutes: 720, // 12 hours standard shift
  },
};

/**
 * Calculates whether an employee is late based on their check-in time and location.
 * Converts timestamp to IST (Asia/Kolkata).
 */
export function evaluateCheckInLate(timeIso: string, location: string): { isLate: boolean; lateMinutes: number; cutoff: string } {
  const rule = LOCATION_SHIFT_RULES[location.toLowerCase()] || LOCATION_SHIFT_RULES.hyderabad;
  
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

  const [cutoffH, cutoffM] = rule.cutoff.split(':').map(Number);
  const cutoffMinutes = cutoffH * 60 + cutoffM;

  if (checkInMinutes > cutoffMinutes) {
    return {
      isLate: true,
      lateMinutes: checkInMinutes - cutoffMinutes,
      cutoff: rule.cutoff,
    };
  }

  return {
    isLate: false,
    lateMinutes: 0,
    cutoff: rule.cutoff,
  };
}

/** Check in an employee */
export async function checkInEmployee(
  employee: { id: string; employeeId: string; name: string; location: string; siteId?: string },
  selfieUrl: string,
  coordinates: { lat: number; lng: number; accuracy?: number } | null,
  date: string
): Promise<{ id: string; isLate: boolean; lateMinutes: number }> {
  const now = new Date().toISOString();
  const { isLate, lateMinutes, cutoff } = evaluateCheckInLate(now, employee.location);
  const rule = LOCATION_SHIFT_RULES[employee.location.toLowerCase()] || LOCATION_SHIFT_RULES.hyderabad;

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
  return { id: docRef.id, isLate, lateMinutes };
}

/** Check out an employee — updates existing record & calculates duration and overtime */
export async function checkOutEmployee(
  attendanceId: string,
  selfieUrl: string,
  coordinates: { lat: number; lng: number; accuracy?: number } | null,
  checkInTime: string,
  location?: string
): Promise<{ durationMinutes: number; overtimeMinutes: number; status: NewRelicAttendance['status'] }> {
  const now = new Date().toISOString();
  const durationMinutes = Math.round(
    (new Date(now).getTime() - new Date(checkInTime).getTime()) / 60000
  );
  const rule = location ? (LOCATION_SHIFT_RULES[location.toLowerCase()] || LOCATION_SHIFT_RULES.hyderabad) : LOCATION_SHIFT_RULES.hyderabad;
  
  // For 12-hour shift (720 min): half-day threshold is 360 min (6 hrs), full-day is >= 360 min
  const status: NewRelicAttendance['status'] = durationMinutes >= 360 ? 'present' : 'half-day';
  const overtimeMinutes = Math.max(0, durationMinutes - rule.expectedMinutes);

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

