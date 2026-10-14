'use client';

import React, { useMemo } from 'react';
import { NewRelicTuckshopRecord } from '@/services/newrelicTuckshopService';
import { Wallet, TrendingUp, TrendingDown, PieChart } from 'lucide-react';

interface Props {
  records: NewRelicTuckshopRecord[];
}

export const CATEGORY_STYLES: Record<string, { emoji: string; bg: string; text: string; border: string; bar: string }> = {
  'Dosa Batter': { emoji: '🥞', bg: 'bg-amber-50/90', text: 'text-amber-950', border: 'border-amber-200', bar: 'bg-amber-500' },
  'Bread': { emoji: '🍞', bg: 'bg-orange-50/90', text: 'text-orange-950', border: 'border-orange-200', bar: 'bg-orange-500' },
  'Fruits': { emoji: '🍎', bg: 'bg-rose-50/90', text: 'text-rose-950', border: 'border-rose-200', bar: 'bg-rose-500' },
  'Vegetables': { emoji: '🥦', bg: 'bg-emerald-50/90', text: 'text-emerald-950', border: 'border-emerald-200', bar: 'bg-emerald-500' },
  'Groceries': { emoji: '🛒', bg: 'bg-indigo-50/90', text: 'text-indigo-950', border: 'border-indigo-200', bar: 'bg-indigo-500' },
  'Cutlery': { emoji: '🍴', bg: 'bg-cyan-50/90', text: 'text-cyan-950', border: 'border-cyan-200', bar: 'bg-cyan-500' },
};

export function getCategoryBadge(category: string, type: 'expense' | 'sale') {
  if (type === 'sale') {
    return {
      emoji: '💰',
      label: category ? category.replace(/_/g, ' ') : 'Sale',
      color: 'text-emerald-800 bg-emerald-50 border-emerald-200',
    };
  }
  const lower = (category || '').toLowerCase().replace(/_/g, ' ');
  if (lower.includes('dosa') || lower.includes('batter')) {
    return { emoji: '🥞', label: 'Dosa Batter', color: 'text-amber-800 bg-amber-50 border-amber-200' };
  }
  if (lower.includes('bread') || lower.includes('bakery')) {
    return { emoji: '🍞', label: 'Bakery / Bread', color: 'text-orange-800 bg-orange-50 border-orange-200' };
  }
  if (lower.includes('fruit')) {
    return { emoji: '🍎', label: 'Fruits', color: 'text-rose-800 bg-rose-50 border-rose-200' };
  }
  if (lower.includes('veg')) {
    return { emoji: '🥦', label: 'Vegetables', color: 'text-emerald-800 bg-emerald-50 border-emerald-200' };
  }
  if (lower.includes('grocer') || lower.includes('provision')) {
    return { emoji: '🛒', label: 'Groceries', color: 'text-indigo-800 bg-indigo-50 border-indigo-200' };
  }
  if (lower.includes('cutlery') || lower.includes('crockery') || lower.includes('supplies')) {
    return { emoji: '🍴', label: 'Cutlery', color: 'text-cyan-800 bg-cyan-50 border-cyan-200' };
  }
  if (lower.includes('milk') || lower.includes('dairy')) {
    return { emoji: '🥛', label: 'Dairy', color: 'text-sky-800 bg-sky-50 border-sky-200' };
  }
  return { emoji: '📦', label: category ? category.replace(/_/g, ' ') : 'Expense', color: 'text-slate-700 bg-slate-50 border-slate-200' };
}

export function TuckshopDashboard({ records }: Props) {
  const { totalSales, totalExpenses, netProfit, expensesByCategory } = useMemo(() => {
    let sales = 0;
    let expenses = 0;
    const byCategory: Record<string, number> = {};

    records.forEach(r => {
      if (r.type === 'sale') {
        sales += (r.amount || 0);
      } else {
        expenses += (r.amount || 0);
        // Normalize category name (e.g. "Dosa Batter", "dosa_batter", "Vegetables")
        const rawCat = (r.category || 'Other').trim();
        const normalized = rawCat.replace(/_/g, ' ');
        // Title case display
        const formattedCat = normalized.charAt(0).toUpperCase() + normalized.slice(1);
        byCategory[formattedCat] = (byCategory[formattedCat] || 0) + (r.amount || 0);
      }
    });

    // Sort categories by highest expense first
    const sorted = Object.entries(byCategory)
      .filter(([_, amount]) => amount > 0)
      .sort((a, b) => b[1] - a[1]);

    return {
      totalSales: sales,
      totalExpenses: expenses,
      netProfit: sales - expenses,
      expensesByCategory: sorted,
    };
  }, [records]);

  return (
    <div className="grid grid-cols-3 sm:grid-cols-3 gap-2.5 sm:gap-6 mb-6 sm:mb-8">
      {/* Total Sales */}
      <div className="bg-gradient-to-br from-emerald-50/90 via-white to-teal-50/50 rounded-2xl p-3 sm:p-5 border border-emerald-200/80 shadow-2xs sm:shadow-xs flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-4 transition-all hover:shadow-md">
        <div className="bg-gradient-to-tr from-emerald-600 to-teal-600 text-white p-2 sm:p-3 rounded-xl sm:rounded-2xl shrink-0 shadow-xs">
          <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-base sm:text-2xl font-black text-emerald-950 tracking-tight truncate">₹{totalSales.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</p>
          <p className="text-[11px] sm:text-xs font-bold text-emerald-700/80 mt-0.5 truncate">Total Sales</p>
        </div>
      </div>

      {/* Total Expenses */}
      <div className="bg-gradient-to-br from-rose-50/90 via-white to-red-50/50 rounded-2xl p-3 sm:p-5 border border-rose-200/80 shadow-2xs sm:shadow-xs flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-4 transition-all hover:shadow-md">
        <div className="bg-gradient-to-tr from-rose-600 to-red-600 text-white p-2 sm:p-3 rounded-xl sm:rounded-2xl shrink-0 shadow-xs">
          <TrendingDown className="h-4 w-4 sm:h-5 sm:w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-base sm:text-2xl font-black text-rose-950 tracking-tight truncate">₹{totalExpenses.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</p>
          <p className="text-[11px] sm:text-xs font-bold text-rose-700/80 mt-0.5 truncate">Total Expenses</p>
        </div>
      </div>

      {/* Net Profit */}
      <div className={`rounded-2xl p-3 sm:p-5 border shadow-2xs sm:shadow-xs flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-4 transition-all hover:shadow-md ${
        netProfit >= 0
          ? 'bg-gradient-to-br from-indigo-50/90 via-white to-purple-50/50 border-indigo-200/80'
          : 'bg-gradient-to-br from-amber-50/90 via-white to-orange-50/50 border-amber-200/80'
      }`}>
        <div className={`p-2 sm:p-3 rounded-xl sm:rounded-2xl shrink-0 shadow-xs text-white ${
          netProfit >= 0
            ? 'bg-gradient-to-tr from-indigo-600 to-violet-600'
            : 'bg-gradient-to-tr from-amber-500 to-orange-500'
        }`}>
          <Wallet className="h-4 w-4 sm:h-5 sm:w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className={`text-base sm:text-2xl font-black tracking-tight truncate ${
            netProfit >= 0 ? 'text-indigo-950' : 'text-amber-950'
          }`}>
            {netProfit >= 0 ? '+' : ''}₹{netProfit.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
          </p>
          <p className={`text-[11px] sm:text-xs font-bold mt-0.5 truncate ${
            netProfit >= 0 ? 'text-indigo-700/80' : 'text-amber-700/80'
          }`}>Net Profit</p>
        </div>
      </div>

      {/* Categories Breakdown */}
      <div className="col-span-3 bg-white rounded-2xl p-4 sm:p-5 border border-indigo-100/70 shadow-xs">
        <div className="flex items-center justify-between mb-3.5">
          <div className="flex items-center gap-2">
            <PieChart className="h-4 w-4 text-indigo-600" />
            <h3 className="text-xs sm:text-sm font-bold text-gray-800 uppercase tracking-wider">Expense Breakdown by Category</h3>
          </div>
          <span className="text-[11px] font-semibold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-100">
            {expensesByCategory.length} {expensesByCategory.length === 1 ? 'category' : 'categories'}
          </span>
        </div>

        {expensesByCategory.length === 0 ? (
          <p className="text-xs text-gray-400 py-2">No expenses recorded for the selected period.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 sm:gap-3">
            {expensesByCategory.map(([cat, amount]) => {
              const pct = totalExpenses > 0 ? Math.round((amount / totalExpenses) * 100) : 0;
              const style = CATEGORY_STYLES[cat] || { emoji: '📦', bg: 'bg-slate-50/90', text: 'text-slate-900', border: 'border-slate-200', bar: 'bg-slate-500' };

              return (
                <div key={cat} className={`${style.bg} rounded-xl p-3 border ${style.border} flex flex-col justify-between transition-all hover:scale-[1.02] shadow-2xs`}>
                  <div className="flex items-center justify-between gap-1 mb-1.5">
                    <span className="text-xs font-bold truncate flex items-center gap-1" title={cat}>
                      <span>{style.emoji}</span>
                      <span className={style.text}>{cat}</span>
                    </span>
                    <span className="text-[10px] font-black px-1.5 py-0.5 rounded-md bg-white/80 text-gray-700 border border-black/5">{pct}%</span>
                  </div>
                  <p className="font-black text-gray-950 text-sm">₹{amount.toLocaleString('en-IN')}</p>
                  {/* Visual progress bar */}
                  <div className="w-full bg-black/5 h-1.5 rounded-full mt-2 overflow-hidden">
                    <div className={`${style.bar} h-full rounded-full transition-all`} style={{ width: `${Math.min(100, Math.max(8, pct))}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
