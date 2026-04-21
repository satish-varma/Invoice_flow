
'use client'

import { Quotation, getQuotations, deleteQuotation, deleteQuotations } from "@/services/quotationService";
import { QuotationsDataTable } from "./data-table";
import { getColumns } from "./columns";
import Link from 'next/link';
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader } from "lucide-react";
import React, { useRef, useEffect, useState } from "react";
import { QuotationPreview } from "@/components/quotation-preview";
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
        <>
            <main className="min-h-screen bg-background flex flex-col items-center p-4 sm:p-8">
                <div className="w-full max-w-7xl mx-auto">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center sm:justify-between mb-8 gap-4">
                        <div>
                            <Button variant="outline" asChild>
                                <Link href="/quotation">
                                    <ArrowLeft className="mr-2 h-4 w-4" />
                                    Back to Create
                                </Link>
                            </Button>
                            <h1 className="text-3xl sm:text-4xl font-headline font-bold text-primary mt-4">
                                Saved Quotations
                            </h1>
                            <p className="text-muted-foreground text-sm sm:text-base">
                                Manage all your business proposals. Filter, sort, and download in bulk.
                            </p>
                        </div>
                    </div>
                    <QuotationsDataTable
                        columns={columns}
                        data={data}
                        onDeleteSelected={handleBulkDeleteRequest}
                        onDownloadSelected={handleBulkDownload}
                    />
                </div>
            </main>

            {/* Preview Dialog */}
            <Dialog open={!!previewingQuotation} onOpenChange={(open) => !open && closePreview()}>
                <DialogContent className="max-w-4xl h-[90vh] flex flex-col">
                    <DialogHeader>
                        <DialogTitle>Quotation Preview: {previewingQuotation?.quotationNumber}</DialogTitle>
                    </DialogHeader>
                    <div className="flex-grow overflow-auto bg-muted/20 p-4 sm:p-8 flex items-center justify-center rounded-md border">
                        {isGeneratingPdf ? (
                            <div className="flex flex-col items-center justify-center py-20">
                                <Loader className="h-8 w-8 animate-spin mb-4" />
                                <p>Generating Preview...</p>
                            </div>
                        ) : pdfUrl ? (
                            <iframe src={pdfUrl} className="w-full h-full border-none shadow-sm" title="Quotation Preview" />
                        ) : (
                            <div className="flex items-center justify-center py-20 text-muted-foreground">
                                Could not generate preview.
                            </div>
                        )}
                    </div>
                    {pdfUrl && !isGeneratingPdf && (
                        <div className="flex justify-end pt-4 mt-auto border-t">
                            <Button
                                onClick={async () => {
                                    const container = document.getElementById('pdf-capture-container-dialog');
                                    if (container && previewingQuotation) {
                                      await generateAndSavePdf(container as HTMLElement, `quotation-${previewingQuotation.quotationNumber}.pdf`, 'save');
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
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This action cannot be undone. This will permanently delete the selected quotation(s).
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => setQuotationsToDelete(null)}>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={confirmDelete} disabled={isDeleting} className="bg-destructive hover:bg-destructive/90">
                            {isDeleting ? <Loader className="mr-2 h-4 w-4 animate-spin" /> : null}
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}
