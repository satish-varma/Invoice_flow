
"use client"

import { ColumnDef } from "@tanstack/react-table"
import { ArrowUpDown, MoreHorizontal } from "lucide-react"
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Invoice } from "@/services/invoiceService"
import { format } from "date-fns"
import { InvoicePreview } from "@/components/invoice-preview";
import { renderToStaticMarkup } from "react-dom/server";


const handleDownload = (invoice: Invoice) => {
    const invoiceElement = document.createElement('div');
    invoiceElement.style.position = 'absolute';
    invoiceElement.style.left = '-9999px';
    invoiceElement.style.top = '-9999px';
    invoiceElement.style.width = '800px';
    
    // We need to wrap the preview in a basic HTML structure for renderToStaticMarkup
    const staticMarkup = renderToStaticMarkup(
        <html lang="en">
            <body>
                <div style={{width: '800px'}}>
                     <InvoicePreview invoice={invoice} />
                </div>
            </body>
        </html>
    );
    // Inject the static markup into our container element
    invoiceElement.innerHTML = staticMarkup;
    document.body.appendChild(invoiceElement);
    
    const input = invoiceElement.querySelector('.invoice-preview-container') as HTMLElement;
    
    if (input) {
      input.classList.add('pdf-capture');
      html2canvas(input, { scale: 2, useCORS: true, logging: false }).then((canvas) => {
        input.classList.remove('pdf-capture');
        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF('p', 'mm', 'a4');
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
        
        pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
        pdf.save(`invoice-${invoice.invoiceNumber || 'untitled'}.pdf`);
        document.body.removeChild(invoiceElement);
      }).catch(err => {
        console.error("Error generating PDF", err);
        document.body.removeChild(invoiceElement);
      });
    } else {
       document.body.removeChild(invoiceElement);
    }
};

// We need to pass the preview handler to the columns
export const getColumns = (onPreview: (invoice: Invoice) => void): ColumnDef<Invoice>[] => [
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
    cell: ({ row }) => {
      const invoice = row.original
 
      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 w-8 p-0">
              <span className="sr-only">Open menu</span>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Actions</DropdownMenuLabel>
            <DropdownMenuItem
              onClick={() => navigator.clipboard.writeText(invoice.invoiceNumber)}
            >
              Copy invoice number
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => onPreview(invoice)}>View details</DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleDownload(invoice)}>Download PDF</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )
    },
  },
]
