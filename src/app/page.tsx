'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import Home from "./(app)/page";
import { Loader2 } from 'lucide-react';

export default function App() {
  const router = useRouter();
  const { user } = useAuth();
  const [isMobileDevice, setIsMobileDevice] = useState<boolean | null>(null);

  useEffect(() => {
    const isCapacitor = typeof window !== 'undefined' && !!(window as any).Capacitor?.isNativePlatform?.();
    const isMobileScreen = typeof window !== 'undefined' && (window.innerWidth < 768 || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent));

    if (isCapacitor || isMobileScreen) {
      setIsMobileDevice(true);
      const site = user?.assignedSite;
      if (site === 'dsm' || site === 'ntt_data') {
        router.replace('/newrelic/tuckshop');
      } else {
        router.replace('/newrelic');
      }
    } else {
      setIsMobileDevice(false);
    }
  }, [user, router]);

  if (isMobileDevice === true) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 gap-3">
        <Loader2 className="h-8 w-8 text-[#3b2fc9] animate-spin" />
        <p className="text-xs text-gray-500 font-medium">Loading Operations Portal…</p>
      </div>
    );
  }

  return <Home />;
}
