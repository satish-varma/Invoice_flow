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

/**
 * HungerBox Vendor Configuration:
 * - MRP Vendors (3% fee): Packaged items, tuckshop stalls, confectionery, packaged retail goods
 * - Non-MRP Vendors (19% fee): Fresh kitchen foods, live counters, freshly brewed tea/coffee, juice, Maggi, sandwich, omelette
 */
export const HUNGERBOX_MRP_VENDOR_IDS = [25577, 25579, 26122, 26200, 30225];
export const HUNGERBOX_NON_MRP_VENDOR_IDS = [23221, 25576, 26121, 26123, 31127, 31142];

export const HUNGERBOX_DEFAULT_CLIENT_ID = '2c0939632f65c1d362ee68675a7757b4';

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
    const description = `HungerBox Digital Sales — ${agg.uniqueOrdersCount || agg.orderCount} orders${
      sessionSummary ? ` (${sessionSummary})` : ''
    }`;

    // Find if a sale record already exists for this date and site
    const existing = existingSales.find((r) => {
      const recDate = (r.date || '').split('T')[0];
      const recSite = resolveSiteId(r.siteId);
      return recDate === agg.date && recSite === agg.siteId && (r.category === 'Sales' || r.source === 'hungerbox');
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

    // 2. Feed individual orders into Turso `hungerbox_sales` table (batched)
    if (!skipTursoTelemetry && agg.orders && agg.orders.length > 0) {
      try {
        const batchStatements = agg.orders.slice(0, 500).map((o) => {
          return {
            sql: `INSERT OR REPLACE INTO hungerbox_sales 
                  (order_id, order_date, vendor_name, cafeteria_name, amount, item_name, status, org_id) 
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            args: [
              o.orderId,
              o.orderDate,
              o.stallName || 'The Gut Guru',
              o.locationName,
              o.amount,
              o.itemName,
              o.status || 'Completed',
              'default',
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
 * Directly pulls daily orders & sales from HungerBox Admin API (https://admin.hungerbox.com)
 * without using local downloads, computes MRP (19%) vs Non-MRP (3%) deductions,
 * and feeds all aggregates into the Tuckshop Firestore ledger.
 */
export async function syncHungerBoxDirectFromPortal(params?: {
  fromDate?: string;
  toDate?: string;
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

  // 2. Determine Date Range (Default 6 months historical)
  let fromDate = params?.fromDate;
  let toDate = params?.toDate;

  const now = new Date();
  if (!toDate) {
    toDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  }
  if (!fromDate) {
    const sixMonthsAgo = new Date(now);
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    fromDate = `${sixMonthsAgo.getFullYear()}-${String(sixMonthsAgo.getMonth() + 1).padStart(2, '0')}-${String(sixMonthsAgo.getDate()).padStart(2, '0')}`;
  }

  const headers = {
    Authorization: `Bearer ${accessToken}`,
    Currentcompany: '113',
    Companyid: '113',
    'Content-Type': 'application/json',
  };

  // 3. Parallel fetch of MRP (19% commission) and Non-MRP (3% commission) datasets
  const [mrpRes, nonMrpRes] = await Promise.all([
    fetch('https://admin.hungerbox.com/api/v1/order-charts', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        vendor_ids: HUNGERBOX_MRP_VENDOR_IDS,
        fromDate,
        toDate,
      }),
    }),
    fetch('https://admin.hungerbox.com/api/v1/order-charts', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        vendor_ids: HUNGERBOX_NON_MRP_VENDOR_IDS,
        fromDate,
        toDate,
      }),
    }),
  ]);

  if (!mrpRes.ok || !nonMrpRes.ok) {
    throw new Error(`HungerBox order-charts API returned error (MRP: ${mrpRes.status}, Non-MRP: ${nonMrpRes.status})`);
  }

  const mrpJson = await mrpRes.json();
  const nonMrpJson = await nonMrpRes.json();

  const mrpData: any[] = mrpJson.data || [];
  const nonMrpData: any[] = nonMrpJson.data || [];

  // 4. Map Organizations to Company Sites
  const siteMap: Record<string, { siteId: SiteId; name: string }> = {
    'DSM Shared Services India Private Limited': { siteId: 'dsm', name: 'DSM' },
    'New Relic One India Private Limited': { siteId: 'newrelic', name: 'NewRelic' },
    'NTT Data': { siteId: 'ntt_data', name: 'NTT Data' },
    'Madala Holdings Limited': { siteId: 'ntt_data', name: 'NTT Data' }, // Corporate entity operating within NTT Data campus
  };

  // 5. Aggregate by date & site
  const ledger: Record<
    string,
    {
      date: string;
      siteId: SiteId;
      siteName: string;
      mrpSales: number;
      mrpOrders: number;
      nonMrpSales: number;
      nonMrpOrders: number;
    }
  > = {};

  for (const item of mrpData) {
    if (item.org === 'Total eCafe') continue;
    const mapping = siteMap[item.org];
    if (!mapping) continue; // Skip unmapped companies (e.g. CGI, Broadridge)
    if (mapping.siteId === 'newrelic' && item.date < '2026-09-06') continue; // NewRelic site started Sep 6th
    const key = `${item.date}_${mapping.siteId}`;
    if (!ledger[key]) {
      ledger[key] = {
        date: item.date,
        siteId: mapping.siteId,
        siteName: mapping.name,
        mrpSales: 0,
        mrpOrders: 0,
        nonMrpSales: 0,
        nonMrpOrders: 0,
      };
    }
    ledger[key].mrpSales += parseFloat(item.order_value) || 0;
    ledger[key].mrpOrders += parseInt(item.delivered_orders, 10) || 0;
  }

  for (const item of nonMrpData) {
    if (item.org === 'Total eCafe') continue;
    const mapping = siteMap[item.org];
    if (!mapping) continue; // Skip unmapped companies (e.g. CGI, Broadridge)
    if (mapping.siteId === 'newrelic' && item.date < '2026-09-06') continue; // NewRelic site started Sep 6th
    const key = `${item.date}_${mapping.siteId}`;
    if (!ledger[key]) {
      ledger[key] = {
        date: item.date,
        siteId: mapping.siteId,
        siteName: mapping.name,
        mrpSales: 0,
        mrpOrders: 0,
        nonMrpSales: 0,
        nonMrpOrders: 0,
      };
    }
    ledger[key].nonMrpSales += parseFloat(item.order_value) || 0;
    ledger[key].nonMrpOrders += parseInt(item.delivered_orders, 10) || 0;
  }

  // 6. Build typed HungerBoxDailyAggregate objects with exact calculations
  const dailyAggregates: HungerBoxDailyAggregate[] = Object.values(ledger).map((row) => {
    const mrpSales = Math.round(row.mrpSales * 100) / 100;
    const nonMrpSales = Math.round(row.nonMrpSales * 100) / 100;
    const mrpCommission = Math.round(mrpSales * 0.03 * 100) / 100;
    const nonMrpCommission = Math.round(nonMrpSales * 0.19 * 100) / 100;
    const mrpNet = Math.round((mrpSales - mrpCommission) * 100) / 100;
    const nonMrpNet = Math.round((nonMrpSales - nonMrpCommission) * 100) / 100;
    const totalCommission = Math.round((mrpCommission + nonMrpCommission) * 100) / 100;
    const totalAmount = Math.round((mrpSales + nonMrpSales) * 100) / 100;
    const netSales = Math.round((totalAmount - totalCommission) * 100) / 100;
    const orderCount = row.mrpOrders + row.nonMrpOrders;

    return {
      date: row.date,
      displayDate: formatOrdinalDate(row.date),
      siteId: row.siteId,
      locationName: row.siteName,
      totalAmount,
      orderCount,
      uniqueOrdersCount: orderCount,
      mrpSales,
      mrpCommission,
      mrpNet,
      nonMrpSales,
      nonMrpCommission,
      nonMrpNet,
      totalCommission,
      netSales,
      mealSessions: [
        { session: 'MRP Counter Sales', amount: mrpSales, count: row.mrpOrders },
        { session: 'Kitchen & Fresh Food', amount: nonMrpSales, count: row.nonMrpOrders },
      ],
      topItems: [],
      orders: [],
    };
  });

  // Sort chronologically ascending
  dailyAggregates.sort((a, b) => a.date.localeCompare(b.date));

  let totalOrders = 0;
  let totalSales = 0;
  let totalMrpSales = 0;
  let totalNonMrpSales = 0;

  for (const a of dailyAggregates) {
    totalOrders += a.orderCount;
    totalSales += a.totalAmount;
    totalMrpSales += a.mrpSales;
    totalNonMrpSales += a.nonMrpSales;
  }

  let feedResults: FeedResult[] = [];
  if (!params?.skipFirestore && dailyAggregates.length > 0) {
    feedResults = await feedHungerBoxAggregatesToTuckshop(dailyAggregates, userEmail, true);
  }

  return {
    success: true,
    totalOrders,
    totalSales: Math.round(totalSales * 100) / 100,
    totalMrpSales: Math.round(totalMrpSales * 100) / 100,
    totalNonMrpSales: Math.round(totalNonMrpSales * 100) / 100,
    dailyAggregates,
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
