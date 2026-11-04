import { db } from '../src/lib/firebase';
import { collection, getDocs, doc, writeBatch } from 'firebase/firestore';

function normalizeBrand(b: string): string {
  let s = (b || '').trim().toLowerCase().replace(/['’]/g, '');
  if (s === 'haldiram' || s === 'haldirams') return 'haldiram';
  if (s === 'paperboat' || s === 'paper boat' || s === 'pepper boat' || s === 'paper-boat') return 'paper boat';
  if (s === 'yogabar' || s === 'yoga bar' || s === 'yoga-bar') return 'yogabar';
  if (s === 'too yumm' || s === 'too yummi' || s === 'too-yumm') return 'too yumm';
  if (s === 'lays' || s === 'lay') return 'lays';
  if (s === 'coca cola' || s === 'coca-cola') return 'coca cola';
  if (s === 'jarsy' || s === 'jersey') return 'jersey';
  if (s.startsWith('bisleri')) return 'bisleri';
  if (s.startsWith('kinley')) return 'kinley';
  if (s === 'cadbury' || s === 'cadburys') return 'cadbury';
  if (s === 'britania' || s === 'britannia') return 'britannia';
  if (s === 'parle' || s === 'parle-g') return 'parle';
  if (s.startsWith('happilo')) return 'happilo';
  return s;
}

function normalizeItem(n: string, b: string): string {
  let s = (n || '').trim().toLowerCase().replace(/['’]/g, '');
  const nb = normalizeBrand(b);
  const rawB = (b || '').trim().toLowerCase();
  if (s.startsWith(rawB)) s = s.slice(rawB.length).trim();
  if (s.startsWith(nb)) s = s.slice(nb.length).trim();
  s = s.replace(/^[\s\-–—:]+/, '').trim();

  // Clean exact minor typographical differences
  s = s.replace(/&/g, ' and ');
  s = s.replace(/\bpotatos?\b/g, '');
  s = s.replace(/\bchips\b/g, '');
  s = s.replace(/\bshke\b/g, 'shake');
  s = s.replace(/\bchassa\b/g, 'chaas');
  s = s.replace(/\blasi\b/g, 'lassi');
  s = s.replace(/\bcoffe\b/g, 'coffee');
  s = s.replace(/\bpenut\b/g, 'peanut');
  s = s.replace(/\bchocolete\b/g, 'chocolate');
  s = s.replace(/\bpomogranate\b/g, 'pomegranate');
  s = s.replace(/\boranage\b/g, 'orange');
  s = s.replace(/\bchiwda\b/g, 'chivda');
  s = s.replace(/\bbhakharwadi\b/g, 'bhakarwadi');
  s = s.replace(/\bcookies\b/g, '');
  s = s.replace(/\s+/g, ' ').trim();
  return s;
}

async function run() {
  const isExecute = process.argv.includes('--execute');
  console.log('========================================================================');
  console.log(`POPULATE CATALOG MRPS FROM DC DATA [${isExecute ? 'EXECUTE' : 'DRY RUN'}]`);
  console.log('========================================================================');

  const catSnap = await getDocs(collection(db, 'newrelic_catalog'));
  const catalogDocs = catSnap.docs.map(d => ({ id: d.id, ref: d.ref, data: d.data() as any }));
  const missingMrpCatalog = catalogDocs.filter(c => !c.data.mrp || Number(c.data.mrp) <= 0);

  console.log(`Total catalog items: ${catalogDocs.length}`);
  console.log(`Catalog items missing MRP: ${missingMrpCatalog.length}`);

  const nrDcSnap = await getDocs(collection(db, 'newrelic_challans'));
  const genDcSnap = await getDocs(collection(db, 'challans'));

  const dcMrpMap = new Map<string, { mrp: number; source: string; rawBrand: string; rawItem: string }>();

  function registerItem(brand: string, item: string, mrp: number, source: string) {
    if (!mrp || mrp <= 0 || !brand || !item) return;
    const nb = normalizeBrand(brand);
    const ni = normalizeItem(item, brand);
    const key = `${nb}___${ni}`;
    if (!dcMrpMap.has(key)) {
      dcMrpMap.set(key, { mrp, source, rawBrand: brand, rawItem: item });
    }
  }

  nrDcSnap.docs.forEach(docSnap => {
    const dc = docSnap.data();
    if (dc.isDeleted) return;
    (dc.lineItems || []).forEach((it: any) => {
      registerItem(it.brandName, it.itemName, Number(it.mrp), dc.dcNumber || docSnap.id);
    });
  });

  genDcSnap.docs.forEach(docSnap => {
    const dc = docSnap.data();
    (dc.lineItems || []).forEach((it: any) => {
      registerItem(it.brandName, it.itemName, Number(it.mrp), dc.dcNumber || docSnap.id);
    });
  });

  const pricingSnap = await getDocs(collection(db, 'newrelic_pricing'));
  pricingSnap.docs.forEach(docSnap => {
    const p = docSnap.data();
    registerItem(p.brandName, p.itemName, Number(p.mrp), 'Pricing Master');
  });

  const updates: Array<{ id: string; ref: any; brand: string; item: string; newMrp: number; source: string }> = [];

  missingMrpCatalog.forEach(c => {
    const nb = normalizeBrand(c.data.brandName);
    const ni = normalizeItem(c.data.itemName, c.data.brandName);
    const key = `${nb}___${ni}`;

    const match = dcMrpMap.get(key);
    if (match) {
      updates.push({
        id: c.id,
        ref: c.ref,
        brand: c.data.brandName,
        item: c.data.itemName,
        newMrp: match.mrp,
        source: match.source,
      });
    }
  });

  console.log(`\nFound ${updates.length} catalog items to populate with MRP:`);
  updates.forEach(u => {
    console.log(`  ✓ ${u.brand} - ${u.item}  ➔  MRP: ₹${u.newMrp} (from ${u.source})`);
  });

  if (isExecute) {
    console.log(`\nWriting updates to Firestore in batches...`);
    const batchSize = 450;
    for (let i = 0; i < updates.length; i += batchSize) {
      const batch = writeBatch(db);
      const chunk = updates.slice(i, i + batchSize);
      chunk.forEach(u => {
        batch.update(u.ref, {
          mrp: u.newMrp,
          updatedAt: new Date().toISOString(),
        });
      });
      await batch.commit();
      console.log(`  Committed batch ${Math.floor(i / batchSize) + 1} (${chunk.length} items)`);
    }
    console.log(`\nSUCCESS: Populated ${updates.length} catalog items with MRP!`);
  } else {
    console.log(`\nDry run completed. Run with --execute to commit these changes to Firestore.`);
  }
}

run().catch(console.error);
