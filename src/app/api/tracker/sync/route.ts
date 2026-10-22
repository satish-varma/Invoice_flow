import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { performSync } from '@/lib/tracker/sync';
import { getInvoices, createAuditLog } from '@/lib/tracker/turso';
import { headers } from 'next/headers';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const orgId = searchParams.get('orgId') || 'default';

  try {
    const invoices = await getInvoices(orgId);
    return NextResponse.json({ success: true, data: invoices });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const role = (session.user as any).role;
  if (role !== 'admin' && role !== 'manager' && role !== 'staff') {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const orgId = searchParams.get('orgId') || 'default';
  const forceFullSync = searchParams.get('full') === 'true';
  const maxInvoices = searchParams.get('max') ? parseInt(searchParams.get('max')!, 10) : undefined;

  try {
    const result = await performSync(orgId, {
      forceFullSync,
      maxInvoices,
      signal: request.signal,
    });

    const headerList = await headers();
    const ip = headerList.get('x-forwarded-for') || headerList.get('x-real-ip') || 'unknown';

    await createAuditLog({
      userId: (session.user as any).id,
      userEmail: session.user.email,
      action: forceFullSync ? 'Triggered Full Sync' : 'Triggered Quick Sync',
      details: JSON.stringify({
        success: result.success,
        count: result.count,
        totalChecked: result.totalChecked,
      }),
      orgId,
      ipAddress: ip,
    });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('[Sync API] Sync failed:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Unknown error' },
      { status: 500 }
    );
  }
}
