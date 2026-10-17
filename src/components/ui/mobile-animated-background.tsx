'use client';

import React, { useEffect, useState } from 'react';
import { useThemeBackdrop } from '@/contexts/ThemeBackdropContext';

/**
 * MobileAnimatedBackground
 * 
 * Dynamic backdrop renderer supporting 10 distinct aesthetic themes:
 * ── Professional & Minimal ──
 * 1. ambient-orbs: Dynamic live experience with drifting light orbs, dot matrix, and aurora sweep.
 * 2. fintech-luxe: Flowing liquid satin metallic shifts inspired by Apple Card & Stripe.
 * 3. linear-cosmic: High-precision coordinate grid with cyber cyan & violet laser pulses.
 * 4. nordic-mist: Warm tactile paper alabaster with soft watercolor mist & linen noise texture.
 * 5. classic-minimal: Ultra-clean, distraction-free neutral slate canvas with hairline accents.
 * 
 * ── 🔥 Crazy & High-Energy ──
 * 6. cyberpunk-80s: Gliding 3D perspective floor grid, sliced retrowave neon sun, and neon lasers.
 * 7. matrix-rain: Cascading streams of phosphor green digital glyphs and CRT scanlines.
 * 8. electric-plasma: Crackling electric energy arcs, shockwave plasma rings, and high-voltage sparks.
 * 9. volcanic-magma: Churning molten magma cauldron beneath obsidian rock with weightless fire embers.
 * 10. hyperdrive-warp: Star streaks shooting past at light speed with swirling cosmic nebula arms.
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
          <div className="absolute inset-0 bg-gradient-to-b from-[#f9f8f6] via-[#f3ede4] to-[#f7f5f0] dark:from-[#0b0c10] dark:via-[#12131a] dark:to-[#08090d] transition-colors duration-700" />

          {/* Liquid Satin Mesh 1 */}
          <div 
            className="absolute -top-32 -left-20 w-[420px] h-[420px] sm:w-[620px] sm:h-[620px] rounded-full bg-gradient-to-br from-amber-400/25 via-rose-500/18 to-amber-600/12 dark:from-amber-500/22 dark:via-rose-600/16 dark:to-orange-700/10 blur-[80px] sm:blur-[110px] animate-satin-1"
            style={{ transformOrigin: 'center center' }}
          />

          {/* Liquid Satin Mesh 2 */}
          <div 
            className="absolute top-[35%] -right-28 w-[380px] h-[380px] sm:w-[580px] sm:h-[580px] rounded-full bg-gradient-to-tl from-indigo-600/22 via-purple-500/18 to-pink-500/12 dark:from-indigo-600/28 dark:via-purple-800/22 dark:to-pink-700/12 blur-[85px] sm:blur-[115px] animate-satin-2"
            style={{ transformOrigin: 'center center' }}
          />

          {/* Specular Sheen Sweep */}
          <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-amber-300/[0.08] dark:via-amber-400/[0.06] to-transparent animate-metallic-sheen pointer-events-none" />
        </>
      )}

      {/* ════════════════════════════════════════════════════════════════════
          THEME 3: LINEAR COSMIC GRID (High-Tech Precision Grid)
         ════════════════════════════════════════════════════════════════════ */}
      {theme === 'linear-cosmic' && (
        <>
          <div className="absolute inset-0 bg-gradient-to-b from-[#0f172a] via-[#090d16] to-[#04060a] transition-colors duration-700" />

          {/* Center Cosmic Nebula Glow */}
          <div 
            className="absolute top-[15%] left-[20%] w-[320px] h-[320px] sm:w-[500px] sm:h-[500px] rounded-full bg-gradient-to-r from-cyan-500/20 via-blue-600/18 to-violet-600/22 blur-[90px] animate-cosmic-glow pointer-events-none"
          />

          {/* Tech Grid */}
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

          {/* Laser Beams */}
          <div className="absolute left-[30%] top-0 bottom-0 w-[2px] bg-gradient-to-b from-transparent via-cyan-400 to-transparent animate-cosmic-laser opacity-40 pointer-events-none" />
          <div className="absolute right-[25%] top-0 bottom-0 w-[2px] bg-gradient-to-b from-transparent via-violet-400 to-transparent animate-cosmic-laser opacity-30 pointer-events-none" style={{ animationDelay: '3.5s' }} />
        </>
      )}

      {/* ════════════════════════════════════════════════════════════════════
          THEME 4: NORDIC MIST (Minimal & Tactile Paper Grain)
         ════════════════════════════════════════════════════════════════════ */}
      {theme === 'nordic-mist' && (
        <>
          <div className="absolute inset-0 bg-gradient-to-br from-[#faf8f5] via-[#f5f2eb] to-[#ede8df] dark:from-[#111317] dark:via-[#15181f] dark:to-[#0f1115] transition-colors duration-700" />

          {/* Watercolor Clouds */}
          <div className="absolute -top-16 -left-16 w-[420px] h-[420px] sm:w-[600px] sm:h-[600px] rounded-full bg-emerald-500/12 dark:bg-emerald-600/12 blur-[90px] animate-mist-1 pointer-events-none" />
          <div className="absolute top-[40%] -right-24 w-[360px] h-[360px] sm:w-[540px] sm:h-[540px] rounded-full bg-amber-400/14 dark:bg-amber-600/10 blur-[95px] animate-mist-2 pointer-events-none" />

          {/* Tactile Paper / Linen Noise Grain Overlay */}
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
          <div className="absolute inset-0 bg-gradient-to-b from-slate-50 via-slate-100/60 to-slate-100 dark:from-[#0a0d14] dark:via-[#0d1017] dark:to-[#080a0f] transition-colors duration-700" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(0,0,0,0.03),transparent_70%)] dark:bg-[radial-gradient(ellipse_at_top,rgba(255,255,255,0.03),transparent_70%)] pointer-events-none" />
        </>
      )}

      {/* ════════════════════════════════════════════════════════════════════
          THEME 6: 🔥 CYBERPUNK 80s / SYNTHWAVE
         ════════════════════════════════════════════════════════════════════ */}
      {theme === 'cyberpunk-80s' && (
        <>
          {/* Deep Retro Sky */}
          <div className="absolute inset-0 bg-gradient-to-b from-[#090114] via-[#1a0533] to-[#2c084a]" />

          {/* Sliced Retrowave Neon Sun */}
          <div className="absolute top-[20%] sm:top-[22%] left-1/2 -translate-x-1/2 w-[220px] h-[220px] sm:w-[320px] sm:h-[320px] pointer-events-none">
            <div className="w-full h-full rounded-full bg-gradient-to-b from-[#ffee55] via-[#ff007f] to-[#7928ca] animate-synthwave-sun shadow-[0_0_80px_rgba(255,0,127,0.85)]" />
            <div 
              className="absolute inset-0 rounded-full mix-blend-multiply pointer-events-none"
              style={{
                background: 'repeating-linear-gradient(to bottom, transparent 0px, transparent 10px, rgba(9,1,20,0.95) 10px, rgba(9,1,20,0.95) 14px)'
              }}
            />
          </div>

          {/* Horizon Neon Laser Beam */}
          <div className="absolute top-[48%] left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-[#00f0ff] to-transparent shadow-[0_0_16px_#00f0ff] animate-synthwave-beam pointer-events-none" />

          {/* 3D Perspective Gliding Grid Highway */}
          <div 
            className="absolute bottom-0 left-[-20%] right-[-20%] h-[52%] overflow-hidden pointer-events-none"
            style={{ perspective: '300px' }}
          >
            <div 
              className="w-full h-[200%] origin-top animate-synthwave-grid"
              style={{
                transform: 'rotateX(62deg)',
                backgroundImage: 'linear-gradient(to right, rgba(0, 240, 255, 0.45) 1px, transparent 1px), linear-gradient(to bottom, rgba(255, 0, 127, 0.45) 1px, transparent 1px)',
                backgroundSize: '48px 48px',
                maskImage: 'linear-gradient(to bottom, transparent, black 15%, black 90%, transparent)'
              }}
            />
          </div>

          {/* Floating Neon Sparks */}
          {mounted && (
            <div className="absolute inset-0 pointer-events-none">
              <span className="absolute top-[30%] left-[20%] w-1.5 h-1.5 rounded-full bg-[#00f0ff] shadow-[0_0_10px_#00f0ff] animate-pulse" />
              <span className="absolute top-[42%] right-[15%] w-2 h-2 rounded-full bg-[#ff007f] shadow-[0_0_12px_#ff007f] animate-pulse" style={{ animationDuration: '2.5s' }} />
              <span className="absolute top-[65%] left-[30%] w-1.5 h-1.5 rounded-full bg-[#ffee55] shadow-[0_0_8px_#ffee55] animate-pulse" style={{ animationDuration: '3.5s' }} />
            </div>
          )}
        </>
      )}

      {/* ════════════════════════════════════════════════════════════════════
          THEME 7: 🔥 MATRIX DIGITAL RAIN
         ════════════════════════════════════════════════════════════════════ */}
      {theme === 'matrix-rain' && (
        <>
          {/* Deep Black Phosphor Canvas */}
          <div className="absolute inset-0 bg-[#020508]" />

          {/* Center Phosphor Bloom */}
          <div className="absolute top-[30%] left-1/2 -translate-x-1/2 w-[500px] h-[500px] rounded-full bg-emerald-500/10 blur-[110px] pointer-events-none" />

          {/* Digital Code Streams */}
          {mounted && (
            <div className="absolute inset-0 overflow-hidden font-mono text-xs select-none pointer-events-none">
              {[
                { left: '6%', dur: '4.5s', delay: '0s', chars: '01011010110101001' },
                { left: '16%', dur: '6s', delay: '1.2s', chars: 'λ7X019ZΔ4F9012A' },
                { left: '27%', dur: '3.8s', delay: '0.4s', chars: '100111010001011' },
                { left: '38%', dur: '5.2s', delay: '2s', chars: 'X9F4ΔZ10A7λ01' },
                { left: '50%', dur: '4s', delay: '0.8s', chars: '011010011010110' },
                { left: '62%', dur: '5.8s', delay: '1.6s', chars: 'Δ410Z7Xλ901F2' },
                { left: '73%', dur: '4.2s', delay: '0.2s', chars: '110010101110010' },
                { left: '84%', dur: '6.5s', delay: '2.4s', chars: '7Z901λΔ4F102A' },
                { left: '94%', dur: '4.8s', delay: '1s', chars: '010100111010101' },
              ].map((col, idx) => (
                <div
                  key={idx}
                  className="absolute top-0 text-[11px] leading-[15px] font-bold tracking-widest writing-vertical-lr flex flex-col items-center animate-matrix-stream opacity-70"
                  style={{
                    left: col.left,
                    '--matrix-dur': col.dur,
                    '--matrix-delay': col.delay,
                  } as React.CSSProperties}
                >
                  <span className="text-white drop-shadow-[0_0_8px_#4ade80]">{col.chars[0]}</span>
                  <span className="text-emerald-300 drop-shadow-[0_0_5px_#22c55e]">{col.chars.slice(1, 4)}</span>
                  <span className="text-emerald-500 opacity-80">{col.chars.slice(4, 8)}</span>
                  <span className="text-emerald-700/60 opacity-50">{col.chars.slice(8)}</span>
                </div>
              ))}
            </div>
          )}

          {/* CRT Monitor Horizontal Scanlines */}
          <div 
            className="absolute inset-0 pointer-events-none opacity-20"
            style={{
              background: 'repeating-linear-gradient(to bottom, transparent, transparent 2px, rgba(0, 255, 120, 0.15) 2px, rgba(0, 255, 120, 0.15) 4px)'
            }}
          />

          {/* CRT Moving Scanline Beam */}
          <div className="absolute top-0 left-0 right-0 h-24 bg-gradient-to-b from-transparent via-emerald-400/[0.08] to-transparent animate-crt-scanline pointer-events-none" />
        </>
      )}

      {/* ════════════════════════════════════════════════════════════════════
          THEME 8: 🔥 ELECTRIC PLASMA STORM
         ════════════════════════════════════════════════════════════════════ */}
      {theme === 'electric-plasma' && (
        <>
          <div className="absolute inset-0 bg-gradient-to-b from-[#050814] via-[#090b20] to-[#04060e]" />

          {/* Expanding Plasma Shockwave Rings */}
          <div className="absolute top-[35%] left-1/2 -translate-x-1/2 -translate-y-1/2 w-[340px] h-[340px] sm:w-[500px] sm:h-[500px] rounded-full border border-cyan-400/40 bg-radial from-violet-600/20 via-cyan-500/10 to-transparent animate-plasma-ring pointer-events-none shadow-[0_0_50px_rgba(34,211,238,0.3)]" />
          <div className="absolute top-[35%] left-1/2 -translate-x-1/2 -translate-y-1/2 w-[340px] h-[340px] sm:w-[500px] sm:h-[500px] rounded-full border border-violet-400/40 animate-plasma-ring pointer-events-none shadow-[0_0_50px_rgba(168,85,247,0.3)]" style={{ animationDelay: '2.25s' }} />

          {/* Electric Tendril / Lightning Flash 1 */}
          <svg className="absolute -top-10 -left-10 w-[300px] sm:w-[450px] h-[300px] sm:h-[450px] animate-lightning-1 pointer-events-none text-cyan-400">
            <path d="M 50 20 L 140 110 L 110 160 L 220 240 L 180 290 L 280 380" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" filter="drop-shadow(0 0 12px #22d3ee)" />
          </svg>

          {/* Electric Tendril / Lightning Flash 2 */}
          <svg className="absolute top-[20%] -right-10 w-[320px] sm:w-[480px] h-[320px] sm:h-[480px] animate-lightning-2 pointer-events-none text-violet-400">
            <path d="M 280 20 L 190 120 L 230 170 L 130 260 L 160 300 L 60 400" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" filter="drop-shadow(0 0 12px #c084fc)" />
          </svg>

          {/* High-Voltage Jittering Micro-Sparks */}
          {mounted && (
            <div className="absolute inset-0 pointer-events-none">
              <span className="absolute top-[25%] left-[30%] w-2 h-2 rounded-full bg-cyan-300 shadow-[0_0_12px_#22d3ee] animate-spark-jitter" />
              <span className="absolute top-[45%] right-[25%] w-2 h-2 rounded-full bg-violet-300 shadow-[0_0_12px_#a855f7] animate-spark-jitter" style={{ animationDelay: '0.1s' }} />
              <span className="absolute bottom-[35%] left-[45%] w-1.5 h-1.5 rounded-full bg-sky-300 shadow-[0_0_10px_#38bdf8] animate-spark-jitter" style={{ animationDelay: '0.18s' }} />
            </div>
          )}
        </>
      )}

      {/* ════════════════════════════════════════════════════════════════════
          THEME 9: 🔥 VOLCANIC MAGMA & RISING EMBERS
         ════════════════════════════════════════════════════════════════════ */}
      {theme === 'volcanic-magma' && (
        <>
          <div className="absolute inset-0 bg-gradient-to-b from-[#080402] via-[#140805] to-[#250a04]" />

          {/* Bottom Molten Magma Reservoir */}
          <div 
            className="absolute -bottom-24 left-[-10%] right-[-10%] h-[320px] sm:h-[420px] rounded-t-[100%] bg-gradient-to-t from-[#ea580c] via-[#dc2626]/80 to-[#f59e0b]/20 blur-[60px] sm:blur-[80px] animate-lava-churn pointer-events-none"
          />

          <div className="absolute bottom-0 inset-x-0 h-40 bg-[radial-gradient(ellipse_at_bottom,rgba(245,158,11,0.35),transparent_70%)] pointer-events-none" />

          {/* Rising Weightless Fire Embers */}
          {mounted && (
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
              {[
                { left: '12%', dur: '6s', delay: '0s', drift: '30px', size: 'w-2 h-2', glow: 'shadow-[0_0_10px_#f59e0b]' },
                { left: '25%', dur: '8s', delay: '1.5s', drift: '-25px', size: 'w-1.5 h-1.5', glow: 'shadow-[0_0_8px_#ea580c]' },
                { left: '42%', dur: '5.5s', delay: '0.8s', drift: '20px', size: 'w-2.5 h-2.5', glow: 'shadow-[0_0_12px_#fbbf24]' },
                { left: '58%', dur: '7.5s', delay: '2.5s', drift: '-35px', size: 'w-1.5 h-1.5', glow: 'shadow-[0_0_8px_#f59e0b]' },
                { left: '72%', dur: '6.5s', delay: '1s', drift: '25px', size: 'w-2 h-2', glow: 'shadow-[0_0_10px_#ea580c]' },
                { left: '88%', dur: '8.5s', delay: '3s', drift: '-20px', size: 'w-2 h-2', glow: 'shadow-[0_0_10px_#fbbf24]' },
              ].map((ember, idx) => (
                <div
                  key={idx}
                  className={`absolute rounded-full bg-gradient-to-t from-amber-400 to-orange-500 animate-ember-rise ${ember.size} ${ember.glow}`}
                  style={{
                    left: ember.left,
                    '--ember-dur': ember.dur,
                    '--ember-delay': ember.delay,
                    '--ember-drift': ember.drift,
                  } as React.CSSProperties}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* ════════════════════════════════════════════════════════════════════
          THEME 10: 🔥 HYPERDRIVE STARFIELD WARP
         ════════════════════════════════════════════════════════════════════ */}
      {theme === 'hyperdrive-warp' && (
        <>
          <div className="absolute inset-0 bg-[#02040a]" />

          {/* Distant Swirling Cosmic Nebula */}
          <div className="absolute top-[20%] left-1/2 -translate-x-1/2 w-[420px] h-[420px] sm:w-[600px] sm:h-[600px] rounded-full bg-gradient-to-tr from-indigo-700/20 via-purple-600/15 to-cyan-500/12 blur-[90px] animate-nebula-swirl pointer-events-none" />

          {/* Warp Starfield Streaks Radiating from Center */}
          {mounted && (
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
              {[0, 24, 48, 72, 96, 120, 144, 168, 192, 216, 240, 264, 288, 312, 336].map((angle, idx) => (
                <div
                  key={idx}
                  className="absolute top-1/2 left-1/2 w-[2px] h-[90px] rounded-full bg-gradient-to-b from-white via-cyan-300 to-transparent shadow-[0_0_10px_#38bdf8] animate-warp-streak origin-top"
                  style={{
                    '--warp-angle': `${angle}deg`,
                    '--warp-dur': `${1.5 + (idx % 4) * 0.4}s`,
                    '--warp-delay': `${(idx * 0.12) % 1.5}s`,
                  } as React.CSSProperties}
                />
              ))}
            </div>
          )}

          {/* Quasar Flares */}
          {mounted && (
            <div className="absolute inset-0 pointer-events-none">
              <span className="absolute top-[18%] left-[22%] w-1 h-1 rounded-full bg-white shadow-[0_0_8px_#ffffff] animate-ping" style={{ animationDuration: '3s' }} />
              <span className="absolute bottom-[28%] right-[18%] w-1.5 h-1.5 rounded-full bg-cyan-300 shadow-[0_0_10px_#22d3ee] animate-ping" style={{ animationDuration: '4s' }} />
            </div>
          )}
        </>
      )}
    </div>
  );
}
