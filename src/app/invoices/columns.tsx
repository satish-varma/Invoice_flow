"use client";

import { ColumnDef } from "@tanstack/react-table";
import {
  ArrowUpDown,
  Copy,
  Download,
  Eye,
  Pencil,
  Trash2,
  Calendar,
  Truck,
  Paperclip,
  CheckCircle2,
  Clock,
  XCircle,
  ChevronDown,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Invoice } from "@/services/invoiceService";
import { format } from "date-fns";
import { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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

export const getColumns = (
  onPreview: (invoice: Invoice) => void,
  onDownload: (invoice: Invoice) => void,
  onDelete: (invoice: Invoice) => void,
  onEdit?: (invoice: Invoice) => void,
  onUpdateStatus?: (invoice: Invoice, newStatus: "pending" | "paid" | "cancelled") => void
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
          size="sm"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="h-7 px-1.5 -ml-1 text-xs font-bold text-slate-700 dark:text-slate-300"
        >
          Invoice #
          <ArrowUpDown className="ml-1 h-3 w-3" />
        </Button>
      );
    },
    cell: ({ row }) => (
      <span className="font-mono font-bold text-xs text-[#3b2fc9] dark:text-indigo-400 whitespace-nowrap">
        {row.original.invoiceNumber}
      </span>
    ),
  },
  {
    accessorKey: "invoiceType",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="h-7 px-1.5 -ml-1 text-xs font-bold text-slate-700 dark:text-slate-300"
        >
          Type
          <ArrowUpDown className="ml-1 h-3 w-3" />
        </Button>
      );
    },
    cell: ({ row }) => {
      const type = row.original.invoiceType || "NON-MRP";
      const isMrp = type === "MRP";
      return (
        <div className="whitespace-nowrap">
          <span
            className={`inline-flex items-center font-mono font-bold text-[10px] px-1.5 py-0.5 rounded border transition-all ${
              isMrp
                ? "text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200/80 dark:border-emerald-800/80"
                : "text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/60 border-purple-200/80 dark:border-purple-800/80"
            }`}
          >
            {type}
          </span>
        </div>
      );
    },
  },
  {
    accessorKey: "eventNumber",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="h-7 px-1.5 -ml-1 text-xs font-bold text-slate-700 dark:text-slate-300"
        >
          Event #
          <ArrowUpDown className="ml-1 h-3 w-3" />
        </Button>
      );
    },
    cell: ({ row }) => {
      const eventNo = row.original.eventNumber;
      const poUrl = row.original.poFileUrl;
      const poName = row.original.poFileName;
      return (
        <div className="flex items-center gap-1 text-xs font-mono font-bold whitespace-nowrap">
          {eventNo ? (
            <span className="text-slate-800 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-[11px]">
              {eventNo}
            </span>
          ) : (
            <span className="text-slate-400 font-sans">—</span>
          )}
          {poUrl && (
            <a
              href={poUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center gap-0.5 text-[10px] font-black text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 px-1 py-0.5 rounded border border-indigo-200/60 dark:border-indigo-800/60"
              title={`View PO: ${poName || "Purchase Order"}`}
            >
              <Paperclip className="w-2.5 h-2.5" />
              PO
            </a>
          )}
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
          size="sm"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="h-7 px-1.5 -ml-1 text-xs font-bold text-slate-700 dark:text-slate-300"
        >
          Ship To
          <ArrowUpDown className="ml-1 h-3 w-3" />
        </Button>
      );
    },
    cell: ({ row }) => {
      const shipTo = row.original.shipToName || "";
      const firstWord = shipTo.trim().split(/\s+/)[0];
      return (
        <div className="text-xs text-slate-700 dark:text-slate-300 font-semibold whitespace-nowrap">
          {firstWord ? (
            <span
              title={shipTo}
              className="inline-block px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 max-w-[90px] truncate"
            >
              {firstWord}
            </span>
          ) : (
            <span className="text-slate-400 font-normal">—</span>
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
          size="sm"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="h-7 px-1.5 -ml-1 text-xs font-bold text-slate-700 dark:text-slate-300"
        >
          Service Month
          <ArrowUpDown className="ml-1 h-3 w-3" />
        </Button>
      );
    },
    cell: ({ row }) => {
      const period = row.original.period;
      return (
        <div className="text-xs whitespace-nowrap font-medium">
          {period ? (
            <span className="inline-flex items-center gap-1 font-semibold text-[10px] text-indigo-700 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200/60 dark:border-indigo-800/60 px-1.5 py-0.5 rounded">
              <Calendar className="w-2.5 h-2.5 text-indigo-500" />
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
          size="sm"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="h-7 px-1.5 -ml-1 text-xs font-bold text-slate-700 dark:text-slate-300"
        >
          Date
          <ArrowUpDown className="ml-1 h-3 w-3" />
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
        return <div className="text-xs text-slate-400">—</div>;
      }
    },
  },
  {
    accessorKey: "status",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="h-7 px-1.5 -ml-1 text-xs font-bold text-slate-700 dark:text-slate-300"
        >
          Status
          <ArrowUpDown className="ml-1 h-3 w-3" />
        </Button>
      );
    },
    cell: ({ row }) => {
      const invoice = row.original;
      const status = invoice.status || "pending";
      const badgeStyle = statusMap[status] || statusMap.pending;

      if (!onUpdateStatus) {
        return (
          <span
            className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border whitespace-nowrap ${badgeStyle.class}`}
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
              className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border cursor-pointer hover:shadow-xs active:scale-95 transition-all whitespace-nowrap ${badgeStyle.class}`}
              title="Click to change payment status"
            >
              <span className={`w-1.5 h-1.5 rounded-full ${badgeStyle.dot}`} />
              <span>{badgeStyle.label}</span>
              <ChevronDown className="w-2.5 h-2.5 opacity-60 ml-0.5" />
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
    },
  },
  {
    accessorKey: "total",
    header: ({ column }) => {
      return (
        <div className="text-right">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="h-7 px-1.5 -mr-1 text-xs font-bold text-slate-700 dark:text-slate-300"
          >
            Amount
            <ArrowUpDown className="ml-1 h-3 w-3" />
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
        <div className="flex items-center justify-center gap-1 whitespace-nowrap">
          <TooltipProvider>
            {/* Quick Mark Paid Button */}
            {onUpdateStatus && invoice.status !== "paid" && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => {
                      triggerHaptic("light");
                      onUpdateStatus(invoice, "paid");
                    }}
                    className="h-7 w-7 rounded-lg text-emerald-700 dark:text-emerald-300 bg-emerald-50/70 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 border-emerald-200 dark:border-emerald-800/80 active:scale-95 transition-all"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                    <span className="sr-only">Mark as Paid</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Quick Mark as Paid</p>
                </TooltipContent>
              </Tooltip>
            )}

            {/* View Button */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => onPreview(invoice)}
                  className="h-7 w-7 rounded-lg text-slate-700 dark:text-slate-300 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 border-slate-200 dark:border-slate-700 active:scale-95 transition-all"
                >
                  <Eye className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
                  <span className="sr-only">View Invoice</span>
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
                    size="icon"
                    onClick={() => onEdit(invoice)}
                    className="h-7 w-7 rounded-lg text-slate-700 dark:text-slate-300 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/40 border-slate-200 dark:border-slate-700 active:scale-95 transition-all"
                  >
                    <Pencil className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                    <span className="sr-only">Edit Invoice</span>
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
                  size="icon"
                  onClick={() => onDelete(invoice)}
                  className="h-7 w-7 rounded-lg text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 border-rose-200 dark:border-rose-900/60 active:scale-95 transition-all"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span className="sr-only">Delete Invoice</span>
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
                  className="h-7 w-7 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
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
                  className="h-7 w-7 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
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
