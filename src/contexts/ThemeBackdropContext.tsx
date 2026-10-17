'use client';

import React, { createContext, useContext, useEffect, useState, useMemo, useCallback } from 'react';
import { db } from '@/lib/firebase';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';

export type ThemeBackdropId =
  | 'ambient-orbs'
  | 'fintech-luxe'
  | 'linear-cosmic'
  | 'nordic-mist'
  | 'classic-minimal'
  | 'cyberpunk-80s'
  | 'matrix-rain'
  | 'electric-plasma'
  | 'volcanic-magma'
  | 'hyperdrive-warp';

export interface ThemeOption {
  id: ThemeBackdropId;
  name: string;
  subtitle: string;
  description: string;
  badge: string;
  category: 'pro' | 'crazy';
  isDark: boolean;
  previewColors: string[];
}

export const THEME_OPTIONS: ThemeOption[] = [
  // ── Professional & Minimal Presets ──
  {
    id: 'ambient-orbs',
    name: 'Ambient Orbs & Aurora',
    subtitle: 'Current Dynamic Experience',
    description: 'Drifting organic light orbs, tactile dot matrix, aurora sweep, and floating micro-sparkles.',
    badge: 'Popular',
    category: 'pro',
    isDark: false,
    previewColors: ['#4f46e5', '#f59e0b', '#10b981', '#38bdf8'],
  },
  {
    id: 'fintech-luxe',
    name: 'Fintech Luxe',
    subtitle: 'Liquid Satin & Metallic Shifts',
    description: 'Flowing metallic mesh, champagne gold, titanium violet, and satin specular sheen.',
    badge: 'Executive',
    category: 'pro',
    isDark: false,
    previewColors: ['#312e81', '#d97706', '#db2777', '#4338ca'],
  },
  {
    id: 'linear-cosmic',
    name: 'Linear Cosmic Grid',
    subtitle: 'High-Tech Precision Grid',
    description: 'Perspective coordinate grid with cyber cyan & violet laser pulses inspired by Linear.',
    badge: 'Tech',
    category: 'pro',
    isDark: true,
    previewColors: ['#0f172a', '#06b6d4', '#8b5cf6', '#3b82f6'],
  },
  {
    id: 'nordic-mist',
    name: 'Nordic Mist',
    subtitle: 'Minimal & Paper Grain',
    description: 'Warm paper alabaster, soft watercolor bleeds, and tactile micro-noise grain overlay.',
    badge: 'Calm',
    category: 'pro',
    isDark: false,
    previewColors: ['#f8fafc', '#a7f3d0', '#fed7aa', '#cbd5e1'],
  },
  {
    id: 'classic-minimal',
    name: 'Classic Minimal',
    subtitle: 'Clean & Hairline Accents',
    description: 'Crisp distraction-free canvas with soft vignette and hairline accents. Zero motion.',
    badge: 'Minimal',
    category: 'pro',
    isDark: false,
    previewColors: ['#f8fafc', '#e2e8f0', '#94a3b8', '#64748b'],
  },

  // ── 🔥 Crazy & High-Energy Presets ──
  {
    id: 'cyberpunk-80s',
    name: 'Cyberpunk 80s / Synthwave',
    subtitle: 'Retro Horizon & Neon Highway',
    description: 'Gliding 3D perspective floor grid, sliced retrowave neon sun, and electric magenta/cyan lasers.',
    badge: 'Crazy',
    category: 'crazy',
    isDark: true,
    previewColors: ['#ff007f', '#00f0ff', '#7928ca', '#0d0221'],
  },
  {
    id: 'matrix-rain',
    name: 'Matrix Digital Rain',
    subtitle: 'Phosphor Green Terminal Streams',
    description: 'Cascading streams of glowing digital glyphs, phosphor green trails, and CRT monitor scanlines.',
    badge: 'Crazy',
    category: 'crazy',
    isDark: true,
    previewColors: ['#22c55e', '#4ade80', '#15803d', '#020508'],
  },
  {
    id: 'electric-plasma',
    name: 'Electric Plasma Storm',
    subtitle: 'High-Voltage Lightning Arcs',
    description: 'Crackling electric energy tendrils, shockwave plasma bubbles, and vibrating cyan lightning sparks.',
    badge: 'Crazy',
    category: 'crazy',
    isDark: true,
    previewColors: ['#a855f7', '#22d3ee', '#3b82f6', '#050814'],
  },
  {
    id: 'volcanic-magma',
    name: 'Volcanic Magma & Embers',
    subtitle: 'Liquid Lava & Rising Fire Sparks',
    description: 'Churning molten gold magma cauldron beneath obsidian rock with weightless rising fire embers.',
    badge: 'Crazy',
    category: 'crazy',
    isDark: true,
    previewColors: ['#f59e0b', '#ea580c', '#dc2626', '#090503'],
  },
  {
    id: 'hyperdrive-warp',
    name: 'Hyperdrive Starfield Warp',
    subtitle: 'Warp Speed Hyperspace Flight',
    description: 'Star streaks shooting past at light speed, swirling cosmic nebula arms, and pulsar flares.',
    badge: 'Crazy',
    category: 'crazy',
    isDark: true,
    previewColors: ['#38bdf8', '#c084fc', '#ffffff', '#02040a'],
  },
];

export interface MotionFxConfig {
  masterEnabled: boolean; // Master switch for all motion FX
  stardustTrail: boolean; // ✨ Touch & cursor stardust trail (auto-sleeps when idle)
  shimmerBorders: boolean; // 💫 GPU-accelerated running shimmer card borders
  actionBursts: boolean; // 💥 Tap spark micro-bursts on primary actions
  rollingCounters: boolean; // 🎰 Smooth numerical odometry cash counters
  cosmicRipple: boolean; // 🌊 Radial shockwave wave when switching themes
  card3dTilt: boolean; // 🎮 3D Perspective Tilt with Specular Glare
}

export const DEFAULT_MOTION_FX: MotionFxConfig = {
  masterEnabled: true,
  stardustTrail: true,
  shimmerBorders: true,
  actionBursts: true,
  rollingCounters: true,
  cosmicRipple: true,
  card3dTilt: true,
};

const STORAGE_OVERRIDE_KEY = 'invoiceflow_theme_override';
const STORAGE_USER_THEME_KEY = 'invoiceflow_user_theme';
const STORAGE_MOTION_FX_KEY = 'invoiceflow_motion_fx';
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
  motionFx: MotionFxConfig;
  updateMotionFx: (partial: Partial<MotionFxConfig>) => void;
  resetMotionFx: () => void;
  triggerActionBurst: (x: number, y: number, color?: string) => void;
  triggerCosmicRipple: (x: number, y: number, color?: string) => void;
}

const ThemeBackdropContext = createContext<ThemeBackdropContextType | undefined>(undefined);

export function ThemeBackdropProvider({ children }: { children: React.ReactNode }) {
  const [companyDefaultTheme, setCompanyDefaultThemeState] = useState<ThemeBackdropId>('ambient-orbs');
  const [userPersonalTheme, setUserPersonalTheme] = useState<ThemeBackdropId | null>(null);
  const [isPersonalOverride, setIsPersonalOverride] = useState<boolean>(false);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [motionFx, setMotionFx] = useState<MotionFxConfig>(DEFAULT_MOTION_FX);

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

      // Load Motion FX configuration
      const savedFx = localStorage.getItem(STORAGE_MOTION_FX_KEY);
      if (savedFx) {
        setMotionFx({ ...DEFAULT_MOTION_FX, ...JSON.parse(savedFx) });
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

  // Update Motion FX configuration and persist to localStorage
  const updateMotionFx = useCallback((partial: Partial<MotionFxConfig>) => {
    setMotionFx((prev) => {
      const updated = { ...prev, ...partial };
      try {
        localStorage.setItem(STORAGE_MOTION_FX_KEY, JSON.stringify(updated));
      } catch {
        // Ignore quota errors
      }
      return updated;
    });
  }, []);

  // Reset Motion FX configuration to default
  const resetMotionFx = useCallback(() => {
    setMotionFx(DEFAULT_MOTION_FX);
    try {
      localStorage.removeItem(STORAGE_MOTION_FX_KEY);
    } catch {
      // Ignore
    }
  }, []);

  // Dispatch Action Button Particle Burst event
  const triggerActionBurst = useCallback((x: number, y: number, color?: string) => {
    if (typeof window === 'undefined') return;
    window.dispatchEvent(new CustomEvent('invoiceflow:burst', { detail: { x, y, color } }));
  }, []);

  // Dispatch Cosmic Ripple wave event
  const triggerCosmicRipple = useCallback((x: number, y: number, color?: string) => {
    if (typeof window === 'undefined') return;
    window.dispatchEvent(new CustomEvent('invoiceflow:ripple', { detail: { x, y, color } }));
  }, []);

  // Effective active theme: Personal choice if customized, otherwise follows Company Default in real-time
  const activeTheme: ThemeBackdropId = isPersonalOverride && userPersonalTheme
    ? userPersonalTheme
    : companyDefaultTheme;

  // Synchronize active theme with <html> attributes and Tailwind dark mode class
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const opt = THEME_OPTIONS.find((t) => t.id === activeTheme);
    document.documentElement.setAttribute('data-theme', activeTheme);
    if (opt?.isDark) {
      document.documentElement.classList.add('dark');
      document.documentElement.style.colorScheme = 'dark';
    } else {
      document.documentElement.classList.remove('dark');
      document.documentElement.style.colorScheme = 'light';
    }
  }, [activeTheme]);

  // Synchronize data-shimmer attribute for running shimmer border CSS
  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.documentElement.setAttribute(
      'data-shimmer',
      String(motionFx.masterEnabled && motionFx.shimmerBorders)
    );
  }, [motionFx.masterEnabled, motionFx.shimmerBorders]);

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
      motionFx,
      updateMotionFx,
      resetMotionFx,
      triggerActionBurst,
      triggerCosmicRipple,
    }),
    [
      activeTheme,
      companyDefaultTheme,
      isPersonalOverride,
      setPersonalTheme,
      resetToCompanyDefault,
      setCompanyDefaultTheme,
      isSyncing,
      motionFx,
      updateMotionFx,
      resetMotionFx,
      triggerActionBurst,
      triggerCosmicRipple,
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
      motionFx: DEFAULT_MOTION_FX,
      updateMotionFx: () => {},
      resetMotionFx: () => {},
      triggerActionBurst: () => {},
      triggerCosmicRipple: () => {},
    };
  }
  return context;
}

export function useMotionFx() {
  const ctx = useThemeBackdrop();
  return {
    motionFx: ctx.motionFx,
    updateMotionFx: ctx.updateMotionFx,
    resetMotionFx: ctx.resetMotionFx,
    triggerActionBurst: ctx.triggerActionBurst,
    triggerCosmicRipple: ctx.triggerCosmicRipple,
  };
}
