
'use server';

import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';

export interface BillToContact {
    id: string; 
    displayName: string;
    name: string;
    address: string;
    gst: string;
}

export interface ShipToContact {
    id: string; 
    displayName: string;
    name: string;
    address: string;
    gst: string;
}

export interface CompanySettings {
    companyName?: string;
    companyAddress?: string;
    companyGstin?: string;
    companyPan?: string;
    invoicePrefix?: string;
    bankBeneficiary?: string;
    bankName?: string;
    bankAccount?: string;
    bankIfsc?: string;
    bankBranch?: string;
    stampLogoUrl?: string;
}

export interface Settings extends CompanySettings {
    billToContacts?: BillToContact[];
    shipToContacts?: ShipToContact[];
    defaultBillToContact?: string; // Storing ID of the default contact
    defaultShipToContact?: string; // Storing ID of the default contact
}

const SETTINGS_COLLECTION = 'settings';
const SINGLETON_DOC_ID = 'invoiceDefaults';

export async function getSettings(): Promise<Settings> {
    try {
        const docRef = doc(db, SETTINGS_COLLECTION, SINGLETON_DOC_ID);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            return docSnap.data() as Settings;
        } else {
            const initialSettings: Settings = { 
                billToContacts: [], 
                shipToContacts: [],
                companyName: 'THE GUT GURU',
                companyAddress: 'H NO.6-46/3/A, Venkateswarao nagar, Chanda Nagar, Hyderabad-500050',
                companyGstin: '36DDTPJ6536D1Z8',
                companyPan: 'DDTPJ6536D',
                invoicePrefix: 'TGGHS/25-26/',
                bankBeneficiary: 'THE GUT GURU',
                bankName: 'HDFC BANK LTD',
                bankAccount: '50200095177481',
                bankIfsc: 'HDFC0000045',
                bankBranch: 'HYDERABAD - CHANDA NAGAR',
                stampLogoUrl: '/signature.png',
            };
            await setDoc(docRef, initialSettings);
            return initialSettings;
        }
    } catch (error) {
        console.error("Error fetching settings: ", error);
        return { billToContacts: [], shipToContacts: [] };
    }
}

export async function saveCompanySettings(companySettings: CompanySettings): Promise<void> {
    try {
        const settingsRef = doc(db, SETTINGS_COLLECTION, SINGLETON_DOC_ID);
        // Use setDoc with merge to create the document if it doesn't exist, or update it if it does.
        await setDoc(settingsRef, companySettings, { merge: true });
    } catch (error) {
        console.error("Error saving company settings: ", error);
        throw new Error("Failed to save company settings.");
    }
}


function contactExists(contacts: any[] | undefined, displayName: string): Promise<boolean> {
    if (!contacts) return Promise.resolve(false);
    return Promise.resolve(contacts.some(contact => contact.displayName === displayName));
}

export async function saveBillToContact(contact: Omit<BillToContact, 'id'>): Promise<void> {
    try {
        const settingsRef = doc(db, SETTINGS_COLLECTION, SINGLETON_DOC_ID);
        const settings = await getSettings();
        
        if (await contactExists(settings.billToContacts, contact.displayName)) {
           throw new Error("A Bill To contact with this Display Name already exists.");
        }

        const newContact: BillToContact = {
            ...contact,
            id: `${Date.now()}-${Math.random()}`, // Assign a more unique ID
        };
        
        const updatedContacts = [...(settings.billToContacts || []), newContact];
        await setDoc(settingsRef, { ...settings, billToContacts: updatedContacts }, { merge: true });

    } catch (error) {
        console.error("Error saving Bill To contact: ", error);
        if (error instanceof Error && error.message.includes("already exists")) {
            throw error;
        }
        throw new Error("Failed to save Bill To contact.");
    }
}

export async function saveShipToContact(contact: Omit<ShipToContact, 'id'>): Promise<void> {
     try {
        const settingsRef = doc(db, SETTINGS_COLLECTION, SINGLETON_DOC_ID);
        const settings = await getSettings();
        
        if (await contactExists(settings.shipToContacts, contact.displayName)) {
           throw new Error("A Ship To contact with this Display Name already exists.");
        }

        const newContact: ShipToContact = {
            ...contact,
            id: `${Date.now()}-${Math.random()}`, // Assign a more unique ID
        };
        
        const updatedContacts = [...(settings.shipToContacts || []), newContact];
        await setDoc(settingsRef, { ...settings, shipToContacts: updatedContacts }, { merge: true });

    } catch (error) {
        console.error("Error saving Ship To contact: ", error);
        if (error instanceof Error && error.message.includes("already exists")) {
            throw error;
        }
        throw new Error("Failed to save Ship To contact.");
    }
}


export async function deleteBillToContact(id: string): Promise<void> {
    try {
        const settingsRef = doc(db, SETTINGS_COLLECTION, SINGLETON_DOC_ID);
        const settings = await getSettings();
        if (!settings || !settings.billToContacts) {
            throw new Error("Settings or contacts not found");
        }
        
        const updatedContacts = settings.billToContacts.filter(c => c.id !== id);
        
        await updateDoc(settingsRef, { billToContacts: updatedContacts });

    } catch (error) {
        console.error("Error deleting Bill To contact: ", error);
        throw new Error("Failed to delete Bill To contact.");
    }
}

export async function deleteShipToContact(id: string): Promise<void> {
    try {
        const settingsRef = doc(db, SETTINGS_COLLECTION, SINGLETON_DOC_ID);
        const settings = await getSettings();
         if (!settings || !settings.shipToContacts) {
            throw new Error("Settings or contacts not found");
        }

        const updatedContacts = settings.shipToContacts.filter(c => c.id !== id);
        
        await updateDoc(settingsRef, { shipToContacts: updatedContacts });

    } catch (error) {
        console.error("Error deleting Ship To contact: ", error);
        throw new Error("Failed to delete Ship To contact.");
    }
}

export async function updateBillToContact(contact: BillToContact): Promise<void> {
    try {
        const settingsRef = doc(db, SETTINGS_COLLECTION, SINGLETON_DOC_ID);
        const settings = await getSettings();
        if (!settings || !settings.billToContacts) {
            throw new Error("Settings or contacts not found");
        }

        // Check for duplicate display name, excluding the current contact being edited
        const otherContacts = settings.billToContacts.filter(c => c.id !== contact.id);
        if (await contactExists(otherContacts, contact.displayName)) {
           throw new Error("A Bill To contact with this Display Name already exists.");
        }

        const updatedContacts = settings.billToContacts.map(c => 
            c.id === contact.id ? contact : c
        );
        await updateDoc(settingsRef, { billToContacts: updatedContacts });
    } catch (error) {
        console.error("Error updating Bill To contact: ", error);
        if (error instanceof Error && error.message.includes("already exists")) {
            throw error;
        }
        throw new Error("Failed to update Bill To contact.");
    }
}

export async function updateShipToContact(contact: ShipToContact): Promise<void> {
    try {
        const settingsRef = doc(db, SETTINGS_COLLECTION, SINGLETON_DOC_ID);
        const settings = await getSettings();
        if (!settings || !settings.shipToContacts) {
            throw new Error("Settings or contacts not found");
        }

        const otherContacts = settings.shipToContacts.filter(c => c.id !== contact.id);
         if (await contactExists(otherContacts, contact.displayName)) {
           throw new Error("A Ship To contact with this Display Name already exists.");
        }

        const updatedContacts = settings.shipToContacts.map(c => 
            c.id === contact.id ? contact : c
        );
        await updateDoc(settingsRef, { shipToContacts: updatedContacts });
    } catch (error) {
        console.error("Error updating Ship To contact: ", error);
        if (error instanceof Error && error.message.includes("already exists")) {
            throw error;
        }
        throw new Error("Failed to update Ship To contact.");
    }
}

export async function setDefaultBillToContact(id: string): Promise<void> {
    if (!id) {
        throw new Error("Cannot set default with an empty ID.");
    }
    try {
        const settingsRef = doc(db, SETTINGS_COLLECTION, SINGLETON_DOC_ID);
        await setDoc(settingsRef, { defaultBillToContact: id }, { merge: true });
    } catch (error) {
        console.error("Error setting default Bill To contact: ", error);
        throw new Error(`Failed to set default Bill To contact: ${error instanceof Error ? error.message : String(error)}`);
    }
}

export async function setDefaultShipToContact(id: string): Promise<void> {
    if (!id) {
        throw new Error("Cannot set default with an empty ID.");
    }
    try {
        const settingsRef = doc(db, SETTINGS_COLLECTION, SINGLETON_DOC_ID);
        await setDoc(settingsRef, { defaultShipToContact: id }, { merge: true });
    } catch (error) {
        console.error("Error setting default Ship To contact: ", error);
        throw new Error(`Failed to set default Ship To contact: ${error instanceof Error ? error.message : String(error)}`);
    }
}
