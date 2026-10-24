/**
 * WhatsApp Messaging Utility for InvoiceFlow
 * Handles cross-platform URL creation (mobile native vs desktop web),
 * clipboard copying, native OS sharing, and daily alert tracking.
 */

export interface ContactedRecord {
  timestamp: string; // ISO string
  formattedTime: string; // e.g. "09:45 AM"
  template: string;
  recipientName?: string;
  phone?: string;
}

const STORAGE_PREFIX = 'invoiceflow_wa_contacted_';

/** Returns YYYY-MM-DD for today in Indian standard time */
export function getTodayKey(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Detect if running on mobile device / tablet */
export function isMobileDevice(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  const isTouch = navigator.maxTouchPoints > 0;
  return /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua) || (isTouch && window.innerWidth < 768);
}

/** Normalize Indian mobile number or international phone */
export function cleanPhoneNumber(rawPhone?: string): {
  cleanDigits: string;
  tenDigits: string;
  withPlus: string;
  isValid: boolean;
} {
  if (!rawPhone) {
    return { cleanDigits: '', tenDigits: '', withPlus: '', isValid: false };
  }
  const digits = rawPhone.replace(/\D/g, '');
  if (digits.length < 10) {
    return { cleanDigits: digits, tenDigits: digits, withPlus: `+${digits}`, isValid: false };
  }
  const ten = digits.slice(-10);
  const normalized = digits.length === 10 ? `91${digits}` : digits.startsWith('91') ? digits : `91${ten}`;
  return {
    cleanDigits: normalized,
    tenDigits: ten,
    withPlus: `+${normalized}`,
    isValid: ten.length === 10,
  };
}

/**
 * Builds the best WhatsApp link based on device and phone availability
 */
export function buildWhatsAppUrl(
  rawPhone?: string,
  messageText?: string,
  preferredPlatform?: 'auto' | 'web' | 'app'
): string {
  const encodedText = encodeURIComponent((messageText || '').trim());
  const { cleanDigits, isValid } = cleanPhoneNumber(rawPhone);

  // If no phone or invalid phone number, open WhatsApp to select contact/group
  if (!isValid || !cleanDigits) {
    return `https://api.whatsapp.com/send?text=${encodedText}`;
  }

  // Force desktop web if requested
  if (preferredPlatform === 'web') {
    return `https://web.whatsapp.com/send?phone=${cleanDigits}&text=${encodedText}`;
  }

  // Native app protocol for mobile if requested
  if (preferredPlatform === 'app') {
    return `whatsapp://send?phone=${cleanDigits}&text=${encodedText}`;
  }

  // Universal fallback: wa.me routes to WhatsApp App on mobile and WhatsApp Web on desktop
  return `https://wa.me/${cleanDigits}?text=${encodedText}`;
}

/**
 * Open WhatsApp directly in new window or native app
 */
export function openWhatsAppChat(
  rawPhone?: string,
  messageText?: string,
  preferredPlatform: 'auto' | 'web' | 'app' = 'auto'
): void {
  if (typeof window === 'undefined') return;
  const url = buildWhatsAppUrl(rawPhone, messageText, preferredPlatform);
  window.open(url, '_blank', 'noopener,noreferrer');
}

/**
 * Copy message to clipboard with browser fallback
 */
export async function copyTextToClipboard(text: string): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  try {
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fallback below
  }

  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    textarea.style.left = '-9999px';
    document.body.appendChild(textarea);
    textarea.select();
    const successful = document.execCommand('copy');
    document.body.removeChild(textarea);
    return successful;
  } catch (err) {
    console.error('Failed to copy to clipboard', err);
    return false;
  }
}

/**
 * Native OS Web Share (great for Android Capacitor & mobile browsers)
 */
export async function shareViaNative(options: {
  title?: string;
  text: string;
  url?: string;
}): Promise<boolean> {
  if (typeof navigator === 'undefined' || !navigator.share) {
    return false;
  }
  try {
    await navigator.share({
      title: options.title || 'Attendance Update',
      text: options.text,
      url: options.url,
    });
    return true;
  } catch (err: any) {
    // AbortError is triggered if user cancels the share dialog
    if (err?.name === 'AbortError') return true;
    console.warn('Native share failed', err);
    return false;
  }
}

/**
 * Get map of employees contacted today: { [empId]: ContactedRecord }
 */
export function getContactedLog(dateKey = getTodayKey()): Record<string, ContactedRecord> {
  if (typeof window === 'undefined' || !window.localStorage) return {};
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${dateKey}`);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

/**
 * Mark an employee as contacted today in localStorage and emit window event
 */
export function markEmployeeContacted(
  empId: string,
  info: { template: string; recipientName?: string; phone?: string }
): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    const dateKey = getTodayKey();
    const current = getContactedLog(dateKey);
    const now = new Date();
    const formattedTime = now.toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });

    current[empId] = {
      timestamp: now.toISOString(),
      formattedTime,
      template: info.template,
      recipientName: info.recipientName,
      phone: info.phone,
    };

    localStorage.setItem(`${STORAGE_PREFIX}${dateKey}`, JSON.stringify(current));
    window.dispatchEvent(new CustomEvent('invoiceflow_contacted_updated', { detail: { dateKey, empId } }));
  } catch (err) {
    console.error('Failed to save contacted log', err);
  }
}
