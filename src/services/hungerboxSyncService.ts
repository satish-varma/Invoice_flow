import { collection, query, getDocs, addDoc, updateDoc, doc, serverTimestamp, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { NEWRELIC_TUCKSHOP_COLLECTION, NewRelicTuckshopRecord } from './newrelicTuckshopService';
import { HungerBoxDailyAggregate, HungerBoxParsedOrder } from './hungerboxParser';
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
    const sessionSummary = agg.mealSessions
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
        mealSessions: agg.mealSessions,
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
        mealSessions: agg.mealSessions,
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
