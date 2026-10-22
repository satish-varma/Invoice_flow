'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Invoice } from '@/lib/tracker/types';
import { TrackerHeader } from '@/components/tracker/TrackerHeader';
import { DashboardCharts } from '@/components/tracker/DashboardCharts';
import { InvoiceDrawer } from '@/components/tracker/InvoiceDrawer';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  DollarSign,
  FileText,
  Clock,
  TrendingUp,
  Search,
  Eye,
  RefreshCw,
  ArrowRight,
  Filter,
} from 'lucide-react';
import Link from 'next/link';

export default function TrackerDashboardPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'Pending' | 'Paid'>('ALL');

  const fetchInvoices = async () => {
    try {
      setIsLoading(true);
      const res = await fetch(`/api/tracker/invoices?t=${Date.now()}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          Pragma: 'no-cache',
        },
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        setInvoices(data.data);
      }
    } catch (err) {
      console.error('Failed to load tracker invoices:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchInvoices();
  }, []);

  const handleQuickSync = async () => {
    try {
      setIsSyncing(true);
      const res = await fetch('/api/tracker/sync', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        await fetchInvoices();
      } else {
        alert(data.error || 'Sync failed');
      }
    } catch (err: any) {
      alert(`Sync failed: ${err.message}`);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleStatusChange = async (id: string, newStatus: string) => {
    try {
      const res = await fetch(`/api/tracker/invoices/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        setInvoices((prev) =>
          prev.map((inv) => (inv.id === id ? { ...inv, status: newStatus as any } : inv))
        );
        if (selectedInvoice && selectedInvoice.id === id) {
          setSelectedInvoice((prev) => (prev ? { ...prev, status: newStatus as any } : null));
        }
      }
    } catch (err) {
      console.error('Failed to update status:', err);
    }
  };

  // KPIs
  const totalAmount = useMemo(() => invoices.reduce((s, i) => s + i.amount, 0), [invoices]);
  const pendingAmount = useMemo(
    () => invoices.filter((i) => i.status !== 'Paid').reduce((s, i) => s + i.amount, 0),
    [invoices]
  );
  const paidAmount = useMemo(
    () => invoices.filter((i) => i.status === 'Paid').reduce((s, i) => s + i.amount, 0),
    [invoices]
  );
  const avgAmount = useMemo(
    () => (invoices.length > 0 ? totalAmount / invoices.length : 0),
    [invoices, totalAmount]
  );

  // Filtered invoices for preview table
  const filteredInvoices = useMemo(() => {
    return invoices.filter((inv) => {
      const matchSearch =
        inv.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        inv.stall.toLowerCase().includes(searchTerm.toLowerCase()) ||
        inv.location.toLowerCase().includes(searchTerm.toLowerCase());
      const matchStatus = statusFilter === 'ALL' || inv.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [invoices, searchTerm, statusFilter]);

  return (
    <div className="space-y-6">
      <TrackerHeader
        title="Cash & Carry Overview"
        count={invoices.length}
        onSync={handleQuickSync}
        isSyncing={isSyncing}
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl sm:rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-[0_4px_16px_-4px_rgba(0,0,0,0.06)] p-5 flex items-center justify-between transition-all hover:shadow-md">
          <div>
            <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Total Remittances
            </p>
            <div className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white font-mono tabular-nums mt-1">
              ₹{totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
              {invoices.length} payment advices
            </p>
          </div>
          <div className="h-12 w-12 bg-indigo-50 dark:bg-indigo-950/50 text-[#3b2fc9] dark:text-indigo-400 rounded-2xl flex items-center justify-center shrink-0 shadow-xs">
            <DollarSign className="h-6 w-6" />
          </div>
        </div>

        <div className="rounded-2xl sm:rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-[0_4px_16px_-4px_rgba(0,0,0,0.06)] p-5 flex items-center justify-between transition-all hover:shadow-md">
          <div>
            <p className="text-[11px] font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider">
              Pending Remittance
            </p>
            <div className="text-2xl sm:text-3xl font-black text-amber-700 dark:text-amber-400 font-mono tabular-nums mt-1">
              ₹{pendingAmount.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
              {invoices.filter((i) => i.status !== 'Paid').length} awaiting settlement
            </p>
          </div>
          <div className="h-12 w-12 bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 rounded-2xl flex items-center justify-center shrink-0 shadow-xs">
            <Clock className="h-6 w-6" />
          </div>
        </div>

        <div className="rounded-2xl sm:rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-[0_4px_16px_-4px_rgba(0,0,0,0.06)] p-5 flex items-center justify-between transition-all hover:shadow-md">
          <div>
            <p className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">
              Settled &amp; Paid
            </p>
            <div className="text-2xl sm:text-3xl font-black text-emerald-700 dark:text-emerald-400 font-mono tabular-nums mt-1">
              ₹{paidAmount.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
              {invoices.filter((i) => i.status === 'Paid').length} verified received
            </p>
          </div>
          <div className="h-12 w-12 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 rounded-2xl flex items-center justify-center shrink-0 shadow-xs">
            <TrendingUp className="h-6 w-6" />
          </div>
        </div>

        <div className="rounded-2xl sm:rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-[0_4px_16px_-4px_rgba(0,0,0,0.06)] p-5 flex items-center justify-between transition-all hover:shadow-md">
          <div>
            <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Avg Advice Payout
            </p>
            <div className="text-2xl sm:text-3xl font-black text-blue-900 dark:text-blue-300 font-mono tabular-nums mt-1">
              ₹{avgAmount.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
              Per bi-weekly remittance
            </p>
          </div>
          <div className="h-12 w-12 bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 rounded-2xl flex items-center justify-center shrink-0 shadow-xs">
            <FileText className="h-6 w-6" />
          </div>
        </div>
      </div>

      {/* Charts */}
      <DashboardCharts invoices={invoices} />

      {/* Recent Invoices Table Preview */}
      <div className="rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-200/80 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-[#3b2fc9]" />
            <h2 className="text-sm sm:text-base font-black text-slate-900 dark:text-white">
              Recent Remittance Invoices
            </h2>
            <Badge variant="outline" className="text-xs bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-full font-mono font-bold">
              {filteredInvoices.length}
            </Badge>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative w-48 sm:w-64">
              <Search className="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <Input
                placeholder="Filter stall, location..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="h-9 pl-8 text-xs rounded-xl border-slate-200/80 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/40"
              />
            </div>

            <div className="flex rounded-xl border border-slate-200/80 dark:border-slate-700 p-0.5 bg-slate-50 dark:bg-slate-800">
              {(['ALL', 'Pending', 'Paid'] as const).map((st) => (
                <button
                  key={st}
                  onClick={() => setStatusFilter(st)}
                  className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all ${
                    statusFilter === st
                      ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs'
                      : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>

            <Button asChild size="sm" variant="outline" className="h-9 rounded-xl font-bold text-xs">
              <Link href="/tracker/invoices">
                View All
                <ArrowRight className="h-3.5 w-3.5 ml-1" />
              </Link>
            </Button>
          </div>
        </div>

        <div className="overflow-x-auto">
            {isLoading ? (
              <div className="p-12 text-center text-gray-500">
                <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-indigo-600" />
                Loading invoices from Turso...
              </div>
            ) : filteredInvoices.length === 0 ? (
              <div className="p-12 text-center text-gray-500">
                No remittance invoices matching your filter criteria.
              </div>
            ) : (
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-gray-50/75 border-b border-gray-200 text-gray-600 font-bold uppercase text-[10px] tracking-wider">
                    <th className="py-2.5 px-4">Raised Date</th>
                    <th className="py-2.5 px-4">Location</th>
                    <th className="py-2.5 px-4">Stall / Vendor</th>
                    <th className="py-2.5 px-4">Service Period</th>
                    <th className="py-2.5 px-4 text-right">Net Amount</th>
                    <th className="py-2.5 px-4 text-center">Status</th>
                    <th className="py-2.5 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredInvoices.slice(0, 15).map((inv) => (
                    <tr
                      key={inv.id}
                      className="hover:bg-indigo-50/20 transition-colors cursor-pointer"
                      onClick={() => setSelectedInvoice(inv)}
                    >
                      <td className="py-2.5 px-4 font-semibold text-gray-900 whitespace-nowrap">{inv.date}</td>
                      <td className="py-2.5 px-4 text-gray-700 font-medium">{inv.location}</td>
                      <td className="py-2.5 px-4 text-gray-900 font-bold">{inv.stall}</td>
                      <td className="py-2.5 px-4 text-gray-500 font-mono text-[11px]">
                        {inv.serviceDateRange || 'N/A'}
                      </td>
                      <td className="py-2.5 px-4 text-right font-extrabold text-indigo-900 whitespace-nowrap">
                        ₹{inv.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-2.5 px-4 text-center">
                        <Badge
                          variant="outline"
                          className={
                            inv.status === 'Paid'
                              ? 'text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200 font-bold'
                              : 'text-[10px] bg-amber-50 text-amber-700 border-amber-200 font-bold'
                          }
                        >
                          {inv.status}
                        </Badge>
                      </td>
                      <td className="py-2.5 px-4 text-right">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-xs text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedInvoice(inv);
                          }}
                        >
                          <Eye className="h-3.5 w-3.5 mr-1" />
                          View
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

      <InvoiceDrawer
        invoice={selectedInvoice}
        isOpen={!!selectedInvoice}
        onClose={() => setSelectedInvoice(null)}
        onStatusChange={handleStatusChange}
      />
    </div>
  );
}
