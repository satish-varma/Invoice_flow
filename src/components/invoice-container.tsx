
"use client";

import React, { useState, useEffect, useRef } from 'react';
import { InvoiceForm } from '@/components/invoice-form';
import { InvoiceList } from '@/components/invoice-list';
import { getInvoices, Invoice } from '@/services/invoiceService';
import { useToast } from '@/hooks/use-toast';
import { Loader } from 'lucide-react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { InvoicePreview } from './invoice-preview';
import { getSettings, Settings } from '@/services/settingsService';

export function InvoiceContainer() {
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
    const { toast } = useToast();
    const invoicePreviewRef = useRef<HTMLDivElement>(null);
    const [invoiceToDownload, setInvoiceToDownload] = useState<Invoice | null>(null);
    const [settings, setSettings] = useState<Settings | null>(null);


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

    useEffect(() => {
        fetchData();
    }, []);

    const handleInvoiceSave = (savedInvoice?: Invoice) => {
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
        if (invoiceToDownload && invoicePreviewRef.current && settings) {
            const input = invoicePreviewRef.current;
            // Add a class for specific PDF styling if needed
            input.classList.add('pdf-capture');
            html2canvas(input, { scale: 1.5, useCORS: true }).then((canvas) => {
                input.classList.remove('pdf-capture');
                const imgData = canvas.toDataURL('image/jpeg', 0.9);
                const pdf = new jsPDF('p', 'mm', 'a4');
                const pdfWidth = pdf.internal.pageSize.getWidth();
                const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
                
                pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
                pdf.save(`invoice-${invoiceToDownload.invoiceNumber || 'untitled'}.pdf`);
                setInvoiceToDownload(null);
            }).catch(error => {
                console.error("Error generating PDF:", error);
                toast({
                    variant: 'destructive',
                    title: 'Download Failed',
                    description: 'There was an error generating the PDF for download.',
                });
                setInvoiceToDownload(null);
            });
        }
    }, [invoiceToDownload, settings, toast]);

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2">
                <InvoiceForm 
                  key={selectedInvoice?.id || 'new'} 
                  initialData={selectedInvoice} 
                  onInvoiceSave={handleInvoiceSave} 
                  onAddNew={handleAddNew}
                />
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
    );
}
