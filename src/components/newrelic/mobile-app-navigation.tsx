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
  UserCheck,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { triggerHaptic } from '@/lib/haptics';
import { hasPermission, PermissionKey } from '@/types/permissions';
import { COMPANY_SITES } from '@/types/site';

interface GlowTheme {
  activePill: string;
  iconActive: string;
  textActive: string;
  dotGlow: string;
}

const GLOW_THEMES: Record<string, GlowTheme> = {
  cyan: {
    activePill: 'bg-gradient-to-b from-cyan-500/25 to-blue-600/30 border border-cyan-400/40 shadow-[0_0_16px_rgba(56,189,248,0.45)]',
    iconActive: 'text-cyan-300 drop-shadow-[0_0_8px_rgba(56,189,248,0.85)]',
    textActive: 'text-cyan-300 drop-shadow-[0_0_6px_rgba(56,189,248,0.6)]',
    dotGlow: 'bg-cyan-400 shadow-[0_0_6px_#38bdf8]',
  },
  indigo: {
    activePill: 'bg-gradient-to-b from-indigo-500/25 to-blue-600/30 border border-indigo-400/40 shadow-[0_0_16px_rgba(99,102,241,0.45)]',
    iconActive: 'text-indigo-300 drop-shadow-[0_0_8px_rgba(99,102,241,0.85)]',
    textActive: 'text-indigo-300 drop-shadow-[0_0_6px_rgba(99,102,241,0.6)]',
    dotGlow: 'bg-indigo-400 shadow-[0_0_6px_#6366f1]',
  },
  emerald: {
    activePill: 'bg-gradient-to-b from-emerald-500/25 to-teal-600/30 border border-emerald-400/40 shadow-[0_0_16px_rgba(52,211,153,0.45)]',
    iconActive: 'text-emerald-300 drop-shadow-[0_0_8px_rgba(52,211,153,0.85)]',
    textActive: 'text-emerald-300 drop-shadow-[0_0_6px_rgba(52,211,153,0.6)]',
    dotGlow: 'bg-emerald-400 shadow-[0_0_6px_#34d399]',
  },
  amber: {
    activePill: 'bg-gradient-to-b from-amber-500/25 to-orange-600/30 border border-amber-400/40 shadow-[0_0_16px_rgba(251,191,36,0.45)]',
    iconActive: 'text-amber-300 drop-shadow-[0_0_8px_rgba(251,191,36,0.85)]',
    textActive: 'text-amber-300 drop-shadow-[0_0_6px_rgba(251,191,36,0.6)]',
    dotGlow: 'bg-amber-400 shadow-[0_0_6px_#fbbf24]',
  },
  purple: {
    activePill: 'bg-gradient-to-b from-purple-500/25 to-pink-600/30 border border-purple-400/40 shadow-[0_0_16px_rgba(192,132,252,0.45)]',
    iconActive: 'text-purple-300 drop-shadow-[0_0_8px_rgba(192,132,252,0.85)]',
    textActive: 'text-purple-300 drop-shadow-[0_0_6px_rgba(192,132,252,0.6)]',
    dotGlow: 'bg-purple-400 shadow-[0_0_6px_#c084fc]',
  },
  blue: {
    activePill: 'bg-gradient-to-b from-blue-500/25 to-indigo-600/30 border border-blue-400/40 shadow-[0_0_16px_rgba(96,165,250,0.45)]',
    iconActive: 'text-blue-300 drop-shadow-[0_0_8px_rgba(96,165,250,0.85)]',
    textActive: 'text-blue-300 drop-shadow-[0_0_6px_rgba(96,165,250,0.6)]',
    dotGlow: 'bg-blue-400 shadow-[0_0_6px_#60a5fa]',
  },
  teal: {
    activePill: 'bg-gradient-to-b from-teal-500/25 to-emerald-600/30 border border-teal-400/40 shadow-[0_0_16px_rgba(45,212,191,0.45)]',
    iconActive: 'text-teal-300 drop-shadow-[0_0_8px_rgba(45,212,191,0.85)]',
    textActive: 'text-teal-300 drop-shadow-[0_0_6px_rgba(45,212,191,0.6)]',
    dotGlow: 'bg-teal-400 shadow-[0_0_6px_#2dd4bf]',
  },
  orange: {
    activePill: 'bg-gradient-to-b from-orange-500/25 to-rose-600/30 border border-orange-400/40 shadow-[0_0_16px_rgba(251,146,60,0.45)]',
    iconActive: 'text-orange-300 drop-shadow-[0_0_8px_rgba(251,146,60,0.85)]',
    textActive: 'text-orange-300 drop-shadow-[0_0_6px_rgba(251,146,60,0.6)]',
    dotGlow: 'bg-orange-400 shadow-[0_0_6px_#fb923c]',
  },
  slate: {
    activePill: 'bg-gradient-to-b from-slate-500/25 to-slate-600/30 border border-slate-400/40 shadow-[0_0_16px_rgba(148,163,184,0.45)]',
    iconActive: 'text-slate-200 drop-shadow-[0_0_8px_rgba(148,163,184,0.85)]',
    textActive: 'text-slate-200 drop-shadow-[0_0_6px_rgba(148,163,184,0.6)]',
    dotGlow: 'bg-slate-400 shadow-[0_0_6px_#94a3b8]',
  },
  rose: {
    activePill: 'bg-gradient-to-b from-rose-500/25 to-pink-600/30 border border-rose-400/40 shadow-[0_0_16px_rgba(244,63,94,0.45)]',
    iconActive: 'text-rose-300 drop-shadow-[0_0_8px_rgba(244,63,94,0.85)]',
    textActive: 'text-rose-300 drop-shadow-[0_0_6px_rgba(244,63,94,0.6)]',
    dotGlow: 'bg-rose-400 shadow-[0_0_6px_#fb7185]',
  },
};

interface NavigationTabItem {
  id: string;
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  isActive: boolean;
  glowTheme: GlowTheme;
  permissionKey?: PermissionKey;
  badge?: number;
}

export function MobileAppNavigation({ pendingStockCount = 0 }: { pendingStockCount?: number }) {
  const pathname = usePathname();
  const router = useRouter();
  const { role, user } = useAuth();
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showCreateSheet, setShowCreateSheet] = useState(false);

  const isAdmin = role === 'admin' || role === 'superadmin';
  const site = user?.assignedSite || 'newrelic';
  const siteConfig = COMPANY_SITES[site] || COMPANY_SITES.newrelic;

  /* ─────────────────────────────────────────────────────────────
     1. DYNAMIC PRIMARY MODULES (Filtered by User Permissions & Site)
     ───────────────────────────────────────────────────────────── */
  const allModules: NavigationTabItem[] = [];

  // NewRelic DC (Strictly forbidden for DSM & NTT Data)
  if (hasPermission(user, 'newrelic_dc')) {
    allModules.push({
      id: 'newrelic_dc',
      label: 'DC',
      href: '/newrelic',
      icon: FileText,
      isActive: pathname === '/newrelic',
      glowTheme: GLOW_THEMES.cyan,
      permissionKey: 'newrelic_dc',
    });
  }

  // General Delivery Challans (Universal for other companies / HungerBox)
  if (hasPermission(user, 'general_dc')) {
    allModules.push({
      id: 'general_dc',
      label: 'Challan',
      href: '/delivery-challan',
      icon: Truck,
      isActive: pathname.startsWith('/delivery-challan') || pathname.startsWith('/delivery-challans'),
      glowTheme: GLOW_THEMES.indigo,
      permissionKey: 'general_dc',
    });
  }

  // Tuckshop (Counter sales & petty expenses for assigned site)
  if (hasPermission(user, 'tuckshop')) {
    allModules.push({
      id: 'tuckshop',
      label: 'Tuckshop',
      href: '/newrelic/tuckshop',
      icon: Store,
      isActive: pathname.startsWith('/newrelic/tuckshop') || pathname === '/tuckshop',
      glowTheme: GLOW_THEMES.emerald,
      permissionKey: 'tuckshop',
    });
  }

  // Attendance (Daily selfie clock-in for assigned site)
  if (hasPermission(user, 'attendance')) {
    allModules.push({
      id: 'attendance',
      label: 'Attendance',
      href: '/newrelic/attendance',
      icon: CalendarCheck,
      isActive:
        (pathname.startsWith('/newrelic/attendance') || pathname === '/attendance') &&
        !pathname.includes('payroll'),
      glowTheme: GLOW_THEMES.amber,
      permissionKey: 'attendance',
    });
  }

  // Stock Request (Material requests for assigned site)
  if (hasPermission(user, 'stock_request')) {
    allModules.push({
      id: 'stock_request',
      label: 'Stock Req',
      href: '/newrelic/stock-request',
      icon: Send,
      isActive: pathname === '/newrelic/stock-request',
      glowTheme: GLOW_THEMES.purple,
      permissionKey: 'stock_request',
    });
  }

  // Invoicing & Billing
  if (hasPermission(user, 'billing')) {
    allModules.push({
      id: 'billing',
      label: 'Invoices',
      href: '/invoices',
      icon: LayoutDashboard,
      isActive: pathname === '/invoices' || pathname === '/',
      glowTheme: GLOW_THEMES.blue,
      permissionKey: 'billing',
    });
  }

  // Products Master
  if (hasPermission(user, 'masters')) {
    allModules.push({
      id: 'masters',
      label: 'Products',
      href: '/products',
      icon: Package,
      isActive: pathname.startsWith('/products') || pathname.startsWith('/clients'),
      glowTheme: GLOW_THEMES.teal,
      permissionKey: 'masters',
    });
  }

  // HR Docs & Payslips
  if (hasPermission(user, 'hr_docs')) {
    allModules.push({
      id: 'hr_docs',
      label: 'HR Docs',
      href: '/payslip',
      icon: Receipt,
      isActive:
        pathname.startsWith('/payslip') ||
        pathname.startsWith('/offer-letter') ||
        pathname.startsWith('/declarations'),
      glowTheme: GLOW_THEMES.orange,
      permissionKey: 'hr_docs',
    });
  }

  // Prioritize User's assigned default landing page to Slot 1 if configured
  if (user?.defaultLandingPage) {
    const landingIdx = allModules.findIndex(
      (m) => m.href === user.defaultLandingPage || (user.defaultLandingPage && user.defaultLandingPage.startsWith(m.href))
    );
    if (landingIdx > 0) {
      const [landingItem] = allModules.splice(landingIdx, 1);
      allModules.unshift(landingItem);
    }
  }

  /* ─────────────────────────────────────────────────────────────
     2. ITEMS FOR "MORE" ACTION DRAWER
     ───────────────────────────────────────────────────────────── */
  // Group 1: Operations & Dispatches
  const operationItems: Array<{ label: string; href: string; icon: any; desc: string }> = [];
  if (hasPermission(user, 'newrelic_dc')) {
    operationItems.push({
      label: 'NewRelic DC Hub',
      href: '/newrelic',
      icon: FileText,
      desc: 'Bangalore & Hyderabad cafeteria dispatches',
    });
  }
  if (hasPermission(user, 'general_dc')) {
    operationItems.push({
      label: 'General Delivery Challans',
      href: '/delivery-challan',
      icon: Truck,
      desc: 'Universal dispatches for HungerBox & corporate clients',
    });
  }
  if (hasPermission(user, 'tuckshop')) {
    operationItems.push({
      label: 'Tuckshop Sales & Ledger',
      href: '/newrelic/tuckshop',
      icon: Store,
      desc: 'Counter sales, daily collections & petty cash',
    });
  }
  if (hasPermission(user, 'attendance')) {
    operationItems.push({
      label: 'Daily Attendance',
      href: '/newrelic/attendance',
      icon: CalendarCheck,
      desc: 'Selfie clock-in & shift attendance verification',
    });
  }
  if (hasPermission(user, 'stock_request')) {
    operationItems.push({
      label: 'Request Stock',
      href: '/newrelic/stock-request',
      icon: Send,
      desc: 'Order raw materials, snacks and inventory',
    });
  }

  // Group 2: Invoicing, HR & Masters
  const billingAndHrItems: Array<{ label: string; href: string; icon: any; desc: string }> = [];
  if (hasPermission(user, 'billing')) {
    billingAndHrItems.push({
      label: 'Invoice Dashboard & Creator',
      href: '/',
      icon: LayoutDashboard,
      desc: 'Create tax invoices, revenue charts & billing metrics',
    });
    billingAndHrItems.push({
      label: 'Saved Invoices',
      href: '/invoices',
      icon: ListOrdered,
      desc: 'All tax invoices and client billing history',
    });
    billingAndHrItems.push({
      label: 'Saved Quotations',
      href: '/quotations',
      icon: FileSearch,
      desc: 'Past estimates, proposals and quotes',
    });
    billingAndHrItems.push({
      label: 'New Quotation / Proposal',
      href: '/quotation',
      icon: FilePlus,
      desc: 'Create and export a new client quote',
    });
  }
  if (hasPermission(user, 'masters')) {
    billingAndHrItems.push({
      label: 'Products Master',
      href: '/products',
      icon: Package,
      desc: 'Manage master items catalog and HSN codes',
    });
    billingAndHrItems.push({
      label: 'Clients Directory',
      href: '/clients',
      icon: Users,
      desc: 'Customer addresses, GST numbers and contacts',
    });
  }
  if (hasPermission(user, 'hr_docs')) {
    billingAndHrItems.push({
      label: 'Staff Payslips',
      href: '/payslip',
      icon: Receipt,
      desc: 'Generate monthly employee pay slips',
    });
    billingAndHrItems.push({
      label: 'Offer Letters',
      href: '/offer-letter',
      icon: Briefcase,
      desc: 'Draft employment letters & appointment records',
    });
    billingAndHrItems.push({
      label: 'GST Declarations',
      href: '/declarations',
      icon: FileText,
      desc: 'Generate URD GST declaration letterheads',
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

  const allMoreItems = [...operationItems, ...billingAndHrItems, ...adminItems];
  const isMoreActive = allMoreItems.some((item) => {
    if (item.href.includes('?')) {
      const base = item.href.split('?')[0];
      return pathname.startsWith(base);
    }
    return pathname === item.href;
  });

  /* ─────────────────────────────────────────────────────────────
     3. 5-SLOT MOBILE NAVIGATION LAYOUT ALLOCATION
     Slot 1: Primary Tab 1
     Slot 2: Primary Tab 2
     Slot 3: Elevated Center (+) Button
     Slot 4: Primary Tab 3 (or Profile fallback)
     Slot 5: More (Admin / Extra modules) or Primary Tab 4 / Profile
     ───────────────────────────────────────────────────────────── */
  const profileTab: NavigationTabItem = {
    id: 'profile',
    label: 'Profile',
    href: '/profile',
    icon: Users,
    isActive: pathname === '/profile',
    glowTheme: GLOW_THEMES.slate,
  };

  const slot1 = allModules[0] || profileTab;
  const slot2 = allModules[1] || profileTab;
  const slot4 = allModules[2] || profileTab;

  const requiresMoreMenu = allModules.length > 4 || adminItems.length > 0 || isAdmin;
  const slot5IsMore = requiresMoreMenu;
  const slot5Tab = !slot5IsMore
    ? allModules[3] || (allModules.length === 3 ? profileTab : null)
    : null;

  /* Helper to render a navigation item with CRED ambient glow */
  const renderTab = (tab: NavigationTabItem) => {
    const Icon = tab.icon;
    return (
      <Link
        key={tab.id}
        href={tab.href}
        prefetch={false}
        onClick={() => triggerHaptic('light')}
        className="flex-1 flex flex-col items-center justify-center py-1 transition-all active:scale-90 group"
      >
        <div className="relative">
          <div
            className={`px-3 py-1.5 rounded-2xl transition-all duration-200 flex items-center justify-center ${
              tab.isActive
                ? tab.glowTheme.activePill
                : 'bg-white/[0.03] border border-white/[0.05] group-hover:bg-white/[0.08]'
            }`}
          >
            <Icon
              className={`w-5 h-5 transition-all duration-200 ${
                tab.isActive
                  ? `scale-110 stroke-[2.4] ${tab.glowTheme.iconActive}`
                  : 'stroke-[1.8] text-slate-400 group-hover:text-slate-200'
              }`}
            />
            {Boolean(tab.badge && tab.badge > 0) && (
              <span className="absolute -top-1 -right-1 bg-gradient-to-r from-red-500 to-rose-600 text-white text-[9px] font-black rounded-full h-4 w-4 flex items-center justify-center shadow-[0_0_8px_#f43f5e] ring-2 ring-[#090b16] animate-pulse">
                {tab.badge}
              </span>
            )}
          </div>
        </div>
        <span
          className={`text-[10px] mt-1 tracking-tight transition-all flex items-center gap-1 ${
            tab.isActive
              ? `font-black ${tab.glowTheme.textActive} scale-105`
              : 'font-semibold text-slate-400 group-hover:text-slate-200'
          }`}
        >
          {tab.label}
          {tab.isActive && (
            <span className={`w-1 h-1 rounded-full ${tab.glowTheme.dotGlow}`} />
          )}
        </span>
      </Link>
    );
  };

  return (
    <>
      {/* ── Floating CRED-Style Glowing Bottom Navigation Bar ── */}
      <div className="sm:hidden fixed bottom-2 left-2.5 right-2.5 z-40 pb-[env(safe-area-inset-bottom)] pointer-events-none">
        <nav className="pointer-events-auto relative bg-[#090b16]/95 backdrop-blur-2xl border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.65),0_0_30px_rgba(99,102,241,0.15)] rounded-3xl ring-1 ring-white/10 pt-1 pb-1">
          {/* Ambient top neon accent line */}
          <div className="absolute top-0 left-3 right-3 h-[1.5px] bg-gradient-to-r from-cyan-400/60 via-purple-500/60 via-pink-500/60 to-amber-400/60 rounded-full" />

          <div className="flex items-center justify-around h-[66px] px-1 py-1">
            {/* Slot 1: Primary Module */}
            {renderTab(slot1)}

            {/* Slot 2: Secondary Module */}
            {renderTab(slot2)}

            {/* Slot 3: Center Elevated Plus (+) Action Button - CRED Jewel Orb */}
            <button
              type="button"
              onClick={() => {
                triggerHaptic('medium');
                setShowCreateSheet(true);
              }}
              className="flex-1 flex flex-col items-center justify-center -mt-6 relative z-30 group"
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

            {/* Slot 4: Tertiary Module or Profile */}
            {renderTab(slot4)}

            {/* Slot 5: More Drawer (Admin / Extra Tools) or Quaternary Tab */}
            {slot5IsMore ? (
              <button
                type="button"
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
            ) : slot5Tab ? (
              renderTab(slot5Tab)
            ) : (
              renderTab(profileTab)
            )}
          </div>
        </nav>
      </div>

      {/* ── Dynamic Create Action Sheet (Opened by Center + Button) ── */}
      {showCreateSheet && (
        <div className="sm:hidden fixed inset-0 z-50 flex flex-col justify-end">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-xs transition-opacity animate-in fade-in"
            onClick={() => setShowCreateSheet(false)}
          />

          {/* Action List Container */}
          <div className="relative bg-white rounded-t-3xl max-h-[85vh] overflow-y-auto p-5 pb-9 shadow-2xl space-y-4 animate-in slide-in-from-bottom duration-200">
            <div className="w-12 h-1.5 bg-gray-300 rounded-full mx-auto" />

            <div className="flex items-center justify-between pb-1">
              <div>
                <h4 className="text-base font-black text-gray-900 tracking-tight">Create &amp; Quick Actions</h4>
                <p className="text-xs text-gray-500">
                  Quick shortcuts for {siteConfig.name} operations
                </p>
              </div>
              <button
                onClick={() => setShowCreateSheet(false)}
                className="p-1.5 text-gray-400 hover:text-gray-600 rounded-full"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* 1. Delivery Challans Section (Site & Permission Scoped) */}
            {(hasPermission(user, 'newrelic_dc') || hasPermission(user, 'general_dc')) && (
              <div className="space-y-2">
                <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider px-1">
                  Delivery Challans
                </span>
                <div className="grid grid-cols-1 gap-2">
                  {/* Dedicated NewRelic DC (Strictly for NewRelic site) */}
                  {hasPermission(user, 'newrelic_dc') && (
                    <>
                      <button
                        onClick={() => {
                          setShowCreateSheet(false);
                          triggerHaptic('light');
                          if (pathname === '/newrelic') {
                            window.dispatchEvent(
                              new CustomEvent('open-new-challan', { detail: { location: 'hyderabad' } })
                            );
                          } else {
                            router.push('/newrelic?action=new&location=hyderabad');
                          }
                        }}
                        className="w-full flex items-center gap-3.5 p-3 rounded-2xl bg-gradient-to-r from-blue-50/90 to-indigo-50/70 border border-blue-200/80 text-left active:scale-[0.99] transition-transform shadow-xs"
                      >
                        <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center shadow-xs shrink-0">
                          <FileText className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-blue-950">New Challan · Hyderabad</p>
                          <p className="text-[11px] text-blue-700 font-medium">Mindspace cafeteria DC</p>
                        </div>
                      </button>

                      <button
                        onClick={() => {
                          setShowCreateSheet(false);
                          triggerHaptic('light');
                          if (pathname === '/newrelic') {
                            window.dispatchEvent(
                              new CustomEvent('open-new-challan', { detail: { location: 'bangalore' } })
                            );
                          } else {
                            router.push('/newrelic?action=new&location=bangalore');
                          }
                        }}
                        className="w-full flex items-center gap-3.5 p-3 rounded-2xl bg-gradient-to-r from-emerald-50/90 to-teal-50/70 border border-emerald-200/80 text-left active:scale-[0.99] transition-transform shadow-xs"
                      >
                        <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-600 text-white flex items-center justify-center shadow-xs shrink-0">
                          <FileText className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-emerald-950">New Challan · Bangalore</p>
                          <p className="text-[11px] text-emerald-700 font-medium">Bagmane Tech Park DC</p>
                        </div>
                      </button>
                    </>
                  )}

                  {/* General Delivery Challan (HungerBox, The Gut Guru & Other Clients) */}
                  {hasPermission(user, 'general_dc') && (
                    <button
                      onClick={() => {
                        setShowCreateSheet(false);
                        triggerHaptic('light');
                        router.push('/delivery-challan');
                      }}
                      className="w-full flex items-center gap-3.5 p-3 rounded-2xl bg-gradient-to-r from-indigo-50/90 to-blue-50/70 border border-indigo-200/80 text-left active:scale-[0.99] transition-transform shadow-xs"
                    >
                      <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-blue-600 text-white flex items-center justify-center shadow-xs shrink-0">
                        <Truck className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-indigo-950">New General Challan</p>
                        <p className="text-[11px] text-indigo-700 font-medium">HungerBox &amp; corporate dispatches</p>
                      </div>
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* 2. Billing & Invoicing Section */}
            {hasPermission(user, 'billing') && (
              <div className="space-y-2">
                <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider px-1">
                  Billing &amp; Quotes
                </span>
                <div className="grid grid-cols-1 gap-2">
                  <button
                    onClick={() => {
                      setShowCreateSheet(false);
                      triggerHaptic('light');
                      router.push('/');
                    }}
                    className="w-full flex items-center gap-3.5 p-3 rounded-2xl bg-gradient-to-r from-blue-50/90 to-sky-50/70 border border-blue-200/80 text-left active:scale-[0.99] transition-transform shadow-xs"
                  >
                    <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-sky-600 text-white flex items-center justify-center shadow-xs shrink-0">
                      <LayoutDashboard className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-blue-950">New Tax Invoice</p>
                      <p className="text-[11px] text-blue-700 font-medium">Create client invoice with line items</p>
                    </div>
                  </button>

                  <button
                    onClick={() => {
                      setShowCreateSheet(false);
                      triggerHaptic('light');
                      router.push('/quotation');
                    }}
                    className="w-full flex items-center gap-3.5 p-3 rounded-2xl bg-gradient-to-r from-violet-50/90 to-purple-50/70 border border-violet-200/80 text-left active:scale-[0.99] transition-transform shadow-xs"
                  >
                    <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-violet-600 to-purple-600 text-white flex items-center justify-center shadow-xs shrink-0">
                      <FilePlus className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-violet-950">New Quotation / Estimate</p>
                      <p className="text-[11px] text-violet-700 font-medium">Draft price quotation for approval</p>
                    </div>
                  </button>
                </div>
              </div>
            )}

            {/* 3. Site Daily Operations Section */}
            {(hasPermission(user, 'attendance') || hasPermission(user, 'stock_request') || hasPermission(user, 'tuckshop')) && (
              <div className="space-y-2">
                <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider px-1">
                  Site Operations ({siteConfig.name})
                </span>
                <div className="grid grid-cols-1 gap-2">
                  {hasPermission(user, 'attendance') && (
                    <button
                      onClick={() => {
                        setShowCreateSheet(false);
                        triggerHaptic('light');
                        router.push('/newrelic/attendance');
                      }}
                      className="w-full flex items-center gap-3.5 p-3 rounded-2xl bg-gradient-to-r from-amber-50/90 to-orange-50/70 border border-amber-200/80 text-left active:scale-[0.99] transition-transform shadow-xs"
                    >
                      <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-amber-500 to-orange-600 text-white flex items-center justify-center shadow-xs shrink-0">
                        <CalendarCheck className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-amber-950">Attendance Check-In / Clock Out</p>
                        <p className="text-[11px] text-amber-700 font-medium">Selfie camera verification &amp; shift clock</p>
                      </div>
                    </button>
                  )}

                  {hasPermission(user, 'stock_request') && (
                    <button
                      onClick={() => {
                        setShowCreateSheet(false);
                        triggerHaptic('light');
                        router.push('/newrelic/stock-request');
                      }}
                      className="w-full flex items-center gap-3.5 p-3 rounded-2xl bg-gradient-to-r from-purple-50/90 to-violet-50/70 border border-purple-200/80 text-left active:scale-[0.99] transition-transform shadow-xs"
                    >
                      <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-purple-600 to-violet-600 text-white flex items-center justify-center shadow-xs shrink-0">
                        <Send className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-purple-950">New Stock Request</p>
                        <p className="text-[11px] text-purple-700 font-medium">Request inventory &amp; material supplies</p>
                      </div>
                    </button>
                  )}

                  {hasPermission(user, 'tuckshop') && (
                    <button
                      onClick={() => {
                        setShowCreateSheet(false);
                        triggerHaptic('light');
                        router.push('/newrelic/tuckshop');
                      }}
                      className="w-full flex items-center gap-3.5 p-3 rounded-2xl bg-gradient-to-r from-emerald-50/90 to-teal-50/70 border border-emerald-200/80 text-left active:scale-[0.99] transition-transform shadow-xs"
                    >
                      <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-600 text-white flex items-center justify-center shadow-xs shrink-0">
                        <Store className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-emerald-950">Tuckshop Register / Expense</p>
                        <p className="text-[11px] text-emerald-700 font-medium">Record sales &amp; petty expense ledger</p>
                      </div>
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* 4. HR & Legal Documents Section */}
            {hasPermission(user, 'hr_docs') && (
              <div className="space-y-2">
                <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider px-1">
                  HR &amp; Documents
                </span>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => {
                      setShowCreateSheet(false);
                      triggerHaptic('light');
                      router.push('/payslip');
                    }}
                    className="flex items-center gap-2.5 p-3 rounded-2xl bg-orange-50 border border-orange-200 text-left active:scale-95 transition-transform"
                  >
                    <Receipt className="w-4 h-4 text-orange-600 shrink-0" />
                    <div>
                      <p className="text-xs font-bold text-orange-950">New Payslip</p>
                      <p className="text-[10px] text-orange-700">Salary slip</p>
                    </div>
                  </button>

                  <button
                    onClick={() => {
                      setShowCreateSheet(false);
                      triggerHaptic('light');
                      router.push('/offer-letter');
                    }}
                    className="flex items-center gap-2.5 p-3 rounded-2xl bg-amber-50 border border-amber-200 text-left active:scale-95 transition-transform"
                  >
                    <Briefcase className="w-4 h-4 text-amber-600 shrink-0" />
                    <div>
                      <p className="text-xs font-bold text-amber-950">Offer Letter</p>
                      <p className="text-[10px] text-amber-700">Appointment</p>
                    </div>
                  </button>
                </div>
              </div>
            )}

            {/* 5. Management & Admin Tools */}
            {(isAdmin || hasPermission(user, 'tuckshop_reconcile') || hasPermission(user, 'stock_admin')) && (
              <div className="space-y-2 pt-1 border-t border-gray-100">
                <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider px-1">
                  Management Tools
                </span>
                <div className="grid grid-cols-2 gap-2">
                  {hasPermission(user, 'tuckshop_reconcile') && (
                    <Link
                      href="/newrelic/reconcile"
                      onClick={() => {
                        setShowCreateSheet(false);
                        triggerHaptic('light');
                      }}
                      className="flex items-center gap-2 p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-left text-xs font-bold text-amber-900 active:scale-95"
                    >
                      <FileCheck2 className="w-4 h-4 text-amber-700" />
                      <span>Reconcile Cash</span>
                    </Link>
                  )}
                  {hasPermission(user, 'stock_admin') && (
                    <Link
                      href="/newrelic/stock-requests-admin"
                      onClick={() => {
                        setShowCreateSheet(false);
                        triggerHaptic('light');
                      }}
                      className="flex items-center gap-2 p-2.5 rounded-xl bg-purple-50 border border-purple-200 text-left text-xs font-bold text-purple-900 active:scale-95"
                    >
                      <Send className="w-4 h-4 text-purple-700" />
                      <span>Stock Approvals</span>
                    </Link>
                  )}
                  {hasPermission(user, 'newrelic_dc') && (
                    <button
                      onClick={() => {
                        setShowCreateSheet(false);
                        if (pathname === '/newrelic') {
                          window.dispatchEvent(new CustomEvent('export-newrelic-excel'));
                        } else {
                          router.push('/newrelic?action=export');
                        }
                      }}
                      className="flex items-center gap-2 p-2.5 rounded-xl bg-blue-50 border border-blue-200 text-left text-xs font-bold text-blue-900 active:scale-95"
                    >
                      <FileSpreadsheet className="w-4 h-4 text-blue-700" />
                      <span>Export DC Excel</span>
                    </button>
                  )}
                </div>
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
                <h3 className="text-base font-black text-gray-900 tracking-tight">Modules &amp; Tools</h3>
                <p className="text-xs text-gray-500">
                  {user?.email} · {siteConfig.name} ({role})
                </p>
              </div>
              <button
                onClick={() => setShowMoreMenu(false)}
                className="p-1.5 rounded-full hover:bg-gray-100 text-gray-400 active:scale-95"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Quick Profile Link Card */}
            <Link
              href="/profile"
              onClick={() => {
                triggerHaptic('light');
                setShowMoreMenu(false);
              }}
              className="flex items-center justify-between p-3 rounded-2xl bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-100 text-indigo-950 active:scale-98 transition-transform"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold text-sm shadow-xs">
                  <UserCheck className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xs font-bold text-gray-900">View My Profile</p>
                  <p className="text-[11px] text-gray-500">Account details &amp; preferences</p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-400" />
            </Link>

            {/* Section 1: Operations & Dispatches */}
            {operationItems.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-1.5 px-1">
                  <Store className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                    Operations &amp; Dispatches
                  </span>
                </div>
                <div className="grid grid-cols-1 gap-2">
                  {operationItems.map((item) => {
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

            {/* Section 2: Invoicing, HR & Masters */}
            {billingAndHrItems.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-1.5 px-1">
                  <Package className="w-3.5 h-3.5 text-indigo-600" />
                  <span className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                    Invoicing, HR &amp; Masters
                  </span>
                </div>
                <div className="grid grid-cols-1 gap-2">
                  {billingAndHrItems.map((item) => {
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
                            isSelected ? 'bg-[#3b2fc9] text-white' : 'bg-white border border-gray-100 text-indigo-600'
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

            {/* Section 3: Administration & Settings */}
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
