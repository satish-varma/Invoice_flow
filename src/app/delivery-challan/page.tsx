
'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Loader } from 'lucide-react';
import { getSettings, Settings } from '@/services/settingsService';
import { generateAndSavePdf } from '@/lib/pdf';
import { DeliveryChallanForm } from '@/components/delivery-challan-form';
import { ChallanList } from '@/components/challan-list';
import { Challan, getChallans } from '@/services/challanService';
import { DeliveryChallanPreview } from '@/components/delivery-challan-preview';

export default function DeliveryChallanPage() {
    const [challans, setChallans] = useState<Challan[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedChallan, setSelectedChallan] = useState<Challan | null>(null);
    const { toast } = useToast();
    const challanPreviewRef = useRef<HTMLDivElement>(null);
    const [challanToDownload, setChallanToDownload] = useState<Challan | null>(null);
    const [settings, setSettings] = useState<Settings | null>(null);


    const fetchData = async () => {
        setIsLoading(true);
        try {
            const [fetchedChallans, fetchedSettings] = await Promise.all([
                getChallans(),
                getSettings()
            ]);
            setChallans(fetchedChallans);
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

    const handleChallanSave = (savedChallan?: Challan) => {
        fetchData();
        setSelectedChallan(null); // Clear form after saving
        if (savedChallan) {
            handleDownload(savedChallan);
        }
    };

    const handleSelectChallan = (challan: Challan) => {
        setSelectedChallan(challan);
    }
    
    const handleAddNew = () => {
        setSelectedChallan(null);
    }

    const handleDownload = (challan: Challan) => {
        setChallanToDownload(challan);
    };

    useEffect(() => {
        const createPdf = async () => {
            if (challanToDownload && challanPreviewRef.current && settings) {
                const element = challanPreviewRef.current;
                const fileName = `challan-${challanToDownload.dcNumber || 'untitled'}.pdf`;
                
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
                    setChallanToDownload(null);
                }
            }
        };

        // Delay generation slightly to ensure component is fully rendered with the correct data
        if (challanToDownload) {
            setTimeout(createPdf, 50);
        }
    }, [challanToDownload, settings, toast]);

    return (
        <main className="min-h-screen bg-background flex flex-col items-center p-4 sm:p-8">
            <div className="w-full max-w-7xl mx-auto">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div className="lg:col-span-2">
                        <DeliveryChallanForm
                          key={selectedChallan?.id || 'new'} 
                          initialData={selectedChallan} 
                          onChallanSave={handleChallanSave} 
                          onAddNew={handleAddNew}
                        />
                    </div>
                    <div className="lg:col-span-1">
                        {isLoading ? (
                            <div className="flex items-center justify-center h-full">
                                <Loader className="h-8 w-8 animate-spin" />
                            </div>
                        ) : (
                            <ChallanList 
                                challans={challans} 
                                onSelectChallan={handleSelectChallan}
                                onDownloadChallan={handleDownload}
                            />
                        )}
                    </div>
                     {/* This component is rendered off-screen and used for PDF generation */}
                     {challanToDownload && settings && (
                        <div style={{ position: 'absolute', left: '-9999px', top: '-9999px', zIndex: -1 }}>
                            <DeliveryChallanPreview ref={challanPreviewRef} challan={challanToDownload} settings={settings} />
                        </div>
                    )}
                </div>
            </div>
        </main>
    );
}
