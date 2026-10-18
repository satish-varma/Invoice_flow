'use client';
import { NewRelicChallan, NewRelicLocation } from '@/types/challan';

import React, { useEffect, useRef, useState, useMemo } from 'react';
import { Loader2, FileText, MapPin, Filter, FileSpreadsheet, RefreshCcw, Search, X, ArrowUp, Calculator } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
import * as XLSX from 'xlsx';
import {getNewRelicChallans, deleteNewRelicChallan, revertNewRelicChallanVersion, NEWRELIC_LOCATIONS} from '@/services/newrelicChallanService';
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
import { checkUserCheckedInToday } from '@/services/newrelicAttendanceService';
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
  const { role, user, isReadOnly } = useAuth();
  const isAdmin = role === 'admin' || role === 'superadmin';

  // Route guard: Only redirect if user does not have permission for NewRelic DC
  useEffect(() => {
    if (user && !isAdmin && role !== 'guest' && !hasPermission(user, 'newrelic_dc')) {
      router.replace('/newrelic/tuckshop');
    }
  }, [isAdmin, user, role, router]);

  // Non-blocking attendance check: If daily check-in is pending, show reminder banner without trapping user
  const [isAttendancePending, setIsAttendancePending] = useState(false);
  useEffect(() => {
    if (!user || isAdmin || role === 'guest') return;
    let isSubscribed = true;
    checkUserCheckedInToday(user.id, user.email).then((hasCheckedIn) => {
      if (isSubscribed) {
        setIsAttendancePending(!hasCheckedIn);
      }
    });
    return () => {
      isSubscribed = false;
    };
  }, [isAdmin, user, role]);
  
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

  // Initialize filterLocation defaulting to user's preferred location
  useEffect(() => {
    if (user?.preferredLocations && user.preferredLocations.length > 0) {
      setFilterLocation(user.preferredLocations[0]);
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
    setFormKey(`new-${loc}-${Date.now()}`);
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
    toast({
      title: 'Generating Delivery Challan...',
      description: `Preparing DC ${challan.dcNumber} for download`,
    });
    setChallanToDownload(challan);
  };

  const handleDelete = async (id: string) => {
    if (isReadOnly || role === 'guest') {
      toast({ variant: 'destructive', title: 'Read-Only Mode', description: 'Guest account cannot delete challans.' });
      return;
    }
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
    if (isReadOnly || role === 'guest') {
      toast({ variant: 'destructive', title: 'Read-Only Mode', description: 'Guest account cannot restore challans.' });
      return;
    }
    try {
      const { restoreNewRelicChallans } = await import('@/services/newrelicChallanService');
      await restoreNewRelicChallans([id], user?.email || null);
      toast({ title: 'Challan restored' });
      await fetchData();
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
    if (isReadOnly || role === 'guest') {
      toast({ variant: 'destructive', title: 'Read-Only Mode', description: 'Guest account cannot restore versions.' });
      return;
    }
    try {
      const challanId = version.id || historyChallan?.id;
      if (!challanId) {
        throw new Error('Missing document ID for restore');
      }
      await revertNewRelicChallanVersion(challanId, version, user?.email || null);
      toast({
        title: 'Version Restored',
        description: `Successfully reverted ${version.dcNumber || historyChallan?.dcNumber || 'challan'} to previous version.`,
      });
      await fetchData();
      setHistoryChallan(null);
    } catch (err: any) {
      console.error('Revert failed:', err);
      toast({
        variant: 'destructive',
        title: 'Revert failed',
        description: err?.message || 'Failed to revert to previous state.',
      });
      throw err;
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

  /* ── Listeners for Mobile Navigation Center (+) Actions and Query Params ── */
  const handleStartCreateNewRef = useRef(handleStartCreateNew);
  handleStartCreateNewRef.current = handleStartCreateNew;
  const handleExportExcelRef = useRef(handleExportExcel);
  handleExportExcelRef.current = handleExportExcel;

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const action = params.get('action');
    const loc = params.get('location') as NewRelicLocation | null;
    if (action === 'new') {
      handleStartCreateNewRef.current(loc === 'bangalore' ? 'bangalore' : 'hyderabad');
    } else if (action === 'calculator' && isAdmin) {
      setShowCalculator(true);
    } else if (action === 'export' && isAdmin) {
      handleExportExcelRef.current();
    }
  }, [isAdmin]);

  useEffect(() => {
    const handleOpenNew = (e: Event) => {
      const customEvent = e as CustomEvent<{ location?: NewRelicLocation }>;
      handleStartCreateNewRef.current(customEvent.detail?.location || 'hyderabad');
    };
    const handleOpenCalc = () => {
      if (isAdmin) setShowCalculator(true);
    };
    const handleExport = () => {
      if (isAdmin) handleExportExcelRef.current();
    };

    window.addEventListener('open-new-challan', handleOpenNew);
    window.addEventListener('open-mrp-calculator', handleOpenCalc);
    window.addEventListener('export-dc-excel', handleExport);
    window.addEventListener('export-newrelic-excel', handleExport);
    return () => {
      window.removeEventListener('open-new-challan', handleOpenNew);
      window.removeEventListener('open-mrp-calculator', handleOpenCalc);
      window.removeEventListener('export-dc-excel', handleExport);
      window.removeEventListener('export-newrelic-excel', handleExport);
    };
  }, [isAdmin]);

  /* ── PDF generation after preview mounts ── */
  useEffect(() => {
    if (!challanToDownload) return;

    const timer = setTimeout(async () => {
      try {
        if (!previewRef.current) {
          console.warn("Preview ref not ready after timeout");
          return;
        }
        const locLabel = NEWRELIC_LOCATIONS[challanToDownload.location]?.label || challanToDownload.location;
        const fileName = `DC-${challanToDownload.dcNumber}-${locLabel}.pdf`;
        await generateAndSavePdf(previewRef.current, fileName);
        toast({
          title: 'Delivery Challan Downloaded',
          description: fileName,
        });
      } catch (err) {
        console.error("PDF generation failed:", err);
        toast({
          variant: 'destructive',
          title: 'PDF generation failed',
          description: err instanceof Error ? err.message : String(err),
        });
      } finally {
        setChallanToDownload(null);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [challanToDownload, toast]);

  /* ── Stats & Filtering ── */
  const activeChallans = useMemo(() => {
    const seen = new Map<string, NewRelicChallan>();
    for (const c of challans) {
      if (!c.isDeleted) {
        const dc = c.dcNumber?.trim();
        if (dc && !seen.has(dc)) {
          seen.set(dc, c);
        } else if (!dc) {
          seen.set(c.id || Math.random().toString(), c);
        }
      }
    }
    return Array.from(seen.values());
  }, [challans]);
  const trashChallans = challans.filter((c) => c.isDeleted);
  
  const displayChallans = useMemo(() => {
    let list = activeTab === 'trash' ? trashChallans : activeChallans;
    
    if (filterLocation !== 'all') {
      list = list.filter((c) => c.location === filterLocation);
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

  const cycleTotalValue = useMemo(() => {
    return displayChallans.reduce((sum, c) => {
      const mrp = (c.lineItems || []).reduce(
        (acc, item) => acc + (Number(item.mrp || 0) * Number(item.quantity || 1)),
        0
      );
      return sum + mrp;
    }, 0);
  }, [displayChallans]);

  const hydCount = activeChallans.filter((c) => c.location === 'hyderabad').length;
  const blrCount = activeChallans.filter((c) => c.location === 'bangalore').length;

  if (!mounted) {
    return (
      <div className="min-h-screen bg-transparent flex items-center justify-center">
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Loader2 className="h-6 w-6 animate-spin text-[#3b2fc9]" />
          Loading Delivery Challans...
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen bg-transparent"
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

        {/* Attendance Check-In Reminder Banner */}
        {isAttendancePending && (
          <div className="bg-amber-50/95 border border-amber-200 rounded-2xl p-3 sm:p-4 flex items-center justify-between gap-3 shadow-xs animate-in fade-in">
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="text-base shrink-0">⚠️</span>
              <div className="min-w-0">
                <p className="text-xs font-bold text-amber-900 truncate">
                  Daily Attendance Check-In Pending
                </p>
                <p className="text-[11px] text-amber-700 font-medium">
                  Remember to record today&apos;s shift attendance with camera selfie.
                </p>
              </div>
            </div>
            <Link
              href="/newrelic/attendance"
              className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs shrink-0 active:scale-95 transition-all shadow-xs"
            >
              Check In
            </Link>
          </div>
        )}

        {/* DC Page Header - Large Title on Mobile */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                Delivery Challans
              </h1>
              <span className="text-xs font-black bg-gradient-to-r from-indigo-500/10 to-purple-500/10 text-indigo-700 dark:text-indigo-300 border border-indigo-200/80 px-2.5 py-0.5 rounded-full uppercase tracking-wider shrink-0">
                DC Hub
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium truncate mt-0.5">
              Cafeteria stock, inward challans &amp; dispatch management
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
            {(role === 'admin' || role === 'superadmin') && (
              <button
                type="button"
                onClick={() => {
                  triggerHaptic('light');
                  setShowCalculator(true);
                }}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-purple-50 hover:bg-purple-100 text-[#3b2fc9] text-xs font-bold transition-all border border-purple-200/80 shadow-2xs active:scale-95"
                title="Open MRP % Calculator"
              >
                <Calculator className="w-4 h-4" />
                <span>% Calc</span>
              </button>
            )}
            <button
              type="button"
              onClick={handlePullRefresh}
              disabled={isRefreshing}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white hover:bg-slate-50 active:scale-95 text-xs font-bold text-slate-700 transition-all border border-slate-200 shadow-2xs cursor-pointer"
            >
              <RefreshCcw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-indigo-600' : 'text-slate-500'}`} />
              <span>{isRefreshing ? 'Syncing...' : 'Sync Data'}</span>
            </button>
          </div>
        </div>

        {/* Hero stats & Dashboard */}
        {role === 'admin' || role === 'superadmin' ? (
          <NewRelicDashboard challans={displayChallans} showFinancials={isUnlocked && showFinancials} />
        ) : (
          <div className="grid grid-cols-3 gap-2 sm:gap-4">
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
              {(role === 'admin' || role === 'superadmin') && (
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
              )}
            </div>

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
              key={formKey || selectedChallan?.id || (isCreatingNew ? `new-${isCreatingNew}` : 'new')}
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

        {/* Tabs - Show full tab bar for Admin; for user/manager hide single Active Challans card on mobile */}
        {role === 'admin' || role === 'superadmin' ? (
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
          </div>
        ) : (
          <div className="hidden sm:flex items-center gap-2 pb-1">
            <div className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200/80 flex items-center gap-2">
              <span>Active Challans</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full font-black bg-indigo-600 text-white">
                {activeChallans.length}
              </span>
            </div>
          </div>
        )}

        {/* Instant Search Bar & Filter Controls */}
        <div className="space-y-3">
          {/* Instant Search Input */}
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-indigo-500 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search challans by DC#, brand, or item name..."
              className="w-full h-12 sm:h-11 pl-10 pr-10 bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 shadow-sm transition-all"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800"
                aria-label="Clear search"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Filters Section: Segmented Location Switcher + Quick Presets + More Filters */}
          <div className="bg-white dark:bg-slate-900 p-3.5 sm:p-4 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] space-y-3">
            {/* Top Row: Segmented Location Switcher (Mobile & Desktop) */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              {/* Responsive Segmented Switcher (Fluid pill container) */}
              <div className="flex items-center p-1 bg-slate-100 dark:bg-slate-800/80 rounded-2xl w-full sm:w-auto gap-1 border border-slate-200/70 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic('light');
                    setFilterLocation('all');
                  }}
                  className={`flex-1 sm:flex-initial flex items-center justify-center text-center px-3 sm:px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                    filterLocation === 'all'
                      ? 'bg-gradient-to-r from-indigo-600 to-[#3b2fc9] text-white shadow-xs font-black'
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 hover:bg-white/60'
                  }`}
                >
                  All Hubs ({activeChallans.length})
                </button>
                {Object.entries(NEWRELIC_LOCATIONS).map(([key, loc]) => {
                  const count = activeChallans.filter(c => c.location === key).length;
                  const isSelected = filterLocation === key;
                  const activeColor =
                    key === 'hyderabad'
                      ? 'bg-gradient-to-r from-sky-500 to-blue-600 text-white shadow-xs font-black'
                      : 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-xs font-black';

                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => {
                        triggerHaptic('light');
                        setFilterLocation(key);
                      }}
                      className={`flex-1 sm:flex-initial flex items-center justify-center text-center px-3 sm:px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                        isSelected ? activeColor : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 hover:bg-white/60'
                      }`}
                    >
                      {loc.label} <span className="text-[10px] opacity-80 ml-1">({count})</span>
                    </button>
                  );
                })}
              </div>

              {/* Financial Unlock Toggle (Admin) */}
              {(role === 'admin' || role === 'superadmin') && (
                <div className="flex items-center gap-2 sm:ml-auto">
                  {isUnlocked ? (
                    <div className="flex items-center gap-2 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 px-3 py-1.5 rounded-xl w-full sm:w-auto justify-between sm:justify-start">
                      <label className="text-xs text-emerald-800 dark:text-emerald-300 cursor-pointer flex items-center gap-1.5 font-bold">
                        <input
                          type="checkbox"
                          checked={showFinancials}
                          onChange={(e) => setShowFinancials(e.target.checked)}
                          className="rounded text-emerald-600 focus:ring-emerald-500 h-4 w-4"
                        />
                        <Unlock className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                        Financials Visible ({remainingMinutes}m)
                      </label>
                      <button
                        onClick={() => {
                          lockFinancials();
                          setShowFinancials(false);
                        }}
                        className="text-xs text-red-600 hover:text-red-800 underline font-semibold ml-1.5"
                        title="Lock now"
                      >
                        Lock
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setShowFinancialModal(true)}
                      className="w-full sm:w-auto flex items-center justify-center gap-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 text-xs font-bold px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 shadow-2xs transition-colors"
                    >
                      <Lock className="h-4 w-4 text-slate-500" />
                      Unlock Financials
                    </button>
                  )}
                </div>
              )}

              {/* MRP % Calculator Trigger - Admin & Superadmin only */}
              {(role === 'admin' || role === 'superadmin') && (
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic('light');
                    setShowCalculator(true);
                  }}
                  className="flex items-center gap-1.5 bg-gradient-to-r from-purple-50 to-indigo-50 hover:from-purple-100 hover:to-indigo-100 text-[#3b2fc9] text-xs font-bold px-3.5 py-2 rounded-xl border border-purple-200/80 shadow-2xs transition-colors shrink-0 ml-auto sm:ml-0 active:scale-95"
                  title="MRP % Calculator"
                >
                  <Calculator className="h-4 w-4" />
                  <span>MRP % Calc</span>
                </button>
              )}
            </div>

            {/* Bottom Row: Date Presets & Filter Reset */}
            <div className="pt-2.5 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
              {/* Cycle Presets: Only visible to Admin / Superadmin */}
              {(role === 'admin' || role === 'superadmin') ? (
                <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none no-scrollbar py-0.5">
                  <span className="text-xs font-bold text-slate-400 mr-1 hidden sm:inline">Cycle:</span>
                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic('light');
                      setFilterCycle('all');
                    }}
                    className={`h-9 sm:h-8 px-3.5 rounded-full text-xs font-bold transition-all active:scale-95 ${
                      filterCycle === 'all'
                        ? 'bg-[#3b2fc9]/10 text-[#3b2fc9] font-black border border-[#3b2fc9]/30 shadow-2xs'
                        : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100 border border-slate-200/80 dark:border-slate-700'
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
                    className={`h-9 sm:h-8 px-3.5 rounded-full text-xs font-bold transition-all active:scale-95 ${
                      filterCycle === '1-15'
                        ? 'bg-[#3b2fc9]/10 text-[#3b2fc9] font-black border border-[#3b2fc9]/30 shadow-2xs'
                        : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100 border border-slate-200/80 dark:border-slate-700'
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
                    className={`h-9 sm:h-8 px-3.5 rounded-full text-xs font-bold transition-all active:scale-95 ${
                      filterCycle === '16-31'
                        ? 'bg-[#3b2fc9]/10 text-[#3b2fc9] font-black border border-[#3b2fc9]/30 shadow-2xs'
                        : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100 border border-slate-200/80 dark:border-slate-700'
                    }`}
                  >
                    Cycle 2 (16–End)
                  </button>

                  {/* Total Value for Cycle */}
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-950/40 dark:to-purple-950/40 border border-indigo-200/80 dark:border-indigo-800 text-xs shrink-0 shadow-2xs ml-1">
                    <span className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400">
                      {filterCycle === '1-15' ? 'Cycle 1' : filterCycle === '16-31' ? 'Cycle 2' : 'Cycle'} Value:
                    </span>
                    <span className="font-black text-[#3b2fc9] dark:text-indigo-400 font-mono text-xs sm:text-sm">
                      ₹{cycleTotalValue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="text-xs font-bold text-slate-400 flex items-center gap-1">
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
                    className={`h-9 sm:h-8 pl-3 pr-7 rounded-full text-xs font-bold focus:outline-none focus:ring-2 focus:ring-[#3b2fc9]/30 appearance-none cursor-pointer border transition-all ${
                      filterMonth !== 'all'
                        ? 'bg-[#3b2fc9]/10 text-[#3b2fc9] border-[#3b2fc9]/30'
                        : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <option value="all">📅 All Months</option>
                    {Array.from({ length: 12 }, (_, i) => {
                      const date = new Date(2000, i, 1);
                      return <option key={i} value={i}>{date.toLocaleString('default', { month: 'short' })}</option>;
                    })}
                  </select>
                  <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[9px] text-slate-400">▼</span>
                </div>

                {/* Year Pill */}
                <div className="relative">
                  <select
                    value={filterYear}
                    onChange={(e) => {
                      triggerHaptic('light');
                      setFilterYear(e.target.value);
                    }}
                    className={`h-9 sm:h-8 pl-3 pr-7 rounded-full text-xs font-bold focus:outline-none focus:ring-2 focus:ring-[#3b2fc9]/30 appearance-none cursor-pointer border transition-all ${
                      filterYear !== 'all'
                        ? 'bg-[#3b2fc9]/10 text-[#3b2fc9] border-[#3b2fc9]/30'
                        : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <option value="all">🗓️ All Years</option>
                    {availableYears.map(year => (
                      <option key={year} value={year}>{year}</option>
                    ))}
                  </select>
                  <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[9px] text-slate-400">▼</span>
                </div>

                {/* Clear Active Filters Button */}
                {(filterLocation !== (user?.preferredLocations?.[0] || 'all') || filterMonth !== 'all' || filterYear !== 'all' || filterCycle !== 'all' || searchQuery.trim() !== '') && (
                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic('medium');
                      const defaultLoc = user?.preferredLocations?.[0] || 'all';
                      setFilterLocation(defaultLoc);
                      setFilterMonth('all');
                      setFilterYear('all');
                      setFilterCycle('all');
                      setSearchQuery('');
                    }}
                    className="h-9 sm:h-8 px-3 rounded-full text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 transition-colors flex items-center gap-1 active:scale-95"
                    title="Reset all filters"
                  >
                    <X className="w-3.5 h-3.5" />
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
        onEdit={(c) => {
          setPreviewChallan(null);
          handleEditChallan(c);
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
          id="newrelic-pdf-capture-container"
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '794px',
            zIndex: -9999,
            pointerEvents: 'none',
            overflow: 'visible',
            backgroundColor: '#ffffff',
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
    <div className={`rounded-2xl sm:rounded-3xl border ${cardBg || 'border-slate-200 bg-white'} shadow-[0_4px_16px_-4px_rgba(0,0,0,0.06)] p-2.5 sm:p-5 flex flex-col sm:flex-row items-center text-center sm:text-left gap-1.5 sm:gap-4 transition-all hover:shadow-md`}>
      <div className={`${bg} p-2 sm:p-3 rounded-xl sm:rounded-2xl shrink-0 shadow-xs`}>{icon}</div>
      <div className="min-w-0 w-full">
        <p className="text-base sm:text-2xl font-black text-slate-900 dark:text-white leading-tight font-mono tabular-nums">{value}</p>
        <p className="text-[10px] sm:text-xs text-slate-600 dark:text-slate-400 font-bold truncate mt-0.5">{label}</p>
        {subtext && <p className="text-[10px] text-slate-400 font-medium hidden sm:block truncate">{subtext}</p>}
      </div>
    </div>
  );
}
