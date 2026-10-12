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
      siteId: request.siteId || 'newrelic',
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

export async function getStockRequests(location?: NewRelicLocation, siteId?: string): Promise<StockRequest[]> {
  try {
    let q = query(collection(db, STOCK_REQUEST_COLLECTION));
    if (location) {
      q = query(q, where('location', '==', location));
    }
    
    const snap = await getDocs(q);
    let requests: StockRequest[] = [];
    snap.forEach((d) => {
      const data = d.data();
      requests.push({
        id: d.id,
        ...data,
        siteId: data.siteId || 'newrelic',
      } as StockRequest);
    });

    if (siteId) {
      requests = requests.filter((r) => (r.siteId || 'newrelic') === siteId);
    }

    // In-memory sort by createdAt desc (or requestDate) to avoid composite index requirements
    return requests.sort((a, b) => {
      const timeA = a.createdAt ? new Date(a.createdAt).getTime() : (a.requestDate ? new Date(a.requestDate).getTime() : 0);
      const timeB = b.createdAt ? new Date(b.createdAt).getTime() : (b.requestDate ? new Date(b.requestDate).getTime() : 0);
      return timeB - timeA;
    });
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

export async function updateStockRequestFulfillment(id: string, lineItems: StockRequest['lineItems'], status: StockRequest['status']): Promise<void> {
  try {
    const docRef = doc(db, STOCK_REQUEST_COLLECTION, id);
    await setDoc(docRef, { lineItems, status, updatedAt: serverTimestamp() }, { merge: true });
  } catch (error) {
    console.error('Error updating stock request fulfillment:', error);
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
