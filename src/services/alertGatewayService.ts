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
    phoneNumberId: '1406728339194059',
    accessToken: '',
    wabaId: '1353279520061969',
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
  enableAutoLateAlert: false,
  enableAutoCheckoutReminder: false,
  managerPhone: '917709632898',
  managerSiteRouting: {},
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
    phoneNumberId: currentPhoneId || envPhoneId || '1406728339194059',
    accessToken: currentToken || envToken || '',
    wabaId: currentWabaId || envWabaId || '1353279520061969',
  };

  // If token is available and provider was mock or missing, promote to meta_whatsapp
  if ((config.meta.accessToken || envToken) && (config.activeProvider === 'mock' || !config.activeProvider)) {
    config.activeProvider = 'meta_whatsapp';
    config.channel = 'whatsapp';
  }

  if (!config.managerPhone?.trim()) {
    config.managerPhone = '917709632898';
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

/** Generate standardized message copy for alerts */
export function generateAlertMessage(
  alertType: SendAlertRequest['alertType'],
  data: {
    employeeName?: string;
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
  const site = data.siteName || 'InvoiceFlow Hub';
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

    case 'checkout_reminder':
      return `🏁 Shift Check-Out Reminder\n\nHi ${name},\nYou have completed your shift at ${site} (${data.hoursElapsed || 9}+ hours elapsed). Please remember to capture your check-out selfie on the kiosk before leaving.\n\nThank you for your hard work!\n— Operations Team`;

    case 'manager_digest':
      return `📊 Shift Attendance Digest — ${today}\n📍 Site: ${site}\n\n👥 Total Punched: ${data.presentCount || 0} / ${data.totalRoster || 0}\n🟢 On Duty: ${data.onDutyCount || 0}\n🔴 Absent / Pending (${data.absentNames?.length || 0}):\n${data.absentNames && data.absentNames.length > 0 ? data.absentNames.map((n, i) => `  ${i + 1}. ${n}`).join('\n') : '  None (100% Turnout! 🎉)'}\n\n— Generated via InvoiceFlow Attendance`;

    case 'group_absent_alert': {
      const absentList = data.absentNames && data.absentNames.length > 0
        ? data.absentNames.map((n, i) => `  ${i + 1}. ${n}`).join('\n')
        : '  All staff present!';
      return `📢 Shift Attendance Alert — ${today}\n📍 Site: ${site} · Cutoff: ${cutoff}\n\nThe following team members have not checked in yet:\n${absentList}\n\nPlease mark attendance immediately on the kiosk or update management.\n— Operations Team`;
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
  message: string
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
    const isTemplateRequest = message === 'hello_world' || message.startsWith('TEMPLATE:hello_world');

    const primaryPayload = isTemplateRequest
      ? {
          messaging_product: 'whatsapp',
          to: cleanDigits,
          type: 'template',
          template: {
            name: 'hello_world',
            language: { code: 'en_US' },
          },
        }
      : {
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: cleanDigits,
          type: 'text',
          text: {
            preview_url: false,
            body: message,
          },
        };

    const { ok, status, data } = await makeMetaRequest(primaryPayload);

    if (ok) {
      return { success: true, data };
    }

    const errorCode = data?.error?.code;

    // Error 131030: Number not in developer test allowed list
    if (errorCode === 131030) {
      return {
        success: false,
        error: `(#131030) Phone number +${cleanDigits} is not in your Meta Test Allowed List. In Meta Developer Console (WhatsApp > API Setup > Step 2: "To" dropdown), click "Manage phone number list", add +${cleanDigits}, and verify via OTP.`,
      };
    }

    // Error 131047: Customer service window is closed (>24h). Fall back to approved hello_world template for test pings
    if (errorCode === 131047 && !isTemplateRequest) {
      console.warn('[MetaWhatsApp] 24h custom text window closed. Attempting hello_world template fallback...');
      const fallbackPayload = {
        messaging_product: 'whatsapp',
        to: cleanDigits,
        type: 'template',
        template: {
          name: 'hello_world',
          language: { code: 'en_US' },
        },
      };
      const fallbackRes = await makeMetaRequest(fallbackPayload);
      if (fallbackRes.ok) {
        return {
          success: true,
          data: { ...fallbackRes.data, note: 'Delivered via pre-approved template (24h custom text window was closed)' },
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
      result = await sendMetaWhatsApp(config, req.to, message);
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
