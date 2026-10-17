'use client';

import React, { useEffect, useState } from 'react';

/**
 * MobileAnimatedBackground
 * 
 * High-performance, GPU-accelerated ambient animated background.
 * Provides soft drifting glowing orbs, fine tech dot-matrix overlay,
 * and gentle floating light particles. Completely transforms flat white screens
 * into a rich, living, native-feeling mobile experience.
 */
export function MobileAnimatedBackground() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div 
      aria-hidden="true" 
      className="fixed inset-0 pointer-events-none -z-10 overflow-hidden select-none"
      suppressHydrationWarning
    >
      {/* ── Base Layer: Soft Adaptive Canvas ── */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-50/90 via-[#f3f4f8] to-slate-100/90 dark:from-[#090d16] dark:via-[#0c1020] dark:to-[#070a12] transition-colors duration-700" />

      {/* ── Layer 1: Animated Ambient Light Orbs ── */}
      {/* Orb 1: Brand Indigo / Violet Glow (Top Right) */}
      <div 
        className="absolute -top-24 -right-24 w-[340px] h-[340px] sm:w-[540px] sm:h-[540px] rounded-full bg-gradient-to-br from-indigo-500/25 via-purple-600/18 to-blue-500/15 dark:from-indigo-600/30 dark:via-purple-700/20 dark:to-blue-700/15 blur-[65px] sm:blur-[95px] animate-ambient-1"
        style={{ transformOrigin: 'center center' }}
      />

      {/* Orb 2: Warm Amber / Culinary Honey Glow (Middle Left) */}
      <div 
        className="absolute top-[28%] -left-28 w-[300px] h-[300px] sm:w-[480px] sm:h-[480px] rounded-full bg-gradient-to-tr from-amber-400/20 via-orange-400/15 to-rose-400/12 dark:from-amber-500/18 dark:via-orange-600/12 dark:to-rose-600/10 blur-[70px] sm:blur-[100px] animate-ambient-2"
        style={{ transformOrigin: 'center center' }}
      />

      {/* Orb 3: Fresh Emerald / Mint Cyan Glow (Bottom Right) */}
      <div 
        className="absolute -bottom-28 right-[-10%] w-[320px] h-[320px] sm:w-[500px] sm:h-[500px] rounded-full bg-gradient-to-tl from-emerald-400/20 via-teal-500/14 to-cyan-400/12 dark:from-emerald-600/22 dark:via-teal-600/16 dark:to-cyan-600/10 blur-[75px] sm:blur-[105px] animate-ambient-3"
        style={{ transformOrigin: 'center center' }}
      />

      {/* Orb 4: Soft Sky Blue Pulse (Upper Center) */}
      <div 
        className="absolute top-[8%] left-[25%] w-[240px] h-[240px] sm:w-[380px] sm:h-[380px] rounded-full bg-gradient-to-r from-sky-400/15 via-blue-400/12 to-indigo-400/15 dark:from-sky-500/15 dark:via-indigo-600/15 dark:to-purple-600/12 blur-[60px] sm:blur-[85px] animate-ambient-4"
        style={{ transformOrigin: 'center center' }}
      />

      {/* ── Layer 2: Subtle Diagonal Aurora Light Sweep ── */}
      <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-indigo-500/[0.04] dark:via-indigo-400/[0.06] to-transparent animate-ambient-sweep pointer-events-none" />

      {/* ── Layer 3: Modern Tactile Tech Micro-Dot Pattern Overlay ── */}
      <svg 
        className="absolute inset-0 w-full h-full opacity-[0.32] dark:opacity-[0.16] pointer-events-none mix-blend-multiply dark:mix-blend-screen"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <pattern id="mobile-ambient-grid" width="28" height="28" patternUnits="userSpaceOnUse">
            <circle cx="2" cy="2" r="1.1" fill="#4338ca" opacity="0.45" />
          </pattern>
          <radialGradient id="mobile-ambient-mask" cx="50%" cy="35%" r="65%">
            <stop offset="0%" stopColor="white" stopOpacity="1" />
            <stop offset="65%" stopColor="white" stopOpacity="0.5" />
            <stop offset="100%" stopColor="white" stopOpacity="0" />
          </radialGradient>
          <mask id="ambient-dot-mask">
            <rect width="100%" height="100%" fill="url(#mobile-ambient-mask)" />
          </mask>
        </defs>
        <rect width="100%" height="100%" fill="url(#mobile-ambient-grid)" mask="url(#ambient-dot-mask)" />
      </svg>

      {/* ── Layer 4: Gentle Ambient Floating Micro-Particles ── */}
      {mounted && (
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {/* Particle 1 */}
          <div 
            className="absolute left-[15%] bottom-[20%] w-1.5 h-1.5 rounded-full bg-indigo-400/60 dark:bg-indigo-300/60 shadow-[0_0_8px_rgba(99,102,241,0.8)] animate-ambient-particle"
            style={{ '--p-dur': '8s', '--p-delay': '0s', '--p-dx': '30px' } as React.CSSProperties}
          />
          {/* Particle 2 */}
          <div 
            className="absolute left-[40%] bottom-[35%] w-2 h-2 rounded-full bg-amber-400/50 dark:bg-amber-300/50 shadow-[0_0_10px_rgba(251,191,36,0.8)] animate-ambient-particle"
            style={{ '--p-dur': '10s', '--p-delay': '2s', '--p-dx': '-25px' } as React.CSSProperties}
          />
          {/* Particle 3 */}
          <div 
            className="absolute right-[22%] bottom-[25%] w-1.5 h-1.5 rounded-full bg-teal-400/60 dark:bg-teal-300/60 shadow-[0_0_8px_rgba(45,212,191,0.8)] animate-ambient-particle"
            style={{ '--p-dur': '9s', '--p-delay': '4s', '--p-dx': '20px' } as React.CSSProperties}
          />
          {/* Particle 4 */}
          <div 
            className="absolute left-[70%] bottom-[45%] w-1 h-1 rounded-full bg-purple-400/60 dark:bg-purple-300/60 shadow-[0_0_6px_rgba(192,132,252,0.8)] animate-ambient-particle"
            style={{ '--p-dur': '11s', '--p-delay': '1s', '--p-dx': '-35px' } as React.CSSProperties}
          />
          {/* Particle 5 */}
          <div 
            className="absolute left-[28%] bottom-[50%] w-1.5 h-1.5 rounded-full bg-rose-400/50 dark:bg-rose-300/50 shadow-[0_0_8px_rgba(244,63,94,0.8)] animate-ambient-particle"
            style={{ '--p-dur': '8.5s', '--p-delay': '3.5s', '--p-dx': '15px' } as React.CSSProperties}
          />
        </div>
      )}
    </div>
  );
}
