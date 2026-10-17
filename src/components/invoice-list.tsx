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
} from 'lucide-react';
import { Input } from '@/components/ui/input';
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

interface InvoiceListProps {
  invoices: Invoice[];
  onSelectInvoice: (invoice: Invoice) => void;
  onDownloadInvoice: (invoice: Invoice) => void;
  onViewInvoice?: (invoice: Invoice) => void;
  onDeleteInvoice?: (invoice: Invoice) => void;
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

export function InvoiceList({
  invoices,
  onSelectInvoice,
  onDownloadInvoice,
  onViewInvoice,
  onDeleteInvoice,
}: InvoiceListProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'paid' | 'cancelled'>('all');
  const [periodFilter, setPeriodFilter] = useState<string>('all');
  const [customerFilter, setCustomerFilter] = useState<string>('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [invoiceToDelete, setInvoiceToDelete] = useState<Invoice | null>(null);

  // Extract unique periods (Service Months)
  const availablePeriods = useMemo(() => {
    const set = new Set<string>();
    invoices.forEach((inv) => {
      if (inv.period && inv.period.trim()) {
        set.add(inv.period.trim());
      }
    });
    return Array.from(set).sort();
  }, [invoices]);

  // Extract unique customers
  const availableCustomers = useMemo(() => {
    const set = new Set<string>();
    invoices.forEach((inv) => {
      const name = inv.billToName || inv.customerName;
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
    statusFilter !== 'all' ||
    periodFilter !== 'all' ||
    customerFilter !== 'all';

  const resetFilters = () => {
    triggerHaptic('light');
    setSearchTerm('');
    setStatusFilter('all');
    setPeriodFilter('all');
    setCustomerFilter('all');
  };

  const filteredInvoices = useMemo(() => {
    return invoices.filter((invoice) => {
      const query = searchTerm.toLowerCase().trim();
      const matchesSearch =
        !query ||
        invoice.invoiceNumber.toLowerCase().includes(query) ||
        (invoice.billToName || invoice.customerName || '').toLowerCase().includes(query) ||
        (invoice.shipToName || '').toLowerCase().includes(query) ||
        (invoice.period || '').toLowerCase().includes(query) ||
        (invoice.eventNumber || '').toLowerCase().includes(query);

      const matchesStatus =
        statusFilter === 'all' || (invoice.status || 'pending') === statusFilter;

      const matchesPeriod =
        periodFilter === 'all' || (invoice.period || '') === periodFilter;

      const matchesCustomer =
        customerFilter === 'all' ||
        (invoice.billToName || invoice.customerName || '') === customerFilter;

      return matchesSearch && matchesStatus && matchesPeriod && matchesCustomer;
    });
  }, [invoices, searchTerm, statusFilter, periodFilter, customerFilter]);

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
              </div>
            </div>

            {/* Filter Controls Toolbar */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 pt-1">
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
                      {period}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Customer Filter */}
              <Select
                value={customerFilter}
                onValueChange={(v: string) => {
                  triggerHaptic('light');
                  setCustomerFilter(v);
                }}
              >
                <SelectTrigger className="h-9 text-xs rounded-xl border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200">
                  <Building2 className="h-3 w-3 mr-1 text-slate-400 shrink-0" />
                  <SelectValue placeholder="Customer" />
                </SelectTrigger>
                <SelectContent className="dark:bg-slate-800 dark:border-slate-700 max-h-56">
                  <SelectItem value="all">All Customers</SelectItem>
                  {availableCustomers.map((cust) => (
                    <SelectItem key={cust} value={cust}>
                      {cust}
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
                      {/* Top Row: Invoice # + Status Badge */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="font-mono font-bold text-sm text-[#3b2fc9] dark:text-indigo-400 truncate">
                            {invoice.invoiceNumber}
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

                        <span
                          className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full border ${badgeStyle.class}`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${badgeStyle.dot}`} />
                          {badgeStyle.label}
                        </span>
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
                            {invoice.shipToName || 'Same as Customer'}
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

                        {/* 3 Explicit Action Buttons */}
                        <div className="flex items-center gap-1.5 shrink-0">
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
              <div className="hidden md:block overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent bg-slate-50/70 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800">
                      <TableHead className="w-[130px] text-xs font-bold text-slate-600 dark:text-slate-300">
                        Invoice #
                      </TableHead>
                      <TableHead className="w-[115px] text-xs font-bold text-slate-600 dark:text-slate-300">
                        Event #
                      </TableHead>
                      <TableHead className="text-xs font-bold text-slate-600 dark:text-slate-300">
                        Customer
                      </TableHead>
                      <TableHead className="text-xs font-bold text-slate-600 dark:text-slate-300">
                        Ship To
                      </TableHead>
                      <TableHead className="w-[125px] text-xs font-bold text-slate-600 dark:text-slate-300">
                        Service Month
                      </TableHead>
                      <TableHead className="w-[110px] text-xs font-bold text-slate-600 dark:text-slate-300">
                        Date
                      </TableHead>
                      <TableHead className="w-[100px] text-xs font-bold text-slate-600 dark:text-slate-300">
                        Status
                      </TableHead>
                      <TableHead className="text-right text-xs font-bold text-slate-600 dark:text-slate-300">
                        Amount
                      </TableHead>
                      <TableHead className="text-center w-[170px] text-xs font-bold text-slate-600 dark:text-slate-300">
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

                          {/* Customer */}
                          <TableCell className="max-w-[200px] truncate font-medium text-slate-800 dark:text-slate-200 text-sm">
                            {invoice.billToName || invoice.customerName || '—'}
                          </TableCell>

                          {/* Ship To */}
                          <TableCell className="max-w-[180px] truncate text-xs text-slate-600 dark:text-slate-300 font-medium">
                            {invoice.shipToName ? (
                              <span title={invoice.shipToName}>{invoice.shipToName}</span>
                            ) : (
                              <span className="text-slate-400 italic">Same as Bill To</span>
                            )}
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
                            <span
                              className={`inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${badgeStyle.class}`}
                            >
                              <span className={`w-1.5 h-1.5 rounded-full ${badgeStyle.dot}`} />
                              {badgeStyle.label}
                            </span>
                          </TableCell>

                          {/* Amount */}
                          <TableCell className="text-right font-mono font-black text-sm text-slate-900 dark:text-white tabular-nums whitespace-nowrap">
                            ₹{(Number(invoice.total) || 0).toLocaleString('en-IN', {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </TableCell>

                          {/* Actions: View, Edit, Delete */}
                          <TableCell className="text-center whitespace-nowrap">
                            <div className="inline-flex items-center gap-1 justify-center">
                              {/* View */}
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
                                className="h-8 px-2.5 rounded-xl border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 transition-colors"
                                title="View / Preview Invoice"
                              >
                                <Eye className="w-3.5 h-3.5 mr-1 text-indigo-600 dark:text-indigo-400" />
                                <span>View</span>
                              </Button>

                              {/* Edit */}
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  triggerHaptic('light');
                                  onSelectInvoice(invoice);
                                }}
                                className="h-8 px-2.5 rounded-xl border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/40 transition-colors"
                                title="Edit Invoice"
                              >
                                <Pencil className="w-3.5 h-3.5 mr-1 text-amber-600 dark:text-amber-400" />
                                <span>Edit</span>
                              </Button>

                              {/* Delete */}
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  triggerHaptic('warning');
                                  setInvoiceToDelete(invoice);
                                }}
                                className="h-8 px-2 rounded-xl border-rose-200 dark:border-rose-900/60 text-xs font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                                title="Delete Invoice"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
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
    </>
  );
}
