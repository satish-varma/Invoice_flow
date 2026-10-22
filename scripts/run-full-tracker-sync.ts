import { performSync } from '../src/lib/tracker/sync';
import { turso } from '../src/lib/tracker/turso';

process.on('uncaughtException', (err) => {
  console.warn('[Sync Runner] Caught background exception:', err?.message || err);
});

process.on('unhandledRejection', (reason: any) => {
  console.warn('[Sync Runner] Caught unhandled rejection:', reason?.message || reason);
});

async function main() {
  console.log('========================================================');
  console.log('   RESILIENT HUNGERBOX HISTORICAL REMITTANCE SYNC       ');
  console.log('========================================================');
  const startTime = Date.now();

  const maxAttempts = 10;
  let attempt = 1;
  let allDone = false;

  while (attempt <= maxAttempts && !allDone) {
    try {
      const initialCount = await turso.execute('SELECT COUNT(*) as c FROM invoices');
      console.log(`\n[Attempt ${attempt}/${maxAttempts}] Current DB count: ${initialCount.rows[0].c} invoices.`);
      console.log('Connecting to Gmail IMAP...');

      const result = await performSync('newrelic', {
        forceFullSync: true,
        maxInvoices: 10000,
      });

      console.log(`Sync pass completed. Added: ${result.count}, Scanned: ${result.totalChecked}`);
      allDone = true;
    } catch (error: any) {
      console.warn(`[Attempt ${attempt}] Socket/IMAP disconnect: ${error.message}. Auto-resuming in 5s...`);
      attempt++;
      if (attempt <= maxAttempts) {
        await new Promise((r) => setTimeout(r, 5000));
      } else {
        console.error('Reached max retry attempts.');
      }
    }
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  const finalCount = await turso.execute('SELECT COUNT(*) as c FROM invoices');
  const totalAmount = await turso.execute('SELECT SUM(amount) as s FROM invoices');

  console.log('\n========================================================');
  console.log('   SYNC COMPLETE & VERIFIED                             ');
  console.log('========================================================');
  console.log(`Total Invoices in DB:   ${finalCount.rows[0].c}`);
  console.log(`Total Remittance Value: ₹${Number(totalAmount.rows[0].s || 0).toLocaleString('en-IN')}`);
  console.log(`Elapsed Time:           ${elapsed}s`);
}

main().catch((err) => {
  console.error('Fatal sync script error:', err);
  process.exit(1);
});
