import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getHungerBoxSales, createHungerBoxSale } from '@/lib/tracker/turso';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const orgId = searchParams.get('orgId') || 'default';
  const limit = parseInt(searchParams.get('limit') || '100', 10);

  try {
    const sales = await getHungerBoxSales(orgId, limit);
    return NextResponse.json({ success: true, data: sales });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const orgId = searchParams.get('orgId') || 'default';

  try {
    const body = await request.json();
    await createHungerBoxSale({
      ...body,
      orgId,
    });
    return NextResponse.json({ success: true, message: 'Sale recorded' });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
