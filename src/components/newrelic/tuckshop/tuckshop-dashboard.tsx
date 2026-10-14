'use client';

import React, { useMemo } from 'react';
import { NewRelicTuckshopRecord } from '@/services/newrelicTuckshopService';
import { Wallet, TrendingUp, TrendingDown, PieChart } from 'lucide-react';

interface Props {
  records: NewRelicTuckshopRecord[];
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
    <div className="grid grid-cols-3 sm:grid-cols-3 gap-2 sm:gap-6 mb-6 sm:mb-8">
      {/* Total Sales */}
      <div className="bg-white rounded-xl sm:rounded-2xl p-2.5 sm:p-5 border border-gray-200 shadow-xs sm:shadow-sm flex flex-col sm:flex-row items-start sm:items-center gap-1.5 sm:gap-4">
        <div className="bg-green-100 text-green-600 p-1.5 sm:p-3 rounded-lg sm:rounded-xl shrink-0">
          <TrendingUp className="h-4 w-4 sm:h-6 sm:w-6" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm sm:text-2xl font-bold text-gray-900 truncate">₹{totalSales.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</p>
          <p className="text-[10px] sm:text-sm font-medium text-gray-500 mt-0.5 truncate">Total Sales</p>
        </div>
      </div>

      {/* Total Expenses */}
      <div className="bg-white rounded-xl sm:rounded-2xl p-2.5 sm:p-5 border border-gray-200 shadow-xs sm:shadow-sm flex flex-col sm:flex-row items-start sm:items-center gap-1.5 sm:gap-4">
        <div className="bg-red-100 text-red-600 p-1.5 sm:p-3 rounded-lg sm:rounded-xl shrink-0">
          <TrendingDown className="h-4 w-4 sm:h-6 sm:w-6" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm sm:text-2xl font-bold text-gray-900 truncate">₹{totalExpenses.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</p>
          <p className="text-[10px] sm:text-sm font-medium text-gray-500 mt-0.5 truncate">Total Expenses</p>
        </div>
      </div>

      {/* Net Profit */}
      <div className="bg-white rounded-xl sm:rounded-2xl p-2.5 sm:p-5 border border-gray-200 shadow-xs sm:shadow-sm flex flex-col sm:flex-row items-start sm:items-center gap-1.5 sm:gap-4">
        <div className={`p-1.5 sm:p-3 rounded-lg sm:rounded-xl shrink-0 ${netProfit >= 0 ? 'bg-blue-100 text-[#3b2fc9]' : 'bg-orange-100 text-orange-600'}`}>
          <Wallet className="h-4 w-4 sm:h-6 sm:w-6" />
        </div>
        <div className="min-w-0 flex-1">
          <p className={`text-sm sm:text-2xl font-bold truncate ${netProfit >= 0 ? 'text-gray-900' : 'text-orange-600'}`}>
            {netProfit >= 0 ? '+' : ''}₹{netProfit.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
          </p>
          <p className="text-[10px] sm:text-sm font-medium text-gray-500 mt-0.5 truncate">Net Profit</p>
        </div>
      </div>

      {/* Categories Breakdown (Spans across all columns on mobile and desktop) */}
      <div className="col-span-3 bg-white rounded-xl sm:rounded-2xl p-3.5 sm:p-5 border border-gray-200 shadow-xs sm:shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <PieChart className="h-4 w-4 text-[#3b2fc9]" />
            <h3 className="text-xs sm:text-sm font-semibold text-gray-800 uppercase tracking-wider">Expense Breakdown</h3>
          </div>
          <span className="text-[11px] text-gray-400 font-medium">
            {expensesByCategory.length} {expensesByCategory.length === 1 ? 'category' : 'categories'}
          </span>
        </div>

        {expensesByCategory.length === 0 ? (
          <p className="text-xs text-gray-400 py-2">No expenses recorded for the selected period.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-3">
            {expensesByCategory.map(([cat, amount]) => {
              const pct = totalExpenses > 0 ? Math.round((amount / totalExpenses) * 100) : 0;
              return (
                <div key={cat} className="bg-gray-50/80 rounded-xl p-2.5 border border-gray-100 flex flex-col justify-between">
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <p className="text-xs text-gray-600 font-medium truncate" title={cat}>{cat}</p>
                    <span className="text-[10px] font-bold text-gray-400">{pct}%</span>
                  </div>
                  <p className="font-bold text-gray-900 text-sm">₹{amount.toLocaleString('en-IN')}</p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
