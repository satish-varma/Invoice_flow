import { NewRelicChallan } from '@/types/challan';
import React, { useMemo, useState } from 'react';
import { Search, Filter, ArrowUpDown, Download, Package, TrendingUp, Award, Tag, X } from 'lucide-react';
import * as XLSX from 'xlsx';
import { triggerHaptic } from '@/lib/haptics';

interface NewRelicItemDashboardProps {
  challans: NewRelicChallan[];
}

interface AggregatedItem {
  id: string;
  brandName: string;
  itemName: string;
  fullName: string;
  mrp: number;
  totalQuantity: number;
  totalValue: number;
  occurrences: number;
  dcs: Set<string>;
  dcSplits: Record<string, number>;
  sources: { dcNumber: string; dcDate: string; location: string; quantity: number; mrp: number }[];
}

function toTitleCase(str: string) {
  return str.replace(
    /\w\S*/g,
    (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()
  );
}

export function NewRelicItemDashboard({ challans }: NewRelicItemDashboardProps) {
  const [searchItem, setSearchItem] = useState('');
  const [selectedBrandFilter, setSelectedBrandFilter] = useState<string>('all');
  const [sortKey, setSortKey] = useState<'qty_desc' | 'qty_asc' | 'val_desc' | 'name_asc'>('qty_desc');
  const [dateFilter, setDateFilter] = useState<string>('all');
  const [customStart, setCustomStart] = useState<string>('');
  const [customEnd, setCustomEnd] = useState<string>('');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedItem, setSelectedItem] = useState<AggregatedItem | null>(null);

  const ITEMS_PER_PAGE = 25;

  // Extract all unique brands from the challans
  const uniqueBrands = useMemo(() => {
    const brands = new Set<string>();
    challans.forEach(c => {
      c.lineItems?.forEach(item => {
        if (item.brandName && item.brandName.trim()) {
          brands.add(item.brandName.trim());
        }
      });
    });
    return Array.from(brands).sort();
  }, [challans]);

  // Aggregate item data across filtered date ranges
  const aggregatedData = useMemo(() => {
    const map = new Map<string, AggregatedItem>();
    const now = new Date();

    let startDate: Date | null = null;
    let endDate: Date | null = null;

    if (dateFilter === 'last_7') {
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    } else if (dateFilter === 'last_15') {
      startDate = new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000);
    } else if (dateFilter === 'this_month') {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    } else if (dateFilter === 'last_month') {
      startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      endDate = new Date(now.getFullYear(), now.getMonth(), 0);
    } else if (dateFilter === 'custom' && customStart && customEnd) {
      startDate = new Date(customStart);
      endDate = new Date(customEnd);
      endDate.setHours(23, 59, 59, 999);
    }

    challans.forEach(c => {
      const cDate = new Date(c.dcDate);
      if (startDate && cDate < startDate) return;
      if (endDate && cDate > endDate) return;

      const dcNum = c.dcNumber || 'Unknown DC';

      c.lineItems?.forEach(item => {
        const rawName = (item.itemName || 'Unknown Item').trim();
        const brandName = (item.brandName || '').trim();
        const fullName = `${brandName} ${rawName}`.trim();
        const mrp = Number(item.mrp) || 0;
        const qty = Number(item.quantity) || 0;

        const normalizedKey = `${brandName.toLowerCase()}___${rawName.toLowerCase()}`;

        const sourceInfo = {
          dcNumber: dcNum,
          dcDate: c.dcDate,
          location: c.location,
          quantity: qty,
          mrp: mrp
        };

        if (map.has(normalizedKey)) {
          const existing = map.get(normalizedKey)!;
          if (mrp > 0 && existing.mrp === 0) existing.mrp = mrp;
          existing.totalQuantity += qty;
          existing.totalValue += qty * (mrp || existing.mrp || 0);
          existing.occurrences += 1;
          existing.dcs.add(dcNum);
          existing.dcSplits[dcNum] = (existing.dcSplits[dcNum] || 0) + qty;
          existing.sources.push(sourceInfo);
        } else {
          map.set(normalizedKey, {
            id: normalizedKey,
            itemName: toTitleCase(rawName),
            brandName: brandName || 'Unbranded',
            fullName: fullName || toTitleCase(rawName),
            mrp: mrp,
            totalQuantity: qty,
            totalValue: qty * mrp,
            occurrences: 1,
            dcs: new Set([dcNum]),
            dcSplits: { [dcNum]: qty },
            sources: [sourceInfo]
          });
        }
      });
    });

    return Array.from(map.values());
  }, [challans, dateFilter, customStart, customEnd]);

  // Brand item counts for filter badges
  const brandCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    aggregatedData.forEach(item => {
      counts[item.brandName] = (counts[item.brandName] || 0) + 1;
    });
    return counts;
  }, [aggregatedData]);

  // Executive KPI summary calculations
  const ledgerKPIs = useMemo(() => {
    let totalQty = 0;
    let totalVal = 0;
    let mrpSum = 0;
    const brandMap: Record<string, { qty: number; val: number }> = {};
    let topItem: { name: string; qty: number } = { name: '—', qty: 0 };

    aggregatedData.forEach(item => {
      totalQty += item.totalQuantity;
      totalVal += item.totalValue;
      mrpSum += item.mrp * item.totalQuantity;

      const brandKey = item.brandName || 'Unbranded';
      if (!brandMap[brandKey]) brandMap[brandKey] = { qty: 0, val: 0 };
      brandMap[brandKey].qty += item.totalQuantity;
      brandMap[brandKey].val += item.totalValue;

      if (item.totalQuantity > topItem.qty) {
        topItem = { name: item.fullName, qty: item.totalQuantity };
      }
    });

    let topBrand: { name: string; qty: number; val: number } = { name: '—', qty: 0, val: 0 };
    Object.entries(brandMap).forEach(([bName, bData]) => {
      if (bData.qty > topBrand.qty) {
        topBrand = { name: bName, qty: bData.qty, val: bData.val };
      }
    });

    const avgMrp = totalQty > 0 ? mrpSum / totalQty : 0;

    return {
      totalQty,
      totalVal,
      topBrand,
      topItem,
      avgMrp,
      uniqueSkuCount: aggregatedData.length,
    };
  }, [aggregatedData]);

  // Filtered & Sorted Data for Table
  const filteredData = useMemo(() => {
    let result = [...aggregatedData];

    // Filter by Brand Filter Chips
    if (selectedBrandFilter !== 'all') {
      result = result.filter(r => r.brandName.toLowerCase() === selectedBrandFilter.toLowerCase());
    }

    // Filter by Text Search (Item name, brand, or DC number)
    if (searchItem.trim()) {
      const q = searchItem.toLowerCase();
      result = result.filter(r =>
        r.fullName.toLowerCase().includes(q) ||
        r.brandName.toLowerCase().includes(q) ||
        Array.from(r.dcs).some(dc => dc.toLowerCase().includes(q))
      );
    }

    // Sorting
    result.sort((a, b) => {
      if (sortKey === 'qty_desc') return b.totalQuantity - a.totalQuantity;
      if (sortKey === 'qty_asc') return a.totalQuantity - b.totalQuantity;
      if (sortKey === 'val_desc') return b.totalValue - a.totalValue;
      if (sortKey === 'name_asc') return a.fullName.localeCompare(b.fullName);
      return 0;
    });

    return result;
  }, [aggregatedData, selectedBrandFilter, searchItem, sortKey]);

  // Reset page when filters change
  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchItem, selectedBrandFilter, sortKey, dateFilter, customStart, customEnd]);

  const totalPages = Math.ceil(filteredData.length / ITEMS_PER_PAGE);
  const paginatedData = filteredData.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  const filteredTotals = useMemo(() => {
    return filteredData.reduce(
      (acc, curr) => ({
        totalQty: acc.totalQty + curr.totalQuantity,
        totalVal: acc.totalVal + curr.totalValue,
      }),
      { totalQty: 0, totalVal: 0 }
    );
  }, [filteredData]);

  // 3. One-Click Excel Export
  const handleExportExcel = () => {
    triggerHaptic('medium');
    if (filteredData.length === 0) {
      alert("No items to export.");
      return;
    }

    const exportRows = filteredData.map((item, index) => {
      const dcSplitsText = Object.entries(item.dcSplits)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([dc, q]) => `${dc}: ${q} pcs`)
        .join(' | ');

      return {
        '#': index + 1,
        'Brand': item.brandName,
        'Item Description': item.itemName,
        'Full Product Name': item.fullName,
        'Dispatched DCs': Array.from(item.dcs).join(', '),
        'Per-DC Quantities': dcSplitsText,
        'MRP (₹)': item.mrp || 0,
        'Total Quantity (pcs)': item.totalQuantity,
        'Total Value (₹)': item.totalValue,
        'Dispatch Frequency': `${item.occurrences} challans`,
      };
    });

    const ws = XLSX.utils.json_to_sheet(exportRows);

    const colWidths = [
      { wch: 5 },
      { wch: 18 },
      { wch: 32 },
      { wch: 36 },
      { wch: 22 },
      { wch: 38 },
      { wch: 10 },
      { wch: 18 },
      { wch: 16 },
      { wch: 18 },
    ];
    ws['!cols'] = colWidths;

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Item Ledger');

    const dateStr = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `Item_Ledger_${dateStr}.xlsx`);
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.06)] overflow-hidden flex flex-col relative transition-all">
      {/* 5. Executive KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3 p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
        {/* Total Dispatched Units */}
        <div className="p-3 sm:p-3.5 bg-gradient-to-br from-indigo-50/70 to-indigo-100/30 dark:from-indigo-950/40 dark:to-indigo-900/20 border border-indigo-200/60 dark:border-indigo-800/60 rounded-2xl">
          <div className="flex items-center justify-between text-indigo-700 dark:text-indigo-400 mb-1">
            <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-wider">Total Dispatched</span>
            <Package className="w-3.5 h-3.5" />
          </div>
          <div className="text-base sm:text-lg font-black font-mono text-slate-900 dark:text-white">
            {ledgerKPIs.totalQty.toLocaleString('en-IN')} <span className="text-xs font-semibold text-slate-500">pcs</span>
          </div>
          <div className="text-[10px] font-medium text-slate-500 dark:text-slate-400 mt-0.5">
            Across {challans.length} challans • {ledgerKPIs.uniqueSkuCount} SKUs
          </div>
        </div>

        {/* Gross Value */}
        <div className="p-3 sm:p-3.5 bg-gradient-to-br from-emerald-50/70 to-emerald-100/30 dark:from-emerald-950/40 dark:to-emerald-900/20 border border-emerald-200/60 dark:border-emerald-800/60 rounded-2xl">
          <div className="flex items-center justify-between text-emerald-700 dark:text-emerald-400 mb-1">
            <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-wider">Gross Value</span>
            <TrendingUp className="w-3.5 h-3.5" />
          </div>
          <div className="text-base sm:text-lg font-black font-mono text-emerald-700 dark:text-emerald-400">
            ₹{ledgerKPIs.totalVal.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
          </div>
          <div className="text-[10px] font-medium text-slate-500 dark:text-slate-400 mt-0.5">
            Avg MRP: ₹{ledgerKPIs.avgMrp.toFixed(2)} / unit
          </div>
        </div>

        {/* Top Brand */}
        <div className="p-3 sm:p-3.5 bg-gradient-to-br from-amber-50/70 to-amber-100/30 dark:from-amber-950/40 dark:to-amber-900/20 border border-amber-200/60 dark:border-amber-800/60 rounded-2xl">
          <div className="flex items-center justify-between text-amber-700 dark:text-amber-400 mb-1">
            <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-wider">Top Brand</span>
            <Award className="w-3.5 h-3.5" />
          </div>
          <div className="text-sm sm:text-base font-black text-slate-900 dark:text-white truncate" title={ledgerKPIs.topBrand.name}>
            {ledgerKPIs.topBrand.name}
          </div>
          <div className="text-[10px] font-mono font-bold text-amber-700 dark:text-amber-400 mt-0.5">
            {ledgerKPIs.topBrand.qty.toLocaleString('en-IN')} pcs (₹{ledgerKPIs.topBrand.val.toLocaleString('en-IN', { maximumFractionDigits: 0 })})
          </div>
        </div>

        {/* Top Volume SKU */}
        <div className="p-3 sm:p-3.5 bg-gradient-to-br from-sky-50/70 to-sky-100/30 dark:from-sky-950/40 dark:to-sky-900/20 border border-sky-200/60 dark:border-sky-800/60 rounded-2xl">
          <div className="flex items-center justify-between text-sky-700 dark:text-sky-400 mb-1">
            <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-wider">Top Volume SKU</span>
            <Tag className="w-3.5 h-3.5" />
          </div>
          <div className="text-xs sm:text-sm font-black text-slate-900 dark:text-white truncate" title={ledgerKPIs.topItem.name}>
            {ledgerKPIs.topItem.name}
          </div>
          <div className="text-[10px] font-mono font-bold text-sky-700 dark:text-sky-400 mt-0.5">
            {ledgerKPIs.topItem.qty.toLocaleString('en-IN')} units dispatched
          </div>
        </div>
      </div>

      {/* Header & Controls */}
      <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">Item Ledger</h2>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-mono">
                {filteredData.length} SKUs
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Aggregated quantities, MRPs, and per-DC dispatch splits across delivery challans.
            </p>
          </div>

          {/* 3. Export Excel Button */}
          <button
            type="button"
            onClick={handleExportExcel}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs font-bold rounded-xl hover:bg-emerald-100 dark:hover:bg-emerald-900/60 transition-all shadow-2xs active:scale-95 self-start sm:self-auto"
            title="Download Item Ledger as Excel (.xlsx)"
          >
            <Download className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>Export Ledger (.xlsx)</span>
          </button>
        </div>

        {/* Filter Toolbar */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 pt-1">
          {/* Search Box */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search items, brands, or DC numbers..."
              value={searchItem}
              onChange={(e) => setSearchItem(e.target.value)}
              className="w-full pl-9 pr-8 py-2 text-xs border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 bg-slate-50 dark:bg-slate-800/80 text-slate-800 dark:text-slate-100"
            />
            {searchItem && (
              <button
                onClick={() => setSearchItem('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Date Filter */}
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <select
              value={dateFilter}
              onChange={(e) => {
                triggerHaptic('light');
                setDateFilter(e.target.value);
              }}
              className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 font-medium"
            >
              <option value="all">All Dates in Current View</option>
              <option value="last_7">Last 7 Days</option>
              <option value="last_15">Last 15 Days</option>
              <option value="this_month">This Month</option>
              <option value="last_month">Last Month</option>
              <option value="custom">Custom Date Range</option>
            </select>
          </div>

          {/* Custom Date Range */}
          {dateFilter === 'custom' && (
            <div className="flex items-center gap-1.5 sm:col-span-2">
              <input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="w-full px-2 py-1.5 text-xs border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100"
              />
              <span className="text-slate-400 text-xs font-medium">to</span>
              <input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="w-full px-2 py-1.5 text-xs border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100"
              />
            </div>
          )}

          {/* Sort Selector */}
          <div className="relative">
            <ArrowUpDown className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <select
              value={sortKey}
              onChange={(e) => {
                triggerHaptic('light');
                setSortKey(e.target.value as any);
              }}
              className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 font-medium"
            >
              <option value="qty_desc">Sort: Highest Quantity</option>
              <option value="qty_asc">Sort: Lowest Quantity</option>
              <option value="val_desc">Sort: Highest Total Value</option>
              <option value="name_asc">Sort: Name (A-Z)</option>
            </select>
          </div>
        </div>

        {/* 2. Brand Filter Chips */}
        {uniqueBrands.length > 0 && (
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 pt-0.5 no-scrollbar">
            <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider mr-1 hidden sm:inline">
              Brand:
            </span>
            <button
              type="button"
              onClick={() => {
                triggerHaptic('light');
                setSelectedBrandFilter('all');
              }}
              className={`h-7 px-3 rounded-full text-xs font-bold transition-all whitespace-nowrap inline-flex items-center gap-1.5 ${
                selectedBrandFilter === 'all'
                  ? 'bg-indigo-600 text-white shadow-xs shadow-indigo-600/30'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              <span>All Brands</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${selectedBrandFilter === 'all' ? 'bg-indigo-700 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'}`}>
                {aggregatedData.length}
              </span>
            </button>
            {uniqueBrands.map(brand => {
              const count = brandCounts[brand] || 0;
              const isSelected = selectedBrandFilter.toLowerCase() === brand.toLowerCase();
              return (
                <button
                  key={brand}
                  type="button"
                  onClick={() => {
                    triggerHaptic('light');
                    setSelectedBrandFilter(isSelected ? 'all' : brand);
                  }}
                  className={`h-7 px-3 rounded-full text-xs font-bold transition-all whitespace-nowrap inline-flex items-center gap-1.5 ${
                    isSelected
                      ? 'bg-indigo-600 text-white shadow-xs shadow-indigo-600/30'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  <span>{brand}</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${isSelected ? 'bg-indigo-700 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'}`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* 1. Desktop Table with Per-DC Breakdown */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead className="bg-slate-100/90 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-black uppercase tracking-wider sticky top-0 shadow-xs text-[10px] z-10">
            <tr>
              <th className="px-4 py-3">Item & Brand</th>
              <th className="px-4 py-3">DC Breakdown (1. Per-DC Qty)</th>
              <th className="px-4 py-3 text-right">MRP</th>
              <th className="px-4 py-3 text-right">Total Quantity</th>
              <th className="px-4 py-3 text-right">Total Value</th>
              <th className="px-4 py-3 text-right">Frequency</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900 font-medium">
            {paginatedData.length > 0 ? (
              paginatedData.map((item) => (
                <tr
                  key={item.id}
                  onClick={() => {
                    triggerHaptic('light');
                    setSelectedItem(item);
                  }}
                  className="hover:bg-indigo-50/30 dark:hover:bg-indigo-950/20 transition-colors cursor-pointer group"
                >
                  <td className="px-4 py-3 max-w-[260px]">
                    <span className="font-bold text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors block leading-tight">
                      {item.fullName}
                    </span>
                    {item.brandName && (
                      <span className="inline-block mt-0.5 text-[9px] font-bold uppercase tracking-wider text-slate-400">
                        {item.brandName}
                      </span>
                    )}
                  </td>

                  {/* 1. Per-DC Breakdown Column */}
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1 max-w-sm">
                      {Object.entries(item.dcSplits)
                        .sort(([a], [b]) => a.localeCompare(b))
                        .map(([dc, q]) => (
                          <span
                            key={dc}
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/70 border border-indigo-200/60 dark:border-indigo-800/60 font-mono text-[10px] text-indigo-700 dark:text-indigo-300 font-semibold"
                          >
                            <span>{dc}:</span>
                            <span className="text-slate-900 dark:text-white font-extrabold">{q}</span>
                          </span>
                        ))}
                    </div>
                  </td>

                  <td className="px-4 py-3 text-right font-mono font-bold text-slate-800 dark:text-slate-200">
                    {item.mrp > 0 ? `₹${item.mrp.toFixed(2)}` : '—'}
                  </td>

                  <td className="px-4 py-3 text-right">
                    <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-md font-mono font-black text-xs bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200/60 dark:border-indigo-800/60">
                      {item.totalQuantity.toLocaleString('en-IN')} pcs
                    </span>
                  </td>

                  <td className="px-4 py-3 text-right font-mono font-bold text-emerald-700 dark:text-emerald-400">
                    ₹{item.totalValue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </td>

                  <td className="px-4 py-3 text-right">
                    <span className="text-slate-500 dark:text-slate-400 text-xs">
                      {item.occurrences} {item.occurrences === 1 ? 'challan' : 'challans'}
                    </span>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-slate-400 text-xs font-medium">
                  No items found matching your filters.
                </td>
              </tr>
            )}
          </tbody>
          {filteredData.length > 0 && (
            <tfoot className="bg-slate-50 dark:bg-slate-800/60 border-t border-slate-200 dark:border-slate-800 font-bold text-slate-900 dark:text-white text-xs">
              <tr>
                <td colSpan={3} className="px-4 py-3 text-right uppercase text-[10px] tracking-wider text-slate-500 dark:text-slate-400">
                  Filtered Totals ({filteredData.length} SKUs):
                </td>
                <td className="px-4 py-3 text-right font-mono font-black text-indigo-700 dark:text-indigo-300">
                  {filteredTotals.totalQty.toLocaleString('en-IN')} pcs
                </td>
                <td className="px-4 py-3 text-right font-mono font-black text-emerald-700 dark:text-emerald-400">
                  ₹{filteredTotals.totalVal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </td>
                <td></td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {/* 1. Mobile Card Layout with Per-DC Breakdown */}
      <div className="md:hidden divide-y divide-slate-100 dark:divide-slate-800">
        {paginatedData.length > 0 ? (
          paginatedData.map((item) => (
            <div
              key={item.id}
              onClick={() => {
                triggerHaptic('light');
                setSelectedItem(item);
              }}
              className="p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer bg-white dark:bg-slate-900 space-y-2"
            >
              <div className="flex justify-between items-start gap-2">
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-white text-sm leading-tight">{item.fullName}</h3>
                  <p className="text-slate-400 text-[11px] font-semibold mt-0.5">{item.brandName}</p>
                </div>
                <div className="text-right shrink-0">
                  <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-md text-xs font-mono font-black bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200/60 dark:border-indigo-800/60">
                    {item.totalQuantity} pcs
                  </span>
                  <div className="text-[10px] font-mono font-bold text-emerald-700 dark:text-emerald-400 mt-0.5">
                    ₹{item.totalValue.toLocaleString('en-IN')}
                  </div>
                </div>
              </div>

              {/* Mobile Per-DC Breakdown Badges */}
              <div className="flex flex-wrap gap-1 pt-1">
                {Object.entries(item.dcSplits)
                  .sort(([a], [b]) => a.localeCompare(b))
                  .map(([dc, q]) => (
                    <span
                      key={dc}
                      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/70 border border-indigo-200/60 dark:border-indigo-800/60 font-mono text-[9px] text-indigo-700 dark:text-indigo-300 font-semibold"
                    >
                      <span>{dc}:</span>
                      <span className="text-slate-900 dark:text-white font-extrabold">{q}</span>
                    </span>
                  ))}
              </div>

              <div className="flex items-center justify-between text-[11px] text-slate-400 pt-0.5">
                <span>MRP: {item.mrp > 0 ? `₹${item.mrp.toFixed(2)}` : '—'}</span>
                <span>In {item.occurrences} {item.occurrences === 1 ? 'challan' : 'challans'}</span>
              </div>
            </div>
          ))
        ) : (
          <div className="p-8 text-center text-slate-400 text-xs">
            No items found matching your filters.
          </div>
        )}
        {filteredData.length > 0 && (
          <div className="bg-slate-50 dark:bg-slate-800/60 p-4 flex justify-between items-center text-xs border-t border-slate-100 dark:border-slate-800">
            <span className="font-bold text-slate-600 dark:text-slate-300">Filtered Total ({filteredData.length} SKUs):</span>
            <div className="text-right">
              <span className="font-mono font-black text-slate-900 dark:text-white block">{filteredTotals.totalQty.toLocaleString('en-IN')} pcs</span>
              <span className="font-mono font-bold text-emerald-700 dark:text-emerald-400 text-[11px]">₹{filteredTotals.totalVal.toLocaleString('en-IN')}</span>
            </div>
          </div>
        )}
      </div>

      {/* Footer / Pagination */}
      <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
        <span className="text-slate-500 dark:text-slate-400">
          Showing {filteredData.length === 0 ? 0 : ((currentPage - 1) * ITEMS_PER_PAGE) + 1} - {Math.min(currentPage * ITEMS_PER_PAGE, filteredData.length)} of {filteredData.length} SKUs
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              triggerHaptic('light');
              setCurrentPage(p => Math.max(1, p - 1));
            }}
            disabled={currentPage === 1}
            className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          >
            Prev
          </button>
          <span className="text-slate-600 dark:text-slate-300 font-medium">Page {currentPage} of {totalPages || 1}</span>
          <button
            onClick={() => {
              triggerHaptic('light');
              setCurrentPage(p => Math.min(totalPages, p + 1));
            }}
            disabled={currentPage === totalPages || totalPages === 0}
            className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          >
            Next
          </button>
        </div>
      </div>

      {/* Drill-down Modal */}
      {selectedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/40">
              <div>
                <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">{selectedItem.fullName}</h2>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    Dispatched in <strong className="text-slate-800 dark:text-slate-200 font-bold">{selectedItem.occurrences}</strong> challans
                  </span>
                  <span className="text-slate-300 dark:text-slate-700">•</span>
                  <span className="text-xs font-mono font-bold text-indigo-600 dark:text-indigo-400">
                    Total: {selectedItem.totalQuantity} pcs
                  </span>
                  {selectedItem.mrp > 0 && (
                    <>
                      <span className="text-slate-300 dark:text-slate-700">•</span>
                      <span className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400">
                        MRP: ₹{selectedItem.mrp.toFixed(2)}
                      </span>
                    </>
                  )}
                </div>
              </div>
              <button
                onClick={() => {
                  triggerHaptic('light');
                  setSelectedItem(null);
                }}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 sm:p-5 overflow-y-auto bg-white dark:bg-slate-900 flex-1">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-black uppercase tracking-wider text-[10px]">
                    <th className="pb-2.5">DC Number</th>
                    <th className="pb-2.5">Date</th>
                    <th className="pb-2.5">Location</th>
                    <th className="pb-2.5 text-right">Quantity</th>
                    <th className="pb-2.5 text-right">MRP</th>
                    <th className="pb-2.5 text-right">Value</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                  {selectedItem.sources.map((src, i) => (
                    <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className="py-2.5 font-mono font-bold text-indigo-600 dark:text-indigo-400">{src.dcNumber}</td>
                      <td className="py-2.5 text-slate-600 dark:text-slate-300">{new Date(src.dcDate).toLocaleDateString()}</td>
                      <td className="py-2.5 text-slate-600 dark:text-slate-300 capitalize">{src.location}</td>
                      <td className="py-2.5 text-right font-mono font-black text-slate-900 dark:text-white">{src.quantity} pcs</td>
                      <td className="py-2.5 text-right font-mono font-bold text-slate-700 dark:text-slate-300">
                        {src.mrp > 0 ? `₹${src.mrp.toFixed(2)}` : '—'}
                      </td>
                      <td className="py-2.5 text-right font-mono font-bold text-emerald-700 dark:text-emerald-400">
                        {src.mrp > 0 ? `₹${(src.quantity * src.mrp).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t border-slate-200 dark:border-slate-800 font-bold text-slate-900 dark:text-white">
                  <tr>
                    <td colSpan={3} className="py-3 text-right uppercase text-[10px] text-slate-400">Total:</td>
                    <td className="py-3 text-right font-mono font-black text-indigo-600 dark:text-indigo-400">{selectedItem.totalQuantity} pcs</td>
                    <td></td>
                    <td className="py-3 text-right font-mono font-black text-emerald-700 dark:text-emerald-400">
                      ₹{selectedItem.totalValue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
