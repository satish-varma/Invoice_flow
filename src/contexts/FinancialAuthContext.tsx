'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

const SESSION_KEY = 'financials_unlocked_until';
const UNLOCK_DURATION_MS = 15 * 60 * 1000; // 15 minutes of unlocked session

interface FinancialAuthContextType {
  isUnlocked: boolean;
  unlockWithPassword: (password: string) => Promise<{ success: boolean; error?: string }>;
  lockFinancials: () => void;
  remainingMinutes: number;
}

const FinancialAuthContext = createContext<FinancialAuthContextType>({
  isUnlocked: false,
  unlockWithPassword: async () => ({ success: false }),
  lockFinancials: () => {},
  remainingMinutes: 0,
});

export function FinancialAuthProvider({ children }: { children: React.ReactNode }) {
  const [isUnlocked, setIsUnlocked] = useState<boolean>(false);
  const [remainingMinutes, setRemainingMinutes] = useState<number>(0);

  const checkUnlockStatus = () => {
    if (typeof window === 'undefined') return;
    try {
      const expiry = sessionStorage.getItem(SESSION_KEY);
      if (expiry) {
        const remaining = Number(expiry) - Date.now();
        if (remaining > 0) {
          setIsUnlocked(true);
          setRemainingMinutes(Math.ceil(remaining / 60000));
          return;
        } else {
          sessionStorage.removeItem(SESSION_KEY);
        }
      }
    } catch (e) {
      // Ignore sessionStorage errors
    }
    setIsUnlocked(false);
    setRemainingMinutes(0);
  };

  useEffect(() => {
    checkUnlockStatus();
    const interval = setInterval(checkUnlockStatus, 15000); // Check every 15s
    return () => clearInterval(interval);
  }, []);

  const unlockWithPassword = async (password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const res = await fetch('/api/auth/verify-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();

      if (data.success) {
        const expiresAt = Date.now() + UNLOCK_DURATION_MS;
        try {
          sessionStorage.setItem(SESSION_KEY, String(expiresAt));
        } catch (e) {
          // Ignore
        }
        setIsUnlocked(true);
        setRemainingMinutes(15);
        return { success: true };
      } else {
        return { success: false, error: data.error || 'Incorrect password' };
      }
    } catch (err: any) {
      return { success: false, error: err.message || 'Verification network error' };
    }
  };

  const lockFinancials = () => {
    try {
      sessionStorage.removeItem(SESSION_KEY);
    } catch (e) {}
    setIsUnlocked(false);
    setRemainingMinutes(0);
  };

  return (
    <FinancialAuthContext.Provider
      value={{
        isUnlocked,
        unlockWithPassword,
        lockFinancials,
        remainingMinutes,
      }}
    >
      {children}
    </FinancialAuthContext.Provider>
  );
}

export function useFinancialAuth() {
  return useContext(FinancialAuthContext);
}
