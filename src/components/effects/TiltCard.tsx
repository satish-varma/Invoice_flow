'use client';

import React, { useRef, useState, useCallback } from 'react';
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
  const [transformStyle, setTransformStyle] = useState<string>(
    'perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)'
  );
  const [glarePos, setGlarePos] = useState<{ x: string; y: string; opacity: number }>({
    x: '50%',
    y: '50%',
    opacity: 0,
  });

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!motionFx.masterEnabled || !motionFx.card3dTilt || !cardRef.current) return;

      const rect = cardRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;

      const rotateX = ((y - centerY) / centerY) * -maxTilt;
      const rotateY = ((x - centerX) / centerX) * maxTilt;

      setTransformStyle(
        `perspective(1000px) rotateX(${rotateX.toFixed(2)}deg) rotateY(${rotateY.toFixed(2)}deg) scale3d(1.015, 1.015, 1.015)`
      );

      if (glare) {
        setGlarePos({
          x: `${((x / rect.width) * 100).toFixed(1)}%`,
          y: `${((y / rect.height) * 100).toFixed(1)}%`,
          opacity: 1,
        });
      }
    },
    [motionFx.masterEnabled, motionFx.card3dTilt, maxTilt, glare]
  );

  const handleMouseLeave = useCallback(() => {
    setTransformStyle('perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)');
    setGlarePos((prev) => ({ ...prev, opacity: 0 }));
  }, []);

  // If 3D tilt is disabled in settings, render without 3D transforms
  if (!motionFx.masterEnabled || !motionFx.card3dTilt) {
    return (
      <div className={className} {...props}>
        {children}
      </div>
    );
  }

  return (
    <div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className={`relative overflow-hidden transition-transform duration-150 ease-out ${className}`}
      style={{
        transform: transformStyle,
        transformStyle: 'preserve-3d',
        ...props.style,
      }}
      {...props}
    >
      {/* Specular Holographic Glare Layer */}
      {glare && (
        <div
          className="absolute inset-0 pointer-events-none z-20 rounded-[inherit] transition-opacity duration-200"
          style={{
            opacity: glarePos.opacity,
            background: `radial-gradient(circle 160px at ${glarePos.x} ${glarePos.y}, rgba(255, 255, 255, 0.22), transparent 75%)`,
            mixBlendMode: 'overlay',
          }}
        />
      )}
      {children}
    </div>
  );
}
