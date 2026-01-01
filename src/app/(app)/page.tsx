
'use client';

import React, { useState, useEffect, useRef } from 'react';
import { InvoiceForm } from '@/components/invoice-form';
import { InvoiceList } from '@/components/invoice-list';
import { getInvoices, Invoice } from '@/services/invoiceService';
import { useToast } from '@/hooks/use-toast';
import { Loader } from 'lucide-react';
import { InvoicePreview } from '@/components/invoice-preview';
import { getSettings, Settings } from '@/services/settingsService';
import { generateAndSavePdf } from '@/lib/pdf';
import { AppShell } from '@/components/app-shell';

export default function Home() {
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
    const { toast } = useToast();
    const invoicePreviewRef = useRef<HTMLDivElement>(null);
    const [invoiceToDownload, setInvoiceToDownload] = useState<Invoice | null>(null);
    const [settings, setSettings] = useState<Settings | null>(null);


    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            try {
                const [fetchedInvoices, fetchedSettings] = await Promise.all([
                    getInvoices(),
                    getSettings()
                ]);
                setInvoices(fetchedInvoices);
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
        fetchData();
    }, [toast]);

    const handleInvoiceSave = (savedInvoice?: Invoice) => {
        const fetchData = async () => {
            const [fetchedInvoices, fetchedSettings] = await Promise.all([
                getInvoices(),
                getSettings()
            ]);
            setInvoices(fetchedInvoices);
            setSettings(fetchedSettings);
        }
        fetchData();
        setSelectedInvoice(null); // Clear form after saving
        if (savedInvoice) {
            handleDownload(savedInvoice);
        }
    };

    const handleSelectInvoice = (invoice: Invoice) => {
        setSelectedInvoice(invoice);
    }
    
    const handleAddNew = () => {
        setSelectedInvoice(null);
    }

    const handleDownload = (invoice: Invoice) => {
        setInvoiceToDownload(invoice);
    };

    useEffect(() => {
        if (invoiceToDownload && settings) {
            // Use a timeout to ensure the ref is current and the component has rendered.
            const timer = setTimeout(async () => {
                if (invoicePreviewRef.current) {
                    const element = invoicePreviewRef.current;
                    const fileName = `invoice-${invoiceToDownload.invoiceNumber || 'untitled'}.pdf`;
                    
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
                        setInvoiceToDownload(null);
                    }
                }
            }, 100); // 100ms delay

            return () => clearTimeout(timer);
        }
    }, [invoiceToDownload, settings, toast]);

    return (
        <AppShell>
            <main className="min-h-screen bg-background flex flex-col items-center p-4 sm:p-8">
                <div className="w-full max-w-7xl mx-auto">
                     <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        <div className="lg:col-span-2">
                            {isLoading || !settings ? (
                                 <div className="flex items-center justify-center h-[500px]">
                                    <Loader className="h-8 w-8 animate-spin" />
                                </div>
                            ) : (
                                <InvoiceForm 
                                    key={selectedInvoice?.id || 'new'} 
                                    initialData={selectedInvoice} 
                                    onInvoiceSave={handleInvoiceSave} 
                                    onAddNew={handleAddNew}
                                    settings={settings}
                                />
                            )}
                        </div>
                        <div className="lg:col-span-1">
                            {isLoading ? (
                                <div className="flex items-center justify-center h-full">
                                    <Loader className="h-8 w-8 animate-spin" />
                                </div>
                            ) : (
                                <InvoiceList 
                                    invoices={invoices} 
                                    onSelectInvoice={handleSelectInvoice}
                                    onDownloadInvoice={handleDownload}
                                />
                            )}
                        </div>
                        {/* This component is rendered off-screen and used for PDF generation */}
                        {invoiceToDownload && settings && (
                            <div style={{ position: 'absolute', left: '-9999px', top: '-9999px', zIndex: -1 }}>
                                <InvoicePreview ref={invoicePreviewRef} invoice={invoiceToDownload} settings={settings} />
                            </div>
                        )}
                    </div>
                </div>
            </main>
        </AppShell>
    );
}
