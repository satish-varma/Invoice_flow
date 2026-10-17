
"use client"

import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Invoice } from '@/services/invoiceService';
import { Settings } from '@/services/settingsService';
import { Loader, Download, X, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { generateAndSavePdf } from '@/lib/pdf';
import { InvoicePreview } from './invoice-preview';
import { triggerHaptic } from '@/lib/haptics';

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
            <DialogContent className="w-full sm:max-w-4xl max-h-[92vh] sm:max-h-[90vh] bottom-0 top-auto sm:top-[50%] sm:bottom-auto translate-y-0 sm:translate-y-[-50%] rounded-t-3xl sm:rounded-3xl p-0 border-0 overflow-hidden bg-white dark:bg-slate-900 shadow-2xl flex flex-col">
                {/* Mobile Drag Handle */}
                <div className="sm:hidden w-12 h-1.5 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto mt-2.5 mb-1 shrink-0" />

                <DialogHeader className="px-4 sm:px-6 py-3 sm:py-4 border-b border-slate-100 dark:border-slate-800 text-left">
                    <div className="flex items-center justify-between">
                        <div>
                            <div className="flex items-center gap-2">
                                <span className="uppercase text-[10px] font-black tracking-widest text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2.5 py-0.5 rounded-full border border-emerald-200/60 dark:border-emerald-800/60">
                                    INVOICE PREVIEW
                                </span>
                                <span className="text-xs font-mono font-bold text-slate-500">
                                    {invoice.invoiceNumber}
                                </span>
                            </div>
                            <DialogTitle className="text-base sm:text-xl font-black text-slate-900 dark:text-white mt-1">
                                {invoice.billToName || invoice.customerName || 'Customer Invoice'}
                            </DialogTitle>
                        </div>
                    </div>
                    <DialogDescription className="sr-only">
                        Preview of invoice {invoice.invoiceNumber}
                    </DialogDescription>
                </DialogHeader>

                <div className="flex-grow overflow-auto bg-slate-100/60 dark:bg-slate-950/60 p-2 sm:p-6 flex items-center justify-center">
                    {isGeneratingPdf ? (
                        <div className="flex flex-col items-center gap-3 py-16">
                            <Loader className="h-8 w-8 animate-spin text-emerald-600" />
                            <p className="text-sm font-semibold text-slate-500">Generating PDF preview...</p>
                        </div>
                    ) : pdfUrl ? (
                        <iframe 
                            src={pdfUrl} 
                            className="w-full h-full min-h-[50vh] sm:min-h-[60vh] rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white shadow-sm" 
                            title={`Invoice Preview for ${invoice.invoiceNumber}`} 
                        />
                    ) : (
                        <div className="text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/30 p-6 rounded-2xl border border-rose-200 dark:border-rose-900 text-center">
                            <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                            <p className="text-sm font-bold">Could not load PDF preview.</p>
                        </div>
                    )}
                </div>

                {/* Sticky Bottom Thumb Bar */}
                <div className="p-3 sm:p-4 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200/80 dark:border-slate-800 flex items-center justify-between gap-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
                    <Button
                        variant="outline"
                        size="sm"
                        className="h-11 rounded-2xl font-bold px-4 border-slate-200 dark:border-slate-800 active:scale-95"
                        onClick={() => {
                            triggerHaptic('light');
                            onOpenChange(false);
                        }}
                    >
                        Close
                    </Button>

                    {pdfUrl && !isGeneratingPdf && (
                        <Button
                            onClick={async () => {
                                triggerHaptic('medium');
                                const container = document.getElementById('pdf-capture-container-dialog');
                                if (container) {
                                    await generateAndSavePdf(container as HTMLElement, `invoice-${invoice.invoiceNumber}.pdf`, 'save');
                                }
                            }}
                            className="h-11 rounded-2xl font-black text-xs sm:text-sm bg-emerald-600 hover:bg-emerald-700 text-white shadow-md active:scale-95 transition-all px-5"
                        >
                            <Download className="mr-2 h-4 w-4" />
                            Download PDF
                        </Button>
                    )}
                </div>
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
