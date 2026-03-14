
import { db } from '@/lib/firebase';
import { collection, addDoc, getDocs, updateDoc, deleteDoc, doc, query, orderBy, serverTimestamp, setDoc } from 'firebase/firestore';

export interface Client {
    id?: string;
    name: string;
    address: string;
    gst?: string;
    email?: string;
    phone?: string;
    type: 'individual' | 'business';
    createdAt?: any;
    updatedAt?: any;
}

const CLIENTS_COLLECTION = 'clients';

export async function saveClient(client: Omit<Client, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    try {
        const docRef = await addDoc(collection(db, CLIENTS_COLLECTION), {
            ...client,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
        });
        return docRef.id;
    } catch (error) {
        console.error("Error saving client: ", error);
        throw new Error("Failed to save client.");
    }
}

export async function getClients(): Promise<Client[]> {
    try {
        const q = query(collection(db, CLIENTS_COLLECTION), orderBy('name', 'asc'));
        const querySnapshot = await getDocs(q);
        return querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        } as Client));
    } catch (error) {
        console.error("Error fetching clients: ", error);
        return [];
    }
}

export async function updateClient(id: string, updates: Partial<Client>): Promise<void> {
    try {
        const docRef = doc(db, CLIENTS_COLLECTION, id);
        await updateDoc(docRef, {
            ...updates,
            updatedAt: serverTimestamp(),
        });
    } catch (error) {
        console.error("Error updating client: ", error);
        throw new Error("Failed to update client.");
    }
}

export async function deleteClient(id: string): Promise<void> {
    try {
        await deleteDoc(doc(db, CLIENTS_COLLECTION, id));
    } catch (error) {
        console.error("Error deleting client: ", error);
        throw new Error("Failed to delete client.");
    }
}
