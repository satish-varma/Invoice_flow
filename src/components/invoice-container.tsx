
"use client";

import React, { useState, useEffect } from 'react';
import { InvoiceForm } from '@/components/invoice-form';
import { InvoiceList } from '@/components/invoice-list';
import { getInvoices, Invoice } from '@/services/invoiceService';
import { useToast } from '@/hooks/use-toast';
import { Loader } from 'lucide-react';

export function InvoiceContainer() {
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
    const { toast } = useToast();

    const fetchInvoices = async () => {
        setIsLoading(true);
        try {
            const fetchedInvoices = await getInvoices();
            setInvoices(fetchedInvoices);
        } catch (error) {
            console.error(error);
            toast({
                variant: 'destructive',
                title: 'Failed to fetch invoices',
                description: 'There was an error loading your invoices. Please try again later.',
            });
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchInvoices();
    }, []);

    const handleInvoiceSave = () => {
        fetchInvoices();
        setSelectedInvoice(null); // Clear form after saving
    };

    const handleSelectInvoice = (invoice: Invoice) => {
        setSelectedInvoice(invoice);
    }
    
    const handleAddNew = () => {
        setSelectedInvoice(null);
    }

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
                    <InvoiceList invoices={invoices} onSelectInvoice={handleSelectInvoice} />
                )}
            </div>
        </div>
    );
}
