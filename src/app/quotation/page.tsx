
'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Loader } from 'lucide-react';
import { getSettings, Settings } from '@/services/settingsService';
import { generateAndSavePdf } from '@/lib/pdf';
import { QuotationForm } from '@/components/quotation-form';
import { QuotationList } from '@/components/quotation-list';
import { Quotation, getQuotations } from '@/services/quotationService';
import { QuotationPreview } from '@/components/quotation-preview';
import { AppShell } from '@/components/app-shell';

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
            }, 100); // 100ms delay

            return () => clearTimeout(timer);
        }
    }, [quotationToDownload, settings, toast]);

    return (
        <AppShell>
            <main className="min-h-screen bg-background flex flex-col items-center p-4 sm:p-8">
                <div className="w-full max-w-7xl mx-auto">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        <div className="lg:col-span-2">
                            <QuotationForm
                            key={selectedQuotation?.id || 'new'} 
                            initialData={selectedQuotation} 
                            onQuotationSave={handleQuotationSave} 
                            onAddNew={handleAddNew}
                            />
                        </div>
                        <div className="lg:col-span-1">
                            {isLoading ? (
                                <div className="flex items-center justify-center h-full">
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
                        {/* This component is rendered off-screen and used for PDF generation */}
                        {quotationToDownload && settings && (
                            <div style={{ position: 'absolute', left: '-9999px', top: '-9999px', zIndex: -1 }}>
                                <QuotationPreview ref={quotationPreviewRef} quotation={quotationToDownload} settings={settings} />
                            </div>
                        )}
                    </div>
                </div>
            </main>
        </AppShell>
    );
}
