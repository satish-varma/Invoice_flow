
'use server';

import { db } from '@/lib/firebase';
import { collection, addDoc, getDocs, doc, runTransaction, serverTimestamp, query, orderBy, updateDoc, deleteDoc, writeBatch, getDoc } from 'firebase/firestore';
import { getSettings, CompanyProfile } from './settingsService';

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

async function getNextInvoiceNumber(companyProfileId?: string): Promise<string> {
    const counterRef = doc(db, 'counters', COUNTER_DOCUMENT);
    const settings = await getSettings();
    
    let prefix = 'INV-'; // Default prefix
    if (companyProfileId) {
        const profile = settings.companyProfiles?.find(p => p.id === companyProfileId);
        if (profile?.invoicePrefix) {
            prefix = profile.invoicePrefix;
        }
    }

    const newInvoiceNumber = await runTransaction(db, async (transaction) => {
        const counterDoc = await transaction.get(counterRef);
        let nextNumber = 1; 
        if (counterDoc.exists()) {
            nextNumber = counterDoc.data().currentNumber + 1;
        }
        transaction.set(counterRef, { currentNumber: nextNumber }, { merge: true });
        return nextNumber;
    });

    return `${prefix}${String(newInvoiceNumber)}`;
}


export async function saveInvoice(invoice: Omit<Invoice, 'invoiceNumber' | 'createdAt'> & {id?: string}): Promise<Invoice> {
  try {
    let savedInvoiceId: string;
    let fullInvoice: Invoice;

    if (invoice.id) {
      // Update existing invoice
      const docRef = doc(db, INVOICES_COLLECTION, invoice.id);
      const { id, ...invoiceData } = invoice;
      await updateDoc(docRef, {
        ...invoiceData,
      });
      savedInvoiceId = invoice.id;
      const updatedDoc = await getDoc(docRef);
      fullInvoice = { id: savedInvoiceId, ...updatedDoc.data() } as Invoice;

    } else {
      // Create new invoice
      const invoiceNumber = await getNextInvoiceNumber(invoice.companyProfileId);
      const { id, ...invoiceData } = invoice;
      const completeInvoiceData = {
        ...invoiceData,
        invoiceNumber,
        createdAt: serverTimestamp(),
      }
      const docRef = await addDoc(collection(db, INVOICES_COLLECTION), completeInvoiceData);
      savedInvoiceId = docRef.id;
      fullInvoice = { id: savedInvoiceId, ...completeInvoiceData } as Invoice;
    }

    // Convert date objects for serialization
    if (fullInvoice.date && typeof fullInvoice.date !== 'string') {
        fullInvoice.date = (fullInvoice.date as any).toDate().toISOString();
    }
    if (fullInvoice.createdAt && typeof fullInvoice.createdAt !== 'string') {
       fullInvoice.createdAt = (fullInvoice.createdAt as any).toDate().toISOString();
    }


    return fullInvoice;

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
