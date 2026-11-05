import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getInvoices, deleteAllInvoices } from '@/lib/tracker/turso';
import { isInvoiceInScope } from '@/lib/tracker/scoping';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const orgId = searchParams.get('orgId') || 'default';

  try {
    let invoices = await getInvoices(orgId);

    const user = session.user as any;
    const isAdmin = user.role === 'admin' || user.role === 'superadmin';

    // Scoping for non-admin users (starting date, locations, stalls)
    if (!isAdmin) {
      const assignedStartDate: string | undefined | null = user.assignedStartDate;
      const assignedLocations: string[] =
        Array.isArray(user.assignedLocations) && user.assignedLocations.length > 0
          ? user.assignedLocations
          : Array.isArray(user.preferredLocations) &&
            user.preferredLocations.length > 0 &&
            !user.preferredLocations.every((l: string) => l === 'hyderabad' || l === 'bangalore')
          ? user.preferredLocations
          : [];
      const assignedStalls: string[] = Array.isArray(user.assignedStalls) ? user.assignedStalls : [];

      invoices = invoices.filter((inv) =>
        isInvoiceInScope(inv, {
          assignedStartDate,
          assignedLocations,
          assignedStalls,
        })
      );
    }

    const paidCount = invoices.filter((i) => i.status === 'Paid').length;
    const paidSum = invoices.filter((i) => i.status === 'Paid').reduce((s, i) => s + i.amount, 0);
    console.log(`[API Invoices] orgId: ${orgId}, total: ${invoices.length}, paidCount: ${paidCount}, paidSum: ₹${paidSum}`);
    return NextResponse.json(
      { success: true, data: invoices },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
          Pragma: 'no-cache',
          Expires: '0',
        },
      }
    );
  } catch (error: any) {
    console.error('[API Tracker Invoices] Failed to get invoices:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if ((session.user as any).role !== 'admin' && !(session.user as any).canDelete) {
    return NextResponse.json({ error: 'Forbidden: Insufficient delete privileges' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const orgId = searchParams.get('orgId') || 'default';

  try {
    await deleteAllInvoices(orgId);
    return NextResponse.json({ success: true, message: 'All invoices reset successfully' });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
