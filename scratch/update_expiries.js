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

const expiriesData = {
  "HYD579": [
    {"brand": "Farmley", "item": "Cream and onion", "qty": 120, "expiry": "17-03-2027"},
    {"brand": "Farmley", "item": "Aachari makhana", "qty": 180, "expiry": "17-05-2027"},
    {"brand": "Farmley", "item": "Peri peri makhana", "qty": 120, "expiry": "14-05-2027"},
    {"brand": "Farmley", "item": "Tangy tomato makhana", "qty": 60, "expiry": "29-04-2027"},
    {"brand": "Happilo", "item": "Chilli garlic makhana", "qty": 144, "expiry": "18-05-2027"},
    {"brand": "Happilo", "item": "Peri peri makhana", "qty": 144, "expiry": "04-05-2027"},
    {"brand": "Happilo", "item": "Perky pudina makhana", "qty": 120, "expiry": "21-04-2027"},
    {"brand": "Britannia", "item": "Good day butter", "qty": 90, "expiry": "17-02-2027"},
    {"brand": "Britannia", "item": "Good day Cashew", "qty": 90, "expiry": "15-03-2027"},
    {"brand": "Paper Boat", "item": "Jaljeera juice", "qty": 90, "expiry": "10-03-2027"},
    {"brand": "Paper Boat", "item": "Aamras", "qty": 90, "expiry": "23-03-2027"},
    {"brand": "Paper boat", "item": "Chilli guava juice", "qty": 90, "expiry": "28-02-2027"},
    {"brand": "Karias", "item": "Peanut chiki", "qty": 480, "expiry": "09-12-2026"},
    {"brand": "ShantaG", "item": "All Mix Khakhra", "qty": 512, "expiry": "03-2027"},
    {"brand": "Coca Cola", "item": "Thums up", "qty": 240, "expiry": "01-05-2027"},
    {"brand": "Coca Cola", "item": "Sprite", "qty": 120, "expiry": "28-04-2027"},
    {"brand": "Coca Cola", "item": "Zero Coke", "qty": 360, "expiry": "10-03-2027"}
  ],
  "HYD580": [
    {"brand": "Storia", "item": "Coconut water", "qty": 1500, "expiry": "06-04-2027"},
    {"brand": "Storia", "item": "Coffee shake", "qty": 90, "expiry": "02-04-2027"}, 
    {"brand": "Storia", "item": "Banana shake", "qty": 150, "expiry": "25-04-2027"},
    {"brand": "Storia", "item": "Mango shake", "qty": 150, "expiry": "26-04-2027"},
    {"brand": "Storia", "item": "Chocolate shake", "qty": 210, "expiry": "01-04-2027"},
    {"brand": "Storia", "item": "Pomegranate", "qty": 150, "expiry": "18-04-2027"},
    {"brand": "Fab box", "item": "Spicy lemony chickpeas", "qty": 200, "expiry": "07-03-2027"},
    {"brand": "Fab box", "item": "Soya chips", "qty": 180, "expiry": "07-03-2027"},
    {"brand": "Fab box", "item": "Chocochip Banana", "qty": 200, "expiry": "07-03-2027"}
  ],
  "HYD581": [
    {"brand": "Epigamia", "item": "Mishti doi", "qty": 128, "expiry": "18-10-2026"},
    {"brand": "Epigamia", "item": "Lychee", "qty": 38, "expiry": "13-10-2026"}, 
    {"brand": "Epigamia", "item": "Mango", "qty": 39, "expiry": "13-10-2026"},
    {"brand": "Epigamia", "item": "Strawberry", "qty": 39, "expiry": "16-10-2026"},
    {"brand": "Epigamia", "item": "Chocolate shake", "qty": 208, "expiry": "29-04-2027"},
    {"brand": "Epigamia", "item": "Vanilla Shake", "qty": 250, "expiry": "10-05-2027"}
  ],
  "HYD582": [
    {"brand": "Unibic", "item": "Cashew badam", "qty": 144, "expiry": "09-05-2027"},
    {"brand": "Unibic", "item": "Butter classic", "qty": 144, "expiry": "07-05-2027"},
    {"brand": "Unibic", "item": "Choco ripple", "qty": 144, "expiry": "21-03-2027"},
    {"brand": "Unibic", "item": "Choco nut", "qty": 192, "expiry": "20-03-2027"},
    {"brand": "Unibic", "item": "Fruit & nut", "qty": 192, "expiry": "24-04-2027"},
    {"brand": "Unibic", "item": "Choco chip", "qty": 192, "expiry": "23-04-2027"},
    {"brand": "Town Bus", "item": "Moong dal", "qty": 144, "expiry": "09-01-2027"},
    {"brand": "Town Bus", "item": "Soya Sticks", "qty": 240, "expiry": "19-02-2027"},
    {"brand": "Cavins", "item": "Cold coffee shake", "qty": 150, "expiry": "27-04-2027"},
    {"brand": "Cavins", "item": "Strawberry shake", "qty": 150, "expiry": "18-05-2027"},
    {"brand": "Cavins", "item": "Belgium chocolate shake", "qty": 150, "expiry": "18-05-2027"},
    {"brand": "Cavins", "item": "Kaju butterscotch shake", "qty": 150, "expiry": "10-06-2027"},
    {"brand": "Cavins", "item": "Masala Chaasa", "qty": 150, "expiry": "06-03-2027"}
  ],
  "HYD583": [
    {"brand": "Heritage", "item": "Chocolate caramel shake", "qty": 76, "expiry": "06-05-2027"},
    {"brand": "Epigamia", "item": "Chocolate shake", "qty": 44, "expiry": "12-05-2027"},
    {"brand": "Epigamia", "item": "Vanilla Shake", "qty": 25, "expiry": "10-05-2027"},
    {"brand": "Epigamia", "item": "Strawberry shake", "qty": 300, "expiry": "28-04-2027"},
    {"brand": "Dodla", "item": "Badam milk", "qty": 60, "expiry": "12-01-2027"},
    {"brand": "Milky Mist", "item": "Butter milk", "qty": 116, "expiry": "08-02-2027"}
  ],
  "HYD584": [
    {"brand": "Akshaykalpa", "item": "Plain butter milk", "qty": 300, "expiry": "04-03-2027"},
    {"brand": "Akshaykalpa", "item": "Spicy Buttermilk", "qty": 300, "expiry": "08-03-2027"},
    {"brand": "Epigamia", "item": "Lychee yogurt", "qty": 48, "expiry": "16-10-2026"},
    {"brand": "Epigamia", "item": "Mango yogurt", "qty": 48, "expiry": "21-10-2026"},
    {"brand": "Epigamia", "item": "Strawberry yoghurt", "qty": 48, "expiry": "17-10-2026"}
  ],
  "HYD585": [
    {"brand": "Epigamia", "item": "Lychee yogurt", "qty": 48, "expiry": "27-10-2026"},
    {"brand": "Epigamia", "item": "Mango yogurt", "qty": 48, "expiry": "20-10-2026"},
    {"brand": "Epigamia", "item": "Strawberry yogurt", "qty": 48, "expiry": "15-10-2026"},
    {"brand": "Britannia", "item": "Bourbon", "qty": 140, "expiry": "19-03-2027"},
    {"brand": "Britannia", "item": "Jim jam", "qty": 120, "expiry": "21-03-2027"},
    {"brand": "Britannia", "item": "Good day butter", "qty": 90, "expiry": "06-03-2027"},
    {"brand": "Britannia", "item": "Good day Cashew", "qty": 90, "expiry": "10-03-2027"},
    {"brand": "Paper Boat", "item": "Orange", "qty": 90, "expiry": "09-03-2027"},
    {"brand": "Paper Boat", "item": "Alphonse", "qty": 90, "expiry": "07-03-2027"},
    {"brand": "Paper boat", "item": "Mix fruit", "qty": 90, "expiry": "05-03-2027"},
    {"brand": "Paper boat", "item": "Lychee", "qty": 90, "expiry": "04-03-2027"},
    {"brand": "Paper boat", "item": "Apple", "qty": 90, "expiry": "11-03-2027"},
    {"brand": "Paper Boat", "item": "Aamras", "qty": 90, "expiry": "06-03-2027"},
    {"brand": "Coca Cola", "item": "Thumbs Up", "qty": 120, "expiry": "01-05-2027"},
    {"brand": "Coca Cola", "item": "Sprite", "qty": 120, "expiry": "23-05-2027"},
    {"brand": "Coca Cola", "item": "Dite Coke", "qty": 120, "expiry": "09-01-2027"},
    {"brand": "Coca Cola", "item": "Zero Coke", "qty": 120, "expiry": "15-05-2027"},
    {"brand": "Lay's", "item": "Cream and Onion", "qty": 120, "expiry": "29-12-2026"},
    {"brand": "Lay's", "item": "Magic Masala", "qty": 120, "expiry": "25-12-2027"},
    {"brand": "Haldirams", "item": "Salted peanuts", "qty": 120, "expiry": "19-12-2026"},
    {"brand": "Haldiram", "item": "Soya Sticks", "qty": 96, "expiry": "22-01-2027"},
    {"brand": "Haldiram", "item": "Lite chiwda", "qty": 120, "expiry": "05-12-2026"},
    {"brand": "Haldiram", "item": "Instant bhel", "qty": 144, "expiry": "18-01-2027"},
    {"brand": "Haldiram", "item": "Aloo bhujia", "qty": 96, "expiry": "17-01-2027"},
    {"brand": "Haldiram", "item": "Bhujiya Sev", "qty": 120, "expiry": "08-01-2027"}
  ],
  "HYD586": [
    {"brand": "Yogabar", "item": "Seeds 7in 1 mix", "qty": 720, "expiry": "30-12-2026"},
    {"brand": "Yogabar", "item": "Nut Mix", "qty": 48, "expiry": "28-12-2026"},
    {"brand": "Yogabar", "item": "Panchmeva", "qty": 70, "expiry": "29-12-2026"},
    {"brand": "Yogabar", "item": "Pumpkin seeds", "qty": 1344, "expiry": "27-12-2026"},
    {"brand": "Yogabar", "item": "Sunflower seeds", "qty": 1344, "expiry": "27-12-2026"},
    {"brand": "Yogabar", "item": "Chia seeds", "qty": 1344, "expiry": "29-12-2026"},
    {"brand": "Yogabar", "item": "Flax seeds", "qty": 1344, "expiry": "28-12-2026"},
    {"brand": "Yogabar", "item": "Salted almonds", "qty": 432, "expiry": "28-03-2027"},
    {"brand": "Yogabar", "item": "Salted cashew", "qty": 167, "expiry": "29-03-2027"},
    {"brand": "Yoga Bar", "item": "Salted pista", "qty": 14, "expiry": "10-03-2027"},
    {"brand": "Yogabar", "item": "Trailmix", "qty": 720, "expiry": "29-12-2026"}
  ],
  "HYD587": [
    {"brand": "Storia", "item": "Coconut Water", "qty": 1320, "expiry": "06-05-2027"},
    {"brand": "Storia", "item": "Pomegranate Juice", "qty": 300, "expiry": "18-04-2027"}
  ],
  "HYD588": [
    {"brand": "Epigamia", "item": "Lychee yogurt", "qty": 48, "expiry": "27-10-2026"},
    {"brand": "Epigamia", "item": "Mango yogurt", "qty": 96, "expiry": "27-10-2026"},
    {"brand": "Epigamia", "item": "Strawberry yogurt", "qty": 96, "expiry": "13-10-2026"}
  ]
};

const normalizeStr = (s) => (s || '').replace(/[^a-z0-9]/gi, '').toLowerCase();

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
        if (data.location !== 'hyderabad' || !expiriesData[data.dcNumber]) continue;

        let needsUpdate = false;
        const mappedExpiries = expiriesData[data.dcNumber];
        
        const newLineItems = (data.lineItems || []).map(item => {
            let matched = false;
            let expiry = item.expiry;
            
            // Try to find matching item in mappedExpiries
            // Strategy 1: Match by brand AND normalized item name
            let match = mappedExpiries.find(e => normalizeStr(e.brand) === normalizeStr(item.brandName) && normalizeStr(e.item) === normalizeStr(item.itemName));
            
            // Strategy 2: If no exact string match, match by brand AND qty (risky but okay for missing ones)
            if (!match) {
                match = mappedExpiries.find(e => normalizeStr(e.brand) === normalizeStr(item.brandName) && Number(e.qty) === Number(item.quantity));
            }
            
            // Strategy 3: Just match by qty
            if (!match) {
                match = mappedExpiries.find(e => Number(e.qty) === Number(item.quantity));
            }

            if (match) {
                if (!expiry || expiry === '') {
                    expiry = match.expiry;
                    needsUpdate = true;
                    matched = true;
                }
            }
            
            return {
                ...item,
                expiry: expiry || ''
            };
        });

        if (needsUpdate) {
            const payload = cleanUndefined({
                lineItems: newLineItems
            });
            await updateDoc(doc(db, 'newrelic_challans', docSnap.id), payload);
            console.log(`Updated expiries for ${data.dcNumber}`);
            updated++;
        }
    }
    console.log(`Updated expiries for ${updated} documents.`);
}

run().catch(console.error).finally(() => process.exit(0));
