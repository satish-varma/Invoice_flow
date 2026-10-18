'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { InvoiceForm } from '@/components/invoice-form';
import { InvoiceList } from '@/components/invoice-list';
import { getInvoices, deleteInvoice, Invoice } from '@/services/invoiceService';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Loader, ListOrdered, FilePlus, ArrowLeft, Plus, RefreshCcw } from 'lucide-react';
import { InvoicePreview } from '@/components/invoice-preview';
import { InvoicePreviewDialog } from '@/components/invoice-preview-dialog';
import { getSettings, Settings } from '@/services/settingsService';
import { generateAndSavePdf } from '@/lib/pdf';
import { AppShell } from '@/components/app-shell';
import { DashboardOverview } from '@/components/dashboard-overview';
import { getQuotations, Quotation } from '@/services/quotationService';
import { getChallans, Challan } from '@/services/challanService';
import { triggerHaptic } from '@/lib/haptics';
import { hasPermission } from '@/types/permissions';

import { checkUserCheckedInToday } from '@/services/newrelicAttendanceService';

export default function RootHomePage() {
  const router = useRouter();
  const { user, role, loading } = useAuth();
  const [redirecting, setRedirecting] = useState<boolean | null>(null);

  // Invoices & Dashboard states
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [challans, setChallans] = useState<Challan[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [activeTab, setActiveTab] = useState<'list' | 'form'>('list');
  const { toast } = useToast();
  const invoicePreviewRef = useRef<HTMLDivElement>(null);
  const [invoiceToGenerate, setInvoiceToGenerate] = useState<Invoice | null>(null);
  const [pdfAction, setPdfAction] = useState<'preview' | 'save' | null>(null);
  const [previewingInvoice, setPreviewingInvoice] = useState<Invoice | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [settings, setSettings] = useState<Settings | null>(null);

  useEffect(() => {
    if (loading) return;

    if (!user) {
      router.replace('/login');
      return;
    }

    const isAdmin = role === 'admin' || role === 'superadmin';
    const isGuest = role === 'guest';
    const canAccessBilling = isAdmin || isGuest || hasPermission(user, 'billing');

    // Guests do not require daily attendance check-in
    if (isGuest) {
      setRedirecting(false);
      return;
    }

    // Verify if check-in for the day has happened
    checkUserCheckedInToday(user.id, user.email).then((checkedIn) => {
      if (!checkedIn) {
        setRedirecting(true);
        router.replace('/newrelic/attendance');
        return;
      }

      if (canAccessBilling) {
        setRedirecting(false);
        return;
      }

      setRedirecting(true);
      router.replace('/newrelic');
    });
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

  const handleSync = async () => {
    setIsRefreshing(true);
    triggerHaptic('light');
    await fetchData();
    setIsRefreshing(false);
    toast({ title: '✨ Invoices & Stats Refreshed' });
  };

  useEffect(() => {
    if (redirecting === false) {
      fetchData();
    }
  }, [redirecting]);

  // Support navigating directly to edit invoice via ?edit=ID
  useEffect(() => {
    if (typeof window !== 'undefined' && invoices.length > 0) {
      const params = new URLSearchParams(window.location.search);
      const editId = params.get('edit');
      if (editId) {
        const found = invoices.find((inv) => inv.id === editId);
        if (found) {
          setSelectedInvoice(found);
          setActiveTab('form');
        }
      }
    }
  }, [invoices]);

  const handleInvoiceSave = (savedInvoice?: Invoice) => {
    fetchData();
    setSelectedInvoice(null);
    setActiveTab('list');
    if (savedInvoice) {
      handleDownload(savedInvoice);
    }
  };

  const handleSelectInvoice = (invoice: Invoice) => {
    setSelectedInvoice(invoice);
    setActiveTab('form');
    triggerHaptic('selection');
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 400, behavior: 'smooth' });
    }
  };

  const handleAddNew = () => {
    setSelectedInvoice(null);
    setActiveTab('form');
    triggerHaptic('medium');
  };

  const handleDownload = (invoice: Invoice) => {
    setPreviewingInvoice(null);
    setInvoiceToGenerate(invoice);
    setPdfAction('save');
  };

  const handlePreviewInvoice = (invoice: Invoice) => {
    setPreviewingInvoice(invoice);
    setPdfUrl(null);
    setIsGeneratingPdf(true);
    setInvoiceToGenerate(invoice);
    setPdfAction('preview');
  };

  const handleDeleteInvoice = async (invoice: Invoice) => {
    if (!invoice.id) return;
    try {
      await deleteInvoice(invoice.id);
      toast({
        title: 'Invoice Deleted',
        description: `Invoice ${invoice.invoiceNumber} has been removed.`,
      });
      setInvoices((prev) => prev.filter((i) => i.id !== invoice.id));
      if (selectedInvoice?.id === invoice.id) {
        setSelectedInvoice(null);
        setActiveTab('list');
      }
    } catch (error) {
      console.error('Error deleting invoice:', error);
      toast({
        variant: 'destructive',
        title: 'Delete Failed',
        description: 'Failed to delete the invoice. Please try again.',
      });
    }
  };

  useEffect(() => {
    if (invoiceToGenerate && settings && pdfAction) {
      const timer = setTimeout(async () => {
        if (invoicePreviewRef.current) {
          const element = invoicePreviewRef.current;
          const fileName = `invoice-${
            invoiceToGenerate.invoiceNumber || 'untitled'
          }.pdf`;

          if (pdfAction === 'save') {
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
              setInvoiceToGenerate(null);
              setPdfAction(null);
            }
          } else {
            // 'preview'
            setIsGeneratingPdf(true);
            try {
              const url = await generateAndSavePdf(element, '', 'preview');
              if (url) {
                setPdfUrl(url as string);
              }
            } catch (error) {
              console.error('Error generating PDF preview:', error);
              toast({
                variant: 'destructive',
                title: 'Preview Failed',
                description: 'There was an error generating the PDF preview.',
              });
            } finally {
              setIsGeneratingPdf(false);
              setInvoiceToGenerate(null);
              setPdfAction(null);
            }
          }
        }
      }, 150);

      return () => clearTimeout(timer);
    }
  }, [invoiceToGenerate, pdfAction, settings, toast]);

  if (loading || redirecting !== false) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-transparent gap-3">
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
            onNewInvoice={handleAddNew}
          />

          {/* Modernized Workspace Switcher Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-3 sm:p-4 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.06)]">
            <div className="flex items-center p-1 bg-slate-100 dark:bg-slate-800/80 rounded-2xl gap-1 border border-slate-200/80 dark:border-slate-700 w-full sm:w-auto">
              <button
                type="button"
                onClick={() => {
                  triggerHaptic('light');
                  setActiveTab('list');
                }}
                className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                  activeTab === 'list'
                    ? 'bg-gradient-to-r from-indigo-600 to-[#3b2fc9] text-white shadow-xs font-black'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 hover:bg-white/60 dark:hover:bg-slate-700/60'
                }`}
              >
                <ListOrdered className="w-4 h-4" />
                <span>Invoices Directory</span>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-black ${
                  activeTab === 'list' ? 'bg-white/20 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                }`}>
                  {invoices.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  triggerHaptic('medium');
                  setActiveTab('form');
                }}
                className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                  activeTab === 'form'
                    ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-xs font-black'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 hover:bg-white/60 dark:hover:bg-slate-700/60'
                }`}
              >
                <FilePlus className="w-4 h-4" />
                <span>{selectedInvoice ? `Edit (${selectedInvoice.invoiceNumber})` : '+ Create Invoice'}</span>
              </button>
            </div>

            <div className="flex items-center gap-2">
              {activeTab === 'form' && (
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic('light');
                    setSelectedInvoice(null);
                    setActiveTab('list');
                  }}
                  className="h-10 px-3.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Back to Directory</span>
                </button>
              )}

              {activeTab === 'list' && (
                <button
                  type="button"
                  onClick={handleAddNew}
                  className="h-10 px-4 rounded-xl bg-gradient-to-r from-indigo-600 to-[#3b2fc9] text-white text-xs font-black flex items-center gap-1.5 shadow-md shadow-indigo-600/25 transition-all active:scale-95 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>New Invoice</span>
                </button>
              )}

              <button
                type="button"
                onClick={handleSync}
                disabled={isRefreshing}
                className="h-10 px-3.5 rounded-xl bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer"
                title="Sync Invoices Data"
              >
                <RefreshCcw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-indigo-600' : 'text-slate-500'}`} />
                <span className="hidden sm:inline">{isRefreshing ? 'Syncing...' : 'Sync'}</span>
              </button>
            </div>
          </div>

          {/* Workspace Content: Invoices Directory OR Focused Invoice Form */}
          <div className="transition-all duration-200" id="invoice-workspace-section">
            {activeTab === 'form' ? (
              <div className="space-y-4">
                <InvoiceForm
                  key={selectedInvoice?.id || 'new'}
                  initialData={selectedInvoice}
                  onInvoiceSave={handleInvoiceSave}
                  onAddNew={handleAddNew}
                />
              </div>
            ) : (
              <div className="space-y-4">
                {isLoading ? (
                  <div className="flex flex-col items-center justify-center p-12 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 gap-3">
                    <Loader className="h-8 w-8 text-[#3b2fc9] animate-spin" />
                    <p className="text-xs text-slate-500 font-medium">Loading Invoices...</p>
                  </div>
                ) : (
                  <InvoiceList
                    invoices={invoices}
                    onSelectInvoice={handleSelectInvoice}
                    onDownloadInvoice={handleDownload}
                    onViewInvoice={handlePreviewInvoice}
                    onDeleteInvoice={handleDeleteInvoice}
                  />
                )}
              </div>
            )}
          </div>

          {/* Off-screen PDF generation target */}
          {invoiceToGenerate && settings && (
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
                invoice={invoiceToGenerate}
                settings={settings}
              />
            </div>
          )}

          {/* Invoice Preview Dialog */}
          {previewingInvoice && settings && (
            <InvoicePreviewDialog
              invoice={previewingInvoice}
              settings={settings}
              isOpen={!!previewingInvoice}
              onOpenChange={(isOpen) => {
                if (!isOpen) {
                  setPreviewingInvoice(null);
                  setPdfUrl(null);
                  setIsGeneratingPdf(false);
                }
              }}
              pdfUrl={pdfUrl}
              isGeneratingPdf={isGeneratingPdf}
            />
          )}
        </div>
      </div>
    </AppShell>
  );
}
