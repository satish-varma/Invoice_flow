/**
 * Parser utilities for HungerBox Payment Advice remittance invoices.
 */

export const KNOWN_STALL_MAP: Record<string, string> = {
  SipnByteDLF: 'SipnByte DLF',
  SipnByteSkyview: 'SipnByte Skyview',
  SnackOnDLF: 'Snack On DLF',
  JuicytailesJuiceCounter: 'Juicytailes Juice Counter',
  MunchboxLiveCounter: 'Munchbox Live Counter',
  SlurpstoreBakery: 'Slurpstore Bakery',
  LiveCounter: 'Live Counter',
  LiveCounterGutGuru: 'Live Counter',
  JuiceCounter: 'Juice Counter',
  TuckShop: 'Tuck Shop',
  Tuckshop: 'Tuck Shop',
  TuckshopNTTDATA: 'Tuckshop NTT DATA',
  TuckshopCovance: 'Tuckshop Covance',
  RelicFresh: 'Relic Fresh',
  TheGutGuru: 'The Gut Guru',
  GutGuruTuckshop: 'Gut Guru Tuckshop',
  THEGUTGURUEvent: 'The Gut Guru Event',
  TheGutGuruEvents: 'The Gut Guru Event',
  Orion14thfloorCafeteriaTuckshop: 'Orion 14th Floor Cafeteria Tuckshop',
  CovanceSoftSolLimitedSoftSol: 'Covance SoftSol',
};

export interface ExtractedInvoiceMetadata {
  stall: string;
  location: string;
  serviceDateRange?: string;
}

export function isGarbageText(val?: string | null): boolean {
  if (!val) return true;
  const s = val.toLowerCase().trim();
  return (
    s === '' ||
    s === 'unknown stall' ||
    s === 'other' ||
    s.includes('settlementid:') ||
    s.includes('payment advice') ||
    s.includes('order date')
  );
}

/**
 * Parses clean Stall, Location, and Service Date Range from an invoice filename/ID and optional raw PDF text.
 */
export function extractStallAndLocation(
  idOrFileName: string,
  pdfText?: string,
  existingStall?: string,
  existingLocation?: string
): ExtractedInvoiceMetadata {
  const clean = idOrFileName.replace(/^INV-/, '').replace(/\.pdf$/i, '');

  // Format: {settlementId}_payment_advice_{stall}_{company}-{startDate}-{endDate}-{amount}
  const match = clean.match(/^[0-9]+_payment_advice_([^_]+)_(.+?)(?:-\d{8}-\d{8}|$)/i);

  let stallRaw = '';
  let companyRaw = '';

  if (match) {
    stallRaw = match[1];
    companyRaw = match[2].replace(/-\d+(\.\d+)?$/, '');
  }

  // 1. Resolve Stall
  let stall = KNOWN_STALL_MAP[stallRaw];
  if (!stall) {
    if (stallRaw) {
      stall = stallRaw.replace(/([a-z])([A-Z])/g, '$1 $2').trim();
    } else if (existingStall && !isGarbageText(existingStall)) {
      stall = existingStall.trim();
    } else {
      stall = 'General Stall';
    }
  }

  // 2. Resolve Location
  let location = 'Other';
  const combined = (clean + ' ' + (pdfText || '') + ' ' + (existingLocation || '')).toUpperCase();

  if (combined.includes('BROADRIDGE')) location = 'Broadridge';
  else if (combined.includes('CGI')) location = 'CGI Information Systems';
  else if (combined.includes('IBM')) location = 'IBM';
  else if (combined.includes('DSM')) location = 'DSM Shared Services';
  else if (combined.includes('NTT')) location = 'NTT Data';
  else if (combined.includes('RELIC')) location = 'New Relic';
  else if (combined.includes('COVANCE') || combined.includes('MADALA') || combined.includes('SOFTSOL')) location = 'Covance';
  else if (combined.includes('QUALCOMM')) location = 'Qualcomm';
  else if (companyRaw) {
    location = companyRaw.replace(/___/g, ' - ').replace(/_/g, ' ').trim();
  } else if (existingLocation && !isGarbageText(existingLocation)) {
    location = existingLocation.trim();
  }

  // 3. Resolve Service Date Range
  let serviceDateRange: string | undefined;
  const dateFromFilename = clean.match(/-(\d{4})(\d{2})(\d{2})-(\d{4})(\d{2})(\d{2})/);
  if (dateFromFilename) {
    serviceDateRange = `${dateFromFilename[1]}-${dateFromFilename[2]}-${dateFromFilename[3]} to ${dateFromFilename[4]}-${dateFromFilename[5]}-${dateFromFilename[6]}`;
  }

  return { stall, location, serviceDateRange };
}
