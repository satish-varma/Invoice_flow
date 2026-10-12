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
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { triggerHaptic } from '@/lib/haptics';

export function MobileAppNavigation({ pendingStockCount = 0 }: { pendingStockCount?: number }) {
  const pathname = usePathname();
  const { role } = useAuth();
  const [showMoreMenu, setShowMoreMenu] = useState(false);

  const isAdmin = role === 'admin' || role === 'superadmin';

  // Primary 4 tabs on the bottom bar
  const navTabs = [
    {
      label: 'Challans',
      href: '/newrelic',
      icon: FileText,
      isActive: pathname === '/newrelic',
    },
    {
      label: 'Attendance',
      href: '/newrelic/attendance',
      icon: CalendarCheck,
      isActive: pathname === '/newrelic/attendance' && !pathname.includes('payroll'),
    },
    {
      label: 'Tuckshop',
      href: '/newrelic/tuckshop',
      icon: Store,
      isActive: pathname === '/newrelic/tuckshop',
    },
    {
      label: 'Stock Req',
      href: isAdmin ? '/newrelic/stock-requests-admin' : '/newrelic/stock-request',
      icon: Send,
      badge: isAdmin && pendingStockCount > 0 ? pendingStockCount : undefined,
      isActive: pathname.includes('stock-request'),
    },
  ];

  // Secondary items accessible via "More" sheet
  const moreMenuItems = [
    ...(isAdmin
      ? [
          {
            label: 'Executive Insights & P&L',
            href: '/newrelic/analytics',
            icon: BarChart3,
            desc: 'Cross-location ledger, spend vs revenue',
          },
          {
            label: 'Staff Salaries & Advances',
            href: '/newrelic/attendance?tab=payroll',
            icon: CreditCard,
            desc: 'Attendance-based payroll calculations',
          },
          {
            label: 'Pricing & Margins',
            href: '/newrelic/pricing',
            icon: DollarSign,
            desc: 'Vendor P.Cost, MRP & batch updates',
          },
          {
            label: 'Catalog & Brands',
            href: '/newrelic/catalog',
            icon: PackageCheck,
            desc: 'Master product item list',
          },
          {
            label: 'Employees Directory',
            href: '/newrelic/employees',
            icon: Users,
            desc: 'Manage staff, locations, daily wages',
          },
          {
            label: 'User Management',
            href: '/admin/users',
            icon: Settings,
            desc: 'User roles, portal access',
          },
        ]
      : [
          {
            label: 'Stock Requests',
            href: '/newrelic/stock-request',
            icon: Send,
            desc: 'Request cafeteria replenishment',
          },
        ]),
  ];

  const isMoreActive = moreMenuItems.some((item) => {
    if (item.href.includes('?')) {
      const base = item.href.split('?')[0];
      return pathname.startsWith(base);
    }
    return pathname === item.href;
  });

  return (
    <>
      {/* ── Fixed Native Bottom Navigation Bar ── */}
      <nav className="sm:hidden fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-gray-200/80 z-40 safe-bottom shadow-lg">
        <div className="flex items-center justify-around h-16 px-1">
          {navTabs.map((tab) => {
            const Icon = tab.icon;
            const active = tab.isActive;
            return (
              <Link
                key={tab.href}
                href={tab.href}
                onClick={() => triggerHaptic('light')}
                className="flex-1 flex flex-col items-center justify-center py-1 transition-all active:scale-95 group"
              >
                <div className="relative">
                  <div
                    className={`px-3.5 py-1 rounded-full transition-all flex items-center justify-center ${
                      active
                        ? 'bg-indigo-100/80 text-[#3b2fc9]'
                        : 'text-gray-400 group-hover:text-gray-600'
                    }`}
                  >
                    <Icon className={`w-5 h-5 transition-transform ${active ? 'scale-105 stroke-[2.3]' : 'stroke-[1.8]'}`} />
                  </div>
                  {tab.badge !== undefined && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold rounded-full h-4 w-4 flex items-center justify-center shadow-xs">
                      {tab.badge}
                    </span>
                  )}
                </div>
                <span className={`text-[10px] mt-0.5 tracking-tight transition-colors ${
                  active ? 'font-bold text-[#3b2fc9]' : 'font-medium text-gray-500'
                }`}>
                  {tab.label}
                </span>
              </Link>
            );
          })}

          {/* "More" Sheet Trigger */}
          <button
            onClick={() => {
              triggerHaptic('light');
              setShowMoreMenu(true);
            }}
            className="flex-1 flex flex-col items-center justify-center py-1 transition-all active:scale-95 group"
          >
            <div
              className={`px-3.5 py-1 rounded-full transition-all flex items-center justify-center ${
                showMoreMenu || isMoreActive
                  ? 'bg-indigo-100/80 text-[#3b2fc9]'
                  : 'text-gray-400 group-hover:text-gray-600'
              }`}
            >
              <MoreHorizontal className={`w-5 h-5 transition-transform ${showMoreMenu || isMoreActive ? 'scale-105 stroke-[2.3]' : 'stroke-[1.8]'}`} />
            </div>
            <span className={`text-[10px] mt-0.5 tracking-tight transition-colors ${
              showMoreMenu || isMoreActive ? 'font-bold text-[#3b2fc9]' : 'font-medium text-gray-500'
            }`}>
              More
            </span>
          </button>
        </div>
      </nav>

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
                <p className="text-xs text-gray-500">Quick access to cafeteria management</p>
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
                const isSelected = pathname === item.href || (item.href.includes('?') && pathname.includes(item.href.split('?')[0]));
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
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-xs shrink-0 ${
                      isSelected ? 'bg-[#3b2fc9] text-white' : 'bg-white border border-gray-100 text-[#3b2fc9]'
                    }`}>
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
