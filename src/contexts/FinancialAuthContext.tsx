'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

const SESSION_KEY = 'financials_unlocked_until';
const VISIBILITY_OVERRIDE_KEY = 'financials_visibility_override';
const UNLOCK_DURATION_MS = 15 * 60 * 1000; // 15 minutes of unlocked session

interface FinancialAuthContextType {
  isUnlocked: boolean;
  showFinancials: boolean;
  setShowFinancials: (show: boolean) => void;
  toggleShowFinancials: () => void;
  unlockWithPassword: (password: string) => Promise<{ success: boolean; error?: string }>;
  lockFinancials: () => void;
  remainingMinutes: number;
}

const FinancialAuthContext = createContext<FinancialAuthContextType>({
  isUnlocked: false,
  showFinancials: false,
  setShowFinancials: () => {},
  toggleShowFinancials: () => {},
  unlockWithPassword: async () => ({ success: false }),
  lockFinancials: () => {},
  remainingMinutes: 0,
});

export function FinancialAuthProvider({ children }: { children: React.ReactNode }) {
  const [isUnlocked, setIsUnlocked] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    try {
      const expiry = sessionStorage.getItem(SESSION_KEY);
      if (expiry) {
        return Number(expiry) - Date.now() > 0;
      }
    } catch {}
    return false;
  });

  const [showFinancials, setShowFinancialsState] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    try {
      const expiry = sessionStorage.getItem(SESSION_KEY);
      const isOverrideHidden = sessionStorage.getItem(VISIBILITY_OVERRIDE_KEY) === 'false';
      if (expiry && Number(expiry) - Date.now() > 0) {
        return !isOverrideHidden;
      }
    } catch {}
    return false;
  });

  const [remainingMinutes, setRemainingMinutes] = useState<number>(() => {
    if (typeof window === 'undefined') return 0;
    try {
      const expiry = sessionStorage.getItem(SESSION_KEY);
      if (expiry) {
        const rem = Number(expiry) - Date.now();
        return rem > 0 ? Math.ceil(rem / 60000) : 0;
      }
    } catch {}
    return 0;
  });

  const checkUnlockStatus = useCallback(() => {
    if (typeof window === 'undefined') return;
    try {
      const expiry = sessionStorage.getItem(SESSION_KEY);
      if (expiry) {
        const remaining = Number(expiry) - Date.now();
        if (remaining > 0) {
          setIsUnlocked(true);
          setRemainingMinutes(Math.ceil(remaining / 60000));
          const isOverrideHidden = sessionStorage.getItem(VISIBILITY_OVERRIDE_KEY) === 'false';
          setShowFinancialsState(!isOverrideHidden);
          return;
        } else {
          sessionStorage.removeItem(SESSION_KEY);
          sessionStorage.removeItem(VISIBILITY_OVERRIDE_KEY);
        }
      }
    } catch (e) {
      // Ignore sessionStorage errors
    }
    setIsUnlocked(false);
    setShowFinancialsState(false);
    setRemainingMinutes(0);
  }, []);

  useEffect(() => {
    checkUnlockStatus();
    const interval = setInterval(checkUnlockStatus, 10000); // Check every 10s
    return () => clearInterval(interval);
  }, [checkUnlockStatus]);

  const setShowFinancials = (show: boolean) => {
    setShowFinancialsState(show);
    try {
      if (!show) {
        sessionStorage.setItem(VISIBILITY_OVERRIDE_KEY, 'false');
      } else {
        sessionStorage.removeItem(VISIBILITY_OVERRIDE_KEY);
      }
    } catch {}
  };

  const toggleShowFinancials = () => {
    setShowFinancials(!showFinancials);
  };

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
          sessionStorage.removeItem(VISIBILITY_OVERRIDE_KEY);
        } catch (e) {}
        setIsUnlocked(true);
        setShowFinancialsState(true);
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
      sessionStorage.removeItem(VISIBILITY_OVERRIDE_KEY);
    } catch (e) {}
    setIsUnlocked(false);
    setShowFinancialsState(false);
    setRemainingMinutes(0);
  };

  return (
    <FinancialAuthContext.Provider
      value={{
        isUnlocked,
        showFinancials,
        setShowFinancials,
        toggleShowFinancials,
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
