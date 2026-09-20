import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc } from 'firebase/firestore';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '.env.local') });

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

async function seed() {
  try {
    const email = 'thegutguru.in@gmail.com';
    const password = 'Var1986!';
    
    const newDocRef = doc(db, 'users', email.replace(/[@.]/g, '_')); 
    
    await setDoc(newDocRef, {
      email,
      password: hashPassword(password),
      role: 'admin',
      createdAt: new Date().toISOString()
    }, { merge: true });

    console.log('Successfully seeded admin user with hashed password!');
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

seed();
