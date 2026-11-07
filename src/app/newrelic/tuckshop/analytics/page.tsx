'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import * as XLSX from 'xlsx';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Calendar,
  Building2,
  RefreshCw,
  Search,
  ArrowLeft,
  FileSpreadsheet,
  AlertCircle,
  Percent,
  Receipt,
  Tag,
  Filter,
  PieChart,
  ShoppingBag,
  Zap,
  ShieldCheck,
  ChevronRight,
  Flame,
  ChefHat,
  Package,
  Layers,
  ArrowUpRight,
  ArrowDownRight,
  Wallet,
} from 'lucide-react';
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
  PieChart as RechartsPie,
  Pie,
  Cell,
} from 'recharts';
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
import { CogsHealthGauge } from '@/components/newrelic/tuckshop/CogsHealthGauge';
import { PettyCashFloatWidget } from '@/components/newrelic/tuckshop/PettyCashFloatWidget';
import { useAuth } from '@/contexts/AuthContext';
import {
  computeTuckshopPnL,
  TuckshopPnLSummary,
  classifyExpenseCategory,
  normalizeCategoryName,
} from '@/services/tuckshopPnLService';
import { triggerHaptic } from '@/lib/haptics';
import { formatOrdinalDate } from '@/services/hungerboxParser';

const PIE_COLORS = ['#3b2fc9', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#06b6d4', '#ef4444', '#64748b'];

export default function TuckshopAnalyticsPage() {
  const { role } = useAuth();
  const isAdmin = role === 'admin' || role === 'superadmin';
  const [records, setRecords] = useState<NewRelicTuckshopRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);

  // Filters
  const [selectedSiteFilter, setSelectedSiteFilter] = useState<string>('all');
  const [datePreset, setDatePreset] = useState<string>('6months');
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

  // 2. Subscribe to Firestore tuckshop records (both sales & expenses)
  useEffect(() => {
    const unsubscribe = subscribeToTuckshopRecords((data) => {
      setRecords(data);
      setIsLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // 3. Compute effective start/end date from preset
  const dateRange = useMemo(() => {
    const now = new Date();
    const formatYmd = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

    if (datePreset === 'today') {
      const todayStr = formatYmd(now);
      return { start: todayStr, end: todayStr };
    }
    if (datePreset === 'yesterday') {
      const y = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const yStr = formatYmd(y);
      return { start: yStr, end: yStr };
    }
    if (datePreset === 'week') {
      const w = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      return { start: formatYmd(w), end: formatYmd(now) };
    }
    if (datePreset === 'month') {
      const m = new Date(now.getFullYear(), now.getMonth(), 1);
      return { start: formatYmd(m), end: formatYmd(now) };
    }
    if (datePreset === 'last_month') {
      const first = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const last = new Date(now.getFullYear(), now.getMonth(), 0);
      return { start: formatYmd(first), end: formatYmd(last) };
    }
    if (datePreset === '3months') {
      const m = new Date(now);
      m.setMonth(m.getMonth() - 3);
      return { start: formatYmd(m), end: formatYmd(now) };
    }
    if (datePreset === '6months') {
      const m = new Date(now);
      m.setMonth(m.getMonth() - 6);
      return { start: formatYmd(m), end: formatYmd(now) };
    }
    if (datePreset === 'all') {
      return { start: '', end: '' };
    }
    if (datePreset === 'custom') {
      return { start: customStartDate, end: customEndDate };
    }
    return { start: '', end: '' };
  }, [datePreset, customStartDate, customEndDate]);

  // 4. Compute comprehensive P&L using analytics service
  const pnl: TuckshopPnLSummary = useMemo(() => {
    return computeTuckshopPnL(records, {
      siteId: selectedSiteFilter,
      startDate: dateRange.start,
      endDate: dateRange.end,
    });
  }, [records, selectedSiteFilter, dateRange]);

  // 5. Filter daily timeline for search bar
  const filteredTimeline = useMemo(() => {
    if (!searchTerm.trim()) return pnl.dailyTimeline;
    const term = searchTerm.toLowerCase();
    return pnl.dailyTimeline.filter(
      (d) =>
        d.date.includes(term) ||
        d.displayDate.toLowerCase().includes(term) ||
        (d.siteId && d.siteId.toLowerCase().includes(term))
    );
  }, [pnl.dailyTimeline, searchTerm]);

  // 6. Chart datasets
  const timelineChartData = useMemo(() => {
    // Return last 45 active points for legible chart display
    return pnl.dailyTimeline.slice(-45).map((d) => ({
      date: d.date,
      displayDate: d.displayDate.split('-')[0] + ' ' + d.displayDate.split('-')[1],
      grossSales: d.grossSales,
      netRevenue: d.netRevenue,
      commission: d.totalCommission,
      totalExpenses: d.totalExpenses,
      cogs: d.cogs,
      opex: d.opex,
      netProfit: d.netProfit,
    }));
  }, [pnl.dailyTimeline]);

  // Revenue mix donut
  const revenueMixData = useMemo(() => {
    return [
      { name: 'MRP Sales (3% Fee)', value: pnl.mrpSales, color: '#f59e0b' },
      { name: 'Non-MRP Fresh Food (19% Fee)', value: pnl.nonMrpSales, color: '#8b5cf6' },
    ].filter((item) => item.value > 0);
  }, [pnl.mrpSales, pnl.nonMrpSales]);

  // Expense nature pie
  const expenseNatureData = useMemo(() => {
    return [
      { name: 'COGS (Food & Raw Materials)', value: pnl.totalCogs, color: '#06b6d4' },
      { name: 'OPEX (Staff, Gas, Cutlery)', value: pnl.totalOpex, color: '#ef4444' },
    ].filter((item) => item.value > 0);
  }, [pnl.totalCogs, pnl.totalOpex]);

  // 7. Export P&L to Excel
  const handleExportExcel = () => {
    triggerHaptic('medium');
    const wb = XLSX.utils.book_new();

    // Sheet 1: Executive Summary Statement
    const summaryData = [
      ['THE GUT GURU - EXECUTIVE TUCKSHOP P&L STATEMENT'],
      [`Generated: ${new Date().toLocaleString('en-IN')}`],
      [`Filter Site: ${selectedSiteFilter.toUpperCase()}`],
      [`Period: ${pnl.startDate || 'Beginning'} to ${pnl.endDate || 'Present'}`],
      [],
      ['FINANCIAL LINE ITEM', 'AMOUNT (INR)', '% OF NET REVENUE', 'NOTES'],
      ['Gross HungerBox Sales', pnl.grossSales, `${Math.round((pnl.grossSales / (pnl.netRevenue || 1)) * 100)}%`, 'Total customer orders'],
      ['  - MRP Packaged Sales (3% Fee)', pnl.mrpSales, '', 'Biscuits, chips, packaged snacks'],
      ['  - Non-MRP Fresh Kitchen (19% Fee)', pnl.nonMrpSales, '', 'Maggi, Sandwiches, Juices, Breakfast'],
      ['Aggregator Commission Deducted', -pnl.totalCommission, `-${pnl.effectiveCommissionRate}%`, 'HungerBox platform commission'],
      ['  - MRP Commission (3%)', -pnl.mrpCommission, '-3.0%', 'Exact 3% on packaged goods'],
      ['  - Non-MRP Commission (19%)', -pnl.nonMrpCommission, '-19.0%', 'Exact 19% on kitchen prepared'],
      ['NET REVENUE / BANK SETTLEMENT', pnl.netRevenue, '100.0%', 'Direct vendor bank payout'],
      [],
      ['Cost of Goods Sold (COGS)', -pnl.totalCogs, `-${pnl.cogsPercentage}%`, 'Raw materials & kitchen groceries'],
      ['GROSS PROFIT', pnl.grossProfit, `${pnl.grossMarginPct}%`, 'Net Revenue minus COGS'],
      [],
      ['Operating Expenses (OPEX)', -pnl.totalOpex, `-${pnl.opexPercentage}%`, 'Staff, gas cylinders, cutlery, maintenance'],
      ['TOTAL EXPENSES (COGS + OPEX)', -pnl.totalExpenses, `-${Math.round((pnl.totalExpenses / (pnl.netRevenue || 1)) * 100)}%`, 'All recorded tuckshop costs'],
      [],
      ['NET OPERATING PROFIT (EBITDA)', pnl.netProfit, `${pnl.netProfitMarginPct}%`, 'Final tuckshop operating bottom line'],
      [],
      ['OPERATIONAL METRICS', 'VALUE'],
      ['Total Recorded Days', pnl.totalDays],
      ['Active Sales Days', pnl.activeSalesDays],
      ['Total Orders', pnl.orderCount],
      ['Average Order Value (AOV)', `INR ${pnl.avgOrderValue}`],
      ['Average Daily Net Revenue', `INR ${pnl.avgDailyNetRevenue}`],
      ['Average Daily Net Profit', `INR ${pnl.avgDailyProfit}`],
    ];

    const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, wsSummary, 'P&L Executive Summary');

    // Sheet 2: Site-by-Site P&L Matrix
    const siteData = [
      [
        'Site ID',
        'Site Name',
        'Active Days',
        'Gross Sales',
        'MRP Sales',
        'Non-MRP Sales',
        'Total Commission',
        'Effective Comm %',
        'Net Revenue',
        'COGS (Food Cost)',
        'Gross Profit',
        'Gross Margin %',
        'OPEX (Overheads)',
        'Total Expenses',
        'Net Profit',
        'Net Margin %',
        'Orders',
        'AOV',
      ],
      ...pnl.siteBreakdowns.map((s) => [
        s.siteId,
        s.name,
        s.daysCount,
        s.grossSales,
        s.mrpSales,
        s.nonMrpSales,
        s.totalCommission,
        `${s.effectiveCommRate}%`,
        s.netRevenue,
        s.cogs,
        s.grossProfit,
        `${s.grossMarginPct}%`,
        s.opex,
        s.totalExpenses,
        s.netProfit,
        `${s.netProfitMarginPct}%`,
        s.orderCount,
        s.avgOrderValue,
      ]),
    ];
    const wsSite = XLSX.utils.aoa_to_sheet(siteData);
    XLSX.utils.book_append_sheet(wb, wsSite, 'Multi-Site Breakdown');

    // Sheet 3: Daily Timeline
    const timelineData = [
      [
        'Date',
        'Display Date',
        'Site',
        'Gross Sales',
        'MRP Sales (3%)',
        'Non-MRP (19%)',
        'Total Commission',
        'Net Revenue',
        'COGS (Raw Materials)',
        'Gross Profit',
        'OPEX (Overhead)',
        'Total Expenses',
        'Net Profit',
        'Margin %',
        'Orders',
      ],
      ...pnl.dailyTimeline.map((d) => [
        d.date,
        d.displayDate,
        d.siteId || 'all',
        d.grossSales,
        d.mrpSales,
        d.nonMrpSales,
        d.totalCommission,
        d.netRevenue,
        d.cogs,
        d.grossProfit,
        d.opex,
        d.totalExpenses,
        d.netProfit,
        `${d.netProfitMarginPct}%`,
        d.orderCount,
      ]),
    ];
    const wsTimeline = XLSX.utils.aoa_to_sheet(timelineData);
    XLSX.utils.book_append_sheet(wb, wsTimeline, 'Daily P&L Ledger');

    // Sheet 4: Expense Categories
    const expenseData = [
      ['Category Name', 'Nature (COGS/OPEX)', 'Total Amount (INR)', 'Record Count', '% of Nature Group', '% of Total Expense'],
      ...pnl.allExpenseCategories.map((c) => [
        c.normalizedName,
        c.nature,
        c.amount,
        c.count,
        `${c.percentageOfGroup}%`,
        `${c.percentageOfTotalExpense}%`,
      ]),
    ];
    const wsExpenses = XLSX.utils.aoa_to_sheet(expenseData);
    XLSX.utils.book_append_sheet(wb, wsExpenses, 'Expense Categories');

    XLSX.writeFile(
      wb,
      `Tuckshop_PnL_Report_${selectedSiteFilter}_${new Date().toISOString().split('T')[0]}.xlsx`
    );
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-8 py-4 sm:py-8 space-y-5 sm:space-y-6">
      {/* Breadcrumb Navigation Strip */}
      <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
        <Link
          href="/newrelic/tuckshop"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Tuckshop Counter</span>
        </Link>

        <div className="flex items-center gap-2">
          <Badge
            variant="outline"
            className="text-[10px] bg-emerald-50 text-emerald-900 border-emerald-300 font-black uppercase tracking-wider"
          >
            ⚡ Exact 3% &amp; 19% Commissions
          </Badge>
          <Badge
            variant="outline"
            className="text-[10px] bg-purple-50 text-purple-900 border-purple-300 font-black uppercase tracking-wider"
          >
            📊 Automated P&amp;L Engine
          </Badge>
        </div>
      </div>

      {/* Hero Header */}
      <div className="rounded-2xl sm:rounded-3xl bg-gradient-to-r from-[#1c1917] via-[#2d1b2d] to-[#1e1b4b] p-5 sm:p-7 text-white shadow-xl relative overflow-hidden">
        <div className="absolute -right-10 -top-10 w-48 h-48 bg-purple-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute right-36 -bottom-10 w-40 h-40 bg-emerald-500/15 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-5">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-br from-emerald-400/20 to-teal-500/20 border-2 border-emerald-300/40 flex items-center justify-center text-emerald-300 shadow-lg shrink-0">
              <PieChart className="w-6 h-6 sm:w-7 sm:h-7" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <span className="text-[10px] font-black uppercase tracking-wider bg-emerald-400/20 text-emerald-300 border border-emerald-400/30 px-2 py-0.5 rounded-full">
                  Executive Suite
                </span>
                <span className="text-[10px] font-black uppercase tracking-wider bg-purple-500/20 text-purple-300 border border-purple-400/30 px-2 py-0.5 rounded-full">
                  Multi-Site P&amp;L
                </span>
              </div>
              <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white">
                Tuckshop Profit &amp; Loss Analytics
              </h1>
              <p className="text-xs text-rose-100/80 font-medium mt-0.5">
                Automated HungerBox sales, exact commission deductions, COGS food cost, OPEX overhead, and net store profit.
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
              Sync HungerBox
            </Button>

            <Button
              variant="outline"
              onClick={handleExportExcel}
              className="h-10 px-3.5 rounded-2xl bg-white/10 hover:bg-white/20 border-white/20 text-white font-bold text-xs active:scale-95 transition-all"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 mr-1.5" />
              Export Full P&amp;L (Excel)
            </Button>
          </div>
        </div>
      </div>

      {/* 🧭 NAVIGATION TABS (Daily Ledger vs Item Breakdown vs P&L Analytics) */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2 overflow-x-auto">
        <Link
          href="/newrelic/tuckshop/sales"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/60 transition-colors whitespace-nowrap"
        >
          <Building2 className="w-4 h-4 text-slate-500" />
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
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm whitespace-nowrap"
        >
          <PieChart className="w-4 h-4 text-emerald-400 dark:text-emerald-600" />
          P&amp;L Executive Analytics
        </Link>
      </div>

      {/* 🏢 SITE SELECTOR CARDS */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <p className="text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
            <Building2 className="w-3.5 h-3.5 text-[#3b2fc9]" />
            Site Filter &amp; P&amp;L Scope
          </p>
          <span className="text-[11px] text-slate-400 font-medium">
            Click any site card to isolate unit economics
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {/* All Sites Card */}
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
                All Sites Consolidated
              </span>
              <Badge
                variant="outline"
                className={`text-[9px] font-mono font-bold ${
                  selectedSiteFilter === 'all' ? 'bg-[#3b2fc9] text-white border-transparent' : ''
                }`}
              >
                {pnl.activeSalesDays} days
              </Badge>
            </div>
            <p className="text-base font-black text-[#3b2fc9] dark:text-indigo-400 font-mono">
              ₹{pnl.grossSales.toLocaleString('en-IN')}
            </p>
            <div className="flex items-center justify-between text-[10px] text-slate-400 mt-1">
              <span className="text-emerald-600 font-bold">
                Profit: ₹{pnl.netProfit.toLocaleString('en-IN')}
              </span>
              <span>{pnl.netProfitMarginPct}% margin</span>
            </div>
          </button>

          {/* Individual Site Cards */}
          {pnl.siteBreakdowns.map((sp) => {
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
                    {sp.daysCount} days
                  </Badge>
                </div>
                <p className="text-base font-black text-slate-900 dark:text-white font-mono">
                  ₹{Math.round(sp.grossSales).toLocaleString('en-IN')}
                </p>
                <div className="flex items-center justify-between text-[10px] text-slate-400 mt-1">
                  <span className={`font-bold ${sp.netProfit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                    Profit: ₹{Math.round(sp.netProfit).toLocaleString('en-IN')}
                  </span>
                  <span>{sp.netProfitMarginPct}%</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* FILTER CONTROL BAR */}
      <div className="p-4 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-3.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Date Range Presets */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] font-black text-slate-500 uppercase tracking-wider flex items-center gap-1 mr-1">
              <Calendar className="w-3 h-3 text-indigo-600" /> Range:
            </span>

            {[
              { id: 'today', label: 'Today' },
              { id: 'yesterday', label: 'Yesterday' },
              { id: 'week', label: 'Last 7 Days' },
              { id: 'month', label: 'This Month' },
              { id: 'last_month', label: 'Last Month' },
              { id: '3months', label: '3 Months' },
              { id: '6months', label: '6 Months' },
              { id: 'all', label: 'All Time' },
              { id: 'custom', label: 'Custom' },
            ].map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  triggerHaptic('light');
                  setDatePreset(p.id);
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  datePreset === p.id
                    ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-xs'
                    : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Quick Search */}
          <div className="relative min-w-[200px] sm:w-64">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Filter by date..."
              className="pl-8 h-8 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700"
            />
          </div>
        </div>

        {/* Custom Date Inputs if selected */}
        {datePreset === 'custom' && (
          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center gap-3 text-xs flex-wrap">
            <span className="font-bold text-slate-600 dark:text-slate-400">Custom Date Span:</span>
            <Input
              type="date"
              value={customStartDate}
              onChange={(e) => setCustomStartDate(e.target.value)}
              className="h-8 w-36 rounded-xl text-xs"
            />
            <span className="text-slate-400">to</span>
            <Input
              type="date"
              value={customEndDate}
              onChange={(e) => setCustomEndDate(e.target.value)}
              className="h-8 w-36 rounded-xl text-xs"
            />
          </div>
        )}
      </div>

      {/* 🚀 COMPREHENSIVE P&L EXECUTIVE KPI SCORECARD */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 sm:gap-3.5">
        {/* 1. Gross Sales */}
        <div className="p-3.5 sm:p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-slate-400 mb-1">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1">
                <TrendingUp className="w-3 h-3 text-blue-600" /> Gross Sales
              </span>
            </div>
            <p className="text-lg sm:text-xl font-mono font-black text-slate-900 dark:text-white tracking-tight">
              ₹{pnl.grossSales.toLocaleString('en-IN')}
            </p>
          </div>
          <div className="flex items-center justify-between text-[10px] text-slate-400 mt-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <span>{pnl.orderCount} orders</span>
            <span>AOV: ₹{pnl.avgOrderValue}</span>
          </div>
        </div>

        {/* 2. Platform Commission */}
        <div className="p-3.5 sm:p-4 rounded-2xl bg-gradient-to-b from-rose-50/50 to-white dark:from-rose-950/20 dark:to-slate-900 border border-rose-200 dark:border-rose-900/40 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-rose-800 dark:text-rose-400 mb-1">
              <span className="text-[10px] font-black uppercase tracking-wider flex items-center gap-1">
                <Percent className="w-3 h-3 text-rose-600" /> HungerBox Fee
              </span>
              <Badge className="text-[9px] bg-rose-600 text-white font-mono px-1 py-0 h-3.5">
                {pnl.effectiveCommissionRate}%
              </Badge>
            </div>
            <p className="text-lg sm:text-xl font-mono font-black text-rose-600 dark:text-rose-400 tracking-tight">
              -₹{pnl.totalCommission.toLocaleString('en-IN')}
            </p>
          </div>
          <div className="flex items-center justify-between text-[10px] text-rose-700 dark:text-rose-400 font-bold mt-2 pt-2 border-t border-rose-100 dark:border-rose-900/40">
            <span>MRP: 3%</span>
            <span>Kitchen: 19%</span>
          </div>
        </div>

        {/* 3. Realized Net Revenue */}
        <div className="p-3.5 sm:p-4 rounded-2xl bg-gradient-to-b from-indigo-50/60 to-white dark:from-indigo-950/30 dark:to-slate-900 border border-indigo-200 dark:border-indigo-900/50 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-indigo-800 dark:text-indigo-400 mb-1">
              <span className="text-[10px] font-black uppercase tracking-wider flex items-center gap-1">
                <Wallet className="w-3 h-3 text-indigo-600" /> Net Payout
              </span>
              <Badge className="text-[9px] bg-indigo-600 text-white font-mono px-1 py-0 h-3.5">
                Bank
              </Badge>
            </div>
            <p className="text-lg sm:text-xl font-mono font-black text-indigo-950 dark:text-indigo-200 tracking-tight">
              ₹{pnl.netRevenue.toLocaleString('en-IN')}
            </p>
          </div>
          <div className="text-[10px] text-indigo-700 dark:text-indigo-400 font-bold mt-2 pt-2 border-t border-indigo-100 dark:border-indigo-900/40">
            Expected bank inflow
          </div>
        </div>

        {/* 4. Cost of Goods Sold (COGS) */}
        <div className="p-3.5 sm:p-4 rounded-2xl bg-gradient-to-b from-cyan-50/50 to-white dark:from-cyan-950/20 dark:to-slate-900 border border-cyan-200 dark:border-cyan-900/40 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-cyan-800 dark:text-cyan-400 mb-1">
              <span className="text-[10px] font-black uppercase tracking-wider flex items-center gap-1">
                <ChefHat className="w-3 h-3 text-cyan-600" /> COGS (Food)
              </span>
              <Badge className="text-[9px] bg-cyan-600 text-white font-mono px-1 py-0 h-3.5">
                {pnl.cogsPercentage}%
              </Badge>
            </div>
            <p className="text-lg sm:text-xl font-mono font-black text-cyan-950 dark:text-cyan-200 tracking-tight">
              -₹{pnl.totalCogs.toLocaleString('en-IN')}
            </p>
          </div>
          <div className="text-[10px] text-cyan-700 dark:text-cyan-400 font-bold mt-2 pt-2 border-t border-cyan-100 dark:border-cyan-900/40">
            Ingredients &amp; stock
          </div>
        </div>

        {/* 5. Gross Profit */}
        <div className="p-3.5 sm:p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-slate-500 mb-1">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1">
                <Layers className="w-3 h-3 text-emerald-600" /> Gross Profit
              </span>
              <Badge className="text-[9px] bg-emerald-600 text-white font-mono px-1 py-0 h-3.5">
                {pnl.grossMarginPct}%
              </Badge>
            </div>
            <p className="text-lg sm:text-xl font-mono font-black text-slate-900 dark:text-white tracking-tight">
              ₹{pnl.grossProfit.toLocaleString('en-IN')}
            </p>
          </div>
          <div className="text-[10px] text-slate-400 mt-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            Net Revenue - COGS
          </div>
        </div>

        {/* 6. OPEX (Operating Expenses) */}
        <div className="p-3.5 sm:p-4 rounded-2xl bg-gradient-to-b from-amber-50/50 to-white dark:from-amber-950/20 dark:to-slate-900 border border-amber-200 dark:border-amber-900/40 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-amber-800 dark:text-amber-400 mb-1">
              <span className="text-[10px] font-black uppercase tracking-wider flex items-center gap-1">
                <Flame className="w-3 h-3 text-amber-600" /> OPEX (Staff/Gas)
              </span>
              <Badge className="text-[9px] bg-amber-600 text-white font-mono px-1 py-0 h-3.5">
                {pnl.opexPercentage}%
              </Badge>
            </div>
            <p className="text-lg sm:text-xl font-mono font-black text-amber-950 dark:text-amber-200 tracking-tight">
              -₹{pnl.totalOpex.toLocaleString('en-IN')}
            </p>
          </div>
          <div className="text-[10px] text-amber-700 dark:text-amber-400 font-bold mt-2 pt-2 border-t border-amber-100 dark:border-amber-900/40">
            Wages, gas &amp; cutlery
          </div>
        </div>

        {/* 7. Net Operating Profit (EBITDA) */}
        <div className={`p-3.5 sm:p-4 rounded-2xl border-2 shadow-md flex flex-col justify-between col-span-2 md:col-span-1 ${
          pnl.netProfit >= 0
            ? 'bg-gradient-to-b from-emerald-50 to-white dark:from-emerald-950/40 dark:to-slate-900 border-emerald-500'
            : 'bg-gradient-to-b from-rose-50 to-white dark:from-rose-950/40 dark:to-slate-900 border-rose-500'
        }`}>
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className={`text-[10px] font-black uppercase tracking-wider flex items-center gap-1 ${
                pnl.netProfit >= 0 ? 'text-emerald-900 dark:text-emerald-300' : 'text-rose-900 dark:text-rose-300'
              }`}>
                <DollarSign className="w-3.5 h-3.5" /> Net Profit
              </span>
              <Badge className={`text-[9px] font-mono px-1.5 py-0 h-4 ${
                pnl.netProfit >= 0 ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'
              }`}>
                {pnl.netProfitMarginPct}%
              </Badge>
            </div>
            <p className={`text-lg sm:text-xl font-mono font-black tracking-tight ${
              pnl.netProfit >= 0 ? 'text-emerald-700 dark:text-emerald-300' : 'text-rose-600 dark:text-rose-400'
            }`}>
              ₹{pnl.netProfit.toLocaleString('en-IN')}
            </p>
          </div>
          <div className={`text-[10px] font-bold mt-2 pt-2 border-t ${
            pnl.netProfit >= 0
              ? 'text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900'
              : 'text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-900'
          }`}>
            Bottom Line Cash
          </div>
        </div>
      </div>

      {/* 📊 CHARTS SECTION: TIMELINE RUN-RATE & REVENUE MIX */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Main Timeline Run Rate Chart (2 Cols) */}
        <div className="lg:col-span-2 p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-1.5">
                <TrendingUp className="w-4 h-4 text-indigo-600" />
                Financial Run Rate (Net Revenue vs Total Expenses vs Profit)
              </h3>
              <p className="text-xs text-slate-400">
                Daily cash trend across {timelineChartData.length} active data points.
              </p>
            </div>
            <span className="text-[11px] font-mono font-bold text-slate-500">
              Avg Daily Profit: ₹{pnl.avgDailyProfit.toLocaleString('en-IN')}
            </span>
          </div>

          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={timelineChartData}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                <XAxis dataKey="displayDate" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={(val) => `₹${val >= 1000 ? `${(val/1000).toFixed(0)}k` : val}`} />
                <Tooltip
                  formatter={(val: any, name: any) => [
                    `₹${Number(val).toLocaleString('en-IN')}`,
                    name === 'netRevenue' ? 'Net Settlement' : name === 'totalExpenses' ? 'Total Expenses' : name === 'netProfit' ? 'Net Profit' : name,
                  ]}
                  contentStyle={{
                    backgroundColor: 'rgba(15, 23, 42, 0.95)',
                    borderRadius: '12px',
                    color: '#fff',
                    fontSize: '11px',
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                <Area
                  type="monotone"
                  dataKey="netRevenue"
                  name="Net Settlement"
                  fill="#3b2fc9"
                  fillOpacity={0.15}
                  stroke="#3b2fc9"
                  strokeWidth={2}
                />
                <Bar
                  dataKey="totalExpenses"
                  name="Total Expenses"
                  fill="#ef4444"
                  radius={[4, 4, 0, 0]}
                  barSize={12}
                />
                <Line
                  type="monotone"
                  dataKey="netProfit"
                  name="Net Profit"
                  stroke="#10b981"
                  strokeWidth={2.5}
                  dot={{ r: 2 }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Revenue & Expense Mix Sidekick (1 Col) */}
        <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-4 flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-1.5">
              <PieChart className="w-4 h-4 text-purple-600" />
              Sales &amp; Expense Distribution
            </h3>
            <p className="text-xs text-slate-400">
              MRP (3% fee) vs Non-MRP (19% fee) &amp; COGS vs OPEX
            </p>
          </div>

          {/* Revenue Mix Progress */}
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-slate-700 dark:text-slate-300">Sales Mix:</span>
              <span className="font-mono text-slate-400 text-[11px]">
                MRP {pnl.grossSales > 0 ? Math.round((pnl.mrpSales / pnl.grossSales) * 100) : 0}% / Kitchen {pnl.grossSales > 0 ? Math.round((pnl.nonMrpSales / pnl.grossSales) * 100) : 0}%
              </span>
            </div>
            <div className="h-3 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden flex">
              <div
                style={{ width: `${pnl.grossSales > 0 ? (pnl.mrpSales / pnl.grossSales) * 100 : 0}%` }}
                className="bg-amber-500 h-full transition-all"
                title={`MRP: ₹${pnl.mrpSales.toLocaleString('en-IN')}`}
              />
              <div
                style={{ width: `${pnl.grossSales > 0 ? (pnl.nonMrpSales / pnl.grossSales) * 100 : 0}%` }}
                className="bg-purple-600 h-full transition-all"
                title={`Non-MRP: ₹${pnl.nonMrpSales.toLocaleString('en-IN')}`}
              />
            </div>
            <div className="grid grid-cols-2 gap-2 text-[11px] pt-1">
              <div className="p-2 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-900/40">
                <span className="text-amber-800 dark:text-amber-300 font-bold block">MRP (3% fee)</span>
                <span className="font-black text-amber-950 dark:text-amber-200 font-mono">₹{pnl.mrpSales.toLocaleString('en-IN')}</span>
              </div>
              <div className="p-2 rounded-xl bg-purple-50 dark:bg-purple-950/20 border border-purple-200/60 dark:border-purple-900/40">
                <span className="text-purple-800 dark:text-purple-300 font-bold block">Non-MRP (19%)</span>
                <span className="font-black text-purple-950 dark:text-purple-200 font-mono">₹{pnl.nonMrpSales.toLocaleString('en-IN')}</span>
              </div>
            </div>
          </div>

          {/* Expense Nature Progress */}
          <div className="space-y-3 pt-3 border-t border-slate-100 dark:border-slate-800">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-slate-700 dark:text-slate-300">Expense Split:</span>
              <span className="font-mono text-slate-400 text-[11px]">
                COGS {pnl.totalExpenses > 0 ? Math.round((pnl.totalCogs / pnl.totalExpenses) * 100) : 0}% / OPEX {pnl.totalExpenses > 0 ? Math.round((pnl.totalOpex / pnl.totalExpenses) * 100) : 0}%
              </span>
            </div>
            <div className="h-3 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden flex">
              <div
                style={{ width: `${pnl.totalExpenses > 0 ? (pnl.totalCogs / pnl.totalExpenses) * 100 : 0}%` }}
                className="bg-cyan-500 h-full transition-all"
                title={`COGS: ₹${pnl.totalCogs.toLocaleString('en-IN')}`}
              />
              <div
                style={{ width: `${pnl.totalExpenses > 0 ? (pnl.totalOpex / pnl.totalExpenses) * 100 : 0}%` }}
                className="bg-rose-500 h-full transition-all"
                title={`OPEX: ₹${pnl.totalOpex.toLocaleString('en-IN')}`}
              />
            </div>
            <div className="grid grid-cols-2 gap-2 text-[11px] pt-1">
              <div className="p-2 rounded-xl bg-cyan-50 dark:bg-cyan-950/20 border border-cyan-200/60 dark:border-cyan-900/40">
                <span className="text-cyan-800 dark:text-cyan-300 font-bold block">Food COGS</span>
                <span className="font-black text-cyan-950 dark:text-cyan-200 font-mono">₹{pnl.totalCogs.toLocaleString('en-IN')}</span>
              </div>
              <div className="p-2 rounded-xl bg-rose-50 dark:bg-rose-950/20 border border-rose-200/60 dark:border-rose-900/40">
                <span className="text-rose-800 dark:text-rose-300 font-bold block">Overhead OPEX</span>
                <span className="font-black text-rose-950 dark:text-rose-200 font-mono">₹{pnl.totalOpex.toLocaleString('en-IN')}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 📉 COGS Health Gauge & 🏦 Petty Cash Float Tracker */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <CogsHealthGauge
          cogsAmount={pnl.totalCogs}
          netRevenue={pnl.netRevenue}
          grossSales={pnl.grossSales}
          cogsPercentage={pnl.cogsPercentage}
          topIngredients={pnl.cogsCategories}
        />
        <PettyCashFloatWidget
          siteId={selectedSiteFilter === 'all' ? 'newrelic' : selectedSiteFilter}
          records={records}
          isAdmin={isAdmin}
        />
      </div>

      {/* 🏢 MULTI-SITE P&L COMPARISON TABLE */}
      <div className="rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-200/80 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-1.5">
              <Building2 className="w-4 h-4 text-[#3b2fc9]" />
              Multi-Site P&amp;L Performance Matrix
            </h3>
            <p className="text-xs text-slate-400">
              Direct profitability comparison across New Relic, NTT Data, and DSM counters.
            </p>
          </div>
          <Badge variant="outline" className="text-xs font-mono font-bold text-slate-600">
            {pnl.siteBreakdowns.length} Operating Sites
          </Badge>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/80 dark:bg-slate-800/60 border-b border-slate-200/80 dark:border-slate-800 text-slate-600 dark:text-slate-400 font-black uppercase text-[10px] tracking-wider whitespace-nowrap">
                <th className="py-3.5 px-4">Site Location</th>
                <th className="py-3.5 px-3.5 text-center">Active Days</th>
                <th className="py-3.5 px-4 text-right">Gross Sales</th>
                <th className="py-3.5 px-4 text-right text-rose-600 dark:text-rose-400">Aggregator Fee</th>
                <th className="py-3.5 px-4 text-right bg-indigo-50/40 dark:bg-indigo-950/20 text-indigo-900 dark:text-indigo-300 font-black">
                  Net Settlement
                </th>
                <th className="py-3.5 px-4 text-right text-cyan-700 dark:text-cyan-400">Food COGS</th>
                <th className="py-3.5 px-4 text-right">Gross Margin</th>
                <th className="py-3.5 px-4 text-right text-amber-700 dark:text-amber-400">Overhead OPEX</th>
                <th className="py-3.5 px-4 text-right bg-emerald-50/60 dark:bg-emerald-950/30 text-emerald-900 dark:text-emerald-300 font-black">
                  Net Operating Profit
                </th>
                <th className="py-3.5 px-3.5 text-center">Net Margin</th>
                <th className="py-3.5 px-3.5 text-center">Orders</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono">
              {pnl.siteBreakdowns.map((sp) => (
                <tr
                  key={sp.siteId}
                  className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                >
                  <td className="py-3.5 px-4 font-sans font-bold text-slate-900 dark:text-white whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-500" />
                      <span>{sp.name}</span>
                    </div>
                  </td>
                  <td className="py-3.5 px-3.5 text-center text-slate-500 font-bold">
                    {sp.daysCount}
                  </td>
                  <td className="py-3.5 px-4 text-right font-black text-slate-900 dark:text-white">
                    ₹{Math.round(sp.grossSales).toLocaleString('en-IN')}
                  </td>
                  <td className="py-3.5 px-4 text-right text-rose-600 dark:text-rose-400 font-bold">
                    -₹{Math.round(sp.totalCommission).toLocaleString('en-IN')}
                    <span className="text-[10px] text-slate-400 block font-normal">({sp.effectiveCommRate}%)</span>
                  </td>
                  <td className="py-3.5 px-4 text-right font-black text-indigo-900 dark:text-indigo-300 bg-indigo-50/40 dark:bg-indigo-950/20">
                    ₹{Math.round(sp.netRevenue).toLocaleString('en-IN')}
                  </td>
                  <td className="py-3.5 px-4 text-right text-cyan-700 dark:text-cyan-400">
                    -₹{Math.round(sp.cogs).toLocaleString('en-IN')}
                  </td>
                  <td className="py-3.5 px-4 text-right text-slate-700 dark:text-slate-300 font-bold">
                    ₹{Math.round(sp.grossProfit).toLocaleString('en-IN')}
                    <span className="text-[10px] text-slate-400 block font-normal">{sp.grossMarginPct}%</span>
                  </td>
                  <td className="py-3.5 px-4 text-right text-amber-700 dark:text-amber-400">
                    -₹{Math.round(sp.opex).toLocaleString('en-IN')}
                  </td>
                  <td className="py-3.5 px-4 text-right font-black text-emerald-800 dark:text-emerald-300 bg-emerald-50/60 dark:bg-emerald-950/30 text-xs sm:text-sm">
                    ₹{Math.round(sp.netProfit).toLocaleString('en-IN')}
                  </td>
                  <td className="py-3.5 px-3.5 text-center">
                    <Badge
                      variant="outline"
                      className={`text-[10px] font-bold ${
                        sp.netProfit >= 0
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                          : 'bg-rose-50 text-rose-700 border-rose-300'
                      }`}
                    >
                      {sp.netProfitMarginPct}%
                    </Badge>
                  </td>
                  <td className="py-3.5 px-3.5 text-center text-slate-600 dark:text-slate-400">
                    {sp.orderCount}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-slate-100/95 dark:bg-slate-800 font-mono font-black text-xs border-t-2 border-slate-300 dark:border-slate-700">
              <tr>
                <td className="py-4 px-4 font-sans text-slate-900 dark:text-white uppercase text-[11px] tracking-wider">
                  Total Consolidated P&amp;L
                </td>
                <td className="py-4 px-3.5 text-center text-slate-700 dark:text-slate-300">
                  {pnl.activeSalesDays}
                </td>
                <td className="py-4 px-4 text-right text-slate-900 dark:text-white">
                  ₹{pnl.grossSales.toLocaleString('en-IN')}
                </td>
                <td className="py-4 px-4 text-right text-rose-600 dark:text-rose-400">
                  -₹{pnl.totalCommission.toLocaleString('en-IN')}
                </td>
                <td className="py-4 px-4 text-right text-indigo-900 dark:text-indigo-200 bg-indigo-100/60 dark:bg-indigo-950/40">
                  ₹{pnl.netRevenue.toLocaleString('en-IN')}
                </td>
                <td className="py-4 px-4 text-right text-cyan-800 dark:text-cyan-300">
                  -₹{pnl.totalCogs.toLocaleString('en-IN')}
                </td>
                <td className="py-4 px-4 text-right text-slate-900 dark:text-white">
                  ₹{pnl.grossProfit.toLocaleString('en-IN')}
                </td>
                <td className="py-4 px-4 text-right text-amber-800 dark:text-amber-300">
                  -₹{pnl.totalOpex.toLocaleString('en-IN')}
                </td>
                <td className="py-4 px-4 text-right text-emerald-800 dark:text-emerald-200 bg-emerald-100/70 dark:bg-emerald-900/40 text-sm">
                  ₹{pnl.netProfit.toLocaleString('en-IN')}
                </td>
                <td className="py-4 px-3.5 text-center text-emerald-700 dark:text-emerald-300">
                  {pnl.netProfitMarginPct}%
                </td>
                <td className="py-4 px-3.5 text-center text-slate-900 dark:text-white">
                  {pnl.orderCount}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* 📦 EXPENSE CATEGORY DEEP-DIVE */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* COGS Categories */}
        <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-3.5">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-1.5">
                <ChefHat className="w-4 h-4 text-cyan-600" />
                COGS Breakdown (Raw Materials &amp; Ingredients)
              </h3>
              <p className="text-xs text-slate-400">
                Direct food costs needed to produce kitchen menu items.
              </p>
            </div>
            <span className="font-mono font-black text-sm text-cyan-700 dark:text-cyan-300">
              ₹{pnl.totalCogs.toLocaleString('en-IN')}
            </span>
          </div>

          {pnl.cogsCategories.length === 0 ? (
            <p className="text-xs text-slate-400 py-4 text-center">No COGS expenses in this period.</p>
          ) : (
            <div className="space-y-2">
              {pnl.cogsCategories.map((c) => (
                <div
                  key={c.category}
                  className="p-3 rounded-2xl bg-cyan-50/40 dark:bg-cyan-950/20 border border-cyan-100 dark:border-cyan-900/40 flex items-center justify-between text-xs"
                >
                  <div>
                    <span className="font-bold text-slate-900 dark:text-white block">{c.normalizedName}</span>
                    <span className="text-[10px] text-slate-400">{c.count} transactions • {c.percentageOfGroup}% of food cost</span>
                  </div>
                  <span className="font-mono font-black text-slate-900 dark:text-white">
                    ₹{c.amount.toLocaleString('en-IN')}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* OPEX Categories */}
        <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-3.5">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-1.5">
                <Flame className="w-4 h-4 text-amber-600" />
                OPEX Breakdown (Counter Overheads &amp; Utilities)
              </h3>
              <p className="text-xs text-slate-400">
                Staff wages, gas cylinders, disposable cutlery, and maintenance.
              </p>
            </div>
            <span className="font-mono font-black text-sm text-amber-700 dark:text-amber-300">
              ₹{pnl.totalOpex.toLocaleString('en-IN')}
            </span>
          </div>

          {pnl.opexCategories.length === 0 ? (
            <p className="text-xs text-slate-400 py-4 text-center">No OPEX expenses in this period.</p>
          ) : (
            <div className="space-y-2">
              {pnl.opexCategories.map((c) => (
                <div
                  key={c.category}
                  className="p-3 rounded-2xl bg-amber-50/40 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/40 flex items-center justify-between text-xs"
                >
                  <div>
                    <span className="font-bold text-slate-900 dark:text-white block">{c.normalizedName}</span>
                    <span className="text-[10px] text-slate-400">{c.count} bills • {c.percentageOfGroup}% of overhead</span>
                  </div>
                  <span className="font-mono font-black text-slate-900 dark:text-white">
                    ₹{c.amount.toLocaleString('en-IN')}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 📅 DAY-BY-DAY AUDIT TRAIL TABLE */}
      <div className="rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-200/80 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-indigo-600" />
              Day-by-Day Statement &amp; Profit Ledger
            </h3>
            <p className="text-xs text-slate-400">
              Showing {filteredTimeline.length} daily operational cycles.
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          {isLoading ? (
            <div className="p-16 text-center text-slate-500">
              <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-indigo-600" />
              Computing multi-site P&amp;L ledger...
            </div>
          ) : filteredTimeline.length === 0 ? (
            <div className="p-16 text-center text-slate-500">
              <AlertCircle className="h-8 w-8 text-slate-300 mx-auto mb-2" />
              <p className="font-bold text-slate-700 dark:text-slate-300">No records found</p>
              <p className="text-xs text-slate-400">Adjust the date range or site filter above.</p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50/80 dark:bg-slate-800/60 border-b border-slate-200/80 dark:border-slate-800 text-slate-600 dark:text-slate-400 font-black uppercase text-[10px] tracking-wider whitespace-nowrap">
                  <th className="py-3 px-3.5">Date</th>
                  <th className="py-3 px-4 text-right">Gross Sales</th>
                  <th className="py-3 px-4 text-right text-amber-700 dark:text-amber-400">MRP (3%)</th>
                  <th className="py-3 px-4 text-right text-purple-700 dark:text-purple-400">Kitchen (19%)</th>
                  <th className="py-3 px-4 text-right text-rose-600 dark:text-rose-400">Commission</th>
                  <th className="py-3 px-4 text-right bg-indigo-50/40 dark:bg-indigo-950/20 font-black text-indigo-950 dark:text-indigo-200">
                    Net Settlement
                  </th>
                  <th className="py-3 px-4 text-right text-cyan-700 dark:text-cyan-400">Food COGS</th>
                  <th className="py-3 px-4 text-right text-amber-700 dark:text-amber-400">Overhead OPEX</th>
                  <th className="py-3 px-4 text-right bg-emerald-50/60 dark:bg-emerald-950/30 font-black text-emerald-950 dark:text-emerald-200">
                    Net Profit
                  </th>
                  <th className="py-3 px-3 text-center">Status</th>
                  <th className="py-3 px-3 text-center">Orders</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono">
                {filteredTimeline.map((d) => (
                  <tr
                    key={d.date}
                    className="hover:bg-indigo-50/20 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    <td className="py-3 px-3.5 font-bold text-slate-900 dark:text-white whitespace-nowrap">
                      {d.displayDate}
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-slate-900 dark:text-white">
                      ₹{d.grossSales.toLocaleString('en-IN')}
                    </td>
                    <td className="py-3 px-4 text-right text-amber-800 dark:text-amber-300">
                      ₹{d.mrpSales.toLocaleString('en-IN')}
                    </td>
                    <td className="py-3 px-4 text-right text-purple-800 dark:text-purple-300">
                      ₹{d.nonMrpSales.toLocaleString('en-IN')}
                    </td>
                    <td className="py-3 px-4 text-right text-rose-600 dark:text-rose-400 font-bold">
                      -₹{d.totalCommission.toLocaleString('en-IN')}
                    </td>
                    <td className="py-3 px-4 text-right font-black text-indigo-950 dark:text-indigo-200 bg-indigo-50/40 dark:bg-indigo-950/20">
                      ₹{d.netRevenue.toLocaleString('en-IN')}
                    </td>
                    <td className="py-3 px-4 text-right text-cyan-700 dark:text-cyan-400">
                      {d.cogs > 0 ? `-₹${d.cogs.toLocaleString('en-IN')}` : '—'}
                    </td>
                    <td className="py-3 px-4 text-right text-amber-700 dark:text-amber-400">
                      {d.opex > 0 ? `-₹${d.opex.toLocaleString('en-IN')}` : '—'}
                    </td>
                    <td className={`py-3 px-4 text-right font-black text-xs sm:text-sm bg-emerald-50/60 dark:bg-emerald-950/30 ${
                      d.isProfitable ? 'text-emerald-700 dark:text-emerald-300' : 'text-rose-600 dark:text-rose-400'
                    }`}>
                      ₹{d.netProfit.toLocaleString('en-IN')}
                    </td>
                    <td className="py-3 px-3 text-center">
                      <Badge
                        variant="outline"
                        className={`text-[9px] font-bold ${
                          d.isProfitable
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                            : 'bg-rose-50 text-rose-700 border-rose-300'
                        }`}
                      >
                        {d.isProfitable ? 'Gain' : 'Deficit'}
                      </Badge>
                    </td>
                    <td className="py-3 px-3 text-center text-slate-500">
                      {d.orderCount}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* HungerBox Modal */}
      <HungerBoxSyncModal
        open={isSyncModalOpen}
        onOpenChange={setIsSyncModalOpen}
        siteId={selectedSiteFilter === 'all' ? 'newrelic' : selectedSiteFilter}
      />
    </div>
  );
}
