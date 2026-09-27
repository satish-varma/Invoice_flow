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
import { NewRelicLocation } from './newrelicChallanService';

export interface PricingItem {
  id?: string;
  brandName: string;
  itemName: string;
  location: NewRelicLocation;
  mrp: number;
  discountPercent: number;
  purchaseCost: number; // auto-calculated or overridden
  updatedAt?: Timestamp;
}

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

/** Upsert a pricing row */
export async function savePricingItem(item: Omit<PricingItem, 'id' | 'updatedAt'>): Promise<void> {
  const docId = getPricingDocId(item.brandName, item.itemName, item.location);
  const docRef = doc(db, PRICING_COLLECTION, docId);
  await setDoc(docRef, { ...item, updatedAt: serverTimestamp() }, { merge: true });
}

/** Delete a pricing row by document ID */
export async function deletePricingItem(id: string): Promise<void> {
  await deleteDoc(doc(db, PRICING_COLLECTION, id));
}

/** Build a fast lookup map: "brand__item" -> purchaseCost for a location */
export function buildPricingMap(items: PricingItem[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const item of items) {
    const key = `${item.brandName.trim().toLowerCase()}__${item.itemName.trim().toLowerCase()}`;
    map.set(key, item.purchaseCost);
  }
  return map;
}
