'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useMotionFx, useThemeBackdrop } from '@/contexts/ThemeBackdropContext';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  alpha: number;
  decay: number;
  color: string;
}

interface Ripple {
  id: number;
  x: number;
  y: number;
  color: string;
}

export function GlobalMotionFxOverlay() {
  const { motionFx } = useMotionFx();
  const { theme } = useThemeBackdrop();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const particlesRef = useRef<Particle[]>([]);
  const animFrameRef = useRef<number | null>(null);
  const isRunningRef = useRef<boolean>(false);
  const [ripples, setRipples] = useState<Ripple[]>([]);

  // Get active theme accent color dynamically from CSS root
  const getAccentColor = useCallback(() => {
    if (typeof window === 'undefined') return '#6366f1';
    const computed = getComputedStyle(document.documentElement).getPropertyValue('--theme-accent').trim();
    return computed || '#6366f1';
  }, []);

  // Sleep-When-Idle Animation Loop
  const startLoopIfNeeded = useCallback(() => {
    if (isRunningRef.current) return;
    isRunningRef.current = true;

    const render = () => {
      const canvas = canvasRef.current;
      if (!canvas) {
        isRunningRef.current = false;
        return;
      }
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        isRunningRef.current = false;
        return;
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const particles = particlesRef.current;
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.alpha -= p.decay;
        p.size *= 0.96;

        if (p.alpha <= 0 || p.size <= 0.4) {
          particles.splice(i, 1);
          continue;
        }

        ctx.save();
        ctx.globalAlpha = Math.max(0, p.alpha);
        ctx.fillStyle = p.color;
        ctx.shadowBlur = 6;
        ctx.shadowColor = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // If particles still exist, continue loop; otherwise suspend to save battery (0% idle CPU)
      if (particles.length > 0) {
        animFrameRef.current = requestAnimationFrame(render);
      } else {
        isRunningRef.current = false;
        animFrameRef.current = null;
      }
    };

    animFrameRef.current = requestAnimationFrame(render);
  }, []);

  // Resize canvas to full viewport size
  useEffect(() => {
    const handleResize = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // 1. Touch & Cursor Stardust Trail (Clean, non-distracting & 60-120fps)
  useEffect(() => {
    if (!motionFx.masterEnabled || !motionFx.stardustTrail) return;

    let lastSpawn = 0;
    const SPAWN_INTERVAL = 32; // ~30 spawns per sec for desktop

    const handlePointerMove = (e: PointerEvent) => {
      const isTouch = e.pointerType === 'touch';

      // Mobile Touch Optimization:
      // Suppress particles during rapid vertical scrolling so user's thumb has zero lag/distraction
      if (isTouch) {
        if (Math.abs(e.movementY) > 8) return;
      }

      const now = performance.now();
      const interval = isTouch ? 70 : SPAWN_INTERVAL;
      if (now - lastSpawn < interval) return;
      lastSpawn = now;

      // Cap max particles to prevent any stutter
      if (particlesRef.current.length > 25) {
        particlesRef.current.shift();
      }

      const accent = getAccentColor();
      const color = Math.random() > 0.4 ? accent : '#ffffff';

      particlesRef.current.push({
        x: e.clientX,
        y: e.clientY,
        vx: (Math.random() - 0.5) * (isTouch ? 0.7 : 1.5),
        vy: (Math.random() - 0.5) * (isTouch ? 0.7 : 1.5) + (isTouch ? 0 : 0.3),
        size: isTouch ? Math.random() * 1.2 + 0.8 : Math.random() * 3 + 1.5,
        alpha: isTouch ? 0.6 : 0.85,
        decay: isTouch ? 0.055 : Math.random() * 0.035 + 0.02,
        color,
      });

      startLoopIfNeeded();
    };

    window.addEventListener('pointermove', handlePointerMove, { passive: true });
    return () => window.removeEventListener('pointermove', handlePointerMove);
  }, [motionFx.masterEnabled, motionFx.stardustTrail, getAccentColor, startLoopIfNeeded]);

  // 2. Action Button Tap Bursts
  useEffect(() => {
    if (!motionFx.masterEnabled || !motionFx.actionBursts) return;

    // Custom event listener for explicit triggers
    const handleCustomBurst = (e: Event) => {
      const detail = (e as CustomEvent<{ x: number; y: number; color?: string }>).detail;
      if (!detail) return;
      spawnBurst(detail.x, detail.y, detail.color);
    };

    // Auto-detect clicks on primary action buttons or elements with data-burst
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      const burstElement = target.closest('[data-burst="true"], .theme-btn-primary, [type="submit"]');
      if (burstElement) {
        spawnBurst(e.clientX, e.clientY);
      }
    };

    const spawnBurst = (x: number, y: number, customColor?: string) => {
      const accent = customColor || getAccentColor();
      for (let i = 0; i < 22; i++) {
        const angle = (Math.PI * 2 * i) / 22 + (Math.random() - 0.5) * 0.4;
        const speed = Math.random() * 5 + 2.5;
        particlesRef.current.push({
          x,
          y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 0.8,
          size: Math.random() * 3.5 + 2,
          alpha: 1,
          decay: Math.random() * 0.03 + 0.025,
          color: Math.random() > 0.35 ? accent : '#fbbf24',
        });
      }
      startLoopIfNeeded();
    };

    window.addEventListener('invoiceflow:burst', handleCustomBurst);
    window.addEventListener('click', handleClick, { passive: true });

    return () => {
      window.removeEventListener('invoiceflow:burst', handleCustomBurst);
      window.removeEventListener('click', handleClick);
    };
  }, [motionFx.masterEnabled, motionFx.actionBursts, getAccentColor, startLoopIfNeeded]);

  // 3. Cosmic Theme Switch Ripple Wave
  useEffect(() => {
    if (!motionFx.masterEnabled || !motionFx.cosmicRipple) return;

    const handleRippleEvent = (e: Event) => {
      const detail = (e as CustomEvent<{ x: number; y: number; color?: string }>).detail;
      const x = detail?.x ?? window.innerWidth / 2;
      const y = detail?.y ?? window.innerHeight / 2;
      const color = detail?.color || getAccentColor();
      const id = Date.now() + Math.random();

      setRipples((prev) => [...prev, { id, x, y, color }]);
      setTimeout(() => {
        setRipples((prev) => prev.filter((r) => r.id !== id));
      }, 950);
    };

    window.addEventListener('invoiceflow:ripple', handleRippleEvent);
    return () => window.removeEventListener('invoiceflow:ripple', handleRippleEvent);
  }, [motionFx.masterEnabled, motionFx.cosmicRipple, getAccentColor, theme]);

  // Clean up animation on unmount
  useEffect(() => {
    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, []);

  return (
    <div className="fixed inset-0 pointer-events-none z-[999] overflow-hidden">
      {/* 2D Canvas for Stardust Trail & Action Bursts */}
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none" />

      {/* Cosmic Ripple Shockwave Layer */}
      {ripples.map((ripple) => (
        <div
          key={ripple.id}
          className="absolute rounded-full pointer-events-none animate-cosmic-ripple"
          style={{
            left: `${ripple.x}px`,
            top: `${ripple.y}px`,
            width: '80px',
            height: '80px',
            background: `radial-gradient(circle, ${ripple.color}88 0%, ${ripple.color}33 45%, transparent 75%)`,
          }}
        />
      ))}
    </div>
  );
}
