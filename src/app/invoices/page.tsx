
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
import { generateAndSavePdf } from "@/lib/pdf";


export default function InvoicesPage() {
  const [data, setData] = useState<Invoice[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [previewingInvoice, setPreviewingInvoice] = useState<Invoice | null>(null);
  const [invoiceToGenerate, setInvoiceToGenerate] = useState<Invoice | null>(null);
  const [pdfAction, setPdfAction] = useState<'preview' | 'save' | null>(null);
  
  const invoicePreviewRef = useRef<HTMLDivElement>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isBulkDownloading, setIsBulkDownloading] = useState(false);

  const [invoicesToDelete, setInvoicesToDelete] = useState<string[] | null>(null);
  const { toast } = useToast();

  const loadData = async () => {
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
    loadData();
  }, []);
  
  useEffect(() => {
    const generatePdf = async () => {
        if (!invoiceToGenerate || !pdfAction || !invoicePreviewRef.current || !settings) {
            return;
        }

        const input = invoicePreviewRef.current;
        if (!input) return;

        setIsGeneratingPdf(true);

        try {
            if (pdfAction === 'save') {
                await generateAndSavePdf(input, `invoice-${invoiceToGenerate.invoiceNumber || 'untitled'}.pdf`);
                 if (!isBulkDownloading) {
                    setInvoiceToGenerate(null);
                    setPdfAction(null);
                }
            } else { // 'preview'
                const canvas = await html2canvas(input, { scale: 1.5, useCORS: true });
                const imgData = canvas.toDataURL('image/jpeg', 0.9);
                const pdf = new jsPDF('p', 'mm', 'a4');
                const pdfWidth = pdf.internal.pageSize.getWidth();
                const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
                pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
                const url = pdf.output('datauristring');
                setPdfUrl(url);
            }
        } catch (error) {
            console.error("Error generating PDF:", error);
            toast({ variant: "destructive", title: "PDF Generation Failed", description: "There was an error generating the PDF." });
        } finally {
            if (pdfAction === 'preview') {
              setIsGeneratingPdf(false); // Only stop generating indicator for preview
            }
            if (!isBulkDownloading) {
              setInvoiceToGenerate(null); // Reset after single action
              setPdfAction(null);
            }
        }
    };

    generatePdf();
    
  }, [invoiceToGenerate, pdfAction, settings, toast, isBulkDownloading, invoicePreviewRef.current]);

  const handlePreview = (invoice: Invoice) => {
    closePreview(); // Close any existing preview first
    setPreviewingInvoice(invoice);
    setPdfUrl(null);
    setInvoiceToGenerate(invoice);
    setPdfAction('preview');
  }

  const handleDownload = (invoice: Invoice) => {
    closePreview();
    setInvoiceToGenerate(invoice);
    setPdfAction('save');
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
      description: `Preparing to download ${invoices.length} invoices.`,
    });

    for (const invoice of invoices) {
      // Set the state to trigger the useEffect for PDF generation
      setInvoiceToGenerate(invoice);
      setPdfAction('save');
      // Wait for the PDF to be generated and download to start.
      // This is a simple way to queue them up. A more complex system could be used for progress.
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    setInvoiceToGenerate(null);
    setPdfAction(null);
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
        await loadData(); // Reload data
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
            <div className="flex flex-col sm:flex-row items-start sm:items-center sm:justify-between mb-8 gap-4">
                <div>
                    <Button variant="outline" asChild>
                        <Link href="/">
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Back to Create
                        </Link>
                    </Button>
                    <h1 className="text-3xl sm:text-4xl font-headline font-bold text-primary mt-4">
                        Saved Invoices
                    </h1>
                    <p className="text-muted-foreground text-sm sm:text-base">
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
    {invoiceToGenerate && settings && (
        <div style={{ position: 'absolute', left: '-9999px', top: '-9999px', zIndex: -1 }}>
            <InvoicePreview ref={invoicePreviewRef} invoice={invoiceToGenerate} settings={settings} />
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
