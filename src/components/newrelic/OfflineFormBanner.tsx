'use client';

import React, { useEffect, useState } from 'react';
import { WifiOff, ShieldCheck } from 'lucide-react';

interface OfflineFormBannerProps {
  moduleName?: string; // e.g. "Delivery Challan", "Stock Request", "Attendance Punch"
  className?: string;
}

export function OfflineFormBanner({ moduleName = 'Form', className = '' }: OfflineFormBannerProps) {
  const [mounted, setMounted] = useState(false);
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    setMounted(true);
    if (typeof window === 'undefined') return;

    setIsOnline(navigator.onLine);
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);

    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  if (!mounted || isOnline) return null;

  return (
    <div
      role="status"
      className={`p-3 rounded-2xl bg-gradient-to-r from-amber-500/15 via-orange-500/10 to-amber-500/15 border border-amber-500/30 text-amber-900 dark:text-amber-200 flex items-center justify-between gap-3 text-xs shadow-xs animate-in fade-in slide-in-from-top-1 duration-200 ${className}`}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="w-7 h-7 rounded-xl bg-amber-500/20 text-amber-700 dark:text-amber-300 flex items-center justify-center shrink-0">
          <WifiOff className="w-4 h-4 animate-pulse" />
        </div>
        <div className="min-w-0">
          <p className="font-bold flex items-center gap-1.5 text-xs text-amber-950 dark:text-amber-100">
            <span>Offline Mode Active</span>
            <span className="inline-block w-2 h-2 rounded-full bg-amber-500 animate-ping" />
          </p>
          <p className="text-[11px] text-amber-800 dark:text-amber-300/90 line-clamp-1">
            Your {moduleName} will be safely stored to this device and auto-uploaded once connected.
          </p>
        </div>
      </div>
      <div className="flex items-center gap-1 shrink-0 font-bold text-[10px] bg-amber-500/25 text-amber-900 dark:text-amber-200 px-2 py-1 rounded-lg border border-amber-500/20">
        <ShieldCheck className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
        <span>Safe to Save</span>
      </div>
    </div>
  );
}
