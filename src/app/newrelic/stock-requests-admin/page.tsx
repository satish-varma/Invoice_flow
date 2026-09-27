'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { getStockRequests, updateStockRequestStatus, deleteStockRequest, updateStockRequestFulfillment } from '@/services/newrelicStockRequestService';
import { StockRequest } from '@/types/stockRequest';
import { Check, Download, Trash2, MapPin, Calendar, Clock, CheckCircle, User, FileText } from 'lucide-react';
import { format } from 'date-fns';
import { useRouter } from 'next/navigation';

export default function StockRequestsAdminPage() {
  const { role } = useAuth();
  const router = useRouter();
  const [requests, setRequests] = useState<StockRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filterLocation, setFilterLocation] = useState<'all' | 'hyderabad' | 'bangalore'>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'PENDING' | 'PARTIALLY_FULFILLED' | 'FULFILLED' | 'CANCELLED'>('PENDING');
  const [activeFulfillId, setActiveFulfillId] = useState<string | null>(null);
  const [fulfillData, setFulfillData] = useState<{ [itemId: string]: number }>({});

  useEffect(() => {
    if (role === 'admin') {
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
    if (!confirm(`Mark this request as ${status}?`)) return;
    try {
      await updateStockRequestStatus(id, status);
      setRequests(prev => prev.map(r => r.id === id ? { ...r, status } : r));
    } catch (e) {
      alert('Failed to update status');
    }
  };

  const handleDelete = async (id: string) => {
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
      if (filterLocation !== 'all' && r.location !== filterLocation) return false;
      if (filterStatus !== 'all' && r.status !== filterStatus) return false;
      return true;
    });

    if (filtered.length === 0) {
      alert('No data to export based on current filters.');
      return;
    }

    const headers = ['Request Date', 'Requested By', 'Location', 'Status', 'Brand Name', 'Item Name', 'Order Type', 'Case Size', 'Quantity', 'Total Units', 'Reference MRP', 'Fulfilled Qty', 'Fulfilled Units'];
    const rows: string[][] = [];

    filtered.forEach(req => {
      const date = format(new Date(req.requestDate), 'dd MMM yyyy');
      req.lineItems.forEach(item => {
        rows.push([
          date,
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
    link.setAttribute('download', `stock_requests_${filterLocation}_${filterStatus}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!role || role !== 'admin') return null;

  const filteredRequests = requests.filter(r => {
    if (filterLocation !== 'all' && r.location !== filterLocation) return false;
    if (filterStatus !== 'all' && r.status !== filterStatus) return false;
    return true;
  });

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Stock Requests (Admin)</h1>
          <p className="text-gray-500 text-sm mt-1">Review and fulfill stock requirements from location managers.</p>
        </div>
        <button
          onClick={handleExport}
          className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-green-700 transition-colors"
        >
          <Download className="h-4 w-4" /> Export CSV
        </button>
      </div>

      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-wrap gap-4">
        <select
          value={filterLocation}
          onChange={(e) => setFilterLocation(e.target.value as any)}
          className="rounded border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-[#3b2fc9]"
        >
          <option value="all">All Locations</option>
          <option value="hyderabad">Hyderabad</option>
          <option value="bangalore">Bangalore</option>
        </select>
        
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value as any)}
          className="rounded border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-[#3b2fc9]"
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
            <div key={req.id} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="bg-gray-50 px-6 py-4 border-b border-gray-200 flex flex-wrap justify-between items-center gap-4">
                <div className="flex flex-wrap items-center gap-4 text-sm">
                  <div className="flex items-center gap-1.5 text-gray-600">
                    <Calendar className="h-4 w-4" />
                    <span className="font-medium text-gray-900">{format(new Date(req.requestDate), 'dd MMM yyyy, hh:mm a')}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-gray-600">
                    <User className="h-4 w-4" />
                    <span>{req.createdBy}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-gray-600">
                    <MapPin className="h-4 w-4" />
                    <span className="capitalize">{req.location}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {req.status === 'PENDING' && <span className="bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded text-xs font-semibold flex items-center gap-1"><Clock className="h-3 w-3"/> PENDING</span>}
                    {req.status === 'PARTIALLY_FULFILLED' && <span className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded text-xs font-semibold flex items-center gap-1"><CheckCircle className="h-3 w-3"/> PARTIAL</span>}
                    {req.status === 'FULFILLED' && <span className="bg-green-100 text-green-800 px-2 py-0.5 rounded text-xs font-semibold flex items-center gap-1"><CheckCircle className="h-3 w-3"/> FULFILLED</span>}
                    {req.status === 'CANCELLED' && <span className="bg-red-100 text-red-800 px-2 py-0.5 rounded text-xs font-semibold flex items-center gap-1"><Trash2 className="h-3 w-3"/> CANCELLED</span>}
                  </div>
                  {req.notes && (
                    <div className="text-gray-500 italic">" {req.notes} "</div>
                  )}
                </div>
                
                <div className="flex items-center gap-2">
                  {(req.status === 'PENDING' || req.status === 'PARTIALLY_FULFILLED') && activeFulfillId !== req.id && (
                    <button
                      onClick={() => handleStartFulfill(req)}
                      className="bg-[#3b2fc9] text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-[#2f25a8] transition-colors flex items-center gap-1"
                    >
                      <Check className="h-4 w-4" /> Fulfill
                    </button>
                  )}
                  {activeFulfillId === req.id && (
                    <>
                      <button
                        onClick={() => setActiveFulfillId(null)}
                        className="bg-gray-100 text-gray-600 px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => handleSaveFulfill(req)}
                        className="bg-green-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-green-700 transition-colors"
                      >
                        Save & Mark
                      </button>
                    </>
                  )}
                  {req.status === 'FULFILLED' && (
                    <button
                      onClick={() => handleStatusChange(req.id!, 'PENDING')}
                      className="bg-gray-100 text-gray-600 border border-gray-200 px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors"
                    >
                      Undo Fulfill
                    </button>
                  )}
                  {(req.status === 'FULFILLED' || req.status === 'PARTIALLY_FULFILLED') && (
                    <button
                      onClick={() => handleCreateChallan(req)}
                      className="bg-blue-100 text-blue-700 px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-blue-200 transition-colors flex items-center gap-1"
                      title="Convert to Delivery Challan"
                    >
                      <FileText className="h-4 w-4" /> Create Challan
                    </button>
                  )}
                  <button
                    onClick={() => handleDelete(req.id!)}
                    className="text-gray-400 hover:text-red-600 p-1.5 bg-gray-100 hover:bg-red-50 rounded-lg transition-colors"
                    title="Delete Request"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="p-6">
                <table className="w-full text-sm text-left">
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
