const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
require('dotenv').config({ path: '.env.local' });

const serviceAccount = {
  projectId: process.env.FIREBASE_PROJECT_ID,
  clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
};

if (!process.env.FIREBASE_PROJECT_ID) {
  console.log("No FIREBASE_PROJECT_ID provided in .env.local");
  process.exit(1);
}

initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore();

async function run() {
  const snapshot = await db.collection('newrelic_stock_requests').where('createdBy', '==', 'Unknown').get();
  console.log(`Found ${snapshot.size} requests with 'Unknown'.`);
  
  const batch = db.batch();
  snapshot.docs.forEach(doc => {
    batch.update(doc.ref, { createdBy: 'manager@hungerbox.com' }); // fallback 
  });
  
  await batch.commit();
  console.log('Updated to manager@hungerbox.com');
}

run().catch(console.error).finally(() => process.exit(0));
