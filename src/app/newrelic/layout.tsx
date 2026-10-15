'use client';

import React, { useEffect, useState } from 'react';

import { useAuth } from '@/contexts/AuthContext';
import { FinancialAuthProvider, useFinancialAuth } from '@/contexts/FinancialAuthContext';
import {
  LogOut,
  Users,
  UserCircle,
  ClipboardList,
  Calculator,
  BarChart2,
  Lock,
  Unlock,
  Truck,
  FileCheck2,
  PackageCheck,
  DollarSign,
  FileText,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { getStockRequests } from '@/services/newrelicStockRequestService';
import { FinancialPasswordModal } from '@/components/newrelic/financial-password-modal';
import { MobileAppNavigation } from '@/components/newrelic/mobile-app-navigation';
import { MobileAppBar } from '@/components/newrelic/mobile-app-bar';
import { NetworkStatusIndicator } from '@/components/newrelic/network-status-indicator';
import { COMPANY_SITES } from '@/types/site';
import { hasPermission } from '@/types/permissions';

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

  const site = user?.assignedSite || 'newrelic';
  const siteConfig = COMPANY_SITES[site] || COMPANY_SITES.newrelic;

  useEffect(() => {
    // Dynamically configure native status bar in Capacitor if running on Android/iOS
    import('@capacitor/status-bar').then(({ StatusBar, Style }) => {
      StatusBar.setOverlaysWebView({ overlay: false }).catch(() => {});
      StatusBar.setStyle({ style: Style.Light }).catch(() => {});
      StatusBar.setBackgroundColor({ color: '#FFFFFF' }).catch(() => {});
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (role === 'admin' || hasPermission(user, 'stock_admin')) {
      const fetchPending = async () => {
        try {
          const reqs = await getStockRequests();
          const pending = reqs.filter((r) => r.status === 'PENDING');
          setPendingCount(pending.length);
        } catch (error) {
          console.error('Failed to fetch pending requests:', error);
        }
      };
      fetchPending();
    }
  }, [role, user, pathname]);

  return (
    <FinancialAuthProvider>
      <div className="min-h-screen bg-gray-50">
        {/* Network offline/restored indicator */}
        <NetworkStatusIndicator />

        {/* Mobile Top App Bar (sm:hidden) */}
        <div className="sm:hidden">
          <MobileAppBar>
            {role === 'admin' && <FinancialStatusBadge />}
          </MobileAppBar>
        </div>

        {/* Desktop Header (hidden sm:block) */}
        <header className="hidden sm:block border-b border-gray-100 bg-white sticky top-0 z-10 shadow-sm">
          <div className="max-w-6xl mx-auto px-3 sm:px-8 h-14 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 sm:gap-3 shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/gut_guru_logo.png"
                alt="The Gut Guru Tracker"
                className="h-8 sm:h-9 w-8 sm:w-9 rounded-full object-contain shadow-xs border border-amber-900/10"
              />
              <div className="flex items-center gap-2">
                <span className="text-sm sm:text-base font-black tracking-tight text-gray-900 hidden xs:inline">
                  The Gut Guru Tracker
                </span>
                <span className="text-[11px] font-semibold text-gray-400 hidden md:inline">
                  · {role === 'admin' ? 'Multi-Site Operations' : `${siteConfig.name} Portal`}
                </span>
                {role !== 'admin' && (
                  <span
                    className={`text-[11px] px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                      site === 'dsm'
                        ? 'bg-cyan-100 text-cyan-800 border border-cyan-200'
                        : site === 'ntt_data'
                        ? 'bg-amber-100 text-amber-800 border border-amber-200'
                        : 'bg-indigo-100 text-[#3b2fc9] border border-indigo-200'
                    }`}
                  >
                    📍 {siteConfig.name}
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-3">
              {role === 'admin' && (
                <Link
                  href="/admin/users"
                  className="hidden sm:flex items-center gap-1.5 text-xs font-semibold text-gray-600 hover:text-[#3b2fc9] bg-gray-50 hover:bg-indigo-50 border border-gray-200 hover:border-indigo-200 px-3 py-1.5 rounded-full transition-colors"
                >
                  <Users className="h-3.5 w-3.5 text-[#3b2fc9]" />
                  Access & Users
                </Link>
              )}

              <span className="text-[11px] sm:text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded-full px-2.5 py-0.5 sm:px-3 sm:py-1 truncate hidden md:inline font-medium">
                {role === 'admin'
                  ? 'Multi-Site · HYD & BLR'
                  : `${siteConfig.name} · ${siteConfig.tagline || 'Tuckshop'}`}
              </span>

              {role === 'admin' && <FinancialStatusBadge />}

              <div className="hidden sm:flex flex-col items-end mr-2">
                <span className="text-xs font-semibold text-gray-700">{user?.email}</span>
                <span className="text-[10px] text-gray-500 uppercase tracking-wider font-bold">
                  {role}
                </span>
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
          <div className="max-w-6xl mx-auto px-4 sm:px-8 flex items-center gap-5 overflow-x-auto">
            {/* Dedicated NewRelic DC (strictly NewRelic cafeteria) */}
            {hasPermission(user, 'newrelic_dc') && (
              <Link
                href="/newrelic"
                className={`py-3 text-sm font-semibold border-b-2 whitespace-nowrap transition-colors ${
                  pathname === '/newrelic'
                    ? 'border-[#3b2fc9] text-[#3b2fc9]'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                NewRelic DC
              </Link>
            )}

            {/* General DC (Universal DC for HungerBox and other corporate clients) */}
            {hasPermission(user, 'general_dc') && (
              <Link
                href="/delivery-challan"
                className={`py-3 text-sm font-semibold border-b-2 whitespace-nowrap transition-colors flex items-center gap-1.5 ${
                  pathname.startsWith('/delivery-challan')
                    ? 'border-[#3b2fc9] text-[#3b2fc9]'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Truck className="h-3.5 w-3.5" />
                General DC
              </Link>
            )}

            {/* Tuckshop Sales & Ledger (Site-scoped) */}
            {hasPermission(user, 'tuckshop') && (
              <Link
                href="/newrelic/tuckshop"
                className={`py-3 text-sm font-semibold border-b-2 whitespace-nowrap transition-colors ${
                  pathname === '/newrelic/tuckshop'
                    ? 'border-[#3b2fc9] text-[#3b2fc9]'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Tuckshop Tracking
              </Link>
            )}

            {/* Attendance (Site-scoped) */}
            {hasPermission(user, 'attendance') && (
              <Link
                href="/newrelic/attendance"
                className={`py-3 text-sm font-semibold border-b-2 whitespace-nowrap transition-colors flex items-center gap-1.5 ${
                  pathname === '/newrelic/attendance' && !pathname.includes('payroll')
                    ? 'border-[#3b2fc9] text-[#3b2fc9]'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <ClipboardList className="h-3.5 w-3.5" />
                Attendance
              </Link>
            )}

            {/* Request Stock */}
            {hasPermission(user, 'stock_request') && (
              <Link
                href="/newrelic/stock-request"
                className={`py-3 text-sm font-semibold border-b-2 whitespace-nowrap transition-colors ${
                  pathname === '/newrelic/stock-request'
                    ? 'border-[#3b2fc9] text-[#3b2fc9]'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Request Stock
              </Link>
            )}

            {/* Admin Category Modules */}
            {hasPermission(user, 'stock_admin') && (
              <Link
                href="/newrelic/stock-requests-admin"
                className={`py-3 text-sm font-semibold border-b-2 whitespace-nowrap transition-colors flex items-center gap-2 ${
                  pathname === '/newrelic/stock-requests-admin'
                    ? 'border-[#3b2fc9] text-[#3b2fc9]'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Stock Approvals
                {pendingCount > 0 && (
                  <span className="bg-red-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center">
                    {pendingCount}
                  </span>
                )}
              </Link>
            )}

            {hasPermission(user, 'tuckshop_reconcile') && (
              <Link
                href="/newrelic/reconcile"
                className={`py-3 text-sm font-semibold border-b-2 whitespace-nowrap transition-colors flex items-center gap-1.5 ${
                  pathname === '/newrelic/reconcile'
                    ? 'border-[#3b2fc9] text-[#3b2fc9]'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <FileCheck2 className="h-3.5 w-3.5" />
                Reconcile
              </Link>
            )}

            {hasPermission(user, 'pricing') && (
              <Link
                href="/newrelic/pricing"
                className={`py-3 text-sm font-semibold border-b-2 whitespace-nowrap transition-colors flex items-center gap-1.5 ${
                  pathname === '/newrelic/pricing'
                    ? 'border-[#3b2fc9] text-[#3b2fc9]'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <DollarSign className="h-3.5 w-3.5" />
                Pricing
              </Link>
            )}

            {hasPermission(user, 'catalog') && (
              <Link
                href="/newrelic/catalog"
                className={`py-3 text-sm font-semibold border-b-2 whitespace-nowrap transition-colors flex items-center gap-1.5 ${
                  pathname === '/newrelic/catalog'
                    ? 'border-[#3b2fc9] text-[#3b2fc9]'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <PackageCheck className="h-3.5 w-3.5" />
                Catalog
              </Link>
            )}

            {hasPermission(user, 'payroll') && (
              <Link
                href="/newrelic/attendance?tab=payroll"
                className={`py-3 text-sm font-semibold border-b-2 whitespace-nowrap transition-colors flex items-center gap-1.5 ${
                  pathname === '/newrelic/attendance' &&
                  typeof window !== 'undefined' &&
                  window.location.search.includes('tab=payroll')
                    ? 'border-[#3b2fc9] text-[#3b2fc9]'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Calculator className="h-3.5 w-3.5" />
                Salaries & Advances
              </Link>
            )}

            {hasPermission(user, 'employees') && (
              <Link
                href="/newrelic/employees"
                className={`py-3 text-sm font-semibold border-b-2 whitespace-nowrap transition-colors flex items-center gap-1.5 ${
                  pathname === '/newrelic/employees'
                    ? 'border-[#3b2fc9] text-[#3b2fc9]'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <UserCircle className="h-3.5 w-3.5" />
                Employees
              </Link>
            )}

            {hasPermission(user, 'analytics') && (
              <Link
                href="/newrelic/analytics"
                className={`py-3 text-sm font-semibold border-b-2 whitespace-nowrap transition-colors flex items-center gap-1.5 ${
                  pathname === '/newrelic/analytics'
                    ? 'border-[#3b2fc9] text-[#3b2fc9]'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <BarChart2 className="h-3.5 w-3.5" />
                Analytics
              </Link>
            )}

            {hasPermission(user, 'billing') && (
              <Link
                href="/invoices"
                className="py-3 text-sm font-semibold border-b-2 border-transparent text-indigo-600 hover:text-indigo-800 hover:border-indigo-300 whitespace-nowrap flex items-center gap-1.5 ml-auto"
              >
                <FileText className="h-3.5 w-3.5" />
                Invoices Hub
              </Link>
            )}
          </div>
        </div>

        <main className="pb-24 sm:pb-0">{children}</main>

        {/* Native Mobile Bottom Navigation Bar */}
        <MobileAppNavigation pendingStockCount={pendingCount} />
      </div>
    </FinancialAuthProvider>
  );
}
