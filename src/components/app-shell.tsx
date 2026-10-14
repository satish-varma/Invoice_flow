'use client';

import React, { useState } from 'react';
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarFooter,
  SidebarInset,
  SidebarTrigger,
  useSidebar,
  SidebarProvider,
} from '@/components/ui/sidebar';
import Link from 'next/link';
import {
  FilePlus,
  FileText,
  Truck,
  Settings,
  ListOrdered,
  LogOut,
  User,
  Package,
  Briefcase,
  Receipt,
  ExternalLink,
  LayoutDashboard,
  FileSearch,
  Plus,
  MoreHorizontal,
  X,
  Sparkles,
  ChevronRight,
  Shield,
  Layers,
} from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { COMPANY_SITES } from '@/types/site';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { triggerHaptic } from '@/lib/haptics';

function AppShellContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const auth = useAuth();
  const user = auth?.user;
  const router = useRouter();
  const { openMobile, setOpenMobile } = useSidebar();

  const [showCreateSheet, setShowCreateSheet] = useState(false);
  const [showMoreSheet, setShowMoreSheet] = useState(false);

  const handleSignOut = async () => {
    if (auth && auth.signOut) {
      triggerHaptic('medium');
      await auth.signOut();
    }
  };

  const isNonNewRelic = user?.assignedSite && user.assignedSite !== 'newrelic';
  const siteConfig = user?.assignedSite ? COMPANY_SITES[user.assignedSite] : null;

  const portalHref = isNonNewRelic ? '/newrelic/tuckshop' : '/newrelic';
  const portalLabel = siteConfig ? `${siteConfig.name} Portal` : 'NewRelic DC Hub';

  const rawNavItems = [
    { href: '/', label: 'Dashboard & Invoice', icon: LayoutDashboard, app: '/invoices', section: 'core' },
    { href: '/quotation', label: 'New Quotation', icon: FilePlus, app: '/quotations', section: 'core' },
    { href: '/delivery-challan', label: 'Delivery Challan', icon: Truck, app: '/delivery-challans', hideIfNonNewRelic: true, section: 'core' },
    { href: '/offer-letter', label: 'Offer Letter', icon: Briefcase, app: '/offer-letter', section: 'hr' },
    { href: '/payslip', label: 'Payslip', icon: Receipt, app: '/payslip', section: 'hr' },
    { href: '/invoices', label: 'Saved Invoices', icon: ListOrdered, app: '/invoices', section: 'records' },
    { href: '/quotations', label: 'Saved Quotations', icon: FileSearch, app: '/quotations', section: 'records' },
    { href: '/delivery-challans', label: 'Saved Challans', icon: Truck, app: '/delivery-challans', hideIfNonNewRelic: true, section: 'records' },
    { href: '/products', label: 'Products Master', icon: Package, app: '/invoices', section: 'master' },
    { href: '/clients', label: 'Clients Directory', icon: User, app: '/invoices', section: 'master' },
    { href: '/settings', label: 'Company Settings', icon: Settings, app: '/settings', section: 'system' },
    { href: '/declarations', label: 'GST Declarations', icon: FileText, app: '/declarations', section: 'master' },
  ];

  const isAdmin = auth?.role === 'admin' || auth?.role === 'superadmin';
  const assignedApps = user?.assignedApps || [];

  const navItems = rawNavItems.filter((item) => {
    if (item.hideIfNonNewRelic && isNonNewRelic) return false;
    if (isAdmin) return true;
    if (assignedApps.length > 0 && item.app) {
      return assignedApps.includes(item.app);
    }
    return true;
  });

  return (
    <>
      {/* ── DESKTOP SIDEBAR ── */}
      <Sidebar variant="inset" collapsible="icon" className="border-r border-gray-200/80 bg-white">
        <SidebarHeader className="border-b border-gray-100 p-4">
          <div className="flex items-center justify-between group-data-[collapsible=icon]:justify-center">
            <Link
              href="/"
              className="flex items-center gap-2.5 group-data-[collapsible=icon]:hidden"
            >
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#181156] via-[#2a1d8f] to-[#3b2fc9] text-amber-300 flex items-center justify-center font-black shadow-md shadow-indigo-950/20 shrink-0">
                <FileText className="w-5 h-5 text-amber-300" />
              </div>
              <div>
                <h1 className="text-base font-black text-gray-900 tracking-tight leading-none">
                  InvoiceFlow
                </h1>
                <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider">
                  Enterprise Suite
                </span>
              </div>
            </Link>
            <SidebarTrigger className="group-data-[collapsible=icon]:hidden" />
          </div>

          {/* Quick DC Portal Switcher Pill on Desktop */}
          <div className="pt-2 group-data-[collapsible=icon]:hidden">
            <Link
              href={portalHref}
              onClick={() => triggerHaptic('light')}
              className="flex items-center justify-between p-2 rounded-xl bg-gradient-to-r from-purple-50 to-indigo-50 hover:from-purple-100 hover:to-indigo-100 border border-purple-200/80 text-[#3b2fc9] transition-all group/portal shadow-2xs"
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                <span className="text-xs font-bold truncate">{portalLabel}</span>
              </div>
              <ExternalLink className="w-3.5 h-3.5 text-[#3b2fc9] group-hover/portal:translate-x-0.5 transition-transform shrink-0" />
            </Link>
          </div>
        </SidebarHeader>

        <SidebarContent className="px-2 py-3">
          <SidebarMenu className="space-y-1">
            {navItems.map((item) => {
              const isActive = pathname === item.href;
              const Icon = item.icon;
              return (
                <SidebarMenuItem key={item.href}>
                  <Link href={item.href} passHref>
                    <SidebarMenuButton
                      isActive={isActive}
                      tooltip={{ children: item.label }}
                      onClick={() => {
                        triggerHaptic('light');
                        if (openMobile) setOpenMobile(false);
                      }}
                      className={`h-9 px-3 rounded-xl font-medium text-xs transition-all ${
                        isActive
                          ? 'bg-gradient-to-r from-indigo-50 to-violet-50 text-[#3b2fc9] font-bold border border-indigo-200/70 shadow-2xs'
                          : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100/70'
                      }`}
                    >
                      <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-[#3b2fc9]' : 'text-gray-400'}`} />
                      <span className="truncate">{item.label}</span>
                    </SidebarMenuButton>
                  </Link>
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
        </SidebarContent>

        <SidebarFooter className="border-t border-gray-100 p-3">
          <SidebarMenu className="space-y-1.5">
            <SidebarMenuItem>
              <div className="flex items-center gap-2.5 p-2 rounded-xl bg-gray-50 border border-gray-100">
                <Avatar className="h-8 w-8 rounded-lg bg-indigo-100 text-[#3b2fc9] font-bold text-xs shrink-0">
                  <AvatarFallback className="bg-indigo-100 text-[#3b2fc9]">
                    {user?.email?.[0]?.toUpperCase() || 'U'}
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-col min-w-0 group-data-[collapsible=icon]:hidden">
                  <span className="text-xs font-bold truncate text-gray-900">
                    {user?.email?.split('@')[0]}
                  </span>
                  <span className="text-[10px] text-gray-500 capitalize truncate">
                    {auth?.role || 'User'}
                  </span>
                </div>
              </div>
            </SidebarMenuItem>

            <SidebarMenuItem>
              <SidebarMenuButton
                tooltip={{ children: 'Sign Out' }}
                onClick={handleSignOut}
                className="h-8 text-xs font-semibold text-rose-600 hover:bg-rose-50 hover:text-rose-700 rounded-xl"
              >
                <LogOut className="w-3.5 h-3.5 text-rose-500 mr-2 shrink-0" />
                <span>Sign Out</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </Sidebar>

      {/* ── MAIN CONTENT INSET ── */}
      <SidebarInset className="bg-gray-50/40">
        {/* ── STICKY MOBILE TOP APP BAR (md:hidden) ── */}
        <header className="md:hidden sticky top-0 z-30 bg-[#181156] text-white px-3.5 py-2.5 shadow-md flex items-center justify-between border-b border-indigo-900/50">
          <div className="flex items-center gap-2">
            <SidebarTrigger className="text-white hover:bg-white/10 p-1.5 rounded-lg" />
            <Link
              href="/"
              onClick={() => triggerHaptic('light')}
              className="flex items-center gap-2"
            >
              <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-indigo-500 to-violet-500 flex items-center justify-center font-black text-amber-300 text-xs shadow-xs">
                IF
              </div>
              <span className="text-sm font-black tracking-tight text-white">
                InvoiceFlow
              </span>
            </Link>
          </div>

          <div className="flex items-center gap-2">
            {/* Direct 1-tap jump to NewRelic DC Portal on mobile */}
            <Link
              href={portalHref}
              onClick={() => triggerHaptic('light')}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-amber-400/20 hover:bg-amber-400/30 text-amber-300 border border-amber-300/35 text-xs font-bold active:scale-95 transition-transform"
              title="Switch to NewRelic DC Portal"
            >
              <Layers className="w-3 h-3 text-amber-300" />
              <span>DC Portal</span>
            </Link>

            <button
              type="button"
              onClick={handleSignOut}
              className="p-1.5 rounded-lg text-indigo-200 hover:text-white hover:bg-white/10"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* Page Content with safe mobile bottom padding */}
        <div className="flex-1 overflow-auto pb-24 md:pb-6">
          {children}
        </div>

        {/* ── FLOATING GLASSMORPHIC MOBILE BOTTOM NAVIGATION (md:hidden) ── */}
        <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 px-3 pb-[max(0.6rem,env(safe-area-inset-bottom))] pointer-events-none">
          <nav className="pointer-events-auto bg-white/95 backdrop-blur-xl border border-gray-250/70 shadow-[0_12px_36px_-6px_rgba(15,23,42,0.22)] rounded-2xl overflow-hidden ring-1 ring-black/5">
            <div className="flex items-center justify-around h-16 px-1 py-1">
              {/* Tab 1: Dashboard */}
              <Link
                href="/"
                onClick={() => triggerHaptic('light')}
                className={`flex-1 flex flex-col items-center justify-center py-1 transition-all active:scale-95 ${
                  pathname === '/' ? 'text-[#3b2fc9]' : 'text-gray-400 hover:text-gray-700'
                }`}
              >
                <LayoutDashboard className={`w-5 h-5 ${pathname === '/' ? 'stroke-[2.5]' : 'stroke-[1.8]'}`} />
                <span className={`text-[10px] mt-0.5 ${pathname === '/' ? 'font-black' : 'font-medium'}`}>
                  Dashboard
                </span>
              </Link>

              {/* Tab 2: Invoices */}
              <Link
                href="/invoices"
                onClick={() => triggerHaptic('light')}
                className={`flex-1 flex flex-col items-center justify-center py-1 transition-all active:scale-95 ${
                  pathname === '/invoices' ? 'text-[#3b2fc9]' : 'text-gray-400 hover:text-gray-700'
                }`}
              >
                <ListOrdered className={`w-5 h-5 ${pathname === '/invoices' ? 'stroke-[2.5]' : 'stroke-[1.8]'}`} />
                <span className={`text-[10px] mt-0.5 ${pathname === '/invoices' ? 'font-black' : 'font-medium'}`}>
                  Invoices
                </span>
              </Link>

              {/* Tab 3: Prominent Center (+) Creation Sheet Button */}
              <div className="flex items-center justify-center px-1">
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic('medium');
                    setShowCreateSheet(true);
                  }}
                  className="w-12 h-12 -mt-3 rounded-full bg-gradient-to-tr from-[#181156] via-[#2a1d8f] to-[#3b2fc9] text-amber-300 border-2 border-white/60 shadow-xl shadow-indigo-900/50 flex items-center justify-center active:scale-90 transition-transform"
                  aria-label="Create Document"
                  title="Create Document"
                >
                  <Plus className="w-6 h-6 stroke-[2.8]" />
                </button>
              </div>

              {/* Tab 4: Quotations */}
              <Link
                href="/quotations"
                onClick={() => triggerHaptic('light')}
                className={`flex-1 flex flex-col items-center justify-center py-1 transition-all active:scale-95 ${
                  pathname === '/quotations' ? 'text-[#3b2fc9]' : 'text-gray-400 hover:text-gray-700'
                }`}
              >
                <FileSearch className={`w-5 h-5 ${pathname === '/quotations' ? 'stroke-[2.5]' : 'stroke-[1.8]'}`} />
                <span className={`text-[10px] mt-0.5 ${pathname === '/quotations' ? 'font-black' : 'font-medium'}`}>
                  Quotes
                </span>
              </Link>

              {/* Tab 5: More Menu Sheet */}
              <button
                type="button"
                onClick={() => {
                  triggerHaptic('light');
                  setShowMoreSheet(true);
                }}
                className={`flex-1 flex flex-col items-center justify-center py-1 transition-all active:scale-95 ${
                  showMoreSheet ? 'text-[#3b2fc9]' : 'text-gray-400 hover:text-gray-700'
                }`}
              >
                <MoreHorizontal className="w-5 h-5 stroke-[1.8]" />
                <span className="text-[10px] font-medium mt-0.5">More</span>
              </button>
            </div>
          </nav>
        </div>

        {/* ── MOBILE CREATE ACTION SHEET ── */}
        {showCreateSheet && (
          <div className="fixed inset-0 z-50 flex flex-col justify-end md:hidden">
            <div
              className="absolute inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
              onClick={() => setShowCreateSheet(false)}
            />
            <div className="relative bg-white rounded-t-3xl p-5 pb-8 shadow-2xl space-y-3 animate-in slide-in-from-bottom duration-200">
              <div className="w-12 h-1.5 bg-gray-300 rounded-full mx-auto mb-2" />
              <div className="flex items-center justify-between pb-1">
                <h4 className="text-sm font-bold text-gray-900">Create New Document</h4>
                <button
                  onClick={() => setShowCreateSheet(false)}
                  className="p-1 text-gray-400 hover:text-gray-600 rounded-full"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="grid grid-cols-1 gap-2.5">
                <Link
                  href="/#invoice-form"
                  onClick={() => {
                    triggerHaptic('light');
                    setShowCreateSheet(false);
                  }}
                  className="flex items-center gap-3.5 p-3.5 rounded-2xl bg-gradient-to-r from-indigo-50/90 to-purple-50/80 border border-indigo-200/80 text-left active:scale-[0.99] transition-transform"
                >
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                    <FilePlus className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-indigo-950">New GST Invoice</p>
                    <p className="text-xs text-indigo-700">Calculate tax, discounts &amp; export PDF</p>
                  </div>
                </Link>

                <Link
                  href="/quotation"
                  onClick={() => {
                    triggerHaptic('light');
                    setShowCreateSheet(false);
                  }}
                  className="flex items-center gap-3.5 p-3.5 rounded-2xl bg-gradient-to-r from-amber-50/90 to-orange-50/80 border border-amber-200/80 text-left active:scale-[0.99] transition-transform"
                >
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-600 to-orange-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                    <FileSearch className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-amber-950">New Quotation / Proposal</p>
                    <p className="text-xs text-amber-700">Draft estimate &amp; share client quote</p>
                  </div>
                </Link>

                <Link
                  href="/delivery-challan"
                  onClick={() => {
                    triggerHaptic('light');
                    setShowCreateSheet(false);
                  }}
                  className="flex items-center gap-3.5 p-3.5 rounded-2xl bg-gradient-to-r from-blue-50/90 to-sky-50/80 border border-blue-200/80 text-left active:scale-[0.99] transition-transform"
                >
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-cyan-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                    <Truck className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-blue-950">New Delivery Challan</p>
                    <p className="text-xs text-blue-700">Standard material dispatch challan</p>
                  </div>
                </Link>

                <Link
                  href="/offer-letter"
                  onClick={() => {
                    triggerHaptic('light');
                    setShowCreateSheet(false);
                  }}
                  className="flex items-center gap-3.5 p-3 rounded-2xl bg-gray-50 border border-gray-200 text-left active:scale-[0.99] transition-transform"
                >
                  <div className="w-9 h-9 rounded-xl bg-gray-200 text-gray-700 flex items-center justify-center shrink-0">
                    <Briefcase className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-gray-800">New Offer Letter</p>
                    <p className="text-[11px] text-gray-500">Employment contract document</p>
                  </div>
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* ── MOBILE "MORE" NAVIGATION SHEET ── */}
        {showMoreSheet && (
          <div className="fixed inset-0 z-50 flex flex-col justify-end md:hidden">
            <div
              className="absolute inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
              onClick={() => setShowMoreSheet(false)}
            />
            <div className="relative bg-white rounded-t-3xl p-5 pb-8 shadow-2xl space-y-4 animate-in slide-in-from-bottom duration-200 max-h-[85vh] overflow-y-auto">
              <div className="w-12 h-1.5 bg-gray-300 rounded-full mx-auto" />
              <div className="flex items-center justify-between pb-1 border-b border-gray-100">
                <div>
                  <h4 className="text-sm font-bold text-gray-900">All Modules &amp; Tools</h4>
                  <p className="text-xs text-gray-400">Complete InvoiceFlow navigation</p>
                </div>
                <button
                  onClick={() => setShowMoreSheet(false)}
                  className="p-1.5 text-gray-400 hover:text-gray-600 rounded-full"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* NewRelic Portal Highlight */}
              <Link
                href={portalHref}
                onClick={() => {
                  triggerHaptic('medium');
                  setShowMoreSheet(false);
                }}
                className="flex items-center justify-between p-3.5 rounded-2xl bg-gradient-to-r from-slate-900 to-[#181156] text-white shadow-md active:scale-[0.98] transition-transform"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-400 to-orange-500 text-slate-950 flex items-center justify-center font-black">
                    <Layers className="w-5 h-5 text-slate-950" />
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <p className="text-xs font-bold text-amber-300 uppercase tracking-wider">
                        Operations Hub
                      </p>
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    </div>
                    <p className="text-sm font-extrabold text-white">
                      {portalLabel}
                    </p>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-indigo-300" />
              </Link>

              {/* Module Links Grid */}
              <div className="grid grid-cols-2 gap-2.5 pt-1">
                <Link
                  href="/delivery-challans"
                  onClick={() => {
                    triggerHaptic('light');
                    setShowMoreSheet(false);
                  }}
                  className="flex items-center gap-2.5 p-3 rounded-xl bg-gray-50 border border-gray-100 hover:bg-gray-100 transition-colors"
                >
                  <Truck className="w-4 h-4 text-blue-600 shrink-0" />
                  <span className="text-xs font-bold text-gray-800">Saved Challans</span>
                </Link>

                <Link
                  href="/products"
                  onClick={() => {
                    triggerHaptic('light');
                    setShowMoreSheet(false);
                  }}
                  className="flex items-center gap-2.5 p-3 rounded-xl bg-gray-50 border border-gray-100 hover:bg-gray-100 transition-colors"
                >
                  <Package className="w-4 h-4 text-purple-600 shrink-0" />
                  <span className="text-xs font-bold text-gray-800">Products</span>
                </Link>

                <Link
                  href="/clients"
                  onClick={() => {
                    triggerHaptic('light');
                    setShowMoreSheet(false);
                  }}
                  className="flex items-center gap-2.5 p-3 rounded-xl bg-gray-50 border border-gray-100 hover:bg-gray-100 transition-colors"
                >
                  <User className="w-4 h-4 text-indigo-600 shrink-0" />
                  <span className="text-xs font-bold text-gray-800">Clients</span>
                </Link>

                <Link
                  href="/settings"
                  onClick={() => {
                    triggerHaptic('light');
                    setShowMoreSheet(false);
                  }}
                  className="flex items-center gap-2.5 p-3 rounded-xl bg-gray-50 border border-gray-100 hover:bg-gray-100 transition-colors"
                >
                  <Settings className="w-4 h-4 text-gray-600 shrink-0" />
                  <span className="text-xs font-bold text-gray-800">Settings</span>
                </Link>

                <Link
                  href="/declarations"
                  onClick={() => {
                    triggerHaptic('light');
                    setShowMoreSheet(false);
                  }}
                  className="flex items-center gap-2.5 p-3 rounded-xl bg-gray-50 border border-gray-100 hover:bg-gray-100 transition-colors"
                >
                  <FileText className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span className="text-xs font-bold text-gray-800">GST Declarations</span>
                </Link>

                <Link
                  href="/payslip"
                  onClick={() => {
                    triggerHaptic('light');
                    setShowMoreSheet(false);
                  }}
                  className="flex items-center gap-2.5 p-3 rounded-xl bg-gray-50 border border-gray-100 hover:bg-gray-100 transition-colors"
                >
                  <Receipt className="w-4 h-4 text-amber-600 shrink-0" />
                  <span className="text-xs font-bold text-gray-800">Staff Payslips</span>
                </Link>
              </div>

              {/* User profile & Sign Out */}
              <div className="pt-2 border-t border-gray-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Avatar className="h-8 w-8 rounded-lg bg-indigo-100 text-[#3b2fc9] font-bold text-xs">
                    <AvatarFallback className="bg-indigo-100 text-[#3b2fc9]">
                      {user?.email?.[0]?.toUpperCase() || 'U'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-gray-900 truncate">
                      {user?.email}
                    </p>
                    <p className="text-[10px] text-gray-400 capitalize">
                      {auth?.role || 'User'}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleSignOut}
                  className="px-3 py-1.5 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100 text-xs font-bold flex items-center gap-1.5"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Sign Out</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </SidebarInset>
    </>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <AppShellContent>{children}</AppShellContent>
    </SidebarProvider>
  );
}
