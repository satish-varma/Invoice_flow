import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getInvoiceById, updateInvoiceStatus } from '@/lib/tracker/turso';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const orgId = searchParams.get('orgId') || 'default';

  const user = session.user as any;
  if (user.role === 'guest') {
    return NextResponse.json({ error: 'Forbidden: Read-only access' }, { status: 403 });
  }

  try {
    const invoice = await getInvoiceById(id, orgId);
    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    const user = session.user as any;
    const isAdmin = user.role === 'admin' || user.role === 'superadmin';

    // Scoping for non-admin users
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

      if (assignedStartDate && invoice.date && invoice.date < assignedStartDate) {
        return NextResponse.json({ error: 'Invoice outside permitted date range' }, { status: 403 });
      }
      if (assignedLocations.length > 0) {
        const locSet = new Set(assignedLocations.map((l: string) => l.trim().toLowerCase()));
        if (!invoice.location || !locSet.has(invoice.location.trim().toLowerCase())) {
          return NextResponse.json({ error: 'Invoice outside permitted locations' }, { status: 403 });
        }
      }
      if (assignedStalls.length > 0) {
        const stallSet = new Set(assignedStalls.map((s: string) => s.trim().toLowerCase()));
        if (!invoice.stall || !stallSet.has(invoice.stall.trim().toLowerCase())) {
          return NextResponse.json({ error: 'Invoice outside permitted stalls' }, { status: 403 });
        }
      }
    }

    return NextResponse.json({ success: true, data: invoice });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const orgId = searchParams.get('orgId') || 'default';

  const user = session.user as any;
  if (user.role === 'guest') {
    return NextResponse.json({ error: 'Forbidden: Read-only access' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { status } = body;
    if (!status) {
      return NextResponse.json({ error: 'Status is required' }, { status: 400 });
    }

    await updateInvoiceStatus(id, status, orgId);
    return NextResponse.json({ success: true, id, status });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
