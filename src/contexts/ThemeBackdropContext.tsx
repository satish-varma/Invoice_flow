'use client';

import React, { createContext, useContext, useEffect, useState, useMemo, useCallback } from 'react';
import { db } from '@/lib/firebase';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';

export type ThemeBackdropId =
  | 'ambient-orbs'
  | 'fintech-luxe'
  | 'linear-cosmic'
  | 'nordic-mist'
  | 'classic-minimal';

export interface ThemeOption {
  id: ThemeBackdropId;
  name: string;
  subtitle: string;
  description: string;
  badge: string;
  previewColors: string[];
}

export const THEME_OPTIONS: ThemeOption[] = [
  {
    id: 'ambient-orbs',
    name: 'Ambient Orbs & Aurora',
    subtitle: 'Current Dynamic Experience',
    description: 'Drifting organic light orbs, tactile dot matrix, aurora sweep, and floating micro-sparkles.',
    badge: 'Popular',
    previewColors: ['#4f46e5', '#f59e0b', '#10b981', '#38bdf8'],
  },
  {
    id: 'fintech-luxe',
    name: 'Fintech Luxe',
    subtitle: 'Liquid Satin & Metallic Shifts',
    description: 'Flowing metallic mesh, champagne gold, titanium violet, and satin specular sheen.',
    badge: 'Executive',
    previewColors: ['#312e81', '#d97706', '#db2777', '#4338ca'],
  },
  {
    id: 'linear-cosmic',
    name: 'Linear Cosmic Grid',
    subtitle: 'High-Tech Precision Grid',
    description: 'Perspective coordinate grid with cyber cyan & violet laser pulses inspired by Linear.',
    badge: 'Tech',
    previewColors: ['#0f172a', '#06b6d4', '#8b5cf6', '#3b82f6'],
  },
  {
    id: 'nordic-mist',
    name: 'Nordic Mist',
    subtitle: 'Minimal & Paper Grain',
    description: 'Warm paper alabaster, soft watercolor bleeds, and tactile micro-noise grain overlay.',
    badge: 'Calm',
    previewColors: ['#f8fafc', '#a7f3d0', '#fed7aa', '#cbd5e1'],
  },
  {
    id: 'classic-minimal',
    name: 'Classic Minimal',
    subtitle: 'Clean & Hairline Accents',
    description: 'Crisp distraction-free canvas with soft vignette and hairline accents. Zero motion.',
    badge: 'Minimal',
    previewColors: ['#f8fafc', '#e2e8f0', '#94a3b8', '#64748b'],
  },
];

const STORAGE_OVERRIDE_KEY = 'invoiceflow_theme_override';
const STORAGE_USER_THEME_KEY = 'invoiceflow_user_theme';
const SETTINGS_DOC_PATH = ['settings', 'appTheme'] as const;

interface ThemeBackdropContextType {
  theme: ThemeBackdropId; // Active theme on this device
  companyDefaultTheme: ThemeBackdropId; // Organization default set by Admin in Firestore
  isPersonalOverride: boolean; // True if user picked their own theme
  setPersonalTheme: (theme: ThemeBackdropId) => void;
  resetToCompanyDefault: () => void;
  setCompanyDefaultTheme: (theme: ThemeBackdropId, updatedByEmail?: string) => Promise<void>;
  setTheme: (theme: ThemeBackdropId) => void; // Convenience alias for setPersonalTheme
  themes: ThemeOption[];
  isSyncing: boolean;
}

const ThemeBackdropContext = createContext<ThemeBackdropContextType | undefined>(undefined);

export function ThemeBackdropProvider({ children }: { children: React.ReactNode }) {
  const [companyDefaultTheme, setCompanyDefaultThemeState] = useState<ThemeBackdropId>('ambient-orbs');
  const [userPersonalTheme, setUserPersonalTheme] = useState<ThemeBackdropId | null>(null);
  const [isPersonalOverride, setIsPersonalOverride] = useState<boolean>(false);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  // 1. Initialize local personal preference from localStorage
  useEffect(() => {
    try {
      const hasOverride = localStorage.getItem(STORAGE_OVERRIDE_KEY) === 'true';
      const savedTheme = localStorage.getItem(STORAGE_USER_THEME_KEY) as ThemeBackdropId | null;

      if (hasOverride && savedTheme && THEME_OPTIONS.some((t) => t.id === savedTheme)) {
        setIsPersonalOverride(true);
        setUserPersonalTheme(savedTheme);
      } else {
        setIsPersonalOverride(false);
        setUserPersonalTheme(null);
      }
    } catch {
      // Local storage disabled or error
    }
  }, []);

  // 2. Real-time Firestore sync with Company Default Theme
  useEffect(() => {
    try {
      const themeDocRef = doc(db, SETTINGS_DOC_PATH[0], SETTINGS_DOC_PATH[1]);
      const unsubscribe = onSnapshot(
        themeDocRef,
        (snap) => {
          if (snap.exists()) {
            const data = snap.data();
            const remoteDefault = data?.companyDefaultTheme as ThemeBackdropId | undefined;
            if (remoteDefault && THEME_OPTIONS.some((t) => t.id === remoteDefault)) {
              setCompanyDefaultThemeState(remoteDefault);
            }
          }
        },
        (error) => {
          console.warn('Real-time theme sync listener warning:', error);
        }
      );

      return () => unsubscribe();
    } catch (err) {
      console.warn('Failed to subscribe to theme doc:', err);
    }
  }, []);

  // Set user's personal theme
  const setPersonalTheme = useCallback((newTheme: ThemeBackdropId) => {
    setIsPersonalOverride(true);
    setUserPersonalTheme(newTheme);
    try {
      localStorage.setItem(STORAGE_OVERRIDE_KEY, 'true');
      localStorage.setItem(STORAGE_USER_THEME_KEY, newTheme);
    } catch {
      // Ignore quota errors
    }
  }, []);

  // Reset user's choice back to follow Company Default
  const resetToCompanyDefault = useCallback(() => {
    setIsPersonalOverride(false);
    setUserPersonalTheme(null);
    try {
      localStorage.removeItem(STORAGE_OVERRIDE_KEY);
      localStorage.removeItem(STORAGE_USER_THEME_KEY);
    } catch {
      // Ignore errors
    }
  }, []);

  // Admin action: Persist Company Default Theme to Firestore for all users
  const setCompanyDefaultTheme = useCallback(async (newTheme: ThemeBackdropId, updatedByEmail?: string) => {
    setIsSyncing(true);
    try {
      const themeDocRef = doc(db, SETTINGS_DOC_PATH[0], SETTINGS_DOC_PATH[1]);
      await setDoc(
        themeDocRef,
        {
          companyDefaultTheme: newTheme,
          updatedAt: new Date().toISOString(),
          updatedBy: updatedByEmail || 'admin',
        },
        { merge: true }
      );
      setCompanyDefaultThemeState(newTheme);
    } catch (err) {
      console.error('Failed to update company default theme:', err);
      throw err;
    } finally {
      setIsSyncing(false);
    }
  }, []);

  // Effective active theme: Personal choice if customized, otherwise follows Company Default in real-time
  const activeTheme: ThemeBackdropId = isPersonalOverride && userPersonalTheme
    ? userPersonalTheme
    : companyDefaultTheme;

  const value = useMemo(
    () => ({
      theme: activeTheme,
      companyDefaultTheme,
      isPersonalOverride,
      setPersonalTheme,
      resetToCompanyDefault,
      setCompanyDefaultTheme,
      setTheme: setPersonalTheme,
      themes: THEME_OPTIONS,
      isSyncing,
    }),
    [
      activeTheme,
      companyDefaultTheme,
      isPersonalOverride,
      setPersonalTheme,
      resetToCompanyDefault,
      setCompanyDefaultTheme,
      isSyncing,
    ]
  );

  return (
    <ThemeBackdropContext.Provider value={value}>
      {children}
    </ThemeBackdropContext.Provider>
  );
}

export function useThemeBackdrop() {
  const context = useContext(ThemeBackdropContext);
  if (!context) {
    return {
      theme: 'ambient-orbs' as ThemeBackdropId,
      companyDefaultTheme: 'ambient-orbs' as ThemeBackdropId,
      isPersonalOverride: false,
      setPersonalTheme: () => {},
      resetToCompanyDefault: () => {},
      setCompanyDefaultTheme: async () => {},
      setTheme: () => {},
      themes: THEME_OPTIONS,
      isSyncing: false,
    };
  }
  return context;
}
