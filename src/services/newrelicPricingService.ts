import { db } from '@/lib/firebase';
import {
  collection,
  getDocs,
  doc,
  setDoc,
  deleteDoc,
  query,
  where,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { PricingItem, NewRelicLocation } from '@/types/challan';

const PRICING_COLLECTION = 'newrelic_pricing';

export function getPricingDocId(brandName: string, itemName: string, location: NewRelicLocation): string {
  return `${brandName.trim().toLowerCase()}_${itemName.trim().toLowerCase()}_${location}`
    .replace(/[^a-z0-9_]/g, '_')
    .replace(/_+/g, '_');
}

export function calcPurchaseCost(mrp: number, discountPercent: number): number {
  return parseFloat((mrp * (1 - discountPercent / 100)).toFixed(2));
}

/** Fetch all pricing rows for a specific location */
export async function getPricingItems(location: NewRelicLocation): Promise<PricingItem[]> {
  try {
    const q = query(collection(db, PRICING_COLLECTION), where('location', '==', location));
    const snap = await getDocs(q);
    const items: PricingItem[] = [];
    snap.forEach((d) => items.push({ id: d.id, ...d.data() } as PricingItem));
    return items;
  } catch (error) {
    console.error('Error fetching pricing items:', error);
    return [];
  }
}

/** Fetch all pricing rows across all locations */
export async function getAllPricingItems(): Promise<PricingItem[]> {
  try {
    const snap = await getDocs(collection(db, PRICING_COLLECTION));
    const items: PricingItem[] = [];
    snap.forEach((d) => items.push({ id: d.id, ...d.data() } as PricingItem));
    return items;
  } catch (error) {
    console.error('Error fetching all pricing items:', error);
    return [];
  }
}

import { getDoc } from 'firebase/firestore';

/** Upsert a pricing row with automatic historical log tracking */
export async function savePricingItem(
  item: Omit<PricingItem, 'id' | 'updatedAt'>,
  userEmail?: string | null
): Promise<void> {
  const docId = getPricingDocId(item.brandName, item.itemName, item.location);
  const docRef = doc(db, PRICING_COLLECTION, docId);
  const existingSnap = await getDoc(docRef);

  let history = item.history || [];
  const today = new Date().toISOString().substring(0, 10);
  const effectiveDate = item.effectiveDate || today;

  if (existingSnap.exists()) {
    const existingData = existingSnap.data() as PricingItem;
    const prevHistory = existingData.history || [];
    // If the price changed, push previous rate into history
    if (
      existingData.purchaseCost !== item.purchaseCost ||
      existingData.mrp !== item.mrp ||
      existingData.discountPercent !== item.discountPercent
    ) {
      const historyEntry = {
        mrp: existingData.mrp,
        discountPercent: existingData.discountPercent,
        purchaseCost: existingData.purchaseCost,
        effectiveDate: existingData.effectiveDate || today,
        updatedAt: new Date().toISOString(),
        updatedBy: userEmail || undefined,
      };
      history = [...prevHistory, historyEntry];
    } else {
      history = prevHistory;
    }
  }

  await setDoc(
    docRef,
    {
      ...item,
      effectiveDate,
      history,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

/** Delete a pricing row by document ID */
export async function deletePricingItem(id: string): Promise<void> {
  await deleteDoc(doc(db, PRICING_COLLECTION, id));
}

/** 
 * Resolve effective price for an item on a specific target date (YYYY-MM-DD).
 * If targetDate is provided and is earlier than the item's current effectiveDate,
 * it looks into the history entries to find what price was valid on that target date.
 */
export function resolveEffectivePricing(
  item: PricingItem,
  targetDate?: string
): { mrp: number; discountPercent: number; purchaseCost: number } {
  if (!targetDate || !item.effectiveDate || targetDate >= item.effectiveDate || !item.history || item.history.length === 0) {
    return {
      mrp: item.mrp,
      discountPercent: item.discountPercent,
      purchaseCost: item.purchaseCost,
    };
  }

  // Sort history chronologically
  const sorted = [...item.history].sort((a, b) => (a.effectiveDate || '').localeCompare(b.effectiveDate || ''));
  // Find the latest history entry whose effectiveDate <= targetDate
  for (let i = sorted.length - 1; i >= 0; i--) {
    if (sorted[i].effectiveDate <= targetDate) {
      return {
        mrp: sorted[i].mrp,
        discountPercent: sorted[i].discountPercent,
        purchaseCost: sorted[i].purchaseCost,
      };
    }
  }

  // Fallback to earliest historical rate or current
  return sorted[0] || {
    mrp: item.mrp,
    discountPercent: item.discountPercent,
    purchaseCost: item.purchaseCost,
  };
}

/** Build a fast lookup map: "brand__item" -> purchaseCost for a location on a specific date */
export function buildPricingMap(items: PricingItem[], targetDate?: string): Map<string, number> {
  const map = new Map<string, number>();
  for (const item of items) {
    const key = `${item.brandName.trim().toLowerCase()}__${item.itemName.trim().toLowerCase()}`;
    const resolved = resolveEffectivePricing(item, targetDate);
    map.set(key, resolved.purchaseCost);
  }
  return map;
}

/**
 * Bulk update pricing for all items belonging to a specific Brand & Location.
 * Supports:
 * - 'percentage': Add X% inflation multiplier to MRP or purchaseCost (e.g. +5% across all Amul items)
 * - 'discount': Set uniform discount % across all items for that brand
 * - 'fixed_adjustment': Add or subtract flat ₹ to MRP or P.Cost
 */
export async function bulkUpdateBrandPricing({
  brandName,
  location,
  mode,
  value,
  applyTo,
  effectiveDate,
  userEmail,
}: {
  brandName: string;
  location: NewRelicLocation;
  mode: 'percentage_increase' | 'set_discount' | 'fixed_increase';
  value: number; // e.g. 5 for +5%, or 20 for 20% discount
  applyTo?: 'mrp' | 'purchaseCost'; // default 'purchaseCost'
  effectiveDate?: string;
  userEmail?: string | null;
}): Promise<{ updatedCount: number }> {
  const targetBrand = brandName.trim().toLowerCase();
  const allItems = await getPricingItems(location);
  const matching = allItems.filter(i => i.brandName.trim().toLowerCase() === targetBrand);

  let updatedCount = 0;
  const dateStr = effectiveDate || new Date().toISOString().substring(0, 10);

  for (const item of matching) {
    let newMrp = item.mrp;
    let newDiscount = item.discountPercent;
    let newCost = item.purchaseCost;

    if (mode === 'percentage_increase') {
      const multiplier = 1 + value / 100;
      if (applyTo === 'mrp') {
        newMrp = parseFloat((item.mrp * multiplier).toFixed(2));
        newCost = calcPurchaseCost(newMrp, newDiscount);
      } else {
        newCost = parseFloat((item.purchaseCost * multiplier).toFixed(2));
        if (newMrp > 0) {
          newDiscount = parseFloat(((1 - newCost / newMrp) * 100).toFixed(2));
        }
      }
    } else if (mode === 'set_discount') {
      newDiscount = value;
      newCost = calcPurchaseCost(newMrp, newDiscount);
    } else if (mode === 'fixed_increase') {
      if (applyTo === 'mrp') {
        newMrp = Math.max(0, parseFloat((item.mrp + value).toFixed(2)));
        newCost = calcPurchaseCost(newMrp, newDiscount);
      } else {
        newCost = Math.max(0, parseFloat((item.purchaseCost + value).toFixed(2)));
        if (newMrp > 0) {
          newDiscount = parseFloat(((1 - newCost / newMrp) * 100).toFixed(2));
        }
      }
    }

    await savePricingItem(
      {
        brandName: item.brandName,
        itemName: item.itemName,
        location: item.location,
        mrp: newMrp,
        discountPercent: newDiscount,
        purchaseCost: newCost,
        effectiveDate: dateStr,
      },
      userEmail
    );
    updatedCount++;
  }

  return { updatedCount };
}

/**
 * Seeds the newrelic_pricing collection from existing challan history.
 * Reads all DCs ordered newest-first; latest data wins — skips items already seen.
 * Only seeds entries where procurementCost > 0 on the DC line item.
 */
export async function seedPricingFromChallans(): Promise<{ seeded: number; skipped: number }> {
  // Lazy import to avoid circular deps at module level
  const { db } = await import('@/lib/firebase');
  const { collection, getDocs, query, orderBy, setDoc, doc, serverTimestamp } = await import('firebase/firestore');

  const CHALLANS_COLLECTION = 'newrelic_challans';
  const seen = new Set<string>(); // "brand__item__location" — track which we've already seeded
  let seeded = 0;
  let skipped = 0;

  try {
    const snap = await getDocs(
      query(collection(db, CHALLANS_COLLECTION), orderBy('createdAt', 'desc'))
    );

    for (const docSnap of snap.docs) {
      const data = docSnap.data();
      const location = data.location as NewRelicLocation;
      if (!location || !data.lineItems || !Array.isArray(data.lineItems)) continue;

      for (const item of data.lineItems) {
        const brand = (item.brandName || '').trim();
        const name = (item.itemName || '').trim();
        const pCost = Number(item.procurementCost);
        const mrp = Number(item.mrp);

        if (!brand || !name || !(pCost > 0)) continue;

        const seenKey = `${brand.toLowerCase()}__${name.toLowerCase()}__${location}`;
        if (seen.has(seenKey)) {
          skipped++;
          continue; // Later (older) DC — latest already processed
        }
        seen.add(seenKey);

        const discountPercent =
          mrp > 0 ? parseFloat(((1 - pCost / mrp) * 100).toFixed(2)) : 0;

        const docId = getPricingDocId(brand, name, location);
        await setDoc(
          doc(db, PRICING_COLLECTION, docId),
          {
            brandName: brand,
            itemName: name,
            location,
            mrp: mrp || pCost, // fallback mrp to pCost if not available
            discountPercent,
            purchaseCost: pCost,
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );
        seeded++;
      }
    }
  } catch (e) {
    console.error('Error seeding pricing from challans:', e);
    throw e;
  }

  return { seeded, skipped };
}

