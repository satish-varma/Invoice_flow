
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
import { Download, Trash2 } from "lucide-react"


interface DataTableProps<TData extends Invoice, TValue> {
  columns: ColumnDef<TData, TValue>[]
  data: TData[],
  onDeleteSelected: (selectedIds: string[]) => void;
  onDownloadSelected: (selectedInvoices: TData[]) => void;
}

export function InvoicesDataTable<TData extends Invoice, TValue>({
  columns,
  data,
  onDeleteSelected,
  onDownloadSelected,
}: DataTableProps<TData, TValue>) {
    const [sorting, setSorting] = React.useState<SortingState>([])
    const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(
        []
      )
    const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({})

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
    // table.resetRowSelection();
  };

   const handleDownload = () => {
    const selectedInvoices = table.getSelectedRowModel().rows.map(row => row.original);
    onDownloadSelected(selectedInvoices);
  };

  return (
    <div>
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 py-4">
            <Input
            placeholder="Filter by customer name..."
            value={(table.getColumn("billToName")?.getFilterValue() as string) ?? ""}
            onChange={(event) =>
                table.getColumn("billToName")?.setFilterValue(event.target.value)
            }
            className="w-full sm:max-w-sm"
            />
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
  )
}

    