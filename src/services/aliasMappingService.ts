import { db } from '@/lib/firebase';
import {
  collection,
  doc,
  getDocs,
  setDoc,
  deleteDoc,
  query,
} from 'firebase/firestore';

export interface AliasMapping {
  id: string;
  internalName: string;
  aggregatorName: string;
}

const ALIASES_COLLECTION = 'newrelic_item_aliases';

export const getAliases = async (): Promise<AliasMapping[]> => {
  try {
    const q = query(collection(db, ALIASES_COLLECTION));
    const snapshot = await getDocs(q);
    const aliases: AliasMapping[] = [];
    snapshot.forEach((doc) => {
      const data = doc.data();
      aliases.push({
        id: doc.id,
        internalName: data.internalName || '',
        aggregatorName: data.aggregatorName || '',
      });
    });
    return aliases;
  } catch (error) {
    console.error('Error fetching aliases:', error);
    return [];
  }
};

export const saveAlias = async (alias: AliasMapping): Promise<void> => {
  try {
    const docRef = doc(db, ALIASES_COLLECTION, alias.id);
    await setDoc(docRef, {
      internalName: alias.internalName,
      aggregatorName: alias.aggregatorName,
      updatedAt: new Date().toISOString()
    }, { merge: true });
  } catch (error) {
    console.error('Error saving alias:', error);
    throw error;
  }
};

export const deleteAlias = async (id: string): Promise<void> => {
  try {
    const docRef = doc(db, ALIASES_COLLECTION, id);
    await deleteDoc(docRef);
  } catch (error) {
    console.error('Error deleting alias:', error);
    throw error;
  }
};
