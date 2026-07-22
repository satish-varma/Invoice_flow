
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
import { Download, Trash2, FileSpreadsheet, Eye, Copy, FileText } from "lucide-react"
import { exportToCSV } from "@/lib/export"
import { Checkbox } from "@/components/ui/checkbox"
import { format } from "date-fns"
import { Badge } from "@/components/ui/badge"


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
        <div>
            {/* ── Filters & Bulk Actions ─────────────────────────────── */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 py-4">
                <div className="flex flex-col sm:flex-row items-center gap-2 w-full sm:w-auto">
                    {/* Mobile uses a single search input */}
                    <Input
                        placeholder="Search customer or invoice #..."
                        value={searchText || (table.getColumn("billToName")?.getFilterValue() as string) ?? ""}
                        onChange={(event) => {
                            setSearchText(event.target.value);
                            table.getColumn("billToName")?.setFilterValue(event.target.value);
                            table.getColumn("invoiceNumber")?.setFilterValue(event.target.value);
                        }}
                        className="w-full sm:w-64 md:hidden"
                    />
                    {/* Desktop keeps both filters */}
                    <Input
                        placeholder="Filter by customer..."
                        value={(table.getColumn("billToName")?.getFilterValue() as string) ?? ""}
                        onChange={(event) =>
                            table.getColumn("billToName")?.setFilterValue(event.target.value)
                        }
                        className="hidden md:block w-full sm:w-64"
                    />
                    <Input
                        placeholder="Filter by invoice #..."
                        value={(table.getColumn("invoiceNumber")?.getFilterValue() as string) ?? ""}
                        onChange={(event) =>
                            table.getColumn("invoiceNumber")?.setFilterValue(event.target.value)
                        }
                        className="hidden md:block w-full sm:w-48"
                    />
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto flex-wrap">
                    <Button variant="outline" onClick={() => exportToCSV(table.getSelectedRowModel().rows.length > 0 ? table.getSelectedRowModel().rows.map(r => r.original) : data, `invoices-export-${new Date().toISOString().split('T')[0]}.csv`)} className="w-full sm:w-auto">
                        <FileSpreadsheet className="mr-2 h-4 w-4" />
                        Export CSV {table.getSelectedRowModel().rows.length > 0 ? `(${table.getSelectedRowModel().rows.length})` : '(All)'}
                    </Button>

                    {table.getSelectedRowModel().rows.length > 0 && (
                        <div className="flex w-full sm:w-auto items-center gap-2">
                            <Button variant="outline" onClick={handleDownload} className="w-full sm:w-auto">
                                <Download className="mr-2 h-4 w-4" />
                                Download ({table.getSelectedRowModel().rows.length})
                            </Button>
                            <Button variant="destructive" onClick={handleDelete} className="w-full sm:w-auto">
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
                    <div className="text-center text-muted-foreground py-12 border rounded-lg">
                        <FileText className="h-10 w-10 mx-auto mb-2 opacity-30" />
                        <p>No invoices found.</p>
                    </div>
                ) : (
                    filteredData.map((invoice) => {
                        const id = invoice.id!;
                        const isSelected = mobileSelected.has(id);
                        return (
                            <div
                                key={id}
                                className={`border rounded-xl p-4 space-y-3 transition-all duration-150 ${isSelected ? 'border-primary bg-primary/5 shadow-md' : 'bg-card shadow-sm'}`}
                            >
                                {/* Top row: Checkbox + Invoice # + Amount */}
                                <div className="flex items-start justify-between gap-2">
                                    <div className="flex items-center gap-3">
                                        <Checkbox
                                            checked={isSelected}
                                            onCheckedChange={() => toggleMobileSelect(id)}
                                            aria-label="Select invoice"
                                            className="mt-0.5"
                                        />
                                        <div>
                                            <p className="font-bold text-sm text-primary leading-tight">
                                                {invoice.invoiceNumber || 'No Number'}
                                            </p>
                                            <p className="text-xs text-muted-foreground mt-0.5">
                                                {invoice.billToName || invoice.customerName || '—'}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="text-right flex-shrink-0">
                                        <p className="font-bold text-base">₹{formatAmount(invoice.total)}</p>
                                        <p className="text-xs text-muted-foreground mt-0.5">
                                            {formatDate(invoice.date)}
                                        </p>
                                    </div>
                                </div>

                                {/* Action buttons */}
                                <div className="grid grid-cols-3 gap-2 pt-1 border-t">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="w-full text-xs h-9"
                                        onClick={() => onPreview?.(invoice)}
                                    >
                                        <Eye className="h-3.5 w-3.5 mr-1" /> Preview
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="w-full text-xs h-9"
                                        onClick={() => onDownloadSingle?.(invoice)}
                                    >
                                        <Download className="h-3.5 w-3.5 mr-1" /> PDF
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="w-full text-xs h-9 text-destructive border-destructive/30 hover:bg-destructive/10"
                                        onClick={() => onDeleteSingle?.(invoice)}
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
                    <p className="text-xs text-center text-muted-foreground pb-2">
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

