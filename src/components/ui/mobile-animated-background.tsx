'use client';

import React, { useEffect, useState } from 'react';
import { useThemeBackdrop } from '@/contexts/ThemeBackdropContext';

/**
 * MobileAnimatedBackground
 * 
 * Dynamic backdrop renderer supporting multiple aesthetic themes:
 * 1. ambient-orbs: Dynamic live experience with drifting light orbs, dot matrix, and aurora sweep.
 * 2. fintech-luxe: Flowing liquid satin metallic shifts inspired by Apple Card & Stripe.
 * 3. linear-cosmic: High-precision coordinate grid with cyber cyan & violet laser pulses.
 * 4. nordic-mist: Warm tactile paper alabaster with soft watercolor mist & linen noise texture.
 * 5. classic-minimal: Ultra-clean, distraction-free neutral slate canvas with hairline accents.
 */
export function MobileAnimatedBackground() {
  const { theme } = useThemeBackdrop();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div 
      aria-hidden="true" 
      className="fixed inset-0 pointer-events-none -z-10 overflow-hidden select-none transition-colors duration-700"
      suppressHydrationWarning
    >
      {/* ════════════════════════════════════════════════════════════════════
          THEME 1: CURRENT (Ambient Orbs & Aurora)
         ════════════════════════════════════════════════════════════════════ */}
      {theme === 'ambient-orbs' && (
        <>
          {/* Base Layer */}
          <div className="absolute inset-0 bg-gradient-to-br from-slate-50/90 via-[#f3f4f8] to-slate-100/90 dark:from-[#090d16] dark:via-[#0c1020] dark:to-[#070a12] transition-colors duration-700" />

          {/* Orb 1: Indigo/Violet */}
          <div 
            className="absolute -top-24 -right-24 w-[340px] h-[340px] sm:w-[540px] sm:h-[540px] rounded-full bg-gradient-to-br from-indigo-500/25 via-purple-600/18 to-blue-500/15 dark:from-indigo-600/30 dark:via-purple-700/20 dark:to-blue-700/15 blur-[65px] sm:blur-[95px] animate-ambient-1"
            style={{ transformOrigin: 'center center' }}
          />

          {/* Orb 2: Warm Amber */}
          <div 
            className="absolute top-[28%] -left-28 w-[300px] h-[300px] sm:w-[480px] sm:h-[480px] rounded-full bg-gradient-to-tr from-amber-400/20 via-orange-400/15 to-rose-400/12 dark:from-amber-500/18 dark:via-orange-600/12 dark:to-rose-600/10 blur-[70px] sm:blur-[100px] animate-ambient-2"
            style={{ transformOrigin: 'center center' }}
          />

          {/* Orb 3: Emerald Mint */}
          <div 
            className="absolute -bottom-28 right-[-10%] w-[320px] h-[320px] sm:w-[500px] sm:h-[500px] rounded-full bg-gradient-to-tl from-emerald-400/20 via-teal-500/14 to-cyan-400/12 dark:from-emerald-600/22 dark:via-teal-600/16 dark:to-cyan-600/10 blur-[75px] sm:blur-[105px] animate-ambient-3"
            style={{ transformOrigin: 'center center' }}
          />

          {/* Orb 4: Sky Blue */}
          <div 
            className="absolute top-[8%] left-[25%] w-[240px] h-[240px] sm:w-[380px] sm:h-[380px] rounded-full bg-gradient-to-r from-sky-400/15 via-blue-400/12 to-indigo-400/15 dark:from-sky-500/15 dark:via-indigo-600/15 dark:to-purple-600/12 blur-[60px] sm:blur-[85px] animate-ambient-4"
            style={{ transformOrigin: 'center center' }}
          />

          {/* Diagonal Aurora Light Sweep */}
          <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-indigo-500/[0.04] dark:via-indigo-400/[0.06] to-transparent animate-ambient-sweep pointer-events-none" />

          {/* Micro-Dot Pattern Matrix */}
          <svg 
            className="absolute inset-0 w-full h-full opacity-[0.32] dark:opacity-[0.16] pointer-events-none mix-blend-multiply dark:mix-blend-screen"
            xmlns="http://www.w3.org/2000/svg"
          >
            <defs>
              <pattern id="ambient-grid-pat" width="28" height="28" patternUnits="userSpaceOnUse">
                <circle cx="2" cy="2" r="1.1" fill="#4338ca" opacity="0.45" />
              </pattern>
              <radialGradient id="ambient-grid-mask" cx="50%" cy="35%" r="65%">
                <stop offset="0%" stopColor="white" stopOpacity="1" />
                <stop offset="65%" stopColor="white" stopOpacity="0.5" />
                <stop offset="100%" stopColor="white" stopOpacity="0" />
              </radialGradient>
              <mask id="ambient-mask-apply">
                <rect width="100%" height="100%" fill="url(#ambient-grid-mask)" />
              </mask>
            </defs>
            <rect width="100%" height="100%" fill="url(#ambient-grid-pat)" mask="url(#ambient-mask-apply)" />
          </svg>

          {/* Micro-Particles */}
          {mounted && (
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
              <div 
                className="absolute left-[15%] bottom-[20%] w-1.5 h-1.5 rounded-full bg-indigo-400/60 shadow-[0_0_8px_rgba(99,102,241,0.8)] animate-ambient-particle"
                style={{ '--p-dur': '8s', '--p-delay': '0s', '--p-dx': '30px' } as React.CSSProperties}
              />
              <div 
                className="absolute left-[40%] bottom-[35%] w-2 h-2 rounded-full bg-amber-400/50 shadow-[0_0_10px_rgba(251,191,36,0.8)] animate-ambient-particle"
                style={{ '--p-dur': '10s', '--p-delay': '2s', '--p-dx': '-25px' } as React.CSSProperties}
              />
              <div 
                className="absolute right-[22%] bottom-[25%] w-1.5 h-1.5 rounded-full bg-teal-400/60 shadow-[0_0_8px_rgba(45,212,191,0.8)] animate-ambient-particle"
                style={{ '--p-dur': '9s', '--p-delay': '4s', '--p-dx': '20px' } as React.CSSProperties}
              />
            </div>
          )}
        </>
      )}

      {/* ════════════════════════════════════════════════════════════════════
          THEME 2: FINTECH LUXE (Liquid Satin & Metallic Shifts)
         ════════════════════════════════════════════════════════════════════ */}
      {theme === 'fintech-luxe' && (
        <>
          {/* Base: Deep rich platinum / obsidian canvas */}
          <div className="absolute inset-0 bg-gradient-to-b from-[#f9f8f6] via-[#f3ede4] to-[#f7f5f0] dark:from-[#0b0c10] dark:via-[#12131a] dark:to-[#08090d] transition-colors duration-700" />

          {/* Liquid Satin Mesh 1: Champagne Gold & Rose Bronze */}
          <div 
            className="absolute -top-32 -left-20 w-[420px] h-[420px] sm:w-[620px] sm:h-[620px] rounded-full bg-gradient-to-br from-amber-400/25 via-rose-500/18 to-amber-600/12 dark:from-amber-500/22 dark:via-rose-600/16 dark:to-orange-700/10 blur-[80px] sm:blur-[110px] animate-satin-1"
            style={{ transformOrigin: 'center center' }}
          />

          {/* Liquid Satin Mesh 2: Royal Titanium Violet & Deep Platinum */}
          <div 
            className="absolute top-[35%] -right-28 w-[380px] h-[380px] sm:w-[580px] sm:h-[580px] rounded-full bg-gradient-to-tl from-indigo-600/22 via-purple-500/18 to-pink-500/12 dark:from-indigo-600/28 dark:via-purple-800/22 dark:to-pink-700/12 blur-[85px] sm:blur-[115px] animate-satin-2"
            style={{ transformOrigin: 'center center' }}
          />

          {/* Liquid Satin Mesh 3: Soft Pearl Gold reflection (Bottom Left) */}
          <div 
            className="absolute -bottom-24 left-[10%] w-[320px] h-[320px] sm:w-[460px] sm:h-[460px] rounded-full bg-gradient-to-tr from-amber-300/18 via-yellow-400/12 to-rose-300/10 dark:from-amber-600/15 dark:via-yellow-700/10 dark:to-rose-800/10 blur-[75px] sm:blur-[100px] animate-satin-1"
            style={{ transformOrigin: 'center center' }}
          />

          {/* Specular Diagonal Metallic Sheen Sweep */}
          <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-amber-300/[0.08] dark:via-amber-400/[0.06] to-transparent animate-metallic-sheen pointer-events-none" />

          {/* Subtle Fine Satin Ribbons Overlay */}
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(217,119,6,0.12),rgba(255,255,255,0))] dark:bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(217,119,6,0.18),rgba(0,0,0,0))]" />
        </>
      )}

      {/* ════════════════════════════════════════════════════════════════════
          THEME 3: LINEAR COSMIC GRID (High-Tech Precision Grid)
         ════════════════════════════════════════════════════════════════════ */}
      {theme === 'linear-cosmic' && (
        <>
          {/* Base: High-contrast midnight slate */}
          <div className="absolute inset-0 bg-gradient-to-b from-[#0f172a] via-[#090d16] to-[#04060a] text-cyan-500 transition-colors duration-700" />

          {/* Center Cosmic Nebula Glow */}
          <div 
            className="absolute top-[15%] left-[20%] w-[320px] h-[320px] sm:w-[500px] sm:h-[500px] rounded-full bg-gradient-to-r from-cyan-500/20 via-blue-600/18 to-violet-600/22 blur-[90px] animate-cosmic-glow pointer-events-none"
          />

          {/* High-Precision Isometric/Ortho Tech Grid */}
          <svg 
            className="absolute inset-0 w-full h-full opacity-[0.25] pointer-events-none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <defs>
              <pattern id="linear-grid" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#38bdf8" strokeWidth="0.7" opacity="0.35" />
                <circle cx="0" cy="0" r="1.5" fill="#06b6d4" opacity="0.75" />
              </pattern>
              <radialGradient id="linear-grid-fade" cx="50%" cy="30%" r="75%">
                <stop offset="0%" stopColor="white" stopOpacity="1" />
                <stop offset="60%" stopColor="white" stopOpacity="0.4" />
                <stop offset="100%" stopColor="white" stopOpacity="0.05" />
              </radialGradient>
              <mask id="linear-grid-mask">
                <rect width="100%" height="100%" fill="url(#linear-grid-fade)" />
              </mask>
            </defs>
            <rect width="100%" height="100%" fill="url(#linear-grid)" mask="url(#linear-grid-mask)" />
          </svg>

          {/* Moving Vertical Laser Scanner Beam */}
          <div className="absolute left-[30%] top-0 bottom-0 w-[2px] bg-gradient-to-b from-transparent via-cyan-400 to-transparent animate-cosmic-laser opacity-40 pointer-events-none" />
          <div className="absolute right-[25%] top-0 bottom-0 w-[2px] bg-gradient-to-b from-transparent via-violet-400 to-transparent animate-cosmic-laser opacity-30 pointer-events-none" style={{ animationDelay: '3.5s' }} />

          {/* Cosmic Micro-Stars */}
          {mounted && (
            <div className="absolute inset-0 pointer-events-none">
              <span className="absolute top-[20%] left-[18%] w-1 h-1 rounded-full bg-cyan-300 shadow-[0_0_6px_#22d3ee] animate-pulse" />
              <span className="absolute top-[35%] right-[22%] w-1.5 h-1.5 rounded-full bg-violet-300 shadow-[0_0_8px_#a78bfa] animate-pulse" style={{ animationDuration: '3s' }} />
              <span className="absolute bottom-[30%] left-[45%] w-1 h-1 rounded-full bg-sky-300 shadow-[0_0_6px_#38bdf8] animate-pulse" style={{ animationDuration: '4s' }} />
            </div>
          )}
        </>
      )}

      {/* ════════════════════════════════════════════════════════════════════
          THEME 4: NORDIC MIST (Minimal & Tactile Paper Grain)
         ════════════════════════════════════════════════════════════════════ */}
      {theme === 'nordic-mist' && (
        <>
          {/* Base: Warm organic oat/alabaster canvas */}
          <div className="absolute inset-0 bg-gradient-to-br from-[#faf8f5] via-[#f5f2eb] to-[#ede8df] dark:from-[#111317] dark:via-[#15181f] dark:to-[#0f1115] transition-colors duration-700" />

          {/* Watercolor Cloud 1: Muted Eucalyptus / Sage */}
          <div 
            className="absolute -top-16 -left-16 w-[420px] h-[420px] sm:w-[600px] sm:h-[600px] rounded-full bg-emerald-500/12 dark:bg-emerald-600/12 blur-[90px] animate-mist-1 pointer-events-none"
          />

          {/* Watercolor Cloud 2: Morning Apricot & Oat Warmth */}
          <div 
            className="absolute top-[40%] -right-24 w-[360px] h-[360px] sm:w-[540px] sm:h-[540px] rounded-full bg-amber-400/14 dark:bg-amber-600/10 blur-[95px] animate-mist-2 pointer-events-none"
          />

          {/* Watercolor Cloud 3: Soft Lavender / Slate Fog */}
          <div 
            className="absolute -bottom-20 left-[20%] w-[320px] h-[320px] sm:w-[480px] sm:h-[480px] rounded-full bg-slate-400/14 dark:bg-indigo-900/15 blur-[85px] animate-mist-1 pointer-events-none"
          />

          {/* Tactile Fine Paper / Linen Noise Grain Overlay (SVG Turbulence) */}
          <svg 
            className="absolute inset-0 w-full h-full opacity-[0.28] dark:opacity-[0.14] mix-blend-multiply dark:mix-blend-overlay pointer-events-none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <filter id="nordic-paper-grain">
              <feTurbulence type="fractalNoise" baseFrequency="0.75" numOctaves="3" stitchTiles="stitch" />
              <feColorMatrix type="matrix" values="0 0 0 0 0.4  0 0 0 0 0.4  0 0 0 0 0.4  0 0 0 0.7 0" />
            </filter>
            <rect width="100%" height="100%" filter="url(#nordic-paper-grain)" />
          </svg>
        </>
      )}

      {/* ════════════════════════════════════════════════════════════════════
          THEME 5: CLASSIC MINIMAL (Clean & Subtle Hairline Accents)
         ════════════════════════════════════════════════════════════════════ */}
      {theme === 'classic-minimal' && (
        <>
          {/* Neutral Static Matte Surface with soft top gradient */}
          <div className="absolute inset-0 bg-gradient-to-b from-slate-50 via-slate-100/60 to-slate-100 dark:from-[#0a0d14] dark:via-[#0d1017] dark:to-[#080a0f] transition-colors duration-700" />
          
          {/* Soft Hairline Perimeter Vignette */}
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(0,0,0,0.03),transparent_70%)] dark:bg-[radial-gradient(ellipse_at_top,rgba(255,255,255,0.03),transparent_70%)] pointer-events-none" />
        </>
      )}
    </div>
  );
}
