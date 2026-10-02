'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { getNewRelicChallans } from '@/services/newrelicChallanService';
import { NewRelicChallan } from '@/types/challan';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2, ArrowLeft, BarChart2, DollarSign, TrendingUp, TrendingDown, PieChart as PieChartIcon } from 'lucide-react';
import Link from 'next/link';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, LineChart, Line, ComposedChart
} from 'recharts';
import { format } from 'date-fns';

const COLORS = ['#3b2fc9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

export default function AnalyticsDashboardPage() {
  const { role } = useAuth();
  const [challans, setChallans] = useState<NewRelicChallan[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const data = await getNewRelicChallans();
        setChallans(data);
      } catch (err) {
        console.error("Failed to load challans for analytics", err);
      } finally {
        setIsLoading(false);
      }
    }
    if (role === 'admin' || role === 'superadmin') {
      load();
    } else {
      setIsLoading(false); // Let it render empty or unauthorized
    }
  }, [role]);

  // Aggregate Data for Charts
  const monthlyData = useMemo(() => {
    const months: Record<string, { revenue: number, cost: number, profit: number, margin: number }> = {};
    
    challans.forEach(c => {
      const date = new Date(c.dcDate);
      const monthStr = date.toLocaleString('default', { month: 'short', year: '2-digit' });
      
      if (!months[monthStr]) months[monthStr] = { revenue: 0, cost: 0, profit: 0, margin: 0 };
      
      let itemCost = 0;
      const mrpTotal = (c.lineItems || []).reduce((sum, item: any) => {
        itemCost += (Number(item.procurementCost) || 0) * (Number(item.quantity) || 1);
        return sum + ((Number(item.mrp) || 0) * (Number(item.quantity) || 1));
      }, 0);
      
      const revenue = mrpTotal - (mrpTotal * 0.055);
      const cost = (c.procurementCost !== undefined && c.procurementCost !== null ? Number(c.procurementCost) : itemCost) 
                 + Number(c.transportCost || 0) 
                 + Number(c.otherCharges || 0);
      
      months[monthStr].revenue += revenue;
      months[monthStr].cost += cost;
      months[monthStr].profit += (revenue - cost);
    });

    return Object.keys(months).sort((a, b) => new Date(`01 ${a}`).getTime() - new Date(`01 ${b}`).getTime()).map(k => {
      const margin = months[k].revenue > 0 ? (months[k].profit / months[k].revenue) * 100 : 0;
      return {
        name: k,
        Revenue: months[k].revenue,
        Cost: months[k].cost,
        Profit: months[k].profit,
        Margin: parseFloat(margin.toFixed(2))
      };
    });
  }, [challans]);

  const locationData = useMemo(() => {
    const locs = { 'hyderabad': 0, 'bangalore': 0 };
    challans.forEach(c => {
      let itemCost = 0;
      const mrpTotal = (c.lineItems || []).reduce((sum, item: any) => {
        itemCost += (Number(item.procurementCost) || 0) * (Number(item.quantity) || 1);
        return sum + ((Number(item.mrp) || 0) * (Number(item.quantity) || 1));
      }, 0);
      const rev = mrpTotal - (mrpTotal * 0.055);
      
      if (c.location === 'hyderabad') locs['hyderabad'] += rev;
      if (c.location === 'bangalore') locs['bangalore'] += rev;
    });
    
    return [
      { name: 'Hyderabad', value: locs.hyderabad },
      { name: 'Bangalore', value: locs.bangalore }
    ];
  }, [challans]);

  const formatCurrency = (val: number) => {
    if (val >= 10000000) return `₹${(val / 10000000).toFixed(2)}Cr`;
    if (val >= 100000) return `₹${(val / 100000).toFixed(2)}L`;
    return `₹${val.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
  };

  if (role !== 'admin' && role !== 'superadmin') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-500 font-medium">Unauthorized Access</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="h-8 w-8 animate-spin text-[#3b2fc9]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50/50 pb-20">
      <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 space-y-8">
        
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <Link href="/newrelic" className="p-2 -ml-2 rounded-full hover:bg-gray-100 transition-colors text-gray-500">
                <ArrowLeft className="h-5 w-5" />
              </Link>
              <h1 className="text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
                <BarChart2 className="h-6 w-6 text-[#3b2fc9]" />
                Analytics Dashboard
              </h1>
            </div>
            <p className="text-sm text-gray-500 ml-10">Comprehensive visual breakdown of revenue, costs, and profit margins.</p>
          </div>
        </div>

        {/* Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* Monthly Revenue & Cost (Bar Chart) */}
          <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
            <h3 className="text-lg font-semibold text-gray-900 mb-6 flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-gray-400" />
              Monthly Revenue vs Cost
            </h3>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyData} margin={{ top: 10, right: 10, left: 20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6b7280' }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tickFormatter={formatCurrency} tick={{ fontSize: 12, fill: '#6b7280' }} />
                  <Tooltip formatter={(value: number) => formatCurrency(value)} cursor={{ fill: '#f9fafb' }} />
                  <Legend wrapperStyle={{ paddingTop: '20px' }} />
                  <Bar dataKey="Revenue" fill="#3b2fc9" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Cost" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Profit Margins (Line Chart) */}
          <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
            <h3 className="text-lg font-semibold text-gray-900 mb-6 flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-gray-400" />
              Profit Margin Trend (%)
            </h3>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={monthlyData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6b7280' }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tickFormatter={(val) => `${val}%`} tick={{ fontSize: 12, fill: '#6b7280' }} />
                  <Tooltip formatter={(value: number) => `${value}%`} />
                  <Legend wrapperStyle={{ paddingTop: '20px' }} />
                  <Line type="monotone" dataKey="Margin" stroke="#10b981" strokeWidth={3} dot={{ r: 4, fill: '#10b981' }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Location Revenue Split (Pie Chart) */}
          <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
            <h3 className="text-lg font-semibold text-gray-900 mb-6 flex items-center gap-2">
              <PieChartIcon className="h-5 w-5 text-gray-400" />
              Revenue by Location
            </h3>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={locationData}
                    cx="50%"
                    cy="50%"
                    innerRadius={70}
                    outerRadius={100}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {locationData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={index === 0 ? '#3b2fc9' : '#10b981'} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => formatCurrency(value)} />
                  <Legend verticalAlign="bottom" height={36} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Monthly Profit (Bar Chart) */}
          <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
            <h3 className="text-lg font-semibold text-gray-900 mb-6 flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-gray-400" />
              Net Profit by Month
            </h3>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyData} margin={{ top: 10, right: 10, left: 20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6b7280' }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tickFormatter={formatCurrency} tick={{ fontSize: 12, fill: '#6b7280' }} />
                  <Tooltip formatter={(value: number) => formatCurrency(value)} cursor={{ fill: '#f9fafb' }} />
                  <Bar dataKey="Profit" radius={[4, 4, 0, 0]}>
                    {monthlyData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.Profit >= 0 ? '#10b981' : '#ef4444'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
