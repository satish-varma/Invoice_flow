
'use server';

import { db } from '@/lib/firebase';
import { collection, addDoc, getDocs, doc, runTransaction, serverTimestamp, query, orderBy, updateDoc, deleteDoc, writeBatch, getDoc, Timestamp } from 'firebase/firestore';
import { getSettings, CompanyProfile } from './settingsService';

export interface LineItem {
  id: number;
  name: string;
  quantity: number;
  price: number;
}

export interface TaxItem {
  id?: number;
  name: string;
  rate: number; // Will be 0 for manual entry but kept for structure
  amount: number;
}

export interface Invoice {
  id?: string;
  invoiceNumber: string;
  date: string; // Storing date as ISO string
  lineItems: LineItem[];
  subtotal: number;
  taxes?: TaxItem[];
  taxTotal: number;
  total: number;
  createdAt?: any;
  
  // Store the ID of the company profile used for this invoice
  companyProfileId?: string; 
  
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

async function getNextInvoiceNumber(prefix: string): Promise<string> {
    const counterRef = doc(db, 'counters', COUNTER_DOCUMENT);

    const newInvoiceNumber = await runTransaction(db, async (transaction) => {
        const counterDoc = await transaction.get(counterRef);
        let nextNumber = 1; 
        if (counterDoc.exists()) {
            const data = counterDoc.data();
            const currentNumber = (data && data.currentNumber) ? data.currentNumber : 0;
            nextNumber = currentNumber + 1;
        }
        transaction.set(counterRef, { currentNumber: nextNumber }, { merge: true });
        return nextNumber;
    });

    return `${prefix}${String(newInvoiceNumber)}`;
}


export async function saveInvoice(invoice: Omit<Invoice, 'invoiceNumber' | 'createdAt'> & {id?: string}): Promise<Invoice> {
  try {
    let finalInvoiceData: any;

    if (invoice.id) {
      // Update existing invoice
      const docRef = doc(db, INVOICES_COLLECTION, invoice.id);
      const { id, ...invoiceData } = invoice;
      await updateDoc(docRef, {
        ...invoiceData,
      });
      const updatedDocSnap = await getDoc(docRef);
      finalInvoiceData = { id: invoice.id, ...updatedDocSnap.data() };
    } else {
      // Create new invoice
      const settings = await getSettings();
      let prefix = 'INV-'; // Default prefix
      if (invoice.companyProfileId) {
          const profile = settings.companyProfiles?.find(p => p.id === invoice.companyProfileId);
          if (profile?.invoicePrefix) {
              prefix = profile.invoicePrefix;
          }
      }

      const invoiceNumber = await getNextInvoiceNumber(prefix);
      const { id, ...invoiceData } = invoice;
      const completeInvoiceData = {
        ...invoiceData,
        invoiceNumber,
        createdAt: serverTimestamp(),
      }
      const docRef = await addDoc(collection(db, INVOICES_COLLECTION), completeInvoiceData);
      
      const newDocSnap = await getDoc(docRef);
      finalInvoiceData = { id: docRef.id, ...newDocSnap.data() };
    }

    // Create a serializable version of the invoice to return to the client
    const serializableInvoice: Invoice = {
      ...finalInvoiceData,
      // Convert Firestore Timestamp or Date object to ISO string
      date: finalInvoiceData.date instanceof Timestamp ? finalInvoiceData.date.toDate().toISOString() : new Date(finalInvoiceData.date).toISOString(),
      createdAt: finalInvoiceData.createdAt instanceof Timestamp ? finalInvoiceData.createdAt.toDate().toISOString() : new Date().toISOString(),
    };

    return serializableInvoice;

  } catch (e) {
    console.error("Error adding/updating document: ", e);
    const errorMessage = e instanceof Error ? e.message : "An unknown error occurred.";
    throw new Error(`Failed to save invoice: ${errorMessage}`);
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
