'use client';

import React, { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import { NewRelicTuckshopRecord } from '@/services/newrelicTuckshopService';
import {
  TrendingUp,
  BarChart3,
  Calendar,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Wallet,
} from 'lucide-react';
import { triggerHaptic } from '@/lib/haptics';
import { cn } from '@/lib/utils';

interface Props {
  records: NewRelicTuckshopRecord[];
}

export function TuckshopTrendChart({ records }: Props) {
  const [daysCount, setDaysCount] = useState<14 | 30>(14);
  const [isExpanded, setIsExpanded] = useState(true);

  // Group records by day for the last N days
  const chartData = useMemo(() => {
    const dataMap: Record<string, { date: string; displayDate: string; sales: number; expenses: number; netProfit: number }> = {};
    const today = new Date();

    // Initialize all past N days
    for (let i = daysCount - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(today.getDate() - i);
      const isoKey = d.toISOString().split('T')[0];
      const displayDate = d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
      dataMap[isoKey] = {
        date: isoKey,
        displayDate,
        sales: 0,
        expenses: 0,
        netProfit: 0,
      };
    }

    // Accumulate records
    records.forEach((r) => {
      const key = (r.date || '').split('T')[0];
      if (dataMap[key]) {
        if (r.type === 'sale') {
          dataMap[key].sales += Number(r.amount) || 0;
        } else {
          dataMap[key].expenses += Number(r.amount) || 0;
        }
      }
    });

    // Calculate net profit (80% net sales - expenses)
    return Object.values(dataMap).map((d) => ({
      ...d,
      netProfit: Math.round(d.sales * 0.8 - d.expenses),
    }));
  }, [records, daysCount]);

  // Aggregate stats
  const totals = useMemo(() => {
    let sales = 0;
    let expenses = 0;
    let activeSalesDays = 0;

    chartData.forEach((d) => {
      sales += d.sales;
      expenses += d.expenses;
      if (d.sales > 0) activeSalesDays++;
    });

    const netSales = sales * 0.8;
    const netProfit = netSales - expenses;
    const avgDailySales = activeSalesDays > 0 ? Math.round(sales / activeSalesDays) : 0;
    const marginPct = sales > 0 ? Math.round((netProfit / sales) * 100) : 0;

    return { sales, expenses, netProfit, avgDailySales, marginPct };
  }, [chartData]);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const sales = payload.find((p: any) => p.dataKey === 'sales')?.value || 0;
      const expenses = payload.find((p: any) => p.dataKey === 'expenses')?.value || 0;
      const netProfit = payload.find((p: any) => p.dataKey === 'netProfit')?.value || 0;

      return (
        <div className="bg-slate-900/95 text-white p-3 rounded-2xl shadow-xl border border-white/15 text-xs backdrop-blur-md space-y-1.5 min-w-[170px]">
          <p className="font-bold text-slate-300 pb-1 border-b border-white/10">{label}</p>
          <div className="flex items-center justify-between gap-3 text-emerald-400">
            <span>Gross Sales:</span>
            <span className="font-mono font-bold">₹{sales.toLocaleString('en-IN')}</span>
          </div>
          <div className="flex items-center justify-between gap-3 text-rose-400">
            <span>Expenses:</span>
            <span className="font-mono font-bold">₹{expenses.toLocaleString('en-IN')}</span>
          </div>
          <div className="flex items-center justify-between gap-3 text-indigo-300 pt-1 border-t border-white/10">
            <span>Net Profit:</span>
            <span className="font-mono font-black">
              {netProfit >= 0 ? '+' : ''}₹{netProfit.toLocaleString('en-IN')}
            </span>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="w-full bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl border border-slate-200/90 dark:border-slate-800 p-4 sm:p-5 shadow-sm transition-all mb-4 sm:mb-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-[#3b2fc9] text-white flex items-center justify-center shadow-xs">
            <BarChart3 className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs sm:text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">
              {daysCount}-Day Counter Trends (Sales vs Expenses)
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
              Daily revenue trajectory, supply costs, and net margin
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Day span switcher */}
          <div className="flex items-center p-0.5 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200/80 dark:border-slate-700">
            <button
              type="button"
              onClick={() => {
                triggerHaptic('light');
                setDaysCount(14);
              }}
              className={cn(
                "px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all",
                daysCount === 14
                  ? "bg-white dark:bg-slate-900 text-indigo-700 dark:text-indigo-300 shadow-2xs"
                  : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
              )}
            >
              14 Days
            </button>
            <button
              type="button"
              onClick={() => {
                triggerHaptic('light');
                setDaysCount(30);
              }}
              className={cn(
                "px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all",
                daysCount === 30
                  ? "bg-white dark:bg-slate-900 text-indigo-700 dark:text-indigo-300 shadow-2xs"
                  : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
              )}
            >
              30 Days
            </button>
          </div>

          <button
            type="button"
            onClick={() => {
              triggerHaptic('light');
              setIsExpanded(!isExpanded);
            }}
            className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500"
            title={isExpanded ? 'Collapse chart' : 'Expand chart'}
          >
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="mt-4 space-y-4">
          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-800 text-xs">
            <div>
              <span className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase block">
                Period Sales
              </span>
              <span className="text-sm sm:text-base font-mono font-black text-emerald-700 dark:text-emerald-400">
                ₹{totals.sales.toLocaleString('en-IN')}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase block">
                Period Supplies
              </span>
              <span className="text-sm sm:text-base font-mono font-black text-rose-700 dark:text-rose-400">
                ₹{totals.expenses.toLocaleString('en-IN')}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase block">
                Avg Daily Sale
              </span>
              <span className="text-sm sm:text-base font-mono font-black text-indigo-700 dark:text-indigo-400">
                ₹{totals.avgDailySales.toLocaleString('en-IN')}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase block">
                Period Margin
              </span>
              <span className={cn(
                "text-sm sm:text-base font-mono font-black",
                totals.marginPct >= 0 ? "text-indigo-700 dark:text-indigo-400" : "text-amber-700 dark:text-amber-400"
              )}>
                {totals.marginPct}% ({totals.netProfit >= 0 ? '+' : ''}₹{totals.netProfit.toLocaleString('en-IN')})
              </span>
            </div>
          </div>

          {/* Chart Container */}
          <div className="h-64 sm:h-72 w-full pt-1">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="tuckshopSalesGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" opacity={0.6} />
                <XAxis
                  dataKey="displayDate"
                  tick={{ fontSize: 10, fill: '#64748b' }}
                  tickLine={false}
                  axisLine={{ stroke: '#cbd5e1' }}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: '#64748b' }}
                  tickLine={false}
                  axisLine={{ stroke: '#cbd5e1' }}
                  tickFormatter={(val) => `₹${val >= 1000 ? `${Math.round(val / 1000)}k` : val}`}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend
                  verticalAlign="top"
                  align="right"
                  wrapperStyle={{ fontSize: 11, paddingBottom: 8 }}
                  formatter={(value) => {
                    if (value === 'sales') return 'Gross Sales';
                    if (value === 'expenses') return 'Expenses';
                    if (value === 'netProfit') return 'Net Profit';
                    return value;
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="sales"
                  name="sales"
                  stroke="#10b981"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#tuckshopSalesGrad)"
                />
                <Bar
                  dataKey="expenses"
                  name="expenses"
                  fill="#f43f5e"
                  radius={[4, 4, 0, 0]}
                  barSize={10}
                />
                <Line
                  type="monotone"
                  dataKey="netProfit"
                  name="netProfit"
                  stroke="#4f46e5"
                  strokeWidth={2}
                  dot={{ r: 2, fill: '#4f46e5' }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}
