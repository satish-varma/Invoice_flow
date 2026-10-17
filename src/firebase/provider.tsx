
'use client';
import { createContext, useContext, ReactNode, useMemo } from 'react';
import { FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { Firestore } from 'firebase/firestore';

// Define the shape of the context value
interface FirebaseContextValue {
  app: FirebaseApp;
  auth: Auth;
  db: Firestore;
}

// Create the context with a default undefined value
const FirebaseContext = createContext<FirebaseContextValue | undefined>(
  undefined
);

// Custom hook to use the Firebase context
export const useFirebase = (): FirebaseContextValue => {
  const context = useContext(FirebaseContext);
  if (context === undefined) {
    throw new Error('useFirebase must be used within a FirebaseProvider');
  }
  return context;
};

export const useFirebaseApp = (): FirebaseApp => useFirebase().app;
export const useAuth = (): Auth => useFirebase().auth;
export const useFirestore = (): Firestore => useFirebase().db;

import { app, db } from '@/lib/firebase';

// Provider component
export const FirebaseProvider = ({ children }: { children: ReactNode }) => {
  const value = useMemo(() => {
    const auth = getAuth(app);
    return { app, auth, db };
  }, []);

  return (
    <FirebaseContext.Provider value={value}>
      {children}
    </FirebaseContext.Provider>
  );
};
