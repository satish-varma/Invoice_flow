'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Invoice } from '@/lib/tracker/types';
import { TrackerHeader } from '@/components/tracker/TrackerHeader';
import { MultiSelect } from '@/components/tracker/MultiSelect';
import { InvoiceDrawer } from '@/components/tracker/InvoiceDrawer';
import { GroupedInvoiceView } from '@/components/tracker/GroupedInvoiceView';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Download,
  Search,
  CreditCard,
  CheckSquare,
  Save,
  Calendar,
  X,
  List,
  Layers,
  DollarSign,
  TrendingUp,
  Clock,
  Eye,
  ChevronLeft,
  ChevronRight,
  Filter,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { triggerHaptic } from '@/lib/haptics';

interface SavedFilter {
  id: string;
  name: string;
  searchTerm: string;
  locations: string[];
  stalls: string[];
  dateFilter: string;
  statusFilter: string;
  minAmount: string;
  maxAmount: string;
  monthFilter: string;
  yearFilter: string;
  customDateFrom: string;
  customDateTo: string;
}

export default function TrackerInvoicesPage() {
  const { user } = useAuth();
  const router = useRouter();

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLocations, setSelectedLocations] = useState<string[]>([]);
  const [selectedStalls, setSelectedStalls] = useState<string[]>([]);
  const [dateFilter, setDateFilter] = useState('All Time');
  const [statusFilter, setStatusFilter] = useState('All Status');
  const [minAmount, setMinAmount] = useState('');
  const [maxAmount, setMaxAmount] = useState('');
  const [monthFilter, setMonthFilter] = useState('All');
  const [yearFilter, setYearFilter] = useState('All');
  const [customDateFrom, setCustomDateFrom] = useState('');
  const [customDateTo, setCustomDateTo] = useState('');

  // UI States
  const [viewMode, setViewMode] = useState<'grouped' | 'list'>('grouped');
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Saved Filters
  const [savedFilters, setSavedFilters] = useState<SavedFilter[]>([]);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [filterName, setFilterName] = useState('');

  // Load Saved Filters
  useEffect(() => {
    const saved = localStorage.getItem('tracker_saved_filters');
    if (saved) {
      try {
        setSavedFilters(JSON.parse(saved));
      } catch (e) {
        console.error(e);
      }
    }
  }, []);

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
      console.error('Failed to load invoices:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchInvoices();
  }, []);

  const handleSync = async () => {
    try {
      setIsSyncing(true);
      const res = await fetch('/api/tracker/sync', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        await fetchInvoices();
      } else {
        alert(data.error || 'Sync failed. Please check credentials in Tracker Settings.');
      }
    } catch (err: any) {
      alert(`Sync error: ${err.message}`);
    } finally {
      setIsSyncing(false);
    }
  };

  // Locations and Stalls
  const uniqueLocations = useMemo(() => {
    return Array.from(new Set(invoices.map((i) => i.location))).sort();
  }, [invoices]);

  const uniqueStalls = useMemo(() => {
    const list =
      selectedLocations.length > 0
        ? invoices.filter((i) => selectedLocations.includes(i.location))
        : invoices;
    return Array.from(new Set(list.map((i) => i.stall))).sort();
  }, [invoices, selectedLocations]);

  // Filter logic
  const filteredInvoices = useMemo(() => {
    return invoices.filter((inv) => {
      if (selectedLocations.length && !selectedLocations.includes(inv.location)) return false;
      if (selectedStalls.length && !selectedStalls.includes(inv.stall)) return false;
      if (statusFilter !== 'All Status') {
        if (statusFilter === 'Pending') {
          if (inv.status?.toLowerCase() !== 'pending' && inv.status?.toLowerCase() !== 'processed') {
            return false;
          }
        } else if (inv.status !== statusFilter) {
          return false;
        }
      }

      if (searchTerm) {
        const lower = searchTerm.toLowerCase();
        if (
          !inv.id.toLowerCase().includes(lower) &&
          !inv.stall.toLowerCase().includes(lower) &&
          !inv.location.toLowerCase().includes(lower) &&
          !inv.amount.toString().includes(lower)
        ) {
          return false;
        }
      }

      if (minAmount && inv.amount < parseFloat(minAmount)) return false;
      if (maxAmount && inv.amount > parseFloat(maxAmount)) return false;

      if (dateFilter === 'Custom' && (customDateFrom || customDateTo)) {
        const d = new Date(inv.date);
        if (customDateFrom && d < new Date(customDateFrom)) return false;
        if (customDateTo && d > new Date(customDateTo)) return false;
      } else if (dateFilter === 'Last Month') {
        const d = new Date(inv.date);
        const limit = new Date();
        limit.setMonth(limit.getMonth() - 1);
        if (d < limit) return false;
      } else if (dateFilter === 'Last 2 Months') {
        const d = new Date(inv.date);
        const limit = new Date();
        limit.setMonth(limit.getMonth() - 2);
        if (d < limit) return false;
      } else if (dateFilter === 'Last 3 Months') {
        const d = new Date(inv.date);
        const limit = new Date();
        limit.setMonth(limit.getMonth() - 3);
        if (d < limit) return false;
      }

      if (monthFilter !== 'All' || yearFilter !== 'All') {
        const d = new Date(inv.date);
        const monthMap: Record<string, number> = {
          Jan: 0,
          Feb: 1,
          Mar: 2,
          Apr: 3,
          May: 4,
          Jun: 5,
          Jul: 6,
          Aug: 7,
          Sep: 8,
          Oct: 9,
          Nov: 10,
          Dec: 11,
        };
        if (monthFilter !== 'All' && d.getMonth() !== monthMap[monthFilter]) return false;
        if (yearFilter !== 'All' && d.getFullYear() !== parseInt(yearFilter, 10)) return false;
      }

      return true;
    });
  }, [
    invoices,
    selectedLocations,
    selectedStalls,
    statusFilter,
    searchTerm,
    minAmount,
    maxAmount,
    dateFilter,
    customDateFrom,
    customDateTo,
    monthFilter,
    yearFilter,
  ]);

  // Totals Calculation
  const activeInvoicesForSummary = useMemo(() => {
    return selectedIds.size > 0
      ? invoices.filter((inv) => selectedIds.has(inv.id))
      : filteredInvoices;
  }, [invoices, selectedIds, filteredInvoices]);

  const summaryTotals = useMemo(() => {
    return activeInvoicesForSummary.reduce(
      (acc, inv) => {
        acc.total += inv.amount;
        if (inv.status?.toLowerCase() === 'paid') acc.paid += inv.amount;
        else acc.pending += inv.amount;
        return acc;
      },
      { total: 0, paid: 0, pending: 0 }
    );
  }, [activeInvoicesForSummary]);

  // Pagination for list view
  const totalPages = Math.ceil(filteredInvoices.length / pageSize) || 1;
  const paginatedInvoices = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredInvoices.slice(start, start + pageSize);
  }, [filteredInvoices, currentPage, pageSize]);

  // CSV Export
  const handleExportCSV = () => {
    triggerHaptic('light');
    const headers = ['ID', 'Date', 'Location', 'Stall', 'Service Date Range', 'Net Amount', 'Status'];
    const rows = filteredInvoices.map((i) => [
      i.id,
      i.date,
      `"${i.location}"`,
      `"${i.stall}"`,
      `"${i.serviceDateRange || ''}"`,
      i.amount,
      i.status || 'Pending',
    ]);

    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Cash_and_Carry_Invoices_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  // Saved Filters
  const saveCurrentFilter = () => {
    if (!filterName.trim()) {
      alert('Please enter a filter name');
      return;
    }
    const newFilter: SavedFilter = {
      id: Date.now().toString(),
      name: filterName.trim(),
      searchTerm,
      locations: selectedLocations,
      stalls: selectedStalls,
      dateFilter,
      statusFilter,
      minAmount,
      maxAmount,
      monthFilter,
      yearFilter,
      customDateFrom,
      customDateTo,
    };
    const updated = [...savedFilters, newFilter];
    setSavedFilters(updated);
    localStorage.setItem('tracker_saved_filters', JSON.stringify(updated));
    setFilterName('');
    setShowSaveDialog(false);
  };

  const deleteFilter = (id: string) => {
    const updated = savedFilters.filter((f) => f.id !== id);
    setSavedFilters(updated);
    localStorage.setItem('tracker_saved_filters', JSON.stringify(updated));
  };

  const loadFilter = (f: SavedFilter) => {
    setSearchTerm(f.searchTerm || '');
    setSelectedLocations(f.locations || []);
    setSelectedStalls(f.stalls || []);
    setDateFilter(f.dateFilter || 'All Time');
    setStatusFilter(f.statusFilter || 'All Status');
    setMinAmount(f.minAmount || '');
    setMaxAmount(f.maxAmount || '');
    setMonthFilter(f.monthFilter || 'All');
    setYearFilter(f.yearFilter || 'All');
    setCustomDateFrom(f.customDateFrom || '');
    setCustomDateTo(f.customDateTo || '');
    setCurrentPage(1);
  };

  const clearAllFilters = () => {
    triggerHaptic('light');
    setSearchTerm('');
    setSelectedLocations([]);
    setSelectedStalls([]);
    setDateFilter('All Time');
    setStatusFilter('All Status');
    setMinAmount('');
    setMaxAmount('');
    setMonthFilter('All');
    setYearFilter('All');
    setCustomDateFrom('');
    setCustomDateTo('');
    setCurrentPage(1);
  };

  const handlePayInvoice = async (invoice: Invoice) => {
    try {
      const res = await fetch(`/api/tracker/invoices/${encodeURIComponent(invoice.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'Paid' }),
      });
      if (res.ok) {
        setInvoices((prev) =>
          prev.map((i) => (i.id === invoice.id ? { ...i, status: 'Paid' } : i))
        );
      }
    } catch (err) {
      console.error('Failed to update status:', err);
    }
  };

  const toggleSelection = (id: string) => {
    triggerHaptic('light');
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    triggerHaptic('light');
    if (selectedIds.size === paginatedInvoices.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(paginatedInvoices.map((inv) => inv.id)));
    }
  };

  const toggleGroupSelection = (ids: string[], selected: boolean) => {
    triggerHaptic('light');
    setSelectedIds((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => {
        if (selected) next.add(id);
        else next.delete(id);
      });
      return next;
    });
  };

  const handleDownloadInvoice = async (inv: Invoice) => {
    try {
      const apiUrl = `/api/tracker/download/${encodeURIComponent(inv.id)}`;
      const response = await fetch(apiUrl);
      if (!response.ok) {
        alert('Failed to download PDF');
        return;
      }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${inv.id}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (e) {
      console.error('Download error:', e);
      alert('Failed to download PDF');
    }
  };

  const handleDownloadSelected = async () => {
    const selectedInvoices = invoices.filter((inv) => selectedIds.has(inv.id));
    for (let i = 0; i < selectedInvoices.length; i++) {
      await handleDownloadInvoice(selectedInvoices[i]);
      if (i < selectedInvoices.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 300));
      }
    }
    setSelectedIds(new Set());
  };

  const handleBulkStatusUpdate = async (newStatus: 'Paid' | 'Processed' | 'Pending') => {
    if (selectedIds.size === 0) return;
    setIsUpdatingStatus(true);
    const selectedInvoiceIds = Array.from(selectedIds);
    let successCount = 0;

    for (const id of selectedInvoiceIds) {
      try {
        const response = await fetch(`/api/tracker/invoices/${encodeURIComponent(id)}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: newStatus }),
        });
        if (response.ok) successCount++;
      } catch (err) {
        console.error(err);
      }
    }

    setInvoices((prev) =>
      prev.map((inv) => (selectedIds.has(inv.id) ? { ...inv, status: newStatus } : inv))
    );
    setSelectedIds(new Set());
    setIsUpdatingStatus(false);
    alert(`Successfully updated ${successCount} invoice(s) to "${newStatus}"`);
  };

  return (
    <div className="space-y-6">
      {/* ── Top Header & Tab Navigation ── */}
      <TrackerHeader
        title="Remittance Invoices"
        subtitle="Payment invoices from HungerBox to GutGuru for employee-paid orders (received in 2 cycles per week)."
        count={invoices.length}
        onSync={handleSync}
        isSyncing={isSyncing}
        actions={
          <>
            {selectedIds.size > 0 && (
              <div className="flex items-center gap-1.5 flex-wrap">
                <Button
                  size="sm"
                  onClick={handleDownloadSelected}
                  className="h-10 px-3.5 rounded-2xl font-bold text-xs bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs active:scale-95 transition-all"
                >
                  <CheckSquare className="h-3.5 w-3.5 mr-1.5" />
                  Download ({selectedIds.size})
                </Button>
                <Button
                  size="sm"
                  disabled={isUpdatingStatus}
                  onClick={() => handleBulkStatusUpdate('Paid')}
                  className="h-10 px-3.5 rounded-2xl font-bold text-xs bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs active:scale-95 transition-all"
                >
                  <CreditCard className="h-3.5 w-3.5 mr-1.5" />
                  Mark Paid ({selectedIds.size})
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={isUpdatingStatus}
                  onClick={() => handleBulkStatusUpdate('Pending')}
                  className="h-10 px-3 rounded-2xl font-bold text-xs border-amber-300 text-amber-700 bg-amber-50 hover:bg-amber-100 shadow-2xs active:scale-95 transition-all"
                >
                  Pending
                </Button>
              </div>
            )}

            <Button
              size="sm"
              variant="outline"
              onClick={handleExportCSV}
              className="h-10 px-4 rounded-2xl font-bold text-xs border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 shadow-2xs active:scale-95 transition-all"
            >
              <Download className="h-3.5 w-3.5 mr-1.5" />
              Export CSV
            </Button>
          </>
        }
      />

      {/* ── KPI Stat Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-2xl sm:rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-[0_4px_16px_-4px_rgba(0,0,0,0.06)] p-5 flex items-center justify-between transition-all hover:shadow-md">
          <div>
            <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              {selectedIds.size > 0 ? 'Selected Amount' : 'Filtered Total'}
            </p>
            <div className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white font-mono tabular-nums mt-1">
              ₹{summaryTotals.total.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
              {selectedIds.size > 0 ? `${selectedIds.size} selected` : `${filteredInvoices.length} invoices shown`}
            </p>
          </div>
          <div className="h-12 w-12 bg-indigo-50 dark:bg-indigo-950/50 text-[#3b2fc9] dark:text-indigo-400 rounded-2xl flex items-center justify-center shrink-0 shadow-xs">
            <DollarSign className="h-6 w-6" />
          </div>
        </div>

        <div className="rounded-2xl sm:rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-[0_4px_16px_-4px_rgba(0,0,0,0.06)] p-5 flex items-center justify-between transition-all hover:shadow-md">
          <div>
            <p className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">
              Settled &amp; Paid
            </p>
            <div className="text-2xl sm:text-3xl font-black text-emerald-700 dark:text-emerald-400 font-mono tabular-nums mt-1">
              ₹{summaryTotals.paid.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
              Verified received remittance
            </p>
          </div>
          <div className="h-12 w-12 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 rounded-2xl flex items-center justify-center shrink-0 shadow-xs">
            <TrendingUp className="h-6 w-6" />
          </div>
        </div>

        <div className="rounded-2xl sm:rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-[0_4px_16px_-4px_rgba(0,0,0,0.06)] p-5 flex items-center justify-between transition-all hover:shadow-md">
          <div>
            <p className="text-[11px] font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider">
              Pending Settlement
            </p>
            <div className="text-2xl sm:text-3xl font-black text-amber-700 dark:text-amber-400 font-mono tabular-nums mt-1">
              ₹{summaryTotals.pending.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
              Awaiting payout cycle
            </p>
          </div>
          <div className="h-12 w-12 bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 rounded-2xl flex items-center justify-center shrink-0 shadow-xs">
            <Clock className="h-6 w-6" />
          </div>
        </div>
      </div>

      {/* ── Modern App Filter Bar ── */}
      <div className="p-4 sm:p-5 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-3">
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Search Input */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input
              type="text"
              placeholder="Search invoice ID, stall, location..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-10 pl-9 pr-8 text-xs rounded-xl border-slate-200/80 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/40 text-slate-900 dark:text-white"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Location MultiSelect */}
          <MultiSelect
            label="Location"
            options={uniqueLocations}
            value={selectedLocations}
            onChange={setSelectedLocations}
          />

          {/* Stall MultiSelect */}
          <MultiSelect
            label="Stall"
            options={uniqueStalls}
            value={selectedStalls}
            onChange={setSelectedStalls}
          />

          {/* Status Dropdown */}
          <select
            className="h-10 px-3 text-xs font-bold rounded-xl border border-slate-200/80 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/40 text-slate-700 dark:text-slate-300 outline-none focus:border-indigo-500 cursor-pointer shadow-2xs"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="All Status">📊 All Status</option>
            <option value="Pending">🟡 Pending</option>
            <option value="Paid">🔵 Paid</option>
          </select>

          {/* Date Range Dropdown */}
          <select
            className="h-10 px-3 text-xs font-bold rounded-xl border border-slate-200/80 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/40 text-slate-700 dark:text-slate-300 outline-none focus:border-indigo-500 cursor-pointer shadow-2xs"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
          >
            <option value="All Time">📅 All Time</option>
            <option value="Last Month">Last Month</option>
            <option value="Last 2 Months">Last 2 Months</option>
            <option value="Last 3 Months">Last 3 Months</option>
            <option value="Custom">Custom Range</option>
          </select>

          {/* Month Dropdown */}
          <select
            className="h-10 px-2.5 text-xs font-bold rounded-xl border border-slate-200/80 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/40 text-slate-700 dark:text-slate-300 outline-none focus:border-indigo-500 cursor-pointer shadow-2xs"
            value={monthFilter}
            onChange={(e) => setMonthFilter(e.target.value)}
          >
            <option value="All">📆 Month</option>
            {['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>

          {/* Year Dropdown */}
          <select
            className="h-10 px-2.5 text-xs font-bold rounded-xl border border-slate-200/80 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/40 text-slate-700 dark:text-slate-300 outline-none focus:border-indigo-500 cursor-pointer shadow-2xs"
            value={yearFilter}
            onChange={(e) => setYearFilter(e.target.value)}
          >
            <option value="All">🗓️ Year</option>
            <option value="2024">2024</option>
            <option value="2025">2025</option>
            <option value="2026">2026</option>
          </select>

          {/* Custom Date Range Inline */}
          {dateFilter === 'Custom' && (
            <div className="flex items-center gap-1.5 p-1 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
              <input
                type="date"
                value={customDateFrom}
                onChange={(e) => setCustomDateFrom(e.target.value)}
                className="h-8 px-2 text-xs rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900"
              />
              <span className="text-slate-400 font-bold">&rarr;</span>
              <input
                type="date"
                value={customDateTo}
                onChange={(e) => setCustomDateTo(e.target.value)}
                className="h-8 px-2 text-xs rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900"
              />
            </div>
          )}

          {/* View Mode Segmented Switcher */}
          <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 ml-auto">
            <button
              onClick={() => {
                triggerHaptic('light');
                setViewMode('grouped');
              }}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                viewMode === 'grouped'
                  ? 'bg-white dark:bg-slate-700 text-[#3b2fc9] dark:text-indigo-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              <Layers size={13} />
              <span>Grouped</span>
            </button>
            <button
              onClick={() => {
                triggerHaptic('light');
                setViewMode('list');
              }}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                viewMode === 'list'
                  ? 'bg-white dark:bg-slate-700 text-[#3b2fc9] dark:text-indigo-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              <List size={13} />
              <span>List</span>
            </button>
          </div>
        </div>

        {/* ── Sub-bar: Quick Access Chips & Save Filter ── */}
        <div className="flex items-center justify-between gap-3 pt-2 border-t border-slate-100 dark:border-slate-800 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Quick Presets:
            </span>
            {savedFilters.length === 0 ? (
              <span className="text-xs text-slate-400 italic">No saved filter presets</span>
            ) : (
              savedFilters.map((f) => (
                <div
                  key={f.id}
                  onClick={() => loadFilter(f)}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-indigo-50 hover:text-[#3b2fc9] transition-all cursor-pointer border border-slate-200 dark:border-slate-700"
                >
                  <span>{f.name}</span>
                  <span
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteFilter(f.id);
                    }}
                    className="text-slate-400 hover:text-rose-500"
                  >
                    <X size={12} />
                  </span>
                </div>
              ))
            )}
          </div>

          <div className="flex items-center gap-2">
            {showSaveDialog ? (
              <div className="flex items-center gap-1.5 p-1 bg-indigo-50 dark:bg-indigo-950/60 rounded-xl border border-indigo-200 dark:border-indigo-800">
                <input
                  type="text"
                  placeholder="Preset name..."
                  value={filterName}
                  onChange={(e) => setFilterName(e.target.value)}
                  className="h-7 px-2 text-xs rounded-lg border border-indigo-200 dark:border-indigo-700 bg-white dark:bg-slate-900"
                />
                <Button size="sm" onClick={saveCurrentFilter} className="h-7 px-2.5 text-xs rounded-lg font-bold">
                  Save
                </Button>
                <button
                  onClick={() => setShowSaveDialog(false)}
                  className="p-1 text-slate-400 hover:text-slate-600"
                >
                  <X size={14} />
                </button>
              </div>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowSaveDialog(true)}
                className="h-8 px-2.5 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 rounded-xl"
              >
                <Save className="h-3 w-3 mr-1" />
                Save Current View
              </Button>
            )}

            <Button
              variant="ghost"
              size="sm"
              onClick={clearAllFilters}
              className="h-8 px-2.5 text-xs font-bold text-slate-500 hover:text-slate-900 rounded-xl"
            >
              Reset Filters
            </Button>
          </div>
        </div>
      </div>

      {/* ── Main Content Area ── */}
      <div>
        {isLoading ? (
          <div className="p-16 text-center text-slate-500 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto mb-3" />
            <p className="text-xs font-bold">Loading Cash &amp; Carry Remittances...</p>
          </div>
        ) : filteredInvoices.length === 0 ? (
          <div className="p-16 text-center text-slate-500 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 space-y-3">
            <Filter className="h-10 w-10 text-slate-300 mx-auto" />
            <h3 className="text-base font-bold text-slate-800 dark:text-white">No Invoices Found</h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              No remittance invoices match your active filters. Try adjusting your search term, location, or date filter.
            </p>
            <Button size="sm" variant="outline" onClick={clearAllFilters} className="rounded-xl font-bold text-xs">
              Clear All Filters
            </Button>
          </div>
        ) : viewMode === 'grouped' ? (
          <GroupedInvoiceView
            invoices={filteredInvoices}
            onInvoiceClick={setSelectedInvoice}
            onDownload={handleDownloadInvoice}
            onPay={handlePayInvoice}
            userRole={user?.role}
            selectedIds={selectedIds}
            onToggleSelect={toggleSelection}
            onToggleAll={toggleGroupSelection}
          />
        ) : (
          /* ── Flat Table View with Clean Styling ── */
          <div className="rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50/75 dark:bg-slate-800/60 border-b border-slate-200/80 dark:border-slate-800 text-slate-600 dark:text-slate-400 font-black uppercase text-[10px] tracking-wider">
                    <th className="py-3 px-4 w-10">
                      <input
                        type="checkbox"
                        checked={selectedIds.size > 0 && selectedIds.size === paginatedInvoices.length}
                        onChange={toggleSelectAll}
                        className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                      />
                    </th>
                    <th className="py-3 px-4">Stall / Counter</th>
                    <th className="py-3 px-4">Location</th>
                    <th className="py-3 px-4">Advice ID</th>
                    <th className="py-3 px-4">Service Period</th>
                    <th className="py-3 px-4 text-right">Net Payable</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {paginatedInvoices.map((inv) => {
                    const isSelected = selectedIds.has(inv.id);
                    return (
                      <tr
                        key={inv.id}
                        onClick={() => setSelectedInvoice(inv)}
                        className={`transition-colors cursor-pointer ${
                          isSelected
                            ? 'bg-indigo-50/40 dark:bg-indigo-950/30'
                            : 'hover:bg-slate-50/80 dark:hover:bg-slate-800/40'
                        }`}
                      >
                        <td className="py-3 px-4" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelection(inv.id)}
                            className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                          />
                        </td>
                        <td className="py-3 px-4 font-bold text-slate-900 dark:text-white">
                          {inv.stall}
                        </td>
                        <td className="py-3 px-4 font-semibold text-slate-600 dark:text-slate-300">
                          {inv.location}
                        </td>
                        <td className="py-3 px-4 font-mono text-slate-500 text-[11px]">
                          {inv.id.split('_')[0]}
                        </td>
                        <td className="py-3 px-4 font-mono text-slate-500 text-[11px]">
                          {inv.serviceDateRange || 'N/A'}
                        </td>
                        <td className="py-3 px-4 text-right font-black text-slate-900 dark:text-white font-mono tabular-nums">
                          ₹{inv.amount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                        </td>
                        <td className="py-3 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                          <Badge
                            variant="outline"
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              inv.status === 'Paid'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-400'
                                : 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-400'
                            }`}
                          >
                            {inv.status || 'Pending'}
                          </Badge>
                        </td>
                        <td className="py-3 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setSelectedInvoice(inv)}
                              className="h-7 px-2 text-xs text-indigo-600 hover:bg-indigo-50 rounded-lg"
                            >
                              <Eye size={13} className="mr-1" />
                              View
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleDownloadInvoice(inv)}
                              className="h-7 w-7 p-0 text-slate-500 hover:text-indigo-600 rounded-lg"
                              title="Download PDF"
                            >
                              <Download size={13} />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {filteredInvoices.length > 0 && (
              <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
                <div className="flex items-center gap-2">
                  <span>Show</span>
                  <select
                    value={pageSize}
                    onChange={(e) => {
                      setPageSize(Number(e.target.value));
                      setCurrentPage(1);
                    }}
                    className="h-7 px-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold"
                  >
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                  </select>
                  <span>invoices per page</span>
                  <span className="font-mono text-slate-400">
                    ({(currentPage - 1) * pageSize + 1} -{' '}
                    {Math.min(currentPage * pageSize, filteredInvoices.length)} of{' '}
                    {filteredInvoices.length})
                  </span>
                </div>

                <div className="flex items-center gap-1.5">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    className="h-8 px-2.5 rounded-xl font-bold text-xs"
                  >
                    <ChevronLeft className="h-3.5 w-3.5 mr-1" />
                    Previous
                  </Button>
                  <span className="px-2 font-mono font-bold text-slate-700 dark:text-slate-300">
                    {currentPage} / {totalPages}
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    className="h-8 px-2.5 rounded-xl font-bold text-xs"
                  >
                    Next
                    <ChevronRight className="h-3.5 w-3.5 ml-1" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Slide-Over Invoice Drawer ── */}
      <InvoiceDrawer
        isOpen={!!selectedInvoice}
        invoice={selectedInvoice}
        onClose={() => setSelectedInvoice(null)}
        onStatusChange={async (id, newStatus) => {
          await fetch(`/api/tracker/invoices/${encodeURIComponent(id)}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: newStatus }),
          });
          setInvoices((prev) =>
            prev.map((inv) => (inv.id === id ? { ...inv, status: newStatus as any } : inv))
          );
        }}
      />
    </div>
  );
}
