
'use server';

import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';

export interface BillToContact {
    id: string; // Keep ID for potential future use, but it's mainly the key in the map
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

export interface Settings {
    billToContacts?: BillToContact[];
    shipToContacts?: ShipToContact[];
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
             await setDoc(settingsRef, { billToContacts: [contact], shipToContacts: [] });
        }
    } catch (error) {
        console.error("Error saving Bill To contact: ", error);
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
             await setDoc(settingsRef, { shipToContacts: [contact], billToContacts: [] });
        }
    } catch (error) {
        console.error("Error saving Ship To contact: ", error);
        throw new Error("Failed to save Ship To contact.");
    }
}


export async function deleteBillToContact(displayName: string): Promise<void> {
    try {
        const settingsRef = doc(db, SETTINGS_COLLECTION, SINGLETON_DOC_ID);
        const settings = await getSettings();
        const contactToDelete = (settings?.billToContacts || []).find(c => c.displayName === displayName);
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
        const contactToDelete = (settings?.shipToContacts || []).find(c => c.displayName === displayName);

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
