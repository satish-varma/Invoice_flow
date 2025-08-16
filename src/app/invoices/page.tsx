
'use client'

import { Invoice, getInvoices } from "@/services/invoiceService";
import { InvoicesDataTable } from "./data-table";
import { getColumns } from "./columns";
import Link from 'next/link';
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader } from "lucide-react";
import React, { useRef, useEffect } from "react";
import { InvoicePreviewDialog } from "@/components/invoice-preview-dialog";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { InvoicePreview } from "@/components/invoice-preview";

export default function InvoicesPage() {
  const [data, setData] = React.useState<Invoice[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [previewingInvoice, setPreviewingInvoice] = React.useState<Invoice | null>(null);
  const [invoiceToGeneratePdf, setInvoiceToGeneratePdf] = React.useState<Invoice | null>(null);
  const [pdfOutput, setPdfOutput] = React.useState<'dataurl' | 'save' | null>(null);
  
  const invoicePreviewRef = useRef<HTMLDivElement>(null);
  const [pdfUrl, setPdfUrl] = React.useState<string | null>(null);
  const [isGeneratingPdf, setIsGeneratingPdf] = React.useState(false);

  useEffect(() => {
    async function getData() {
      setIsLoading(true);
      const invoices = await getInvoices();
      setData(invoices);
      setIsLoading(false);
    }
    getData();
  }, []);
  
  useEffect(() => {
    const generatePdf = async () => {
      if (!invoiceToGeneratePdf || !pdfOutput || !invoicePreviewRef.current) {
        return;
      }
  
      const input = invoicePreviewRef.current;
      const canvas = await html2canvas(input, { scale: 2, useCORS: true });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      
      if (pdfOutput === 'save') {
        pdf.save(`invoice-${invoiceToGeneratePdf.invoiceNumber || 'untitled'}.pdf`);
      } else {
        const url = pdf.output('datauristring');
        setPdfUrl(url);
      }

      // Reset states
      setIsGeneratingPdf(false);
      setInvoiceToGeneratePdf(null);
      setPdfOutput(null);
    };

    // Use a timeout to ensure the component has rendered before capturing
    const timer = setTimeout(() => {
        generatePdf();
    }, 100);

    return () => clearTimeout(timer);
  }, [invoiceToGeneratePdf, pdfOutput]);

  const handlePreview = (invoice: Invoice) => {
    setPreviewingInvoice(invoice);
    setIsGeneratingPdf(true);
    setPdfUrl(null);
    setInvoiceToGeneratePdf(invoice);
    setPdfOutput('dataurl');
  }

  const handleDownload = (invoice: Invoice) => {
    setInvoiceToGeneratePdf(invoice);
    setPdfOutput('save');
  };

  const closePreview = () => {
    setPreviewingInvoice(null);
    setPdfUrl(null);
  }

  const columns = React.useMemo(() => getColumns(handlePreview, handleDownload), []);
  
  if (isLoading) {
    return (
        <div className="flex items-center justify-center min-h-screen">
            <Loader className="h-8 w-8 animate-spin" />
        </div>
    )
  }

  return (
    <>
    <main className="min-h-screen bg-background flex flex-col items-center p-4 sm:p-8">
        <div className="w-full max-w-7xl mx-auto">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <Button variant="outline" asChild>
                        <Link href="/">
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Back to Create
                        </Link>
                    </Button>
                    <h1 className="text-4xl font-headline font-bold text-primary mt-4">
                        Saved Invoices
                    </h1>
                    <p className="text-muted-foreground">
                        Here are all the invoices you have saved. You can filter, sort, and manage them from here.
                    </p>
                </div>
            </div>
            <InvoicesDataTable columns={columns} data={data} onPreview={handlePreview} />
        </div>
    </main>
    {previewingInvoice && (
      <InvoicePreviewDialog
        invoice={previewingInvoice}
        isOpen={!!previewingInvoice}
        onOpenChange={(isOpen) => {
          if (!isOpen) {
            closePreview();
          }
        }}
        pdfUrl={pdfUrl}
        isGeneratingPdf={isGeneratingPdf}
      />
    )}
    {/* This component is rendered off-screen and used for PDF generation */}
    {invoiceToGeneratePdf && (
        <div style={{ position: 'absolute', left: '-9999px', top: '-9999px', zIndex: -1 }}>
            <InvoicePreview ref={invoicePreviewRef} invoice={invoiceToGeneratePdf} />
        </div>
    )}
    </>
  );
}
