import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  where,
  orderBy,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { assertWritePermission } from '@/lib/readOnlyGuard';
import { SiteId } from '@/types/site';
import { NewRelicTuckshopRecord } from './newrelicTuckshopService';

export const TUCKSHOP_FLOATS_COLLECTION = 'tuckshop_floats';
export const TUCKSHOP_FLOAT_REQUESTS_COLLECTION = 'tuckshop_float_requests';

export interface FloatTopUpEntry {
  id: string;
  amount: number;
  date: string; // ISO string
  note?: string;
  mode: 'cash' | 'upi' | 'bank_transfer';
  addedBy?: string | null;
  transactionRef?: string | null;
}

export interface FloatRequestEntry {
  id: string;
  floatKey: string; // e.g. "newrelic_hyderabad", "newrelic_bangalore", "ntt_data", "dsm", "resmed"
  siteId: SiteId;
  location?: string;
  counterName: string;
  amount: number;
  date: string; // ISO string
  reason?: string;
  preferredMode?: 'cash' | 'upi';
  currentBalance?: number;
  status: 'pending' | 'approved' | 'rejected';
  requestedBy: string;
  requestedByEmail?: string | null;
  reviewedBy?: string | null;
  reviewedAt?: string | null;
  reviewNotes?: string | null;
  transactionRef?: string | null;
}

export interface TuckshopSiteFloat {
  scopeKey: string; // e.g. "newrelic_hyderabad"
  siteId: SiteId;
  location?: string;
  counterName: string;
  openingFloat: number; // e.g. 5000
  currentCycleStart: string; // ISO string, e.g. 1st of month
  topUps: FloatTopUpEntry[];
  requests: FloatRequestEntry[];
  updatedAt?: string | Timestamp | any;
  updatedBy?: string | null;
}

export interface FloatCalculationResult {
  scopeKey: string;
  counterName: string;
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
 * Resolves a unique scope key for physical float counters:
 * - Laxman -> newrelic_hyderabad
 * - Ravi -> newrelic_bangalore
 * - Swamy -> ntt_data, dsm, resmed
 */
export function getFloatScopeKey(siteId?: string, location?: string): string {
  const cleanSite = (siteId || 'newrelic').toLowerCase().trim();
  const cleanLoc = (location || '').toLowerCase().trim();

  if (cleanSite === 'newrelic') {
    if (cleanLoc.includes('bangalore') || cleanLoc.includes('blr') || cleanLoc.includes('bagmane')) {
      return 'newrelic_bangalore';
    }
    return 'newrelic_hyderabad';
  }

  if (cleanSite === 'dsm') return 'dsm';
  if (cleanSite === 'ntt_data' || cleanSite.includes('ntt')) return 'ntt_data';
  if (cleanSite === 'resmed') return 'resmed';

  return cleanSite;
}

/**
 * Human-readable counter display name
 */
export function getCounterDisplayName(scopeKey: string): string {
  switch (scopeKey) {
    case 'newrelic_hyderabad':
      return 'New Relic (Hyderabad)';
    case 'newrelic_bangalore':
      return 'New Relic (Bangalore)';
    case 'ntt_data':
      return 'NTT Data (Hyderabad)';
    case 'dsm':
      return 'DSM (Hyderabad)';
    case 'resmed':
      return 'ResMed (Hyderabad)';
    default:
      return scopeKey.replace(/_/g, ' ').toUpperCase();
  }
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
export function createDefaultFloat(scopeKey: string): TuckshopSiteFloat {
  let siteId: SiteId = 'newrelic';
  let location = 'hyderabad';

  if (scopeKey === 'newrelic_bangalore') {
    siteId = 'newrelic';
    location = 'bangalore';
  } else if (scopeKey === 'dsm') {
    siteId = 'dsm';
    location = 'hyderabad';
  } else if (scopeKey === 'ntt_data') {
    siteId = 'ntt_data';
    location = 'hyderabad';
  } else if (scopeKey === 'resmed') {
    siteId = 'resmed';
    location = 'hyderabad';
  }

  return {
    scopeKey,
    siteId,
    location,
    counterName: getCounterDisplayName(scopeKey),
    openingFloat: 5000,
    currentCycleStart: getDefaultCycleStart(),
    topUps: [],
    requests: [],
  };
}

/**
 * Real-time subscription to site float data by scopeKey
 */
export function subscribeToSiteFloat(
  scopeKey: string,
  callback: (floatData: TuckshopSiteFloat) => void
) {
  const docRef = doc(db, TUCKSHOP_FLOATS_COLLECTION, scopeKey);

  return onSnapshot(
    docRef,
    (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        callback({
          scopeKey,
          siteId: (data.siteId as SiteId) || 'newrelic',
          location: data.location || (scopeKey.includes('bangalore') ? 'bangalore' : 'hyderabad'),
          counterName: data.counterName || getCounterDisplayName(scopeKey),
          openingFloat: Number(data.openingFloat) || 5000,
          currentCycleStart: data.currentCycleStart || getDefaultCycleStart(),
          topUps: Array.isArray(data.topUps) ? data.topUps : [],
          requests: Array.isArray(data.requests) ? data.requests : [],
          updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt.toDate().toISOString() : data.updatedAt,
          updatedBy: data.updatedBy,
        });
      } else {
        callback(createDefaultFloat(scopeKey));
      }
    },
    (err) => {
      console.warn(`[TuckshopFloat] Snapshot error for ${scopeKey}:`, err);
      callback(createDefaultFloat(scopeKey));
    }
  );
}

/**
 * Fetch float data once by scopeKey
 */
export async function getSiteFloat(scopeKey: string): Promise<TuckshopSiteFloat> {
  const docRef = doc(db, TUCKSHOP_FLOATS_COLLECTION, scopeKey);
  const snap = await getDoc(docRef);
  if (snap.exists()) {
    const data = snap.data();
    return {
      scopeKey,
      siteId: (data.siteId as SiteId) || 'newrelic',
      location: data.location || (scopeKey.includes('bangalore') ? 'bangalore' : 'hyderabad'),
      counterName: data.counterName || getCounterDisplayName(scopeKey),
      openingFloat: Number(data.openingFloat) || 5000,
      currentCycleStart: data.currentCycleStart || getDefaultCycleStart(),
      topUps: Array.isArray(data.topUps) ? data.topUps : [],
      requests: Array.isArray(data.requests) ? data.requests : [],
      updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt.toDate().toISOString() : data.updatedAt,
      updatedBy: data.updatedBy,
    };
  }
  return createDefaultFloat(scopeKey);
}

/**
 * Real-time subscription to ALL pending float requests across counters (for Admin notification center)
 */
export function subscribeToAllPendingRequests(
  callback: (requests: FloatRequestEntry[]) => void
) {
  const q = query(
    collection(db, TUCKSHOP_FLOAT_REQUESTS_COLLECTION),
    where('status', '==', 'pending'),
    orderBy('date', 'desc')
  );

  return onSnapshot(
    q,
    (snap) => {
      const items = snap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      })) as FloatRequestEntry[];
      callback(items);
    },
    (err) => {
      console.warn('[TuckshopFloat] Pending requests snapshot error:', err);
      callback([]);
    }
  );
}

/**
 * Record a float advance / top-up given to counter staff
 */
export async function addFloatTopUp(
  scopeKey: string,
  entry: {
    amount: number;
    note?: string;
    mode?: 'cash' | 'upi' | 'bank_transfer';
    transactionRef?: string;
    userEmail?: string | null;
  }
): Promise<void> {
  await assertWritePermission('Adding Float Top-Up');
  const current = await getSiteFloat(scopeKey);

  const newTopUp: FloatTopUpEntry = {
    id: `topup_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    amount: Math.round(Number(entry.amount) * 100) / 100,
    date: new Date().toISOString(),
    note: entry.note?.trim() || 'Counter petty cash replenishment',
    mode: entry.mode || 'cash',
    addedBy: entry.userEmail || 'manager',
    transactionRef: entry.transactionRef?.trim() || null,
  };

  const updatedTopUps = [newTopUp, ...current.topUps];

  const docRef = doc(db, TUCKSHOP_FLOATS_COLLECTION, scopeKey);
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
export async function submitFloatRequest(
  scopeKey: string,
  entry: {
    amount: number;
    reason?: string;
    preferredMode?: 'cash' | 'upi';
    currentBalance?: number;
    requestedBy: string;
    requestedByEmail?: string | null;
  }
): Promise<FloatRequestEntry> {
  await assertWritePermission('Requesting Float Top-Up');
  const current = await getSiteFloat(scopeKey);

  const reqId = `req_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const newRequest: FloatRequestEntry = {
    id: reqId,
    floatKey: scopeKey,
    siteId: current.siteId,
    location: current.location,
    counterName: current.counterName,
    amount: Math.round(Number(entry.amount) * 100) / 100,
    date: new Date().toISOString(),
    reason: entry.reason?.trim() || 'Morning supplies replenishment',
    preferredMode: entry.preferredMode || 'upi',
    currentBalance: entry.currentBalance !== undefined ? Math.round(entry.currentBalance) : undefined,
    status: 'pending',
    requestedBy: entry.requestedBy,
    requestedByEmail: entry.requestedByEmail,
  };

  // 1. Save in site's float document
  const updatedRequests = [newRequest, ...current.requests];
  const docRef = doc(db, TUCKSHOP_FLOATS_COLLECTION, scopeKey);
  await setDoc(
    docRef,
    {
      ...current,
      requests: updatedRequests,
      updatedAt: serverTimestamp(),
      updatedBy: entry.requestedByEmail,
    },
    { merge: true }
  );

  // 2. Save in central pending requests collection for fast admin listening
  const centralReqRef = doc(db, TUCKSHOP_FLOAT_REQUESTS_COLLECTION, reqId);
  await setDoc(centralReqRef, {
    ...newRequest,
    createdAt: serverTimestamp(),
  });

  return newRequest;
}

/**
 * Approve a pending float request:
 * 1. Marks request as 'approved'
 * 2. Automatically credits the counter's float as a top-up entry
 * 3. Updates central request collection
 */
export async function approveFloatRequest(
  requestId: string,
  details: {
    mode: 'cash' | 'upi' | 'bank_transfer';
    transactionRef?: string;
    note?: string;
    approvedBy: string;
  }
): Promise<void> {
  await assertWritePermission('Approving Float Request');

  // Read request from central collection
  const centralRef = doc(db, TUCKSHOP_FLOAT_REQUESTS_COLLECTION, requestId);
  const snap = await getDoc(centralRef);
  if (!snap.exists()) {
    throw new Error('Float request not found');
  }

  const reqData = snap.data() as FloatRequestEntry;
  const scopeKey = reqData.floatKey || 'newrelic_hyderabad';
  const nowIso = new Date().toISOString();

  // 1. Mark central request approved
  await updateDoc(centralRef, {
    status: 'approved',
    reviewedBy: details.approvedBy,
    reviewedAt: nowIso,
    reviewNotes: details.note || 'Approved by Admin',
    transactionRef: details.transactionRef || null,
  });

  // 2. Add top-up to counter float document and update request status inside it
  const currentFloat = await getSiteFloat(scopeKey);

  const newTopUp: FloatTopUpEntry = {
    id: `topup_req_${requestId}`,
    amount: reqData.amount,
    date: nowIso,
    note: `Approved Request: ${reqData.reason || 'Petty cash top-up'}`,
    mode: details.mode,
    addedBy: details.approvedBy,
    transactionRef: details.transactionRef || null,
  };

  const updatedTopUps = [newTopUp, ...currentFloat.topUps];
  const updatedRequests = currentFloat.requests.map((r) =>
    r.id === requestId
      ? {
          ...r,
          status: 'approved' as const,
          reviewedBy: details.approvedBy,
          reviewedAt: nowIso,
          reviewNotes: details.note || 'Approved by Admin',
          transactionRef: details.transactionRef || null,
        }
      : r
  );

  const floatRef = doc(db, TUCKSHOP_FLOATS_COLLECTION, scopeKey);
  await setDoc(
    floatRef,
    {
      ...currentFloat,
      topUps: updatedTopUps,
      requests: updatedRequests,
      updatedAt: serverTimestamp(),
      updatedBy: details.approvedBy,
    },
    { merge: true }
  );
}

/**
 * Reject a pending float request
 */
export async function rejectFloatRequest(
  requestId: string,
  details: {
    reason?: string;
    reviewedBy: string;
  }
): Promise<void> {
  await assertWritePermission('Rejecting Float Request');

  const centralRef = doc(db, TUCKSHOP_FLOAT_REQUESTS_COLLECTION, requestId);
  const snap = await getDoc(centralRef);
  if (!snap.exists()) {
    throw new Error('Float request not found');
  }

  const reqData = snap.data() as FloatRequestEntry;
  const scopeKey = reqData.floatKey || 'newrelic_hyderabad';
  const nowIso = new Date().toISOString();

  // 1. Mark central request rejected
  await updateDoc(centralRef, {
    status: 'rejected',
    reviewedBy: details.reviewedBy,
    reviewedAt: nowIso,
    reviewNotes: details.reason || 'Declined by Admin',
  });

  // 2. Update request inside float document
  const currentFloat = await getSiteFloat(scopeKey);
  const updatedRequests = currentFloat.requests.map((r) =>
    r.id === requestId
      ? {
          ...r,
          status: 'rejected' as const,
          reviewedBy: details.reviewedBy,
          reviewedAt: nowIso,
          reviewNotes: details.reason || 'Declined by Admin',
        }
      : r
  );

  const floatRef = doc(db, TUCKSHOP_FLOATS_COLLECTION, scopeKey);
  await setDoc(
    floatRef,
    {
      ...currentFloat,
      requests: updatedRequests,
      updatedAt: serverTimestamp(),
      updatedBy: details.reviewedBy,
    },
    { merge: true }
  );
}

/**
 * Configure / update base opening float amount for a counter
 */
export async function updateOpeningFloat(
  scopeKey: string,
  openingFloat: number,
  userEmail?: string | null
): Promise<void> {
  await assertWritePermission('Updating Opening Float');
  const current = await getSiteFloat(scopeKey);
  const docRef = doc(db, TUCKSHOP_FLOATS_COLLECTION, scopeKey);
  await setDoc(
    docRef,
    {
      ...current,
      openingFloat: Math.round(Number(openingFloat) * 100) / 100,
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
  expenses: NewRelicTuckshopRecord[],
  locationFilter?: string
): FloatCalculationResult {
  const openingFloat = Number(floatData.openingFloat) || 5000;
  const cycleStart = floatData.currentCycleStart || getDefaultCycleStart();

  // Sum top-ups logged in this cycle
  const totalTopUps = floatData.topUps.reduce((acc, t) => acc + (Number(t.amount) || 0), 0);
  const totalAdvanceAvailable = openingFloat + totalTopUps;

  // Filter expenses matching this counter and logged since cycleStart
  const totalSpent = expenses
    .filter((e) => {
      if (e.type !== 'expense') return false;
      const expenseDate = e.date || '';
      if (expenseDate < cycleStart) return false;

      // Location match check for multi-location sites like New Relic
      if (locationFilter) {
        const expenseLoc = (e.location || '').toLowerCase();
        if (locationFilter === 'bangalore') {
          return expenseLoc.includes('bangalore') || expenseLoc.includes('blr') || expenseLoc.includes('bagmane');
        } else if (locationFilter === 'hyderabad') {
          return !expenseLoc.includes('bangalore') && !expenseLoc.includes('blr') && !expenseLoc.includes('bagmane');
        }
      }

      return true;
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
    scopeKey: floatData.scopeKey,
    counterName: floatData.counterName,
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
