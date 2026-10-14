"use client";

import React, { useState } from 'react';
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
  ExternalLink,
  ChevronRight,
  FileText,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { exportToCSV } from '@/lib/export';
import { triggerHaptic } from '@/lib/haptics';

interface InvoiceListProps {
  invoices: Invoice[];
  onSelectInvoice: (invoice: Invoice) => void;
  onDownloadInvoice: (invoice: Invoice) => void;
}

const statusMap: Record<
  string,
  { label: string; class: string; dot: string }
> = {
  paid: {
    label: 'Paid',
    class: 'bg-emerald-50 text-emerald-700 border-emerald-200/80',
    dot: 'bg-emerald-500',
  },
  pending: {
    label: 'Pending',
    class: 'bg-amber-50 text-amber-700 border-amber-200/80',
    dot: 'bg-amber-500',
  },
  cancelled: {
    label: 'Cancelled',
    class: 'bg-rose-50 text-rose-700 border-rose-200/80',
    dot: 'bg-rose-500',
  },
};

export function InvoiceList({
  invoices,
  onSelectInvoice,
  onDownloadInvoice,
}: InvoiceListProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<
    'all' | 'pending' | 'paid' | 'cancelled'
  >('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleDownloadClick = (e: React.MouseEvent, invoice: Invoice) => {
    e.stopPropagation();
    triggerHaptic('medium');
    onDownloadInvoice(invoice);
  };

  const handleCopyInvoiceNumber = (e: React.MouseEvent, num: string) => {
    e.stopPropagation();
    triggerHaptic('light');
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(num);
      setCopiedId(num);
      setTimeout(() => setCopiedId(null), 1800);
    }
  };

  const filteredInvoices = invoices.filter((invoice) => {
    const matchesSearch =
      invoice.invoiceNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (invoice.billToName || invoice.customerName || '')
        .toLowerCase()
        .includes(searchTerm.toLowerCase());
    const matchesStatus =
      statusFilter === 'all' || (invoice.status || 'pending') === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <Card className="rounded-2xl border border-gray-200/80 shadow-sm overflow-hidden bg-white">
      <CardHeader className="p-4 sm:p-5 border-b border-gray-100 bg-gray-50/50">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
          <div>
            <div className="flex items-center gap-2">
              <CardTitle className="text-base sm:text-lg font-black text-gray-900 tracking-tight">
                Recent Invoices
              </CardTitle>
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200/60 font-mono">
                {filteredInvoices.length}
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-0.5">
              Click any invoice to edit, view, or download PDF
            </p>
          </div>

          <div className="flex flex-wrap w-full md:w-auto items-center gap-2">
            <div className="relative flex-1 md:w-56">
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-gray-400" />
              <Input
                placeholder="Search invoice or client..."
                className="pl-8 h-9 text-xs rounded-xl border-gray-200 bg-white"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <Select
              value={statusFilter}
              onValueChange={(v: any) => {
                triggerHaptic('light');
                setStatusFilter(v);
              }}
            >
              <SelectTrigger className="w-[110px] sm:w-[125px] h-9 text-xs rounded-xl border-gray-200 bg-white">
                <Filter className="h-3 w-3 mr-1 text-gray-400" />
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>

            <Button
              variant="outline"
              size="sm"
              className="h-9 px-3 rounded-xl border-gray-200 text-xs font-bold text-gray-700 hover:bg-gray-100 shrink-0"
              onClick={() => {
                triggerHaptic('light');
                exportToCSV(filteredInvoices, 'invoices-export.csv');
              }}
              title="Export filtered invoices to CSV"
            >
              <FileSpreadsheet className="h-3.5 w-3.5 mr-1.5 text-emerald-600" />
              CSV
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        {filteredInvoices.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-center">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-3">
              <FileText className="w-6 h-6" />
            </div>
            <p className="text-sm font-bold text-gray-800">No invoices found</p>
            <p className="text-xs text-gray-400 mt-1">
              Try adjusting your search query or status filter.
            </p>
          </div>
        ) : (
          <>
            {/* ── MOBILE TOUCH-FIRST CARD VIEW (md:hidden) ── */}
            <div className="md:hidden divide-y divide-gray-100">
              {filteredInvoices.map((invoice) => {
                const status = invoice.status || 'pending';
                const badgeStyle = statusMap[status] || statusMap.pending;

                return (
                  <div
                    key={invoice.id}
                    onClick={() => {
                      triggerHaptic('light');
                      onSelectInvoice(invoice);
                    }}
                    className="p-4 active:bg-gray-50 transition-colors space-y-2.5 cursor-pointer"
                  >
                    {/* Top Row: Invoice # + Status Badge */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="font-mono font-bold text-sm text-[#3b2fc9] truncate">
                          {invoice.invoiceNumber}
                        </span>
                        <button
                          type="button"
                          onClick={(e) => handleCopyInvoiceNumber(e, invoice.invoiceNumber)}
                          className="p-1 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
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

                    {/* Middle: Customer + Date */}
                    <div className="flex items-center justify-between text-xs text-gray-600 gap-2">
                      <div className="flex items-center gap-1.5 truncate">
                        <Building2 className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                        <span className="font-semibold text-gray-800 truncate">
                          {invoice.billToName || invoice.customerName || 'General Customer'}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 text-gray-400 shrink-0 font-medium text-[11px]">
                        <Calendar className="w-3 h-3" />
                        <span>
                          {invoice.date
                            ? format(new Date(invoice.date), 'dd MMM yyyy')
                            : '—'}
                        </span>
                      </div>
                    </div>

                    {/* Bottom Row: Amount + Action Buttons */}
                    <div className="flex items-center justify-between pt-1 border-t border-gray-50 gap-2">
                      <div>
                        <span className="text-[10px] text-gray-400 uppercase font-bold tracking-wider block">
                          Total Amount
                        </span>
                        <p className="text-base font-black text-gray-900 font-mono tabular-nums leading-tight">
                          ₹{(Number(invoice.total) || 0).toLocaleString('en-IN', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </p>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => handleDownloadClick(e, invoice)}
                          className="h-8 px-2.5 rounded-lg border-gray-200 text-xs font-bold text-gray-700 hover:bg-gray-100 flex items-center gap-1 shadow-2xs"
                        >
                          <Download className="w-3.5 h-3.5 text-indigo-600" />
                          <span>PDF</span>
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 px-2 text-xs font-semibold text-indigo-600 hover:bg-indigo-50 flex items-center gap-0.5"
                        >
                          <span>Edit</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* ── DESKTOP DATA TABLE (hidden md:block) ── */}
            <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent bg-gray-50/70 border-b border-gray-100">
                    <TableHead className="w-[140px] text-xs font-bold text-gray-600">
                      Invoice #
                    </TableHead>
                    <TableHead className="text-xs font-bold text-gray-600">
                      Customer
                    </TableHead>
                    <TableHead className="w-[120px] text-xs font-bold text-gray-600">
                      Date
                    </TableHead>
                    <TableHead className="w-[110px] text-xs font-bold text-gray-600">
                      Status
                    </TableHead>
                    <TableHead className="text-right text-xs font-bold text-gray-600">
                      Amount
                    </TableHead>
                    <TableHead className="text-right w-[100px] text-xs font-bold text-gray-600">
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
                        onClick={() => {
                          triggerHaptic('light');
                          onSelectInvoice(invoice);
                        }}
                        className="cursor-pointer transition-colors hover:bg-indigo-50/30 group border-b border-gray-100"
                      >
                        <TableCell className="font-mono font-bold text-sm text-[#3b2fc9] group-hover:underline">
                          {invoice.invoiceNumber}
                        </TableCell>
                        <TableCell className="max-w-[220px] truncate font-medium text-gray-800 text-sm">
                          {invoice.billToName || invoice.customerName || '—'}
                        </TableCell>
                        <TableCell className="text-xs text-gray-500 font-medium">
                          {invoice.date
                            ? format(new Date(invoice.date), 'dd MMM yyyy')
                            : '—'}
                        </TableCell>
                        <TableCell>
                          <span
                            className={`inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${badgeStyle.class}`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${badgeStyle.dot}`} />
                            {badgeStyle.label}
                          </span>
                        </TableCell>
                        <TableCell className="text-right font-mono font-black text-sm text-gray-900 tabular-nums">
                          ₹{(Number(invoice.total) || 0).toLocaleString('en-IN', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => handleDownloadClick(e, invoice)}
                            className="h-8 w-8 rounded-lg text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                            title="Download PDF"
                          >
                            <Download className="h-4 w-4" />
                          </Button>
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
  );
}
