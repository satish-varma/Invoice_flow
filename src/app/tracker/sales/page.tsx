'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { HungerBoxSale } from '@/lib/tracker/types';
import { TrackerHeader } from '@/components/tracker/TrackerHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  ShoppingBag,
  DollarSign,
  TrendingUp,
  RefreshCw,
  Search,
  CheckCircle2,
  Clock,
  Store,
  MapPin,
  Calendar,
} from 'lucide-react';

export default function TrackerSalesPage() {
  const [sales, setSales] = useState<HungerBoxSale[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const fetchSales = async () => {
    try {
      setIsLoading(true);
      const res = await fetch('/api/tracker/sales?limit=200');
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        setSales(data.data);
      }
    } catch (err) {
      console.error('Failed to fetch HungerBox sales:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSales();
  }, []);

  const handleTriggerWorker = async () => {
    try {
      setIsSyncing(true);
      setStatusMessage(null);
      const res = await fetch('/api/tracker/sync/hungerbox-sales', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setStatusMessage({
          text: 'HungerBox worker triggered successfully! Orders are being pulled into database.',
          type: 'success',
        });
        await fetchSales();
      } else {
        setStatusMessage({
          text: data.error || 'Failed to trigger sales worker.',
          type: 'error',
        });
      }
    } catch (err: any) {
      setStatusMessage({ text: err.message || 'Worker trigger error', type: 'error' });
    } finally {
      setIsSyncing(false);
    }
  };

  const totalSalesAmount = useMemo(() => sales.reduce((s, o) => s + (o.amount || 0), 0), [sales]);
  const avgOrderValue = useMemo(() => (sales.length > 0 ? totalSalesAmount / sales.length : 0), [sales, totalSalesAmount]);

  const filteredSales = useMemo(() => {
    return sales.filter((s) => {
      const matchSearch =
        s.orderId.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (s.itemName && s.itemName.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (s.cafeteriaName && s.cafeteriaName.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (s.vendorName && s.vendorName.toLowerCase().includes(searchTerm.toLowerCase()));
      return matchSearch;
    });
  }, [sales, searchTerm]);

  return (
    <div className="space-y-6">
      <TrackerHeader
        title="Live Sales Telemetry"
        subtitle="Live counter purchases and order stream pulled from the HungerBox scraper worker."
        count={sales.length}
        badge="Live Telemetry"
        actions={
          <Button
            onClick={handleTriggerWorker}
            disabled={isSyncing}
            size="sm"
            className="h-10 px-4 rounded-2xl font-bold text-xs bg-[#3b2fc9] hover:bg-[#2f24a8] text-white shadow-md active:scale-95 transition-all"
          >
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${isSyncing ? 'animate-spin' : ''}`} />
            {isSyncing ? 'Triggering Worker...' : 'Sync Live Orders'}
          </Button>
        }
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-2xl sm:rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-[0_4px_16px_-4px_rgba(0,0,0,0.06)] p-5 flex items-center justify-between transition-all hover:shadow-md">
          <div>
            <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Live Sales Total
            </p>
            <div className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white font-mono tabular-nums mt-1">
              ₹{totalSalesAmount.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">{sales.length} tracked orders</p>
          </div>
          <div className="h-12 w-12 bg-indigo-50 dark:bg-indigo-950/50 text-[#3b2fc9] dark:text-indigo-400 rounded-2xl flex items-center justify-center shrink-0 shadow-xs">
            <DollarSign className="h-6 w-6" />
          </div>
        </div>

        <div className="rounded-2xl sm:rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-[0_4px_16px_-4px_rgba(0,0,0,0.06)] p-5 flex items-center justify-between transition-all hover:shadow-md">
          <div>
            <p className="text-[11px] font-bold text-indigo-700 dark:text-indigo-400 uppercase tracking-wider">
              Orders Count
            </p>
            <div className="text-2xl sm:text-3xl font-black text-indigo-950 dark:text-indigo-200 font-mono tabular-nums mt-1">
              {sales.length}
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">Transactions captured</p>
          </div>
          <div className="h-12 w-12 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 rounded-2xl flex items-center justify-center shrink-0 shadow-xs">
            <ShoppingBag className="h-6 w-6" />
          </div>
        </div>

        <div className="rounded-2xl sm:rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-[0_4px_16px_-4px_rgba(0,0,0,0.06)] p-5 flex items-center justify-between transition-all hover:shadow-md">
          <div>
            <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Avg Order Value
            </p>
            <div className="text-2xl sm:text-3xl font-black text-blue-900 dark:text-blue-300 font-mono tabular-nums mt-1">
              ₹{avgOrderValue.toFixed(1)}
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">Per counter ticket</p>
          </div>
          <div className="h-12 w-12 bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 rounded-2xl flex items-center justify-center shrink-0 shadow-xs">
            <TrendingUp className="h-6 w-6" />
          </div>
        </div>
      </div>

      {/* Status Message */}
      {statusMessage && (
        <div
          className={`p-4 rounded-2xl border text-xs font-bold flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 shadow-2xs ${
            statusMessage.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-rose-50 text-rose-800 border-rose-200'
          }`}
        >
          <span>{statusMessage.text}</span>
          {statusMessage.type === 'error' && statusMessage.text.includes('Tracker Settings') && (
            <Button asChild size="sm" variant="outline" className="h-8 rounded-xl font-bold text-xs border-rose-300 text-rose-900 hover:bg-rose-100">
              <Link href="/tracker/settings">Configure in Settings &rarr;</Link>
            </Button>
          )}
        </div>
      )}

      {/* Filter Card */}
      <div className="p-4 sm:p-5 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input
            placeholder="Search order ID, item, cafeteria..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="h-10 pl-9 text-xs rounded-xl border-slate-200/80 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/40"
          />
        </div>
        <p className="text-xs text-slate-400 font-medium">
          Showing {filteredSales.length} orders
        </p>
      </div>

      {/* Orders Table */}
      <div className="rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          {isLoading ? (
            <div className="p-16 text-center text-slate-500">
              <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-indigo-600" />
              Loading HungerBox sales orders...
            </div>
          ) : filteredSales.length === 0 ? (
            <div className="p-16 text-center text-slate-500 space-y-3">
              <ShoppingBag className="h-10 w-10 text-slate-300 mx-auto" />
              <p className="font-bold text-slate-800 dark:text-white">No sales orders found</p>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                Ensure the HungerBox Worker URL and API Key are configured in Tracker Settings.
              </p>
              <Button asChild size="sm" variant="outline" className="rounded-xl font-bold text-xs">
                <Link href="/tracker/settings">Open Tracker Settings</Link>
              </Button>
            </div>
          ) : (
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50/75 dark:bg-slate-800/60 border-b border-slate-200/80 dark:border-slate-800 text-slate-600 dark:text-slate-400 font-black uppercase text-[10px] tracking-wider">
                  <th className="py-3 px-4">Order ID</th>
                  <th className="py-3 px-4">Order Date</th>
                  <th className="py-3 px-4">Cafeteria / Location</th>
                  <th className="py-3 px-4">Item Name</th>
                  <th className="py-3 px-4 text-right">Amount</th>
                  <th className="py-3 px-4 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredSales.map((sale) => (
                  <tr key={sale.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-slate-900 dark:text-white">{sale.orderId}</td>
                    <td className="py-3 px-4 text-slate-600 dark:text-slate-300 whitespace-nowrap">{sale.orderDate}</td>
                    <td className="py-3 px-4 text-slate-700 dark:text-slate-300 font-semibold">{sale.cafeteriaName || 'Main Counter'}</td>
                    <td className="py-3 px-4 text-slate-900 dark:text-white font-bold">{sale.itemName || 'Meal / Snack'}</td>
                    <td className="py-3 px-4 text-right font-black text-slate-900 dark:text-white font-mono tabular-nums whitespace-nowrap">
                      ₹{sale.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200 font-bold">
                        {sale.status || 'Completed'}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
