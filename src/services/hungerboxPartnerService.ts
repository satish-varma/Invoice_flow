/**
 * HungerBox Partner Portal Service (partner.hungerbox.com)
 *
 * Provides direct API integration with partner-api.hungerbox.com:
 * - Direct authentication via seller OAuth
 * - Cash & Carry payment advices (with presigned S3 PDF links)
 * - Granular deduction breakdown (MRP commission, non-MRP commission, GST, TCS, TDS)
 * - Company-Paid (DC) invoices (TGGHS/...), PO IDs, and payment status tracking
 * - HungerBox commission tax invoices (HB/VC/...)
 * - Zoho vendor statements (direct signed PDF download & historical generation)
 * - Synchronization into Turso database invoices table
 */

import { turso } from '@/lib/tracker/turso';

const BASE_URL = 'https://partner-api.hungerbox.com';
const CLIENT_ID = 'b6c8e123a4fUmpCJSJd38X6wR7e2c453';
const DEFAULT_USERNAME = process.env.HUNGERBOX_PARTNER_USERNAME || 'thegutguru.in@gmail.com';
const DEFAULT_PASSWORD = process.env.HUNGERBOX_PARTNER_PASSWORD || 'Var1986!';

// Token cache to avoid logging in on every single request
interface TokenCache {
  token: string;
  expiresAt: number;
  masterVendorId: number;
}

let cachedAuth: TokenCache | null = null;

export interface PartnerAuthResult {
  token: string;
  masterVendorId: number;
  scopes: string[];
}

/**
 * Login to HungerBox Partner Portal API and retrieve Bearer token
 */
export async function getPartnerToken(
  customUsername?: string,
  customPassword?: string,
  forceRefresh = false
): Promise<PartnerAuthResult> {
  const username = customUsername || DEFAULT_USERNAME;
  const password = customPassword || DEFAULT_PASSWORD;

  const now = Date.now();
  if (!forceRefresh && cachedAuth && cachedAuth.expiresAt > now + 60000 && !customUsername) {
    return {
      token: cachedAuth.token,
      masterVendorId: cachedAuth.masterVendorId,
      scopes: ['seller-admin'],
    };
  }

  const res = await fetch(`${BASE_URL}/api/v3/oauth/seller/access_token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-origin': 'web_seller_app',
    },
    body: JSON.stringify({
      username,
      password,
      grant_type: 'password',
      client_id: CLIENT_ID,
      company_id: -1,
    }),
  });

  if (!res.ok) {
    const errorBody = await res.text();
    throw new Error(`HungerBox Partner authentication failed (${res.status}): ${errorBody}`);
  }

  const data = await res.json();
  const token = data.access_token;
  if (!token) {
    throw new Error('HungerBox Partner authentication failed: No access_token returned');
  }

  // Fetch current user to determine masterVendorId
  let masterVendorId = 5009;
  try {
    const userRes = await fetch(`${BASE_URL}/api/v3/oauth/seller/current_user`, {
      headers: {
        Authorization: `Bearer ${token}`,
        'x-origin': 'web_seller_app',
      },
    });
    if (userRes.ok) {
      const userData = await userRes.json();
      masterVendorId = userData.data?.master_vendor_details?.id || 5009;
    }
  } catch (err) {
    console.warn('[HungerBoxPartner] Could not fetch current_user, defaulting masterVendorId=5009', err);
  }

  // Cache token for 1 hour
  cachedAuth = {
    token,
    expiresAt: now + (data.expires_in ? Math.min(data.expires_in * 1000, 3600000) : 3600000),
    masterVendorId,
  };

  return {
    token,
    masterVendorId,
    scopes: data.scope ? data.scope.split(' ') : ['seller-admin'],
  };
}

/**
 * Returns full profile of currently authenticated seller
 */
export async function getPartnerCurrentUser(customToken?: string) {
  const token = customToken || (await getPartnerToken()).token;
  const res = await fetch(`${BASE_URL}/api/v3/oauth/seller/current_user`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'x-origin': 'web_seller_app',
    },
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch current user (${res.status}): ${await res.text()}`);
  }

  const json = await res.json();
  return json.data;
}

export interface CashAndCarryPaymentItem {
  settlementID: string;
  dateRange: string;
  counterName: string;
  companyName: string;
  cafeteriaNames?: string[];
  netPayable: string;
  statusFormatted: string;
  status: string;
  isPinned: number;
  fileUrl?: string;
}

export interface CashAndCarryPaymentsResponse {
  paymentAdviceDetails: CashAndCarryPaymentItem[];
  pageContext?: {
    currentPage?: number;
    pageSize?: number;
    totalCount?: number;
    totalPages?: number;
  };
  currencySymbol?: string;
}

/**
 * Fetch Cash & Carry Payment Advices / Settlements list
 */
export async function fetchCashAndCarryPayments(options: {
  page?: number;
  limit?: number;
  state?: 'all' | 'pinned';
  filters?: Record<string, any>;
} = {}): Promise<CashAndCarryPaymentsResponse> {
  const auth = await getPartnerToken();
  const page = options.page || 1;
  const limit = options.limit || 20;
  const state = options.state || 'all';
  const filters = JSON.stringify(options.filters || {});

  const url = `${BASE_URL}/api/v6/seller/cash-n-carry-payments?state=${state}&page=${page}&limit=${limit}&masterVendorId=${auth.masterVendorId}&filters=${encodeURIComponent(filters)}`;

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${auth.token}`,
      'x-origin': 'web_seller_app',
    },
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch cash-n-carry payments (${res.status}): ${await res.text()}`);
  }

  return res.json();
}

export interface PaymentAdviceBreakdown {
  currencySymbol: string;
  paymentAdviceDetails: {
    settlementID: string;
    dateRange: string;
    paymentDate: string;
    counterName: string;
    companyName: string;
    cafeteriaNames: string[];
    totalSales: string;
    totalDeductions: string;
    netPayable: string;
    roundedAmount: number;
    currentStatus: {
      statusFormatted: string;
      status: string;
      statusRemarks: string;
    };
  };
  paymentAdviceDeductions: Array<{
    deductionName: string;
    value: string;
  }>;
  paymentAdviceDocuments: Array<{
    title: string;
    dateText: string;
    reference: string;
    dateFormatted: string;
    id: string;
    type: string;
    fileUrl: string;
  }>;
  masterVendorName: string;
}

/**
 * Fetch detailed deduction and remittance breakdown for a specific settlement ID
 */
export async function fetchPaymentAdviceDetails(
  settlementId: string | number
): Promise<PaymentAdviceBreakdown> {
  const auth = await getPartnerToken();
  const url = `${BASE_URL}/api/v6/seller/payments-advice-details?settlementId=${settlementId}`;

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${auth.token}`,
      'x-origin': 'web_seller_app',
    },
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch payment advice details (${res.status}): ${await res.text()}`);
  }

  return res.json();
}

export interface CompanyPaidInvoice {
  invoiceNumber: string;
  companyName: string;
  serviceMonth: string;
  dateReceived: string;
  amount: string;
  status: string;
  sourceState?: string;
  poId?: string;
}

export interface CompanyPaidResponse {
  invoiceSummary: CompanyPaidInvoice[];
  currencySymbol?: string;
}

/**
 * Fetch Company-Paid (DC) invoices summary
 */
export async function fetchCompanyPaidInvoices(options: {
  page?: number;
  limit?: number;
  filters?: Record<string, any>;
} = {}): Promise<CompanyPaidResponse> {
  const auth = await getPartnerToken();
  const page = options.page || 1;
  const limit = options.limit || 50;

  const url = `${BASE_URL}/api/v6/hb/seller/invoice-summary/data?paymentType=companyPaid&masterVendorId=${auth.masterVendorId}&page=${page}&limit=${limit}`;

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${auth.token}`,
      'x-origin': 'web_seller_app',
    },
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch company-paid invoices (${res.status}): ${await res.text()}`);
  }

  return res.json();
}

export interface CompanyPaidCounts {
  totalInvoiceCount: number;
  settledInvoiceCount: number;
  ongoingInvoiceCount: number;
  pendingInvoiceCount: number;
}

/**
 * Fetch count summaries for company-paid invoices
 */
export async function fetchCompanyPaidCounts(): Promise<CompanyPaidCounts> {
  const auth = await getPartnerToken();
  const url = `${BASE_URL}/api/v6/hb/seller/invoice-summary/count?paymentType=companyPaid&masterVendorId=${auth.masterVendorId}`;

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${auth.token}`,
      'x-origin': 'web_seller_app',
    },
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch company-paid counts (${res.status}): ${await res.text()}`);
  }

  return res.json();
}

export interface CommissionInvoiceItem {
  invoiceId: string;
  invoiceNumber: string;
  sourceState: string[];
  supportingDocumentUrl?: string;
  serviceMonth?: string;
  invoiceDate?: string;
  totalAmount?: string;
}

export interface CommissionInvoicesResponse {
  commissionInvoiceDetails: CommissionInvoiceItem[];
  pageContext?: {
    currentPage?: number;
    pageSize?: number;
    totalCount?: number;
    totalPages?: number;
  };
  currencySymbol?: string;
}

/**
 * Fetch HungerBox Commission Invoices
 */
export async function fetchCommissionInvoices(options: {
  paymentType?: 'companyPaid' | 'cashNCarry';
  page?: number;
  limit?: number;
} = {}): Promise<CommissionInvoicesResponse> {
  const auth = await getPartnerToken();
  const paymentType = options.paymentType || 'companyPaid';
  const page = options.page || 1;
  const limit = options.limit || 20;

  const url = `${BASE_URL}/api/v6/seller/commission-invoices?paymentType=${paymentType}&masterVendorId=${auth.masterVendorId}&page=${page}&limit=${limit}`;

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${auth.token}`,
      'x-origin': 'web_seller_app',
    },
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch commission invoices (${res.status}): ${await res.text()}`);
  }

  return res.json();
}

export interface CommissionInvoiceDetail {
  currencySymbol: string;
  commissionInvoiceDetails: {
    invoiceId: string;
    invoiceNumber: string;
    sourceState: string[];
    supportingDocumentUrl?: string;
    totalAmount: string;
    serviceMonth: string;
    invoiceDate: string;
    subTotalAmount: string;
    dateRange: string;
    taxesApplicable: Array<{
      taxName: string;
      value: string;
    }>;
    commissionInvoiceDocuments: Array<{
      title: string;
      dateText: string;
      reference: string;
      dateFormatted: string;
      id: string;
      type: string;
      fileUrl: string;
    }>;
  };
  masterVendorName: string;
}

/**
 * Fetch details of a specific commission invoice
 */
export async function fetchCommissionInvoiceDetails(options: {
  invoiceId: string | number;
  paymentType?: 'companyPaid' | 'cashNCarry';
}): Promise<CommissionInvoiceDetail> {
  const auth = await getPartnerToken();
  const paymentType = options.paymentType || 'companyPaid';
  const url = `${BASE_URL}/api/v6/seller/commission-invoice-details?invoiceId=${options.invoiceId}&masterVendorId=${auth.masterVendorId}&paymentType=${paymentType}`;

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${auth.token}`,
      'x-origin': 'web_seller_app',
    },
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch commission invoice details (${res.status}): ${await res.text()}`);
  }

  return res.json();
}

export interface ZohoDownloadItem {
  downloadId: number;
  fileName: string;
  fromDate: string;
  toDate: string;
  format: string;
  paymentType: string;
  createdAt: string;
  fileDownloadUrl: string;
}

/**
 * Fetch list of generated Zoho statement downloads
 */
export async function fetchZohoStatementDownloads(options: {
  paymentType?: 'companyPaid' | 'cashNCarry';
} = {}): Promise<{ downloads: ZohoDownloadItem[] }> {
  const auth = await getPartnerToken();
  const paymentType = options.paymentType || 'companyPaid';
  const url = `${BASE_URL}/api/v6/seller/zoho/vendor-statement/downloads?paymentType=${paymentType}&masterVendorId=${auth.masterVendorId}`;

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${auth.token}`,
      'x-origin': 'web_seller_app',
    },
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch Zoho statement downloads (${res.status}): ${await res.text()}`);
  }

  return res.json();
}

/**
 * Request generation of a new Zoho Vendor Statement PDF
 */
export async function generateZohoStatement(options: {
  fromDate: string; // YYYY-MM-DD
  toDate: string; // YYYY-MM-DD
  paymentType?: 'companyPaid' | 'cashNCarry';
  format?: 'pdf' | 'excel';
}): Promise<{ downloadId: number; fileLink: string; format: string }> {
  const auth = await getPartnerToken();
  const paymentType = options.paymentType || 'companyPaid';
  const format = options.format || 'pdf';

  const url = `${BASE_URL}/api/v6/seller/zoho/vendor-statement?paymentType=${paymentType}&masterVendorId=${auth.masterVendorId}&from_date=${options.fromDate}&to_date=${options.toDate}&type=${format}`;

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${auth.token}`,
      'x-origin': 'web_seller_app',
    },
  });

  if (!res.ok) {
    throw new Error(`Failed to generate Zoho vendor statement (${res.status}): ${await res.text()}`);
  }

  return res.json();
}

/**
 * Fetch dashboard filter mappings: list of companies, vendor counters, and locations
 */
export async function fetchDashboardFilters() {
  const auth = await getPartnerToken();
  const url = `${BASE_URL}/api/v6/hb/seller/payment/getDashboardFilters?masterVendorId=${auth.masterVendorId}`;

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${auth.token}`,
      'x-origin': 'web_seller_app',
    },
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch dashboard filters (${res.status}): ${await res.text()}`);
  }

  return res.json();
}

/**
 * Synchronize Cash & Carry settlements directly into Turso database's `invoices` table
 * This updates the Tracker Overview & Remittance pages with real settlement numbers and direct S3 advice PDFs!
 */
export async function syncPartnerAdvicesToTurso(orgId: string = 'default') {
  const paymentsRes = await fetchCashAndCarryPayments({ page: 1, limit: 100, state: 'all' });
  const items = paymentsRes.paymentAdviceDetails || [];

  let syncedCount = 0;
  const now = new Date().toISOString();

  for (const item of items) {
    const rawAmount = typeof item.netPayable === 'string'
      ? parseFloat(item.netPayable.replace(/,/g, ''))
      : Number(item.netPayable || 0);

    const invoiceId = `HB-PA-${item.settlementID}`;
    const status = item.status === 'PaymentDone' ? 'Paid' : 'Pending';

    // Parse date from dateRange or default to today's date
    const dateStr = now.slice(0, 10);

    await turso.execute({
      sql: `INSERT OR REPLACE INTO invoices 
            (id, date, service_date_range, location, stall, amount, status, pdf_path, synced_at, org_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        invoiceId,
        dateStr,
        item.dateRange || '',
        item.companyName || 'HungerBox Client',
        item.counterName || 'The Gut Guru',
        rawAmount,
        status,
        item.fileUrl || '',
        now,
        orgId,
      ],
    });

    syncedCount++;
  }

  return {
    success: true,
    syncedCount,
    totalChecked: items.length,
  };
}
