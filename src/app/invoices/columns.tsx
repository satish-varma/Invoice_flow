"use client";

import { ColumnDef } from "@tanstack/react-table";
import { ArrowUpDown, Copy, Download, Eye, Pencil, Trash2, Calendar, Truck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Invoice } from "@/services/invoiceService";
import { format } from "date-fns";
import { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { Checkbox } from "@/components/ui/checkbox";

export const getColumns = (
  onPreview: (invoice: Invoice) => void,
  onDownload: (invoice: Invoice) => void,
  onDelete: (invoice: Invoice) => void,
  onEdit?: (invoice: Invoice) => void
): ColumnDef<Invoice>[] => [
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
    accessorKey: "invoiceNumber",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="text-xs font-bold"
        >
          Invoice #
          <ArrowUpDown className="ml-1.5 h-3.5 w-3.5" />
        </Button>
      );
    },
    cell: ({ row }) => (
      <span className="font-mono font-bold text-xs text-[#3b2fc9] dark:text-indigo-400">
        {row.original.invoiceNumber}
      </span>
    ),
  },
  {
    accessorKey: "billToName",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="text-xs font-bold"
        >
          Customer
          <ArrowUpDown className="ml-1.5 h-3.5 w-3.5" />
        </Button>
      );
    },
    cell: ({ row }) => {
      return (
        <div className="font-medium text-xs text-slate-800 dark:text-slate-200 truncate max-w-[170px]">
          {row.original.billToName || row.original.customerName || "—"}
        </div>
      );
    },
  },
  {
    accessorKey: "shipToName",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="text-xs font-bold"
        >
          Ship To
          <ArrowUpDown className="ml-1.5 h-3.5 w-3.5" />
        </Button>
      );
    },
    cell: ({ row }) => {
      const shipTo = row.original.shipToName;
      return (
        <div className="text-xs text-slate-600 dark:text-slate-300 font-medium truncate max-w-[160px]">
          {shipTo ? (
            <span title={shipTo}>{shipTo}</span>
          ) : (
            <span className="text-slate-400 italic">Same as Bill To</span>
          )}
        </div>
      );
    },
  },
  {
    accessorKey: "period",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="text-xs font-bold"
        >
          Service Month
          <ArrowUpDown className="ml-1.5 h-3.5 w-3.5" />
        </Button>
      );
    },
    cell: ({ row }) => {
      const period = row.original.period;
      return (
        <div className="text-xs whitespace-nowrap font-medium">
          {period ? (
            <span className="inline-flex items-center gap-1 font-semibold text-[11px] text-indigo-700 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200/60 dark:border-indigo-800/60 px-2 py-0.5 rounded-md">
              <Calendar className="w-3 h-3 text-indigo-500" />
              {period}
            </span>
          ) : (
            <span className="text-slate-400">—</span>
          )}
        </div>
      );
    },
  },
  {
    accessorKey: "date",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="text-xs font-bold"
        >
          Date
          <ArrowUpDown className="ml-1.5 h-3.5 w-3.5" />
        </Button>
      );
    },
    cell: ({ row }) => {
      const date = row.getValue("date") as string;
      try {
        return (
          <div className="text-xs text-slate-500 dark:text-slate-400 font-medium whitespace-nowrap">
            {format(new Date(date), "dd MMM yyyy")}
          </div>
        );
      } catch (e) {
        return <div className="text-xs text-slate-400">Invalid Date</div>;
      }
    },
  },
  {
    accessorKey: "total",
    header: ({ column }) => {
      return (
        <div className="text-right">
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="text-xs font-bold"
          >
            Amount
            <ArrowUpDown className="ml-1.5 h-3.5 w-3.5" />
          </Button>
        </div>
      );
    },
    cell: ({ row }) => {
      const amount = parseFloat(row.getValue("total"));
      const formatted = new Intl.NumberFormat("en-IN", {
        style: "decimal",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(amount || 0);

      return (
        <div className="text-right font-mono font-black text-xs text-slate-900 dark:text-white tabular-nums whitespace-nowrap">
          ₹{formatted}
        </div>
      );
    },
  },
  {
    id: "actions",
    header: () => <div className="text-center text-xs font-bold">Actions</div>,
    cell: ({ row }) => {
      const invoice = row.original;

      return (
        <div className="flex items-center justify-center gap-1">
          <TooltipProvider>
            {/* View Button */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onPreview(invoice)}
                  className="h-7 px-2 rounded-lg text-xs font-bold text-slate-700 dark:text-slate-300 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 border-slate-200 dark:border-slate-700 flex items-center gap-1"
                >
                  <Eye className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
                  <span className="hidden xl:inline">View</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>View / Preview Invoice</p>
              </TooltipContent>
            </Tooltip>

            {/* Edit Button */}
            {onEdit && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onEdit(invoice)}
                    className="h-7 px-2 rounded-lg text-xs font-bold text-slate-700 dark:text-slate-300 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/40 border-slate-200 dark:border-slate-700 flex items-center gap-1"
                  >
                    <Pencil className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                    <span className="hidden xl:inline">Edit</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Edit Invoice</p>
                </TooltipContent>
              </Tooltip>
            )}

            {/* Delete Button */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onDelete(invoice)}
                  className="h-7 px-2 rounded-lg text-xs font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 border-rose-200 dark:border-rose-900/60 flex items-center gap-1"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span className="hidden xl:inline">Delete</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Delete Invoice</p>
              </TooltipContent>
            </Tooltip>

            {/* Download PDF Button */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-slate-500 hover:text-slate-800"
                  onClick={() => onDownload(invoice)}
                >
                  <Download className="h-3.5 w-3.5" />
                  <span className="sr-only">Download PDF</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Download PDF</p>
              </TooltipContent>
            </Tooltip>

            {/* Copy Invoice # Button */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-slate-500 hover:text-slate-800"
                  onClick={() => navigator.clipboard.writeText(invoice.invoiceNumber)}
                >
                  <Copy className="h-3.5 w-3.5" />
                  <span className="sr-only">Copy Invoice Number</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Copy Invoice Number</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      );
    },
  },
];
