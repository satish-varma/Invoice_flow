
'use client'

import { Quotation, getQuotations, deleteQuotation, deleteQuotations } from "@/services/quotationService";
import { QuotationsDataTable } from "./data-table";
import { getColumns } from "./columns";
import Link from 'next/link';
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader, Plus } from "lucide-react";
import React, { useRef, useEffect, useState } from "react";
import { QuotationPreview } from "@/components/quotation-preview";
import { AppShell } from "@/components/app-shell";
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Download, FileSpreadsheet, FileText, Sparkles } from "lucide-react";
import { triggerHaptic } from "@/lib/haptics";


export default function QuotationsPage() {
    const [data, setData] = useState<Quotation[]>([]);
    const [settings, setSettings] = useState<Settings | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [previewingQuotation, setPreviewingQuotation] = useState<Quotation | null>(null);
    const [quotationToGenerate, setQuotationToGenerate] = useState<Quotation | null>(null);
    const [pdfAction, setPdfAction] = useState<'preview' | 'save' | null>(null);

    const quotationPreviewRef = useRef<HTMLDivElement>(null);
    const [pdfUrl, setPdfUrl] = useState<string | null>(null);
    const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [isBulkDownloading, setIsBulkDownloading] = useState(false);

    const [quotationsToDelete, setQuotationsToDelete] = useState<string[] | null>(null);
    const { toast } = useToast();

    const loadData = async () => {
        setIsLoading(true);
        try {
            const [fetchedQuotations, settingsData] = await Promise.all([
                getQuotations(),
                getSettings()
            ]);
            setData(fetchedQuotations);
            setSettings(settingsData);
        } catch (error) {
            console.error(error);
            toast({
                variant: 'destructive',
                title: 'Failed to fetch data',
                description: 'There was an error loading your quotations. Please try again later.',
            });
        } finally {
            setIsLoading(false);
        }
    }

    useEffect(() => {
        loadData();
    }, []);

    useEffect(() => {
        if (quotationToGenerate && settings && pdfAction) {
            const timer = setTimeout(async () => {
                if (quotationPreviewRef.current) {
                    const input = quotationPreviewRef.current;

                    if (pdfAction === 'save') {
                        try {
                            await generateAndSavePdf(input, `quotation-${quotationToGenerate.quotationNumber || 'untitled'}.pdf`);
                        } catch (error) {
                            console.error("Error saving PDF:", error);
                            toast({ variant: "destructive", title: "PDF Generation Failed", description: "There was an error saving the PDF." });
                        } finally {
                            if (!isBulkDownloading) {
                                setTimeout(() => {
                                    setQuotationToGenerate(null);
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
                                setQuotationToGenerate(null);
                                setPdfAction(null);
                            }
                        }
                    }
                }
            }, 100);

            return () => clearTimeout(timer);
        }
    }, [quotationToGenerate, pdfAction, settings, toast, isBulkDownloading]);

    const handlePreview = (quotation: Quotation) => {
        setPreviewingQuotation(quotation);
        setPdfUrl(null);
        setQuotationToGenerate(quotation);
        setPdfAction('preview');
    }

    const handleDownload = (quotation: Quotation) => {
        setQuotationToGenerate(quotation);
        setPdfAction('save');
    };

    const closePreview = () => {
        setPreviewingQuotation(null);
        setPdfUrl(null);
        setIsGeneratingPdf(false);
    }

    const handleDeleteRequest = (quotation: Quotation) => {
        if (quotation.id) {
            setQuotationsToDelete([quotation.id]);
        }
    }

    const handleBulkDeleteRequest = (ids: string[]) => {
        setQuotationsToDelete(ids);
    }

    const handleBulkDownload = async (quotations: Quotation[]) => {
        if (isBulkDownloading) return;
        setIsBulkDownloading(true);

        toast({
            title: "Bulk Download Started",
            description: `Preparing to download ${quotations.length} quotations.`,
        });

        for (const quotation of quotations) {
            setQuotationToGenerate(quotation);
            setPdfAction('save');
            await new Promise(resolve => setTimeout(resolve, 2000));
        }

        setQuotationToGenerate(null);
        setPdfAction(null);
        setIsBulkDownloading(false);
        toast({
            title: "Bulk Download Complete",
            description: `Finished processing ${quotations.length} quotations.`,
        });
    };

    const confirmDelete = async () => {
        if (!quotationsToDelete) return;
        setIsDeleting(true);
        try {
            if (quotationsToDelete.length === 1) {
                await deleteQuotation(quotationsToDelete[0]);
            } else {
                await deleteQuotations(quotationsToDelete);
            }
            toast({
                title: "Success",
                description: `Successfully deleted ${quotationsToDelete.length} quotation(s).`,
            });
            await loadData();
        } catch (error) {
            console.error("Failed to delete quotations:", error);
            toast({
                variant: "destructive",
                title: "Error",
                description: "Failed to delete quotations. Please try again.",
            });
        } finally {
            setQuotationsToDelete(null);
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
                                    <Link href="/quotation">
                                        <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
                                        Back
                                    </Link>
                                </Button>
                                <span className="uppercase text-[10px] sm:text-xs font-black tracking-widest text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-2.5 py-1 rounded-full border border-indigo-200/60 dark:border-indigo-800/60 inline-flex items-center gap-1.5 shadow-xs">
                                    <FileSpreadsheet className="w-3 h-3 text-indigo-500" />
                                    Proposals • Quotations
                                </span>
                                <span className="text-[11px] font-mono font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-2.5 py-1 rounded-full border border-slate-200/60 dark:border-slate-700/60">
                                    {data.length} Total
                                </span>
                            </div>
                            <h1 className="text-2xl sm:text-4xl font-black text-slate-900 dark:text-white tracking-tight">
                                Saved Quotations
                            </h1>
                            <p className="text-xs sm:text-sm font-medium text-slate-500 dark:text-slate-400 mt-1">
                                Manage all your business proposals. Filter, sort, and download in bulk.
                            </p>
                        </div>

                        <Button
                            asChild
                            onClick={() => triggerHaptic('light')}
                            className="h-11 rounded-2xl font-black text-xs sm:text-sm bg-indigo-600 hover:bg-indigo-700 text-white shadow-md active:scale-95 transition-all w-full sm:w-auto"
                        >
                            <Link href="/quotation">
                                <Plus className="mr-2 h-4 w-4" />
                                Create New Quotation
                            </Link>
                        </Button>
                    </div>

                    <QuotationsDataTable
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

            {/* Preview Bottom Sheet */}
            <Dialog open={!!previewingQuotation} onOpenChange={(open) => !open && closePreview()}>
                <DialogContent className="w-full sm:max-w-4xl max-h-[92vh] sm:max-h-[90vh] bottom-0 top-auto sm:top-[50%] sm:bottom-auto translate-y-0 sm:translate-y-[-50%] rounded-t-3xl sm:rounded-3xl p-0 border-0 overflow-hidden bg-white dark:bg-slate-900 shadow-2xl flex flex-col">
                    {/* Drag Handle */}
                    <div className="sm:hidden w-12 h-1.5 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto mt-2.5 mb-1 shrink-0" />

                    <DialogHeader className="px-4 sm:px-6 py-3 sm:py-4 border-b border-slate-100 dark:border-slate-800 text-left">
                        <div className="flex items-center gap-2">
                            <span className="uppercase text-[10px] font-black tracking-widest text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-2.5 py-0.5 rounded-full border border-indigo-200/60 dark:border-indigo-800/60">
                                QUOTATION PREVIEW
                            </span>
                            <span className="text-xs font-mono font-bold text-slate-500">
                                {previewingQuotation?.quotationNumber}
                            </span>
                        </div>
                        <DialogTitle className="text-base sm:text-xl font-black text-slate-900 dark:text-white mt-1">
                            {previewingQuotation?.billToName || 'Business Proposal'}
                        </DialogTitle>
                        <DialogDescription className="sr-only">
                            Preview of quotation {previewingQuotation?.quotationNumber}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="flex-grow overflow-auto bg-slate-100/60 dark:bg-slate-950/60 p-2 sm:p-6 flex items-center justify-center">
                        {isGeneratingPdf ? (
                            <div className="flex flex-col items-center justify-center py-16 gap-3">
                                <Loader className="h-8 w-8 animate-spin text-indigo-600" />
                                <p className="text-sm font-semibold text-slate-500">Generating preview...</p>
                            </div>
                        ) : pdfUrl ? (
                            <iframe 
                                src={pdfUrl} 
                                className="w-full h-full min-h-[50vh] sm:min-h-[60vh] rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white shadow-sm" 
                                title="Quotation Preview" 
                            />
                        ) : (
                            <div className="text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/30 p-6 rounded-2xl border border-rose-200 dark:border-rose-900 text-center">
                                <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                                <p className="text-sm font-bold">Could not generate preview.</p>
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
                                closePreview();
                            }}
                        >
                            Close
                        </Button>

                        {pdfUrl && !isGeneratingPdf && (
                            <Button
                                onClick={async () => {
                                    triggerHaptic('medium');
                                    const container = document.getElementById('pdf-capture-container-dialog');
                                    if (container && previewingQuotation) {
                                      await generateAndSavePdf(container as HTMLElement, `quotation-${previewingQuotation.quotationNumber}.pdf`, 'save');
                                    }
                                }}
                                className="h-11 rounded-2xl font-black text-xs sm:text-sm bg-indigo-600 hover:bg-indigo-700 text-white shadow-md active:scale-95 transition-all px-5"
                            >
                                <Download className="mr-2 h-4 w-4" />
                                Download PDF
                            </Button>
                        )}
                    </div>
                </DialogContent>
                {/* Hidden container for clean capture in dialog */}
                <div style={{ position: 'fixed', left: '-9999px', top: 0, width: '850px' }}>
                    {previewingQuotation && settings && (
                        <div id="pdf-capture-container-dialog" style={{ background: 'white' }}>
                            <QuotationPreview quotation={previewingQuotation} settings={settings} />
                        </div>
                    )}
                </div>
            </Dialog>

            {/* Robust container for PDF generation */}
            {quotationToGenerate && settings && (
                <div 
                    id="pdf-capture-container"
                    style={{ 
                        position: 'fixed', 
                        top: 0, 
                        left: 0, 
                        width: '850px',
                        background: 'white',
                        opacity: 0, 
                        pointerEvents: 'none',
                        zIndex: -9999,
                        overflow: 'visible'
                    }}
                >
                    <QuotationPreview ref={quotationPreviewRef} quotation={quotationToGenerate} settings={settings} />
                </div>
            )}

            {/* Delete Confirmation */}
            <AlertDialog open={!!quotationsToDelete} onOpenChange={(open) => !open && setQuotationsToDelete(null)}>
                <AlertDialogContent className="w-[90vw] sm:max-w-md rounded-3xl p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="text-lg font-black tracking-tight text-slate-900 dark:text-white">Are you absolutely sure?</AlertDialogTitle>
                        <AlertDialogDescription className="text-sm font-medium text-slate-500 dark:text-slate-400">
                            This action cannot be undone. This will permanently delete the selected quotation(s).
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="flex-row gap-2 mt-4 sm:justify-end">
                        <AlertDialogCancel onClick={() => setQuotationsToDelete(null)} className="flex-1 sm:flex-initial h-11 rounded-2xl font-bold border-slate-200 dark:border-slate-800">
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

            {/* Mobile Floating Action Button - Positioned above bottom nav bar (bottom-[84px]) */}
            <div className="sm:hidden fixed bottom-[84px] right-4 z-40 no-print">
                <Button 
                    size="icon" 
                    onClick={() => triggerHaptic('medium')}
                    className="h-14 w-14 rounded-full shadow-2xl bg-indigo-600 hover:bg-indigo-700 text-white border-2 border-white/20 active:scale-90 transition-all flex items-center justify-center" 
                    asChild
                >
                    <Link href="/quotation">
                        <Plus className="h-6 w-6 stroke-[2.5]" />
                    </Link>
                </Button>
            </div>
        </AppShell>
    );
}
