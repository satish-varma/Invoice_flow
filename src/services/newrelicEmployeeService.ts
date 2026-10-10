import { db } from '@/lib/firebase';
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

export async function getEmployees(): Promise<NewRelicEmployee[]> {
  const q = query(
    collection(db, EMPLOYEES_COLLECTION),
    orderBy('name', 'asc')
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as NewRelicEmployee));
}

export async function getActiveEmployees(location?: string): Promise<NewRelicEmployee[]> {
  const constraints: any[] = [where('isActive', '==', true)];
  if (location) constraints.push(where('location', '==', location));
  const q = query(collection(db, EMPLOYEES_COLLECTION), ...constraints);
  const snapshot = await getDocs(q);
  const list = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as NewRelicEmployee));
  return list.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
}

export async function getEmployee(id: string): Promise<NewRelicEmployee | null> {
  const snap = await getDoc(doc(db, EMPLOYEES_COLLECTION, id));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as NewRelicEmployee;
}

export async function saveEmployee(
  data: Omit<NewRelicEmployee, 'id' | 'createdAt' | 'updatedAt'>,
  editorEmail: string | null,
  existingId?: string
): Promise<string> {
  if (existingId) {
    await updateDoc(doc(db, EMPLOYEES_COLLECTION, existingId), {
      ...data,
      updatedAt: serverTimestamp(),
    });
    return existingId;
  }
  const docRef = await addDoc(collection(db, EMPLOYEES_COLLECTION), {
    ...data,
    createdBy: editorEmail,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return docRef.id;
}

export async function deleteEmployee(id: string): Promise<void> {
  await deleteDoc(doc(db, EMPLOYEES_COLLECTION, id));
}

export async function generateEmployeeId(location: 'hyderabad' | 'bangalore'): Promise<string> {
  const prefix = location === 'hyderabad' ? 'NR-HYD' : 'NR-BLR';
  const q = query(
    collection(db, EMPLOYEES_COLLECTION),
    where('location', '==', location)
  );
  const snap = await getDocs(q);
  const next = snap.size + 1;
  return `${prefix}-${String(next).padStart(3, '0')}`;
}

/** Record a new salary advance */
export async function recordSalaryAdvance(
  data: Omit<NewRelicSalaryAdvance, 'id' | 'createdAt'>,
  editorEmail: string | null
): Promise<string> {
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
  await deleteDoc(doc(db, SALARY_ADVANCES_COLLECTION, id));
}

/** Record a finalized salary payout */
export async function recordSalaryPayment(
  data: Omit<NewRelicSalaryPayment, 'id' | 'createdAt'>,
  editorEmail: string | null
): Promise<string> {
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
