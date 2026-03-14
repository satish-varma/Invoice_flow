
// Import the functions you need from the SDKs you need
import { initializeApp, getApp, getApps } from "firebase/app";
import { getFirestore } from "firebase/firestore";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  "projectId": "invoiceflow-24nxt",
  "appId": "1:272128777200:web:f1309bfb80260ff45e5b35",
  "storageBucket": "invoiceflow-24nxt.firebasestorage.app",
  "apiKey": "AIzaSyCCa1LXbotrsXO8FkppHRzxGno04s_i_SE",
  "authDomain": "invoiceflow-24nxt.firebaseapp.com",
  "measurementId": "",
  "messagingSenderId": "272128777200"
};

// Initialize Firebase
const getFirebaseApp = () => {
  return !getApps().length ? initializeApp(firebaseConfig) : getApp();
};

const getDb = () => getFirestore(getFirebaseApp());

export const app = getFirebaseApp();
export const db = getDb();
