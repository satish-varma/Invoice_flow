export type AlertProviderType =
  | 'ultramsg'
  | 'meta_whatsapp'
  | 'twilio'
  | 'fast2sms'
  | 'msg91'
  | 'webhook'
  | 'mock';

export interface UltraMsgConfig {
  instanceId: string;
  token: string;
}

export interface MetaWhatsAppConfig {
  phoneNumberId: string;
  accessToken: string;
  wabaId?: string;
}

export interface TwilioConfig {
  accountSid: string;
  authToken: string;
  fromNumber: string; // e.g. "whatsapp:+14155238886" or "+1234567890" for SMS
}

export interface Fast2SMSConfig {
  apiKey: string;
  senderId?: string;
  route?: string; // e.g. 'q' or 'v3' or 'dlt'
}

export interface MSG91Config {
  authKey: string;
  senderId: string;
  flowId?: string;
}

export interface WebhookConfig {
  webhookUrl: string;
  secretToken?: string;
}

export interface AlertGatewayConfig {
  activeProvider: AlertProviderType;
  channel: 'whatsapp' | 'sms' | 'auto';
  ultramsg?: UltraMsgConfig;
  meta?: MetaWhatsAppConfig;
  twilio?: TwilioConfig;
  fast2sms?: Fast2SMSConfig;
  msg91?: MSG91Config;
  webhook?: WebhookConfig;
  // Automation settings
  enableAutoLateAlert: boolean; // Auto WhatsApp alert to admins when employee arrives late
  enableAutoAbsentAlert?: boolean; // Auto WhatsApp alert to admins when cutoff passes with absentees
  enableAutoCheckoutReminder: boolean; // Remind staff and notify admins of missed checkouts
  enableAutoDailyDigest?: boolean; // Auto morning digest to admins
  managerPhone: string; // primary admin phone (e.g. "917709632898")
  adminPhones?: string[]; // top 5 manager/admin WhatsApp numbers (e.g. ['917709632898'])
  managerSiteRouting?: Record<string, string>; // siteId -> manager phone number
  updatedAt?: string;
  updatedBy?: string;
}

export interface AlertDispatchRecord {
  id?: string;
  timestamp: string;
  provider: AlertProviderType;
  channel: 'whatsapp' | 'sms' | 'webhook';
  recipientPhone: string;
  recipientName?: string;
  alertType: 'absent_notice' | 'late_alert' | 'checkout_reminder' | 'manager_digest' | 'test_ping' | 'custom' | 'gentle_reminder' | 'group_absent_alert';
  status: 'sent' | 'delivered' | 'failed' | 'simulated';
  messageBody: string;
  providerResponse?: any;
  error?: string;
  sentBy?: string;
}

export interface SendAlertRequest {
  to: string;
  recipientName?: string;
  alertType: 'absent_notice' | 'late_alert' | 'checkout_reminder' | 'manager_digest' | 'test_ping' | 'custom' | 'gentle_reminder' | 'group_absent_alert';
  channel?: 'whatsapp' | 'sms' | 'auto';
  customMessage?: string;
  metadata?: Record<string, any>;
}
