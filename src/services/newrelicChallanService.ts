
import { db } from '@/lib/firebase';
import {
  collection,
  addDoc,
  getDocs,
  doc,
  runTransaction,
  serverTimestamp,
  query,
  orderBy,
  updateDoc,
  deleteDoc,
  writeBatch,
  getDoc,
  Timestamp,
} from 'firebase/firestore';

export type NewRelicLocation = 'hyderabad' | 'bangalore';

export const NEWRELIC_LOCATIONS: Record<
  NewRelicLocation,
  { label: string; address: string; dcPrefix: string; counterDoc: string }
> = {
  hyderabad: {
    label: 'Hyderabad',
    address:
      'New Relic One India Pvt Ltd,\n15th Floor, Building Number 9,\nMindspace, HITEC City,\nHyderabad,\nTelangana 500081',
    dcPrefix: 'HYD',
    counterDoc: 'newrelicHydCounter',
  },
  bangalore: {
    label: 'Bangalore',
    address:
      'New Relic One India Pvt Ltd,\nNo 15 Challaghatta Village,\nKNC Valley WeWork St. Andrews (Signature Block)\nEmbassy Golf Links Business Park,\nBengaluru 560071',
    dcPrefix: 'BLR',
    counterDoc: 'newrelicBlrCounter',
  },
};

export interface NewRelicChallanItem {
  id: number;
  brandName: string;
  itemName: string;
  quantity: number;
  expiry?: string; // e.g. "30-04-2027" or optional/blank
}

export interface NewRelicChallan {
  id?: string;
  dcNumber: string; // e.g. "HYD569" or "BLR001"
  dcDate: string; // ISO date string
  location: NewRelicLocation;
  lineItems: NewRelicChallanItem[];
  note?: string;
  createdAt?: any;
}

const NEWRELIC_CHALLANS_COLLECTION = 'newrelic_challans';

import { saveCatalogItems } from './newrelicCatalogService';

export async function getSuggestedDcNumber(location: NewRelicLocation): Promise<string> {
  const locationConfig = NEWRELIC_LOCATIONS[location];
  const counterRef = doc(db, 'counters', locationConfig.counterDoc);
  const snap = await getDoc(counterRef);
  let nextNumber = 1;
  if (snap.exists()) {
    nextNumber = (snap.data()?.currentNumber ?? 0) + 1;
  }
  const paddedNumber = String(nextNumber).padStart(3, '0');
  return `${locationConfig.dcPrefix}${paddedNumber}`;
}

async function getNextDcNumber(location: NewRelicLocation): Promise<string> {
  const locationConfig = NEWRELIC_LOCATIONS[location];
  const counterRef = doc(db, 'counters', locationConfig.counterDoc);

  const newNumber = await runTransaction(db, async (transaction) => {
    const counterDoc = await transaction.get(counterRef);
    let nextNumber = 1;
    if (counterDoc.exists()) {
      const data = counterDoc.data();
      const currentNumber = data?.currentNumber ?? 0;
      nextNumber = currentNumber + 1;
    }
    transaction.set(counterRef, { currentNumber: nextNumber }, { merge: true });
    return nextNumber;
  });

  // Format: HYD001, BLR001, etc.
  const paddedNumber = String(newNumber).padStart(3, '0');
  return `${locationConfig.dcPrefix}${paddedNumber}`;
}

type SaveInput = Omit<NewRelicChallan, 'dcNumber' | 'createdAt'> & {
  id?: string;
  dcNumber?: string;
};

export async function saveNewRelicChallan(challan: SaveInput): Promise<NewRelicChallan> {
  try {
    let finalData: any;

    // Harvest line items into catalog for future autocomplete
    if (challan.lineItems?.length) {
      await saveCatalogItems(challan.lineItems);
    }

    if (challan.id) {
      // Update existing
      const docRef = doc(db, NEWRELIC_CHALLANS_COLLECTION, challan.id);
      const { id, ...data } = challan;
      await updateDoc(docRef, { ...data });
      const snap = await getDoc(docRef);
      finalData = { id: challan.id, ...snap.data() };
    } else {
      // Create new: use specified dcNumber or auto-generate
      const dcNumber =
        challan.dcNumber?.trim() || (await getNextDcNumber(challan.location));
      const { id, ...data } = challan;
      const completeData = {
        ...data,
        dcNumber,
        createdAt: serverTimestamp(),
      };
      const docRef = await addDoc(collection(db, NEWRELIC_CHALLANS_COLLECTION), completeData);
      const snap = await getDoc(docRef);
      finalData = { id: docRef.id, ...snap.data() };
    }

    const serializable: NewRelicChallan = {
      ...finalData,
      dcDate:
        finalData.dcDate instanceof Timestamp
          ? finalData.dcDate.toDate().toISOString()
          : new Date(finalData.dcDate).toISOString(),
      createdAt:
        finalData.createdAt instanceof Timestamp
          ? finalData.createdAt.toDate().toISOString()
          : new Date().toISOString(),
    };

    return serializable;
  } catch (e) {
    console.error('Error saving NewRelic challan:', e);
    const msg = e instanceof Error ? e.message : 'Unknown error';
    throw new Error(`Failed to save challan: ${msg}`);
  }
}

export async function getNewRelicChallans(): Promise<NewRelicChallan[]> {
  try {
    const q = query(
      collection(db, NEWRELIC_CHALLANS_COLLECTION),
      orderBy('createdAt', 'desc')
    );
    const snapshot = await getDocs(q);
    const challans: NewRelicChallan[] = [];

    snapshot.forEach((docSnap) => {
      const data = docSnap.data();

      let dcDate: string;
      try {
        if (data.dcDate instanceof Timestamp) {
          dcDate = data.dcDate.toDate().toISOString();
        } else if (data.dcDate) {
          dcDate = new Date(data.dcDate).toISOString();
        } else {
          dcDate = new Date().toISOString();
        }
      } catch {
        dcDate = new Date().toISOString();
      }

      let createdAt: string | undefined;
      try {
        if (data.createdAt instanceof Timestamp) {
          createdAt = data.createdAt.toDate().toISOString();
        } else if (data.createdAt) {
          createdAt = new Date(data.createdAt).toISOString();
        }
      } catch {}

      challans.push({
        id: docSnap.id,
        ...data,
        dcDate,
        createdAt,
      } as NewRelicChallan);
    });

    return JSON.parse(JSON.stringify(challans));
  } catch (error) {
    console.error('Error fetching NewRelic challans:', error);
    return [];
  }
}

/**
 * Increments the numeric suffix of a DC number by one.
 * e.g. "HYD569" → "HYD570", "BLR001" → "BLR002"
 * Preserves the zero-padding width of the original number.
 */
export function incrementDcNumber(dcNumber: string): string {
  const match = dcNumber.match(/^([A-Za-z]+)(\d+)$/);
  if (!match) return dcNumber; // unrecognised format – return as-is
  const prefix = match[1].toUpperCase();
  const digits = match[2];
  const nextNum = parseInt(digits, 10) + 1;
  const padded = String(nextNum).padStart(digits.length, '0');
  return `${prefix}${padded}`;
}

export async function deleteNewRelicChallan(id: string): Promise<void> {
  const docRef = doc(db, NEWRELIC_CHALLANS_COLLECTION, id);
  await deleteDoc(docRef);
}

export async function deleteNewRelicChallans(ids: string[]): Promise<void> {
  const batch = writeBatch(db);
  ids.forEach((id) => {
    batch.delete(doc(db, NEWRELIC_CHALLANS_COLLECTION, id));
  });
  await batch.commit();
}
