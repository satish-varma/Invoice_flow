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
