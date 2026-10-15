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
  CheckCircle,
  FileCheck2,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { triggerHaptic } from '@/lib/haptics';
import { hasPermission } from '@/types/permissions';

export function MobileAppNavigation({ pendingStockCount = 0 }: { pendingStockCount?: number }) {
  const pathname = usePathname();
  const { role, user } = useAuth();
  const [showMoreMenu, setShowMoreMenu] = useState(false);

  const isAdmin = role === 'admin' || role === 'superadmin';

  // Primary bottom tabs determined by permissions
  const navTabs: Array<{
    label: string;
    href: string;
    icon: any;
    badge?: number;
    isActive: boolean;
  }> = [];

  // 1. Dedicated NewRelic DC (strictly only if allowed and site === 'newrelic')
  if (hasPermission(user, 'newrelic_dc')) {
    navTabs.push({
      label: 'NewRelic DC',
      href: '/newrelic',
      icon: FileText,
      isActive: pathname === '/newrelic',
    });
  }

  // 2. Tuckshop Sales & Ledger (Site-scoped)
  if (hasPermission(user, 'tuckshop')) {
    navTabs.push({
      label: 'Tuckshop',
      href: '/newrelic/tuckshop',
      icon: Store,
      isActive: pathname === '/newrelic/tuckshop',
    });
  }

  // 3. Daily Attendance (Site-scoped)
  if (hasPermission(user, 'attendance')) {
    navTabs.push({
      label: 'Attendance',
      href: '/newrelic/attendance',
      icon: CalendarCheck,
      isActive: pathname === '/newrelic/attendance' && !pathname.includes('payroll'),
    });
  }

  // 4. Stock Requests (Admin view vs operator view)
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

  // If user doesn't have NewRelic DC, but has General DC, show General DC on primary bar if space
  if (!hasPermission(user, 'newrelic_dc') && hasPermission(user, 'general_dc') && navTabs.length < 4) {
    navTabs.push({
      label: 'General DC',
      href: '/delivery-challan',
      icon: Truck,
      isActive: pathname.startsWith('/delivery-challan'),
    });
  }

  // Limit primary bar to 4 tabs max so "More" fits comfortably
  const visibleTabs = navTabs.slice(0, 4);

  // Secondary items in "More" sheet
  const moreMenuItems: Array<{
    label: string;
    href: string;
    icon: any;
    desc: string;
  }> = [];

  // General Delivery Challans (for other companies)
  if (hasPermission(user, 'general_dc')) {
    moreMenuItems.push({
      label: 'General Delivery Challan',
      href: '/delivery-challan',
      icon: Truck,
      desc: 'Universal challans for HungerBox & corporate clients',
    });
  }

  // Tuckshop Daily Reconciliation (Admin / Manager)
  if (hasPermission(user, 'tuckshop_reconcile')) {
    moreMenuItems.push({
      label: 'Daily Cash Reconciliation',
      href: '/newrelic/reconcile',
      icon: FileCheck2,
      desc: 'Verify POS, cash, UPI vs counter sales',
    });
  }

  // Pricing Matrix (Admin category)
  if (hasPermission(user, 'pricing')) {
    moreMenuItems.push({
      label: 'Pricing Matrix',
      href: '/newrelic/pricing',
      icon: DollarSign,
      desc: 'Vendor P.Cost, MRP & batch updates',
    });
  }

  // Catalog & Brands (Admin category)
  if (hasPermission(user, 'catalog')) {
    moreMenuItems.push({
      label: 'Catalog & Brands',
      href: '/newrelic/catalog',
      icon: PackageCheck,
      desc: 'Master product catalog and brand registry',
    });
  }

  // Salaries & Advances (Payroll - Admin category)
  if (hasPermission(user, 'payroll')) {
    moreMenuItems.push({
      label: 'Salaries & Advances (Payroll)',
      href: '/newrelic/attendance?tab=payroll',
      icon: CreditCard,
      desc: 'Attendance-based payroll and wage calculations',
    });
  }

  // Employees Directory (Admin category)
  if (hasPermission(user, 'employees')) {
    moreMenuItems.push({
      label: 'Employee Directory',
      href: '/newrelic/employees',
      icon: Users,
      desc: 'Staff profiles, wage settings, bank accounts',
    });
  }

  // Executive Analytics (Admin category)
  if (hasPermission(user, 'analytics')) {
    moreMenuItems.push({
      label: 'Executive Analytics & P&L',
      href: '/newrelic/analytics',
      icon: BarChart3,
      desc: 'Multi-site profitability, revenue breakdown, trends',
    });
  }

  // Billing & Invoices
  if (hasPermission(user, 'billing')) {
    moreMenuItems.push({
      label: 'Invoices & Quotations',
      href: '/invoices',
      icon: FileText,
      desc: 'Generate client tax invoices and estimates',
    });
  }

  // User Management (Admin category)
  if (hasPermission(user, 'users_admin')) {
    moreMenuItems.push({
      label: 'Access Control & Users',
      href: '/admin/users',
      icon: Settings,
      desc: 'User logins, roles, landing pages & tabs',
    });
  }

  // Company Settings (Admin category)
  if (hasPermission(user, 'settings')) {
    moreMenuItems.push({
      label: 'Company Settings',
      href: '/settings',
      icon: Settings,
      desc: 'Company legal profiles, GSTINs, bank accounts',
    });
  }

  const isMoreActive = moreMenuItems.some((item) => {
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
            {moreMenuItems.length > 0 && (
              <button
                onClick={() => {
                  triggerHaptic('light');
                  setShowMoreMenu(true);
                }}
                className="flex-1 flex flex-col items-center justify-center py-1 transition-all active:scale-90 group"
              >
                <div
                  className={`px-3.5 py-1.5 rounded-full transition-all flex items-center justify-center ${
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

      {/* ── Native Mobile Action Sheet / Drawer for "More" ── */}
      {showMoreMenu && (
        <div className="sm:hidden fixed inset-0 z-50 flex flex-col justify-end">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-xs transition-opacity animate-in fade-in"
            onClick={() => setShowMoreMenu(false)}
          />

          {/* Sheet Container */}
          <div className="relative bg-white rounded-t-3xl max-h-[82vh] overflow-y-auto p-5 pb-9 shadow-2xl space-y-4 animate-in slide-in-from-bottom duration-200">
            {/* Sheet Handle */}
            <div className="w-12 h-1.5 bg-gray-300 rounded-full mx-auto" />

            <div className="flex items-center justify-between pt-1">
              <div>
                <h3 className="text-base font-bold text-gray-900">All Modules & Tools</h3>
                <p className="text-xs text-gray-500">Accessible tools based on your role permissions</p>
              </div>
              <button
                onClick={() => setShowMoreMenu(false)}
                className="p-1.5 rounded-full hover:bg-gray-100 text-gray-400 active:scale-95"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 gap-2 pt-1">
              {moreMenuItems.map((item) => {
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
                    className={`flex items-center gap-3.5 p-3 rounded-2xl border transition-all active:scale-98 ${
                      isSelected
                        ? 'border-[#3b2fc9]/40 bg-[#3b2fc9]/5 text-[#3b2fc9] shadow-2xs'
                        : 'border-gray-100 bg-gray-50/70 hover:bg-gray-100 text-gray-800'
                    }`}
                  >
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-xs shrink-0 ${
                        isSelected
                          ? 'bg-[#3b2fc9] text-white'
                          : 'bg-white border border-gray-100 text-[#3b2fc9]'
                      }`}
                    >
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold truncate">{item.label}</p>
                      <p className="text-xs text-gray-400 truncate mt-0.5">{item.desc}</p>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
