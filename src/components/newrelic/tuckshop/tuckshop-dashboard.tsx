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
    const byCategory: Record<string, number> = {
      dosa_batter: 0,
      bread: 0,
      fruits: 0,
      groceries: 0,
      cutlery: 0,
      other: 0,
    };

    records.forEach(r => {
      if (r.type === 'sale') {
        sales += r.amount;
      } else {
        expenses += r.amount;
        if (byCategory[r.category] !== undefined) {
          byCategory[r.category] += r.amount;
        } else {
          byCategory['other'] += r.amount;
        }
      }
    });

    return {
      totalSales: sales,
      totalExpenses: expenses,
      netProfit: sales - expenses,
      expensesByCategory: byCategory,
    };
  }, [records]);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-8">
      {/* Total Sales */}
      <div className="bg-white rounded-2xl p-5 border border-gray-200 shadow-sm flex items-center gap-4">
        <div className="bg-green-100 text-green-600 p-3 rounded-xl shrink-0">
          <TrendingUp className="h-6 w-6" />
        </div>
        <div>
          <p className="text-2xl font-bold text-gray-900">₹{totalSales.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
          <p className="text-sm font-medium text-gray-500 mt-0.5">Total Sales</p>
        </div>
      </div>

      {/* Total Expenses */}
      <div className="bg-white rounded-2xl p-5 border border-gray-200 shadow-sm flex items-center gap-4">
        <div className="bg-red-100 text-red-600 p-3 rounded-xl shrink-0">
          <TrendingDown className="h-6 w-6" />
        </div>
        <div>
          <p className="text-2xl font-bold text-gray-900">₹{totalExpenses.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
          <p className="text-sm font-medium text-gray-500 mt-0.5">Total Expenses</p>
        </div>
      </div>

      {/* Net Profit */}
      <div className="bg-white rounded-2xl p-5 border border-gray-200 shadow-sm flex items-center gap-4">
        <div className={`p-3 rounded-xl shrink-0 ${netProfit >= 0 ? 'bg-blue-100 text-[#3b2fc9]' : 'bg-orange-100 text-orange-600'}`}>
          <Wallet className="h-6 w-6" />
        </div>
        <div>
          <p className="text-2xl font-bold text-gray-900">
            {netProfit >= 0 ? '+' : ''}₹{netProfit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </p>
          <p className="text-sm font-medium text-gray-500 mt-0.5">Net Profit</p>
        </div>
      </div>

      {/* Categories Breakdown (Spans across bottom) */}
      <div className="sm:col-span-3 bg-white rounded-2xl p-5 border border-gray-200 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <PieChart className="h-4 w-4 text-gray-400" />
          <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">Expense Breakdown</h3>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          {Object.entries(expensesByCategory).map(([cat, amount]) => (
            <div key={cat} className="bg-gray-50 rounded-lg p-3 border border-gray-100">
              <p className="text-xs text-gray-500 capitalize mb-1">{cat.replace('_', ' ')}</p>
              <p className="font-semibold text-gray-900 text-sm">₹{amount.toLocaleString('en-IN')}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
