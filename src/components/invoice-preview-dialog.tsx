
"use client"

import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Invoice } from '@/services/invoiceService';
import { Loader } from 'lucide-react';

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
                <div className="flex-grow overflow-auto bg-gray-200 p-4 sm:p-8 flex items-center justify-center">
                   {isGeneratingPdf ? (
                        <div className="flex flex-col items-center gap-4">
                           <Loader className="h-8 w-8 animate-spin text-primary" />
                           <p className="text-muted-foreground">Generating PDF Preview...</p>
                        </div>
                   ) : pdfUrl ? (
                        <embed src={pdfUrl} type="application/pdf" className="w-full h-full" />
                   ) : (
                        <div className="text-destructive-foreground bg-destructive p-4 rounded-md">
                            Could not load PDF preview.
                        </div>
                   )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
