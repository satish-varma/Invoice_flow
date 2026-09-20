
// Import the functions you need from the SDKs you need
import { initializeApp, getApp, getApps } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

import { firebaseConfig } from '@/firebase/config';

// Initialize Firebase
const getFirebaseApp = () => {
  return !getApps().length ? initializeApp(firebaseConfig) : getApp();
};

const getDb = () => getFirestore(getFirebaseApp());
const getFirebaseStorage = () => getStorage(getFirebaseApp());

export const app = getFirebaseApp();
export const db = getDb();
export const storage = getFirebaseStorage();
