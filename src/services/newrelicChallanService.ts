
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
  deleteField,
} from 'firebase/firestore';

import { NewRelicLocation, NewRelicChallanItem, NewRelicChallan, NewRelicChallanHistory } from '@/types/challan';
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



const NEWRELIC_CHALLANS_COLLECTION = 'newrelic_challans';

import { saveCatalogItems } from './newrelicCatalogService';
import { assertWritePermission } from '@/lib/readOnlyGuard';

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

function deepCleanUndefined(obj: any): any {
  if (obj === undefined || obj === null) return obj;
  if (Array.isArray(obj)) {
    return obj.map(deepCleanUndefined).filter((v) => v !== undefined);
  }
  if (
    typeof obj === 'object' &&
    !(obj instanceof Date) &&
    typeof obj.toDate !== 'function' &&
    typeof obj.isEqual !== 'function'
  ) {
    const clean: Record<string, any> = {};
    for (const [key, value] of Object.entries(obj)) {
      if (value !== undefined) {
        clean[key] = deepCleanUndefined(value);
      }
    }
    return clean;
  }
  return obj;
}

type SaveInput = Omit<NewRelicChallan, 'dcNumber' | 'createdAt'> & {
  id?: string;
  dcNumber?: string;
};

export async function saveNewRelicChallan(challan: SaveInput, userEmail: string | null = null): Promise<NewRelicChallan> {
  await assertWritePermission('Saving Delivery Challan');
  try {
    let finalData: any;

    // Harvest line items into catalog for future autocomplete
    if (challan.lineItems?.length) {
      await saveCatalogItems(challan.lineItems);
    }

    // 1. Resolve target document ID
    let targetDocId = challan.id?.trim() || undefined;

    // 2. If no ID was explicitly provided, check if an active challan with this dcNumber already exists
    if (!targetDocId && challan.dcNumber?.trim()) {
      const q = query(
        collection(db, NEWRELIC_CHALLANS_COLLECTION),
        where('dcNumber', '==', challan.dcNumber.trim())
      );
      const existingSnap = await getDocs(q);
      const activeExisting = existingSnap.docs.find((d) => !d.data().isDeleted);
      if (activeExisting) {
        targetDocId = activeExisting.id;
      }
    }

    if (targetDocId) {
      // Fetch existing data for history snapshot
      const docRef = doc(db, NEWRELIC_CHALLANS_COLLECTION, targetDocId);
      const oldSnap = await getDoc(docRef);
      
      if (oldSnap.exists()) {
        const historyRef = collection(docRef, 'history');
        await addDoc(historyRef, {
          editedAt: serverTimestamp(),
          action: 'UPDATED',
          editedBy: userEmail,
          previousData: deepCleanUndefined({ ...oldSnap.data(), id: targetDocId }),
        });
      }

      // Update existing
      const { id, ...data } = challan;
      const cleanData = deepCleanUndefined(data);

      // Recalculate root procurementCost if missing or 0 but lineItems have costs
      if (cleanData.lineItems?.length) {
        const itemsPCost = cleanData.lineItems.reduce((acc: number, it: any) => 
          acc + ((Number(it.procurementCost) || 0) * (Number(it.quantity) || 1)), 0);
        if ((cleanData.procurementCost === undefined || cleanData.procurementCost === 0) && itemsPCost > 0) {
          cleanData.procurementCost = itemsPCost;
        }
      }

      const updatePayload = { 
        ...cleanData,
        pCost: deleteField(),
        updatedAt: serverTimestamp(),
        updatedBy: userEmail,
      };
      await updateDoc(docRef, updatePayload);
      const snap = await getDoc(docRef);
      finalData = { id: targetDocId, ...snap.data() };
    } else {
      // Create new: use specified dcNumber or generate one as fallback
      const dcNumber =
        challan.dcNumber?.trim() || (await getSuggestedDcNumber(challan.location));
      const { id, ...data } = challan;
      const cleanData = deepCleanUndefined(data);

      if (cleanData.lineItems?.length) {
        const itemsPCost = cleanData.lineItems.reduce((acc: number, it: any) => 
          acc + ((Number(it.procurementCost) || 0) * (Number(it.quantity) || 1)), 0);
        if ((cleanData.procurementCost === undefined || cleanData.procurementCost === 0) && itemsPCost > 0) {
          cleanData.procurementCost = itemsPCost;
        }
      }

      const completeData = {
        ...cleanData,
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
        // Backward compatibility for old documents (handle 0 correctly if pCost exists)
        procurementCost: (data.procurementCost === 0 && data.pCost > 0) ? data.pCost : (data.procurementCost ?? data.pCost),
        lineItems: (data.lineItems || []).map((item: any) => ({
          ...item,
          procurementCost: (item.procurementCost === 0 && item.pCost > 0) ? item.pCost : (item.procurementCost ?? item.pCost),
        })),
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
  await assertWritePermission('Deleting Delivery Challan');
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
  await assertWritePermission('Permanently Deleting Delivery Challan');
  const docRef = doc(db, NEWRELIC_CHALLANS_COLLECTION, id);
  await deleteDoc(docRef);
}

export async function deleteNewRelicChallans(ids: string[], userEmail: string | null = null): Promise<void> {
  await assertWritePermission('Bulk Deleting Delivery Challans');
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
  await assertWritePermission('Restoring Delivery Challans');
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
    const mainSnap = await getDoc(docRef);
    const dcNumber = mainSnap.exists() ? mainSnap.data().dcNumber?.trim() : undefined;

    // Collect all documents sharing this dcNumber to ensure no history is lost across duplicate/recreated docs
    const docIds = new Set<string>([id]);
    if (dcNumber) {
      const qDocs = query(
        collection(db, NEWRELIC_CHALLANS_COLLECTION),
        where('dcNumber', '==', dcNumber)
      );
      const snapDocs = await getDocs(qDocs);
      snapDocs.forEach((d) => docIds.add(d.id));
    }

    const historyMap = new Map<string, NewRelicChallanHistory>();

    for (const docId of docIds) {
      const historyRef = collection(doc(db, NEWRELIC_CHALLANS_COLLECTION, docId), 'history');
      const q = query(historyRef, orderBy('editedAt', 'desc'));
      const snapshot = await getDocs(q);

      snapshot.forEach((docSnap) => {
        if (historyMap.has(docSnap.id)) return;
        const data = docSnap.data();

        let editedAt: string | undefined;
        try {
          if (data.editedAt instanceof Timestamp) {
            editedAt = data.editedAt.toDate().toISOString();
          } else if (data.editedAt) {
            editedAt = new Date(data.editedAt).toISOString();
          }
        } catch {}

        const prev = data.previousData || {};

        // Normalize lineItems with robust procurementCost resolution
        const rawItems = prev.lineItems || [];
        const normalizedItems = rawItems.map((item: any) => {
          const cost = (item.procurementCost === 0 && item.pCost > 0)
            ? item.pCost
            : (item.procurementCost ?? item.pCost ?? 0);
          return {
            ...item,
            procurementCost: Number(cost) || 0,
            mrp: Number(item.mrp) || 0,
            quantity: Number(item.quantity) || 1,
          };
        });

        // Recalculate or normalize root procurementCost
        const rawRootPCost = prev.procurementCost;
        const legacyRootPCost = prev.pCost;
        let resolvedRootPCost = (rawRootPCost === 0 && legacyRootPCost > 0)
          ? legacyRootPCost
          : (rawRootPCost ?? legacyRootPCost);

        const sumItemsCost = normalizedItems.reduce(
          (acc: number, it: any) => acc + (it.procurementCost * it.quantity),
          0
        );

        if ((!resolvedRootPCost || resolvedRootPCost === 0) && sumItemsCost > 0) {
          resolvedRootPCost = sumItemsCost;
        }

        historyMap.set(docSnap.id, {
          id: docSnap.id,
          editedAt,
          action: data.action || 'UPDATED',
          editedBy: data.editedBy || 'Unknown',
          previousData: {
            ...prev,
            id: prev.id || id,
            procurementCost: Number(resolvedRootPCost) || 0,
            lineItems: normalizedItems,
          } as NewRelicChallan,
        });
      });
    }

    const history = Array.from(historyMap.values()).sort((a, b) => {
      const timeA = a.editedAt ? new Date(a.editedAt).getTime() : 0;
      const timeB = b.editedAt ? new Date(b.editedAt).getTime() : 0;
      return timeB - timeA;
    });

    return JSON.parse(JSON.stringify(history));
  } catch (error) {
    console.error('Error fetching challan history:', error);
    return [];
  }
}

export async function revertNewRelicChallanVersion(
  challanId: string,
  versionData: Partial<NewRelicChallan>,
  userEmail: string | null = null
): Promise<NewRelicChallan> {
  let targetId = challanId;
  let docRef = doc(db, NEWRELIC_CHALLANS_COLLECTION, targetId);
  let currentSnap = await getDoc(docRef);

  // If the target doc was deleted or not found, try looking up by dcNumber for the active document
  if ((!currentSnap.exists() || currentSnap.data()?.isDeleted) && versionData.dcNumber?.trim()) {
    const q = query(
      collection(db, NEWRELIC_CHALLANS_COLLECTION),
      where('dcNumber', '==', versionData.dcNumber.trim())
    );
    const snap = await getDocs(q);
    const activeDoc = snap.docs.find(d => !d.data().isDeleted);
    if (activeDoc) {
      targetId = activeDoc.id;
      docRef = doc(db, NEWRELIC_CHALLANS_COLLECTION, targetId);
      currentSnap = activeDoc;
    }
  }

  if (!currentSnap.exists()) {
    throw new Error('Challan not found');
  }
  const currentData = currentSnap.data();

  // 1. Record the state prior to revert in history with action RESTORED
  const historyRef = collection(docRef, 'history');
  await addDoc(historyRef, {
    editedAt: serverTimestamp(),
    action: 'RESTORED',
    editedBy: userEmail,
    previousData: deepCleanUndefined({ ...currentData, id: targetId }),
  });

  // 2. Harvest items if available
  if (versionData.lineItems?.length) {
    try {
      await saveCatalogItems(versionData.lineItems);
    } catch (e) {
      console.warn('Could not harvest catalog items during revert:', e);
    }
  }

  // 3. Resolve pricing map for fallback if any items are missing procurementCost
  const loc = (versionData.location || currentData.location || 'hyderabad') as NewRelicLocation;
  const targetDateStr = versionData.dcDate ? versionData.dcDate.substring(0, 10) : undefined;
  let pricingMap = new Map<string, number>();
  try {
    const { getPricingItems, buildPricingMap } = await import('@/services/newrelicPricingService');
    const pricingItems = await getPricingItems(loc);
    pricingMap = buildPricingMap(pricingItems, targetDateStr);
  } catch (e) {
    console.warn('Could not load pricing map during revert:', e);
  }

  // 4. Also fetch known item costs from all history versions of this challan
  const historyItemCosts = new Map<string, number>();
  try {
    const allHistory = await getNewRelicChallanHistory(targetId);
    for (const h of allHistory) {
      for (const item of (h.previousData?.lineItems || [])) {
        const cost = Number(item.procurementCost) || 0;
        if (cost > 0) {
          const brandKey = `${(item.brandName || '').trim().toLowerCase()}__${(item.itemName || '').trim().toLowerCase()}`;
          if (!historyItemCosts.has(brandKey)) {
            historyItemCosts.set(brandKey, cost);
          }
          const itemOnlyKey = (item.itemName || '').trim().toLowerCase();
          if (!historyItemCosts.has(itemOnlyKey)) {
            historyItemCosts.set(itemOnlyKey, cost);
          }
        }
      }
    }
  } catch (e) {
    console.warn('Could not inspect history item costs during revert:', e);
  }

  // 5. Prepare and normalize lineItems
  const rawItems = versionData.lineItems || [];
  const normalizedItems = rawItems.map((item: any) => {
    let cost = (item.procurementCost === 0 && item.pCost > 0)
      ? Number(item.pCost)
      : (Number(item.procurementCost) || Number(item.pCost) || 0);

    // If cost is 0, attempt fallback from history records, then from pricing map
    if (cost === 0) {
      const brand = (item.brandName || '').trim().toLowerCase();
      const name = (item.itemName || '').trim().toLowerCase();
      const brandKey = `${brand}__${name}`;

      if (historyItemCosts.has(brandKey)) {
        cost = historyItemCosts.get(brandKey)!;
      } else if (historyItemCosts.has(name)) {
        cost = historyItemCosts.get(name)!;
      } else if (pricingMap.has(brandKey)) {
        cost = pricingMap.get(brandKey)!;
      } else if (pricingMap.has(name)) {
        cost = pricingMap.get(name)!;
      }
    }

    const { pCost, ...itemClean } = item;
    return {
      ...itemClean,
      brandName: item.brandName || '',
      itemName: item.itemName || '',
      quantity: Number(item.quantity) || 1,
      mrp: Number(item.mrp) || 0,
      procurementCost: cost,
    };
  });

  // 6. Calculate total procurement cost from normalized items
  const totalCalculatedPCost = normalizedItems.reduce(
    (acc: number, it: any) => acc + (it.procurementCost * it.quantity),
    0
  );

  let finalProcurementCost = totalCalculatedPCost;
  if (finalProcurementCost === 0 && versionData.procurementCost) {
    finalProcurementCost = Number(versionData.procurementCost) || 0;
  }

  // 7. Prepare payload from versionData without system fields
  const { id, createdAt, createdBy, updatedAt, updatedBy, history, ...rest } = versionData as any;
  const cleanData = deepCleanUndefined(rest);

  const updatePayload: Record<string, any> = {
    ...cleanData,
    lineItems: normalizedItems,
    procurementCost: finalProcurementCost,
    pCost: deleteField(),
    updatedAt: serverTimestamp(),
    updatedBy: userEmail,
  };

  await updateDoc(docRef, updatePayload);
  const snap = await getDoc(docRef);
  const finalData = { id: targetId, ...snap.data() } as any;

  return {
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
