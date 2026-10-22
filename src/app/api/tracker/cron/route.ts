import { NextResponse } from 'next/server';
import { performSync } from '@/lib/tracker/sync';
import { turso } from '@/lib/tracker/turso';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  console.log('[Cron] Starting auto-sync for tracker...');

  try {
    const result = await turso.execute('SELECT DISTINCT org_id FROM settings WHERE email_user IS NOT NULL AND email_user != ""');
    const orgIds = result.rows.map((row) => row.org_id as string).filter(Boolean);

    if (orgIds.length === 0) {
      // Fallback to default
      orgIds.push('default-org');
    }

    const results = [];
    for (const orgId of orgIds) {
      try {
        console.log(`[Cron] Syncing Org: ${orgId}`);
        const syncResult = await performSync(orgId);
        results.push({ orgId, success: true, count: syncResult.count });
      } catch (error: any) {
        console.error(`[Cron] Failed to sync Org ${orgId}:`, error.message);
        results.push({ orgId, success: false, error: error.message });
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Auto-sync completed',
      summary: results,
    });
  } catch (error: any) {
    console.error('[Cron] Critical error in auto-sync:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
