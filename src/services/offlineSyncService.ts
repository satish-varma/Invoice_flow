/**
 * Offline Sync Service using native browser IndexedDB.
 * Manages an offline queue for Attendance Punches (with compressed selfies), Delivery Challans, and Stock Requests.
 * Also provides an Offline Data Cache (for staff roster, product catalog, and pricing items).
 * Includes auto-retry with exponential backoff and seamless background sync.
 */

export type OfflineQueueItemType = 'attendance-punch' | 'challan' | 'stock-request';

export interface OfflineAttendancePayload {
  type: 'check-in' | 'check-out';
  employee: {
    id: string;
    employeeId: string;
    name: string;
    location: string;
    siteId?: string;
    shiftTiming?: any;
  };
  attendanceId?: string;
  checkInTime?: string;
  selfieBase64: string;
  coordinates: { lat: number; lng: number; accuracy?: number } | null;
  punchTime: string; // ISO 8601 string recorded at the instant of capture
  date: string;      // YYYY-MM-DD
  checkoutOptions?: {
    minWorkHours?: number;
    allowEarlyCheckout?: boolean;
    adminOverrideReason?: string;
    expectedMinutes?: number;
  };
  globalShiftRules?: any;
}

export interface OfflineChallanPayload {
  challan: any;
  userEmail: string | null;
}

export interface OfflineStockRequestPayload {
  request: any;
  id?: string;
}

export interface OfflineQueueItem {
  id: string; // Unique queue identifier
  type: OfflineQueueItemType;
  title: string;
  summary: string;
  payload: OfflineAttendancePayload | OfflineChallanPayload | OfflineStockRequestPayload;
  createdAt: number;
  status: 'pending' | 'syncing' | 'synced' | 'failed';
  errorMessage?: string;
  retryCount: number;
  syncedAt?: number;
}

interface CacheEntry<T> {
  key: string;
  data: T;
  updatedAt: number;
}

const DB_NAME = 'invoiceflow_offline_store';
const DB_VERSION = 2;
const STORE_NAME = 'offline_queue';
const CACHE_STORE_NAME = 'offline_cache';

type QueueListener = (items: OfflineQueueItem[]) => void;
const listeners = new Set<QueueListener>();

function notifyListeners(items: OfflineQueueItem[]) {
  listeners.forEach((listener) => {
    try {
      listener(items);
    } catch (e) {
      console.error('Error notifying offline queue listener:', e);
    }
  });
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      return reject(new Error('IndexedDB is not available in this environment'));
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      
      // 1. Offline Queue Store
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('status', 'status', { unique: false });
        store.createIndex('createdAt', 'createdAt', { unique: false });
        store.createIndex('type', 'type', { unique: false });
      }

      // 2. Offline Data Cache Store (for roster, catalog, pricing)
      if (!db.objectStoreNames.contains(CACHE_STORE_NAME)) {
        db.createObjectStore(CACHE_STORE_NAME, { keyPath: 'key' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/* ─────────────────────────────────────────────────────────────
   OFFLINE DATA CACHE (Roster, Catalog, Pricing)
   ───────────────────────────────────────────────────────────── */

/** Save a data collection to IndexedDB cache for offline read access */
export async function setCachedData<T>(key: string, data: T): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(CACHE_STORE_NAME, 'readwrite');
      const store = tx.objectStore(CACHE_STORE_NAME);
      const entry: CacheEntry<T> = { key, data, updatedAt: Date.now() };
      const req = store.put(entry);

      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn(`[OfflineCache] Failed to cache key "${key}":`, err);
  }
}

/** Retrieve cached data collection from IndexedDB when offline */
export async function getCachedData<T>(key: string): Promise<T | null> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(CACHE_STORE_NAME, 'readonly');
      const store = tx.objectStore(CACHE_STORE_NAME);
      const req = store.get(key);

      req.onsuccess = () => {
        const entry = req.result as CacheEntry<T> | undefined;
        resolve(entry ? entry.data : null);
      };
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn(`[OfflineCache] Failed to read cached key "${key}":`, err);
    return null;
  }
}

/* ─────────────────────────────────────────────────────────────
   OFFLINE QUEUE OPERATIONS
   ───────────────────────────────────────────────────────────── */

/** Enqueue a new item into the offline queue */
export async function enqueueOfflineItem(
  type: OfflineQueueItemType,
  title: string,
  summary: string,
  payload: OfflineAttendancePayload | OfflineChallanPayload | OfflineStockRequestPayload
): Promise<OfflineQueueItem> {
  const item: OfflineQueueItem = {
    id: `queue_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
    type,
    title,
    summary,
    payload,
    createdAt: Date.now(),
    status: 'pending',
    retryCount: 0,
  };

  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.add(item);

    req.onsuccess = async () => {
      resolve(item);
      const all = await getAllOfflineItems();
      notifyListeners(all);
    };
    req.onerror = () => reject(req.error);
  });
}

/** Retrieve all items currently in the offline queue (ordered newest first) */
export async function getAllOfflineItems(): Promise<OfflineQueueItem[]> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();

      req.onsuccess = () => {
        const items = (req.result as OfflineQueueItem[]) || [];
        items.sort((a, b) => b.createdAt - a.createdAt);
        resolve(items);
      };
      req.onerror = () => reject(req.error);
    });
  } catch {
    return [];
  }
}

/** Retrieve only pending/failed items awaiting sync */
export async function getPendingOfflineItems(): Promise<OfflineQueueItem[]> {
  const all = await getAllOfflineItems();
  return all.filter((i) => i.status === 'pending' || i.status === 'failed');
}

/** Update an item in the queue */
export async function updateOfflineItem(item: OfflineQueueItem): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.put(item);

    req.onsuccess = async () => {
      resolve();
      const all = await getAllOfflineItems();
      notifyListeners(all);
    };
    req.onerror = () => reject(req.error);
  });
}

/** Delete an item from the queue */
export async function removeOfflineItem(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.delete(id);

    req.onsuccess = async () => {
      resolve();
      const all = await getAllOfflineItems();
      notifyListeners(all);
    };
    req.onerror = () => reject(req.error);
  });
}

/** Purge already synced items to keep storage clean */
export async function clearSyncedOfflineItems(): Promise<number> {
  const all = await getAllOfflineItems();
  const synced = all.filter((i) => i.status === 'synced');
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    synced.forEach((s) => store.delete(s.id));

    tx.oncomplete = async () => {
      const remaining = await getAllOfflineItems();
      notifyListeners(remaining);
      resolve(synced.length);
    };
    tx.onerror = () => reject(tx.error);
  });
}

/** Subscribe to live changes in the offline queue */
export function subscribeToOfflineQueue(listener: QueueListener): () => void {
  listeners.add(listener);
  // Emit initial state
  getAllOfflineItems().then((items) => listener(items)).catch(() => listener([]));
  return () => {
    listeners.delete(listener);
  };
}

let isSyncing = false;
let retryTimeoutId: any = null;

export function isQueueSyncing(): boolean {
  return isSyncing;
}

/** Schedule auto-retry with exponential backoff (e.g. 15s, 35s, 75s, 120s) */
function scheduleAutoRetry(attempt: number) {
  if (retryTimeoutId) {
    clearTimeout(retryTimeoutId);
    retryTimeoutId = null;
  }
  const delayMs = Math.min(15000 * Math.pow(2.2, Math.max(0, attempt - 1)), 120000);
  console.log(`[OfflineSync] Scheduling auto-retry in ${Math.round(delayMs / 1000)}s (Attempt #${attempt})`);

  retryTimeoutId = setTimeout(() => {
    if (typeof navigator !== 'undefined' && navigator.onLine) {
      console.log('[OfflineSync] Auto-retry timer fired. Retrying sync...');
      processOfflineQueue().catch((e) => console.warn('[OfflineSync] Auto-retry failed:', e));
    }
  }, delayMs);
}

/**
 * Process all pending offline items by uploading to Firebase Storage & Firestore.
 * Preserves original punch timestamps recorded offline.
 * Automatically triggers exponential backoff on intermittent failures.
 */
export async function processOfflineQueue(): Promise<{
  total: number;
  synced: number;
  failed: number;
}> {
  if (isSyncing) {
    return { total: 0, synced: 0, failed: 0 };
  }
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return { total: 0, synced: 0, failed: 0 };
  }

  isSyncing = true;
  let synced = 0;
  let failed = 0;
  let maxRetryCount = 0;

  try {
    const pending = await getPendingOfflineItems();
    if (!pending.length) {
      if (retryTimeoutId) {
        clearTimeout(retryTimeoutId);
        retryTimeoutId = null;
      }
      isSyncing = false;
      return { total: 0, synced: 0, failed: 0 };
    }

    // Lazy load services to avoid circular dependencies
    const { uploadSelfie, checkInEmployee, checkOutEmployee } = await import('@/services/newrelicAttendanceService');
    const { saveNewRelicChallan } = await import('@/services/newrelicChallanService');
    const { saveStockRequest } = await import('@/services/newrelicStockRequestService');

    for (const item of pending) {
      item.status = 'syncing';
      await updateOfflineItem(item);

      try {
        if (item.type === 'attendance-punch') {
          const p = item.payload as OfflineAttendancePayload;
          const folder = `${p.employee.employeeId}/${p.date}`;
          
          // 1. Upload the offline-captured selfie to Firebase Storage
          const selfieUrl = await uploadSelfie(p.selfieBase64, folder);

          if (p.type === 'check-in') {
            await checkInEmployee(
              p.employee,
              selfieUrl,
              p.coordinates,
              p.date,
              p.globalShiftRules,
              p.punchTime // Preserve the exact offline punch time!
            );
          } else {
            if (!p.attendanceId || !p.checkInTime) {
              throw new Error('Missing check-in reference for check-out punch');
            }
            await checkOutEmployee(
              p.attendanceId,
              selfieUrl,
              p.coordinates,
              p.checkInTime,
              p.employee.location,
              {
                ...p.checkoutOptions,
                overrideTime: p.punchTime, // Preserve the exact offline punch time!
              }
            );
          }
        } else if (item.type === 'challan') {
          const p = item.payload as OfflineChallanPayload;
          await saveNewRelicChallan(p.challan, p.userEmail);
        } else if (item.type === 'stock-request') {
          const p = item.payload as OfflineStockRequestPayload;
          await saveStockRequest(p.request, p.id);
        }

        item.status = 'synced';
        item.syncedAt = Date.now();
        item.errorMessage = undefined;
        await updateOfflineItem(item);
        synced++;
      } catch (err: any) {
        console.error(`Failed to sync offline item [${item.id}]:`, err);
        item.status = 'failed';
        item.errorMessage = err?.message || 'Sync failed';
        item.retryCount = (item.retryCount || 0) + 1;
        maxRetryCount = Math.max(maxRetryCount, item.retryCount);
        await updateOfflineItem(item);
        failed++;
      }
    }

    // Feature 6: Auto-Retry with Exponential Backoff
    if (failed > 0 && maxRetryCount < 5) {
      scheduleAutoRetry(maxRetryCount);
    } else if (failed === 0 && retryTimeoutId) {
      clearTimeout(retryTimeoutId);
      retryTimeoutId = null;
    }

    return { total: pending.length, synced, failed };
  } finally {
    isSyncing = false;
  }
}

// Auto-listen to the browser going back online to immediately trigger synchronization
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    console.log('[OfflineSync] Device is back online. Processing offline queue...');
    processOfflineQueue().then((res) => {
      if (res.synced > 0) {
        console.log(`[OfflineSync] Successfully synced ${res.synced} offline records.`);
      }
    }).catch((err) => {
      console.warn('[OfflineSync] Auto-sync encountered error:', err);
    });
  });
}
