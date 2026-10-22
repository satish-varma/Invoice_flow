import { db } from '@/lib/firebase';
import { assertWritePermission } from '@/lib/readOnlyGuard';
import {
  collection,
  addDoc,
  getDocs,
  doc,
  updateDoc,
  deleteDoc,
  getDoc,
  serverTimestamp,
  query,
  orderBy,
  where,
} from 'firebase/firestore';
import { NewRelicEmployee, NewRelicSalaryAdvance, NewRelicSalaryPayment } from '@/types/employee';

const EMPLOYEES_COLLECTION = 'newrelic_employees';
const SALARY_ADVANCES_COLLECTION = 'newrelic_salary_advances';
const SALARY_PAYMENTS_COLLECTION = 'newrelic_salary_payments';

export async function getEmployees(siteId?: string): Promise<NewRelicEmployee[]> {
  const snapshot = await getDocs(collection(db, EMPLOYEES_COLLECTION));
  let list = snapshot.docs.map((d) => ({
    id: d.id,
    ...d.data(),
    siteId: d.data().siteId || 'newrelic',
  } as NewRelicEmployee));
  if (siteId) {
    list = list.filter((e) => (e.siteId || 'newrelic') === siteId);
  }
  return list.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
}

import { setCachedData, getCachedData } from '@/services/offlineSyncService';

export async function getActiveEmployees(location?: string, siteId?: string): Promise<NewRelicEmployee[]> {
  const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;

  if (isOffline) {
    const cached = await getCachedData<NewRelicEmployee[]>('active_employees_roster');
    if (cached && cached.length) {
      let filtered = cached.filter((e) => e.isActive !== false);
      if (location) filtered = filtered.filter((e) => e.location === location);
      if (siteId) filtered = filtered.filter((e) => (e.siteId || 'newrelic') === siteId);
      return filtered.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    }
  }

  try {
    const snapshot = await getDocs(collection(db, EMPLOYEES_COLLECTION));
    let list = snapshot.docs.map((d) => ({
      id: d.id,
      ...d.data(),
      siteId: d.data().siteId || 'newrelic',
    } as NewRelicEmployee));
    
    // Save to IndexedDB offline cache
    setCachedData('active_employees_roster', list).catch(() => {});

    list = list.filter((e) => e.isActive !== false);
    if (location) {
      list = list.filter((e) => e.location === location);
    }
    if (siteId) {
      list = list.filter((e) => (e.siteId || 'newrelic') === siteId);
    }
    return list.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  } catch (error) {
    console.warn('Notice: Error fetching active employees online, checking offline cache:', error);
    const cached = await getCachedData<NewRelicEmployee[]>('active_employees_roster');
    if (cached && cached.length) {
      console.log('[Offline] Serving active employees roster from IndexedDB cache');
      let filtered = cached.filter((e) => e.isActive !== false);
      if (location) filtered = filtered.filter((e) => e.location === location);
      if (siteId) filtered = filtered.filter((e) => (e.siteId || 'newrelic') === siteId);
      return filtered.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    }
    return [];
  }
}

export async function getEmployee(id: string): Promise<NewRelicEmployee | null> {
  const snap = await getDoc(doc(db, EMPLOYEES_COLLECTION, id));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data(), siteId: snap.data().siteId || 'newrelic' } as NewRelicEmployee;
}

export async function saveEmployee(
  data: Omit<NewRelicEmployee, 'id' | 'createdAt' | 'updatedAt'>,
  editorEmail: string | null,
  existingId?: string
): Promise<string> {
  await assertWritePermission('Saving Employee');
  const payload = {
    ...data,
    siteId: data.siteId || 'newrelic',
  };
  if (existingId) {
    await updateDoc(doc(db, EMPLOYEES_COLLECTION, existingId), {
      ...payload,
      updatedAt: serverTimestamp(),
    });
    return existingId;
  }
  const docRef = await addDoc(collection(db, EMPLOYEES_COLLECTION), {
    ...payload,
    createdBy: editorEmail,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return docRef.id;
}

export async function deleteEmployee(id: string): Promise<void> {
  await assertWritePermission('Deleting Employee');
  await deleteDoc(doc(db, EMPLOYEES_COLLECTION, id));
}

export async function generateEmployeeId(location: 'hyderabad' | 'bangalore', siteId: string = 'newrelic'): Promise<string> {
  let prefix = location === 'hyderabad' ? 'NR-HYD' : 'NR-BLR';
  if (siteId === 'dsm') prefix = 'DSM-HYD';
  if (siteId === 'ntt_data') prefix = 'NTT-HYD';

  const snapshot = await getDocs(collection(db, EMPLOYEES_COLLECTION));
  const count = snapshot.docs.filter((d) => {
    const data = d.data();
    const docSite = data.siteId || 'newrelic';
    return docSite === siteId && data.location === location;
  }).length;
  const next = count + 1;
  return `${prefix}-${String(next).padStart(3, '0')}`;
}

/** Record a new salary advance */
export async function recordSalaryAdvance(
  data: Omit<NewRelicSalaryAdvance, 'id' | 'createdAt'>,
  editorEmail: string | null
): Promise<string> {
  await assertWritePermission('Recording Salary Advance');
  const docRef = await addDoc(collection(db, SALARY_ADVANCES_COLLECTION), {
    ...data,
    status: 'pending',
    createdBy: editorEmail,
    createdAt: serverTimestamp(),
  });
  return docRef.id;
}

/** Get salary advances for a specific month (e.g. '2026-10') */
export async function getSalaryAdvancesForMonth(month: string): Promise<NewRelicSalaryAdvance[]> {
  const q = query(
    collection(db, SALARY_ADVANCES_COLLECTION),
    where('month', '==', month)
  );
  const snap = await getDocs(q);
  const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as NewRelicSalaryAdvance));
  return list.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
}

/** Delete or void a salary advance */
export async function deleteSalaryAdvance(id: string): Promise<void> {
  await assertWritePermission('Deleting Salary Advance');
  await deleteDoc(doc(db, SALARY_ADVANCES_COLLECTION, id));
}

/** Record a finalized salary payout */
export async function recordSalaryPayment(
  data: Omit<NewRelicSalaryPayment, 'id' | 'createdAt'>,
  editorEmail: string | null
): Promise<string> {
  await assertWritePermission('Recording Salary Payment');
  const docRef = await addDoc(collection(db, SALARY_PAYMENTS_COLLECTION), {
    ...data,
    status: 'paid',
    createdBy: editorEmail,
    createdAt: serverTimestamp(),
  });
  return docRef.id;
}

/** Get salary payments for a given month */
export async function getSalaryPaymentsForMonth(month: string): Promise<NewRelicSalaryPayment[]> {
  const q = query(
    collection(db, SALARY_PAYMENTS_COLLECTION),
    where('month', '==', month)
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as NewRelicSalaryPayment));
}

/** Get all recorded salary payments across all months */
export async function getAllSalaryPayments(): Promise<NewRelicSalaryPayment[]> {
  const snap = await getDocs(collection(db, SALARY_PAYMENTS_COLLECTION));
  const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as NewRelicSalaryPayment));
  return list.sort((a, b) => {
    const timeA = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : 0;
    const timeB = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : 0;
    return timeB - timeA;
  });
}
