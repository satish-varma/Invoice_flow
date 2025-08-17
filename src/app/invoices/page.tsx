
'use client'

import { Invoice, getInvoices, deleteInvoice, deleteInvoices } from "@/services/invoiceService";
import { InvoicesDataTable } from "./data-table";
import { getColumns } from "./columns";
import Link from 'next/link';
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader } from "lucide-react";
import React, { useRef, useEffect, useState } from "react";
import { InvoicePreviewDialog } from "@/components/invoice-preview-dialog";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { InvoicePreview } from "@/components/invoice-preview";
import type { Settings } from "@/services/settingsService";
import { getSettings } from "@/services/settingsService";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { useToast } from "@/hooks/use-toast";


export default function InvoicesPage() {
  const [data, setData] = useState<Invoice[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [previewingInvoice, setPreviewingInvoice] = useState<Invoice | null>(null);
  const [invoiceToGeneratePdf, setInvoiceToGeneratePdf] = useState<Invoice | null>(null);
  const [pdfOutput, setPdfOutput] = useState<'dataurl' | 'save' | null>(null);
  
  const invoicePreviewRef = useRef<HTMLDivElement>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isBulkDownloading, setIsBulkDownloading] = useState(false);

  const [invoicesToDelete, setInvoicesToDelete] = useState<string[] | null>(null);
  const { toast } = useToast();

  const loadInvoices = async () => {
    setIsLoading(true);
    const [invoices, settingsData] = await Promise.all([
      getInvoices(),
      getSettings()
    ]);
    setData(invoices);
    setSettings(settingsData);
    setIsLoading(false);
  }

  useEffect(() => {
    loadInvoices();
  }, []);
  
  useEffect(() => {
    const generatePdf = async () => {
      // Ensure there's a component to capture and an action to perform
      if (!invoiceToGeneratePdf || !pdfOutput || !invoicePreviewRef.current || !settings) {
        return;
      }
  
      // Add a small delay to ensure the component is fully rendered in the DOM
      setTimeout(async () => {
        const input = invoicePreviewRef.current;
        if (!input) return;

        try {
            const canvas = await html2canvas(input, { scale: 2, useCORS: true });
            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF('p', 'mm', 'a4');
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
            
            pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
            
            if (pdfOutput === 'save') {
                pdf.save(`invoice-${invoiceToGeneratePdf.invoiceNumber || 'untitled'}.pdf`);
                // Reset states after saving. In bulk download, this is handled by the loop.
                if (!isBulkDownloading) {
                    setInvoiceToGeneratePdf(null);
                    setPdfOutput(null);
                }
            } else { // 'dataurl' for preview
                const url = pdf.output('datauristring');
                setPdfUrl(url);
                setIsGeneratingPdf(false); // Stop generating indicator for preview
            }
        } catch (error) {
            console.error("Error generating PDF:", error);
            toast({ variant: "destructive", title: "PDF Generation Failed", description: "There was an error generating the PDF." });
            setIsGeneratingPdf(false);
            setInvoiceToGeneratePdf(null);
            setPdfOutput(null);
        }
      }, 500); // 500ms delay
    };

    generatePdf();

  }, [invoiceToGeneratePdf, pdfOutput, isBulkDownloading, settings, toast]);

  const handlePreview = (invoice: Invoice) => {
    closePreview(); // Close any existing preview first
    setPreviewingInvoice(invoice);
    setIsGeneratingPdf(true);
    setPdfUrl(null);
    setInvoiceToGeneratePdf(invoice); // Set the invoice to be rendered for PDF generation
    setPdfOutput('dataurl');
  }

  const handleDownload = (invoice: Invoice) => {
    closePreview();
    setIsGeneratingPdf(false);
    setPdfUrl(null);
    setInvoiceToGeneratePdf(invoice); // Set the invoice to be rendered for PDF generation
    setPdfOutput('save');
  };

  const closePreview = () => {
    setPreviewingInvoice(null);
    setPdfUrl(null);
    setIsGeneratingPdf(false);
  }

  const handleDeleteRequest = (invoice: Invoice) => {
    if (invoice.id) {
        setInvoicesToDelete([invoice.id]);
    }
  }

  const handleBulkDeleteRequest = (ids: string[]) => {
    setInvoicesToDelete(ids);
  }

  const handleBulkDownload = async (invoices: Invoice[]) => {
    if (isBulkDownloading) return;
    setIsBulkDownloading(true);

    toast({
      title: "Bulk Download Started",
      description: `Preparing to download ${invoices.length} invoices. Please allow pop-ups if prompted.`,
    });

    for (const invoice of invoices) {
      // This function now returns a promise that resolves after the PDF is saved
      await new Promise<void>(resolve => {
        setInvoiceToGeneratePdf(invoice);
        setPdfOutput('save');
        // The useEffect will trigger the download. We need a way to know when it's done.
        // A simple timeout is a pragmatic way to wait for the async operation.
        setTimeout(() => {
          resolve();
        }, 1500); // Wait for PDF generation and download prompt
      });
    }

    setInvoiceToGeneratePdf(null);
    setPdfOutput(null);
    setIsBulkDownloading(false);
    toast({
      title: "Bulk Download Complete",
      description: `Finished processing ${invoices.length} invoices.`,
    });
  };

  const confirmDelete = async () => {
    if (!invoicesToDelete) return;
    setIsDeleting(true);
    try {
        if (invoicesToDelete.length === 1) {
            await deleteInvoice(invoicesToDelete[0]);
        } else {
            await deleteInvoices(invoicesToDelete);
        }
        toast({
            title: "Success",
            description: `Successfully deleted ${invoicesToDelete.length} invoice(s).`,
        });
        await loadInvoices(); // Reload data
    } catch (error) {
        console.error("Failed to delete invoices:", error);
        toast({
            variant: "destructive",
            title: "Error",
            description: "Failed to delete invoices. Please try again.",
        });
    } finally {
        setInvoicesToDelete(null);
        setIsDeleting(false);
    }
  }

  const columns = React.useMemo(() => getColumns(handlePreview, handleDownload, handleDeleteRequest), []);
  
  if (isLoading || isBulkDownloading) {
    return (
        <div className="flex flex-col items-center justify-center min-h-screen">
            <Loader className="h-8 w-8 animate-spin" />
            {isBulkDownloading && <p className="mt-4 text-muted-foreground">Processing bulk download...</p>}
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
            <InvoicesDataTable 
              columns={columns} 
              data={data} 
              onDeleteSelected={handleBulkDeleteRequest}
              onDownloadSelected={handleBulkDownload}
            />
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
    {invoiceToGeneratePdf && settings && (
        <div style={{ position: 'absolute', left: '-9999px', top: '-9999px', zIndex: -1 }}>
            <InvoicePreview ref={invoicePreviewRef} invoice={invoiceToGeneratePdf} settings={settings} />
        </div>
    )}

    {/* Delete Confirmation Dialog */}
    <AlertDialog open={!!invoicesToDelete} onOpenChange={(open) => !open && setInvoicesToDelete(null)}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                <AlertDialogDescription>
                    This action cannot be undone. This will permanently delete the selected invoice(s).
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel onClick={() => setInvoicesToDelete(null)}>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={confirmDelete} disabled={isDeleting} className="bg-destructive hover:bg-destructive/90">
                    {isDeleting ? <Loader className="mr-2 h-4 w-4 animate-spin"/> : null}
                    Delete
                </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
    </AlertDialog>

    </>
  );
}
