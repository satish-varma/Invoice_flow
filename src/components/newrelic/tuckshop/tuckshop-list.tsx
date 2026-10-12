'use client';

import React, { useState } from 'react';
import { Trash2, Filter, FileText, Search, ChevronLeft, ChevronRight, TrendingUp, TrendingDown, IndianRupee, Pencil, FileSpreadsheet } from 'lucide-react';
import * as XLSX from 'xlsx';
import { NewRelicTuckshopRecord, deleteTuckshopRecord } from '@/services/newrelicTuckshopService';
import { TuckshopDashboard } from './tuckshop-dashboard';
import { useAuth } from '@/contexts/AuthContext';
import { SiteId, resolveSiteId, SITE_OPTIONS } from '@/types/site';

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

  const availableYears = React.useMemo(() => {
    return Array.from(new Set(records.map(r => new Date(r.date).getFullYear()))).sort((a, b) => b - a);
  }, [records]);

  const filteredRecords = records.filter(record => {
    if (filterType !== 'all' && record.type !== filterType) return false;
    if (filterLocation !== 'all' && record.location !== filterLocation) return false;
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
      
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden h-full flex flex-col">
      <div className="p-4 sm:p-5 border-b border-gray-100 flex flex-col gap-3 bg-gray-50/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-gray-800 text-base sm:text-lg">Transaction Ledger</h3>
            <span className="text-xs text-gray-500 font-medium hidden sm:inline">
              ({filteredRecords.length} record{filteredRecords.length !== 1 ? 's' : ''})
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500 font-medium sm:hidden">
              {filteredRecords.length} record{filteredRecords.length !== 1 ? 's' : ''}
            </span>
            <button
              type="button"
              onClick={exportToExcel}
              disabled={filteredRecords.length === 0}
              className="h-8 px-2.5 sm:px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-colors"
              title="Download Excel report"
            >
              <FileSpreadsheet className="h-3.5 w-3.5" />
              <span>Export Excel</span>
            </button>
          </div>
        </div>
        
        <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 sm:gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search items or notes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 sm:py-1.5 text-xs sm:text-sm border border-gray-200 rounded-xl sm:rounded-lg focus:outline-none focus:ring-2 focus:ring-[#3b2fc9]/20 bg-white"
            />
          </div>

          <div className="grid grid-cols-2 sm:flex sm:items-center gap-2">
            {isOwnerOrAdmin && (
              <select
                value={filterSite}
                onChange={(e) => setFilterSite(e.target.value)}
                className="w-full px-2.5 py-2 sm:py-1.5 text-xs sm:text-sm border border-gray-200 rounded-xl sm:rounded-lg focus:outline-none focus:ring-2 focus:ring-[#3b2fc9]/20 bg-white"
              >
                <option value="all">All Sites</option>
                {SITE_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            )}

            <div className="relative">
              <Filter className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
              <select
                value={filterLocation}
                onChange={(e) => setFilterLocation(e.target.value as any)}
                className="w-full pl-8 pr-2 py-2 sm:py-1.5 text-xs sm:text-sm border border-gray-200 rounded-xl sm:rounded-lg focus:outline-none focus:ring-2 focus:ring-[#3b2fc9]/20 bg-white"
              >
                <option value="all">All Locations</option>
                <option value="BLR">Bangalore (BLR)</option>
                <option value="HYD">Hyderabad (HYD)</option>
              </select>
            </div>
            
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value as any)}
              className="w-full px-2.5 py-2 sm:py-1.5 text-xs sm:text-sm border border-gray-200 rounded-xl sm:rounded-lg focus:outline-none focus:ring-2 focus:ring-[#3b2fc9]/20 bg-white"
            >
              <option value="all">All Types</option>
              <option value="expense">Expenses Only</option>
              <option value="sale">Sales Only</option>
            </select>

            <select
              value={filterMonth}
              onChange={(e) => setFilterMonth(e.target.value)}
              className="w-full px-2.5 py-2 sm:py-1.5 text-xs sm:text-sm border border-gray-200 rounded-xl sm:rounded-lg focus:outline-none focus:ring-2 focus:ring-[#3b2fc9]/20 bg-white"
            >
              <option value="all">All Months</option>
              {Array.from({ length: 12 }, (_, i) => {
                const d = new Date(2000, i, 1);
                return <option key={i} value={i}>{d.toLocaleString('default', { month: 'short' })}</option>;
              })}
            </select>

            <select
              value={filterYear}
              onChange={(e) => setFilterYear(e.target.value)}
              className="w-full px-2.5 py-2 sm:py-1.5 text-xs sm:text-sm border border-gray-200 rounded-xl sm:rounded-lg focus:outline-none focus:ring-2 focus:ring-[#3b2fc9]/20 bg-white"
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
      <div className="md:hidden divide-y divide-gray-100 flex-1 overflow-y-auto">
        {paginatedRecords.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-500">
            No records found.
          </div>
        ) : (
          paginatedRecords.map((record) => (
            <div key={record.id} className="p-4 hover:bg-gray-50/50 transition-colors space-y-2.5">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 flex-wrap mb-1">
                    <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                      record.type === 'expense'
                        ? 'bg-red-50 text-red-600 border border-red-100'
                        : 'bg-green-50 text-green-700 border border-green-100'
                    }`}>
                      {record.type.toUpperCase()}
                    </span>
                    {(() => {
                      const sId = resolveSiteId(record.siteId);
                      return (
                        <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold border ${
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
                    <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold bg-gray-100 text-gray-600">
                      {record.location}
                    </span>
                    <span className="text-xs text-gray-400">
                      {new Date(record.date).toLocaleDateString()}
                    </span>
                  </div>
                  <h4 className="text-sm font-semibold text-gray-800 capitalize leading-snug">
                    {record.category.replace('_', ' ')}
                  </h4>
                  {record.description && (
                    <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">
                      {record.description}
                    </p>
                  )}
                </div>

                <div className="text-right shrink-0">
                  <div className={`text-base font-bold ${
                    record.type === 'expense' ? 'text-red-600' : 'text-green-600'
                  }`}>
                    {record.type === 'expense' ? '-' : '+'}₹{record.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </div>
                  {record.billUrl && (
                    <a
                      href={record.billUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 mt-1 text-[11px] font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded hover:bg-blue-100"
                    >
                      <FileText className="h-3 w-3" /> View Bill
                    </a>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between text-[11px] text-gray-400 pt-1 border-t border-gray-50">
                <span className="truncate max-w-[200px]">By: {record.createdBy || 'Unknown'}</span>
                {(canEditRecord(record) || canDeleteRecord(record)) && (
                  <div className="flex items-center gap-2">
                    {onEdit && canEditRecord(record) && (
                      <button
                        onClick={() => onEdit(record)}
                        className="text-[#3b2fc9] hover:text-[#2a2296] p-1 flex items-center gap-1 font-medium"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        <span>Edit</span>
                      </button>
                    )}
                    {canDeleteRecord(record) && (
                      <button
                        onClick={() => handleDelete(record.id!)}
                        className="text-red-500 hover:text-red-700 p-1 flex items-center gap-1 font-medium"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        <span>Delete</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Desktop Table View (hidden md:block) */}
      <div className="hidden md:block overflow-x-auto flex-1">
        <table className="w-full text-left border-collapse min-w-[700px]">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Date</th>
              <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Site</th>
              <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Location</th>
              <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Category</th>
              <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase">User</th>
              <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Description</th>
              <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase text-center">Bill</th>
              <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase text-right">Amount</th>
              <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {paginatedRecords.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-5 py-8 text-center text-sm text-gray-500">
                  No records found.
                </td>
              </tr>
            ) : (
              paginatedRecords.map((record) => (
                <tr key={record.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-5 py-3 text-sm text-gray-600">
                    {new Date(record.date).toLocaleDateString()}
                  </td>
                  <td className="px-5 py-3 text-sm">
                    {(() => {
                      const sId = resolveSiteId(record.siteId);
                      return (
                        <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold border ${
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
                  </td>
                  <td className="px-5 py-3 text-sm font-medium text-gray-700">
                    {record.location}
                  </td>
                  <td className="px-5 py-3 text-sm text-gray-600 capitalize">
                    {record.category.replace('_', ' ')}
                  </td>
                  <td className="px-5 py-3 text-sm text-gray-500 max-w-[150px] truncate" title={record.createdBy || ''}>
                    {record.createdBy || 'Unknown'}
                  </td>
                  <td className="px-5 py-3 text-sm text-gray-500 max-w-[200px] truncate" title={record.description}>
                    {record.description || '-'}
                  </td>
                  <td className="px-5 py-3 text-center">
                    {record.billUrl ? (
                      <a href={record.billUrl} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center p-1.5 text-blue-600 bg-blue-50 rounded hover:bg-blue-100 transition-colors" title="View Uploaded Bill">
                        <FileText className="h-4 w-4" />
                      </a>
                    ) : (
                      <span className="text-gray-300">-</span>
                    )}
                  </td>
                  <td className={`px-5 py-3 text-sm font-semibold text-right ${record.type === 'expense' ? 'text-red-600' : 'text-green-600'}`}>
                    {record.type === 'expense' ? '-' : '+'}₹{record.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {onEdit && canEditRecord(record) && (
                        <button
                          onClick={() => onEdit(record)}
                          className="text-gray-400 hover:text-[#3b2fc9] p-1.5 rounded hover:bg-gray-100 transition-colors"
                          title="Edit Record"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                      )}
                      {canDeleteRecord(record) && (
                        <button
                          onClick={() => handleDelete(record.id!)}
                          className="text-gray-400 hover:text-red-500 p-1.5 rounded hover:bg-red-50 transition-colors"
                          title="Delete Record"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
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
