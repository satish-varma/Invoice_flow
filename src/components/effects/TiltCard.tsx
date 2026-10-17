'use client';

import React, { useRef, useState, useCallback, useEffect } from 'react';
import { useMotionFx } from '@/contexts/ThemeBackdropContext';

interface TiltCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
  maxTilt?: number;
  glare?: boolean;
}

export function TiltCard({
  children,
  className = '',
  maxTilt = 7,
  glare = true,
  ...props
}: TiltCardProps) {
  const { motionFx } = useMotionFx();
  const cardRef = useRef<HTMLDivElement | null>(null);
  const [isTouchDevice, setIsTouchDevice] = useState(false);
  const [transformStyle, setTransformStyle] = useState<string>('none');
  const [glarePos, setGlarePos] = useState<{ x: string; y: string; opacity: number }>({
    x: '50%',
    y: '50%',
    opacity: 0,
  });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const isTouch =
        window.matchMedia('(hover: none) and (pointer: coarse)').matches ||
        'ontouchstart' in window ||
        navigator.maxTouchPoints > 0;
      setIsTouchDevice(isTouch);
    }
  }, []);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      // Never apply 3D transforms on touch devices (prevents font blurriness and scroll interference)
      if (isTouchDevice || !motionFx.masterEnabled || !motionFx.card3dTilt || !cardRef.current) return;

      const rect = cardRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;

      const rotateX = ((y - centerY) / centerY) * -maxTilt;
      const rotateY = ((x - centerX) / centerX) * maxTilt;

      setTransformStyle(
        `perspective(1000px) rotateX(${rotateX.toFixed(2)}deg) rotateY(${rotateY.toFixed(2)}deg) scale3d(1.012, 1.012, 1.012)`
      );

      if (glare) {
        setGlarePos({
          x: `${((x / rect.width) * 100).toFixed(1)}%`,
          y: `${((y / rect.height) * 100).toFixed(1)}%`,
          opacity: 1,
        });
      }
    },
    [isTouchDevice, motionFx.masterEnabled, motionFx.card3dTilt, maxTilt, glare]
  );

  const handleMouseLeave = useCallback(() => {
    setTransformStyle('none');
    setGlarePos((prev) => ({ ...prev, opacity: 0 }));
  }, []);

  // If 3D tilt is disabled or running on mobile touch, render cleanly without 3D transforms
  if (!motionFx.masterEnabled || !motionFx.card3dTilt || isTouchDevice) {
    return (
      <div
        data-card="true"
        className={`theme-card transition-all duration-150 ${className}`}
        {...props}
      >
        {children}
      </div>
    );
  }

  return (
    <div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      data-card="true"
      className={`relative overflow-hidden transition-transform duration-150 ease-out theme-card ${className}`}
      style={{
        transform: transformStyle,
        transformStyle: 'preserve-3d',
        ...props.style,
      }}
      {...props}
    >
      {/* Specular Holographic Glare Layer (Desktop only) */}
      {glare && (
        <div
          className="absolute inset-0 pointer-events-none z-20 rounded-[inherit] transition-opacity duration-200"
          style={{
            opacity: glarePos.opacity,
            background: `radial-gradient(circle 180px at ${glarePos.x} ${glarePos.y}, rgba(255, 255, 255, 0.22), transparent 75%)`,
            mixBlendMode: 'overlay',
          }}
        />
      )}
      {children}
    </div>
  );
}
