
'use client'

import { Invoice, getInvoices } from "@/services/invoiceService";
import { InvoicesDataTable } from "./data-table";
import { getColumns } from "./columns";
import Link from 'next/link';
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader } from "lucide-react";
import React, { useRef } from "react";
import { InvoicePreviewDialog } from "@/components/invoice-preview-dialog";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { InvoicePreview } from "@/components/invoice-preview";

export default function InvoicesPage() {
  const [data, setData] = React.useState<Invoice[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [previewingInvoice, setPreviewingInvoice] = React.useState<Invoice | null>(null);
  const [invoiceToDownload, setInvoiceToDownload] = React.useState<Invoice | null>(null);
  const invoicePreviewRef = useRef<HTMLDivElement>(null);
  const [pdfUrl, setPdfUrl] = React.useState<string | null>(null);
  const [isGeneratingPdf, setIsGeneratingPdf] = React.useState(false);

  React.useEffect(() => {
    async function getData() {
      setIsLoading(true);
      const invoices = await getInvoices();
      setData(invoices);
      setIsLoading(false);
    }
    getData();
  }, []);
  
  const generatePdf = async (invoice: Invoice, output: 'dataurl' | 'save') => {
    // Ensure the component is ready for capture
    if (output === 'save') {
        setInvoiceToDownload(invoice);
    }
    
    // Use a timeout to allow the off-screen InvoicePreview to render
    await new Promise(resolve => setTimeout(resolve, 100));
  
    const input = invoicePreviewRef.current;
    if (!input) {
        if(output === 'save') setInvoiceToDownload(null);
        return null;
    };
  
    const canvas = await html2canvas(input, { scale: 2, useCORS: true });
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
    
    pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
    
    if (output === 'save') {
      pdf.save(`invoice-${invoice.invoiceNumber || 'untitled'}.pdf`);
      setInvoiceToDownload(null); // Clean up after download
      return null;
    } else {
      return pdf.output('datauristring');
    }
  };
  
  const handlePreview = async (invoice: Invoice) => {
    setPreviewingInvoice(invoice);
    setIsGeneratingPdf(true);
    setPdfUrl(null);
    const url = await generatePdf(invoice, 'dataurl');
    if (url) {
      setPdfUrl(url);
    }
    setIsGeneratingPdf(false);
  }

  const handleDownload = async (invoice: Invoice) => {
    await generatePdf(invoice, 'save');
  };

  const closePreview = () => {
    setPreviewingInvoice(null);
    setPdfUrl(null);
  }

  const columns = React.useMemo(() => getColumns(handlePreview, handleDownload), []);
  
  // The invoice that needs to be rendered off-screen for PDF generation.
  // It's either the one being downloaded, or the one being previewed (while the PDF is generating).
  const invoiceForPdf = invoiceToDownload || (previewingInvoice && isGeneratingPdf ? previewingInvoice : null);


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
    {invoiceForPdf && (
        <div style={{ position: 'absolute', left: '-9999px', top: '-9999px', zIndex: -1 }}>
            <InvoicePreview ref={invoicePreviewRef} invoice={invoiceForPdf} />
        </div>
    )}
    </>
  );
}
