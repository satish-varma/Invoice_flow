import { db } from '@/lib/firebase';
import {
  doc,
  getDoc,
  setDoc,
  collection,
  addDoc,
  getDocs,
  query,
  orderBy,
  limit,
} from 'firebase/firestore';
import {
  AlertGatewayConfig,
  AlertDispatchRecord,
  SendAlertRequest,
  AlertProviderType,
} from '@/types/alertGateway';

const SETTINGS_DOC = 'site_settings';
const GATEWAY_KEY = 'alert_gateway';
const LOGS_COLLECTION = 'alert_logs';

export const DEFAULT_ALERT_CONFIG: AlertGatewayConfig = {
  activeProvider: 'meta_whatsapp',
  channel: 'whatsapp',
  ultramsg: {
    instanceId: '',
    token: '',
  },
  meta: {
    phoneNumberId: '1478203265366413',
    accessToken: '',
    wabaId: '1138494142069945',
  },
  twilio: {
    accountSid: '',
    authToken: '',
    fromNumber: '',
  },
  fast2sms: {
    apiKey: '',
    senderId: 'GUTGRU',
    route: 'q',
  },
  msg91: {
    authKey: '',
    senderId: 'GUTGRU',
  },
  webhook: {
    webhookUrl: '',
    secretToken: '',
  },
  enableAutoLateAlert: true,
  enableAutoAbsentAlert: true,
  enableAutoCheckoutReminder: true,
  enableAutoDailyDigest: true,
  enableAutoDcAlert: true,
  enableBiWeeklyBillingDigest: true,
  managerPhone: '917709632898',
  adminPhones: ['917709632898'],
  managerSiteRouting: {},
  dcRouting: {
    bangalore: ['917709632898'],
    hyderabad: ['917709632898'],
  },
};

/** Get the configured Alert Gateway settings from Firestore */
export async function getAlertGatewayConfig(): Promise<AlertGatewayConfig> {
  let config: AlertGatewayConfig = { ...DEFAULT_ALERT_CONFIG };
  try {
    const snap = await getDoc(doc(db, SETTINGS_DOC, GATEWAY_KEY));
    if (snap.exists()) {
      config = { ...DEFAULT_ALERT_CONFIG, ...snap.data() } as AlertGatewayConfig;
    }
  } catch (err) {
    console.warn('Error fetching alert gateway config from Firestore:', err);
  }

  // Seamless fallback to environment variables if Meta credentials aren't in Firestore
  const envPhoneId = process.env.META_WHATSAPP_PHONE_NUMBER_ID;
  const envToken = process.env.META_WHATSAPP_ACCESS_TOKEN;
  const envWabaId = process.env.META_WHATSAPP_WABA_ID;

  const currentPhoneId = config.meta?.phoneNumberId?.trim();
  const currentToken = config.meta?.accessToken?.trim();
  const currentWabaId = config.meta?.wabaId?.trim();

  config.meta = {
    phoneNumberId: currentPhoneId || envPhoneId || '1478203265366413',
    accessToken: currentToken || envToken || '',
    wabaId: currentWabaId || envWabaId || '1138494142069945',
  };

  // If token is available and provider was mock or missing, promote to meta_whatsapp
  if ((config.meta.accessToken || envToken) && (config.activeProvider === 'mock' || !config.activeProvider)) {
    config.activeProvider = 'meta_whatsapp';
    config.channel = 'whatsapp';
  }

  if (!config.managerPhone?.trim()) {
    config.managerPhone = '917709632898';
  }

  if (!config.adminPhones || !Array.isArray(config.adminPhones) || config.adminPhones.length === 0) {
    config.adminPhones = [config.managerPhone || '917709632898'];
  }

  return config;
}

/** Save updated Alert Gateway settings to Firestore */
export async function saveAlertGatewayConfig(
  config: AlertGatewayConfig,
  userEmail?: string | null
): Promise<void> {
  const payload = {
    ...config,
    updatedAt: new Date().toISOString(),
    updatedBy: userEmail || 'admin',
  };
  await setDoc(doc(db, SETTINGS_DOC, GATEWAY_KEY), payload, { merge: true });
}

/**
 * Standardize phone number for Indian mobile numbers & international format
 * Examples: "9876543210" -> "919876543210", "+91 98765 43210" -> "919876543210"
 */
export function formatPhoneNumber(rawPhone: string): {
  cleanDigits: string;
  withPlus: string;
  tenDigits: string;
} {
  const digits = rawPhone.replace(/\D/g, '');
  let normalized = digits;
  if (digits.length === 10) {
    normalized = `91${digits}`;
  } else if (digits.length === 12 && digits.startsWith('91')) {
    normalized = digits;
  }
  const tenDigits = normalized.slice(-10);
  return {
    cleanDigits: normalized,
    withPlus: `+${normalized}`,
    tenDigits,
  };
}

/** Visual progress bar helper for WhatsApp text digests (e.g. [████████░░]) */
export function buildProgressBar(present: number, total: number, barLength: number = 10): string {
  if (total <= 0) return '░'.repeat(barLength);
  const ratio = Math.min(1, Math.max(0, present / total));
  const filled = Math.round(ratio * barLength);
  const empty = Math.max(0, barLength - filled);
  return '█'.repeat(filled) + '░'.repeat(empty);
}

/** Generate standardized message copy for alerts */
export function generateAlertMessage(
  alertType: SendAlertRequest['alertType'],
  data: {
    employeeName?: string;
    employeePhone?: string;
    role?: string;
    siteName?: string;
    cutoff?: string;
    checkInTime?: string;
    lateMinutes?: number;
    hoursElapsed?: number;
    date?: string;
    presentCount?: number;
    totalRoster?: number;
    onDutyCount?: number;
    absentNames?: string[];
    customText?: string;
  }
): string {
  const today = data.date || new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  const site = data.siteName || 'The Gut Guru Hub';
  const name = data.employeeName || 'Team Member';
  const cutoff = data.cutoff || '06:30 AM';

  if (data.customText) {
    return data.customText;
  }

  switch (alertType) {
    case 'gentle_reminder':
      return `☀️ Morning Attendance Reminder\n\nHi ${name},\nPlease remember to mark your check-in for today's shift (${today}) at ${site}. Expected cutoff is ${cutoff}.\n\nHave a great and safe shift!\n— Operations Team`;

    case 'absent_notice':
      return `⚠️ Attendance Cutoff Notice\n\nHi ${name},\nYou have not checked in for today's shift (${today}) at ${site}. The cutoff deadline was ${cutoff}.\n\nPlease mark your attendance immediately via the Kiosk or notify your supervisor if on approved leave.\n— Operations Team`;

    case 'late_alert':
      return `⏰ Check-In Notice\n\nHi ${name},\nYour check-in today (${today}) was recorded at ${data.checkInTime || 'morning'} (+${data.lateMinutes || 0}m past the ${cutoff} cutoff).\n\nPlease ensure punctual check-ins for scheduled shifts.\n— Operations Team`;

    case 'admin_late_notice' as any: {
      const cleanPhone = data.employeePhone ? formatPhoneNumber(data.employeePhone).cleanDigits : '';
      const phoneDisplay = cleanPhone ? (cleanPhone.startsWith('+') ? cleanPhone : `+${cleanPhone}`) : '';
      const roleLine = data.role ? `💼 Role: ${data.role}\n` : '';
      const phoneLine = phoneDisplay ? `📱 Phone: ${phoneDisplay}\n` : '';

      let contactAction = '';
      if (cleanPhone) {
        const textMsg = encodeURIComponent(
          `Hi ${name}, management noticed you checked in late (+${data.lateMinutes || 0}m past ${cutoff}) today for your shift at ${site}.`
        );
        contactAction = `\n👉 1-Tap Contact Staff:\nhttps://wa.me/${cleanPhone}?text=${textMsg}\n`;
      }

      return `⏰ Staff Late Arrival Alert — ${today}\n📍 Facility: ${site}\n\n👤 Employee: ${name}\n${roleLine}⏱️ Punch Time: ${data.checkInTime || 'Just now'}\n⚠️ Delay: +${data.lateMinutes || 0} mins (Cutoff was ${cutoff})\n${phoneLine}${contactAction}\n— The Gut Guru Hospitality Operations`;
    }

    case 'checkout_reminder':
      return `🏁 Shift Check-Out Reminder\n\nHi ${name},\nYou have completed your shift at ${site} (${data.hoursElapsed || 9}+ hours elapsed). Please remember to capture your check-out selfie on the kiosk before leaving.\n\nThank you for your hard work!\n— Operations Team`;

    case 'admin_missed_checkout' as any: {
      const list = data.absentNames && data.absentNames.length > 0
        ? data.absentNames.map((n, i) => `  ${i + 1}. ${n}`).join('\n')
        : '  None (All checked out! 🎉)';
      return `🏁 Missed Check-Out Notice — ${today}\n📍 Facility: ${site}\n━━━━━━━━━━━━━━━━━━━━\nActive shifts without check-out punch:\n${list}\n\n🔗 Review Active Shifts:\nhttps://studio--invoiceflow-24nxt.us-central1.hosted.app/newrelic/attendance\n\n— The Gut Guru Hospitality Operations`;
    }

    case 'manager_digest': {
      const present = data.presentCount || 0;
      const total = data.totalRoster || 0;
      const pct = total > 0 ? Math.round((present / total) * 100) : 0;
      const meter = buildProgressBar(present, total, 10);
      const absentCount = data.absentNames?.length || 0;
      const absentList = data.absentNames && data.absentNames.length > 0
        ? data.absentNames.map((n, i) => `  ${i + 1}. ${n}`).join('\n')
        : '  None (100% Turnout! 🎉)';

      return `📊 Shift Attendance Digest — ${today}\n📍 Facility: ${site} · Turnout: ${pct}% ${pct >= 75 ? '🟢' : '🔴'}\n━━━━━━━━━━━━━━━━━━━━\nTurnout Meter: [${meter}] ${present} / ${total} Staff\n\n🟢 On Duty Right Now: ${data.onDutyCount || 0}\n🔴 Absent / Pending (${absentCount}):\n${absentList}\n\n🔗 Live Attendance Kiosk:\nhttps://studio--invoiceflow-24nxt.us-central1.hosted.app/newrelic/attendance\n\n— The Gut Guru Hospitality Operations`;
    }

    case 'group_absent_alert':
    case 'admin_absent_alert' as any: {
      const absentCount = data.absentNames?.length || 0;
      const absentList = data.absentNames && data.absentNames.length > 0
        ? data.absentNames.map((n, i) => `  ${i + 1}. ${n}`).join('\n')
        : '  All staff present! 🎉';
      return `📢 Morning Shift Cutoff Alert — ${today}\n📍 Facility: ${site} · Cutoff: ${cutoff}\n━━━━━━━━━━━━━━━━━━━━\n⚠️ Absent / Pending Punch (${absentCount}):\n${absentList}\n\n👉 Open Attendance Kiosk:\nhttps://studio--invoiceflow-24nxt.us-central1.hosted.app/newrelic/attendance\n\n— The Gut Guru Hospitality Operations`;
    }

    case 'dc_created': {
      const formattedDate = data.date || new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
      const location = (data as any).locationName || ((data as any).location === 'bangalore' ? 'Bangalore Hub (Bagmane Tech Park)' : 'Hyderabad Hub (DivyaSree NSL Orion)');
      const dcNum = (data as any).dcNumber || 'DC-NEW';
      const itemsCount = (data as any).lineItemsCount ?? 0;
      const totalQty = (data as any).totalQty ?? 0;
      const totalVal = (data as any).totalValue !== undefined
        ? `₹${Number((data as any).totalValue).toLocaleString('en-IN')}`
        : '₹0';
      const createdBy = (data as any).createdBy || 'manager@thegutguru.in';

      return `📦 New Delivery Challan Created — ${formattedDate}\n📍 Location: ${location}\n━━━━━━━━━━━━━━━━━━━━\n📄 DC Number: ${dcNum}\n🛒 Items Count: ${itemsCount} Line Items (Total Qty: ${totalQty})\n💰 Total Value (MRP): ${totalVal}\n👤 Created By: ${createdBy}\n🔗 1-Tap Download PDF:\nhttps://studio--invoiceflow-24nxt.us-central1.hosted.app/newrelic?dc=${encodeURIComponent(dcNum)}\n— The Gut Guru DC System`;
    }

    case 'billing_cycle_digest': {
      const cycleLabel = (data as any).cycleLabel || '15-Day Cycle Review';
      const period = (data as any).period || `${(data as any).startDate || ''} to ${(data as any).endDate || ''}`;
      const totalDcs = (data as any).totalDcs || 0;
      const totalVolume = (data as any).totalVolume !== undefined
        ? `₹${Number((data as any).totalVolume).toLocaleString('en-IN')}`
        : '₹0';
      const totalUnits = (data as any).totalUnits || 0;
      const missingCount = (data as any).missingSignedCount || 0;
      const missingDcs = (data as any).missingSignedDcs || [];
      const missingList = missingDcs.length > 0
        ? missingDcs.slice(0, 8).map((d: any) => `  • DC ${d.dcNumber} (${d.date || 'Recent'}) — ₹${Number(d.value || 0).toLocaleString('en-IN')}`).join('\n')
        : '';
      const moreText = missingDcs.length > 8
        ? `\n  ... and ${missingDcs.length - 8} more`
        : '';

      const signedSection = missingCount === 0
        ? `✅ All ${totalDcs} DCs have physical signed copies uploaded & verified!`
        : `⚠️ ${missingCount} DCs Missing Signed Copies (Action Required before Invoicing):\n${missingList}${moreText}`;

      return `📊 Bi-Weekly Billing Cycle Summary — ${cycleLabel}\n🏢 NewRelic Stall Operations (HYD & BLR Hubs)\n━━━━━━━━━━━━━━━━━━━━\n📅 Billing Period: ${period}\n📦 Total DCs Raised: ${totalDcs}\n💰 Total Billing Volume: ${totalVolume}\n🛒 Total Units Delivered: ${totalUnits}\n\n📑 Signed Copies Status:\n${signedSection}\n\n🔗 Review & Finalize Invoices:\nhttps://studio--invoiceflow-24nxt.us-central1.hosted.app/newrelic/reconcile\n— The Gut Guru Billing Operations`;
    }

    case 'test_ping':
      return `🔔 Gateway Test Notification\n\nThis is a test notification confirming your ${site} Alert Gateway is connected and operating correctly. Timestamp: ${new Date().toLocaleTimeString('en-IN')}`;

    default:
      return `Attendance Alert for ${name} (${site}): Please verify your shift status for ${today}.`;
  }
}

/** Send WhatsApp message via UltraMsg (QR-code based bridge) */
async function sendUltraMsg(
  config: AlertGatewayConfig,
  recipientPhone: string,
  message: string
): Promise<{ success: boolean; data?: any; error?: string }> {
  const ultramsg = config.ultramsg;
  if (!ultramsg?.instanceId || !ultramsg?.token) {
    return { success: false, error: 'UltraMsg credentials (Instance ID or Token) are missing.' };
  }

  const { cleanDigits } = formatPhoneNumber(recipientPhone);
  const endpoint = `https://api.ultramsg.com/${ultramsg.instanceId}/messages/chat`;

  const params = new URLSearchParams();
  params.append('token', ultramsg.token);
  params.append('to', cleanDigits);
  params.append('body', message);

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    const data = await res.json();
    if (!res.ok || data?.error) {
      return { success: false, error: data?.error || `HTTP ${res.status}: UltraMsg dispatch failed` };
    }
    return { success: true, data };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/** Send alert to Meta WhatsApp Cloud API */
async function sendMetaWhatsApp(
  config: AlertGatewayConfig,
  recipientPhone: string,
  message: string,
  options?: { isBotReply?: boolean; preferTemplate?: boolean }
): Promise<{ success: boolean; data?: any; error?: string }> {
  const meta = config.meta;
  const phoneNumberId = meta?.phoneNumberId || process.env.META_WHATSAPP_PHONE_NUMBER_ID;
  const accessToken = meta?.accessToken || process.env.META_WHATSAPP_ACCESS_TOKEN;

  if (!phoneNumberId || !accessToken) {
    return { success: false, error: 'Meta WhatsApp credentials (phoneNumberId or accessToken) are missing.' };
  }

  const { cleanDigits } = formatPhoneNumber(recipientPhone);
  const endpoint = `https://graph.facebook.com/v19.0/${phoneNumberId}/messages`;

  const makeMetaRequest = async (payload: any) => {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    return { ok: res.ok, status: res.status, data };
  };

  try {
    const isHelloWorld = message === 'hello_world' || message.startsWith('TEMPLATE:hello_world');

    if (isHelloWorld) {
      const res = await makeMetaRequest({
        messaging_product: 'whatsapp',
        to: cleanDigits,
        type: 'template',
        template: {
          name: 'hello_world',
          language: { code: 'en_US' },
        },
      });
      if (res.ok) return { success: true, data: res.data };
      return { success: false, error: res.data?.error?.message || 'Failed to send hello_world template' };
    }

    // Proactive outbound alerts (shift digests, late arrivals, absent staff) MUST be sent via an approved template
    // to guarantee delivery 24/7 without being dropped by Meta's 24-hour customer window policy.
    // Bot replies (when user messaged the bot) use rich freeform text.
    const isBotReply = options?.isBotReply === true;
    const preferTemplate = options?.preferTemplate ?? !isBotReply;

    if (preferTemplate) {
      // Sanitize multi-line text into a single-line string for Meta template variable rules
      const sanitizedText = message
        .replace(/[\r\n]+/g, ' · ')
        .replace(/\s{2,}/g, ' ')
        .trim()
        .slice(0, 1000);

      const templatePayload = {
        messaging_product: 'whatsapp',
        to: cleanDigits,
        type: 'template',
        template: {
          name: 'attendance_alert_notice',
          language: { code: 'en_US' },
          components: [
            {
              type: 'body',
              parameters: [
                {
                  type: 'text',
                  text: sanitizedText,
                },
              ],
            },
          ],
        },
      };

      const res = await makeMetaRequest(templatePayload);
      if (res.ok) {
        return { success: true, data: res.data };
      }
      console.warn('[MetaWhatsApp] Template send failed, falling back to text:', res.data?.error?.message);
    }

    // Freeform text (for interactive bot responses inside the 24-hour window)
    const textPayload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: cleanDigits,
      type: 'text',
      text: {
        preview_url: false,
        body: message,
      },
    };

    const { ok, status, data } = await makeMetaRequest(textPayload);

    if (ok) {
      return { success: true, data };
    }

    const errorCode = data?.error?.code;

    // Error 190: Access Token Expired or Invalid OAuth
    if (errorCode === 190) {
      return {
        success: false,
        error: `(#190) Meta Access Token Expired. Your 24-hour temporary token in Meta Developer Console has expired. Please copy a fresh token from developers.facebook.com/apps or configure a permanent System User Token in Meta Business Settings.`,
      };
    }

    // Error 131030: Number not in developer test allowed list
    if (errorCode === 131030) {
      return {
        success: false,
        error: `(#131030) Phone number +${cleanDigits} is not in your Meta Test Allowed List. In Meta Developer Console (WhatsApp > API Setup > Step 2: "To" dropdown), click "Manage phone number list", add +${cleanDigits}, and verify via OTP.`,
      };
    }

    // Error 131047: Customer service window is closed (>24h). Fall back to approved attendance_alert_notice template
    if (errorCode === 131047 && !isHelloWorld) {
      console.warn('[MetaWhatsApp] 24h custom text window closed. Attempting attendance_alert_notice template fallback...');
      const sanitizedText = message.replace(/[\r\n]+/g, ' · ').replace(/\s{2,}/g, ' ').slice(0, 1000);
      const fallbackPayload = {
        messaging_product: 'whatsapp',
        to: cleanDigits,
        type: 'template',
        template: {
          name: 'attendance_alert_notice',
          language: { code: 'en_US' },
          components: [
            {
              type: 'body',
              parameters: [
                {
                  type: 'text',
                  text: sanitizedText,
                },
              ],
            },
          ],
        },
      };
      const fallbackRes = await makeMetaRequest(fallbackPayload);
      if (fallbackRes.ok) {
        return {
          success: true,
          data: { ...fallbackRes.data, note: 'Delivered via pre-approved attendance_alert_notice template (24h window fallback)' },
        };
      }
    }

    return {
      success: false,
      error: data?.error?.error_data?.details || data?.error?.message || `HTTP ${status}: Failed to send WhatsApp via Meta Cloud API`,
    };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/** Send alert via Twilio Messaging API (SMS or WhatsApp) */
async function sendTwilio(
  config: AlertGatewayConfig,
  recipientPhone: string,
  message: string,
  channel: 'whatsapp' | 'sms' | 'auto'
): Promise<{ success: boolean; data?: any; error?: string }> {
  const twilio = config.twilio;
  if (!twilio?.accountSid || !twilio?.authToken || !twilio?.fromNumber) {
    return { success: false, error: 'Twilio credentials (accountSid, authToken, or fromNumber) are missing.' };
  }

  const { withPlus } = formatPhoneNumber(recipientPhone);
  const isWhatsApp = channel === 'whatsapp' || twilio.fromNumber.startsWith('whatsapp:');
  const to = isWhatsApp ? `whatsapp:${withPlus}` : withPlus;
  const from = twilio.fromNumber;

  const endpoint = `https://api.twilio.com/2010-04-01/Accounts/${twilio.accountSid}/Messages.json`;
  const basicAuth = Buffer.from(`${twilio.accountSid}:${twilio.authToken}`).toString('base64');

  const params = new URLSearchParams();
  params.append('To', to);
  params.append('From', from);
  params.append('Body', message);

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${basicAuth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    const data = await res.json();
    if (!res.ok) {
      return { success: false, error: data?.message || `HTTP ${res.status}: Twilio error` };
    }
    return { success: true, data };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/** Send SMS via Fast2SMS (Indian SMS Gateway) */
async function sendFast2SMS(
  config: AlertGatewayConfig,
  recipientPhone: string,
  message: string
): Promise<{ success: boolean; data?: any; error?: string }> {
  const fast2sms = config.fast2sms;
  if (!fast2sms?.apiKey) {
    return { success: false, error: 'Fast2SMS API Key is missing.' };
  }

  const { tenDigits } = formatPhoneNumber(recipientPhone);
  const endpoint = 'https://www.fast2sms.com/dev/bulkV2';

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'authorization': fast2sms.apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        route: fast2sms.route || 'q',
        message,
        language: 'english',
        flash: 0,
        numbers: tenDigits,
      }),
    });

    const data = await res.json();
    if (!res.ok || data?.return === false) {
      return { success: false, error: data?.message?.[0] || 'Fast2SMS dispatch failed' };
    }
    return { success: true, data };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/** Send SMS via MSG91 */
async function sendMSG91(
  config: AlertGatewayConfig,
  recipientPhone: string,
  message: string
): Promise<{ success: boolean; data?: any; error?: string }> {
  const msg91 = config.msg91;
  if (!msg91?.authKey) {
    return { success: false, error: 'MSG91 AuthKey is missing.' };
  }

  const { cleanDigits } = formatPhoneNumber(recipientPhone);
  const endpoint = 'https://control.msg91.com/api/v5/flow/';

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'authkey': msg91.authKey,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        template_id: msg91.flowId || '',
        short_url: '0',
        recipients: [
          {
            mobiles: cleanDigits,
            message,
          },
        ],
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      return { success: false, error: data?.message || 'MSG91 dispatch failed' };
    }
    return { success: true, data };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/** Send payload via Webhook (Zapier / Make / n8n) */
async function sendWebhook(
  config: AlertGatewayConfig,
  recipientPhone: string,
  recipientName: string | undefined,
  alertType: string,
  message: string
): Promise<{ success: boolean; data?: any; error?: string }> {
  const webhook = config.webhook;
  if (!webhook?.webhookUrl) {
    return { success: false, error: 'Webhook URL is not configured.' };
  }

  const { cleanDigits, withPlus } = formatPhoneNumber(recipientPhone);

  try {
    const res = await fetch(webhook.webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(webhook.secretToken ? { 'X-Webhook-Token': webhook.secretToken } : {}),
      },
      body: JSON.stringify({
        event: alertType,
        recipientPhone: withPlus,
        recipientDigits: cleanDigits,
        recipientName: recipientName || '',
        message,
        timestamp: new Date().toISOString(),
      }),
    });

    if (!res.ok) {
      return { success: false, error: `Webhook returned status ${res.status}` };
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/** Log dispatched alert to Firestore for audit and reporting */
export async function logAlertDispatch(record: Omit<AlertDispatchRecord, 'id'>): Promise<string> {
  try {
    const ref = await addDoc(collection(db, LOGS_COLLECTION), record);
    return ref.id;
  } catch (e) {
    console.error('Failed to log alert dispatch to Firestore:', e);
    return '';
  }
}

/** Retrieve recent alert dispatch records */
export async function getRecentAlertLogs(limitCount: number = 20): Promise<AlertDispatchRecord[]> {
  try {
    const q = query(
      collection(db, LOGS_COLLECTION),
      orderBy('timestamp', 'desc'),
      limit(limitCount)
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as AlertDispatchRecord));
  } catch (err) {
    console.warn('Error fetching recent alert logs:', err);
    return [];
  }
}

/** Main Alert Dispatch Orchestrator */
export async function dispatchAlert(
  req: SendAlertRequest,
  configOverride?: AlertGatewayConfig,
  senderEmail?: string | null
): Promise<{ success: boolean; provider: AlertProviderType; error?: string }> {
  const config = configOverride || (await getAlertGatewayConfig());
  const provider = config.activeProvider || 'mock';
  const message = req.customMessage || generateAlertMessage(req.alertType, {
    employeeName: req.recipientName,
    ...req.metadata,
  });

  const channelUsed =
    req.channel && req.channel !== 'auto'
      ? req.channel
      : provider === 'meta_whatsapp' || provider === 'ultramsg'
      ? 'whatsapp'
      : provider === 'fast2sms' || provider === 'msg91'
      ? 'sms'
      : provider === 'twilio' && config.twilio?.fromNumber?.startsWith('whatsapp:')
      ? 'whatsapp'
      : 'sms';

  let result: { success: boolean; data?: any; error?: string };

  switch (provider) {
    case 'ultramsg':
      result = await sendUltraMsg(config, req.to, message);
      break;

    case 'meta_whatsapp':
      result = await sendMetaWhatsApp(config, req.to, message, {
        isBotReply: req.isBotReply,
        preferTemplate: req.preferTemplate,
      });
      break;

    case 'twilio':
      result = await sendTwilio(config, req.to, message, channelUsed as any);
      break;

    case 'fast2sms':
      result = await sendFast2SMS(config, req.to, message);
      break;

    case 'msg91':
      result = await sendMSG91(config, req.to, message);
      break;

    case 'webhook':
      result = await sendWebhook(config, req.to, req.recipientName, req.alertType, message);
      break;

    case 'mock':
    default:
      // Simulator mode: Log successfully without charging external SMS/WhatsApp credits
      console.log(`[AlertGateway:MOCK] Sent ${channelUsed} to ${req.to}: "${message.slice(0, 60)}..."`);
      result = { success: true, data: { simulated: true } };
      break;
  }

  // Record dispatch log asynchronously
  await logAlertDispatch({
    timestamp: new Date().toISOString(),
    provider,
    channel: provider === 'webhook' ? 'webhook' : (channelUsed as 'whatsapp' | 'sms'),
    recipientPhone: req.to,
    recipientName: req.recipientName || '',
    alertType: req.alertType,
    status: result.success ? (provider === 'mock' ? 'simulated' : 'sent') : 'failed',
    messageBody: message,
    providerResponse: result.data || null,
    error: result.error || '',
    sentBy: senderEmail || 'system',
  });

  return {
    success: result.success,
    provider,
    error: result.error,
  };
}

/**
 * Dispatch an automated alert to all configured admin / manager phone numbers
 * (strictly limited to top 5 managers for safety and quota compliance)
 */
export async function dispatchAlertToAdmins(
  alertPayload: {
    alertType: SendAlertRequest['alertType'];
    customMessage: string;
    siteId?: string;
  },
  configOverride?: AlertGatewayConfig,
  senderEmail?: string | null
): Promise<{
  totalSent: number;
  totalFailed: number;
  results: Array<{ phone: string; success: boolean; error?: string }>;
}> {
  const config = configOverride || (await getAlertGatewayConfig());

  // Collect raw target manager phone numbers
  const rawTargets: string[] = [];
  if (config.adminPhones && Array.isArray(config.adminPhones)) {
    rawTargets.push(...config.adminPhones);
  }
  if (config.managerPhone) {
    rawTargets.push(config.managerPhone);
  }
  if (alertPayload.siteId && config.managerSiteRouting?.[alertPayload.siteId]) {
    rawTargets.push(config.managerSiteRouting[alertPayload.siteId]);
  }
  if (rawTargets.length === 0) {
    rawTargets.push('917709632898');
  }

  // Deduplicate and sanitize to top 5 manager numbers max
  const uniquePhones = Array.from(
    new Set(rawTargets.map((p) => formatPhoneNumber(p).cleanDigits).filter(Boolean))
  ).slice(0, 5);

  const results: Array<{ phone: string; success: boolean; error?: string }> = [];
  let totalSent = 0;
  let totalFailed = 0;

  for (const phone of uniquePhones) {
    const res = await dispatchAlert(
      {
        to: phone,
        recipientName: 'Operations Admin',
        alertType: alertPayload.alertType,
        customMessage: alertPayload.customMessage,
      },
      config,
      senderEmail || 'system:auto-alert'
    );
    if (res.success) {
      totalSent++;
    } else {
      totalFailed++;
    }
    results.push({ phone, success: res.success, error: res.error });
  }

  return { totalSent, totalFailed, results };
}

/**
 * Dispatch real-time WhatsApp notice when a Delivery Challan is finalized and saved
 * Targets Operational Admins + Location-Specific Supervisors (e.g. Laxman for BLR/HYD)
 */
export async function dispatchDcAlert(
  dcData: {
    dcNumber: string;
    location: string;
    lineItemsCount: number;
    totalQty: number;
    totalValue: number;
    createdBy: string;
    date?: string;
  },
  configOverride?: AlertGatewayConfig,
  senderEmail?: string | null
): Promise<{
  totalSent: number;
  totalFailed: number;
  results: Array<{ phone: string; success: boolean; error?: string }>;
}> {
  const config = configOverride || (await getAlertGatewayConfig());
  if (config.enableAutoDcAlert === false) {
    return { totalSent: 0, totalFailed: 0, results: [] };
  }

  const rawTargets: string[] = [];
  // 1. Operational admins
  if (config.adminPhones && Array.isArray(config.adminPhones)) {
    rawTargets.push(...config.adminPhones);
  }
  if (config.managerPhone) {
    rawTargets.push(config.managerPhone);
  }

  // 2. Hub-specific routing (if specified)
  const loc = dcData.location?.toLowerCase().trim() || 'hyderabad';
  if (config.dcRouting?.[loc] && Array.isArray(config.dcRouting[loc]) && config.dcRouting[loc].length > 0) {
    rawTargets.push(...config.dcRouting[loc]);
  }

  if (rawTargets.length === 0) {
    rawTargets.push('917709632898');
  }

  // Deduplicate and filter out Laxman (918897036993) to send strictly to admin
  const uniquePhones = Array.from(
    new Set(rawTargets.map((p) => formatPhoneNumber(p).cleanDigits).filter((p) => p && !p.includes('8897036993')))
  ).slice(0, 5);

  const locName = loc === 'bangalore' ? 'Bangalore Hub (Bagmane Tech Park)' : 'Hyderabad Hub (DivyaSree NSL Orion)';
  const message = generateAlertMessage('dc_created', {
    date: dcData.date,
    locationName: locName,
    location: loc,
    dcNumber: dcData.dcNumber,
    lineItemsCount: dcData.lineItemsCount,
    totalQty: dcData.totalQty,
    totalValue: dcData.totalValue,
    createdBy: dcData.createdBy,
  } as any);

  const results: Array<{ phone: string; success: boolean; error?: string }> = [];
  let totalSent = 0;
  let totalFailed = 0;

  for (const phone of uniquePhones) {
    const res = await dispatchAlert(
      {
        to: phone,
        recipientName: 'DC Supervisor / Ops Admin',
        alertType: 'dc_created',
        customMessage: message,
      },
      config,
      senderEmail || 'system:dc-notice'
    );
    if (res.success) {
      totalSent++;
    } else {
      totalFailed++;
    }
    results.push({ phone, success: res.success, error: res.error });
  }

  return { totalSent, totalFailed, results };
}

/**
 * Dispatch Bi-Weekly Billing Cycle Summary (Runs on 15th & end of month at 08:00 PM)
 * Dispatches total DCs, total billing volume, and any DCs missing signed copies
 */
export async function dispatchBillingCycleDigest(
  digestData: {
    cycleLabel: string;
    startDate: string;
    endDate: string;
    totalDcs: number;
    totalVolume: number;
    totalUnits: number;
    missingSignedCount: number;
    missingSignedDcs: Array<{ dcNumber: string; date: string; value: number }>;
  },
  configOverride?: AlertGatewayConfig,
  senderEmail?: string | null
): Promise<{
  totalSent: number;
  totalFailed: number;
  results: Array<{ phone: string; success: boolean; error?: string }>;
}> {
  const config = configOverride || (await getAlertGatewayConfig());
  if (config.enableBiWeeklyBillingDigest === false) {
    return { totalSent: 0, totalFailed: 0, results: [] };
  }

  const rawTargets: string[] = [];
  // Send exclusively to Operational Admins
  if (config.adminPhones && Array.isArray(config.adminPhones)) {
    rawTargets.push(...config.adminPhones);
  }
  if (config.managerPhone) {
    rawTargets.push(config.managerPhone);
  }
  if (rawTargets.length === 0) {
    rawTargets.push('917709632898');
  }

  // Deduplicate and filter out Laxman (918897036993) to send strictly to admin
  const uniquePhones = Array.from(
    new Set(rawTargets.map((p) => formatPhoneNumber(p).cleanDigits).filter((p) => p && !p.includes('8897036993')))
  ).slice(0, 5);

  const message = generateAlertMessage('billing_cycle_digest', {
    cycleLabel: digestData.cycleLabel,
    period: `${digestData.startDate} to ${digestData.endDate}`,
    totalDcs: digestData.totalDcs,
    totalVolume: digestData.totalVolume,
    totalUnits: digestData.totalUnits,
    missingSignedCount: digestData.missingSignedCount,
    missingSignedDcs: digestData.missingSignedDcs,
  } as any);

  const results: Array<{ phone: string; success: boolean; error?: string }> = [];
  let totalSent = 0;
  let totalFailed = 0;

  for (const phone of uniquePhones) {
    const res = await dispatchAlert(
      {
        to: phone,
        recipientName: 'Billing & Ops Admin',
        alertType: 'billing_cycle_digest',
        customMessage: message,
      },
      config,
      senderEmail || 'system:billing-digest'
    );
    if (res.success) {
      totalSent++;
    } else {
      totalFailed++;
    }
    results.push({ phone, success: res.success, error: res.error });
  }

  return { totalSent, totalFailed, results };
}

/**
 * Dispatch real-time WhatsApp alert when counter staff requests a Petty Cash Float replenishment
 * Sends alert directly to Operational Admin (+91 77096 32898 / configured admin phones)
 */
export async function dispatchPettyCashRequestAlert(
  data: {
    requestId: string;
    siteName: string;
    location: string;
    requestedBy: string;
    amount: number;
    reason: string;
    currentBalance: number;
    preferredMode?: string;
  },
  configOverride?: AlertGatewayConfig,
  senderEmail?: string | null
): Promise<{
  totalSent: number;
  totalFailed: number;
  results: Array<{ phone: string; success: boolean; error?: string }>;
}> {
  const config = configOverride || (await getAlertGatewayConfig());

  const rawTargets: string[] = [];
  if (config.adminPhones && Array.isArray(config.adminPhones)) {
    rawTargets.push(...config.adminPhones);
  }
  if (config.managerPhone) {
    rawTargets.push(config.managerPhone);
  }
  if (rawTargets.length === 0) {
    rawTargets.push('917709632898');
  }

  // Deduplicate and filter out staff phones to ensure alerts reach the business owner/admin
  const uniquePhones = Array.from(
    new Set(rawTargets.map((p) => formatPhoneNumber(p).cleanDigits).filter((p) => p && !p.includes('8897036993')))
  ).slice(0, 5);

  const timeStr = new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }).format(new Date());

  const amountVal = Number(data.amount ?? (data as any).requestedAmount ?? 0);
  const currentBalanceVal = Number(data.currentBalance ?? 0);
  const staffName = data.requestedBy || (data as any).staffName || 'Counter Staff';
  const site = data.siteName || (data as any).counterName || 'Tuckshop Counter';
  const loc = data.location || (data as any).locationName || 'Stall';
  const reasonText = data.reason || (data as any).purpose || 'Morning supplies replenishment';
  const rawMode = (data.preferredMode || '').toLowerCase();
  const modeText = rawMode.includes('bank') ? '🏦 HDFC NetBanking / IMPS' : '📱 PhonePe / UPI Transfer';
  const rawPhone = (data as any).payeePhone ? String((data as any).payeePhone).replace(/\D/g, '').slice(-10) : '';
  const payeeUpi = (data as any).payeeUpi || (rawPhone ? `${rawPhone}@ybl` : '');
  const upiPayLink = payeeUpi
    ? `upi://pay?pa=${encodeURIComponent(payeeUpi)}&pn=${encodeURIComponent(staffName)}&am=${amountVal}&cu=INR&tn=${encodeURIComponent('Tuckshop-Petty-Cash')}`
    : '';

  const waPayLink = rawPhone
    ? `https://wa.me/91${rawPhone}?text=${encodeURIComponent(`Hi ${staffName}, approving petty cash float top-up of ₹${amountVal.toLocaleString('en-IN')} for ${site}.`)}`
    : '';

  const portalLink = `https://studio--invoiceflow-24nxt.us-central1.hosted.app/newrelic/tuckshop?floatReq=${data.requestId}`;

  const message = `🚨 *PETTY CASH FLOAT TOP-UP REQUEST*
━━━━━━━━━━━━━━━━━━━━
👤 *Staff:* ${staffName}
🏢 *Counter:* ${site} (${loc})
💰 *Requested Amount:* ₹${amountVal.toLocaleString('en-IN')}
📝 *Purpose:* ${reasonText}
💵 *Current Drawer Balance:* ₹${currentBalanceVal.toLocaleString('en-IN')}
💳 *Preferred Mode:* ${modeText}
⏰ *Time:* ${timeStr}
━━━━━━━━━━━━━━━━━━━━
${waPayLink ? `💬 *1-Tap Pay via WhatsApp:*\n${waPayLink}\n\n` : ''}${rawPhone ? `📱 *Phone / UPI:* +91 ${rawPhone} (${payeeUpi})\n\n` : ''}👉 *Review & Approve in Portal:*
${portalLink}`;

  const results: Array<{ phone: string; success: boolean; error?: string }> = [];
  let totalSent = 0;
  let totalFailed = 0;

  for (const phone of uniquePhones) {
    const res = await dispatchAlert(
      {
        to: phone,
        recipientName: 'Tuckshop Ops Admin',
        alertType: 'custom',
        customMessage: message,
      },
      config,
      senderEmail || 'system:petty-cash-request'
    );
    if (res.success) {
      totalSent++;
    } else {
      totalFailed++;
    }
    results.push({ phone, success: res.success, error: res.error });
  }

  return { totalSent, totalFailed, results };
}
