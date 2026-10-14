'use client';

import React, { useState, useEffect, useRef } from 'react';
import { InvoiceForm } from '@/components/invoice-form';
import { InvoiceList } from '@/components/invoice-list';
import { getInvoices, Invoice } from '@/services/invoiceService';
import { useToast } from '@/hooks/use-toast';
import { Loader, ListOrdered, FilePlus } from 'lucide-react';
import { InvoicePreview } from '@/components/invoice-preview';
import { getSettings, Settings } from '@/services/settingsService';
import { generateAndSavePdf } from '@/lib/pdf';
import { AppShell } from '@/components/app-shell';
import { DashboardOverview } from '@/components/dashboard-overview';
import { RevenueChart } from '@/components/revenue-chart';
import { getQuotations, Quotation } from '@/services/quotationService';
import { getChallans, Challan } from '@/services/challanService';
import { triggerHaptic } from '@/lib/haptics';

export default function Home() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [challans, setChallans] = useState<Challan[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [mobileTab, setMobileTab] = useState<'list' | 'form'>('list');
  const { toast } = useToast();
  const invoicePreviewRef = useRef<HTMLDivElement>(null);
  const [invoiceToDownload, setInvoiceToDownload] = useState<Invoice | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      try {
        const fetchedInvoices = await getInvoices();
        setInvoices(fetchedInvoices);
      } catch (invError) {
        console.error('Error fetching invoices:', invError);
      }

      try {
        const fetchedQuotations = await getQuotations();
        setQuotations(fetchedQuotations);
      } catch (qError) {
        console.error('Error fetching quotations:', qError);
      }

      try {
        const fetchedChallans = await getChallans();
        setChallans(fetchedChallans);
      } catch (cError) {
        console.error('Error fetching challans:', cError);
      }

      try {
        const fetchedSettings = await getSettings();
        setSettings(fetchedSettings);
      } catch (setError) {
        console.error('Error fetching settings:', setError);
        toast({
          variant: 'destructive',
          title: 'Settings Load Failed',
          description:
            setError instanceof Error
              ? setError.message
              : 'Could not load application settings.',
        });
      }
    } catch (error) {
      console.error('Unexpected error in fetchData:', error);
      toast({
        variant: 'destructive',
        title: 'Data Load Critical Error',
        description:
          error instanceof Error
            ? error.message
            : 'An unexpected error occurred while loading home data.',
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
    setSelectedInvoice(null);
    setMobileTab('list');
    if (savedInvoice) {
      handleDownload(savedInvoice);
    }
  };

  const handleSelectInvoice = (invoice: Invoice) => {
    setSelectedInvoice(invoice);
    setMobileTab('form');
    // Smooth scroll to form if needed
    if (typeof window !== 'undefined') {
      const el = document.getElementById('invoice-form-section');
      if (el) el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleAddNew = () => {
    setSelectedInvoice(null);
    setMobileTab('form');
  };

  const handleDownload = (invoice: Invoice) => {
    setInvoiceToDownload(invoice);
  };

  useEffect(() => {
    if (invoiceToDownload && settings) {
      const timer = setTimeout(async () => {
        if (invoicePreviewRef.current) {
          const element = invoicePreviewRef.current;
          const fileName = `invoice-${
            invoiceToDownload.invoiceNumber || 'untitled'
          }.pdf`;

          try {
            await generateAndSavePdf(element, fileName);
          } catch (error) {
            console.error('Error generating PDF:', error);
            toast({
              variant: 'destructive',
              title: 'Download Failed',
              description: 'There was an error generating the PDF for download.',
            });
          } finally {
            setInvoiceToDownload(null);
          }
        }
      }, 1000);

      return () => clearTimeout(timer);
    }
  }, [invoiceToDownload, settings, toast]);

  return (
    <AppShell>
      <main className="min-h-screen bg-transparent flex flex-col items-center p-3 sm:p-6 lg:p-8">
        <div className="w-full max-w-7xl mx-auto space-y-6 sm:space-y-8">
          {/* Executive Overview Banner & Stats */}
          <DashboardOverview
            invoices={invoices}
            quotations={quotations}
            challans={challans}
            settings={settings}
          />

          {/* Revenue Analytics Chart */}
          <div className="grid grid-cols-1">
            <RevenueChart invoices={invoices} settings={settings} />
          </div>

          {/* ── MOBILE VIEW SWITCHER TABS (md:hidden) ── */}
          <div className="md:hidden flex items-center p-1 rounded-2xl bg-gray-200/70 border border-gray-300/60 shadow-inner">
            <button
              type="button"
              onClick={() => {
                triggerHaptic('light');
                setMobileTab('list');
              }}
              className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                mobileTab === 'list'
                  ? 'bg-white text-[#3b2fc9] shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <ListOrdered className="w-3.5 h-3.5" />
              <span>Invoices ({invoices.length})</span>
            </button>
            <button
              type="button"
              onClick={() => {
                triggerHaptic('light');
                setMobileTab('form');
              }}
              className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                mobileTab === 'form'
                  ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <FilePlus className="w-3.5 h-3.5" />
              <span>{selectedInvoice ? 'Edit Invoice' : '+ New Invoice'}</span>
            </button>
          </div>

          {/* ── FORMS & INVOICE LIST SECTION ── */}
          {/* On Desktop: both are displayed stacked or side-by-side */}
          {/* On Mobile: renders based on mobileTab */}
          <div className="space-y-8" id="invoice-form-section">
            <div className={`w-full ${mobileTab === 'list' ? 'hidden md:block' : 'block'}`}>
              <InvoiceForm
                key={selectedInvoice?.id || 'new'}
                initialData={selectedInvoice}
                onInvoiceSave={handleInvoiceSave}
                onAddNew={handleAddNew}
              />
            </div>

            <div className={`w-full ${mobileTab === 'form' ? 'hidden md:block' : 'block'}`}>
              {isLoading ? (
                <div className="flex flex-col items-center justify-center p-12 bg-white rounded-2xl border border-gray-200/80 gap-3">
                  <Loader className="h-8 w-8 text-[#3b2fc9] animate-spin" />
                  <p className="text-xs text-gray-500 font-medium">Loading Invoices...</p>
                </div>
              ) : (
                <InvoiceList
                  invoices={invoices}
                  onSelectInvoice={handleSelectInvoice}
                  onDownloadInvoice={handleDownload}
                />
              )}
            </div>
          </div>

          {/* Off-screen PDF generation target */}
          {invoiceToDownload && settings && (
            <div
              id="pdf-capture-container"
              style={{
                position: 'fixed',
                top: 0,
                left: 0,
                width: '850px',
                opacity: 0.01,
                pointerEvents: 'none',
                zIndex: -9999,
              }}
            >
              <InvoicePreview
                ref={invoicePreviewRef}
                invoice={invoiceToDownload}
                settings={settings}
              />
            </div>
          )}
        </div>
      </main>
    </AppShell>
  );
}
