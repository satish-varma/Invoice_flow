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
  Percent,
  Receipt,
  Tag,
  Filter,
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
import { formatOrdinalDate } from '@/services/hungerboxParser';

/**
 * Robust financial extractor ensuring 100% calculation consistency across rows
 */
function getRecordFinancials(r: NewRelicTuckshopRecord) {
  const gross = Number(r.amount) || 0;
  let mrp = r.mrpSales !== undefined ? Number(r.mrpSales) : 0;
  let nonMrp = r.nonMrpSales !== undefined ? Number(r.nonMrpSales) : 0;

  // Fallback for legacy records without explicit split
  if (r.mrpSales === undefined && r.nonMrpSales === undefined) {
    const isPackaged = /tuck|bakery|packaged/i.test(`${r.location || ''} ${r.description || ''}`);
    if (isPackaged) {
      mrp = gross;
      nonMrp = 0;
    } else {
      nonMrp = gross;
      mrp = 0;
    }
  }

  // Exact HungerBox Commission Rules (Clarified):
  // - MRP Packaged Sales: 3% commission
  // - Non-MRP Fresh Kitchen Food Sales (Maggi, Sandwich, Juice, Omelette, etc.): 19% commission
  const mrpComm = Math.round(mrp * 0.03 * 100) / 100;
  const nonMrpComm = Math.round(nonMrp * 0.19 * 100) / 100;
  const totalComm = Math.round((mrpComm + nonMrpComm) * 100) / 100;
  const net = Math.round((gross - totalComm) * 100) / 100;

  return {
    gross,
    mrp,
    mrpComm,
    mrpNet: Math.round((mrp - mrpComm) * 100) / 100,
    nonMrp,
    nonMrpComm,
    nonMrpNet: Math.round((nonMrp - nonMrpComm) * 100) / 100,
    totalComm,
    net,
  };
}

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
    autoCron?: {
      active: boolean;
      schedule: string;
      lastRunDate?: string;
      lastSyncedToDate?: string;
      lastRunTimestamp?: string;
      status?: string;
    };
  }>({
    workerConfigured: true,
    totalOrdersCount: 0,
    syncLogs: [],
  });

  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);
  const [isQuickSyncing, setIsQuickSyncing] = useState(false);
  const [isAggregating, setIsAggregating] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Filters
  const [selectedSiteFilter, setSelectedSiteFilter] = useState<string>('all');
  const [selectedDateFilter, setSelectedDateFilter] = useState<string>('6months');
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');
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
          workerConfigured: Boolean(data.workerConfigured),
          workerUrl: data.workerUrl,
          totalOrdersCount: data.recentTelemetryCount || 0,
          latestOrderDate: data.latestOrderDate,
          latestSyncedAt: data.latestSyncedAt,
          syncLogs: data.recentSyncLogs || [],
          autoCron: data.autoCron,
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

  // Aggregate all stored Turso telemetry into daily Firestore ledger
  const handleAggregateAllTelemetry = async () => {
    triggerHaptic('medium');
    setIsAggregating(true);
    setStatusMessage(null);

    try {
      const res = await fetch('/api/tuckshop/sync/hungerbox', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'aggregate_telemetry',
          siteId: selectedSiteFilter === 'all' ? 'newrelic' : selectedSiteFilter,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setStatusMessage({
          text: data.message || 'Successfully aggregated HungerBox telemetry into the daily site ledger!',
          type: 'success',
        });
        await fetchSyncStatus();
      } else {
        setStatusMessage({
          text: data.error || 'Failed to aggregate telemetry.',
          type: 'error',
        });
      }
    } catch (err: any) {
      setStatusMessage({ text: err.message || 'Aggregation failed', type: 'error' });
    } finally {
      setIsAggregating(false);
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

    const sixMonthsAgo = new Date(now);
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    const sixMonthsAgoStr = formatYmd(sixMonthsAgo);

    return records.filter((r) => {
      const recDate = (r.date || '').split('T')[0];
      const recSite = resolveSiteId(r.siteId);

      // Site filter
      if (selectedSiteFilter !== 'all' && recSite !== selectedSiteFilter) {
        return false;
      }

      // Date preset filter
      if (selectedDateFilter === 'today' && recDate !== todayStr) return false;
      if (selectedDateFilter === 'yesterday' && recDate !== yesterdayStr) return false;
      if (selectedDateFilter === 'week' && (recDate < weekAgoStr || recDate > todayStr)) return false;
      if (selectedDateFilter === 'month' && (recDate < monthStartStr || recDate > todayStr)) return false;
      if (selectedDateFilter === '6months' && recDate < sixMonthsAgoStr) return false;
      if (selectedDateFilter === 'custom') {
        if (customStartDate && recDate < customStartDate) return false;
        if (customEndDate && recDate > customEndDate) return false;
      }

      // Search term (searches raw date, ordinal date, site, location, description)
      if (searchTerm) {
        const q = searchTerm.toLowerCase();
        const siteName = COMPANY_SITES[recSite]?.name?.toLowerCase() || '';
        const desc = (r.description || '').toLowerCase();
        const loc = (r.location || '').toLowerCase();
        const ordDate = formatOrdinalDate(recDate).toLowerCase();
        if (
          !siteName.includes(q) &&
          !desc.includes(q) &&
          !loc.includes(q) &&
          !recDate.includes(q) &&
          !ordDate.includes(q)
        ) {
          return false;
        }
      }

      return true;
    });
  }, [
    records,
    selectedSiteFilter,
    selectedDateFilter,
    customStartDate,
    customEndDate,
    searchTerm,
  ]);

  // Aggregate Metrics with MRP vs Non-MRP Separation
  const financials = useMemo(() => {
    let totalGross = 0;
    let totalMrp = 0;
    let totalMrpComm = 0;
    let totalNonMrp = 0;
    let totalNonMrpComm = 0;
    let totalCommission = 0;
    let totalNet = 0;
    let totalOrders = 0;

    for (const r of filteredRecords) {
      const f = getRecordFinancials(r);
      totalGross += f.gross;
      totalMrp += f.mrp;
      totalMrpComm += f.mrpComm;
      totalNonMrp += f.nonMrp;
      totalNonMrpComm += f.nonMrpComm;
      totalCommission += f.totalComm;
      totalNet += f.net;
      totalOrders += r.orderCount || 1;
    }

    const effectiveCommRate =
      totalGross > 0 ? ((totalCommission / totalGross) * 100).toFixed(1) : '0.0';
    const aov = totalOrders > 0 ? (totalGross / totalOrders).toFixed(1) : '0.0';

    return {
      totalGross: Math.round(totalGross),
      totalMrp: Math.round(totalMrp),
      totalMrpComm: Math.round(totalMrpComm),
      totalNonMrp: Math.round(totalNonMrp),
      totalNonMrpComm: Math.round(totalNonMrpComm),
      totalCommission: Math.round(totalCommission),
      totalNet: Math.round(totalNet),
      totalOrders,
      effectiveCommRate,
      aov,
    };
  }, [filteredRecords]);

  // Multi-Site Performance Breakdown
  const sitePerformance = useMemo(() => {
    const map = new Map<
      string,
      {
        siteId: string;
        name: string;
        gross: number;
        mrp: number;
        nonMrp: number;
        totalComm: number;
        net: number;
        orders: number;
        recordsCount: number;
      }
    >();

    for (const [sId, site] of Object.entries(COMPANY_SITES)) {
      map.set(sId, {
        siteId: sId,
        name: site.name,
        gross: 0,
        mrp: 0,
        nonMrp: 0,
        totalComm: 0,
        net: 0,
        orders: 0,
        recordsCount: 0,
      });
    }

    for (const r of filteredRecords) {
      const sId = resolveSiteId(r.siteId);
      if (!map.has(sId)) {
        map.set(sId, {
          siteId: sId,
          name: COMPANY_SITES[sId]?.name || sId,
          gross: 0,
          mrp: 0,
          nonMrp: 0,
          totalComm: 0,
          net: 0,
          orders: 0,
          recordsCount: 0,
        });
      }
      const item = map.get(sId)!;
      const f = getRecordFinancials(r);
      item.gross += f.gross;
      item.mrp += f.mrp;
      item.nonMrp += f.nonMrp;
      item.totalComm += f.totalComm;
      item.net += f.net;
      item.orders += r.orderCount || 1;
      item.recordsCount += 1;
    }

    return Array.from(map.values()).sort((a, b) => b.gross - a.gross);
  }, [filteredRecords]);

  // Filtered Telemetry Stream
  const filteredTelemetry = useMemo(() => {
    return telemetryOrders.filter((o) => {
      if (searchTerm) {
        const q = searchTerm.toLowerCase();
        const idMatch = o.orderId.toLowerCase().includes(q);
        const itemMatch = (o.itemName || '').toLowerCase().includes(q);
        const cafeMatch = (o.cafeteriaName || '').toLowerCase().includes(q);
        const ordDateMatch = formatOrdinalDate(o.orderDate).toLowerCase().includes(q);
        if (!idMatch && !itemMatch && !cafeMatch && !ordDateMatch) return false;
      }
      return true;
    });
  }, [telemetryOrders, searchTerm]);

  // Export to Excel with clean MRP / Non-MRP and exact "1st-jan-26" dates
  const handleExportExcel = () => {
    triggerHaptic('light');
    const rows = filteredRecords.map((r) => {
      const sId = resolveSiteId(r.siteId);
      const f = getRecordFinancials(r);
      return {
        'Date': formatOrdinalDate(r.date),
        'Raw Date (YYYY-MM-DD)': (r.date || '').split('T')[0],
        'Site': COMPANY_SITES[sId]?.name || sId,
        'Location / Stall': r.location || 'Main Cafeteria',
        'MRP Sales (₹)': Math.round(f.mrp),
        'MRP Comm (3%) (₹)': Math.round(f.mrpComm),
        'MRP Net (97%) (₹)': Math.round(f.mrpNet),
        'Non-MRP Sales (₹)': Math.round(f.nonMrp),
        'Non-MRP Comm (19%) (₹)': Math.round(f.nonMrpComm),
        'Non-MRP Net (81%) (₹)': Math.round(f.nonMrpNet),
        'Total Gross Sale (₹)': Math.round(f.gross),
        'Total Commission (₹)': Math.round(f.totalComm),
        'Net Sale After Comm (₹)': Math.round(f.net),
        'Delivered Orders': r.orderCount || 1,
        'Session / Notes': r.description || '',
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Multi-Site Sales');
    XLSX.writeFile(
      workbook,
      `Tuckshop_Sales_Reconciliation_${formatOrdinalDate(new Date().toISOString().split('T')[0])}.xlsx`
    );
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-8 py-4 sm:py-8 space-y-6">
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
          <Badge
            variant="outline"
            className="text-[10px] bg-amber-50 text-amber-900 border-amber-300 font-black uppercase tracking-wider"
          >
            ⚡ 100% Cashless App Orders
          </Badge>
          <Badge
            variant="outline"
            className="text-[10px] bg-indigo-50 text-indigo-900 border-indigo-300 font-black uppercase tracking-wider"
          >
            📊 MRP (3%) &amp; Non-MRP (19%) Split
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
                  6-Month Ledger Fed
                </span>
              </div>
              <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white">
                All Sites Sales &amp; Commission Reconciliation
              </h1>
              <p className="text-xs text-rose-100/80 font-medium mt-0.5">
                Separate MRP (3% fee) &amp; Non-MRP (19% fee) breakdown, HungerBox digital ledger, and site-by-site net payouts.
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
              Export Excel (Reconciliation)
            </Button>
          </div>
        </div>
      </div>

      {/* 🧭 NAVIGATION TABS (Daily Ledger vs Item Breakdown vs P&L Analytics) */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2 overflow-x-auto">
        <Link
          href="/newrelic/tuckshop/sales"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm whitespace-nowrap"
        >
          <Building2 className="w-4 h-4" />
          Consolidated Daily Ledger
        </Link>
        <Link
          href="/newrelic/tuckshop/sales/items"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/60 transition-colors whitespace-nowrap"
        >
          <ShoppingBag className="w-4 h-4 text-amber-500" />
          Item Sales Breakdown
        </Link>
        <Link
          href="/newrelic/tuckshop/analytics"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-emerald-700 dark:text-emerald-400 hover:text-slate-900 dark:hover:text-white hover:bg-emerald-50 dark:hover:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 transition-colors whitespace-nowrap"
        >
          <TrendingUp className="w-4 h-4 text-emerald-600" />
          P&amp;L Executive Analytics
        </Link>
      </div>

      {/* 🔴 LIVE DATA PULL STATUS BANNER */}
      <div className="rounded-2xl sm:rounded-3xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 shadow-sm space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="relative flex items-center justify-center">
              <span
                className={`w-3.5 h-3.5 rounded-full ${
                  syncStatus.workerConfigured ? 'bg-emerald-500' : 'bg-amber-500'
                }`}
              />
              <span
                className={`absolute w-3.5 h-3.5 rounded-full ${
                  syncStatus.workerConfigured ? 'bg-emerald-400 animate-ping' : ''
                } opacity-75`}
              />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-xs sm:text-sm font-black text-slate-900 dark:text-white">
                  HungerBox Automated Sync:
                </p>
                <Badge
                  variant="outline"
                  className="text-[10px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-800 border-emerald-300"
                >
                  🟢 Daily 8:00 AM IST Auto-Sync Active
                </Badge>
                {syncStatus.autoCron?.lastSyncedToDate && (
                  <Badge
                    variant="outline"
                    className="text-[10px] font-mono font-bold bg-purple-50 text-purple-900 border-purple-300"
                  >
                    Data Fed Until: {formatOrdinalDate(syncStatus.autoCron.lastSyncedToDate)}
                  </Badge>
                )}
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                Automatically fetches yesterday's sales every morning by 8:00 AM - 8:30 AM IST from HungerBox API. Zero manual triggers required.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Button
              onClick={handleAggregateAllTelemetry}
              disabled={isAggregating}
              size="sm"
              variant="outline"
              className="h-8 rounded-xl font-bold text-xs border-amber-300 text-amber-900 bg-amber-50 hover:bg-amber-100"
            >
              <Zap
                className={`w-3 h-3 mr-1.5 text-amber-600 ${
                  isAggregating ? 'animate-spin' : ''
                }`}
              />
              {isAggregating ? 'Aggregating...' : 'Aggregate Telemetry to Ledger'}
            </Button>

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
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Total Cached Orders
            </p>
            <p className="text-base sm:text-lg font-black text-slate-900 dark:text-white font-mono mt-0.5">
              {syncStatus.totalOrdersCount.toLocaleString()}
            </p>
            <p className="text-[10px] text-slate-400">Captured in database</p>
          </div>

          <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Latest Order Date
            </p>
            <p className="text-base sm:text-lg font-black text-indigo-600 dark:text-indigo-400 font-mono mt-0.5">
              {syncStatus.latestOrderDate
                ? formatOrdinalDate(syncStatus.latestOrderDate)
                : 'No orders yet'}
            </p>
            <p className="text-[10px] text-slate-400">Most recent transaction</p>
          </div>

          <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Last Sync Event
            </p>
            <p className="text-xs sm:text-sm font-black text-slate-800 dark:text-slate-200 font-mono mt-1 truncate">
              {syncStatus.latestSyncedAt
                ? new Date(syncStatus.latestSyncedAt).toLocaleTimeString('en-IN', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })
                : 'Ready to pull'}
            </p>
            <p className="text-[10px] text-slate-400 truncate">
              {syncStatus.latestSyncedAt
                ? formatOrdinalDate(syncStatus.latestSyncedAt.split('T')[0])
                : 'Never'}
            </p>
          </div>

          <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Daily Ledger Records
            </p>
            <p className="text-xs sm:text-sm font-black text-emerald-600 dark:text-emerald-400 mt-1 flex items-center gap-1 font-mono">
              <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
              <span>{records.length} Daily Days</span>
            </p>
            <p className="text-[10px] text-slate-400">6 Months Historical Data</p>
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
            {statusMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            )}
            <span>{statusMessage.text}</span>
          </div>
        )}
      </div>

      {/* 🚀 COMPREHENSIVE FINANCIAL KPI SUMMARY CARDS (Gross, MRP 19%, Non-MRP 3%, Comm, Net) */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3 sm:gap-4">
        {/* 1. Total Gross Sales */}
        <div className="p-4 rounded-2xl sm:rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1">
              <TrendingUp className="w-3.5 h-3.5 text-blue-600" /> Total Sale
            </span>
          </div>
          <p className="text-xl sm:text-2xl font-mono font-black text-slate-900 dark:text-white tracking-tight">
            ₹{financials.totalGross.toLocaleString('en-IN')}
          </p>
          <p className="text-[10px] text-slate-400 mt-0.5">
            {filteredRecords.length} days recorded
          </p>
        </div>

        {/* 2. MRP Sales (3% Fee) */}
        <div className="p-4 rounded-2xl sm:rounded-3xl bg-gradient-to-b from-amber-50/50 to-white dark:from-amber-950/20 dark:to-slate-900 border border-amber-200 dark:border-amber-900/40 shadow-sm">
          <div className="flex items-center justify-between text-amber-800 dark:text-amber-400 mb-1">
            <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-wider flex items-center gap-1">
              <Tag className="w-3 h-3 text-amber-600" /> MRP Sales
            </span>
            <Badge className="text-[9px] bg-amber-500 text-white font-mono px-1 py-0 h-4">
              3% Comm
            </Badge>
          </div>
          <p className="text-xl sm:text-2xl font-mono font-black text-amber-950 dark:text-amber-200 tracking-tight">
            ₹{financials.totalMrp.toLocaleString('en-IN')}
          </p>
          <p className="text-[10px] text-amber-700 dark:text-amber-400 font-bold mt-0.5">
            Fee: -₹{financials.totalMrpComm.toLocaleString('en-IN')}
          </p>
        </div>

        {/* 3. Non-MRP Sales (19% Fee) */}
        <div className="p-4 rounded-2xl sm:rounded-3xl bg-gradient-to-b from-purple-50/50 to-white dark:from-purple-950/20 dark:to-slate-900 border border-purple-200 dark:border-purple-900/40 shadow-sm">
          <div className="flex items-center justify-between text-purple-800 dark:text-purple-400 mb-1">
            <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-wider flex items-center gap-1">
              <Receipt className="w-3 h-3 text-purple-600" /> Non-MRP Sales
            </span>
            <Badge className="text-[9px] bg-purple-600 text-white font-mono px-1 py-0 h-4">
              19% Comm
            </Badge>
          </div>
          <p className="text-xl sm:text-2xl font-mono font-black text-purple-950 dark:text-purple-200 tracking-tight">
            ₹{financials.totalNonMrp.toLocaleString('en-IN')}
          </p>
          <p className="text-[10px] text-purple-700 dark:text-purple-400 font-bold mt-0.5">
            Fee: -₹{financials.totalNonMrpComm.toLocaleString('en-IN')}
          </p>
        </div>

        {/* 4. Total Commission Deducted */}
        <div className="p-4 rounded-2xl sm:rounded-3xl bg-gradient-to-b from-rose-50/50 to-white dark:from-rose-950/20 dark:to-slate-900 border border-rose-200 dark:border-rose-900/40 shadow-sm">
          <div className="flex items-center justify-between text-rose-800 dark:text-rose-400 mb-1">
            <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-wider flex items-center gap-1">
              <Percent className="w-3 h-3 text-rose-600" /> Total Commission
            </span>
          </div>
          <p className="text-xl sm:text-2xl font-mono font-black text-rose-600 dark:text-rose-400 tracking-tight">
            -₹{financials.totalCommission.toLocaleString('en-IN')}
          </p>
          <p className="text-[10px] text-rose-700 dark:text-rose-400 font-bold mt-0.5">
            Avg Effective: {financials.effectiveCommRate}%
          </p>
        </div>

        {/* 5. Total Sale After Commission (Net Payout) */}
        <div className="p-4 rounded-2xl sm:rounded-3xl bg-gradient-to-b from-emerald-50/60 to-white dark:from-emerald-950/30 dark:to-slate-900 border-2 border-emerald-400/80 shadow-md">
          <div className="flex items-center justify-between text-emerald-800 dark:text-emerald-400 mb-1">
            <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-wider flex items-center gap-1">
              <DollarSign className="w-3.5 h-3.5 text-emerald-600" /> Net Sale Payout
            </span>
            <Badge className="text-[9px] bg-emerald-600 text-white font-mono px-1 py-0 h-4">
              Vendor Net
            </Badge>
          </div>
          <p className="text-xl sm:text-2xl font-mono font-black text-emerald-700 dark:text-emerald-300 tracking-tight">
            ₹{financials.totalNet.toLocaleString('en-IN')}
          </p>
          <p className="text-[10px] text-emerald-700 dark:text-emerald-400 font-bold mt-0.5">
            After 3% &amp; 19% cuts
          </p>
        </div>

        {/* 6. Total Orders & AOV */}
        <div className="p-4 rounded-2xl sm:rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1">
              <ShoppingBag className="w-3.5 h-3.5 text-amber-500" /> Orders
            </span>
          </div>
          <p className="text-xl sm:text-2xl font-mono font-black text-slate-900 dark:text-white tracking-tight">
            {financials.totalOrders.toLocaleString('en-IN')}
          </p>
          <p className="text-[10px] text-slate-500 font-medium mt-0.5">
            AOV: ₹{financials.aov} / ticket
          </p>
        </div>
      </div>

      {/* 🏢 PROMINENT MULTI-SITE SELECTOR CARDS */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <p className="text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
            <Building2 className="w-3.5 h-3.5 text-[#3b2fc9]" />
            Site Filter &amp; Performance Breakdown
          </p>
          <span className="text-[11px] text-slate-400 font-medium">
            Click any site card to filter records
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {/* All Sites Pill */}
          <button
            type="button"
            onClick={() => {
              triggerHaptic('light');
              setSelectedSiteFilter('all');
            }}
            className={`p-3.5 rounded-2xl border text-left transition-all ${
              selectedSiteFilter === 'all'
                ? 'border-[#3b2fc9] bg-indigo-50/70 dark:bg-indigo-950/40 ring-2 ring-[#3b2fc9]/80 shadow-sm'
                : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300'
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-black text-slate-900 dark:text-white flex items-center gap-1">
                All Sites
              </span>
              <Badge
                variant="outline"
                className={`text-[9px] font-mono font-bold ${
                  selectedSiteFilter === 'all' ? 'bg-[#3b2fc9] text-white border-transparent' : ''
                }`}
              >
                {filteredRecords.length} days
              </Badge>
            </div>
            <p className="text-base font-black text-[#3b2fc9] dark:text-indigo-400 font-mono">
              ₹{financials.totalGross.toLocaleString('en-IN')}
            </p>
            <div className="flex items-center justify-between text-[10px] text-slate-400 mt-1">
              <span>Net: ₹{financials.totalNet.toLocaleString('en-IN')}</span>
              <span>{financials.totalOrders} ord</span>
            </div>
          </button>

          {/* Individual Site Cards */}
          {sitePerformance.map((sp) => {
            const isSelected = selectedSiteFilter === sp.siteId;
            return (
              <button
                key={sp.siteId}
                type="button"
                onClick={() => {
                  triggerHaptic('light');
                  setSelectedSiteFilter(isSelected ? 'all' : sp.siteId);
                }}
                className={`p-3.5 rounded-2xl border text-left transition-all ${
                  isSelected
                    ? 'border-[#3b2fc9] bg-indigo-50/70 dark:bg-indigo-950/40 ring-2 ring-[#3b2fc9]/80 shadow-sm'
                    : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-black text-slate-900 dark:text-white truncate max-w-[130px]">
                    {sp.name}
                  </span>
                  <Badge
                    variant="outline"
                    className={`text-[9px] font-mono font-bold ${
                      isSelected ? 'bg-[#3b2fc9] text-white border-transparent' : ''
                    }`}
                  >
                    {sp.recordsCount} days
                  </Badge>
                </div>
                <p className="text-base font-black text-slate-900 dark:text-white font-mono">
                  ₹{Math.round(sp.gross).toLocaleString('en-IN')}
                </p>
                <div className="flex items-center justify-between text-[10px] text-slate-400 mt-1">
                  <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                    Net: ₹{Math.round(sp.net).toLocaleString('en-IN')}
                  </span>
                  <span>{sp.orders} ord</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* FILTER CONTROL BAR */}
      <div className="p-4 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-3.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Prominent Site Filter Dropdown / Selector Bar */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] font-black text-slate-500 uppercase tracking-wider flex items-center gap-1">
              <Filter className="w-3 h-3 text-indigo-600" /> Site:
            </span>
            <div className="inline-flex items-center p-0.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
              <button
                type="button"
                onClick={() => setSelectedSiteFilter('all')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                  selectedSiteFilter === 'all'
                    ? 'bg-white dark:bg-slate-900 text-[#3b2fc9] shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                All Sites ({filteredRecords.length})
              </button>
              {Object.entries(COMPANY_SITES).map(([sId, site]) => (
                <button
                  key={sId}
                  type="button"
                  onClick={() => setSelectedSiteFilter(sId)}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                    selectedSiteFilter === sId
                      ? 'bg-white dark:bg-slate-900 text-[#3b2fc9] shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                  }`}
                >
                  {site.name}
                </button>
              ))}
            </div>
          </div>

          {/* Search bar */}
          <div className="relative w-full sm:w-80">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input
              placeholder="Search date (e.g. 1st-jan-26), site, item..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-9 pl-9 text-xs rounded-xl bg-slate-50/60 dark:bg-slate-800/40 border-slate-200/80"
            />
          </div>
        </div>

        {/* Date range presets */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] font-bold text-slate-400 uppercase mr-1">Timeframe:</span>
            {[
              { id: '6months', label: '📅 Last 6 Months' },
              { id: 'month', label: 'This Month' },
              { id: 'week', label: 'Last 7 Days' },
              { id: 'yesterday', label: 'Yesterday' },
              { id: 'today', label: 'Today' },
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

          <div className="text-[11px] text-slate-400 flex items-center gap-1.5 font-medium">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Showing <strong>{filteredRecords.length} days</strong> • 100% HungerBox Cashless</span>
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

        {/* TAB 1: CONSOLIDATED DAILY SITE LEDGER (SEPARATE MRP & NON-MRP COLUMNS + ORDINAL DATES) */}
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
                  <p className="font-bold text-slate-800 dark:text-white">
                    No sales records found for current filters
                  </p>
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
                    <tr className="bg-slate-50/90 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 font-black uppercase text-[10px] tracking-wider whitespace-nowrap">
                      <th className="py-3.5 px-3.5">Date</th>
                      <th className="py-3.5 px-3.5">Site / Location</th>
                      <th className="py-3.5 px-4 text-right bg-amber-50/60 dark:bg-amber-950/20 text-amber-950 dark:text-amber-300">
                        <div className="flex items-center justify-end gap-1">
                          <Tag className="w-3 h-3 text-amber-600" />
                          <span>MRP Sale &amp; Comm (3%)</span>
                        </div>
                      </th>
                      <th className="py-3.5 px-4 text-right bg-purple-50/60 dark:bg-purple-950/20 text-purple-950 dark:text-purple-300">
                        <div className="flex items-center justify-end gap-1">
                          <Receipt className="w-3 h-3 text-purple-600" />
                          <span>Non-MRP Sale &amp; Comm (19%)</span>
                        </div>
                      </th>
                      <th className="py-3.5 px-4 text-right bg-slate-100/70 dark:bg-slate-800/50 text-slate-900 dark:text-slate-100">
                        <div className="flex items-center justify-end gap-1">
                          <Percent className="w-3 h-3 text-rose-600" />
                          <span>Total Gross &amp; Comm</span>
                        </div>
                      </th>
                      <th className="py-3.5 px-4 text-right bg-emerald-50/80 dark:bg-emerald-950/30 text-emerald-900 dark:text-emerald-300 font-black">
                        <div className="flex items-center justify-end gap-1">
                          <DollarSign className="w-3 h-3 text-emerald-600" />
                          <span>Net Sale (After Comm)</span>
                        </div>
                      </th>
                      <th className="py-3.5 px-3.5 text-center">Orders</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {filteredRecords.map((record) => {
                      const sId = resolveSiteId(record.siteId);
                      const siteName = COMPANY_SITES[sId]?.name || sId;
                      const f = getRecordFinancials(record);
                      const formattedDate = formatOrdinalDate(record.date);

                      return (
                        <tr
                          key={record.id}
                          className="hover:bg-indigo-50/30 dark:hover:bg-slate-800/50 transition-colors border-b border-slate-100 dark:border-slate-800/60"
                        >
                          {/* Formatted Date: "1st-jan-26" */}
                          <td className="py-3.5 px-3.5 font-mono font-bold text-slate-900 dark:text-white whitespace-nowrap">
                            <span className="inline-flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 px-2.5 py-1 rounded-lg text-xs font-mono font-bold shadow-2xs">
                              <Calendar className="w-3 h-3 text-slate-400" />
                              {formattedDate}
                            </span>
                          </td>

                          {/* Site & Location */}
                          <td className="py-3.5 px-3.5 whitespace-nowrap">
                            <div className="flex items-center gap-1.5">
                              <Badge
                                variant="outline"
                                className="font-bold text-[11px] bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 px-2 py-0.5"
                              >
                                {siteName}
                              </Badge>
                            </div>
                            <span className="text-[10px] text-slate-400 block truncate max-w-[140px] mt-0.5">
                              {record.location || 'Main Counter'}
                            </span>
                          </td>

                          {/* Merged: MRP Sale & Comm (3%) */}
                          <td className="py-3.5 px-4 text-right font-mono bg-amber-50/30 dark:bg-amber-950/10 whitespace-nowrap">
                            <div className="font-bold text-amber-950 dark:text-amber-200 text-xs sm:text-[13px]">
                              ₹{Math.round(f.mrp).toLocaleString('en-IN')}
                            </div>
                            <div className="text-[10px] text-amber-700/90 dark:text-amber-400 font-semibold mt-0.5">
                              {f.mrp > 0 ? (
                                `-₹${Math.round(f.mrpComm).toLocaleString('en-IN')} (3%)`
                              ) : (
                                <span className="text-slate-300 dark:text-slate-600">-₹0</span>
                              )}
                            </div>
                          </td>

                          {/* Merged: Non-MRP Sale & Comm (19%) */}
                          <td className="py-3.5 px-4 text-right font-mono bg-purple-50/30 dark:bg-purple-950/10 whitespace-nowrap">
                            <div className="font-bold text-purple-950 dark:text-purple-200 text-xs sm:text-[13px]">
                              ₹{Math.round(f.nonMrp).toLocaleString('en-IN')}
                            </div>
                            <div className="text-[10px] text-purple-700/90 dark:text-purple-400 font-semibold mt-0.5">
                              {f.nonMrp > 0 ? (
                                `-₹${Math.round(f.nonMrpComm).toLocaleString('en-IN')} (19%)`
                              ) : (
                                <span className="text-slate-300 dark:text-slate-600">-₹0</span>
                              )}
                            </div>
                          </td>

                          {/* Merged: Total Gross Sale & Total Comm */}
                          <td className="py-3.5 px-4 text-right font-mono bg-slate-50/60 dark:bg-slate-800/30 whitespace-nowrap">
                            <div className="font-black text-slate-900 dark:text-white text-xs sm:text-[13px]">
                              ₹{Math.round(f.gross).toLocaleString('en-IN')}
                            </div>
                            <div className="text-[10px] text-rose-600 dark:text-rose-400 font-bold mt-0.5">
                              -₹{Math.round(f.totalComm).toLocaleString('en-IN')}
                            </div>
                          </td>

                          {/* Total Sale After Commission (Net Payout) */}
                          <td className="py-3.5 px-4 text-right font-mono font-black text-emerald-700 dark:text-emerald-300 bg-emerald-50/50 dark:bg-emerald-950/20 whitespace-nowrap text-xs sm:text-sm">
                            ₹{Math.round(f.net).toLocaleString('en-IN')}
                          </td>

                          {/* Orders */}
                          <td className="py-3.5 px-3.5 text-center font-mono">
                            <span className="inline-block px-2 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200/80 dark:border-slate-700">
                              {record.orderCount || 1}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot className="bg-slate-100/95 dark:bg-slate-800 font-mono font-black text-xs border-t-2 border-slate-300 dark:border-slate-700">
                    <tr>
                      <td colSpan={2} className="py-4 px-3.5 text-slate-900 dark:text-white uppercase text-[11px] tracking-wider">
                        Total Summary ({filteredRecords.length} days)
                      </td>
                      <td className="py-4 px-4 text-right bg-amber-100/40 dark:bg-amber-950/30">
                        <div className="text-amber-950 dark:text-amber-200 text-xs sm:text-[13px]">
                          ₹{financials.totalMrp.toLocaleString('en-IN')}
                        </div>
                        <div className="text-[10px] text-amber-800 dark:text-amber-400 font-bold mt-0.5">
                          -₹{financials.totalMrpComm.toLocaleString('en-IN')} (3%)
                        </div>
                      </td>
                      <td className="py-4 px-4 text-right bg-purple-100/40 dark:bg-purple-950/30">
                        <div className="text-purple-950 dark:text-purple-200 text-xs sm:text-[13px]">
                          ₹{financials.totalNonMrp.toLocaleString('en-IN')}
                        </div>
                        <div className="text-[10px] text-purple-800 dark:text-purple-400 font-bold mt-0.5">
                          -₹{financials.totalNonMrpComm.toLocaleString('en-IN')} (19%)
                        </div>
                      </td>
                      <td className="py-4 px-4 text-right bg-slate-200/50 dark:bg-slate-800/60">
                        <div className="text-slate-900 dark:text-white text-xs sm:text-sm">
                          ₹{financials.totalGross.toLocaleString('en-IN')}
                        </div>
                        <div className="text-[10px] text-rose-600 dark:text-rose-400 font-bold mt-0.5">
                          -₹{financials.totalCommission.toLocaleString('en-IN')}
                        </div>
                      </td>
                      <td className="py-4 px-4 text-right text-emerald-800 dark:text-emerald-200 text-sm sm:text-base bg-emerald-100/70 dark:bg-emerald-900/40 font-black">
                        ₹{financials.totalNet.toLocaleString('en-IN')}
                      </td>
                      <td className="py-4 px-3.5 text-center text-slate-900 dark:text-white text-xs sm:text-sm">
                        {financials.totalOrders.toLocaleString('en-IN')}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              )}
            </div>
          </div>
        </TabsContent>

        {/* TAB 2: ORDER-BY-ORDER TELEMETRY STREAM */}
        <TabsContent value="telemetry">
          <div className="rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
            <div className="p-4 bg-slate-50/60 dark:bg-slate-800/50 border-b border-slate-200/80 dark:border-slate-800 flex items-center justify-between text-xs">
              <span className="font-bold text-slate-700 dark:text-slate-300">
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
                  <p className="font-bold text-slate-700 dark:text-slate-300">
                    No telemetry tickets found
                  </p>
                  <p className="text-xs text-slate-400">
                    Trigger sync to pull latest orders into database.
                  </p>
                </div>
              ) : (
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50/80 dark:bg-slate-800/60 border-b border-slate-200/80 dark:border-slate-800 text-slate-600 dark:text-slate-400 font-black uppercase text-[10px] tracking-wider whitespace-nowrap">
                      <th className="py-3 px-4">Order ID</th>
                      <th className="py-3 px-4">Order Date</th>
                      <th className="py-3 px-4">Cafeteria</th>
                      <th className="py-3 px-4">Item Name</th>
                      <th className="py-3 px-4 text-right">Amount</th>
                      <th className="py-3 px-4 text-center">Status</th>
                      <th className="py-3 px-4">Synced At</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {filteredTelemetry.map((order) => (
                      <tr
                        key={order.orderId}
                        className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                      >
                        <td className="py-3 px-4 font-mono font-bold text-slate-900 dark:text-white">
                          {order.orderId}
                        </td>
                        <td className="py-3 px-4 text-slate-700 dark:text-slate-300 font-mono">
                          {formatOrdinalDate(order.orderDate)}
                        </td>
                        <td className="py-3 px-4 font-bold text-slate-700 dark:text-slate-300">
                          {order.cafeteriaName || 'Main'}
                        </td>
                        <td className="py-3 px-4 font-bold text-slate-900 dark:text-white">
                          {order.itemName || 'Counter Meal'}
                        </td>
                        <td className="py-3 px-4 text-right font-black text-emerald-700 dark:text-emerald-400 font-mono">
                          ₹{order.amount.toFixed(2)}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <Badge
                            variant="outline"
                            className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-300 font-bold"
                          >
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
                        <Badge
                          variant="outline"
                          className="text-[10px] bg-indigo-50 text-indigo-700 border-indigo-200 font-black"
                        >
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
                      <span className="text-[10px] font-bold text-slate-400 block">
                        Triggered by:
                      </span>
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
