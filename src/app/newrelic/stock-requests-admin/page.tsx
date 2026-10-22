'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { getStockRequests, updateStockRequestStatus, deleteStockRequest, updateStockRequestFulfillment } from '@/services/newrelicStockRequestService';
import { StockRequest } from '@/types/stockRequest';
import { Check, Download, Trash2, MapPin, Calendar, Clock, CheckCircle, User, FileText, IndianRupee } from 'lucide-react';
import { format } from 'date-fns';
import { useRouter } from 'next/navigation';

import { COMPANY_SITES, SiteId } from '@/types/site';
import { triggerHaptic } from '@/lib/haptics';

export default function StockRequestsAdminPage() {
  const { role, isReadOnly } = useAuth();
  const router = useRouter();
  const [requests, setRequests] = useState<StockRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filterSite, setFilterSite] = useState<'all' | SiteId>('all');
  const [filterLocation, setFilterLocation] = useState<'all' | 'hyderabad' | 'bangalore'>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'PENDING' | 'PARTIALLY_FULFILLED' | 'FULFILLED' | 'CANCELLED'>('PENDING');
  const [activeFulfillId, setActiveFulfillId] = useState<string | null>(null);
  const [fulfillData, setFulfillData] = useState<{ [itemId: string]: number }>({});

  useEffect(() => {
    if (role === 'admin' || role === 'superadmin' || role === 'guest') {
      fetchRequests();
    }
  }, [role]);

  const fetchRequests = async () => {
    setIsLoading(true);
    try {
      const reqs = await getStockRequests();
      setRequests(reqs);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStatusChange = async (id: string, status: StockRequest['status']) => {
    if (isReadOnly || role === 'guest') {
      alert('Guest Mode (Read-Only): Updating request status is disabled.');
      return;
    }
    if (!confirm(`Mark this request as ${status}?`)) return;
    try {
      await updateStockRequestStatus(id, status);
      setRequests(prev => prev.map(r => r.id === id ? { ...r, status } : r));
    } catch (e) {
      alert('Failed to update status');
    }
  };

  const handleDelete = async (id: string) => {
    if (isReadOnly || role === 'guest') {
      alert('Guest Mode (Read-Only): Deleting requests is disabled.');
      return;
    }
    if (!confirm('Are you sure you want to permanently delete this request?')) return;
    try {
      await deleteStockRequest(id);
      setRequests(prev => prev.filter(r => r.id !== id));
    } catch (e) {
      alert('Failed to delete request');
    }
  };

  const handleStartFulfill = (req: StockRequest) => {
    const data: { [itemId: string]: number } = {};
    req.lineItems.forEach((item, idx) => {
      data[idx.toString()] = item.fulfilledQuantity ?? item.quantity;
    });
    setFulfillData(data);
    setActiveFulfillId(req.id!);
  };

  const handleSaveFulfill = async (req: StockRequest) => {
    if (isReadOnly || role === 'guest') {
      alert('Guest Mode (Read-Only): Updating fulfillment is disabled.');
      return;
    }
    let allFulfilled = true;
    let anyFulfilled = false;
    const newLineItems = req.lineItems.map((item, idx) => {
      const fQty = fulfillData[idx.toString()] ?? 0;
      if (fQty < item.quantity) allFulfilled = false;
      if (fQty > 0) anyFulfilled = true;
      return {
        ...item,
        fulfilledQuantity: fQty,
        fulfilledTotalUnits: item.orderType === 'cases' ? fQty * item.caseSize : fQty
      };
    });
    
    let status = 'PENDING';
    if (allFulfilled) status = 'FULFILLED';
    else if (anyFulfilled) status = 'PARTIALLY_FULFILLED';
    
    try {
      await updateStockRequestFulfillment(req.id!, newLineItems, status as any);
      setRequests(prev => prev.map(r => r.id === req.id ? { ...r, lineItems: newLineItems, status: status as any } : r));
      setActiveFulfillId(null);
    } catch (e) {
      alert('Failed to save fulfillment');
    }
  };

  const handleCreateChallan = (req: StockRequest) => {
    const draft = {
      location: req.location,
      dcDate: new Date().toISOString(),
      dcNumber: '',
      lineItems: req.lineItems.map(item => {
        const qty = item.fulfilledQuantity ?? item.quantity;
        const totalValue = qty * (item.mrp || 0);
        return {
          brandName: item.brandName,
          itemName: item.itemName,
          quantity: qty,
          unitValue: item.mrp || 0,
          totalValue: totalValue,
          isFreeItem: false,
          hsnCode: ''
        };
      }),
      amount: req.lineItems.reduce((acc, item) => {
        const qty = item.fulfilledQuantity ?? item.quantity;
        return acc + (qty * (item.mrp || 0));
      }, 0),
      discount: 0,
      freight: 0,
      totalAmount: req.lineItems.reduce((acc, item) => {
        const qty = item.fulfilledQuantity ?? item.quantity;
        return acc + (qty * (item.mrp || 0));
      }, 0),
    };
    sessionStorage.setItem('challanDraft', JSON.stringify(draft));
    router.push('/newrelic');
  };

  const handleExport = () => {
    const filtered = requests.filter(r => {
      if (filterSite !== 'all' && (r.siteId || 'newrelic') !== filterSite) return false;
      if (filterLocation !== 'all' && r.location !== filterLocation) return false;
      if (filterStatus !== 'all' && r.status !== filterStatus) return false;
      return true;
    });

    if (filtered.length === 0) {
      alert('No data to export based on current filters.');
      return;
    }

    const headers = [
      'Request Date',
      'Company Site',
      'Requested By',
      'Location',
      'Status',
      'Brand Name',
      'Item Name',
      'Order Type',
      'Case Size',
      'Quantity',
      'Total Units',
      'Reference MRP',
      'Fulfilled Qty',
      'Fulfilled Units'
    ];
    const rows: string[][] = [];

    filtered.forEach(req => {
      const date = format(new Date(req.requestDate), 'dd MMM yyyy');
      const siteName = COMPANY_SITES[req.siteId || 'newrelic']?.name || 'NewRelic';
      req.lineItems.forEach(item => {
        rows.push([
          date,
          `"${siteName}"`,
          `"${req.createdBy}"`,
          req.location,
          req.status,
          `"${item.brandName.replace(/"/g, '""')}"`,
          `"${item.itemName.replace(/"/g, '""')}"`,
          item.orderType,
          (item.caseSize || 1).toString(),
          item.quantity.toString(),
          item.totalUnits.toString(),
          item.mrp?.toString() || '',
          item.fulfilledQuantity?.toString() || '',
          item.fulfilledTotalUnits?.toString() || ''
        ]);
      });
    });

    const csvContent = [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    const siteSuffix = filterSite === 'all' ? 'all_sites' : filterSite;
    link.setAttribute('download', `stock_requests_${siteSuffix}_${filterLocation}_${filterStatus}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!role || role !== 'admin') return null;

  const filteredRequests = requests.filter(r => {
    if (filterSite !== 'all' && (r.siteId || 'newrelic') !== filterSite) return false;
    if (filterLocation !== 'all' && r.location !== filterLocation) return false;
    if (filterStatus !== 'all' && r.status !== filterStatus) return false;
    return true;
  });

  const pendingRequests = requests.filter(r => {
    if (r.status !== 'PENDING') return false;
    if (filterSite !== 'all' && (r.siteId || 'newrelic') !== filterSite) return false;
    if (filterLocation !== 'all' && r.location !== filterLocation) return false;
    return true;
  });
  let totalPendingMrp = 0;
  let totalPendingCost = 0;
  pendingRequests.forEach(r => {
    r.lineItems.forEach(item => {
      totalPendingMrp += (item.mrp || 0) * item.quantity;
      totalPendingCost += (item.procurementCost || 0) * item.quantity;
    });
  });

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-8 py-4 sm:py-8 space-y-4 sm:space-y-6">
      {/* Large Title Mobile Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-black uppercase tracking-wider bg-indigo-50 text-indigo-700 border border-indigo-200/60 px-2 py-0.5 rounded-full">
              Administration • Hub
            </span>
            <span className="text-[10px] font-bold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
              Fulfillment Control
            </span>
          </div>
          <h1 className="text-xl sm:text-3xl font-black text-slate-900 tracking-tight">Stock Requests (Admin)</h1>
          <p className="text-slate-500 text-xs sm:text-sm font-medium mt-0.5">Review, approve, and fulfill stock indent requirements from location managers.</p>
        </div>
        <button
          onClick={() => {
            triggerHaptic('medium');
            handleExport();
          }}
          className="w-full sm:w-auto h-12 sm:h-10 flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white px-5 rounded-2xl font-black text-xs sm:text-sm shadow-md transition-all active:scale-95"
        >
          <Download className="h-4 w-4" /> Export CSV
        </button>
      </div>

      {/* 2-Column Squircle Stat Cards */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        <div className="bg-gradient-to-br from-blue-50/90 via-white to-sky-50/50 p-3.5 sm:p-5 rounded-2xl sm:rounded-3xl border border-blue-200/70 shadow-[0_4px_16px_-4px_rgba(0,0,0,0.06)] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 sm:gap-4">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] sm:text-xs font-bold text-blue-700 uppercase tracking-wider mb-1 truncate">Pending Budget (MRP)</p>
            <p className="text-lg sm:text-3xl font-mono font-black text-blue-950 tracking-tight truncate">₹{totalPendingMrp.toFixed(2)}</p>
          </div>
          <div className="w-10 h-10 sm:w-12 sm:h-12 bg-blue-600 text-white rounded-2xl flex items-center justify-center shadow-md shadow-blue-950/20 shrink-0">
            <IndianRupee className="h-5 w-5 sm:h-6 sm:w-6" />
          </div>
        </div>
        <div className="bg-gradient-to-br from-indigo-50/90 via-white to-purple-50/50 p-3.5 sm:p-5 rounded-2xl sm:rounded-3xl border border-indigo-200/70 shadow-[0_4px_16px_-4px_rgba(0,0,0,0.06)] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 sm:gap-4">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] sm:text-xs font-bold text-indigo-700 uppercase tracking-wider mb-1 truncate">Pending Cost (P.Cost)</p>
            <p className="text-lg sm:text-3xl font-mono font-black text-indigo-950 tracking-tight truncate">₹{totalPendingCost.toFixed(2)}</p>
          </div>
          <div className="w-10 h-10 sm:w-12 sm:h-12 bg-[#3b2fc9] text-white rounded-2xl flex items-center justify-center shadow-md shadow-indigo-950/20 shrink-0">
            <IndianRupee className="h-5 w-5 sm:h-6 sm:w-6" />
          </div>
        </div>
      </div>

      {/* Tactile Filter Bar */}
      <div className="bg-white p-3 sm:p-4 rounded-2xl sm:rounded-3xl border border-slate-200/80 shadow-[0_4px_16px_-4px_rgba(0,0,0,0.04)] grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-3">
        <select
          value={filterSite}
          onChange={(e) => {
            triggerHaptic('light');
            setFilterSite(e.target.value as any);
          }}
          className="w-full h-11 sm:h-10 px-3 rounded-2xl border border-slate-200 text-xs sm:text-sm font-semibold bg-white text-slate-800 shadow-2xs focus:outline-none focus:ring-2 focus:ring-[#3b2fc9]/20"
        >
          <option value="all">All Company Sites</option>
          <option value="newrelic">NewRelic</option>
          <option value="dsm">DSM</option>
          <option value="ntt_data">NTT Data</option>
        </select>

        <select
          value={filterLocation}
          onChange={(e) => {
            triggerHaptic('light');
            setFilterLocation(e.target.value as any);
          }}
          className="w-full h-11 sm:h-10 px-3 rounded-2xl border border-slate-200 text-xs sm:text-sm font-semibold bg-white text-slate-800 shadow-2xs focus:outline-none focus:ring-2 focus:ring-[#3b2fc9]/20"
        >
          <option value="all">All Locations</option>
          <option value="hyderabad">Hyderabad</option>
          <option value="bangalore">Bangalore</option>
        </select>
        
        <select
          value={filterStatus}
          onChange={(e) => {
            triggerHaptic('light');
            setFilterStatus(e.target.value as any);
          }}
          className="w-full h-11 sm:h-10 px-3 rounded-2xl border border-slate-200 text-xs sm:text-sm font-semibold bg-white text-slate-800 shadow-2xs focus:outline-none focus:ring-2 focus:ring-[#3b2fc9]/20"
        >
          <option value="all">All Statuses</option>
          <option value="PENDING">Pending</option>
          <option value="PARTIALLY_FULFILLED">Partially Fulfilled</option>
          <option value="FULFILLED">Fulfilled</option>
          <option value="CANCELLED">Cancelled</option>
        </select>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-gray-500">Loading requests...</div>
      ) : filteredRequests.length === 0 ? (
        <div className="text-center py-12 text-gray-500 bg-white rounded-xl border border-gray-200 border-dashed">
          No requests found matching your filters.
        </div>
      ) : (
        <div className="space-y-4">
          {filteredRequests.map(req => (
            <div key={req.id} className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200/80 shadow-[0_4px_16px_-4px_rgba(0,0,0,0.06)] overflow-hidden">
              <div className="bg-slate-50/80 px-4 sm:px-6 py-3.5 sm:py-4 border-b border-slate-200/80 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs sm:text-sm">
                  <div className="flex items-center gap-1.5 text-slate-600">
                    <Calendar className="h-4 w-4 shrink-0 text-slate-400" />
                    <span className="font-bold text-slate-900">{format(new Date(req.requestDate), 'dd MMM yyyy, hh:mm a')}</span>
                  </div>
                  <span className={`px-2 py-0.5 rounded-md text-xs font-bold border ${
                    (req.siteId || 'newrelic') === 'dsm'
                      ? 'bg-cyan-50 text-cyan-800 border-cyan-200'
                      : (req.siteId || 'newrelic') === 'ntt_data'
                      ? 'bg-amber-50 text-amber-800 border-amber-200'
                      : 'bg-indigo-50 text-[#3b2fc9] border-indigo-200'
                  }`}>
                    📍 {COMPANY_SITES[req.siteId || 'newrelic']?.name || 'NewRelic'}
                  </span>
                  <div className="flex items-center gap-1 text-slate-600">
                    <User className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                    <span className="truncate max-w-[150px] font-medium">{req.createdBy}</span>
                  </div>
                  <div className="flex items-center gap-1 text-slate-600">
                    <MapPin className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                    <span className="capitalize font-bold text-slate-800">{req.location}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {req.status === 'PENDING' && (
                      <span className="bg-gradient-to-r from-amber-500/15 via-amber-400/20 to-orange-500/15 text-amber-900 border border-amber-400/60 px-2.5 py-0.5 rounded-full text-xs font-black flex items-center gap-1.5 shadow-2xs">
                        <span className="relative flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                        </span>
                        PENDING
                      </span>
                    )}
                    {req.status === 'PARTIALLY_FULFILLED' && (
                      <span className="bg-gradient-to-r from-sky-500/15 to-blue-500/15 text-sky-950 border border-sky-400/60 px-2.5 py-0.5 rounded-full text-xs font-black flex items-center gap-1 shadow-2xs">
                        <CheckCircle className="h-3 w-3 text-sky-600"/> PARTIAL
                      </span>
                    )}
                    {req.status === 'FULFILLED' && (
                      <span className="bg-gradient-to-r from-emerald-500/15 via-emerald-400/20 to-teal-500/15 text-emerald-950 border border-emerald-400/60 px-2.5 py-0.5 rounded-full text-xs font-black flex items-center gap-1.5 shadow-2xs">
                        <CheckCircle className="h-3.5 w-3.5 text-emerald-600"/> FULFILLED
                      </span>
                    )}
                    {req.status === 'CANCELLED' && (
                      <span className="bg-gradient-to-r from-rose-500/15 to-red-500/15 text-rose-950 border border-rose-400/60 px-2.5 py-0.5 rounded-full text-xs font-black flex items-center gap-1 shadow-2xs">
                        <Trash2 className="h-3 w-3 text-rose-600"/> CANCELLED
                      </span>
                    )}
                  </div>
                  {req.notes && (
                    <div className="text-slate-500 italic w-full sm:w-auto font-medium">" {req.notes} "</div>
                  )}
                </div>
                
                <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                  {(req.status === 'PENDING' || req.status === 'PARTIALLY_FULFILLED') && activeFulfillId !== req.id && (
                    <button
                      onClick={() => {
                        triggerHaptic('medium');
                        handleStartFulfill(req);
                      }}
                      className="bg-[#3b2fc9] hover:bg-[#2f25a8] text-white px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-black transition-all flex items-center gap-1.5 shadow-xs active:scale-95"
                    >
                      <Check className="h-4 w-4" /> Fulfill
                    </button>
                  )}
                  {activeFulfillId === req.id && (
                    <>
                      <button
                        onClick={() => {
                          triggerHaptic('light');
                          setActiveFulfillId(null);
                        }}
                        className="bg-slate-100 hover:bg-slate-200 text-slate-600 px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-bold transition-all active:scale-95"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => {
                          triggerHaptic('success');
                          handleSaveFulfill(req);
                        }}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-black transition-all active:scale-95 shadow-xs"
                      >
                        Save & Mark
                      </button>
                    </>
                  )}
                  {req.status === 'FULFILLED' && (
                    <button
                      onClick={() => {
                        triggerHaptic('light');
                        handleStatusChange(req.id!, 'PENDING');
                      }}
                      className="bg-slate-100 text-slate-600 border border-slate-200 px-3 py-1.5 rounded-xl text-xs sm:text-sm font-bold hover:bg-slate-200 transition-all active:scale-95"
                    >
                      Undo Fulfill
                    </button>
                  )}
                  {(req.status === 'FULFILLED' || req.status === 'PARTIALLY_FULFILLED') && (req.siteId || 'newrelic') === 'newrelic' && (
                    <button
                      onClick={() => {
                        triggerHaptic('medium');
                        handleCreateChallan(req);
                      }}
                      className="bg-indigo-50 border border-indigo-200 text-[#3b2fc9] hover:bg-indigo-100 px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-black transition-all flex items-center gap-1.5 active:scale-95 shadow-2xs"
                      title="Convert to Delivery Challan"
                    >
                      <FileText className="h-4 w-4" /> Create Challan
                    </button>
                  )}
                  <button
                    onClick={() => {
                      triggerHaptic('medium');
                      handleDelete(req.id!);
                    }}
                    className="text-slate-400 hover:text-rose-600 p-2 bg-slate-100 hover:bg-rose-50 rounded-xl transition-all active:scale-95"
                    title="Delete Request"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Mobile Line Items Cards (md:hidden) */}
              <div className="md:hidden divide-y divide-gray-100 p-3">
                {req.lineItems.map((item, idx) => {
                  const isFulfilling = activeFulfillId === req.id;
                  const fQty = isFulfilling 
                    ? (fulfillData[idx.toString()] ?? 0)
                    : (item.fulfilledQuantity ?? item.quantity);
                  const fUnits = item.orderType === 'cases' ? fQty * (item.caseSize || 1) : fQty;

                  return (
                    <div key={idx} className="py-2.5 first:pt-0 last:pb-0 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <span className="font-semibold text-gray-900 text-sm">{item.brandName}</span>
                          <span className="text-gray-500 text-xs block">{item.itemName}</span>
                        </div>
                        <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">
                          {item.orderType}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs bg-gray-50 p-2.5 rounded-lg">
                        <div>
                          <span className="text-[10px] text-gray-400 uppercase block font-semibold">Req Qty / Units</span>
                          <span className="font-medium text-gray-800">
                            {item.quantity} {item.orderType === 'cases' && `(${item.totalUnits} pcs)`}
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] text-gray-400 uppercase block font-semibold">Fulfilled</span>
                          {isFulfilling ? (
                            <div className="flex items-center justify-end gap-1 mt-1">
                              <input
                                type="number"
                                min="0"
                                value={fQty}
                                onChange={(e) => setFulfillData(prev => ({ ...prev, [idx]: Number(e.target.value) }))}
                                className="w-16 rounded border border-gray-300 px-1.5 py-1 text-xs text-right bg-white focus:border-[#3b2fc9] focus:outline-none"
                              />
                              <span className="text-[11px] font-bold text-[#3b2fc9]">({fUnits})</span>
                            </div>
                          ) : (
                            <span className="font-bold text-[#3b2fc9]">
                              {item.fulfilledQuantity ?? '-'} {item.fulfilledTotalUnits !== undefined && `(${item.fulfilledTotalUnits} pcs)`}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Desktop Line Items Table (hidden md:block) */}
              <div className="hidden md:block p-4 sm:p-6 overflow-x-auto">
                <table className="w-full text-sm text-left min-w-[620px]">
                  <thead className="bg-gray-50 border-b border-gray-200 text-gray-600 font-medium">
                    <tr>
                      <th className="px-4 py-2">Brand & Item</th>
                      <th className="px-4 py-2">Order Type</th>
                      <th className="px-4 py-2 text-right">Case Size</th>
                      <th className="px-4 py-2 text-right">Req. Qty</th>
                      <th className="px-4 py-2 text-right">Req. Units</th>
                      <th className="px-4 py-2 text-right text-[#3b2fc9]">Fulf. Qty</th>
                      <th className="px-4 py-2 text-right text-[#3b2fc9]">Fulf. Units</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {req.lineItems.map((item, idx) => {
                      const isFulfilling = activeFulfillId === req.id;
                      const fQty = isFulfilling 
                        ? (fulfillData[idx.toString()] ?? 0)
                        : (item.fulfilledQuantity ?? item.quantity); // Fallback to full for UI if not fulfilled yet
                      const fUnits = item.orderType === 'cases' ? fQty * item.caseSize : fQty;
                      
                      return (
                        <tr key={idx} className="hover:bg-gray-50">
                          <td className="px-4 py-2">
                            <span className="font-medium">{item.brandName}</span> - {item.itemName}
                          </td>
                          <td className="px-4 py-2 capitalize">{item.orderType}</td>
                          <td className="px-4 py-2 text-right text-gray-500">{item.caseSize || 1}</td>
                          <td className="px-4 py-2 text-right">{item.quantity}</td>
                          <td className="px-4 py-2 text-right font-semibold text-gray-900">{item.totalUnits}</td>
                          <td className="px-4 py-2 text-right">
                            {isFulfilling ? (
                              <input
                                type="number"
                                min="0"
                                value={fQty}
                                onChange={(e) => setFulfillData(prev => ({ ...prev, [idx]: Number(e.target.value) }))}
                                className="w-20 rounded border border-gray-300 px-2 py-1 text-sm text-right focus:border-[#3b2fc9] focus:outline-none focus:ring-1 focus:ring-[#3b2fc9]"
                              />
                            ) : (
                              <span className={item.fulfilledQuantity !== undefined && item.fulfilledQuantity < item.quantity ? "text-orange-500 font-bold" : ""}>
                                {item.fulfilledQuantity ?? '-'}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-2 text-right font-bold text-[#3b2fc9]">
                            {isFulfilling ? fUnits : (item.fulfilledTotalUnits ?? '-')}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
