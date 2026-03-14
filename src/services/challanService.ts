
'use server';

import { db } from '@/lib/firebase';
import { collection, addDoc, getDocs, doc, runTransaction, serverTimestamp, query, orderBy, updateDoc, deleteDoc, writeBatch, getDoc, Timestamp } from 'firebase/firestore';

export interface ChallanLineItem {
  id: number;
  name: string;
  hsnCode: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface Challan {
  id?: string;
  dcNumber: string;
  dcDate: string; // Storing date as ISO string
  lineItems: ChallanLineItem[];
  subtotal: number;
  gstAmount: number;
  shipping: number;
  other: number;
  total: number;
  note?: string;
  createdAt?: any;

  companyProfileId?: string;

  billToName?: string;
  billToAddress?: string;
  shipToName?: string;
  shipToAddress?: string;
}

const CHALLANS_COLLECTION = 'challans';
const COUNTER_DOCUMENT = 'challanCounter';

async function getNextChallanNumber(prefix: string): Promise<string> {
  const counterRef = doc(db, 'counters', COUNTER_DOCUMENT);

  try {
    const newChallanNumber = await runTransaction(db, async (transaction) => {
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

    // Format to TGG/SL/24-25/2210 style, assuming prefix is TGG/SL/ and we need to format number
    const year = new Date().getFullYear().toString().slice(-2);
    const nextYear = (parseInt(year) + 1).toString();
    // This is a simplified version. A real app might need more robust logic for the number part.
    return `${prefix}${year}-${nextYear}/${newChallanNumber}`;

  } catch (error) {
    console.error("Error in getNextChallanNumber transaction:", error);
    throw new Error("Failed to generate a new challan number.");
  }
}


export async function saveChallan(challan: Omit<Challan, 'dcNumber' | 'createdAt'> & { id?: string }): Promise<Challan> {
  try {
    let finalChallanData: any;
    let docRef;

    if (challan.id) {
      // Update existing challan
      docRef = doc(db, CHALLANS_COLLECTION, challan.id);
      const { id, ...challanData } = challan;
      await updateDoc(docRef, {
        ...challanData,
      });
      const updatedDocSnap = await getDoc(docRef);
      finalChallanData = { id: challan.id, ...updatedDocSnap.data() };
    } else {
      // Create new challan
      // Assuming a prefix for challan numbers. This could be stored in settings.
      const prefix = "TGG/SL/";
      const newChallanNumber = await getNextChallanNumber(prefix);
      const { id, ...challanData } = challan;
      const completeChallanData = {
        ...challanData,
        dcNumber: newChallanNumber,
        createdAt: serverTimestamp(),
      }
      docRef = await addDoc(collection(db, CHALLANS_COLLECTION), completeChallanData);

      const newDocSnap = await getDoc(docRef);
      finalChallanData = { id: docRef.id, ...newDocSnap.data() };
    }

    const serializableChallan: Challan = {
      ...finalChallanData,
      dcNumber: finalChallanData.dcNumber,
      dcDate: finalChallanData.dcDate instanceof Timestamp ? finalChallanData.dcDate.toDate().toISOString() : new Date(finalChallanData.dcDate).toISOString(),
      createdAt: finalChallanData.createdAt instanceof Timestamp ? finalChallanData.createdAt.toDate().toISOString() : new Date().toISOString(),
    };

    return serializableChallan;

  } catch (e) {
    console.error("Error adding/updating document: ", e);
    const errorMessage = e instanceof Error ? e.message : "An unknown error occurred.";
    throw new Error(`Failed to save challan: ${errorMessage}`);
  }
}


export async function getChallans(): Promise<Challan[]> {
  try {
    console.log("Fetching challans from Firestore...");
    const q = query(collection(db, CHALLANS_COLLECTION), orderBy("createdAt", "desc"));
    const querySnapshot = await getDocs(q);
    const challans: Challan[] = [];
    querySnapshot.forEach((doc) => {
      const data = doc.data();

      // Safe date handling
      let dDate: string;
      try {
        if (data.dcDate instanceof Timestamp) {
          dDate = data.dcDate.toDate().toISOString();
        } else if (data.dcDate) {
          dDate = new Date(data.dcDate).toISOString();
        } else {
          dDate = new Date().toISOString();
        }
      } catch (e) {
        dDate = new Date().toISOString();
      }

      let cAt: string | undefined;
      try {
        if (data.createdAt instanceof Timestamp) {
          cAt = data.createdAt.toDate().toISOString();
        } else if (data.createdAt) {
          cAt = new Date(data.createdAt).toISOString();
        }
      } catch (e) { }

      challans.push({
        id: doc.id,
        ...data,
        dcDate: dDate,
        createdAt: cAt,
      } as Challan);
    });

    console.log(`Successfully fetched ${challans.length} challans.`);
    return JSON.parse(JSON.stringify(challans));
  } catch (error) {
    console.error("Error in getChallans:", error);
    // Return an empty array on error to prevent crashing the client
    return [];
  }
}

export async function deleteChallan(id: string): Promise<void> {
  try {
    const docRef = doc(db, CHALLANS_COLLECTION, id);
    await deleteDoc(docRef);
  } catch (e) {
    console.error("Error deleting document: ", e);
    throw new Error("Failed to delete challan.");
  }
}

export async function deleteChallans(ids: string[]): Promise<void> {
  try {
    const batch = writeBatch(db);
    ids.forEach(id => {
      const docRef = doc(db, CHALLANS_COLLECTION, id);
      batch.delete(docRef);
    });
    await batch.commit();
  } catch (e) {
    console.error("Error deleting documents in batch: ", e);
    throw new Error("Failed to delete challans.");
  }
}
