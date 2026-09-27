'use client';

import React, { useEffect, useState } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { stockRequestSchema, StockRequestFormValues, StockRequestItemValues } from '@/types/stockRequest';
import { getCatalogItems } from '@/services/newrelicCatalogService';
import { getAllPricingItems } from '@/services/newrelicPricingService';
import { saveStockRequest, getStockRequests } from '@/services/newrelicStockRequestService';
import { CatalogItem, PricingItem } from '@/types/challan';
import { StockRequest } from '@/types/stockRequest';
import { Plus, Trash2, CheckCircle, PackageSearch, List, Copy, Pencil, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

export default function StockRequestPage() {
  const { role, user } = useAuth();
  const router = useRouter();

  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [pricing, setPricing] = useState<PricingItem[]>([]);
  const [myRequests, setMyRequests] = useState<StockRequest[]>([]);
  const [view, setView] = useState<'form' | 'history'>('form');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<StockRequestFormValues>({
    resolver: zodResolver(stockRequestSchema),
    defaultValues: {
      location: 'hyderabad',
      requestDate: new Date(),
      status: 'PENDING',
      lineItems: [{ brandName: '', itemName: '', orderType: 'cases', caseSize: 1, quantity: 1, totalUnits: 1 }],
      notes: '',
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'lineItems',
  });

  const selectedLocation = watch('location');
  const lineItems = watch('lineItems');

  useEffect(() => {
    if (!role) return;
    Promise.all([
      getCatalogItems(), 
      getAllPricingItems(),
      getStockRequests()
    ]).then(([cat, pri, reqs]) => {
      setCatalog(cat);
      setPricing(pri);
      
      // Filter requests created by this user
      const userIdentifier = user?.email || user?.id;
      setMyRequests(reqs.filter(r => r.createdBy === userIdentifier || r.createdBy === 'Unknown'));
    });
  }, [role, user?.email, user?.id, success]);

  // Derive unique brands for datalist
  const brands = Array.from(new Set(catalog.map(c => c.brandName))).sort();

  const handleEdit = (req: StockRequest) => {
    reset({
      id: req.id,
      location: req.location,
      requestDate: new Date(req.requestDate),
      status: req.status,
      notes: req.notes || '',
      lineItems: req.lineItems,
    });
    setView('form');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDuplicate = (req: StockRequest) => {
    reset({
      id: undefined, // Create as new
      location: req.location,
      requestDate: new Date(),
      status: 'PENDING',
      notes: req.notes || '',
      lineItems: req.lineItems.map(item => ({ ...item, id: undefined })),
    });
    setView('form');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const onSubmit = async (data: StockRequestFormValues) => {
    try {
      setIsSubmitting(true);
      
      const payload = {
        location: data.location,
        requestDate: data.requestDate.toISOString(),
        status: data.status,
        lineItems: data.lineItems,
        notes: data.notes,
        createdBy: user?.email || user?.id || 'Unknown',
      };
      
      await saveStockRequest(payload, data.id);
      setSuccess(true);
      reset({
        id: undefined,
        location: data.location,
        requestDate: new Date(),
        status: 'PENDING',
        lineItems: [{ brandName: '', itemName: '', orderType: 'cases', caseSize: 1, quantity: 1, totalUnits: 1 }],
        notes: '',
      });
      setTimeout(() => setSuccess(false), 5000);
    } catch (error) {
      console.error(error);
      alert('Failed to submit request');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!role) return null;

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <PackageSearch className="h-6 w-6 text-[#3b2fc9]" />
            Stock Requests
          </h1>
          <p className="text-gray-500 text-sm mt-1">Submit or track your stock requirements to the admin.</p>
        </div>
        <div className="flex bg-gray-100 p-1 rounded-lg">
          <button
            onClick={() => setView('form')}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors",
              view === 'form' ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
            )}
          >
            <Plus className="h-4 w-4" /> New Request
          </button>
          <button
            onClick={() => setView('history')}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors",
              view === 'history' ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
            )}
          >
            <List className="h-4 w-4" /> My Requests
          </button>
        </div>
      </div>

      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg flex items-center gap-2">
          <CheckCircle className="h-5 w-5" />
          Stock Request submitted successfully! The admin will review it shortly.
        </div>
      )}

      {view === 'form' && (
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
        
        {/* Header Information */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-6 border-b border-gray-100">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
            <select
              {...register('location')}
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-[#3b2fc9] focus:ring-[#3b2fc9] p-2 border"
            >
              <option value="hyderabad">Hyderabad</option>
              <option value="bangalore">Bangalore</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Additional Notes</label>
            <input
              type="text"
              {...register('notes')}
              placeholder="e.g. Urgent requirement for weekend..."
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-[#3b2fc9] focus:ring-[#3b2fc9] p-2 border"
            />
          </div>
        </div>

        {/* Line Items */}
        <div className="space-y-4">
          <h3 className="text-lg font-medium text-gray-900">Requested Items</h3>
          
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-50 border-y border-gray-200 text-gray-600 font-medium">
                <tr>
                  <th className="px-3 py-2 w-[200px]">Brand</th>
                  <th className="px-3 py-2 w-[250px]">Item</th>
                  <th className="px-3 py-2 w-[120px]">Order Type</th>
                  <th className="px-3 py-2 w-[100px]">Case Size</th>
                  <th className="px-3 py-2 w-[120px]">Quantity</th>
                  <th className="px-3 py-2 w-[120px]">Total Units</th>
                  <th className="px-3 py-2 w-[100px]">Ref MRP</th>
                  <th className="px-3 py-2 w-[50px]"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {fields.map((field, index) => {
                  const currentBrand = lineItems[index]?.brandName || '';
                  const currentItem = lineItems[index]?.itemName || '';
                  const orderType = lineItems[index]?.orderType || 'cases';
                  const caseSize = lineItems[index]?.caseSize || 1;
                  const qty = lineItems[index]?.quantity || 0;
                  const mrp = lineItems[index]?.mrp;
                  
                  // Allowed items for the current brand
                  const allowedItems = catalog.filter(c => c.brandName === currentBrand).map(c => c.itemName).sort();

                  return (
                    <tr key={field.id} className="hover:bg-gray-50/50">
                      <td className="px-2 py-2">
                        <input
                          list={`brands-${index}`}
                          {...register(`lineItems.${index}.brandName` as const)}
                          autoComplete="off"
                          onFocus={(e) => e.target.select()}
                          onChange={(e) => {
                            // Let react-hook-form handle the onChange first, but we also want to reset the item name
                            setValue(`lineItems.${index}.brandName`, e.target.value);
                            setValue(`lineItems.${index}.itemName`, '');
                            setValue(`lineItems.${index}.caseSize`, 1);
                            setValue(`lineItems.${index}.mrp`, 0);
                            setValue(`lineItems.${index}.quantity`, 1);
                            setValue(`lineItems.${index}.totalUnits`, 1);
                          }}
                          className={cn(
                            "w-full rounded border px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-[#3b2fc9]",
                            errors.lineItems?.[index]?.brandName ? "border-red-500" : "border-gray-300"
                          )}
                          placeholder="Select Brand"
                        />
                        <datalist id={`brands-${index}`}>
                          {brands.map(b => <option key={b} value={b} />)}
                        </datalist>
                      </td>
                      <td className="px-2 py-2">
                        <input
                          list={`items-${index}`}
                          {...register(`lineItems.${index}.itemName` as const)}
                          autoComplete="off"
                          onFocus={(e) => e.target.select()}
                          onChange={(e) => {
                            const val = e.target.value;
                            setValue(`lineItems.${index}.itemName`, val);
                            
                            // Auto-populate caseSize from catalog
                            const catMatch = catalog.find(c => c.brandName === currentBrand && c.itemName === val);
                            if (catMatch && catMatch.caseSize) {
                              setValue(`lineItems.${index}.caseSize`, catMatch.caseSize);
                              if (orderType === 'cases') {
                                setValue(`lineItems.${index}.totalUnits`, (lineItems[index]?.quantity || 1) * catMatch.caseSize);
                              }
                            }
                            
                            // Auto-populate MRP from pricing
                            const priceMatch = pricing.find(p => p.location === selectedLocation && p.brandName === currentBrand && p.itemName === val);
                            if (priceMatch && priceMatch.mrp) {
                              setValue(`lineItems.${index}.mrp`, priceMatch.mrp);
                            } else if (catMatch && catMatch.mrp) {
                              setValue(`lineItems.${index}.mrp`, catMatch.mrp); // Fallback to catalog ref mrp
                            }
                          }}
                          className={cn(
                            "w-full rounded border px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-[#3b2fc9]",
                            errors.lineItems?.[index]?.itemName ? "border-red-500" : "border-gray-300"
                          )}
                          placeholder="Select Item"
                        />
                        <datalist id={`items-${index}`}>
                          {allowedItems.map(i => <option key={i} value={i} />)}
                        </datalist>
                      </td>
                      <td className="px-2 py-2">
                        <select
                          {...register(`lineItems.${index}.orderType` as const)}
                          onChange={(e) => {
                            const val = e.target.value as 'cases' | 'units';
                            setValue(`lineItems.${index}.orderType`, val);
                            setValue(`lineItems.${index}.totalUnits`, val === 'cases' ? qty * caseSize : qty);
                          }}
                          className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-[#3b2fc9]"
                        >
                          <option value="cases">Cases</option>
                          <option value="units">Units</option>
                        </select>
                      </td>
                      <td className="px-2 py-2">
                        <input
                          type="number"
                          {...register(`lineItems.${index}.caseSize` as const)}
                          readOnly
                          className="w-full rounded border border-gray-300 bg-gray-50 px-2 py-1.5 text-sm text-gray-500 cursor-not-allowed"
                        />
                      </td>
                      <td className="px-2 py-2">
                        <input
                          type="number"
                          min="1"
                          {...register(`lineItems.${index}.quantity` as const)}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            setValue(`lineItems.${index}.quantity`, val);
                            setValue(`lineItems.${index}.totalUnits`, orderType === 'cases' ? val * caseSize : val);
                          }}
                          className={cn(
                            "w-full rounded border px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-[#3b2fc9]",
                            errors.lineItems?.[index]?.quantity ? "border-red-500" : "border-gray-300"
                          )}
                        />
                      </td>
                      <td className="px-2 py-2">
                        <input
                          type="number"
                          value={lineItems[index]?.totalUnits || 0}
                          readOnly
                          className="w-full rounded border border-transparent bg-transparent px-2 py-1.5 text-sm font-medium text-gray-900"
                        />
                      </td>
                      <td className="px-2 py-2 text-gray-500">
                        {mrp ? `₹${mrp}` : '-'}
                      </td>
                      <td className="px-2 py-2 text-right">
                        <button
                          type="button"
                          onClick={() => remove(index)}
                          className="text-red-400 hover:text-red-600 p-1"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          
          <button
            type="button"
            onClick={() => append({ brandName: '', itemName: '', orderType: 'cases', caseSize: 1, quantity: 1, totalUnits: 1 })}
            className="flex items-center gap-1.5 text-sm text-[#3b2fc9] font-medium hover:text-[#2f25a8] px-2"
          >
            <Plus className="h-4 w-4" /> Add Row
          </button>
        </div>

        {errors.lineItems?.root && (
          <p className="text-red-500 text-sm">{errors.lineItems.root.message}</p>
        )}

        <div className="pt-4 flex justify-end">
          <button
            type="submit"
            disabled={isSubmitting || fields.length === 0}
            className="bg-[#3b2fc9] text-white px-6 py-2.5 rounded-lg font-medium hover:bg-[#2f25a8] disabled:opacity-50 transition-colors shadow-sm"
          >
            {isSubmitting ? 'Submitting...' : watch('id') ? 'Update Request' : 'Submit Request'}
          </button>
        </div>
      </form>
      )}

      {view === 'history' && (
        <div className="space-y-4">
          {myRequests.length === 0 ? (
            <div className="text-center py-12 text-gray-500 bg-white rounded-xl border border-gray-200 border-dashed">
              You haven't submitted any stock requests yet.
            </div>
          ) : (
            myRequests.map(req => (
              <div key={req.id} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="bg-gray-50 px-6 py-4 border-b border-gray-200 flex flex-wrap justify-between items-center gap-4">
                  <div className="flex flex-wrap items-center gap-4 text-sm">
                    <span className="font-medium text-gray-900">{format(new Date(req.requestDate), 'dd MMM yyyy, hh:mm a')}</span>
                    <span className="capitalize text-gray-600">{req.location}</span>
                    <div className="flex items-center gap-1.5">
                      {req.status === 'PENDING' && <span className="bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded text-xs font-semibold flex items-center gap-1"><Clock className="h-3 w-3"/> PENDING</span>}
                      {req.status === 'FULFILLED' && <span className="bg-green-100 text-green-800 px-2 py-0.5 rounded text-xs font-semibold flex items-center gap-1"><CheckCircle className="h-3 w-3"/> FULFILLED</span>}
                      {req.status === 'CANCELLED' && <span className="bg-red-100 text-red-800 px-2 py-0.5 rounded text-xs font-semibold flex items-center gap-1"><Trash2 className="h-3 w-3"/> CANCELLED</span>}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {req.status === 'PENDING' && (
                      <button
                        onClick={() => handleEdit(req)}
                        className="text-gray-500 hover:text-[#3b2fc9] bg-white border border-gray-200 hover:border-[#3b2fc9] px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5"
                      >
                        <Pencil className="h-3.5 w-3.5" /> Edit
                      </button>
                    )}
                    <button
                      onClick={() => handleDuplicate(req)}
                      className="text-gray-500 hover:text-[#3b2fc9] bg-white border border-gray-200 hover:border-[#3b2fc9] px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5"
                    >
                      <Copy className="h-3.5 w-3.5" /> Duplicate
                    </button>
                  </div>
                </div>

                <div className="p-4 sm:p-6 overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="text-gray-500 font-medium border-b border-gray-100">
                      <tr>
                        <th className="pb-2 pr-4">Item</th>
                        <th className="pb-2 pr-4">Order Type</th>
                        <th className="pb-2 pr-4 text-right">Quantity</th>
                        <th className="pb-2 pr-4 text-right">Total Units</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {req.lineItems.map((item, idx) => (
                        <tr key={idx}>
                          <td className="py-2 pr-4"><span className="font-medium text-gray-900">{item.brandName}</span> - {item.itemName}</td>
                          <td className="py-2 pr-4 capitalize text-gray-600">{item.orderType}</td>
                          <td className="py-2 pr-4 text-right text-gray-900">{item.quantity} {item.orderType === 'cases' && <span className="text-gray-400 text-xs">(x{item.caseSize})</span>}</td>
                          <td className="py-2 pr-4 text-right font-medium text-[#3b2fc9]">{item.totalUnits}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
