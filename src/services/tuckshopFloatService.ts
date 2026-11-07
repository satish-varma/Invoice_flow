import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  onSnapshot,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { assertWritePermission } from '@/lib/readOnlyGuard';
import { SiteId } from '@/types/site';
import { NewRelicTuckshopRecord } from './newrelicTuckshopService';

export const TUCKSHOP_FLOATS_COLLECTION = 'tuckshop_floats';

export interface FloatTopUpEntry {
  id: string;
  amount: number;
  date: string; // ISO string
  note?: string;
  mode: 'cash' | 'upi' | 'bank_transfer';
  addedBy?: string | null;
}

export interface FloatRequestEntry {
  id: string;
  amount: number;
  date: string; // ISO string
  reason?: string;
  status: 'pending' | 'approved' | 'rejected';
  requestedBy?: string | null;
  reviewedBy?: string | null;
  reviewedAt?: string | null;
}

export interface TuckshopSiteFloat {
  siteId: SiteId;
  openingFloat: number; // e.g. 5000
  currentCycleStart: string; // ISO string, e.g. 1st of month
  topUps: FloatTopUpEntry[];
  requests: FloatRequestEntry[];
  updatedAt?: string | Timestamp | any;
  updatedBy?: string | null;
}

export interface FloatCalculationResult {
  openingFloat: number;
  totalTopUps: number;
  totalAdvanceAvailable: number; // opening + topUps
  totalSpent: number; // sum of expenses in current cycle
  remainingFloat: number; // totalAdvanceAvailable - totalSpent
  remainingPercentage: number; // (remainingFloat / totalAdvanceAvailable) * 100
  status: 'optimal' | 'warning' | 'critical';
  statusText: string;
}

/**
 * Get the first day of the current month in ISO format
 */
export function getDefaultCycleStart(): string {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

/**
 * Default float object if none exists in Firestore
 */
export function createDefaultFloat(siteId: SiteId): TuckshopSiteFloat {
  return {
    siteId,
    openingFloat: 5000,
    currentCycleStart: getDefaultCycleStart(),
    topUps: [],
    requests: [],
  };
}

/**
 * Real-time subscription to site float data
 */
export function subscribeToSiteFloat(
  siteId: string,
  callback: (floatData: TuckshopSiteFloat) => void
) {
  const docRef = doc(db, TUCKSHOP_FLOATS_COLLECTION, siteId);

  return onSnapshot(
    docRef,
    (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        callback({
          siteId: (data.siteId as SiteId) || (siteId as SiteId),
          openingFloat: Number(data.openingFloat) || 5000,
          currentCycleStart: data.currentCycleStart || getDefaultCycleStart(),
          topUps: Array.isArray(data.topUps) ? data.topUps : [],
          requests: Array.isArray(data.requests) ? data.requests : [],
          updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt.toDate().toISOString() : data.updatedAt,
          updatedBy: data.updatedBy,
        });
      } else {
        // Return default state
        callback(createDefaultFloat(siteId as SiteId));
      }
    },
    (err) => {
      console.warn(`[TuckshopFloat] Snapshot error for ${siteId}:`, err);
      callback(createDefaultFloat(siteId as SiteId));
    }
  );
}

/**
 * Fetch float data once
 */
export async function getSiteFloat(siteId: string): Promise<TuckshopSiteFloat> {
  const docRef = doc(db, TUCKSHOP_FLOATS_COLLECTION, siteId);
  const snap = await getDoc(docRef);
  if (snap.exists()) {
    const data = snap.data();
    return {
      siteId: (data.siteId as SiteId) || (siteId as SiteId),
      openingFloat: Number(data.openingFloat) || 5000,
      currentCycleStart: data.currentCycleStart || getDefaultCycleStart(),
      topUps: Array.isArray(data.topUps) ? data.topUps : [],
      requests: Array.isArray(data.requests) ? data.requests : [],
      updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt.toDate().toISOString() : data.updatedAt,
      updatedBy: data.updatedBy,
    };
  }
  return createDefaultFloat(siteId as SiteId);
}

/**
 * Record a float advance / top-up given to counter staff
 */
export async function addFloatTopUp(
  siteId: string,
  entry: {
    amount: number;
    note?: string;
    mode?: 'cash' | 'upi' | 'bank_transfer';
    userEmail?: string | null;
  }
): Promise<void> {
  await assertWritePermission('Adding Float Top-Up');
  const current = await getSiteFloat(siteId);

  const newTopUp: FloatTopUpEntry = {
    id: `topup_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    amount: Math.round(Number(entry.amount) * 100) / 100,
    date: new Date().toISOString(),
    note: entry.note?.trim() || 'Counter petty cash replenishment',
    mode: entry.mode || 'cash',
    addedBy: entry.userEmail || 'manager',
  };

  const updatedTopUps = [newTopUp, ...current.topUps];

  const docRef = doc(db, TUCKSHOP_FLOATS_COLLECTION, siteId);
  await setDoc(
    docRef,
    {
      ...current,
      topUps: updatedTopUps,
      updatedAt: serverTimestamp(),
      updatedBy: entry.userEmail,
    },
    { merge: true }
  );
}

/**
 * Submit an emergency float replenishment request from counter staff
 */
export async function requestFloatTopUp(
  siteId: string,
  entry: {
    amount: number;
    reason?: string;
    userEmail?: string | null;
  }
): Promise<void> {
  await assertWritePermission('Requesting Float Top-Up');
  const current = await getSiteFloat(siteId);

  const newRequest: FloatRequestEntry = {
    id: `req_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    amount: Math.round(Number(entry.amount) * 100) / 100,
    date: new Date().toISOString(),
    reason: entry.reason?.trim() || 'Counter float funds running low for morning supplies',
    status: 'pending',
    requestedBy: entry.userEmail || 'staff',
  };

  const updatedRequests = [newRequest, ...current.requests];

  const docRef = doc(db, TUCKSHOP_FLOATS_COLLECTION, siteId);
  await setDoc(
    docRef,
    {
      ...current,
      requests: updatedRequests,
      updatedAt: serverTimestamp(),
      updatedBy: entry.userEmail,
    },
    { merge: true }
  );
}

/**
 * Configure / update base opening float amount
 */
export async function updateOpeningFloat(
  siteId: string,
  openingFloat: number,
  userEmail?: string | null
): Promise<void> {
  await assertWritePermission('Updating Opening Float');
  const docRef = doc(db, TUCKSHOP_FLOATS_COLLECTION, siteId);
  await setDoc(
    docRef,
    {
      siteId,
      openingFloat: Math.round(Number(openingFloat) * 100) / 100,
      updatedAt: serverTimestamp(),
      updatedBy: userEmail,
    },
    { merge: true }
  );
}

/**
 * Reset cycle to today (starts a fresh monthly or weekly replenishment cycle)
 */
export async function resetFloatCycle(
  siteId: string,
  userEmail?: string | null
): Promise<void> {
  await assertWritePermission('Resetting Float Cycle');
  const current = await getSiteFloat(siteId);
  const docRef = doc(db, TUCKSHOP_FLOATS_COLLECTION, siteId);
  await setDoc(
    docRef,
    {
      ...current,
      currentCycleStart: new Date().toISOString(),
      topUps: [], // Reset active top-ups for new cycle
      updatedAt: serverTimestamp(),
      updatedBy: userEmail,
    },
    { merge: true }
  );
}

/**
 * Computes exact real-time float balance:
 * Float Available (Opening + Top-Ups) minus Supplies Expenses logged since currentCycleStart
 */
export function computeFloatBalance(
  floatData: TuckshopSiteFloat,
  expenses: NewRelicTuckshopRecord[]
): FloatCalculationResult {
  const openingFloat = Number(floatData.openingFloat) || 5000;
  const cycleStart = floatData.currentCycleStart || getDefaultCycleStart();

  // Sum top-ups logged in this cycle
  const totalTopUps = floatData.topUps.reduce((acc, t) => acc + (Number(t.amount) || 0), 0);
  const totalAdvanceAvailable = openingFloat + totalTopUps;

  // Sum all expenses for this site logged since cycleStart
  const totalSpent = expenses
    .filter((e) => {
      if (e.type !== 'expense') return false;
      const expenseDate = e.date || '';
      return expenseDate >= cycleStart;
    })
    .reduce((acc, e) => acc + (Number(e.amount) || 0), 0);

  const remainingFloat = Math.round((totalAdvanceAvailable - totalSpent) * 100) / 100;
  const remainingPercentage =
    totalAdvanceAvailable > 0
      ? Math.round((remainingFloat / totalAdvanceAvailable) * 1000) / 10
      : 0;

  let status: 'optimal' | 'warning' | 'critical' = 'optimal';
  let statusText = 'Healthy Float Balance';

  if (remainingPercentage <= 15 || remainingFloat <= 750) {
    status = 'critical';
    statusText = 'Critical: Float Almost Depleted';
  } else if (remainingPercentage <= 40 || remainingFloat <= 2000) {
    status = 'warning';
    statusText = 'Watch: Low Float Remaining';
  }

  return {
    openingFloat,
    totalTopUps,
    totalAdvanceAvailable,
    totalSpent,
    remainingFloat,
    remainingPercentage,
    status,
    statusText,
  };
}
