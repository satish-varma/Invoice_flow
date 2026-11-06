import { db } from '@/lib/firebase';
import {
  collection,
  doc,
  getDocs,
  setDoc,
  deleteDoc,
  onSnapshot,
  query,
} from 'firebase/firestore';
import {
  CompanySite,
  DEFAULT_COMPANY_SITES,
  registerCompanySites,
  SiteId,
} from '@/types/site';

const SITES_COLLECTION = 'company_sites';

/**
 * Fetch all dynamic sites from Firestore and register into memory.
 * Returns combined list of default built-in sites + dynamic custom sites.
 */
export async function fetchCompanySites(): Promise<CompanySite[]> {
  try {
    const snap = await getDocs(collection(db, SITES_COLLECTION));
    const dynamicSites: CompanySite[] = [];
    snap.forEach((docSnap) => {
      const data = docSnap.data();
      dynamicSites.push({
        id: docSnap.id as SiteId,
        name: data.name || docSnap.id,
        allowedLocations: data.allowedLocations || ['hyderabad'],
        hasChallans: Boolean(data.hasChallans),
        tagline: data.tagline || '',
        description: data.description || '',
        isCustom: true,
        createdAt: data.createdAt || new Date().toISOString(),
      });
    });

    registerCompanySites(dynamicSites);

    const allSitesMap = new Map<string, CompanySite>();
    Object.values(DEFAULT_COMPANY_SITES).forEach((s) => allSitesMap.set(s.id, s));
    dynamicSites.forEach((s) => allSitesMap.set(s.id, s));

    return Array.from(allSitesMap.values());
  } catch (err) {
    console.error('Error fetching company sites:', err);
    return Object.values(DEFAULT_COMPANY_SITES);
  }
}

/**
 * Subscribes in real-time to changes in the company_sites collection.
 */
export function subscribeCompanySites(
  onUpdate: (sites: CompanySite[]) => void
): () => void {
  try {
    const q = query(collection(db, SITES_COLLECTION));
    return onSnapshot(
      q,
      (snapshot) => {
        const dynamicSites: CompanySite[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          dynamicSites.push({
            id: docSnap.id as SiteId,
            name: data.name || docSnap.id,
            allowedLocations: data.allowedLocations || ['hyderabad'],
            hasChallans: Boolean(data.hasChallans),
            tagline: data.tagline || '',
            description: data.description || '',
            isCustom: true,
            createdAt: data.createdAt || new Date().toISOString(),
          });
        });

        registerCompanySites(dynamicSites);

        const allSitesMap = new Map<string, CompanySite>();
        Object.values(DEFAULT_COMPANY_SITES).forEach((s) => allSitesMap.set(s.id, s));
        dynamicSites.forEach((s) => allSitesMap.set(s.id, s));

        onUpdate(Array.from(allSitesMap.values()));
      },
      (error) => {
        console.warn('subscribeCompanySites snapshot listener error:', error);
        onUpdate(Object.values(DEFAULT_COMPANY_SITES));
      }
    );
  } catch (err) {
    console.warn('Failed to subscribe to company sites:', err);
    onUpdate(Object.values(DEFAULT_COMPANY_SITES));
    return () => {};
  }
}

/**
 * Creates or updates a company site in Firestore.
 */
export async function saveCompanySite(site: {
  id?: string;
  name: string;
  allowedLocations: ('hyderabad' | 'bangalore')[];
  hasChallans?: boolean;
  tagline?: string;
  description?: string;
}): Promise<CompanySite> {
  const trimmedName = site.name.trim();
  if (!trimmedName) {
    throw new Error('Site name is required.');
  }

  // Generate URL/code-friendly slug if id not provided
  let cleanId = (site.id || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

  if (!cleanId) {
    cleanId = trimmedName.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  }
  if (!cleanId) {
    cleanId = `site_${Date.now()}`;
  }

  const siteRecord: CompanySite = {
    id: cleanId,
    name: trimmedName,
    allowedLocations:
      site.allowedLocations && site.allowedLocations.length > 0
        ? site.allowedLocations
        : ['hyderabad'],
    hasChallans: Boolean(site.hasChallans),
    tagline: site.tagline?.trim() || `${trimmedName} Tuckshop`,
    description:
      site.description?.trim() ||
      `${trimmedName} counter sales and daily staff attendance.`,
    isCustom: true,
    createdAt: new Date().toISOString(),
  };

  const docRef = doc(db, SITES_COLLECTION, cleanId);
  await setDoc(docRef, siteRecord, { merge: true });

  registerCompanySites([siteRecord]);
  return siteRecord;
}

/**
 * Deletes a dynamic custom site from Firestore.
 * Built-in default sites (newrelic, dsm, ntt_data) are protected from deletion.
 */
export async function deleteCompanySite(siteId: string): Promise<void> {
  if (siteId === 'newrelic' || siteId === 'dsm' || siteId === 'ntt_data') {
    throw new Error('Default built-in system sites cannot be deleted.');
  }
  const docRef = doc(db, SITES_COLLECTION, siteId);
  await deleteDoc(docRef);
}
