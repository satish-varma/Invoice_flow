import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { turso } from '@/lib/tracker/turso';
import { formatOrdinalDate } from '@/services/hungerboxParser';
import { COMPANY_SITES, SiteId } from '@/types/site';

export const dynamic = 'force-dynamic';

export interface GroupedItemDetail {
  itemName: string;
  category: string;
  isMrp: boolean;
  commissionRate: number; // 0.03 or 0.19
  quantity: number;
  avgUnitPrice: number;
  totalGross: number;
  commission: number;
  netPayout: number;
  siteId: string;
  siteName: string;
  vendorName: string;
  orderIds: string[];
}

export interface DateGroupedItemSales {
  date: string; // YYYY-MM-DD
  displayDate: string; // "23rd-jan-26"
  totalGross: number;
  totalOrders: number;
  totalItems: number;
  nonMrpSales: number;
  nonMrpCommission: number;
  mrpSales: number;
  mrpCommission: number;
  totalCommission: number;
  netPayout: number;
  siteBreakdown: { siteId: string; name: string; amount: number; count: number }[];
  categoryBreakdown: { category: string; amount: number; count: number }[];
  items: GroupedItemDetail[];
}

function classifyItemCategory(itemName: string, isMrp: boolean): string {
  const name = (itemName || '').toLowerCase();
  if (/maggi|maggie|noodle/i.test(name)) return 'Maggi & Noodles';
  if (/sandwich|toast|bread|sub/i.test(name)) return 'Sandwiches & Toast';
  if (/juice|shake|smoothie|fruit/i.test(name)) return 'Fresh Juices & Shakes';
  if (/omlet|omelet|egg/i.test(name)) return 'Omelettes & Eggs';
  if (/tea|coffee|chai|milk|horlicks|boost|bournvita/i.test(name)) return 'Tea & Coffee';
  if (/puff|samosa|dilkush|pastry|cake|bakery|roll|muffin/i.test(name)) return 'Puffs & Bakery';
  if (/dosa|idly|idli|vada|upma|poha|punugulu|bonda|bajji|pesarattu/i.test(name)) return 'South Indian Breakfast';
  if (/rice|chapathi|chapthi|roti|paratha|meal|biryani|pulao|curry|curd/i.test(name)) return 'Meals & Rice';
  if (/bhel|chaat|fries|snack/i.test(name)) return 'Snacks & Live Counter';
  if (isMrp) return 'Packaged Snacks (MRP)';
  return 'Kitchen Fresh Food';
}

function resolveSiteFromRow(cafeteria?: string, vendor?: string): { siteId: SiteId; name: string } {
  const c = (cafeteria || '').toLowerCase();
  const v = (vendor || '').toLowerCase();

  if (c === 'ntt_data' || c.includes('ntt') || v.includes('ntt')) {
    return { siteId: 'ntt_data', name: 'NTT Data' };
  }
  if (c === 'dsm' || c.includes('dsm') || c.includes('firmenich') || v.includes('dsm') || v.includes('gut guru')) {
    return { siteId: 'dsm', name: 'DSM' };
  }
  if (c === 'newrelic' || c.includes('relic') || v.includes('relic') || c.includes('455')) {
    return { siteId: 'newrelic', name: 'New Relic' };
  }

  return { siteId: 'newrelic', name: COMPANY_SITES.newrelic.name };
}

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const url = new URL(request.url);
    const siteFilter = url.searchParams.get('siteId') || 'all';
    const searchTerm = (url.searchParams.get('search') || '').trim().toLowerCase();
    const categoryFilter = url.searchParams.get('category') || 'all';
    const startDate = url.searchParams.get('startDate') || '';
    const endDate = url.searchParams.get('endDate') || '';
    const limit = parseInt(url.searchParams.get('limit') || '50000', 10);

    // Build dynamic SQL query for Turso
    let sql = `SELECT order_id, order_date, vendor_name, cafeteria_name, amount, item_name, status, org_id, quantity
               FROM hungerbox_sales
               WHERE 1=1`;
    const args: any[] = [];

    if (siteFilter !== 'all') {
      sql += ` AND (cafeteria_name = ? OR org_id = ?)`;
      args.push(siteFilter, siteFilter);
    }

    if (startDate) {
      sql += ` AND order_date >= ?`;
      args.push(startDate);
    }

    if (endDate) {
      sql += ` AND order_date <= ?`;
      args.push(endDate);
    }

    sql += ` ORDER BY order_date DESC LIMIT ?`;
    args.push(limit);

    const queryRes = await turso.execute({ sql, args });
    const rows = queryRes.rows || [];

    // Filter and process rows
    const byDate = new Map<
      string,
      {
        date: string;
        rawOrders: {
          orderId: string;
          orderDate: string;
          amount: number;
          quantity: number;
          itemName: string;
          siteId: SiteId;
          siteName: string;
          vendorName: string;
          isMrp: boolean;
          category: string;
        }[];
      }
    >();

    for (const r of rows) {
      const orderDate = String(r.order_date || '').split('T')[0];
      if (!orderDate) continue;

      const { siteId, name: siteName } = resolveSiteFromRow(
        String(r.cafeteria_name || ''),
        String(r.vendor_name || '')
      );

      if (siteFilter !== 'all' && siteId !== siteFilter) continue;

      const itemName = String(r.item_name || 'Counter Purchase').trim();
      const amount = Number(r.amount) || 0;
      const quantity = Number(r.quantity) > 0 ? Number(r.quantity) : 1;
      const orderId = String(r.order_id || '');
      const statusStr = String(r.status || '').toLowerCase();

      // Check item search filter
      if (searchTerm && !itemName.toLowerCase().includes(searchTerm) && !orderId.toLowerCase().includes(searchTerm)) {
        continue;
      }

      // Determine MRP vs Non-MRP accurately
      let isMrp = false;
      if (statusStr.includes('mrp (3%)') || statusStr === 'mrp') {
        isMrp = true;
      } else if (statusStr.includes('non-mrp') || statusStr.includes('19%')) {
        isMrp = false;
      } else {
        // Fallback heuristic classification
        const isPreparedFood = /maggi|maggie|sandwich|toast|juice|shake|omlet|omelet|egg|tea|coffee|chai|milk|dosa|idly|rice|chapathi|roti|paratha|puff|samosa|punugulu|bajji|bonda|curry|curd|upma|poha|vada|lemonade|meal|biryani|pulao|fries|combo|soup|noodles/i.test(itemName);
        const isBrandedPackaged = /lays|haldiram|cadbury|britannia|biscuit|cookie|chikki|chips|chocolate|amul|thumsup|coke|pepsi|kurkure|bingo|parle|snickers|kitkat|dairy milk|wafer|namkeen|packaged|tropicana|paper boat/i.test(itemName);
        isMrp = !isPreparedFood && isBrandedPackaged;
      }

      const category = classifyItemCategory(itemName, isMrp);

      if (categoryFilter !== 'all' && category !== categoryFilter) {
        continue;
      }

      if (!byDate.has(orderDate)) {
        byDate.set(orderDate, { date: orderDate, rawOrders: [] });
      }

      byDate.get(orderDate)!.rawOrders.push({
        orderId,
        orderDate,
        amount,
        quantity,
        itemName,
        siteId,
        siteName,
        vendorName: String(r.vendor_name || siteName),
        isMrp,
        category,
      });
    }

    // Build hierarchical grouped response
    const groupedDays: DateGroupedItemSales[] = [];

    for (const [date, group] of byDate.entries()) {
      let dayGross = 0;
      let dayMrpGross = 0;
      let dayNonMrpGross = 0;
      const orderSet = new Set<string>();

      const itemsMap = new Map<string, GroupedItemDetail>();
      const siteMap = new Map<string, { siteId: string; name: string; amount: number; count: number }>();
      const catMap = new Map<string, { category: string; amount: number; count: number }>();

      for (const o of group.rawOrders) {
        dayGross += o.amount;
        orderSet.add(o.orderId);

        if (o.isMrp) {
          dayMrpGross += o.amount;
        } else {
          dayNonMrpGross += o.amount;
        }

        // Sites breakdown
        if (!siteMap.has(o.siteId)) {
          siteMap.set(o.siteId, { siteId: o.siteId, name: o.siteName, amount: 0, count: 0 });
        }
        const sEntry = siteMap.get(o.siteId)!;
        sEntry.amount += o.amount;
        sEntry.count += o.quantity;

        // Categories breakdown
        if (!catMap.has(o.category)) {
          catMap.set(o.category, { category: o.category, amount: 0, count: 0 });
        }
        const cEntry = catMap.get(o.category)!;
        cEntry.amount += o.amount;
        cEntry.count += o.quantity;

        // Aggregate by item name
        const itemKey = `${o.itemName}_${o.siteId}`;
        if (!itemsMap.has(itemKey)) {
          const commRate = o.isMrp ? 0.03 : 0.19; // 3% on MRP, 19% on Non-MRP
          itemsMap.set(itemKey, {
            itemName: o.itemName,
            category: o.category,
            isMrp: o.isMrp,
            commissionRate: commRate,
            quantity: 0,
            avgUnitPrice: 0,
            totalGross: 0,
            commission: 0,
            netPayout: 0,
            siteId: o.siteId,
            siteName: o.siteName,
            vendorName: o.vendorName,
            orderIds: [],
          });
        }

        const itemRecord = itemsMap.get(itemKey)!;
        itemRecord.quantity += o.quantity;
        itemRecord.totalGross += o.amount;
        if (itemRecord.orderIds.length < 5) {
          itemRecord.orderIds.push(o.orderId);
        }
      }

      // Calculate item financial totals
      const itemsList: GroupedItemDetail[] = Array.from(itemsMap.values()).map((it) => {
        const comm = Math.round(it.totalGross * it.commissionRate * 100) / 100;
        return {
          ...it,
          avgUnitPrice: it.quantity > 0 ? Math.round((it.totalGross / it.quantity) * 100) / 100 : 0,
          totalGross: Math.round(it.totalGross * 100) / 100,
          commission: comm,
          netPayout: Math.round((it.totalGross - comm) * 100) / 100,
        };
      });

      // Sort items by total amount descending
      itemsList.sort((a, b) => b.totalGross - a.totalGross);

      // Financials for this date
      const mrpCommission = Math.round(dayMrpGross * 0.03 * 100) / 100; // 3%
      const nonMrpCommission = Math.round(dayNonMrpGross * 0.19 * 100) / 100; // 19%
      const totalCommission = Math.round((mrpCommission + nonMrpCommission) * 100) / 100;
      const netPayout = Math.round((dayGross - totalCommission) * 100) / 100;

      groupedDays.push({
        date,
        displayDate: formatOrdinalDate(date),
        totalGross: Math.round(dayGross * 100) / 100,
        totalOrders: orderSet.size,
        totalItems: group.rawOrders.length,
        mrpSales: Math.round(dayMrpGross * 100) / 100,
        mrpCommission,
        nonMrpSales: Math.round(dayNonMrpGross * 100) / 100,
        nonMrpCommission,
        totalCommission,
        netPayout,
        siteBreakdown: Array.from(siteMap.values()),
        categoryBreakdown: Array.from(catMap.values()).sort((a, b) => b.amount - a.amount),
        items: itemsList,
      });
    }

    // Sort dates descending
    groupedDays.sort((a, b) => b.date.localeCompare(a.date));

    // Calculate global stats across all matching days
    let totalGross = 0;
    let totalItems = 0;
    let totalOrders = 0;
    let totalMrpSales = 0;
    let totalMrpComm = 0;
    let totalNonMrpSales = 0;
    let totalNonMrpComm = 0;

    for (const d of groupedDays) {
      totalGross += d.totalGross;
      totalItems += d.totalItems;
      totalOrders += d.totalOrders;
      totalMrpSales += d.mrpSales;
      totalMrpComm += d.mrpCommission;
      totalNonMrpSales += d.nonMrpSales;
      totalNonMrpComm += d.nonMrpCommission;
    }

    const totalCommission = Math.round((totalMrpComm + totalNonMrpComm) * 100) / 100;
    const totalNet = Math.round((totalGross - totalCommission) * 100) / 100;

    return NextResponse.json({
      success: true,
      summary: {
        totalGross: Math.round(totalGross * 100) / 100,
        totalItems,
        totalOrders,
        totalDays: groupedDays.length,
        mrpSales: Math.round(totalMrpSales * 100) / 100,
        mrpCommission: Math.round(totalMrpComm * 100) / 100,
        nonMrpSales: Math.round(totalNonMrpSales * 100) / 100,
        nonMrpCommission: Math.round(totalNonMrpComm * 100) / 100,
        totalCommission,
        totalNet,
      },
      days: groupedDays,
    });
  } catch (err: any) {
    console.error('[API] /api/tuckshop/items error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
