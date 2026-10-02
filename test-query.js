const { initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
require('dotenv').config({ path: '.env.local' });
initializeApp({ projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID });
const db = getFirestore();
async function run() {
  const reqs = await db.collection('newrelic_stock_requests').orderBy('createdAt', 'desc').limit(1).get();
  reqs.forEach(doc => console.log('Latest Request:', JSON.stringify(doc.data(), null, 2)));
}
run();
