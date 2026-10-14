'use client';

import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Challan } from '@/services/challanService';
import { format, isAfter, subDays, startOfMonth } from 'date-fns';
import {
  Download,
  FileSpreadsheet,
  Search,
  Copy,
  Check,
  Building2,
  Calendar,
  Truck,
  Package,
  Eye,
  Trash2,
  User,
  CheckSquare,
  Square,
  X,
  Edit,
  TrendingUp,
  Percent,
  DollarSign,
  ArrowUpDown,
  Filter,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { exportToCSV } from '@/lib/export';
import { triggerHaptic } from '@/lib/haptics';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface ChallanListProps {
  challans: Challan[];
  onSelectChallan: (challan: Challan) => void;
  onDownloadChallan: (challan: Challan) => void;
  onViewChallan: (challan: Challan) => void;
  onDuplicateChallan: (challan: Challan) => void;
  onDeleteChallan: (challan: Challan) => void;
  onBulkDownload: (selectedChallans: Challan[]) => void;
  onBulkDuplicate: (selectedChallans: Challan[]) => void;
  onBulkDelete: (selectedIds: string[]) => void;
  isBulkDownloading?: boolean;
  showFinancials?: boolean;
}

export function ChallanList({
  challans,
  onSelectChallan,
  onDownloadChallan,
  onViewChallan,
  onDuplicateChallan,
  onDeleteChallan,
  onBulkDownload,
  onBulkDuplicate,
  onBulkDelete,
  isBulkDownloading = false,
  showFinancials = true,
}: ChallanListProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [creatorFilter, setCreatorFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<'all' | 'this_month' | 'last_30'>('all');
  const [sortBy, setSortBy] = useState<'date_desc' | 'date_asc' | 'value_desc' | 'value_asc'>('date_desc');

  // Confirm delete dialog state
  const [deleteDialogChallan, setDeleteDialogChallan] = useState<Challan | null>(null);
  const [isBulkDeleteDialogOpen, setIsBulkDeleteDialogOpen] = useState(false);

  const handleCopyDcNumber = (e: React.MouseEvent, num: string) => {
    e.stopPropagation();
    triggerHaptic('light');
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(num);
      setCopiedId(num);
      setTimeout(() => setCopiedId(null), 1800);
    }
  };

  const getCreator = (c: Challan) => {
    if (c.creatorName) return c.creatorName;
    const raw = c.createdBy || c.creatorEmail;
    if (raw) {
      const name = raw.includes('@') ? raw.split('@')[0] : raw;
      return name.charAt(0).toUpperCase() + name.slice(1);
    }
    return 'Satya';
  };

  // Distinct creator list for filtering
  const allCreators = useMemo(() => {
    const set = new Set<string>();
    challans.forEach((c) => set.add(getCreator(c)));
    return Array.from(set).sort();
  }, [challans]);

  const filteredChallans = useMemo(() => {
    return challans
      .filter((c) => {
        const q = searchTerm.toLowerCase();
        const dcMatch = (c.dcNumber || '').toLowerCase().includes(q);
        const shipMatch = (c.shipToName || '').toLowerCase().includes(q);
        const billMatch = (c.billToName || '').toLowerCase().includes(q);
        const creator = getCreator(c);
        const creatorMatch = creator.toLowerCase().includes(q);
        const searchOk = !q || dcMatch || shipMatch || billMatch || creatorMatch;

        // Creator filter
        const creatorOk = creatorFilter === 'all' || creator.toLowerCase() === creatorFilter.toLowerCase();

        // Date filter
        let dateOk = true;
        if (dateFilter !== 'all' && c.dcDate) {
          const dcD = new Date(c.dcDate);
          if (dateFilter === 'this_month') {
            dateOk = isAfter(dcD, startOfMonth(new Date()));
          } else if (dateFilter === 'last_30') {
            dateOk = isAfter(dcD, subDays(new Date(), 30));
          }
        }

        return searchOk && creatorOk && dateOk;
      })
      .sort((a, b) => {
        if (sortBy === 'date_asc') {
          return new Date(a.dcDate || 0).getTime() - new Date(b.dcDate || 0).getTime();
        }
        if (sortBy === 'value_desc') {
          return (Number(b.total) || 0) - (Number(a.total) || 0);
        }
        if (sortBy === 'value_asc') {
          return (Number(a.total) || 0) - (Number(b.total) || 0);
        }
        // Default: date_desc
        return new Date(b.dcDate || 0).getTime() - new Date(a.dcDate || 0).getTime();
      });
  }, [challans, searchTerm, creatorFilter, dateFilter, sortBy]);

  const validFilteredWithId = filteredChallans.filter((c) => !!c.id);
  const isAllSelected =
    validFilteredWithId.length > 0 &&
    validFilteredWithId.every((c) => selectedIds.has(c.id!));

  const handleToggleSelectAll = () => {
    triggerHaptic('light');
    if (isAllSelected) {
      const next = new Set(selectedIds);
      validFilteredWithId.forEach((c) => next.delete(c.id!));
      setSelectedIds(next);
    } else {
      const next = new Set(selectedIds);
      validFilteredWithId.forEach((c) => next.add(c.id!));
      setSelectedIds(next);
    }
  };

  const handleToggleSelectOne = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    triggerHaptic('light');
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedIds(next);
  };

  const handleClearSelection = () => {
    triggerHaptic('light');
    setSelectedIds(new Set());
  };

  const selectedChallansList = challans.filter((c) => c.id && selectedIds.has(c.id));
  const selectedTotalValue = selectedChallansList.reduce(
    (acc, c) => acc + (Number(c.total) || 0),
    0
  );
  const selectedTotalPCost = selectedChallansList.reduce(
    (acc, c) => acc + (Number(c.procurementCost) || 0),
    0
  );
  const selectedTotalProfit = selectedChallansList.reduce(
    (acc, c) => acc + (Number(c.grossProfit) || 0),
    0
  );

  const confirmDelete = () => {
    if (deleteDialogChallan) {
      onDeleteChallan(deleteDialogChallan);
      if (deleteDialogChallan.id) {
        const next = new Set(selectedIds);
        next.delete(deleteDialogChallan.id);
        setSelectedIds(next);
      }
      setDeleteDialogChallan(null);
    }
  };

  const confirmBulkDelete = () => {
    const ids = Array.from(selectedIds);
    if (ids.length > 0) {
      onBulkDelete(ids);
      setSelectedIds(new Set());
      setIsBulkDeleteDialogOpen(false);
    }
  };

  return (
    <>
      <Card className="rounded-2xl border border-gray-200/80 shadow-sm overflow-hidden bg-white mb-24 sm:mb-12">
        <CardHeader className="p-4 sm:p-5 border-b border-gray-100 bg-gray-50/50 space-y-3">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-3">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <CardTitle className="text-base sm:text-lg font-black text-gray-900 tracking-tight">
                  Delivery Challans
                </CardTitle>
                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200/60 font-mono">
                  {filteredChallans.length} of {challans.length}
                </span>
                {selectedIds.size > 0 && (
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-indigo-600 text-white font-mono animate-in fade-in">
                    {selectedIds.size} selected
                  </span>
                )}
                {showFinancials && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/60 flex items-center gap-1">
                    <TrendingUp className="w-3 h-3" /> P.Cost &amp; Margins Active
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-500 mt-0.5">
                Consignee destination, creator logs, procurement cost, commission &amp; bulk exports
              </p>
            </div>

            <div className="flex w-full lg:w-auto items-center gap-2 flex-wrap sm:flex-nowrap">
              <div className="relative flex-1 sm:w-64">
                <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-gray-400" />
                <Input
                  placeholder="Search DC #, consignee, creator..."
                  className="pl-8 h-9 text-xs rounded-xl border-gray-200 bg-white"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>

              <Button
                variant="outline"
                size="sm"
                className="h-9 px-3 rounded-xl border-gray-200 text-xs font-bold text-gray-700 hover:bg-gray-100 shrink-0"
                onClick={() => {
                  triggerHaptic('light');
                  const exportData = filteredChallans.map((c) => ({
                    'DC Number': c.dcNumber,
                    'DC Date': c.dcDate ? format(new Date(c.dcDate), 'yyyy-MM-dd') : '',
                    'Consignee (Ship To)': c.shipToName || c.billToName || '',
                    'Bill To': c.billToName || '',
                    'Created By': getCreator(c),
                    'Total Items': c.lineItems?.length || 0,
                    'Total Value (₹)': c.total || 0,
                    'P.Cost (₹)': c.procurementCost || 0,
                    'Commission Rate (%)': c.commissionRate || 5.5,
                    'Commission (₹)': c.commissionAmount || 0,
                    'Net Revenue (₹)': c.revenue || 0,
                    'Gross Profit (₹)': c.grossProfit || 0,
                    'Margin (%)': (c.marginPercent || 0).toFixed(1),
                  }));
                  exportToCSV(exportData, 'delivery-challans-advanced-export.csv');
                }}
                title="Export with complete financials to CSV"
              >
                <FileSpreadsheet className="h-3.5 w-3.5 mr-1.5 text-emerald-600" />
                CSV
              </Button>
            </div>
          </div>

          {/* Quick Filter Bar (Dates, Creators, Sort) */}
          <div className="flex items-center gap-2 flex-wrap pt-1 text-xs">
            {/* Date Filters */}
            <div className="flex items-center bg-white p-0.5 rounded-xl border border-gray-200">
              <button
                type="button"
                onClick={() => setDateFilter('all')}
                className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition-all ${
                  dateFilter === 'all'
                    ? 'bg-indigo-600 text-white shadow-2xs'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                All Time
              </button>
              <button
                type="button"
                onClick={() => setDateFilter('this_month')}
                className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition-all ${
                  dateFilter === 'this_month'
                    ? 'bg-indigo-600 text-white shadow-2xs'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                This Month
              </button>
              <button
                type="button"
                onClick={() => setDateFilter('last_30')}
                className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition-all ${
                  dateFilter === 'last_30'
                    ? 'bg-indigo-600 text-white shadow-2xs'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Last 30 Days
              </button>
            </div>

            {/* Creator Filter */}
            {allCreators.length > 1 && (
              <select
                value={creatorFilter}
                onChange={(e) => setCreatorFilter(e.target.value)}
                className="h-7 text-[11px] font-bold rounded-xl border-gray-200 bg-white px-2 py-0.5 text-gray-700 shadow-2xs"
              >
                <option value="all">All Creators ({allCreators.length})</option>
                {allCreators.map((cr) => (
                  <option key={cr} value={cr}>
                    Created by {cr}
                  </option>
                ))}
              </select>
            )}

            {/* Sort Dropdown */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="h-7 text-[11px] font-bold rounded-xl border-gray-200 bg-white px-2 py-0.5 text-gray-700 shadow-2xs ml-auto"
            >
              <option value="date_desc">Date: Newest First</option>
              <option value="date_asc">Date: Oldest First</option>
              <option value="value_desc">Value: High &rarr; Low</option>
              <option value="value_asc">Value: Low &rarr; High</option>
            </select>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {filteredChallans.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 text-center">
              <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mb-3">
                <Truck className="w-6 h-6" />
              </div>
              <p className="text-sm font-bold text-gray-800">No delivery challans match filters</p>
              <p className="text-xs text-gray-400 mt-1">
                Try resetting your search query, date filter, or creator filter.
              </p>
            </div>
          ) : (
            <>
              {/* ── MOBILE CARD VIEW (md:hidden) ── */}
              <div className="md:hidden">
                <div className="flex items-center justify-between px-4 py-2.5 bg-gray-50/80 border-b border-gray-100 text-xs font-semibold text-gray-600">
                  <button
                    type="button"
                    onClick={handleToggleSelectAll}
                    className="flex items-center gap-2 text-indigo-700 active:opacity-75"
                  >
                    {isAllSelected ? (
                      <CheckSquare className="w-4 h-4 text-indigo-600" />
                    ) : (
                      <Square className="w-4 h-4 text-gray-400" />
                    )}
                    <span>{isAllSelected ? 'Deselect All' : 'Select All'}</span>
                  </button>
                  <span className="text-[11px] text-gray-400 font-medium">
                    Showing {filteredChallans.length}
                  </span>
                </div>

                <div className="divide-y divide-gray-100">
                  {filteredChallans.map((challan) => {
                    const itemCount = challan.lineItems?.length || 0;
                    const isSelected = !!challan.id && selectedIds.has(challan.id);
                    const consigneeName = challan.shipToName || challan.billToName || 'General Consignee';
                    const hasDifferentBillTo =
                      challan.billToName &&
                      challan.shipToName &&
                      challan.shipToName.trim().toLowerCase() !== challan.billToName.trim().toLowerCase();
                    const creator = getCreator(challan);
                    const pCost = Number(challan.procurementCost) || 0;
                    const comm = Number(challan.commissionAmount) || 0;
                    const profit = Number(challan.grossProfit) || 0;
                    const margin = Number(challan.marginPercent) || 0;

                    return (
                      <div
                        key={challan.id}
                        className={`p-3.5 transition-colors space-y-2.5 ${
                          isSelected ? 'bg-indigo-50/40' : 'bg-white active:bg-gray-50'
                        }`}
                      >
                        {/* Top: Checkbox + DC # + Date + Creator Pill */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2.5 min-w-0">
                            {challan.id && (
                              <button
                                type="button"
                                onClick={(e) => handleToggleSelectOne(challan.id!, e)}
                                className="p-1 -ml-1 text-gray-400 hover:text-indigo-600 transition-colors"
                              >
                                {isSelected ? (
                                  <CheckSquare className="w-4 h-4 text-indigo-600" />
                                ) : (
                                  <Square className="w-4 h-4 text-gray-400" />
                                )}
                              </button>
                            )}

                            <div className="flex items-center gap-1.5 min-w-0">
                              <span
                                onClick={() => {
                                  triggerHaptic('light');
                                  onSelectChallan(challan);
                                }}
                                className="font-mono font-bold text-sm text-[#3b2fc9] hover:underline cursor-pointer truncate"
                              >
                                {challan.dcNumber}
                              </span>
                              <button
                                type="button"
                                onClick={(e) => handleCopyDcNumber(e, challan.dcNumber)}
                                className="p-1 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                                title="Copy DC #"
                              >
                                {copiedId === challan.dcNumber ? (
                                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                                ) : (
                                  <Copy className="w-3.5 h-3.5" />
                                )}
                              </button>
                            </div>
                          </div>

                          <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 border border-slate-200/80 text-[10px] font-bold text-slate-700 shrink-0">
                            <User className="w-3 h-3 text-slate-500" />
                            <span className="truncate max-w-[90px]">{creator}</span>
                          </div>
                        </div>

                        {/* Middle: Consignee (Ship To) */}
                        <div className="bg-gray-50/90 rounded-xl p-2.5 space-y-1">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <span className="text-[10px] uppercase font-bold text-indigo-600 tracking-wider block">
                                Consignee (Ship To)
                              </span>
                              <p className="font-bold text-xs text-gray-900 truncate">
                                {consigneeName}
                              </p>
                              {hasDifferentBillTo && (
                                <p className="text-[11px] text-gray-500 truncate mt-0.5">
                                  <span className="font-semibold text-gray-600">Bill To:</span> {challan.billToName}
                                </p>
                              )}
                            </div>

                            <div className="text-right shrink-0">
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200/80">
                                <Package className="w-2.5 h-2.5 text-blue-500" />
                                {itemCount} {itemCount === 1 ? 'item' : 'items'}
                              </span>
                              <div className="flex items-center justify-end gap-1 text-gray-400 font-medium text-[10px] mt-1">
                                <Calendar className="w-2.5 h-2.5" />
                                <span>
                                  {challan.dcDate
                                    ? format(new Date(challan.dcDate), 'dd MMM yyyy')
                                    : '—'}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Mobile Financials Breakdown Pill */}
                          {showFinancials && (
                            <div className="mt-2 pt-1.5 border-t border-gray-200/60 grid grid-cols-3 gap-1 text-[10px] font-mono">
                              <div className="bg-white p-1 rounded-lg border border-gray-100">
                                <span className="text-gray-400 block text-[9px]">P.COST</span>
                                <span className="font-bold text-amber-700">₹{pCost.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
                              </div>
                              <div className="bg-white p-1 rounded-lg border border-gray-100">
                                <span className="text-gray-400 block text-[9px]">COMM (5.5%)</span>
                                <span className="font-bold text-red-600">-₹{comm.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
                              </div>
                              <div className="bg-white p-1 rounded-lg border border-gray-100">
                                <span className="text-gray-400 block text-[9px]">EST. PROFIT</span>
                                <span className="font-bold text-emerald-700">₹{profit.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Bottom Row: Amount + Actions */}
                        <div className="flex items-center justify-between pt-1 border-t border-gray-100 gap-2">
                          <div>
                            <span className="text-[10px] text-gray-400 uppercase font-bold tracking-wider block">
                              Total Value
                            </span>
                            <div className="flex items-baseline gap-1.5">
                              <p className="text-sm font-black text-gray-900 font-mono tabular-nums leading-tight">
                                ₹{(Number(challan.total) || 0).toLocaleString('en-IN', {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                })}
                              </p>
                              {showFinancials && margin !== 0 && (
                                <span className={`text-[10px] font-bold px-1.5 rounded-full ${
                                  margin >= 15 ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                                }`}>
                                  {margin.toFixed(0)}% mgn
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                triggerHaptic('light');
                                onViewChallan(challan);
                              }}
                              className="h-7 px-2 rounded-lg border-gray-200 text-xs font-bold text-gray-700 hover:bg-gray-100 flex items-center gap-1 shadow-2xs"
                              title="View Document"
                            >
                              <Eye className="w-3 h-3 text-indigo-600" />
                              <span>View</span>
                            </Button>

                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                triggerHaptic('medium');
                                onDownloadChallan(challan);
                              }}
                              className="h-7 px-2 rounded-lg border-gray-200 text-xs font-bold text-gray-700 hover:bg-gray-100 flex items-center gap-1 shadow-2xs"
                              title="Download PDF"
                            >
                              <Download className="w-3 h-3 text-blue-600" />
                              <span>PDF</span>
                            </Button>

                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                triggerHaptic('light');
                                onDuplicateChallan(challan);
                              }}
                              className="h-7 w-7 p-0 rounded-lg border-gray-200 text-gray-700 hover:text-purple-700 hover:bg-purple-50"
                              title="Duplicate Challan"
                            >
                              <Copy className="w-3.5 h-3.5" />
                            </Button>

                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                triggerHaptic('light');
                                onSelectChallan(challan);
                              }}
                              className="h-7 w-7 p-0 rounded-lg border-gray-200 text-gray-700 hover:text-blue-700 hover:bg-blue-50"
                              title="Edit in Form"
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </Button>

                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                triggerHaptic('medium');
                                setDeleteDialogChallan(challan);
                              }}
                              className="h-7 w-7 p-0 rounded-lg border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300"
                              title="Delete Challan"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* ── DESKTOP DATA TABLE (hidden md:block) ── */}
              <div className="hidden md:block overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent bg-gray-50/70 border-b border-gray-100 text-xs font-bold text-gray-700">
                      <TableHead className="w-[44px] px-3">
                        <button
                          type="button"
                          onClick={handleToggleSelectAll}
                          className="flex items-center text-gray-400 hover:text-indigo-600 transition-colors"
                          title={isAllSelected ? 'Deselect all' : 'Select all'}
                        >
                          {isAllSelected ? (
                            <CheckSquare className="w-4 h-4 text-indigo-600" />
                          ) : (
                            <Square className="w-4 h-4" />
                          )}
                        </button>
                      </TableHead>
                      <TableHead className="w-[130px]">DC #</TableHead>
                      <TableHead>Consignee (Ship To)</TableHead>
                      <TableHead className="w-[105px]">Date</TableHead>
                      <TableHead className="w-[110px]">Created By</TableHead>
                      <TableHead className="w-[75px]">Items</TableHead>
                      <TableHead className="text-right w-[110px]">Total Value</TableHead>
                      {showFinancials && (
                        <>
                          <TableHead className="text-right w-[95px] text-amber-700">P.Cost</TableHead>
                          <TableHead className="text-right w-[95px] text-red-600">Comm (5.5%)</TableHead>
                          <TableHead className="text-right w-[100px] text-emerald-700">Est. Profit</TableHead>
                        </>
                      )}
                      <TableHead className="text-right w-[165px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredChallans.map((challan) => {
                      const itemCount = challan.lineItems?.length || 0;
                      const isSelected = !!challan.id && selectedIds.has(challan.id);
                      const consigneeName = challan.shipToName || challan.billToName || '—';
                      const hasDifferentBillTo =
                        challan.billToName &&
                        challan.shipToName &&
                        challan.shipToName.trim().toLowerCase() !== challan.billToName.trim().toLowerCase();
                      const creator = getCreator(challan);
                      const pCost = Number(challan.procurementCost) || 0;
                      const comm = Number(challan.commissionAmount) || 0;
                      const profit = Number(challan.grossProfit) || 0;
                      const margin = Number(challan.marginPercent) || 0;

                      return (
                        <TableRow
                          key={challan.id}
                          className={`transition-colors group border-b border-gray-100 text-xs ${
                            isSelected ? 'bg-indigo-50/50 hover:bg-indigo-50/70' : 'hover:bg-slate-50/80'
                          }`}
                        >
                          <TableCell className="px-3 py-3">
                            {challan.id && (
                              <button
                                type="button"
                                onClick={(e) => handleToggleSelectOne(challan.id!, e)}
                                className="flex items-center text-gray-400 hover:text-indigo-600 transition-colors"
                              >
                                {isSelected ? (
                                  <CheckSquare className="w-4 h-4 text-indigo-600" />
                                ) : (
                                  <Square className="w-4 h-4" />
                                )}
                              </button>
                            )}
                          </TableCell>

                          <TableCell className="py-3">
                            <div className="flex items-center gap-1.5">
                              <span
                                onClick={() => {
                                  triggerHaptic('light');
                                  onSelectChallan(challan);
                                }}
                                className="font-mono font-bold text-sm text-[#3b2fc9] hover:underline cursor-pointer"
                              >
                                {challan.dcNumber}
                              </span>
                              <button
                                type="button"
                                onClick={(e) => handleCopyDcNumber(e, challan.dcNumber)}
                                className="opacity-0 group-hover:opacity-100 p-1 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-200 transition-all"
                                title="Copy DC #"
                              >
                                {copiedId === challan.dcNumber ? (
                                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                                ) : (
                                  <Copy className="w-3.5 h-3.5" />
                                )}
                              </button>
                            </div>
                          </TableCell>

                          <TableCell className="py-3 max-w-[240px]">
                            <div className="font-semibold text-gray-900 truncate">
                              {consigneeName}
                            </div>
                            {hasDifferentBillTo && (
                              <div className="text-[11px] text-gray-500 truncate">
                                <span className="font-medium text-gray-400">Bill To:</span> {challan.billToName}
                              </div>
                            )}
                          </TableCell>

                          <TableCell className="py-3 text-gray-500 font-medium whitespace-nowrap">
                            {challan.dcDate
                              ? format(new Date(challan.dcDate), 'dd MMM yyyy')
                              : '—'}
                          </TableCell>

                          <TableCell className="py-3">
                            <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-slate-100 border border-slate-200 text-slate-700 max-w-[110px]">
                              <span className="w-3.5 h-3.5 rounded-full bg-indigo-200 text-indigo-800 font-bold text-[8px] flex items-center justify-center shrink-0">
                                {creator.charAt(0).toUpperCase()}
                              </span>
                              <span className="truncate font-semibold">{creator}</span>
                            </div>
                          </TableCell>

                          <TableCell className="py-3">
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200/80">
                              {itemCount}
                            </span>
                          </TableCell>

                          <TableCell className="py-3 text-right font-mono font-black text-gray-900 tabular-nums">
                            ₹{(Number(challan.total) || 0).toLocaleString('en-IN', {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </TableCell>

                          {showFinancials && (
                            <>
                              <TableCell className="py-3 text-right font-mono font-bold text-amber-800 tabular-nums">
                                ₹{pCost.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                              </TableCell>
                              <TableCell className="py-3 text-right font-mono font-semibold text-red-600 tabular-nums">
                                -₹{comm.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                              </TableCell>
                              <TableCell className="py-3 text-right">
                                <div className="space-y-0.5">
                                  <span className="font-mono font-black text-emerald-700 block tabular-nums">
                                    ₹{profit.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                                  </span>
                                  {margin !== 0 && (
                                    <span className="text-[10px] text-gray-400 font-mono font-semibold block">
                                      {margin.toFixed(0)}%
                                    </span>
                                  )}
                                </div>
                              </TableCell>
                            </>
                          )}

                          <TableCell className="py-3 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                  triggerHaptic('light');
                                  onViewChallan(challan);
                                }}
                                className="h-7 w-7 rounded-lg text-gray-500 hover:text-indigo-600 hover:bg-indigo-50"
                                title="View Document"
                              >
                                <Eye className="h-3.5 w-3.5" />
                              </Button>

                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                  triggerHaptic('medium');
                                  onDownloadChallan(challan);
                                }}
                                className="h-7 w-7 rounded-lg text-gray-500 hover:text-blue-600 hover:bg-blue-50"
                                title="Download PDF"
                              >
                                <Download className="h-3.5 w-3.5" />
                              </Button>

                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                  triggerHaptic('light');
                                  onDuplicateChallan(challan);
                                }}
                                className="h-7 w-7 rounded-lg text-gray-500 hover:text-purple-600 hover:bg-purple-50"
                                title="Duplicate Challan"
                              >
                                <Copy className="h-3.5 w-3.5" />
                              </Button>

                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                  triggerHaptic('light');
                                  onSelectChallan(challan);
                                }}
                                className="h-7 w-7 rounded-lg text-gray-500 hover:text-emerald-600 hover:bg-emerald-50"
                                title="Edit in Form"
                              >
                                <Edit className="h-3.5 w-3.5" />
                              </Button>

                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                  triggerHaptic('medium');
                                  setDeleteDialogChallan(challan);
                                }}
                                className="h-7 w-7 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50"
                                title="Delete Challan"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* ── FLOATING BULK ACTIONS TOOLBAR ── */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 w-[94vw] max-w-3xl bg-gray-950 text-white p-3 sm:px-5 sm:py-3.5 rounded-2xl shadow-2xl border border-gray-800 flex flex-wrap items-center justify-between gap-3 animate-in fade-in slide-in-from-bottom-5 duration-200">
          <div className="flex items-center gap-3">
            <span className="bg-[#3b2fc9] text-white text-xs font-black px-2.5 py-0.5 rounded-full font-mono">
              {selectedIds.size}
            </span>
            <div className="text-xs space-y-0.5">
              <div className="flex items-center gap-2">
                <span className="font-bold text-gray-200">Selected</span>
                <span className="text-gray-500">•</span>
                <span className="font-mono font-black text-amber-300">
                  ₹{selectedTotalValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                </span>
              </div>
              {showFinancials && selectedTotalPCost > 0 && (
                <div className="text-[10px] text-gray-400 font-mono flex items-center gap-2">
                  <span>P.Cost: ₹{selectedTotalPCost.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
                  <span className="text-emerald-400 font-bold">Profit: ₹{selectedTotalProfit.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Button
              size="sm"
              variant="secondary"
              disabled={isBulkDownloading}
              onClick={() => {
                triggerHaptic('medium');
                onBulkDownload(selectedChallansList);
              }}
              className="h-8 px-2.5 rounded-xl text-xs font-bold bg-white/10 hover:bg-white/20 text-white border border-white/15 flex items-center gap-1.5"
              title="Download selected as PDFs"
            >
              <Download className="w-3.5 h-3.5 text-blue-400" />
              <span>{isBulkDownloading ? 'Downloading...' : 'PDFs'}</span>
            </Button>

            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                triggerHaptic('medium');
                onBulkDuplicate(selectedChallansList);
              }}
              className="h-8 px-2.5 rounded-xl text-xs font-bold bg-white/10 hover:bg-white/20 text-white border border-white/15 flex items-center gap-1.5"
              title="Duplicate selected challans"
            >
              <Copy className="w-3.5 h-3.5 text-purple-400" />
              <span>Duplicate</span>
            </Button>

            <Button
              size="sm"
              variant="destructive"
              onClick={() => {
                triggerHaptic('medium');
                setIsBulkDeleteDialogOpen(true);
              }}
              className="h-8 px-2.5 rounded-xl text-xs font-bold bg-red-600/90 hover:bg-red-600 text-white flex items-center gap-1.5"
              title="Delete selected challans"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete</span>
            </Button>

            <button
              type="button"
              onClick={handleClearSelection}
              className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
              title="Clear selection"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ── SINGLE DELETE CONFIRMATION DIALOG ── */}
      <AlertDialog
        open={!!deleteDialogChallan}
        onOpenChange={(open) => !open && setDeleteDialogChallan(null)}
      >
        <AlertDialogContent className="rounded-2xl max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base sm:text-lg font-bold text-gray-900">
              Delete Delivery Challan?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs sm:text-sm text-gray-500">
              Are you sure you want to delete delivery challan{' '}
              <span className="font-mono font-bold text-gray-900">
                {deleteDialogChallan?.dcNumber}
              </span>
              ? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-0">
            <AlertDialogCancel
              onClick={() => setDeleteDialogChallan(null)}
              className="rounded-xl text-xs font-semibold"
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="rounded-xl text-xs font-bold bg-red-600 hover:bg-red-700 text-white"
            >
              Yes, Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── BULK DELETE CONFIRMATION DIALOG ── */}
      <AlertDialog
        open={isBulkDeleteDialogOpen}
        onOpenChange={setIsBulkDeleteDialogOpen}
      >
        <AlertDialogContent className="rounded-2xl max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base sm:text-lg font-bold text-gray-900">
              Delete {selectedIds.size} Delivery Challans?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs sm:text-sm text-gray-500">
              Are you sure you want to permanently delete{' '}
              <span className="font-bold text-red-600">{selectedIds.size}</span> selected
              delivery challan documents? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-0">
            <AlertDialogCancel
              onClick={() => setIsBulkDeleteDialogOpen(false)}
              className="rounded-xl text-xs font-semibold"
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmBulkDelete}
              className="rounded-xl text-xs font-bold bg-red-600 hover:bg-red-700 text-white"
            >
              Delete {selectedIds.size} Challans
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
