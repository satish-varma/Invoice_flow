'use client';
import { NewRelicChallan, NewRelicLocation } from '@/types/challan';

import React, { useEffect, useRef, useState, useMemo } from 'react';
import { Loader2, FileText, MapPin, Filter, FileSpreadsheet, RefreshCcw, Search, X } from 'lucide-react';
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
import { MobileFloatingActions } from '@/components/newrelic/mobile-floating-actions';

export default function NewRelicPage() {
  const { toast } = useToast();
  const [challans, setChallans] = useState<NewRelicChallan[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedChallan, setSelectedChallan] = useState<NewRelicChallan | null>(null);
  const [challanToDownload, setChallanToDownload] = useState<NewRelicChallan | null>(null);
  const [isCreatingNew, setIsCreatingNew] = useState<NewRelicLocation | null>(null);
  const [formKey, setFormKey] = useState<string>('new');
  const [activeTab, setActiveTab] = useState<'active' | 'trash' | 'insights' | 'items'>('active');
  const { role, user } = useAuth();
  
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
  const previewRef = useRef<HTMLDivElement>(null);

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
      setFilterLocation('preferred');
    }
  }, [user]);

  /* ── Handlers ── */
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

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-3 sm:px-8 py-3 sm:py-8 space-y-4 sm:space-y-8">

        {/* Mobile Pull-to-Refresh Indicator & Action Bar */}
        <div className="sm:hidden flex items-center justify-between bg-white/80 backdrop-blur-xs px-3.5 py-2 rounded-xl border border-gray-200/80 shadow-2xs">
          <span className="text-xs font-bold text-gray-700">Delivery Challans</span>
          <button
            type="button"
            onClick={handlePullRefresh}
            disabled={isRefreshing}
            className="flex items-center gap-1.5 text-[11px] font-semibold text-[#3b2fc9] hover:text-[#2c229e] active:scale-95 transition-transform"
          >
            <RefreshCcw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            {isRefreshing ? 'Syncing...' : 'Sync Data'}
          </button>
        </div>

        {/* Hero stats & Dashboard */}
        {role === 'admin' || role === 'superadmin' ? (
          <NewRelicDashboard challans={displayChallans} showFinancials={isUnlocked && showFinancials} />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
            <StatCard
              icon={<FileText className="h-5 w-5 text-[#3b2fc9]" />}
              label="Total Challans"
              value={challans.length}
              bg="bg-[#3b2fc9]/5"
            />
            <StatCard
              icon={<MapPin className="h-5 w-5 text-blue-500" />}
              label="Hyderabad"
              value={hydCount}
              bg="bg-blue-50"
            />
            <StatCard
              icon={<MapPin className="h-5 w-5 text-emerald-500" />}
              label="Bangalore"
              value={blrCount}
              bg="bg-emerald-50"
            />
          </div>
        )}

        {/* Desktop Action Buttons (hidden on mobile, replaced by floating action button) */}
        {!selectedChallan && !isCreatingNew && (
          <>
            <div className="hidden sm:flex flex-row gap-3">
              <button
                onClick={() => setIsCreatingNew('hyderabad')}
                className="flex-1 bg-[#3b2fc9] text-white py-3 px-4 rounded-xl font-medium hover:bg-[#3b2fc9]/90 transition-colors shadow-sm flex items-center justify-center gap-2"
              >
                <FileText className="h-5 w-5" />
                New Challan (Hyderabad)
              </button>
              <button
                onClick={() => setIsCreatingNew('bangalore')}
                className="flex-1 bg-emerald-600 text-white py-3 px-4 rounded-xl font-medium hover:bg-emerald-700 transition-colors shadow-sm flex items-center justify-center gap-2"
              >
                <FileText className="h-5 w-5" />
                New Challan (Bangalore)
              </button>
              <Link
                href="/newrelic/reconcile"
                className="flex-1 bg-amber-500 text-white py-3 px-4 rounded-xl font-medium hover:bg-amber-600 transition-colors shadow-sm flex items-center justify-center gap-2"
              >
                <RefreshCcw className="h-5 w-5" />
                Reconcile
              </Link>
              <button
                onClick={handleExportExcel}
                className="flex-1 bg-blue-600 text-white py-3 px-4 rounded-xl font-medium hover:bg-blue-700 transition-colors shadow-sm flex items-center justify-center gap-2"
              >
                <FileSpreadsheet className="h-5 w-5" />
                Export Excel
              </button>
            </div>

            {/* Native Mobile Floating Action Button (+) */}
            <MobileFloatingActions
              onNewChallan={(loc) => setIsCreatingNew(loc)}
              onExportExcel={handleExportExcel}
            />
          </>
        )}

        {/* Form Container */}
        {(selectedChallan || isCreatingNew) && (
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
        )}

        {/* Tabs */}
        <div className="flex items-center gap-4 border-b border-gray-200">
          <button
            onClick={() => setActiveTab('active')}
            className={`pb-3 text-sm font-medium transition-colors border-b-2 ${
              activeTab === 'active'
                ? 'border-[#3b2fc9] text-[#3b2fc9]'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Active Invoices ({activeChallans.length})
          </button>

          {role === 'admin' && (
            <>
              <Link
                href="/newrelic/analytics"
                className="pb-3 text-sm font-medium transition-colors border-b-2 border-transparent text-gray-500 hover:text-gray-700"
              >
                Analytics Dashboard
              </Link>

              <button
                onClick={() => setActiveTab('items')}
                className={`pb-3 text-sm font-medium transition-colors border-b-2 ${
                  activeTab === 'items'
                    ? 'border-[#3b2fc9] text-[#3b2fc9]'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                Item Ledger
              </button>
            </>
          )}
          
          {role === 'admin' && (
            <button
              onClick={() => setActiveTab('trash')}
              className={`pb-3 text-sm font-medium transition-colors border-b-2 ${
                activeTab === 'trash'
                  ? 'border-[#3b2fc9] text-[#3b2fc9]'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Trash / Audit ({trashChallans.length})
            </button>
          )}
        </div>

        {/* Instant Search Bar & Filter Controls */}
        <div className="space-y-2.5">
          {/* Instant Search Input */}
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search challans by DC#, brand, or item name..."
              className="w-full h-11 sm:h-10 pl-10 pr-9 bg-white border border-gray-200/90 rounded-2xl text-xs sm:text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#3b2fc9]/20 focus:border-[#3b2fc9] shadow-2xs transition-all"
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

          {/* Filters: Native Horizontal Scrollable Pill Chips on Mobile, Standard Flex on Desktop */}
          <div className="bg-white p-3 sm:p-4 rounded-2xl border border-gray-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center gap-2.5 sm:gap-4">
            <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0 scrollbar-none no-scrollbar flex-1">
              <div className="flex items-center gap-1.5 text-gray-500 text-xs font-bold shrink-0 mr-1">
                <Filter className="h-3.5 w-3.5 text-[#3b2fc9]" />
                <span>Filter:</span>
              </div>
            
            {/* Location Pill */}
            <div className="relative shrink-0">
              <select
                value={filterLocation}
                onChange={(e) => setFilterLocation(e.target.value)}
                className="h-8 pl-3 pr-7 border border-gray-200 rounded-full text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-[#3b2fc9] bg-gray-50/70 hover:bg-gray-100/70 capitalize appearance-none cursor-pointer"
              >
                {user?.preferredLocations && user.preferredLocations.length > 0 && (
                  <option value="preferred">📍 Preferred</option>
                )}
                <option value="all">📍 All Locations</option>
                {Object.entries(NEWRELIC_LOCATIONS).map(([key, loc]) => (
                  <option key={key} value={key}>📍 {loc.label}</option>
                ))}
              </select>
              <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[9px] text-gray-400">▼</span>
            </div>

            {/* Month Pill */}
            <div className="relative shrink-0">
              <select
                value={filterMonth}
                onChange={(e) => setFilterMonth(e.target.value)}
                className="h-8 pl-3 pr-7 border border-gray-200 rounded-full text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-[#3b2fc9] bg-gray-50/70 hover:bg-gray-100/70 appearance-none cursor-pointer"
              >
                <option value="all">📅 All Months</option>
                {Array.from({ length: 12 }, (_, i) => {
                  const date = new Date(2000, i, 1);
                  return <option key={i} value={i}>{date.toLocaleString('default', { month: 'short' })}</option>;
                })}
              </select>
              <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[9px] text-gray-400">▼</span>
            </div>

            {/* Year Pill */}
            <div className="relative shrink-0">
              <select
                value={filterYear}
                onChange={(e) => setFilterYear(e.target.value)}
                className="h-8 pl-3 pr-7 border border-gray-200 rounded-full text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-[#3b2fc9] bg-gray-50/70 hover:bg-gray-100/70 appearance-none cursor-pointer"
              >
                <option value="all">🗓️ All Years</option>
                {availableYears.map(year => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
              <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[9px] text-gray-400">▼</span>
            </div>

            {/* Cycle Pill */}
            <div className="relative shrink-0">
              <select
                value={filterCycle}
                onChange={(e) => setFilterCycle(e.target.value)}
                className="h-8 pl-3 pr-7 border border-gray-200 rounded-full text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-[#3b2fc9] bg-gray-50/70 hover:bg-gray-100/70 appearance-none cursor-pointer"
              >
                <option value="all">🔄 All Cycles</option>
                <option value="1-15">Cycle 1 (1–15)</option>
                <option value="16-31">Cycle 2 (16–End)</option>
              </select>
              <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[9px] text-gray-400">▼</span>
            </div>
          </div>
          
          {(role === 'admin' || role === 'superadmin') && (
            <div className="ml-auto flex items-center gap-2">
              {isUnlocked ? (
                <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-lg">
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
                  className="flex items-center gap-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold px-3 py-1.5 rounded-lg border border-gray-200 shadow-xs transition-colors"
                >
                  <Lock className="h-3.5 w-3.5 text-gray-500" />
                  Unlock Financials
                </button>
              )}
            </div>
          )}
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
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
          </div>
        ) : activeTab === 'items' ? (
          <NewRelicItemDashboard challans={displayChallans} />
        ) : activeTab === 'trash' ? (
          <div className="space-y-8">
            <NewRelicChallanList
              challans={displayChallans}
              isTrashView={true}
              role={role}
              showFinancials={isUnlocked && showFinancials}
              onSelectChallan={setSelectedChallan}
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
            onSelectChallan={setSelectedChallan}
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
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  bg: string;
}) {
  return (
    <div className={`rounded-2xl border border-gray-200 bg-white shadow-sm p-4 sm:p-5 flex items-center gap-3.5 sm:gap-4`}>
      <div className={`${bg} p-2.5 sm:p-3 rounded-xl shrink-0`}>{icon}</div>
      <div>
        <p className="text-xl sm:text-2xl font-bold text-gray-900">{value}</p>
        <p className="text-xs sm:text-sm text-gray-500">{label}</p>
      </div>
    </div>
  );
}
