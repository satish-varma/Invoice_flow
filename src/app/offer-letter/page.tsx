
'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Loader } from 'lucide-react';
import { getSettings, Settings } from '@/services/settingsService';
import { generateAndSavePdf } from '@/lib/pdf';
import { AppShell } from '@/components/app-shell';
import { OfferLetterForm } from '@/components/offer-letter-form';
import { OfferLetterList } from '@/components/offer-letter-list';
import { OfferLetterPreview } from '@/components/offer-letter-preview';
import { getOfferLetters, OfferLetter, deleteOfferLetter } from '@/services/offerLetterService';

export default function OfferLetterPage() {
    const [offerLetters, setOfferLetters] = useState<OfferLetter[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedOffer, setSelectedOffer] = useState<OfferLetter | null>(null);
    const { toast } = useToast();
    const previewRef = useRef<HTMLDivElement>(null);
    const [offerToDownload, setOfferToDownload] = useState<OfferLetter | null>(null);
    const [settings, setSettings] = useState<Settings | null>(null);

    const fetchData = async () => {
        setIsLoading(true);
        try {
            const [fetchedOffers, fetchedSettings] = await Promise.all([
                getOfferLetters(),
                getSettings()
            ]);
            setOfferLetters(fetchedOffers);
            setSettings(fetchedSettings);
        } catch (error) {
            console.error(error);
            toast({
                variant: 'destructive',
                title: 'Data Error',
                description: 'Failed to load offer letters.',
            });
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleSave = (savedOffer?: OfferLetter) => {
        fetchData();
        setSelectedOffer(null);
        if (savedOffer) {
            handleDownload(savedOffer);
        }
    };

    const handleDownload = (offer: OfferLetter) => {
        setOfferToDownload(offer);
    };

    const handleDelete = async (id: string) => {
        if (confirm('Are you sure you want to delete this offer letter?')) {
            try {
                await deleteOfferLetter(id);
                toast({ title: 'Deleted', description: 'Offer letter removed successfully.' });
                fetchData();
            } catch (error) {
                toast({ variant: 'destructive', title: 'Error', description: 'Failed to delete.' });
            }
        }
    };

    useEffect(() => {
        if (offerToDownload && settings) {
            const timer = setTimeout(async () => {
                if (previewRef.current) {
                    const fileName = `offer-letter-${offerToDownload.employeeName.replace(/\s+/g, '-').toLowerCase()}.pdf`;
                    try {
                        await generateAndSavePdf(previewRef.current, fileName);
                    } catch(error) {
                         toast({ variant: 'destructive', title: 'Download Failed' });
                    } finally {
                        setOfferToDownload(null);
                    }
                }
            }, 500);
            return () => clearTimeout(timer);
        }
    }, [offerToDownload, settings, toast]);

    return (
        <AppShell>
            <main className="min-h-screen bg-background flex flex-col items-center p-4 sm:p-8">
                <div className="w-full max-w-7xl mx-auto">
                    <div className="grid grid-cols-1 gap-8">
                        <div className="w-full">
                            <OfferLetterForm 
                                key={selectedOffer?.id || 'new'} 
                                initialData={selectedOffer} 
                                onOfferSave={handleSave} 
                                onAddNew={() => setSelectedOffer(null)}
                            />
                        </div>
                        <div className="w-full">
                            {isLoading ? (
                                <div className="flex items-center justify-center p-12">
                                    <Loader className="h-8 w-8 animate-spin" />
                                </div>
                            ) : (
                                <OfferLetterList 
                                    offerLetters={offerLetters} 
                                    onSelectOffer={setSelectedOffer}
                                    onDownloadOffer={handleDownload}
                                    onDeleteOffer={handleDelete}
                                />
                            )}
                        </div>
                    </div>
                </div>

                {offerToDownload && settings && (
                    <div style={{ position: 'fixed', left: '-9999px', top: '-9999px' }}>
                        <OfferLetterPreview ref={previewRef} offerLetter={offerToDownload} settings={settings} />
                    </div>
                )}
            </main>
        </AppShell>
    );
}
