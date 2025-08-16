
// Import the functions you need from the SDKs you need
import { initializeApp, getApp, getApps } from "firebase/app";
import { getFirestore } from "firebase/firestore";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "TODO: YOUR API KEY",
  authDomain: "TODO: YOUR AUTH DOMAIN",
  projectId: "TODO: YOUR PROJECT ID",
  storageBucket: "TODO: YOUR STORAGE BUCKET",
  messagingSenderId: "TODO: YOUR MESSAGING SENDER ID",
  appId: "TODO: YOUR APP ID",
  measurementId: "TODO: YOUR MEASUREMENT ID"
};

// Initialize Firebase
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const db = getFirestore(app);

export { app, db };
