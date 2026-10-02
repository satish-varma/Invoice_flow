
// Import the functions you need from the SDKs you need
import { initializeApp, getApp, getApps } from "firebase/app";
import { getFirestore, initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from "firebase/firestore";
import { getStorage } from "firebase/storage";

import { firebaseConfig } from '@/firebase/config';

// Initialize Firebase
const getFirebaseApp = () => {
  return !getApps().length ? initializeApp(firebaseConfig) : getApp();
};

const getDb = () => {
  const app = getFirebaseApp();
  if (typeof window !== "undefined") {
    try {
      // Enable multi-tab offline persistence
      return initializeFirestore(app, {
        localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
      });
    } catch (e) {
      // If already initialized, just return it
      return getFirestore(app);
    }
  }
  return getFirestore(app);
};

const getFirebaseStorage = () => getStorage(getFirebaseApp());

export const app = getFirebaseApp();
export const db = getDb();
export const storage = getFirebaseStorage();
