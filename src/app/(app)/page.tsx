
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
import { DashboardOverview } from '@/components/dashboard-overview';
import { RevenueChart } from '@/components/revenue-chart';
import { getQuotations, Quotation } from '@/services/quotationService';
import { getChallans, Challan } from '@/services/challanService';

export default function Home() {
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [quotations, setQuotations] = useState<Quotation[]>([]);
    const [challans, setChallans] = useState<Challan[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
    const { toast } = useToast();
    const invoicePreviewRef = useRef<HTMLDivElement>(null);
    const [invoiceToDownload, setInvoiceToDownload] = useState<Invoice | null>(null);
    const [settings, setSettings] = useState<Settings | null>(null);

    const fetchData = async () => {
        setIsLoading(true);
        try {
            console.log("Fetching home data...");

            // Try fetching invoices
            try {
                const fetchedInvoices = await getInvoices();
                setInvoices(fetchedInvoices);
            } catch (invError) {
                console.error("Error fetching invoices:", invError);
            }

            // Fetch Quotations
            try {
                const fetchedQuotations = await getQuotations();
                setQuotations(fetchedQuotations);
            } catch (qError) {
                console.error("Error fetching quotations:", qError);
            }

            // Fetch Challans
            try {
                const fetchedChallans = await getChallans();
                setChallans(fetchedChallans);
            } catch (cError) {
                console.error("Error fetching challans:", cError);
            }

            // Try fetching settings
            try {
                const fetchedSettings = await getSettings();
                setSettings(fetchedSettings);
            } catch (setError) {
                console.error("Error fetching settings:", setError);
                toast({
                    variant: 'destructive',
                    title: 'Settings Load Failed',
                    description: setError instanceof Error ? setError.message : 'Could not load application settings.',
                });
            }
        } catch (error) {
            console.error("Unexpected error in fetchData:", error);
            toast({
                variant: 'destructive',
                title: 'Data Load Critical Error',
                description: error instanceof Error ? error.message : 'An unexpected error occurred while loading home data.',
            });
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleInvoiceSave = (savedInvoice?: Invoice) => {
        fetchData(); // Refetch all data
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
                    } catch (error) {
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
            <main className="min-h-screen bg-transparent flex flex-col items-center p-4 sm:p-8">
                <div className="w-full max-w-7xl mx-auto space-y-8">
                    <DashboardOverview
                        invoices={invoices}
                        quotations={quotations}
                        challans={challans}
                        settings={settings}
                    />

                    <div className="grid grid-cols-1 gap-8">
                        <RevenueChart invoices={invoices} settings={settings} />
                    </div>

                    <div className="grid grid-cols-1 gap-8">
                        <div className="w-full">
                            <InvoiceForm
                                key={selectedInvoice?.id || 'new'}
                                initialData={selectedInvoice}
                                onInvoiceSave={handleInvoiceSave}
                                onAddNew={handleAddNew}
                            />
                        </div>
                        <div className="w-full">
                            {isLoading ? (
                                <div className="flex items-center justify-center p-12">
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
