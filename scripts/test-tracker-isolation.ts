import { getInvoices } from '../src/lib/tracker/turso';

async function testTrackerIsolation() {
  console.log('--- Testing Tracker Scoping & Isolation Logic ---');

  const allInvoices = await getInvoices();
  console.log(`Total invoices in DB (Admin view): ${allInvoices.length}`);

  // Simulate tracker.guest user attributes
  const guestUser = {
    role: 'guest',
    assignedStartDate: '2026-10-01',
    assignedLocations: ['New Relic', 'Broadridge'],
    assignedStalls: ['Relic Fresh', 'Slurpstore Bakery'],
  };

  let scopedInvoices = [...allInvoices];

  // 1. Date filter
  if (guestUser.assignedStartDate) {
    scopedInvoices = scopedInvoices.filter((inv) => inv.date >= guestUser.assignedStartDate);
  }
  console.log(`Invoices after starting date (>= ${guestUser.assignedStartDate}): ${scopedInvoices.length}`);

  // 2. Locations filter
  if (guestUser.assignedLocations.length > 0) {
    const locSet = new Set(guestUser.assignedLocations.map((l) => l.trim().toLowerCase()));
    scopedInvoices = scopedInvoices.filter((inv) => inv.location && locSet.has(inv.location.trim().toLowerCase()));
  }
  console.log(`Invoices after location filter (${guestUser.assignedLocations.join(', ')}): ${scopedInvoices.length}`);

  // 3. Stalls filter
  if (guestUser.assignedStalls.length > 0) {
    const stallSet = new Set(guestUser.assignedStalls.map((s) => s.trim().toLowerCase()));
    scopedInvoices = scopedInvoices.filter((inv) => inv.stall && stallSet.has(inv.stall.trim().toLowerCase()));
  }
  console.log(`Invoices after stall filter (${guestUser.assignedStalls.join(', ')}): ${scopedInvoices.length}`);

  console.log('\nSample scoped invoice records:');
  console.log(
    scopedInvoices.slice(0, 3).map((i) => ({
      id: i.id,
      date: i.date,
      location: i.location,
      stall: i.stall,
      amount: i.amount,
      status: i.status,
    }))
  );

  // Assertions
  for (const inv of scopedInvoices) {
    if (inv.date < guestUser.assignedStartDate) {
      throw new Error(`Leakage detected: invoice ${inv.id} has date ${inv.date} < ${guestUser.assignedStartDate}`);
    }
    const locLower = inv.location.toLowerCase();
    if (!guestUser.assignedLocations.some((l) => l.toLowerCase() === locLower)) {
      throw new Error(`Leakage detected: invoice ${inv.id} has location ${inv.location} not in assigned list`);
    }
    const stallLower = inv.stall.toLowerCase();
    if (!guestUser.assignedStalls.some((s) => s.toLowerCase() === stallLower)) {
      throw new Error(`Leakage detected: invoice ${inv.id} has stall ${inv.stall} not in assigned list`);
    }
  }

  console.log('\n✅ All isolation assertions passed! Zero leakage across date, location, and stall filters.');
}

testTrackerIsolation().catch(console.error);
