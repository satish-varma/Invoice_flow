
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
import { Download, Trash2, FileSpreadsheet, Eye, FileText, Search, X } from "lucide-react"
import { exportToCSV } from "@/lib/export"
import { Checkbox } from "@/components/ui/checkbox"
import { format } from "date-fns"
import { triggerHaptic } from "@/lib/haptics"


interface DataTableProps<TData, TValue> {
    columns: ColumnDef<TData, TValue>[]
    data: TData[],
    onDeleteSelected: (selectedIds: string[]) => void;
    onDownloadSelected: (selectedData: TData[]) => void;
    onPreview?: (item: TData) => void;
    onDownloadSingle?: (item: TData) => void;
    onDeleteSingle?: (item: TData) => void;
}

export function ChallansDataTable<TData, TValue>({
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
        const selectedIds = table.getSelectedRowModel().rows.map(row => (row.original as any).id!);
        onDeleteSelected(selectedIds);
    };

    const handleDownload = () => {
        const selectedData = table.getSelectedRowModel().rows.map(row => row.original);
        onDownloadSelected(selectedData);
    };

    const handleExportCSV = () => {
        const selectedData = table.getSelectedRowModel().rows.map(row => row.original);
        const dataToExport = selectedData.length > 0 ? selectedData : data;
        exportToCSV(dataToExport, `challans-export-${new Date().toISOString().split('T')[0]}.csv`);
    };

    const filteredData = React.useMemo(() => {
        if (!searchText.trim()) return data;
        const lower = searchText.toLowerCase();
        return data.filter((item: any) =>
            (item.dcNumber || '').toLowerCase().includes(lower) ||
            (item.billToName || '').toLowerCase().includes(lower)
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

    const formatAmount = (amount: number) =>
        new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount || 0);

    return (
        <div>
            {/* ── Filters & Bulk Actions ─────────────────────────────── */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 py-3">
                <div className="flex flex-col sm:flex-row items-center gap-2 w-full sm:w-auto">
                    {/* Mobile 48px Search with clear (X) */}
                    <div className="relative flex-1 w-full md:hidden">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                        <Input
                            placeholder="Search customer or challan #..."
                            value={searchText}
                            onChange={(e) => {
                                setSearchText(e.target.value);
                                table.getColumn("billToName")?.setFilterValue(e.target.value);
                                table.getColumn("dcNumber")?.setFilterValue(e.target.value);
                            }}
                            className="pl-10 pr-10 h-12 rounded-2xl border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-sm font-medium shadow-sm focus-visible:ring-indigo-500"
                        />
                        {searchText && (
                            <button
                                type="button"
                                onClick={() => {
                                    triggerHaptic('light');
                                    setSearchText('');
                                    table.getColumn("billToName")?.setFilterValue('');
                                    table.getColumn("dcNumber")?.setFilterValue('');
                                }}
                                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-full active:scale-90"
                                aria-label="Clear search"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        )}
                    </div>

                    <Input
                        placeholder="Filter by customer..."
                        value={(table.getColumn("billToName")?.getFilterValue() as string) ?? ""}
                        onChange={(event) =>
                            table.getColumn("billToName")?.setFilterValue(event.target.value)
                        }
                        className="hidden md:block w-full sm:w-64 h-10 rounded-xl"
                    />
                    <Input
                        placeholder="Filter by challan #..."
                        value={(table.getColumn("dcNumber")?.getFilterValue() as string) ?? ""}
                        onChange={(event) =>
                            table.getColumn("dcNumber")?.setFilterValue(event.target.value)
                        }
                        className="hidden md:block w-full sm:w-48 h-10 rounded-xl"
                    />
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto flex-wrap">
                    <Button 
                        variant="outline" 
                        onClick={() => {
                            triggerHaptic('selection');
                            handleExportCSV();
                        }} 
                        className="w-full sm:w-auto h-11 sm:h-10 rounded-xl font-bold text-xs active:scale-95 transition-all"
                    >
                        <FileSpreadsheet className="mr-2 h-4 w-4 text-emerald-600" />
                        Export CSV {table.getSelectedRowModel().rows.length > 0 ? `(${table.getSelectedRowModel().rows.length})` : '(All)'}
                    </Button>

                    {table.getSelectedRowModel().rows.length > 0 && (
                        <div className="flex items-center gap-2 w-full sm:w-auto">
                            <Button 
                                variant="outline" 
                                onClick={() => {
                                    triggerHaptic('medium');
                                    handleDownload();
                                }} 
                                className="flex-1 sm:flex-initial h-11 sm:h-10 rounded-xl font-bold text-xs active:scale-95 transition-all"
                            >
                                <Download className="mr-2 h-4 w-4 text-indigo-600" />
                                Download ({table.getSelectedRowModel().rows.length})
                            </Button>
                            <Button 
                                variant="destructive" 
                                onClick={() => {
                                    triggerHaptic('warning');
                                    handleDelete();
                                }} 
                                className="flex-1 sm:flex-initial h-11 sm:h-10 rounded-xl font-bold text-xs active:scale-95 transition-all"
                            >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete ({table.getSelectedRowModel().rows.length})
                            </Button>
                        </div>
                    )}
                </div>
            </div>

            {/* ── MOBILE CARD LIST ──────────────────────────────────── */}
            <div className="md:hidden space-y-3">
                {filteredData.length === 0 ? (
                    <div className="text-center text-muted-foreground py-12 rounded-3xl border border-dashed border-slate-300 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50">
                        <FileText className="h-10 w-10 mx-auto mb-2 opacity-30 text-slate-400" />
                        <p className="font-bold text-sm text-slate-600 dark:text-slate-400">No challans found</p>
                    </div>
                ) : (
                    (filteredData as any[]).map((challan) => {
                        const id = challan.id!;
                        const isSelected = mobileSelected.has(id);
                        return (
                            <div
                                key={id}
                                className={`rounded-2xl border bg-white dark:bg-slate-900 p-4 space-y-3.5 shadow-[0_4px_16px_-4px_rgba(0,0,0,0.06)] transition-all active:scale-[0.99] ${
                                    isSelected 
                                        ? 'border-indigo-500 ring-2 ring-indigo-500/30 bg-indigo-50/20 dark:bg-indigo-950/20' 
                                        : 'border-slate-200/80 dark:border-slate-800'
                                }`}
                            >
                                <div className="flex items-start justify-between gap-2">
                                    <div className="flex items-center gap-3">
                                        <Checkbox
                                            checked={isSelected}
                                            onCheckedChange={() => {
                                                triggerHaptic('light');
                                                toggleMobileSelect(id);
                                            }}
                                            aria-label="Select challan"
                                            className="h-5 w-5 rounded-lg border-slate-300 dark:border-slate-700"
                                        />
                                        <div>
                                            <p className="font-mono font-black text-sm text-indigo-600 dark:text-indigo-400 leading-tight">
                                                {challan.dcNumber || 'No Number'}
                                            </p>
                                            <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 mt-0.5 line-clamp-1">
                                                {challan.billToName || '—'}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="text-right flex-shrink-0">
                                        <p className="font-mono font-black text-base text-slate-900 dark:text-white">₹{formatAmount(challan.total)}</p>
                                        <p className="text-[11px] font-medium text-slate-400 mt-0.5">
                                            {formatDate(challan.dcDate)}
                                        </p>
                                    </div>
                                </div>

                                <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-100 dark:border-slate-800/80">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="w-full text-xs font-bold h-10 rounded-xl bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 active:scale-95 transition-all"
                                        onClick={() => {
                                            triggerHaptic('selection');
                                            onPreview?.(challan);
                                        }}
                                    >
                                        <Eye className="h-3.5 w-3.5 mr-1 text-slate-600 dark:text-slate-300" /> Preview
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="w-full text-xs font-bold h-10 rounded-xl bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 text-indigo-600 dark:text-indigo-400 active:scale-95 transition-all"
                                        onClick={() => {
                                            triggerHaptic('medium');
                                            onDownloadSingle?.(challan);
                                        }}
                                    >
                                        <Download className="h-3.5 w-3.5 mr-1" /> PDF
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="w-full text-xs font-bold h-10 rounded-xl text-rose-600 border-rose-200 dark:border-rose-900/50 hover:bg-rose-50 dark:hover:bg-rose-950/30 active:scale-95 transition-all"
                                        onClick={() => {
                                            triggerHaptic('warning');
                                            onDeleteSingle?.(challan);
                                        }}
                                    >
                                        <Trash2 className="h-3.5 w-3.5 mr-1" /> Delete
                                    </Button>
                                </div>
                            </div>
                        );
                    })
                )}
                {filteredData.length > 0 && (
                    <p className="text-xs text-center font-medium text-slate-400 pb-2">
                        Showing {filteredData.length} challan{filteredData.length !== 1 ? 's' : ''}
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

