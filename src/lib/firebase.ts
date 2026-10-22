
// Import the functions you need from the SDKs you need
import { initializeApp, getApp, getApps } from "firebase/app";
import { getFirestore, initializeFirestore, memoryLocalCache, setLogLevel } from "firebase/firestore";
import { getStorage } from "firebase/storage";

import { firebaseConfig } from '@/firebase/config';

// 1. Safe cleanup: purge stale firestore mutation entries from localStorage
// persistentMultipleTabManager previously mirrored mutations into window.localStorage,
// exhausting the browser's 5MB quota limit and causing fatal QuotaExceededError crashes.
if (typeof window !== "undefined") {
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (key && (key.startsWith("firestore_") || key.includes("firestore_mutations"))) {
        keysToRemove.push(key);
      }
    }
    for (const key of keysToRemove) {
      try {
        window.localStorage.removeItem(key);
      } catch {
        // Ignore individual key removal errors
      }
    }
  } catch (e) {
    console.warn("Notice: Stale firestore cache cleanup skipped:", e);
  }

  // 2. Wrap Storage.prototype.setItem as an unbreakable failsafe against QuotaExceededError
  try {
    if (typeof window.Storage !== "undefined") {
      const origSetItem = window.Storage.prototype.setItem;
      window.Storage.prototype.setItem = function (key: string, value: string) {
        try {
          return origSetItem.call(this, key, value);
        } catch (err: unknown) {
          const isQuotaError =
            (err instanceof DOMException &&
              (err.name === "QuotaExceededError" ||
                err.code === 22 ||
                err.code === 1014 ||
                err.name === "NS_ERROR_DOM_QUOTA_REACHED")) ||
            (typeof err === "object" && err !== null && "name" in err && (err as { name: string }).name === "QuotaExceededError");

          if (isQuotaError && typeof key === "string" && (key.startsWith("firestore_") || key.includes("firestore_mutations"))) {
            try {
              // Immediately purge older firestore mutation/target entries to recover storage space
              for (let j = window.localStorage.length - 1; j >= 0; j--) {
                const k = window.localStorage.key(j);
                if (k && (k.startsWith("firestore_mutations_") || k.startsWith("firestore_targets_") || k.startsWith("firestore_clients_"))) {
                  window.localStorage.removeItem(k);
                }
              }
              return origSetItem.call(this, key, value);
            } catch {
              // Suppress error so Firestore async queue never crashes
              console.warn("[Firestore SafeStorage] Suppressed QuotaExceededError for key:", key);
              return;
            }
          }
          throw err;
        }
      };
    }
  } catch {
    // Ignore storage patch errors
  }

  // Suppress internal Firestore multi-tab lease election warnings in client console
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
      // Use in-memory cache to prevent localStorage 5MB quota overflow across tabs
      return initializeFirestore(app, {
        localCache: memoryLocalCache()
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
