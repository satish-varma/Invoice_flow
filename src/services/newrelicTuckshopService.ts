import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  orderBy,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  Timestamp,
  limit,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { assertWritePermission } from '@/lib/readOnlyGuard';

import { SiteId } from '@/types/site';

export const NEWRELIC_TUCKSHOP_COLLECTION = 'newrelic_tuckshop';

export type TuckshopType = 'expense' | 'sale';

export interface NewRelicTuckshopRecord {
  id?: string;
  siteId?: SiteId; // Company site: 'newrelic' | 'dsm' | 'ntt_data' (defaults to 'newrelic')
  date: string; // ISO string
  location: string;
  type: TuckshopType;
  category: string; // Now fully dynamic
  amount: number;
  description?: string;
  billUrl?: string; // Link to uploaded bill in Storage
  createdAt?: string | Timestamp | any;
  createdBy?: string | null;
  updatedAt?: string | Timestamp | any;
  updatedBy?: string | null;
}

export const subscribeToTuckshopRecords = (
  callback: (records: NewRelicTuckshopRecord[]) => void,
  siteIdFilter?: string
) => {
  const q = query(collection(db, NEWRELIC_TUCKSHOP_COLLECTION), orderBy('date', 'desc'), limit(1000));
  
  return onSnapshot(q, (snapshot) => {
    let records = snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        siteId: (data.siteId as SiteId) || 'newrelic',
        date: data.date instanceof Timestamp ? data.date.toDate().toISOString() : data.date,
        createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate().toISOString() : data.createdAt,
        updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt.toDate().toISOString() : data.updatedAt,
      } as NewRelicTuckshopRecord;
    });
    if (siteIdFilter) {
      records = records.filter((r) => (r.siteId || 'newrelic') === siteIdFilter);
    }
    callback(records);
  }, (error) => {
    console.error("Error fetching tuckshop records:", error);
    callback([]);
  });
};

export const getTuckshopRecords = async (siteIdFilter?: string): Promise<NewRelicTuckshopRecord[]> => {
  const q = query(collection(db, NEWRELIC_TUCKSHOP_COLLECTION), orderBy('date', 'desc'), limit(1500));
  const snap = await getDocs(q);
  let records = snap.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      ...data,
      siteId: (data.siteId as SiteId) || 'newrelic',
      date: data.date instanceof Timestamp ? data.date.toDate().toISOString() : data.date,
      createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate().toISOString() : data.createdAt,
      updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt.toDate().toISOString() : data.updatedAt,
    } as NewRelicTuckshopRecord;
  });
  if (siteIdFilter) {
    records = records.filter((r) => (r.siteId || 'newrelic') === siteIdFilter);
  }
  return records;
};

export const saveTuckshopRecord = async (record: Partial<NewRelicTuckshopRecord>, userEmail: string | null): Promise<NewRelicTuckshopRecord> => {
  await assertWritePermission('Saving Tuckshop Record');
  // Deep clean undefined to prevent Firebase addDoc/updateDoc errors
  const cleanUndefined = (obj: any): any => {
    if (Array.isArray(obj)) return obj.map(cleanUndefined);
    if (obj !== null && typeof obj === 'object' && !(obj instanceof Date) && !obj.toDate) {
      const newObj: any = {};
      Object.keys(obj).forEach((key) => {
        if (obj[key] !== undefined) {
          newObj[key] = cleanUndefined(obj[key]);
        }
      });
      return newObj;
    }
    return obj;
  };

  const cleanData = cleanUndefined(record);
  const nowIso = new Date().toISOString();

  if (cleanData.id) {
    const docRef = doc(db, NEWRELIC_TUCKSHOP_COLLECTION, cleanData.id);
    const { id, ...data } = cleanData;
    await updateDoc(docRef, {
      ...data,
      updatedAt: serverTimestamp(),
      updatedBy: userEmail,
    });
    return {
      id: cleanData.id,
      ...data,
      updatedAt: nowIso,
      updatedBy: userEmail,
      date: cleanData.date || nowIso,
    } as NewRelicTuckshopRecord;
  } else {
    const { id, ...data } = cleanData;
    const completeData = {
      ...data,
      createdAt: serverTimestamp(),
      createdBy: userEmail,
      updatedAt: serverTimestamp(),
      updatedBy: userEmail,
    };
    const docRef = await addDoc(collection(db, NEWRELIC_TUCKSHOP_COLLECTION), completeData);
    return {
      id: docRef.id,
      ...completeData,
      createdAt: nowIso,
      updatedAt: nowIso,
      date: completeData.date || nowIso,
    } as NewRelicTuckshopRecord;
  }
};

export const deleteTuckshopRecord = async (id: string) => {
  await assertWritePermission('Deleting Tuckshop Record');
  await deleteDoc(doc(db, NEWRELIC_TUCKSHOP_COLLECTION, id));
};

export const uploadTuckshopBill = async (file: File): Promise<string> => {
  await assertWritePermission('Uploading Tuckshop Bill');
  const { storage } = await import('@/lib/firebase');
  const { ref, uploadBytes, getDownloadURL } = await import('firebase/storage');
  
  let uploadPayload: Blob | File = file;
  if (file.type.startsWith('image/')) {
    try {
      uploadPayload = await new Promise<Blob | File>((resolve) => {
        const reader = new FileReader();
        reader.onload = async (e) => {
          const dataUri = e.target?.result as string;
          if (!dataUri) return resolve(file);
          const { compressImage } = await import('@/lib/imageCompression');
          const compressedUri = await compressImage(dataUri, 1200, 1200, 0.75);
          const arr = compressedUri.split(',');
          const mime = arr[0].match(/:(.*?);/)?.[1] || 'image/jpeg';
          const bstr = atob(arr[1]);
          let n = bstr.length;
          const u8arr = new Uint8Array(n);
          while (n--) {
            u8arr[n] = bstr.charCodeAt(n);
          }
          resolve(new Blob([u8arr], { type: mime }));
        };
        reader.onerror = () => resolve(file);
        reader.readAsDataURL(file);
      });
    } catch (err) {
      console.warn('[Tuckshop] Image compression fallback to original:', err);
    }
  }

  const timestamp = Date.now();
  const fileExtension = file.type.startsWith('image/') ? 'jpg' : (file.name.split('.').pop() || 'dat');
  const filePath = `tuckshop_bills/${timestamp}_${Math.random().toString(36).substring(2, 9)}.${fileExtension}`;
  
  const storageRef = ref(storage, filePath);
  await uploadBytes(storageRef, uploadPayload);
  return await getDownloadURL(storageRef);
};
