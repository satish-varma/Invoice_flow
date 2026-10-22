
'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Loader, ArrowLeft, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { triggerHaptic } from '@/lib/haptics';
import { getSettings, Settings } from '@/services/settingsService';
import { generateAndSavePdf } from '@/lib/pdf';
import { AppShell } from '@/components/app-shell';
import { OfferLetterForm } from '@/components/offer-letter-form';
import { OfferLetterList } from '@/components/offer-letter-list';
import { OfferLetterPreview } from '@/components/offer-letter-preview';
import { getOfferLetters, OfferLetter, deleteOfferLetter } from '@/services/offerLetterService';
import { useAuth } from '@/contexts/AuthContext';

export default function OfferLetterPage() {
    const { role, isReadOnly } = useAuth();
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
        if (isReadOnly || role === 'guest') {
            toast({ variant: 'destructive', title: 'Read-Only Mode', description: 'Guest account cannot delete offer letters.' });
            return;
        }
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
            <div className="w-full max-w-7xl mx-auto px-4 sm:px-8 py-4 sm:py-8 space-y-6">
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
                                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-gradient-to-r from-violet-500/10 via-purple-500/10 to-violet-500/10 border border-violet-500/20 text-violet-600 dark:text-violet-400 text-[10px] sm:text-xs font-black tracking-widest uppercase shadow-xs">
                                    <Sparkles className="h-3 w-3 animate-pulse" />
                                    HR & RECRUITING
                                </div>
                            </div>

                            <h1 className="text-2xl sm:text-4xl font-black text-slate-900 dark:text-white tracking-tight">
                                Offer Letter Generator
                            </h1>
                            <p className="text-slate-500 dark:text-slate-400 text-xs sm:text-sm font-medium">
                                Generate professional employment offer letters with CTC breakdown & PDF download
                            </p>
                        </div>

                        <div className="hidden sm:flex items-center gap-2">
                            <Link
                                href="/"
                                onClick={() => triggerHaptic('light')}
                                className="inline-flex items-center gap-2 h-10 px-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-bold text-slate-700 dark:text-slate-200 shadow-2xs hover:bg-slate-50 active:scale-95 transition-all"
                            >
                                <ArrowLeft className="h-4 w-4" />
                                <span>Back to Home</span>
                            </Link>
                        </div>
                    </div>

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
                                    <Loader className="h-8 w-8 animate-spin text-violet-600" />
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
        </AppShell>
    );
}
