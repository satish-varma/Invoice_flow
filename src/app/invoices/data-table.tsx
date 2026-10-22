"use client";

import * as React from "react";
import {
  ColumnDef,
  ColumnFiltersState,
  RowSelectionState,
  SortingState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Invoice } from "@/services/invoiceService";
import {
  Download,
  Trash2,
  FileSpreadsheet,
  Eye,
  Pencil,
  Truck,
  FileText,
  Search,
  X,
  Calendar,
  Filter,
  RotateCcw,
  Paperclip,
  Tag,
  CheckCircle2,
  Clock,
  XCircle,
  ChevronDown,
  CheckCheck,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { exportToCSV } from "@/lib/export";
import { Checkbox } from "@/components/ui/checkbox";
import { format } from "date-fns";
import { triggerHaptic } from "@/lib/haptics";

const statusMap: Record<
  string,
  { label: string; class: string; dot: string }
> = {
  paid: {
    label: "Paid",
    class:
      "bg-emerald-50 text-emerald-700 border-emerald-200/80 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800/60",
    dot: "bg-emerald-500",
  },
  pending: {
    label: "Pending",
    class:
      "bg-amber-50 text-amber-700 border-amber-200/80 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800/60",
    dot: "bg-amber-500",
  },
  cancelled: {
    label: "Cancelled",
    class:
      "bg-rose-50 text-rose-700 border-rose-200/80 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-800/60",
    dot: "bg-rose-500",
  },
};

interface DataTableProps<TData extends Invoice, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  onDeleteSelected: (selectedIds: string[]) => void;
  onDownloadSelected: (selectedInvoices: TData[]) => void;
  onPreview?: (invoice: TData) => void;
  onDownloadSingle?: (invoice: TData) => void;
  onDeleteSingle?: (invoice: TData) => void;
  onEditSingle?: (invoice: TData) => void;
  onUpdateStatus?: (invoice: TData, newStatus: 'pending' | 'paid' | 'cancelled') => void;
  onBulkUpdateStatus?: (selectedIds: string[], newStatus: 'pending' | 'paid' | 'cancelled') => void;
}

export function InvoicesDataTable<TData extends Invoice, TValue>({
  columns,
  data,
  onDeleteSelected,
  onDownloadSelected,
  onPreview,
  onDownloadSingle,
  onDeleteSingle,
  onEditSingle,
  onUpdateStatus,
  onBulkUpdateStatus,
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({});
  const [mobileSelected, setMobileSelected] = React.useState<Set<string>>(new Set());

  // Filter states
  const [searchText, setSearchText] = React.useState("");
  const currentYear = React.useMemo(() => new Date().getFullYear().toString(), []);
  const MONTH_NAMES = React.useMemo(() => [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ], []);
  const currentMonthName = React.useMemo(() => MONTH_NAMES[new Date().getMonth()], [MONTH_NAMES]);
  const defaultPeriod = currentMonthName;

  const [yearFilter, setYearFilter] = React.useState<string>(currentYear);
  const [statusFilter, setStatusFilter] = React.useState<string>("all");
  const [periodFilter, setPeriodFilter] = React.useState<string>(defaultPeriod);
  const [shipToFilter, setShipToFilter] = React.useState<string>("all");
  const [typeFilter, setTypeFilter] = React.useState<string>("MRP");

  // Extract unique years
  const availableYears = React.useMemo(() => {
    const set = new Set<string>();
    set.add(currentYear);
    data.forEach((inv) => {
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
  }, [data, currentYear]);

  // Extract unique periods (Service Months) in reverse chronological order with Current Month at the top
  const availablePeriods = React.useMemo(() => {
    const currentMonthIdx = new Date().getMonth();
    const orderedMonths: string[] = [];
    for (let i = 0; i < 12; i++) {
      const idx = (currentMonthIdx - i + 12) % 12;
      orderedMonths.push(MONTH_NAMES[idx]);
    }

    const set = new Set<string>();
    data.forEach((inv) => {
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
  }, [data, MONTH_NAMES]);

  // Extract unique Ship To destinations
  const availableShipTos = React.useMemo(() => {
    const set = new Set<string>();
    data.forEach((inv) => {
      const name = inv.shipToName;
      if (name && name.trim()) {
        set.add(name.trim());
      }
    });
    return Array.from(set).sort();
  }, [data]);

  // Combined filtered data for both desktop and mobile
  const filteredData = React.useMemo(() => {
    return data.filter((inv) => {
      const query = searchText.toLowerCase().trim();
      const matchesSearch =
        !query ||
        (inv.invoiceNumber || "").toLowerCase().includes(query) ||
        (inv.invoiceType || "").toLowerCase().includes(query) ||
        (inv.billToName || inv.customerName || "").toLowerCase().includes(query) ||
        (inv.shipToName || "").toLowerCase().includes(query) ||
        (inv.period || "").toLowerCase().includes(query) ||
        (inv.eventNumber || "").toLowerCase().includes(query);

      const invoiceYear = (() => {
        if (inv.date) {
          const match = String(inv.date).match(/^(\d{4})/);
          if (match) return match[1];
          const d = new Date(inv.date);
          if (!isNaN(d.getFullYear())) return String(d.getFullYear());
        }
        if (inv.createdAt?.toDate) {
          return String(inv.createdAt.toDate().getFullYear());
        }
        return '';
      })();

      const matchesYear = yearFilter === "all" || invoiceYear === yearFilter;

      const matchesStatus =
        statusFilter === "all" || (inv.status || "pending") === statusFilter;

      const matchesPeriod =
        periodFilter === "all" ||
        (inv.period || "").trim().toLowerCase() === periodFilter.trim().toLowerCase();

      const matchesShipTo =
        shipToFilter === "all" ||
        (inv.shipToName || "").trim().toLowerCase() === shipToFilter.trim().toLowerCase();

      const matchesType =
        typeFilter === "all" || (inv.invoiceType || "NON-MRP") === typeFilter;

      return matchesSearch && matchesYear && matchesStatus && matchesPeriod && matchesShipTo && matchesType;
    });
  }, [data, searchText, yearFilter, statusFilter, periodFilter, shipToFilter, typeFilter]);

  const hasActiveFilters =
    searchText !== "" ||
    yearFilter !== currentYear ||
    periodFilter !== defaultPeriod ||
    typeFilter !== "MRP" ||
    statusFilter !== "all" ||
    shipToFilter !== "all";

  const resetFilters = () => {
    triggerHaptic("light");
    setSearchText("");
    setYearFilter(currentYear);
    setPeriodFilter(defaultPeriod);
    setTypeFilter("MRP");
    setStatusFilter("all");
    setShipToFilter("all");
  };

  const table = useReactTable({
    data: filteredData,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    onSortingChange: setSorting,
    getSortedRowModel: getSortedRowModel(),
    onColumnFiltersChange: setColumnFilters,
    getFilteredRowModel: getFilteredRowModel(),
    onRowSelectionChange: setRowSelection,
    state: {
      sorting,
      columnFilters,
      rowSelection,
    },
  });

  const handleDelete = () => {
    const selectedIds = table
      .getSelectedRowModel()
      .rows.map((row) => (row.original as Invoice).id!);
    onDeleteSelected(selectedIds);
  };

  const handleDownload = () => {
    const selectedInvoices = table.getSelectedRowModel().rows.map((row) => row.original);
    onDownloadSelected(selectedInvoices);
  };

  const toggleMobileSelect = (id: string) => {
    setMobileSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const formatDate = (dateStr: string) => {
    try {
      return format(new Date(dateStr), "dd MMM yyyy");
    } catch {
      return dateStr;
    }
  };

  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount || 0);
  };

  return (
    <div className="space-y-4">
      {/* ── Filters & Bulk Actions ─────────────────────────────── */}
      <div className="flex flex-col gap-3 p-4 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-sm">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Search invoice #, customer, ship to, event #..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              className="h-10 pl-10 pr-9 rounded-xl border-slate-200/80 dark:border-slate-800 text-xs sm:text-sm bg-slate-50/50 dark:bg-slate-800/40"
            />
            {searchText && (
              <button
                type="button"
                onClick={() => {
                  triggerHaptic("light");
                  setSearchText("");
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Status Filter */}
          <div className="w-full sm:w-40">
            <Select
              value={statusFilter}
              onValueChange={(v) => {
                triggerHaptic("light");
                setStatusFilter(v);
              }}
            >
              <SelectTrigger className="h-10 text-xs rounded-xl border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 text-slate-700 dark:text-slate-200">
                <Filter className="h-3.5 w-3.5 mr-1 text-slate-400 shrink-0" />
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent className="dark:bg-slate-800 dark:border-slate-700">
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Year Filter */}
          <div className="w-full sm:w-36">
            <Select
              value={yearFilter}
              onValueChange={(v) => {
                triggerHaptic("light");
                setYearFilter(v);
              }}
            >
              <SelectTrigger className="h-10 text-xs rounded-xl border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 text-slate-700 dark:text-slate-200 font-medium">
                <Calendar className="h-3.5 w-3.5 mr-1 text-slate-400 shrink-0" />
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
          </div>

          {/* Service Month Filter */}
          <div className="w-full sm:w-44">
            <Select
              value={periodFilter}
              onValueChange={(v) => {
                triggerHaptic("light");
                setPeriodFilter(v);
              }}
            >
              <SelectTrigger className="h-10 text-xs rounded-xl border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 text-slate-700 dark:text-slate-200">
                <Calendar className="h-3.5 w-3.5 mr-1 text-slate-400 shrink-0" />
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
          </div>

          {/* Invoice Type Filter (MRP / NON-MRP) */}
          <div className="w-full sm:w-40">
            <Select
              value={typeFilter}
              onValueChange={(v) => {
                triggerHaptic("light");
                setTypeFilter(v);
              }}
            >
              <SelectTrigger className="h-10 text-xs rounded-xl border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 text-slate-700 dark:text-slate-200 font-medium">
                <Tag className="h-3.5 w-3.5 mr-1 text-slate-400 shrink-0" />
                <SelectValue placeholder="Invoice Type" />
              </SelectTrigger>
              <SelectContent className="dark:bg-slate-800 dark:border-slate-700">
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="MRP">MRP (With GST)</SelectItem>
                <SelectItem value="NON-MRP">NON-MRP</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Ship To Filter */}
          <div className="w-full sm:w-44">
            <Select
              value={shipToFilter}
              onValueChange={(v) => {
                triggerHaptic("light");
                setShipToFilter(v);
              }}
            >
              <SelectTrigger className="h-10 text-xs rounded-xl border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 text-slate-700 dark:text-slate-200 font-medium">
                <Truck className="h-3.5 w-3.5 mr-1 text-slate-400 shrink-0" />
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

          {/* Action buttons: Reset & CSV */}
          <div className="flex items-center gap-2">
            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={resetFilters}
                className="h-10 px-2.5 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300"
              >
                <RotateCcw className="w-3.5 h-3.5 mr-1" />
                Reset
              </Button>
            )}

            <Button
              variant="outline"
              onClick={() => {
                triggerHaptic("light");
                exportToCSV(
                  table.getSelectedRowModel().rows.length > 0
                    ? table.getSelectedRowModel().rows.map((r) => r.original)
                    : filteredData,
                  `invoices-export-${new Date().toISOString().split("T")[0]}.csv`
                );
              }}
              className="h-10 rounded-xl font-bold text-xs border-slate-200 dark:border-slate-800 active:scale-95 transition-all shrink-0"
            >
              <FileSpreadsheet className="mr-1.5 h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
              Export CSV
            </Button>
          </div>
        </div>

        {/* Selected row counter & bulk actions */}
        {table.getSelectedRowModel().rows.length > 0 && (
          <div className="hidden sm:flex items-center justify-between p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/80 dark:border-emerald-800">
            <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300">
              {table.getSelectedRowModel().rows.length} invoice(s) selected
            </span>
            <div className="flex items-center gap-2">
              {onBulkUpdateStatus && (
                <Button
                  size="sm"
                  onClick={() => {
                    triggerHaptic("medium");
                    const selectedIds = table
                      .getSelectedRowModel()
                      .rows.map((r) => r.original.id!)
                      .filter(Boolean);
                    onBulkUpdateStatus(selectedIds, 'paid');
                    table.resetRowSelection();
                  }}
                  className="h-8 rounded-lg font-bold text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                  title="Mark all selected invoices as Paid"
                >
                  <CheckCheck className="mr-1.5 h-3.5 w-3.5" />
                  Mark Paid ({table.getSelectedRowModel().rows.length})
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownload}
                className="h-8 rounded-lg font-bold text-xs"
              >
                <Download className="mr-1.5 h-3.5 w-3.5" />
                Download ({table.getSelectedRowModel().rows.length})
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleDelete}
                className="h-8 rounded-lg font-bold text-xs bg-rose-600 hover:bg-rose-700"
              >
                <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                Delete ({table.getSelectedRowModel().rows.length})
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Mobile Bulk Selection Bar */}
      {mobileSelected.size > 0 && (
        <div className="md:hidden flex items-center justify-between p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200/80 dark:border-emerald-800 shadow-sm animate-in fade-in slide-in-from-top-2">
          <span className="text-xs font-black text-emerald-800 dark:text-emerald-300">
            {mobileSelected.size} selected
          </span>
          <div className="flex gap-2">
            {onBulkUpdateStatus && (
              <Button
                size="sm"
                className="h-9 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white active:scale-95"
                onClick={() => {
                  triggerHaptic("medium");
                  onBulkUpdateStatus(Array.from(mobileSelected), 'paid');
                  setMobileSelected(new Set());
                }}
                title="Mark selected invoices as Paid"
              >
                <CheckCheck className="h-3.5 w-3.5 mr-1" /> Paid
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              className="h-9 rounded-xl text-xs font-bold border-emerald-300 dark:border-emerald-700 active:scale-95"
              onClick={() => {
                triggerHaptic("light");
                const selected = data.filter((d) => mobileSelected.has(d.id!));
                onDownloadSelected(selected);
              }}
            >
              <Download className="h-3.5 w-3.5 mr-1" /> Download
            </Button>
            <Button
              size="sm"
              variant="destructive"
              className="h-9 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 active:scale-95"
              onClick={() => {
                triggerHaptic("medium");
                onDeleteSelected(Array.from(mobileSelected));
                setMobileSelected(new Set());
              }}
            >
              <Trash2 className="h-3.5 w-3.5 mr-1" /> Delete
            </Button>
          </div>
        </div>
      )}

      {/* ── MOBILE SQUIRCLE CARD LIST ──────────────────────────────────── */}
      <div className="md:hidden space-y-3">
        {filteredData.length === 0 ? (
          <div className="text-center text-slate-500 dark:text-slate-400 py-12 rounded-3xl border border-dashed border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60">
            <FileText className="h-10 w-10 mx-auto mb-2 opacity-30 text-emerald-500" />
            <p className="font-bold text-sm">No invoices found</p>
            <p className="text-xs text-slate-400 mt-1">
              Try adjusting your search query, status, or service month
            </p>
          </div>
        ) : (
          filteredData.map((invoice) => {
            const id = invoice.id!;
            const isSelected = mobileSelected.has(id);
            return (
              <div
                key={id}
                data-card="true"
                className={`rounded-2xl border transition-all duration-150 p-4 space-y-3 theme-card ${
                  isSelected
                    ? "border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20 shadow-md ring-2 ring-emerald-500/20"
                    : "border-slate-200/80 dark:border-slate-800/80 shadow-[0_4px_16px_-4px_rgba(0,0,0,0.06)]"
                }`}
              >
                {/* Top row: Checkbox + Invoice # + Amount */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3 min-w-0">
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => {
                        triggerHaptic("light");
                        toggleMobileSelect(id);
                      }}
                      aria-label="Select invoice"
                      className="mt-0.5 rounded-lg h-5 w-5"
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <p className="font-mono font-black text-sm text-indigo-600 dark:text-indigo-400 truncate">
                          {invoice.invoiceNumber || "No Number"}
                        </p>
                        <span
                          className={`inline-flex items-center font-mono font-bold text-[10px] px-1.5 py-0.5 rounded border ${
                            (invoice.invoiceType || "NON-MRP") === "MRP"
                              ? "text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200/80 dark:border-emerald-800/80"
                              : "text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/60 border-purple-200/80 dark:border-purple-800/80"
                          }`}
                        >
                          {invoice.invoiceType || "NON-MRP"}
                        </span>
                        {(() => {
                          const status = invoice.status || "pending";
                          const badgeStyle = statusMap[status] || statusMap.pending;

                          if (!onUpdateStatus) {
                            return (
                              <span
                                className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${badgeStyle.class}`}
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
                                  className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border cursor-pointer hover:shadow-sm active:scale-95 transition-all ${badgeStyle.class}`}
                                >
                                  <span className={`w-1.5 h-1.5 rounded-full ${badgeStyle.dot}`} />
                                  <span>{badgeStyle.label}</span>
                                  <ChevronDown className="w-2 h-2 opacity-60 ml-0.5" />
                                </button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent
                                align="start"
                                className="w-40 p-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl rounded-xl z-50"
                              >
                                <DropdownMenuItem
                                  disabled={status === "paid"}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    triggerHaptic("light");
                                    onUpdateStatus(invoice, "paid");
                                  }}
                                  className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 focus:bg-emerald-50 dark:focus:bg-emerald-950/50 cursor-pointer rounded-lg py-1.5"
                                >
                                  <CheckCircle2 className="w-3.5 h-3.5 mr-2 text-emerald-600" />
                                  Mark as Paid
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  disabled={status === "pending"}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    triggerHaptic("light");
                                    onUpdateStatus(invoice, "pending");
                                  }}
                                  className="text-xs font-semibold text-amber-700 dark:text-amber-400 focus:bg-amber-50 dark:focus:bg-amber-950/50 cursor-pointer rounded-lg py-1.5"
                                >
                                  <Clock className="w-3.5 h-3.5 mr-2 text-amber-600" />
                                  Mark as Pending
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  disabled={status === "cancelled"}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    triggerHaptic("light");
                                    onUpdateStatus(invoice, "cancelled");
                                  }}
                                  className="text-xs font-semibold text-slate-700 dark:text-slate-300 focus:bg-slate-50 dark:focus:bg-slate-800 cursor-pointer rounded-lg py-1.5"
                                >
                                  <XCircle className="w-3.5 h-3.5 mr-2 text-slate-500" />
                                  Mark as Cancelled
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          );
                        })()}
                      </div>
                      <p className="text-xs font-semibold text-slate-700 dark:text-slate-200 truncate mt-0.5">
                        {invoice.billToName || invoice.customerName || "—"}
                      </p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-mono font-black text-base text-slate-900 dark:text-white">
                      ₹{formatAmount(invoice.total)}
                    </p>
                    <p className="text-[11px] font-medium text-slate-400 dark:text-slate-500 mt-0.5 flex items-center justify-end gap-1">
                      <Calendar className="h-3 w-3" />
                      {formatDate(invoice.date)}
                    </p>
                  </div>
                </div>

                {/* Ship To & Service Month Row */}
                <div className="flex items-center justify-between text-[11px] gap-2 pt-1 border-t border-slate-100 dark:border-slate-800/80">
                  <div className="flex items-center gap-1.5 min-w-0 text-slate-500 dark:text-slate-400 truncate">
                    <Truck className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="truncate">
                      <span className="font-medium text-slate-400">Ship: </span>
                      {invoice.shipToName ? (
                        <span title={invoice.shipToName} className="font-semibold text-slate-700 dark:text-slate-200">
                          {invoice.shipToName.trim().split(/\s+/)[0]}
                        </span>
                      ) : (
                        "—"
                      )}
                    </span>
                  </div>
                  {invoice.period ? (
                    <span className="inline-flex items-center gap-1 font-semibold text-indigo-700 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200/60 dark:border-indigo-800/60 px-2 py-0.5 rounded-md shrink-0">
                      <Calendar className="w-3 h-3 text-indigo-500" />
                      {invoice.period}
                    </span>
                  ) : (
                    <span className="text-slate-400 text-[10px]">—</span>
                  )}
                </div>

                {/* Event # & Attached PO Attachment */}
                <div className="flex items-center justify-between text-[11px] gap-2 pt-1 border-t border-slate-100 dark:border-slate-800/80">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-slate-400 dark:text-slate-500 font-medium">Event #:</span>
                    <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                      {invoice.eventNumber || "—"}
                    </span>
                  </div>
                  {invoice.poFileUrl && (
                    <a
                      href={invoice.poFileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="inline-flex items-center gap-1 text-[10px] font-black text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 px-2 py-0.5 rounded-md border border-indigo-200/60 dark:border-indigo-800/60 shrink-0"
                      title={invoice.poFileName || "Purchase Order"}
                    >
                      <Paperclip className="w-3 h-3" />
                      Attached PO
                    </a>
                  )}
                </div>

                {/* Action buttons: Paid (if pending), View, Edit, Delete */}
                <div
                  className={`grid ${
                    onUpdateStatus && invoice.status !== "paid" ? "grid-cols-4" : "grid-cols-3"
                  } gap-2 pt-2 border-t border-slate-100 dark:border-slate-800`}
                >
                  {onUpdateStatus && invoice.status !== "paid" && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-9 rounded-xl text-xs font-bold active:scale-95 transition-all bg-emerald-50/60 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100"
                      onClick={() => {
                        triggerHaptic("medium");
                        onUpdateStatus(invoice, "paid");
                      }}
                    >
                      <CheckCircle2 className="h-3.5 w-3.5 mr-1 text-emerald-600 dark:text-emerald-400" /> Paid
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-9 rounded-xl text-xs font-bold active:scale-95 transition-all border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200"
                    onClick={() => {
                      triggerHaptic("light");
                      onPreview?.(invoice);
                    }}
                  >
                    <Eye className="h-3.5 w-3.5 mr-1 text-indigo-600 dark:text-indigo-400" /> View
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-9 rounded-xl text-xs font-bold active:scale-95 transition-all border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/30"
                    onClick={() => {
                      triggerHaptic("light");
                      onEditSingle?.(invoice);
                    }}
                  >
                    <Pencil className="h-3.5 w-3.5 mr-1 text-amber-600 dark:text-amber-400" /> Edit
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-9 rounded-xl text-xs font-bold active:scale-95 transition-all text-rose-600 dark:text-rose-400 border-rose-200/60 dark:border-rose-900/40 hover:bg-rose-50 dark:hover:bg-rose-950/20"
                    onClick={() => {
                      triggerHaptic("medium");
                      onDeleteSingle?.(invoice);
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5 mr-1" /> Delete
                  </Button>
                </div>
              </div>
            );
          })
        )}

        {/* Mobile count hint */}
        {filteredData.length > 0 && (
          <p className="text-xs text-center font-medium text-slate-400 pb-2">
            Showing {filteredData.length} of {data.length} invoices
          </p>
        )}
      </div>

      {/* ── DESKTOP TABLE ─────────────────────────────────────── */}
      <div className="hidden md:block">
        <div data-card="true" className="rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-sm overflow-hidden theme-card">
          <Table className="w-full text-xs [&_th]:px-2.5 [&_th]:py-2.5 [&_td]:px-2.5 [&_td]:py-2">
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow
                  key={headerGroup.id}
                  className="hover:bg-transparent bg-slate-50/70 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800"
                >
                  {headerGroup.headers.map((header) => {
                    return (
                      <TableHead key={header.id}>
                        {header.isPlaceholder
                          ? null
                          : flexRender(
                              header.column.columnDef.header,
                              header.getContext()
                            )}
                      </TableHead>
                    );
                  })}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows?.length ? (
                table.getRowModel().rows.map((row) => (
                  <TableRow
                    key={row.id}
                    data-state={row.getIsSelected() && "selected"}
                    className="transition-colors hover:bg-indigo-50/20 dark:hover:bg-slate-800/40 border-b border-slate-100 dark:border-slate-800"
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={columns.length}
                    className="h-28 text-center text-slate-500 font-medium"
                  >
                    No invoices match the selected filters.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {/* Desktop Pagination */}
        <div className="flex items-center justify-between py-4">
          <p className="text-xs text-slate-500 font-medium">
            Showing {table.getRowModel().rows.length} of {filteredData.length} filtered (Total: {data.length})
          </p>
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              className="h-8 rounded-xl text-xs font-bold"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-8 rounded-xl text-xs font-bold"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
            >
              Next
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
