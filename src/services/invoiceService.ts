
'use server';

import { db } from '@/lib/firebase';
import { collection, addDoc, getDocs, doc, runTransaction, serverTimestamp, query, orderBy } from 'firebase/firestore';

export interface LineItem {
  id: number;
  name: string;
  quantity: number;
  price: number;
}

export interface Invoice {
  id?: string;
  invoiceNumber: string;
  customerName: string;
  customerAddress: string;
  date: string; // Storing date as ISO string
  lineItems: LineItem[];
  subtotal: number;
  tax: number;
  total: number;
  createdAt?: any;
}

const INVOICES_COLLECTION = 'invoices';
const COUNTER_DOCUMENT = 'invoiceCounter';

async function getNextInvoiceNumber(): Promise<string> {
    const counterRef = doc(db, 'counters', COUNTER_DOCUMENT);

    const newInvoiceNumber = await runTransaction(db, async (transaction) => {
        const counterDoc = await transaction.get(counterRef);
        let nextNumber = 1;
        if (counterDoc.exists()) {
            nextNumber = counterDoc.data().currentNumber + 1;
        }
        transaction.set(counterRef, { currentNumber: nextNumber }, { merge: true });
        return nextNumber;
    });

    return `INV-${String(newInvoiceNumber).padStart(3, '0')}`;
}


export async function saveInvoice(invoice: Omit<Invoice, 'id' | 'invoiceNumber' | 'createdAt'>): Promise<string> {
  try {
    const invoiceNumber = await getNextInvoiceNumber();
    const docRef = await addDoc(collection(db, INVOICES_COLLECTION), {
      ...invoice,
      invoiceNumber,
      createdAt: serverTimestamp(),
    });
    return docRef.id;
  } catch (e) {
    console.error("Error adding document: ", e);
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
            // Convert Firestore Timestamp to a serializable format if needed
            date: new Date(data.date).toISOString(),
            createdAt: data.createdAt?.toDate().toISOString(),
        } as Invoice);
    });
    return invoices;
}

