
'use server';

import { db } from '@/lib/firebase';
import { collection, addDoc, getDocs, doc, runTransaction, serverTimestamp, query, orderBy, updateDoc, deleteDoc, writeBatch, getDoc, Timestamp } from 'firebase/firestore';

export interface ColumnDef {
  id: string;
  label: string;
}

export interface QuotationLineItem {
  id: number;
  name: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  total: number;
  customFields?: { [key: string]: string | number };
  discount?: number;
}

export interface Quotation {
  id?: string;
  quotationNumber: string;
  quotationDate: string; // Storing date as ISO string
  validityDate: string; // Storing date as ISO string
  columns?: ColumnDef[];
  lineItems: QuotationLineItem[];
  subtotal: number;
  gstAmount: number;
  shipping: number;
  other: number;
  totalDiscount?: number;
  total: number;
  terms?: string;
  createdAt?: any;

  companyProfileId?: string;

  billToName?: string;
  billToAddress?: string;
}

const QUOTATIONS_COLLECTION = 'quotations';
const COUNTER_DOCUMENT = 'quotationCounter';

async function getNextQuotationNumber(prefix: string): Promise<string> {
  const counterRef = doc(db, 'counters', COUNTER_DOCUMENT);

  try {
    const newQuotationNumber = await runTransaction(db, async (transaction) => {
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

    const year = new Date().getFullYear().toString().slice(-2);
    const nextYear = (parseInt(year) + 1).toString();
    return `${prefix}${year}-${nextYear}/${newQuotationNumber}`;

  } catch (error) {
    console.error("Error in getNextQuotationNumber transaction:", error);
    throw new Error("Failed to generate a new quotation number.");
  }
}


export async function saveQuotation(quotation: Omit<Quotation, 'quotationNumber' | 'createdAt'> & { id?: string }): Promise<Quotation> {
  try {
    let finalQuotationData: any;
    let newQuotationNumber: string | null = null;

    if (quotation.id) {
      // Update existing quotation
      const docRef = doc(db, QUOTATIONS_COLLECTION, quotation.id);
      const { id, ...quotationData } = quotation;
      await updateDoc(docRef, {
        ...quotationData,
      });
      const updatedDocSnap = await getDoc(docRef);
      finalQuotationData = { id: quotation.id, ...updatedDocSnap.data() };
    } else {
      // Create new quotation
      const prefix = "TGG/QTN/";
      newQuotationNumber = await getNextQuotationNumber(prefix);
      const { id, ...quotationData } = quotation;
      const completeQuotationData = {
        ...quotationData,
        quotationNumber: newQuotationNumber,
        createdAt: serverTimestamp(),
      }
      const docRef = await addDoc(collection(db, QUOTATIONS_COLLECTION), completeQuotationData);

      const newDocSnap = await getDoc(docRef);
      finalQuotationData = { id: docRef.id, ...newDocSnap.data() };
    }

    const serializableQuotation: Quotation = {
      ...finalQuotationData,
      quotationNumber: newQuotationNumber || finalQuotationData.quotationNumber,
      quotationDate: finalQuotationData.quotationDate instanceof Timestamp ? finalQuotationData.quotationDate.toDate().toISOString() : new Date(finalQuotationData.quotationDate).toISOString(),
      validityDate: finalQuotationData.validityDate instanceof Timestamp ? finalQuotationData.validityDate.toDate().toISOString() : new Date(finalQuotationData.validityDate).toISOString(),
      createdAt: finalQuotationData.createdAt instanceof Timestamp ? finalQuotationData.createdAt.toDate().toISOString() : new Date().toISOString(),
    };

    return serializableQuotation;

  } catch (e) {
    console.error("Error adding/updating document: ", e);
    const errorMessage = e instanceof Error ? e.message : "An unknown error occurred.";
    throw new Error(`Failed to save quotation: ${errorMessage}`);
  }
}


export async function getQuotations(): Promise<Quotation[]> {
  try {
    console.log("Fetching quotations from Firestore...");
    const q = query(collection(db, QUOTATIONS_COLLECTION), orderBy("createdAt", "desc"));
    const querySnapshot = await getDocs(q);
    const quotations: Quotation[] = [];
    querySnapshot.forEach((doc) => {
      const data = doc.data();

      // Safe date handling
      let qDate: string;
      try {
        if (data.quotationDate instanceof Timestamp) {
          qDate = data.quotationDate.toDate().toISOString();
        } else if (data.quotationDate) {
          qDate = new Date(data.quotationDate).toISOString();
        } else {
          qDate = new Date().toISOString();
        }
      } catch (e) {
        qDate = new Date().toISOString();
      }

      let vDate: string;
      try {
        if (data.validityDate instanceof Timestamp) {
          vDate = data.validityDate.toDate().toISOString();
        } else if (data.validityDate) {
          vDate = new Date(data.validityDate).toISOString();
        } else {
          vDate = new Date().toISOString();
        }
      } catch (e) {
        vDate = new Date().toISOString();
      }

      let cAt: string | undefined;
      try {
        if (data.createdAt instanceof Timestamp) {
          cAt = data.createdAt.toDate().toISOString();
        } else if (data.createdAt) {
          cAt = new Date(data.createdAt).toISOString();
        }
      } catch (e) { }

      quotations.push({
        id: doc.id,
        ...data,
        quotationDate: qDate,
        validityDate: vDate,
        createdAt: cAt,
      } as Quotation);
    });

    console.log(`Successfully fetched ${quotations.length} quotations.`);
    return JSON.parse(JSON.stringify(quotations));
  } catch (error) {
    console.error("Error in getQuotations:", error);
    // Return an empty array on error to prevent crashing the client
    return [];
  }
}

export async function deleteQuotation(id: string): Promise<void> {
  try {
    const docRef = doc(db, QUOTATIONS_COLLECTION, id);
    await deleteDoc(docRef);
  } catch (e) {
    console.error("Error deleting document: ", e);
    throw new Error("Failed to delete quotation.");
  }
}

export async function deleteQuotations(ids: string[]): Promise<void> {
  try {
    const batch = writeBatch(db);
    ids.forEach(id => {
      const docRef = doc(db, QUOTATIONS_COLLECTION, id);
      batch.delete(docRef);
    });
    await batch.commit();
  } catch (e) {
    console.error("Error deleting documents in batch: ", e);
    throw new Error("Failed to delete quotations.");
  }
}
