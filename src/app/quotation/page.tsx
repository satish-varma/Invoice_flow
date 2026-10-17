
'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Loader, ArrowLeft, FileSpreadsheet, Sparkles } from 'lucide-react';
import { getSettings, Settings } from '@/services/settingsService';
import { generateAndSavePdf } from '@/lib/pdf';
import { QuotationForm } from '@/components/quotation-form';
import { QuotationList } from '@/components/quotation-list';
import { Quotation, getQuotations } from '@/services/quotationService';
import { QuotationPreview } from '@/components/quotation-preview';
import { AppShell } from '@/components/app-shell';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { triggerHaptic } from '@/lib/haptics';

export default function QuotationPage() {
    const [quotations, setQuotations] = useState<Quotation[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedQuotation, setSelectedQuotation] = useState<Quotation | null>(null);
    const { toast } = useToast();
    const quotationPreviewRef = useRef<HTMLDivElement>(null);
    const [quotationToDownload, setQuotationToDownload] = useState<Quotation | null>(null);
    const [settings, setSettings] = useState<Settings | null>(null);


    const fetchData = async () => {
        setIsLoading(true);
        try {
            const [fetchedQuotations, fetchedSettings] = await Promise.all([
                getQuotations(),
                getSettings()
            ]);
            setQuotations(fetchedQuotations);
            setSettings(fetchedSettings);
        } catch (error) {
            console.error(error);
            toast({
                variant: 'destructive',
                title: 'Failed to fetch data',
                description: 'There was an error loading your data. Please try again later.',
            });
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleQuotationSave = (savedQuotation?: Quotation) => {
        fetchData();
        setSelectedQuotation(null); // Clear form after saving
        if (savedQuotation) {
            handleDownload(savedQuotation);
        }
    };

    const handleSelectQuotation = (quotation: Quotation) => {
        setSelectedQuotation(quotation);
    }
    
    const handleAddNew = () => {
        setSelectedQuotation(null);
    }

    const handleDownload = (quotation: Quotation) => {
        setQuotationToDownload(quotation);
    };

    useEffect(() => {
        if (quotationToDownload && settings) {
            // Use a timeout to ensure the ref is current and the component has rendered.
            const timer = setTimeout(async () => {
                if (quotationPreviewRef.current) {
                    const element = quotationPreviewRef.current;
                    const fileName = `quotation-${quotationToDownload.quotationNumber || 'untitled'}.pdf`;
                    
                    try {
                        await generateAndSavePdf(element, fileName);
                    } catch(error) {
                         console.error("Error generating PDF:", error);
                         toast({
                             variant: 'destructive',
                             title: 'Download Failed',
                             description: 'There was an error generating the PDF for download.',
                         });
                    } finally {
                        setQuotationToDownload(null);
                    }
                }
            }, 1000); // 1000ms delay

            return () => clearTimeout(timer);
        }
    }, [quotationToDownload, settings, toast]);

    return (
        <AppShell>
            <main className="min-h-screen bg-slate-50/50 dark:bg-slate-950 flex flex-col items-center p-3 sm:p-8 pb-32">
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
                                    <Link href="/quotations">
                                        <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
                                        All Proposals
                                    </Link>
                                </Button>
                                <span className="uppercase text-[10px] sm:text-xs font-black tracking-widest text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-2.5 py-1 rounded-full border border-indigo-200/60 dark:border-indigo-800/60 inline-flex items-center gap-1.5 shadow-xs">
                                    <Sparkles className="w-3 h-3 text-indigo-500" />
                                    Proposal Generator
                                </span>
                            </div>
                            <h1 className="text-2xl sm:text-4xl font-black text-slate-900 dark:text-white tracking-tight">
                                {selectedQuotation ? `Edit Quotation ${selectedQuotation.quotationNumber}` : 'Create Quotation'}
                            </h1>
                            <p className="text-xs sm:text-sm font-medium text-slate-500 dark:text-slate-400 mt-1">
                                Fill in details, calculate item prices, and generate client-ready PDF proposals instantly.
                            </p>
                        </div>

                        <Button
                            variant="outline"
                            asChild
                            onClick={() => triggerHaptic('light')}
                            className="h-11 rounded-2xl font-black text-xs sm:text-sm border-slate-200 dark:border-slate-800 shadow-xs active:scale-95 transition-all w-full sm:w-auto"
                        >
                            <Link href="/quotations">
                                <FileSpreadsheet className="mr-2 h-4 w-4 text-indigo-600" />
                                View All ({quotations.length})
                            </Link>
                        </Button>
                    </div>

                    <div className="grid grid-cols-1 gap-8">
                        <div className="w-full">
                            <QuotationForm
                            key={selectedQuotation?.id || 'new'} 
                            initialData={selectedQuotation} 
                            onQuotationSave={handleQuotationSave} 
                            onAddNew={handleAddNew}
                            />
                        </div>
                        <div className="w-full">
                            {isLoading ? (
                                <div className="flex items-center justify-center p-12">
                                    <Loader className="h-8 w-8 animate-spin" />
                                </div>
                            ) : (
                                <QuotationList 
                                    quotations={quotations} 
                                    onSelectQuotation={handleSelectQuotation}
                                    onDownloadQuotation={handleDownload}
                                />
                            )}
                        </div>
                    </div>
                     {/* This component is rendered off-screen and used for PDF generation */}
                     {quotationToDownload && settings && (
                        <div 
                            id="pdf-capture-container"
                            style={{ 
                                position: 'fixed', 
                                top: 0, 
                                left: 0, 
                                width: '850px', 
                                opacity: 0.01, 
                                pointerEvents: 'none',
                                zIndex: -9999 
                            }}
                        >
                            <QuotationPreview ref={quotationPreviewRef} quotation={quotationToDownload} settings={settings} />
                        </div>
                    )}
                </div>
            </main>
        </AppShell>
    );
}
