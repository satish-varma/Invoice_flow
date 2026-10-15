'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { InvoiceForm } from '@/components/invoice-form';
import { InvoiceList } from '@/components/invoice-list';
import { getInvoices, Invoice } from '@/services/invoiceService';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Loader, ListOrdered, FilePlus } from 'lucide-react';
import { InvoicePreview } from '@/components/invoice-preview';
import { getSettings, Settings } from '@/services/settingsService';
import { generateAndSavePdf } from '@/lib/pdf';
import { AppShell } from '@/components/app-shell';
import { DashboardOverview } from '@/components/dashboard-overview';
import { RevenueChart } from '@/components/revenue-chart';
import { getQuotations, Quotation } from '@/services/quotationService';
import { getChallans, Challan } from '@/services/challanService';
import { triggerHaptic } from '@/lib/haptics';
import { hasPermission } from '@/types/permissions';

export default function RootHomePage() {
  const router = useRouter();
  const { user, role, loading } = useAuth();
  const [redirecting, setRedirecting] = useState<boolean | null>(null);

  // Invoices & Dashboard states
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

  useEffect(() => {
    if (loading) return;

    if (!user) {
      router.replace('/login');
      return;
    }

    const isAdmin = role === 'admin' || role === 'superadmin';
    const canAccessBilling = isAdmin || hasPermission(user, 'billing');

    if (canAccessBilling) {
      setRedirecting(false);
      return;
    }

    // User without billing permission: redirect to accessible landing module
    const defaultPage =
      user.defaultLandingPage ||
      (user.assignedSite === 'dsm' || user.assignedSite === 'ntt_data'
        ? '/newrelic/tuckshop'
        : '/newrelic');

    setRedirecting(true);
    router.replace(defaultPage);
  }, [user, role, loading, router]);

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
      }
    } catch (error) {
      console.error('Unexpected error in fetchData:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (redirecting === false) {
      fetchData();
    }
  }, [redirecting]);

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

  if (loading || redirecting !== false) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 gap-3">
        <Loader2 className="h-8 w-8 text-[#3b2fc9] animate-spin" />
        <p className="text-xs text-gray-500 font-medium">Loading workspace…</p>
      </div>
    );
  }

  return (
    <AppShell>
      <div className="min-h-screen bg-transparent flex flex-col items-center p-3 sm:p-6 lg:p-8">
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

          {/* Mobile View Switcher Tabs (md:hidden) */}
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

          {/* Forms & Invoice List Section */}
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
      </div>
    </AppShell>
  );
}
