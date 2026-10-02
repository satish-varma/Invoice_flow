import { initializeApp } from 'firebase/app';
import { getFirestore, doc, updateDoc, getDoc } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function test() {
  const dcNumber = 'HYD580';
  // I will just get the doc ID directly for HYD580
  import { collection, query, where, getDocs } from 'firebase/firestore';
  const q = query(collection(db, 'newrelic-challans'), where('dcNumber', '==', dcNumber));
  const snap = await getDocs(q);
  if (snap.empty) { console.log('Not found'); return; }
  
  const docRef = snap.docs[0].ref;
  const data = snap.docs[0].data();
  console.log("BEFORE:", JSON.stringify(data.lineItems[0], null, 2));
  
  // Let's simulate a save with a string "999" (from RHF)
  const simulatedValues = {
    procurementCost: "999"
  };
  
  const originalItem = data.lineItems[0];
  const item = { ...originalItem, ...simulatedValues };
  
  const processedPCost = item.procurementCost !== undefined && !Number.isNaN(item.procurementCost) ? Number(item.procurementCost) : (originalItem.procurementCost ?? originalItem.pCost);
  
  console.log("PROCESSED P.COST:", processedPCost);
  
  process.exit(0);
}
test().catch(console.error);
