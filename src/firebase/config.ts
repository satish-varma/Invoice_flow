
// Firebase configuration from environment variables
// Firebase configuration from environment variables with hardcoded fallbacks
export const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyCCa1LXbotrsXO8FkppHRzxGno04s_i_SE",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "invoiceflow-24nxt.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "invoiceflow-24nxt",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "invoiceflow-24nxt.firebasestorage.app",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "272128777200",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:272128777200:web:f1309bfb80260ff45e5b35",
};
