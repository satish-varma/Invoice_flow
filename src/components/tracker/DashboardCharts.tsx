'use client';

import { useMemo } from 'react';
import { Invoice } from '@/lib/tracker/types';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface DashboardChartsProps {
  invoices: Invoice[];
}

const COLORS = ['#4f46e5', '#10b981', '#f59e0b', '#ec4899', '#3b82f6', '#8b5cf6'];

export function DashboardCharts({ invoices }: DashboardChartsProps) {
  const trendData = useMemo(() => {
    const grouped: Record<string, number> = {};
    invoices.forEach((inv) => {
      const dateKey = inv.date;
      grouped[dateKey] = (grouped[dateKey] || 0) + inv.amount;
    });

    return Object.entries(grouped)
      .map(([date, amount]) => ({ date, amount }))
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-14);
  }, [invoices]);

  const locationData = useMemo(() => {
    const grouped: Record<string, number> = {};
    invoices.forEach((inv) => {
      grouped[inv.location] = (grouped[inv.location] || 0) + inv.amount;
    });

    return Object.entries(grouped)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [invoices]);

  if (invoices.length === 0) return null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
      {/* Revenue Trend Chart */}
      <Card className="border border-gray-200 shadow-xs">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-bold text-gray-900">Daily Remittance Trend (Last 14 Days)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="w-full h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis
                  dataKey="date"
                  stroke="#94a3b8"
                  fontSize={11}
                  tickFormatter={(val) => {
                    const d = new Date(val);
                    return `${d.getDate()}/${d.getMonth() + 1}`;
                  }}
                />
                <YAxis
                  stroke="#94a3b8"
                  fontSize={11}
                  tickFormatter={(val) => `₹${(val / 1000).toFixed(0)}k`}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#ffffff',
                    borderColor: '#e2e8f0',
                    color: '#0f172a',
                    borderRadius: '0.375rem',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                  }}
                  itemStyle={{ color: '#4f46e5', fontWeight: 600 }}
                  cursor={{ fill: 'rgba(79, 70, 229, 0.05)' }}
                  formatter={(value: any) => [`₹${Number(value).toLocaleString()}`, 'Remittance']}
                  labelFormatter={(label) =>
                    new Date(label).toLocaleDateString(undefined, {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric',
                    })
                  }
                />
                <Bar dataKey="amount" fill="#4f46e5" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Location Share Pie Chart */}
      <Card className="border border-gray-200 shadow-xs">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-bold text-gray-900">Revenue Breakdown by Location</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="w-full h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={locationData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={90}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {locationData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: any) => [`₹${Number(value).toLocaleString()}`, 'Total']}
                  contentStyle={{
                    backgroundColor: '#ffffff',
                    borderColor: '#e2e8f0',
                    color: '#0f172a',
                    borderRadius: '0.375rem',
                  }}
                />
                <Legend
                  verticalAlign="bottom"
                  height={36}
                  formatter={(val, entry: any) => (
                    <span className="text-xs font-medium text-gray-700">{entry.payload?.name}</span>
                  )}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
