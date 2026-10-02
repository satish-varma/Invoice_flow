require('dotenv').config({ path: '.env.local' });
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, query, where } = require('firebase/firestore');

const app = initializeApp({
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
});
const db = getFirestore(app);

async function run() {
    const q = query(collection(db, 'newrelic_challans'), where('dcNumber', '==', 'HYD580'));
    const snap = await getDocs(q);
    snap.forEach(doc => {
        console.log(JSON.stringify(doc.data().lineItems, null, 2));
    });
}
run().catch(console.error).finally(() => process.exit(0));
