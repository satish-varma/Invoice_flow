
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
  where,
  collectionGroup,
  limit,
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
  mrp?: number; // purely for admin analytics/view
  procurementCost?: number; // actual cost paid to vendor per item
}

export interface NewRelicChallan {
  id?: string;
  dcNumber: string; // e.g. "HYD569" or "BLR001"
  dcDate: string; // ISO date string
  location: NewRelicLocation;
  lineItems: NewRelicChallanItem[];
  note?: string;
  transportCost?: number; // purely for admin analytics/view
  otherCharges?: number; // purely for admin analytics/view
  procurementCost?: number; // actual cost paid to vendor for goods
  createdAt?: any;
  createdBy?: string | null;
  updatedAt?: any;
  updatedBy?: string | null;
  deletedBy?: string | null;
  isDeleted?: boolean;
  deletedAt?: any;
  signedCopyUrls?: string[];
  goodsReceivedInvoiceUrls?: string[];
}

export interface NewRelicChallanHistory {
  id: string;
  editedAt: any;
  action?: 'CREATED' | 'UPDATED' | 'DELETED' | 'RESTORED';
  editedBy?: string | null;
  previousData: NewRelicChallan;
}

const NEWRELIC_CHALLANS_COLLECTION = 'newrelic_challans';

import { saveCatalogItems } from './newrelicCatalogService';

export async function getSuggestedDcNumber(location: NewRelicLocation): Promise<string> {
  const locationConfig = NEWRELIC_LOCATIONS[location];
  
  const q = query(
    collection(db, NEWRELIC_CHALLANS_COLLECTION),
    where('location', '==', location)
  );
  
  const snapshot = await getDocs(q);
  let maxNumber = 0;

  snapshot.forEach((docSnap) => {
    const data = docSnap.data();
    const dcNumber = data.dcNumber || '';
    // Extract the numeric part
    const numPart = dcNumber.replace(locationConfig.dcPrefix, '');
    const num = parseInt(numPart, 10);
    if (!isNaN(num) && num > maxNumber) {
      maxNumber = num;
    }
  });

  const nextNumber = maxNumber + 1;
  const paddedNumber = String(nextNumber).padStart(3, '0');
  return `${locationConfig.dcPrefix}${paddedNumber}`;
}

export async function checkDuplicateDcNumber(dcNumber: string, excludeId?: string): Promise<boolean> {
  if (!dcNumber) return false;
  
  const q = query(
    collection(db, NEWRELIC_CHALLANS_COLLECTION),
    where('dcNumber', '==', dcNumber.trim())
  );
  const snapshot = await getDocs(q);
  
  if (snapshot.empty) return false;
  
  // If it exists, make sure it's not the same document we are editing
  let isDuplicate = false;
  snapshot.forEach(docSnap => {
    if (docSnap.id !== excludeId && !docSnap.data().isDeleted) {
      isDuplicate = true;
    }
  });
  
  return isDuplicate;
}

type SaveInput = Omit<NewRelicChallan, 'dcNumber' | 'createdAt'> & {
  id?: string;
  dcNumber?: string;
};

export async function saveNewRelicChallan(challan: SaveInput, userEmail: string | null = null): Promise<NewRelicChallan> {
  try {
    let finalData: any;

    // Harvest line items into catalog for future autocomplete
    if (challan.lineItems?.length) {
      await saveCatalogItems(challan.lineItems);
    }

    if (challan.id) {
      // Fetch existing data for history snapshot
      const docRef = doc(db, NEWRELIC_CHALLANS_COLLECTION, challan.id);
      const oldSnap = await getDoc(docRef);
      
      if (oldSnap.exists()) {
        const historyRef = collection(docRef, 'history');
        await addDoc(historyRef, {
          editedAt: serverTimestamp(),
          action: 'UPDATED',
          editedBy: userEmail,
          previousData: oldSnap.data()
        });
      }

      // Update existing
      const { id, ...data } = challan;
      await updateDoc(docRef, { 
        ...data,
        updatedAt: serverTimestamp(),
        updatedBy: userEmail,
      });
      const snap = await getDoc(docRef);
      finalData = { id: challan.id, ...snap.data() };
    } else {
      // Create new: use specified dcNumber or generate one as fallback
      const dcNumber =
        challan.dcNumber?.trim() || (await getSuggestedDcNumber(challan.location));
      const { id, ...data } = challan;
      const completeData = {
        ...data,
        dcNumber,
        createdAt: serverTimestamp(),
        createdBy: userEmail,
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

      let deletedAt: string | undefined;
      try {
        if (data.deletedAt instanceof Timestamp) {
          deletedAt = data.deletedAt.toDate().toISOString();
        } else if (data.deletedAt) {
          deletedAt = new Date(data.deletedAt).toISOString();
        }
      } catch {}

      let updatedAt: string | undefined;
      try {
        if (data.updatedAt instanceof Timestamp) {
          updatedAt = data.updatedAt.toDate().toISOString();
        } else if (data.updatedAt) {
          updatedAt = new Date(data.updatedAt).toISOString();
        }
      } catch {}

      challans.push({
        id: docSnap.id,
        ...data,
        dcDate,
        createdAt,
        deletedAt,
        updatedAt,
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

export async function deleteNewRelicChallan(id: string, userEmail: string | null = null): Promise<void> {
  const docRef = doc(db, NEWRELIC_CHALLANS_COLLECTION, id);
  const oldSnap = await getDoc(docRef);
  if (oldSnap.exists()) {
    const historyRef = collection(docRef, 'history');
    await addDoc(historyRef, {
      editedAt: serverTimestamp(),
      action: 'DELETED',
      editedBy: userEmail,
      previousData: oldSnap.data()
    });
  }
  await updateDoc(docRef, {
    isDeleted: true,
    deletedAt: serverTimestamp(),
    deletedBy: userEmail,
  });
}

export async function permanentDeleteNewRelicChallan(id: string): Promise<void> {
  const docRef = doc(db, NEWRELIC_CHALLANS_COLLECTION, id);
  await deleteDoc(docRef);
}

export async function deleteNewRelicChallans(ids: string[], userEmail: string | null = null): Promise<void> {
  const batch = writeBatch(db);
  for (const id of ids) {
    const docRef = doc(db, NEWRELIC_CHALLANS_COLLECTION, id);
    const oldSnap = await getDoc(docRef);
    if (oldSnap.exists()) {
      const historyRef = collection(docRef, 'history');
      batch.set(doc(historyRef), {
        editedAt: serverTimestamp(),
        action: 'DELETED',
        editedBy: userEmail,
        previousData: oldSnap.data()
      });
    }
    batch.update(docRef, {
      isDeleted: true,
      deletedAt: serverTimestamp(),
      deletedBy: userEmail,
    });
  }
  await batch.commit();
}

export async function restoreNewRelicChallans(ids: string[], userEmail: string | null = null): Promise<void> {
  const batch = writeBatch(db);
  for (const id of ids) {
    const docRef = doc(db, NEWRELIC_CHALLANS_COLLECTION, id);
    const oldSnap = await getDoc(docRef);
    if (oldSnap.exists()) {
      const historyRef = collection(docRef, 'history');
      batch.set(doc(historyRef), {
        editedAt: serverTimestamp(),
        action: 'RESTORED',
        editedBy: userEmail,
        previousData: oldSnap.data()
      });
    }
    batch.update(docRef, {
      isDeleted: false,
      deletedAt: null,
      updatedAt: serverTimestamp(),
      updatedBy: userEmail,
    });
  }
  await batch.commit();
}

export async function getNewRelicChallanHistory(id: string): Promise<NewRelicChallanHistory[]> {
  try {
    const docRef = doc(db, NEWRELIC_CHALLANS_COLLECTION, id);
    const historyRef = collection(docRef, 'history');
    const q = query(historyRef, orderBy('editedAt', 'desc'));
    const snapshot = await getDocs(q);
    
    const history: NewRelicChallanHistory[] = [];
    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      
      let editedAt: string | undefined;
      try {
        if (data.editedAt instanceof Timestamp) {
          editedAt = data.editedAt.toDate().toISOString();
        } else if (data.editedAt) {
          editedAt = new Date(data.editedAt).toISOString();
        }
      } catch {}

      history.push({
        id: docSnap.id,
        editedAt,
        action: data.action || 'UPDATED',
        editedBy: data.editedBy || 'Unknown',
        previousData: data.previousData as NewRelicChallan,
      });
    });

    return JSON.parse(JSON.stringify(history));
  } catch (error) {
    console.error('Error fetching challan history:', error);
    return [];
  }
}

export async function getGlobalAuditLogs(): Promise<NewRelicChallanHistory[]> {
  try {
    const q = query(
      collectionGroup(db, 'history'),
      // Remove orderBy to avoid composite index requirements for now
      // We'll sort in memory
      limit(200)
    );
    const snapshot = await getDocs(q);
    
    let history: NewRelicChallanHistory[] = [];
    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      
      let editedAt: string | undefined;
      try {
        if (data.editedAt instanceof Timestamp) {
          editedAt = data.editedAt.toDate().toISOString();
        } else if (data.editedAt) {
          editedAt = new Date(data.editedAt).toISOString();
        }
      } catch {}

      history.push({
        id: docSnap.id,
        editedAt,
        action: data.action || 'UPDATED',
        editedBy: data.editedBy || 'Unknown',
        previousData: data.previousData as NewRelicChallan,
      });
    });

    // Sort descending by date
    history.sort((a, b) => {
      if (!a.editedAt) return 1;
      if (!b.editedAt) return -1;
      return new Date(b.editedAt).getTime() - new Date(a.editedAt).getTime();
    });

    return JSON.parse(JSON.stringify(history));
  } catch (error) {
    console.error('Error fetching global audit logs:', error);
    return [];
  }
}

export async function addSignedCopyUrl(challanId: string, url: string, userEmail: string | null): Promise<void> {
  const docRef = doc(db, NEWRELIC_CHALLANS_COLLECTION, challanId);
  const docSnap = await getDoc(docRef);
  if (!docSnap.exists()) throw new Error('Challan not found');

  const data = docSnap.data();
  const currentUrls = data.signedCopyUrls || [];
  
  const batch = writeBatch(db);
  batch.update(docRef, {
    signedCopyUrls: [...currentUrls, url],
    updatedAt: serverTimestamp(),
    updatedBy: userEmail,
  });

  const historyRef = doc(collection(docRef, 'history'));
  batch.set(historyRef, {
    editedAt: serverTimestamp(),
    action: 'UPDATED',
    editedBy: userEmail,
    previousData: { ...data, id: docSnap.id },
  });

  await batch.commit();
}

export async function removeSignedCopyUrl(challanId: string, urlToRemove: string, userEmail: string | null): Promise<void> {
  const docRef = doc(db, NEWRELIC_CHALLANS_COLLECTION, challanId);
  const docSnap = await getDoc(docRef);
  if (!docSnap.exists()) throw new Error('Challan not found');

  const data = docSnap.data();
  const currentUrls: string[] = data.signedCopyUrls || [];
  
  const batch = writeBatch(db);
  batch.update(docRef, {
    signedCopyUrls: currentUrls.filter(u => u !== urlToRemove),
    updatedAt: serverTimestamp(),
    updatedBy: userEmail,
  });

  const historyRef = doc(collection(docRef, 'history'));
  batch.set(historyRef, {
    editedAt: serverTimestamp(),
    action: 'UPDATED',
    editedBy: userEmail,
    previousData: { ...data, id: docSnap.id },
  });

  await batch.commit();
}

export async function addGoodsReceivedUrl(challanId: string, url: string, userEmail: string | null): Promise<void> {
  const docRef = doc(db, NEWRELIC_CHALLANS_COLLECTION, challanId);
  const docSnap = await getDoc(docRef);
  if (!docSnap.exists()) throw new Error('Challan not found');

  const data = docSnap.data();
  const currentUrls = data.goodsReceivedInvoiceUrls || [];
  
  const batch = writeBatch(db);
  batch.update(docRef, {
    goodsReceivedInvoiceUrls: [...currentUrls, url],
    updatedAt: serverTimestamp(),
    updatedBy: userEmail,
  });

  const historyRef = doc(collection(docRef, 'history'));
  batch.set(historyRef, {
    editedAt: serverTimestamp(),
    action: 'UPDATED',
    editedBy: userEmail,
    previousData: { ...data, id: docSnap.id },
  });

  await batch.commit();
}

export async function removeGoodsReceivedUrl(challanId: string, urlToRemove: string, userEmail: string | null): Promise<void> {
  const docRef = doc(db, NEWRELIC_CHALLANS_COLLECTION, challanId);
  const docSnap = await getDoc(docRef);
  if (!docSnap.exists()) throw new Error('Challan not found');

  const data = docSnap.data();
  const currentUrls: string[] = data.goodsReceivedInvoiceUrls || [];
  
  const batch = writeBatch(db);
  batch.update(docRef, {
    goodsReceivedInvoiceUrls: currentUrls.filter(u => u !== urlToRemove),
    updatedAt: serverTimestamp(),
    updatedBy: userEmail,
  });

  const historyRef = doc(collection(docRef, 'history'));
  batch.set(historyRef, {
    editedAt: serverTimestamp(),
    action: 'UPDATED',
    editedBy: userEmail,
    previousData: { ...data, id: docSnap.id },
  });

  await batch.commit();
}
