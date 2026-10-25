'use client';
import { NewRelicChallan, NewRelicLocation } from '@/types/challan';

import React, { useEffect, useRef, useState, useMemo } from 'react';
import { Loader2, FileText, MapPin, Filter, FileSpreadsheet, RefreshCcw, Search, X, ArrowUp, Calculator, AlertTriangle, Plus, ChevronDown } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
import * as XLSX from 'xlsx';
import {getNewRelicChallans, deleteNewRelicChallan, revertNewRelicChallanVersion, NEWRELIC_LOCATIONS} from '@/services/newrelicChallanService';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
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
    if (user && !isAdmin && !hasPermission(user, 'newrelic_dc')) {
      router.replace(user.defaultLandingPage || '/newrelic/tuckshop');
    }
  }, [isAdmin, user, router]);

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
  const [facetFilter, setFacetFilter] = useState<'all' | 'pending_signed' | 'has_signed' | 'low_margin' | 'high_margin' | 'missing_cost'>('all');

  const [historyChallan, setHistoryChallan] = useState<NewRelicChallan | null>(null);
  const [previewChallan, setPreviewChallan] = useState<NewRelicChallan | null>(null);
  const [adminPreviewChallan, setAdminPreviewChallan] = useState<NewRelicChallan | null>(null);
  const { isUnlocked, remainingMinutes, lockFinancials, showFinancials, setShowFinancials } = useFinancialAuth();
  const [showFinancialModal, setShowFinancialModal] = useState(false);
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
    setSelectedChallan(null);
    setIsCreatingNew(null);
    if (saved) {
      setChallans((prev) => {
        const idx = prev.findIndex(
          (c) => (saved.id && c.id === saved.id) || (saved.dcNumber && c.dcNumber === saved.dcNumber)
        );
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = { ...next[idx], ...saved };
          return next;
        }
        return [saved, ...prev];
      });
      handleDownload(saved);
    }
    fetchData();
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
  
  const facetCounts = useMemo(() => {
    if (!isAdmin) {
      return { all: 0, pendingSigned: 0, hasSigned: 0, lowMargin: 0, highMargin: 0, missingCost: 0 };
    }

    let pendingSigned = 0;
    let hasSigned = 0;
    let lowMargin = 0;
    let highMargin = 0;
    let missingCost = 0;

    for (const c of activeChallans) {
      if (c.signedCopyUrls && c.signedCopyUrls.length > 0) {
        hasSigned++;
      } else {
        pendingSigned++;
      }

      // Check if any line item has missing or <=0 procurement cost
      const hasMissingItemCost = (c.lineItems || []).some((item) => {
        const cost = item.procurementCost as unknown;
        return cost === undefined || cost === null || cost === '' || isNaN(Number(cost)) || Number(cost) <= 0;
      });
      if (hasMissingItemCost) {
        missingCost++;
      }

      const mrp = (c.lineItems || []).reduce((sum, item) => sum + ((Number(item.mrp) || 0) * (Number(item.quantity) || 1)), 0);
      let pCost = 0;
      if (c.procurementCost !== undefined && c.procurementCost !== null) {
        pCost = Number(c.procurementCost);
      } else {
        pCost = (c.lineItems || []).reduce((sum, item: any) => sum + ((Number(item.procurementCost) || 0) * (Number(item.quantity) || 1)), 0);
      }
      const marginPct = mrp > 0 ? ((mrp - pCost) / mrp) * 100 : 0;
      if (marginPct < 10) lowMargin++;
      if (marginPct >= 20) highMargin++;
    }

    return {
      all: activeChallans.length,
      pendingSigned,
      hasSigned,
      lowMargin,
      highMargin,
      missingCost,
    };
  }, [activeChallans, isAdmin]);
  
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

    // Modern Data Grid Facet Filtering (Admin Only)
    if (isAdmin && facetFilter !== 'all') {
      if (facetFilter === 'pending_signed') {
        list = list.filter((c) => !(c.signedCopyUrls && c.signedCopyUrls.length > 0));
      } else if (facetFilter === 'has_signed') {
        list = list.filter((c) => c.signedCopyUrls && c.signedCopyUrls.length > 0);
      } else if (facetFilter === 'missing_cost') {
        list = list.filter((c) => {
          return (c.lineItems || []).some((item) => {
            const cost = item.procurementCost as unknown;
            return cost === undefined || cost === null || cost === '' || isNaN(Number(cost)) || Number(cost) <= 0;
          });
        });
      } else if (facetFilter === 'low_margin') {
        list = list.filter((c) => {
          const mrp = (c.lineItems || []).reduce((sum, item) => sum + ((Number(item.mrp) || 0) * (Number(item.quantity) || 1)), 0);
          let pCost = 0;
          if (c.procurementCost !== undefined && c.procurementCost !== null) {
            pCost = Number(c.procurementCost);
          } else {
            pCost = (c.lineItems || []).reduce((sum, item: any) => sum + ((Number(item.procurementCost) || 0) * (Number(item.quantity) || 1)), 0);
          }
          const marginPct = mrp > 0 ? ((mrp - pCost) / mrp) * 100 : 0;
          return marginPct < 10;
        });
      } else if (facetFilter === 'high_margin') {
        list = list.filter((c) => {
          const mrp = (c.lineItems || []).reduce((sum, item) => sum + ((Number(item.mrp) || 0) * (Number(item.quantity) || 1)), 0);
          let pCost = 0;
          if (c.procurementCost !== undefined && c.procurementCost !== null) {
            pCost = Number(c.procurementCost);
          } else {
            pCost = (c.lineItems || []).reduce((sum, item: any) => sum + ((Number(item.procurementCost) || 0) * (Number(item.quantity) || 1)), 0);
          }
          const marginPct = mrp > 0 ? ((mrp - pCost) / mrp) * 100 : 0;
          return marginPct >= 20;
        });
      }
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
  }, [activeTab, activeChallans, trashChallans, filterLocation, filterMonth, filterYear, filterCycle, searchQuery, facetFilter, isAdmin]);

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
      className="min-h-screen bg-transparent w-full max-w-full"
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
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-8 py-4 sm:py-8 space-y-4 sm:space-y-8 min-w-0">

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

        {/* Unified Top Navigation & Controls */}
        {!selectedChallan && !isCreatingNew && (
          <div className="space-y-3">
            {/* ═══ TIER 1: Unified Navigation & Action Suite ═══ */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              {/* Left: View Navigation Tabs */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-none no-scrollbar">
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic('light');
                    setActiveTab('active');
                  }}
                  className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2 shrink-0 ${
                    activeTab === 'active'
                      ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm'
                      : 'bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:text-slate-900 hover:border-slate-300'
                  }`}
                >
                  <span>Active Challans</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-black ${
                    activeTab === 'active' ? 'bg-white/20 text-white dark:bg-slate-200 dark:text-slate-900' : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200'
                  }`}>
                    {activeChallans.length}
                  </span>
                </button>

                {isAdmin && (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        triggerHaptic('light');
                        setActiveTab('items');
                      }}
                      className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-1.5 shrink-0 ${
                        activeTab === 'items'
                          ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm'
                          : 'bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:text-slate-900 hover:border-slate-300'
                      }`}
                    >
                      <span>📋 Item Ledger</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        triggerHaptic('light');
                        setActiveTab('trash');
                      }}
                      className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2 shrink-0 ${
                        activeTab === 'trash'
                          ? 'bg-rose-600 text-white shadow-sm'
                          : 'bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:text-slate-900 hover:border-slate-300'
                      }`}
                    >
                      <span>Trash</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-black ${
                        activeTab === 'trash' ? 'bg-white/20 text-white' : 'bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400'
                      }`}>
                        {trashChallans.length}
                      </span>
                    </button>

                    <Link
                      href="/newrelic/analytics"
                      className="px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-1.5 shrink-0 bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:text-indigo-600 hover:border-indigo-200 hover:bg-indigo-50/40"
                    >
                      <span>📊 Analytics</span>
                    </Link>
                  </>
                )}
              </div>

              {/* Right: Consolidated Action Suite */}
              <div className="flex items-center gap-2 overflow-x-auto pb-0.5 scrollbar-none no-scrollbar sm:ml-auto">
                {/* Financial Unlock Status (Admin) */}
                {isAdmin && (
                  isUnlocked ? (
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-800 dark:text-emerald-300 font-bold shrink-0">
                      <label className="cursor-pointer flex items-center gap-1.5">
                        <input
                          type="checkbox"
                          checked={showFinancials}
                          onChange={(e) => setShowFinancials(e.target.checked)}
                          className="rounded text-emerald-600 focus:ring-emerald-500 h-3.5 w-3.5"
                        />
                        <Unlock className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                        <span className="hidden md:inline">Visible ({remainingMinutes}m)</span>
                      </label>
                      <button
                        onClick={() => {
                          lockFinancials();
                          setShowFinancials(false);
                        }}
                        className="text-[11px] text-red-600 hover:text-red-800 underline font-semibold ml-0.5"
                        title="Lock now"
                      >
                        Lock
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setShowFinancialModal(true)}
                      className="inline-flex items-center gap-1.5 px-2.5 py-2 rounded-xl bg-white dark:bg-slate-800 hover:bg-slate-100 text-slate-700 dark:text-slate-300 text-xs font-bold border border-slate-200/80 dark:border-slate-700 shadow-2xs transition-colors shrink-0"
                      title="Unlock Financials (Costs & Margins)"
                    >
                      <Lock className="w-3.5 h-3.5 text-slate-500" />
                      <span className="hidden md:inline">Unlock Financials</span>
                    </button>
                  )
                )}

                {/* MRP % Calculator Trigger (Admin Only) */}
                {isAdmin && (
                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic('light');
                      setShowCalculator(true);
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white dark:bg-slate-800 hover:bg-purple-50 dark:hover:bg-purple-950/30 text-[#3b2fc9] dark:text-purple-400 text-xs font-bold border border-purple-200/80 dark:border-purple-900/60 shadow-2xs active:scale-95 transition-all shrink-0"
                    title="Calculate MRP percentage and purchase cost"
                  >
                    <Calculator className="w-3.5 h-3.5" />
                    <span className="hidden md:inline">% Calc</span>
                  </button>
                )}

                {/* Reconcile (Admin Only) */}
                {isAdmin && (
                  <Link
                    href="/newrelic/reconcile"
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white dark:bg-slate-800 hover:bg-amber-50 dark:hover:bg-amber-950/30 text-amber-700 dark:text-amber-400 text-xs font-bold border border-amber-200/80 dark:border-amber-900/60 shadow-2xs active:scale-95 transition-all shrink-0"
                    title="Reconcile Delivery Challans"
                  >
                    <RefreshCcw className="w-3.5 h-3.5" />
                    <span className="hidden md:inline">Reconcile</span>
                  </Link>
                )}

                {/* Export Excel (Admin Only) */}
                {isAdmin && (
                  <button
                    type="button"
                    onClick={handleExportExcel}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-blue-950/30 text-blue-700 dark:text-blue-400 text-xs font-bold border border-blue-200/80 dark:border-blue-900/60 shadow-2xs active:scale-95 transition-all shrink-0"
                    title="Export to Excel Spreadsheet"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5" />
                    <span className="hidden md:inline">Export</span>
                  </button>
                )}

                {/* + New Challan Split Dropdown */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-[#3b2fc9] hover:from-indigo-700 hover:to-indigo-800 text-white text-xs sm:text-sm font-bold shadow-sm shadow-indigo-200/60 active:scale-95 transition-all shrink-0"
                    >
                      <Plus className="w-4 h-4 stroke-[2.5]" />
                      <span>New Challan</span>
                      <ChevronDown className="w-3.5 h-3.5 opacity-80 -mr-0.5" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56 p-1.5 rounded-2xl shadow-xl border-slate-200 dark:border-slate-800">
                    <DropdownMenuItem
                      onClick={() => handleStartCreateNew('hyderabad')}
                      className="flex items-center gap-2.5 p-2.5 rounded-xl cursor-pointer hover:bg-indigo-50 dark:hover:bg-indigo-950/40 text-slate-800 dark:text-slate-100"
                    >
                      <div className="w-2.5 h-2.5 rounded-full bg-sky-500 shrink-0 shadow-xs" />
                      <div className="flex flex-col">
                        <span className="font-bold text-xs sm:text-sm">Hyderabad Hub</span>
                        <span className="text-[10px] text-slate-400">Mindspace · Hitec City</span>
                      </div>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => handleStartCreateNew('bangalore')}
                      className="flex items-center gap-2.5 p-2.5 rounded-xl cursor-pointer hover:bg-emerald-50 dark:hover:bg-emerald-950/40 text-slate-800 dark:text-slate-100"
                    >
                      <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0 shadow-xs" />
                      <div className="flex flex-col">
                        <span className="font-bold text-xs sm:text-sm">Bangalore Hub</span>
                        <span className="text-[10px] text-slate-400">Bagmane Tech Park</span>
                      </div>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            {/* Missing P.Cost Alert Notification Banner (Admin Only) */}
            {isAdmin && facetCounts.missingCost > 0 && facetFilter !== 'missing_cost' && (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 p-2.5 sm:px-4 rounded-2xl bg-amber-50/90 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200 text-xs sm:text-sm animate-in fade-in shadow-2xs">
                <div className="flex items-center gap-2.5">
                  <div className="p-1 rounded-lg bg-amber-200/80 dark:bg-amber-900/80 text-amber-800 dark:text-amber-200 shrink-0">
                    <AlertTriangle className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="font-bold">Missing Procurement Cost: </span>
                    <span>{facetCounts.missingCost} delivery {facetCounts.missingCost === 1 ? 'challan has' : 'challans have'} items with missed P.Cost.</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic('light');
                    setFacetFilter('missing_cost');
                  }}
                  className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 active:scale-95 text-white text-xs font-bold shrink-0 transition-all shadow-xs flex items-center justify-center gap-1.5"
                >
                  <span>Filter Missing ({facetCounts.missingCost})</span>
                </button>
              </div>
            )}

            {/* ═══ TIER 2: Unified Control Center Card ═══ */}
            <div className="bg-white dark:bg-slate-900 p-3 sm:p-4 rounded-2xl sm:rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] space-y-3">
              {/* Row 1: Hub Switcher + Search Input + Date Selectors */}
              <div className="flex flex-col md:flex-row items-stretch md:items-center gap-2.5">
                {/* Segmented Location Hub Switcher */}
                <div className="flex items-center p-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl gap-1 border border-slate-200/70 dark:border-slate-700 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic('light');
                      setFilterLocation('all');
                    }}
                    className={`flex-1 sm:flex-initial px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
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
                        className={`flex-1 sm:flex-initial px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                          isSelected ? activeColor : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 hover:bg-white/60'
                        }`}
                      >
                        {loc.label} <span className="text-[10px] opacity-80 ml-0.5">({count})</span>
                      </button>
                    );
                  })}
                </div>

                {/* Instant Search Bar */}
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-indigo-500 pointer-events-none" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search challans by DC#, brand, or item name..."
                    className="w-full h-9 pl-9 pr-8 bg-slate-50 dark:bg-slate-800/60 border border-slate-200/90 dark:border-slate-700/80 rounded-xl text-xs sm:text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-slate-200/50"
                      aria-label="Clear search"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Date Filters (Month & Year) & Reset */}
                <div className="flex items-center gap-1.5 shrink-0 self-end md:self-auto">
                  {/* Month */}
                  <div className="relative">
                    <select
                      value={filterMonth}
                      onChange={(e) => {
                        triggerHaptic('light');
                        setFilterMonth(e.target.value);
                      }}
                      className={`h-9 pl-2.5 pr-6 rounded-xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-[#3b2fc9]/30 appearance-none cursor-pointer border transition-all ${
                        filterMonth !== 'all'
                          ? 'bg-[#3b2fc9]/10 text-[#3b2fc9] border-[#3b2fc9]/30'
                          : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      <option value="all">📅 Month</option>
                      {Array.from({ length: 12 }, (_, i) => {
                        const date = new Date(2000, i, 1);
                        return <option key={i} value={i}>{date.toLocaleString('default', { month: 'short' })}</option>;
                      })}
                    </select>
                    <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[9px] text-slate-400">▼</span>
                  </div>

                  {/* Year */}
                  <div className="relative">
                    <select
                      value={filterYear}
                      onChange={(e) => {
                        triggerHaptic('light');
                        setFilterYear(e.target.value);
                      }}
                      className={`h-9 pl-2.5 pr-6 rounded-xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-[#3b2fc9]/30 appearance-none cursor-pointer border transition-all ${
                        filterYear !== 'all'
                          ? 'bg-[#3b2fc9]/10 text-[#3b2fc9] border-[#3b2fc9]/30'
                          : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      <option value="all">🗓️ Year</option>
                      {availableYears.map(year => (
                        <option key={year} value={year}>{year}</option>
                      ))}
                    </select>
                    <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[9px] text-slate-400">▼</span>
                  </div>

                  {/* Reset button if active */}
                  {(filterLocation !== (user?.preferredLocations?.[0] || 'all') || filterMonth !== 'all' || filterYear !== 'all' || filterCycle !== 'all' || searchQuery.trim() !== '' || facetFilter !== 'all') && (
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
                        setFacetFilter('all');
                      }}
                      className="h-9 px-2.5 rounded-xl text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 transition-colors flex items-center gap-1 active:scale-95"
                      title="Reset all filters"
                    >
                      <X className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Reset</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Row 2: Admin Facet Pills & Cycle Presets + Cycle Total (Admin Only) */}
              {isAdmin && (
                <div className="pt-2.5 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2.5">
                  {/* Left: Facet Filter Pills */}
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-none no-scrollbar">
                    <button
                      type="button"
                      onClick={() => {
                        triggerHaptic('light');
                        setFacetFilter('all');
                      }}
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 ${
                        facetFilter === 'all'
                          ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-xs'
                          : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 border border-slate-200/80 dark:border-slate-700'
                      }`}
                    >
                      <span>All Records</span>
                      <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-200/60 dark:bg-slate-700 font-mono">
                        {facetCounts.all}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        triggerHaptic('light');
                        setFacetFilter(facetFilter === 'pending_signed' ? 'all' : 'pending_signed');
                      }}
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 ${
                        facetFilter === 'pending_signed'
                          ? 'bg-amber-500 text-white shadow-xs'
                          : 'bg-slate-50 dark:bg-slate-800 text-amber-700 dark:text-amber-400 hover:bg-amber-50 border border-amber-200 dark:border-amber-900/50'
                      }`}
                    >
                      <span>Pending Signed</span>
                      <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-amber-100 dark:bg-amber-950/80 font-mono">
                        {facetCounts.pendingSigned}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        triggerHaptic('light');
                        setFacetFilter(facetFilter === 'has_signed' ? 'all' : 'has_signed');
                      }}
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 ${
                        facetFilter === 'has_signed'
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'bg-slate-50 dark:bg-slate-800 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 border border-emerald-200 dark:border-emerald-900/50'
                      }`}
                    >
                      <span>Signed Verified</span>
                      <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-emerald-100 dark:bg-emerald-950/80 font-mono">
                        {facetCounts.hasSigned}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        triggerHaptic('light');
                        setFacetFilter(facetFilter === 'missing_cost' ? 'all' : 'missing_cost');
                      }}
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 ${
                        facetFilter === 'missing_cost'
                          ? 'bg-amber-600 text-white shadow-xs'
                          : 'bg-slate-50 dark:bg-slate-800 text-amber-800 dark:text-amber-300 hover:bg-amber-50 border border-amber-300 dark:border-amber-900/60'
                      }`}
                      title="Filter delivery challans that have at least one line item missing procurement cost"
                    >
                      <span>⚠️ Missing P.Cost</span>
                      <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                        facetCounts.missingCost > 0
                          ? 'bg-amber-200 text-amber-950 dark:bg-amber-900 dark:text-amber-200 font-black'
                          : 'bg-amber-100 dark:bg-amber-950 font-normal'
                      }`}>
                        {facetCounts.missingCost}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        triggerHaptic('light');
                        setFacetFilter(facetFilter === 'low_margin' ? 'all' : 'low_margin');
                      }}
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 ${
                        facetFilter === 'low_margin'
                          ? 'bg-rose-600 text-white shadow-xs'
                          : 'bg-slate-50 dark:bg-slate-800 text-rose-700 dark:text-rose-400 hover:bg-rose-50 border border-rose-200 dark:border-rose-900/50'
                      }`}
                      title="Filter challans with profit margin under 10%"
                    >
                      <span>⚠️ Low Margin</span>
                      <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-rose-100 dark:bg-rose-950/80 font-mono">
                        {facetCounts.lowMargin}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        triggerHaptic('light');
                        setFacetFilter(facetFilter === 'high_margin' ? 'all' : 'high_margin');
                      }}
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 ${
                        facetFilter === 'high_margin'
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'bg-slate-50 dark:bg-slate-800 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 border border-emerald-200 dark:border-emerald-900/50'
                      }`}
                      title="Filter challans with healthy profit margin 20% or higher"
                    >
                      <span>Healthy Margin</span>
                      <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-emerald-100 dark:bg-emerald-950/80 font-mono">
                        {facetCounts.highMargin}
                      </span>
                    </button>
                  </div>

                  {/* Right: Cycle Presets & Cycle Total Value */}
                  <div className="flex items-center gap-1.5 ml-auto overflow-x-auto pb-0.5 scrollbar-none no-scrollbar">
                    <div className="flex items-center p-0.5 bg-slate-100 dark:bg-slate-800 rounded-lg border border-slate-200/70 dark:border-slate-700 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          triggerHaptic('light');
                          setFilterCycle('all');
                        }}
                        className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all ${
                          filterCycle === 'all'
                            ? 'bg-white dark:bg-slate-700 text-[#3b2fc9] dark:text-indigo-300 shadow-2xs font-black'
                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                        }`}
                      >
                        All
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          triggerHaptic('light');
                          setFilterCycle('1-15');
                        }}
                        className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all ${
                          filterCycle === '1-15'
                            ? 'bg-white dark:bg-slate-700 text-[#3b2fc9] dark:text-indigo-300 shadow-2xs font-black'
                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
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
                        className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all ${
                          filterCycle === '16-31'
                            ? 'bg-white dark:bg-slate-700 text-[#3b2fc9] dark:text-indigo-300 shadow-2xs font-black'
                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                        }`}
                      >
                        Cycle 2 (16–End)
                      </button>
                    </div>

                    {/* Cycle Total Value */}
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200/80 dark:border-indigo-800 text-xs shrink-0">
                      <span className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400">Total:</span>
                      <span className="font-black text-[#3b2fc9] dark:text-indigo-400 font-mono text-xs">
                        ₹{cycleTotalValue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Showing search results message */}
            {searchQuery && (
              <div className="flex items-center justify-between text-xs px-2 text-gray-500">
                <span>Showing {displayChallans.length} challan{displayChallans.length !== 1 ? 's' : ''} for &ldquo;<strong className="text-gray-800">{searchQuery}</strong>&rdquo;</span>
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="text-[#3b2fc9] hover:underline font-semibold"
                >
                  Clear Search
                </button>
              </div>
            )}
          </div>
        )}

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
            onChallanUpdated={(updated) => {
              setChallans((prev) => {
                const idx = prev.findIndex(c => c.id === updated.id);
                if (idx >= 0) {
                  const next = [...prev];
                  next[idx] = updated;
                  return next;
                }
                return prev;
              });
            }}
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
