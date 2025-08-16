
"use client"

import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Invoice } from '@/services/invoiceService';
import { generateInvoicePdf } from '@/lib/pdf';
import { Loader } from 'lucide-react';

interface InvoicePreviewDialogProps {
    invoice: Invoice;
    isOpen: boolean;
    onOpenChange: (isOpen: boolean) => void;
}

export function InvoicePreviewDialog({ invoice, isOpen, onOpenChange }: InvoicePreviewDialogProps) {
    const [pdfUrl, setPdfUrl] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (isOpen && invoice) {
            setIsLoading(true);
            setPdfUrl(null);
            generateInvoicePdf(invoice).then(url => {
                setPdfUrl(url);
                setIsLoading(false);
            }).catch(error => {
                console.error("Failed to generate PDF preview", error);
                setIsLoading(false);
                // Optionally show a toast message here
            });
        }
    }, [isOpen, invoice]);

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl h-[90vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle>Invoice Preview: {invoice.invoiceNumber}</DialogTitle>
                    <DialogDescription>
                        A preview of the invoice for {invoice.customerName}. This is how the final PDF will look.
                    </DialogDescription>
                </DialogHeader>
                <div className="flex-grow overflow-auto bg-gray-200 flex items-center justify-center">
                   {isLoading && (
                       <div className='text-center'>
                           <Loader className="h-8 w-8 animate-spin mx-auto mb-2" />
                           <p>Generating PDF Preview...</p>
                       </div>
                   )}
                   {pdfUrl && !isLoading && (
                       <iframe src={pdfUrl} className="w-full h-full" title={`Invoice ${invoice.invoiceNumber}`} />
                   )}
                   {!isLoading && !pdfUrl && (
                        <p className='text-destructive'>Could not load PDF preview.</p>
                   )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
