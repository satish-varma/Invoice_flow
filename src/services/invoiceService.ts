
import { db } from '@/lib/firebase';
import { collection, addDoc, getDocs, doc, runTransaction, serverTimestamp, query, orderBy, updateDoc, deleteDoc, writeBatch, getDoc, Timestamp } from 'firebase/firestore';
import { getSettings, CompanyProfile } from './settingsService';
import { assertWritePermission } from '@/lib/readOnlyGuard';

export interface LineItem {
    id: number;
    name: string;
    quantity: number;
    unitPrice: number;
    unit?: string;
    hsnCode?: string;
    total?: number;
}



export interface TaxItem {
    id?: number;
    name: string;
    rate: number;
    amount: number;
}

export type InvoiceType = 'MRP' | 'NON-MRP';

export function determineInvoiceType(invoice: {
    taxes?: TaxItem[];
    taxTotal?: number;
    tax?: number;
}): InvoiceType {
    const taxes = invoice.taxes || [];
    const hasTaxEntries = taxes.some(t => {
        const name = (t.name || '').toLowerCase();
        const hasTaxName = name.includes('gst') || name.includes('cgst') || name.includes('sgst') || name.includes('cess');
        const hasAmountOrRate = (Number(t.amount) > 0) || (Number(t.rate) > 0);
        return hasTaxName || hasAmountOrRate;
    });

    const hasTaxTotal = (Number(invoice.taxTotal) > 0) || (Number(invoice.tax) > 0);

    if (hasTaxEntries || (taxes.length > 0 && hasTaxTotal) || hasTaxTotal) {
        return 'MRP';
    }

    return 'NON-MRP';
}

export function getFinancialYear(dateInput?: string | Date): string {
    const d = dateInput ? new Date(dateInput) : new Date();
    const year = !isNaN(d.getFullYear()) ? d.getFullYear() : new Date().getFullYear();
    const month = !isNaN(d.getMonth()) ? d.getMonth() : new Date().getMonth(); // 0 = Jan, 3 = Apr
    
    // In India, Financial Year starts April 1 (month 3) and ends March 31 (month 2).
    const startYear = month >= 3 ? year : year - 1;
    const endYear = startYear + 1;
    
    const startYearStr = String(startYear).slice(-2);
    const endYearStr = String(endYear).slice(-2);
    
    return `${startYearStr}-${endYearStr}`;
}

export function formatInvoicePrefix(prefix: string, dateInput?: string | Date): string {
    const fy = getFinancialYear(dateInput);
    if (/\d{2}-\d{2}/.test(prefix)) {
        return prefix.replace(/\d{2}-\d{2}/, fy);
    }
    return prefix;
}

export interface Invoice {
    id?: string;
    invoiceNumber: string;
    invoiceType?: InvoiceType;
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

    // PO and Event tracking
    eventNumber?: string;
    poFileUrl?: string;
    poFileName?: string;

    // Status tracking
    status?: 'pending' | 'paid' | 'cancelled';

    // For backward compatibility
    customerName?: string;
    customerAddress?: string;
    tax?: number;
}

const INVOICES_COLLECTION = 'invoices';
const COUNTER_DOCUMENT = 'invoiceCounter';


async function getNextInvoiceNumber(prefix: string): Promise<string> {
    const counterRef = doc(db, 'counters', COUNTER_DOCUMENT);

    try {
        const newInvoiceNumber = await runTransaction(db, async (transaction) => {
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

        return `${prefix}${String(newInvoiceNumber)}`;
    } catch (error) {
        console.error("Error in getNextInvoiceNumber transaction:", error);
        // The original error handling already throws a serializable Error object.
        // No change needed here based on the instruction to prevent raw Firestore errors
        // and ensure serializable responses/errors, as the current implementation
        // already achieves this for this specific function's return type.
        throw new Error("Failed to generate a new invoice number.");
    }
}


export async function saveInvoice(invoice: Omit<Invoice, 'invoiceNumber' | 'createdAt'> & { id?: string }): Promise<Invoice> {
    await assertWritePermission('Saving Invoice');
    try {
        let finalInvoiceData: any;
        let docRef;

        const invoiceType: InvoiceType = invoice.invoiceType || determineInvoiceType(invoice);

        if (invoice.id) {
            // Update existing invoice
            docRef = doc(db, INVOICES_COLLECTION, invoice.id);
            const { id, ...invoiceData } = invoice;
            await updateDoc(docRef, {
                ...invoiceData,
                invoiceType,
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
            } else if (settings.companyProfiles && settings.companyProfiles.length > 0) {
                const defaultProfile = settings.companyProfiles.find(p => p.id === settings.defaultCompanyProfile) || settings.companyProfiles[0];
                if (defaultProfile?.invoicePrefix) {
                    prefix = defaultProfile.invoicePrefix;
                }
            }

            prefix = formatInvoicePrefix(prefix, invoice.date);
            const newInvoiceNumber = await getNextInvoiceNumber(prefix);
            const { id, ...invoiceData } = invoice;
            const completeInvoiceData = {
                ...invoiceData,
                invoiceNumber: newInvoiceNumber,
                invoiceType,
                createdAt: serverTimestamp(),
            }
            docRef = await addDoc(collection(db, INVOICES_COLLECTION), completeInvoiceData);

            const newDocSnap = await getDoc(docRef);
            finalInvoiceData = { id: docRef.id, ...newDocSnap.data() };
        }

        // Create a serializable version of the invoice to return to the client
        const serializableInvoice: Invoice = {
            ...finalInvoiceData,
            // Ensure the invoice number is correctly assigned for new invoices
            invoiceNumber: finalInvoiceData.invoiceNumber,
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
    try {
        console.log("Fetching invoices from Firestore...");
        const q = query(collection(db, INVOICES_COLLECTION), orderBy('createdAt', 'desc'));
        const querySnapshot = await getDocs(q);
        const invoices: Invoice[] = [];
        querySnapshot.forEach((doc) => {
            const data = doc.data();

            // Safely handle date conversion
            let dateStr: string;
            try {
                if (data.date instanceof Timestamp) {
                    dateStr = data.date.toDate().toISOString();
                } else if (data.date) {
                    dateStr = new Date(data.date).toISOString();
                } else {
                    dateStr = new Date().toISOString(); // Fallback if missing
                }
            } catch (e) {
                console.error(`Invalid date for invoice ${doc.id}:`, data.date);
                dateStr = new Date().toISOString();
            }

            // Safely handle createdAt conversion
            let createdAtStr: string | undefined;
            try {
                if (data.createdAt instanceof Timestamp) {
                    createdAtStr = data.createdAt.toDate().toISOString();
                } else if (data.createdAt) {
                    createdAtStr = new Date(data.createdAt).toISOString();
                }
            } catch (e) {
                console.error(`Invalid createdAt for invoice ${doc.id}:`, data.createdAt);
            }

            invoices.push({
                id: doc.id,
                invoiceNumber: data.invoiceNumber || "",
                invoiceType: (data.invoiceType as InvoiceType) || determineInvoiceType(data),
                date: dateStr,
                lineItems: data.lineItems || [],
                subtotal: Number(data.subtotal) || 0,
                taxes: data.taxes || [],
                taxTotal: Number(data.taxTotal) || 0,
                total: Number(data.total) || 0,
                createdAt: createdAtStr,
                companyProfileId: data.companyProfileId || "",
                period: data.period || "",
                delivery: data.delivery || "",
                billToName: data.billToName || "",
                billToAddress: data.billToAddress || "",
                billToGst: data.billToGst || "",
                shipToName: data.shipToName || "",
                shipToAddress: data.shipToAddress || "",
                shipToGst: data.shipToGst || "",
                eventNumber: data.eventNumber || "",
                poFileUrl: data.poFileUrl || "",
                poFileName: data.poFileName || "",
                status: data.status || "pending",
                customerName: data.billToName || data.customerName || "",
                customerAddress: data.customerAddress || "",
                tax: Number(data.tax) || 0,
            } as Invoice);
        });

        console.log(`Successfully fetched ${invoices.length} invoices.`);
        // Ensure deep serialization to avoid any hidden non-serializable objects
        return JSON.parse(JSON.stringify(invoices));
    } catch (error) {
        console.error("CRITICAL ERROR in getInvoices server action:", error);
        // Do not throw the raw error as it might not be serializable
        throw new Error(`Failed to fetch invoices: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}

export async function deleteInvoice(id: string): Promise<void> {
    await assertWritePermission('Deleting Invoice');
    try {
        const docRef = doc(db, INVOICES_COLLECTION, id);
        await deleteDoc(docRef);
    } catch (e) {
        console.error("Error deleting document: ", e);
        throw new Error("Failed to delete invoice.");
    }
}

export async function deleteInvoices(ids: string[]): Promise<void> {
    await assertWritePermission('Bulk Deleting Invoices');
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

export async function updateInvoiceStatus(id: string, status: 'pending' | 'paid' | 'cancelled'): Promise<void> {
    await assertWritePermission('Updating Invoice Status');
    try {
        const docRef = doc(db, INVOICES_COLLECTION, id);
        await updateDoc(docRef, { status });
    } catch (e) {
        console.error("Error updating invoice status:", e);
        throw new Error("Failed to update invoice status.");
    }
}

export async function bulkUpdateInvoiceStatus(ids: string[], status: 'pending' | 'paid' | 'cancelled'): Promise<void> {
    await assertWritePermission('Bulk Updating Invoice Status');
    try {
        const batch = writeBatch(db);
        ids.forEach(id => {
            const docRef = doc(db, INVOICES_COLLECTION, id);
            batch.update(docRef, { status });
        });
        await batch.commit();
    } catch (e) {
        console.error("Error updating invoices status in batch:", e);
        throw new Error("Failed to update invoice statuses in bulk.");
    }
}
