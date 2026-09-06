import { db } from '@/lib/firebase';
import {
  collection,
  getDocs,
  doc,
  setDoc,
  writeBatch,
  query,
  limit,
} from 'firebase/firestore';

export interface CatalogItem {
  id?: string;
  brandName: string;
  itemName: string;
  defaultQuantity: number;
}

const CATALOG_COLLECTION = 'newrelic_catalog';

// 113 Unique Brand & Description Catalog Items from provided dataset
const DEFAULT_CATALOG: CatalogItem[] = [
  { brandName: 'Storia', itemName: 'Coconut Water', defaultQuantity: 1 },
  { brandName: 'The Drill', itemName: 'Nimbu Pudina', defaultQuantity: 1 },
  { brandName: 'The Drill', itemName: 'Cheese', defaultQuantity: 1 },
  { brandName: 'The Drill', itemName: 'Sea Salt', defaultQuantity: 1 },
  { brandName: 'The Drill', itemName: 'Peri Peri Lemon', defaultQuantity: 1 },
  { brandName: 'Zumi', itemName: 'Rasmalai', defaultQuantity: 1 },
  { brandName: 'Haldiram', itemName: 'Tasty Nuts', defaultQuantity: 1 },
  { brandName: 'Amul', itemName: 'Buttermilk', defaultQuantity: 1 },
  { brandName: 'Cavins', itemName: 'Masala Chaas', defaultQuantity: 1 },
  { brandName: 'Jersey', itemName: 'Buttermilk', defaultQuantity: 1 },
  { brandName: 'Coca Cola', itemName: 'Sprite', defaultQuantity: 1 },
  { brandName: 'Coca Cola', itemName: 'Thumbs Up', defaultQuantity: 1 },
  { brandName: 'Coca Cola', itemName: 'Coke', defaultQuantity: 1 },
  { brandName: 'Britannia', itemName: 'Good Day Butter', defaultQuantity: 1 },
  { brandName: 'Britannia', itemName: 'Maska Chaska', defaultQuantity: 1 },
  { brandName: 'Cadbury', itemName: 'Oreo', defaultQuantity: 1 },
  { brandName: 'Rite Bite', itemName: 'Cheese Jalapeno', defaultQuantity: 1 },
  { brandName: 'Beyond', itemName: 'Salt & Black Pepper', defaultQuantity: 1 },
  { brandName: 'ShantaG', itemName: 'All Mix Khakhra', defaultQuantity: 1 },
  { brandName: 'Healthy Master', itemName: 'Ragi Chips', defaultQuantity: 1 },
  { brandName: 'Healthy Master', itemName: 'Palak Chips', defaultQuantity: 1 },
  { brandName: 'Healthy Master', itemName: 'Mix Veg Chips', defaultQuantity: 1 },
  { brandName: 'Britannia', itemName: 'Strawberry Shake', defaultQuantity: 1 },
  { brandName: 'Britannia', itemName: 'Mariegold', defaultQuantity: 1 },
  { brandName: 'Kairas', itemName: 'Peanut Chikki', defaultQuantity: 1 },
  { brandName: 'Beyond Snacks', itemName: 'Peri Peri', defaultQuantity: 1 },
  { brandName: 'Haldiram', itemName: 'Soya Sticks', defaultQuantity: 1 },
  { brandName: "Lay's", itemName: 'Spanish Tomato', defaultQuantity: 1 },
  { brandName: 'Raw', itemName: 'Coconut Water', defaultQuantity: 1 },
  { brandName: 'Bindu', itemName: 'Fizz Jeera Masala', defaultQuantity: 1 },
  { brandName: 'Milky Mist', itemName: 'Buttermilk', defaultQuantity: 1 },
  { brandName: 'Heritage', itemName: 'Buttermilk', defaultQuantity: 1 },
  { brandName: 'Epigamia', itemName: 'Chocolate Milkshake', defaultQuantity: 1 },
  { brandName: 'Dodla', itemName: 'Pista Badam Milk', defaultQuantity: 1 },
  { brandName: 'Dodla', itemName: 'Badam Milk', defaultQuantity: 1 },
  { brandName: 'Haldiram', itemName: 'Masala Sev Murmura', defaultQuantity: 1 },
  { brandName: "Lay's", itemName: 'Cream and Onion', defaultQuantity: 1 },
  { brandName: 'Mcvities', itemName: 'Butter Cookies', defaultQuantity: 1 },
  { brandName: 'Parle', itemName: 'Nutticrunch', defaultQuantity: 1 },
  { brandName: 'Healthy Master', itemName: 'Soya Chips', defaultQuantity: 1 },
  { brandName: 'Healthy Master', itemName: 'Oats Chips', defaultQuantity: 1 },
  { brandName: 'Healthy Master', itemName: 'Beetroot Chips', defaultQuantity: 1 },
  { brandName: 'Paperboat', itemName: 'Coconut Water', defaultQuantity: 1 },
  { brandName: 'Yogabar', itemName: 'Nuts & Seeds', defaultQuantity: 1 },
  { brandName: 'Haldiram', itemName: 'Salted Peanuts', defaultQuantity: 1 },
  { brandName: 'Britannia', itemName: 'Vanilla Milkshake', defaultQuantity: 1 },
  { brandName: 'Britannia', itemName: 'Chocolate Milkshake', defaultQuantity: 1 },
  { brandName: 'Britannia', itemName: 'Bourbon Milkshake', defaultQuantity: 1 },
  { brandName: 'Britannia', itemName: 'Milk Bikis', defaultQuantity: 1 },
  { brandName: 'Storia', itemName: 'Pomegranate', defaultQuantity: 1 },
  { brandName: 'Storia', itemName: 'Banana Milkshake', defaultQuantity: 1 },
  { brandName: 'Storia', itemName: 'Chocolate Milkshake', defaultQuantity: 1 },
  { brandName: 'Storia', itemName: 'Coffee Shake', defaultQuantity: 1 },
  { brandName: 'Storia', itemName: 'Mango Shake', defaultQuantity: 1 },
  { brandName: 'Zumi', itemName: 'Chocolate Shake', defaultQuantity: 1 },
  { brandName: 'Zumi', itemName: 'Rose Kulfi Shake', defaultQuantity: 1 },
  { brandName: 'Storia', itemName: 'Badam Shake', defaultQuantity: 1 },
  { brandName: 'Coca Cola', itemName: 'Diet Coke', defaultQuantity: 1 },
  { brandName: 'Coca Cola', itemName: 'Zero Coke', defaultQuantity: 1 },
  { brandName: 'Haldiram', itemName: 'Bhujiya Sev', defaultQuantity: 1 },
  { brandName: 'Haldiram', itemName: 'Crushed Peanut', defaultQuantity: 1 },
  { brandName: 'Haldiram', itemName: 'Chatpata Matar', defaultQuantity: 1 },
  { brandName: "Lay's", itemName: 'Magic Masala', defaultQuantity: 1 },
  { brandName: 'Britannia', itemName: 'Good Day Cashew', defaultQuantity: 1 },
  { brandName: 'Tropicana', itemName: 'Appltini', defaultQuantity: 1 },
  { brandName: 'Tropicana', itemName: 'Pomegranate', defaultQuantity: 1 },
  { brandName: 'Tropicana', itemName: 'Litchi', defaultQuantity: 1 },
  { brandName: 'Britannia', itemName: 'Jim Jam', defaultQuantity: 1 },
  { brandName: 'Britannia', itemName: 'Sweet & Salty', defaultQuantity: 1 },
  { brandName: 'Agvit', itemName: 'All Mix Khakhra', defaultQuantity: 1 },
  { brandName: 'Yogabar', itemName: 'Orange Cashew', defaultQuantity: 1 },
  { brandName: 'Happilo Makhana', itemName: 'Hot Peri Peri', defaultQuantity: 1 },
  { brandName: 'Happilo Makhana', itemName: 'Cream and Onion', defaultQuantity: 1 },
  { brandName: 'Happilo Makhana', itemName: 'Chilli Garlic', defaultQuantity: 1 },
  { brandName: 'Too Yumm', itemName: 'Bhoot Chips', defaultQuantity: 1 },
  { brandName: 'Beyond Snacks', itemName: 'Desi Masala', defaultQuantity: 1 },
  { brandName: 'Epigamia', itemName: 'Chocolate Shake', defaultQuantity: 1 },
  { brandName: 'Epigamia', itemName: 'Vanilla Shake', defaultQuantity: 1 },
  { brandName: 'Bisleri (500ml)', itemName: 'Water Bottles', defaultQuantity: 1 },
  { brandName: 'Tropicana', itemName: 'Litchi Juices', defaultQuantity: 1 },
  { brandName: 'Yogabar', itemName: 'Vanilla Almond Bar', defaultQuantity: 1 },
  { brandName: 'Britannia', itemName: 'Marie Gold', defaultQuantity: 1 },
  { brandName: 'Max Protein', itemName: 'Cream and Onion', defaultQuantity: 1 },
  { brandName: 'Healthy Master', itemName: 'Quinoa Chips', defaultQuantity: 1 },
  { brandName: 'Healthy Master', itemName: 'Jowar Chips', defaultQuantity: 1 },
  { brandName: 'Gatorade', itemName: 'Orange', defaultQuantity: 1 },
  { brandName: 'Gatorade', itemName: 'Lemon', defaultQuantity: 1 },
  { brandName: 'Gatorade', itemName: 'Blue Bolt', defaultQuantity: 1 },
  { brandName: 'Storia', itemName: 'Pomegranate Juice', defaultQuantity: 1 },
  { brandName: 'Bindu', itemName: 'Jeera Masala', defaultQuantity: 1 },
  { brandName: 'Yogabar', itemName: 'Chocolate Chunk Nut', defaultQuantity: 1 },
  { brandName: 'Farmley', itemName: 'Cream and Onion', defaultQuantity: 1 },
  { brandName: 'Farmley', itemName: 'Tangy Tomato', defaultQuantity: 1 },
  { brandName: 'Farmley', itemName: 'Peri Peri', defaultQuantity: 1 },
  { brandName: 'Farmley', itemName: 'Achari', defaultQuantity: 1 },
  { brandName: 'Happilo', itemName: 'Pink Salt and Pepper', defaultQuantity: 1 },
  { brandName: 'Happilo', itemName: 'Chilli Garlic', defaultQuantity: 1 },
  { brandName: 'Beyond Snacks', itemName: 'Salt & Pepper', defaultQuantity: 1 },
  { brandName: 'Beyond Snacks', itemName: 'Hot & Sweet Chilli', defaultQuantity: 1 },
  { brandName: 'Beyond Snacks', itemName: 'Sour Cream', defaultQuantity: 1 },
  { brandName: 'Beyond Snacks', itemName: 'Original Style', defaultQuantity: 1 },
  { brandName: 'Yogabar', itemName: 'DC+ Cranberry', defaultQuantity: 1 },
  { brandName: 'Yogabar', itemName: 'Roasted Cashew', defaultQuantity: 1 },
  { brandName: 'Yogabar', itemName: 'Trailmix', defaultQuantity: 1 },
  { brandName: 'Yogabar', itemName: 'Nut Mix', defaultQuantity: 1 },
  { brandName: 'Yogabar', itemName: 'R&S Pistachio', defaultQuantity: 1 },
  { brandName: 'Yogabar', itemName: 'R&S Almond', defaultQuantity: 1 },
  { brandName: 'Yogabar', itemName: 'Panchmeva', defaultQuantity: 1 },
  { brandName: 'Yogabar', itemName: 'Apricot Fig', defaultQuantity: 1 },
  { brandName: 'Yogabar', itemName: 'Blue Berry Pie', defaultQuantity: 1 },
  { brandName: 'Yogabar', itemName: 'Dark Chocolate', defaultQuantity: 1 },
  { brandName: 'Yogabar', itemName: 'Protein Mini Coffee Crash', defaultQuantity: 1 },
  { brandName: 'Yogabar', itemName: 'Protein Mini Choco Peanut Butter', defaultQuantity: 1 },
  { brandName: 'Britannia', itemName: 'Strawberry Milk Shake', defaultQuantity: 1 },
  { brandName: 'Britannia', itemName: 'Bourbon Shake', defaultQuantity: 1 },
  { brandName: 'Britannia', itemName: 'Vanilla Shake', defaultQuantity: 1 },
  { brandName: 'Paperboat', itemName: 'Aampana Juice', defaultQuantity: 1 },
  { brandName: 'Paperboat', itemName: 'Anar Juice', defaultQuantity: 1 },
  { brandName: 'Paperboat', itemName: 'Jal Jeera Juice', defaultQuantity: 1 },
  { brandName: 'Tropicana', itemName: 'Pomegranate Juice', defaultQuantity: 1 },
  { brandName: 'Tropicana', itemName: 'Orange Delight', defaultQuantity: 1 },
  { brandName: "Lay's", itemName: 'Tangy Tomato Chips', defaultQuantity: 1 },
  { brandName: 'Bisleri (250ml)', itemName: 'Water Bottles', defaultQuantity: 1 },
  { brandName: 'Kinley (250ml)', itemName: 'Water Bottles', defaultQuantity: 1 },
  { brandName: 'Jersey', itemName: 'Sweet Lassi', defaultQuantity: 1 },
  { brandName: 'Haldiram', itemName: 'Mini Bhakarwadi', defaultQuantity: 1 },
  { brandName: 'Haldiram', itemName: 'Mixture', defaultQuantity: 1 },
  { brandName: 'The Drill', itemName: 'Tangy Tomato', defaultQuantity: 1 },
  { brandName: 'The Drill', itemName: 'Peri Peri', defaultQuantity: 1 },
  { brandName: 'Happilo', itemName: 'Perky Pudina', defaultQuantity: 1 },
  { brandName: 'Tropicana', itemName: 'Appltini Juice', defaultQuantity: 1 },
  { brandName: 'Tropicana', itemName: 'Guava Juice', defaultQuantity: 1 },
  { brandName: 'Paperboat', itemName: 'Orange Juice', defaultQuantity: 1 },
  { brandName: 'Pepsi', itemName: 'Mountain Dew', defaultQuantity: 1 },
  { brandName: 'Pepsi', itemName: '7UP', defaultQuantity: 1 },
  { brandName: 'Pepsi', itemName: 'Pepsi', defaultQuantity: 1 },
  { brandName: 'Parle', itemName: 'Monaco', defaultQuantity: 1 }
];

export async function getCatalogItems(): Promise<CatalogItem[]> {
  try {
    const q = query(collection(db, CATALOG_COLLECTION), limit(300));
    const snap = await getDocs(q);

    // If Firestore collection has fewer items than dataset, overwrite & seed full dataset
    if (snap.size < DEFAULT_CATALOG.length) {
      await seedDefaultCatalog();
      return DEFAULT_CATALOG;
    }

    const items: CatalogItem[] = [];
    snap.forEach((docSnap) => {
      items.push({ id: docSnap.id, ...docSnap.data() } as CatalogItem);
    });

    return items.length > 0 ? items : DEFAULT_CATALOG;
  } catch (error) {
    console.error('Error fetching catalog items:', error);
    return DEFAULT_CATALOG;
  }
}

export async function saveCatalogItems(
  lineItems: { brandName: string; itemName: string; quantity: number }[]
): Promise<void> {
  try {
    for (const item of lineItems) {
      if (!item.brandName?.trim() || !item.itemName?.trim()) continue;
      const docId = `${item.brandName.trim().toLowerCase()}_${item.itemName
        .trim()
        .toLowerCase()}`.replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_');

      const docRef = doc(db, CATALOG_COLLECTION, docId);
      await setDoc(
        docRef,
        {
          brandName: item.brandName.trim(),
          itemName: item.itemName.trim(),
          defaultQuantity: Number(item.quantity) || 1,
        },
        { merge: true }
      );
    }
  } catch (error) {
    console.error('Error saving catalog items:', error);
  }
}

export async function seedDefaultCatalog(): Promise<void> {
  try {
    const batch = writeBatch(db);
    for (const item of DEFAULT_CATALOG) {
      const docId = `${item.brandName.toLowerCase()}_${item.itemName
        .toLowerCase()}`.replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_');
      batch.set(doc(db, CATALOG_COLLECTION, docId), item, { merge: true });
    }
    await batch.commit();
  } catch (e) {
    console.error('Error seeding default catalog:', e);
  }
}
