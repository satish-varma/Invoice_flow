

"use client"

import { ColumnDef } from "@tanstack/react-table"
import { ArrowUpDown, Copy, Download, Eye } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Invoice } from "@/services/invoiceService"
import { format } from "date-fns"
import { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip"


// We need to pass the preview handler to the columns
export const getColumns = (onPreview: (invoice: Invoice) => void, onDownload: (invoice: Invoice) => void): ColumnDef<Invoice>[] => [
  {
    accessorKey: "invoiceNumber",
    header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Invoice #
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        )
      },
  },
  {
    accessorKey: "customerName",
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
  },
  {
    accessorKey: "date",
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
        const date = row.getValue("date") as string;
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
      const invoice = row.original
 
      return (
        <div className="flex items-center justify-end gap-2">
            <TooltipProvider>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" onClick={() => onPreview(invoice)}>
                            <Eye className="h-4 w-4" />
                            <span className="sr-only">View Details</span>
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                        <p>View Details</p>
                    </TooltipContent>
                </Tooltip>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" onClick={() => onDownload(invoice)}>
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
                        <Button variant="ghost" size="icon" onClick={() => navigator.clipboard.writeText(invoice.invoiceNumber)}>
                             <Copy className="h-4 w-4" />
                             <span className="sr-only">Copy Invoice Number</span>
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                        <p>Copy Invoice Number</p>
                    </TooltipContent>
                </Tooltip>
            </TooltipProvider>
        </div>
      )
    },
  },
]
