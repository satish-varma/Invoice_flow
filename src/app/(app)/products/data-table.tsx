
"use client"

import * as React from "react"
import {
    ColumnDef,
    ColumnFiltersState,
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

import { FileSpreadsheet, Search, X, Package } from "lucide-react"
import { exportToCSV } from "@/lib/export"
import { triggerHaptic } from "@/lib/haptics"

interface DataTableProps<TData, TValue> {
    columns: ColumnDef<TData, TValue>[]
    data: TData[]
    searchPlaceholder?: string
    searchColumn?: string
    noResultsMessage?: string
    exportFileName?: string
}

export function DataTable<TData, TValue>({
    columns,
    data,
    searchPlaceholder = "Search...",
    searchColumn = "name",
    noResultsMessage = "No results found.",
    exportFileName = "export.csv"
}: DataTableProps<TData, TValue>) {
    const [sorting, setSorting] = React.useState<SortingState>([])
    const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([])

    const table = useReactTable({
        data,
        columns,
        getCoreRowModel: getCoreRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
        onSortingChange: setSorting,
        getSortedRowModel: getSortedRowModel(),
        onColumnFiltersChange: setColumnFilters,
        getFilteredRowModel: getFilteredRowModel(),
        state: {
            sorting,
            columnFilters,
        },
    })

    const searchValue = (table.getColumn(searchColumn)?.getFilterValue() as string) ?? ""

    return (
        <div className="space-y-4">
            {/* Search & Export Toolbar */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                    <Input
                        placeholder={searchPlaceholder}
                        value={searchValue}
                        onChange={(event) =>
                            table.getColumn(searchColumn)?.setFilterValue(event.target.value)
                        }
                        className="pl-10 pr-10 h-12 sm:h-10 rounded-2xl border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 text-sm font-medium focus-visible:ring-indigo-500"
                    />
                    {searchValue && (
                        <button
                            type="button"
                            onClick={() => {
                                triggerHaptic('light');
                                table.getColumn(searchColumn)?.setFilterValue("");
                            }}
                            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-full active:scale-90 transition-transform"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    )}
                </div>

                <button
                    type="button"
                    onClick={() => {
                        triggerHaptic('light');
                        exportToCSV(data, exportFileName);
                    }}
                    className="inline-flex items-center justify-center gap-2 h-11 sm:h-10 px-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-bold text-slate-700 dark:text-slate-200 shadow-2xs hover:bg-slate-50 dark:hover:bg-slate-800 active:scale-95 transition-all"
                >
                    <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
                    <span>Export CSV</span>
                </button>
            </div>

            {/* Mobile Squircle Card View (md:hidden) */}
            <div className="md:hidden space-y-3">
                {table.getRowModel().rows?.length ? (
                    table.getRowModel().rows.map((row) => {
                        const item = row.original as any;
                        const actionsCell = row.getVisibleCells().find(c => c.column.id === 'actions');

                        return (
                            <div
                                key={row.id}
                                className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-xs space-y-3"
                            >
                                <div className="flex items-start justify-between gap-3">
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-500/20 to-orange-500/20 border border-amber-500/30 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0">
                                            <Package className="h-5 w-5" />
                                        </div>
                                        <div className="min-w-0">
                                            <h3 className="font-bold text-slate-900 dark:text-white text-sm truncate">
                                                {item.name || 'Untitled'}
                                            </h3>
                                            {item.description && (
                                                <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1">
                                                    {item.description}
                                                </p>
                                            )}
                                        </div>
                                    </div>

                                    {actionsCell && (
                                        <div className="shrink-0">
                                            {flexRender(actionsCell.column.columnDef.cell, actionsCell.getContext())}
                                        </div>
                                    )}
                                </div>

                                <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800 gap-2 flex-wrap">
                                    <div className="inline-flex items-center gap-1.5 font-mono font-black text-sm text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-1 rounded-xl border border-emerald-200/60 dark:border-emerald-800/40">
                                        ₹ {Number(item.unitPrice || 0).toFixed(2)}
                                        <span className="text-[11px] font-sans font-medium text-slate-500">
                                            / {item.unit || 'Nos'}
                                        </span>
                                    </div>

                                    <div className="flex items-center gap-1.5 flex-wrap">
                                        {item.hsnCode && (
                                            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200/50 dark:border-slate-700/50">
                                                HSN: {item.hsnCode}
                                            </span>
                                        )}
                                        {item.taxCategory && (
                                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border border-indigo-200/50 dark:border-indigo-800/40">
                                                {item.taxCategory}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })
                ) : (
                    <div className="text-center py-10 px-4 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
                        <Package className="h-8 w-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                        <p className="text-sm font-medium text-slate-500">{noResultsMessage}</p>
                    </div>
                )}
            </div>

            {/* Desktop Table View (hidden md:block) */}
            <div className="hidden md:block rounded-2xl border border-slate-200/80 dark:border-slate-800 overflow-hidden">
                <Table>
                    <TableHeader className="bg-slate-50/80 dark:bg-slate-900/80">
                        {table.getHeaderGroups().map((headerGroup) => (
                            <TableRow key={headerGroup.id}>
                                {headerGroup.headers.map((header) => {
                                    return (
                                        <TableHead key={header.id} className="font-bold text-xs uppercase tracking-wider text-slate-600 dark:text-slate-400">
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
                                    className="hover:bg-slate-50/60 dark:hover:bg-slate-800/50"
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
                                <TableCell colSpan={columns.length} className="h-24 text-center text-slate-500">
                                    {noResultsMessage}
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>

            {/* Pagination Controls */}
            <div className="flex items-center justify-between pt-2">
                <p className="text-xs text-slate-500 font-medium">
                    Showing {table.getRowModel().rows?.length || 0} items
                </p>
                <div className="flex items-center space-x-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                            triggerHaptic('light');
                            table.previousPage();
                        }}
                        disabled={!table.getCanPreviousPage()}
                        className="h-9 rounded-xl font-bold text-xs active:scale-95"
                    >
                        Previous
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                            triggerHaptic('light');
                            table.nextPage();
                        }}
                        disabled={!table.getCanNextPage()}
                        className="h-9 rounded-xl font-bold text-xs active:scale-95"
                    >
                        Next
                    </Button>
                </div>
            </div>
        </div>
    )
}
