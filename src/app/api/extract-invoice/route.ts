import { NextRequest, NextResponse } from 'next/server';
import { extractText } from 'unpdf';
import { parseInvoiceText } from '@/ai/flows/extract-invoice-flow';

export async function POST(req: NextRequest) {
  try {
    const { photoDataUri } = await req.json();
    if (!photoDataUri) {
      return NextResponse.json({ success: false, error: "No file uploaded." }, { status: 400 });
    }

    const match = photoDataUri.match(/^data:([^;]+);base64,(.+)$/);
    if (!match) {
      return NextResponse.json({ success: false, error: "Invalid file format." }, { status: 400 });
    }

    const mimeType = match[1];
    const base64Data = match[2];

    if (mimeType !== 'application/pdf') {
      return NextResponse.json({ success: false, error: "Only text-based PDF files are supported." }, { status: 400 });
    }

    const buffer = Buffer.from(base64Data, 'base64');
    const uint8Array = new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
    
    // Extract text from the PDF using unpdf (requires Uint8Array)
    const { text } = await extractText(uint8Array);

    if (!text || !text.trim()) {
      return NextResponse.json({ success: false, error: "The PDF document does not contain extractable text." }, { status: 400 });
    }

    // Parse the extracted text
    const result = parseInvoiceText(text);

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error("API PDF parsing error:", error);
    const errMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ success: false, error: `Failed to parse PDF: ${errMessage}` }, { status: 500 });
  }
}
