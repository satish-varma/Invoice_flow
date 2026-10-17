
'use client'

import { Invoice, getInvoices, deleteInvoice, deleteInvoices } from "@/services/invoiceService";
import { InvoicesDataTable } from "./data-table";
import { getColumns } from "./columns";
import Link from 'next/link';
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader, Plus, Receipt } from "lucide-react";
import React, { useRef, useEffect, useState } from "react";
import { InvoicePreviewDialog } from "@/components/invoice-preview-dialog";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { InvoicePreview } from "@/components/invoice-preview";
import type { Settings } from "@/services/settingsService";
import { getSettings } from "@/services/settingsService";
import { triggerHaptic } from "@/lib/haptics";
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
import { AppShell } from "@/components/app-shell";


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
    try {
      const [invoices, settingsData] = await Promise.all([
        getInvoices(),
        getSettings()
      ]);
      setData(invoices);
      setSettings(settingsData);
    } catch (error) {
      console.error(error);
      toast({
        variant: 'destructive',
        title: 'Failed to fetch data',
        description: 'There was an error loading your data. Please try again later.',
      });
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (invoiceToGenerate && settings && pdfAction) {
      const timer = setTimeout(async () => {
        if (invoicePreviewRef.current) {
          const input = invoicePreviewRef.current;

          if (pdfAction === 'save') {
            try {
              await generateAndSavePdf(input, `invoice-${invoiceToGenerate.invoiceNumber || 'untitled'}.pdf`);
            } catch (error) {
              console.error("Error saving PDF:", error);
              toast({ variant: "destructive", title: "PDF Generation Failed", description: "There was an error saving the PDF." });
            } finally {
              if (!isBulkDownloading) {
                // Wait a bit to ensure the browser has handled the download trigger
                setTimeout(() => {
                  setInvoiceToGenerate(null);
                  setPdfAction(null);
                }, 500);
              }
            }
          } else { // 'preview'
            setIsGeneratingPdf(true);
            try {
              const url = await generateAndSavePdf(input, '', 'preview');
              if (url) {
                setPdfUrl(url);
              }
            } catch (error) {
              console.error("Error generating PDF preview:", error);
              toast({ variant: "destructive", title: "PDF Preview Failed", description: "There was an error generating the PDF preview." });
            } finally {
              setIsGeneratingPdf(false);
              if (!isBulkDownloading) {
                setInvoiceToGenerate(null);
                setPdfAction(null);
              }
            }
          }

        }
      }, 100);

      return () => clearTimeout(timer);
    }

  }, [invoiceToGenerate, pdfAction, settings, toast, isBulkDownloading]);

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
    <AppShell>
      <main className="min-h-screen bg-slate-50/50 dark:bg-slate-950 flex flex-col items-center p-3 sm:p-8 pb-24">
        <div className="w-full max-w-7xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <Button 
                  variant="outline" 
                  size="sm"
                  asChild
                  onClick={() => triggerHaptic('light')}
                  className="h-9 rounded-2xl font-bold text-xs active:scale-95 transition-all"
                >
                  <Link href="/">
                    <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
                    Back
                  </Link>
                </Button>
                <span className="uppercase text-[10px] sm:text-xs font-black tracking-widest text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2.5 py-1 rounded-full border border-emerald-200/60 dark:border-emerald-800/60 inline-flex items-center gap-1.5 shadow-xs">
                  <Receipt className="w-3 h-3 text-emerald-500" />
                  Billing • Invoices
                </span>
                <span className="text-[11px] font-mono font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-2.5 py-1 rounded-full border border-slate-200/60 dark:border-slate-700/60">
                  {data.length} Total
                </span>
              </div>
              <h1 className="text-2xl sm:text-4xl font-black text-slate-900 dark:text-white tracking-tight">
                Saved Invoices
              </h1>
              <p className="text-xs sm:text-sm font-medium text-slate-500 dark:text-slate-400 mt-1">
                Filter, export, preview, and generate PDFs for your invoices.
              </p>
            </div>

            <Button
              asChild
              onClick={() => triggerHaptic('light')}
              className="h-11 rounded-2xl font-black text-xs sm:text-sm bg-emerald-600 hover:bg-emerald-700 text-white shadow-md active:scale-95 transition-all w-full sm:w-auto"
            >
              <Link href="/">
                <Plus className="mr-2 h-4 w-4" />
                Create New Invoice
              </Link>
            </Button>
          </div>

          <InvoicesDataTable
            columns={columns}
            data={data}
            onDeleteSelected={handleBulkDeleteRequest}
            onDownloadSelected={handleBulkDownload}
            onPreview={handlePreview}
            onDownloadSingle={handleDownload}
            onDeleteSingle={handleDeleteRequest}
          />
        </div>
      </main>
      {previewingInvoice && settings && (
        <InvoicePreviewDialog
          invoice={previewingInvoice}
          settings={settings}
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
        <div
          id="pdf-capture-container"
          style={{ 
            position: 'fixed',
            top: 0,
            left: 0, 
            width: '800px', // Exact width of the card
            height: 'auto',
            background: 'white',
            opacity: 0, // Fully invisible but still rendered
            pointerEvents: 'none',
            zIndex: -9999,
            overflow: 'visible'
          }}
        >
          <InvoicePreview ref={invoicePreviewRef} invoice={invoiceToGenerate} settings={settings} />
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!invoicesToDelete} onOpenChange={(open) => !open && setInvoicesToDelete(null)}>
        <AlertDialogContent className="w-[90vw] sm:max-w-md rounded-3xl p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-lg font-black tracking-tight text-slate-900 dark:text-white">Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription className="text-sm font-medium text-slate-500 dark:text-slate-400">
              This action cannot be undone. This will permanently delete the selected invoice(s).
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row gap-2 mt-4 sm:justify-end">
            <AlertDialogCancel onClick={() => setInvoicesToDelete(null)} className="flex-1 sm:flex-initial h-11 rounded-2xl font-bold border-slate-200 dark:border-slate-800">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmDelete} 
              disabled={isDeleting} 
              className="flex-1 sm:flex-initial h-11 rounded-2xl font-bold bg-rose-600 hover:bg-rose-700 text-white"
            >
              {isDeleting ? <Loader className="mr-2 h-4 w-4 animate-spin" /> : null}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </AppShell>
  );
}
