'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import * as XLSX from 'xlsx';
import {
  Store,
  Zap,
  TrendingUp,
  TrendingDown,
  ShoppingBag,
  DollarSign,
  Calendar,
  Building2,
  RefreshCw,
  Search,
  CheckCircle2,
  Clock,
  ArrowLeft,
  FileSpreadsheet,
  AlertCircle,
  Layers,
  ChevronRight,
  ExternalLink,
  ShieldCheck,
  History,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  subscribeToTuckshopRecords,
  NewRelicTuckshopRecord,
} from '@/services/newrelicTuckshopService';
import { COMPANY_SITES, SiteId, resolveSiteId } from '@/types/site';
import { subscribeCompanySites } from '@/services/siteService';
import { HungerBoxSyncModal } from '@/components/newrelic/tuckshop/HungerBoxSyncModal';
import { HungerBoxSale } from '@/lib/tracker/types';
import { triggerHaptic } from '@/lib/haptics';

export default function AllSitesSalesPage() {
  const [records, setRecords] = useState<NewRelicTuckshopRecord[]>([]);
  const [telemetryOrders, setTelemetryOrders] = useState<HungerBoxSale[]>([]);
  const [isLoadingLedger, setIsLoadingLedger] = useState(true);
  const [isLoadingTelemetry, setIsLoadingTelemetry] = useState(true);

  // Sync Status Metadata
  const [syncStatus, setSyncStatus] = useState<{
    workerConfigured: boolean;
    workerUrl?: string;
    totalOrdersCount: number;
    latestOrderDate?: string;
    latestSyncedAt?: string;
    syncLogs: any[];
  }>({
    workerConfigured: false,
    totalOrdersCount: 0,
    syncLogs: [],
  });

  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);
  const [isQuickSyncing, setIsQuickSyncing] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Filters
  const [selectedSiteFilter, setSelectedSiteFilter] = useState<string>('all');
  const [selectedDateFilter, setSelectedDateFilter] = useState<string>('month');
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');
  const [sourceFilter, setSourceFilter] = useState<'all' | 'hungerbox' | 'manual'>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [, setSitesVersion] = useState(0);

  // 1. Subscribe to dynamic company sites
  useEffect(() => {
    const unsub = subscribeCompanySites(() => {
      setSitesVersion((v) => v + 1);
    });
    return () => unsub();
  }, []);

  // 2. Fetch Sync Status & Health
  const fetchSyncStatus = async () => {
    try {
      const res = await fetch('/api/tuckshop/sync/hungerbox');
      const data = await res.json();
      if (data.success) {
        setSyncStatus({
          workerConfigured: data.workerConfigured,
          workerUrl: data.workerUrl,
          totalOrdersCount: data.recentTelemetryCount || 0,
          latestOrderDate: data.latestOrderDate,
          latestSyncedAt: data.latestSyncedAt,
          syncLogs: data.recentSyncLogs || [],
        });
      }
    } catch (err) {
      console.warn('Could not fetch sync status:', err);
    }
  };

  // 3. Fetch order-level telemetry from Turso
  const fetchTelemetryOrders = async () => {
    setIsLoadingTelemetry(true);
    try {
      const res = await fetch('/api/tracker/sales?limit=500');
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        setTelemetryOrders(data.data);
      }
    } catch (err) {
      console.warn('Could not fetch telemetry orders:', err);
    } finally {
      setIsLoadingTelemetry(false);
    }
  };

  // 4. Subscribe to Tuckshop Firestore records (All sites)
  useEffect(() => {
    fetchSyncStatus();
    fetchTelemetryOrders();

    const unsubscribe = subscribeToTuckshopRecords((data) => {
      // Only keep 'sale' type records for this sales dashboard
      const salesOnly = data.filter((r) => r.type === 'sale');
      setRecords(salesOnly);
      setIsLoadingLedger(false);
    });

    return () => unsubscribe();
  }, []);

  // Quick Sync action
  const handleTriggerQuickSync = async () => {
    triggerHaptic('medium');
    setIsQuickSyncing(true);
    setStatusMessage(null);

    try {
      const today = new Date().toISOString().split('T')[0];
      const res = await fetch('/api/tuckshop/sync/hungerbox', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'worker_sync',
          startDate: today,
          endDate: today,
          siteId: selectedSiteFilter === 'all' ? 'newrelic' : selectedSiteFilter,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setStatusMessage({
          text: data.message || 'HungerBox orders pulled and updated successfully!',
          type: 'success',
        });
        await fetchSyncStatus();
        await fetchTelemetryOrders();
      } else {
        setStatusMessage({
          text: data.error || 'Failed to pull data from HungerBox.',
          type: 'error',
        });
      }
    } catch (err: any) {
      setStatusMessage({ text: err.message || 'Worker sync failed', type: 'error' });
    } finally {
      setIsQuickSyncing(false);
    }
  };

  // Filtered Ledger Sales Records
  const filteredRecords = useMemo(() => {
    const now = new Date();
    const formatYmd = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

    const todayStr = formatYmd(now);
    const yest = new Date(now);
    yest.setDate(yest.getDate() - 1);
    const yesterdayStr = formatYmd(yest);

    const weekAgo = new Date(now);
    weekAgo.setDate(weekAgo.getDate() - 7);
    const weekAgoStr = formatYmd(weekAgo);

    const monthStartStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;

    return records.filter((r) => {
      const recDate = (r.date || '').split('T')[0];
      const recSite = resolveSiteId(r.siteId);

      // Site filter
      if (selectedSiteFilter !== 'all' && recSite !== selectedSiteFilter) {
        return false;
      }

      // Source filter
      if (sourceFilter === 'hungerbox' && r.source !== 'hungerbox') return false;
      if (sourceFilter === 'manual' && r.source === 'hungerbox') return false;

      // Date preset filter
      if (selectedDateFilter === 'today' && recDate !== todayStr) return false;
      if (selectedDateFilter === 'yesterday' && recDate !== yesterdayStr) return false;
      if (selectedDateFilter === 'week' && (recDate < weekAgoStr || recDate > todayStr)) return false;
      if (selectedDateFilter === 'month' && (recDate < monthStartStr || recDate > todayStr)) return false;
      if (selectedDateFilter === 'custom') {
        if (customStartDate && recDate < customStartDate) return false;
        if (customEndDate && recDate > customEndDate) return false;
      }

      // Search term
      if (searchTerm) {
        const q = searchTerm.toLowerCase();
        const siteName = COMPANY_SITES[recSite]?.name?.toLowerCase() || '';
        const desc = (r.description || '').toLowerCase();
        const loc = (r.location || '').toLowerCase();
        if (!siteName.includes(q) && !desc.includes(q) && !loc.includes(q) && !recDate.includes(q)) {
          return false;
        }
      }

      return true;
    });
  }, [records, selectedSiteFilter, selectedDateFilter, customStartDate, customEndDate, sourceFilter, searchTerm]);

  // Aggregate Metrics
  const totalSalesAmount = useMemo(() => {
    return filteredRecords.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
  }, [filteredRecords]);

  const netEarningsAmount = totalSalesAmount * 0.8; // 20% platform commission

  const totalOrdersCount = useMemo(() => {
    return filteredRecords.reduce((sum, r) => sum + (r.orderCount || 1), 0);
  }, [filteredRecords]);

  const avgOrderTicket = totalOrdersCount > 0 ? totalSalesAmount / totalOrdersCount : 0;

  // Multi-Site Performance Breakdown
  const sitePerformance = useMemo(() => {
    const map = new Map<string, { siteId: string; name: string; sales: number; orders: number }>();

    for (const [sId, site] of Object.entries(COMPANY_SITES)) {
      map.set(sId, { siteId: sId, name: site.name, sales: 0, orders: 0 });
    }

    for (const r of filteredRecords) {
      const sId = resolveSiteId(r.siteId);
      if (!map.has(sId)) {
        map.set(sId, { siteId: sId, name: COMPANY_SITES[sId]?.name || sId, sales: 0, orders: 0 });
      }
      const item = map.get(sId)!;
      item.sales += Number(r.amount) || 0;
      item.orders += r.orderCount || 1;
    }

    return Array.from(map.values()).sort((a, b) => b.sales - a.sales);
  }, [filteredRecords]);

  // Filtered Telemetry Stream
  const filteredTelemetry = useMemo(() => {
    return telemetryOrders.filter((o) => {
      if (searchTerm) {
        const q = searchTerm.toLowerCase();
        const idMatch = o.orderId.toLowerCase().includes(q);
        const itemMatch = (o.itemName || '').toLowerCase().includes(q);
        const cafeMatch = (o.cafeteriaName || '').toLowerCase().includes(q);
        if (!idMatch && !itemMatch && !cafeMatch) return false;
      }
      return true;
    });
  }, [telemetryOrders, searchTerm]);

  // Export to Excel
  const handleExportExcel = () => {
    triggerHaptic('light');
    const rows = filteredRecords.map((r) => {
      const sId = resolveSiteId(r.siteId);
      return {
        'Date': (r.date || '').split('T')[0],
        'Site ID': sId,
        'Site Name': COMPANY_SITES[sId]?.name || sId,
        'Location': r.location || '',
        'Source': r.source === 'hungerbox' ? 'HungerBox Cashless' : 'Manual',
        'Gross Sales (₹)': r.amount,
        'Net Earnings (80%) (₹)': Math.round(r.amount * 0.8),
        'Orders Count': r.orderCount || 1,
        'Description / Sessions': r.description || '',
        'Logged By': r.createdBy || '',
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'All Sites Sales');
    XLSX.writeFile(workbook, `Tuckshop_Sales_All_Sites_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-8 py-4 sm:py-8 space-y-5">
      {/* Top Breadcrumb & Navigation */}
      <div className="flex items-center justify-between gap-3">
        <Link
          href="/newrelic/tuckshop"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Assigned Site Counter</span>
        </Link>

        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-900 border-amber-300 font-black uppercase">
            ⚡ 100% Cashless App Orders
          </Badge>
        </div>
      </div>

      {/* Hero Header */}
      <div className="rounded-2xl sm:rounded-3xl bg-gradient-to-r from-[#2c1d24] via-[#43232f] to-[#1e1b4b] p-5 sm:p-7 text-white shadow-xl relative overflow-hidden">
        <div className="absolute -right-10 -top-10 w-48 h-48 bg-purple-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute right-36 -bottom-10 w-40 h-40 bg-amber-500/20 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-5">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-br from-amber-400/20 to-orange-500/20 border-2 border-amber-300/40 flex items-center justify-center text-amber-300 shadow-lg shrink-0">
              <Building2 className="w-6 h-6 sm:w-7 sm:h-7" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <span className="text-[10px] font-black uppercase tracking-wider bg-amber-400/20 text-amber-300 border border-amber-400/30 px-2 py-0.5 rounded-full">
                  Multi-Site Hub
                </span>
                <span className="text-[10px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 px-2 py-0.5 rounded-full">
                  All Sites Telemetry
                </span>
              </div>
              <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white">
                All Sites Sales &amp; HungerBox Telemetry
              </h1>
              <p className="text-xs text-rose-100/80 font-medium mt-0.5">
                Consolidated digital sales, automated HungerBox sync status, and performance breakdown across all cafeterias.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <Button
              onClick={() => {
                triggerHaptic('medium');
                setIsSyncModalOpen(true);
              }}
              className="h-10 px-4 rounded-2xl bg-gradient-to-r from-amber-400 via-amber-500 to-orange-500 hover:from-amber-300 hover:to-orange-400 text-slate-950 font-black text-xs shadow-lg shadow-amber-950/20 active:scale-95 transition-all"
            >
              <Zap className="w-3.5 h-3.5 fill-slate-950 mr-1.5" />
              Sync HungerBox Sales
            </Button>

            <Button
              variant="outline"
              onClick={handleExportExcel}
              className="h-10 px-3.5 rounded-2xl bg-white/10 hover:bg-white/20 border-white/20 text-white font-bold text-xs active:scale-95 transition-all"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 mr-1.5" />
              Export Excel
            </Button>
          </div>
        </div>
      </div>

      {/* 🔴 LIVE DATA PULL STATUS BANNER (Answers: "How do we know is the data pulled or not") */}
      <div className="rounded-2xl sm:rounded-3xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 shadow-sm space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="relative flex items-center justify-center">
              <span className={`w-3.5 h-3.5 rounded-full ${syncStatus.workerConfigured ? 'bg-emerald-500' : 'bg-amber-500'}`} />
              <span className={`absolute w-3.5 h-3.5 rounded-full ${syncStatus.workerConfigured ? 'bg-emerald-400 animate-ping' : ''} opacity-75`} />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-xs sm:text-sm font-black text-slate-900 dark:text-white">
                  HungerBox Scraper &amp; Sync Status:
                </p>
                <Badge
                  variant="outline"
                  className={`text-[10px] font-black uppercase tracking-wider ${
                    syncStatus.workerConfigured
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                      : 'bg-amber-50 text-amber-800 border-amber-300'
                  }`}
                >
                  {syncStatus.workerConfigured ? '🟢 Scraper Worker Active' : '🟡 Manual / Report Mode'}
                </Badge>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                Target Portal:{' '}
                <a
                  href="https://admin.hungerbox.com/va/reporting/download-reports"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-bold text-[#3b2fc9] dark:text-indigo-400 hover:underline inline-flex items-center gap-0.5"
                >
                  admin.hungerbox.com/va/reporting/download-reports <ExternalLink className="w-2.5 h-2.5 ml-0.5" />
                </a>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              onClick={handleTriggerQuickSync}
              disabled={isQuickSyncing}
              size="sm"
              variant="outline"
              className="h-8 rounded-xl font-bold text-xs border-indigo-200 text-[#3b2fc9] hover:bg-indigo-50"
            >
              <RefreshCw className={`w-3 h-3 mr-1.5 ${isQuickSyncing ? 'animate-spin' : ''}`} />
              {isQuickSyncing ? 'Pulling Orders...' : 'Check & Sync Now'}
            </Button>
          </div>
        </div>

        {/* 4 Metadata Cards inside status bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-2 border-t border-slate-100 dark:border-slate-800">
          <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Cached Orders</p>
            <p className="text-base sm:text-lg font-black text-slate-900 dark:text-white font-mono mt-0.5">
              {syncStatus.totalOrdersCount.toLocaleString()}
            </p>
            <p className="text-[10px] text-slate-400">Captured in database</p>
          </div>

          <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Latest Order Date</p>
            <p className="text-base sm:text-lg font-black text-indigo-600 dark:text-indigo-400 font-mono mt-0.5">
              {syncStatus.latestOrderDate || 'No orders yet'}
            </p>
            <p className="text-[10px] text-slate-400">Most recent transaction</p>
          </div>

          <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Last Sync Event</p>
            <p className="text-xs sm:text-sm font-black text-slate-800 dark:text-slate-200 font-mono mt-1 truncate">
              {syncStatus.latestSyncedAt ? new Date(syncStatus.latestSyncedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : 'Ready to pull'}
            </p>
            <p className="text-[10px] text-slate-400 truncate">
              {syncStatus.latestSyncedAt ? new Date(syncStatus.latestSyncedAt).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }) : 'Never'}
            </p>
          </div>

          <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Sync Integrity</p>
            <p className="text-xs sm:text-sm font-black text-emerald-600 dark:text-emerald-400 mt-1 flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Zero Cash Loss</span>
            </p>
            <p className="text-[10px] text-slate-400">100% digital matching</p>
          </div>
        </div>

        {/* Status Message toast */}
        {statusMessage && (
          <div
            className={`p-3 rounded-xl border text-xs font-bold flex items-center gap-2 ${
              statusMessage.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : 'bg-rose-50 text-rose-800 border-rose-200'
            }`}
          >
            {statusMessage.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" /> : <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />}
            <span>{statusMessage.text}</span>
          </div>
        )}
      </div>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* 1. Total Gross Sales */}
        <div className="p-4 rounded-2xl sm:rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
              <TrendingUp className="w-3.5 h-3.5" /> Gross Sales
            </span>
            <span className="text-[10px] font-black px-1.5 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200">
              {filteredRecords.length} records
            </span>
          </div>
          <p className="text-2xl sm:text-3xl font-mono font-black text-slate-900 dark:text-white tracking-tight">
            ₹{Math.round(totalSalesAmount).toLocaleString('en-IN')}
          </p>
          <p className="text-[10px] text-slate-400 mt-1">Across selected sites &amp; dates</p>
        </div>

        {/* 2. Total Net Digital Earnings */}
        <div className="p-4 rounded-2xl sm:rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-400 flex items-center gap-1">
              <DollarSign className="w-3.5 h-3.5" /> Net Earnings (80%)
            </span>
            <span className="text-[10px] font-black px-1.5 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200">
              Payout
            </span>
          </div>
          <p className="text-2xl sm:text-3xl font-mono font-black text-indigo-950 dark:text-indigo-200 tracking-tight">
            ₹{Math.round(netEarningsAmount).toLocaleString('en-IN')}
          </p>
          <p className="text-[10px] text-slate-400 mt-1">After 20% commission</p>
        </div>

        {/* 3. Total Customer Orders */}
        <div className="p-4 rounded-2xl sm:rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400 flex items-center gap-1">
              <ShoppingBag className="w-3.5 h-3.5" /> Total Orders
            </span>
            <span className="text-[10px] font-black px-1.5 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200">
              App Tickets
            </span>
          </div>
          <p className="text-2xl sm:text-3xl font-mono font-black text-slate-900 dark:text-white tracking-tight">
            {totalOrdersCount.toLocaleString('en-IN')}
          </p>
          <p className="text-[10px] text-slate-400 mt-1">Digital customer tokens</p>
        </div>

        {/* 4. Average Order Value */}
        <div className="p-4 rounded-2xl sm:rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-teal-700 dark:text-teal-400 flex items-center gap-1">
              <Zap className="w-3.5 h-3.5" /> Avg Ticket (AOV)
            </span>
            <span className="text-[10px] font-black px-1.5 py-0.5 rounded-md bg-teal-50 text-teal-700 border border-teal-200">
              Per Order
            </span>
          </div>
          <p className="text-2xl sm:text-3xl font-mono font-black text-slate-900 dark:text-white tracking-tight">
            ₹{avgOrderTicket.toFixed(1)}
          </p>
          <p className="text-[10px] text-slate-400 mt-1">Counter basket size</p>
        </div>
      </div>

      {/* Cross-Site Performance Breakdown Pills */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-xs font-black uppercase tracking-wider text-slate-500">
            Site Breakdown &amp; Performance
          </p>
          <span className="text-[11px] text-slate-400 font-medium">Click site to filter</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <button
            type="button"
            onClick={() => setSelectedSiteFilter('all')}
            className={`p-3 rounded-2xl border text-left transition-all ${
              selectedSiteFilter === 'all'
                ? 'border-[#3b2fc9] bg-indigo-50/60 dark:bg-indigo-950/40 ring-1 ring-[#3b2fc9]'
                : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300'
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-black text-slate-900 dark:text-white">All Sites</span>
              <Badge variant="outline" className="text-[9px] font-mono">100%</Badge>
            </div>
            <p className="text-base font-black text-[#3b2fc9] dark:text-indigo-400 font-mono">
              ₹{Math.round(totalSalesAmount).toLocaleString('en-IN')}
            </p>
            <p className="text-[10px] text-slate-400 mt-0.5">{totalOrdersCount} orders total</p>
          </button>

          {sitePerformance.map((sp) => {
            const share = totalSalesAmount > 0 ? (sp.sales / totalSalesAmount) * 100 : 0;
            const isSelected = selectedSiteFilter === sp.siteId;
            return (
              <button
                key={sp.siteId}
                type="button"
                onClick={() => setSelectedSiteFilter(isSelected ? 'all' : sp.siteId)}
                className={`p-3 rounded-2xl border text-left transition-all ${
                  isSelected
                    ? 'border-[#3b2fc9] bg-indigo-50/60 dark:bg-indigo-950/40 ring-1 ring-[#3b2fc9]'
                    : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-black text-slate-900 dark:text-white truncate max-w-[120px]">{sp.name}</span>
                  <Badge variant="outline" className="text-[9px] font-mono">{share.toFixed(0)}%</Badge>
                </div>
                <p className="text-base font-black text-slate-900 dark:text-white font-mono">
                  ₹{Math.round(sp.sales).toLocaleString('en-IN')}
                </p>
                <p className="text-[10px] text-slate-400 mt-0.5">{sp.orders} orders</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Control Filter Bar */}
      <div className="p-4 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Date range presets */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {[
              { id: 'today', label: 'Today' },
              { id: 'yesterday', label: 'Yesterday' },
              { id: 'week', label: 'Last 7 Days' },
              { id: 'month', label: 'This Month' },
              { id: 'all', label: 'All Time' },
              { id: 'custom', label: 'Custom Range' },
            ].map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  triggerHaptic('light');
                  setSelectedDateFilter(p.id);
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  selectedDateFilter === p.id
                    ? 'bg-[#3b2fc9] text-white shadow-xs'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Source filters */}
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-bold text-slate-400 uppercase">Source:</span>
            {[
              { id: 'all', label: 'All' },
              { id: 'hungerbox', label: '⚡ HungerBox' },
              { id: 'manual', label: 'Manual' },
            ].map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setSourceFilter(s.id as any)}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                  sourceFilter === s.id
                    ? 'bg-amber-100 dark:bg-amber-950 text-amber-900 dark:text-amber-200 border border-amber-300'
                    : 'bg-slate-50 dark:bg-slate-800 text-slate-500 hover:bg-slate-100'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* Custom date range inputs */}
        {selectedDateFilter === 'custom' && (
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500 font-bold">From:</span>
              <Input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="h-8 text-xs rounded-xl w-36"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500 font-bold">To:</span>
              <Input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="h-8 text-xs rounded-xl w-36"
              />
            </div>
          </div>
        )}

        {/* Search bar */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input
            placeholder="Search date (YYYY-MM-DD), site, location, session notes, or items..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="h-9 pl-9 text-xs rounded-xl bg-slate-50/60 dark:bg-slate-800/40 border-slate-200/80"
          />
        </div>
      </div>

      {/* Main Tabbed Views */}
      <Tabs defaultValue="ledger" className="space-y-4">
        <TabsList className="bg-slate-100 dark:bg-slate-800 p-1 rounded-2xl">
          <TabsTrigger value="ledger" className="rounded-xl text-xs font-bold gap-1.5">
            <Calendar className="w-3.5 h-3.5" />
            Consolidated Daily Site Ledger ({filteredRecords.length})
          </TabsTrigger>
          <TabsTrigger value="telemetry" className="rounded-xl text-xs font-bold gap-1.5">
            <ShoppingBag className="w-3.5 h-3.5" />
            Order-by-Order Telemetry Stream ({filteredTelemetry.length})
          </TabsTrigger>
          <TabsTrigger value="logs" className="rounded-xl text-xs font-bold gap-1.5">
            <History className="w-3.5 h-3.5" />
            Sync Logs &amp; Audit Trail ({syncStatus.syncLogs.length})
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: CONSOLIDATED DAILY SITE LEDGER */}
        <TabsContent value="ledger">
          <div className="rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              {isLoadingLedger ? (
                <div className="p-16 text-center text-slate-500">
                  <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-indigo-600" />
                  Loading consolidated sales records...
                </div>
              ) : filteredRecords.length === 0 ? (
                <div className="p-16 text-center text-slate-500 space-y-3">
                  <Store className="h-10 w-10 text-slate-300 mx-auto" />
                  <p className="font-bold text-slate-800 dark:text-white">No sales records found for current filters</p>
                  <p className="text-xs text-slate-400 max-w-sm mx-auto">
                    Try adjusting your site or date filter, or trigger a HungerBox automated sync.
                  </p>
                  <Button
                    onClick={() => setIsSyncModalOpen(true)}
                    size="sm"
                    className="rounded-xl font-bold text-xs bg-[#3b2fc9] text-white"
                  >
                    Sync from HungerBox
                  </Button>
                </div>
              ) : (
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50/80 dark:bg-slate-800/60 border-b border-slate-200/80 dark:border-slate-800 text-slate-600 dark:text-slate-400 font-black uppercase text-[10px] tracking-wider">
                      <th className="py-3 px-4">Date</th>
                      <th className="py-3 px-4">Site / Cafeteria</th>
                      <th className="py-3 px-4">Source</th>
                      <th className="py-3 px-4">Session Breakdown / Notes</th>
                      <th className="py-3 px-4 text-center">Orders</th>
                      <th className="py-3 px-4 text-right">Gross Sales</th>
                      <th className="py-3 px-4 text-right">Net (80%)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {filteredRecords.map((record) => {
                      const sId = resolveSiteId(record.siteId);
                      const siteName = COMPANY_SITES[sId]?.name || sId;
                      const isHB = record.source === 'hungerbox' || Boolean(record.orderCount);
                      const netAmt = record.amount * 0.8;

                      return (
                        <tr key={record.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                          <td className="py-3 px-4 font-mono font-bold text-slate-900 dark:text-white whitespace-nowrap">
                            {(record.date || '').split('T')[0]}
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap">
                            <span className="font-bold text-slate-800 dark:text-slate-200">{siteName}</span>
                            <span className="text-[10px] text-slate-400 block">{record.location}</span>
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap">
                            {isHB ? (
                              <Badge className="bg-amber-100 hover:bg-amber-100 text-amber-900 border-amber-300 font-black text-[10px] gap-1">
                                <Zap className="w-2.5 h-2.5 fill-amber-500" /> HungerBox App
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-[10px] font-bold">
                                Manual Entry
                              </Badge>
                            )}
                          </td>
                          <td className="py-3 px-4 max-w-xs truncate text-slate-600 dark:text-slate-300" title={record.description || ''}>
                            {record.description || 'General counter sales'}
                          </td>
                          <td className="py-3 px-4 text-center font-mono font-bold text-slate-700 dark:text-slate-300">
                            {record.orderCount || 1}
                          </td>
                          <td className="py-3 px-4 text-right font-black text-emerald-600 dark:text-emerald-400 font-mono text-sm whitespace-nowrap">
                            ₹{Math.round(record.amount).toLocaleString('en-IN')}
                          </td>
                          <td className="py-3 px-4 text-right font-black text-indigo-900 dark:text-indigo-300 font-mono text-sm whitespace-nowrap">
                            ₹{Math.round(netAmt).toLocaleString('en-IN')}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </TabsContent>

        {/* TAB 2: ORDER-BY-ORDER TELEMETRY STREAM */}
        <TabsContent value="telemetry">
          <div className="rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
            <div className="p-4 bg-slate-50/60 border-b border-slate-200/80 flex items-center justify-between text-xs">
              <span className="font-bold text-slate-700">
                Live Transaction Tickets (Pulled from HungerBox Scraper)
              </span>
              <span className="text-slate-400">
                Showing {filteredTelemetry.length} tickets
              </span>
            </div>

            <div className="overflow-x-auto">
              {isLoadingTelemetry ? (
                <div className="p-16 text-center text-slate-500">
                  <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-indigo-600" />
                  Loading HungerBox customer transactions...
                </div>
              ) : filteredTelemetry.length === 0 ? (
                <div className="p-16 text-center text-slate-500 space-y-2">
                  <ShoppingBag className="h-8 w-8 text-slate-300 mx-auto" />
                  <p className="font-bold text-slate-700">No telemetry tickets found</p>
                  <p className="text-xs text-slate-400">Trigger sync to pull latest orders into database.</p>
                </div>
              ) : (
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50/80 border-b border-slate-200/80 text-slate-600 font-black uppercase text-[10px] tracking-wider">
                      <th className="py-3 px-4">Order ID</th>
                      <th className="py-3 px-4">Order Date</th>
                      <th className="py-3 px-4">Cafeteria</th>
                      <th className="py-3 px-4">Item Name</th>
                      <th className="py-3 px-4 text-right">Amount</th>
                      <th className="py-3 px-4 text-center">Status</th>
                      <th className="py-3 px-4">Synced At</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredTelemetry.map((order) => (
                      <tr key={order.orderId} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-4 font-mono font-bold text-slate-900">{order.orderId}</td>
                        <td className="py-3 px-4 text-slate-600 font-mono">{order.orderDate}</td>
                        <td className="py-3 px-4 font-bold text-slate-700">{order.cafeteriaName || 'Main'}</td>
                        <td className="py-3 px-4 font-bold text-slate-900">{order.itemName || 'Counter Meal'}</td>
                        <td className="py-3 px-4 text-right font-black text-emerald-700 font-mono">
                          ₹{order.amount.toFixed(2)}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-300 font-bold">
                            {order.status || 'Completed'}
                          </Badge>
                        </td>
                        <td className="py-3 px-4 text-[10px] text-slate-400 font-mono">
                          {order.syncedAt || '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </TabsContent>

        {/* TAB 3: SYNC LOGS & AUDIT TRAIL */}
        <TabsContent value="logs">
          <div className="rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm p-5 space-y-4">
            <div>
              <h3 className="text-sm font-black text-slate-900 dark:text-white">
                HungerBox Scraper Execution &amp; Sync History
              </h3>
              <p className="text-xs text-slate-400">
                Detailed audit trail of automated pulls, manual triggers, and report file imports.
              </p>
            </div>

            {syncStatus.syncLogs.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs border border-dashed rounded-2xl">
                No sync logs recorded yet. Trigger a sync to record audit history.
              </div>
            ) : (
              <div className="space-y-2.5">
                {syncStatus.syncLogs.map((log) => (
                  <div
                    key={log.id}
                    className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-[10px] bg-indigo-50 text-indigo-700 border-indigo-200 font-black">
                          {log.action}
                        </Badge>
                        <span className="font-mono text-[11px] text-slate-400">
                          {log.timestamp}
                        </span>
                      </div>
                      <p className="text-slate-600 dark:text-slate-300 font-mono text-[11px] break-all">
                        {log.details || 'Sync job completed'}
                      </p>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="text-[10px] font-bold text-slate-400 block">Triggered by:</span>
                      <span className="font-bold text-slate-700 dark:text-slate-300 text-xs">
                        {log.userEmail || 'System'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* HungerBox Modal */}
      <HungerBoxSyncModal
        open={isSyncModalOpen}
        onOpenChange={setIsSyncModalOpen}
        siteId={selectedSiteFilter === 'all' ? 'newrelic' : selectedSiteFilter}
        onSyncComplete={() => {
          fetchSyncStatus();
          fetchTelemetryOrders();
        }}
      />
    </div>
  );
}
