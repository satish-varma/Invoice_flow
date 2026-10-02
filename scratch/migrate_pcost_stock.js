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
    const snap = await getDocs(collection(db, 'newrelic_stock_requests'));
    let updated = 0;

    for (const docSnap of snap.docs) {
        const data = docSnap.data();
        let needsUpdate = false;
        
        const newLineItems = (data.lineItems || []).map(item => {
            let p = item.procurementCost;
            if (p === undefined && item.pCost !== undefined) {
                p = item.pCost;
            } else if (p === undefined) {
                p = null;
            }
            
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
            await updateDoc(doc(db, 'newrelic_stock_requests', docSnap.id), payload);
            console.log(`Migrated pCost for stock request ${docSnap.id}`);
            updated++;
        }
    }
    console.log(`Migrated pCost in ${updated} stock requests.`);
}

run().catch(console.error).finally(() => process.exit(0));
