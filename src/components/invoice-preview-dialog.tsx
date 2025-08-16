
"use client"

import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Invoice } from '@/services/invoiceService';
import { InvoicePreview } from './invoice-preview';

interface InvoicePreviewDialogProps {
    invoice: Invoice;
    isOpen: boolean;
    onOpenChange: (isOpen: boolean) => void;
}

export function InvoicePreviewDialog({ invoice, isOpen, onOpenChange }: InvoicePreviewDialogProps) {
    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl h-[90vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle>Invoice Preview: {invoice.invoiceNumber}</DialogTitle>
                    <DialogDescription>
                        A preview of the invoice for {invoice.customerName}.
                    </DialogDescription>
                </DialogHeader>
                <div className="flex-grow overflow-auto bg-gray-200 p-4 sm:p-8">
                   <div className="w-full h-full bg-white shadow-lg mx-auto">
                        <InvoicePreview invoice={invoice} />
                   </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
