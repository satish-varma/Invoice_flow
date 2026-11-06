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
  isMrp: boolean;
  raw?: Record<string, any>;
}

export interface HungerBoxDailyAggregate {
  date: string; // YYYY-MM-DD
  displayDate?: string; // e.g. "1st-jan-26"
  siteId: SiteId;
  locationName: string;
  totalAmount: number; // Gross Total Sale
  orderCount: number;
  uniqueOrdersCount: number;
  
  // MRP vs Non-MRP Sales & Commissions
  mrpSales: number; // Gross MRP sales
  mrpCommission: number; // 19% deduction on MRP sales
  mrpNet: number; // MRP after 19% deduction
  nonMrpSales: number; // Gross Non-MRP sales
  nonMrpCommission: number; // 3% deduction on Non-MRP sales
  nonMrpNet: number; // Non-MRP after 3% deduction
  totalCommission: number; // mrpCommission + nonMrpCommission
  netSales: number; // Total Sale After Commission (Gross Sale - Total Commission)

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

/**
 * Formats date into exact "1st-jan-26" format with ordinal suffix
 */
export function formatOrdinalDate(dateStr: string): string {
  if (!dateStr) return '';
  const clean = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr;
  const parts = clean.split('-');
  if (parts.length !== 3) return dateStr;
  const year = parts[0].slice(-2);
  const monthIdx = parseInt(parts[1], 10) - 1;
  const day = parseInt(parts[2], 10);
  if (isNaN(day) || monthIdx < 0 || monthIdx > 11) return dateStr;

  const getSuffix = (n: number) => {
    if (n >= 11 && n <= 13) return 'th';
    switch (n % 10) {
      case 1: return 'st';
      case 2: return 'nd';
      case 3: return 'rd';
      default: return 'th';
    }
  };
  const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
  return `${day}${getSuffix(day)}-${months[monthIdx]}-${year}`;
}

/**
 * Classifies whether an item is an MRP packaged product (19% fee) or NON-MRP prepared food/beverage (3% fee)
 */
export function isMrpItem(itemName: string, vendorName?: string, rawRow?: Record<string, any>): boolean {
  if (rawRow) {
    const rawCategory = String(rawRow['category'] || rawRow['type'] || rawRow['ratetype'] || rawRow['itemtype'] || '').toLowerCase();
    if (rawCategory.includes('non-mrp') || rawCategory.includes('non_mrp') || rawCategory.includes('kitchen')) return false;
    if (rawCategory.includes('mrp') || rawCategory.includes('retail') || rawCategory.includes('packaged')) return true;
  }

  const v = (vendorName || '').toLowerCase();
  if (v.includes('live counter') || v.includes('juice counter') || v.includes('kitchen') || v.includes('food court')) {
    return false;
  }

  const name = (itemName || '').toLowerCase();
  // Prepared food and freshly brewed beverages -> NON-MRP (3% commission)
  if (/tea|coffee|chai|milk|horlicks|boost|dosa|idly|idli|rice|chapthi|chapathi|roti|paratha|punugulu|bajji|bonda|curry|curd|puff|samosa|bhel|upma|poha|vada|lemonade|juice|shake|meal|biryani|pulao/i.test(name)) {
    return false;
  }

  // Branded packaged snacks, biscuits, confectionery -> MRP (19% commission)
  if (/lays|haldiram|cadbury|britannia|biscuit|cookie|chikki|chips|chocolate|amul|thumsup|coke|pepsi|kurkure|bingo|parle|snickers|kitkat|dairy milk|wafer|namkeen|packaged|sweet chilli|salted/i.test(name)) {
    return true;
  }

  // By default, tuckshop items without fresh kitchen food keywords are considered packaged MRP goods
  if (v.includes('tuckshop') || v.includes('tuck shop')) {
    return true;
  }

  return false;
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
  if (loc.includes('relic') || loc.includes('new relic') || loc.includes('orion') || loc.includes('455')) {
    return { siteId: 'newrelic', name: 'New Relic' };
  }
  if (loc.includes('dsm') || loc.includes('firmenich') || loc.includes('458')) {
    return { siteId: 'dsm', name: 'DSM' };
  }
  if (loc.includes('ntt') || loc.includes('data') || loc.includes('2082') || loc.includes('457') || loc.includes('2820')) {
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
    const rawLocField =
      rowMap['cafeteria'] ??
      rowMap['location'] ??
      rowMap['site'] ??
      rowMap['company'] ??
      rowMap['client'] ??
      rowMap['companyname'] ??
      rowMap['outlet'];
    const rawVendorField = rowMap['vendor'] ?? rowMap['vendorname'] ?? rowMap['stall'];
    const combinedLocation = `${rawLocField || ''} ${rawVendorField || ''}`.trim() || undefined;
    const { siteId, name: locationName } = matchSiteFromLocation(combinedLocation, fallbackSite);

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
      const isMrp = isMrpItem(itemName, rowMap['vendor'] || rowMap['vendorname'] || rowMap['stall'], rowMap);
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
        isMrp,
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
        displayDate: formatOrdinalDate(order.orderDate),
        siteId: order.siteId,
        locationName: order.locationName,
        totalAmount: 0,
        orderCount: 0,
        uniqueOrdersCount: 0,
        mrpSales: 0,
        mrpCommission: 0,
        mrpNet: 0,
        nonMrpSales: 0,
        nonMrpCommission: 0,
        nonMrpNet: 0,
        totalCommission: 0,
        netSales: 0,
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

  // Refine aggregates (MRP vs Non-MRP, sessions, and top items)
  const dailyAggregates: HungerBoxDailyAggregate[] = Array.from(aggregatesMap.values()).map((agg) => {
    const uniqueOrders = new Set(agg.orders.map((o) => o.orderId));
    agg.uniqueOrdersCount = uniqueOrders.size;
    agg.displayDate = formatOrdinalDate(agg.date);

    // Sessions map & MRP vs Non-MRP
    let mrpSum = 0;
    let nonMrpSum = 0;
    const sessionMap = new Map<string, { amount: number; count: number }>();
    const itemMap = new Map<string, { quantity: number; amount: number }>();

    for (const o of agg.orders) {
      if (o.isMrp) {
        mrpSum += o.amount;
      } else {
        nonMrpSum += o.amount;
      }

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

    // Exact commission deductions: 19% on MRP, 3% on Non-MRP
    agg.mrpSales = Math.round(mrpSum * 100) / 100;
    agg.mrpCommission = Math.round(mrpSum * 0.19 * 100) / 100;
    agg.mrpNet = Math.round((agg.mrpSales - agg.mrpCommission) * 100) / 100;

    agg.nonMrpSales = Math.round(nonMrpSum * 100) / 100;
    agg.nonMrpCommission = Math.round(nonMrpSum * 0.03 * 100) / 100;
    agg.nonMrpNet = Math.round((agg.nonMrpSales - agg.nonMrpCommission) * 100) / 100;

    agg.totalCommission = Math.round((agg.mrpCommission + agg.nonMrpCommission) * 100) / 100;
    agg.netSales = Math.round((agg.mrpNet + agg.nonMrpNet) * 100) / 100;

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
