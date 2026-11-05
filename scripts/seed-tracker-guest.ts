import { db } from '../src/lib/firebase';
import { collection, query, where, getDocs, doc, setDoc, updateDoc } from 'firebase/firestore';
import { hashPassword } from '../src/lib/hash';

async function seedTrackerGuest() {
  const email = 'tracker.guest@gutguru.com';
  const password = 'TrackerGuest@2026';
  const hashedPassword = hashPassword(password);

  console.log(`Checking for existing user: ${email}...`);
  const usersRef = collection(db, 'users');
  const q = query(usersRef, where('email', '==', email));
  const snap = await getDocs(q);

  const userData = {
    email: email,
    password: hashedPassword,
    role: 'guest',
    status: 'active',
    tokenVersion: 1,
    assignedSite: 'newrelic',
    assignedSites: ['newrelic'],
    preferredLocations: ['hyderabad'],
    defaultLandingPage: '/tracker',
    allowedTabs: ['hungerbox_tracker'], // Note: hungerbox_tracker_invoices is omitted (restricted by default)
    assignedApps: [],
    assignedStartDate: '2026-10-01',
    assignedLocations: ['New Relic', 'Broadridge'],
    assignedStalls: ['Relic Fresh', 'Slurpstore Bakery'],
    canDelete: false,
    createdAt: new Date().toISOString(),
  };

  if (!snap.empty) {
    const existingDoc = snap.docs[0];
    console.log(`Updating existing user doc: ${existingDoc.id}...`);
    await updateDoc(doc(db, 'users', existingDoc.id), {
      ...userData,
      tokenVersion: (existingDoc.data().tokenVersion || 1) + 1,
    });
    console.log(`User ${email} updated successfully!`);
  } else {
    console.log(`Creating new user...`);
    const newDocRef = doc(collection(db, 'users'));
    await setDoc(newDocRef, userData);
    console.log(`User ${email} created successfully with ID: ${newDocRef.id}!`);
  }

  console.log('\n--- Account Details ---');
  console.log(`Email: ${email}`);
  console.log(`Password: ${password}`);
  console.log(`Role: guest (Read-Only)`);
  console.log(`Landing Page: /tracker`);
  console.log(`Allowed Tabs: ['hungerbox_tracker'] (Access to /tracker/invoices blocked)`);
  console.log(`Assigned Start Date: 2026-10-01`);
  console.log(`Assigned Locations: ['New Relic', 'Broadridge']`);
  console.log(`Assigned Stalls: ['Relic Fresh', 'Slurpstore Bakery']`);
}

seedTrackerGuest().catch(console.error);
