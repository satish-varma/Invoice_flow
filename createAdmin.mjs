import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc } from 'firebase/firestore';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '.env.local') });

const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
const firebaseConfig = {
  apiKey,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function createAdmin() {
  const email = 'thegutguru.in@gmail.com';
  const password = 'Var1986!';

  try {
    let localId;
    
    // Attempt sign up via REST API
    console.log('Attempting to create user via REST API...');
    const signUpRes = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, returnSecureToken: true })
    });
    
    let data = await signUpRes.json();
    
    if (!signUpRes.ok) {
      if (data.error && data.error.message === 'EMAIL_EXISTS') {
        console.log('User exists, signing in via REST API to get localId...');
        const signInRes = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password, returnSecureToken: true })
        });
        const signInData = await signInRes.json();
        if (!signInRes.ok) {
          throw new Error('Sign in failed: ' + JSON.stringify(signInData));
        }
        localId = signInData.localId;
      } else {
        throw new Error('Sign up failed: ' + JSON.stringify(data));
      }
    } else {
      localId = data.localId;
      console.log('User created:', localId);
    }

    console.log('Setting admin role in Firestore...');
    const userDocRef = doc(db, 'users', localId);
    await setDoc(userDocRef, {
      email,
      role: 'admin',
      createdAt: new Date().toISOString()
    }, { merge: true });

    console.log('Successfully set admin role for', email);
    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

createAdmin();
