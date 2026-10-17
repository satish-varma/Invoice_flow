
// Import the functions you need from the SDKs you need
import { initializeApp, getApp, getApps } from "firebase/app";
import { getFirestore, initializeFirestore, persistentLocalCache, persistentMultipleTabManager, setLogLevel } from "firebase/firestore";
import { getStorage } from "firebase/storage";

import { firebaseConfig } from '@/firebase/config';

// Suppress internal Firestore multi-tab lease election warnings in client console
if (typeof window !== "undefined") {
  try {
    setLogLevel("silent");
  } catch {
    // Ignore
  }

  // Next.js dev client catches all console.error calls and pops up an error modal.
  // In Firebase 11.x, secondary tabs fail to acquire the primary lease for 'Backfill Indexes'
  // when another tab is already primary. The SDK handles this internally, but logs it via console.error.
  const originalConsoleError = console.error;
  console.error = (...args: unknown[]) => {
    const msg = args.map((a) => (typeof a === "object" ? JSON.stringify(a) : String(a))).join(" ");
    if (msg.includes("Failed to obtain primary lease") || msg.includes("Backfill Indexes")) {
      return;
    }
    originalConsoleError.apply(console, args);
  };
}

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
    } catch {
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
