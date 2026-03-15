
"use client"

import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Invoice } from '@/services/invoiceService';
import { Loader, Download } from 'lucide-react';

interface InvoicePreviewDialogProps {
    invoice: Invoice;
    isOpen: boolean;
    onOpenChange: (isOpen: boolean) => void;
    pdfUrl: string | null;
    isGeneratingPdf: boolean;
}

export function InvoicePreviewDialog({ invoice, isOpen, onOpenChange, pdfUrl, isGeneratingPdf }: InvoicePreviewDialogProps) {
    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl h-[90vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle>Invoice Preview: {invoice.invoiceNumber}</DialogTitle>
                    <DialogDescription>
                        A preview of the invoice for {invoice.customerName}.
                    </DialogDescription>
                </DialogHeader>
                <div className="flex-grow overflow-auto bg-muted/20 p-4 sm:p-8 flex items-center justify-center rounded-md border">
                    {isGeneratingPdf ? (
                        <div className="flex flex-col items-center gap-4">
                            <Loader className="h-8 w-8 animate-spin text-primary" />
                            <p className="text-muted-foreground">Generating PDF Preview...</p>
                        </div>
                    ) : pdfUrl ? (
                        <iframe src={pdfUrl} className="w-full h-full border-none shadow-sm" title={`Invoice Preview for ${invoice.invoiceNumber}`} />
                    ) : (
                        <div className="text-destructive-foreground bg-destructive/10 p-4 rounded-md border border-destructive/20">
                            Could not load PDF preview.
                        </div>
                    )}
                </div>
                {pdfUrl && !isGeneratingPdf && (
                    <div className="flex justify-end pt-4 mt-auto border-t">
                        <a
                            href={pdfUrl}
                            download={`invoice-${invoice.invoiceNumber}.pdf`}
                            className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2"
                        >
                            <Download className="mr-2 h-4 w-4" />
                            Download PDF
                        </a>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}
