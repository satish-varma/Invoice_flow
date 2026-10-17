
"use client"

import * as React from "react"
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
} from "@tanstack/react-table"

import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Invoice } from "@/services/invoiceService"
import { Download, Trash2, FileSpreadsheet, Eye, Copy, FileText, Search, X, Calendar } from "lucide-react"
import { exportToCSV } from "@/lib/export"
import { Checkbox } from "@/components/ui/checkbox"
import { format } from "date-fns"
import { Badge } from "@/components/ui/badge"
import { triggerHaptic } from "@/lib/haptics"


interface DataTableProps<TData extends Invoice, TValue> {
    columns: ColumnDef<TData, TValue>[]
    data: TData[],
    onDeleteSelected: (selectedIds: string[]) => void;
    onDownloadSelected: (selectedInvoices: TData[]) => void;
    onPreview?: (invoice: TData) => void;
    onDownloadSingle?: (invoice: TData) => void;
    onDeleteSingle?: (invoice: TData) => void;
}

export function InvoicesDataTable<TData extends Invoice, TValue>({
    columns,
    data,
    onDeleteSelected,
    onDownloadSelected,
    onPreview,
    onDownloadSingle,
    onDeleteSingle,
}: DataTableProps<TData, TValue>) {
    const [sorting, setSorting] = React.useState<SortingState>([])
    const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(
        []
    )
    const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({})
    const [mobileSelected, setMobileSelected] = React.useState<Set<string>>(new Set())
    const [searchText, setSearchText] = React.useState("")

    const table = useReactTable({
        data,
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
    })

    const handleDelete = () => {
        const selectedIds = table.getSelectedRowModel().rows.map(row => (row.original as Invoice).id!);
        onDeleteSelected(selectedIds);
    };

    const handleDownload = () => {
        const selectedInvoices = table.getSelectedRowModel().rows.map(row => row.original);
        onDownloadSelected(selectedInvoices);
    };

    // Mobile filtered data
    const filteredData = React.useMemo(() => {
        if (!searchText.trim()) return data;
        const lower = searchText.toLowerCase();
        return data.filter(inv =>
            (inv.invoiceNumber || '').toLowerCase().includes(lower) ||
            (inv.billToName || inv.customerName || '').toLowerCase().includes(lower)
        );
    }, [data, searchText]);

    const toggleMobileSelect = (id: string) => {
        setMobileSelected(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
    };

    const formatDate = (dateStr: string) => {
        try { return format(new Date(dateStr), 'dd MMM yyyy'); } catch { return dateStr; }
    };

    const formatAmount = (amount: number) => {
        return new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount || 0);
    };

    return (
        <div className="space-y-4">
            {/* ── Filters & Bulk Actions ─────────────────────────────── */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="flex flex-col sm:flex-row items-center gap-2 w-full sm:w-auto">
                    {/* Mobile 48px Search */}
                    <div className="relative w-full md:hidden">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <Input
                            placeholder="Search customer or invoice #..."
                            value={searchText}
                            onChange={(event) => {
                                setSearchText(event.target.value);
                                table.getColumn("billToName")?.setFilterValue(event.target.value);
                                table.getColumn("invoiceNumber")?.setFilterValue(event.target.value);
                            }}
                            className="h-12 pl-10 pr-10 rounded-2xl border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 text-sm font-medium shadow-xs focus-visible:ring-emerald-500"
                        />
                        {searchText && (
                            <button
                                onClick={() => {
                                    triggerHaptic('light');
                                    setSearchText('');
                                    table.getColumn("billToName")?.setFilterValue('');
                                    table.getColumn("invoiceNumber")?.setFilterValue('');
                                }}
                                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        )}
                    </div>

                    {/* Desktop filters */}
                    <Input
                        placeholder="Filter by customer..."
                        value={(table.getColumn("billToName")?.getFilterValue() as string) ?? ""}
                        onChange={(event) =>
                            table.getColumn("billToName")?.setFilterValue(event.target.value)
                        }
                        className="hidden md:block w-full sm:w-64 h-10 rounded-xl"
                    />
                    <Input
                        placeholder="Filter by invoice #..."
                        value={(table.getColumn("invoiceNumber")?.getFilterValue() as string) ?? ""}
                        onChange={(event) =>
                            table.getColumn("invoiceNumber")?.setFilterValue(event.target.value)
                        }
                        className="hidden md:block w-full sm:w-48 h-10 rounded-xl"
                    />
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto flex-wrap">
                    <Button 
                        variant="outline" 
                        onClick={() => {
                            triggerHaptic('light');
                            exportToCSV(table.getSelectedRowModel().rows.length > 0 ? table.getSelectedRowModel().rows.map(r => r.original) : data, `invoices-export-${new Date().toISOString().split('T')[0]}.csv`);
                        }} 
                        className="h-10 rounded-2xl font-bold text-xs w-full sm:w-auto border-slate-200 dark:border-slate-800 active:scale-95 transition-all"
                    >
                        <FileSpreadsheet className="mr-2 h-4 w-4 text-emerald-600" />
                        Export CSV {table.getSelectedRowModel().rows.length > 0 ? `(${table.getSelectedRowModel().rows.length})` : '(All)'}
                    </Button>

                    {table.getSelectedRowModel().rows.length > 0 && (
                        <div className="hidden sm:flex items-center gap-2">
                            <Button variant="outline" onClick={handleDownload} className="h-10 rounded-2xl font-bold text-xs">
                                <Download className="mr-2 h-4 w-4" />
                                Download ({table.getSelectedRowModel().rows.length})
                            </Button>
                            <Button variant="destructive" onClick={handleDelete} className="h-10 rounded-2xl font-bold text-xs">
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete ({table.getSelectedRowModel().rows.length})
                            </Button>
                        </div>
                    )}
                </div>
            </div>

            {/* Mobile Bulk Selection Bar */}
            {mobileSelected.size > 0 && (
                <div className="md:hidden flex items-center justify-between p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200/80 dark:border-emerald-800 shadow-sm animate-in fade-in slide-in-from-top-2">
                    <span className="text-xs font-black text-emerald-800 dark:text-emerald-300">
                        {mobileSelected.size} selected
                    </span>
                    <div className="flex gap-2">
                        <Button
                            size="sm"
                            variant="outline"
                            className="h-9 rounded-xl text-xs font-bold border-emerald-300 dark:border-emerald-700 active:scale-95"
                            onClick={() => {
                                triggerHaptic('light');
                                const selected = data.filter(d => mobileSelected.has(d.id!));
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
                                triggerHaptic('medium');
                                onDeleteSelected(Array.from(mobileSelected));
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
                        <p className="text-xs text-slate-400 mt-1">Try searching for a different customer or invoice #</p>
                    </div>
                ) : (
                    filteredData.map((invoice) => {
                        const id = invoice.id!;
                        const isSelected = mobileSelected.has(id);
                        return (
                            <div
                                key={id}
                                className={`rounded-2xl border transition-all duration-150 p-4 space-y-3.5 ${
                                    isSelected
                                        ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20 shadow-md ring-2 ring-emerald-500/20'
                                        : 'border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-900 shadow-[0_4px_16px_-4px_rgba(0,0,0,0.06)]'
                                }`}
                            >
                                {/* Top row: Checkbox + Invoice # + Amount */}
                                <div className="flex items-start justify-between gap-2">
                                    <div className="flex items-center gap-3 min-w-0">
                                        <Checkbox
                                            checked={isSelected}
                                            onCheckedChange={() => {
                                                triggerHaptic('light');
                                                toggleMobileSelect(id);
                                            }}
                                            aria-label="Select invoice"
                                            className="mt-0.5 rounded-lg h-5 w-5"
                                        />
                                        <div className="min-w-0">
                                            <p className="font-mono font-black text-sm text-emerald-600 dark:text-emerald-400 truncate">
                                                {invoice.invoiceNumber || 'No Number'}
                                            </p>
                                            <p className="text-xs font-semibold text-slate-600 dark:text-slate-300 truncate mt-0.5">
                                                {invoice.billToName || invoice.customerName || '—'}
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

                                {/* 3 Inline Tactile Action buttons */}
                                <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="h-10 rounded-xl text-xs font-bold active:scale-95 transition-all border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200"
                                        onClick={() => {
                                            triggerHaptic('light');
                                            onPreview?.(invoice);
                                        }}
                                    >
                                        <Eye className="h-3.5 w-3.5 mr-1 text-slate-500" /> Preview
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="h-10 rounded-xl text-xs font-bold active:scale-95 transition-all border-emerald-200 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
                                        onClick={() => {
                                            triggerHaptic('light');
                                            onDownloadSingle?.(invoice);
                                        }}
                                    >
                                        <Download className="h-3.5 w-3.5 mr-1" /> PDF
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="h-10 rounded-xl text-xs font-bold active:scale-95 transition-all text-rose-600 dark:text-rose-400 border-rose-200/60 dark:border-rose-900/40 hover:bg-rose-50 dark:hover:bg-rose-950/20"
                                        onClick={() => {
                                            triggerHaptic('medium');
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

                {/* Mobile pagination hint */}
                {filteredData.length > 0 && (
                    <p className="text-xs text-center font-medium text-slate-400 pb-2">
                        Showing {filteredData.length} invoice{filteredData.length !== 1 ? 's' : ''}
                    </p>
                )}
            </div>

            {/* ── DESKTOP TABLE ─────────────────────────────────────── */}
            <div className="hidden md:block">
                <div className="rounded-md border overflow-x-auto">
                    <Table>
                        <TableHeader>
                            {table.getHeaderGroups().map((headerGroup) => (
                                <TableRow key={headerGroup.id}>
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
                                        )
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
                                        className="transition-all hover:shadow-md hover:scale-[1.01]"
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
                                    <TableCell colSpan={columns.length} className="h-24 text-center">
                                        No results.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
                <div className="flex items-center justify-end space-x-2 py-4">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => table.previousPage()}
                        disabled={!table.getCanPreviousPage()}
                    >
                        Previous
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => table.nextPage()}
                        disabled={!table.getCanNextPage()}
                    >
                        Next
                    </Button>
                </div>
            </div>
        </div>
    )
}

