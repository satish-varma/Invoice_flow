'use client';

import React, { useMemo } from 'react';
import { NewRelicTuckshopRecord } from '@/services/newrelicTuckshopService';
import { Wallet, TrendingUp, TrendingDown, PieChart } from 'lucide-react';

interface Props {
  records: NewRelicTuckshopRecord[];
}

export const CATEGORY_STYLES: Record<string, { emoji: string; bg: string; text: string; border: string; bar: string }> = {
  'Dosa Batter': { 
    emoji: '🥞', 
    bg: 'bg-gradient-to-br from-[#fff7ed] via-[#fed7aa]/60 to-[#fdba74]/40', 
    text: 'text-[#9a3412]', 
    border: 'border-[#ea580c]/30', 
    bar: 'bg-gradient-to-r from-[#ea580c] to-[#c2410c]' 
  },
  'Bread': { 
    emoji: '🍞', 
    bg: 'bg-gradient-to-br from-[#fffbeb] via-[#fde68a]/60 to-[#fcd34d]/40', 
    text: 'text-[#92400e]', 
    border: 'border-[#f59e0b]/30', 
    bar: 'bg-gradient-to-r from-[#f59e0b] to-[#b45309]' 
  },
  'Fruits': { 
    emoji: '🍎', 
    bg: 'bg-gradient-to-br from-[#ecfdf5] via-[#a7f3d0]/60 to-[#6ee7b7]/40', 
    text: 'text-[#065f46]', 
    border: 'border-[#10b981]/30', 
    bar: 'bg-gradient-to-r from-[#10b981] to-[#047857]' 
  },
  'Vegetables': { 
    emoji: '🥦', 
    bg: 'bg-gradient-to-br from-[#f0fdf4] via-[#bbf7d0]/60 to-[#86efac]/40', 
    text: 'text-[#166534]', 
    border: 'border-[#22c55e]/30', 
    bar: 'bg-gradient-to-r from-[#22c55e] to-[#15803d]' 
  },
  'Groceries': { 
    emoji: '🛒', 
    bg: 'bg-gradient-to-br from-[#f5f3ff] via-[#ddd6fe]/60 to-[#c4b5fd]/40', 
    text: 'text-[#5b21b6]', 
    border: 'border-[#8b5cf6]/30', 
    bar: 'bg-gradient-to-r from-[#8b5cf6] to-[#6d28d9]' 
  },
  'Cutlery': { 
    emoji: '🍴', 
    bg: 'bg-gradient-to-br from-[#ecfeff] via-[#a5f3fc]/60 to-[#67e8f9]/40', 
    text: 'text-[#155e75]', 
    border: 'border-[#06b6d4]/30', 
    bar: 'bg-gradient-to-r from-[#06b6d4] to-[#0e7490]' 
  },
};

export function getCategoryBadge(category: string, type: 'expense' | 'sale') {
  if (type === 'sale') {
    return {
      emoji: '💰',
      label: category ? category.replace(/_/g, ' ') : 'Sale',
      color: 'text-emerald-900 bg-gradient-to-r from-emerald-50 to-teal-50 border-emerald-300',
    };
  }
  const lower = (category || '').toLowerCase().replace(/_/g, ' ');
  if (lower.includes('dosa') || lower.includes('batter')) {
    // Warm terracotta
    return { emoji: '🥞', label: 'Dosa Batter', color: 'text-[#9a3412] bg-gradient-to-r from-[#fff7ed] to-[#fed7aa] border-[#fb923c]' };
  }
  if (lower.includes('bread') || lower.includes('bakery')) {
    // Amber
    return { emoji: '🍞', label: 'Bakery / Bread', color: 'text-[#92400e] bg-gradient-to-r from-[#fffbeb] to-[#fde68a] border-[#fcd34d]' };
  }
  if (lower.includes('fruit')) {
    // Fresh emerald
    return { emoji: '🍎', label: 'Fruits', color: 'text-[#065f46] bg-gradient-to-r from-[#ecfdf5] to-[#a7f3d0] border-[#6ee7b7]' };
  }
  if (lower.includes('veg')) {
    // Fresh green
    return { emoji: '🥦', label: 'Vegetables', color: 'text-[#166534] bg-gradient-to-r from-[#f0fdf4] to-[#bbf7d0] border-[#86efac]' };
  }
  if (lower.includes('grocer') || lower.includes('provision')) {
    // Violet
    return { emoji: '🛒', label: 'Groceries', color: 'text-[#5b21b6] bg-gradient-to-r from-[#f5f3ff] to-[#ddd6fe] border-[#c4b5fd]' };
  }
  if (lower.includes('cutlery') || lower.includes('crockery') || lower.includes('supplies')) {
    // Cyan
    return { emoji: '🍴', label: 'Cutlery', color: 'text-[#155e75] bg-gradient-to-r from-[#ecfeff] to-[#a5f3fc] border-[#67e8f9]' };
  }
  if (lower.includes('milk') || lower.includes('dairy')) {
    return { emoji: '🥛', label: 'Dairy', color: 'text-sky-900 bg-gradient-to-r from-sky-50 to-blue-100 border-sky-300' };
  }
  return { emoji: '📦', label: category ? category.replace(/_/g, ' ') : 'Expense', color: 'text-slate-800 bg-gradient-to-r from-slate-50 to-gray-100 border-slate-300' };
}

export function TuckshopDashboard({ records }: Props) {
  const { totalSales, commission, netSales, totalExpenses, netProfit, expensesByCategory } = useMemo(() => {
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

    // 20% Tuckshop Sales Commission
    const commission = sales * 0.20;
    const netSales = sales - commission;
    const netProfit = netSales - expenses;

    // Sort categories by highest expense first
    const sorted = Object.entries(byCategory)
      .filter(([_, amount]) => amount > 0)
      .sort((a, b) => b[1] - a[1]);

    return {
      totalSales: sales,
      commission,
      netSales,
      totalExpenses: expenses,
      netProfit,
      expensesByCategory: sorted,
    };
  }, [records]);

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-4 sm:mb-8">
      {/* 1. Gross Sales */}
      <div className="bg-gradient-to-br from-emerald-50/90 via-white to-teal-50/50 rounded-2xl sm:rounded-3xl p-3.5 sm:p-5 border border-emerald-200/80 shadow-[0_4px_16px_-4px_rgba(0,0,0,0.06)] flex flex-col sm:flex-row items-start sm:items-center gap-2.5 sm:gap-4 transition-all hover:shadow-md">
        <div className="bg-gradient-to-tr from-emerald-600 to-teal-600 text-white w-10 h-10 sm:w-12 sm:h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-md shadow-emerald-950/20">
          <TrendingUp className="h-5 w-5 sm:h-6 sm:w-6" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-lg sm:text-2xl font-mono font-black text-emerald-950 tracking-tight truncate">₹{totalSales.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</p>
          <p className="text-[11px] sm:text-xs font-bold text-emerald-700 mt-0.5 truncate uppercase tracking-wider">Gross Sales</p>
          <p className="text-[10px] text-emerald-600/80 font-medium">Counter receipts</p>
        </div>
      </div>

      {/* 2. Net Sales (Less 20% Commission) */}
      <div className="bg-gradient-to-br from-teal-50/90 via-white to-cyan-50/50 rounded-2xl sm:rounded-3xl p-3.5 sm:p-5 border border-teal-200/80 shadow-[0_4px_16px_-4px_rgba(0,0,0,0.06)] flex flex-col sm:flex-row items-start sm:items-center gap-2.5 sm:gap-4 transition-all hover:shadow-md">
        <div className="bg-gradient-to-tr from-teal-600 to-cyan-600 text-white w-10 h-10 sm:w-12 sm:h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-md shadow-teal-950/20">
          <Wallet className="h-5 w-5 sm:h-6 sm:w-6" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-lg sm:text-2xl font-mono font-black text-teal-950 tracking-tight truncate">₹{netSales.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</p>
          <p className="text-[11px] sm:text-xs font-bold text-teal-700 mt-0.5 truncate uppercase tracking-wider">Net Rev (80%)</p>
          <p className="text-[10px] text-rose-500 font-bold truncate">-₹{commission.toLocaleString('en-IN', { maximumFractionDigits: 0 })} (20% comm)</p>
        </div>
      </div>

      {/* 3. Total Expenses */}
      <div className="bg-gradient-to-br from-rose-50/90 via-white to-red-50/50 rounded-2xl sm:rounded-3xl p-3.5 sm:p-5 border border-rose-200/80 shadow-[0_4px_16px_-4px_rgba(0,0,0,0.06)] flex flex-col sm:flex-row items-start sm:items-center gap-2.5 sm:gap-4 transition-all hover:shadow-md">
        <div className="bg-gradient-to-tr from-rose-600 to-red-600 text-white w-10 h-10 sm:w-12 sm:h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-md shadow-rose-950/20">
          <TrendingDown className="h-5 w-5 sm:h-6 sm:w-6" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-lg sm:text-2xl font-mono font-black text-rose-950 tracking-tight truncate">₹{totalExpenses.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</p>
          <p className="text-[11px] sm:text-xs font-bold text-rose-700 mt-0.5 truncate uppercase tracking-wider">Total Expenses</p>
          <p className="text-[10px] text-rose-600/80 font-medium truncate">Supplies & stock</p>
        </div>
      </div>

      {/* 4. Net Profit */}
      <div className={`rounded-2xl sm:rounded-3xl p-3.5 sm:p-5 border shadow-[0_4px_16px_-4px_rgba(0,0,0,0.06)] flex flex-col sm:flex-row items-start sm:items-center gap-2.5 sm:gap-4 transition-all hover:shadow-md ${
        netProfit >= 0
          ? 'bg-gradient-to-br from-indigo-50/90 via-white to-purple-50/50 border-indigo-200/80'
          : 'bg-gradient-to-br from-amber-50/90 via-white to-orange-50/50 border-amber-200/80'
      }`}>
        <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-md text-white ${
          netProfit >= 0
            ? 'bg-gradient-to-tr from-indigo-600 to-violet-600 shadow-indigo-950/20'
            : 'bg-gradient-to-tr from-amber-500 to-orange-500 shadow-amber-950/20'
        }`}>
          <Wallet className="h-5 w-5 sm:h-6 sm:w-6" />
        </div>
        <div className="min-w-0 flex-1">
          <p className={`text-lg sm:text-2xl font-mono font-black tracking-tight truncate ${
            netProfit >= 0 ? 'text-indigo-950' : 'text-amber-950'
          }`}>
            {netProfit >= 0 ? '+' : ''}₹{netProfit.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
          </p>
          <p className={`text-[11px] sm:text-xs font-bold mt-0.5 truncate uppercase tracking-wider ${
            netProfit >= 0 ? 'text-indigo-700' : 'text-amber-700'
          }`}>Net Profit</p>
          <p className="text-[10px] text-slate-500 font-medium truncate">Net Rev − Expenses</p>
        </div>
      </div>

      {/* Categories Breakdown */}
      <div className="col-span-2 lg:col-span-4 bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-5 border border-indigo-100 shadow-[0_4px_16px_-4px_rgba(0,0,0,0.04)]">
        <div className="flex items-center justify-between mb-3.5">
          <div className="flex items-center gap-2">
            <PieChart className="h-4 w-4 text-indigo-600" />
            <h3 className="text-xs sm:text-sm font-black text-slate-800 uppercase tracking-wider">Expense Breakdown by Category</h3>
          </div>
          <span className="text-[11px] font-black text-indigo-700 bg-indigo-50 px-2.5 py-0.5 rounded-full border border-indigo-100">
            {expensesByCategory.length} {expensesByCategory.length === 1 ? 'category' : 'categories'}
          </span>
        </div>

        {expensesByCategory.length === 0 ? (
          <p className="text-xs text-slate-400 py-2">No expenses recorded for the selected period.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 sm:gap-3">
            {expensesByCategory.map(([cat, amount]) => {
              const pct = totalExpenses > 0 ? Math.round((amount / totalExpenses) * 100) : 0;
              const normalizedCat = cat.toLowerCase();
              let style = CATEGORY_STYLES[cat];
              if (!style) {
                if (normalizedCat.includes('dosa') || normalizedCat.includes('batter')) style = CATEGORY_STYLES['Dosa Batter'];
                else if (normalizedCat.includes('bread') || normalizedCat.includes('bakery')) style = CATEGORY_STYLES['Bread'];
                else if (normalizedCat.includes('fruit')) style = CATEGORY_STYLES['Fruits'];
                else if (normalizedCat.includes('veg')) style = CATEGORY_STYLES['Vegetables'];
                else if (normalizedCat.includes('grocer') || normalizedCat.includes('provision')) style = CATEGORY_STYLES['Groceries'];
                else if (normalizedCat.includes('cutlery') || normalizedCat.includes('crockery') || normalizedCat.includes('supplies')) style = CATEGORY_STYLES['Cutlery'];
                else style = { emoji: '📦', bg: 'bg-gradient-to-br from-slate-50 via-gray-100 to-slate-100', text: 'text-slate-900', border: 'border-slate-300', bar: 'bg-slate-500' };
              }

              return (
                <div key={cat} className={`${style.bg} rounded-2xl p-3.5 border ${style.border} flex flex-col justify-between transition-all hover:scale-[1.03] shadow-xs`}>
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
