'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  FileText,
  Store,
  CalendarCheck,
  BarChart3,
  BarChart2,
  MoreHorizontal,
  DollarSign,
  PackageCheck,
  Users,
  Settings,
  CreditCard,
  Send,
  Truck,
  FileCheck2,
  ListOrdered,
  FileSearch,
  Package,
  Receipt,
  Briefcase,
  Layers,
  ChevronDown,
  Shield,
  FilePlus,
  LogOut,
  Lock,
  Unlock,
  LayoutDashboard,
  CalendarDays,
  Building2,
  PieChart,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { FinancialAuthProvider, useFinancialAuth } from '@/contexts/FinancialAuthContext';
import { FinancialPasswordModal } from '@/components/newrelic/financial-password-modal';
import { AdminFloatNotificationPill, AdminFloatMobileBanner } from '@/components/newrelic/tuckshop/AdminFloatApprovalModal';
import { MobileAppNavigation } from '@/components/newrelic/mobile-app-navigation';
import { MobileAppBar } from '@/components/newrelic/mobile-app-bar';
import { NetworkStatusIndicator } from '@/components/newrelic/network-status-indicator';
import { getStockRequests } from '@/services/newrelicStockRequestService';
import { COMPANY_SITES } from '@/types/site';
import { subscribeCompanySites } from '@/services/siteService';
import { hasPermission } from '@/types/permissions';
import { triggerHaptic } from '@/lib/haptics';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

function FinancialStatusBadge({ darkHeader }: { darkHeader?: boolean }) {
  const { isUnlocked, remainingMinutes, lockFinancials } = useFinancialAuth();
  const [showModal, setShowModal] = useState(false);

  if (isUnlocked) {
    return (
      <div
        className={
          darkHeader
            ? "flex items-center gap-1.5 bg-emerald-500/20 border border-emerald-400/30 text-emerald-100 text-[11px] px-2.5 py-1 rounded-full font-medium shadow-xs backdrop-blur-sm"
            : "flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] px-2.5 py-1 rounded-full font-medium shadow-xs"
        }
      >
        <Unlock className={`w-3 h-3 ${darkHeader ? 'text-emerald-300' : 'text-emerald-600'}`} />
        <span>Financials ({remainingMinutes}m)</span>
        <button
          onClick={lockFinancials}
          title="Lock financials now"
          className={`ml-1 transition-colors p-0.5 rounded ${darkHeader ? 'text-emerald-200 hover:text-red-300' : 'text-emerald-950 hover:text-red-600'}`}
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
        className={
          darkHeader
            ? "flex items-center gap-1.5 bg-white/10 hover:bg-white/20 text-white/90 text-[11px] px-2.5 py-1 rounded-full font-medium transition-colors border border-white/20 backdrop-blur-sm"
            : "flex items-center gap-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-[11px] px-2.5 py-1 rounded-full font-medium transition-colors border border-gray-200"
        }
        title="Financials are locked. Click to enter admin password."
      >
        <Lock className={`w-3 h-3 ${darkHeader ? 'text-white/70' : 'text-gray-500'}`} />
        <span>Financials Locked</span>
      </button>

      <FinancialPasswordModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
      />
    </>
  );
}

function AppShellInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, role, signOut } = useAuth();
  const [pendingStockCount, setPendingStockCount] = useState(0);

  const isAdmin = role === 'admin' || role === 'superadmin';
  const site = user?.assignedSite || 'newrelic';
  const [, setSitesVersion] = useState(0);
  const siteConfig = COMPANY_SITES[site] || {
    id: site,
    name: site,
    allowedLocations: ['hyderabad'],
    hasChallans: false,
    tagline: `${site} Stall`,
  };

  useEffect(() => {
    const unsub = subscribeCompanySites(() => {
      setSitesVersion((v) => v + 1);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    // Configure mobile status bar for native Android/iOS Capacitor wrapper
    if (typeof window !== 'undefined') {
      import('@capacitor/status-bar')
        .then(({ StatusBar, Style }) => {
          StatusBar.setOverlaysWebView({ overlay: false }).catch(() => {});
          StatusBar.setStyle({ style: Style.Light }).catch(() => {});
          StatusBar.setBackgroundColor({ color: '#FFFFFF' }).catch(() => {});
        })
        .catch(() => {});
    }
  }, []);

  useEffect(() => {
    if (isAdmin || hasPermission(user, 'stock_admin')) {
      getStockRequests()
        .then((reqs) => {
          const pending = reqs.filter((r) => r.status === 'PENDING');
          setPendingStockCount(pending.length);
        })
        .catch(() => {});
    }
  }, [isAdmin, user, pathname]);

  // Active check helpers
  const isRecordsAndHrActive =
    pathname === '/invoices' ||
    pathname === '/delivery-challans' ||
    pathname === '/quotations' ||
    pathname === '/quotation' ||
    pathname === '/products' ||
    pathname === '/payslip' ||
    pathname === '/offer-letter' ||
    pathname === '/declarations' ||
    pathname === '/clients' ||
    pathname === '/newrelic/leaves';

  const isAdminActive =
    pathname.startsWith('/newrelic/stock-requests-admin') ||
    pathname === '/newrelic/reconcile' ||
    pathname === '/newrelic/pricing' ||
    pathname === '/newrelic/catalog' ||
    (pathname === '/newrelic/attendance' && typeof window !== 'undefined' && window.location.search.includes('tab=payroll')) ||
    pathname === '/newrelic/employees' ||
    pathname === '/newrelic/analytics' ||
    pathname.startsWith('/admin') ||
    pathname === '/settings';

  return (
    <div className="min-h-screen bg-transparent flex flex-col relative">
      {/* Network offline/restored indicator */}
      <NetworkStatusIndicator />

      {/* Mobile Top App Bar (sm:hidden) */}
      <div className="sm:hidden">
        <MobileAppBar>
          <AdminFloatNotificationPill compact />
          {isAdmin && <FinancialStatusBadge />}
        </MobileAppBar>
        {isAdmin && <AdminFloatMobileBanner />}
      </div>

      {/* Desktop Top Header (hidden sm:block) */}
      <header className="hidden sm:block border-b border-indigo-950/40 bg-gradient-to-r from-[#1e1b4b] via-[#3b2fc9] to-[#4f46e5] text-white sticky top-0 z-30 shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-8 h-14 flex items-center justify-between gap-3">
          {/* Brand & Site Scoping */}
          <div className="flex items-center gap-3 shrink-0">
            <Link
              href="/"
              onClick={() => triggerHaptic('light')}
              className="flex items-center gap-2.5 hover:opacity-95 transition-opacity"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/gut_guru_logo.png"
                alt="The Gut Guru Tracker"
                className="h-8 sm:h-9 w-8 sm:w-9 rounded-full object-contain shadow-xs border border-white/20 bg-white/10 p-0.5"
              />
              <span className="text-base font-black tracking-tight text-white">
                The Gut Guru Tracker
              </span>
            </Link>

            <span className="text-white/30 font-light">|</span>

            {/* Site Indicator Badge */}
            {isAdmin ? (
              <span className="text-xs text-white/90 bg-white/15 border border-white/20 backdrop-blur-sm rounded-full px-3 py-1 font-semibold flex items-center gap-1.5 shadow-xs">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                Multi-Site Operations (HYD &amp; BLR)
              </span>
            ) : (user?.allowedTabs?.includes('hungerbox_tracker') && (!user?.allowedTabs?.includes('tuckshop') && !user?.allowedTabs?.includes('attendance'))) || (user?.assignedLocations && user.assignedLocations.length > 0) ? (
              <span className="text-xs px-3 py-1 rounded-full font-bold uppercase tracking-wider border flex items-center gap-1.5 bg-emerald-500/20 text-emerald-200 border-emerald-400/30 backdrop-blur-sm">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                📍 Cash &amp; Carry: {user?.assignedLocations && user.assignedLocations.length > 0 ? user.assignedLocations.join(' · ') : 'All Locations'}
                {user?.assignedStalls && user.assignedStalls.length > 0 ? ` (${user.assignedStalls.length} Stalls)` : ''}
              </span>
            ) : user?.assignedSites && user.assignedSites.length > 1 ? (
              <span
                className="text-xs px-3 py-1 rounded-full font-bold uppercase tracking-wider border flex items-center gap-1.5 bg-white/15 text-white border-white/20 backdrop-blur-sm"
              >
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                📍 Multi-Stall: {user.assignedSites.map((s) => COMPANY_SITES[s]?.name || s).join(' · ')}
              </span>
            ) : (
              <span
                className="text-xs px-3 py-1 rounded-full font-bold uppercase tracking-wider border flex items-center gap-1.5 bg-white/15 text-white border-white/20 backdrop-blur-sm"
              >
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                📍 {siteConfig.name} Stall
              </span>
            )}
          </div>

          {/* Right Action Items */}
          <div className="flex items-center gap-3">
            <AdminFloatNotificationPill />

            {isAdmin && <FinancialStatusBadge darkHeader />}

            {role === 'guest' && (
              <span className="text-xs text-amber-200 bg-amber-500/20 border border-amber-400/30 backdrop-blur-sm rounded-full px-3 py-1 font-bold flex items-center gap-1.5 shadow-xs">
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                👁️ Guest Mode (Read-Only)
              </span>
            )}

            {isAdmin && (
              <Link
                href="/admin/users"
                className="flex items-center gap-1.5 text-xs font-semibold text-white/90 hover:text-white bg-white/10 hover:bg-white/20 border border-white/20 px-3 py-1.5 rounded-full transition-colors backdrop-blur-sm"
              >
                <Shield className="h-3.5 w-3.5 text-indigo-200" />
                Access &amp; Users
              </Link>
            )}

            <Link
              href="/profile"
              className="flex items-center gap-2 px-2.5 py-1 rounded-xl hover:bg-white/10 transition-colors group cursor-pointer"
              title="View account and employee details"
            >
              <div className="w-8 h-8 rounded-full bg-white/20 text-white flex items-center justify-center font-bold text-xs border border-white/30 shadow-xs">
                {user?.email ? user.email.substring(0, 2).toUpperCase() : 'GG'}
              </div>
              <div className="flex flex-col items-start text-left">
                <span className="text-xs font-bold text-white group-hover:text-indigo-200 transition-colors truncate max-w-[170px]">
                  {user?.email}
                </span>
                <span className="text-[10px] text-white/60 uppercase font-bold tracking-wider">
                  {role || 'User'}
                </span>
              </div>
            </Link>

            <button
              onClick={signOut}
              className="p-1.5 text-white/60 hover:text-red-300 transition-colors rounded-lg hover:bg-white/10 cursor-pointer"
              title="Sign out from device"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Desktop Secondary Navigation Bar with Categorized Dropdowns */}
      <div className="hidden sm:block bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-gray-200/80 sticky top-14 z-20 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-8 py-2 flex items-center gap-1.5 overflow-x-auto">
          {/* Direct Tab 1: Tuckshop (Counter sales & ledger for assigned site) */}
          {hasPermission(user, 'tuckshop') && (
            <>
              <Link
                href="/newrelic/tuckshop"
                className={`px-3 py-1.5 text-xs font-bold rounded-full whitespace-nowrap transition-all duration-150 flex items-center gap-1.5 border ${
                  (pathname === '/newrelic/tuckshop' || pathname === '/tuckshop')
                    ? 'bg-indigo-50 border-indigo-200 text-[#3b2fc9] dark:bg-indigo-950/60 dark:border-indigo-800 dark:text-indigo-300 shadow-xs'
                    : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100/80 dark:hover:bg-slate-800/60'
                }`}
              >
                <Store className="h-3.5 w-3.5" />
                Tuckshop
              </Link>

              {isAdmin && (
                <>
                  <Link
                    href="/newrelic/tuckshop/sales"
                    className={`px-3 py-1.5 text-xs font-bold rounded-full whitespace-nowrap transition-all duration-150 flex items-center gap-1.5 border ${
                      pathname === '/newrelic/tuckshop/sales' || pathname === '/tuckshop/sales'
                        ? 'bg-indigo-50 border-indigo-200 text-[#3b2fc9] dark:bg-indigo-950/60 dark:border-indigo-800 dark:text-indigo-300 shadow-xs'
                        : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100/80 dark:hover:bg-slate-800/60'
                    }`}
                  >
                    <Building2 className="h-3.5 w-3.5 text-amber-500" />
                    All Sites Sales
                  </Link>

                  <Link
                    href="/newrelic/tuckshop/analytics"
                    className={`px-3 py-1.5 text-xs font-bold rounded-full whitespace-nowrap transition-all duration-150 flex items-center gap-1.5 border ${
                      pathname === '/newrelic/tuckshop/analytics' || pathname === '/tuckshop/analytics'
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-950/60 dark:border-emerald-800 dark:text-emerald-300 shadow-xs'
                        : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100/80 dark:hover:bg-slate-800/60'
                    }`}
                  >
                    <PieChart className="h-3.5 w-3.5 text-emerald-500" />
                    P&amp;L Analytics
                  </Link>
                </>
              )}
            </>
          )}

          {/* Direct Tab 2: Attendance (Daily check-in/out for assigned site) */}
          {hasPermission(user, 'attendance') && (
            <Link
              href="/newrelic/attendance"
              className={`px-3 py-1.5 text-xs font-bold rounded-full whitespace-nowrap transition-all duration-150 flex items-center gap-1.5 border ${
                (pathname.startsWith('/newrelic/attendance') || pathname === '/attendance') &&
                !pathname.includes('payroll')
                  ? 'bg-indigo-50 border-indigo-200 text-[#3b2fc9] dark:bg-indigo-950/60 dark:border-indigo-800 dark:text-indigo-300 shadow-xs'
                  : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100/80 dark:hover:bg-slate-800/60'
              }`}
            >
              <CalendarCheck className="h-3.5 w-3.5" />
              Attendance
            </Link>
          )}

          {/* Direct Tab 3: Dedicated NewRelic DC Hub (strictly NewRelic cafeteria) */}
          {hasPermission(user, 'newrelic_dc') && (
            <Link
              href="/newrelic"
              prefetch={false}
              className={`px-3 py-1.5 text-xs font-bold rounded-full whitespace-nowrap transition-all duration-150 flex items-center gap-1.5 border ${
                pathname === '/newrelic'
                  ? 'bg-indigo-50 border-indigo-200 text-[#3b2fc9] dark:bg-indigo-950/60 dark:border-indigo-800 dark:text-indigo-300 shadow-xs'
                  : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100/80 dark:hover:bg-slate-800/60'
              }`}
            >
              <FileText className="h-3.5 w-3.5" />
              NewRelic DC
            </Link>
          )}

          {/* Direct Tab 4: General DC (Universal delivery challan for other companies) */}
          {hasPermission(user, 'general_dc') && (
            <Link
              href="/delivery-challan"
              className={`px-3 py-1.5 text-xs font-bold rounded-full whitespace-nowrap transition-all duration-150 flex items-center gap-1.5 border ${
                pathname === '/delivery-challan'
                  ? 'bg-indigo-50 border-indigo-200 text-[#3b2fc9] dark:bg-indigo-950/60 dark:border-indigo-800 dark:text-indigo-300 shadow-xs'
                  : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100/80 dark:hover:bg-slate-800/60'
              }`}
            >
              <Truck className="h-3.5 w-3.5" />
              General DC
            </Link>
          )}

          {/* Direct Tab 5: Invoicing & Billing (Dashboard, Creator & Overview) */}
          {hasPermission(user, 'invoices') && role !== 'guest' && (
            <Link
              href="/"
              className={`px-3 py-1.5 text-xs font-bold rounded-full whitespace-nowrap transition-all duration-150 flex items-center gap-1.5 border ${
                pathname === '/'
                  ? 'bg-indigo-50 border-indigo-200 text-[#3b2fc9] dark:bg-indigo-950/60 dark:border-indigo-800 dark:text-indigo-300 shadow-xs'
                  : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100/80 dark:hover:bg-slate-800/60'
              }`}
            >
              <LayoutDashboard className="h-3.5 w-3.5" />
              Invoices &amp; Dashboard
            </Link>
          )}

          {/* Direct Tab 6: Cash & Carry Portal */}
          {(hasPermission(user, 'hungerbox_tracker') || hasPermission(user, 'hungerbox_tracker_invoices')) && (
            <Link
              href="/tracker"
              prefetch={false}
              className={`px-3 py-1.5 text-xs font-bold rounded-full whitespace-nowrap transition-all duration-150 flex items-center gap-1.5 border ${
                pathname.startsWith('/tracker')
                  ? 'bg-indigo-50 border-indigo-200 text-[#3b2fc9] dark:bg-indigo-950/60 dark:border-indigo-800 dark:text-indigo-300 shadow-xs'
                  : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100/80 dark:hover:bg-slate-800/60'
              }`}
            >
              <Receipt className="h-3.5 w-3.5" />
              Cash &amp; Carry
            </Link>
          )}

          {/* Direct Tab 7: Stock Requests (Operator view) */}
          {hasPermission(user, 'stock_request') && !hasPermission(user, 'stock_admin') && (
            <Link
              href="/newrelic/stock-request"
              className={`px-3 py-1.5 text-xs font-bold rounded-full whitespace-nowrap transition-all duration-150 flex items-center gap-1.5 border ${
                pathname === '/newrelic/stock-request' || pathname === '/stock-request'
                  ? 'bg-indigo-50 border-indigo-200 text-[#3b2fc9] dark:bg-indigo-950/60 dark:border-indigo-800 dark:text-indigo-300 shadow-xs'
                  : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100/80 dark:hover:bg-slate-800/60'
              }`}
            >
              <Send className="h-3.5 w-3.5" />
              Request Stock
            </Link>
          )}

          {/* ── Dropdown: Records, HR & Legal ── */}
          {(hasPermission(user, 'invoices') ||
            hasPermission(user, 'quotations') ||
            hasPermission(user, 'general_dc') ||
            hasPermission(user, 'masters') ||
            hasPermission(user, 'hr_docs')) && (
            <DropdownMenu>
              <DropdownMenuTrigger
                className={`px-3 py-1.5 text-xs font-bold rounded-full whitespace-nowrap transition-all duration-150 flex items-center gap-1.5 border outline-none cursor-pointer ${
                  isRecordsAndHrActive
                    ? 'bg-indigo-50 border-indigo-200 text-[#3b2fc9] dark:bg-indigo-950/60 dark:border-indigo-800 dark:text-indigo-300 shadow-xs'
                    : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100/80 dark:hover:bg-slate-800/60'
                }`}
              >
                <Package className="h-3.5 w-3.5" />
                Records, HR &amp; Legal
                <ChevronDown className="h-3.5 w-3.5 opacity-60 ml-0.5" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56 p-1.5">
                {/* ── Section: Records & Masters ── */}
                {(hasPermission(user, 'invoices') || hasPermission(user, 'quotations') || hasPermission(user, 'general_dc') || hasPermission(user, 'masters')) && (
                  <>
                    <DropdownMenuLabel className="text-[11px] font-bold uppercase text-gray-400 px-2 py-1">
                      Records &amp; Masters
                    </DropdownMenuLabel>
                    {hasPermission(user, 'invoices') && role !== 'guest' && (
                      <>
                        <DropdownMenuItem asChild>
                          <Link href="/" className="flex items-center gap-2 cursor-pointer font-medium text-xs">
                            <LayoutDashboard className="h-3.5 w-3.5 text-indigo-600" />
                            Invoice Dashboard &amp; New
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link href="/invoices" className="flex items-center gap-2 cursor-pointer font-medium text-xs">
                            <ListOrdered className="h-3.5 w-3.5 text-blue-600" />
                            Saved Invoices
                          </Link>
                        </DropdownMenuItem>
                      </>
                    )}
                    {hasPermission(user, 'newrelic_dc') && (
                      <DropdownMenuItem asChild>
                        <Link href="/newrelic" prefetch={false} className="flex items-center gap-2 cursor-pointer font-medium text-xs">
                          <FileText className="h-3.5 w-3.5 text-purple-600" />
                          NewRelic DC Hub
                        </Link>
                      </DropdownMenuItem>
                    )}
                    {hasPermission(user, 'general_dc') && (
                      <DropdownMenuItem asChild>
                        <Link href="/delivery-challans" className="flex items-center gap-2 cursor-pointer font-medium text-xs">
                          <Truck className="h-3.5 w-3.5 text-blue-600" />
                          Saved General Challans
                        </Link>
                      </DropdownMenuItem>
                    )}
                    {hasPermission(user, 'quotations') && (
                      <>
                        <DropdownMenuItem asChild>
                          <Link href="/quotations" className="flex items-center gap-2 cursor-pointer font-medium text-xs">
                            <FileSearch className="h-3.5 w-3.5 text-amber-600" />
                            Saved Quotations
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link href="/quotation" className="flex items-center gap-2 cursor-pointer font-medium text-xs">
                            <FilePlus className="h-3.5 w-3.5 text-emerald-600" />
                            New Quotation / Proposal
                          </Link>
                        </DropdownMenuItem>
                      </>
                    )}
                    {hasPermission(user, 'masters') && (
                      <DropdownMenuItem asChild>
                        <Link href="/products" className="flex items-center gap-2 cursor-pointer font-medium text-xs">
                          <Package className="h-3.5 w-3.5 text-purple-600" />
                          Products Master
                        </Link>
                      </DropdownMenuItem>
                    )}
                  </>
                )}

                {/* ── Section: HR & Legal ── */}
                {(hasPermission(user, 'hr_docs') || hasPermission(user, 'masters')) && (
                  <>
                    <DropdownMenuSeparator className="my-1" />
                    <DropdownMenuLabel className="text-[11px] font-bold uppercase text-gray-400 px-2 py-1">
                      HR &amp; Legal
                    </DropdownMenuLabel>
                    {hasPermission(user, 'hr_docs') && (
                      <>
                        <DropdownMenuItem asChild>
                          <Link href="/payslip" className="flex items-center gap-2 cursor-pointer font-medium text-xs">
                            <Receipt className="h-3.5 w-3.5 text-amber-600" />
                            Staff Payslips
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link href="/offer-letter" className="flex items-center gap-2 cursor-pointer font-medium text-xs">
                            <Briefcase className="h-3.5 w-3.5 text-blue-600" />
                            Offer Letters
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link href="/declarations" className="flex items-center gap-2 cursor-pointer font-medium text-xs">
                            <FileText className="h-3.5 w-3.5 text-emerald-600" />
                            GST Declarations (URD)
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link href="/newrelic/leaves" className="flex items-center gap-2 cursor-pointer font-medium text-xs">
                            <CalendarDays className="h-3.5 w-3.5 text-teal-600" />
                            Leaves &amp; Holiday Calendar
                          </Link>
                        </DropdownMenuItem>
                      </>
                    )}
                    {hasPermission(user, 'masters') && (
                      <DropdownMenuItem asChild>
                        <Link href="/clients" className="flex items-center gap-2 cursor-pointer font-medium text-xs">
                          <Users className="h-3.5 w-3.5 text-indigo-600" />
                          Clients Directory
                        </Link>
                      </DropdownMenuItem>
                    )}
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {/* ── Dropdown 3: Admin Tools (Strictly Admin Category) ── */}
          {(isAdmin ||
            hasPermission(user, 'stock_admin') ||
            hasPermission(user, 'tuckshop_reconcile') ||
            hasPermission(user, 'pricing') ||
            hasPermission(user, 'catalog') ||
            hasPermission(user, 'payroll') ||
            hasPermission(user, 'employees') ||
            hasPermission(user, 'analytics') ||
            hasPermission(user, 'users_admin') ||
            hasPermission(user, 'settings')) && (
            <DropdownMenu>
              <DropdownMenuTrigger
                className={`px-3 py-1.5 text-xs font-bold rounded-full whitespace-nowrap transition-all duration-150 flex items-center gap-1.5 border outline-none cursor-pointer ${
                  isAdminActive
                    ? 'bg-indigo-50 border-indigo-200 text-[#3b2fc9] dark:bg-indigo-950/60 dark:border-indigo-800 dark:text-indigo-300 shadow-xs'
                    : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100/80 dark:hover:bg-slate-800/60'
                }`}
              >
                <Settings className="h-3.5 w-3.5" />
                Admin Tools
                {pendingStockCount > 0 && (
                  <span className="bg-red-500 text-white text-[10px] font-black px-1.5 py-0.2 rounded-full min-w-[18px] text-center ml-0.5">
                    {pendingStockCount}
                  </span>
                )}
                <ChevronDown className="h-3.5 w-3.5 opacity-60 ml-0.5" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64 p-1.5">
                <DropdownMenuLabel className="text-[11px] font-bold uppercase text-gray-400 px-2 py-1">
                  Privileged Operations
                </DropdownMenuLabel>
                {hasPermission(user, 'stock_admin') && (
                  <DropdownMenuItem asChild>
                    <Link
                      href="/newrelic/stock-requests-admin"
                      className="flex items-center justify-between cursor-pointer font-medium text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <Send className="h-3.5 w-3.5 text-indigo-600" />
                        Stock Approvals
                      </div>
                      {pendingStockCount > 0 && (
                        <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.2 rounded-full">
                          {pendingStockCount}
                        </span>
                      )}
                    </Link>
                  </DropdownMenuItem>
                )}
                {hasPermission(user, 'tuckshop_reconcile') && (
                  <DropdownMenuItem asChild>
                    <Link href="/newrelic/reconcile" className="flex items-center gap-2 cursor-pointer font-medium text-xs">
                      <FileCheck2 className="h-3.5 w-3.5 text-emerald-600" />
                      Daily Cash Reconcile
                    </Link>
                  </DropdownMenuItem>
                )}
                {isAdmin && (
                  <>
                    <DropdownMenuItem asChild>
                      <Link href="/newrelic/tuckshop/sales" className="flex items-center gap-2 cursor-pointer font-medium text-xs">
                        <Building2 className="h-3.5 w-3.5 text-amber-500" />
                        All Sites Sales (HungerBox)
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href="/newrelic/tuckshop/analytics" className="flex items-center gap-2 cursor-pointer font-medium text-xs">
                        <PieChart className="h-3.5 w-3.5 text-emerald-500" />
                        P&amp;L Executive Analytics
                      </Link>
                    </DropdownMenuItem>
                  </>
                )}
                {hasPermission(user, 'pricing') && (
                  <DropdownMenuItem asChild>
                    <Link href="/newrelic/pricing" className="flex items-center gap-2 cursor-pointer font-medium text-xs">
                      <DollarSign className="h-3.5 w-3.5 text-green-600" />
                      Pricing Matrix
                    </Link>
                  </DropdownMenuItem>
                )}
                {hasPermission(user, 'catalog') && (
                  <DropdownMenuItem asChild>
                    <Link href="/newrelic/catalog" className="flex items-center gap-2 cursor-pointer font-medium text-xs">
                      <PackageCheck className="h-3.5 w-3.5 text-purple-600" />
                      Catalog &amp; Brands
                    </Link>
                  </DropdownMenuItem>
                )}
                {hasPermission(user, 'payroll') && (
                  <DropdownMenuItem asChild>
                    <Link
                      href="/newrelic/attendance?tab=payroll"
                      className="flex items-center gap-2 cursor-pointer font-medium text-xs"
                    >
                      <CreditCard className="h-3.5 w-3.5 text-blue-600" />
                      Salaries &amp; Advances (Payroll)
                    </Link>
                  </DropdownMenuItem>
                )}
                {(hasPermission(user, 'payroll') || hasPermission(user, 'attendance') || hasPermission(user, 'leaves')) && (
                  <DropdownMenuItem asChild>
                    <Link
                      href="/newrelic/leaves"
                      className="flex items-center gap-2 cursor-pointer font-medium text-xs"
                    >
                      <CalendarDays className="h-3.5 w-3.5 text-teal-600" />
                      Leaves &amp; Holiday Calendar
                    </Link>
                  </DropdownMenuItem>
                )}
                {hasPermission(user, 'employees') && (
                  <DropdownMenuItem asChild>
                    <Link href="/newrelic/employees" className="flex items-center gap-2 cursor-pointer font-medium text-xs">
                      <Users className="h-3.5 w-3.5 text-indigo-600" />
                      Employees Directory
                    </Link>
                  </DropdownMenuItem>
                )}
                {hasPermission(user, 'analytics') && (
                  <DropdownMenuItem asChild>
                    <Link href="/newrelic/analytics" className="flex items-center gap-2 cursor-pointer font-medium text-xs">
                      <BarChart2 className="h-3.5 w-3.5 text-cyan-600" />
                      Executive Analytics &amp; P&amp;L
                    </Link>
                  </DropdownMenuItem>
                )}
                {(isAdmin || hasPermission(user, 'users_admin')) && (
                  <>
                    <DropdownMenuSeparator className="my-1" />
                    <DropdownMenuItem asChild>
                      <Link href="/admin/users" className="flex items-center gap-2 cursor-pointer font-medium text-xs">
                        <Shield className="h-3.5 w-3.5 text-[#3b2fc9]" />
                        Access Control &amp; Users
                      </Link>
                    </DropdownMenuItem>
                  </>
                )}
                {(isAdmin || hasPermission(user, 'settings')) && (
                  <DropdownMenuItem asChild>
                    <Link href="/settings" className="flex items-center gap-2 cursor-pointer font-medium text-xs">
                      <Settings className="h-3.5 w-3.5 text-gray-600" />
                      Company Settings
                    </Link>
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      {/* Main Page Content Body */}
      <main className="flex-1 pb-24 sm:pb-8 max-w-full min-w-0">
        {children}
      </main>

      {/* Native Mobile Bottom Navigation Bar */}
      <MobileAppNavigation pendingStockCount={pendingStockCount} />
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  return <AppShellInner>{children}</AppShellInner>;
}
