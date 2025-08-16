
"use client"

import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { InvoicePreview } from './invoice-preview';
import { Invoice } from '@/services/invoiceService';

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
                <div className="flex-grow overflow-auto">
                   <div className="w-[800px] mx-auto">
                     <InvoicePreview invoice={invoice} />
                   </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
