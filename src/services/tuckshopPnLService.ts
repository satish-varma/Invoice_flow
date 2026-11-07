import { NewRelicTuckshopRecord } from './newrelicTuckshopService';
import { COMPANY_SITES, SiteId, resolveSiteId } from '@/types/site';
import { formatOrdinalDate } from './hungerboxParser';

export type ExpenseNature = 'COGS' | 'OPEX';

export interface CategoryFinancialItem {
  category: string;
  normalizedName: string;
  nature: ExpenseNature;
  amount: number;
  count: number;
  percentageOfGroup: number;
  percentageOfTotalExpense: number;
}

export interface DayPnLRecord {
  date: string; // YYYY-MM-DD
  displayDate: string; // "7th-nov-26"
  siteId?: string;
  grossSales: number;
  mrpSales: number;
  mrpCommission: number;
  nonMrpSales: number;
  nonMrpCommission: number;
  totalCommission: number;
  effectiveCommRate: number; // e.g. 14.5%
  netRevenue: number; // Gross - Commission
  cogs: number; // Raw materials
  grossProfit: number; // Net Revenue - COGS
  grossMarginPct: number;
  opex: number; // Operations, gas, packaging, wages
  totalExpenses: number; // COGS + OPEX
  netProfit: number; // Net Revenue - Total Expenses
  netProfitMarginPct: number;
  orderCount: number;
  topItems?: string[];
  isProfitable: boolean;
}

export interface SitePnLSummary {
  siteId: SiteId;
  name: string;
  daysCount: number;
  grossSales: number;
  mrpSales: number;
  mrpCommission: number;
  nonMrpSales: number;
  nonMrpCommission: number;
  totalCommission: number;
  effectiveCommRate: number;
  netRevenue: number;
  cogs: number;
  grossProfit: number;
  grossMarginPct: number;
  opex: number;
  totalExpenses: number;
  netProfit: number;
  netProfitMarginPct: number;
  orderCount: number;
  avgDailySales: number;
  avgOrderValue: number;
}

export interface TuckshopPnLSummary {
  startDate: string;
  endDate: string;
  totalDays: number;
  activeSalesDays: number;
  
  // Topline
  grossSales: number;
  mrpSales: number;
  mrpCommission: number;
  mrpNet: number;
  nonMrpSales: number;
  nonMrpCommission: number;
  nonMrpNet: number;
  
  // Platform Fee
  totalCommission: number;
  effectiveCommissionRate: number; // %
  
  // Realized Net Revenue
  netRevenue: number;
  
  // COGS & Gross Profit
  totalCogs: number;
  cogsPercentage: number; // Food Cost % = (COGS / Net Revenue) * 100
  grossProfit: number;
  grossMarginPct: number; // (Gross Profit / Net Revenue) * 100
  
  // OPEX & Net Profit
  totalOpex: number;
  opexPercentage: number; // (OPEX / Net Revenue) * 100
  totalExpenses: number;
  netProfit: number; // Net Revenue - Total Expenses
  netProfitMarginPct: number; // (Net Profit / Net Revenue) * 100
  
  // Orders & Volume
  orderCount: number;
  avgOrderValue: number;
  avgDailyNetRevenue: number;
  avgDailyProfit: number;
  
  // Breakdowns
  cogsCategories: CategoryFinancialItem[];
  opexCategories: CategoryFinancialItem[];
  allExpenseCategories: CategoryFinancialItem[];
  siteBreakdowns: SitePnLSummary[];
  dailyTimeline: DayPnLRecord[];
}

/**
 * Classifies an expense category as either:
 * - COGS (Cost of Goods Sold / Raw materials / Kitchen Ingredients / Inventory)
 * - OPEX (Operating Expenses / Staff / Packaging / Utilities / Repairs)
 */
export function classifyExpenseCategory(category?: string, description?: string): ExpenseNature {
  const text = `${category || ''} ${description || ''}`.toLowerCase();

  // 1. Direct COGS (Ingredients, Bakery, Raw materials, Groceries, Stock)
  if (
    /dosa|batter|bread|bakery|fruit|apple|banana|veg|vegetable|onion|tomato|potato|grocer|provision|dairy|milk|paneer|curd|egg|chicken|meat|flour|atta|rice|oil|masala|maggi|noodle|sauce|cheese|butter|tea powder|coffee powder|sugar|stock|inventory|cogs/i.test(
      text
    )
  ) {
    return 'COGS';
  }

  // 2. Direct OPEX (Packaging, Staff, Utilities, Gas, Maintenance)
  if (
    /cutlery|plate|cup|glass|spoon|fork|foil|container|packaging|carry bag|tissue|napkin|gas|lpg|cylinder|salary|wage|staff|allowance|bonus|clean|housekeep|transport|auto|cab|delivery|logistics|repair|maint|service|fix|rent|electric|utility|misc|other/i.test(
      text
    )
  ) {
    return 'OPEX';
  }

  // Default to COGS if it appears to be inventory purchase, otherwise OPEX
  return 'COGS';
}

/**
 * Normalizes category label for display consistency
 */
export function normalizeCategoryName(raw?: string): string {
  if (!raw) return 'Uncategorized';
  const clean = raw.trim().replace(/_/g, ' ');
  const lower = clean.toLowerCase();

  if (lower.includes('dosa') || lower.includes('batter')) return 'Dosa Batter';
  if (lower.includes('bread') || lower.includes('bakery')) return 'Bakery & Bread';
  if (lower.includes('fruit')) return 'Fresh Fruits';
  if (lower.includes('veg')) return 'Vegetables & Produce';
  if (lower.includes('grocer') || lower.includes('provision')) return 'Groceries & Staples';
  if (lower.includes('milk') || lower.includes('dairy') || lower.includes('paneer')) return 'Dairy & Milk';
  if (lower.includes('cutlery') || lower.includes('crockery') || lower.includes('cup') || lower.includes('plate')) return 'Cutlery & Packaging';
  if (lower.includes('gas') || lower.includes('cylinder') || lower.includes('lpg')) return 'Commercial Gas (LPG)';
  if (lower.includes('salary') || lower.includes('wage') || lower.includes('staff')) return 'Staff Wages & Allowances';
  if (lower.includes('clean') || lower.includes('housekeep')) return 'Cleaning & Housekeeping';
  if (lower.includes('repair') || lower.includes('maint')) return 'Maintenance & Repairs';
  if (lower.includes('transport') || lower.includes('logistics')) return 'Logistics & Transport';

  // Capitalize words
  return clean.replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Robust financial extractor ensuring 100% calculation consistency across rows
 */
export function extractRecordFinancials(r: NewRelicTuckshopRecord) {
  const gross = Number(r.amount) || 0;
  let mrp = r.mrpSales !== undefined ? Number(r.mrpSales) : 0;
  let nonMrp = r.nonMrpSales !== undefined ? Number(r.nonMrpSales) : 0;

  // Fallback for legacy records without explicit split
  if (r.mrpSales === undefined && r.nonMrpSales === undefined) {
    const isPackaged = /tuck|bakery|packaged/i.test(`${r.location || ''} ${r.description || ''}`);
    if (isPackaged) {
      mrp = gross;
      nonMrp = 0;
    } else {
      nonMrp = gross;
      mrp = 0;
    }
  }

  // Exact HungerBox Commission Rules:
  // - MRP Packaged Sales: 3% commission
  // - Non-MRP Fresh Kitchen Food Sales (Maggi, Sandwich, Juice, etc.): 19% commission
  const mrpComm = Math.round(mrp * 0.03 * 100) / 100;
  const nonMrpComm = Math.round(nonMrp * 0.19 * 100) / 100;
  const totalComm = Math.round((mrpComm + nonMrpComm) * 100) / 100;
  const net = Math.round((gross - totalComm) * 100) / 100;

  return {
    gross,
    mrp,
    mrpComm,
    mrpNet: Math.round((mrp - mrpComm) * 100) / 100,
    nonMrp,
    nonMrpComm,
    nonMrpNet: Math.round((nonMrp - nonMrpComm) * 100) / 100,
    totalComm,
    net,
  };
}

/**
 * Computes comprehensive Executive P&L from Tuckshop records
 */
export function computeTuckshopPnL(
  records: NewRelicTuckshopRecord[],
  options?: {
    siteId?: string; // 'all' or specific site
    startDate?: string; // YYYY-MM-DD
    endDate?: string; // YYYY-MM-DD
  }
): TuckshopPnLSummary {
  const siteFilter = options?.siteId && options.siteId !== 'all' ? options.siteId : null;
  const startDate = options?.startDate || '';
  const endDate = options?.endDate || '';

  // 1. Filter records
  const filtered = records.filter((r) => {
    const recSite = resolveSiteId(r.siteId);
    if (siteFilter && recSite !== siteFilter) return false;

    const rDate = (r.date || '').split('T')[0];
    if (startDate && rDate < startDate) return false;
    if (endDate && rDate > endDate) return false;

    return true;
  });

  // 2. Maps for daily aggregation
  const dailyMap = new Map<
    string,
    {
      date: string;
      siteId?: string;
      grossSales: number;
      mrpSales: number;
      mrpCommission: number;
      nonMrpSales: number;
      nonMrpCommission: number;
      totalCommission: number;
      netRevenue: number;
      cogs: number;
      opex: number;
      orderCount: number;
      topItems: Set<string>;
    }
  >();

  // Category trackers
  const cogsCatMap = new Map<string, { amount: number; count: number }>();
  const opexCatMap = new Map<string, { amount: number; count: number }>();
  const allCatMap = new Map<string, { nature: ExpenseNature; amount: number; count: number }>();

  // Site trackers
  const siteMap = new Map<
    SiteId,
    {
      days: Set<string>;
      grossSales: number;
      mrpSales: number;
      mrpCommission: number;
      nonMrpSales: number;
      nonMrpCommission: number;
      totalCommission: number;
      netRevenue: number;
      cogs: number;
      opex: number;
      orderCount: number;
    }
  >();

  // Initialize known company sites
  Object.keys(COMPANY_SITES).forEach((sKey) => {
    siteMap.set(sKey as SiteId, {
      days: new Set(),
      grossSales: 0,
      mrpSales: 0,
      mrpCommission: 0,
      nonMrpSales: 0,
      nonMrpCommission: 0,
      totalCommission: 0,
      netRevenue: 0,
      cogs: 0,
      opex: 0,
      orderCount: 0,
    });
  });

  // Global accumulators
  let globalGross = 0;
  let globalMrp = 0;
  let globalMrpComm = 0;
  let globalNonMrp = 0;
  let globalNonMrpComm = 0;
  let globalTotalComm = 0;
  let globalNetRevenue = 0;
  let globalCogs = 0;
  let globalOpex = 0;
  let globalOrderCount = 0;
  let activeSalesDaysCount = 0;

  // Process all records
  for (const r of filtered) {
    const dateStr = (r.date || '').split('T')[0];
    if (!dateStr) continue;

    const sId = resolveSiteId(r.siteId);

    // Initialize daily entry
    if (!dailyMap.has(dateStr)) {
      dailyMap.set(dateStr, {
        date: dateStr,
        siteId: siteFilter ? sId : undefined,
        grossSales: 0,
        mrpSales: 0,
        mrpCommission: 0,
        nonMrpSales: 0,
        nonMrpCommission: 0,
        totalCommission: 0,
        netRevenue: 0,
        cogs: 0,
        opex: 0,
        orderCount: 0,
        topItems: new Set(),
      });
    }

    const dayEntry = dailyMap.get(dateStr)!;
    const siteEntry = siteMap.get(sId);

    if (r.type === 'sale') {
      const f = extractRecordFinancials(r);

      // Daily
      dayEntry.grossSales += f.gross;
      dayEntry.mrpSales += f.mrp;
      dayEntry.mrpCommission += f.mrpComm;
      dayEntry.nonMrpSales += f.nonMrp;
      dayEntry.nonMrpCommission += f.nonMrpComm;
      dayEntry.totalCommission += f.totalComm;
      dayEntry.netRevenue += f.net;
      const orders = Number(r.orderCount) || 1;
      dayEntry.orderCount += orders;

      // Site
      if (siteEntry) {
        siteEntry.days.add(dateStr);
        siteEntry.grossSales += f.gross;
        siteEntry.mrpSales += f.mrp;
        siteEntry.mrpCommission += f.mrpComm;
        siteEntry.nonMrpSales += f.nonMrp;
        siteEntry.nonMrpCommission += f.nonMrpComm;
        siteEntry.totalCommission += f.totalComm;
        siteEntry.netRevenue += f.net;
        siteEntry.orderCount += orders;
      }

      // Global
      globalGross += f.gross;
      globalMrp += f.mrp;
      globalMrpComm += f.mrpComm;
      globalNonMrp += f.nonMrp;
      globalNonMrpComm += f.nonMrpComm;
      globalTotalComm += f.totalComm;
      globalNetRevenue += f.net;
      globalOrderCount += orders;
    } else {
      // Expense
      const amt = Number(r.amount) || 0;
      const nature = classifyExpenseCategory(r.category, r.description);
      const normalizedCat = normalizeCategoryName(r.category);

      if (nature === 'COGS') {
        dayEntry.cogs += amt;
        if (siteEntry) siteEntry.cogs += amt;
        globalCogs += amt;

        const existing = cogsCatMap.get(normalizedCat) || { amount: 0, count: 0 };
        existing.amount += amt;
        existing.count += 1;
        cogsCatMap.set(normalizedCat, existing);
      } else {
        dayEntry.opex += amt;
        if (siteEntry) siteEntry.opex += amt;
        globalOpex += amt;

        const existing = opexCatMap.get(normalizedCat) || { amount: 0, count: 0 };
        existing.amount += amt;
        existing.count += 1;
        opexCatMap.set(normalizedCat, existing);
      }

      const allExisting = allCatMap.get(normalizedCat) || { nature, amount: 0, count: 0 };
      allExisting.amount += amt;
      allExisting.count += 1;
      allCatMap.set(normalizedCat, allExisting);
    }
  }

  // 3. Compile timeline in chronological order
  const timelineDates = Array.from(dailyMap.keys()).sort((a, b) => a.localeCompare(b));
  const dailyTimeline: DayPnLRecord[] = timelineDates.map((dKey) => {
    const d = dailyMap.get(dKey)!;
    const grossSales = Math.round(d.grossSales * 100) / 100;
    const mrpSales = Math.round(d.mrpSales * 100) / 100;
    const mrpCommission = Math.round(d.mrpCommission * 100) / 100;
    const nonMrpSales = Math.round(d.nonMrpSales * 100) / 100;
    const nonMrpCommission = Math.round(d.nonMrpCommission * 100) / 100;
    const totalCommission = Math.round(d.totalCommission * 100) / 100;
    const effectiveCommRate = grossSales > 0 ? Math.round((totalCommission / grossSales) * 1000) / 10 : 0;
    const netRevenue = Math.round(d.netRevenue * 100) / 100;
    const cogs = Math.round(d.cogs * 100) / 100;
    const grossProfit = Math.round((netRevenue - cogs) * 100) / 100;
    const grossMarginPct = netRevenue > 0 ? Math.round((grossProfit / netRevenue) * 1000) / 10 : 0;
    const opex = Math.round(d.opex * 100) / 100;
    const totalExpenses = Math.round((cogs + opex) * 100) / 100;
    const netProfit = Math.round((netRevenue - totalExpenses) * 100) / 100;
    const netProfitMarginPct = netRevenue > 0 ? Math.round((netProfit / netRevenue) * 1000) / 10 : 0;

    if (grossSales > 0) activeSalesDaysCount++;

    return {
      date: d.date,
      displayDate: formatOrdinalDate(d.date),
      siteId: d.siteId,
      grossSales,
      mrpSales,
      mrpCommission,
      nonMrpSales,
      nonMrpCommission,
      totalCommission,
      effectiveCommRate,
      netRevenue,
      cogs,
      grossProfit,
      grossMarginPct,
      opex,
      totalExpenses,
      netProfit,
      netProfitMarginPct,
      orderCount: d.orderCount,
      isProfitable: netProfit >= 0,
    };
  });

  // Total expenses
  const totalExpenses = Math.round((globalCogs + globalOpex) * 100) / 100;
  const grossProfit = Math.round((globalNetRevenue - globalCogs) * 100) / 100;
  const netProfit = Math.round((globalNetRevenue - totalExpenses) * 100) / 100;

  // Margin ratios
  const effectiveCommissionRate =
    globalGross > 0 ? Math.round((globalTotalComm / globalGross) * 1000) / 10 : 0;
  const cogsPercentage =
    globalNetRevenue > 0 ? Math.round((globalCogs / globalNetRevenue) * 1000) / 10 : 0;
  const grossMarginPct =
    globalNetRevenue > 0 ? Math.round((grossProfit / globalNetRevenue) * 1000) / 10 : 0;
  const opexPercentage =
    globalNetRevenue > 0 ? Math.round((globalOpex / globalNetRevenue) * 1000) / 10 : 0;
  const netProfitMarginPct =
    globalNetRevenue > 0 ? Math.round((netProfit / globalNetRevenue) * 1000) / 10 : 0;

  // Category breakdown lists
  const cogsCategories: CategoryFinancialItem[] = Array.from(cogsCatMap.entries())
    .map(([cat, val]) => ({
      category: cat,
      normalizedName: cat,
      nature: 'COGS' as ExpenseNature,
      amount: val.amount,
      count: val.count,
      percentageOfGroup: globalCogs > 0 ? Math.round((val.amount / globalCogs) * 1000) / 10 : 0,
      percentageOfTotalExpense:
        totalExpenses > 0 ? Math.round((val.amount / totalExpenses) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.amount - a.amount);

  const opexCategories: CategoryFinancialItem[] = Array.from(opexCatMap.entries())
    .map(([cat, val]) => ({
      category: cat,
      normalizedName: cat,
      nature: 'OPEX' as ExpenseNature,
      amount: val.amount,
      count: val.count,
      percentageOfGroup: globalOpex > 0 ? Math.round((val.amount / globalOpex) * 1000) / 10 : 0,
      percentageOfTotalExpense:
        totalExpenses > 0 ? Math.round((val.amount / totalExpenses) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.amount - a.amount);

  const allExpenseCategories: CategoryFinancialItem[] = Array.from(allCatMap.entries())
    .map(([cat, val]) => ({
      category: cat,
      normalizedName: cat,
      nature: val.nature,
      amount: val.amount,
      count: val.count,
      percentageOfGroup:
        val.nature === 'COGS'
          ? globalCogs > 0
            ? Math.round((val.amount / globalCogs) * 1000) / 10
            : 0
          : globalOpex > 0
          ? Math.round((val.amount / globalOpex) * 1000) / 10
          : 0,
      percentageOfTotalExpense:
        totalExpenses > 0 ? Math.round((val.amount / totalExpenses) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.amount - a.amount);

  // Site breakdowns
  const siteBreakdowns: SitePnLSummary[] = Array.from(siteMap.entries())
    .filter(([_, val]) => val.grossSales > 0 || val.cogs > 0 || val.opex > 0)
    .map(([sId, val]) => {
      const g = Math.round(val.grossSales * 100) / 100;
      const tc = Math.round(val.totalCommission * 100) / 100;
      const nr = Math.round(val.netRevenue * 100) / 100;
      const c = Math.round(val.cogs * 100) / 100;
      const o = Math.round(val.opex * 100) / 100;
      const te = Math.round((c + o) * 100) / 100;
      const gp = Math.round((nr - c) * 100) / 100;
      const np = Math.round((nr - te) * 100) / 100;
      const daysCount = val.days.size;

      return {
        siteId: sId,
        name: COMPANY_SITES[sId]?.name || sId,
        daysCount,
        grossSales: g,
        mrpSales: Math.round(val.mrpSales * 100) / 100,
        mrpCommission: Math.round(val.mrpCommission * 100) / 100,
        nonMrpSales: Math.round(val.nonMrpSales * 100) / 100,
        nonMrpCommission: Math.round(val.nonMrpCommission * 100) / 100,
        totalCommission: tc,
        effectiveCommRate: g > 0 ? Math.round((tc / g) * 1000) / 10 : 0,
        netRevenue: nr,
        cogs: c,
        grossProfit: gp,
        grossMarginPct: nr > 0 ? Math.round((gp / nr) * 1000) / 10 : 0,
        opex: o,
        totalExpenses: te,
        netProfit: np,
        netProfitMarginPct: nr > 0 ? Math.round((np / nr) * 1000) / 10 : 0,
        orderCount: val.orderCount,
        avgDailySales: daysCount > 0 ? Math.round(g / daysCount) : 0,
        avgOrderValue: val.orderCount > 0 ? Math.round((g / val.orderCount) * 10) / 10 : 0,
      };
    })
    .sort((a, b) => b.grossSales - a.grossSales);

  return {
    startDate: timelineDates[0] || startDate,
    endDate: timelineDates[timelineDates.length - 1] || endDate,
    totalDays: timelineDates.length,
    activeSalesDays: activeSalesDaysCount,

    grossSales: Math.round(globalGross * 100) / 100,
    mrpSales: Math.round(globalMrp * 100) / 100,
    mrpCommission: Math.round(globalMrpComm * 100) / 100,
    mrpNet: Math.round((globalMrp - globalMrpComm) * 100) / 100,
    nonMrpSales: Math.round(globalNonMrp * 100) / 100,
    nonMrpCommission: Math.round(globalNonMrpComm * 100) / 100,
    nonMrpNet: Math.round((globalNonMrp - globalNonMrpComm) * 100) / 100,

    totalCommission: Math.round(globalTotalComm * 100) / 100,
    effectiveCommissionRate,

    netRevenue: Math.round(globalNetRevenue * 100) / 100,

    totalCogs: Math.round(globalCogs * 100) / 100,
    cogsPercentage,
    grossProfit,
    grossMarginPct,

    totalOpex: Math.round(globalOpex * 100) / 100,
    opexPercentage,
    totalExpenses,
    netProfit,
    netProfitMarginPct,

    orderCount: globalOrderCount,
    avgOrderValue: globalOrderCount > 0 ? Math.round((globalGross / globalOrderCount) * 10) / 10 : 0,
    avgDailyNetRevenue:
      activeSalesDaysCount > 0 ? Math.round(globalNetRevenue / activeSalesDaysCount) : 0,
    avgDailyProfit: activeSalesDaysCount > 0 ? Math.round(netProfit / activeSalesDaysCount) : 0,

    cogsCategories,
    opexCategories,
    allExpenseCategories,
    siteBreakdowns,
    dailyTimeline,
  };
}
