
'use server';

import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

export interface Signature {
    id: string;
    name: string;
    url: string; // data URI
}

export interface Settings {
    id?: string;
    billToName?: string;
    billToAddress?: string;
    billToGst?: string;
    shipToName?: string;
    shipToAddress?: string;
    shipToGst?: string;
    signatures?: Signature[];
    defaultSignatureId?: string;
}

const SETTINGS_COLLECTION = 'settings';
const SINGLETON_DOC_ID = 'invoiceDefaults'; // Use a single document for all settings

export async function getSettings(): Promise<Settings | null> {
    try {
        const docRef = doc(db, SETTINGS_COLLECTION, SINGLETON_DOC_ID);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            return { id: docSnap.id, ...docSnap.data() } as Settings;
        } else {
            return null; // No settings saved yet
        }
    } catch (error) {
        console.error("Error fetching settings: ", error);
        // Depending on requirements, you might want to throw or return a default object
        return null;
    }
}

export async function saveSettings(settings: Omit<Settings, 'id'>): Promise<void> {
    try {
        const docRef = doc(db, SETTINGS_COLLECTION, SINGLETON_DOC_ID);
        // Use setDoc with merge to create or update the document
        await setDoc(docRef, settings, { merge: true });
    } catch (error) {
        console.error("Error saving settings: ", error);
        throw new Error("Failed to save settings.");
    }
}
