'use server';
/**
 * @fileOverview An invoice data extraction local agent.
 *
 * - extractInvoiceData - A function that handles the invoice data extraction process locally.
 * - ExtractInvoiceDataInput - The input type for the extractInvoiceData function.
 * - ExtractInvoiceDataOutput - The return type for the extractInvoiceData function.
 */

import { z } from 'genkit';
import { PDFParse } from 'pdf-parse';

const LineItemSchema = z.object({
  name: z.string().describe('The name or description of the line item.'),
  unit: z.string().optional().describe('The unit of the line item (e.g., kg, pcs, box, service).'),
  quantity: z.number().describe('The quantity of the line item.'),
  unitPrice: z.number().describe('The unit price or rate of a single unit of the line item.'),
  hsnCode: z.string().optional().describe('The HSN or SAC code of the line item.'),
});

const ExtractInvoiceDataInputSchema = z.object({
  photoDataUri: z
    .string()
    .describe(
      "A photo of an invoice, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
});
export type ExtractInvoiceDataInput = z.infer<
  typeof ExtractInvoiceDataInputSchema
>;

const ExtractInvoiceDataOutputSchema = z.object({
  invoiceNumber: z.string().optional().describe('The invoice number.'),
  customerName: z.string().optional().describe('The name of the customer or who the invoice is billed to.'),
  date: z.string().optional().describe('The date of the invoice in YYYY-MM-DD format.'),
  serviceMonth: z.string().optional().describe('The service month, e.g., Apr-26.'),
  deliverTo: z.string().optional().describe('The name/address of the delivery target.'),
  lineItems: z.array(LineItemSchema).optional().describe('An array of line items from the invoice.'),
});
export type ExtractInvoiceDataOutput = z.infer<
  typeof ExtractInvoiceDataOutputSchema
>;

function formatDate(dateStr: string): string {
  const monthsMap: Record<string, string> = {
    jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
    jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
    january: '01', february: '02', march: '03', april: '04', june: '06',
    july: '07', august: '08', september: '09', october: '10', november: '11', december: '12'
  };

  const parts = dateStr.split(/[\s\/-]+/);
  if (parts.length === 3) {
    let day = '';
    let month = '';
    let year = '';

    if (parts[0].length === 4) {
      year = parts[0]; month = parts[1]; day = parts[2];
    } else {
      day = parts[0]; month = parts[1]; year = parts[2];
    }

    if (/^\d+$/.test(day) && /^\d+$/.test(year)) {
      if (isNaN(Number(month))) {
        month = monthsMap[month.toLowerCase()] || '01';
      }
      day = day.padStart(2, '0');
      month = month.padStart(2, '0');
      if (year.length === 2) year = '20' + year;

      const dNum = Number(day);
      const mNum = Number(month);
      const yNum = Number(year);
      if (dNum >= 1 && dNum <= 31 && mNum >= 1 && mNum <= 12 && yNum >= 2000 && yNum <= 2100) {
        return `${year}-${month}-${day}`;
      }
    }
  }

  try {
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const dayVal = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${dayVal}`;
    }
  } catch (e) {}

  return '';
}

function parseInvoiceText(text: string): ExtractInvoiceDataOutput {
  const rawLines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  const fullText = rawLines.join(' '); // for regex matching across line breaks

  let invoiceNumber = '';
  let customerName = '';
  let date = '';
  let serviceMonth = '';
  let deliverTo = '';
  const lineItems: any[] = [];

  // ── 1. Invoice Number ─────────────────────────────────────────────────────
  // Pre-join adjacent lines that start with '/' (continuation of split Ref# / Invoice No)
  const joinedLines: string[] = [];
  for (let i = 0; i < rawLines.length; i++) {
    if (rawLines[i].startsWith('/') && joinedLines.length > 0) {
      joinedLines[joinedLines.length - 1] += rawLines[i];
    } else {
      joinedLines.push(rawLines[i]);
    }
  }
  const joinedText = joinedLines.join(' ');

  // Handle "Ref# : TS/Apr-26/C113/L2820/1" (possibly joined from split lines)
  const refMatch = joinedText.match(/Ref#\s*[:#]?\s*([a-zA-Z0-9/_-]+)/i);
  if (refMatch && refMatch[1].length >= 3) {
    invoiceNumber = refMatch[1].trim();
  } else {
    const invNoPatterns = [
      /(?:Invoice\s*(?:No|Number|#)|Inv\s*(?:No|#)|Bill\s*(?:No|#))[\s\t]*[:#-]?[\s\t]*([a-zA-Z0-9/_-]+)/i,
      /Purchase\s*Order\s*#\s*([a-zA-Z0-9/_-]+)/i,
    ];
    for (const re of invNoPatterns) {
      const m = fullText.match(re);
      if (m && m[1] && m[1].length >= 3) {
        invoiceNumber = m[1].trim();
        break;
      }
    }
  }

  // ── 2. Invoice Date ───────────────────────────────────────────────────────
  const datePatterns = [
    /(?:Invoice\s*Date|Inv\s*Date)[\s\t]*[:.,-]?[\s\t]*(\d{4}-\d{2}-\d{2})/i,
    /(?:Invoice\s*Date|Inv\s*Date)[\s\t]*[:.,-]?[\s\t]*(\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4})/i,
    /(?:Date)[\s\t]*[:.,-]?[\s\t]*(\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4})/i,
    /\b(\d{4}-\d{2}-\d{2})\b/,
    /\b(\d{2}[-/]\d{2}[-/]\d{4})\b/,
  ];
  for (const re of datePatterns) {
    const m = text.match(re);
    if (m && m[1]) {
      const formatted = formatDate(m[1].trim());
      if (formatted) { date = formatted; break; }
    }
  }

  // ── 3. Customer / Bill-To Name, Service Month, Deliver To ─────────────────
  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i];

    // Service Month
    const smMatch = line.match(/^Service\s*Month\s*[:#-]?\s*(.+)/i);
    if (smMatch && !serviceMonth) {
      serviceMonth = smMatch[1].trim();
    }

    // Deliver To
    if (/^Deliver\s*To\b/i.test(line)) {
      if (i + 1 < rawLines.length) {
        deliverTo = rawLines[i + 1].trim();
        // optionally, append the next line if it looks like continuation
        if (i + 2 < rawLines.length && !/^(?:#|Item|Vendor|HSN)/i.test(rawLines[i + 2])) {
           deliverTo += '\n' + rawLines[i + 2].trim();
        }
      }
    }

    // Inline: "Bill To THE GUT GURU Invoice Date 2025-06-30"
    const billToInlineMatch = line.match(/^Bill\s*To\s+(.+?)(?:\s+Invoice\s+(?:Date|No)\b|$)/i);
    if (billToInlineMatch && /[a-zA-Z]{2,}/.test(billToInlineMatch[1]) && !customerName) {
      customerName = billToInlineMatch[1].trim();
      continue;
    }

    // Standard "Bill To:" / "Billed To:" label
    if (/^(?:Bill\s*To|Billed\s*To|Buyer|Client|Sold\s*To)\b/i.test(line) && !customerName) {
      const ci = line.indexOf(':');
      const after = ci !== -1 ? line.substring(ci + 1).trim() : '';
      if (after && /[a-zA-Z]/.test(after)) {
        customerName = after;
      } else if (i + 1 < rawLines.length && /[a-zA-Z]{3,}/.test(rawLines[i + 1]) && !/gstin|pan|cin|email|phone/i.test(rawLines[i + 1])) {
        customerName = rawLines[i + 1].trim();
      }
      continue;
    }

    // "Vendor Address" section: next line is the vendor/customer name (Hungerbox format)
    if (/^Vendor\s*Address\b/i.test(line) && !customerName) {
      if (i + 1 < rawLines.length && /[a-zA-Z]{2,}/.test(rawLines[i + 1])) {
        customerName = rawLines[i + 1].trim();
      }
      continue;
    }
  }

  // ── 4. Find items table section ───────────────────────────────────────────
  let itemSectionStart = 0;
  for (let i = 0; i < rawLines.length; i++) {
    if (/(?:#?\s*item\s*[&]\s*desc|description\s*hsn|hsn.*qty.*rate|qty.*rate.*amount)/i.test(rawLines[i])) {
      itemSectionStart = i + 1;
      break;
    }
    // Also detect when we see the HSN/SAC Qty Rate Amount header row
    if (/hsn[/\\]sac.*qty.*rate.*amount/i.test(rawLines[i])) {
      itemSectionStart = i + 1;
      break;
    }
  }

  const SKIP_LINE_RE = /^\s*(?:--\s*\d+\s*of|cgst|sgst|igst|tds|payment\s*terms|service\s*month|due\s*date|place\s*of|pan\s*:|gstin|cin\s*|email|phone|website|bank\s|ifsc|account\s*no|branch|authorized|beneficiary|words\s*rupee|this\s*is\s*computer|annexure|^si$|^sl$|^sr$|^no$|^code$|^base$|^gst$|^hsn|^sac|^counter$|^vendor$|^id$|^r$|^ssion\s*%|counte|deliver\s*to|purchase\s*order|^on\s*%|^commission|comission|hungerbox|items\s*in\s*total|sub\s*total|grand\s*total|total)/i;
  const SKIP_NAME_RE = /^(?:cgst|sgst|igst|tax|vat|tds|discount|sub\s*total|grand\s*total|balance\s*due|total\s*payable|round|sales\s*value|hungerbox|comission|items\s*in\s*total|total)/i;

  // Helper to distinguish data lines from text lines that just happen to contain a number
  const isDataLine = (str: string) => {
    const tokens = str.split(/\s+/);
    let numCount = 0;
    for (const t of tokens) {
      if (/^[\d,]+(\.\d+)?%?$/.test(t)) numCount++;
    }
    return numCount >= 2;
  };

  // ── 5. Stitch and parse line items (Multi-page safe) ───────────────────────
  const itemLines: string[] = [];
  for (let i = itemSectionStart; i < rawLines.length; i++) {
    const line = rawLines[i];
    if (SKIP_LINE_RE.test(line)) continue;
    // Skip repeated table headers
    if (/(?:#?\s*item\s*[&]\s*desc|description\s*hsn|hsn.*qty.*rate|qty.*rate.*amount)/i.test(line)) continue;

    const stripped = line.replace(/^\s*\d{1,3}[\s.)-]+(?=[a-zA-Z#])/, '').trim();
    if (!stripped) continue;
    const hasDigits = isDataLine(stripped);

    if (!hasDigits) {
      // Collect all text-only lines into a single item name until we hit a data line
      let accName = stripped;
      let j = i + 1;
      let foundData = false;

      while (j < rawLines.length) {
        let nextLine = rawLines[j];
        if (SKIP_LINE_RE.test(nextLine)) { j++; continue; }
        if (/(?:#?\s*item\s*[&]\s*desc|description\s*hsn|hsn.*qty.*rate|qty.*rate.*amount)/i.test(nextLine)) { j++; continue; }

        const nextStripped = nextLine.replace(/^\s*\d{1,3}[\s.)-]+(?=[a-zA-Z#])/, '').trim();
        if (isDataLine(nextStripped)) {
          // Data line found. Check for continuation of broken numeric lines (e.g. wrapped decimals)
          let dataStr = nextLine.trim();
          let k = j + 1;
          while (k < rawLines.length) {
            const lookahead = rawLines[k].trim();
            if (/^--\s*\d+\s*of/.test(lookahead)) {
               k++;
               if (k < rawLines.length && /^\d+$/.test(rawLines[k].trim())) k++;
               continue;
            }
            if (SKIP_LINE_RE.test(lookahead)) { k++; continue; }
            if (/^[\d.,%-\s]+$/.test(lookahead) && lookahead.length > 0) {
              dataStr += ' ' + lookahead;
              k++;
            } else {
              break;
            }
          }
          // Rejoin heavily wrapped decimals in all 3 known formats (e.g., "4798. 10", "4798 .10", "6731.1 2")
          dataStr = dataStr
            .replace(/\.\s+(\d+)/g, '.$1')
            .replace(/(\d)\s+\./g, '$1.')
            .replace(/(\.\d)\s+(\d)(?!\d)/g, '$1$2');
            
          itemLines.push(accName + ' ' + dataStr);
          i = k - 1;
          foundData = true;
          break;
        } else if (nextStripped) {
          accName += (accName.endsWith('-') ? '' : ' ') + nextStripped;
        }
        j++;
      }
      
      if (!foundData) break;
    } else {
      itemLines.push(line);
    }
  }

  for (let line of itemLines) {
    // Strip leading S.No
    line = line.replace(/^\s*\d{1,3}[\s.)-]+(?=[a-zA-Z#])/, '').trim();
    if (!line) continue;

    // Remove percentage tokens (e.g. "11%") — these are GST/commission rates, not item values
    const cleanedLine = line.replace(/\b\d+(\.\d+)?%\b/g, '').trim();

    const tokens = cleanedLine.split(/\s+/);
    if (tokens.length < 2) continue;

    const parsedNums = tokens.map((t, idx) => {
      const clean = t.replace(/,/g, '').replace(/^Rs\.?/i, '');
      const val = parseFloat(clean);
      return {
        str: t,
        val,
        isNum: !isNaN(val) && isFinite(val) && /^-?\d+(\.\d+)?$/.test(clean) && clean.length < 12,
        idx
      };
    });

    const numTokens = parsedNums.filter(n => n.isNum);
    if (numTokens.length < 1) continue;

    const firstNumIdx = numTokens[0].idx;
    // Extract name and strip any trailing percentage values (e.g. "11%", "18%") from the end
    const name = tokens.slice(0, firstNumIdx).join(' ').trim().replace(/\s+\d+(\.\d+)?%\s*$/g, '').trim();
    if (!name || !/[a-zA-Z]/.test(name)) continue;
    if (SKIP_NAME_RE.test(name)) continue;

    let quantity = 1;
    let unitPrice = 0;

    if (numTokens.length === 1) {
      unitPrice = numTokens[0].val;

    } else if (numTokens.length === 2) {
      const [n1, n2] = numTokens;
      if (Number.isInteger(n1.val) && n1.val >= 1 && n1.val <= 100000 && n2.val > 0) {
        quantity = n1.val;
        unitPrice = n2.val / n1.val;
        if (Math.abs(quantity * unitPrice - n2.val) > 0.01) { quantity = 1; unitPrice = n2.val; }
      } else {
        quantity = 1;
        unitPrice = n2.val;
      }

    } else {
      // 3+ numbers: try qty*rate≈total
      const last = numTokens[numTokens.length - 1];
      const first = numTokens[0];
      let foundQty = false;

      for (let i = 0; i <= numTokens.length - 3; i++) {
        const qN = numTokens[i];
        const rN = numTokens[i + 1];
        const product = qN.val * rN.val;
        if (last.val > 0 && Math.abs(product - last.val) / last.val <= 0.02) {
          quantity = qN.val;
          unitPrice = rN.val;
          foundQty = true;
          break;
        }
      }

      if (!foundQty) {
        // Fallback: HungerBox/GST format — use first number as base rate, qty=1
        quantity = 1;
        unitPrice = first.val;
      }
    }

    if (quantity <= 0 || unitPrice <= 0) continue;

    lineItems.push({ name, quantity, unitPrice });
  }

  const output: any = {};
  if (invoiceNumber) output.invoiceNumber = invoiceNumber;
  if (customerName) output.customerName = customerName;
  if (date) output.date = date;
  if (serviceMonth) output.serviceMonth = serviceMonth;
  if (deliverTo) output.deliverTo = deliverTo;
  if (lineItems.length > 0) output.lineItems = lineItems;
  return output;
}


export async function extractInvoiceData(
  input: ExtractInvoiceDataInput
): Promise<ExtractInvoiceDataOutput> {
  const { photoDataUri } = input;
  if (!photoDataUri) {
    throw new Error("No file uploaded.");
  }

  const match = photoDataUri.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) {
    throw new Error("Invalid file format.");
  }

  const mimeType = match[1];
  const base64Data = match[2];

  if (mimeType !== 'application/pdf') {
    throw new Error("Local autofill is only supported for text-based PDF files. Images are not supported locally.");
  }

  try {
    const buffer = Buffer.from(base64Data, 'base64');
    const parser = new PDFParse({ data: buffer });
    const parseResult = await parser.getText();
    const text = parseResult.text;
    await parser.destroy();

    console.log('[extractInvoiceData] PDF text extracted, length:', text?.length);
    console.log('[extractInvoiceData] First 800 chars:\n', text?.substring(0, 800));

    if (!text || !text.trim()) {
      throw new Error("The PDF document does not contain extractable text (it might be a scanned image-only PDF).");
    }

    const result = parseInvoiceText(text);
    console.log('[extractInvoiceData] Parsed result:', JSON.stringify(result, null, 2));
    return result;
  } catch (error) {
    console.error("Local PDF parsing error:", error);
    throw error instanceof Error ? error : new Error("Failed to parse the PDF document.");
  }
}
