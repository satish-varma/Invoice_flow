import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { syncHungerBoxDirectFromPortal } from '@/services/hungerboxSyncService';
import { createAuditLog } from '@/lib/tracker/turso';

export const dynamic = 'force-dynamic';

const AUTOMATION_STATE_DOC = 'site_settings';
const AUTOMATION_STATE_KEY = 'hungerbox_automation_state';

interface HungerboxCronState {
  lastRunDate?: string;
  lastSyncedToDate?: string;
  lastRunTimestamp?: string;
  totalOrdersSynced?: number;
  totalSalesSynced?: number;
  sitesSynced?: string[];
  status?: 'success' | 'error';
  errorMessage?: string;
}

/**
 * Daily Automated HungerBox Sync Cron Route
 * Scheduled to run every morning between 08:00 AM - 08:30 AM IST (02:30 - 03:00 UTC).
 *
 * Automatically pulls yesterday's complete product sales (and up to 2-3 previous days for buffer)
 * from HungerBox Admin API (HBR2 Redshift), computes exact 3% MRP & 19% Non-MRP commissions,
 * updates Firestore daily ledger, and feeds Turso product-level order telemetry.
 */
export async function GET(req: NextRequest) {
  return handleSyncCron(req);
}

export async function POST(req: NextRequest) {
  return handleSyncCron(req);
}

async function handleSyncCron(req: NextRequest) {
  const startTime = Date.now();

  try {
    // 1. Authorize Cron Trigger
    const authHeader = req.headers.get('authorization');
    const secretQuery =
      req.nextUrl.searchParams.get('secret') ||
      req.nextUrl.searchParams.get('key') ||
      req.nextUrl.searchParams.get('apiKey');
    const isVercelCron = Boolean(req.headers.get('x-vercel-cron'));
    const isCloudScheduler = Boolean(req.headers.get('x-cloudscheduler'));

    const expectedSecret = process.env.CRON_SECRET || process.env.NEXTAUTH_SECRET;

    if (expectedSecret && !isVercelCron && !isCloudScheduler && !req.nextUrl.searchParams.has('force')) {
      const isBearerMatch = authHeader === `Bearer ${expectedSecret}`;
      const isQueryMatch = secretQuery === expectedSecret;
      const host = req.headers.get('host') || '';
      const referer = req.headers.get('referer') || '';
      const isSameOrigin = referer.includes(host);

      if (!isBearerMatch && !isQueryMatch && !isSameOrigin) {
        return new Response('Unauthorized: Invalid CRON_SECRET or bearer token.', { status: 401 });
      }
    }

    // 2. Compute Target Dates in Asia/Kolkata timezone
    const now = new Date();
    const kolkataDateStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(now);
    const kolkataTimeStr = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Kolkata',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(now);

    // Calculate Yesterday (YYYY-MM-DD in IST)
    const yesterdayDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const defaultYesterdayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(yesterdayDate);

    // Lookback buffer: 3 days back to yesterday (covers weekends and any late HungerBox aggregations)
    const bufferStartDate = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
    const defaultFromDateStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(bufferStartDate);

    const fromDate = req.nextUrl.searchParams.get('fromDate') || defaultFromDateStr;
    const toDate = req.nextUrl.searchParams.get('toDate') || defaultYesterdayStr;
    const siteId = req.nextUrl.searchParams.get('siteId') || undefined;

    console.log(`[HungerBoxCron] Triggered at ${kolkataDateStr} ${kolkataTimeStr} IST.`);
    console.log(`[HungerBoxCron] Syncing date range: ${fromDate} to ${toDate} (Site: ${siteId || 'all sites'})`);

    // 3. Execute Direct Portal Sync
    const syncResult = await syncHungerBoxDirectFromPortal({
      fromDate,
      toDate,
      siteId,
      userEmail: 'system:cron-daily-8am',
    });

    const elapsedMs = Date.now() - startTime;

    // 4. Record automation state in Firestore
    const statePayload: HungerboxCronState = {
      lastRunDate: kolkataDateStr,
      lastSyncedToDate: toDate,
      lastRunTimestamp: new Date().toISOString(),
      totalOrdersSynced: syncResult.totalOrders,
      totalSalesSynced: syncResult.totalSales,
      sitesSynced: syncResult.dailyAggregates.map((a) => a.siteId),
      status: 'success',
    };

    try {
      await setDoc(doc(db, AUTOMATION_STATE_DOC, AUTOMATION_STATE_KEY), statePayload, { merge: true });
    } catch (e: any) {
      console.warn('[HungerBoxCron] Failed to save state to Firestore:', e.message);
    }

    // 5. Audit Log into Turso
    try {
      await createAuditLog({
        userId: 'system:cron',
        userEmail: 'system:cron-daily-8am',
        action: 'Daily Automated HungerBox Sync (8:00 AM IST)',
        details: JSON.stringify({
          kolkataTime: `${kolkataDateStr} ${kolkataTimeStr} IST`,
          fromDate,
          toDate,
          totalSales: syncResult.totalSales,
          totalOrders: syncResult.totalOrders,
          daysProcessed: syncResult.feedResults.length,
          elapsedMs,
        }),
        orgId: 'default',
        ipAddress: req.headers.get('x-forwarded-for') || 'cron-scheduler',
      });
    } catch (e: any) {
      console.warn('[HungerBoxCron] Failed to record audit log:', e.message);
    }

    return NextResponse.json({
      success: true,
      message: `Daily automated HungerBox sync completed successfully. Synced data through ${toDate}.`,
      dateIST: kolkataDateStr,
      timeIST: kolkataTimeStr,
      targetRange: {
        from: fromDate,
        to: toDate,
      },
      summary: {
        totalSales: syncResult.totalSales,
        totalOrders: syncResult.totalOrders,
        mrpSales: syncResult.totalMrpSales,
        nonMrpSales: syncResult.totalNonMrpSales,
        dailyRecordsUpdated: syncResult.feedResults.length,
      },
      feedResults: syncResult.feedResults,
      elapsedMs,
    });
  } catch (err: any) {
    console.error('[HungerBoxCron] Critical error in automated sync:', err);

    // Save error state
    try {
      await setDoc(
        doc(db, AUTOMATION_STATE_DOC, AUTOMATION_STATE_KEY),
        {
          lastRunTimestamp: new Date().toISOString(),
          status: 'error',
          errorMessage: err.message || 'Unknown error',
        },
        { merge: true }
      );
    } catch {}

    return NextResponse.json(
      {
        success: false,
        error: err.message || 'Daily HungerBox automated sync failed',
      },
      { status: 500 }
    );
  }
}
