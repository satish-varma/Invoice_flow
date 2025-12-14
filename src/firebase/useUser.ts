'use client';
import { useState, useEffect } from 'react';
import type { User } from 'firebase/auth';
import { useAuth } from './provider';

export const useUser = () => {
  const auth = useAuth();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (auth) {
      const unsubscribe = auth.onAuthStateChanged((user) => {
        setUser(user);
        setLoading(false);
      });

      return () => unsubscribe();
    }
  }, [auth]);

  return { user, loading };
};
