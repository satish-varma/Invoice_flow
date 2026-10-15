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
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { FinancialAuthProvider, useFinancialAuth } from '@/contexts/FinancialAuthContext';
import { FinancialPasswordModal } from '@/components/newrelic/financial-password-modal';
import { MobileAppNavigation } from '@/components/newrelic/mobile-app-navigation';
import { MobileAppBar } from '@/components/newrelic/mobile-app-bar';
import { NetworkStatusIndicator } from '@/components/newrelic/network-status-indicator';
import { getStockRequests } from '@/services/newrelicStockRequestService';
import { COMPANY_SITES } from '@/types/site';
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

function AppShellInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, role, signOut } = useAuth();
  const [pendingStockCount, setPendingStockCount] = useState(0);

  const isAdmin = role === 'admin' || role === 'superadmin';
  const site = user?.assignedSite || 'newrelic';
  const siteConfig = COMPANY_SITES[site] || COMPANY_SITES.newrelic;

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
  const isRecordsActive =
    pathname === '/invoices' ||
    pathname === '/delivery-challans' ||
    pathname === '/quotations' ||
    pathname === '/quotation' ||
    pathname === '/products';

  const isHrActive =
    pathname === '/payslip' ||
    pathname === '/offer-letter' ||
    pathname === '/declarations' ||
    pathname === '/clients';

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
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Network offline/restored indicator */}
      <NetworkStatusIndicator />

      {/* Mobile Top App Bar (sm:hidden) */}
      <div className="sm:hidden">
        <MobileAppBar>
          {isAdmin && <FinancialStatusBadge />}
        </MobileAppBar>
      </div>

      {/* Desktop Top Header (hidden sm:block) */}
      <header className="hidden sm:block border-b border-gray-100 bg-white sticky top-0 z-30 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-8 h-14 flex items-center justify-between gap-3">
          {/* Brand & Site Scoping */}
          <div className="flex items-center gap-3 shrink-0">
            <Link
              href="/"
              onClick={() => triggerHaptic('light')}
              className="flex items-center gap-2.5 hover:opacity-90 transition-opacity"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/gut_guru_logo.png"
                alt="The Gut Guru Tracker"
                className="h-8 sm:h-9 w-8 sm:w-9 rounded-full object-contain shadow-xs border border-amber-900/10"
              />
              <span className="text-base font-black tracking-tight text-gray-900">
                The Gut Guru Tracker
              </span>
            </Link>

            <span className="text-gray-300 font-light">|</span>

            {/* Site Indicator Badge */}
            {isAdmin ? (
              <span className="text-xs text-gray-600 bg-gray-50 border border-gray-200 rounded-full px-3 py-1 font-semibold flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
                Multi-Site Operations (HYD &amp; BLR)
              </span>
            ) : (
              <span
                className={`text-xs px-3 py-1 rounded-full font-bold uppercase tracking-wider border flex items-center gap-1.5 ${
                  site === 'dsm'
                    ? 'bg-cyan-50 text-cyan-800 border-cyan-200'
                    : site === 'ntt_data'
                    ? 'bg-amber-50 text-amber-800 border-amber-200'
                    : 'bg-indigo-50 text-[#3b2fc9] border-indigo-200'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                📍 {siteConfig.name} Stall
              </span>
            )}
          </div>

          {/* Right Action Items */}
          <div className="flex items-center gap-3">
            {isAdmin && <FinancialStatusBadge />}

            {isAdmin && (
              <Link
                href="/admin/users"
                className="flex items-center gap-1.5 text-xs font-semibold text-gray-600 hover:text-[#3b2fc9] bg-gray-50 hover:bg-indigo-50 border border-gray-200 hover:border-indigo-200 px-3 py-1.5 rounded-full transition-colors"
              >
                <Shield className="h-3.5 w-3.5 text-[#3b2fc9]" />
                Access &amp; Users
              </Link>
            )}

            <div className="flex flex-col items-end mr-1 text-right">
              <span className="text-xs font-bold text-gray-800 truncate max-w-[170px]">
                {user?.email}
              </span>
              <span className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">
                {role || 'User'}
              </span>
            </div>

            <button
              onClick={signOut}
              className="p-1.5 text-gray-400 hover:text-red-600 transition-colors rounded-lg hover:bg-red-50"
              title="Sign out from device"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Desktop Secondary Navigation Bar with Categorized Dropdowns */}
      <div className="hidden sm:block bg-white border-b border-gray-200 sticky top-14 z-20 shadow-2xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-8 flex items-center gap-2 overflow-x-auto">
          {/* Direct Tab 1: Tuckshop (Counter sales & ledger for assigned site) */}
          {hasPermission(user, 'tuckshop') && (
            <Link
              href="/newrelic/tuckshop"
              className={`py-3 px-3 text-sm font-bold border-b-2 whitespace-nowrap transition-colors flex items-center gap-1.5 ${
                pathname.startsWith('/newrelic/tuckshop') || pathname === '/tuckshop'
                  ? 'border-[#3b2fc9] text-[#3b2fc9]'
                  : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
              }`}
            >
              <Store className="h-4 w-4" />
              Tuckshop
            </Link>
          )}

          {/* Direct Tab 2: Attendance (Daily check-in/out for assigned site) */}
          {hasPermission(user, 'attendance') && (
            <Link
              href="/newrelic/attendance"
              className={`py-3 px-3 text-sm font-bold border-b-2 whitespace-nowrap transition-colors flex items-center gap-1.5 ${
                (pathname.startsWith('/newrelic/attendance') || pathname === '/attendance') &&
                !pathname.includes('payroll')
                  ? 'border-[#3b2fc9] text-[#3b2fc9]'
                  : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
              }`}
            >
              <CalendarCheck className="h-4 w-4" />
              Attendance
            </Link>
          )}

          {/* Direct Tab 3: Dedicated NewRelic DC Hub (strictly NewRelic cafeteria) */}
          {hasPermission(user, 'newrelic_dc') && (
            <Link
              href="/newrelic"
              className={`py-3 px-3 text-sm font-bold border-b-2 whitespace-nowrap transition-colors flex items-center gap-1.5 ${
                pathname === '/newrelic'
                  ? 'border-[#3b2fc9] text-[#3b2fc9]'
                  : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
              }`}
            >
              <FileText className="h-4 w-4" />
              NewRelic DC
            </Link>
          )}

          {/* Direct Tab 4: General DC (Universal delivery challan for other companies) */}
          {hasPermission(user, 'general_dc') && (
            <Link
              href="/delivery-challan"
              className={`py-3 px-3 text-sm font-bold border-b-2 whitespace-nowrap transition-colors flex items-center gap-1.5 ${
                pathname === '/delivery-challan'
                  ? 'border-[#3b2fc9] text-[#3b2fc9]'
                  : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
              }`}
            >
              <Truck className="h-4 w-4" />
              General DC
            </Link>
          )}

          {/* Direct Tab 5: Invoicing & Billing (Dashboard, Creator & Overview) */}
          {hasPermission(user, 'billing') && (
            <Link
              href="/"
              className={`py-3 px-3 text-sm font-bold border-b-2 whitespace-nowrap transition-colors flex items-center gap-1.5 ${
                pathname === '/'
                  ? 'border-[#3b2fc9] text-[#3b2fc9]'
                  : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
              }`}
            >
              <LayoutDashboard className="h-4 w-4" />
              Invoices &amp; Dashboard
            </Link>
          )}

          {/* Direct Tab 6: Stock Requests (Operator view) */}
          {hasPermission(user, 'stock_request') && !hasPermission(user, 'stock_admin') && (
            <Link
              href="/newrelic/stock-request"
              className={`py-3 px-3 text-sm font-bold border-b-2 whitespace-nowrap transition-colors flex items-center gap-1.5 ${
                pathname === '/newrelic/stock-request' || pathname === '/stock-request'
                  ? 'border-[#3b2fc9] text-[#3b2fc9]'
                  : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
              }`}
            >
              <Send className="h-4 w-4" />
              Request Stock
            </Link>
          )}

          {/* ── Dropdown 1: Records & Masters ── */}
          {(hasPermission(user, 'billing') || hasPermission(user, 'general_dc') || hasPermission(user, 'masters')) && (
            <DropdownMenu>
              <DropdownMenuTrigger
                className={`py-3 px-3 text-sm font-bold border-b-2 whitespace-nowrap transition-colors flex items-center gap-1.5 outline-none cursor-pointer ${
                  isRecordsActive
                    ? 'border-[#3b2fc9] text-[#3b2fc9]'
                    : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
                }`}
              >
                <Package className="h-4 w-4" />
                Records &amp; Masters
                <ChevronDown className="h-3.5 w-3.5 opacity-60 ml-0.5" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56 p-1.5">
                <DropdownMenuLabel className="text-[11px] font-bold uppercase text-gray-400 px-2 py-1">
                  Master Records
                </DropdownMenuLabel>
                {hasPermission(user, 'billing') && (
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
                {hasPermission(user, 'general_dc') && (
                  <DropdownMenuItem asChild>
                    <Link href="/delivery-challans" className="flex items-center gap-2 cursor-pointer font-medium text-xs">
                      <Truck className="h-3.5 w-3.5 text-blue-600" />
                      Saved General Challans
                    </Link>
                  </DropdownMenuItem>
                )}
                {hasPermission(user, 'billing') && (
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
                  <>
                    <DropdownMenuSeparator className="my-1" />
                    <DropdownMenuItem asChild>
                      <Link href="/products" className="flex items-center gap-2 cursor-pointer font-medium text-xs">
                        <Package className="h-3.5 w-3.5 text-purple-600" />
                        Products Master
                      </Link>
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {/* ── Dropdown 2: HR & Legal (Rarely Used Documents) ── */}
          {(hasPermission(user, 'hr_docs') || hasPermission(user, 'masters')) && (
            <DropdownMenu>
              <DropdownMenuTrigger
                className={`py-3 px-3 text-sm font-bold border-b-2 whitespace-nowrap transition-colors flex items-center gap-1.5 outline-none cursor-pointer ${
                  isHrActive
                    ? 'border-[#3b2fc9] text-[#3b2fc9]'
                    : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
                }`}
              >
                <Briefcase className="h-4 w-4" />
                HR &amp; Legal
                <ChevronDown className="h-3.5 w-3.5 opacity-60 ml-0.5" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56 p-1.5">
                <DropdownMenuLabel className="text-[11px] font-bold uppercase text-gray-400 px-2 py-1">
                  HR &amp; Compliance Documents
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
                  </>
                )}
                {hasPermission(user, 'masters') && (
                  <>
                    <DropdownMenuSeparator className="my-1" />
                    <DropdownMenuItem asChild>
                      <Link href="/clients" className="flex items-center gap-2 cursor-pointer font-medium text-xs">
                        <Users className="h-3.5 w-3.5 text-indigo-600" />
                        Clients Directory
                      </Link>
                    </DropdownMenuItem>
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
                className={`py-3 px-3 text-sm font-bold border-b-2 whitespace-nowrap transition-colors flex items-center gap-1.5 outline-none cursor-pointer ${
                  isAdminActive
                    ? 'border-[#3b2fc9] text-[#3b2fc9]'
                    : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
                }`}
              >
                <Settings className="h-4 w-4" />
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
      <main className="flex-1 pb-24 sm:pb-8 max-w-full overflow-x-hidden min-w-0">
        {children}
      </main>

      {/* Native Mobile Bottom Navigation Bar */}
      <MobileAppNavigation pendingStockCount={pendingStockCount} />
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <FinancialAuthProvider>
      <AppShellInner>{children}</AppShellInner>
    </FinancialAuthProvider>
  );
}
