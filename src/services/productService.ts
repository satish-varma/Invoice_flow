
import { db } from '@/lib/firebase';
import { collection, addDoc, getDocs, updateDoc, deleteDoc, doc, query, orderBy, serverTimestamp } from 'firebase/firestore';

export interface Product {
    id?: string;
    name: string;
    description: string;
    hsnCode: string;
    unitPrice: number;
    unit: string; // e.g., "Sq Ft", "Hour", "Nos", "Service"
    taxCategory?: string; // e.g., "GST 18%", "GST 12%", "Exempt"
    createdAt?: any;
    updatedAt?: any;
}

const PRODUCTS_COLLECTION = 'products';

export async function saveProduct(product: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    try {
        const docRef = await addDoc(collection(db, PRODUCTS_COLLECTION), {
            ...product,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
        });
        return docRef.id;
    } catch (error) {
        console.error("Error saving product: ", error);
        throw new Error("Failed to save product.");
    }
}

export async function getProducts(): Promise<Product[]> {
    try {
        const q = query(collection(db, PRODUCTS_COLLECTION), orderBy('name', 'asc'));
        const querySnapshot = await getDocs(q);
        return querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        } as Product));
    } catch (error) {
        console.error("Error fetching products: ", error);
        return [];
    }
}

export async function updateProduct(id: string, updates: Partial<Product>): Promise<void> {
    try {
        const docRef = doc(db, PRODUCTS_COLLECTION, id);
        await updateDoc(docRef, {
            ...updates,
            updatedAt: serverTimestamp(),
        });
    } catch (error) {
        console.error("Error updating product: ", error);
        throw new Error("Failed to update product.");
    }
}

export async function deleteProduct(id: string): Promise<void> {
    try {
        await deleteDoc(doc(db, PRODUCTS_COLLECTION, id));
    } catch (error) {
        console.error("Error deleting product: ", error);
        throw new Error("Failed to delete product.");
    }
}
