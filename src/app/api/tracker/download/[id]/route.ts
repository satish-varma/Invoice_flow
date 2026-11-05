import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getInvoiceById } from '@/lib/tracker/turso';
import { isR2Configured, getR2SignedUrl, getFromR2 } from '@/lib/tracker/r2';
import fs from 'fs';
import path from 'path';

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

  try {
    const invoice = await getInvoiceById(id, orgId);
    if (!invoice || !invoice.pdfPath) {
      return NextResponse.json({ error: 'Invoice or PDF not found' }, { status: 404 });
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
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
      if (assignedLocations.length > 0) {
        const locSet = new Set(assignedLocations.map((l: string) => l.trim().toLowerCase()));
        if (!invoice.location || !locSet.has(invoice.location.trim().toLowerCase())) {
          return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }
      }
      if (assignedStalls.length > 0) {
        const stallSet = new Set(assignedStalls.map((s: string) => s.trim().toLowerCase()));
        if (!invoice.stall || !stallSet.has(invoice.stall.trim().toLowerCase())) {
          return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }
      }
    }

    if (invoice.pdfPath.startsWith('r2://')) {
      const r2Key = invoice.pdfPath.replace('r2://', '');
      if (isR2Configured()) {
        const signedUrl = await getR2SignedUrl(r2Key, 3600);
        return NextResponse.redirect(signedUrl);
      }
    }

    // Local file fallback
    const localRelPath = invoice.pdfPath.replace(/^\//, '');
    const localFullPath = path.join(process.cwd(), 'public', localRelPath);

    if (fs.existsSync(localFullPath)) {
      const fileBuffer = fs.readFileSync(localFullPath);
      return new NextResponse(fileBuffer, {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `inline; filename="${id}.pdf"`,
        },
      });
    }

    return NextResponse.json({ error: 'PDF file not found on storage' }, { status: 404 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
