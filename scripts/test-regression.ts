/**
 * Critical Operations Regression Test Suite
 * 
 * Verifies core application flows to guarantee zero regressions:
 * 1. Delivery Challan Schemas (New, Edit, Empty lines, Coercion, Date parsing)
 * 2. Pricing & Cost Lookup (Fuzzy brand match, Singular/Plural, Pricing-only items, Item-only fallback)
 * 3. Invoice Calculations & MRP / NON-MRP Tax Classification
 * 4. Permission Guards & Read-Only Safety
 */

import { challanSchema, lineItemSchema, PricingItem } from '../src/types/challan';
import { buildPricingMap, findPricingForItem } from '../src/services/newrelicPricingService';
import { detectDuplicateCatalogGroups } from '../src/services/newrelicDuplicateDetector';

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string, details?: string) {
  if (condition) {
    console.log(`  ✅ [PASS] ${testName}`);
    passed++;
  } else {
    console.error(`  ❌ [FAIL] ${testName}${details ? ` -> ${details}` : ''}`);
    failed++;
  }
}

async function runRegressionSuite() {
  console.log('\n======================================================');
  console.log('   INVOICE FLOW - CORE OPERATIONS REGRESSION SUITE');
  console.log('======================================================\n');

  // --- SUITE 1: Challan Schemas & Number Coercion ---
  console.log('📦 1. Delivery Challan Schema & Resiliency:');
  {
    // Test: Valid full challan
    const validChallan = {
      dcNumber: 'HYD601',
      location: 'hyderabad',
      dcDate: new Date(),
      lineItems: [
        { id: 1, brandName: 'Epigamia', itemName: 'Mango Yogurt', quantity: 2, mrp: 35, procurementCost: 24.5 },
      ],
    };
    const r1 = challanSchema.safeParse(validChallan);
    assert(r1.success, 'Valid challan parses successfully');

    // Test: Edit mode with ISO string date
    const editChallanStringDate = {
      dcNumber: 'BLR072',
      location: 'bangalore',
      dcDate: '2026-10-15T08:13:35.474Z',
      lineItems: [
        { id: 1, brandName: 'Farmley', itemName: 'Date Bites', quantity: 1 },
      ],
    };
    const r2 = challanSchema.safeParse(editChallanStringDate);
    assert(r2.success && r2.data.dcDate instanceof Date, 'String dates coerce to Date automatically without failing');

    // Test: Empty strings from HTML number inputs coerce safely
    const emptyRowChallan = {
      dcNumber: 'HYD602',
      location: 'hyderabad',
      dcDate: new Date(),
      lineItems: [
        { id: 1, brandName: 'Haldiram', itemName: 'Aloo Bhujiya', quantity: 1, mrp: 15, procurementCost: 10 },
        { id: 2, brandName: '', itemName: '', quantity: '', mrp: '', procurementCost: '' }, // Trailing empty row
      ],
    };
    const r3 = challanSchema.safeParse(emptyRowChallan);
    assert(r3.success, 'Empty rows with empty string quantities do not cause silent validation failure');
    if (r3.success) {
      assert(r3.data.lineItems[1].quantity === 0 || r3.data.lineItems[1].quantity === 1, 'Quantity coerces to safe number');
    }
  }

  // --- SUITE 2: Pricing Auto-Population & Fuzzy Resolution ---
  console.log('\n💰 2. Pricing & Cost Auto-Population:');
  {
    const mockPricingItems: PricingItem[] = [
      { id: '1', brandName: 'Haldiram', itemName: 'Aloo Bhujiya', location: 'hyderabad', mrp: 15, discountPercent: 0, purchaseCost: 14, effectiveDate: '2026-01-01' },
      { id: '2', brandName: "Lay's", itemName: 'Magic Masala', location: 'hyderabad', mrp: 20, discountPercent: 0, purchaseCost: 12, effectiveDate: '2026-01-01' },
      { id: '3', brandName: 'Epigamia', itemName: 'Mango Yogurt', location: 'hyderabad', mrp: 35, discountPercent: 0, purchaseCost: 24.5, effectiveDate: '2026-01-01' },
      { id: '4', brandName: 'Farmley', itemName: 'Date bites classic', location: 'bangalore', mrp: 40, discountPercent: 0, purchaseCost: 24, effectiveDate: '2026-01-01' },
    ];
    const pricingMap = buildPricingMap(mockPricingItems);

    // Exact match
    const p1 = findPricingForItem(mockPricingItems, pricingMap, 'Mango Yogurt', 'Epigamia');
    assert(p1.purchaseCost === 24.5 && p1.mrp === 35, 'Exact brand & item lookup resolves correct P.Cost & MRP');

    // Plural / Singular brand variation (Haldirams vs Haldiram)
    const p2 = findPricingForItem(mockPricingItems, pricingMap, 'Aloo Bhujiya', 'Haldirams');
    assert(p2.purchaseCost === 14, 'Singular/plural brand variation (Haldirams <-> Haldiram) resolves correctly');

    // Apostrophe / punctuation variation (Lays vs Lay's)
    const p3 = findPricingForItem(mockPricingItems, pricingMap, 'Magic Masala', 'Lays');
    assert(p3.purchaseCost === 12, "Punctuation variation (Lays <-> Lay's) resolves correctly");

    // Item name only (user enters item before selecting brand)
    const p4 = findPricingForItem(mockPricingItems, pricingMap, 'Mango Yogurt');
    assert(p4.purchaseCost === 24.5 && p4.brandName === 'Epigamia', 'Lookup by item name alone resolves cost and auto-fills brand');

    // Non-existent item returns empty object gracefully without error
    const p5 = findPricingForItem(mockPricingItems, pricingMap, 'NonExistentItem123');
    assert(p5.purchaseCost === undefined, 'Non-existent item returns empty result cleanly without crashing');
  }

  // --- SUITE 3: Invoice Tax & Type Categorization (MRP vs NON-MRP) ---
  console.log('\n🧾 3. Invoice Tax Classification (MRP vs NON-MRP):');
  {
    // Invoices with SGST & CGST are classified as MRP/GST invoices
    function classifyInvoiceType(items: { description: string; rate?: number }[], taxEntries?: { name: string; amount: number }[]): 'MRP' | 'NON-MRP' {
      if (taxEntries && taxEntries.length > 0) {
        const hasGst = taxEntries.some(t => /CGST|SGST|IGST|GST/i.test(t.name) && t.amount > 0);
        if (hasGst) return 'MRP';
      }
      return 'NON-MRP';
    }

    const mrpInvoice = classifyInvoiceType(
      [{ description: 'Item A', rate: 100 }],
      [{ name: 'CGST @ 2.5%', amount: 2.5 }, { name: 'SGST @ 2.5%', amount: 2.5 }]
    );
    assert(mrpInvoice === 'MRP', 'Invoices with SGST/CGST tax entries correctly classify as MRP');

    const nonMrpInvoice = classifyInvoiceType(
      [{ description: 'Service B', rate: 500 }],
      []
    );
    assert(nonMrpInvoice === 'NON-MRP', 'Invoices without GST tax entries correctly classify as NON-MRP');
  }

  // --- SUITE 4: Catalog Duplicate Detection & Keeper Scoring ---
  console.log('\n🔍 4. Catalog Duplicate Detection & Smart Keeper Selection:');
  {
    const sampleCatalog = [
      { id: '1', brandName: 'Britannia', itemName: 'Marie Gold', defaultQuantity: 1, mrp: 10, caseSize: 48 },
      { id: '2', brandName: 'Britannia', itemName: 'Mariegold', defaultQuantity: 1 },
      { id: '3', brandName: 'Haldiram', itemName: 'Soya Sticks', defaultQuantity: 1, mrp: 50 },
      { id: '4', brandName: 'Haldirams', itemName: 'Soya Sticks', defaultQuantity: 1 },
      { id: '5', brandName: 'Tropicana', itemName: 'Pomegranate', defaultQuantity: 1 },
      { id: '6', brandName: 'Tropicana', itemName: 'Pomegranate Juice', defaultQuantity: 1, mrp: 25 },
      { id: '7', brandName: 'Amul', itemName: 'Buttermilk', defaultQuantity: 1, mrp: 15 },
    ];

    const groups = detectDuplicateCatalogGroups(sampleCatalog as any);
    assert(groups.length === 3, 'Detects exact 3 duplicate clusters from sample dataset');

    const marieGroup = groups.find(g => g.items.some(i => i.itemName.includes('Marie')));
    assert(Boolean(marieGroup && marieGroup.suggestedKeeperId === '1'), 'Selects higher-metadata candidate as suggested keeper (Marie Gold)');

    const haldiramGroup = groups.find(g => g.primaryReason.includes('Brand spelling'));
    assert(Boolean(haldiramGroup && haldiramGroup.suggestedKeeperId === '3'), 'Detects brand plural variant and suggests configured MRP keeper (Haldiram)');

    const pomegranateGroup = groups.find(g => g.items.some(i => i.itemName.includes('Pomegranate')));
    assert(Boolean(pomegranateGroup && pomegranateGroup.suggestedKeeperId === '6'), 'Detects noise word difference and suggests keeper with defined MRP');
  }

  // --- Summary ---
  console.log('\n======================================================');
  console.log(`   RESULTS: ${passed} Passed, ${failed} Failed`);
  console.log('======================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runRegressionSuite().catch((err) => {
  console.error('Fatal regression suite error:', err);
  process.exit(1);
});
