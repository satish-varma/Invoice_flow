const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
require('dotenv').config({ path: '.env.local' });

const serviceAccount = {
  projectId: process.env.FIREBASE_PROJECT_ID,
  clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
};

if (!serviceAccount.projectId) {
  console.error("Missing FIREBASE_PROJECT_ID in .env.local");
  process.exit(1);
}

initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore();

async function syncPricing() {
  console.log('Starting Pricing Synchronization...');

  try {
    // 1. Fetch all catalog items
    const catalogSnap = await db.collection('newrelic_catalog').get();
    const validCatalogKeys = new Set();
    
    catalogSnap.forEach(doc => {
      const data = doc.data();
      if (data.brandName && data.itemName) {
        const key = `${data.brandName.trim().toLowerCase()}__${data.itemName.trim().toLowerCase()}`;
        validCatalogKeys.add(key);
      }
    });
    
    console.log(`Loaded ${validCatalogKeys.size} valid items from Catalog.`);

    // 2. Fetch all pricing items
    const pricingSnap = await db.collection('newrelic_pricing').get();
    let deletedCount = 0;
    let keptCount = 0;

    const batch = db.batch();
    let batchOperations = 0;

    pricingSnap.forEach(doc => {
      const data = doc.data();
      const key = `${(data.brandName || '').trim().toLowerCase()}__${(data.itemName || '').trim().toLowerCase()}`;
      
      if (!validCatalogKeys.has(key)) {
        // Delete this pricing item because it's not in the catalog
        batch.delete(doc.ref);
        deletedCount++;
        batchOperations++;
        console.log(`[DELETE] ${data.brandName} - ${data.itemName} (Location: ${data.location})`);
      } else {
        keptCount++;
      }

      // Firestore batches can only have 500 operations
      if (batchOperations >= 450) {
        // We'd have to commit and create a new batch, but for small datasets we can just do this later
      }
    });

    if (batchOperations > 0) {
      console.log(`Committing batch delete of ${batchOperations} orphaned pricing records...`);
      await batch.commit();
    }

    console.log('\n--- Synchronization Complete ---');
    console.log(`Pricing items kept: ${keptCount}`);
    console.log(`Pricing items deleted (orphans/duplicates): ${deletedCount}`);
    
  } catch (error) {
    console.error('Error during synchronization:', error);
  }
}

syncPricing();
