'use client';

import React, { useState } from 'react';
import { Trash2, Filter, FileText, Search, ChevronLeft, ChevronRight, TrendingUp, TrendingDown, IndianRupee, Pencil, FileSpreadsheet, X } from 'lucide-react';
import * as XLSX from 'xlsx';
import { NewRelicTuckshopRecord, deleteTuckshopRecord } from '@/services/newrelicTuckshopService';
import { TuckshopDashboard, getCategoryBadge } from './tuckshop-dashboard';
import { useAuth } from '@/contexts/AuthContext';
import { SiteId, resolveSiteId, SITE_OPTIONS } from '@/types/site';
import { triggerHaptic } from '@/lib/haptics';
import { RollingCashCounter } from '@/components/effects/RollingCashCounter';
import { TiltCard } from '@/components/effects/TiltCard';

interface Props {
  records: NewRelicTuckshopRecord[];
  showDashboard?: boolean;
  onEdit?: (record: NewRelicTuckshopRecord) => void;
}

export function TuckshopList({ records, showDashboard, onEdit }: Props) {
  const { role, user } = useAuth();
  const isOwnerOrAdmin = role === 'admin' || role === 'superadmin';
  const [filterType, setFilterType] = useState<'all' | 'expense' | 'sale'>('all');
  const [filterSite, setFilterSite] = useState<string>('all');
  const [filterMonth, setFilterMonth] = useState<string>('all');
  const [filterYear, setFilterYear] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 20;


  // Map full names to codes since they are stored as 'bangalore' / 'hyderabad' in users collection
  const getMappedLocation = (locStr?: string) => {
    if (!locStr) return undefined;
    if (locStr.toLowerCase() === 'bangalore' || locStr === 'BLR') return 'BLR';
    if (locStr.toLowerCase() === 'hyderabad' || locStr === 'HYD') return 'HYD';
    return undefined;
  };
  
  const defaultLoc = getMappedLocation(user?.preferredLocations?.[0]);
  const [filterLocation, setFilterLocation] = useState<'all' | 'HYD' | 'BLR'>(defaultLoc || 'all');

  // Reset to page 1 when filters change
  React.useEffect(() => {
    setCurrentPage(1);
  }, [filterType, filterLocation, filterSite, filterMonth, filterYear, searchQuery]);

  // Also update if user object loads later
  React.useEffect(() => {
    const mappedLoc = getMappedLocation(user?.preferredLocations?.[0]);
    if (mappedLoc && filterLocation === 'all') {
      setFilterLocation(mappedLoc);
    }
  }, [user?.preferredLocations]);

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this record?')) {
      await deleteTuckshopRecord(id);
    }
  };

  const canEditRecord = (record: NewRelicTuckshopRecord) => {
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
    // Only Admin or Superadmin can delete
    return isOwnerOrAdmin;
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
    
    if (filterMonth !== 'all') {
      if (new Date(record.date).getMonth().toString() !== filterMonth) return false;
    }
    if (filterYear !== 'all') {
      if (new Date(record.date).getFullYear().toString() !== filterYear) return false;
    }
    
    if (searchQuery.trim() !== '') {
      const q = searchQuery.toLowerCase().trim();
      const catMatch = record.category.replace('_', ' ').toLowerCase().includes(q);
      const descMatch = (record.description || '').toLowerCase().includes(q);
      if (!catMatch && !descMatch) return false;
    }
    
    return true;
  });

  const totalPages = Math.ceil(filteredRecords.length / ITEMS_PER_PAGE);
  const paginatedRecords = filteredRecords.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );



  const exportToExcel = () => {
    try {
      const rows = filteredRecords.map((r) => {
        const sId = resolveSiteId(r.siteId);
        const siteName = sId === 'dsm' ? 'DSM' : sId === 'ntt_data' ? 'NTT Data' : 'NewRelic';
        return {
          'Date': new Date(r.date).toLocaleDateString('en-IN'),
          'Company Site': siteName,
          'Location': r.location,
          'Type': r.type.toUpperCase(),
          'Category': r.category.replace('_', ' ').toUpperCase(),
          'Amount (₹)': r.amount,
          'Description': r.description || '',
          'Created By': r.createdBy || '',
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
    <div className="flex flex-col gap-6 h-full w-full">
      {showDashboard && <TuckshopDashboard records={filteredRecords} />}
      
      <div className="theme-card rounded-2xl shadow-sm overflow-hidden h-full flex flex-col">
      <div className="p-4 sm:p-5 border-b border-white/10 flex flex-col gap-3.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold theme-text-primary text-base sm:text-lg">Transaction Ledger</h3>
            <span className="text-xs theme-text-muted font-medium">
              ({filteredRecords.length} record{filteredRecords.length !== 1 ? 's' : ''})
            </span>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Prominent Segmented Location Filter Switcher */}
            <div className="flex items-center p-1 bg-slate-200/80 rounded-2xl gap-1 border border-slate-300/70 shadow-2xs">
              <button
                type="button"
                onClick={() => {
                  triggerHaptic('light');
                  setFilterLocation('all');
                }}
                className={`flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  filterLocation === 'all'
                    ? 'bg-gradient-to-r from-indigo-600 to-[#3b2fc9] text-white shadow-xs font-black'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                }`}
              >
                <span>All Locations</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${
                  filterLocation === 'all' ? 'bg-white/20 text-white' : 'bg-slate-300/80 text-slate-700'
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
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                }`}
              >
                <span>Bangalore</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${
                  filterLocation === 'BLR' ? 'bg-white/20 text-white' : 'bg-slate-300/80 text-slate-700'
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
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                }`}
              >
                <span>Hyderabad</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${
                  filterLocation === 'HYD' ? 'bg-white/20 text-white' : 'bg-slate-300/80 text-slate-700'
                }`}>
                  {locCounts.hyd}
                </span>
              </button>
            </div>

            <button
              type="button"
              onClick={exportToExcel}
              disabled={filteredRecords.length === 0}
              className="h-8 px-2.5 sm:px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-colors shrink-0"
              title="Download Excel report"
            >
              <FileSpreadsheet className="h-3.5 w-3.5" />
              <span>Export Excel</span>
            </button>
          </div>
        </div>
        
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
                <option value="all">All Sites</option>
                {SITE_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
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
                        return (
                          <span className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-bold border ${
                            sId === 'dsm'
                              ? 'bg-cyan-50 text-cyan-800 border-cyan-200'
                              : sId === 'ntt_data'
                              ? 'bg-amber-50 text-amber-800 border-amber-200'
                              : 'bg-indigo-50 text-[#3b2fc9] border-indigo-200'
                          }`}>
                            {sId === 'dsm' ? 'DSM' : sId === 'ntt_data' ? 'NTT Data' : 'NewRelic'}
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
                      <a
                        href={record.billUrl}
                        target="_blank"
                        rel="noreferrer"
                        onClick={() => triggerHaptic('light')}
                        className="h-8 px-2.5 rounded-xl bg-blue-50 border border-blue-200 text-blue-700 text-xs font-bold flex items-center gap-1 hover:bg-blue-100 transition-colors"
                      >
                        <FileText className="h-3.5 w-3.5" />
                        <span>Bill</span>
                      </a>
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
                        onClick={() => {
                          triggerHaptic('medium');
                          handleDelete(record.id!);
                        }}
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
                          return (
                            <span className={`inline-block px-2 py-0.5 rounded-md text-[11px] font-bold border ${
                              sId === 'dsm'
                                ? 'bg-cyan-50 text-cyan-800 border-cyan-200'
                                : sId === 'ntt_data'
                                ? 'bg-amber-50 text-amber-800 border-amber-200'
                                : 'bg-indigo-50 text-[#3b2fc9] border-indigo-200'
                            }`}>
                              {sId === 'dsm' ? 'DSM' : sId === 'ntt_data' ? 'NTT Data' : 'NewRelic'}
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
                        <a href={record.billUrl} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center p-1.5 text-blue-600 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors shadow-2xs" title="View Uploaded Bill">
                          <FileText className="h-3.5 w-3.5" />
                        </a>
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
                            onClick={() => handleDelete(record.id!)}
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
    </div>
    </div>
  );
}
