import imap from 'imap-simple';
import { getInvoices, createInvoice, getSettings } from './turso';
import { uploadToR2, getInvoicePdfKey, isR2Configured } from './r2';
import { Invoice } from './types';
import { extractStallAndLocation } from './parser';
import fs from 'fs';
import path from 'path';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const PDFParser = require('pdf2json');

export async function performSync(
  organizationId: string,
  options: {
    forceFullSync?: boolean;
    maxInvoices?: number;
    signal?: AbortSignal;
  } = {}
) {
  const settings = await getSettings(organizationId);

  // Determine credential source: User Settings OR Environment Fallback
  const emailUser = settings.emailUser || process.env.EMAIL_USER;
  const emailPass = settings.emailPassword || process.env.EMAIL_PASSWORD;

  if (!emailUser || !emailPass) {
    throw new Error('Missing email credentials. Please configure IMAP user & password in Tracker Settings.');
  }

  console.log(`[Sync] Connecting with email: ${emailUser.substring(0, 5)}...`);

  const config = {
    imap: {
      user: emailUser,
      password: emailPass,
      host: 'imap.gmail.com',
      port: 993,
      tls: true,
      authTimeout: 30000,
      connTimeout: 30000,
      tlsOptions: { rejectUnauthorized: false },
    },
  };

  if (!config.imap.user || !config.imap.password || config.imap.user.startsWith('your-email')) {
    throw new Error('Email credentials not set properly.');
  }

  /* eslint-disable @typescript-eslint/no-explicit-any */
  let connection: any;
  try {
    connection = await imap.connect(config);
    connection.on('error', (err: any) => {
      console.warn(`[Sync:${organizationId}] Socket warning/error:`, err?.message || err);
    });
    if (options.signal?.aborted) throw new Error('Aborted');

    try {
      await connection.openBox('Invoices');
      console.log(`[Sync:${organizationId}] Opened 'Invoices' mailbox`);
    } catch {
      console.log(`[Sync:${organizationId}] 'Invoices' mailbox not found, falling back to INBOX`);
      await connection.openBox('INBOX');
    }

    const searchTerm = settings.emailSearchTerm || 'TheGutGuru';
    const lookbackDate = new Date();
    const lookbackDays = options.forceFullSync ? 3650 : Math.min(settings.syncLookbackDays || 30, 7);
    lookbackDate.setDate(lookbackDate.getDate() - lookbackDays);

    console.log(`[Sync:${organizationId}] Search Term: "${searchTerm}", Since: ${lookbackDate.toISOString()}`);

    const existingInvoices = await getInvoices(organizationId);
    const existingIds = new Set(existingInvoices.map((inv) => inv.id));
    const existingSettlementIds = new Set(
      existingInvoices
        .map((inv) => {
          const m = inv.id.match(/^INV-([0-9]+)_/i);
          return m ? m[1] : null;
        })
        .filter(Boolean) as string[]
    );
    console.log(`[Sync:${organizationId}] Indexed ${existingIds.size} existing invoices (${existingSettlementIds.size} unique settlements) for fast skipping.`);

    let searchCriteria: any[] = [
      ['TEXT', searchTerm],
      ['SINCE', lookbackDate],
    ];

    if (existingInvoices.length === 0 || options.forceFullSync) {
      console.log(`[Sync:${organizationId}] Full sync or first run. Fetching matching emails by TEXT...`);
      searchCriteria = [['TEXT', searchTerm]];
    }

    const fetchOptions = {
      bodies: ['HEADER'],
      struct: true,
      markSeen: false,
    };

    console.log(`[Sync:${organizationId}] Searching emails with criteria:`, JSON.stringify(searchCriteria));

    const allMessages = await connection.search(searchCriteria, fetchOptions);
    if (options.signal?.aborted) throw new Error('Aborted');

    // Sort by UID descending (newest first)
    const messages = allMessages.sort(
      (a: any, b: any) => (b.attributes?.uid || 0) - (a.attributes?.uid || 0)
    );

    console.log(`[Sync:${organizationId}] Found ${allMessages.length} total messages to scan.`);

    const addedInvoices: Invoice[] = [];
    const MAX_NEW_INVOICES = options.maxInvoices || (options.forceFullSync ? 5000 : (process.env.VERCEL === '1' ? 10 : 100));
    let processedCount = 0;

    for (const message of messages) {
      if (addedInvoices.length >= MAX_NEW_INVOICES) {
        console.log(`[Sync:${organizationId}] Reached limit of ${MAX_NEW_INVOICES} new invoices.`);
        break;
      }

      processedCount++;
      if (processedCount % 100 === 0 || processedCount === messages.length) {
        console.log(`[Sync:${organizationId}] Progress: Scanned ${processedCount}/${messages.length} messages... Added ${addedInvoices.length} new invoices.`);
      }
      if (options.signal?.aborted) {
        console.log(`[Sync:${organizationId}] Sync aborted`);
        break;
      }
      if (!message.attributes || !message.attributes.struct) continue;

      const parts = imap.getParts(message.attributes.struct!);
      const attachments = parts.filter(
        (part) =>
          (part.disposition && part.disposition.type.toUpperCase() === 'ATTACHMENT') ||
          (part.params && part.params.name && part.params.name.toLowerCase().endsWith('.pdf'))
      );

      if (attachments.length === 0) {
        continue;
      }

      for (const attachment of attachments) {
        if (options.signal?.aborted) break;

        const fileName = attachment.params?.name || '';
        if (fileName.includes('commission_invoice')) continue;
        if (!fileName.toLowerCase().endsWith('.pdf')) continue;

        // FAST SKIP: Check settlement ID directly from filename BEFORE downloading part data or parsing PDF
        const settMatch = fileName.match(/^([0-9]+)_payment_advice/i);
        if (settMatch && existingSettlementIds.has(settMatch[1])) {
          continue;
        }

        console.log(`[Sync:${organizationId}] Downloading & processing NEW attachment: ${fileName}...`);
        const partData = await connection.getPartData(message, attachment);
        if (options.signal?.aborted) break;

        let text = '';
        try {
          text = await new Promise((resolve, reject) => {
            const pdfParser = new PDFParser(null, 1);
            pdfParser.on('pdfParser_dataError', (errData: any) => reject(errData.parserError));
            pdfParser.on('pdfParser_dataReady', () => {
              resolve(pdfParser.getRawTextContent());
            });
            pdfParser.parseBuffer(partData);
          });
        } catch (err) {
          console.error(`Failed to parse PDF ${fileName}:`, err);
          continue;
        }

        // Regex for amount
        const amountMatch = text.match(/Net\s+Payable\s+Amount[\s:]*([0-9,]+\.?\d*)/i);
        const amount = amountMatch ? parseFloat(amountMatch[1].replace(/,/g, '')) : 0;

        const dateMatch = text.match(/Raised On\s*:\s*(\d{4}-\d{2}-\d{2})/i);
        const date = dateMatch ? dateMatch[1] : new Date().toISOString().split('T')[0];

        const extracted = extractStallAndLocation(fileName, text);
        const stall = extracted.stall;
        const location = extracted.location;

        const dateRangeMatch = text.match(
          /For the Date Range\s*:?[\s]*(\d{4}-\d{2}-\d{2})[\s\S]*?to[\s\S]*?(\d{4}-\d{2}-\d{2})/i
        );
        let serviceDateRange = '';
        if (dateRangeMatch) {
          serviceDateRange = `${dateRangeMatch[1]} to ${dateRangeMatch[2]}`;
        } else if (extracted.serviceDateRange) {
          serviceDateRange = extracted.serviceDateRange;
        }

        if (amount > 0) {
          const uniqueId = `INV-${fileName.split('.')[0]}-${amount}`;

          if (existingIds.has(uniqueId)) {
            continue;
          }

          let pdfPath: string | null = null;

          if (isR2Configured()) {
            try {
              const r2Key = getInvoicePdfKey(uniqueId);
              await uploadToR2(r2Key, partData);
              pdfPath = `r2://${r2Key}`;
              console.log(`[Sync] PDF uploaded to R2: ${r2Key}`);
            } catch (err) {
              console.error('[Sync] Failed to upload PDF to R2:', err);
            }
          }

          if (!pdfPath) {
            try {
              const isServerless = process.env.VERCEL === '1';
              if (!isServerless) {
                const uploadDir = path.join(process.cwd(), 'public', 'documents');
                if (!fs.existsSync(uploadDir)) {
                  fs.mkdirSync(uploadDir, { recursive: true });
                }
                const filePath = path.join(uploadDir, `${uniqueId}.pdf`);
                fs.writeFileSync(filePath, partData);
                pdfPath = `/documents/${uniqueId}.pdf`;
              }
            } catch (err) {
              console.warn('[Sync] Could not save PDF locally:', err);
            }
          }

          await createInvoice({
            id: uniqueId,
            date,
            serviceDateRange,
            location,
            stall,
            amount,
            status: 'Pending',
            pdfPath: pdfPath || undefined,
            syncedAt: new Date().toISOString(),
            orgId: organizationId,
          });

          addedInvoices.push({
            id: uniqueId,
            date,
            location,
            stall,
            amount,
            status: 'Pending',
            serviceDateRange,
            pdfUrl: pdfPath ? (pdfPath.startsWith('r2://') ? `/api/tracker/download/${uniqueId}` : pdfPath) : undefined,
          });

          existingIds.add(uniqueId);
          if (settMatch) {
            existingSettlementIds.add(settMatch[1]);
          }
          console.log(`[Sync:${organizationId}] Saved new invoice #${addedInvoices.length} (${uniqueId}) - ₹${amount.toLocaleString('en-IN')}`);
        }
      }
    }

    if (connection) connection.end();

    return {
      success: true,
      count: addedInvoices.length,
      totalChecked: processedCount,
      newHighWatermark: new Date().toISOString(),
      data: addedInvoices,
      message:
        addedInvoices.length > 0
          ? `Successfully synced ${addedInvoices.length} new invoices (scanned ${processedCount} emails)`
          : `No new unique invoices found (scanned ${processedCount} emails)`,
    };
  } catch (error: any) {
    if (connection) connection.end();
    console.error(`[Sync:${organizationId}] Failed:`, error);
    throw error;
  }
}
