'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  FileText,
  ShoppingBag,
  BarChart3,
  Settings,
  ArrowLeft,
  Wallet,
  RefreshCw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { triggerHaptic } from '@/lib/haptics';

interface TrackerHeaderProps {
  title?: string;
  subtitle?: string;
  badge?: string;
  count?: number | string;
  onSync?: () => void;
  isSyncing?: boolean;
  actions?: React.ReactNode;
}

export function TrackerHeader({
  title = 'Cash & Carry',
  subtitle = 'Payment invoices from HungerBox to GutGuru for employee-paid orders (received in 2 cycles per week).',
  badge = '2 Cycles / Week',
  count,
  onSync,
  isSyncing,
  actions,
}: TrackerHeaderProps) {
  const pathname = usePathname();

  const navItems = [
    { label: 'Overview', href: '/tracker', icon: LayoutDashboard, exact: true },
    { label: 'Remittances', href: '/tracker/invoices', icon: FileText },
    { label: 'Sales Feed', href: '/tracker/sales', icon: ShoppingBag },
    { label: 'Analytics', href: '/tracker/analytics', icon: BarChart3 },
    { label: 'Sync & Settings', href: '/tracker/settings', icon: Settings },
  ];

  return (
    <div className="space-y-4">
      {/* ── Top Bar: Back Button, Breadcrumb Badges & Action Buttons ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              asChild
              onClick={() => triggerHaptic('light')}
              className="h-9 rounded-2xl font-bold text-xs active:scale-95 transition-all border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xs hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              <Link href="/">
                <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
                Back
              </Link>
            </Button>

            <span className="uppercase text-[10px] sm:text-xs font-black tracking-widest text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-3 py-1 rounded-full border border-emerald-200/80 dark:border-emerald-800/60 inline-flex items-center gap-1.5 shadow-2xs">
              <Wallet className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
              Cash &amp; Carry • {badge}
            </span>

            {count !== undefined && (
              <span className="text-[11px] font-mono font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-2.5 py-1 rounded-full border border-slate-200 dark:border-slate-700 shadow-2xs">
                {count} Total
              </span>
            )}
          </div>

          <h1 className="text-2xl sm:text-4xl font-black text-slate-900 dark:text-white tracking-tight">
            {title}
          </h1>
          <p className="text-xs sm:text-sm font-medium text-slate-500 dark:text-slate-400 mt-1 max-w-3xl">
            {subtitle}
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          {actions}

          {onSync && (
            <Button
              onClick={() => {
                triggerHaptic('light');
                onSync();
              }}
              disabled={isSyncing}
              size="sm"
              className="h-10 px-4 rounded-2xl font-black text-xs bg-[#3b2fc9] hover:bg-[#2f24a8] text-white shadow-md active:scale-95 transition-all"
            >
              <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${isSyncing ? 'animate-spin' : ''}`} />
              {isSyncing ? 'Syncing...' : 'Quick Sync'}
            </Button>
          )}
        </div>
      </div>

      {/* ── Segmented Navigation Tabs ── */}
      <div className="p-1.5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 w-fit max-w-full overflow-x-auto no-scrollbar shadow-xs flex items-center gap-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = item.exact ? pathname === item.href : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => triggerHaptic('light')}
              className={`flex items-center gap-2 px-3.5 sm:px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all active:scale-95 ${
                isActive
                  ? 'bg-[#3b2fc9] text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {item.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
