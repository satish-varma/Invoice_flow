import { collection, query, getDocs, addDoc, updateDoc, doc, serverTimestamp, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { NEWRELIC_TUCKSHOP_COLLECTION, NewRelicTuckshopRecord } from './newrelicTuckshopService';
import { HungerBoxDailyAggregate, HungerBoxParsedOrder, formatOrdinalDate } from './hungerboxParser';
import { turso, createAuditLog } from '@/lib/tracker/turso';
import { COMPANY_SITES, resolveSiteId, SiteId } from '@/types/site';

export interface FeedResult {
  date: string;
  siteId: string;
  siteName: string;
  amount: number;
  orderCount: number;
  action: 'created' | 'updated';
  recordId: string;
}

export const HUNGERBOX_DEFAULT_CLIENT_ID = '2c0939632f65c1d362ee68675a7757b4';

export interface SiteSyncProfile {
  siteId: SiteId;
  companyId: number;
  siteName: string;
  defaultStartDate: string;
  vendors: number[];
  locations: number[];
}

export const SITE_SYNC_PROFILES: Record<string, SiteSyncProfile> = {
  newrelic: {
    siteId: 'newrelic',
    companyId: 665,
    siteName: 'NewRelic',
    defaultStartDate: '2026-09-01',
    vendors: [31127, 31142],
    locations: [2849, 3123],
  },
  ntt_data: {
    siteId: 'ntt_data',
    companyId: 299,
    siteName: 'NTT Data',
    defaultStartDate: '2026-07-20',
    vendors: [30225],
    locations: [3070],
  },
  dsm: {
    siteId: 'dsm',
    companyId: 403,
    siteName: 'DSM',
    defaultStartDate: '2025-06-15',
    vendors: [23221],
    locations: [1992, 139, 2292],
  },
};

/**
 * Splits date range into chunks <= 80 days to respect HungerBox 3-month limit per report
 */
function splitDateRange(startDate: string, endDate: string, maxDays = 80): { from: string; to: string }[] {
  const chunks: { from: string; to: string }[] = [];
  const start = new Date(startDate);
  const end = new Date(endDate);

  let currentStart = new Date(start);

  while (currentStart < end) {
    const currentEnd = new Date(currentStart);
    currentEnd.setDate(currentEnd.getDate() + maxDays - 1);

    const actualEnd = currentEnd > end ? end : currentEnd;

    const fromStr = currentStart.toISOString().split('T')[0];
    const toStr = actualEnd.toISOString().split('T')[0];
    chunks.push({ from: fromStr, to: toStr });

    currentStart = new Date(actualEnd);
    currentStart.setDate(currentStart.getDate() + 1);
  }

  return chunks;
}

// Convert Excel serial number or date string to YYYY-MM-DD
function parseOrderDate(rawDate: any): string {
  if (!rawDate) return '';
  const str = String(rawDate).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
    return str.substring(0, 10);
  }
  const num = parseFloat(str);
  if (!isNaN(num) && num > 40000 && num < 60000) {
    const epoch = new Date(Date.UTC(1899, 11, 30));
    const d = new Date(epoch.getTime() + num * 86400000);
    return d.toISOString().substring(0, 10);
  }
  const d = new Date(str);
  if (!isNaN(d.getTime())) {
    return d.toISOString().substring(0, 10);
  }
  return str.substring(0, 10);
}

// Parse CSV manually and robustly
function parseCsvRows(text: string): Record<string, string>[] {
  const lines = text.split('\n').filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];

  const parseLine = (line: string): string[] => {
    const values: string[] = [];
    let cur = '';
    let inQuote = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') {
        inQuote = !inQuote;
      } else if (c === ',' && !inQuote) {
        values.push(cur.trim());
        cur = '';
      } else {
        cur += c;
      }
    }
    values.push(cur.trim());
    return values.map((v) => v.replace(/^"|"$/g, '').trim());
  };

  const headers = parseLine(lines[0]).map((h) => h.toLowerCase().replace(/[^a-z0-9_]/g, ''));
  const rows: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseLine(lines[i]);
    const row: Record<string, string> = {};
    for (let j = 0; j < headers.length; j++) {
      row[headers[j]] = values[j] !== undefined ? values[j] : '';
    }
    rows.push(row);
  }

  return rows;
}

/**
 * Feeds HungerBox aggregated daily sales into Firestore Tuckshop Ledger (`newrelic_tuckshop`)
 * and order telemetry into Turso (`hungerbox_sales`).
 */
export async function feedHungerBoxAggregatesToTuckshop(
  aggregates: HungerBoxDailyAggregate[],
  userEmail: string = 'system-sync@hungerbox',
  skipTursoTelemetry: boolean = false
): Promise<FeedResult[]> {
  const results: FeedResult[] = [];

  // 1. Fetch current tuckshop sales records to match existing ones
  const tuckshopCol = collection(db, NEWRELIC_TUCKSHOP_COLLECTION);
  const q = query(tuckshopCol, where('type', '==', 'sale'));
  const snapshot = await getDocs(q);

  const existingSales = snapshot.docs.map((d) => ({
    id: d.id,
    ...d.data(),
  })) as (NewRelicTuckshopRecord & { id: string })[];

  for (const agg of aggregates) {
    const siteConfig = COMPANY_SITES[agg.siteId] || COMPANY_SITES.newrelic;
    const locationName = siteConfig.name;

    // Build descriptive notes
    const sessionSummary = (agg.mealSessions || [])
      .map((s) => `${s.session}: ₹${Math.round(s.amount).toLocaleString('en-IN')}`)
      .join(', ');
    const description = `HungerBox Verified Product Sales — ${agg.uniqueOrdersCount || agg.orderCount} items (MRP: ₹${agg.mrpSales.toLocaleString('en-IN')}, Non-MRP: ₹${agg.nonMrpSales.toLocaleString('en-IN')})${
      sessionSummary ? ` [${sessionSummary}]` : ''
    }`;

    // Find if a sale record already exists for this date and site
    const existing = existingSales.find((r) => {
      const recDate = (r.date || '').split('T')[0];
      const recSite = resolveSiteId(r.siteId);
      return recDate === agg.date && (recSite === agg.siteId || (r.location && r.location.toLowerCase().includes(locationName.toLowerCase())));
    });

    if (existing) {
      // Update existing record
      const docRef = doc(db, NEWRELIC_TUCKSHOP_COLLECTION, existing.id);
      await updateDoc(docRef, {
        amount: agg.totalAmount,
        orderCount: agg.uniqueOrdersCount || agg.orderCount,
        mealSessions: agg.mealSessions || [],
        source: 'hungerbox',
        description,
        mrpSales: agg.mrpSales,
        mrpCommission: agg.mrpCommission,
        mrpNet: agg.mrpNet,
        nonMrpSales: agg.nonMrpSales,
        nonMrpCommission: agg.nonMrpCommission,
        nonMrpNet: agg.nonMrpNet,
        totalCommission: agg.totalCommission,
        netSales: agg.netSales,
        topItems: agg.topItems || [],
        updatedAt: serverTimestamp(),
        updatedBy: userEmail,
      });

      results.push({
        date: agg.date,
        siteId: agg.siteId,
        siteName: locationName,
        amount: agg.totalAmount,
        orderCount: agg.uniqueOrdersCount || agg.orderCount,
        action: 'updated',
        recordId: existing.id,
      });
    } else {
      // Create new sales record
      const newRecordData = {
        type: 'sale',
        category: 'Sales',
        amount: agg.totalAmount,
        siteId: agg.siteId,
        location: locationName,
        date: `${agg.date}T12:00:00.000Z`,
        orderCount: agg.uniqueOrdersCount || agg.orderCount,
        mealSessions: agg.mealSessions || [],
        source: 'hungerbox',
        description,
        mrpSales: agg.mrpSales,
        mrpCommission: agg.mrpCommission,
        mrpNet: agg.mrpNet,
        nonMrpSales: agg.nonMrpSales,
        nonMrpCommission: agg.nonMrpCommission,
        nonMrpNet: agg.nonMrpNet,
        totalCommission: agg.totalCommission,
        netSales: agg.netSales,
        topItems: agg.topItems || [],
        createdAt: serverTimestamp(),
        createdBy: userEmail,
        updatedAt: serverTimestamp(),
        updatedBy: userEmail,
      };

      const docRef = await addDoc(tuckshopCol, newRecordData);
      results.push({
        date: agg.date,
        siteId: agg.siteId,
        siteName: locationName,
        amount: agg.totalAmount,
        orderCount: agg.uniqueOrdersCount || agg.orderCount,
        action: 'created',
        recordId: docRef.id,
      });
    }

    // 2. Feed individual orders / top items into Turso `hungerbox_sales` table
    if (!skipTursoTelemetry && agg.topItems && agg.topItems.length > 0) {
      try {
        const batchStatements = agg.topItems.map((item) => {
          return {
            sql: `INSERT OR REPLACE INTO hungerbox_sales 
                  (order_id, order_date, vendor_name, cafeteria_name, amount, item_name, status, org_id) 
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            args: [
              `${agg.siteId}_${agg.date}_${item.name.replace(/[^a-zA-Z0-9]/g, '').slice(0, 20)}`,
              agg.date,
              locationName,
              agg.siteId,
              item.amount,
              item.name,
              item.amount > 0 ? (item.amount <= 30 ? 'MRP (3%)' : 'Non-MRP (19%)') : 'Completed',
              agg.siteId,
            ],
          };
        });

        if (batchStatements.length > 0) {
          await turso.batch(batchStatements);
        }
      } catch (tursoErr) {
        console.warn('[HungerBoxSync] Turso telemetry batch sync skipped/failed:', tursoErr);
      }
    }
  }

  return results;
}

/**
 * Pulls HBR2 (Datewise Product wise Sales Report) from HungerBox Admin Redshift API
 * for a specific site profile and date range, parses `is_mrp_item` per item line,
 * and compiles daily aggregates with 3% (MRP) and 19% (Non-MRP) fees.
 */
async function pullHbr2SiteData(
  accessToken: string,
  profile: SiteSyncProfile,
  fromDate: string,
  toDate: string
): Promise<HungerBoxDailyAggregate[]> {
  const chunks = splitDateRange(fromDate, toDate, 80);
  const dailyMap: Record<
    string,
    {
      date: string;
      mrpSales: number;
      nonMrpSales: number;
      itemsCount: number;
      totalUnits: number;
      topItems: Record<string, { qty: number; amount: number; isMrp: boolean }>;
    }
  > = {};

  for (const chunk of chunks) {
    const headers = {
      Authorization: `Bearer ${accessToken}`,
      Currentcompany: String(profile.companyId),
      Companyid: String(profile.companyId),
      'Content-Type': 'application/json',
    };

    const options = [
      { type: 'timestamp', label: 'From Date', key: '#fromDate', value: chunk.from, from_tz: 'Asia/Kolkata', to_tz: 'Asia/Kolkata' },
      { type: 'timestamp', label: 'To Date', key: '#toDate', value: chunk.to, from_tz: 'Asia/Kolkata', to_tz: 'Asia/Kolkata' },
      { type: 'vendor', label: 'Select Vendors', key: '#vendors', value: profile.vendors },
      { type: 'location', label: 'Select Cafeteria', key: '#locations', value: profile.locations },
    ];

    try {
      const schedRes = await fetch('https://admin.hungerbox.com/api/report/schedule', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          companyId: profile.companyId,
          options: JSON.stringify(options),
          reportRef: 'HBR2',
        }),
      });

      if (!schedRes.ok) continue;
      const schedJson = await schedRes.json();
      const reportId = schedJson.data?.id;
      if (!reportId) continue;

      let fileDownloadId: number | null = null;
      for (let poll = 0; poll < 12; poll++) {
        await new Promise((r) => setTimeout(r, 2000));
        const pRes = await fetch(`https://admin.hungerbox.com/api/report/download/${profile.companyId}`, { headers });
        if (!pRes.ok) continue;
        const pJson = await pRes.json();
        const rep = pJson.data?.find((r: any) => r.id === reportId);
        if (rep?.status === 'ready_for_download' && rep.file_download_id) {
          fileDownloadId = rep.file_download_id;
          break;
        }
        if (rep?.status === 'error') break;
      }

      if (!fileDownloadId) continue;

      const sRes = await fetch(`https://admin.hungerbox.com/api/report/signed-url/${fileDownloadId}`, { headers });
      if (!sRes.ok) continue;
      const sJson = await sRes.json();
      const signedUrl = sJson.data?.signed_url;
      if (!signedUrl) continue;

      const fRes = await fetch(signedUrl);
      if (!fRes.ok) continue;
      const csvText = await fRes.text();
      const rows = parseCsvRows(csvText);

      for (const row of rows) {
        const rawDate = row['order_date'] || row['orderdate'] || row['date'];
        const date = parseOrderDate(rawDate);
        if (!date || date < fromDate || date > toDate) continue;

        const amount = parseFloat(row['actual_value'] || row['actualvalue'] || row['price'] || '0') || 0;
        const qty = parseInt(row['qty'] || row['quantity'] || '1', 10) || 1;
        const isMrp = row['is_mrp_item'] === '1' || row['ismrpitem'] === '1' || row['is_mrp'] === '1';
        const productName = row['product_name'] || row['productname'] || 'Item';

        if (!dailyMap[date]) {
          dailyMap[date] = {
            date,
            mrpSales: 0,
            nonMrpSales: 0,
            itemsCount: 0,
            totalUnits: 0,
            topItems: {},
          };
        }

        if (isMrp) {
          dailyMap[date].mrpSales += amount;
        } else {
          dailyMap[date].nonMrpSales += amount;
        }

        dailyMap[date].itemsCount++;
        dailyMap[date].totalUnits += qty;

        if (!dailyMap[date].topItems[productName]) {
          dailyMap[date].topItems[productName] = { qty: 0, amount: 0, isMrp };
        }
        dailyMap[date].topItems[productName].qty += qty;
        dailyMap[date].topItems[productName].amount += amount;
      }
    } catch (chunkErr) {
      console.warn(`[HungerBoxSync] Chunk error ${profile.siteId} ${chunk.from}-${chunk.to}:`, chunkErr);
    }
  }

  // Convert dailyMap to HungerBoxDailyAggregate
  const aggregates: HungerBoxDailyAggregate[] = Object.values(dailyMap).map((d) => {
    const mrpSales = Math.round(d.mrpSales * 100) / 100;
    const nonMrpSales = Math.round(d.nonMrpSales * 100) / 100;
    const totalAmount = Math.round((mrpSales + nonMrpSales) * 100) / 100;

    const mrpCommission = Math.round(mrpSales * 0.03 * 100) / 100; // 3%
    const nonMrpCommission = Math.round(nonMrpSales * 0.19 * 100) / 100; // 19%
    const mrpNet = Math.round((mrpSales - mrpCommission) * 100) / 100;
    const nonMrpNet = Math.round((nonMrpSales - nonMrpCommission) * 100) / 100;
    const totalCommission = Math.round((mrpCommission + nonMrpCommission) * 100) / 100;
    const netSales = Math.round((totalAmount - totalCommission) * 100) / 100;

    const topItemsList = Object.entries(d.topItems)
      .map(([name, stat]) => ({
        name,
        quantity: stat.qty,
        amount: Math.round(stat.amount * 100) / 100,
        isMrp: stat.isMrp,
      }))
      .sort((a, b) => b.amount - a.amount);

    return {
      date: d.date,
      displayDate: formatOrdinalDate(d.date),
      siteId: profile.siteId,
      locationName: profile.siteName,
      totalAmount,
      orderCount: d.totalUnits,
      uniqueOrdersCount: d.totalUnits,
      mrpSales,
      mrpCommission,
      mrpNet,
      nonMrpSales,
      nonMrpCommission,
      nonMrpNet,
      totalCommission,
      netSales,
      mealSessions: [
        { session: 'MRP Counter Sales (3%)', amount: mrpSales, count: topItemsList.filter((i) => i.isMrp).length },
        { session: 'Kitchen & Beverages (19%)', amount: nonMrpSales, count: topItemsList.filter((i) => !i.isMrp).length },
      ],
      topItems: topItemsList.slice(0, 10),
      orders: [],
    };
  });

  aggregates.sort((a, b) => a.date.localeCompare(b.date));
  return aggregates;
}

/**
 * Pulls daily product sales directly from HungerBox Admin API (HBR2 Redshift report),
 * calculates verified MRP (3%) vs Non-MRP (19%) figures per day,
 * and feeds all aggregates into the Tuckshop Firestore ledger and Turso telemetry.
 */
export async function syncHungerBoxDirectFromPortal(params?: {
  fromDate?: string;
  toDate?: string;
  siteId?: string;
  userEmail?: string;
  username?: string;
  password?: string;
  skipFirestore?: boolean;
}): Promise<{
  success: boolean;
  totalOrders: number;
  totalSales: number;
  totalMrpSales: number;
  totalNonMrpSales: number;
  dailyAggregates: HungerBoxDailyAggregate[];
  feedResults: FeedResult[];
}> {
  const username = params?.username || process.env.HUNGERBOX_USERNAME || 'the_gut_guru';
  const password = params?.password || process.env.HUNGERBOX_PASSWORD || 'hungerbox@123';
  const userEmail = params?.userEmail || 'admin@hungerbox';

  // 1. Authenticate against HungerBox OAuth API
  const authRes = await fetch('https://admin.hungerbox.com/api/oauth/access_token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'password',
      client_id: HUNGERBOX_DEFAULT_CLIENT_ID,
      client_secret: '',
      username,
      password,
    }),
  });

  if (!authRes.ok) {
    const errText = await authRes.text();
    throw new Error(`HungerBox Authentication failed (${authRes.status}): ${errText}`);
  }

  const authData = await authRes.json();
  const accessToken = authData.access_token;
  if (!accessToken) {
    throw new Error('HungerBox OAuth response did not contain access_token.');
  }

  // 2. Select Site Profiles to sync
  const targetProfiles: SiteSyncProfile[] = [];
  if (params?.siteId && SITE_SYNC_PROFILES[params.siteId]) {
    targetProfiles.push(SITE_SYNC_PROFILES[params.siteId]);
  } else {
    targetProfiles.push(SITE_SYNC_PROFILES.newrelic, SITE_SYNC_PROFILES.ntt_data, SITE_SYNC_PROFILES.dsm);
  }

  const now = new Date();
  const defaultToDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  const allAggregates: HungerBoxDailyAggregate[] = [];

  for (const profile of targetProfiles) {
    const fromDate = params?.fromDate || profile.defaultStartDate;
    const toDate = params?.toDate || defaultToDate;

    const siteAggregates = await pullHbr2SiteData(accessToken, profile, fromDate, toDate);
    allAggregates.push(...siteAggregates);
  }

  allAggregates.sort((a, b) => a.date.localeCompare(b.date));

  let totalOrders = 0;
  let totalSales = 0;
  let totalMrpSales = 0;
  let totalNonMrpSales = 0;

  for (const a of allAggregates) {
    totalOrders += a.orderCount;
    totalSales += a.totalAmount;
    totalMrpSales += a.mrpSales;
    totalNonMrpSales += a.nonMrpSales;
  }

  let feedResults: FeedResult[] = [];
  if (!params?.skipFirestore && allAggregates.length > 0) {
    feedResults = await feedHungerBoxAggregatesToTuckshop(allAggregates, userEmail, false);
  }

  return {
    success: true,
    totalOrders,
    totalSales: Math.round(totalSales * 100) / 100,
    totalMrpSales: Math.round(totalMrpSales * 100) / 100,
    totalNonMrpSales: Math.round(totalNonMrpSales * 100) / 100,
    dailyAggregates: allAggregates,
    feedResults,
  };
}

/**
 * Triggers external HungerBox worker if URL & key are configured
 */
export async function triggerHungerBoxWorker(params: {
  workerUrl: string;
  apiKey: string;
  startDate?: string;
  endDate?: string;
  siteId?: string;
  orgId?: string;
}) {
  let cleanUrl = params.workerUrl.trim();
  if (cleanUrl.endsWith('/')) {
    cleanUrl = cleanUrl.slice(0, -1);
  }

  const payload = {
    id: 'hungerbox',
    organizationId: params.orgId || 'default',
    startDate: params.startDate,
    endDate: params.endDate,
    siteId: params.siteId,
    timestamp: new Date().toISOString(),
  };

  const res = await fetch(cleanUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': params.apiKey.trim(),
    },
    body: JSON.stringify(payload),
  });

  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || data.message || `Worker returned HTTP ${res.status}`);
    }
    return data;
  }

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Worker returned HTTP ${res.status}: ${text.substring(0, 300)}`);
  }

  return { success: true, message: text };
}
