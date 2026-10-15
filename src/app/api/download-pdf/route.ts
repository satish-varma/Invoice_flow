import { NextRequest, NextResponse } from 'next/server';

// Temporary in-memory cache for generated PDFs (auto-expires after 10 minutes)
interface CachedPdf {
  buffer: Buffer;
  filename: string;
  createdAt: number;
}

const pdfCache = new Map<string, CachedPdf>();

// Periodically clean up entries older than 10 minutes
function cleanOldEntries() {
  const now = Date.now();
  for (const [id, entry] of pdfCache.entries()) {
    if (now - entry.createdAt > 10 * 60 * 1000) {
      pdfCache.delete(id);
    }
  }
}

/**
 * POST /api/download-pdf
 * Body: { pdfBase64: string, filename: string }
 * Returns: { id: string, downloadUrl: string, viewUrl: string }
 */
export async function POST(req: NextRequest) {
  try {
    cleanOldEntries();
    const body = await req.json();
    const { pdfBase64, filename = 'challan.pdf' } = body;

    if (!pdfBase64) {
      return NextResponse.json({ error: 'Missing pdfBase64 data' }, { status: 400 });
    }

    const cleanBase64 = pdfBase64.replace(/^data:application\/pdf;base64,/, '');
    const buffer = Buffer.from(cleanBase64, 'base64');

    const id = `pdf_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const safeFilename = filename.replace(/[/\\?%*:|"<>#]/g, '-').replace(/\s+/g, '_');
    const finalFilename = safeFilename.toLowerCase().endsWith('.pdf') ? safeFilename : `${safeFilename}.pdf`;

    pdfCache.set(id, {
      buffer,
      filename: finalFilename,
      createdAt: Date.now(),
    });

    const forwardedHost = req.headers.get('x-forwarded-host');
    const hostHeader = req.headers.get('host') || '';
    let host = forwardedHost || hostHeader;

    // Cloud Run internal host returns 403 when called directly from client browsers.
    // Ensure public domain is always used in Firebase App Hosting.
    if (host.includes('.run.app')) {
      host = 'studio--invoiceflow-24nxt.us-central1.hosted.app';
    }

    const protocol = req.headers.get('x-forwarded-proto') || 'https';
    const baseUrl = host ? `${protocol}://${host}` : '';

    return NextResponse.json({
      success: true,
      id,
      downloadUrl: `${baseUrl}/api/download-pdf?id=${id}&download=true`,
      viewUrl: `${baseUrl}/api/download-pdf?id=${id}`,
    });
  } catch (error) {
    console.error('Error caching PDF for download:', error);
    return NextResponse.json({ error: 'Internal server error caching PDF' }, { status: 500 });
  }
}

/**
 * GET /api/download-pdf?id=...&download=true
 * Streams the cached PDF buffer with standard HTTP headers that trigger Android's native DownloadManager.
 */
export async function GET(req: NextRequest) {
  try {
    cleanOldEntries();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    const isDownload = searchParams.get('download') === 'true';

    if (!id || !pdfCache.has(id)) {
      return new NextResponse('PDF link has expired or is invalid. Please generate the PDF again.', {
        status: 404,
        headers: { 'Content-Type': 'text/plain' },
      });
    }

    const cached = pdfCache.get(id)!;
    const disposition = isDownload ? 'attachment' : 'inline';

    return new NextResponse(cached.buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `${disposition}; filename="${cached.filename}"`,
        'Content-Length': cached.buffer.length.toString(),
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    });
  } catch (error) {
    console.error('Error streaming PDF download:', error);
    return new NextResponse('Error downloading PDF', { status: 500 });
  }
}
