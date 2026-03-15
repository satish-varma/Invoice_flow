
'use client'

import { Challan, getChallans, deleteChallan, deleteChallans } from "@/services/challanService";
import { ChallansDataTable } from "./data-table";
import { getColumns } from "./columns";
import Link from 'next/link';
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader } from "lucide-react";
import React, { useRef, useEffect, useState } from "react";
import { DeliveryChallanPreview } from "@/components/delivery-challan-preview";
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
import { Dialog, DialogContent } from "@/components/ui/dialog";


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
                                setChallanToGenerate(null);
                                setPdfAction(null);
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
        <>
            <main className="min-h-screen bg-background flex flex-col items-center p-4 sm:p-8">
                <div className="w-full max-w-7xl mx-auto">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center sm:justify-between mb-8 gap-4">
                        <div>
                            <Button variant="outline" asChild>
                                <Link href="/delivery-challan">
                                    <ArrowLeft className="mr-2 h-4 w-4" />
                                    Back to Create
                                </Link>
                            </Button>
                            <h1 className="text-3xl sm:text-4xl font-headline font-bold text-primary mt-4">
                                Saved Delivery Challans
                            </h1>
                            <p className="text-muted-foreground text-sm sm:text-base">
                                Manage all your delivery documents. Filter, sort, and download in bulk.
                            </p>
                        </div>
                    </div>
                    <ChallansDataTable
                        columns={columns}
                        data={data}
                        onDeleteSelected={handleBulkDeleteRequest}
                        onDownloadSelected={handleBulkDownload}
                    />
                </div>
            </main>

            {/* Preview Dialog */}
            <Dialog open={!!previewingChallan} onOpenChange={(open) => !open && closePreview()}>
                <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                    {isGeneratingPdf ? (
                        <div className="flex flex-col items-center justify-center py-20">
                            <Loader className="h-8 w-8 animate-spin mb-4" />
                            <p>Generating Preview...</p>
                        </div>
                    ) : pdfUrl ? (
                        <iframe src={pdfUrl} className="w-full h-[70vh] border-none" title="Challan Preview" />
                    ) : (
                        <div className="flex items-center justify-center py-20 text-muted-foreground">
                            Could not generate preview.
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            {/* Hidden container for PDF generation */}
            {challanToGenerate && settings && (
                <div style={{ position: 'absolute', left: '-9999px', top: '-9999px', zIndex: -1 }}>
                    <DeliveryChallanPreview ref={challanPreviewRef} challan={challanToGenerate} settings={settings} />
                </div>
            )}

            {/* Delete Confirmation */}
            <AlertDialog open={!!challansToDelete} onOpenChange={(open) => !open && setChallansToDelete(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This action cannot be undone. This will permanently delete the selected challan(s).
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => setChallansToDelete(null)}>Cancel</AlertDialogCancel>
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
