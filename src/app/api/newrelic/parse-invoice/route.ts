import { NextRequest, NextResponse } from 'next/server';
import { parseInvoiceBufferLocally } from '@/services/localInvoiceParserServer';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { fileDataUri, fileName, ocrText } = body;

    if (ocrText && typeof ocrText === 'string' && ocrText.trim()) {
      const { extractDataFromText } = await import('@/services/localInvoiceParserServer');
      const parsedFromOcr = extractDataFromText(ocrText, fileName || '');
      if (parsedFromOcr.lineItems.length > 0) {
        return NextResponse.json({
          success: true,
          data: parsedFromOcr,
        });
      }
    }

    if (!fileDataUri || typeof fileDataUri !== 'string') {
      return NextResponse.json(
        { error: 'Missing or invalid fileDataUri parameter.' },
        { status: 400 }
      );
    }

    // Extract mime type and base64 string
    const matches = fileDataUri.match(/^data:([^;]+);base64,(.+)$/);
    let mimeType = 'application/pdf';
    let base64Data = fileDataUri;

    if (matches && matches.length === 3) {
      mimeType = matches[1];
      base64Data = matches[2];
    }

    const buffer = Buffer.from(base64Data, 'base64');

    // Parse completely locally without external AI APIs
    const result = await parseInvoiceBufferLocally(buffer, mimeType, fileName || '');

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Local invoice parsing API error:', error);
    const msg = error instanceof Error ? error.message : 'Failed to parse invoice locally';
    return NextResponse.json(
      { error: msg },
      { status: 500 }
    );
  }
}
