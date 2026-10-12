'use client';

import React, { useEffect, useState } from 'react';
import { WifiOff, Wifi, RefreshCw } from 'lucide-react';
import { triggerHaptic } from '@/lib/haptics';

export function NetworkStatusIndicator() {
  const [mounted, setMounted] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [showRestored, setShowRestored] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (typeof window === 'undefined' || typeof navigator === 'undefined') return;

    setIsOnline(navigator.onLine);

    const handleOnline = () => {
      setIsOnline(true);
      setShowRestored(true);
      triggerHaptic('success');
      // Hide the "Back Online" message after 3.5 seconds
      const timer = setTimeout(() => {
        setShowRestored(false);
      }, 3500);
      return () => clearTimeout(timer);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setShowRestored(false);
      triggerHaptic('warning');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (!mounted) return null;

  // Don't render anything if online and not showing the temporary restored banner
  if (isOnline && !showRestored) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed top-14 sm:top-16 left-0 right-0 z-50 flex justify-center px-4 pointer-events-none animate-in fade-in slide-in-from-top-2 duration-200"
    >
      {!isOnline ? (
        <div className="pointer-events-auto bg-amber-500/95 backdrop-blur-md text-white px-4 py-2 rounded-2xl shadow-lg border border-amber-400 flex items-center gap-2.5 max-w-sm text-xs font-medium">
          <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center shrink-0">
            <WifiOff className="w-3.5 h-3.5 text-white animate-pulse" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold leading-tight">You are offline</p>
            <p className="text-[11px] text-amber-100 leading-tight mt-0.5">
              Check-in selfies & stock forms will fail to upload until connection returns.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              triggerHaptic('light');
              setIsOnline(navigator.onLine);
            }}
            className="p-1.5 rounded-lg bg-white/20 hover:bg-white/30 active:scale-95 transition-all shrink-0"
            title="Retry Connection"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      ) : showRestored ? (
        <div className="pointer-events-auto bg-emerald-600/95 backdrop-blur-md text-white px-4 py-2 rounded-2xl shadow-lg border border-emerald-500 flex items-center gap-2.5 max-w-sm text-xs font-medium animate-in fade-in slide-in-from-top-1">
          <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center shrink-0">
            <Wifi className="w-3.5 h-3.5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold leading-tight">Back online</p>
            <p className="text-[11px] text-emerald-100 leading-tight mt-0.5">
              Network connection restored. Ready to sync.
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
