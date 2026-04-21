
"use client"

import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Invoice } from '@/services/invoiceService';
import { Settings } from '@/services/settingsService';
import { Loader, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { generateAndSavePdf } from '@/lib/pdf';
import { InvoicePreview } from './invoice-preview';

interface InvoicePreviewDialogProps {
    invoice: Invoice;
    settings: Settings;
    isOpen: boolean;
    onOpenChange: (isOpen: boolean) => void;
    pdfUrl: string | null;
    isGeneratingPdf: boolean;
}

export function InvoicePreviewDialog({ invoice, settings, isOpen, onOpenChange, pdfUrl, isGeneratingPdf }: InvoicePreviewDialogProps) {
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
                        <Button
                            onClick={async () => {
                                const container = document.getElementById('pdf-capture-container-dialog');
                                if (container) {
                                    await generateAndSavePdf(container as HTMLElement, `invoice-${invoice.invoiceNumber}.pdf`, 'save');
                                }
                            }}
                            className="inline-flex items-center justify-center"
                        >
                            <Download className="mr-2 h-4 w-4" />
                            Download PDF
                        </Button>
                    </div>
                )}
            </DialogContent>
            {/* Hidden container for clean capture in dialog */}
            <div style={{ position: 'fixed', left: '-9999px', top: 0, width: '800px' }}>
                <div id="pdf-capture-container-dialog" style={{ background: 'white' }}>
                    <InvoicePreview invoice={invoice} settings={settings} />
                </div>
            </div>
        </Dialog>
    );
}
