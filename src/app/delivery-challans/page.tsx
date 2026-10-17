
'use client'

import { Challan, getChallans, deleteChallan, deleteChallans } from "@/services/challanService";
import { ChallansDataTable } from "./data-table";
import { getColumns } from "./columns";
import Link from 'next/link';
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader, Plus, Sparkles, FileText } from "lucide-react";
import React, { useRef, useEffect, useState } from "react";
import { DeliveryChallanPreview } from "@/components/delivery-challan-preview";
import { AppShell } from "@/components/app-shell";
import { triggerHaptic } from "@/lib/haptics";
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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Download } from "lucide-react";


export default function DeliveryChallansPage() {
    const [data, setData] = useState<Challan[]>([]);
    const [settings, setSettings] = useState<Settings | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [previewingChallan, setPreviewingChallan] = useState<Challan | null>(null);
    const [challanToGenerate, setChallanToGenerate] = useState<Challan | null>(null);
    const [pdfAction, setPdfAction] = useState<'preview' | 'save' | null>(null);

    const challanPreviewRef = useRef<HTMLDivElement>(null);
    const [pdfUrl, setPdfUrl] = useState<string | null>(null);
    const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [isBulkDownloading, setIsBulkDownloading] = useState(false);

    const [challansToDelete, setChallansToDelete] = useState<string[] | null>(null);
    const { toast } = useToast();

    const loadData = async () => {
        setIsLoading(true);
        try {
            const [fetchedChallans, settingsData] = await Promise.all([
                getChallans(),
                getSettings()
            ]);
            setData(fetchedChallans);
            setSettings(settingsData);
        } catch (error) {
            console.error(error);
            toast({
                variant: 'destructive',
                title: 'Failed to fetch data',
                description: 'There was an error loading your delivery challans. Please try again later.',
            });
        } finally {
            setIsLoading(false);
        }
    }

    useEffect(() => {
        loadData();
    }, []);

    useEffect(() => {
        if (challanToGenerate && settings && pdfAction) {
            const timer = setTimeout(async () => {
                if (challanPreviewRef.current) {
                    const input = challanPreviewRef.current;

                    if (pdfAction === 'save') {
                        try {
                            await generateAndSavePdf(input, `challan-${challanToGenerate.dcNumber || 'untitled'}.pdf`);
                        } catch (error) {
                            console.error("Error saving PDF:", error);
                            toast({ variant: "destructive", title: "PDF Generation Failed", description: "There was an error saving the PDF." });
                        } finally {
                            if (!isBulkDownloading) {
                                setTimeout(() => {
                                    setChallanToGenerate(null);
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
                                setChallanToGenerate(null);
                                setPdfAction(null);
                            }
                        }
                    }
                }
            }, 100);

            return () => clearTimeout(timer);
        }
    }, [challanToGenerate, pdfAction, settings, toast, isBulkDownloading]);

    const handlePreview = (challan: Challan) => {
        setPreviewingChallan(challan);
        setPdfUrl(null);
        setChallanToGenerate(challan);
        setPdfAction('preview');
    }

    const handleDownload = (challan: Challan) => {
        setChallanToGenerate(challan);
        setPdfAction('save');
    };

    const closePreview = () => {
        setPreviewingChallan(null);
        setPdfUrl(null);
        setIsGeneratingPdf(false);
    }

    const handleDeleteRequest = (challan: Challan) => {
        if (challan.id) {
            setChallansToDelete([challan.id]);
        }
    }

    const handleBulkDeleteRequest = (ids: string[]) => {
        setChallansToDelete(ids);
    }

    const handleBulkDownload = async (challans: Challan[]) => {
        if (isBulkDownloading) return;
        setIsBulkDownloading(true);

        toast({
            title: "Bulk Download Started",
            description: `Preparing to download ${challans.length} challans.`,
        });

        for (const challan of challans) {
            setChallanToGenerate(challan);
            setPdfAction('save');
            await new Promise(resolve => setTimeout(resolve, 2000));
        }

        setChallanToGenerate(null);
        setPdfAction(null);
        setIsBulkDownloading(false);
        toast({
            title: "Bulk Download Complete",
            description: `Finished processing ${challans.length} challans.`,
        });
    };

    const confirmDelete = async () => {
        if (!challansToDelete) return;
        setIsDeleting(true);
        try {
            if (challansToDelete.length === 1) {
                await deleteChallan(challansToDelete[0]);
            } else {
                await deleteChallans(challansToDelete);
            }
            toast({
                title: "Success",
                description: `Successfully deleted ${challansToDelete.length} challan(s).`,
            });
            await loadData();
        } catch (error) {
            console.error("Failed to delete challans:", error);
            toast({
                variant: "destructive",
                title: "Error",
                description: "Failed to delete challans. Please try again.",
            });
        } finally {
            setChallansToDelete(null);
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
            <main className="min-h-screen bg-transparent flex flex-col items-center p-3 sm:p-8">
                <div className="w-full max-w-7xl mx-auto space-y-6">
                    {/* Mobile Large Title Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <div className="space-y-1">
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => {
                                        triggerHaptic('light');
                                        window.history.back();
                                    }}
                                    className="sm:hidden p-2 -ml-2 rounded-xl text-slate-600 dark:text-slate-300 active:scale-95 transition-all"
                                >
                                    <ArrowLeft className="h-5 w-5" />
                                </button>
                                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-gradient-to-r from-blue-500/10 via-indigo-500/10 to-blue-500/10 border border-blue-500/20 text-blue-600 dark:text-blue-400 text-[10px] sm:text-xs font-black tracking-widest uppercase shadow-xs">
                                    <Sparkles className="h-3 w-3 animate-pulse" />
                                    DELIVERY CHALLANS ARCHIVE
                                </div>
                            </div>

                            <h1 className="text-2xl sm:text-4xl font-black text-slate-900 dark:text-white tracking-tight">
                                Saved Delivery Challans
                            </h1>
                            <p className="text-slate-500 dark:text-slate-400 text-xs sm:text-sm font-medium">
                                Manage all delivery documents. Filter, inspect, and download in bulk
                            </p>
                        </div>

                        <div className="flex items-center gap-2">
                            <Button
                                variant="outline"
                                asChild
                                className="hidden sm:inline-flex rounded-2xl h-10 border-slate-200 dark:border-slate-800 text-xs font-bold"
                            >
                                <Link href="/delivery-challan" onClick={() => triggerHaptic('light')}>
                                    <ArrowLeft className="mr-2 h-4 w-4" />
                                    Back to Create
                                </Link>
                            </Button>
                            <Button
                                asChild
                                className="h-11 sm:h-10 px-5 rounded-2xl bg-gradient-to-r from-[#181156] to-[#241775] text-white font-bold text-xs sm:text-sm shadow-md active:scale-95 transition-all"
                            >
                                <Link href="/delivery-challan" onClick={() => triggerHaptic('light')}>
                                    <Plus className="mr-2 h-4 w-4" />
                                    Create Challan
                                </Link>
                            </Button>
                        </div>
                    </div>

                    <div data-card="true" className="theme-card rounded-2xl sm:rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-[0_4px_16px_-4px_rgba(0,0,0,0.06)] p-3 sm:p-6">
                        <ChallansDataTable
                            columns={columns}
                            data={data}
                            onDeleteSelected={handleBulkDeleteRequest}
                            onDownloadSelected={handleBulkDownload}
                            onPreview={handlePreview}
                            onDownloadSingle={handleDownload}
                            onDeleteSingle={handleDeleteRequest}
                        />
                    </div>
                </div>
            </main>

            {/* Preview Bottom Sheet Dialog */}
            <Dialog open={!!previewingChallan} onOpenChange={(open) => !open && closePreview()}>
                <DialogContent className="w-full sm:max-w-4xl rounded-t-3xl sm:rounded-3xl bottom-0 top-auto sm:top-[50%] sm:bottom-auto translate-y-0 sm:translate-y-[-50%] p-0 border-0 overflow-hidden bg-white dark:bg-slate-900 shadow-2xl flex flex-col h-[90vh]">
                    {/* Native Drag Handle */}
                    <div className="sm:hidden w-12 h-1.5 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto mt-2.5 mb-1 shrink-0" />

                    <div className="px-5 sm:px-6 pt-3 sm:pt-5 pb-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                        <DialogTitle className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                            Challan Preview: {previewingChallan?.dcNumber}
                        </DialogTitle>
                    </div>

                    <div className="flex-grow overflow-auto bg-slate-100/50 dark:bg-slate-950 p-2 sm:p-6 flex items-center justify-center">
                        {isGeneratingPdf ? (
                            <div className="flex flex-col items-center justify-center py-20 text-slate-500">
                                <Loader className="h-8 w-8 animate-spin mb-3 text-indigo-600" />
                                <p className="text-sm font-medium">Generating Preview...</p>
                            </div>
                        ) : pdfUrl ? (
                            <iframe src={pdfUrl} className="w-full h-full border-none rounded-xl shadow-sm" title="Challan Preview" />
                        ) : (
                            <div className="flex items-center justify-center py-20 text-slate-400 text-sm">
                                Could not render document preview.
                            </div>
                        )}
                    </div>

                    {pdfUrl && !isGeneratingPdf && (
                        <div className="sticky bottom-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md p-4 sm:p-5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2.5 pb-[max(1rem,env(safe-area-inset-bottom))]">
                            <Button
                                variant="outline"
                                onClick={() => {
                                    triggerHaptic('light');
                                    closePreview();
                                }}
                                className="h-11 rounded-2xl font-bold text-xs px-5 border-slate-200 dark:border-slate-800"
                            >
                                Close
                            </Button>
                            <button
                                type="button"
                                onClick={async () => {
                                    triggerHaptic('light');
                                    const container = document.getElementById('pdf-capture-container-dialog');
                                    if (container && previewingChallan) {
                                      await generateAndSavePdf(container as HTMLElement, `challan-${previewingChallan.dcNumber}.pdf`, 'save');
                                    }
                                }}
                                className="inline-flex items-center justify-center gap-2 h-11 px-6 rounded-2xl bg-gradient-to-r from-[#181156] to-[#241775] text-white font-bold text-xs shadow-md active:scale-95 transition-all"
                            >
                                <Download className="h-4 w-4" />
                                <span>Download PDF</span>
                            </button>
                        </div>
                    )}
                </DialogContent>
                {/* Hidden container for clean capture in dialog */}
                <div style={{ position: 'fixed', left: '-9999px', top: 0, width: '850px' }}>
                    {previewingChallan && settings && (
                        <div id="pdf-capture-container-dialog" style={{ background: 'white' }}>
                            <DeliveryChallanPreview challan={previewingChallan} settings={settings} />
                        </div>
                    )}
                </div>
            </Dialog>

            {/* Robust container for PDF generation */}
            {challanToGenerate && settings && (
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
                    <DeliveryChallanPreview ref={challanPreviewRef} challan={challanToGenerate} settings={settings} />
                </div>
            )}

            {/* Delete Confirmation Alert */}
            <AlertDialog open={!!challansToDelete} onOpenChange={(open) => !open && setChallansToDelete(null)}>
                <AlertDialogContent className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl p-6">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="text-xl font-black text-slate-900 dark:text-white">
                            Delete Challan(s)?
                        </AlertDialogTitle>
                        <AlertDialogDescription className="text-sm text-slate-600 dark:text-slate-400">
                            This action cannot be undone. This will permanently delete the selected challan(s).
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="mt-4 gap-2">
                        <AlertDialogCancel
                            onClick={() => {
                                triggerHaptic('light');
                                setChallansToDelete(null);
                            }}
                            className="h-11 rounded-2xl font-bold text-xs"
                        >
                            Cancel
                        </AlertDialogCancel>
                        <AlertDialogAction
                            onClick={() => {
                                triggerHaptic('light');
                                confirmDelete();
                            }}
                            disabled={isDeleting}
                            className="h-11 rounded-2xl font-bold text-xs bg-rose-600 hover:bg-rose-700 text-white shadow-md"
                        >
                            {isDeleting ? <Loader className="mr-2 h-4 w-4 animate-spin" /> : null}
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Mobile Floating Action Button - Positioned safely above bottom nav dock at bottom-[84px] */}
            <div className="sm:hidden fixed bottom-[84px] right-4 z-40 no-print">
                <Button
                    size="icon"
                    className="h-14 w-14 rounded-2xl shadow-xl bg-gradient-to-tr from-[#181156] to-[#241775] text-white active:scale-90 transition-transform"
                    asChild
                    onClick={() => triggerHaptic('light')}
                >
                    <Link href="/delivery-challan">
                        <Plus className="h-6 w-6 stroke-[2.5]" />
                    </Link>
                </Button>
            </div>
        </AppShell>
    );
}
