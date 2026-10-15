'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
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
  Plus,
  FileSpreadsheet,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { triggerHaptic } from '@/lib/haptics';
import { hasPermission } from '@/types/permissions';

export function MobileAppNavigation({ pendingStockCount = 0 }: { pendingStockCount?: number }) {
  const pathname = usePathname();
  const router = useRouter();
  const { role, user } = useAuth();
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showCreateSheet, setShowCreateSheet] = useState(false);

  const isAdmin = role === 'admin' || role === 'superadmin';

  // 5-Slot Bottom Bar: 1. DC, 2. Tuckshop, 3. (+), 4. Attendance, 5. Stock Request (User) / More (Admin)
  const tabDc = {
    label: 'DC',
    href: '/newrelic',
    icon: FileText,
    isActive: pathname === '/newrelic',
  };

  const tabTuckshop = {
    label: 'Tuckshop',
    href: '/newrelic/tuckshop',
    icon: Store,
    isActive: pathname.startsWith('/newrelic/tuckshop') || pathname === '/tuckshop',
  };

  const tabAttendance = {
    label: 'Attendance',
    href: '/newrelic/attendance',
    icon: CalendarCheck,
    isActive:
      (pathname.startsWith('/newrelic/attendance') || pathname === '/attendance') &&
      !pathname.includes('payroll'),
  };

  const tabStock = {
    label: 'Stock Req',
    href: '/newrelic/stock-request',
    icon: Send,
    isActive: pathname === '/newrelic/stock-request',
  };

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
      {/* ── Floating CRED-Style Glowing Bottom Navigation Bar ── */}
      <div className="sm:hidden fixed bottom-2 left-2.5 right-2.5 z-40 pb-[env(safe-area-inset-bottom)] pointer-events-none">
        <nav className="pointer-events-auto relative bg-[#090b16]/95 backdrop-blur-2xl border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.65),0_0_30px_rgba(99,102,241,0.15)] rounded-3xl ring-1 ring-white/10">
          {/* Ambient top neon accent line */}
          <div className="absolute top-0 left-3 right-3 h-[1.5px] bg-gradient-to-r from-cyan-400/60 via-purple-500/60 via-pink-500/60 to-amber-400/60 rounded-full" />

          <div className="flex items-center justify-around h-[66px] px-1 py-1">
            {/* Slot 1: DC (Cyber Cyan Glow) */}
            <Link
              href={tabDc.href}
              prefetch={false}
              onClick={() => triggerHaptic('light')}
              className="flex-1 flex flex-col items-center justify-center py-1 transition-all active:scale-90 group"
            >
              <div className="relative">
                <div
                  className={`px-3 py-1.5 rounded-2xl transition-all duration-200 flex items-center justify-center ${
                    tabDc.isActive
                      ? 'bg-gradient-to-b from-cyan-500/25 to-blue-600/30 border border-cyan-400/40 shadow-[0_0_16px_rgba(56,189,248,0.45)]'
                      : 'bg-white/[0.03] border border-white/[0.05] group-hover:bg-white/[0.08]'
                  }`}
                >
                  <FileText
                    className={`w-5 h-5 transition-all duration-200 ${
                      tabDc.isActive
                        ? 'scale-110 stroke-[2.4] text-cyan-300 drop-shadow-[0_0_8px_rgba(56,189,248,0.85)]'
                        : 'stroke-[1.8] text-slate-400 group-hover:text-cyan-200'
                    }`}
                  />
                </div>
              </div>
              <span
                className={`text-[10px] mt-1 tracking-tight transition-all flex items-center gap-1 ${
                  tabDc.isActive
                    ? 'font-black text-cyan-300 drop-shadow-[0_0_6px_rgba(56,189,248,0.6)] scale-105'
                    : 'font-semibold text-slate-400 group-hover:text-slate-200'
                }`}
              >
                {tabDc.label}
                {tabDc.isActive && (
                  <span className="w-1 h-1 rounded-full bg-cyan-400 shadow-[0_0_6px_#38bdf8]" />
                )}
              </span>
            </Link>

            {/* Slot 2: Tuckshop (Emerald Mint Glow) */}
            <Link
              href={tabTuckshop.href}
              prefetch={false}
              onClick={() => triggerHaptic('light')}
              className="flex-1 flex flex-col items-center justify-center py-1 transition-all active:scale-90 group"
            >
              <div className="relative">
                <div
                  className={`px-3 py-1.5 rounded-2xl transition-all duration-200 flex items-center justify-center ${
                    tabTuckshop.isActive
                      ? 'bg-gradient-to-b from-emerald-500/25 to-teal-600/30 border border-emerald-400/40 shadow-[0_0_16px_rgba(52,211,153,0.45)]'
                      : 'bg-white/[0.03] border border-white/[0.05] group-hover:bg-white/[0.08]'
                  }`}
                >
                  <Store
                    className={`w-5 h-5 transition-all duration-200 ${
                      tabTuckshop.isActive
                        ? 'scale-110 stroke-[2.4] text-emerald-300 drop-shadow-[0_0_8px_rgba(52,211,153,0.85)]'
                        : 'stroke-[1.8] text-slate-400 group-hover:text-emerald-200'
                    }`}
                  />
                </div>
              </div>
              <span
                className={`text-[10px] mt-1 tracking-tight transition-all flex items-center gap-1 ${
                  tabTuckshop.isActive
                    ? 'font-black text-emerald-300 drop-shadow-[0_0_6px_rgba(52,211,153,0.6)] scale-105'
                    : 'font-semibold text-slate-400 group-hover:text-slate-200'
                }`}
              >
                {tabTuckshop.label}
                {tabTuckshop.isActive && (
                  <span className="w-1 h-1 rounded-full bg-emerald-400 shadow-[0_0_6px_#34d399]" />
                )}
              </span>
            </Link>

            {/* Slot 3: Center Elevated Plus (+) Action Button - CRED Jewel Orb */}
            <button
              type="button"
              onClick={() => {
                triggerHaptic('medium');
                setShowCreateSheet(true);
              }}
              className="flex-1 flex flex-col items-center justify-center -mt-7 relative z-30 group"
              aria-label="New Action"
            >
              <div className="relative">
                {/* Ambient Multi-Color Glow Halo */}
                <div className="absolute -inset-1 rounded-full bg-gradient-to-tr from-amber-400 via-rose-500 to-indigo-500 blur-md opacity-75 group-hover:opacity-100 animate-pulse transition-opacity" />
                <div className="relative w-12 h-12 rounded-full bg-gradient-to-tr from-amber-400 via-rose-500 to-indigo-600 text-white shadow-xl shadow-rose-950/60 border-2 border-white/80 flex items-center justify-center active:scale-90 group-hover:scale-105 transition-all">
                  <Plus className="w-6 h-6 stroke-[3.2] text-white drop-shadow-[0_0_6px_rgba(255,255,255,0.9)]" />
                </div>
              </div>
              <span className="text-[10px] font-black bg-gradient-to-r from-amber-300 via-rose-300 to-indigo-200 bg-clip-text text-transparent tracking-tight mt-1">
                New
              </span>
            </button>

            {/* Slot 4: Attendance (Solar Amber Flame Glow) */}
            <Link
              href={tabAttendance.href}
              prefetch={false}
              onClick={() => triggerHaptic('light')}
              className="flex-1 flex flex-col items-center justify-center py-1 transition-all active:scale-90 group"
            >
              <div className="relative">
                <div
                  className={`px-3 py-1.5 rounded-2xl transition-all duration-200 flex items-center justify-center ${
                    tabAttendance.isActive
                      ? 'bg-gradient-to-b from-amber-500/25 to-orange-600/30 border border-amber-400/40 shadow-[0_0_16px_rgba(251,191,36,0.45)]'
                      : 'bg-white/[0.03] border border-white/[0.05] group-hover:bg-white/[0.08]'
                  }`}
                >
                  <CalendarCheck
                    className={`w-5 h-5 transition-all duration-200 ${
                      tabAttendance.isActive
                        ? 'scale-110 stroke-[2.4] text-amber-300 drop-shadow-[0_0_8px_rgba(251,191,36,0.85)]'
                        : 'stroke-[1.8] text-slate-400 group-hover:text-amber-200'
                    }`}
                  />
                </div>
              </div>
              <span
                className={`text-[10px] mt-1 tracking-tight transition-all flex items-center gap-1 ${
                  tabAttendance.isActive
                    ? 'font-black text-amber-300 drop-shadow-[0_0_6px_rgba(251,191,36,0.6)] scale-105'
                    : 'font-semibold text-slate-400 group-hover:text-slate-200'
                }`}
              >
                {tabAttendance.label}
                {tabAttendance.isActive && (
                  <span className="w-1 h-1 rounded-full bg-amber-400 shadow-[0_0_6px_#fbbf24]" />
                )}
              </span>
            </Link>

            {/* Slot 5: Stock Request (Cyber Violet) for user, More (Ruby Rose) for admin */}
            {isAdmin ? (
              <button
                onClick={() => {
                  triggerHaptic('light');
                  setShowMoreMenu(true);
                }}
                className="flex-1 flex flex-col items-center justify-center py-1 transition-all active:scale-90 group"
              >
                <div className="relative">
                  <div
                    className={`px-3 py-1.5 rounded-2xl transition-all duration-200 flex items-center justify-center relative ${
                      showMoreMenu || isMoreActive
                        ? 'bg-gradient-to-b from-rose-500/25 to-pink-600/30 border border-rose-400/40 shadow-[0_0_16px_rgba(244,63,94,0.45)]'
                        : 'bg-white/[0.03] border border-white/[0.05] group-hover:bg-white/[0.08]'
                    }`}
                  >
                    <MoreHorizontal
                      className={`w-5 h-5 transition-all duration-200 ${
                        showMoreMenu || isMoreActive
                          ? 'scale-110 stroke-[2.4] text-rose-300 drop-shadow-[0_0_8px_rgba(244,63,94,0.85)]'
                          : 'stroke-[1.8] text-slate-400 group-hover:text-rose-200'
                      }`}
                    />
                    {pendingStockCount > 0 && (
                      <span className="absolute -top-1 -right-1 bg-gradient-to-r from-red-500 to-rose-600 text-white text-[9px] font-black rounded-full h-4 w-4 flex items-center justify-center shadow-[0_0_8px_#f43f5e] ring-2 ring-[#090b16] animate-pulse">
                        {pendingStockCount}
                      </span>
                    )}
                  </div>
                </div>
                <span
                  className={`text-[10px] mt-1 tracking-tight transition-all flex items-center gap-1 ${
                    showMoreMenu || isMoreActive
                      ? 'font-black text-rose-300 drop-shadow-[0_0_6px_rgba(244,63,94,0.6)] scale-105'
                      : 'font-semibold text-slate-400 group-hover:text-slate-200'
                  }`}
                >
                  More
                  {(showMoreMenu || isMoreActive) && (
                    <span className="w-1 h-1 rounded-full bg-rose-400 shadow-[0_0_6px_#fb7185]" />
                  )}
                </span>
              </button>
            ) : (
              <Link
                href={tabStock.href}
                prefetch={false}
                onClick={() => triggerHaptic('light')}
                className="flex-1 flex flex-col items-center justify-center py-1 transition-all active:scale-90 group"
              >
                <div className="relative">
                  <div
                    className={`px-3 py-1.5 rounded-2xl transition-all duration-200 flex items-center justify-center ${
                      tabStock.isActive
                        ? 'bg-gradient-to-b from-purple-500/25 to-pink-600/30 border border-purple-400/40 shadow-[0_0_16px_rgba(192,132,252,0.45)]'
                        : 'bg-white/[0.03] border border-white/[0.05] group-hover:bg-white/[0.08]'
                    }`}
                  >
                    <Send
                      className={`w-5 h-5 transition-all duration-200 ${
                        tabStock.isActive
                          ? 'scale-110 stroke-[2.4] text-purple-300 drop-shadow-[0_0_8px_rgba(192,132,252,0.85)]'
                          : 'stroke-[1.8] text-slate-400 group-hover:text-purple-200'
                      }`}
                    />
                  </div>
                </div>
                <span
                  className={`text-[10px] mt-1 tracking-tight transition-all flex items-center gap-1 ${
                    tabStock.isActive
                      ? 'font-black text-purple-300 drop-shadow-[0_0_6px_rgba(192,132,252,0.6)] scale-105'
                      : 'font-semibold text-slate-400 group-hover:text-slate-200'
                  }`}
                >
                  {tabStock.label}
                  {tabStock.isActive && (
                    <span className="w-1 h-1 rounded-full bg-purple-400 shadow-[0_0_6px_#c084fc]" />
                  )}
                </span>
              </Link>
            )}
          </div>
        </nav>
      </div>

      {/* ── Native Create Action Sheet (Opened by Center + Button) ── */}
      {showCreateSheet && (
        <div className="sm:hidden fixed inset-0 z-50 flex flex-col justify-end">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-xs transition-opacity animate-in fade-in"
            onClick={() => setShowCreateSheet(false)}
          />

          {/* Action List Container */}
          <div className="relative bg-white rounded-t-3xl p-5 pb-9 shadow-2xl space-y-3.5 animate-in slide-in-from-bottom duration-200">
            <div className="w-12 h-1.5 bg-gray-300 rounded-full mx-auto" />

            <div className="flex items-center justify-between pb-1">
              <div>
                <h4 className="text-base font-black text-gray-900 tracking-tight">Create & Quick Actions</h4>
                <p className="text-xs text-gray-500">Fast operations across multi-site cafeteria hub</p>
              </div>
              <button
                onClick={() => setShowCreateSheet(false)}
                className="p-1.5 text-gray-400 hover:text-gray-600 rounded-full"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Action 1: New Challan · Hyderabad */}
            <button
              onClick={() => {
                setShowCreateSheet(false);
                triggerHaptic('light');
                if (pathname === '/newrelic') {
                  window.dispatchEvent(new CustomEvent('open-new-challan', { detail: { location: 'hyderabad' } }));
                } else {
                  router.push('/newrelic?action=new&location=hyderabad');
                }
              }}
              className="w-full flex items-center gap-3.5 p-3.5 rounded-2xl bg-gradient-to-r from-blue-50/90 to-indigo-50/70 border border-blue-200/80 text-left active:scale-[0.99] transition-transform shadow-xs"
            >
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center shadow-xs shrink-0">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm font-bold text-blue-950">New Challan · Hyderabad</p>
                <p className="text-xs text-blue-700 font-medium">Mindspace, Hitec City cafeteria DC</p>
              </div>
            </button>

            {/* Action 2: New Challan · Bangalore */}
            <button
              onClick={() => {
                setShowCreateSheet(false);
                triggerHaptic('light');
                if (pathname === '/newrelic') {
                  window.dispatchEvent(new CustomEvent('open-new-challan', { detail: { location: 'bangalore' } }));
                } else {
                  router.push('/newrelic?action=new&location=bangalore');
                }
              }}
              className="w-full flex items-center gap-3.5 p-3.5 rounded-2xl bg-gradient-to-r from-emerald-50/90 to-teal-50/70 border border-emerald-200/80 text-left active:scale-[0.99] transition-transform shadow-xs"
            >
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-600 text-white flex items-center justify-center shadow-xs shrink-0">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm font-bold text-emerald-950">New Challan · Bangalore</p>
                <p className="text-xs text-emerald-700 font-medium">Bagmane Tech Park cafeteria DC</p>
              </div>
            </button>

            {/* Action 3: New Stock Request */}
            <button
              onClick={() => {
                setShowCreateSheet(false);
                triggerHaptic('light');
                router.push('/newrelic/stock-request');
              }}
              className="w-full flex items-center gap-3.5 p-3.5 rounded-2xl bg-gradient-to-r from-purple-50/90 to-violet-50/70 border border-purple-200/80 text-left active:scale-[0.99] transition-transform shadow-xs"
            >
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-purple-600 to-violet-600 text-white flex items-center justify-center shadow-xs shrink-0">
                <Send className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm font-bold text-purple-950">New Stock Request</p>
                <p className="text-xs text-purple-700 font-medium">Request items, raw materials &amp; supplies</p>
              </div>
            </button>

            {/* Action 4: Today's Attendance / Check In */}
            <button
              onClick={() => {
                setShowCreateSheet(false);
                triggerHaptic('light');
                router.push('/newrelic/attendance');
              }}
              className="w-full flex items-center gap-3.5 p-3.5 rounded-2xl bg-gradient-to-r from-amber-50/90 to-orange-50/70 border border-amber-200/80 text-left active:scale-[0.99] transition-transform shadow-xs"
            >
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-orange-600 text-white flex items-center justify-center shadow-xs shrink-0">
                <CalendarCheck className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm font-bold text-amber-950">Attendance Check-In / Out</p>
                <p className="text-xs text-amber-700 font-medium">Selfie camera verification &amp; shift clock</p>
              </div>
            </button>

            {/* Admin extras in + sheet: Reconciliation & Export Excel */}
            {isAdmin && (
              <div className="grid grid-cols-2 gap-2 pt-1 border-t border-gray-100">
                <Link
                  href="/newrelic/reconcile"
                  onClick={() => setShowCreateSheet(false)}
                  className="flex items-center gap-2 p-3 rounded-xl bg-amber-50 border border-amber-200 text-left text-xs font-bold text-amber-900 active:scale-95"
                >
                  <FileCheck2 className="w-4 h-4 text-amber-700" />
                  <span>Reconcile Cash</span>
                </Link>
                <button
                  onClick={() => {
                    setShowCreateSheet(false);
                    if (pathname === '/newrelic') {
                      window.dispatchEvent(new CustomEvent('export-newrelic-excel'));
                    } else {
                      router.push('/newrelic?action=export');
                    }
                  }}
                  className="flex items-center gap-2 p-3 rounded-xl bg-blue-50 border border-blue-200 text-left text-xs font-bold text-blue-900 active:scale-95"
                >
                  <FileSpreadsheet className="w-4 h-4 text-blue-700" />
                  <span>Export DC Excel</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}

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
                        prefetch={false}
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
