'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
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
  Eye,
  EyeOff,
  DollarSign,
  Percent,
  BarChart3,
  PieChart,
  ShieldCheck,
} from 'lucide-react';
import { getSettings, Settings } from '@/services/settingsService';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { hasPermission } from '@/types/permissions';

export default function DeliveryChallanPage() {
  const [challans, setChallans] = useState<Challan[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedChallan, setSelectedChallan] = useState<Challan | null>(null);
  const [showAnalytics, setShowAnalytics] = useState<boolean>(false);
  const [showFinancials, setShowFinancials] = useState<boolean>(true);
  const [viewModalChallan, setViewModalChallan] = useState<Challan | null>(null);

  // Bulk / Download states
  const [challanToDownload, setChallanToDownload] = useState<Challan | null>(null);
  const [downloadQueue, setDownloadQueue] = useState<Challan[]>([]);
  const [isBulkDownloading, setIsBulkDownloading] = useState(false);
  const [settings, setSettings] = useState<Settings | null>(null);

  const { toast } = useToast();
  const { user, role } = useAuth();
  const isAdmin = role === 'admin' || role === 'superadmin';
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
    if (savedChallan) {
      handleDownload(savedChallan);
    }
  };

  const handleSelectChallan = (challan: Challan) => {
    setSelectedChallan(challan);
    if (typeof window !== 'undefined') {
      const el = document.getElementById('challan-form-section');
      if (el) el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleAddNew = () => {
    setSelectedChallan(null);
    if (typeof window !== 'undefined') {
      const el = document.getElementById('challan-form-section');
      if (el) el.scrollIntoView({ behavior: 'smooth' });
    }
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
    if (typeof window !== 'undefined') {
      const el = document.getElementById('challan-form-section');
      if (el) el.scrollIntoView({ behavior: 'smooth' });
    }
    toast({
      title: 'Challan Cloned to Editor',
      description: 'Pre-filled line items, addresses & pricing. Save to assign next DC #.',
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
    const creatorDisplayName = (user as any)?.name || (user?.email ? user.email.split('@')[0] : 'Satya');
    const creatorEmail = user?.email || 'satya@tgg.in';

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
            procurementCost: Number(item.procurementCost) || 0,
            unitPrice: Number(item.unitPrice) || 0,
            quantity: Number(item.quantity) || 0,
            total: (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0),
          })),
          subtotal: Number(c.subtotal) || 0,
          gstAmount: Number(c.gstAmount) || 0,
          shipping: Number(c.shipping) || 0,
          other: Number(c.other) || 0,
          total: Number(c.total) || 0,
          procurementCost: Number(c.procurementCost) || 0,
          commissionRate: Number(c.commissionRate) || 5.5,
          commissionAmount: Number(c.commissionAmount) || 0,
          revenue: Number(c.revenue) || 0,
          grossProfit: Number(c.grossProfit) || 0,
          marginPercent: Number(c.marginPercent) || 0,
          note: c.note || 'The above goods sent on non returnable basis',
          createdBy: creatorDisplayName,
          creatorEmail,
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

  // Derived metrics (like NewRelic)
  const totalValue = challans.reduce((acc, c) => acc + (Number(c.total) || 0), 0);
  const totalItems = challans.reduce((acc, c) => acc + (c.lineItems?.length || 0), 0);
  const totalPCost = challans.reduce((acc, c) => acc + (Number(c.procurementCost) || 0), 0);
  const totalCommission = challans.reduce((acc, c) => acc + (Number(c.commissionAmount) || 0), 0);
  const totalGrossProfit = challans.reduce((acc, c) => acc + (Number(c.grossProfit) || 0), 0);
  const overallMargin = totalValue > 0 ? (totalGrossProfit / totalValue) * 100 : 0;

  const uniqueClients = new Set(
    challans.map((c) => c.shipToName || c.billToName).filter(Boolean)
  ).size;

  // Top Consignees Breakdown
  const topConsignees = useMemo(() => {
    const map = new Map<string, { count: number; total: number; pCost: number; profit: number }>();
    challans.forEach((c) => {
      const name = c.shipToName || c.billToName || 'Unknown';
      const existing = map.get(name) || { count: 0, total: 0, pCost: 0, profit: 0 };
      existing.count += 1;
      existing.total += Number(c.total) || 0;
      existing.pCost += Number(c.procurementCost) || 0;
      existing.profit += Number(c.grossProfit) || 0;
      map.set(name, existing);
    });
    return Array.from(map.entries())
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);
  }, [challans]);

  const now = new Date();

  return (
    <AppShell>
      <main className="min-h-screen bg-transparent flex flex-col items-center p-2.5 sm:p-6 lg:p-8 w-full max-w-full overflow-x-hidden">
        <div className="w-full max-w-7xl mx-auto space-y-4 sm:space-y-8">
          {/* ── Executive Hero Banner (like /newrelic) ── */}
          <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl bg-gradient-to-r from-slate-950 via-[#181156] to-[#251b85] text-white p-4 sm:p-7 shadow-xl shadow-indigo-950/20 border border-indigo-900/40">
            <div className="absolute top-0 right-0 -mt-6 -mr-6 w-56 h-56 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute bottom-0 left-1/3 -mb-10 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

            <div className="relative flex flex-col lg:flex-row lg:items-center justify-between gap-3 sm:gap-5">
              <div className="space-y-1.5 sm:space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 sm:px-3 sm:py-1 rounded-full text-[11px] sm:text-xs font-bold bg-white/10 text-cyan-300 border border-cyan-300/25 backdrop-blur-md">
                    <Truck className="w-3 sm:w-3.5 h-3 sm:h-3.5" />
                    Delivery Challan Hub
                  </span>
                  <span className="text-[10px] sm:text-[11px] text-indigo-200 font-medium">
                    {now.toLocaleDateString('en-IN', {
                      weekday: 'short',
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </span>
                  {isAdmin && showFinancials && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                      <TrendingUp className="w-2.5 h-2.5" /> P.Cost Active
                    </span>
                  )}
                </div>

                <h1 className="text-lg sm:text-3xl font-black tracking-tight text-white">
                  Material Dispatch &amp; Delivery Challans
                </h1>
                <p className="hidden sm:block text-xs sm:text-sm text-indigo-200/80 max-w-2xl font-normal leading-relaxed">
                  Enterprise material dispatches, consignee destination tracking, procurement cost analysis, commission reporting, and instant batch PDF export.
                </p>
              </div>

              <div className="flex items-center gap-2 self-start lg:self-center flex-wrap pt-1 sm:pt-0">
                {isAdmin && (
                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic('light');
                      setShowFinancials(!showFinancials);
                    }}
                    className={`flex items-center gap-1 px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-xl text-[11px] sm:text-xs font-bold transition-all border ${
                      showFinancials
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400/40'
                        : 'bg-white/10 text-white/80 border-white/15'
                    }`}
                    title="Toggle Procurement Cost, Commission & Margin Visibility"
                  >
                    {showFinancials ? <Eye className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-emerald-300" /> : <EyeOff className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-gray-400" />}
                    <span>{showFinancials ? 'Financials: ON' : 'Financials: OFF'}</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleRefresh}
                  disabled={isRefreshing}
                  className="flex items-center gap-1 px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-xl bg-white/10 hover:bg-white/20 active:scale-95 text-[11px] sm:text-xs font-bold text-white transition-all backdrop-blur-xs border border-white/15"
                >
                  <RefreshCcw className={`w-3 h-3 sm:w-3.5 sm:h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
                  <span>{isRefreshing ? 'Syncing...' : 'Sync Data'}</span>
                </button>

                {/* Direct Link to NewRelic DC Portal (Strictly if permitted) */}
                {hasPermission(user, 'newrelic_dc') && (
                  <Link
                    href="/newrelic"
                    prefetch={false}
                    onClick={() => triggerHaptic('light')}
                    className="group flex items-center gap-1.5 px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 hover:from-amber-500 hover:to-orange-600 text-slate-950 text-[11px] sm:text-xs font-black shadow-md active:scale-95 transition-all"
                    title="Switch to NewRelic Cafeteria DC Hub"
                  >
                    <Layers className="w-3.5 h-3.5 text-slate-950" />
                    <span>NewRelic DC</span>
                    <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                  </Link>
                )}
              </div>
            </div>
          </div>

          {/* ── Stat Metric Cards (Dynamic Financials like NewRelic) ── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
            <div className="p-3 sm:p-4 rounded-xl sm:rounded-2xl bg-gradient-to-br from-indigo-50/90 via-white to-purple-50/40 border border-indigo-200/80 shadow-xs">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[9px] sm:text-[10px] font-bold px-1.5 sm:px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800 border border-indigo-200 uppercase tracking-wider">
                  Challans
                </span>
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-xs">
                  <Truck className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </div>
              </div>
              <p className="text-[11px] sm:text-xs font-semibold text-gray-500 truncate">Total Issued</p>
              <p className="text-lg sm:text-2xl font-black text-gray-900 font-mono tabular-nums mt-0.5">
                {challans.length}
              </p>
              <p className="text-[10px] sm:text-[11px] text-gray-400 font-medium truncate mt-0.5">
                Across {uniqueClients} consignees
              </p>
            </div>

            <div className="p-3 sm:p-4 rounded-xl sm:rounded-2xl bg-gradient-to-br from-blue-50/90 via-white to-sky-50/40 border border-blue-200/80 shadow-xs">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[9px] sm:text-[10px] font-bold px-1.5 sm:px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 border border-blue-200 uppercase tracking-wider">
                  Gross Value
                </span>
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs">
                  <DollarSign className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </div>
              </div>
              <p className="text-[11px] sm:text-xs font-semibold text-gray-500 truncate">Total Dispatched</p>
              <p className="text-lg sm:text-2xl font-black text-gray-900 font-mono tabular-nums mt-0.5 truncate">
                ₹{totalValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
              </p>
              <p className="text-[10px] sm:text-[11px] text-gray-400 font-medium truncate mt-0.5">
                {totalItems} total line units
              </p>
            </div>

            {isAdmin ? (
              <>
                <div className="p-3 sm:p-4 rounded-xl sm:rounded-2xl bg-gradient-to-br from-amber-50/90 via-white to-orange-50/40 border border-amber-200/80 shadow-xs">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[9px] sm:text-[10px] font-bold px-1.5 sm:px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200 uppercase tracking-wider">
                      Procurement
                    </span>
                    <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl bg-amber-600 text-white flex items-center justify-center shadow-xs">
                      <Package className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    </div>
                  </div>
                  <p className="text-[11px] sm:text-xs font-semibold text-gray-500 truncate">Total P.Cost</p>
                  <p className="text-lg sm:text-2xl font-black text-gray-900 font-mono tabular-nums mt-0.5 truncate">
                    ₹{totalPCost.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                  </p>
                  <p className="text-[10px] sm:text-[11px] text-gray-400 font-medium truncate mt-0.5">
                    Purchase / buy-in
                  </p>
                </div>

                <div className="p-3 sm:p-4 rounded-xl sm:rounded-2xl bg-gradient-to-br from-emerald-50/90 via-white to-teal-50/40 border border-emerald-200/80 shadow-xs">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[9px] sm:text-[10px] font-bold px-1.5 sm:px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 uppercase tracking-wider">
                      Margin / Profit
                    </span>
                    <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-xs">
                      <TrendingUp className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    </div>
                  </div>
                  <p className="text-[11px] sm:text-xs font-semibold text-gray-500 truncate">Est. Net Profit</p>
                  <p className="text-lg sm:text-2xl font-black text-emerald-700 font-mono tabular-nums mt-0.5 truncate">
                    ₹{totalGrossProfit.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                  </p>
                  <p className="text-[10px] sm:text-[11px] text-emerald-600 font-bold truncate mt-0.5">
                    {overallMargin.toFixed(1)}% Gross Margin
                  </p>
                </div>
              </>
            ) : (
              <>
                <div className="p-3 sm:p-4 rounded-xl sm:rounded-2xl bg-gradient-to-br from-indigo-50/90 via-white to-blue-50/40 border border-indigo-200/80 shadow-xs">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[9px] sm:text-[10px] font-bold px-1.5 sm:px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800 border border-indigo-200 uppercase tracking-wider">
                      Consignees
                    </span>
                    <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-xs">
                      <Building2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    </div>
                  </div>
                  <p className="text-[11px] sm:text-xs font-semibold text-gray-500 truncate">Active Destinations</p>
                  <p className="text-lg sm:text-2xl font-black text-gray-900 font-mono tabular-nums mt-0.5 truncate">
                    {uniqueClients}
                  </p>
                  <p className="text-[10px] sm:text-[11px] text-gray-400 font-medium truncate mt-0.5">
                    Client delivery sites
                  </p>
                </div>

                <div className="p-3 sm:p-4 rounded-xl sm:rounded-2xl bg-gradient-to-br from-purple-50/90 via-white to-pink-50/40 border border-purple-200/80 shadow-xs">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[9px] sm:text-[10px] font-bold px-1.5 sm:px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 border border-purple-200 uppercase tracking-wider">
                      Line Units
                    </span>
                    <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl bg-purple-600 text-white flex items-center justify-center shadow-xs">
                      <Package className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    </div>
                  </div>
                  <p className="text-[11px] sm:text-xs font-semibold text-gray-500 truncate">Dispatched Items</p>
                  <p className="text-lg sm:text-2xl font-black text-purple-900 font-mono tabular-nums mt-0.5 truncate">
                    {totalItems}
                  </p>
                  <p className="text-[10px] sm:text-[11px] text-purple-600 font-medium truncate mt-0.5">
                    Total consignment items
                  </p>
                </div>
              </>
            )}
          </div>

          {/* ── Mobile-Friendly Quick Navigation Switcher ── */}
          <div className="flex items-center justify-between gap-2 flex-wrap bg-white/80 backdrop-blur-md p-2 sm:p-3 rounded-2xl border border-gray-200/80 shadow-2xs">
            <div className="flex items-center gap-1.5 sm:gap-2 flex-1 min-w-0">
              <button
                type="button"
                onClick={() => {
                  triggerHaptic('light');
                  const el = document.getElementById('challan-form-section');
                  if (el) el.scrollIntoView({ behavior: 'smooth' });
                }}
                className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1 px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] sm:text-xs font-bold transition-all shadow-2xs active:scale-95"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{selectedChallan ? 'Edit Form' : 'New Form'}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  triggerHaptic('light');
                  const el = document.getElementById('saved-challans-section');
                  if (el) el.scrollIntoView({ behavior: 'smooth' });
                }}
                className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1 px-3 py-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-[11px] sm:text-xs font-bold border border-indigo-200/80 transition-all shadow-2xs active:scale-95"
              >
                <ListOrdered className="w-3.5 h-3.5" />
                <span>Saved List ({challans.length}) &darr;</span>
              </button>

              {selectedChallan && (
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic('light');
                    handleAddNew();
                  }}
                  className="inline-flex items-center gap-1 px-2.5 py-2 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 text-[11px] sm:text-xs font-bold border border-amber-200 transition-all shadow-2xs active:scale-95"
                  title="Cancel editing and create a new delivery challan"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Exit Edit &amp;</span> New
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => {
                  triggerHaptic('light');
                  setShowAnalytics(!showAnalytics);
                }}
                className={`inline-flex items-center gap-1 px-2.5 py-2 rounded-xl text-[11px] sm:text-xs font-bold border transition-all shadow-2xs active:scale-95 ${
                  showAnalytics
                    ? 'bg-emerald-600 text-white border-emerald-700 shadow-sm'
                    : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                }`}
              >
                <BarChart3 className="w-3.5 h-3.5" />
                <span>{showAnalytics ? 'Hide Analytics' : 'Analytics'}</span>
              </button>
            </div>
          </div>

          {/* ── OPTIONAL FINANCIAL & CONSIGNEE ANALYTICS SECTION ── */}
          {showAnalytics && (
            <div className="w-full space-y-6 animate-in fade-in duration-200">
              <div className={`grid grid-cols-1 ${isAdmin ? 'md:grid-cols-2' : ''} gap-6`}>
                {/* Top Consignees Card */}
                <Card className="rounded-2xl border border-gray-200 shadow-sm bg-white overflow-hidden">
                  <CardHeader className="bg-gray-50/70 p-4 border-b border-gray-100">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
                        <Building2 className="w-4 h-4 text-indigo-600" />
                        Top 5 Consignee Destinations by Volume
                      </CardTitle>
                      <span className="text-[11px] text-gray-400 font-medium">Ranked by Value</span>
                    </div>
                  </CardHeader>
                  <CardContent className="p-4 divide-y divide-gray-100">
                    {topConsignees.map((c, i) => {
                      const pctOfTotal = totalValue > 0 ? (c.total / totalValue) * 100 : 0;
                      return (
                        <div key={c.name} className="py-3 first:pt-0 last:pb-0 space-y-1.5">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-bold text-gray-900 truncate max-w-[200px] sm:max-w-[260px]">
                              #{i + 1} {c.name}
                            </span>
                            <span className="font-mono font-black text-gray-900">
                              ₹{c.total.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-[11px] text-gray-400">
                            <span>{c.count} challan(s)</span>
                            {isAdmin && (
                              <span className="font-semibold text-emerald-600">
                                Profit: ₹{c.profit.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                              </span>
                            )}
                          </div>
                          <div className="w-full bg-gray-100 h-1.5 rounded-full overflow-hidden">
                            <div
                              className="bg-indigo-600 h-full rounded-full transition-all"
                              style={{ width: `${Math.min(100, Math.max(5, pctOfTotal))}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </CardContent>
                </Card>

                {/* P.Cost vs Margin Breakdown Card - Admins Only */}
                {isAdmin && (
                  <Card className="rounded-2xl border border-gray-200 shadow-sm bg-white overflow-hidden">
                    <CardHeader className="bg-gray-50/70 p-4 border-b border-gray-100">
                      <CardTitle className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
                        <TrendingUp className="w-4 h-4 text-emerald-600" />
                        Dispatch Financial Breakdown &amp; Commission
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-5 space-y-4">
                      <div className="p-4 rounded-2xl bg-indigo-50/60 border border-indigo-100 space-y-3">
                        <div className="flex justify-between text-xs">
                          <span className="text-gray-600 font-medium">Total MRP / Dispatch Value:</span>
                          <span className="font-mono font-bold text-gray-900">₹{totalValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-gray-600 font-medium">Procurement Cost (P.Cost):</span>
                          <span className="font-mono font-bold text-amber-700">₹{totalPCost.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-gray-600 font-medium">Commission Deductions (~5.5%):</span>
                          <span className="font-mono font-bold text-red-600">-₹{totalCommission.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
                        </div>
                        <div className="pt-2 border-t border-indigo-200 flex justify-between items-baseline text-sm">
                          <span className="font-bold text-indigo-950">Aggregate Net Profit:</span>
                          <span className="font-mono font-black text-emerald-700 text-base">₹{totalGrossProfit.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3 text-center">
                        <div className="p-3 rounded-xl bg-gray-50 border border-gray-100">
                          <span className="text-[11px] text-gray-400 font-semibold block">Avg. DC Value</span>
                          <span className="font-mono font-black text-gray-900 text-base">
                            ₹{challans.length > 0 ? Math.round(totalValue / challans.length).toLocaleString('en-IN') : 0}
                          </span>
                        </div>
                        <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-100">
                          <span className="text-[11px] text-emerald-700 font-semibold block">Overall Margin</span>
                          <span className="font-mono font-black text-emerald-800 text-base">
                            {overallMargin.toFixed(1)}%
                          </span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          )}

          {/* ── 1. NEW / EDIT CHALLAN FORM ── */}
          <div id="challan-form-section" className="w-full">
            <DeliveryChallanForm
              key={selectedChallan?.id || 'new'}
              initialData={selectedChallan}
              onChallanSave={handleChallanSave}
              onAddNew={handleAddNew}
            />
          </div>

          {/* ── 2. SAVED CHALLANS LIST (Directly below new challan) ── */}
          <div id="saved-challans-section" className="w-full pt-4 space-y-3">
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-indigo-600 animate-pulse" />
                <h2 className="text-base sm:text-lg font-black text-gray-900 tracking-tight">
                  Saved Delivery Challans
                </h2>
                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200/80 font-mono">
                  {challans.length} Total
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  triggerHaptic('light');
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className="text-xs font-bold text-indigo-600 hover:text-indigo-800 hover:underline flex items-center gap-1"
              >
                &uarr; Back to Top Form
              </button>
            </div>

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
                onRefresh={fetchData}
                isBulkDownloading={isBulkDownloading}
                showFinancials={isAdmin && showFinancials}
              />
            )}
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
