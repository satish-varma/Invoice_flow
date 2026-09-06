export interface ParsedItem {
  brandName?: string;
  itemName: string;
  quantity: number;
  expiry?: string;
}

export interface ParsedInvoiceData {
  brandName?: string;
  dcNumber?: string;
  date?: string;
  lineItems: ParsedItem[];
}

export const SAMPLE_INVOICES_LIST = [
  { name: 'Gut Guru - Mind Space 596.pdf', label: 'Gut Guru — Mind Space 596 (Unibic)' },
  { name: 'Gut Guru - Mind Space 597.pdf', label: 'Gut Guru — Mind Space 597 (Unibic)' },
  { name: 'Gut Guru - Mind Space 598.pdf', label: 'Gut Guru — Mind Space 598 (Unibic)' },
  { name: 'HMB8740-invoice (1).pdf', label: 'Healthy Master — HMB8740 Invoice' },
  { name: 'HMB8742-invoice.pdf', label: 'Healthy Master — HMB8742 Invoice' },
  { name: 'HMB8749-invoice.pdf', label: 'Healthy Master — HMB8749 Invoice' },
  { name: 'Proforma Invoice.pdf', label: 'Proforma Invoice' },
  { name: 'THE GUT GURU_CVR 0926 82_05-09-2026_Original.pdf', label: 'The Gut Guru — CVR 82' },
  { name: 'THE GUT GURU_CVR 0926 83_05-09-2026_Original.pdf', label: 'The Gut Guru — CVR 83' },
  { name: 'WhatsApp Image 2026-09-05 at 18.27.55.jpeg', label: 'Gut Guru — Photo Invoice 1' },
  { name: 'WhatsApp Image 2026-09-05 at 18.28.27.jpeg', label: 'Gut Guru — Photo Invoice 2' },
  { name: 'WhatsApp Image 2026-09-05 at 18.29.03.jpeg', label: 'Gut Guru — Photo Invoice 3' },
  { name: 'WhatsApp Image 2026-09-05 at 18.29.24.jpeg', label: 'Gut Guru — Photo Invoice 4' },
];

export async function fileToDataUri(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(file);
  });
}

export async function parseInvoiceDataUri(fileDataUri: string, fileName?: string): Promise<ParsedInvoiceData> {
  const res = await fetch('/api/newrelic/parse-invoice', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fileDataUri, fileName }),
  });

  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.error || 'Failed to parse invoice');
  }

  return json.data as ParsedInvoiceData;
}

export async function parseUploadedInvoiceFile(file: File): Promise<ParsedInvoiceData> {
  const dataUri = await fileToDataUri(file);

  if (file.type.startsWith('image/') || /\.(png|jpe?g|webp)$/i.test(file.name)) {
    try {
      const { createWorker } = await import('tesseract.js');
      const worker = await createWorker('eng');
      const ret = await worker.recognize(file);
      await worker.terminate();

      const ocrText = ret.data?.text || '';
      if (ocrText.trim()) {
        const res = await fetch('/api/newrelic/parse-invoice', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fileDataUri: dataUri, fileName: file.name, ocrText }),
        });

        const json = await res.json();
        if (res.ok && json.success && json.data?.lineItems?.length > 0) {
          return json.data as ParsedInvoiceData;
        }
      }
    } catch (err) {
      console.warn('Client-side image OCR error:', err);
    }
  }

  return parseInvoiceDataUri(dataUri, file.name);
}

export async function parseSampleInvoice(sampleFileName: string): Promise<ParsedInvoiceData> {
  const fileUrl = `/newrelic_invoices/${encodeURIComponent(sampleFileName)}`;
  const res = await fetch(fileUrl);
  if (!res.ok) {
    throw new Error(`Failed to load sample file ${sampleFileName}`);
  }

  const blob = await res.blob();
  const file = new File([blob], sampleFileName, { type: blob.type || 'application/pdf' });
  const dataUri = await fileToDataUri(file);
  return parseInvoiceDataUri(dataUri, `sample_preset_${sampleFileName}`);
}
