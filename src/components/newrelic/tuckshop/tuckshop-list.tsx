'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Trash2,
  Filter,
  FileText,
  Search,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  IndianRupee,
  Pencil,
  FileSpreadsheet,
  X,
  AlertTriangle,
  Loader2,
  BarChart3,
  Calendar,
  RotateCcw,
  Sparkles,
  Check,
  Eye,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { NewRelicTuckshopRecord, deleteTuckshopRecord } from '@/services/newrelicTuckshopService';
import { TuckshopDashboard, getCategoryBadge } from './tuckshop-dashboard';
import { TuckshopBillModal } from './TuckshopBillModal';
import { TuckshopTrendChart } from './TuckshopTrendChart';
import { useAuth } from '@/contexts/AuthContext';
import { SiteId, resolveSiteId, SITE_OPTIONS, COMPANY_SITES, CompanySite, DEFAULT_COMPANY_SITES } from '@/types/site';
import { subscribeCompanySites } from '@/services/siteService';
import { triggerHaptic } from '@/lib/haptics';
import { cn } from '@/lib/utils';
import { RollingCashCounter } from '@/components/effects/RollingCashCounter';
import { TiltCard } from '@/components/effects/TiltCard';
import { Input } from '@/components/ui/input';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { logAuditEvent } from '@/services/auditService';

interface Props {
  records: NewRelicTuckshopRecord[];
  showDashboard?: boolean;
  onEdit?: (record: NewRelicTuckshopRecord) => void;
}

export function TuckshopList({ records, showDashboard, onEdit }: Props) {
  const { role, user, canDelete } = useAuth();
  const isOwnerOrAdmin = role === 'admin' || role === 'superadmin';
  const [filterType, setFilterType] = useState<'all' | 'expense' | 'sale'>('all');
  const [filterSite, setFilterSite] = useState<string>('all');
  const [filterMonth, setFilterMonth] = useState<string>('all');
  const [filterYear, setFilterYear] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 20;

  // Modern Filter Enhancements
  type DatePreset = 'all' | 'today' | 'yesterday' | 'week' | 'month' | 'last_month' | 'custom';
  const [datePreset, setDatePreset] = useState<DatePreset>('all');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [filterCategory, setFilterCategory] = useState<string | null>(null);
  const [viewingBillRecord, setViewingBillRecord] = useState<NewRelicTuckshopRecord | null>(null);
  const [showTrendChart, setShowTrendChart] = useState(false);
  const [sites, setSites] = useState<CompanySite[]>(() => Object.values(DEFAULT_COMPANY_SITES));

  useEffect(() => {
    const unsub = subscribeCompanySites((updated) => {
      setSites(updated);
    });
    return () => unsub();
  }, []);


  // Map full names to codes since they are stored as 'bangalore' / 'hyderabad' in users collection
  const getMappedLocation = (locStr?: string) => {
    if (!locStr) return undefined;
    if (locStr.toLowerCase() === 'bangalore' || locStr === 'BLR') return 'BLR';
    if (locStr.toLowerCase() === 'hyderabad' || locStr === 'HYD') return 'HYD';
    return undefined;
  };
  
  const isMultiLocation = (user?.preferredLocations?.length || 0) > 1;
  const defaultLoc = isMultiLocation ? 'all' : (getMappedLocation(user?.preferredLocations?.[0]) || 'all');
  const [filterLocation, setFilterLocation] = useState<'all' | 'HYD' | 'BLR'>(defaultLoc);

  // Reset to page 1 when filters change
  React.useEffect(() => {
    setCurrentPage(1);
  }, [filterType, filterLocation, filterSite, filterMonth, filterYear, searchQuery, datePreset, customStartDate, customEndDate, filterCategory]);

  // Also update if user object loads later (one-time on mount)
  const hasInitializedTuckshopFilter = React.useRef(false);
  React.useEffect(() => {
    if (hasInitializedTuckshopFilter.current) return;
    if (!user) return;
    hasInitializedTuckshopFilter.current = true;
    if (!isMultiLocation) {
      const mappedLoc = getMappedLocation(user?.preferredLocations?.[0]);
      if (mappedLoc) {
        setFilterLocation(mappedLoc);
      }
    }
  }, [user, isMultiLocation]);

  const [recordToDelete, setRecordToDelete] = useState<NewRelicTuckshopRecord | null>(null);
  const [deleteConfirmationInput, setDeleteConfirmationInput] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  const promptDeleteRecord = (record: NewRelicTuckshopRecord) => {
    if (role === 'guest' || (!isOwnerOrAdmin && !canDelete)) {
      alert('Delete Clearance Required: You do not have permission to delete tuckshop records.');
      return;
    }
    triggerHaptic('medium');
    setRecordToDelete(record);
    setDeleteConfirmationInput('');
  };

  const confirmDeleteRecord = async () => {
    if (!recordToDelete?.id) return;
    setIsDeleting(true);
    try {
      logAuditEvent({
        actorEmail: user?.email || 'user',
        actorRole: role || 'user',
        action: 'tuckshop_deleted',
        actionLabel: 'Deleted Tuckshop Record',
        targetType: 'tuckshop',
        targetId: recordToDelete.id,
        targetLabel: `${recordToDelete.category} - ₹${recordToDelete.amount}`,
        details: {
          date: recordToDelete.date,
          category: recordToDelete.category,
          type: recordToDelete.type,
          amount: recordToDelete.amount,
          siteId: recordToDelete.siteId,
          description: recordToDelete.description,
        },
      });
      await deleteTuckshopRecord(recordToDelete.id);
    } catch (err: any) {
      alert(`Failed to delete record: ${err.message || 'Unknown error'}`);
    } finally {
      setIsDeleting(false);
      setRecordToDelete(null);
      setDeleteConfirmationInput('');
    }
  };

  const canEditRecord = (record: NewRelicTuckshopRecord) => {
    if (role === 'guest') return false;
    if (isOwnerOrAdmin) return true;
    if (!user) return false;
    // User or Manager who created this record can edit it
    const userEmailLower = user.email?.toLowerCase().trim();
    const createdByLower = record.createdBy?.toLowerCase().trim();
    if (userEmailLower && createdByLower && userEmailLower === createdByLower) return true;
    if (user.id && record.createdBy === user.id) return true;
    return false;
  };

  const canDeleteRecord = (record: NewRelicTuckshopRecord) => {
    if (role === 'guest') return false;
    return isOwnerOrAdmin || canDelete;
  };

  const locCounts = React.useMemo(() => {
    let blr = 0;
    let hyd = 0;
    records.forEach(r => {
      const loc = (r.location || '').toUpperCase();
      if (loc === 'BLR' || loc === 'BANGALORE') blr++;
      else if (loc === 'HYD' || loc === 'HYDERABAD') hyd++;
    });
    return { blr, hyd, all: records.length };
  }, [records]);

  const availableYears = React.useMemo(() => {
    return Array.from(new Set(records.map(r => new Date(r.date).getFullYear()))).sort((a, b) => b - a);
  }, [records]);

  const isDateInPreset = (dateStr: string, preset: DatePreset) => {
    if (preset === 'all') return true;
    const recDate = (dateStr || '').split('T')[0];
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    if (preset === 'today') {
      return recDate === todayStr;
    }
    if (preset === 'yesterday') {
      const y = new Date();
      y.setDate(now.getDate() - 1);
      const yesterdayStr = `${y.getFullYear()}-${String(y.getMonth() + 1).padStart(2, '0')}-${String(y.getDate()).padStart(2, '0')}`;
      return recDate === yesterdayStr;
    }
    if (preset === 'week') {
      const d = new Date(recDate);
      const pastWeek = new Date();
      pastWeek.setDate(now.getDate() - 7);
      return d >= pastWeek && d <= now;
    }
    if (preset === 'month') {
      const d = new Date(recDate);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    }
    if (preset === 'last_month') {
      const d = new Date(recDate);
      const lastMonth = now.getMonth() === 0 ? 11 : now.getMonth() - 1;
      const year = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
      return d.getMonth() === lastMonth && d.getFullYear() === year;
    }
    if (preset === 'custom') {
      if (customStartDate && recDate < customStartDate) return false;
      if (customEndDate && recDate > customEndDate) return false;
      return true;
    }
    return true;
  };

  const presetCounts = useMemo(() => {
    let today = 0;
    let yesterday = 0;
    let week = 0;
    let month = 0;
    records.forEach((r) => {
      if (isDateInPreset(r.date, 'today')) today++;
      if (isDateInPreset(r.date, 'yesterday')) yesterday++;
      if (isDateInPreset(r.date, 'week')) week++;
      if (isDateInPreset(r.date, 'month')) month++;
    });
    return { all: records.length, today, yesterday, week, month };
  }, [records]);

  const filteredRecords = records.filter(record => {
    if (filterType !== 'all' && record.type !== filterType) return false;
    if (filterLocation !== 'all') {
      const loc = (record.location || '').toUpperCase();
      const isBlr = loc === 'BLR' || loc === 'BANGALORE';
      const isHyd = loc === 'HYD' || loc === 'HYDERABAD';
      if (filterLocation === 'BLR' && !isBlr) return false;
      if (filterLocation === 'HYD' && !isHyd) return false;
    }
    if (filterSite !== 'all') {
      const recSite = resolveSiteId(record.siteId);
      if (recSite !== filterSite) return false;
    }

    if (filterCategory) {
      const rawCat = (record.category || '').toLowerCase().replace(/_/g, ' ');
      const targetCat = filterCategory.toLowerCase().replace(/_/g, ' ');
      if (!rawCat.includes(targetCat) && !targetCat.includes(rawCat)) {
        return false;
      }
    }

    if (!isDateInPreset(record.date, datePreset)) return false;
    
    if (datePreset === 'all' && filterMonth !== 'all') {
      if (new Date(record.date).getMonth().toString() !== filterMonth) return false;
    }
    if (datePreset === 'all' && filterYear !== 'all') {
      if (new Date(record.date).getFullYear().toString() !== filterYear) return false;
    }
    
    if (searchQuery.trim() !== '') {
      const q = searchQuery.toLowerCase().trim();
      const catMatch = record.category.replace('_', ' ').toLowerCase().includes(q);
      const descMatch = (record.description || '').toLowerCase().includes(q);
      const creatorMatch = (record.createdBy || '').toLowerCase().includes(q);
      if (!catMatch && !descMatch && !creatorMatch) return false;
    }
    
    return true;
  });

  const totalPages = Math.ceil(filteredRecords.length / ITEMS_PER_PAGE);
  const paginatedRecords = filteredRecords.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (datePreset !== 'all') count++;
    if (filterCategory) count++;
    if (filterType !== 'all') count++;
    if (filterLocation !== 'all') count++;
    if (filterSite !== 'all') count++;
    if (searchQuery.trim()) count++;
    return count;
  }, [datePreset, filterCategory, filterType, filterLocation, filterSite, searchQuery]);

  const handleResetFilters = () => {
    triggerHaptic('medium');
    setDatePreset('all');
    setCustomStartDate('');
    setCustomEndDate('');
    setFilterCategory(null);
    setFilterType('all');
    setFilterLocation('all');
    setFilterSite('all');
    setFilterMonth('all');
    setFilterYear('all');
    setSearchQuery('');
  };

  const exportToExcel = () => {
    try {
      const rows = filteredRecords.map((r) => {
        const sId = resolveSiteId(r.siteId);
        const siteName = COMPANY_SITES[sId]?.name || sId;
        return {
          'Date': new Date(r.date).toLocaleDateString('en-IN'),
          'Company Site': siteName,
          'Location': r.location,
          'Type': r.type.toUpperCase(),
          'Category': r.category.replace('_', ' ').toUpperCase(),
          'Amount (₹)': r.amount,
          'Description': r.description || '',
          'Created By': r.createdBy || '',
          'Bill Attached': r.billUrl ? 'YES' : 'NO',
        };
      });

      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Tuckshop Ledger');
      const filename = `Tuckshop_Ledger_${new Date().toISOString().substring(0, 10)}.xlsx`;
      XLSX.writeFile(wb, filename);
    } catch (err) {
      console.error('Failed to export tuckshop Excel:', err);
    }
  };

  return (
    <div className="flex flex-col gap-5 sm:gap-6 h-full w-full">
      {showDashboard && (
        <TuckshopDashboard
          records={filteredRecords}
          selectedCategory={filterCategory}
          onSelectCategory={(cat) => setFilterCategory(cat)}
        />
      )}

      {/* Visual Sales & Expense Trend Chart */}
      {showTrendChart && (
        <TuckshopTrendChart records={records} />
      )}
      
      <div className="theme-card rounded-2xl sm:rounded-3xl shadow-sm overflow-hidden h-full flex flex-col bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800">
      <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex flex-col gap-3.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <h3 className="font-black text-slate-900 dark:text-white text-base sm:text-lg tracking-tight">
              Transaction Ledger
            </h3>
            <span className="text-xs font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/60 px-2.5 py-0.5 rounded-full border border-indigo-100 dark:border-indigo-900">
              {filteredRecords.length} record{filteredRecords.length !== 1 ? 's' : ''}
            </span>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Prominent Segmented Location Filter Switcher */}
            <div className="flex items-center p-1 bg-slate-100 dark:bg-slate-800 rounded-2xl gap-1 border border-slate-200/80 dark:border-slate-700 shadow-2xs">
              <button
                type="button"
                onClick={() => {
                  triggerHaptic('light');
                  setFilterLocation('all');
                }}
                className={`flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  filterLocation === 'all'
                    ? 'bg-gradient-to-r from-indigo-600 to-[#3b2fc9] text-white shadow-xs font-black'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 hover:bg-white/60 dark:hover:bg-slate-700'
                }`}
              >
                <span>All Locations</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${
                  filterLocation === 'all' ? 'bg-white/20 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                }`}>
                  {locCounts.all}
                </span>
              </button>
              <button
                type="button"
                onClick={() => {
                  triggerHaptic('light');
                  setFilterLocation('BLR');
                }}
                className={`flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  filterLocation === 'BLR'
                    ? 'bg-gradient-to-r from-teal-600 to-emerald-600 text-white shadow-xs font-black'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 hover:bg-white/60 dark:hover:bg-slate-700'
                }`}
              >
                <span>Bangalore</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${
                  filterLocation === 'BLR' ? 'bg-white/20 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                }`}>
                  {locCounts.blr}
                </span>
              </button>
              <button
                type="button"
                onClick={() => {
                  triggerHaptic('light');
                  setFilterLocation('HYD');
                }}
                className={`flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  filterLocation === 'HYD'
                    ? 'bg-gradient-to-r from-blue-600 to-cyan-600 text-white shadow-xs font-black'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 hover:bg-white/60 dark:hover:bg-slate-700'
                }`}
              >
                <span>Hyderabad</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${
                  filterLocation === 'HYD' ? 'bg-white/20 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                }`}>
                  {locCounts.hyd}
                </span>
              </button>
            </div>

            {/* Toggle 14-Day Visual Trend Chart */}
            <button
              type="button"
              onClick={() => {
                triggerHaptic('light');
                setShowTrendChart(!showTrendChart);
              }}
              className={cn(
                "h-9 px-3 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-2xs active:scale-95 shrink-0",
                showTrendChart
                  ? "bg-[#3b2fc9] text-white shadow-sm"
                  : "bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800"
              )}
              title="Toggle 14-Day Sales & Expense Trend Chart"
            >
              <BarChart3 className="h-3.5 w-3.5" />
              <span>{showTrendChart ? 'Hide Trends' : 'View Trends'}</span>
            </button>

            <button
              type="button"
              onClick={exportToExcel}
              disabled={filteredRecords.length === 0}
              className="h-9 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors shrink-0 active:scale-95"
              title="Download Excel report"
            >
              <FileSpreadsheet className="h-3.5 w-3.5" />
              <span>Export Excel</span>
            </button>
          </div>
        </div>

        {/* 1-Click Time Range Quick Selector Pills */}
        <div className="flex items-center gap-1.5 flex-wrap pt-1">
          {[
            { key: 'all', label: 'All Time', count: presetCounts.all },
            { key: 'today', label: 'Today', count: presetCounts.today },
            { key: 'yesterday', label: 'Yesterday', count: presetCounts.yesterday },
            { key: 'week', label: 'Last 7 Days', count: presetCounts.week },
            { key: 'month', label: 'This Month', count: presetCounts.month },
            { key: 'custom', label: 'Custom Date Range' },
          ].map((preset) => (
            <button
              key={preset.key}
              type="button"
              onClick={() => {
                triggerHaptic('light');
                setDatePreset(preset.key as DatePreset);
              }}
              className={cn(
                "px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer",
                datePreset === preset.key
                  ? "bg-[#3b2fc9] text-white shadow-xs font-black ring-2 ring-[#3b2fc9]/20"
                  : "bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200/70 dark:border-slate-700"
              )}
            >
              <span>{preset.label}</span>
              {typeof preset.count === 'number' && (
                <span className={cn(
                  "text-[10px] px-1.5 py-0.2 rounded-full font-black",
                  datePreset === preset.key
                    ? "bg-white/20 text-white"
                    : "bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300"
                )}>
                  {preset.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Custom Date Range Picker */}
        {datePreset === 'custom' && (
          <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 flex-wrap">
            <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-indigo-600" />
              Custom Date Window:
            </span>
            <div className="flex items-center gap-2">
              <label className="text-[11px] text-slate-500 font-medium">From:</label>
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="h-8 px-2.5 rounded-xl text-xs font-semibold border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-[11px] text-slate-500 font-medium">To:</label>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="h-8 px-2.5 rounded-xl text-xs font-semibold border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
              />
            </div>
            {(customStartDate || customEndDate) && (
              <button
                type="button"
                onClick={() => {
                  setCustomStartDate('');
                  setCustomEndDate('');
                }}
                className="text-[11px] font-bold text-indigo-600 hover:underline"
              >
                Clear Dates
              </button>
            )}
          </div>
        )}
        
        <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 sm:gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search items, notes, or descriptions..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-12 sm:h-10 pl-10 pr-9 text-sm border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#3b2fc9]/20 focus:border-[#3b2fc9] bg-white shadow-2xs font-medium placeholder:text-slate-400"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  triggerHaptic('light');
                  setSearchQuery('');
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 rounded-full"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 sm:flex sm:items-center gap-2 flex-wrap">
            {isOwnerOrAdmin && (
              <select
                value={filterSite}
                onChange={(e) => {
                  triggerHaptic('light');
                  setFilterSite(e.target.value);
                }}
                className="w-full sm:w-auto h-11 sm:h-10 px-3 text-xs sm:text-sm font-semibold border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#3b2fc9]/20 bg-white shadow-2xs text-slate-800"
              >
                <option value="all">All Stalls / Sites</option>
                {sites.map(s => (
                  <option key={s.id} value={s.id}>{s.name} Stall</option>
                ))}
              </select>
            )}

            <div className="relative w-full sm:w-auto">
              <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <select
                value={filterLocation}
                onChange={(e) => {
                  triggerHaptic('light');
                  setFilterLocation(e.target.value as any);
                }}
                className="w-full sm:w-auto h-11 sm:h-10 pl-8 pr-3 text-xs sm:text-sm font-semibold border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#3b2fc9]/20 bg-white shadow-2xs text-slate-800"
              >
                <option value="all">All Locations</option>
                <option value="BLR">Bangalore (BLR)</option>
                <option value="HYD">Hyderabad (HYD)</option>
              </select>
            </div>
            
            <select
              value={filterType}
              onChange={(e) => {
                triggerHaptic('light');
                setFilterType(e.target.value as any);
              }}
              className="w-full sm:w-auto h-11 sm:h-10 px-3 text-xs sm:text-sm font-semibold border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#3b2fc9]/20 bg-white shadow-2xs text-slate-800"
            >
              <option value="all">All Types</option>
              <option value="expense">Expenses Only</option>
              <option value="sale">Sales Only</option>
            </select>

            <select
              value={filterMonth}
              onChange={(e) => {
                triggerHaptic('light');
                setFilterMonth(e.target.value);
              }}
              className="w-full sm:w-auto h-11 sm:h-10 px-3 text-xs sm:text-sm font-semibold border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#3b2fc9]/20 bg-white shadow-2xs text-slate-800"
            >
              <option value="all">All Months</option>
              {Array.from({ length: 12 }, (_, i) => {
                const d = new Date(2000, i, 1);
                return <option key={i} value={i}>{d.toLocaleString('default', { month: 'short' })}</option>;
              })}
            </select>

            <select
              value={filterYear}
              onChange={(e) => {
                triggerHaptic('light');
                setFilterYear(e.target.value);
              }}
              className="w-full sm:w-auto h-11 sm:h-10 px-3 text-xs sm:text-sm font-semibold border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#3b2fc9]/20 bg-white shadow-2xs text-slate-800"
            >
              <option value="all">All Years</option>
              {availableYears.map(year => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Active Filter Chips Bar */}
        {activeFiltersCount > 0 && (
          <div className="flex items-center gap-2 flex-wrap pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
            <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500 flex items-center gap-1">
              <Filter className="w-3 h-3" />
              Active Filters ({activeFiltersCount}):
            </span>

            {datePreset !== 'all' && (
              <span className="px-2.5 py-1 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 font-bold flex items-center gap-1.5">
                Time: {datePreset === 'week' ? 'Last 7 Days' : datePreset === 'month' ? 'This Month' : datePreset.toUpperCase()}
                <button
                  type="button"
                  onClick={() => setDatePreset('all')}
                  className="hover:text-rose-600 transition-colors"
                >
                  ✕
                </button>
              </span>
            )}

            {filterCategory && (
              <span className="px-2.5 py-1 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800 font-bold flex items-center gap-1.5">
                Category: {filterCategory}
                <button
                  type="button"
                  onClick={() => setFilterCategory(null)}
                  className="hover:text-rose-600 transition-colors"
                >
                  ✕
                </button>
              </span>
            )}

            {filterType !== 'all' && (
              <span className="px-2.5 py-1 rounded-xl bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 font-bold flex items-center gap-1.5">
                Type: {filterType.toUpperCase()}
                <button
                  type="button"
                  onClick={() => setFilterType('all')}
                  className="hover:text-rose-600 transition-colors"
                >
                  ✕
                </button>
              </span>
            )}

            {filterLocation !== 'all' && (
              <span className="px-2.5 py-1 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 font-bold flex items-center gap-1.5">
                Location: {filterLocation}
                <button
                  type="button"
                  onClick={() => setFilterLocation('all')}
                  className="hover:text-rose-600 transition-colors"
                >
                  ✕
                </button>
              </span>
            )}

            {filterSite !== 'all' && (
              <span className="px-2.5 py-1 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 font-bold flex items-center gap-1.5">
                Site: {COMPANY_SITES[filterSite]?.name || filterSite}
                <button
                  type="button"
                  onClick={() => setFilterSite('all')}
                  className="hover:text-rose-600 transition-colors"
                >
                  ✕
                </button>
              </span>
            )}

            {searchQuery && (
              <span className="px-2.5 py-1 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 font-bold flex items-center gap-1.5">
                Query: "{searchQuery}"
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="hover:text-rose-600 transition-colors"
                >
                  ✕
                </button>
              </span>
            )}

            <button
              type="button"
              onClick={handleResetFilters}
              className="text-[11px] font-bold text-rose-600 dark:text-rose-400 hover:underline flex items-center gap-1 ml-auto cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
              Reset All Filters
            </button>
          </div>
        )}
      </div>

      {/* Mobile Card List View (md:hidden) */}
      <div className="md:hidden p-3 space-y-3 flex-1 overflow-y-auto bg-slate-50/50">
        {paginatedRecords.length === 0 ? (
          <div className="p-8 text-center text-sm font-semibold text-slate-500 bg-white rounded-2xl border border-dashed border-slate-200">
            No records found.
          </div>
        ) : (
          paginatedRecords.map((record) => {
            const catBadge = getCategoryBadge(record.category, record.type);
            const isExp = record.type === 'expense';
            return (
              <TiltCard
                key={record.id}
                className={`p-4 rounded-2xl sm:rounded-3xl theme-card theme-card-shimmer space-y-3 transition-all ${
                  isExp ? 'border-rose-200/50 hover:border-rose-400' : 'border-emerald-200/50 hover:border-emerald-400'
                }`}
              >
                <div className="flex items-start justify-between gap-2.5">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap mb-2">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                        isExp
                          ? 'bg-rose-50 text-rose-700 border border-rose-200/70'
                          : 'bg-emerald-50 text-emerald-700 border border-emerald-200/70'
                      }`}>
                        {isExp ? <TrendingDown className="h-3 w-3" /> : <TrendingUp className="h-3 w-3" />}
                        {record.type.toUpperCase()}
                      </span>
                      {(() => {
                        const sId = resolveSiteId(record.siteId);
                        const sName = COMPANY_SITES[sId]?.name || sId;
                        return (
                          <span className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-bold border ${
                            sId === 'dsm'
                              ? 'bg-cyan-50 text-cyan-800 border-cyan-200'
                              : sId === 'ntt_data'
                              ? 'bg-amber-50 text-amber-800 border-amber-200'
                              : 'bg-indigo-50 text-[#3b2fc9] border-indigo-200'
                          }`}>
                            {sName}
                          </span>
                        );
                      })()}
                      <span className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-black ${
                        record.location === 'HYD'
                          ? 'bg-blue-50 text-blue-700 border border-blue-200'
                          : 'bg-teal-50 text-teal-700 border border-teal-200'
                      }`}>
                        {record.location}
                      </span>
                      <span className="text-[11px] text-slate-400 font-semibold">
                        {new Date(record.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                      </span>
                    </div>
                    
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-bold border ${catBadge.color}`}>
                        <span>{catBadge.emoji}</span>
                        <span>{catBadge.label}</span>
                      </span>
                    </div>

                    {record.description && (
                      <p className="text-xs theme-text-primary mt-2 line-clamp-2 theme-card-subtle px-2.5 py-1.5 rounded-xl font-medium">
                        {record.description}
                      </p>
                    )}
                  </div>

                  <div className="text-right shrink-0">
                    <div className={`inline-flex items-center px-3 py-1.5 rounded-2xl text-base font-mono font-black shadow-xs border ${
                      isExp
                        ? 'bg-rose-50 border-rose-200 text-rose-700'
                        : 'bg-emerald-50 border-emerald-200 text-emerald-700'
                    }`}>
                      <RollingCashCounter
                        value={record.amount}
                        prefix={isExp ? '-₹' : '+₹'}
                      />
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between text-[11px] text-slate-400 pt-2 border-t border-slate-100">
                  <span className="truncate max-w-[140px] font-medium">By: <span className="font-bold text-slate-700">{record.createdBy || 'Unknown'}</span></span>
                  <div className="flex items-center gap-1.5">
                    {record.billUrl && (
                      <button
                        type="button"
                        onClick={() => {
                          triggerHaptic('light');
                          setViewingBillRecord(record);
                        }}
                        className="h-8 px-2.5 rounded-xl bg-blue-50 border border-blue-200 text-blue-700 text-xs font-bold flex items-center gap-1 hover:bg-blue-100 transition-colors shadow-2xs"
                        title="View Bill in Lightbox"
                      >
                        <FileText className="h-3.5 w-3.5" />
                        <span>Bill</span>
                      </button>
                    )}
                    {onEdit && canEditRecord(record) && (
                      <button
                        onClick={() => {
                          triggerHaptic('light');
                          onEdit(record);
                        }}
                        className="h-8 px-2.5 rounded-xl bg-indigo-50 border border-indigo-100 text-[#3b2fc9] text-xs font-bold flex items-center gap-1 hover:bg-indigo-100 transition-colors"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        <span>Edit</span>
                      </button>
                    )}
                    {canDeleteRecord(record) && (
                      <button
                        onClick={() => promptDeleteRecord(record)}
                        className="h-8 px-2 rounded-xl text-rose-500 hover:bg-rose-50 flex items-center justify-center transition-colors"
                        title="Delete record"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </TiltCard>
            );
          })
        )}
      </div>

      {/* Desktop Table View (hidden md:block) */}
      <div className="hidden md:block overflow-x-auto flex-1">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-50/80 border-b border-gray-200">
              <th className="px-3.5 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Date</th>
              <th className="px-3.5 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Site & Location</th>
              <th className="px-3.5 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Type & Category</th>
              <th className="px-3.5 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Description & User</th>
              <th className="px-2.5 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider text-center">Bill</th>
              <th className="px-3.5 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Amount</th>
              <th className="px-3.5 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {paginatedRecords.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-sm text-gray-500">
                  No records found.
                </td>
              </tr>
            ) : (
              paginatedRecords.map((record) => {
                const catBadge = getCategoryBadge(record.category, record.type);
                const isExp = record.type === 'expense';
                return (
                  <tr key={record.id} className="hover:bg-gray-50/60 transition-colors">
                    {/* Date */}
                    <td className="px-3.5 py-3 text-xs text-gray-700 whitespace-nowrap font-medium">
                      {new Date(record.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </td>

                    {/* Combined: Site & Location */}
                    <td className="px-3.5 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {(() => {
                          const sId = resolveSiteId(record.siteId);
                          const sName = COMPANY_SITES[sId]?.name || sId;
                          return (
                            <span className={`inline-block px-2 py-0.5 rounded-md text-[11px] font-bold border ${
                              sId === 'dsm'
                                ? 'bg-cyan-50 text-cyan-800 border-cyan-200'
                                : sId === 'ntt_data'
                                ? 'bg-amber-50 text-amber-800 border-amber-200'
                                : 'bg-indigo-50 text-[#3b2fc9] border-indigo-200'
                            }`}>
                              {sName}
                            </span>
                          );
                        })()}
                        <span className={`inline-block px-1.5 py-0.5 rounded-md text-[10px] font-black ${
                          record.location === 'HYD' ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'bg-teal-50 text-teal-700 border border-teal-200'
                        }`}>
                          {record.location}
                        </span>
                      </div>
                    </td>

                    {/* Combined: Type & Category */}
                    <td className="px-3.5 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold border ${catBadge.color}`}>
                          <span>{catBadge.emoji}</span>
                          <span className="truncate max-w-[130px]">{catBadge.label}</span>
                        </span>
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                          isExp ? 'bg-rose-50 text-rose-700 border border-rose-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        }`}>
                          {isExp ? <TrendingDown className="h-2.5 w-2.5" /> : <TrendingUp className="h-2.5 w-2.5" />}
                          {record.type}
                        </span>
                      </div>
                    </td>

                    {/* Combined: Description & User */}
                    <td className="px-3.5 py-3">
                      <div className="min-w-0 max-w-[220px]">
                        <p className="text-xs text-gray-700 font-medium truncate" title={record.description || ''}>
                          {record.description || '—'}
                        </p>
                        <p className="text-[10px] text-gray-400 font-medium truncate" title={record.createdBy || ''}>
                          By: <span className="font-semibold text-gray-600">{record.createdBy || 'Unknown'}</span>
                        </p>
                      </div>
                    </td>

                    {/* Bill */}
                    <td className="px-2.5 py-3 text-center whitespace-nowrap">
                      {record.billUrl ? (
                        <button
                          type="button"
                          onClick={() => {
                            triggerHaptic('light');
                            setViewingBillRecord(record);
                          }}
                          className="inline-flex items-center justify-center p-1.5 text-blue-600 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors shadow-2xs cursor-pointer"
                          title="Inspect Uploaded Bill"
                        >
                          <FileText className="h-3.5 w-3.5" />
                        </button>
                      ) : (
                        <span className="text-gray-300 text-xs">—</span>
                      )}
                    </td>

                    {/* Amount */}
                    <td className="px-3.5 py-3 text-right whitespace-nowrap">
                      <span className={`inline-block px-2.5 py-1 rounded-xl font-mono font-black text-xs shadow-2xs border ${
                        isExp ? 'bg-rose-50 text-rose-700 border-rose-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      }`}>
                        {isExp ? '-' : '+'}₹{record.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="px-3.5 py-3 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1">
                        {onEdit && canEditRecord(record) && (
                          <button
                            onClick={() => onEdit(record)}
                            className="text-gray-400 hover:text-[#3b2fc9] p-1.5 rounded-lg hover:bg-[#3b2fc9]/10 transition-colors"
                            title="Edit Record"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                        )}
                        {canDeleteRecord(record) && (
                          <button
                            onClick={() => promptDeleteRecord(record)}
                            className="text-gray-400 hover:text-rose-600 p-1.5 rounded-lg hover:bg-rose-50 transition-colors"
                            title="Delete Record"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="p-4 border-t border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-3 bg-white text-xs sm:text-sm text-gray-600">
          <div>
            Showing <span className="font-medium">{(currentPage - 1) * ITEMS_PER_PAGE + 1}</span> to <span className="font-medium">{Math.min(currentPage * ITEMS_PER_PAGE, filteredRecords.length)}</span> of <span className="font-medium">{filteredRecords.length}</span> results
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="p-1.5 rounded border border-gray-200 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="px-2 font-medium text-gray-700">
              {currentPage} / {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="p-1.5 rounded border border-gray-200 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Tuckshop Record Two-Step Deletion Safeguard Modal */}
      <AlertDialog
        open={!!recordToDelete}
        onOpenChange={(open) => {
          if (!open) {
            setRecordToDelete(null);
            setDeleteConfirmationInput('');
          }
        }}
      >
        <AlertDialogContent className="w-[90vw] max-w-md rounded-2xl">
          <AlertDialogHeader>
            <div className="flex items-center gap-2.5 text-rose-600 mb-1">
              <div className="p-2 rounded-xl bg-rose-100 dark:bg-rose-950/50">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <AlertDialogTitle className="text-base sm:text-lg font-bold text-gray-900 dark:text-gray-100">
                Delete Tuckshop Record Safeguard
              </AlertDialogTitle>
            </div>
            <AlertDialogDescription asChild>
              <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-300 space-y-3 pt-1">
                <p>
                  This action is permanent and will remove this ledger entry and update financial balances. This cannot be undone.
                </p>
                {recordToDelete && (
                  <div className="p-3 rounded-xl bg-gray-50 dark:bg-gray-800/60 border border-gray-200/80 dark:border-gray-700 space-y-1 text-xs">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Date:</span>
                      <span className="font-medium text-gray-800 dark:text-gray-200">
                        {recordToDelete.date}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Type / Category:</span>
                      <span className="font-semibold text-gray-800 dark:text-gray-200 uppercase">
                        {recordToDelete.type} • {recordToDelete.category}
                      </span>
                    </div>
                    {recordToDelete.description && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">Description:</span>
                        <span className="font-medium text-gray-800 dark:text-gray-200 truncate max-w-[200px]">
                          {recordToDelete.description}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between pt-1 border-t border-gray-200 dark:border-gray-700 font-bold">
                      <span className="text-gray-500">Amount:</span>
                      <span className="font-mono text-gray-900 dark:text-gray-100">
                        ₹{Number(recordToDelete.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                )}
                <div className="space-y-1.5 pt-1">
                  <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 block">
                    To confirm, type <span className="font-mono font-bold text-rose-600 select-all">DELETE</span> below:
                  </label>
                  <Input
                    value={deleteConfirmationInput}
                    onChange={(e) => setDeleteConfirmationInput(e.target.value)}
                    placeholder="DELETE"
                    className="font-mono text-sm border-rose-200 focus-visible:ring-rose-500/30"
                    autoFocus
                  />
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-0 mt-2">
            <AlertDialogCancel
              onClick={() => {
                setRecordToDelete(null);
                setDeleteConfirmationInput('');
              }}
              className="rounded-xl text-xs font-semibold"
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold disabled:opacity-40 disabled:cursor-not-allowed"
              disabled={isDeleting || deleteConfirmationInput.trim().toUpperCase() !== 'DELETE'}
              onClick={confirmDeleteRecord}
            >
              {isDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Confirm & Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Lightbox Receipt & Bill Viewer Modal */}
      <TuckshopBillModal
        record={viewingBillRecord}
        isOpen={Boolean(viewingBillRecord)}
        onClose={() => setViewingBillRecord(null)}
      />
    </div>
    </div>
  );
}
