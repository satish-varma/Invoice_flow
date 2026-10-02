require('dotenv').config({ path: '.env.local' });
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, updateDoc, doc } = require('firebase/firestore');

const firebaseConfig = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const cleanUndefined = (obj) => {
    if (Array.isArray(obj)) return obj.map(cleanUndefined);
    if (obj !== null && typeof obj === 'object') {
        const newObj = {};
        Object.keys(obj).forEach(key => {
            if (obj[key] !== undefined) newObj[key] = cleanUndefined(obj[key]);
        });
        return newObj;
    }
    return obj;
};

async function run() {
    const challansSnap = await getDocs(collection(db, 'newrelic_challans'));
    let updated = 0;

    for (const docSnap of challansSnap.docs) {
        const data = docSnap.data();
        let needsUpdate = false;
        
        const newLineItems = (data.lineItems || []).map(item => {
            let p = item.procurementCost;
            if (p === undefined && item.pCost !== undefined) {
                p = item.pCost;
            } else if (p === undefined) {
                p = null; // or 0
            }
            
            // If item has the old pCost key, we need to remove it
            const newItem = { ...item, procurementCost: p };
            if ('pCost' in newItem) {
                delete newItem.pCost;
                needsUpdate = true;
            }
            
            return newItem;
        });

        if (needsUpdate) {
            const payload = cleanUndefined({
                lineItems: newLineItems
            });
            await updateDoc(doc(db, 'newrelic_challans', docSnap.id), payload);
            console.log(`Migrated pCost for ${data.dcNumber}`);
            updated++;
        }
    }
    console.log(`Migrated pCost in ${updated} documents.`);
}

run().catch(console.error).finally(() => process.exit(0));
