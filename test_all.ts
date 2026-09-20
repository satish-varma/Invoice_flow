import fs from 'fs';
import path from 'path';
import pdfParse from 'pdf-parse';
import { extractDataFromText } from './src/services/localInvoiceParserServer';

async function main() {
  const dir = path.join(__dirname, 'public/newrelic_invoices');
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.pdf'));

  for (const file of files) {
    const p = path.join(dir, file);
    const buf = fs.readFileSync(p);
    const data = await pdfParse(buf);
    const text = data.text;
    const parsed = extractDataFromText(text, file);
    console.log(`\n=== File: ${file} ===`);
    console.log(`Brand: ${parsed.brandName}, DC: ${parsed.dcNumber}, Date: ${parsed.date}`);
    console.log(`Items found: ${parsed.lineItems.length}`);
    if (parsed.lineItems.length === 0) {
      console.log('--- OCR TEXT ---');
      console.log(text.substring(0, 500) + '...');
    }
  }
}
main().catch(console.error);
