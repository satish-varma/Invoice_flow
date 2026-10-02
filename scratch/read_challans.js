const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, query, where, limit } = require('firebase/firestore');

const firebaseConfig = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSy...",
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "new-relic.firebaseapp.com",
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "new-relic",
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "new-relic.firebasestorage.app",
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "123",
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:123:web:123",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function run() {
  const q = query(collection(db, 'newrelic_challans'), where('location', '==', 'hyderabad'), limit(3));
  const snap = await getDocs(q);
  snap.forEach(doc => {
      console.log(doc.id, doc.data().dcNumber);
      console.log(JSON.stringify(doc.data().lineItems[0], null, 2));
      console.log("procurementCost:", doc.data().procurementCost);
  });
}
run();
