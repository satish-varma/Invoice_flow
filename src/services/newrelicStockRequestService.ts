import { db } from '@/lib/firebase';
import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
  deleteDoc,
} from 'firebase/firestore';
import { StockRequest } from '@/types/stockRequest';
import { NewRelicLocation } from '@/types/challan';

export const STOCK_REQUEST_COLLECTION = 'newrelic_stock_requests';

export async function saveStockRequest(request: Omit<StockRequest, 'id'>, id?: string): Promise<string> {
  try {
    const docRef = id 
      ? doc(db, STOCK_REQUEST_COLLECTION, id)
      : doc(collection(db, STOCK_REQUEST_COLLECTION));
      
    const dataToSave = {
      ...request,
      updatedAt: serverTimestamp(),
      ...(id ? {} : { createdAt: serverTimestamp() }),
    };

    await setDoc(docRef, dataToSave, { merge: true });
    return docRef.id;
  } catch (error) {
    console.error('Error saving stock request:', error);
    throw error;
  }
}

export async function getStockRequests(location?: NewRelicLocation): Promise<StockRequest[]> {
  try {
    let q = query(collection(db, STOCK_REQUEST_COLLECTION), orderBy('createdAt', 'desc'));
    if (location) {
      q = query(q, where('location', '==', location));
    }
    
    const snap = await getDocs(q);
    const requests: StockRequest[] = [];
    snap.forEach((d) => {
      requests.push({ id: d.id, ...d.data() } as StockRequest);
    });
    return requests;
  } catch (error) {
    console.error('Error fetching stock requests:', error);
    throw error;
  }
}

export async function updateStockRequestStatus(id: string, status: StockRequest['status']): Promise<void> {
  try {
    const docRef = doc(db, STOCK_REQUEST_COLLECTION, id);
    await setDoc(docRef, { status, updatedAt: serverTimestamp() }, { merge: true });
  } catch (error) {
    console.error('Error updating stock request status:', error);
    throw error;
  }
}

export async function deleteStockRequest(id: string): Promise<void> {
  try {
    const docRef = doc(db, STOCK_REQUEST_COLLECTION, id);
    await deleteDoc(docRef);
  } catch (error) {
    console.error('Error deleting stock request:', error);
    throw error;
  }
}
