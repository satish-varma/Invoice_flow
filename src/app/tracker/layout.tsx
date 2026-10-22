'use client';

import React from 'react';
import { AppShell } from '@/components/app-shell';
import { useAuth } from '@/contexts/AuthContext';
import { hasPermission } from '@/types/permissions';
import { ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export default function TrackerLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <AppShell>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
        </div>
      </AppShell>
    );
  }

  // Permission verification: check if user has hungerbox_tracker or is admin
  const isAllowed =
    user?.role === 'admin' ||
    user?.role === 'superadmin' ||
    hasPermission(user, 'hungerbox_tracker');

  if (!isAllowed) {
    return (
      <AppShell>
        <div className="max-w-md mx-auto my-16 p-8 bg-white border border-rose-200 rounded-xl shadow-xs text-center">
          <div className="h-12 w-12 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <ShieldAlert className="h-6 w-6" />
          </div>
          <h2 className="text-lg font-bold text-gray-900">Access Restricted</h2>
          <p className="text-xs text-gray-600 mt-2">
            You do not have permission to access the Cash &amp; Carry portal. Please contact an administrator.
          </p>
          <div className="mt-6">
            <Button asChild variant="outline" size="sm">
              <Link href="/">Back to Dashboard</Link>
            </Button>
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-8 py-4 sm:py-8 space-y-6 min-w-0">
        {children}
      </div>
    </AppShell>
  );
}
