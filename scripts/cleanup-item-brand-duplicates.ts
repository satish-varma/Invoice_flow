import { db } from '../src/lib/firebase';
import {
  collection,
  getDocs,
  doc,
  setDoc,
  deleteDoc,
  writeBatch,
} from 'firebase/firestore';
import { NewRelicLocation } from '../src/types/challan';
import { getPricingDocId } from '../src/services/newrelicPricingService';

function stripBrandPrefix(itemName: string, brandName: string): string {
  const b = brandName.trim().toLowerCase();
  const n = itemName.trim();
  if (n.toLowerCase().startsWith(b)) {
    const stripped = n.slice(b.length).replace(/^[\s\-:]+/, '').trim();
    if (stripped) return stripped;
  }
  return n;
}

async function main() {
  const isExecute = process.argv.includes('--execute');
  console.log('========================================================================');
  console.log(`🧹 Brand Prefix Cleanup Tool — Mode: ${isExecute ? '🚀 EXECUTE (LIVE WRITES)' : '🔍 DRY-RUN (PREVIEW ONLY)'}`);
  console.log('========================================================================\n');

  /* ──────────────────────────────────────────────────────────
   * 1. Check & Clean newrelic_pricing
   * ────────────────────────────────────────────────────────── */
  console.log('▶ Scanning collection: "newrelic_pricing"...');
  const pricingSnap = await getDocs(collection(db, 'newrelic_pricing'));
  console.log(`  Found ${pricingSnap.size} total pricing records.`);

  const pricingActions: Array<{
    oldId: string;
    newId: string;
    brand: string;
    oldItem: string;
    newItem: string;
    location: string;
    alreadyExists: boolean;
    data: any;
  }> = [];

  const existingPricingIds = new Set<string>();
  pricingSnap.forEach(d => existingPricingIds.add(d.id));

  pricingSnap.forEach(d => {
    const data = d.data();
    const brand = (data.brandName || '').trim();
    const item = (data.itemName || '').trim();
    const loc = data.location as NewRelicLocation;

    if (!brand || !item) return;

    const cleanedItem = stripBrandPrefix(item, brand);
    if (cleanedItem.toLowerCase() !== item.toLowerCase()) {
      const newId = getPricingDocId(brand, cleanedItem, loc);
      pricingActions.push({
        oldId: d.id,
        newId,
        brand,
        oldItem: item,
        newItem: cleanedItem,
        location: loc,
        alreadyExists: existingPricingIds.has(newId) && newId !== d.id,
        data,
      });
    }
  });

  console.log(`  Identified ${pricingActions.length} pricing items with duplicate brand prefix:\n`);
  pricingActions.forEach((a, i) => {
    console.log(`  [${i + 1}] Brand: "${a.brand}" | Loc: ${a.location}`);
    console.log(`      Old: "${a.oldItem}" (Doc: ${a.oldId})`);
    console.log(`      New: "${a.newItem}" (Doc: ${a.newId}) ${a.alreadyExists ? '⚠️ [Target already exists - will merge]' : '✅ [New Doc ID]'}`);
  });

  /* ──────────────────────────────────────────────────────────
   * 2. Check & Clean newrelic_catalog
   * ────────────────────────────────────────────────────────── */
  console.log('\n▶ Scanning collection: "newrelic_catalog"...');
  const catalogSnap = await getDocs(collection(db, 'newrelic_catalog'));
  console.log(`  Found ${catalogSnap.size} total catalog records.`);

  const catalogActions: Array<{
    id: string;
    brand: string;
    oldItem: string;
    newItem: string;
    data: any;
  }> = [];

  catalogSnap.forEach(d => {
    const data = d.data();
    const brand = (data.brandName || '').trim();
    const item = (data.itemName || '').trim();

    if (!brand || !item) return;

    // Special check: don't strip if item name IS the brand name (e.g. brand "Pepsi", item "Pepsi")
    if (brand.toLowerCase() === item.toLowerCase()) return;

    const cleanedItem = stripBrandPrefix(item, brand);
    if (cleanedItem.toLowerCase() !== item.toLowerCase()) {
      catalogActions.push({
        id: d.id,
        brand,
        oldItem: item,
        newItem: cleanedItem,
        data,
      });
    }
  });

  console.log(`  Identified ${catalogActions.length} catalog items with duplicate brand prefix:`);
  catalogActions.forEach((a, i) => {
    console.log(`  [${i + 1}] Brand: "${a.brand}"`);
    console.log(`      Old: "${a.oldItem}" (Doc: ${a.id})`);
    console.log(`      New: "${a.newItem}"`);
  });

  /* ──────────────────────────────────────────────────────────
   * 3. Check newrelic_challans (Read-only impact analysis)
   * ────────────────────────────────────────────────────────── */
  console.log('\n▶ Scanning collection: "newrelic_challans" for existing DC line items...');
  const challansSnap = await getDocs(collection(db, 'newrelic_challans'));
  console.log(`  Found ${challansSnap.size} total challans.`);

  const affectedChallans: Array<{
    dcNumber: string;
    location: string;
    date: string;
    affectedCount: number;
    items: Array<{ brand: string; old: string; clean: string }>;
  }> = [];

  challansSnap.forEach(d => {
    const c = d.data();
    const lineItems = c.lineItems || [];
    const affected: Array<{ brand: string; old: string; clean: string }> = [];

    lineItems.forEach((it: any) => {
      const b = (it.brandName || '').trim();
      const name = (it.itemName || '').trim();
      if (!b || !name) return;
      if (b.toLowerCase() === name.toLowerCase()) return; // Skip exact Pepsi / Pepsi
      const clean = stripBrandPrefix(name, b);
      if (clean.toLowerCase() !== name.toLowerCase()) {
        affected.push({ brand: b, old: name, clean });
      }
    });

    if (affected.length > 0) {
      affectedChallans.push({
        dcNumber: c.dcNumber || d.id,
        location: c.location || 'unknown',
        date: c.dcDate || 'unknown',
        affectedCount: affected.length,
        items: affected,
      });
    }
  });

  console.log(`  Found ${affectedChallans.length} delivery challans with prefixed item names:`);
  affectedChallans.forEach((c, idx) => {
    console.log(`  (${idx + 1}) DC ${c.dcNumber} [${c.location}] - ${c.affectedCount} items affected:`);
    c.items.forEach(it => {
      console.log(`      • ${it.brand}: "${it.old}" -> "${it.clean}"`);
    });
  });

  /* ──────────────────────────────────────────────────────────
   * Execution Block (Only when --execute flag is passed)
   * ────────────────────────────────────────────────────────── */
  if (!isExecute) {
    console.log('\n========================================================================');
    console.log('✅ DRY-RUN COMPLETED: No data was modified.');
    console.log('To apply these changes live to Firestore, run:');
    console.log('  npx tsx scripts/cleanup-item-brand-duplicates.ts --execute');
    console.log('========================================================================\n');
    process.exit(0);
  }

  console.log('\n🚀 Executing live cleanup in Firestore...');
  const batch = writeBatch(db);

  // 1. Update Pricing Records
  for (const a of pricingActions) {
    const oldRef = doc(db, 'newrelic_pricing', a.oldId);
    const newRef = doc(db, 'newrelic_pricing', a.newId);

    const updatedData = {
      ...a.data,
      itemName: a.newItem,
      updatedAt: new Date().toISOString(),
    };

    batch.set(newRef, updatedData, { merge: true });
    if (a.oldId !== a.newId) {
      batch.delete(oldRef);
    }
  }

  // 2. Update Catalog Records
  for (const a of catalogActions) {
    const catRef = doc(db, 'newrelic_catalog', a.id);
    batch.update(catRef, { itemName: a.newItem });
  }

  await batch.commit();
  console.log(`🎉 Successfully updated ${pricingActions.length} pricing records and ${catalogActions.length} catalog records!`);
  process.exit(0);
}

main().catch(err => {
  console.error('Fatal error running cleanup:', err);
  process.exit(1);
});
