'use client';

import React, { useMemo } from 'react';
import { NewRelicTuckshopRecord } from '@/services/newrelicTuckshopService';
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  Clock,
  Sparkles,
  Plus,
  IndianRupee,
  CalendarCheck2,
  Store,
} from 'lucide-react';
import { triggerHaptic } from '@/lib/haptics';
import { cn } from '@/lib/utils';

interface Props {
  records: NewRelicTuckshopRecord[];
  onOpenExpense?: () => void;
  onOpenSale?: () => void;
  siteName?: string;
}

export function TuckshopShiftPulse({
  records,
  onOpenExpense,
  onOpenSale,
  siteName,
}: Props) {
  const pulseData = useMemo(() => {
    const now = new Date();
    const localToday = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    let sales = 0;
    let salesCount = 0;
    let expenses = 0;
    let expensesCount = 0;
    let latestTodayRecord: NewRelicTuckshopRecord | null = null;

    for (const r of records) {
      const recDate = (r.date || '').split('T')[0];
      if (recDate === localToday) {
        if (r.type === 'sale') {
          sales += Number(r.amount) || 0;
          salesCount++;
        } else {
          expenses += Number(r.amount) || 0;
          expensesCount++;
        }
        if (!latestTodayRecord || (r.createdAt && latestTodayRecord.createdAt && r.createdAt > latestTodayRecord.createdAt)) {
          latestTodayRecord = r;
        }
      }
    }

    // Commission: 20%
    const commission = sales * 0.2;
    const netSales = sales - commission;
    const netProfit = netSales - expenses;
    const cashInHand = sales - expenses;

    return {
      sales,
      salesCount,
      expenses,
      expensesCount,
      commission,
      netSales,
      netProfit,
      cashInHand,
      latestTodayRecord,
      hasActivity: salesCount > 0 || expensesCount > 0,
      totalEntries: salesCount + expensesCount,
    };
  }, [records]);

  const formatCurrency = (amt: number) => {
    return `₹${Math.round(amt).toLocaleString('en-IN')}`;
  };

  return (
    <div className="w-full rounded-2xl sm:rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 p-4 sm:p-5 shadow-sm relative overflow-hidden transition-all">
      {/* Background soft glow */}
      <div className="absolute right-0 top-0 w-64 h-32 bg-indigo-500/5 dark:bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />

      {/* Header bar of the shift pulse */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3.5 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="relative flex items-center justify-center">
            <span className="w-3 h-3 rounded-full bg-emerald-500" />
            <span className="absolute w-3 h-3 rounded-full bg-emerald-400 animate-ping opacity-75" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-1.5">
                <Store className="w-4 h-4 text-[#3b2fc9] dark:text-indigo-400" />
                <span>Today's Counter Shift Pulse</span>
              </h3>
              {siteName && (
                <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-100 dark:border-indigo-900">
                  {siteName}
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
              Real-time daily register · {new Date().toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
            </p>
          </div>
        </div>

        {/* Quick action triggers */}
        <div className="flex items-center gap-2">
          {onOpenExpense && (
            <button
              type="button"
              onClick={() => {
                triggerHaptic('light');
                onOpenExpense();
              }}
              className="h-8 px-3 rounded-xl bg-rose-50 dark:bg-rose-950/60 hover:bg-rose-100 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900 text-xs font-bold flex items-center gap-1 transition-all active:scale-95"
            >
              <Plus className="w-3.5 h-3.5 text-rose-600" />
              <span>Expense</span>
            </button>
          )}

          {onOpenSale && (
            <button
              type="button"
              onClick={() => {
                triggerHaptic('light');
                onOpenSale();
              }}
              className="h-8 px-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900 text-xs font-bold flex items-center gap-1 transition-all active:scale-95"
            >
              <Plus className="w-3.5 h-3.5 text-emerald-600" />
              <span>Sale</span>
            </button>
          )}
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3.5 pt-3.5">
        {/* 1. Today's Gross Sales */}
        <div className="p-3 sm:p-4 rounded-2xl bg-gradient-to-br from-emerald-50/80 via-white to-teal-50/30 dark:from-emerald-950/30 dark:via-slate-800/80 dark:to-slate-800 border border-emerald-200/70 dark:border-emerald-900/60 shadow-2xs">
          <div className="flex items-center justify-between gap-1 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300 flex items-center gap-1">
              <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
              Today's Sales
            </span>
            <span className="text-[10px] font-black px-1.5 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200">
              {pulseData.salesCount} {pulseData.salesCount === 1 ? 'bill' : 'bills'}
            </span>
          </div>
          <p className="text-xl sm:text-2xl font-mono font-black text-emerald-950 dark:text-emerald-100 tracking-tight">
            {formatCurrency(pulseData.sales)}
          </p>
          <p className="text-[10px] text-emerald-700/80 dark:text-emerald-400 font-medium mt-0.5">
            Gross counter sales
          </p>
        </div>

        {/* 2. Today's Expenses */}
        <div className="p-3 sm:p-4 rounded-2xl bg-gradient-to-br from-rose-50/80 via-white to-red-50/30 dark:from-rose-950/30 dark:via-slate-800/80 dark:to-slate-800 border border-rose-200/70 dark:border-rose-900/60 shadow-2xs">
          <div className="flex items-center justify-between gap-1 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-rose-800 dark:text-rose-300 flex items-center gap-1">
              <TrendingDown className="w-3.5 h-3.5 text-rose-600" />
              Today's Expenses
            </span>
            <span className="text-[10px] font-black px-1.5 py-0.5 rounded-md bg-rose-100 dark:bg-rose-900/60 text-rose-800 dark:text-rose-200">
              {pulseData.expensesCount} items
            </span>
          </div>
          <p className="text-xl sm:text-2xl font-mono font-black text-rose-950 dark:text-rose-100 tracking-tight">
            {formatCurrency(pulseData.expenses)}
          </p>
          <p className="text-[10px] text-rose-700/80 dark:text-rose-400 font-medium mt-0.5">
            Raw materials &amp; supplies
          </p>
        </div>

        {/* 3. Shift Net Profit */}
        <div className={cn(
          "p-3 sm:p-4 rounded-2xl border shadow-2xs",
          pulseData.netProfit >= 0
            ? "bg-gradient-to-br from-indigo-50/80 via-white to-purple-50/30 dark:from-indigo-950/30 dark:via-slate-800/80 dark:to-slate-800 border-indigo-200/70 dark:border-indigo-900/60"
            : "bg-gradient-to-br from-amber-50/80 via-white to-orange-50/30 dark:from-amber-950/30 dark:via-slate-800/80 dark:to-slate-800 border-amber-200/70 dark:border-amber-900/60"
        )}>
          <div className="flex items-center justify-between gap-1 mb-1">
            <span className={cn(
              "text-[11px] font-bold uppercase tracking-wider flex items-center gap-1",
              pulseData.netProfit >= 0 ? "text-indigo-800 dark:text-indigo-300" : "text-amber-800 dark:text-amber-300"
            )}>
              <Wallet className="w-3.5 h-3.5" />
              Today's Net Profit
            </span>
            <span className={cn(
              "text-[10px] font-black px-1.5 py-0.5 rounded-md",
              pulseData.netProfit >= 0
                ? "bg-indigo-100 dark:bg-indigo-900/60 text-indigo-800 dark:text-indigo-200"
                : "bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-200"
            )}>
              Net (80%)
            </span>
          </div>
          <p className={cn(
            "text-xl sm:text-2xl font-mono font-black tracking-tight",
            pulseData.netProfit >= 0 ? "text-indigo-950 dark:text-indigo-100" : "text-amber-950 dark:text-amber-100"
          )}>
            {pulseData.netProfit >= 0 ? '+' : ''}{formatCurrency(pulseData.netProfit)}
          </p>
          <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium mt-0.5">
            After 20% commission
          </p>
        </div>

        {/* 4. Counter Cash Flow Balance */}
        <div className="p-3 sm:p-4 rounded-2xl bg-gradient-to-br from-slate-50 via-white to-slate-100/50 dark:from-slate-800 dark:to-slate-800/80 border border-slate-200/80 dark:border-slate-700 shadow-2xs">
          <div className="flex items-center justify-between gap-1 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1">
              <CalendarCheck2 className="w-3.5 h-3.5 text-slate-600 dark:text-slate-400" />
              Counter Cash Delta
            </span>
            <span className="text-[10px] font-black px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
              Drawer
            </span>
          </div>
          <p className="text-xl sm:text-2xl font-mono font-black text-slate-900 dark:text-white tracking-tight">
            {pulseData.cashInHand >= 0 ? '+' : ''}{formatCurrency(pulseData.cashInHand)}
          </p>
          <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium mt-0.5 truncate">
            {pulseData.latestTodayRecord ? (
              <span className="flex items-center gap-1">
                <Clock className="w-2.5 h-2.5 inline" />
                Latest: {pulseData.latestTodayRecord.category} ({pulseData.latestTodayRecord.createdBy || 'Staff'})
              </span>
            ) : (
              'Ready for shift entries'
            )}
          </p>
        </div>
      </div>
    </div>
  );
}
