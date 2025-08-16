
'use server';

import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';

export interface BillToContact {
    id?: string; // Not stored, used for client-side keying if needed
    displayName: string;
    name: string;
    address: string;
    gst: string;
}

export interface ShipToContact {
    id?: string; // Not stored, used for client-side keying if needed
    displayName: string;
    name: string;
    address: string;
    gst: string;
}

export interface Settings {
    billToContacts?: BillToContact[];
    shipToContacts?: ShipToContact[];
    defaultBillToContact?: string;
    defaultShipToContact?: string;
}

const SETTINGS_COLLECTION = 'settings';
const SINGLETON_DOC_ID = 'invoiceDefaults';

export async function getSettings(): Promise<Settings | null> {
    try {
        const docRef = doc(db, SETTINGS_COLLECTION, SINGLETON_DOC_ID);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            return docSnap.data() as Settings;
        } else {
            // If the document doesn't exist, create it with empty arrays
            const initialSettings: Settings = { billToContacts: [], shipToContacts: [] };
            await setDoc(docRef, initialSettings);
            return initialSettings;
        }
    } catch (error) {
        console.error("Error fetching settings: ", error);
        return null;
    }
}

async function contactExists(contacts: any[] | undefined, displayName: string): Promise<boolean> {
    if (!contacts) return false;
    return contacts.some(contact => contact.displayName === displayName);
}

export async function saveBillToContact(contact: Omit<BillToContact, 'id'>): Promise<void> {
    try {
        const settingsRef = doc(db, SETTINGS_COLLECTION, SINGLETON_DOC_ID);
        const docSnap = await getDoc(settingsRef);

        if (docSnap.exists()) {
             const settings = docSnap.data() as Settings;
             if (await contactExists(settings.billToContacts, contact.displayName)) {
                throw new Error("A Bill To contact with this Display Name already exists.");
             }
             await updateDoc(settingsRef, {
                 billToContacts: arrayUnion(contact)
             });
        } else {
             await setDoc(settingsRef, { billToContacts: [contact] }, { merge: true });
        }
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
        const docSnap = await getDoc(settingsRef);

        if (docSnap.exists()) {
             const settings = docSnap.data() as Settings;
             if (await contactExists(settings.shipToContacts, contact.displayName)) {
                throw new Error("A Ship To contact with this Display Name already exists.");
             }
             await updateDoc(settingsRef, {
                 shipToContacts: arrayUnion(contact)
             });
        } else {
             await setDoc(settingsRef, { shipToContacts: [contact] }, { merge: true });
        }
    } catch (error) {
        console.error("Error saving Ship To contact: ", error);
        if (error instanceof Error && error.message.includes("already exists")) {
            throw error;
        }
        throw new Error("Failed to save Ship To contact.");
    }
}


export async function deleteBillToContact(displayName: string): Promise<void> {
    try {
        const settingsRef = doc(db, SETTINGS_COLLECTION, SINGLETON_DOC_ID);
        const settings = await getSettings();
        if (!settings || !settings.billToContacts) {
            throw new Error("Settings or contacts not found");
        }
        
        const contactToDelete = settings.billToContacts.find(c => c.displayName === displayName);

        if (contactToDelete) {
             await updateDoc(settingsRef, {
                billToContacts: arrayRemove(contactToDelete)
            });
        } else {
            throw new Error("Contact not found");
        }
    } catch (error) {
        console.error("Error deleting Bill To contact: ", error);
        throw new Error("Failed to delete Bill To contact.");
    }
}

export async function deleteShipToContact(displayName: string): Promise<void> {
    try {
        const settingsRef = doc(db, SETTINGS_COLLECTION, SINGLETON_DOC_ID);
        const settings = await getSettings();
         if (!settings || !settings.shipToContacts) {
            throw new Error("Settings or contacts not found");
        }

        const contactToDelete = settings.shipToContacts.find(c => c.displayName === displayName);

        if (contactToDelete) {
            await updateDoc(settingsRef, {
                shipToContacts: arrayRemove(contactToDelete)
            });
        } else {
            throw new Error("Contact not found");
        }
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
        const updatedContacts = settings.billToContacts.map(c => 
            c.displayName === contact.displayName ? contact : c
        );
        await updateDoc(settingsRef, { billToContacts: updatedContacts });
    } catch (error) {
        console.error("Error updating Bill To contact: ", error);
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
        const updatedContacts = settings.shipToContacts.map(c => 
            c.displayName === contact.displayName ? contact : c
        );
        await updateDoc(settingsRef, { shipToContacts: updatedContacts });
    } catch (error) {
        console.error("Error updating Ship To contact: ", error);
        throw new Error("Failed to update Ship To contact.");
    }
}

export async function setDefaultBillToContact(displayName: string): Promise<void> {
    try {
        const settingsRef = doc(db, SETTINGS_COLLECTION, SINGLETON_DOC_ID);
        await updateDoc(settingsRef, { defaultBillToContact: displayName });
    } catch (error) {
        console.error("Error setting default Bill To contact: ", error);
        throw new Error("Failed to set default Bill To contact.");
    }
}

export async function setDefaultShipToContact(displayName: string): Promise<void> {
    try {
        const settingsRef = doc(db, SETTINGS_COLLECTION, SINGLETON_DOC_ID);
        await updateDoc(settingsRef, { defaultShipToContact: displayName });
    } catch (error) {
        console.error("Error setting default Ship To contact: ", error);
        throw new Error("Failed to set default Ship To contact.");
    }
}

    