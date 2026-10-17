'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useMotionFx } from '@/contexts/ThemeBackdropContext';

interface RollingCashCounterProps {
  value: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  className?: string;
}

export function RollingCashCounter({
  value,
  prefix = '₹',
  suffix = '',
  decimals = 2,
  className = '',
}: RollingCashCounterProps) {
  const { motionFx } = useMotionFx();
  const [displayValue, setDisplayValue] = useState<number>(value);
  const prevValueRef = useRef<number>(value);
  const animRef = useRef<number | null>(null);

  useEffect(() => {
    // If rolling counters are disabled or master is off, update immediately without animation
    if (!motionFx.masterEnabled || !motionFx.rollingCounters) {
      setDisplayValue(value);
      prevValueRef.current = value;
      return;
    }

    const start = prevValueRef.current;
    const diff = value - start;
    if (Math.abs(diff) < 0.01) {
      setDisplayValue(value);
      return;
    }

    const duration = 750; // ms
    const startTime = performance.now();

    const animateNumber = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out expo for snappy luxury feel
      const ease = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
      const current = start + diff * ease;

      setDisplayValue(current);

      if (progress < 1) {
        animRef.current = requestAnimationFrame(animateNumber);
      } else {
        setDisplayValue(value);
        prevValueRef.current = value;
      }
    };

    animRef.current = requestAnimationFrame(animateNumber);

    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [value, motionFx.masterEnabled, motionFx.rollingCounters]);

  const formatted = displayValue.toLocaleString('en-IN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

  return (
    <span className={`tabular-nums font-mono ${className}`}>
      {prefix}
      {formatted}
      {suffix}
    </span>
  );
}
