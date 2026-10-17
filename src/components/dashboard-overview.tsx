"use client";

import React from 'react';
import Link from 'next/link';
import { Invoice } from '@/services/invoiceService';
import { Settings } from '@/services/settingsService';
import { Quotation } from '@/services/quotationService';
import { Challan } from '@/services/challanService';
import {
  IndianRupee,
  FileText,
  TrendingUp,
  Calendar,
  CreditCard,
  FileSearch,
  Truck,
  ArrowUpRight,
  Sparkles,
  FilePlus,
  Layers,
  ArrowRight
} from 'lucide-react';
import { triggerHaptic } from '@/lib/haptics';

interface DashboardOverviewProps {
  invoices: Invoice[];
  quotations?: Quotation[];
  challans?: Challan[];
  settings: Settings | null;
  onNewInvoice?: () => void;
}

export function DashboardOverview({
  invoices,
  quotations = [],
  challans = [],
  settings,
  onNewInvoice,
}: DashboardOverviewProps) {
  const currencySymbol = settings?.currencySymbol || '₹';
  const totalRevenue = invoices.reduce((acc, inv) => acc + (inv.total || 0), 0);
  const invoiceCount = invoices.length;
  const quotationCount = quotations.length;
  const challanCount = challans.length;

  // Calculate current month's revenue
  const now = new Date();
  const currentMonthInvoices = invoices.filter((inv) => {
    const invDate = new Date(inv.date);
    return (
      invDate.getMonth() === now.getMonth() &&
      invDate.getFullYear() === now.getFullYear()
    );
  });
  const currentMonthRevenue = currentMonthInvoices.reduce(
    (acc, inv) => acc + (inv.total || 0),
    0
  );
  const unpaidRevenue = invoices
    .filter((inv) => inv.status === 'pending' || !inv.status)
    .reduce((acc, inv) => acc + (inv.total || 0), 0);
  const paidCount = invoices.filter((inv) => inv.status === 'paid').length;

  const stats = [
    {
      title: 'Total Revenue',
      value: `${currencySymbol}${totalRevenue.toLocaleString('en-IN', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      })}`,
      icon: TrendingUp,
      description: 'Lifetime billed amount',
      color: 'from-indigo-600 via-indigo-700 to-violet-700',
      iconBg: 'bg-indigo-600 text-white shadow-indigo-300/40',
      cardBg: 'bg-gradient-to-br from-indigo-50/90 via-white to-purple-50/40 border-indigo-200/80',
      badge: 'Lifetime',
      badgeClass: 'bg-indigo-100 text-indigo-800 border-indigo-200',
    },
    {
      title: `${now.toLocaleString('default', { month: 'short' })} Revenue`,
      value: `${currencySymbol}${currentMonthRevenue.toLocaleString('en-IN', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      })}`,
      icon: Calendar,
      description: `${currentMonthInvoices.length} invoices this month`,
      color: 'from-emerald-600 via-emerald-700 to-teal-700',
      iconBg: 'bg-emerald-600 text-white shadow-emerald-300/40',
      cardBg: 'bg-gradient-to-br from-emerald-50/90 via-white to-teal-50/40 border-emerald-200/80',
      badge: 'Active Month',
      badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    },
    {
      title: 'Pending Collections',
      value: `${currencySymbol}${unpaidRevenue.toLocaleString('en-IN', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      })}`,
      icon: CreditCard,
      description: `${invoices.length - paidCount} pending clearance`,
      color: 'from-rose-600 via-rose-700 to-red-700',
      iconBg: 'bg-rose-600 text-white shadow-rose-300/40',
      cardBg: 'bg-gradient-to-br from-rose-50/90 via-white to-orange-50/40 border-rose-200/80',
      badge: 'Unpaid',
      badgeClass: 'bg-rose-100 text-rose-800 border-rose-200',
    },
    {
      title: 'Total Invoices',
      value: invoiceCount.toString(),
      icon: FileText,
      description: `${paidCount} settled / ${invoiceCount - paidCount} pending`,
      color: 'from-purple-600 via-purple-700 to-pink-700',
      iconBg: 'bg-purple-600 text-white shadow-purple-300/40',
      cardBg: 'bg-gradient-to-br from-purple-50/90 via-white to-fuchsia-50/40 border-purple-200/80',
      badge: 'Invoices',
      badgeClass: 'bg-purple-100 text-purple-800 border-purple-200',
    },
    {
      title: 'Quotations',
      value: quotationCount.toString(),
      icon: FileSearch,
      description: 'Business proposals & quotes',
      color: 'from-amber-600 via-amber-700 to-orange-700',
      iconBg: 'bg-amber-600 text-white shadow-amber-300/40',
      cardBg: 'bg-gradient-to-br from-amber-50/90 via-white to-yellow-50/40 border-amber-200/80',
      badge: 'Proposals',
      badgeClass: 'bg-amber-100 text-amber-800 border-amber-200',
    },
    {
      title: 'Delivery Challans',
      value: challanCount.toString(),
      icon: Truck,
      description: 'Standard dispatch documents',
      color: 'from-blue-600 via-blue-700 to-cyan-700',
      iconBg: 'bg-blue-600 text-white shadow-blue-300/40',
      cardBg: 'bg-gradient-to-br from-blue-50/90 via-white to-sky-50/40 border-blue-200/80',
      badge: 'Challans',
      badgeClass: 'bg-blue-100 text-blue-800 border-blue-200',
    },
  ];

  return (
    <div className="space-y-6">
      {/* ── Enterprise Hero Banner ── */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-slate-950 via-[#181156] to-[#251b85] text-white p-5 sm:p-7 shadow-xl shadow-indigo-950/20 border border-indigo-900/40">
        <div className="absolute top-0 right-0 -mt-6 -mr-6 w-56 h-56 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 -mb-10 w-64 h-64 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div className="space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-white/10 text-amber-300 border border-amber-300/25 backdrop-blur-md">
                <Sparkles className="w-3.5 h-3.5" />
                InvoiceFlow Enterprise Hub
              </span>
              <span className="text-[11px] text-indigo-200 font-medium">
                {now.toLocaleDateString('en-IN', {
                  weekday: 'short',
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                })}
              </span>
            </div>

            <h1 className="text-xl sm:text-3xl font-black tracking-tight text-white">
              Billing, Invoices &amp; Multi-Document Ledger
            </h1>
            <p className="text-xs sm:text-sm text-indigo-200/80 max-w-2xl font-normal leading-relaxed">
              Create GST invoices, quotations, delivery challans, and track payment collections in real time.
            </p>
          </div>

          {/* Quick Switch to NewRelic DC Portal */}
          <Link
            href="/newrelic"
            prefetch={false}
            onClick={() => triggerHaptic('light')}
            className="group relative flex items-center gap-3 p-3.5 sm:p-4 rounded-2xl bg-gradient-to-br from-white/10 via-white/5 to-white/10 hover:from-white/15 hover:to-white/20 border border-white/20 backdrop-blur-xl transition-all shadow-lg active:scale-[0.98] shrink-0"
          >
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-400 to-orange-500 text-slate-950 flex items-center justify-center font-black shadow-md shrink-0 group-hover:scale-105 transition-transform">
              <Layers className="w-5 h-5 text-slate-950 stroke-[2.2]" />
            </div>
            <div className="min-w-0 pr-1">
              <div className="flex items-center gap-1.5">
                <p className="text-xs font-bold text-amber-300 uppercase tracking-wider">
                  NewRelic Operations
                </p>
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              </div>
              <p className="text-sm font-extrabold text-white truncate group-hover:text-amber-200 transition-colors">
                Returnable DC &amp; Tuckshop Portal
              </p>
            </div>
            <ArrowRight className="w-4 h-4 text-white/70 group-hover:translate-x-1 group-hover:text-white transition-all shrink-0 ml-1" />
          </Link>
        </div>
      </div>

      {/* ── KPI Stat Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 sm:gap-4">
        {stats.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <div
              key={index}
              className={`relative overflow-hidden rounded-2xl sm:rounded-3xl border p-4 shadow-[0_4px_16px_-4px_rgba(0,0,0,0.06)] hover:shadow-md transition-all active:scale-[0.98] ${stat.cardBg}`}
            >
              <div className="flex items-center justify-between mb-2.5">
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase tracking-wider ${stat.badgeClass}`}
                >
                  {stat.badge}
                </span>
                <div
                  className={`w-8 h-8 rounded-xl flex items-center justify-center shadow-xs shrink-0 ${stat.iconBg}`}
                >
                  <Icon className="w-4 h-4" />
                </div>
              </div>

              <p className="text-xs font-semibold text-slate-500 truncate">
                {stat.title}
              </p>
              <p className="text-lg sm:text-2xl font-black text-slate-900 tracking-tight font-mono tabular-nums mt-1">
                {stat.value}
              </p>
              <p className="text-[11px] text-slate-400 font-medium truncate mt-1">
                {stat.description}
              </p>
            </div>
          );
        })}
      </div>

      {/* ── Fast Navigation Quick Action Chips ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
        <button
          type="button"
          onClick={() => {
            triggerHaptic('medium');
            onNewInvoice?.();
          }}
          className="flex items-center gap-2.5 p-3.5 rounded-2xl bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 border border-slate-200/80 dark:border-slate-800 shadow-xs hover:border-[#3b2fc9]/40 transition-all active:scale-[0.96] group text-left w-full cursor-pointer"
        >
          <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 group-hover:bg-indigo-100 dark:group-hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-400 flex items-center justify-center shrink-0 transition-colors">
            <FilePlus className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-bold text-slate-900 dark:text-white truncate">New Invoice</p>
            <p className="text-[10px] text-slate-400 truncate">Create GST invoice</p>
          </div>
        </button>

        <Link
          href="/quotation"
          onClick={() => triggerHaptic('light')}
          className="flex items-center gap-2.5 p-3.5 rounded-2xl bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 border border-slate-200/80 dark:border-slate-800 shadow-xs hover:border-amber-500/40 transition-all active:scale-[0.96] group"
        >
          <div className="w-9 h-9 rounded-xl bg-amber-50 dark:bg-amber-950/60 group-hover:bg-amber-100 dark:group-hover:bg-amber-900/60 text-amber-700 dark:text-amber-400 flex items-center justify-center shrink-0 transition-colors">
            <FileSearch className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-bold text-slate-900 dark:text-white truncate">New Quotation</p>
            <p className="text-[10px] text-slate-400 truncate">Send proposal quote</p>
          </div>
        </Link>

        <Link
          href="/delivery-challan"
          onClick={() => triggerHaptic('light')}
          className="flex items-center gap-2.5 p-3.5 rounded-2xl bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 border border-slate-200/80 dark:border-slate-800 shadow-xs hover:border-cyan-500/40 transition-all active:scale-[0.96] group"
        >
          <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950/60 group-hover:bg-blue-100 dark:group-hover:bg-blue-900/60 text-blue-700 dark:text-blue-400 flex items-center justify-center shrink-0 transition-colors">
            <Truck className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-bold text-slate-900 dark:text-white truncate">Delivery Challan</p>
            <p className="text-[10px] text-slate-400 truncate">Dispatch goods</p>
          </div>
        </Link>

        <Link
          href="/invoices"
          onClick={() => triggerHaptic('light')}
          className="flex items-center gap-2.5 p-3.5 rounded-2xl bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 border border-slate-200/80 dark:border-slate-800 shadow-xs hover:border-purple-500/40 transition-all active:scale-[0.96] group"
        >
          <div className="w-9 h-9 rounded-xl bg-purple-50 dark:bg-purple-950/60 group-hover:bg-purple-100 dark:group-hover:bg-purple-900/60 text-purple-700 dark:text-purple-400 flex items-center justify-center shrink-0 transition-colors">
            <FileText className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-bold text-slate-900 dark:text-white truncate">All Invoices</p>
            <p className="text-[10px] text-slate-400 truncate">Filter &amp; bulk export</p>
          </div>
        </Link>
      </div>
    </div>
  );
}
