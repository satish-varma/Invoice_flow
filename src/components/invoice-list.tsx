"use client";

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
import { Invoice } from '@/services/invoiceService';
import { format } from 'date-fns';
import {
  Download,
  Search,
  Filter,
  FileSpreadsheet,
  Copy,
  Check,
  Building2,
  Calendar,
  Eye,
  Pencil,
  Trash2,
  FileText,
  Truck,
  RotateCcw,
  Sparkles,
  Paperclip,
  Tag,
  CheckCircle2,
  Clock,
  XCircle,
  ChevronDown,
  CheckCheck,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import { exportToCSV } from '@/lib/export';
import { triggerHaptic } from '@/lib/haptics';
import { Checkbox } from '@/components/ui/checkbox';

interface InvoiceListProps {
  invoices: Invoice[];
  onSelectInvoice: (invoice: Invoice) => void;
  onDownloadInvoice: (invoice: Invoice) => void;
  onViewInvoice?: (invoice: Invoice) => void;
  onDeleteInvoice?: (invoice: Invoice) => void;
  onBulkDownload?: (selectedInvoices: Invoice[]) => void;
  isBulkDownloading?: boolean;
  onUpdateStatus?: (invoice: Invoice, newStatus: 'pending' | 'paid' | 'cancelled') => void;
  onBulkUpdateStatus?: (selectedInvoices: Invoice[], newStatus: 'pending' | 'paid' | 'cancelled') => void;
  onBulkDelete?: (selectedInvoices: Invoice[]) => void;
}

const statusMap: Record<
  string,
  { label: string; class: string; dot: string }
> = {
  paid: {
    label: 'Paid',
    class: 'bg-emerald-50 text-emerald-700 border-emerald-200/80 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800/60',
    dot: 'bg-emerald-500',
  },
  pending: {
    label: 'Pending',
    class: 'bg-amber-50 text-amber-700 border-amber-200/80 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800/60',
    dot: 'bg-amber-500',
  },
  cancelled: {
    label: 'Cancelled',
    class: 'bg-rose-50 text-rose-700 border-rose-200/80 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-800/60',
    dot: 'bg-rose-500',
  },
};

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export function InvoiceList({
  invoices,
  onSelectInvoice,
  onDownloadInvoice,
  onViewInvoice,
  onDeleteInvoice,
  onBulkDownload,
  isBulkDownloading = false,
  onUpdateStatus,
  onBulkUpdateStatus,
  onBulkDelete,
}: InvoiceListProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const currentYear = useMemo(() => new Date().getFullYear().toString(), []);
  const currentMonthName = useMemo(() => MONTH_NAMES[new Date().getMonth()], []);
  const defaultPeriod = currentMonthName;

  const [yearFilter, setYearFilter] = useState<string>(currentYear);
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'paid' | 'cancelled'>('all');
  const [periodFilter, setPeriodFilter] = useState<string>(defaultPeriod);
  const [shipToFilter, setShipToFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | 'MRP' | 'NON-MRP'>('MRP');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [invoiceToDelete, setInvoiceToDelete] = useState<Invoice | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

  const renderStatusBadge = (invoice: Invoice) => {
    const status = invoice.status || 'pending';
    const badgeStyle = statusMap[status] || statusMap.pending;

    if (!onUpdateStatus) {
      return (
        <span
          className={`inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${badgeStyle.class}`}
        >
          <span className={`w-1.5 h-1.5 rounded-full ${badgeStyle.dot}`} />
          {badgeStyle.label}
        </span>
      );
    }

    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            className={`inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full border cursor-pointer hover:shadow-sm active:scale-95 transition-all ${badgeStyle.class}`}
            title="Click to change payment status"
          >
            <span className={`w-1.5 h-1.5 rounded-full ${badgeStyle.dot}`} />
            <span>{badgeStyle.label}</span>
            <ChevronDown className="w-2.5 h-2.5 opacity-60 ml-0.5" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-40 p-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl rounded-xl z-50">
          <DropdownMenuItem
            disabled={status === 'paid'}
            onClick={(e) => {
              e.stopPropagation();
              onUpdateStatus(invoice, 'paid');
            }}
            className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 focus:bg-emerald-50 dark:focus:bg-emerald-950/50 cursor-pointer rounded-lg py-1.5"
          >
            <CheckCircle2 className="w-3.5 h-3.5 mr-2 text-emerald-600" />
            Mark as Paid
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={status === 'pending'}
            onClick={(e) => {
              e.stopPropagation();
              onUpdateStatus(invoice, 'pending');
            }}
            className="text-xs font-semibold text-amber-700 dark:text-amber-400 focus:bg-amber-50 dark:focus:bg-amber-950/50 cursor-pointer rounded-lg py-1.5"
          >
            <Clock className="w-3.5 h-3.5 mr-2 text-amber-600" />
            Mark as Pending
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={status === 'cancelled'}
            onClick={(e) => {
              e.stopPropagation();
              onUpdateStatus(invoice, 'cancelled');
            }}
            className="text-xs font-semibold text-slate-700 dark:text-slate-300 focus:bg-slate-50 dark:focus:bg-slate-800 cursor-pointer rounded-lg py-1.5"
          >
            <XCircle className="w-3.5 h-3.5 mr-2 text-slate-500" />
            Mark as Cancelled
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  };

  const toggleSelect = (id: string) => {
    triggerHaptic('light');
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Extract unique years
  const availableYears = useMemo(() => {
    const set = new Set<string>();
    set.add(currentYear);
    invoices.forEach((inv) => {
      if (inv.date) {
        const match = String(inv.date).match(/^(\d{4})/);
        if (match) set.add(match[1]);
        else {
          const d = new Date(inv.date);
          if (!isNaN(d.getFullYear())) set.add(String(d.getFullYear()));
        }
      }
    });
    return Array.from(set).sort((a, b) => b.localeCompare(a));
  }, [invoices, currentYear]);

  // Extract unique periods (Service Months) in reverse chronological order with Current Month at the top
  const availablePeriods = useMemo(() => {
    const currentMonthIdx = new Date().getMonth();
    const orderedMonths: string[] = [];
    for (let i = 0; i < 12; i++) {
      const idx = (currentMonthIdx - i + 12) % 12;
      orderedMonths.push(MONTH_NAMES[idx]);
    }

    const set = new Set<string>();
    invoices.forEach((inv) => {
      if (inv.period && inv.period.trim()) {
        set.add(inv.period.trim());
      }
    });

    const result: string[] = [];
    orderedMonths.forEach((m) => {
      result.push(m);
      set.delete(m);
    });

    if (set.size > 0) {
      result.push(...Array.from(set).sort());
    }

    return result;
  }, [invoices]);

  // Extract unique Ship To destinations
  const availableShipTos = useMemo(() => {
    const set = new Set<string>();
    invoices.forEach((inv) => {
      const name = inv.shipToName;
      if (name && name.trim()) {
        set.add(name.trim());
      }
    });
    return Array.from(set).sort();
  }, [invoices]);

  const handleCopyInvoiceNumber = (e: React.MouseEvent, num: string) => {
    e.stopPropagation();
    triggerHaptic('light');
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(num);
      setCopiedId(num);
      setTimeout(() => setCopiedId(null), 1800);
    }
  };

  const hasActiveFilters =
    searchTerm !== '' ||
    yearFilter !== currentYear ||
    periodFilter !== defaultPeriod ||
    typeFilter !== 'MRP' ||
    statusFilter !== 'all' ||
    shipToFilter !== 'all';

  const resetFilters = () => {
    triggerHaptic('light');
    setSearchTerm('');
    setYearFilter(currentYear);
    setPeriodFilter(defaultPeriod);
    setTypeFilter('MRP');
    setStatusFilter('all');
    setShipToFilter('all');
  };

  const filteredInvoices = useMemo(() => {
    return invoices.filter((invoice) => {
      const query = searchTerm.toLowerCase().trim();
      const matchesSearch =
        !query ||
        invoice.invoiceNumber.toLowerCase().includes(query) ||
        (invoice.invoiceType || '').toLowerCase().includes(query) ||
        (invoice.billToName || invoice.customerName || '').toLowerCase().includes(query) ||
        (invoice.shipToName || '').toLowerCase().includes(query) ||
        (invoice.period || '').toLowerCase().includes(query) ||
        (invoice.eventNumber || '').toLowerCase().includes(query);

      const invoiceYear = (() => {
        if (invoice.date) {
          const match = String(invoice.date).match(/^(\d{4})/);
          if (match) return match[1];
          const d = new Date(invoice.date);
          if (!isNaN(d.getFullYear())) return String(d.getFullYear());
        }
        if (invoice.createdAt?.toDate) {
          return String(invoice.createdAt.toDate().getFullYear());
        }
        return '';
      })();

      const matchesYear = yearFilter === 'all' || invoiceYear === yearFilter;

      const matchesStatus =
        statusFilter === 'all' || (invoice.status || 'pending') === statusFilter;

      const matchesPeriod =
        periodFilter === 'all' ||
        (invoice.period || '').trim().toLowerCase() === periodFilter.trim().toLowerCase();

      const matchesShipTo =
        shipToFilter === 'all' ||
        (invoice.shipToName || '').trim().toLowerCase() === shipToFilter.trim().toLowerCase();

      const matchesType =
        typeFilter === 'all' || (invoice.invoiceType || 'NON-MRP') === typeFilter;

      return (
        matchesSearch &&
        matchesYear &&
        matchesStatus &&
        matchesPeriod &&
        matchesShipTo &&
        matchesType
      );
    });
  }, [invoices, searchTerm, yearFilter, statusFilter, periodFilter, shipToFilter, typeFilter]);

  const selectedInvoicesList = useMemo(() => {
    return invoices.filter((inv) => inv.id && selectedIds.has(inv.id));
  }, [invoices, selectedIds]);

  const isAllSelected =
    filteredInvoices.length > 0 &&
    filteredInvoices.every((inv) => inv.id && selectedIds.has(inv.id));
  const isSomeSelected =
    filteredInvoices.some((inv) => inv.id && selectedIds.has(inv.id)) && !isAllSelected;

  const toggleSelectAll = () => {
    triggerHaptic('light');
    if (isAllSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredInvoices.map((inv) => inv.id!).filter(Boolean)));
    }
  };

  const handleConfirmDelete = () => {
    if (invoiceToDelete) {
      triggerHaptic('medium');
      onDeleteInvoice?.(invoiceToDelete);
      setInvoiceToDelete(null);
    }
  };

  return (
    <>
      <Card className="rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.06)] overflow-hidden bg-white dark:bg-slate-900">
        <CardHeader className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40">
          <div className="flex flex-col gap-4">
            {/* Top row: Title + Badges + CSV Export */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <CardTitle className="text-base sm:text-lg font-black text-slate-900 dark:text-white tracking-tight">
                    Invoices Directory
                  </CardTitle>
                  <span className="text-xs font-black px-2.5 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-400 border border-indigo-200/60 dark:border-indigo-800/60 font-mono">
                    {filteredInvoices.length} of {invoices.length}
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  View, edit, filter, or manage your invoices with instant actions.
                </p>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                {hasActiveFilters && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={resetFilters}
                    className="h-9 px-2.5 text-xs font-bold text-slate-600 dark:text-slate-300 hover:text-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl"
                  >
                    <RotateCcw className="w-3.5 h-3.5 mr-1 text-slate-400" />
                    Reset
                  </Button>
                )}

                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 px-3 rounded-xl border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 shrink-0"
                  onClick={() => {
                    triggerHaptic('light');
                    exportToCSV(filteredInvoices, 'invoices-export.csv');
                  }}
                  title="Export filtered invoices to CSV"
                >
                  <FileSpreadsheet className="h-3.5 w-3.5 mr-1.5 text-emerald-600 dark:text-emerald-400" />
                  Export CSV
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  disabled={isBulkDownloading || (selectedIds.size === 0 && filteredInvoices.length === 0)}
                  onClick={() => {
                    triggerHaptic('medium');
                    const target = selectedIds.size > 0 ? selectedInvoicesList : filteredInvoices;
                    onBulkDownload?.(target);
                  }}
                  className="h-9 px-3 rounded-xl border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-xs font-bold flex items-center gap-1.5 shrink-0"
                  title={
                    selectedIds.size > 0
                      ? `Download ${selectedIds.size} selected invoice PDFs`
                      : `Download all ${filteredInvoices.length} filtered invoice PDFs`
                  }
                >
                  <Download className={`h-3.5 w-3.5 ${isBulkDownloading ? 'animate-bounce text-indigo-500' : 'text-indigo-600 dark:text-indigo-400'}`} />
                  <span>
                    {isBulkDownloading
                      ? 'Downloading...'
                      : selectedIds.size > 0
                      ? `Download (${selectedIds.size}) PDFs`
                      : `Download All (${filteredInvoices.length})`}
                  </span>
                </Button>
              </div>
            </div>

            {/* Filter Controls Toolbar */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-2 pt-1">
              {/* Search input */}
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
                <Input
                  placeholder="Search invoice, client, ship to..."
                  className="pl-8 h-9 text-xs rounded-xl border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>

              {/* Year Filter */}
              <Select
                value={yearFilter}
                onValueChange={(v: string) => {
                  triggerHaptic('light');
                  setYearFilter(v);
                }}
              >
                <SelectTrigger className="h-9 text-xs rounded-xl border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-medium">
                  <Calendar className="h-3 w-3 mr-1 text-slate-400 shrink-0" />
                  <SelectValue placeholder="Year" />
                </SelectTrigger>
                <SelectContent className="dark:bg-slate-800 dark:border-slate-700">
                  <SelectItem value="all">All Years</SelectItem>
                  {availableYears.map((yr) => (
                    <SelectItem key={yr} value={yr}>
                      {yr === currentYear ? `${yr} (Current)` : yr}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Status Filter */}
              <Select
                value={statusFilter}
                onValueChange={(v: any) => {
                  triggerHaptic('light');
                  setStatusFilter(v);
                }}
              >
                <SelectTrigger className="h-9 text-xs rounded-xl border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200">
                  <Filter className="h-3 w-3 mr-1 text-slate-400 shrink-0" />
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent className="dark:bg-slate-800 dark:border-slate-700">
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>

              {/* Service Month / Period Filter */}
              <Select
                value={periodFilter}
                onValueChange={(v: string) => {
                  triggerHaptic('light');
                  setPeriodFilter(v);
                }}
              >
                <SelectTrigger className="h-9 text-xs rounded-xl border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200">
                  <Calendar className="h-3 w-3 mr-1 text-slate-400 shrink-0" />
                  <SelectValue placeholder="Service Month" />
                </SelectTrigger>
                <SelectContent className="dark:bg-slate-800 dark:border-slate-700 max-h-56">
                  <SelectItem value="all">All Service Months</SelectItem>
                  {availablePeriods.map((period) => (
                    <SelectItem key={period} value={period}>
                      {period === currentMonthName ? `${period} (Current)` : period}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Invoice Type Filter (MRP / NON-MRP) */}
              <Select
                value={typeFilter}
                onValueChange={(v: any) => {
                  triggerHaptic('light');
                  setTypeFilter(v);
                }}
              >
                <SelectTrigger className="h-9 text-xs rounded-xl border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-medium">
                  <Tag className="h-3 w-3 mr-1 text-slate-400 shrink-0" />
                  <SelectValue placeholder="Invoice Type" />
                </SelectTrigger>
                <SelectContent className="dark:bg-slate-800 dark:border-slate-700">
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="MRP">MRP (With GST)</SelectItem>
                  <SelectItem value="NON-MRP">NON-MRP</SelectItem>
                </SelectContent>
              </Select>

              {/* Ship To Filter */}
              <Select
                value={shipToFilter}
                onValueChange={(v: string) => {
                  triggerHaptic('light');
                  setShipToFilter(v);
                }}
              >
                <SelectTrigger className="h-9 text-xs rounded-xl border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-medium">
                  <Truck className="h-3 w-3 mr-1 text-slate-400 shrink-0" />
                  <SelectValue placeholder="Ship To" />
                </SelectTrigger>
                <SelectContent className="dark:bg-slate-800 dark:border-slate-700 max-h-56">
                  <SelectItem value="all">All Ship To Locations</SelectItem>
                  {availableShipTos.map((loc) => (
                    <SelectItem key={loc} value={loc}>
                      {loc}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {filteredInvoices.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 text-center">
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mb-3">
                <FileText className="w-6 h-6" />
              </div>
              <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
                No invoices found
              </p>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                Try adjusting your search query, service month, or status filters.
              </p>
              {hasActiveFilters && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={resetFilters}
                  className="mt-3 h-8 text-xs font-bold rounded-xl"
                >
                  Reset all filters
                </Button>
              )}
            </div>
          ) : (
            <>
              {/* ── MOBILE TOUCH-FIRST CARD VIEW (md:hidden) ── */}
              <div className="md:hidden divide-y divide-slate-100 dark:divide-slate-800">
                {filteredInvoices.map((invoice) => {
                  const status = invoice.status || 'pending';
                  const badgeStyle = statusMap[status] || statusMap.pending;

                  return (
                    <div
                      key={invoice.id}
                      className="p-4 space-y-3 bg-white dark:bg-slate-900 transition-colors"
                    >
                      {/* Top Row: Checkbox + Invoice # + Type + Status Badge */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0 flex-wrap">
                          <Checkbox
                            checked={invoice.id ? selectedIds.has(invoice.id) : false}
                            onCheckedChange={() => invoice.id && toggleSelect(invoice.id)}
                            aria-label={`Select invoice ${invoice.invoiceNumber}`}
                            className="h-4 w-4 rounded-md shrink-0"
                          />
                          <span className="font-mono font-bold text-sm text-[#3b2fc9] dark:text-indigo-400 truncate">
                            {invoice.invoiceNumber}
                          </span>
                          <span
                            className={`inline-flex items-center font-mono font-bold text-[10px] px-1.5 py-0.5 rounded border ${
                              (invoice.invoiceType || 'NON-MRP') === 'MRP'
                                ? 'text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200/80 dark:border-emerald-800/80'
                                : 'text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/60 border-purple-200/80 dark:border-purple-800/80'
                            }`}
                          >
                            {invoice.invoiceType || 'NON-MRP'}
                          </span>
                          <button
                            type="button"
                            onClick={(e) => handleCopyInvoiceNumber(e, invoice.invoiceNumber)}
                            className="p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                            title="Copy Invoice #"
                          >
                            {copiedId === invoice.invoiceNumber ? (
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>

                        {renderStatusBadge(invoice)}
                      </div>

                      {/* Customer Row */}
                      <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-300 gap-2">
                        <div className="flex items-center gap-1.5 truncate">
                          <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                            {invoice.billToName || invoice.customerName || 'General Customer'}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 text-slate-400 shrink-0 font-medium text-[11px]">
                          <Calendar className="w-3 h-3" />
                          <span>
                            {invoice.date
                              ? format(new Date(invoice.date), 'dd MMM yyyy')
                              : '—'}
                          </span>
                        </div>
                      </div>

                      {/* Ship To & Service Month Row */}
                      <div className="flex items-center justify-between text-[11px] gap-2 pt-1 border-t border-slate-50 dark:border-slate-800/60">
                        <div className="flex items-center gap-1.5 min-w-0 text-slate-500 dark:text-slate-400 truncate">
                          <Truck className="w-3 h-3 text-slate-400 shrink-0" />
                          <span className="truncate">
                            <span className="font-medium text-slate-400 dark:text-slate-500">Ship: </span>
                            {invoice.shipToName ? (
                              <span title={invoice.shipToName} className="font-semibold text-slate-700 dark:text-slate-200">
                                {invoice.shipToName.trim().split(/\s+/)[0]}
                              </span>
                            ) : (
                              '—'
                            )}
                          </span>
                        </div>
                        {invoice.period ? (
                          <span className="inline-flex items-center gap-1 font-semibold text-indigo-700 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200/60 dark:border-indigo-800/60 px-2 py-0.5 rounded-md shrink-0">
                            <Calendar className="w-3 h-3" />
                            {invoice.period}
                          </span>
                        ) : (
                          <span className="text-slate-400 text-[10px]">—</span>
                        )}
                      </div>

                      {/* Event # & Attached PO Attachment */}
                      <div className="flex items-center justify-between text-[11px] gap-2 pt-1 border-t border-slate-50 dark:border-slate-800/60">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="text-slate-400 dark:text-slate-500 font-medium">Event #:</span>
                          <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                            {invoice.eventNumber || '—'}
                          </span>
                        </div>
                        {invoice.poFileUrl && (
                          <a
                            href={invoice.poFileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex items-center gap-1 text-[10px] font-black text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 px-2 py-0.5 rounded-md border border-indigo-200/60 dark:border-indigo-800/60 shrink-0"
                            title={invoice.poFileName || 'Purchase Order'}
                          >
                            <Paperclip className="w-3 h-3" />
                            Attached PO
                          </a>
                        )}
                      </div>

                      {/* Bottom Row: Amount + View, Edit, Delete Actions */}
                      <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800 gap-2">
                        <div>
                          <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">
                            Total
                          </span>
                          <p className="text-base font-black text-slate-900 dark:text-white font-mono tabular-nums leading-tight">
                            ₹{(Number(invoice.total) || 0).toLocaleString('en-IN', {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </p>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
                          {onUpdateStatus && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                triggerHaptic('medium');
                                onUpdateStatus(
                                  invoice,
                                  (invoice.status || 'pending') === 'paid' ? 'pending' : 'paid'
                                );
                              }}
                              className={`h-8 px-2.5 rounded-xl text-xs font-bold flex items-center gap-1 transition-all ${
                                (invoice.status || 'pending') === 'paid'
                                  ? 'border-emerald-200 text-emerald-700 bg-emerald-50/60 hover:bg-amber-50 hover:text-amber-700 hover:border-amber-300 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-800'
                                  : 'border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 hover:text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800'
                              }`}
                              title={(invoice.status || 'pending') === 'paid' ? 'Click to mark Pending' : 'Click to Mark as Paid'}
                            >
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                              <span>{(invoice.status || 'pending') === 'paid' ? 'Paid' : 'Mark Paid'}</span>
                            </Button>
                          )}

                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              triggerHaptic('light');
                              if (onViewInvoice) {
                                onViewInvoice(invoice);
                              } else {
                                onDownloadInvoice(invoice);
                              }
                            }}
                            className="h-8 px-2.5 rounded-xl border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 flex items-center gap-1"
                            title="View Invoice"
                          >
                            <Eye className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                            <span>View</span>
                          </Button>

                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              triggerHaptic('light');
                              onSelectInvoice(invoice);
                            }}
                            className="h-8 px-2.5 rounded-xl border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/40 flex items-center gap-1"
                            title="Edit Invoice"
                          >
                            <Pencil className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                            <span>Edit</span>
                          </Button>

                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              triggerHaptic('warning');
                              setInvoiceToDelete(invoice);
                            }}
                            className="h-8 px-2 rounded-xl border-rose-200 dark:border-rose-900/60 text-xs font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 flex items-center"
                            title="Delete Invoice"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* ── DESKTOP DATA TABLE (hidden md:block) ── */}
              <div className="hidden md:block">
                <Table className="w-full text-xs [&_th]:px-2.5 [&_th]:py-2.5 [&_td]:px-2.5 [&_td]:py-2">
                  <TableHeader>
                    <TableRow className="hover:bg-transparent bg-slate-50/70 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800">
                      <TableHead className="w-10 text-center px-2">
                        <Checkbox
                          checked={isAllSelected ? true : isSomeSelected ? "indeterminate" : false}
                          onCheckedChange={toggleSelectAll}
                          aria-label="Select all invoices"
                          className="rounded-md"
                        />
                      </TableHead>
                      <TableHead className="text-xs font-bold text-slate-600 dark:text-slate-300">
                        Invoice #
                      </TableHead>
                      <TableHead className="text-xs font-bold text-slate-600 dark:text-slate-300">
                        Type
                      </TableHead>
                      <TableHead className="text-xs font-bold text-slate-600 dark:text-slate-300">
                        Event #
                      </TableHead>
                      <TableHead className="text-xs font-bold text-slate-600 dark:text-slate-300">
                        Ship To
                      </TableHead>
                      <TableHead className="text-xs font-bold text-slate-600 dark:text-slate-300">
                        Service Month
                      </TableHead>
                      <TableHead className="text-xs font-bold text-slate-600 dark:text-slate-300">
                        Date
                      </TableHead>
                      <TableHead className="text-xs font-bold text-slate-600 dark:text-slate-300">
                        Status
                      </TableHead>
                      <TableHead className="text-right text-xs font-bold text-slate-600 dark:text-slate-300">
                        Amount
                      </TableHead>
                      <TableHead className="text-center text-xs font-bold text-slate-600 dark:text-slate-300">
                        Actions
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredInvoices.map((invoice) => {
                      const status = invoice.status || 'pending';
                      const badgeStyle = statusMap[status] || statusMap.pending;

                      return (
                        <TableRow
                          key={invoice.id}
                          className="transition-colors hover:bg-indigo-50/20 dark:hover:bg-slate-800/40 group border-b border-slate-100 dark:border-slate-800"
                        >
                          {/* Selection Checkbox */}
                          <TableCell className="w-[45px] text-center px-3" onClick={(e) => e.stopPropagation()}>
                            <Checkbox
                              checked={invoice.id ? selectedIds.has(invoice.id) : false}
                              onCheckedChange={() => invoice.id && toggleSelect(invoice.id)}
                              aria-label={`Select invoice ${invoice.invoiceNumber}`}
                              className="rounded-md"
                            />
                          </TableCell>

                          {/* Invoice # */}
                          <TableCell className="font-mono font-bold text-sm text-[#3b2fc9] dark:text-indigo-400 whitespace-nowrap">
                            <div className="flex items-center gap-1.5">
                              <span>{invoice.invoiceNumber}</span>
                              <button
                                type="button"
                                onClick={(e) => handleCopyInvoiceNumber(e, invoice.invoiceNumber)}
                                className="p-0.5 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors opacity-0 group-hover:opacity-100"
                                title="Copy Invoice #"
                              >
                                {copiedId === invoice.invoiceNumber ? (
                                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                                ) : (
                                  <Copy className="w-3.5 h-3.5" />
                                )}
                              </button>
                            </div>
                          </TableCell>

                          {/* Invoice Type */}
                          <TableCell className="text-xs whitespace-nowrap">
                            <span
                              className={`inline-flex items-center font-mono font-bold text-[11px] px-2 py-0.5 rounded-md border ${
                                (invoice.invoiceType || 'NON-MRP') === 'MRP'
                                  ? 'text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200/80 dark:border-emerald-800/80'
                                  : 'text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/60 border-purple-200/80 dark:border-purple-800/80'
                              }`}
                            >
                              {invoice.invoiceType || 'NON-MRP'}
                            </span>
                          </TableCell>

                          {/* Event # & Attached PO */}
                          <TableCell className="text-xs whitespace-nowrap font-medium">
                            <div className="flex items-center gap-1.5">
                              {invoice.eventNumber ? (
                                <span className="font-mono font-bold text-[11px] px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200">
                                  {invoice.eventNumber}
                                </span>
                              ) : (
                                <span className="text-slate-400 font-sans">—</span>
                              )}
                              {invoice.poFileUrl && (
                                <a
                                  href={invoice.poFileUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                  className="inline-flex items-center gap-0.5 text-[10px] font-black text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 px-1.5 py-0.5 rounded border border-indigo-200/60 dark:border-indigo-800/60"
                                  title={`View Attached PO: ${invoice.poFileName || 'Purchase Order'}`}
                                >
                                  <Paperclip className="w-3 h-3" />
                                  PO
                                </a>
                              )}
                            </div>
                          </TableCell>

                          {/* Ship To (trimmed to first word) */}
                          <TableCell className="text-xs font-semibold whitespace-nowrap">
                            {(() => {
                              const shipTo = invoice.shipToName || '';
                              const firstWord = shipTo.trim().split(/\s+/)[0];
                              return firstWord ? (
                                <span
                                  title={shipTo}
                                  className="inline-block px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 cursor-help"
                                >
                                  {firstWord}
                                </span>
                              ) : (
                                <span className="text-slate-400 font-normal">—</span>
                              );
                            })()}
                          </TableCell>

                          {/* Service Month */}
                          <TableCell className="text-xs whitespace-nowrap font-medium">
                            {invoice.period ? (
                              <span className="inline-flex items-center gap-1 font-semibold text-[11px] text-indigo-700 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200/60 dark:border-indigo-800/60 px-2 py-0.5 rounded-md">
                                <Calendar className="w-3 h-3 text-indigo-500" />
                                {invoice.period}
                              </span>
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </TableCell>

                          {/* Date */}
                          <TableCell className="text-xs text-slate-500 dark:text-slate-400 font-medium whitespace-nowrap">
                            {invoice.date
                              ? format(new Date(invoice.date), 'dd MMM yyyy')
                              : '—'}
                          </TableCell>

                          {/* Status */}
                          <TableCell>
                            {renderStatusBadge(invoice)}
                          </TableCell>

                          {/* Amount */}
                          <TableCell className="text-right font-mono font-black text-sm text-slate-900 dark:text-white tabular-nums whitespace-nowrap">
                            ₹{(Number(invoice.total) || 0).toLocaleString('en-IN', {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </TableCell>

                          {/* Actions: Mark Paid, View, Edit, Delete */}
                          <TableCell className="text-center whitespace-nowrap">
                            <div className="inline-flex items-center gap-1 justify-center">
                              {/* Quick Mark Paid / Pending */}
                              {onUpdateStatus && (
                                <Button
                                  variant="outline"
                                  size="icon"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    triggerHaptic('medium');
                                    onUpdateStatus(
                                      invoice,
                                      (invoice.status || 'pending') === 'paid' ? 'pending' : 'paid'
                                    );
                                  }}
                                  className={`h-7 w-7 rounded-lg transition-all active:scale-95 ${
                                    (invoice.status || 'pending') === 'paid'
                                      ? 'border-emerald-200 text-emerald-700 bg-emerald-50/60 hover:bg-amber-50 hover:text-amber-700 hover:border-amber-300 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-800'
                                      : 'border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 hover:text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800'
                                  }`}
                                  title={
                                    (invoice.status || 'pending') === 'paid'
                                      ? 'Click to mark Pending'
                                      : 'Click to Mark as Paid'
                                  }
                                >
                                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                                  <span className="sr-only">{(invoice.status || 'pending') === 'paid' ? 'Paid' : 'Mark Paid'}</span>
                                </Button>
                              )}

                              {/* View */}
                              <Button
                                variant="outline"
                                size="icon"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  triggerHaptic('light');
                                  if (onViewInvoice) {
                                    onViewInvoice(invoice);
                                  } else {
                                    onDownloadInvoice(invoice);
                                  }
                                }}
                                className="h-7 w-7 rounded-lg border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 transition-colors active:scale-95"
                                title="View / Preview Invoice"
                              >
                                <Eye className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                                <span className="sr-only">View</span>
                              </Button>

                              {/* Edit */}
                              <Button
                                variant="outline"
                                size="icon"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  triggerHaptic('light');
                                  onSelectInvoice(invoice);
                                }}
                                className="h-7 w-7 rounded-lg border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/40 transition-colors active:scale-95"
                                title="Edit Invoice"
                              >
                                <Pencil className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                                <span className="sr-only">Edit</span>
                              </Button>

                              {/* Delete */}
                              <Button
                                variant="outline"
                                size="icon"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  triggerHaptic('warning');
                                  setInvoiceToDelete(invoice);
                                }}
                                className="h-7 w-7 rounded-lg border-rose-200 dark:border-rose-900/60 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors active:scale-95"
                                title="Delete Invoice"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                <span className="sr-only">Delete</span>
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

      {/* Delete Confirmation Alert Dialog */}
      <AlertDialog
        open={!!invoiceToDelete}
        onOpenChange={(open) => !open && setInvoiceToDelete(null)}
      >
        <AlertDialogContent className="w-[90vw] sm:max-w-md rounded-3xl p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-lg font-black tracking-tight text-slate-900 dark:text-white">
              Delete Invoice {invoiceToDelete?.invoiceNumber}?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm font-medium text-slate-500 dark:text-slate-400">
              This action cannot be undone. This will permanently remove invoice{' '}
              <strong className="text-slate-800 dark:text-slate-200">
                {invoiceToDelete?.invoiceNumber}
              </strong>{' '}
              ({invoiceToDelete?.billToName || invoiceToDelete?.customerName || 'Customer'}) from the system.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row gap-2 mt-4 sm:justify-end">
            <AlertDialogCancel
              onClick={() => setInvoiceToDelete(null)}
              className="flex-1 sm:flex-initial h-10 rounded-xl font-bold border-slate-200 dark:border-slate-800"
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="flex-1 sm:flex-initial h-10 rounded-xl font-bold bg-rose-600 hover:bg-rose-700 text-white"
            >
              Delete Invoice
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Delete Confirmation Dialog */}
      <AlertDialog open={isBulkDeleting} onOpenChange={setIsBulkDeleting}>
        <AlertDialogContent className="rounded-2xl max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200/80 dark:border-rose-800/60 flex items-center justify-center text-rose-600 dark:text-rose-400 shrink-0">
                <Trash2 className="w-4 h-4" />
              </div>
              Delete {selectedIds.size} Invoices?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed pt-2">
              Are you sure you want to permanently delete these <strong className="text-slate-800 dark:text-slate-200">{selectedIds.size} invoices</strong>?
              This action cannot be undone and will permanently remove them from the database and offline cache.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-0 pt-2">
            <AlertDialogCancel className="h-10 rounded-xl font-semibold border-slate-200 dark:border-slate-700">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                triggerHaptic('medium');
                if (onBulkDelete) {
                  onBulkDelete(selectedInvoicesList);
                  setSelectedIds(new Set());
                }
                setIsBulkDeleting(false);
              }}
              className="flex-1 sm:flex-initial h-10 rounded-xl font-bold bg-rose-600 hover:bg-rose-700 text-white"
            >
              Delete {selectedIds.size} Invoices
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Floating Bulk Action Bar */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2.5 rounded-2xl bg-slate-900/95 dark:bg-slate-800/95 backdrop-blur-md text-white shadow-2xl border border-slate-700/60 animate-in fade-in slide-in-from-bottom-4 max-w-[95vw]">
          <div className="flex items-center gap-2 shrink-0">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs font-bold font-mono">
              {selectedIds.size} selected
            </span>
          </div>

          <div className="h-4 w-px bg-slate-700 shrink-0" />

          <Button
            size="sm"
            variant="secondary"
            disabled={isBulkDownloading}
            onClick={() => {
              triggerHaptic('medium');
              onBulkDownload?.(selectedInvoicesList);
            }}
            className="h-8 px-3 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white border-0 flex items-center gap-1.5 shadow-sm shadow-indigo-600/30"
          >
            <Download className={`w-3.5 h-3.5 ${isBulkDownloading ? 'animate-bounce' : ''}`} />
            <span>{isBulkDownloading ? 'Downloading...' : `Download (${selectedIds.size})`}</span>
          </Button>

          {onBulkUpdateStatus && (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                triggerHaptic('medium');
                onBulkUpdateStatus(selectedInvoicesList, 'paid');
                setSelectedIds(new Set());
              }}
              className="h-8 px-3 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white border-0 flex items-center gap-1.5 shadow-sm shadow-emerald-600/30"
              title="Mark all selected invoices as Paid"
            >
              <CheckCheck className="w-3.5 h-3.5" />
              <span>Mark Paid ({selectedIds.size})</span>
            </Button>
          )}

          {onBulkDelete && (
            <Button
              size="sm"
              variant="destructive"
              onClick={() => {
                triggerHaptic('medium');
                setIsBulkDeleting(true);
              }}
              className="h-8 px-3 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white border-0 flex items-center gap-1.5 shadow-sm shadow-rose-600/30"
              title="Delete all selected invoices"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete ({selectedIds.size})</span>
            </Button>
          )}

          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              triggerHaptic('light');
              exportToCSV(selectedInvoicesList, `invoices-selected-${selectedIds.size}.csv`);
            }}
            className="h-8 px-2.5 rounded-xl text-xs font-bold text-slate-300 hover:text-white hover:bg-white/10 flex items-center gap-1.5"
            title="Export selected to CSV"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
            <span className="hidden sm:inline">CSV</span>
          </Button>

          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              triggerHaptic('light');
              setSelectedIds(new Set());
            }}
            className="h-8 px-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white hover:bg-white/10"
          >
            Clear
          </Button>
        </div>
      )}
    </>
  );
}
