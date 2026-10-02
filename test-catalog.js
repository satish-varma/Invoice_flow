require('dotenv').config({ path: '.env.local' });
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

const serviceAccount = {
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  clientEmail: 'firebase-adminsdk-xxxxx@invoiceflow-24nxt.iam.gserviceaccount.com',
  privateKey: 'test' // Actually, I don't need the service account if I just use regular client SDK. Let's use the REST API.
};
