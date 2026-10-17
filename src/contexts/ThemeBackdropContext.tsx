'use client';

import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';

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

const STORAGE_KEY = 'invoiceflow_backdrop_theme';

interface ThemeBackdropContextType {
  theme: ThemeBackdropId;
  setTheme: (theme: ThemeBackdropId) => void;
  themes: ThemeOption[];
}

const ThemeBackdropContext = createContext<ThemeBackdropContextType | undefined>(undefined);

export function ThemeBackdropProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeBackdropId>('ambient-orbs');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY) as ThemeBackdropId | null;
      if (saved && THEME_OPTIONS.some((t) => t.id === saved)) {
        setThemeState(saved);
      }
    } catch {
      // Local storage not accessible
    }
    setMounted(true);

    const handleStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && e.newValue) {
        if (THEME_OPTIONS.some((t) => t.id === e.newValue)) {
          setThemeState(e.newValue as ThemeBackdropId);
        }
      }
    };

    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const setTheme = (newTheme: ThemeBackdropId) => {
    setThemeState(newTheme);
    try {
      localStorage.setItem(STORAGE_KEY, newTheme);
    } catch {
      // Ignore quota or private mode errors
    }
  };

  const value = useMemo(
    () => ({
      theme,
      setTheme,
      themes: THEME_OPTIONS,
    }),
    [theme]
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
    // Provide a fallback if used outside provider
    return {
      theme: 'ambient-orbs' as ThemeBackdropId,
      setTheme: () => {},
      themes: THEME_OPTIONS,
    };
  }
  return context;
}
