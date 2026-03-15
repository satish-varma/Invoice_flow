
"use client"

import { ColumnDef } from "@tanstack/react-table"
import { ArrowUpDown, Copy, Download, Eye, Trash2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Quotation } from "@/services/quotationService"
import { format } from "date-fns"
import { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip"
import { Checkbox } from "@/components/ui/checkbox"


// We need to pass the handlers to the columns
export const getColumns = (
    onPreview: (quotation: Quotation) => void,
    onDownload: (quotation: Quotation) => void,
    onDelete: (quotation: Quotation) => void
): ColumnDef<Quotation>[] => [
        {
            id: "select",
            header: ({ table }) => (
                <Checkbox
                    checked={
                        table.getIsAllPageRowsSelected() ||
                        (table.getIsSomePageRowsSelected() && "indeterminate")
                    }
                    onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
                    aria-label="Select all"
                />
            ),
            cell: ({ row }) => (
                <Checkbox
                    checked={row.getIsSelected()}
                    onCheckedChange={(value) => row.toggleSelected(!!value)}
                    aria-label="Select row"
                />
            ),
            enableSorting: false,
            enableHiding: false,
        },
        {
            accessorKey: "quotationNumber",
            header: ({ column }) => {
                return (
                    <Button
                        variant="ghost"
                        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
                    >
                        Quotation #
                        <ArrowUpDown className="ml-2 h-4 w-4" />
                    </Button>
                )
            },
        },
        {
            accessorKey: "billToName",
            header: ({ column }) => {
                return (
                    <Button
                        variant="ghost"
                        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
                    >
                        Customer Name
                        <ArrowUpDown className="ml-2 h-4 w-4" />
                    </Button>
                )
            },
            cell: ({ row }) => {
                return <div>{row.original.billToName}</div>
            }
        },
        {
            accessorKey: "quotationDate",
            header: ({ column }) => {
                return (
                    <Button
                        variant="ghost"
                        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
                    >
                        Date
                        <ArrowUpDown className="ml-2 h-4 w-4" />
                    </Button>
                )
            },
            cell: ({ row }) => {
                const date = row.getValue("quotationDate") as string;
                try {
                    return <div>{format(new Date(date), 'PPP')}</div>
                } catch (e) {
                    return <div>Invalid Date</div>
                }
            }
        },
        {
            accessorKey: "total",
            header: ({ column }) => {
                return (
                    <div className="text-right">
                        <Button
                            variant="ghost"
                            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
                        >
                            Amount
                            <ArrowUpDown className="ml-2 h-4 w-4" />
                        </Button>
                    </div>
                )
            },
            cell: ({ row }) => {
                const amount = parseFloat(row.getValue("total"))
                const formatted = new Intl.NumberFormat("en-US", {
                    style: "decimal",
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                }).format(amount)

                return <div className="text-right font-medium">{formatted}</div>
            },
        },
        {
            id: "actions",
            header: () => <div className="text-right">Actions</div>,
            cell: ({ row }) => {
                const quotation = row.original

                return (
                    <div className="flex items-center justify-end gap-2">
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button variant="ghost" size="icon" onClick={() => onPreview(quotation)}>
                                        <Eye className="h-4 w-4" />
                                        <span className="sr-only">Preview</span>
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                    <p>Preview</p>
                                </TooltipContent>
                            </Tooltip>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button variant="ghost" size="icon" onClick={() => onDownload(quotation)}>
                                        <Download className="h-4 w-4" />
                                        <span className="sr-only">Download PDF</span>
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                    <p>Download PDF</p>
                                </TooltipContent>
                            </Tooltip>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button variant="ghost" size="icon" onClick={() => onDelete(quotation)}>
                                        <Trash2 className="h-4 w-4 text-destructive" />
                                        <span className="sr-only">Delete Quotation</span>
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                    <p>Delete Quotation</p>
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    </div>
                )
            },
        },
    ]
