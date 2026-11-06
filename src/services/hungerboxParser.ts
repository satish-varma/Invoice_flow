import * as XLSX from 'xlsx';
import { COMPANY_SITES, SiteId, resolveSiteId } from '@/types/site';

export interface HungerBoxParsedOrder {
  orderId: string;
  orderDate: string; // YYYY-MM-DD
  orderTime?: string;
  siteId: SiteId;
  locationName: string;
  stallName?: string;
  mealSession: string; // e.g. Breakfast, Lunch, Snacks, Dinner, All Day
  itemName: string;
  quantity: number;
  amount: number;
  status: string;
  paymentMode?: string;
  raw?: Record<string, any>;
}

export interface HungerBoxDailyAggregate {
  date: string; // YYYY-MM-DD
  siteId: SiteId;
  locationName: string;
  totalAmount: number;
  orderCount: number;
  uniqueOrdersCount: number;
  mealSessions: { session: string; amount: number; count: number }[];
  topItems: { name: string; quantity: number; amount: number }[];
  orders: HungerBoxParsedOrder[];
}

export interface HungerBoxParseResult {
  success: boolean;
  totalRows: number;
  validOrders: number;
  totalSales: number;
  dailyAggregates: HungerBoxDailyAggregate[];
  errors: string[];
}

// Normalize strings for flexible column matching
function normalizeKey(str: string): string {
  return str.toLowerCase().replace(/[^a-z0-9]/g, '');
}

// Parse dates into YYYY-MM-DD ISO date string
export function parseDateToYmd(val: any): string {
  if (!val) {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  // If already YYYY-MM-DD
  if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}/.test(val.trim())) {
    return val.trim().substring(0, 10);
  }

  // If DD-MM-YYYY or DD/MM/YYYY
  if (typeof val === 'string') {
    const dmy = val.trim().match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/);
    if (dmy) {
      const day = dmy[1].padStart(2, '0');
      const month = dmy[2].padStart(2, '0');
      const year = dmy[3];
      return `${year}-${month}-${day}`;
    }
  }

  // If Excel serial number (e.g. 45321)
  if (typeof val === 'number') {
    const excelEpoch = new Date(Date.UTC(1899, 11, 30));
    const jsDate = new Date(excelEpoch.getTime() + val * 86400000);
    if (!isNaN(jsDate.getTime())) {
      return jsDate.toISOString().substring(0, 10);
    }
  }

  // Fallback Date parser
  const parsed = new Date(val);
  if (!isNaN(parsed.getTime())) {
    return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}-${String(parsed.getDate()).padStart(2, '0')}`;
  }

  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
}

// Auto-detect which site a location string belongs to
export function matchSiteFromLocation(rawLocation?: string, fallbackSite: SiteId = 'newrelic'): { siteId: SiteId; name: string } {
  if (!rawLocation) {
    const defaultSite = COMPANY_SITES[fallbackSite] || COMPANY_SITES.newrelic;
    return { siteId: fallbackSite, name: defaultSite.name };
  }

  const loc = rawLocation.toLowerCase();

  for (const [siteKey, site] of Object.entries(COMPANY_SITES)) {
    const nameLower = site.name.toLowerCase();
    const idLower = site.id.toLowerCase();

    if (loc.includes(idLower) || loc.includes(nameLower)) {
      return { siteId: site.id, name: site.name };
    }

    if (site.allowedLocations && site.allowedLocations.some((l) => loc.includes(l.toLowerCase()))) {
      return { siteId: site.id, name: site.name };
    }
  }

  // Generic heuristic matches
  if (loc.includes('relic') || loc.includes('new relic')) {
    return { siteId: 'newrelic', name: 'New Relic' };
  }
  if (loc.includes('dsm') || loc.includes('firmenich')) {
    return { siteId: 'dsm', name: 'DSM' };
  }
  if (loc.includes('ntt') || loc.includes('data')) {
    return { siteId: 'ntt_data', name: 'NTT Data' };
  }

  return { siteId: resolveSiteId(fallbackSite), name: COMPANY_SITES[fallbackSite]?.name || rawLocation };
}

// Normalize meal session names
export function normalizeMealSession(raw?: string): string {
  if (!raw) return 'Counter Sales';
  const lower = raw.toLowerCase().trim();
  if (lower.includes('breakfast') || lower.includes('morning')) return 'Breakfast';
  if (lower.includes('lunch') || lower.includes('afternoon')) return 'Lunch';
  if (lower.includes('snack') || lower.includes('tea') || lower.includes('evening')) return 'Evening Snacks';
  if (lower.includes('dinner') || lower.includes('night')) return 'Dinner';
  return raw.trim() || 'Counter Sales';
}

/**
 * Parses raw tabular rows from HungerBox reports (XLSX / CSV)
 */
export function parseHungerBoxRows(
  rows: Record<string, any>[],
  fallbackSite: SiteId = 'newrelic'
): HungerBoxParseResult {
  const errors: string[] = [];
  const parsedOrders: HungerBoxParsedOrder[] = [];

  if (!rows || rows.length === 0) {
    return {
      success: false,
      totalRows: 0,
      validOrders: 0,
      totalSales: 0,
      dailyAggregates: [],
      errors: ['No rows found in the uploaded file or data stream.'],
    };
  }

  rows.forEach((row, idx) => {
    // Map normalized keys
    const rowMap: Record<string, any> = {};
    for (const [key, val] of Object.entries(row)) {
      rowMap[normalizeKey(key)] = val;
    }

    // 1. Order ID
    const rawOrderId =
      rowMap['orderid'] ??
      rowMap['ordernumber'] ??
      rowMap['orderno'] ??
      rowMap['token'] ??
      rowMap['billno'] ??
      rowMap['transactionid'] ??
      rowMap['id'] ??
      `HB-${idx + 1}`;
    const orderId = String(rawOrderId).trim();

    // 2. Order Date
    const rawDate =
      rowMap['date'] ??
      rowMap['orderdate'] ??
      rowMap['ordereddate'] ??
      rowMap['ordercreatedat'] ??
      rowMap['createddate'] ??
      rowMap['transactiondate'] ??
      rowMap['billdate'] ??
      rowMap['time'] ??
      rowMap['timestamp'];
    const orderDate = parseDateToYmd(rawDate);

    // 3. Amount
    const rawAmount =
      rowMap['amount'] ??
      rowMap['totalamount'] ??
      rowMap['netamount'] ??
      rowMap['paidamount'] ??
      rowMap['itemtotal'] ??
      rowMap['grossamount'] ??
      rowMap['billamount'] ??
      rowMap['price'] ??
      rowMap['total'] ??
      0;
    const amount = typeof rawAmount === 'number' ? rawAmount : parseFloat(String(rawAmount).replace(/[^0-9.-]+/g, '')) || 0;

    // 4. Status (skip cancelled / refunded if marked)
    const rawStatus =
      rowMap['status'] ??
      rowMap['orderstatus'] ??
      rowMap['paymentstatus'] ??
      'Completed';
    const status = String(rawStatus).trim();
    const isCancelled = /cancel|refund|failed|rejected/i.test(status);
    if (isCancelled && amount > 0) {
      // Skip cancelled orders from active sales total
      return;
    }

    // 5. Location / Site
    const rawLocation =
      rowMap['cafeteria'] ??
      rowMap['location'] ??
      rowMap['site'] ??
      rowMap['company'] ??
      rowMap['client'] ??
      rowMap['companyname'] ??
      rowMap['outlet'] ??
      rowMap['stall'];
    const { siteId, name: locationName } = matchSiteFromLocation(rawLocation ? String(rawLocation) : undefined, fallbackSite);

    // 6. Meal Session / Slot
    const rawSession =
      rowMap['meal'] ??
      rowMap['mealtype'] ??
      rowMap['mealsession'] ??
      rowMap['session'] ??
      rowMap['slot'] ??
      rowMap['ordertype'] ??
      rowMap['timeslot'];
    const mealSession = normalizeMealSession(rawSession ? String(rawSession) : undefined);

    // 7. Item Name & Quantity
    const rawItem =
      rowMap['itemname'] ??
      rowMap['item'] ??
      rowMap['product'] ??
      rowMap['productname'] ??
      rowMap['description'] ??
      rowMap['menuitem'] ??
      'Counter Purchase';
    const itemName = String(rawItem).trim();

    const rawQty = rowMap['qty'] ?? rowMap['quantity'] ?? rowMap['itemqty'] ?? 1;
    const quantity = typeof rawQty === 'number' ? rawQty : parseInt(String(rawQty).replace(/[^0-9]+/g, ''), 10) || 1;

    // 8. Payment Mode
    const rawPayment =
      rowMap['paymentmode'] ??
      rowMap['paymentmethod'] ??
      rowMap['mode'] ??
      'HungerBox Digital';

    if (amount > 0 || orderId) {
      parsedOrders.push({
        orderId,
        orderDate,
        siteId,
        locationName,
        stallName: rowMap['stall'] ? String(rowMap['stall']) : undefined,
        mealSession,
        itemName,
        quantity,
        amount,
        status,
        paymentMode: String(rawPayment),
        raw: row,
      });
    }
  });

  // Group by Date and SiteId
  const aggregatesMap = new Map<string, HungerBoxDailyAggregate>();

  for (const order of parsedOrders) {
    const key = `${order.orderDate}_${order.siteId}`;
    if (!aggregatesMap.has(key)) {
      aggregatesMap.set(key, {
        date: order.orderDate,
        siteId: order.siteId,
        locationName: order.locationName,
        totalAmount: 0,
        orderCount: 0,
        uniqueOrdersCount: 0,
        mealSessions: [],
        topItems: [],
        orders: [],
      });
    }

    const agg = aggregatesMap.get(key)!;
    agg.totalAmount += order.amount;
    agg.orderCount++;
    agg.orders.push(order);
  }

  // Refine aggregates (sessions and top items)
  const dailyAggregates: HungerBoxDailyAggregate[] = Array.from(aggregatesMap.values()).map((agg) => {
    const uniqueOrders = new Set(agg.orders.map((o) => o.orderId));
    agg.uniqueOrdersCount = uniqueOrders.size;

    // Sessions map
    const sessionMap = new Map<string, { amount: number; count: number }>();
    const itemMap = new Map<string, { quantity: number; amount: number }>();

    for (const o of agg.orders) {
      const s = o.mealSession || 'Counter Sales';
      if (!sessionMap.has(s)) sessionMap.set(s, { amount: 0, count: 0 });
      const curS = sessionMap.get(s)!;
      curS.amount += o.amount;
      curS.count += 1;

      const item = o.itemName;
      if (!itemMap.has(item)) itemMap.set(item, { quantity: 0, amount: 0 });
      const curI = itemMap.get(item)!;
      curI.quantity += o.quantity;
      curI.amount += o.amount;
    }

    agg.mealSessions = Array.from(sessionMap.entries())
      .map(([session, data]) => ({ session, amount: data.amount, count: data.count }))
      .sort((a, b) => b.amount - a.amount);

    agg.topItems = Array.from(itemMap.entries())
      .map(([name, data]) => ({ name, quantity: data.quantity, amount: data.amount }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);

    return agg;
  });

  dailyAggregates.sort((a, b) => b.date.localeCompare(a.date));

  const totalSales = dailyAggregates.reduce((sum, d) => sum + d.totalAmount, 0);

  return {
    success: dailyAggregates.length > 0,
    totalRows: rows.length,
    validOrders: parsedOrders.length,
    totalSales,
    dailyAggregates,
    errors,
  };
}

/**
 * Parses HungerBox file Buffer (XLSX, XLS, CSV) into structured results
 */
export function parseHungerBoxFileBuffer(
  buffer: Buffer | ArrayBuffer,
  fallbackSite: SiteId = 'newrelic'
): HungerBoxParseResult {
  try {
    const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
      return {
        success: false,
        totalRows: 0,
        validOrders: 0,
        totalSales: 0,
        dailyAggregates: [],
        errors: ['Workbook contains no sheets.'],
      };
    }

    const sheet = workbook.Sheets[sheetName];
    const rawRows = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { defval: '' });
    return parseHungerBoxRows(rawRows, fallbackSite);
  } catch (err: any) {
    return {
      success: false,
      totalRows: 0,
      validOrders: 0,
      totalSales: 0,
      dailyAggregates: [],
      errors: [err.message || 'Failed to parse spreadsheet file.'],
    };
  }
}
