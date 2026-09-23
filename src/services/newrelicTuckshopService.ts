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

export const NEWRELIC_TUCKSHOP_COLLECTION = 'newrelic_tuckshop';

export type TuckshopType = 'expense' | 'sale';

export interface NewRelicTuckshopRecord {
  id?: string;
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
  callback: (records: NewRelicTuckshopRecord[]) => void
) => {
  const q = query(collection(db, NEWRELIC_TUCKSHOP_COLLECTION), orderBy('date', 'desc'), limit(1000));
  
  return onSnapshot(q, (snapshot) => {
    const records = snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        date: data.date instanceof Timestamp ? data.date.toDate().toISOString() : data.date,
        createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate().toISOString() : data.createdAt,
        updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt.toDate().toISOString() : data.updatedAt,
      } as NewRelicTuckshopRecord;
    });
    callback(records);
  }, (error) => {
    console.error("Error fetching tuckshop records:", error);
    callback([]);
  });
};

export const saveTuckshopRecord = async (record: Partial<NewRelicTuckshopRecord>, userEmail: string | null): Promise<NewRelicTuckshopRecord> => {
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
  let finalData: any;

  if (cleanData.id) {
    const docRef = doc(db, NEWRELIC_TUCKSHOP_COLLECTION, cleanData.id);
    const { id, ...data } = cleanData;
    await updateDoc(docRef, {
      ...data,
      updatedAt: serverTimestamp(),
      updatedBy: userEmail,
    });
    const snap = await getDoc(docRef);
    finalData = { id: cleanData.id, ...snap.data() };
  } else {
    const { id, ...data } = cleanData;
    const completeData = {
      ...data,
      createdAt: serverTimestamp(),
      createdBy: userEmail,
    };
    const docRef = await addDoc(collection(db, NEWRELIC_TUCKSHOP_COLLECTION), completeData);
    const snap = await getDoc(docRef);
    finalData = { id: docRef.id, ...snap.data() };
  }

  return {
    ...finalData,
    date: finalData.date instanceof Timestamp ? finalData.date.toDate().toISOString() : finalData.date,
    createdAt: finalData.createdAt instanceof Timestamp ? finalData.createdAt.toDate().toISOString() : finalData.createdAt,
  } as NewRelicTuckshopRecord;
};

export const deleteTuckshopRecord = async (id: string) => {
  await deleteDoc(doc(db, NEWRELIC_TUCKSHOP_COLLECTION, id));
};

export const uploadTuckshopBill = async (file: File): Promise<string> => {
  // Requires "import { storage } from '@/lib/firebase'" and "import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'"
  const { storage } = await import('@/lib/firebase');
  const { ref, uploadBytes, getDownloadURL } = await import('firebase/storage');
  
  const timestamp = Date.now();
  const fileExtension = file.name.split('.').pop();
  const filePath = `tuckshop_bills/${timestamp}_${Math.random().toString(36).substring(2, 9)}.${fileExtension}`;
  
  const storageRef = ref(storage, filePath);
  await uploadBytes(storageRef, file);
  return await getDownloadURL(storageRef);
};
