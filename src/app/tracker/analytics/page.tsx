'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Invoice } from '@/lib/tracker/types';
import { TrackerHeader } from '@/components/tracker/TrackerHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  Legend,
} from 'recharts';
import { RefreshCw, BarChart2, TrendingUp, PieChart as PieIcon } from 'lucide-react';

const COLORS = ['#4f46e5', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4'];

export default function TrackerAnalyticsPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch(`/api/tracker/invoices?t=${Date.now()}`, {
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            Pragma: 'no-cache',
          },
        });
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          setInvoices(json.data);
        }
      } catch (e) {
        console.error('Failed to load analytics data', e);
      } finally {
        setIsLoading(false);
      }
    }
    fetchData();
  }, []);

  // Monthly revenue aggregation
  const monthlyData = useMemo(() => {
    const map: Record<string, number> = {};
    invoices.forEach((inv) => {
      const ym = inv.date ? inv.date.substring(0, 7) : 'Unknown';
      map[ym] = (map[ym] || 0) + inv.amount;
    });

    return Object.entries(map)
      .map(([month, amount]) => ({ month, amount }))
      .sort((a, b) => a.month.localeCompare(b.month));
  }, [invoices]);

  // Top stalls aggregation
  const topStallsData = useMemo(() => {
    const map: Record<string, number> = {};
    invoices.forEach((inv) => {
      map[inv.stall] = (map[inv.stall] || 0) + inv.amount;
    });

    return Object.entries(map)
      .map(([stall, amount]) => ({ stall, amount }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 8);
  }, [invoices]);

  // Status breakdown
  const statusData = useMemo(() => {
    let paid = 0;
    let pending = 0;
    invoices.forEach((inv) => {
      if (inv.status === 'Paid') paid += inv.amount;
      else pending += inv.amount;
    });

    return [
      { name: 'Paid / Settled', value: paid },
      { name: 'Pending Settlement', value: pending },
    ];
  }, [invoices]);

  return (
    <div className="space-y-6">
      <TrackerHeader
        title="Cash & Carry Analytics"
        subtitle="Deep dive financial inflow, stall payouts, and settlement distribution."
        count={invoices.length}
        badge="Analytics"
      />

      {isLoading ? (
        <div className="p-16 text-center text-slate-500 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800">
          <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-indigo-600" />
          <p className="text-xs font-bold">Computing remittance analytics...</p>
        </div>
      ) : (
        <>
          {/* Monthly Trend Area Chart */}
          <div className="rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-black text-slate-900 dark:text-white">Monthly Remittance Inflow</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">Historical bi-weekly payout advice totals</p>
              </div>
              <div className="h-10 w-10 bg-indigo-50 dark:bg-indigo-950/50 text-[#3b2fc9] rounded-2xl flex items-center justify-center">
                <TrendingUp className="h-5 w-5" />
              </div>
            </div>
            <div className="w-full h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={monthlyData}>
                  <defs>
                    <linearGradient id="colorAmount" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b2fc9" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#3b2fc9" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="month" stroke="#94a3b8" fontSize={11} />
                  <YAxis
                    stroke="#94a3b8"
                    fontSize={11}
                    tickFormatter={(val) => `₹${(val / 1000).toFixed(0)}k`}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#ffffff',
                      borderColor: '#e2e8f0',
                      borderRadius: '0.75rem',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                    }}
                    formatter={(val: any) => [`₹${Number(val).toLocaleString()}`, 'Remittance Total']}
                  />
                  <Area
                    type="monotone"
                    dataKey="amount"
                    stroke="#3b2fc9"
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill="url(#colorAmount)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Top Stalls Chart */}
            <div className="rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm p-5 sm:p-6 space-y-4">
              <div>
                <h3 className="text-base font-black text-slate-900 dark:text-white">Top Performing Stalls</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">Highest grossing counters across all corporate sites</p>
              </div>
              <div className="w-full h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={topStallsData} layout="vertical" margin={{ left: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                    <XAxis
                      type="number"
                      stroke="#94a3b8"
                      fontSize={11}
                      tickFormatter={(val) => `₹${(val / 1000).toFixed(0)}k`}
                    />
                    <YAxis dataKey="stall" type="category" stroke="#94a3b8" fontSize={10} width={110} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#ffffff',
                        borderColor: '#e2e8f0',
                        borderRadius: '0.75rem',
                      }}
                      formatter={(val: any) => [`₹${Number(val).toLocaleString()}`, 'Total Revenue']}
                    />
                    <Bar dataKey="amount" fill="#3b2fc9" radius={[0, 6, 6, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Settlement Status Ratio */}
            <div className="rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm p-5 sm:p-6 space-y-4">
              <div>
                <h3 className="text-base font-black text-slate-900 dark:text-white">Settlement Status Ratio</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">Paid vs Pending Remittances by value</p>
              </div>
              <div className="w-full h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={statusData}
                      cx="50%"
                      cy="50%"
                      innerRadius={65}
                      outerRadius={95}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      <Cell fill="#10b981" />
                      <Cell fill="#f59e0b" />
                    </Pie>
                    <Tooltip
                      formatter={(value: any) => [`₹${Number(value).toLocaleString()}`, 'Amount']}
                      contentStyle={{
                        backgroundColor: '#ffffff',
                        borderColor: '#e2e8f0',
                        borderRadius: '0.75rem',
                      }}
                    />
                    <Legend
                      verticalAlign="bottom"
                      height={36}
                      formatter={(val) => <span className="text-xs font-bold text-slate-700 dark:text-slate-300">{val}</span>}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
