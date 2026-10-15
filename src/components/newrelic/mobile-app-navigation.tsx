'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  FileText,
  Store,
  CalendarCheck,
  BarChart3,
  MoreHorizontal,
  DollarSign,
  PackageCheck,
  Users,
  Settings,
  X,
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
  ChevronRight,
  Shield,
  FilePlus,
  LayoutDashboard,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { triggerHaptic } from '@/lib/haptics';
import { hasPermission } from '@/types/permissions';

export function MobileAppNavigation({ pendingStockCount = 0 }: { pendingStockCount?: number }) {
  const pathname = usePathname();
  const { role, user } = useAuth();
  const [showMoreMenu, setShowMoreMenu] = useState(false);

  const isAdmin = role === 'admin' || role === 'superadmin';

  // Primary bottom tabs (Tailored to role, max 4 tabs + More)
  const navTabs: Array<{
    label: string;
    href: string;
    icon: any;
    badge?: number;
    isActive: boolean;
  }> = [];

  // 1. Tuckshop (if permitted)
  if (hasPermission(user, 'tuckshop')) {
    navTabs.push({
      label: 'Tuckshop',
      href: '/newrelic/tuckshop',
      icon: Store,
      isActive: pathname.startsWith('/newrelic/tuckshop') || pathname === '/tuckshop',
    });
  }

  // 2. Attendance (if permitted)
  if (hasPermission(user, 'attendance')) {
    navTabs.push({
      label: 'Attendance',
      href: '/newrelic/attendance',
      icon: CalendarCheck,
      isActive:
        (pathname.startsWith('/newrelic/attendance') || pathname === '/attendance') &&
        !pathname.includes('payroll'),
    });
  }

  // 3. NewRelic DC (Strictly if permitted and site is newrelic)
  if (hasPermission(user, 'newrelic_dc')) {
    navTabs.push({
      label: 'NewRelic DC',
      href: '/newrelic',
      icon: FileText,
      isActive: pathname === '/newrelic',
    });
  }

  // 4. General DC (Universal DC for other companies)
  if (hasPermission(user, 'general_dc')) {
    navTabs.push({
      label: 'General DC',
      href: '/delivery-challan',
      icon: Truck,
      isActive: pathname.startsWith('/delivery-challan'),
    });
  }

  // 5. Invoices & Dashboard (If user has billing and space available)
  if (hasPermission(user, 'billing') && navTabs.length < 4) {
    navTabs.push({
      label: 'Invoices',
      href: '/',
      icon: LayoutDashboard,
      isActive: pathname === '/',
    });
  }

  // 6. Stock Requests (if permitted and space available)
  if (navTabs.length < 4) {
    if (hasPermission(user, 'stock_admin')) {
      navTabs.push({
        label: 'Stock Admin',
        href: '/newrelic/stock-requests-admin',
        icon: Send,
        badge: pendingStockCount > 0 ? pendingStockCount : undefined,
        isActive: pathname === '/newrelic/stock-requests-admin',
      });
    } else if (hasPermission(user, 'stock_request')) {
      navTabs.push({
        label: 'Stock Req',
        href: '/newrelic/stock-request',
        icon: Send,
        isActive: pathname === '/newrelic/stock-request',
      });
    }
  }

  // Limit primary bar to 4 tabs max so "More" is the 5th
  const visibleTabs = navTabs.slice(0, 4);

  // Grouped items for "More" Action Drawer
  // Group 1: Records & Masters
  const recordsItems: Array<{ label: string; href: string; icon: any; desc: string }> = [];
  if (hasPermission(user, 'billing')) {
    recordsItems.push({
      label: 'Invoice Dashboard & New',
      href: '/',
      icon: LayoutDashboard,
      desc: 'Create invoices, revenue charts & billing metrics',
    });
    recordsItems.push({
      label: 'Saved Invoices',
      href: '/invoices',
      icon: ListOrdered,
      desc: 'All tax invoices and client billing history',
    });
  }
  if (hasPermission(user, 'newrelic_dc')) {
    recordsItems.push({
      label: 'NewRelic DC Hub',
      href: '/newrelic',
      icon: FileText,
      desc: 'Bangalore & Hyderabad cafeteria dispatches',
    });
  }
  if (hasPermission(user, 'general_dc')) {
    recordsItems.push({
      label: 'Saved General Challans',
      href: '/delivery-challans',
      icon: Truck,
      desc: 'Dispatches for HungerBox & other clients',
    });
  }
  if (hasPermission(user, 'billing')) {
    recordsItems.push({
      label: 'Saved Quotations',
      href: '/quotations',
      icon: FileSearch,
      desc: 'Past estimates, proposals and quotes',
    });
    recordsItems.push({
      label: 'New Quotation / Proposal',
      href: '/quotation',
      icon: FilePlus,
      desc: 'Create and export a new client quote',
    });
  }
  if (hasPermission(user, 'masters')) {
    recordsItems.push({
      label: 'Products Master',
      href: '/products',
      icon: Package,
      desc: 'Manage master items catalog and HSN codes',
    });
  }

  // Group 2: HR & Legal (Rarely Used)
  const hrItems: Array<{ label: string; href: string; icon: any; desc: string }> = [];
  if (hasPermission(user, 'hr_docs')) {
    hrItems.push({
      label: 'Staff Payslips',
      href: '/payslip',
      icon: Receipt,
      desc: 'Generate monthly employee pay slips',
    });
    hrItems.push({
      label: 'Offer Letters',
      href: '/offer-letter',
      icon: Briefcase,
      desc: 'Draft employment letters & appointment records',
    });
    hrItems.push({
      label: 'GST Declarations',
      href: '/declarations',
      icon: FileText,
      desc: 'Generate URD GST declaration letterheads',
    });
  }
  if (hasPermission(user, 'masters')) {
    hrItems.push({
      label: 'Clients Directory',
      href: '/clients',
      icon: Users,
      desc: 'Customer addresses, GST numbers and contacts',
    });
  }

  // Group 3: Admin Category
  const adminItems: Array<{ label: string; href: string; icon: any; desc: string; badge?: number }> = [];
  if (hasPermission(user, 'stock_admin')) {
    adminItems.push({
      label: 'Stock Requests Approvals',
      href: '/newrelic/stock-requests-admin',
      icon: Send,
      desc: 'Review, fulfill and budget inventory requests',
      badge: pendingStockCount > 0 ? pendingStockCount : undefined,
    });
  }
  if (hasPermission(user, 'tuckshop_reconcile')) {
    adminItems.push({
      label: 'Daily Cash Reconciliation',
      href: '/newrelic/reconcile',
      icon: FileCheck2,
      desc: 'Verify POS, cash, UPI vs counter sales',
    });
  }
  if (hasPermission(user, 'pricing')) {
    adminItems.push({
      label: 'Pricing Matrix',
      href: '/newrelic/pricing',
      icon: DollarSign,
      desc: 'MRP, purchase cost, and selling price matrices',
    });
  }
  if (hasPermission(user, 'catalog')) {
    adminItems.push({
      label: 'Catalog & Brands',
      href: '/newrelic/catalog',
      icon: PackageCheck,
      desc: 'Master product item list and brand tags',
    });
  }
  if (hasPermission(user, 'payroll')) {
    adminItems.push({
      label: 'Salaries & Advances (Payroll)',
      href: '/newrelic/attendance?tab=payroll',
      icon: CreditCard,
      desc: 'Attendance-based payroll and monthly payouts',
    });
  }
  if (hasPermission(user, 'employees')) {
    adminItems.push({
      label: 'Employee Directory',
      href: '/newrelic/employees',
      icon: Users,
      desc: 'Staff profiles, daily wages, bank details',
    });
  }
  if (hasPermission(user, 'analytics')) {
    adminItems.push({
      label: 'Executive Analytics & P&L',
      href: '/newrelic/analytics',
      icon: BarChart3,
      desc: 'High-level multi-site revenue and margins',
    });
  }
  if (hasPermission(user, 'users_admin')) {
    adminItems.push({
      label: 'Access Control & Users',
      href: '/admin/users',
      icon: Shield,
      desc: 'User logins, roles, landing pages & tabs',
    });
  }
  if (hasPermission(user, 'settings')) {
    adminItems.push({
      label: 'Company Settings',
      href: '/settings',
      icon: Settings,
      desc: 'Company legal profiles, GSTINs, bank accounts',
    });
  }

  const allMoreItems = [...recordsItems, ...hrItems, ...adminItems];
  const isMoreActive = allMoreItems.some((item) => {
    if (item.href.includes('?')) {
      const base = item.href.split('?')[0];
      return pathname.startsWith(base);
    }
    return pathname === item.href;
  });

  return (
    <>
      {/* ── Floating Glassmorphic Bottom Navigation Bar ── */}
      <div className="sm:hidden fixed bottom-0 left-0 right-0 z-40 px-3 pb-[max(0.5rem,env(safe-area-inset-bottom))] pointer-events-none">
        <nav className="pointer-events-auto bg-white/95 backdrop-blur-xl border border-gray-200/80 shadow-[0_12px_36px_-6px_rgba(15,23,42,0.18)] rounded-2xl overflow-hidden ring-1 ring-black/5">
          <div className="flex items-center justify-around h-16 px-1.5 py-1">
            {visibleTabs.map((tab) => {
              const Icon = tab.icon;
              const active = tab.isActive;
              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  onClick={() => triggerHaptic('light')}
                  className="flex-1 flex flex-col items-center justify-center py-1 transition-all active:scale-90 group"
                >
                  <div className="relative">
                    <div
                      className={`px-3.5 py-1.5 rounded-full transition-all flex items-center justify-center ${
                        active
                          ? 'bg-gradient-to-r from-indigo-500/15 via-[#3b2fc9]/15 to-purple-500/15 text-[#3b2fc9] shadow-2xs border border-[#3b2fc9]/20'
                          : 'text-gray-400 group-hover:text-gray-600'
                      }`}
                    >
                      <Icon
                        className={`w-5 h-5 transition-transform ${
                          active ? 'scale-110 stroke-[2.4] text-[#3b2fc9]' : 'stroke-[1.8]'
                        }`}
                      />
                    </div>
                    {tab.badge !== undefined && (
                      <span className="absolute -top-1 -right-1 bg-rose-500 text-white text-[10px] font-black rounded-full h-4 w-4 flex items-center justify-center shadow-xs ring-2 ring-white animate-pulse">
                        {tab.badge}
                      </span>
                    )}
                  </div>
                  <span
                    className={`text-[10px] mt-0.5 tracking-tight transition-all ${
                      active ? 'font-black text-[#3b2fc9] scale-105' : 'font-semibold text-gray-500'
                    }`}
                  >
                    {tab.label}
                  </span>
                </Link>
              );
            })}

            {/* "More" Sheet Trigger */}
            {allMoreItems.length > 0 && (
              <button
                onClick={() => {
                  triggerHaptic('light');
                  setShowMoreMenu(true);
                }}
                className="flex-1 flex flex-col items-center justify-center py-1 transition-all active:scale-90 group"
              >
                <div
                  className={`px-3.5 py-1.5 rounded-full transition-all flex items-center justify-center relative ${
                    showMoreMenu || isMoreActive
                      ? 'bg-gradient-to-r from-indigo-500/15 via-[#3b2fc9]/15 to-purple-500/15 text-[#3b2fc9] shadow-2xs border border-[#3b2fc9]/20'
                      : 'text-gray-400 group-hover:text-gray-600'
                  }`}
                >
                  <MoreHorizontal
                    className={`w-5 h-5 transition-transform ${
                      showMoreMenu || isMoreActive
                        ? 'scale-110 stroke-[2.4] text-[#3b2fc9]'
                        : 'stroke-[1.8]'
                    }`}
                  />
                  {pendingStockCount > 0 && isAdmin && (
                    <span className="absolute -top-1 -right-1 bg-rose-500 text-white text-[9px] font-black rounded-full h-3.5 w-3.5 flex items-center justify-center shadow-xs">
                      {pendingStockCount}
                    </span>
                  )}
                </div>
                <span
                  className={`text-[10px] mt-0.5 tracking-tight transition-all ${
                    showMoreMenu || isMoreActive
                      ? 'font-black text-[#3b2fc9] scale-105'
                      : 'font-semibold text-gray-500'
                  }`}
                >
                  More
                </span>
              </button>
            )}
          </div>
        </nav>
      </div>

      {/* ── Categorized Native Mobile Action Sheet / Drawer for "More" ── */}
      {showMoreMenu && (
        <div className="sm:hidden fixed inset-0 z-50 flex flex-col justify-end">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-xs transition-opacity animate-in fade-in"
            onClick={() => setShowMoreMenu(false)}
          />

          {/* Sheet Container */}
          <div className="relative bg-white rounded-t-3xl max-h-[85vh] overflow-y-auto p-5 pb-9 shadow-2xl space-y-5 animate-in slide-in-from-bottom duration-200">
            {/* Sheet Handle */}
            <div className="w-12 h-1.5 bg-gray-300 rounded-full mx-auto" />

            <div className="flex items-center justify-between pt-1">
              <div>
                <h3 className="text-base font-black text-gray-900 tracking-tight">Modules & Tools</h3>
                <p className="text-xs text-gray-500">Categorized navigation across all systems</p>
              </div>
              <button
                onClick={() => setShowMoreMenu(false)}
                className="p-1.5 rounded-full hover:bg-gray-100 text-gray-400 active:scale-95"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Section 1: Records & Masters */}
            {recordsItems.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-1.5 px-1">
                  <Package className="w-3.5 h-3.5 text-indigo-600" />
                  <span className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                    Records & Masters
                  </span>
                </div>
                <div className="grid grid-cols-1 gap-2">
                  {recordsItems.map((item) => {
                    const Icon = item.icon;
                    const isSelected = pathname === item.href;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => {
                          triggerHaptic('light');
                          setShowMoreMenu(false);
                        }}
                        className={`flex items-center gap-3 p-2.5 rounded-xl border transition-all active:scale-98 ${
                          isSelected
                            ? 'border-[#3b2fc9]/40 bg-[#3b2fc9]/5 text-[#3b2fc9]'
                            : 'border-gray-150 bg-gray-50/80 hover:bg-gray-100 text-gray-800'
                        }`}
                      >
                        <div
                          className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 shadow-2xs ${
                            isSelected ? 'bg-[#3b2fc9] text-white' : 'bg-white border border-gray-100 text-[#3b2fc9]'
                          }`}
                        >
                          <Icon className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold truncate">{item.label}</p>
                          <p className="text-[11px] text-gray-500 truncate">{item.desc}</p>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Section 2: HR & Documents (Rarely Used) */}
            {hrItems.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-1.5 px-1">
                  <Briefcase className="w-3.5 h-3.5 text-amber-600" />
                  <span className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                    HR & Legal Documents
                  </span>
                </div>
                <div className="grid grid-cols-1 gap-2">
                  {hrItems.map((item) => {
                    const Icon = item.icon;
                    const isSelected = pathname === item.href;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => {
                          triggerHaptic('light');
                          setShowMoreMenu(false);
                        }}
                        className={`flex items-center gap-3 p-2.5 rounded-xl border transition-all active:scale-98 ${
                          isSelected
                            ? 'border-[#3b2fc9]/40 bg-[#3b2fc9]/5 text-[#3b2fc9]'
                            : 'border-gray-150 bg-gray-50/80 hover:bg-gray-100 text-gray-800'
                        }`}
                      >
                        <div
                          className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 shadow-2xs ${
                            isSelected ? 'bg-[#3b2fc9] text-white' : 'bg-white border border-gray-100 text-amber-600'
                          }`}
                        >
                          <Icon className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold truncate">{item.label}</p>
                          <p className="text-[11px] text-gray-500 truncate">{item.desc}</p>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Section 3: Administration & Settings (Admin Category) */}
            {adminItems.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-1.5 px-1">
                  <Settings className="w-3.5 h-3.5 text-rose-600" />
                  <span className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                    Admin Category
                  </span>
                </div>
                <div className="grid grid-cols-1 gap-2">
                  {adminItems.map((item) => {
                    const Icon = item.icon;
                    const isSelected =
                      pathname === item.href ||
                      (item.href.includes('?') && pathname.includes(item.href.split('?')[0]));
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => {
                          triggerHaptic('light');
                          setShowMoreMenu(false);
                        }}
                        className={`flex items-center gap-3 p-2.5 rounded-xl border transition-all active:scale-98 ${
                          isSelected
                            ? 'border-[#3b2fc9]/40 bg-[#3b2fc9]/5 text-[#3b2fc9]'
                            : 'border-gray-150 bg-gray-50/80 hover:bg-gray-100 text-gray-800'
                        }`}
                      >
                        <div
                          className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 shadow-2xs ${
                            isSelected ? 'bg-[#3b2fc9] text-white' : 'bg-white border border-gray-100 text-rose-600'
                          }`}
                        >
                          <Icon className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className="text-xs font-bold truncate">{item.label}</p>
                            {item.badge !== undefined && (
                              <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.2 rounded-full">
                                {item.badge}
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-gray-500 truncate">{item.desc}</p>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
