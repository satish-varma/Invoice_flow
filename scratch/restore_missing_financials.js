require('dotenv').config({ path: '.env.local' });
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, updateDoc, doc } = require('firebase/firestore');

const firebaseConfig = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
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
    const pricingSnap = await getDocs(collection(db, 'newrelic_pricing'));
    const pricingMap = new Map();
    pricingSnap.forEach(docSnap => {
        const d = docSnap.data();
        pricingMap.set(`${(d.brandName || '').trim().toLowerCase()}__${(d.itemName || '').trim().toLowerCase()}`, d);
    });

    const challansSnap = await getDocs(collection(db, 'newrelic_challans'));
    let updated = 0;

    for (const docSnap of challansSnap.docs) {
        const data = docSnap.data();
        if (data.location !== 'hyderabad') continue;

        let needsUpdate = false;
        
        const newLineItems = (data.lineItems || []).map(item => {
            let mrp = item.mrp;
            let pCost = item.procurementCost !== undefined ? item.procurementCost : item.pCost;

            if (mrp === undefined || pCost === undefined || pCost === null || mrp === null || isNaN(mrp) || isNaN(pCost)) {
                const key = `${(item.brandName || '').trim().toLowerCase()}__${(item.itemName || '').trim().toLowerCase()}`;
                const pricing = pricingMap.get(key);
                if (pricing) {
                    if (mrp === undefined || mrp === null || isNaN(mrp)) mrp = pricing.mrp;
                    if (pCost === undefined || pCost === null || isNaN(pCost)) pCost = pricing.purchaseCost;
                    needsUpdate = true;
                }
            }
            return {
                ...item,
                mrp: mrp !== undefined ? mrp : null,
                procurementCost: pCost !== undefined ? pCost : null,
            };
        });

        if (needsUpdate) {
            const calculatedTotalPCost = newLineItems.reduce((acc, item) => acc + ((item.procurementCost || 0) * (item.quantity || 1)), 0);
            const payload = cleanUndefined({
                lineItems: newLineItems,
                procurementCost: calculatedTotalPCost,
            });
            await updateDoc(doc(db, 'newrelic_challans', docSnap.id), payload);
            console.log(`Restored financials for ${data.dcNumber}`);
            updated++;
        }
    }
    console.log(`Restored financials for ${updated} documents.`);
}

run().catch(console.error).finally(() => process.exit(0));
