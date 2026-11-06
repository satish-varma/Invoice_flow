'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import * as XLSX from 'xlsx';
import {
  ShoppingBag,
  Building2,
  Calendar,
  Search,
  Filter,
  ChevronDown,
  ChevronUp,
  FileSpreadsheet,
  ArrowLeft,
  DollarSign,
  Tag,
  Receipt,
  Percent,
  RefreshCw,
  Layers,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { COMPANY_SITES, SiteId, resolveSiteId } from '@/types/site';
import { triggerHaptic } from '@/lib/haptics';
import { formatOrdinalDate } from '@/services/hungerboxParser';
import { DateGroupedItemSales, GroupedItemDetail } from '@/app/api/tuckshop/items/route';

const CATEGORY_PRESETS = [
  { id: 'all', label: 'All Items', icon: '🍽️' },
  { id: 'Maggi & Noodles', label: 'Maggi & Noodles', icon: '🍜' },
  { id: 'Sandwiches & Toast', label: 'Sandwiches & Toast', icon: '🥪' },
  { id: 'Fresh Juices & Shakes', label: 'Fresh Juices & Shakes', icon: '🧃' },
  { id: 'Omelettes & Eggs', label: 'Omelettes & Eggs', icon: '🍳' },
  { id: 'Tea & Coffee', label: 'Tea & Coffee', icon: '☕' },
  { id: 'Puffs & Bakery', label: 'Puffs & Bakery', icon: '🥟' },
  { id: 'South Indian Breakfast', label: 'South Indian Breakfast', icon: '🥞' },
  { id: 'Meals & Rice', label: 'Meals & Rice', icon: '🍛' },
  { id: 'Packaged Snacks (MRP)', label: 'Packaged Snacks (MRP 3%)', icon: '🏷️' },
];

export default function ItemSalesExplorerPage() {
  const [data, setData] = useState<{
    summary: {
      totalGross: number;
      totalItems: number;
      totalOrders: number;
      totalDays: number;
      mrpSales: number;
      mrpCommission: number;
      nonMrpSales: number;
      nonMrpCommission: number;
      totalCommission: number;
      totalNet: number;
    };
    days: DateGroupedItemSales[];
  } | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [selectedSite, setSelectedSite] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [expandedDates, setExpandedDates] = useState<Record<string, boolean>>({});
  const [expandedOrders, setExpandedOrders] = useState<Record<string, boolean>>({});

  // Fetch data
  const fetchData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (selectedSite !== 'all') params.set('siteId', selectedSite);
      if (selectedCategory !== 'all') params.set('category', selectedCategory);
      if (searchTerm.trim()) params.set('search', searchTerm.trim());

      const res = await fetch(`/api/tuckshop/items?${params.toString()}`);
      if (!res.ok) {
        throw new Error(`Failed to load items: HTTP ${res.status}`);
      }
      const json = await res.json();
      if (!json.success) {
        throw new Error(json.error || 'Failed to fetch item sales');
      }
      setData(json);

      // Auto-expand the first date by default
      if (json.days && json.days.length > 0) {
        setExpandedDates((prev) => {
          if (Object.keys(prev).length === 0) {
            return { [json.days[0].date]: true };
          }
          return prev;
        });
      }
    } catch (err: any) {
      console.error('Item sales fetch error:', err);
      setError(err.message || 'Error loading item sales data');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedSite, selectedCategory]);

  // Handle Search on Enter or debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchData();
    }, 400);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Expand / Collapse all dates
  const toggleExpandAll = () => {
    triggerHaptic('light');
    if (!data?.days) return;
    const allExpanded = data.days.every((d) => expandedDates[d.date]);
    if (allExpanded) {
      setExpandedDates({});
    } else {
      const newExpanded: Record<string, boolean> = {};
      data.days.forEach((d) => {
        newExpanded[d.date] = true;
      });
      setExpandedDates(newExpanded);
    }
  };

  const toggleDate = (date: string) => {
    triggerHaptic('selection');
    setExpandedDates((prev) => ({
      ...prev,
      [date]: !prev[date],
    }));
  };

  const toggleOrderList = (itemKey: string) => {
    triggerHaptic('selection');
    setExpandedOrders((prev) => ({
      ...prev,
      [itemKey]: !prev[itemKey],
    }));
  };

  // Export to Excel
  const handleExportExcel = () => {
    triggerHaptic('medium');
    if (!data?.days || data.days.length === 0) return;

    const rows: any[] = [];
    data.days.forEach((day) => {
      day.items.forEach((item) => {
        rows.push({
          Date: day.displayDate,
          'Raw Date': day.date,
          Site: item.siteName,
          Stall: item.vendorName,
          'Item Name': item.itemName,
          Category: item.category,
          Type: item.isMrp ? 'MRP Packaged' : 'Non-MRP Prepared Food',
          'Commission %': item.isMrp ? '3%' : '19%',
          'Quantity Sold': item.quantity,
          'Avg Unit Price (₹)': item.avgUnitPrice,
          'Total Gross Sale (₹)': item.totalGross,
          'HungerBox Comm (₹)': item.commission,
          'Net Payout (₹)': item.netPayout,
        });
      });
    });

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Item Sales Breakdown');
    XLSX.writeFile(
      workbook,
      `HungerBox_Item_Sales_${formatOrdinalDate(new Date().toISOString().split('T')[0])}.xlsx`
    );
  };

  const allDatesExpanded = useMemo(() => {
    if (!data?.days || data.days.length === 0) return false;
    return data.days.every((d) => expandedDates[d.date]);
  }, [data, expandedDates]);

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-8 py-4 sm:py-8 space-y-6">
      {/* Top Breadcrumb & Navigation */}
      <div className="flex items-center justify-between gap-3">
        <Link
          href="/newrelic/tuckshop/sales"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Tuckshop Sales Ledger</span>
        </Link>

        <div className="flex items-center gap-2">
          <Badge
            variant="outline"
            className="text-[10px] bg-amber-50 text-amber-900 border-amber-300 font-black uppercase tracking-wider"
          >
            🍜 Itemized Product Breakdown
          </Badge>
          <Badge
            variant="outline"
            className="text-[10px] bg-purple-50 text-purple-900 border-purple-300 font-black uppercase tracking-wider"
          >
            MRP (3%) vs Non-MRP (19%)
          </Badge>
        </div>
      </div>

      {/* Hero Header */}
      <div className="rounded-2xl sm:rounded-3xl bg-gradient-to-r from-[#1e1b4b] via-[#311042] to-[#2c1d24] p-5 sm:p-7 text-white shadow-xl relative overflow-hidden">
        <div className="absolute -right-10 -top-10 w-48 h-48 bg-amber-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute right-36 -bottom-10 w-40 h-40 bg-purple-500/20 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-5">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-br from-purple-400/20 to-pink-500/20 border-2 border-purple-300/40 flex items-center justify-center text-purple-300 shadow-lg shrink-0">
              <ShoppingBag className="w-6 h-6 sm:w-7 sm:h-7" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <span className="text-[10px] font-black uppercase tracking-wider bg-purple-400/20 text-purple-300 border border-purple-400/30 px-2 py-0.5 rounded-full">
                  Item Explorer
                </span>
                <span className="text-[10px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 px-2 py-0.5 rounded-full">
                  Live Order Data
                </span>
              </div>
              <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white">
                Item-Level Sales &amp; Order Breakdown
              </h1>
              <p className="text-xs text-rose-100/80 font-medium mt-0.5">
                Listing Maggi, Sandwich, Juices, Omelettes &amp; packaged items grouped by date with order-level expand &amp; collapse.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <Button
              variant="outline"
              onClick={fetchData}
              disabled={isLoading}
              className="h-10 px-3.5 rounded-2xl bg-white/10 hover:bg-white/20 border-white/20 text-white font-bold text-xs active:scale-95 transition-all"
            >
              <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>

            <Button
              variant="outline"
              onClick={handleExportExcel}
              disabled={!data?.days?.length}
              className="h-10 px-3.5 rounded-2xl bg-emerald-500 hover:bg-emerald-600 border-emerald-400 text-white font-bold text-xs shadow-md active:scale-95 transition-all"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 mr-1.5" />
              Export Excel
            </Button>
          </div>
        </div>
      </div>

      {/* 🧭 NAVIGATION TABS (Daily Ledger vs Item-Level Breakdown) */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
        <Link
          href="/newrelic/tuckshop/sales"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/60 transition-colors"
        >
          <Building2 className="w-4 h-4" />
          Consolidated Daily Ledger
        </Link>
        <Link
          href="/newrelic/tuckshop/sales/items"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm"
        >
          <ShoppingBag className="w-4 h-4 text-amber-500" />
          Item Sales Breakdown (Maggi, Sandwich, Juices...)
        </Link>
      </div>

      {/* 🚀 COMPREHENSIVE KPI SUMMARY CARDS */}
      {data?.summary && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
          {/* 1. Total Gross Sales */}
          <div className="p-4 rounded-2xl sm:rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-sm">
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-1">
              <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-wider flex items-center gap-1">
                <DollarSign className="w-3.5 h-3.5 text-slate-700 dark:text-slate-300" /> Gross Item Sales
              </span>
            </div>
            <p className="text-xl sm:text-2xl font-mono font-black text-slate-900 dark:text-white tracking-tight">
              ₹{data.summary.totalGross.toLocaleString('en-IN')}
            </p>
            <p className="text-[10px] text-slate-400 mt-0.5">
              {data.summary.totalDays} dates | {data.summary.totalItems.toLocaleString('en-IN')} units
            </p>
          </div>

          {/* 2. Non-MRP Fresh Kitchen Food (19% Fee) */}
          <div className="p-4 rounded-2xl sm:rounded-3xl bg-gradient-to-b from-purple-50/60 to-white dark:from-purple-950/20 dark:to-slate-900 border border-purple-200 dark:border-purple-900/40 shadow-sm">
            <div className="flex items-center justify-between text-purple-800 dark:text-purple-400 mb-1">
              <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-wider flex items-center gap-1">
                <Receipt className="w-3 h-3 text-purple-600" /> Non-MRP Food
              </span>
              <Badge className="text-[9px] bg-purple-600 text-white font-mono px-1 py-0 h-4">
                19% Comm
              </Badge>
            </div>
            <p className="text-xl sm:text-2xl font-mono font-black text-purple-950 dark:text-purple-200 tracking-tight">
              ₹{data.summary.nonMrpSales.toLocaleString('en-IN')}
            </p>
            <p className="text-[10px] text-purple-700 dark:text-purple-400 font-bold mt-0.5">
              Fee (19%): -₹{data.summary.nonMrpCommission.toLocaleString('en-IN')}
            </p>
          </div>

          {/* 3. MRP Packaged Goods (3% Fee) */}
          <div className="p-4 rounded-2xl sm:rounded-3xl bg-gradient-to-b from-amber-50/60 to-white dark:from-amber-950/20 dark:to-slate-900 border border-amber-200 dark:border-amber-900/40 shadow-sm">
            <div className="flex items-center justify-between text-amber-800 dark:text-amber-400 mb-1">
              <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-wider flex items-center gap-1">
                <Tag className="w-3 h-3 text-amber-600" /> MRP Packaged
              </span>
              <Badge className="text-[9px] bg-amber-500 text-white font-mono px-1 py-0 h-4">
                3% Comm
              </Badge>
            </div>
            <p className="text-xl sm:text-2xl font-mono font-black text-amber-950 dark:text-amber-200 tracking-tight">
              ₹{data.summary.mrpSales.toLocaleString('en-IN')}
            </p>
            <p className="text-[10px] text-amber-700 dark:text-amber-400 font-bold mt-0.5">
              Fee (3%): -₹{data.summary.mrpCommission.toLocaleString('en-IN')}
            </p>
          </div>

          {/* 4. Total Commission */}
          <div className="p-4 rounded-2xl sm:rounded-3xl bg-gradient-to-b from-rose-50/60 to-white dark:from-rose-950/20 dark:to-slate-900 border border-rose-200 dark:border-rose-900/40 shadow-sm">
            <div className="flex items-center justify-between text-rose-800 dark:text-rose-400 mb-1">
              <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-wider flex items-center gap-1">
                <Percent className="w-3 h-3 text-rose-600" /> Total HungerBox Fee
              </span>
            </div>
            <p className="text-xl sm:text-2xl font-mono font-black text-rose-600 dark:text-rose-400 tracking-tight">
              -₹{data.summary.totalCommission.toLocaleString('en-IN')}
            </p>
            <p className="text-[10px] text-rose-700 dark:text-rose-400 font-bold mt-0.5">
              Deducted by HungerBox
            </p>
          </div>

          {/* 5. Net Vendor Payout */}
          <div className="col-span-2 lg:col-span-1 p-4 rounded-2xl sm:rounded-3xl bg-gradient-to-b from-emerald-50/80 to-white dark:from-emerald-950/30 dark:to-slate-900 border-2 border-emerald-400/80 shadow-md">
            <div className="flex items-center justify-between text-emerald-800 dark:text-emerald-400 mb-1">
              <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-wider flex items-center gap-1">
                <DollarSign className="w-3.5 h-3.5 text-emerald-600" /> Net Vendor Payout
              </span>
              <Badge className="text-[9px] bg-emerald-600 text-white font-mono px-1 py-0 h-4">
                Net
              </Badge>
            </div>
            <p className="text-xl sm:text-2xl font-mono font-black text-emerald-700 dark:text-emerald-300 tracking-tight">
              ₹{data.summary.totalNet.toLocaleString('en-IN')}
            </p>
            <p className="text-[10px] text-emerald-700 dark:text-emerald-400 font-bold mt-0.5">
              Total Sale After Commission
            </p>
          </div>
        </div>
      )}

      {/* 🔍 FILTERS & QUICK CATEGORY CHIPS */}
      <div className="rounded-2xl sm:rounded-3xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 shadow-sm space-y-4">
        {/* Top Filter Controls: Site Selector + Search Bar + Expand All Toggle */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Site Selector Buttons */}
          <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-2xl overflow-x-auto shrink-0">
            {[
              { id: 'all', label: 'All Sites' },
              { id: 'dsm', label: 'DSM' },
              { id: 'ntt_data', label: 'NTT Data' },
              { id: 'newrelic', label: 'New Relic' },
            ].map((site) => (
              <button
                key={site.id}
                onClick={() => {
                  triggerHaptic('selection');
                  setSelectedSite(site.id);
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all whitespace-nowrap ${
                  selectedSite === site.id
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {site.label}
              </button>
            ))}
          </div>

          {/* Search Box */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <Input
              type="text"
              placeholder="Search Maggi, Sandwich, Juice, Omelette, Puff..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 h-10 rounded-2xl text-xs border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 focus:bg-white dark:focus:bg-slate-800"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600 font-bold"
              >
                Clear
              </button>
            )}
          </div>

          {/* Expand / Collapse All */}
          <Button
            variant="outline"
            onClick={toggleExpandAll}
            className="h-10 px-3.5 rounded-2xl border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 shrink-0"
          >
            {allDatesExpanded ? (
              <>
                <ChevronUp className="w-3.5 h-3.5 mr-1 text-slate-400" />
                Collapse All Dates
              </>
            ) : (
              <>
                <ChevronDown className="w-3.5 h-3.5 mr-1 text-slate-400" />
                Expand All Dates
              </>
            )}
          </Button>
        </div>

        {/* Quick Category Chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 pt-0.5 scrollbar-thin">
          {CATEGORY_PRESETS.map((cat) => {
            const isSelected = selectedCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => {
                  triggerHaptic('selection');
                  setSelectedCategory(cat.id);
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold shrink-0 transition-all flex items-center gap-1.5 ${
                  isSelected
                    ? 'bg-purple-600 text-white shadow-sm'
                    : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300'
                }`}
              >
                <span>{cat.icon}</span>
                <span>{cat.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 🔴 ERROR OR LOADING STATE */}
      {error && (
        <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-200 flex items-center gap-2 text-xs">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
          <span>{error}</span>
        </div>
      )}

      {isLoading && (
        <div className="p-12 text-center rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-sm space-y-3">
          <RefreshCw className="w-8 h-8 mx-auto text-purple-600 animate-spin" />
          <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
            Loading item sales telemetry from HungerBox...
          </p>
          <p className="text-xs text-slate-400">
            Aggregating orders, classifying Maggi, Sandwich, Juices &amp; calculating MRP 3% vs Non-MRP 19% commissions.
          </p>
        </div>
      )}

      {/* 📅 DATE-GROUPED ACCORDION OF ITEM SALES */}
      {!isLoading && data?.days && (
        <div className="space-y-4">
          {data.days.length === 0 ? (
            <div className="p-12 text-center rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-sm space-y-2">
              <ShoppingBag className="w-8 h-8 mx-auto text-slate-400" />
              <h3 className="text-sm font-black text-slate-800 dark:text-white">
                No items found matching the selected filter
              </h3>
              <p className="text-xs text-slate-400">
                Try selecting "All Sites" or choosing a different category like "Maggi & Noodles" or "Sandwiches & Toast".
              </p>
            </div>
          ) : (
            data.days.map((day) => {
              const isExpanded = Boolean(expandedDates[day.date]);

              return (
                <div
                  key={day.date}
                  className="rounded-2xl sm:rounded-3xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden transition-all"
                >
                  {/* Date Header Accordion Trigger */}
                  <div
                    onClick={() => toggleDate(day.date)}
                    className="p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-3 cursor-pointer hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors select-none"
                  >
                    {/* Left: Date + Site Badges */}
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800 flex items-center justify-center text-purple-700 dark:text-purple-300 shrink-0">
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </div>

                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono font-black text-sm sm:text-base text-slate-900 dark:text-white flex items-center gap-1.5">
                            <Calendar className="w-3.5 h-3.5 text-purple-600" />
                            {day.displayDate}
                          </span>

                          {day.siteBreakdown.map((s) => (
                            <Badge
                              key={s.siteId}
                              variant="outline"
                              className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 font-bold"
                            >
                              {s.name} ({s.count})
                            </Badge>
                          ))}
                        </div>

                        {/* Top Category Snippet */}
                        <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-400">
                          <span>{day.totalItems} items sold across {day.totalOrders} orders</span>
                          <span>•</span>
                          <span className="text-purple-700 dark:text-purple-300 font-semibold">
                            {day.items.slice(0, 3).map((it) => `${it.quantity}x ${it.itemName}`).join(', ')}
                            {day.items.length > 3 ? ` +${day.items.length - 3} more` : ''}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Right: Financial Totals for this Date */}
                    <div className="flex items-center justify-between md:justify-end gap-4 shrink-0 font-mono text-right border-t md:border-t-0 pt-2 md:pt-0 border-slate-100 dark:border-slate-800">
                      {/* Non-MRP Food (19%) */}
                      <div className="bg-purple-50/50 dark:bg-purple-950/20 px-2.5 py-1 rounded-xl border border-purple-100 dark:border-purple-900/30">
                        <div className="text-[10px] font-bold text-purple-700 dark:text-purple-400 uppercase tracking-tight">
                          Non-MRP (19%)
                        </div>
                        <div className="text-xs sm:text-[13px] font-black text-purple-950 dark:text-purple-200">
                          ₹{Math.round(day.nonMrpSales).toLocaleString('en-IN')}
                        </div>
                        <div className="text-[9px] text-purple-600 dark:text-purple-400">
                          -₹{Math.round(day.nonMrpCommission).toLocaleString('en-IN')}
                        </div>
                      </div>

                      {/* MRP Packaged (3%) */}
                      <div className="bg-amber-50/50 dark:bg-amber-950/20 px-2.5 py-1 rounded-xl border border-amber-100 dark:border-amber-900/30">
                        <div className="text-[10px] font-bold text-amber-700 dark:text-amber-400 uppercase tracking-tight">
                          MRP (3%)
                        </div>
                        <div className="text-xs sm:text-[13px] font-black text-amber-950 dark:text-amber-200">
                          ₹{Math.round(day.mrpSales).toLocaleString('en-IN')}
                        </div>
                        <div className="text-[9px] text-amber-600 dark:text-amber-400">
                          -₹{Math.round(day.mrpCommission).toLocaleString('en-IN')}
                        </div>
                      </div>

                      {/* Total Gross & Net */}
                      <div className="bg-emerald-50/60 dark:bg-emerald-950/20 px-3 py-1 rounded-xl border border-emerald-200 dark:border-emerald-800">
                        <div className="text-[10px] font-black text-emerald-800 dark:text-emerald-300 uppercase tracking-tight">
                          Net Payout
                        </div>
                        <div className="text-xs sm:text-sm font-black text-emerald-700 dark:text-emerald-200">
                          ₹{Math.round(day.netPayout).toLocaleString('en-IN')}
                        </div>
                        <div className="text-[9px] text-slate-500">
                          Gross: ₹{Math.round(day.totalGross).toLocaleString('en-IN')}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Expanded Item Breakdown Table */}
                  {isExpanded && (
                    <div className="border-t border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 p-3 sm:p-5 space-y-3">
                      <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs">
                        <table className="w-full text-left border-collapse text-xs">
                          <thead>
                            <tr className="bg-slate-100/80 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-black uppercase text-[10px] tracking-wider whitespace-nowrap">
                              <th className="py-3 px-4">Item Name</th>
                              <th className="py-3 px-3">Category</th>
                              <th className="py-3 px-3 text-center">Commission Type</th>
                              <th className="py-3 px-3 text-right">Qty</th>
                              <th className="py-3 px-3 text-right">Avg Unit Price</th>
                              <th className="py-3 px-4 text-right">Gross Total</th>
                              <th className="py-3 px-4 text-right">HB Comm Fee</th>
                              <th className="py-3 px-4 text-right bg-emerald-50/50 dark:bg-emerald-950/20 text-emerald-900 dark:text-emerald-200 font-black">
                                Net Payout
                              </th>
                              <th className="py-3 px-3 text-center">Site &amp; Orders</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {day.items.map((item, idx) => {
                              const itemKey = `${day.date}_${item.itemName}_${item.siteId}`;
                              const isOrdersExpanded = Boolean(expandedOrders[itemKey]);

                              return (
                                <React.Fragment key={itemKey}>
                                  <tr className="hover:bg-purple-50/20 dark:hover:bg-slate-800/40 transition-colors">
                                    {/* Item Name */}
                                    <td className="py-3 px-4 font-bold text-slate-900 dark:text-white">
                                      <div className="flex items-center gap-2">
                                        <span className="w-2 h-2 rounded-full bg-purple-500 shrink-0" />
                                        <span className="text-xs sm:text-[13px]">{item.itemName}</span>
                                      </div>
                                    </td>

                                    {/* Category */}
                                    <td className="py-3 px-3 whitespace-nowrap">
                                      <span className="text-[11px] text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md font-medium">
                                        {item.category}
                                      </span>
                                    </td>

                                    {/* Commission Type Badge */}
                                    <td className="py-3 px-3 text-center whitespace-nowrap">
                                      {item.isMrp ? (
                                        <Badge className="bg-amber-100 text-amber-900 dark:bg-amber-950/50 dark:text-amber-200 border-amber-300 text-[10px] font-mono">
                                          MRP (3%)
                                        </Badge>
                                      ) : (
                                        <Badge className="bg-purple-100 text-purple-900 dark:bg-purple-950/50 dark:text-purple-200 border-purple-300 text-[10px] font-mono">
                                          Non-MRP (19%)
                                        </Badge>
                                      )}
                                    </td>

                                    {/* Quantity */}
                                    <td className="py-3 px-3 text-right font-mono font-black text-slate-800 dark:text-slate-200">
                                      {item.quantity}
                                    </td>

                                    {/* Avg Unit Price */}
                                    <td className="py-3 px-3 text-right font-mono text-slate-600 dark:text-slate-400">
                                      ₹{Math.round(item.avgUnitPrice)}
                                    </td>

                                    {/* Gross Total */}
                                    <td className="py-3 px-4 text-right font-mono font-bold text-slate-900 dark:text-white">
                                      ₹{Math.round(item.totalGross).toLocaleString('en-IN')}
                                    </td>

                                    {/* HB Comm Fee */}
                                    <td className="py-3 px-4 text-right font-mono text-rose-600 dark:text-rose-400 font-semibold">
                                      -₹{Math.round(item.commission).toLocaleString('en-IN')}
                                    </td>

                                    {/* Net Payout */}
                                    <td className="py-3 px-4 text-right font-mono font-black text-emerald-700 dark:text-emerald-300 bg-emerald-50/40 dark:bg-emerald-950/10">
                                      ₹{Math.round(item.netPayout).toLocaleString('en-IN')}
                                    </td>

                                    {/* Site & Order Token Dropdown */}
                                    <td className="py-3 px-3 text-center whitespace-nowrap">
                                      <div className="flex items-center justify-center gap-1">
                                        <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">
                                          {item.siteName}
                                        </span>
                                        {item.orderIds.length > 0 && (
                                          <button
                                            onClick={() => toggleOrderList(itemKey)}
                                            className="ml-1 text-[10px] bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 px-1.5 py-0.5 rounded text-purple-600 dark:text-purple-400 font-mono"
                                            title="View sample order numbers"
                                          >
                                            {isOrdersExpanded ? 'Hide' : `Orders (${item.quantity})`}
                                          </button>
                                        )}
                                      </div>
                                    </td>
                                  </tr>

                                  {/* Expandable Order Numbers Row */}
                                  {isOrdersExpanded && (
                                    <tr className="bg-purple-50/40 dark:bg-slate-800/80 text-[11px]">
                                      <td colSpan={9} className="py-2.5 px-6 font-mono text-slate-600 dark:text-slate-300">
                                        <div className="flex items-center gap-2 flex-wrap">
                                          <span className="font-bold text-slate-700 dark:text-slate-200">
                                            Sample HungerBox Order Tokens for {item.itemName}:
                                          </span>
                                          {item.orderIds.map((oId) => (
                                            <span
                                              key={oId}
                                              className="bg-white dark:bg-slate-900 border border-purple-200 dark:border-purple-800 px-2 py-0.5 rounded text-[10px] font-bold text-purple-900 dark:text-purple-300"
                                            >
                                              #{oId}
                                            </span>
                                          ))}
                                          {item.quantity > item.orderIds.length && (
                                            <span className="text-[10px] text-slate-400">
                                              +{item.quantity - item.orderIds.length} more orders
                                            </span>
                                          )}
                                        </div>
                                      </td>
                                    </tr>
                                  )}
                                </React.Fragment>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
