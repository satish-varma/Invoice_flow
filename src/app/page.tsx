'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import Home from './(app)/page';
import { Loader2 } from 'lucide-react';
import { hasPermission } from '@/types/permissions';

export default function App() {
  const router = useRouter();
  const { user, role, loading } = useAuth();
  const [redirecting, setRedirecting] = useState<boolean | null>(null);

  useEffect(() => {
    if (loading) return;

    if (!user) {
      router.replace('/login');
      return;
    }

    const isAdmin = role === 'admin' || role === 'superadmin';
    const canAccessBilling = isAdmin || hasPermission(user, 'billing');

    // If user has permission to access billing/invoices dashboard, render Home directly!
    if (canAccessBilling) {
      setRedirecting(false);
      return;
    }

    // If user does NOT have permission for billing/invoices, redirect to their assigned module
    const defaultPage =
      user.defaultLandingPage ||
      (user.assignedSite === 'dsm' || user.assignedSite === 'ntt_data'
        ? '/newrelic/tuckshop'
        : '/newrelic');

    setRedirecting(true);
    router.replace(defaultPage);
  }, [user, role, loading, router]);

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
