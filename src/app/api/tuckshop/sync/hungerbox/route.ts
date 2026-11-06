import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getSettings, getHungerBoxSales, createAuditLog, getAuditLogs, turso } from '@/lib/tracker/turso';
import { parseHungerBoxFileBuffer, parseHungerBoxRows, matchSiteFromLocation, parseDateToYmd } from '@/services/hungerboxParser';
import { feedHungerBoxAggregatesToTuckshop, triggerHungerBoxWorker, syncHungerBoxDirectFromPortal } from '@/services/hungerboxSyncService';
import { headers } from 'next/headers';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || !session.user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const settings = await getSettings('default');
    const recentSales = await getHungerBoxSales('default', 10);
    
    // Count total orders in Turso
    let totalSalesCount = recentSales.length;
    try {
      const countRes = await turso.execute('SELECT COUNT(*) as count FROM hungerbox_sales');
      if (countRes.rows.length > 0 && countRes.rows[0]?.count !== undefined) {
        totalSalesCount = Number(countRes.rows[0].count);
      }
    } catch {
      // Ignore count error fallback
    }

    // Get recent sync logs
    const allAuditLogs = await getAuditLogs('default', 25);
    const recentSyncLogs = allAuditLogs.filter(
      (l) => l.action.toLowerCase().includes('hungerbox') || l.action.toLowerCase().includes('sync')
    );

    return NextResponse.json({
      success: true,
      workerConfigured: Boolean(settings.hungerboxWorkerUrl && settings.hungerboxWorkerApiKey),
      workerUrl: settings.hungerboxWorkerUrl ? `${settings.hungerboxWorkerUrl.substring(0, 25)}...` : null,
      recentTelemetryCount: totalSalesCount,
      latestOrderDate: recentSales[0]?.orderDate || null,
      latestSyncedAt: recentSales[0]?.syncedAt || (recentSyncLogs[0]?.timestamp) || null,
      recentOrders: recentSales,
      recentSyncLogs: recentSyncLogs.slice(0, 10),
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user || (session.user as any).role === 'guest') {
    return NextResponse.json({ success: false, error: 'Unauthorized or Read-Only mode' }, { status: 401 });
  }

  const userEmail = session.user.email || 'admin@hungerbox';
  const headerList = await headers();
  const ipAddress = headerList.get('x-forwarded-for') || headerList.get('x-real-ip') || 'unknown';

  const contentType = request.headers.get('content-type') || '';

  // 1. File Upload Mode (multipart/form-data)
  if (contentType.includes('multipart/form-data')) {
    try {
      const formData = await request.formData();
      const file = formData.get('file') as File | null;
      const targetSite = (formData.get('siteId') as string) || 'newrelic';
      const previewOnly = formData.get('previewOnly') === 'true';

      if (!file) {
        return NextResponse.json({ success: false, error: 'No report file provided' }, { status: 400 });
      }

      const arrayBuffer = await file.arrayBuffer();
      const parseResult = parseHungerBoxFileBuffer(arrayBuffer, targetSite as any);

      if (!parseResult.success || parseResult.dailyAggregates.length === 0) {
        return NextResponse.json({
          success: false,
          error: 'Could not extract any valid orders from file. Please ensure this is a HungerBox sales report.',
          details: parseResult.errors,
        }, { status: 400 });
      }

      if (previewOnly) {
        return NextResponse.json({
          success: true,
          preview: true,
          totalSales: parseResult.totalSales,
          validOrders: parseResult.validOrders,
          dailyAggregates: parseResult.dailyAggregates,
        });
      }

      // Feed aggregates into Tuckshop Firestore & Turso
      const feedResults = await feedHungerBoxAggregatesToTuckshop(parseResult.dailyAggregates, userEmail);

      await createAuditLog({
        userId: (session.user as any).id,
        userEmail,
        action: 'Imported HungerBox Sales Report File',
        details: JSON.stringify({
          fileName: file.name,
          validOrders: parseResult.validOrders,
          totalSales: parseResult.totalSales,
          daysProcessed: feedResults.length,
        }),
        orgId: 'default',
        ipAddress,
      });

      return NextResponse.json({
        success: true,
        message: `Successfully fed ${parseResult.validOrders} orders (₹${Math.round(parseResult.totalSales).toLocaleString('en-IN')}) into Tuckshop across ${feedResults.length} day(s).`,
        totalSales: parseResult.totalSales,
        validOrders: parseResult.validOrders,
        feedResults,
      });
    } catch (err: any) {
      console.error('[API] HungerBox file import error:', err);
      return NextResponse.json({ success: false, error: err.message || 'Failed to process file' }, { status: 500 });
    }
  }

  // 2. JSON Trigger Mode (Worker Sync or Direct Aggregates Feed)
  try {
    const body = await request.json();
    const action = body.action || 'portal_api_sync';

    // Direct Sync straight from HungerBox Admin API without reading local downloads
    if (action === 'portal_api_sync' || action === 'direct_portal_sync') {
      const syncResult = await syncHungerBoxDirectFromPortal({
        fromDate: body.startDate,
        toDate: body.endDate,
        userEmail,
      });

      await createAuditLog({
        userId: (session.user as any).id,
        userEmail,
        action: 'Direct HungerBox Portal API Sync',
        details: JSON.stringify({
          startDate: body.startDate,
          endDate: body.endDate,
          totalSales: syncResult.totalSales,
          totalOrders: syncResult.totalOrders,
          totalMrpSales: syncResult.totalMrpSales,
          totalNonMrpSales: syncResult.totalNonMrpSales,
          daysProcessed: syncResult.feedResults.length,
        }),
        orgId: 'default',
        ipAddress,
      });

      return NextResponse.json({
        success: true,
        message: `Successfully pulled ${syncResult.totalOrders.toLocaleString('en-IN')} orders directly from HungerBox API (₹${Math.round(syncResult.totalSales).toLocaleString('en-IN')}) across ${syncResult.feedResults.length} daily site records!`,
        totalSales: syncResult.totalSales,
        totalOrders: syncResult.totalOrders,
        totalMrpSales: syncResult.totalMrpSales,
        totalNonMrpSales: syncResult.totalNonMrpSales,
        feedResults: syncResult.feedResults,
      });
    }

    if (action === 'feed_aggregates' && Array.isArray(body.aggregates)) {
      const feedResults = await feedHungerBoxAggregatesToTuckshop(body.aggregates, userEmail);
      return NextResponse.json({
        success: true,
        message: `Saved ${feedResults.length} day(s) of HungerBox sales to Tuckshop ledger.`,
        feedResults,
      });
    }

    if (action === 'aggregate_telemetry') {
      const { startDate, endDate, siteId } = body;
      let querySql = 'SELECT order_id, order_date, amount, item_name, cafeteria_name, vendor_name, status FROM hungerbox_sales';
      const args: any[] = [];
      if (startDate && endDate) {
        querySql += ' WHERE order_date >= ? AND order_date <= ?';
        args.push(startDate, endDate);
      }
      querySql += ' ORDER BY order_date DESC LIMIT 50000';

      const res = await turso.execute({ sql: querySql, args });
      if (res.rows.length === 0) {
        return NextResponse.json({ success: false, error: 'No order telemetry found in database to aggregate.' });
      }

      const rows = res.rows.map((r: any) => ({
        orderid: r.order_id,
        date: r.order_date,
        amount: Number(r.amount) || 0,
        itemname: r.item_name,
        cafeteria: r.cafeteria_name,
        vendor: r.vendor_name,
        status: r.status,
      }));

      const parseResult = parseHungerBoxRows(rows, siteId || 'newrelic');
      const feedResults = await feedHungerBoxAggregatesToTuckshop(parseResult.dailyAggregates, userEmail);

      await createAuditLog({
        userId: (session.user as any).id,
        userEmail,
        action: 'Aggregated HungerBox Telemetry into Daily Ledger',
        details: JSON.stringify({
          ordersProcessed: rows.length,
          daysGenerated: feedResults.length,
          totalSales: parseResult.totalSales,
        }),
        orgId: 'default',
        ipAddress,
      });

      return NextResponse.json({
        success: true,
        message: `Successfully aggregated ${rows.length} HungerBox orders into ${feedResults.length} daily site ledger records (₹${Math.round(parseResult.totalSales).toLocaleString('en-IN')}).`,
        totalSales: parseResult.totalSales,
        validOrders: parseResult.validOrders,
        feedResults,
      });
    }

    if (action === 'worker_sync') {
      const settings = await getSettings('default');
      const workerUrl = (body.workerUrl || settings.hungerboxWorkerUrl || process.env.HUNGERBOX_WORKER_URL || '').trim();
      const apiKey = (body.apiKey || settings.hungerboxWorkerApiKey || process.env.WORKER_API_KEY || '').trim();

      if (!workerUrl || !apiKey) {
        return NextResponse.json({
          success: false,
          error: 'HungerBox Worker URL and API Key are not configured. Please set them in Tracker Settings or configure worker credentials.',
        }, { status: 400 });
      }

      const workerRes = await triggerHungerBoxWorker({
        workerUrl,
        apiKey,
        startDate: body.startDate,
        endDate: body.endDate,
        siteId: body.siteId,
      });

      // If worker directly returned sales data rows:
      if (workerRes && Array.isArray(workerRes.orders)) {
        const parseResult = parseHungerBoxRows(workerRes.orders, body.siteId || 'newrelic');
        const feedResults = await feedHungerBoxAggregatesToTuckshop(parseResult.dailyAggregates, userEmail);

        await createAuditLog({
          userId: (session.user as any).id,
          userEmail,
          action: 'HungerBox Worker Sync Completed',
          details: JSON.stringify({
            workerResStatus: workerRes.status || 'OK',
            ordersPulled: parseResult.validOrders,
            totalSales: parseResult.totalSales,
          }),
          orgId: 'default',
          ipAddress,
        });

        return NextResponse.json({
          success: true,
          message: `Worker pulled ${parseResult.validOrders} orders and updated Tuckshop ledger!`,
          totalSales: parseResult.totalSales,
          validOrders: parseResult.validOrders,
          feedResults,
        });
      }

      // If worker runs asynchronously, look up any orders in Turso for the target date range
      const startDate = body.startDate || parseDateToYmd(new Date());
      const endDate = body.endDate || startDate;
      const recentSales = await getHungerBoxSales('default', 1000);
      const matchingSales = recentSales.filter((s) => {
        const d = (s.orderDate || '').split('T')[0];
        return d >= startDate && d <= endDate;
      });

      if (matchingSales.length > 0) {
        const rows = matchingSales.map((s) => ({
          orderid: s.orderId,
          date: s.orderDate,
          amount: s.amount,
          itemname: s.itemName,
          cafeteria: s.cafeteriaName,
          status: s.status,
        }));
        const parseResult = parseHungerBoxRows(rows, body.siteId || 'newrelic');
        const feedResults = await feedHungerBoxAggregatesToTuckshop(parseResult.dailyAggregates, userEmail);

        return NextResponse.json({
          success: true,
          message: `Worker synced ${matchingSales.length} orders into Tuckshop ledger across ${feedResults.length} day(s).`,
          feedResults,
          workerResponse: workerRes,
        });
      }

      return NextResponse.json({
        success: true,
        message: 'HungerBox Sync worker triggered successfully! The background scraper is pulling orders.',
        workerResponse: workerRes,
      });
    }

    return NextResponse.json({ success: false, error: `Unknown action: ${action}` }, { status: 400 });
  } catch (err: any) {
    console.error('[API] HungerBox sync route error:', err);
    return NextResponse.json({ success: false, error: err.message || 'Worker sync failed' }, { status: 500 });
  }
}
