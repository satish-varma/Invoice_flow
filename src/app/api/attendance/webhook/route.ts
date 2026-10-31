import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { collection, getDocs, query, where } from 'firebase/firestore';
import {
  getAlertGatewayConfig,
  dispatchAlert,
  formatPhoneNumber,
  buildProgressBar,
} from '@/services/alertGatewayService';

export const dynamic = 'force-dynamic';

const ATTENDANCE_COLLECTION = 'newrelic_attendance';
const EMPLOYEES_COLLECTION = 'newrelic_employees';

// In-Memory Fast Cache (TTL: 60 seconds)
let cachedConfig: { data: any; expiry: number } | null = null;
let cachedEmployees: { data: any[]; expiry: number } | null = null;

async function getCachedConfigFast() {
  const now = Date.now();
  if (cachedConfig && cachedConfig.expiry > now) {
    return cachedConfig.data;
  }
  const config = await getAlertGatewayConfig();
  cachedConfig = { data: config, expiry: now + 60_000 };
  return config;
}

async function getCachedEmployeesFast() {
  const now = Date.now();
  if (cachedEmployees && cachedEmployees.expiry > now) {
    return cachedEmployees.data;
  }
  const empSnap = await getDocs(collection(db, EMPLOYEES_COLLECTION));
  const employees = empSnap.docs
    .map((d) => ({ id: d.id, ...d.data() } as any))
    .filter((e) => e.status !== 'inactive');
  cachedEmployees = { data: employees, expiry: now + 60_000 };
  return employees;
}

function getISTTimeParts(d: Date) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(d);
  const h = parseInt(parts.find((p) => p.type === 'hour')?.value || '0', 10);
  const m = parseInt(parts.find((p) => p.type === 'minute')?.value || '0', 10);
  return { hour: h, minute: m, totalMinutes: h * 60 + m };
}

/** GET handler: Meta Webhook URL Verification */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  const expectedToken = process.env.META_WHATSAPP_VERIFY_TOKEN || 'invoiceflow_wa_webhook_2026';

  if (mode === 'subscribe' && token === expectedToken) {
    console.log('[WhatsAppWebhook] Verification successful!');
    return new Response(challenge || '', { status: 200, headers: { 'Content-Type': 'text/plain' } });
  }

  console.warn('[WhatsAppWebhook] Verification failed! Provided token:', token);
  return new Response('Forbidden', { status: 403 });
}

/** POST handler: Inbound WhatsApp Messages (2-Way Interactive Bot) */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const entry = body?.entry?.[0];
    const change = entry?.changes?.[0]?.value;
    const messages = change?.messages;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      // Status update (delivered, read, sent) — return 200 immediately
      return NextResponse.json({ status: 'ignored_non_message' });
    }

    const message = messages[0];
    const senderPhone = message.from; // e.g. "917709632898"
    const contactName = change?.contacts?.[0]?.profile?.name || 'Manager';
    const textBody = (message.text?.body || message.button?.text || '').trim();

    if (!textBody) {
      return NextResponse.json({ status: 'empty_body' });
    }

    console.log(`[WhatsAppBot] Incoming from +${senderPhone} (${contactName}): "${textBody}"`);

    // 1. Authorize Sender (Managers / Admins only)
    const config = await getCachedConfigFast();
    const cleanSender = formatPhoneNumber(senderPhone).cleanDigits;

    const authorizedPhones = new Set(
      [
        ...(config.adminPhones || []),
        config.managerPhone || '',
        '917709632898',
      ]
        .map((p) => formatPhoneNumber(p).cleanDigits)
        .filter(Boolean)
    );

    if (!authorizedPhones.has(cleanSender)) {
      console.warn(`[WhatsAppBot] Unauthorized inquiry from +${cleanSender}`);
      await dispatchAlert({
        to: senderPhone,
        recipientName: contactName,
        alertType: 'custom',
        customMessage: `👋 Hello ${contactName}!\n\nThis is The Gut Guru Automated Attendance System. Your number (+${senderPhone}) is not listed as an authorized manager.\n\nPlease contact administration to add your number to the manager alert list.`,
      });
      return NextResponse.json({ status: 'unauthorized_reply_sent' });
    }

    // 2. Parse Command (Case-Insensitive & Flexible)
    const cmd = textBody.trim().toUpperCase();

    // 3. Fast Concurrent Data Fetch
    const now = new Date();
    const kolkataDateStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(now);

    const [employees, attSnap] = await Promise.all([
      getCachedEmployeesFast(),
      getDocs(query(collection(db, ATTENDANCE_COLLECTION), where('date', '==', kolkataDateStr))),
    ]);

    const attendanceRecords = attSnap.docs.map((d) => ({ id: d.id, ...d.data() } as any));

    const checkedInEmpDocIds = new Set(
      attendanceRecords.filter((r) => r.checkIn?.time).map((r) => r.employeeDocId)
    );
    const onDutyRecords = attendanceRecords.filter((r) => r.checkIn?.time && !r.checkOut?.time);
    const presentCount = checkedInEmpDocIds.size;
    const totalRoster = employees.length;
    const absentEmployees = employees.filter((e) => !checkedInEmpDocIds.has(e.id));

    let replyMessage = '';

    // --- Command: STATUS / TODAY / SUMMARY / TURNOUT ---
    if (
      cmd.includes('STATUS') ||
      cmd.includes('TODAY') ||
      cmd.includes('SUMMARY') ||
      cmd.includes('DIGEST') ||
      cmd.includes('TURNOUT')
    ) {
      const pct = totalRoster > 0 ? Math.round((presentCount / totalRoster) * 100) : 0;
      const meter = buildProgressBar(presentCount, totalRoster, 10);
      const absentList = absentEmployees.length > 0
        ? absentEmployees.map((e, idx) => `  ${idx + 1}. ${e.name} (${e.designation || 'Staff'})`).join('\n')
        : '  None (100% Turnout! 🎉)';

      replyMessage = `📊 Live Shift Status — ${kolkataDateStr}\n📍 Facility: All Sites · Turnout: ${pct}% ${pct >= 75 ? '🟢' : '🔴'}\n━━━━━━━━━━━━━━━━━━━━\nTurnout Meter: [${meter}] ${presentCount} / ${totalRoster} Staff\n\n🟢 On Duty Right Now: ${onDutyRecords.length}\n🔴 Absent / Pending (${absentEmployees.length}):\n${absentList}\n\n🔗 Live Kiosk:\nhttps://studio--invoiceflow-24nxt.us-central1.hosted.app/newrelic/attendance\n\n— The Gut Guru Live Bot`;
    }

    // --- Command: ABSENT / MISSING ---
    else if (cmd.includes('ABSENT') || cmd.includes('MISSING')) {
      if (absentEmployees.length === 0) {
        replyMessage = `🎉 100% Turnout Today — ${kolkataDateStr}\n\nAll ${totalRoster} scheduled team members have clocked in successfully!\n— The Gut Guru Live Bot`;
      } else {
        const list = absentEmployees.map((e, i) => {
          const phone = e.phone ? ` (${e.phone})` : '';
          const role = e.designation ? ` · ${e.designation}` : '';
          return `  ${i + 1}. ${e.name}${role}${phone}`;
        }).join('\n');

        replyMessage = `🔴 Absent / Pending Staff Today (${absentEmployees.length}) — ${kolkataDateStr}\n━━━━━━━━━━━━━━━━━━━━\n${list}\n\n🔗 Live Kiosk:\nhttps://studio--invoiceflow-24nxt.us-central1.hosted.app/newrelic/attendance\n\n— The Gut Guru Live Bot`;
      }
    }

    // --- Command: LATE / DELAY ---
    else if (cmd.includes('LATE') || cmd.includes('DELAY')) {
      const lateStaff: Array<{ name: string; time: string; delayMins: number }> = [];

      for (const r of attendanceRecords) {
        if (r.checkIn?.time) {
          const punchDate = new Date(r.checkIn.time);
          const punchTimeStr = punchDate.toLocaleTimeString('en-IN', {
            timeZone: 'Asia/Kolkata',
            hour: '2-digit',
            minute: '2-digit',
            hour12: true,
          });

          const { totalMinutes } = getISTTimeParts(punchDate);
          const defaultCutoff = 6 * 60 + 30; // 06:30 AM IST (390 mins)

          const isLate = r.isLate === true || totalMinutes > defaultCutoff;
          if (isLate) {
            const delayMins = r.lateMinutes && r.lateMinutes > 0
              ? r.lateMinutes
              : Math.max(1, totalMinutes - defaultCutoff);

            lateStaff.push({
              name: r.employeeName || 'Staff',
              time: punchTimeStr,
              delayMins,
            });
          }
        }
      }

      if (lateStaff.length === 0) {
        replyMessage = `⏰ Late Arrivals Report — ${kolkataDateStr}\n\n✅ Excellent! Zero staff late arrivals recorded today.\n— The Gut Guru Live Bot`;
      } else {
        const list = lateStaff.map((s, i) => `  ${i + 1}. ${s.name}: ${s.time} (+${s.delayMins}m past cutoff)`).join('\n');
        replyMessage = `⏰ Late Arrivals Today (${lateStaff.length}) — ${kolkataDateStr}\n━━━━━━━━━━━━━━━━━━━━\n${list}\n\n🔗 Live Kiosk:\nhttps://studio--invoiceflow-24nxt.us-central1.hosted.app/newrelic/attendance\n\n— The Gut Guru Live Bot`;
      }
    }

    // --- Command: ONDUTY / ACTIVE / CHECKOUT / PRESENT ---
    else if (
      cmd.includes('ONDUTY') ||
      cmd.includes('ON DUTY') ||
      cmd.includes('DUTY') ||
      cmd.includes('PRESENT') ||
      cmd.includes('ACTIVE') ||
      cmd.includes('CHECKOUT')
    ) {
      if (onDutyRecords.length === 0) {
        replyMessage = `🟢 On-Duty Staff — ${kolkataDateStr}\n\nNo active shifts punched in currently.\n— The Gut Guru Live Bot`;
      } else {
        const list = onDutyRecords.map((r, i) => {
          const punchDate = new Date(r.checkIn.time);
          const hoursElapsed = Math.round(((now.getTime() - punchDate.getTime()) / (1000 * 60 * 60)) * 10) / 10;
          const punchTime = punchDate.toLocaleTimeString('en-IN', {
            timeZone: 'Asia/Kolkata',
            hour: '2-digit',
            minute: '2-digit',
            hour12: true,
          });
          return `  ${i + 1}. ${r.employeeName} (${punchTime} · ${hoursElapsed}h on duty)`;
        }).join('\n');

        replyMessage = `🟢 On-Duty Staff Right Now (${onDutyRecords.length}) — ${kolkataDateStr}\n━━━━━━━━━━━━━━━━━━━━\n${list}\n\n— The Gut Guru Live Bot`;
      }
    }

    // --- Default: Help & Commands Menu ---
    else {
      replyMessage = `👋 Hello ${contactName}! I am The Gut Guru Attendance Bot.\n\nAvailable Manager Commands:\n• STATUS — Live shift attendance & turnout meter\n• ABSENT — Who has not checked in today\n• LATE — Today's late arrival log\n• ONDUTY — Staff currently on shift\n• HELP — Show this menu\n\nJust reply with any keyword to query live data!`;
    }

    // 4. Send WhatsApp Reply
    await dispatchAlert({
      to: senderPhone,
      recipientName: contactName,
      alertType: 'custom',
      customMessage: replyMessage,
    });

    return NextResponse.json({ success: true, replySent: true, command: cmd });
  } catch (err: any) {
    console.error('[WhatsAppBot] Webhook error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
