'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useToast } from '@/hooks/use-toast';
import {
  Loader,
  Truck,
  Plus,
  RefreshCcw,
  Sparkles,
  Package,
  Layers,
  ArrowRight,
  TrendingUp,
  Building2,
  Calendar,
  FilePlus,
  ListOrdered,
} from 'lucide-react';
import { getSettings, Settings } from '@/services/settingsService';
import { generateAndSavePdf } from '@/lib/pdf';
import { DeliveryChallanForm } from '@/components/delivery-challan-form';
import { ChallanList } from '@/components/challan-list';
import {
  Challan,
  getChallans,
  deleteChallan,
  deleteChallans,
  saveChallan,
} from '@/services/challanService';
import { DeliveryChallanPreview } from '@/components/delivery-challan-preview';
import { DeliveryChallanViewModal } from '@/components/delivery-challan-view-modal';
import { AppShell } from '@/components/app-shell';
import { triggerHaptic } from '@/lib/haptics';
import { useAuth } from '@/contexts/AuthContext';

export default function DeliveryChallanPage() {
  const [challans, setChallans] = useState<Challan[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedChallan, setSelectedChallan] = useState<Challan | null>(null);
  const [mobileTab, setMobileTab] = useState<'list' | 'form'>('list');
  const [viewModalChallan, setViewModalChallan] = useState<Challan | null>(null);

  // Bulk / Download states
  const [challanToDownload, setChallanToDownload] = useState<Challan | null>(null);
  const [downloadQueue, setDownloadQueue] = useState<Challan[]>([]);
  const [isBulkDownloading, setIsBulkDownloading] = useState(false);
  const [settings, setSettings] = useState<Settings | null>(null);

  const { toast } = useToast();
  const { user } = useAuth();
  const challanPreviewRef = useRef<HTMLDivElement>(null);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [fetchedChallans, fetchedSettings] = await Promise.all([
        getChallans(),
        getSettings(),
      ]);
      setChallans(fetchedChallans);
      setSettings(fetchedSettings);
    } catch (error) {
      console.error(error);
      toast({
        variant: 'destructive',
        title: 'Failed to fetch data',
        description:
          'There was an error loading your delivery challans. Please try again later.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefresh = async () => {
    triggerHaptic('light');
    setIsRefreshing(true);
    await fetchData();
    setIsRefreshing(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleChallanSave = (savedChallan?: Challan) => {
    fetchData();
    setSelectedChallan(null);
    setMobileTab('list');
    if (savedChallan) {
      handleDownload(savedChallan);
    }
  };

  const handleSelectChallan = (challan: Challan) => {
    setSelectedChallan(challan);
    setMobileTab('form');
    if (typeof window !== 'undefined') {
      const el = document.getElementById('challan-form-section');
      if (el) el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleAddNew = () => {
    setSelectedChallan(null);
    setMobileTab('form');
  };

  const handleViewChallan = (challan: Challan) => {
    setViewModalChallan(challan);
  };

  const handleDuplicateChallan = (challan: Challan) => {
    triggerHaptic('light');
    const duplicated: Challan = {
      ...challan,
      id: undefined,
      dcNumber: '',
      dcDate: new Date().toISOString(),
      createdAt: undefined,
    };
    setSelectedChallan(duplicated);
    setMobileTab('form');
    if (typeof window !== 'undefined') {
      const el = document.getElementById('challan-form-section');
      if (el) el.scrollIntoView({ behavior: 'smooth' });
    }
    toast({
      title: 'Challan Cloned to Editor',
      description: 'Pre-filled line items and addresses. Save when ready to assign next DC #.',
    });
  };

  const handleDeleteChallan = async (challan: Challan) => {
    if (!challan.id) return;
    try {
      await deleteChallan(challan.id);
      toast({
        title: 'Challan Deleted',
        description: `Delivery challan ${challan.dcNumber} has been deleted.`,
      });
      fetchData();
    } catch (err) {
      console.error('Delete error:', err);
      toast({
        variant: 'destructive',
        title: 'Delete Failed',
        description: 'Could not delete the delivery challan.',
      });
    }
  };

  const handleBulkDelete = async (selectedIds: string[]) => {
    if (selectedIds.length === 0) return;
    try {
      await deleteChallans(selectedIds);
      toast({
        title: 'Challans Deleted',
        description: `Successfully deleted ${selectedIds.length} delivery challan(s).`,
      });
      fetchData();
    } catch (err) {
      console.error('Bulk delete error:', err);
      toast({
        variant: 'destructive',
        title: 'Bulk Delete Failed',
        description: 'An error occurred while deleting selected challans.',
      });
    }
  };

  const handleBulkDuplicate = async (selectedChallans: Challan[]) => {
    if (selectedChallans.length === 0) return;
    triggerHaptic('medium');
    const creatorDisplayName = (user as any)?.name || (user?.email ? user.email.split('@')[0] : 'Admin');

    try {
      toast({
        title: 'Duplicating Challans...',
        description: `Processing ${selectedChallans.length} delivery challans.`,
      });

      for (const c of selectedChallans) {
        await saveChallan({
          dcDate: new Date().toISOString(),
          companyProfileId: c.companyProfileId,
          billToName: c.billToName,
          billToAddress: c.billToAddress,
          shipToName: c.shipToName || c.billToName,
          shipToAddress: c.shipToAddress || c.billToAddress,
          lineItems: (c.lineItems || []).map((item, idx) => ({
            ...item,
            id: Date.now() + idx,
          })),
          subtotal: Number(c.subtotal) || 0,
          gstAmount: Number(c.gstAmount) || 0,
          shipping: Number(c.shipping) || 0,
          other: Number(c.other) || 0,
          total: Number(c.total) || 0,
          note: c.note || 'The above goods sent on returnable basis not for sale',
          createdBy: creatorDisplayName,
          creatorEmail: user?.email || '',
          creatorName: creatorDisplayName,
        });
      }

      toast({
        title: 'Bulk Duplication Complete',
        description: `Successfully duplicated ${selectedChallans.length} delivery challan(s) with new DC numbers!`,
      });
      fetchData();
    } catch (err) {
      console.error('Bulk duplicate error:', err);
      toast({
        variant: 'destructive',
        title: 'Bulk Duplicate Failed',
        description: 'Could not duplicate selected challans. Please try again.',
      });
    }
  };

  const handleDownload = (challan: Challan) => {
    setChallanToDownload(challan);
  };

  const handleBulkDownload = (selectedChallans: Challan[]) => {
    if (selectedChallans.length === 0) return;
    triggerHaptic('medium');
    setIsBulkDownloading(true);
    setDownloadQueue([...selectedChallans]);
    toast({
      title: 'Starting Bulk Download',
      description: `Preparing ${selectedChallans.length} PDF documents...`,
    });
  };

  // Queue pump for Bulk Download
  useEffect(() => {
    if (downloadQueue.length > 0 && !challanToDownload && settings) {
      const nextItem = downloadQueue[0];
      setChallanToDownload(nextItem);
      setDownloadQueue((prev) => prev.slice(1));
    } else if (downloadQueue.length === 0 && isBulkDownloading && !challanToDownload) {
      setIsBulkDownloading(false);
      toast({
        title: 'Bulk Download Complete',
        description: 'All selected delivery challan PDFs have been downloaded.',
      });
    }
  }, [downloadQueue, challanToDownload, settings, isBulkDownloading, toast]);

  // Actual PDF generation worker
  useEffect(() => {
    if (challanToDownload && settings) {
      const timer = setTimeout(async () => {
        if (challanPreviewRef.current) {
          const element = challanPreviewRef.current;
          const fileName = `challan-${
            challanToDownload.dcNumber || 'untitled'
          }.pdf`;

          try {
            await generateAndSavePdf(element, fileName);
          } catch (error) {
            console.error('Error generating PDF:', error);
            toast({
              variant: 'destructive',
              title: 'Download Failed',
              description: `Error generating PDF for ${challanToDownload.dcNumber || 'document'}.`,
            });
          } finally {
            setChallanToDownload(null);
          }
        } else {
          setChallanToDownload(null);
        }
      }, 700);

      return () => clearTimeout(timer);
    }
  }, [challanToDownload, settings, toast]);

  // Derived metrics
  const totalValue = challans.reduce((acc, c) => acc + (Number(c.total) || 0), 0);
  const totalItems = challans.reduce((acc, c) => acc + (c.lineItems?.length || 0), 0);
  const uniqueClients = new Set(
    challans.map((c) => c.shipToName || c.billToName).filter(Boolean)
  ).size;
  const now = new Date();

  return (
    <AppShell>
      <main className="min-h-screen bg-transparent flex flex-col items-center p-3 sm:p-6 lg:p-8">
        <div className="w-full max-w-7xl mx-auto space-y-6 sm:space-y-8">
          {/* ── Executive Hero Banner (like /newrelic) ── */}
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-slate-950 via-[#181156] to-[#251b85] text-white p-5 sm:p-7 shadow-xl shadow-indigo-950/20 border border-indigo-900/40">
            <div className="absolute top-0 right-0 -mt-6 -mr-6 w-56 h-56 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute bottom-0 left-1/3 -mb-10 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

            <div className="relative flex flex-col lg:flex-row lg:items-center justify-between gap-5">
              <div className="space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-white/10 text-cyan-300 border border-cyan-300/25 backdrop-blur-md">
                    <Truck className="w-3.5 h-3.5" />
                    Delivery Challan Hub
                  </span>
                  <span className="text-[11px] text-indigo-200 font-medium">
                    {now.toLocaleDateString('en-IN', {
                      weekday: 'short',
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </span>
                </div>

                <h1 className="text-xl sm:text-3xl font-black tracking-tight text-white">
                  Material Dispatch &amp; Delivery Challans
                </h1>
                <p className="text-xs sm:text-sm text-indigo-200/80 max-w-2xl font-normal leading-relaxed">
                  Generate returnable and non-returnable delivery challans, track dispatched consignments, view documents, and bulk manage PDFs.
                </p>
              </div>

              <div className="flex items-center gap-2.5 self-start lg:self-center flex-wrap">
                <button
                  type="button"
                  onClick={handleRefresh}
                  disabled={isRefreshing}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 active:scale-95 text-xs font-bold text-white transition-all backdrop-blur-xs border border-white/15"
                >
                  <RefreshCcw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
                  <span>{isRefreshing ? 'Syncing...' : 'Sync Data'}</span>
                </button>

                {/* Direct Link to NewRelic DC Portal */}
                <Link
                  href="/newrelic"
                  onClick={() => triggerHaptic('light')}
                  className="group flex items-center gap-2 px-3.5 py-2 rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 hover:from-amber-500 hover:to-orange-600 text-slate-950 text-xs font-black shadow-md active:scale-95 transition-all"
                  title="Switch to NewRelic Cafeteria DC Hub"
                >
                  <Layers className="w-4 h-4 text-slate-950" />
                  <span>NewRelic DC Portal</span>
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                </Link>
              </div>
            </div>
          </div>

          {/* ── Stat Metric Cards ── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <div className="p-4 rounded-2xl bg-gradient-to-br from-indigo-50/90 via-white to-purple-50/40 border border-indigo-200/80 shadow-xs">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800 border border-indigo-200 uppercase tracking-wider">
                  Challans
                </span>
                <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-xs">
                  <Truck className="w-4 h-4" />
                </div>
              </div>
              <p className="text-xs font-semibold text-gray-500 truncate">Total Issued</p>
              <p className="text-xl sm:text-2xl font-black text-gray-900 font-mono tabular-nums mt-1">
                {challans.length}
              </p>
              <p className="text-[11px] text-gray-400 font-medium truncate mt-1">
                All dispatch documents
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-50/90 via-white to-teal-50/40 border border-emerald-200/80 shadow-xs">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 uppercase tracking-wider">
                  Dispatched
                </span>
                <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-xs">
                  <TrendingUp className="w-4 h-4" />
                </div>
              </div>
              <p className="text-xs font-semibold text-gray-500 truncate">Total Value</p>
              <p className="text-xl sm:text-2xl font-black text-gray-900 font-mono tabular-nums mt-1">
                ₹{totalValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
              </p>
              <p className="text-[11px] text-gray-400 font-medium truncate mt-1">
                Aggregate material value
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-gradient-to-br from-blue-50/90 via-white to-sky-50/40 border border-blue-200/80 shadow-xs">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 border border-blue-200 uppercase tracking-wider">
                  Inventory
                </span>
                <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs">
                  <Package className="w-4 h-4" />
                </div>
              </div>
              <p className="text-xs font-semibold text-gray-500 truncate">Total Line Items</p>
              <p className="text-xl sm:text-2xl font-black text-gray-900 font-mono tabular-nums mt-1">
                {totalItems}
              </p>
              <p className="text-[11px] text-gray-400 font-medium truncate mt-1">
                Dispatched product units
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-gradient-to-br from-purple-50/90 via-white to-fuchsia-50/40 border border-purple-200/80 shadow-xs">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 border border-purple-200 uppercase tracking-wider">
                  Consignees
                </span>
                <div className="w-8 h-8 rounded-xl bg-purple-600 text-white flex items-center justify-center shadow-xs">
                  <Building2 className="w-4 h-4" />
                </div>
              </div>
              <p className="text-xs font-semibold text-gray-500 truncate">Active Destinations</p>
              <p className="text-xl sm:text-2xl font-black text-gray-900 font-mono tabular-nums mt-1">
                {uniqueClients}
              </p>
              <p className="text-[11px] text-gray-400 font-medium truncate mt-1">
                Unique ship-to locations
              </p>
            </div>
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
              <span>Challans ({challans.length})</span>
            </button>
            <button
              type="button"
              onClick={() => {
                triggerHaptic('light');
                setMobileTab('form');
              }}
              className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                mobileTab === 'form'
                  ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <FilePlus className="w-3.5 h-3.5" />
              <span>{selectedChallan ? 'Edit Challan' : '+ New Challan'}</span>
            </button>
          </div>

          {/* ── MAIN FORM & LIST SECTIONS ── */}
          <div className="space-y-8" id="challan-form-section">
            <div className={`w-full ${mobileTab === 'list' ? 'hidden md:block' : 'block'}`}>
              <DeliveryChallanForm
                key={selectedChallan?.id || 'new'}
                initialData={selectedChallan}
                onChallanSave={handleChallanSave}
                onAddNew={handleAddNew}
              />
            </div>

            <div className={`w-full ${mobileTab === 'form' ? 'hidden md:block' : 'block'}`}>
              {isLoading ? (
                <div className="flex flex-col items-center justify-center p-12 bg-white rounded-2xl border border-gray-200/80 gap-3">
                  <Loader className="h-8 w-8 text-[#3b2fc9] animate-spin" />
                  <p className="text-xs text-gray-500 font-medium">Loading Delivery Challans...</p>
                </div>
              ) : (
                <ChallanList
                  challans={challans}
                  onSelectChallan={handleSelectChallan}
                  onDownloadChallan={handleDownload}
                  onViewChallan={handleViewChallan}
                  onDuplicateChallan={handleDuplicateChallan}
                  onDeleteChallan={handleDeleteChallan}
                  onBulkDownload={handleBulkDownload}
                  onBulkDuplicate={handleBulkDuplicate}
                  onBulkDelete={handleBulkDelete}
                  isBulkDownloading={isBulkDownloading}
                />
              )}
            </div>
          </div>

          {/* Document View Modal */}
          <DeliveryChallanViewModal
            isOpen={!!viewModalChallan}
            onClose={() => setViewModalChallan(null)}
            challan={viewModalChallan}
            settings={settings}
            onDownload={handleDownload}
          />

          {/* Off-screen PDF generation target */}
          {challanToDownload && settings && (
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
              <DeliveryChallanPreview
                ref={challanPreviewRef}
                challan={challanToDownload}
                settings={settings}
              />
            </div>
          )}
        </div>
      </main>
    </AppShell>
  );
}
