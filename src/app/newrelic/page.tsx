'use client';
import { NewRelicChallan, NewRelicLocation } from '@/types/challan';

import React, { useEffect, useRef, useState, useMemo } from 'react';
import { Loader2, FileText, MapPin, Filter, FileSpreadsheet, RefreshCcw, Search, X, ArrowUp, Calculator } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
import * as XLSX from 'xlsx';
import {getNewRelicChallans, deleteNewRelicChallan, NEWRELIC_LOCATIONS} from '@/services/newrelicChallanService';
import { NewRelicChallanForm } from '@/components/newrelic/newrelic-challan-form';
import { NewRelicChallanList } from '@/components/newrelic/newrelic-challan-list';
import { NewRelicItemDashboard } from '@/components/newrelic/newrelic-item-dashboard';
import { NewRelicChallanPreview } from '@/components/newrelic/newrelic-challan-preview';
import { NewRelicChallanHistoryModal } from '@/components/newrelic/newrelic-challan-history-modal';
import { NewRelicChallanViewModal } from '@/components/newrelic/newrelic-challan-view-modal';
import { NewRelicAdminPreviewModal } from '@/components/newrelic/newrelic-admin-preview-modal';

import { NewRelicGlobalAuditLog } from '@/components/newrelic/newrelic-global-audit-log';
import { generateAndSavePdf } from '@/lib/pdf';
import { NewRelicDashboard } from '@/components/newrelic/newrelic-dashboard';
import { useAuth } from '@/contexts/AuthContext';
import { useFinancialAuth } from '@/contexts/FinancialAuthContext';
import { FinancialPasswordModal } from '@/components/newrelic/financial-password-modal';
import { Lock, Unlock } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { MobileFloatingActions } from '@/components/newrelic/mobile-floating-actions';
import { triggerHaptic } from '@/lib/haptics';
import { ChallanSkeletonLoader } from '@/components/newrelic/challan-skeleton-loader';
import { MrpCalculatorModal } from '@/components/newrelic/mrp-calculator-modal';
import { hasPermission } from '@/types/permissions';

export default function NewRelicPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [challans, setChallans] = useState<NewRelicChallan[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedChallan, setSelectedChallan] = useState<NewRelicChallan | null>(null);
  const [challanToDownload, setChallanToDownload] = useState<NewRelicChallan | null>(null);
  const [isCreatingNew, setIsCreatingNew] = useState<NewRelicLocation | null>(null);
  const [formKey, setFormKey] = useState<string>('new');
  const [activeTab, setActiveTab] = useState<'active' | 'trash' | 'insights' | 'items'>('active');
  const { role, user } = useAuth();
  const isAdmin = role === 'admin' || role === 'superadmin';

  // Route guard: Only redirect if user does not have permission for NewRelic DC
  useEffect(() => {
    if (user && !isAdmin && !hasPermission(user, 'newrelic_dc')) {
      router.replace('/newrelic/tuckshop');
    }
  }, [isAdmin, user, router]);
  
  // Filters
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterLocation, setFilterLocation] = useState<string>('all');
  const [filterMonth, setFilterMonth] = useState<string>('all');
  const [filterYear, setFilterYear] = useState<string>('all');
  const [filterCycle, setFilterCycle] = useState<string>('all');

  const [historyChallan, setHistoryChallan] = useState<NewRelicChallan | null>(null);
  const [previewChallan, setPreviewChallan] = useState<NewRelicChallan | null>(null);
  const [adminPreviewChallan, setAdminPreviewChallan] = useState<NewRelicChallan | null>(null);
  const { isUnlocked, remainingMinutes, lockFinancials } = useFinancialAuth();
  const [showFinancialModal, setShowFinancialModal] = useState(false);
  const [showFinancials, setShowFinancials] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [showCalculator, setShowCalculator] = useState(false);
  const [mounted, setMounted] = useState(false);
  const previewRef = useRef<HTMLDivElement>(null);

  // Pull-to-refresh gesture state
  const [pullState, setPullState] = useState<'idle' | 'pulling' | 'triggered'>('idle');
  const [pullDelta, setPullDelta] = useState(0);
  const touchStartY = useRef<number>(0);
  const PTR_THRESHOLD = 72; // px to trigger refresh

  const handleTouchStart = (e: React.TouchEvent) => {
    if (window.scrollY === 0) {
      touchStartY.current = e.touches[0].clientY;
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (window.scrollY > 0 || pullState === 'triggered') return;
    const delta = e.touches[0].clientY - touchStartY.current;
    if (delta > 0) {
      setPullDelta(Math.min(delta * 0.45, PTR_THRESHOLD + 24));
      setPullState(delta >= PTR_THRESHOLD ? 'triggered' : 'pulling');
    }
  };

  const handleTouchEnd = async () => {
    if (pullState === 'triggered') {
      triggerHaptic('medium');
      await handlePullRefresh();
    }
    setPullDelta(0);
    setPullState('idle');
  };

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 350);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  /* ── Data fetching ── */
  const fetchData = async () => {
    setIsLoading(true);
    try {
      const data = await getNewRelicChallans();
      setChallans(data);
    } catch (err) {
      console.error(err);
      toast({ variant: 'destructive', title: 'Failed to load challans' });
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const handlePullRefresh = async () => {
    setIsRefreshing(true);
    await fetchData();
    toast({ title: '✨ Refreshed with latest data' });
  };

  useEffect(() => {
    fetchData();
    
    const draftStr = sessionStorage.getItem('challanDraft');
    if (draftStr) {
      try {
        const draft = JSON.parse(draftStr);
        setSelectedChallan(draft);
        setFormKey(`draft-${Date.now()}`);
        sessionStorage.removeItem('challanDraft');
      } catch (e) {
        console.error('Failed to parse challanDraft', e);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Initialize filterLocation based on preferredLocations
  useEffect(() => {
    if (user?.preferredLocations && user.preferredLocations.length > 0) {
      if (user.preferredLocations.length === 1) {
        setFilterLocation(user.preferredLocations[0]);
      } else {
        setFilterLocation('preferred');
      }
    }
  }, [user]);

  /* ── Handlers ── */
  const handleEditChallan = (challan: NewRelicChallan) => {
    setSelectedChallan(challan);
    setIsCreatingNew(null);
    setFormKey(`edit-${challan.id}-${Date.now()}`);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setTimeout(() => {
      const el = document.getElementById('challan-form-section');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } else {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    }, 80);
  };

  const handleStartCreateNew = (loc: NewRelicLocation) => {
    setSelectedChallan(null);
    setIsCreatingNew(loc);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setTimeout(() => {
      const el = document.getElementById('challan-form-section');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } else {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    }, 80);
  };

  const handleSave = (saved?: NewRelicChallan) => {
    fetchData();
    setSelectedChallan(null);
    setIsCreatingNew(null);
    if (saved) handleDownload(saved);
  };

  const handleDownload = (challan: NewRelicChallan) => {
    setChallanToDownload(challan);
  };

  const handleDelete = async (id: string) => {
    try {
      if (activeTab === 'trash') {
        const { permanentDeleteNewRelicChallan } = await import('@/services/newrelicChallanService');
        await permanentDeleteNewRelicChallan(id);
        toast({ title: 'Challan permanently deleted' });
      } else {
        await deleteNewRelicChallan(id, user?.email || null);
        toast({ title: 'Challan moved to trash' });
      }
      fetchData();
    } catch {
      toast({ variant: 'destructive', title: 'Delete failed' });
    }
  };

  const handleRestore = async (id: string) => {
    try {
      import('@/services/newrelicChallanService').then(async (m) => {
        await m.restoreNewRelicChallans([id], user?.email || null);
        toast({ title: 'Challan restored' });
        fetchData();
      });
    } catch {
      toast({ variant: 'destructive', title: 'Restore failed' });
    }
  };

  const handleDuplicate = (challan: NewRelicChallan) => {
    // Create a new challan with the same items/location but no id or dcNumber.
    // The form will auto-suggest the next DC number just like a new challan.
    const duplicated: NewRelicChallan = {
      location: challan.location,
      dcDate: new Date().toISOString(),
      dcNumber: '', // will be auto-suggested by the form
      lineItems: challan.lineItems,
      note: challan.note,
    };
    setSelectedChallan(duplicated);
    setFormKey(`dup-${Date.now()}`); // force form remount to populate copied items
    window.scrollTo({ top: 0, behavior: 'smooth' });
    toast({
      title: 'Items copied!',
      description: 'A new challan has been pre-filled with the same items. Save to confirm.',
    });
  };

  const handleRestoreVersion = async (version: NewRelicChallan) => {
    try {
      import('@/services/newrelicChallanService').then(async (m) => {
        // To restore a version, we just save it as the current active data
        await m.saveNewRelicChallan(version, user?.email || null);
        toast({ title: 'Invoice reverted to previous version' });
        fetchData();
      });
    } catch {
      toast({ variant: 'destructive', title: 'Revert failed' });
    }
  };

  const handleExportExcel = () => {
    try {
      const exportData = displayChallans.flatMap((c) => 
        (c.lineItems || []).map((item) => ({
          'DC Number': c.dcNumber,
          'Date': new Date(c.dcDate).toLocaleDateString('en-IN'),
          'Location': NEWRELIC_LOCATIONS[c.location]?.label || c.location,
          'Brand Name': item.brandName || '',
          'Item Name': item.itemName,
          'Quantity': item.quantity,
          'MRP': item.mrp || 0,
          'Procurement Cost': item.procurementCost || 0,
          'Total Value': (item.mrp || 0) * item.quantity,
          'Total P.Cost': (item.procurementCost || 0) * item.quantity,
        }))
      );
      
      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Challans');
      XLSX.writeFile(wb, `Challans_Export_${new Date().toISOString().split('T')[0]}.xlsx`);
      toast({ title: 'Export successful' });
    } catch (err) {
      console.error(err);
      toast({ variant: 'destructive', title: 'Export failed' });
    }
  };

  /* ── PDF generation after preview mounts ── */
  useEffect(() => {
    if (!challanToDownload) return;

    const timer = setTimeout(async () => {
      if (previewRef.current) {
        const fileName = `DC-${challanToDownload.dcNumber}-${
          NEWRELIC_LOCATIONS[challanToDownload.location].label
        }.pdf`;
        try {
          await generateAndSavePdf(previewRef.current, fileName);
        } catch (err) {
          console.error(err);
          toast({ variant: 'destructive', title: 'PDF generation failed' });
        } finally {
          setChallanToDownload(null);
        }
      }
    }, 1000);

    return () => clearTimeout(timer);
  }, [challanToDownload, toast]);

  /* ── Stats & Filtering ── */
  const activeChallans = challans.filter((c) => !c.isDeleted);
  const trashChallans = challans.filter((c) => c.isDeleted);
  
  const displayChallans = useMemo(() => {
    let list = activeTab === 'trash' ? trashChallans : activeChallans;
    
    if (filterLocation !== 'all') {
      if (filterLocation === 'preferred' && user?.preferredLocations) {
        list = list.filter((c) => user.preferredLocations!.includes(c.location));
      } else {
        list = list.filter((c) => c.location === filterLocation);
      }
    }
    if (filterMonth !== 'all') {
      list = list.filter((c) => new Date(c.dcDate).getMonth().toString() === filterMonth);
    }
    if (filterYear !== 'all') {
      list = list.filter((c) => new Date(c.dcDate).getFullYear().toString() === filterYear);
    }
    if (filterCycle !== 'all') {
      list = list.filter((c) => {
        const date = new Date(c.dcDate).getDate();
        if (filterCycle === '1-15') return date >= 1 && date <= 15;
        if (filterCycle === '16-31') return date >= 16 && date <= 31;
        return true;
      });
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter((c) => {
        if (c.dcNumber?.toLowerCase().includes(q)) return true;
        if (c.note?.toLowerCase().includes(q)) return true;
        if (NEWRELIC_LOCATIONS[c.location]?.label?.toLowerCase().includes(q)) return true;
        if (c.lineItems?.some(item => 
          item.itemName?.toLowerCase().includes(q) ||
          item.brandName?.toLowerCase().includes(q)
        )) return true;
        return false;
      });
    }
    return list;
  }, [activeTab, activeChallans, trashChallans, filterLocation, filterMonth, filterYear, filterCycle, searchQuery]);

  const availableYears = useMemo(() => {
    return Array.from(new Set(challans.map(c => new Date(c.dcDate).getFullYear()))).sort((a, b) => b - a);
  }, [challans]);

  const hydCount = activeChallans.filter((c) => c.location === 'hyderabad').length;
  const blrCount = activeChallans.filter((c) => c.location === 'bangalore').length;

  if (!mounted) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Loader2 className="h-6 w-6 animate-spin text-[#3b2fc9]" />
          Loading Delivery Challans...
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen bg-gray-50"
      suppressHydrationWarning
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Pull-to-refresh mobile gesture indicator */}
      {pullDelta > 4 && (
        <div
          className="sm:hidden fixed top-0 left-0 right-0 z-50 flex items-end justify-center overflow-hidden transition-all bg-white/70 backdrop-blur-md shadow-xs border-b border-indigo-100"
          style={{ height: `${pullDelta}px` }}
        >
          <div className={`flex items-center gap-2 pb-2 text-xs font-bold transition-all ${
            pullState === 'triggered' ? 'text-[#3b2fc9]' : 'text-gray-500'
          }`}>
            <RefreshCcw className={`w-4 h-4 transition-transform ${
              pullState === 'triggered' ? 'animate-spin text-[#3b2fc9]' : 'rotate-180 text-gray-400'
            }`} />
            <span>
              {pullState === 'triggered' ? 'Release to refresh' : 'Pull to refresh'}
            </span>
          </div>
        </div>
      )}
      <div className="max-w-6xl mx-auto px-3 sm:px-8 py-3 sm:py-8 space-y-4 sm:space-y-8">

        {/* The Gut Guru Tracker - DC Hub Hero Banner */}
        <div className="rounded-2xl sm:rounded-3xl bg-gradient-to-r from-[#2c1d24] via-[#43232f] to-[#1e1b4b] p-4 sm:p-6 text-white shadow-lg relative overflow-hidden">
          {/* Subtle decorative glow circles */}
          <div className="absolute -right-10 -top-10 w-44 h-44 bg-purple-500/20 rounded-full blur-2xl pointer-events-none" />
          <div className="absolute right-32 -bottom-10 w-36 h-36 bg-amber-500/15 rounded-full blur-2xl pointer-events-none" />

          <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/gut_guru_logo.png"
                alt="The Gut Guru"
                className="w-11 h-11 sm:w-14 sm:h-14 rounded-full border-2 border-amber-300/40 shadow-md object-contain bg-black/20 shrink-0"
              />
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-base sm:text-xl font-black tracking-tight text-white">
                    The Gut Guru Tracker
                  </h1>
                  <span className="text-[10px] font-bold bg-amber-400/20 text-amber-300 border border-amber-400/30 px-2 py-0.5 rounded-full uppercase tracking-wider">
                    DC Hub
                  </span>
                </div>
                <p className="text-xs text-rose-100/70 font-medium mt-0.5">
                  Delivery Challans, Cafeteria Stock & Item Dispatch Management
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 self-end sm:self-center">
              <button
                type="button"
                onClick={() => {
                  triggerHaptic('light');
                  setShowCalculator(true);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-400/20 hover:bg-amber-400/30 text-amber-300 active:scale-95 text-xs font-bold transition-all border border-amber-300/40"
                title="Open MRP % Calculator"
              >
                <Calculator className="w-3.5 h-3.5" />
                <span>% Calc</span>
              </button>
              <button
                type="button"
                onClick={handlePullRefresh}
                disabled={isRefreshing}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 active:scale-95 text-xs font-semibold text-white transition-all backdrop-blur-xs border border-white/15"
              >
                <RefreshCcw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
                <span>{isRefreshing ? 'Syncing...' : 'Sync Data'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Hero stats & Dashboard */}
        {role === 'admin' || role === 'superadmin' ? (
          <NewRelicDashboard challans={displayChallans} showFinancials={isUnlocked && showFinancials} />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-4">
            <StatCard
              icon={<FileText className="h-4 sm:h-5 w-4 sm:w-5 text-white" />}
              label="Total Challans"
              value={challans.length}
              bg="bg-gradient-to-tr from-indigo-600 to-violet-600 shadow-indigo-300/40"
              cardBg="bg-gradient-to-br from-indigo-50/90 via-white to-purple-50/40 border-indigo-200/80"
              subtext="All active documents"
            />
            <StatCard
              icon={<MapPin className="h-4 sm:h-5 w-4 sm:w-5 text-white" />}
              label="Hyderabad"
              value={hydCount}
              bg="bg-gradient-to-tr from-blue-600 to-cyan-600 shadow-blue-300/40"
              cardBg="bg-gradient-to-br from-blue-50/90 via-white to-sky-50/40 border-blue-200/80"
              subtext="Mindspace · Hitec City"
            />
            <StatCard
              icon={<MapPin className="h-4 sm:h-5 w-4 sm:w-5 text-white" />}
              label="Bangalore"
              value={blrCount}
              bg="bg-gradient-to-tr from-emerald-600 to-teal-600 shadow-emerald-300/40"
              cardBg="bg-gradient-to-br from-emerald-50/90 via-white to-teal-50/40 border-emerald-200/80"
              subtext="Bagmane Tech Park"
            />
          </div>
        )}

        {/* Desktop Action Buttons (hidden on mobile, replaced by floating action button) */}
        {!selectedChallan && !isCreatingNew && (
          <>
            <div className="hidden sm:flex flex-row gap-3">
              <button
                onClick={() => handleStartCreateNew('hyderabad')}
                className="flex-1 bg-gradient-to-r from-indigo-600 via-indigo-700 to-violet-700 hover:from-indigo-700 hover:to-violet-800 text-white py-3.5 px-4 rounded-xl font-bold transition-all shadow-md shadow-indigo-200/60 active:scale-[0.98] flex items-center justify-center gap-2"
              >
                <FileText className="h-5 w-5" />
                New Challan (Hyderabad)
              </button>
              <button
                onClick={() => handleStartCreateNew('bangalore')}
                className="flex-1 bg-gradient-to-r from-emerald-600 via-emerald-700 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white py-3.5 px-4 rounded-xl font-bold transition-all shadow-md shadow-emerald-200/60 active:scale-[0.98] flex items-center justify-center gap-2"
              >
                <FileText className="h-5 w-5" />
                New Challan (Bangalore)
              </button>
              {(role === 'admin' || role === 'superadmin') && (
                <Link
                  href="/newrelic/reconcile"
                  className="flex-1 bg-gradient-to-r from-amber-500 via-amber-600 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white py-3.5 px-4 rounded-xl font-bold transition-all shadow-md shadow-amber-200/60 active:scale-[0.98] flex items-center justify-center gap-2"
                >
                  <RefreshCcw className="h-5 w-5" />
                  Reconcile
                </Link>
              )}
              {(role === 'admin' || role === 'superadmin') && (
                <button
                  onClick={handleExportExcel}
                  className="flex-1 bg-gradient-to-r from-blue-600 via-blue-700 to-cyan-700 hover:from-blue-700 hover:to-cyan-800 text-white py-3.5 px-4 rounded-xl font-bold transition-all shadow-md shadow-blue-200/60 active:scale-[0.98] flex items-center justify-center gap-2"
                >
                  <FileSpreadsheet className="h-5 w-5" />
                  Export Excel
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  triggerHaptic('light');
                  setShowCalculator(true);
                }}
                className="bg-white hover:bg-gray-50 border border-gray-200 hover:border-[#3b2fc9]/40 text-gray-800 py-3.5 px-4 rounded-xl font-bold transition-all shadow-xs active:scale-[0.98] flex items-center justify-center gap-2 group shrink-0"
                title="Calculate MRP percentage and purchase cost"
              >
                <Calculator className="h-5 w-5 text-[#3b2fc9] group-hover:scale-110 transition-transform" />
                <span>% Calculator</span>
              </button>
            </div>

            {/* Native Mobile Floating Action Button (+) */}
            <MobileFloatingActions
              onNewChallan={(loc) => handleStartCreateNew(loc)}
              onExportExcel={(role === 'admin' || role === 'superadmin') ? handleExportExcel : undefined}
              canReconcile={role === 'admin' || role === 'superadmin'}
              onOpenCalculator={() => setShowCalculator(true)}
            />

            {/* Floating Mobile Calculator Button */}
            <button
              type="button"
              onClick={() => {
                triggerHaptic('light');
                setShowCalculator(true);
              }}
              className={`fixed ${showScrollTop ? 'left-4 bottom-44' : 'left-4 bottom-26'} z-30 w-12 h-12 rounded-full bg-gradient-to-tr from-[#181156] via-[#2a1d8f] to-[#3b2fc9] shadow-2xl shadow-indigo-950/70 text-amber-300 border-2 border-white/30 flex items-center justify-center sm:hidden active:scale-90 transition-all`}
              aria-label="MRP Calculator"
              title="MRP % Calculator"
            >
              <Calculator className="w-5 h-5 stroke-[2.2]" />
            </button>

            {/* Floating Back to Top Button on Mobile */}
            {showScrollTop && (
              <button
                type="button"
                onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                className="fixed left-4 bottom-26 z-30 w-12 h-12 rounded-full bg-white/95 backdrop-blur-md shadow-xl border border-gray-200 text-gray-700 hover:text-[#3b2fc9] flex items-center justify-center sm:hidden active:scale-90 transition-transform animate-in fade-in"
                aria-label="Scroll to top"
              >
                <ArrowUp className="w-5 h-5 stroke-[2.2]" />
              </button>
            )}
          </>
        )}

        {/* Form Container */}
        {(selectedChallan || isCreatingNew) && (
          <div id="challan-form-section">
            <NewRelicChallanForm
              key={selectedChallan?.id ?? (isCreatingNew ? `new-${isCreatingNew}` : formKey)}
              initialData={selectedChallan}
              defaultLocation={isCreatingNew || undefined}
              onChallanSave={handleSave}
              onAddNew={() => {
                setSelectedChallan(null);
                setIsCreatingNew(null);
              }}
              onCancel={() => {
                setSelectedChallan(null);
                setIsCreatingNew(null);
              }}
            />
          </div>
        )}

        {/* Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none no-scrollbar">
          <button
            onClick={() => setActiveTab('active')}
            className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2 shrink-0 ${
              activeTab === 'active'
                ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-sm shadow-indigo-200'
                : 'bg-white border border-gray-200 text-gray-600 hover:text-gray-900 hover:border-gray-300'
            }`}
          >
            <span>Active Challans</span>
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-black ${
              activeTab === 'active' ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-700'
            }`}>
              {activeChallans.length}
            </span>
          </button>

          {(role === 'admin' || role === 'superadmin') && (
            <>
              <Link
                href="/newrelic/analytics"
                className="px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-1.5 shrink-0 bg-white border border-gray-200 text-gray-700 hover:text-indigo-600 hover:border-indigo-200 hover:bg-indigo-50/40"
              >
                <span>📊 Analytics</span>
              </Link>

              <button
                onClick={() => setActiveTab('items')}
                className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-1.5 shrink-0 ${
                  activeTab === 'items'
                    ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-sm shadow-indigo-200'
                    : 'bg-white border border-gray-200 text-gray-600 hover:text-gray-900 hover:border-gray-300'
                }`}
              >
                <span>📋 Item Ledger</span>
              </button>

              <button
                onClick={() => setActiveTab('trash')}
                className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2 shrink-0 ${
                  activeTab === 'trash'
                    ? 'bg-gradient-to-r from-rose-600 to-red-600 text-white shadow-sm shadow-rose-200'
                    : 'bg-white border border-gray-200 text-gray-600 hover:text-gray-900 hover:border-gray-300'
                }`}
              >
                <span>Trash / Audit</span>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-black ${
                  activeTab === 'trash' ? 'bg-white/20 text-white' : 'bg-rose-50 text-rose-600'
                }`}>
                  {trashChallans.length}
                </span>
              </button>
            </>
          )}
        </div>

        {/* Instant Search Bar & Filter Controls */}
        <div className="space-y-2.5">
          {/* Instant Search Input */}
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-indigo-500 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search challans by DC#, brand, or item name..."
              className="w-full h-11 sm:h-10 pl-10 pr-9 bg-white border border-indigo-100 rounded-2xl text-xs sm:text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 shadow-2xs transition-all"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-100"
                aria-label="Clear search"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Filters Section: Segmented Location Switcher + Quick Presets + More Filters */}
          <div className="bg-white p-3 sm:p-4 rounded-2xl border border-indigo-100/70 shadow-xs space-y-2.5">
            {/* Top Row: Segmented Location Switcher (Mobile & Desktop) */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <div className="inline-flex p-1 bg-gray-100/90 rounded-xl max-w-full overflow-x-auto scrollbar-none no-scrollbar gap-1">
                {user?.preferredLocations && user.preferredLocations.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic('light');
                      setFilterLocation('preferred');
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${
                      filterLocation === 'preferred'
                        ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-xs'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    ⭐ Preferred
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic('light');
                    setFilterLocation('all');
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${
                    filterLocation === 'all'
                      ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-xs'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  All Hubs ({activeChallans.length})
                </button>
                {Object.entries(NEWRELIC_LOCATIONS).map(([key, loc]) => {
                  const count = activeChallans.filter(c => c.location === key).length;
                  const isSelected = filterLocation === key;
                  const activeColor =
                    key === 'hyderabad'
                      ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-xs'
                      : 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-xs';

                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => {
                        triggerHaptic('light');
                        setFilterLocation(key);
                      }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${
                        isSelected ? activeColor : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      {loc.label} <span className="text-[10px] opacity-80">({count})</span>
                    </button>
                  );
                })}
              </div>

              {/* Financial Unlock Toggle (Admin) */}
              {(role === 'admin' || role === 'superadmin') && (
                <div className="flex items-center gap-2 sm:ml-auto">
                  {isUnlocked ? (
                    <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-lg w-full sm:w-auto justify-between sm:justify-start">
                      <label className="text-xs text-emerald-800 cursor-pointer flex items-center gap-1.5 font-semibold">
                        <input
                          type="checkbox"
                          checked={showFinancials}
                          onChange={(e) => setShowFinancials(e.target.checked)}
                          className="rounded text-emerald-600 focus:ring-emerald-500 h-3.5 w-3.5"
                        />
                        <Unlock className="h-3.5 w-3.5 text-emerald-600" />
                        Financials Visible ({remainingMinutes}m)
                      </label>
                      <button
                        onClick={() => {
                          lockFinancials();
                          setShowFinancials(false);
                        }}
                        className="text-[10px] text-red-600 hover:text-red-800 underline font-medium ml-1"
                        title="Lock now"
                      >
                        Lock
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setShowFinancialModal(true)}
                      className="w-full sm:w-auto flex items-center justify-center gap-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold px-3 py-1.5 rounded-lg border border-gray-200 shadow-xs transition-colors"
                    >
                      <Lock className="h-3.5 w-3.5 text-gray-500" />
                      Unlock Financials
                    </button>
                  )}
                </div>
              )}

              {/* MRP % Calculator Trigger */}
              <button
                type="button"
                onClick={() => {
                  triggerHaptic('light');
                  setShowCalculator(true);
                }}
                className="flex items-center gap-1.5 bg-gradient-to-r from-purple-50 to-indigo-50 hover:from-purple-100 hover:to-indigo-100 text-[#3b2fc9] text-xs font-bold px-3 py-1.5 rounded-lg border border-purple-200/80 shadow-2xs transition-colors shrink-0 ml-auto sm:ml-0"
                title="MRP % Calculator"
              >
                <Calculator className="h-3.5 w-3.5" />
                <span>MRP % Calc</span>
              </button>
            </div>

            {/* Bottom Row: Date Presets & Filter Reset (Cycle only shown for admin/superadmin) */}
            <div className="pt-2 border-t border-gray-100 flex flex-wrap items-center justify-between gap-2">
              {/* Cycle Presets: Only visible to Admin / Superadmin */}
              {(role === 'admin' || role === 'superadmin') ? (
                <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none no-scrollbar py-0.5">
                  <span className="text-[11px] font-bold text-gray-400 mr-1 hidden sm:inline">Cycle:</span>
                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic('light');
                      setFilterCycle('all');
                    }}
                    className={`h-7 px-2.5 rounded-full text-xs font-medium transition-all ${
                      filterCycle === 'all'
                        ? 'bg-[#3b2fc9]/10 text-[#3b2fc9] font-bold border border-[#3b2fc9]/30'
                        : 'bg-gray-50 text-gray-600 hover:bg-gray-100 border border-gray-200/70'
                    }`}
                  >
                    All Dates
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic('light');
                      setFilterCycle('1-15');
                    }}
                    className={`h-7 px-2.5 rounded-full text-xs font-medium transition-all ${
                      filterCycle === '1-15'
                        ? 'bg-[#3b2fc9]/10 text-[#3b2fc9] font-bold border border-[#3b2fc9]/30'
                        : 'bg-gray-50 text-gray-600 hover:bg-gray-100 border border-gray-200/70'
                    }`}
                  >
                    Cycle 1 (1–15)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic('light');
                      setFilterCycle('16-31');
                    }}
                    className={`h-7 px-2.5 rounded-full text-xs font-medium transition-all ${
                      filterCycle === '16-31'
                        ? 'bg-[#3b2fc9]/10 text-[#3b2fc9] font-bold border border-[#3b2fc9]/30'
                        : 'bg-gray-50 text-gray-600 hover:bg-gray-100 border border-gray-200/70'
                    }`}
                  >
                    Cycle 2 (16–End)
                  </button>
                </div>
              ) : (
                <div className="text-xs font-medium text-gray-400 flex items-center gap-1">
                  <span>📅 Filter by Date:</span>
                </div>
              )}

              {/* Date Pickers (Month & Year) & Clear Filters */}
              <div className="flex items-center gap-2 ml-auto">
                {/* Month Pill */}
                <div className="relative">
                  <select
                    value={filterMonth}
                    onChange={(e) => {
                      triggerHaptic('light');
                      setFilterMonth(e.target.value);
                    }}
                    className={`h-7 pl-2.5 pr-6 rounded-full text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-[#3b2fc9] appearance-none cursor-pointer border transition-colors ${
                      filterMonth !== 'all'
                        ? 'bg-[#3b2fc9]/10 text-[#3b2fc9] border-[#3b2fc9]/30'
                        : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
                    }`}
                  >
                    <option value="all">📅 All Months</option>
                    {Array.from({ length: 12 }, (_, i) => {
                      const date = new Date(2000, i, 1);
                      return <option key={i} value={i}>{date.toLocaleString('default', { month: 'short' })}</option>;
                    })}
                  </select>
                  <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[8px] text-gray-400">▼</span>
                </div>

                {/* Year Pill */}
                <div className="relative">
                  <select
                    value={filterYear}
                    onChange={(e) => {
                      triggerHaptic('light');
                      setFilterYear(e.target.value);
                    }}
                    className={`h-7 pl-2.5 pr-6 rounded-full text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-[#3b2fc9] appearance-none cursor-pointer border transition-colors ${
                      filterYear !== 'all'
                        ? 'bg-[#3b2fc9]/10 text-[#3b2fc9] border-[#3b2fc9]/30'
                        : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
                    }`}
                  >
                    <option value="all">🗓️ All Years</option>
                    {availableYears.map(year => (
                      <option key={year} value={year}>{year}</option>
                    ))}
                  </select>
                  <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[8px] text-gray-400">▼</span>
                </div>

                {/* Clear Active Filters Button */}
                {(filterLocation !== (user?.preferredLocations && user.preferredLocations.length === 1 ? user.preferredLocations[0] : (user?.preferredLocations?.length ? 'preferred' : 'all')) || filterMonth !== 'all' || filterYear !== 'all' || filterCycle !== 'all' || searchQuery.trim() !== '') && (
                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic('medium');
                      const defaultLoc = user?.preferredLocations && user.preferredLocations.length === 1 
                        ? user.preferredLocations[0] 
                        : (user?.preferredLocations?.length ? 'preferred' : 'all');
                      setFilterLocation(defaultLoc);
                      setFilterMonth('all');
                      setFilterYear('all');
                      setFilterCycle('all');
                      setSearchQuery('');
                    }}
                    className="h-7 px-2 rounded-full text-xs font-semibold text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 transition-colors flex items-center gap-1"
                    title="Reset all filters"
                  >
                    <X className="w-3 h-3" />
                    <span>Reset</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {searchQuery && (
            <div className="flex items-center justify-between text-xs px-2 text-gray-500">
              <span>Showing {displayChallans.length} challan{displayChallans.length !== 1 ? 's' : ''} for &ldquo;<strong className="text-gray-800">{searchQuery}</strong>&rdquo;</span>
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="text-[#3b2fc9] hover:underline font-semibold"
              >
                Clear
              </button>
            </div>
          )}
        </div>

        {/* Main Content Area */}
        {isLoading ? (
          <ChallanSkeletonLoader count={4} />
        ) : activeTab === 'items' ? (
          <NewRelicItemDashboard challans={displayChallans} />
        ) : activeTab === 'trash' ? (
          <div className="space-y-8">
            <NewRelicChallanList
              challans={displayChallans}
              isTrashView={true}
              role={role}
              showFinancials={isUnlocked && showFinancials}
              onSelectChallan={handleEditChallan}
              onDownloadChallan={handleDownload}
              onDeleteChallan={handleDelete}
              onDuplicateChallan={handleDuplicate}
              onViewHistory={setHistoryChallan}
              onPreviewChallan={setPreviewChallan}
              onAdminPreviewChallan={setAdminPreviewChallan}
              onRestoreChallan={handleRestore}
            />
            {role === 'admin' && (
              <div className="mt-12">
                <NewRelicGlobalAuditLog />
              </div>
            )}
          </div>
        ) : (
          <NewRelicChallanList
            challans={displayChallans}
            isTrashView={false}
            role={role}
            showFinancials={isUnlocked && showFinancials}
            onSelectChallan={handleEditChallan}
            onDownloadChallan={handleDownload}
            onDeleteChallan={handleDelete}
            onDuplicateChallan={handleDuplicate}
            onViewHistory={setHistoryChallan}
            onPreviewChallan={setPreviewChallan}
            onAdminPreviewChallan={setAdminPreviewChallan}
            onRestoreChallan={handleRestore}
          />
        )}
      </div>

      {historyChallan && (
        <NewRelicChallanHistoryModal
          isOpen={!!historyChallan}
          onClose={() => setHistoryChallan(null)}
          challanId={historyChallan.id!}
          dcNumber={historyChallan.dcNumber}
          currentChallan={historyChallan}
          onRestoreVersion={handleRestoreVersion}
        />
      )}

      {/* Visual Preview Modal */}
      <NewRelicChallanViewModal
        isOpen={!!previewChallan}
        onClose={() => setPreviewChallan(null)}
        challan={previewChallan}
        onDownload={(c) => {
          setPreviewChallan(null);
          handleDownload(c);
        }}
      />

      <NewRelicAdminPreviewModal
        isOpen={!!adminPreviewChallan}
        onClose={() => setAdminPreviewChallan(null)}
        challan={adminPreviewChallan}
      />

      {/* Hidden PDF preview container for html2canvas */}
      {/* Financial Authentication Password Modal */}
      <FinancialPasswordModal
        isOpen={showFinancialModal}
        onClose={() => setShowFinancialModal(false)}
        onSuccess={() => setShowFinancials(true)}
      />

      {/* MRP Percentage & Value Calculator Modal */}
      <MrpCalculatorModal
        isOpen={showCalculator}
        onClose={() => setShowCalculator(false)}
      />

      {challanToDownload && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '794px',
            opacity: 0,
            pointerEvents: 'none',
            zIndex: -9999,
            overflow: 'visible',
          }}
        >
          <NewRelicChallanPreview ref={previewRef} challan={challanToDownload} />
        </div>
      )}
    </div>
  );
}

/* ── Stat card sub-component ── */
function StatCard({
  icon,
  label,
  value,
  bg,
  cardBg,
  subtext,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  bg: string;
  cardBg?: string;
  subtext?: string;
}) {
  return (
    <div className={`rounded-xl sm:rounded-2xl border ${cardBg || 'border-gray-200 bg-white'} shadow-2xs sm:shadow-sm p-3 sm:p-5 flex flex-col sm:flex-row items-center sm:items-center text-center sm:text-left gap-2 sm:gap-4 transition-all hover:shadow-md`}>
      <div className={`${bg} p-2.5 sm:p-3 rounded-xl sm:rounded-2xl shrink-0 shadow-xs`}>{icon}</div>
      <div className="min-w-0">
        <p className="text-lg sm:text-2xl font-black text-gray-900 leading-tight">{value}</p>
        <p className="text-[11px] sm:text-xs text-gray-600 font-bold truncate">{label}</p>
        {subtext && <p className="text-[10px] text-gray-400 font-medium hidden sm:block truncate">{subtext}</p>}
      </div>
    </div>
  );
}
