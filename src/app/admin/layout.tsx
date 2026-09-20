'use client';

import { useAuth } from '@/contexts/AuthContext';
import { LogOut, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, role, signOut } = useAuth();

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-100 bg-white sticky top-0 z-10 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <Link href="/newrelic" className="text-gray-400 hover:text-[#3b2fc9] flex items-center gap-1 text-sm font-medium">
                <ArrowLeft className="h-4 w-4" /> Back to App
              </Link>
            </div>
            <div className="flex items-center gap-3">
              <div className="hidden sm:flex flex-col items-end mr-2">
                <span className="text-xs font-semibold text-gray-700">{user?.email}</span>
                <span className="text-[10px] text-gray-500 uppercase tracking-wider">{role}</span>
              </div>
              <button 
                onClick={signOut}
                className="p-1.5 text-gray-400 hover:text-red-500 transition-colors rounded-md hover:bg-red-50"
                title="Sign out"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </div>
        </header>
        <main>{children}</main>
      </div>
  );
}
