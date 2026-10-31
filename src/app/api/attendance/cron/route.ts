import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import {
  collection,
  getDocs,
  doc,
  getDoc,
  setDoc,
  query,
  where,
} from 'firebase/firestore';
import {
  getAlertGatewayConfig,
  dispatchAlertToAdmins,
  generateAlertMessage,
} from '@/services/alertGatewayService';

export const dynamic = 'force-dynamic';

const ATTENDANCE_COLLECTION = 'newrelic_attendance';
const EMPLOYEES_COLLECTION = 'newrelic_employees';
const AUTOMATION_STATE_DOC = 'site_settings';
const AUTOMATION_STATE_KEY = 'attendance_automation_state';

interface AutomationState {
  lastDigestDate?: string;
  lastAbsentAlertDate?: string;
  lastMissedCheckoutDate?: string;
  updatedAt?: string;
}

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    const secretQuery = req.nextUrl.searchParams.get('secret') || req.nextUrl.searchParams.get('key');
    const expectedSecret = process.env.CRON_SECRET || process.env.NEXTAUTH_SECRET;

    if (expectedSecret && !req.nextUrl.searchParams.has('force')) {
      const isBearerMatch = authHeader === `Bearer ${expectedSecret}` || (process.env.CRON_SECRET ? authHeader === `Bearer ${process.env.CRON_SECRET}` : false);
      const isQueryMatch = secretQuery === expectedSecret || (process.env.CRON_SECRET ? secretQuery === process.env.CRON_SECRET : false);
      const host = req.headers.get('host') || '';
      const referer = req.headers.get('referer') || '';
      const isSameOrigin = referer.includes(host);

      if (!isBearerMatch && !isQueryMatch && !isSameOrigin) {
        return new Response('Unauthorized', { status: 401 });
      }
    }

    const trigger = req.nextUrl.searchParams.get('trigger'); // 'digest' | 'absent' | 'checkout' | 'all'
    const force = req.nextUrl.searchParams.get('force') === 'true';

    const config = await getAlertGatewayConfig();

    // Current Date and Time in Asia/Kolkata
    const now = new Date();
    const kolkataDateStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(now);
    const kolkataTimeParts = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Kolkata',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(now);

    const hour = parseInt(kolkataTimeParts.find((p) => p.type === 'hour')?.value || '0', 10);
    const minute = parseInt(kolkataTimeParts.find((p) => p.type === 'minute')?.value || '0', 10);
    const currentMinutes = hour * 60 + minute;

    // Load automation state from Firestore
    let autoState: AutomationState = {};
    try {
      const stateSnap = await getDoc(doc(db, AUTOMATION_STATE_DOC, AUTOMATION_STATE_KEY));
      if (stateSnap.exists()) {
        autoState = stateSnap.data() as AutomationState;
      }
    } catch (e) {
      console.warn('Could not read automation state:', e);
    }

    // Load active employee roster
    const empSnap = await getDocs(collection(db, EMPLOYEES_COLLECTION));
    const employees = empSnap.docs
      .map((d) => ({ id: d.id, ...d.data() } as any))
      .filter((e) => e.status !== 'inactive');

    // Load today's attendance records
    const attSnap = await getDocs(
      query(collection(db, ATTENDANCE_COLLECTION), where('date', '==', kolkataDateStr))
    );
    const attendanceRecords = attSnap.docs.map((d) => ({ id: d.id, ...d.data() } as any));

    const checkedInEmpDocIds = new Set(
      attendanceRecords.filter((r) => r.checkIn?.time).map((r) => r.employeeDocId)
    );

    const onDutyRecords = attendanceRecords.filter((r) => r.checkIn?.time && !r.checkOut?.time);
    const presentCount = checkedInEmpDocIds.size;
    const totalRoster = employees.length;

    const absentEmployees = employees.filter((e) => !checkedInEmpDocIds.has(e.id));
    const absentNames = absentEmployees.map((e) => e.name || 'Staff');

    // Missed checkout: checked in > 9 hours ago with no checkout
    const missedCheckoutStaff: string[] = [];
    for (const r of onDutyRecords) {
      const checkInDate = new Date(r.checkIn.time);
      const hoursElapsed = (now.getTime() - checkInDate.getTime()) / (1000 * 60 * 60);
      if (hoursElapsed >= 9) {
        missedCheckoutStaff.push(r.employeeName || 'Staff');
      }
    }

    const actionsTriggered: string[] = [];
    const dispatchResults: Record<string, any> = {};

    // 1. Morning Absentee Alert (Triggered after 06:45 AM or manual trigger)
    const isPastMorningCutoff = currentMinutes >= 6 * 60 + 45; // after 06:45 AM
    const shouldRunAbsentAlert =
      (trigger === 'absent' || trigger === 'all' || (isPastMorningCutoff && autoState.lastAbsentAlertDate !== kolkataDateStr)) &&
      (config.enableAutoAbsentAlert !== false || trigger === 'absent');

    if (shouldRunAbsentAlert && (absentNames.length > 0 || force)) {
      const message = generateAlertMessage('admin_absent_alert' as any, {
        siteName: 'All Sites',
        date: kolkataDateStr,
        cutoff: '06:30 AM',
        absentNames,
      });

      const res = await dispatchAlertToAdmins(
        {
          alertType: 'group_absent_alert',
          customMessage: message,
        },
        config,
        'system:cron-absent'
      );

      autoState.lastAbsentAlertDate = kolkataDateStr;
      actionsTriggered.push('absent_alert');
      dispatchResults.absentAlert = res;
    }

    // 2. Morning Shift Attendance Digest (Triggered after 07:30 AM or manual trigger)
    const isMorningDigestTime = currentMinutes >= 7 * 60 + 30; // after 07:30 AM
    const shouldRunDigest =
      (trigger === 'digest' || trigger === 'all' || (isMorningDigestTime && autoState.lastDigestDate !== kolkataDateStr)) &&
      (config.enableAutoDailyDigest !== false || trigger === 'digest');

    if (shouldRunDigest) {
      const message = generateAlertMessage('manager_digest', {
        siteName: 'All Sites',
        date: kolkataDateStr,
        presentCount,
        totalRoster,
        onDutyCount: onDutyRecords.length,
        absentNames,
      });

      const res = await dispatchAlertToAdmins(
        {
          alertType: 'manager_digest',
          customMessage: message,
        },
        config,
        'system:cron-digest'
      );

      autoState.lastDigestDate = kolkataDateStr;
      actionsTriggered.push('daily_digest');
      dispatchResults.dailyDigest = res;
    }

    // 3. Evening Missed Check-Out Alert (Triggered after 19:30 / 07:30 PM or manual trigger)
    const isEveningCheckoutTime = currentMinutes >= 19 * 60 + 30; // after 07:30 PM
    const shouldRunCheckoutAlert =
      (trigger === 'checkout' || trigger === 'all' || (isEveningCheckoutTime && autoState.lastMissedCheckoutDate !== kolkataDateStr)) &&
      (config.enableAutoCheckoutReminder !== false || trigger === 'checkout');

    if (shouldRunCheckoutAlert && (missedCheckoutStaff.length > 0 || force)) {
      const message = generateAlertMessage('admin_missed_checkout' as any, {
        siteName: 'All Sites',
        date: kolkataDateStr,
        absentNames: missedCheckoutStaff,
      });

      const res = await dispatchAlertToAdmins(
        {
          alertType: 'checkout_reminder',
          customMessage: message,
        },
        config,
        'system:cron-missed-checkout'
      );

      autoState.lastMissedCheckoutDate = kolkataDateStr;
      actionsTriggered.push('missed_checkout_alert');
      dispatchResults.missedCheckoutAlert = res;
    }

    // Save updated state back to Firestore
    if (actionsTriggered.length > 0) {
      autoState.updatedAt = new Date().toISOString();
      await setDoc(doc(db, AUTOMATION_STATE_DOC, AUTOMATION_STATE_KEY), autoState, { merge: true });
    }

    return NextResponse.json({
      success: true,
      date: kolkataDateStr,
      currentTimeIST: `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`,
      rosterSummary: {
        totalRoster,
        presentCount,
        onDutyCount: onDutyRecords.length,
        absentCount: absentNames.length,
        missedCheckoutCount: missedCheckoutStaff.length,
      },
      actionsTriggered,
      dispatchResults,
    });
  } catch (err: any) {
    console.error('Error in /api/attendance/cron:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
