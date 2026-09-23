'use client';

import { useAuth } from '@/contexts/AuthContext';
import { LogOut, Users } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function NewRelicLayout({ children }: { children: React.ReactNode }) {
  const { user, role, signOut } = useAuth();
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Minimal branded top bar */}
      <header className="border-b border-gray-100 bg-white sticky top-0 z-10 shadow-sm">
        <div className="max-w-6xl mx-auto px-3 sm:px-8 h-14 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/hungerbox_logo.png"
              alt="HungerBox"
              className="h-7 sm:h-8 w-auto object-contain"
            />
            <span className="text-sm text-gray-400 font-medium hidden xs:inline">×</span>
            <span className="text-xs sm:text-sm font-semibold text-gray-700 hidden xs:inline">
              NewRelic DC Portal
            </span>
          </div>
          <div className="flex items-center gap-3">
            {role === 'admin' && (
              <Link 
                href="/admin/users" 
                className="hidden sm:flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-[#3b2fc9] bg-gray-50 border border-gray-200 px-3 py-1.5 rounded-full transition-colors"
              >
                <Users className="h-3.5 w-3.5" />
                Users
              </Link>
            )}
            <span className="text-[11px] sm:text-xs text-gray-400 bg-gray-50 border border-gray-200 rounded-full px-2.5 py-0.5 sm:px-3 sm:py-1 truncate">
              Returnable Items · HYD & BLR
            </span>
            
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

      {/* Secondary Navigation */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-8 flex items-center gap-6">
          <Link 
            href="/newrelic" 
            className={`py-3 text-sm font-medium border-b-2 transition-colors ${
              pathname === '/newrelic' 
                ? 'border-[#3b2fc9] text-[#3b2fc9]' 
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Delivery Challans
          </Link>
          <Link 
            href="/newrelic/tuckshop" 
            className={`py-3 text-sm font-medium border-b-2 transition-colors ${
              pathname === '/newrelic/tuckshop' 
                ? 'border-[#3b2fc9] text-[#3b2fc9]' 
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Tuckshop Tracking
          </Link>
        </div>
      </div>

      <main>{children}</main>
    </div>
  );
}
