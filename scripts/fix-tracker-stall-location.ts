import { turso } from '../src/lib/tracker/turso';
import { extractStallAndLocation, isGarbageText } from '../src/lib/tracker/parser';

async function migrate() {
  console.log('========================================================');
  console.log('   MIGRATING & NORMALIZING TRACKER STALL & LOCATION     ');
  console.log('========================================================');

  const rs = await turso.execute('SELECT id, stall, location, service_date_range FROM invoices');
  console.log(`Found ${rs.rows.length} total invoices in database.`);

  let updatedCount = 0;
  const locationBreakdown = new Map<string, Set<string>>();

  for (const row of rs.rows) {
    const id = String(row.id);
    const existingStall = row.stall ? String(row.stall) : '';
    const existingLoc = row.location ? String(row.location) : '';
    const existingService = row.service_date_range ? String(row.service_date_range) : '';

    const parsed = extractStallAndLocation(id, undefined, existingStall, existingLoc);

    const needStallUpdate = isGarbageText(existingStall) || existingStall !== parsed.stall;
    const needLocUpdate = isGarbageText(existingLoc) || existingLoc !== parsed.location;
    const needServiceUpdate = !existingService && !!parsed.serviceDateRange;

    if (needStallUpdate || needLocUpdate || needServiceUpdate) {
      const finalStall = parsed.stall;
      const finalLoc = parsed.location;
      const finalService = existingService || parsed.serviceDateRange || null;

      await turso.execute({
        sql: 'UPDATE invoices SET stall = ?, location = ?, service_date_range = ? WHERE id = ?',
        args: [finalStall, finalLoc, finalService, id],
      });
      updatedCount++;
    }

    if (!locationBreakdown.has(parsed.location)) {
      locationBreakdown.set(parsed.location, new Set());
    }
    locationBreakdown.get(parsed.location)!.add(parsed.stall);
  }

  console.log(`\nUpdated ${updatedCount} / ${rs.rows.length} invoices in database.`);
  console.log('\n--- VERIFIED LOCATIONS & STALLS ---');
  for (const [loc, stalls] of Array.from(locationBreakdown.entries()).sort()) {
    console.log(`\n📍 ${loc} (${stalls.size} stalls):`);
    for (const stall of Array.from(stalls).sort()) {
      console.log(`   - 🏪 ${stall}`);
    }
  }
  console.log('\n========================================================');
  console.log('   MIGRATION COMPLETED SUCCESSFULLY                     ');
  console.log('========================================================');
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
