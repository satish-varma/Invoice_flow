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
  FileCheck,
  Receipt,
  Paperclip,
  FileText,
  AlertTriangle,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { exportToCSV } from '@/lib/export';
import { triggerHaptic } from '@/lib/haptics';
import { useAuth } from '@/contexts/AuthContext';
import { DeliveryChallanAttachmentModal } from './delivery-challan-attachment-modal';
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

import { hasPermission } from '@/types/permissions';
import { logAuditEvent } from '@/services/auditService';

export function formatShortDcNumber(dcNumber: string): string {
  if (!dcNumber) return '';
  if (/^TGG-\d{4}$/.test(dcNumber)) return dcNumber;
  const match = dcNumber.match(/(\d+)$/);
  if (match) {
    return `TGG-${match[1].padStart(4, '0')}`;
  }
  return dcNumber;
}

export function getFirstWord(name?: string | null): string {
  if (!name) return '—';
  const trimmed = name.trim();
  if (!trimmed) return '—';
  return trimmed.split(/[\s,]+/)[0];
}

const MONTH_OPTIONS = [
  { value: 'all', label: 'All Months' },
  { value: '0', label: 'January' },
  { value: '1', label: 'February' },
  { value: '2', label: 'March' },
  { value: '3', label: 'April' },
  { value: '4', label: 'May' },
  { value: '5', label: 'June' },
  { value: '6', label: 'July' },
  { value: '7', label: 'August' },
  { value: '8', label: 'September' },
  { value: '9', label: 'October' },
  { value: '10', label: 'November' },
  { value: '11', label: 'December' },
];

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
  onRefresh?: () => void;
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
  onRefresh,
  isBulkDownloading = false,
  showFinancials = true,
}: ChallanListProps) {
  const { user, role, canDelete, isReadOnly } = useAuth();
  const isAdmin = role === 'admin' || role === 'superadmin';
  const canSeeFinancials = isAdmin && showFinancials;
  const canViewSignedCopies = role !== 'guest' && hasPermission(user, 'signed_copies');
  const hasDeleteClearance = canDelete && !isReadOnly && role !== 'guest';

  const [searchTerm, setSearchTerm] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [creatorFilter, setCreatorFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<'all' | 'this_month' | 'last_30'>('all');
  const [monthFilter, setMonthFilter] = useState<string>('all');
  const [yearFilter, setYearFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'date_desc' | 'date_asc' | 'value_desc' | 'value_asc'>('date_desc');

  // Attachment Modal state
  const [attachmentModal, setAttachmentModal] = useState<{
    challan: Challan;
    type: 'signed_copy' | 'invoice';
  } | null>(null);

  // Confirm delete dialog state
  const [deleteDialogChallan, setDeleteDialogChallan] = useState<Challan | null>(null);
  const [isBulkDeleteDialogOpen, setIsBulkDeleteDialogOpen] = useState(false);
  const [deleteConfirmationInput, setDeleteConfirmationInput] = useState('');

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

  // Distinct year list for filtering
  const availableYears = useMemo(() => {
    const set = new Set<string>();
    challans.forEach((c) => {
      if (c.dcDate) {
        try {
          const yr = new Date(c.dcDate).getFullYear();
          if (!isNaN(yr)) set.add(yr.toString());
        } catch {}
      }
    });
    return Array.from(set).sort((a, b) => Number(b) - Number(a));
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

        // Preset Date filter
        let dateOk = true;
        if (dateFilter !== 'all' && c.dcDate) {
          const dcD = new Date(c.dcDate);
          if (dateFilter === 'this_month') {
            dateOk = isAfter(dcD, startOfMonth(new Date()));
          } else if (dateFilter === 'last_30') {
            dateOk = isAfter(dcD, subDays(new Date(), 30));
          }
        }

        // Specific Year & Month Filter
        let yearOk = true;
        let monthOk = true;
        if (c.dcDate) {
          try {
            const dcD = new Date(c.dcDate);
            if (!isNaN(dcD.getTime())) {
              if (yearFilter !== 'all') {
                yearOk = dcD.getFullYear().toString() === yearFilter;
              }
              if (monthFilter !== 'all') {
                monthOk = dcD.getMonth().toString() === monthFilter;
              }
            } else if (yearFilter !== 'all' || monthFilter !== 'all') {
              yearOk = false;
              monthOk = false;
            }
          } catch {
            if (yearFilter !== 'all' || monthFilter !== 'all') {
              yearOk = false;
              monthOk = false;
            }
          }
        } else if (yearFilter !== 'all' || monthFilter !== 'all') {
          yearOk = false;
          monthOk = false;
        }

        return searchOk && creatorOk && dateOk && yearOk && monthOk;
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
  }, [challans, searchTerm, creatorFilter, dateFilter, monthFilter, yearFilter, sortBy]);

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
    if (!hasDeleteClearance) return;
    if (deleteDialogChallan) {
      logAuditEvent({
        actorEmail: user?.email || 'admin',
        actorRole: role || 'user',
        action: 'dc_deleted',
        actionLabel: 'Deleted Delivery Challan',
        targetType: 'challan',
        targetId: deleteDialogChallan.id,
        targetLabel: deleteDialogChallan.dcNumber,
        details: {
          consignee: deleteDialogChallan.shipToName,
          total: deleteDialogChallan.total,
          dcDate: deleteDialogChallan.dcDate,
        },
      });
      onDeleteChallan(deleteDialogChallan);
      if (deleteDialogChallan.id) {
        const next = new Set(selectedIds);
        next.delete(deleteDialogChallan.id);
        setSelectedIds(next);
      }
      setDeleteDialogChallan(null);
      setDeleteConfirmationInput('');
    }
  };

  const confirmBulkDelete = () => {
    if (!hasDeleteClearance) return;
    const ids = Array.from(selectedIds);
    if (ids.length > 0) {
      logAuditEvent({
        actorEmail: user?.email || 'admin',
        actorRole: role || 'user',
        action: 'bulk_dc_deleted',
        actionLabel: 'Bulk Deleted Delivery Challans',
        targetType: 'challan',
        details: {
          deletedCount: ids.length,
        },
      });
      onBulkDelete(ids);
      setSelectedIds(new Set());
      setIsBulkDeleteDialogOpen(false);
      setDeleteConfirmationInput('');
    }
  };

  return (
    <>
      <Card className="rounded-2xl border border-gray-200/80 shadow-sm overflow-hidden bg-white mb-24 sm:mb-12 w-full max-w-full min-w-0">
        <CardHeader className="p-4 sm:p-5 border-b border-gray-100 bg-gray-50/50 space-y-3">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-3">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <CardTitle className="text-base sm:text-lg font-black text-gray-900 tracking-tight">
                  Saved Delivery Challans
                </CardTitle>
                <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200/80 font-mono">
                  {filteredChallans.length === challans.length ? `${challans.length} Total` : `${filteredChallans.length} of ${challans.length}`}
                </span>
                {selectedIds.size > 0 && (
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-indigo-600 text-white font-mono animate-in fade-in">
                    {selectedIds.size} selected
                  </span>
                )}
              </div>
            </div>

            <div className="flex w-full lg:w-auto items-center gap-2 flex-wrap sm:flex-nowrap">
              <div className="relative flex-1 sm:w-64">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Search DC #, consignee, creator..."
                  className="pl-9 h-11 sm:h-9 text-sm rounded-2xl border-slate-200 bg-white focus-visible:ring-indigo-500/30"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
                {searchTerm && (
                  <button
                    type="button"
                    onClick={() => setSearchTerm('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 rounded-full"
                    aria-label="Clear search"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <Button
                variant="outline"
                size="sm"
                className="h-11 sm:h-9 px-3.5 rounded-2xl border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-100 shrink-0 shadow-2xs active:scale-95 transition-transform"
                onClick={() => {
                  triggerHaptic('light');
                  const exportData = filteredChallans.map((c) => {
                    const row: Record<string, any> = {
                      'DC Number': c.dcNumber,
                      'DC Date': c.dcDate ? format(new Date(c.dcDate), 'yyyy-MM-dd') : '',
                      'Consignee (Ship To)': c.shipToName || c.billToName || '',
                      'Bill To': c.billToName || '',
                      'Created By': getCreator(c),
                      'Total Items': c.lineItems?.length || 0,
                      'Total Value (₹)': c.total || 0,
                    };
                    if (canSeeFinancials) {
                      row['P.Cost (₹)'] = c.procurementCost || 0;
                      row['Commission Rate (%)'] = c.commissionRate || 5.5;
                      row['Commission (₹)'] = c.commissionAmount || 0;
                      row['Transport Expense (₹)'] = c.transportationExpense ?? c.transportCost ?? 0;
                      row['Other Expenses (₹)'] = c.otherExpense || 0;
                      row['Net Revenue (₹)'] = c.revenue || 0;
                      row['Gross Profit (₹)'] = c.grossProfit || 0;
                      row['Margin (%)'] = (c.marginPercent || 0).toFixed(1);
                    }
                    return row;
                  });
                  exportToCSV(exportData, 'delivery-challans-export.csv');
                }}
                title={canSeeFinancials ? "Export with complete financials to CSV" : "Export delivery challans to CSV"}
              >
                <FileSpreadsheet className="h-4 w-4 mr-1.5 text-emerald-600" />
                CSV
              </Button>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  triggerHaptic('light');
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className="hidden sm:inline-flex h-9 px-3 rounded-2xl text-xs font-bold text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 shrink-0"
                title="Scroll to Create / Edit Challan form"
              >
                &uarr; Top Form
              </Button>
            </div>
          </div>

          {/* Quick Filter Bar (Dates, Creators, Sort) */}
          <div className="flex items-center gap-2 overflow-x-auto scrollbar-none py-1 text-xs w-full max-w-full">
            {/* Date Filters */}
            <div className="flex items-center bg-white p-1 rounded-2xl border border-slate-200/90 shadow-2xs shrink-0 gap-1">
              <button
                type="button"
                onClick={() => setDateFilter('all')}
                className={`px-3 py-1.5 rounded-xl font-bold text-xs transition-all active:scale-95 ${
                  dateFilter === 'all'
                    ? 'bg-gradient-to-r from-indigo-600 to-[#3b2fc9] text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                All Time
              </button>
              <button
                type="button"
                onClick={() => setDateFilter('this_month')}
                className={`px-3 py-1.5 rounded-xl font-bold text-xs transition-all active:scale-95 ${
                  dateFilter === 'this_month'
                    ? 'bg-gradient-to-r from-indigo-600 to-[#3b2fc9] text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                This Month
              </button>
              <button
                type="button"
                onClick={() => setDateFilter('last_30')}
                className={`px-3 py-1.5 rounded-xl font-bold text-xs transition-all active:scale-95 ${
                  dateFilter === 'last_30'
                    ? 'bg-gradient-to-r from-indigo-600 to-[#3b2fc9] text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Last 30 Days
              </button>
            </div>

            {/* Year Filter */}
            {availableYears.length > 0 && (
              <select
                value={yearFilter}
                onChange={(e) => {
                  triggerHaptic('light');
                  setYearFilter(e.target.value);
                }}
                className={`h-9 text-xs font-bold rounded-2xl border px-3 py-1 shadow-2xs transition-all shrink-0 cursor-pointer ${
                  yearFilter !== 'all'
                    ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                    : 'border-slate-200 bg-white text-slate-700'
                }`}
                title="Filter by Year"
              >
                <option value="all">All Years</option>
                {availableYears.map((yr) => (
                  <option key={yr} value={yr}>
                    Year {yr}
                  </option>
                ))}
              </select>
            )}

            {/* Month Filter */}
            <select
              value={monthFilter}
              onChange={(e) => {
                triggerHaptic('light');
                setMonthFilter(e.target.value);
              }}
              className={`h-9 text-xs font-bold rounded-2xl border px-3 py-1 shadow-2xs transition-all shrink-0 cursor-pointer ${
                monthFilter !== 'all'
                  ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                  : 'border-slate-200 bg-white text-slate-700'
              }`}
              title="Filter by Month"
            >
              {MONTH_OPTIONS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>

            {/* Creator Filter */}
            {allCreators.length > 1 && (
              <select
                value={creatorFilter}
                onChange={(e) => {
                  triggerHaptic('light');
                  setCreatorFilter(e.target.value);
                }}
                className={`h-9 text-xs font-bold rounded-2xl border px-3 py-1 shadow-2xs transition-all shrink-0 cursor-pointer ${
                  creatorFilter !== 'all'
                    ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                    : 'border-slate-200 bg-white text-slate-700'
                }`}
              >
                <option value="all">All Creators ({allCreators.length})</option>
                {allCreators.map((cr) => (
                  <option key={cr} value={cr}>
                    Created by {cr}
                  </option>
                ))}
              </select>
            )}

            {/* Reset Filters Button */}
            {(monthFilter !== 'all' || yearFilter !== 'all' || creatorFilter !== 'all' || dateFilter !== 'all' || searchTerm) && (
              <button
                type="button"
                onClick={() => {
                  triggerHaptic('light');
                  setMonthFilter('all');
                  setYearFilter('all');
                  setCreatorFilter('all');
                  setDateFilter('all');
                  setSearchTerm('');
                }}
                className="h-9 px-3 text-xs font-bold rounded-2xl text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-200 flex items-center gap-1.5 transition-all shrink-0 active:scale-95 shadow-2xs"
                title="Reset all active filters"
              >
                <X className="w-3.5 h-3.5" />
                <span>Reset</span>
              </button>
            )}

            {/* Sort Dropdown */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="h-9 text-xs font-bold rounded-2xl border-slate-200 bg-white px-3 py-1 text-slate-700 shadow-2xs shrink-0 sm:ml-auto cursor-pointer"
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
              {/* ── MOBILE CARD VIEW (lg:hidden) ── */}
              <div className="lg:hidden">
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

                <div className="p-2.5 sm:p-3 space-y-3.5 bg-slate-100/70 dark:bg-slate-950/40">
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
                        className={`relative overflow-hidden rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.06)] border-t-4 border-t-indigo-500 bg-gradient-to-b from-indigo-500/5 via-white to-white dark:from-indigo-500/10 dark:via-slate-900 dark:to-slate-900 p-4 space-y-3 transition-all ${
                          isSelected ? 'ring-2 ring-indigo-500 bg-indigo-50/20' : ''
                        }`}
                      >
                        {/* Top: Checkbox + DC # + Date + Creator Pill */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-3 min-w-0">
                            {challan.id && (
                              <button
                                type="button"
                                onClick={(e) => handleToggleSelectOne(challan.id!, e)}
                                className="p-1 -ml-1 text-slate-400 hover:text-indigo-600 transition-colors shrink-0"
                              >
                                {isSelected ? (
                                  <CheckSquare className="w-5 h-5 text-indigo-600" />
                                ) : (
                                  <Square className="w-5 h-5 text-slate-400" />
                                )}
                              </button>
                            )}

                            <div className="flex items-center gap-1.5 min-w-0">
                              <span
                                onClick={(e) => {
                                  e.stopPropagation();
                                  triggerHaptic('light');
                                  onSelectChallan(challan);
                                }}
                                className="font-mono font-black text-base sm:text-lg text-[#3b2fc9] dark:text-indigo-400 hover:underline cursor-pointer truncate"
                                title={challan.dcNumber}
                              >
                                {formatShortDcNumber(challan.dcNumber)}
                              </span>
                              <button
                                type="button"
                                onClick={(e) => handleCopyDcNumber(e, challan.dcNumber)}
                                className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                                title={`Copy ${challan.dcNumber}`}
                              >
                                {copiedId === challan.dcNumber ? (
                                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                                ) : (
                                  <Copy className="w-3.5 h-3.5" />
                                )}
                              </button>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 shrink-0">
                            <User className="w-3.5 h-3.5 text-slate-500" />
                            <span className="truncate max-w-[100px]">{creator}</span>
                          </div>
                        </div>

                        {/* Middle: Consignee (Ship To) Inset Banner */}
                        <div className="bg-slate-50/90 dark:bg-slate-800/60 rounded-2xl p-3 border border-slate-100 dark:border-slate-800 space-y-1.5">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <span className="text-[11px] uppercase font-bold tracking-wider text-indigo-600 dark:text-indigo-400 block">
                                Consignee (Ship To)
                              </span>
                              <p className="font-black text-sm text-slate-900 dark:text-white truncate" title={consigneeName}>
                                {consigneeName}
                              </p>
                              {hasDifferentBillTo && (
                                <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                                  <span className="font-semibold text-slate-700 dark:text-slate-300">Bill To:</span> {challan.billToName}
                                </p>
                              )}
                            </div>

                            <div className="text-right shrink-0">
                              <span className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200/80 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 shadow-2xs">
                                <Package className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                                {itemCount} Item{itemCount !== 1 ? 's' : ''}
                              </span>
                              <div className="flex items-center justify-end gap-1 text-slate-400 font-medium text-xs mt-1">
                                <Calendar className="w-3.5 h-3.5" />
                                <span>
                                  {challan.dcDate
                                    ? format(new Date(challan.dcDate), 'dd MMM yyyy')
                                    : '—'}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Total Value & Margin */}
                          <div className="pt-2 border-t border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between">
                            <span className="text-[11px] uppercase font-bold tracking-wider text-slate-400">
                              Total Value
                            </span>
                            <div className="flex items-center gap-2">
                              <span className="text-xl font-black font-mono tracking-tight text-indigo-950 dark:text-indigo-200 tabular-nums">
                                ₹{(Number(challan.total) || 0).toLocaleString('en-IN', {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                })}
                              </span>
                              {canSeeFinancials && margin !== 0 && (
                                <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                                  margin >= 15 ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300' : 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                                }`}>
                                  {margin.toFixed(0)}% mgn
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Mobile Financials Breakdown Pill */}
                        {canSeeFinancials && (
                          <div className="grid grid-cols-3 gap-1.5 text-xs font-mono">
                            <div className="bg-white dark:bg-slate-800 p-2 rounded-xl border border-slate-100 dark:border-slate-800 min-w-0">
                              <span className="text-slate-400 block text-[10px] font-bold uppercase truncate">P.COST</span>
                              <span className="font-black text-amber-700 dark:text-amber-400 truncate block">₹{pCost.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
                            </div>
                            <div className="bg-white dark:bg-slate-800 p-2 rounded-xl border border-slate-100 dark:border-slate-800 min-w-0">
                              <span className="text-slate-400 block text-[10px] font-bold uppercase truncate">COMM (5.5%)</span>
                              <span className="font-black text-red-600 dark:text-red-400 truncate block">-₹{comm.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
                            </div>
                            <div className="bg-white dark:bg-slate-800 p-2 rounded-xl border border-slate-100 dark:border-slate-800 min-w-0">
                              <span className="text-slate-400 block text-[10px] font-bold uppercase truncate">EST. PROFIT</span>
                              <span className="font-black text-emerald-700 dark:text-emerald-400 truncate block">₹{profit.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
                            </div>
                          </div>
                        )}

                        {/* Mobile Attachment Buttons: Signed DC & Invoice */}
                        <div className={`grid ${canViewSignedCopies ? 'grid-cols-2' : 'grid-cols-1'} gap-2 pt-1 border-t border-slate-100 dark:border-slate-800`}>
                          {canViewSignedCopies && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                triggerHaptic('light');
                                setAttachmentModal({ challan, type: 'signed_copy' });
                              }}
                              className={`h-10 px-3 rounded-2xl text-xs font-bold flex items-center justify-center gap-2 border transition-all active:scale-[0.98] ${
                                (challan.signedCopyUrls?.length ?? 0) > 0
                                  ? 'bg-emerald-50/90 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 shadow-2xs'
                                  : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50'
                              }`}
                              title="Upload or view Signed Delivery Challan copy"
                            >
                              <FileCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                              <span className="truncate">Signed DC</span>
                              {(challan.signedCopyUrls?.length ?? 0) > 0 ? (
                                <span className="px-2 py-0.5 rounded-full bg-emerald-600 text-white text-[10px] font-black shrink-0">
                                  {challan.signedCopyUrls!.length}
                                </span>
                              ) : (
                                <span className="text-[11px] text-slate-400 font-semibold shrink-0">+Upload</span>
                              )}
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              triggerHaptic('light');
                              setAttachmentModal({ challan, type: 'invoice' });
                            }}
                            className={`h-10 px-3 rounded-2xl text-xs font-bold flex items-center justify-center gap-2 border transition-all active:scale-[0.98] ${
                              (challan.goodsReceivedInvoiceUrls?.length ?? 0) > 0
                                ? 'bg-blue-50/90 dark:bg-blue-950/40 border-blue-300 dark:border-blue-800 text-blue-800 dark:text-blue-300 shadow-2xs'
                                : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50'
                            }`}
                            title="Upload or view Goods Received / Purchase Invoice"
                          >
                            <Receipt className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                            <span className="truncate">Invoice</span>
                            {(challan.goodsReceivedInvoiceUrls?.length ?? 0) > 0 ? (
                              <span className="px-2 py-0.5 rounded-full bg-blue-600 text-white text-[10px] font-black shrink-0">
                                {challan.goodsReceivedInvoiceUrls!.length}
                              </span>
                            ) : (
                              <span className="text-[11px] text-slate-400 font-semibold shrink-0">+Upload</span>
                            )}
                          </button>
                        </div>

                        {/* Mobile Actions: View, PDF, Edit, Duplicate in the EXACT SAME LINE */}
                        <div className="grid grid-cols-4 gap-1.5 sm:gap-2 pt-2.5 border-t border-slate-100 dark:border-slate-800">
                          {/* View Document */}
                          <Button
                            variant="default"
                            size="sm"
                            className="h-10 px-1 bg-gradient-to-r from-indigo-600 to-[#3b2fc9] hover:from-indigo-700 hover:to-[#2d23a0] text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1 shadow-xs active:scale-95 transition-transform"
                            onClick={(e) => {
                              e.stopPropagation();
                              triggerHaptic('light');
                              onViewChallan(challan);
                            }}
                            title="View Challan"
                          >
                            <Eye className="h-4 w-4 shrink-0" />
                            <span className="truncate">View</span>
                          </Button>

                          {/* PDF Download */}
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-10 px-1 border-blue-200 dark:border-blue-800 bg-blue-50/90 dark:bg-blue-950/40 hover:bg-blue-100 text-blue-700 dark:text-blue-300 rounded-xl text-xs font-bold flex items-center justify-center gap-1 active:scale-95 transition-transform shadow-2xs"
                            onClick={(e) => {
                              e.stopPropagation();
                              triggerHaptic('medium');
                              onDownloadChallan(challan);
                            }}
                            title="Download PDF"
                          >
                            <Download className="h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" />
                            <span className="truncate">PDF</span>
                          </Button>

                          {/* Edit */}
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-10 px-1 border-amber-200 dark:border-amber-800 bg-amber-50/90 dark:bg-amber-950/40 hover:bg-amber-100 text-amber-800 dark:text-amber-200 rounded-xl text-xs font-bold flex items-center justify-center gap-1 active:scale-95 transition-transform shadow-2xs"
                            onClick={(e) => {
                              e.stopPropagation();
                              triggerHaptic('light');
                              onSelectChallan(challan);
                            }}
                            title="Edit Challan"
                          >
                            <Edit className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
                            <span className="truncate">Edit</span>
                          </Button>

                          {/* Duplicate */}
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-10 px-1 border-purple-200 dark:border-purple-800 bg-purple-50/90 dark:bg-purple-950/40 hover:bg-purple-100 text-purple-800 dark:text-purple-200 rounded-xl text-xs font-bold flex items-center justify-center gap-1 active:scale-95 transition-transform shadow-2xs"
                            onClick={(e) => {
                              e.stopPropagation();
                              triggerHaptic('light');
                              onDuplicateChallan(challan);
                            }}
                            title="Duplicate Challan"
                          >
                            <Copy className="h-4 w-4 shrink-0 text-purple-600 dark:text-purple-400" />
                            <span className="truncate">Copy</span>
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* ── DESKTOP DATA TABLE (hidden lg:block) ── */}
              <div className="hidden lg:block overflow-x-auto min-w-0 w-full max-w-full">
                <Table className="min-w-[980px]">
                  <TableHeader>
                    <TableRow className="hover:bg-transparent bg-gray-50/70 border-b border-gray-100 text-xs font-bold text-gray-700">
                      <TableHead className="w-[36px] px-2.5">
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
                      <TableHead className="w-[100px]">DC #</TableHead>
                      <TableHead className="w-[85px]">Consignee</TableHead>
                      <TableHead className="w-[90px]">Date</TableHead>
                      <TableHead className="w-[85px]">Created By</TableHead>
                      <TableHead className="w-[45px] text-center">Items</TableHead>
                      <TableHead className="text-right w-[140px]">{canSeeFinancials ? 'Total & Profit' : 'Total (₹)'}</TableHead>
                      {canSeeFinancials && (
                        <TableHead className="text-right w-[80px] text-amber-700">P.Cost</TableHead>
                      )}
                      <TableHead className="text-right w-[205px]">Files &amp; Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredChallans.map((challan) => {
                      const itemCount = challan.lineItems?.length || 0;
                      const isSelected = !!challan.id && selectedIds.has(challan.id);
                      const consigneeName = challan.shipToName || challan.billToName || '—';
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
                          <TableCell className="px-2.5 py-2.5">
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

                          <TableCell className="py-2.5">
                            <div className="flex items-center gap-1">
                              <span
                                onClick={() => {
                                  triggerHaptic('light');
                                  onSelectChallan(challan);
                                }}
                                className="font-mono font-bold text-xs text-[#3b2fc9] hover:underline cursor-pointer"
                                title={challan.dcNumber}
                              >
                                {formatShortDcNumber(challan.dcNumber)}
                              </span>
                              <button
                                type="button"
                                onClick={(e) => handleCopyDcNumber(e, challan.dcNumber)}
                                className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-200 transition-all"
                                title={`Copy ${challan.dcNumber}`}
                              >
                                {copiedId === challan.dcNumber ? (
                                  <Check className="w-3 h-3 text-emerald-600" />
                                ) : (
                                  <Copy className="w-3 h-3" />
                                )}
                              </button>
                            </div>
                          </TableCell>

                          <TableCell className="py-2.5 max-w-[95px]">
                            <div className="font-semibold text-gray-900 truncate text-xs" title={consigneeName}>
                              {getFirstWord(consigneeName)}
                            </div>
                          </TableCell>

                          <TableCell className="py-2.5 text-gray-500 font-medium whitespace-nowrap text-xs">
                            {challan.dcDate
                              ? format(new Date(challan.dcDate), 'dd MMM yyyy')
                              : '—'}
                          </TableCell>

                          <TableCell className="py-2.5">
                            <div className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-slate-100 border border-slate-200 text-slate-700 max-w-[85px]">
                              <span className="w-3.5 h-3.5 rounded-full bg-indigo-200 text-indigo-800 font-bold text-[8px] flex items-center justify-center shrink-0">
                                {creator.charAt(0).toUpperCase()}
                              </span>
                              <span className="truncate font-semibold text-[11px]">{creator}</span>
                            </div>
                          </TableCell>

                          <TableCell className="py-2.5 text-center">
                            <span className="inline-flex items-center justify-center text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-blue-50 text-blue-700 border border-blue-200/80">
                              {itemCount}
                            </span>
                          </TableCell>

                          <TableCell className="py-2.5 text-right font-mono">
                            <div className="font-black text-gray-900 text-xs tabular-nums">
                              ₹{(Number(challan.total) || 0).toLocaleString('en-IN', {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}
                            </div>
                            {canSeeFinancials && (comm > 0 || profit !== 0) && (
                              <div className="text-[10px] text-gray-500 flex items-center justify-end gap-1 mt-0.5 leading-tight">
                                <span className="text-red-600 font-semibold" title="Commission (5.5%)">
                                  -₹{comm.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                                </span>
                                <span className="text-gray-300">|</span>
                                <span className="text-emerald-700 font-bold" title="Estimated Profit">
                                  ₹{profit.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                                  {margin !== 0 && ` (${margin.toFixed(0)}%)`}
                                </span>
                              </div>
                            )}
                          </TableCell>

                          {canSeeFinancials && (
                            <TableCell className="py-2.5 text-right font-mono font-bold text-amber-800 tabular-nums text-xs">
                              ₹{pCost.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                            </TableCell>
                          )}

                          <TableCell className="py-2.5 text-right">
                            <div className="flex items-center justify-end gap-0.5">
                              {/* Attachment: Signed DC */}
                              {canViewSignedCopies && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    triggerHaptic('light');
                                    setAttachmentModal({ challan, type: 'signed_copy' });
                                  }}
                                  className={`h-7 px-1.5 rounded-lg text-[10px] font-bold flex items-center gap-1 ${
                                    (challan.signedCopyUrls?.length ?? 0) > 0
                                      ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200/80 shadow-2xs'
                                      : 'text-gray-400 hover:text-emerald-700 hover:bg-emerald-50'
                                  }`}
                                  title="Manage Signed Copies"
                                >
                                  <Paperclip className="w-3 h-3 text-emerald-600" />
                                  <span className="hidden xl:inline">Signed</span>
                                  {(challan.signedCopyUrls?.length ?? 0) > 0 && (
                                    <span className="ml-0.5 px-1 py-0.2 rounded-full bg-emerald-600 text-white text-[8px] font-black">
                                      {challan.signedCopyUrls!.length}
                                    </span>
                                  )}
                                </Button>
                              )}

                              {/* Attachment: Invoice */}
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  triggerHaptic('light');
                                  setAttachmentModal({ challan, type: 'invoice' });
                                }}
                                className={`h-7 px-1.5 rounded-lg text-[10px] font-bold flex items-center gap-1 ${
                                  (challan.goodsReceivedInvoiceUrls?.length ?? 0) > 0
                                    ? 'bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200/80 shadow-2xs'
                                    : 'text-gray-400 hover:text-blue-700 hover:bg-blue-50'
                                }`}
                                title="Goods Received Invoice"
                              >
                                <FileText className="w-3 h-3 text-blue-600" />
                                <span className="hidden xl:inline">Invoice</span>
                                {(challan.goodsReceivedInvoiceUrls?.length ?? 0) > 0 && (
                                  <span className="ml-0.5 px-1 py-0.2 rounded-full bg-blue-600 text-white text-[8px] font-black">
                                    {challan.goodsReceivedInvoiceUrls!.length}
                                  </span>
                                )}
                              </Button>

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

                              {hasDeleteClearance && (
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
                              )}
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
        <div className="fixed bottom-20 sm:bottom-6 left-1/2 -translate-x-1/2 z-40 w-[94vw] max-w-3xl bg-gray-950 text-white p-3 sm:px-5 sm:py-3.5 rounded-2xl shadow-2xl border border-gray-800 flex flex-wrap items-center justify-between gap-3 animate-in fade-in slide-in-from-bottom-5 duration-200">
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
              {canSeeFinancials && selectedTotalPCost > 0 && (
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

            {hasDeleteClearance && (
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
            )}

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
        onOpenChange={(open) => {
          if (!open) {
            setDeleteDialogChallan(null);
            setDeleteConfirmationInput('');
          }
        }}
      >
        <AlertDialogContent className="rounded-2xl max-w-md">
          <AlertDialogHeader>
            <div className="flex items-center gap-2.5 text-red-600 mb-1">
              <div className="p-2 rounded-xl bg-red-100 dark:bg-red-950/50">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <AlertDialogTitle className="text-base sm:text-lg font-bold text-gray-900 dark:text-gray-100">
                Permanent Delete Safeguard
              </AlertDialogTitle>
            </div>
            <AlertDialogDescription asChild>
              <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-300 space-y-3 pt-1">
                <p>
                  This action is irreversible. All line items, taxes, and attachments linked to this challan will be permanently deleted.
                </p>
                <div className="p-3 rounded-xl bg-gray-50 dark:bg-gray-800/60 border border-gray-200/80 dark:border-gray-700 space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-gray-500">DC Number:</span>
                    <span className="font-mono font-bold text-gray-900 dark:text-gray-100 select-all">
                      {deleteDialogChallan?.dcNumber}
                    </span>
                  </div>
                  {deleteDialogChallan?.shipToName && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">Consignee:</span>
                      <span className="font-medium text-gray-800 dark:text-gray-200 truncate max-w-[200px]">
                        {deleteDialogChallan.shipToName}
                      </span>
                    </div>
                  )}
                  {deleteDialogChallan?.dcDate && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">Date:</span>
                      <span className="font-medium text-gray-800 dark:text-gray-200">
                        {format(new Date(deleteDialogChallan.dcDate), 'dd MMM yyyy')}
                      </span>
                    </div>
                  )}
                  {deleteDialogChallan?.total !== undefined && (
                    <div className="flex justify-between pt-1 border-t border-gray-200 dark:border-gray-700 font-bold">
                      <span className="text-gray-500">Total Value:</span>
                      <span className="font-mono text-gray-900 dark:text-gray-100">
                        ₹{Number(deleteDialogChallan.total).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  )}
                </div>
                <div className="space-y-1.5 pt-1">
                  <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 block">
                    To confirm, type <span className="font-mono font-bold text-red-600 select-all">{deleteDialogChallan?.dcNumber}</span> below:
                  </label>
                  <Input
                    value={deleteConfirmationInput}
                    onChange={(e) => setDeleteConfirmationInput(e.target.value)}
                    placeholder={deleteDialogChallan?.dcNumber}
                    className="font-mono text-sm border-red-200 focus-visible:ring-red-500/30"
                    autoFocus
                  />
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-0 mt-2">
            <AlertDialogCancel
              onClick={() => {
                setDeleteDialogChallan(null);
                setDeleteConfirmationInput('');
              }}
              className="rounded-xl text-xs font-semibold"
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                confirmDelete();
                setDeleteConfirmationInput('');
              }}
              disabled={
                deleteConfirmationInput.trim().toUpperCase() !==
                (deleteDialogChallan?.dcNumber || '').trim().toUpperCase()
              }
              className="rounded-xl text-xs font-bold bg-red-600 hover:bg-red-700 text-white disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Confirm & Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── BULK DELETE CONFIRMATION DIALOG ── */}
      <AlertDialog
        open={isBulkDeleteDialogOpen}
        onOpenChange={(open) => {
          setIsBulkDeleteDialogOpen(open);
          if (!open) setDeleteConfirmationInput('');
        }}
      >
        <AlertDialogContent className="rounded-2xl max-w-md">
          <AlertDialogHeader>
            <div className="flex items-center gap-2.5 text-red-600 mb-1">
              <div className="p-2 rounded-xl bg-red-100 dark:bg-red-950/50">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <AlertDialogTitle className="text-base sm:text-lg font-bold text-gray-900 dark:text-gray-100">
                Bulk Delete Safeguard
              </AlertDialogTitle>
            </div>
            <AlertDialogDescription asChild>
              <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-300 space-y-3 pt-1">
                <p>
                  You are about to permanently delete{' '}
                  <span className="font-bold text-red-600">{selectedIds.size}</span> delivery challans.
                  This action is irreversible and cannot be undone.
                </p>
                <div className="space-y-1.5 pt-1">
                  <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 block">
                    To confirm, type <span className="font-mono font-bold text-red-600">DELETE ALL</span> below:
                  </label>
                  <Input
                    value={deleteConfirmationInput}
                    onChange={(e) => setDeleteConfirmationInput(e.target.value)}
                    placeholder="DELETE ALL"
                    className="font-mono text-sm border-red-200 focus-visible:ring-red-500/30"
                    autoFocus
                  />
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-0 mt-2">
            <AlertDialogCancel
              onClick={() => {
                setIsBulkDeleteDialogOpen(false);
                setDeleteConfirmationInput('');
              }}
              className="rounded-xl text-xs font-semibold"
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                confirmBulkDelete();
                setDeleteConfirmationInput('');
              }}
              disabled={deleteConfirmationInput.trim().toUpperCase() !== 'DELETE ALL'}
              className="rounded-xl text-xs font-bold bg-red-600 hover:bg-red-700 text-white disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Delete {selectedIds.size} Challans
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Attachment Modal (Signed DC / Invoice) ── */}
      {attachmentModal && (
        <DeliveryChallanAttachmentModal
          isOpen={!!attachmentModal}
          onClose={() => setAttachmentModal(null)}
          challan={attachmentModal.challan}
          type={attachmentModal.type}
          title={attachmentModal.type === 'signed_copy' ? 'Signed Copies' : 'Goods Received Invoice'}
          onUpdate={(updatedUrls) => {
            if (updatedUrls && attachmentModal.challan) {
              if (attachmentModal.type === 'signed_copy') {
                attachmentModal.challan.signedCopyUrls = updatedUrls;
              } else {
                attachmentModal.challan.goodsReceivedInvoiceUrls = updatedUrls;
              }
            }
            onRefresh?.();
          }}
        />
      )}
    </>
  );
}
