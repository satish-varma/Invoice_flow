'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import Home from './(app)/page';
import { Loader2 } from 'lucide-react';

export default function App() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [redirecting, setRedirecting] = useState<boolean | null>(null);

  useEffect(() => {
    if (loading) return;

    if (!user) {
      router.replace('/login');
      return;
    }

    const defaultPage = user.defaultLandingPage;
    const isCapacitor =
      typeof window !== 'undefined' && !!(window as any).Capacitor?.isNativePlatform?.();

    // If user has a configured default landing page and it's not root '/' or '/invoices'
    if (defaultPage && defaultPage !== '/' && defaultPage !== '/invoices') {
      setRedirecting(true);
      router.replace(defaultPage);
      return;
    }

    // Default site routing for non-newrelic sites (DSM, NTT Data)
    if (user.assignedSite === 'dsm' || user.assignedSite === 'ntt_data') {
      setRedirecting(true);
      router.replace('/newrelic/tuckshop');
      return;
    }

    // If running inside Capacitor APK on mobile
    if (isCapacitor) {
      setRedirecting(true);
      router.replace(defaultPage || '/newrelic');
      return;
    }

    // If defaultLandingPage is '/' or user is admin/accountant stay on root Home
    setRedirecting(false);
  }, [user, loading, router]);

  if (loading || redirecting !== false) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 gap-3">
        <Loader2 className="h-8 w-8 text-[#3b2fc9] animate-spin" />
        <p className="text-xs text-gray-500 font-medium">Loading workspace…</p>
      </div>
    );
  }

  return <Home />;
}
