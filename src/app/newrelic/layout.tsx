'use client';

import React, { useEffect, useState } from 'react';

import { useAuth } from '@/contexts/AuthContext';
import { FinancialAuthProvider, useFinancialAuth } from '@/contexts/FinancialAuthContext';
import { LogOut, Users, UserCircle, ClipboardList, Calculator, BarChart2, Lock, Unlock } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { getStockRequests } from '@/services/newrelicStockRequestService';
import { FinancialPasswordModal } from '@/components/newrelic/financial-password-modal';
import { MobileAppNavigation } from '@/components/newrelic/mobile-app-navigation';

function FinancialStatusBadge() {
  const { isUnlocked, remainingMinutes, lockFinancials } = useFinancialAuth();
  const [showModal, setShowModal] = useState(false);

  if (isUnlocked) {
    return (
      <div className="flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] px-2.5 py-1 rounded-full font-medium shadow-xs">
        <Unlock className="w-3 h-3 text-emerald-600" />
        <span>Financials ({remainingMinutes}m)</span>
        <button
          onClick={lockFinancials}
          title="Lock financials now"
          className="ml-1 text-emerald-950 hover:text-red-600 transition-colors p-0.5 rounded"
        >
          <Lock className="w-2.5 h-2.5" />
        </button>
      </div>
    );
  }

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        className="flex items-center gap-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-[11px] px-2.5 py-1 rounded-full font-medium transition-colors border border-gray-200"
        title="Financials are locked. Click to enter admin password."
      >
        <Lock className="w-3 h-3 text-gray-500" />
        <span>Financials Locked</span>
      </button>

      <FinancialPasswordModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
      />
    </>
  );
}

export default function NewRelicLayout({ children }: { children: React.ReactNode }) {
  const { user, role, signOut } = useAuth();
  const pathname = usePathname();
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    if (role === 'admin') {
      const fetchPending = async () => {
        try {
          const reqs = await getStockRequests();
          const pending = reqs.filter(r => r.status === 'PENDING');
          setPendingCount(pending.length);
        } catch (error) {
          console.error('Failed to fetch pending requests:', error);
        }
      };
      fetchPending();
      
      // We could also set an interval here if we want it to auto-refresh,
      // but for now, just on mount/layout render is fine.
    }
  }, [role, pathname]);

  return (
    <FinancialAuthProvider>
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
            <span className="text-[11px] sm:text-xs text-gray-400 bg-gray-50 border border-gray-200 rounded-full px-2.5 py-0.5 sm:px-3 sm:py-1 truncate hidden md:inline">
              Returnable Items · HYD & BLR
            </span>
            
            {role === 'admin' && <FinancialStatusBadge />}

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

      {/* Secondary Navigation (Desktop only: hidden on mobile, replaced by bottom nav) */}
      <div className="hidden sm:block bg-white border-b border-gray-200">
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
          <Link 
            href="/newrelic/attendance" 
            className={`py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5 ${
              pathname === '/newrelic/attendance' 
                ? 'border-[#3b2fc9] text-[#3b2fc9]' 
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <ClipboardList className="h-3.5 w-3.5" />
            Attendance
          </Link>
          <Link 
            href="/newrelic/stock-request" 
            className={`py-3 text-sm font-medium border-b-2 transition-colors ${
              pathname === '/newrelic/stock-request' 
                ? 'border-[#3b2fc9] text-[#3b2fc9]' 
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Request Stock
          </Link>
          {role === 'admin' && (
            <>
              <Link 
                href="/newrelic/stock-requests-admin" 
                className={`py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
                  pathname === '/newrelic/stock-requests-admin' 
                    ? 'border-[#3b2fc9] text-[#3b2fc9]' 
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Stock Requests (Admin)
                {pendingCount > 0 && (
                  <span className="bg-red-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center">
                    {pendingCount}
                  </span>
                )}
              </Link>
              <Link 
                href="/newrelic/analytics" 
                className={`py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5 ${
                  pathname === '/newrelic/analytics' 
                    ? 'border-[#3b2fc9] text-[#3b2fc9]' 
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <BarChart2 className="h-3.5 w-3.5" />
                Executive Insights
              </Link>
              <Link 
                href="/newrelic/pricing" 
                className={`py-3 text-sm font-medium border-b-2 transition-colors ${
                  pathname === '/newrelic/pricing' 
                    ? 'border-[#3b2fc9] text-[#3b2fc9]' 
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Pricing
              </Link>
              <Link 
                href="/newrelic/catalog" 
                className={`py-3 text-sm font-medium border-b-2 transition-colors ${
                  pathname === '/newrelic/catalog' 
                    ? 'border-[#3b2fc9] text-[#3b2fc9]' 
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Catalog
              </Link>
              <Link 
                href="/newrelic/attendance?tab=payroll" 
                className={`py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5 ${
                  pathname === '/newrelic/attendance' && typeof window !== 'undefined' && window.location.search.includes('tab=payroll')
                    ? 'border-[#3b2fc9] text-[#3b2fc9]' 
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Calculator className="h-3.5 w-3.5" />
                Salaries & Advances
              </Link>
              <Link 
                href="/newrelic/employees" 
                className={`py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5 ${
                  pathname === '/newrelic/employees' 
                    ? 'border-[#3b2fc9] text-[#3b2fc9]' 
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <UserCircle className="h-3.5 w-3.5" />
                Employees
              </Link>
            </>
          )}
        </div>
      </div>

        <main className="pb-20 sm:pb-0">{children}</main>

        {/* Native Mobile Bottom Navigation Bar */}
        <MobileAppNavigation pendingStockCount={pendingCount} />
      </div>
    </FinancialAuthProvider>
  );
}
