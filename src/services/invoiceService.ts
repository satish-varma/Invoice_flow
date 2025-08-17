
'use server';

import { db } from '@/lib/firebase';
import { collection, addDoc, getDocs, doc, runTransaction, serverTimestamp, query, orderBy, updateDoc, deleteDoc, writeBatch } from 'firebase/firestore';

export interface LineItem {
  id: number;
  name: string;
  quantity: number;
  price: number;
}

export interface Invoice {
  id?: string;
  invoiceNumber: string;
  date: string; // Storing date as ISO string
  lineItems: LineItem[];
  subtotal: number;
  total: number;
  createdAt?: any;
  
  // New fields from the template
  period?: string;
  delivery?: string;
  billToName?: string;
  billToAddress?: string;
  billToGst?: string;
  shipToName?: string;
  shipToAddress?: string;
  shipToGst?: string;

  // Deprecated fields, can be removed after migration
  customerName: string;
  customerAddress: string;
  tax: number;
}

const INVOICES_COLLECTION = 'invoices';
const COUNTER_DOCUMENT = 'invoiceCounter';

async function getNextInvoiceNumber(): Promise<string> {
    const counterRef = doc(db, 'counters', COUNTER_DOCUMENT);

    const newInvoiceNumber = await runTransaction(db, async (transaction) => {
        const counterDoc = await transaction.get(counterRef);
        // Using a fixed prefix and number for consistency with the image
        let nextNumber = 2405; 
        if (counterDoc.exists()) {
            nextNumber = counterDoc.data().currentNumber + 1;
        }
        transaction.set(counterRef, { currentNumber: nextNumber }, { merge: true });
        return nextNumber;
    });

    return `TGGHS/25-26/${String(newInvoiceNumber)}`;
}


export async function saveInvoice(invoice: Omit<Invoice, 'invoiceNumber' | 'createdAt'> & {id?: string}): Promise<string> {
  try {
    if (invoice.id) {
      // Update existing invoice
      const docRef = doc(db, INVOICES_COLLECTION, invoice.id);
      const { id, ...invoiceData } = invoice;
      await updateDoc(docRef, {
        ...invoiceData,
      });
      return invoice.id;
    } else {
      // Create new invoice
      const invoiceNumber = await getNextInvoiceNumber();
      const { id, ...invoiceData } = invoice;
      const docRef = await addDoc(collection(db, INVOICES_COLLECTION), {
        ...invoiceData,
        invoiceNumber,
        createdAt: serverTimestamp(),
      });
      return docRef.id;
    }
  } catch (e) {
    console.error("Error adding/updating document: ", e);
    throw new Error("Failed to save invoice.");
  }
}


export async function getInvoices(): Promise<Invoice[]> {
    const q = query(collection(db, INVOICES_COLLECTION), orderBy("createdAt", "desc"));
    const querySnapshot = await getDocs(q);
    const invoices: Invoice[] = [];
    querySnapshot.forEach((doc) => {
        const data = doc.data();
        invoices.push({ 
            id: doc.id,
            ...data,
            customerName: data.billToName || data.customerName, // Fallback for old data
            // Convert Firestore Timestamp to a serializable format if needed
            date: new Date(data.date).toISOString(),
            createdAt: data.createdAt?.toDate().toISOString(),
        } as Invoice);
    });
    return invoices;
}

export async function deleteInvoice(id: string): Promise<void> {
    try {
        const docRef = doc(db, INVOICES_COLLECTION, id);
        await deleteDoc(docRef);
    } catch (e) {
        console.error("Error deleting document: ", e);
        throw new Error("Failed to delete invoice.");
    }
}

export async function deleteInvoices(ids: string[]): Promise<void> {
    try {
        const batch = writeBatch(db);
        ids.forEach(id => {
            const docRef = doc(db, INVOICES_COLLECTION, id);
            batch.delete(docRef);
        });
        await batch.commit();
    } catch (e) {
        console.error("Error deleting documents in batch: ", e);
        throw new Error("Failed to delete invoices.");
    }
}
