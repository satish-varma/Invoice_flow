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
import { SiteId, SITE_OPTIONS, COMPANY_SITES, resolveSiteId } from '@/types/site';
import { Plus, Minus, Trash2, CheckCircle, PackageSearch, List, Copy, Pencil, Clock, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { triggerHaptic } from '@/lib/haptics';

export default function StockRequestPage() {
  const { role, user } = useAuth();
  const router = useRouter();

  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [pricing, setPricing] = useState<PricingItem[]>([]);
  const [myRequests, setMyRequests] = useState<StockRequest[]>([]);
  const [view, setView] = useState<'form' | 'history'>('history');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const isAdmin = role === 'admin' || role === 'superadmin';
  const [adminSite, setAdminSite] = useState<SiteId>(() => {
    return user?.assignedSite ? resolveSiteId(user.assignedSite) : 'newrelic';
  });

  const activeSite = isAdmin ? adminSite : (user?.assignedSite ? resolveSiteId(user.assignedSite) : 'newrelic');
  const isHydOnlySite = activeSite === 'dsm' || activeSite === 'ntt_data';

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

  const handleSiteChange = (newSite: SiteId) => {
    setAdminSite(newSite);
    if (newSite === 'dsm' || newSite === 'ntt_data') {
      setValue('location', 'hyderabad');
    }
  };

  useEffect(() => {
    if (!role) return;
    Promise.all([
      getCatalogItems(activeSite), 
      getAllPricingItems(),
      getStockRequests(undefined, isAdmin ? undefined : activeSite)
    ]).then(([cat, pri, reqs]) => {
      setCatalog(cat);
      setPricing(pri);
      
      // Filter requests created by this user (or show all for admin)
      const userIdentifier = user?.email || user?.id;
      if (isAdmin) {
        setMyRequests(reqs);
      } else {
        setMyRequests(reqs.filter(r => r.createdBy === userIdentifier || r.createdBy === 'Unknown'));
      }
    });
  }, [role, user?.email, user?.id, success, activeSite, isAdmin]);

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
    setView('form');
    window.scrollTo({ top: 0, behavior: 'smooth' });
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

  const onSubmit = async (data: StockRequestFormValues) => {
    try {
      setIsSubmitting(true);
      
      const payload = JSON.parse(JSON.stringify({
        siteId: activeSite,
        location: isHydOnlySite ? 'hyderabad' : data.location,
        requestDate: data.requestDate.toISOString(),
        status: data.status,
        lineItems: data.lineItems,
        notes: data.notes,
        createdBy: user?.email || user?.id || 'Unknown',
      }));
      
      await saveStockRequest(payload, data.id);
      triggerHaptic('success');
      setSuccess(true);
      reset({
        id: undefined,
        location: isHydOnlySite ? 'hyderabad' : data.location,
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
          {isAdmin && (
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Company Site</label>
              <select
                value={adminSite}
                onChange={(e) => handleSiteChange(e.target.value as SiteId)}
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-[#3b2fc9] focus:ring-[#3b2fc9] p-2 border bg-white font-medium"
              >
                {SITE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label} ({COMPANY_SITES[opt.value]?.name || opt.value})
                  </option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
            <select
              {...register('location')}
              disabled={isHydOnlySite}
              className={`w-full rounded-md border-gray-300 shadow-sm focus:border-[#3b2fc9] focus:ring-[#3b2fc9] p-2 border ${isHydOnlySite ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : ''}`}
            >
              <option value="hyderabad">Hyderabad</option>
              {!isHydOnlySite && <option value="bangalore">Bangalore</option>}
            </select>
            {isHydOnlySite && (
              <span className="text-[10px] text-amber-600 mt-1 block">
                📍 Locked to Hyderabad for {COMPANY_SITES[activeSite]?.name || activeSite}
              </span>
            )}
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
          
          <div className="hidden md:grid grid-cols-12 gap-2 bg-gray-50 px-3 py-2 text-sm font-medium text-gray-600 rounded-t-lg border border-gray-200">
            <div className="col-span-2">Brand</div>
            <div className="col-span-3">Item</div>
            <div className="col-span-2">Order Type</div>
            <div className="col-span-1">Case Size</div>
            <div className="col-span-2">Quantity</div>
            <div className="col-span-1">Total Units</div>
            <div className="col-span-1"></div>
          </div>
          
          <div className="space-y-4 md:space-y-0 md:border-x md:border-b md:border-gray-200 md:rounded-b-lg md:divide-y md:divide-gray-100">
            {fields.map((field, index) => {
              const currentBrand = lineItems[index]?.brandName || '';
              const currentItem = lineItems[index]?.itemName || '';
              const orderType = lineItems[index]?.orderType || 'cases';
              const caseSize = lineItems[index]?.caseSize || 1;
              const qty = lineItems[index]?.quantity || 0;
              const mrp = lineItems[index]?.mrp;
              const procurementCost = lineItems[index]?.procurementCost;
              
              // Allowed items for the current brand
              const allowedItems = catalog.filter(c => c.brandName === currentBrand).map(c => c.itemName).sort();

              return (
                <div key={field.id} className="relative grid grid-cols-1 md:grid-cols-12 gap-3 md:gap-2 p-4 md:p-2 bg-gray-50/50 md:bg-white border md:border-0 border-gray-200 rounded-xl md:rounded-none shadow-sm md:shadow-none hover:bg-gray-50 items-center">
                  
                  {/* Mobile Only: Row Header & Delete */}
                  <div className="flex items-center justify-between md:hidden mb-2 pb-2 border-b border-gray-200">
                    <span className="font-semibold text-gray-700 text-sm">Item #{index + 1}</span>
                    <button
                      type="button"
                      onClick={() => remove(index)}
                      className="text-red-500 hover:text-red-700 p-1 bg-red-50 rounded-md"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>

                  {/* Brand */}
                  <div className="md:col-span-2">
                    <label className="text-xs font-medium text-gray-500 mb-1 block md:hidden">Brand</label>
                    <input type="hidden" {...register(`lineItems.${index}.mrp` as const)} />
                    <input type="hidden" {...register(`lineItems.${index}.procurementCost` as const)} />
                    <input
                      list={`brands-${index}`}
                      {...register(`lineItems.${index}.brandName` as const)}
                      autoComplete="off"
                      onFocus={(e) => e.target.select()}
                      onChange={(e) => {
                        setValue(`lineItems.${index}.brandName`, e.target.value);
                        setValue(`lineItems.${index}.itemName`, '');
                        setValue(`lineItems.${index}.caseSize`, 1);
                        setValue(`lineItems.${index}.mrp`, 0);
                        setValue(`lineItems.${index}.procurementCost`, 0);
                        setValue(`lineItems.${index}.quantity`, 1);
                        setValue(`lineItems.${index}.totalUnits`, 1);
                      }}
                      className={cn(
                        "w-full rounded-lg md:rounded border px-3 md:px-2 py-2 md:py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#3b2fc9]/50",
                        errors.lineItems?.[index]?.brandName ? "border-red-500" : "border-gray-300 bg-white"
                      )}
                      placeholder="Select Brand"
                    />
                    <datalist id={`brands-${index}`}>
                      {brands.map(b => <option key={b} value={b} />)}
                    </datalist>
                  </div>

                  {/* Item Name */}
                  <div className="md:col-span-3">
                    <label className="text-xs font-medium text-gray-500 mb-1 block md:hidden">Item</label>
                    <input
                      list={`items-${index}`}
                      {...register(`lineItems.${index}.itemName` as const)}
                      autoComplete="off"
                      onFocus={(e) => e.target.select()}
                      onChange={(e) => {
                        const val = e.target.value;
                        setValue(`lineItems.${index}.itemName`, val);
                        
                        const catMatch = catalog.find(c => c.brandName === currentBrand && c.itemName === val);
                        if (catMatch && catMatch.caseSize) {
                          setValue(`lineItems.${index}.caseSize`, catMatch.caseSize);
                          if (orderType === 'cases') {
                            setValue(`lineItems.${index}.totalUnits`, (lineItems[index]?.quantity || 1) * catMatch.caseSize);
                          }
                        }
                        
                        const priceMatch = pricing.find(p => p.location === selectedLocation && p.brandName === currentBrand && p.itemName === val);
                        if (priceMatch) {
                          if (priceMatch.mrp) setValue(`lineItems.${index}.mrp`, priceMatch.mrp);
                          if (priceMatch.purchaseCost) setValue(`lineItems.${index}.procurementCost`, priceMatch.purchaseCost);
                        } else if (catMatch && catMatch.mrp) {
                          setValue(`lineItems.${index}.mrp`, catMatch.mrp);
                          setValue(`lineItems.${index}.procurementCost`, 0);
                        }
                      }}
                      className={cn(
                        "w-full rounded-lg md:rounded border px-3 md:px-2 py-2 md:py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#3b2fc9]/50",
                        errors.lineItems?.[index]?.itemName ? "border-red-500" : "border-gray-300 bg-white"
                      )}
                      placeholder="Select Item"
                    />
                    <datalist id={`items-${index}`}>
                      {allowedItems.map(i => <option key={i} value={i} />)}
                    </datalist>
                  </div>

                  {/* Order Type & Case Size Container on Mobile */}
                  <div className="grid grid-cols-2 gap-3 md:contents">
                    <div className="md:col-span-2">
                      <label className="text-xs font-medium text-gray-500 mb-1 block md:hidden">Order Type</label>
                      <select
                        {...register(`lineItems.${index}.orderType` as const)}
                        onChange={(e) => {
                          const val = e.target.value as 'cases' | 'units';
                          setValue(`lineItems.${index}.orderType`, val);
                          setValue(`lineItems.${index}.totalUnits`, val === 'cases' ? qty * caseSize : qty);
                        }}
                        className="w-full rounded-lg md:rounded border border-gray-300 bg-white px-3 md:px-2 py-2 md:py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#3b2fc9]/50"
                      >
                        <option value="cases">Cases</option>
                        <option value="units">Units</option>
                      </select>
                    </div>

                    <div className="md:col-span-1">
                      <label className="text-xs font-medium text-gray-500 mb-1 block md:hidden">Case Size</label>
                      <input
                        type="number"
                        {...register(`lineItems.${index}.caseSize` as const)}
                        readOnly
                        className="w-full rounded-lg md:rounded border border-gray-200 bg-gray-100/80 px-3 md:px-2 py-2 md:py-1.5 text-sm text-gray-500 cursor-not-allowed"
                      />
                    </div>
                  </div>

                  {/* Quantity & Total Container on Mobile */}
                  <div className="grid grid-cols-2 gap-3 md:contents items-center">
                    <div className="md:col-span-2">
                      <label className="text-xs font-medium text-gray-500 mb-1 block md:hidden">Quantity</label>
                      <div className={cn(
                        "flex items-center border rounded-lg md:rounded bg-white overflow-hidden shadow-2xs focus-within:ring-2 focus-within:ring-[#3b2fc9]/30 focus-within:border-[#3b2fc9] transition-all",
                        errors.lineItems?.[index]?.quantity ? "border-red-500" : "border-gray-300"
                      )}>
                        <button
                          type="button"
                          onClick={() => {
                            const cur = Number(lineItems[index]?.quantity) || 1;
                            const next = Math.max(1, cur - 1);
                            triggerHaptic('light');
                            setValue(`lineItems.${index}.quantity`, next, { shouldValidate: true });
                            setValue(`lineItems.${index}.totalUnits`, orderType === 'cases' ? next * caseSize : next);
                          }}
                          disabled={(lineItems[index]?.quantity || 1) <= 1}
                          className="px-3 md:px-2 py-2 md:py-1.5 text-gray-500 hover:text-gray-900 hover:bg-gray-100 active:bg-gray-200 transition-colors shrink-0 disabled:opacity-25 disabled:pointer-events-none"
                          aria-label="Decrease quantity"
                        >
                          <Minus className="h-3.5 w-3.5" />
                        </button>
                        <input
                          type="number"
                          min="1"
                          {...register(`lineItems.${index}.quantity` as const, { valueAsNumber: true })}
                          onChange={(e) => {
                            const val = Math.max(1, Number(e.target.value) || 1);
                            setValue(`lineItems.${index}.quantity`, val);
                            setValue(`lineItems.${index}.totalUnits`, orderType === 'cases' ? val * caseSize : val);
                          }}
                          className="w-full text-center border-0 bg-transparent py-2 md:py-1.5 text-sm font-bold text-gray-800 focus:outline-none focus:ring-0 min-w-0"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const cur = Number(lineItems[index]?.quantity) || 1;
                            const next = cur + 1;
                            triggerHaptic('light');
                            setValue(`lineItems.${index}.quantity`, next, { shouldValidate: true });
                            setValue(`lineItems.${index}.totalUnits`, orderType === 'cases' ? next * caseSize : next);
                          }}
                          className="px-3 md:px-2 py-2 md:py-1.5 text-gray-500 hover:text-gray-900 hover:bg-gray-100 active:bg-gray-200 transition-colors shrink-0"
                          aria-label="Increase quantity"
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="md:col-span-1">
                      <label className="text-xs font-medium text-gray-500 mb-1 block md:hidden">Total Units</label>
                      <div className="flex items-center h-10 md:h-auto px-3 md:px-2 bg-gray-100/80 md:bg-transparent rounded-lg md:rounded">
                        <span className="text-sm font-bold text-gray-900">
                          {lineItems[index]?.totalUnits || 0}
                        </span>
                        <span className="text-[11px] text-gray-500 ml-1.5 md:hidden font-medium">units</span>
                      </div>
                    </div>
                  </div>

                  {/* Delete Button - Desktop Only */}
                  <div className="hidden md:flex md:col-span-1 justify-end">
                    <button
                      type="button"
                      onClick={() => remove(index)}
                      className="text-gray-400 hover:text-red-600 p-1.5 rounded-md hover:bg-red-50 transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  
                </div>
              );
            })}
          </div>
          
          <div className="flex flex-wrap items-center gap-4">
            <button
              type="button"
              onClick={() => append({ brandName: '', itemName: '', orderType: 'cases', caseSize: 1, quantity: 1, totalUnits: 1 })}
              className="flex items-center gap-1.5 text-sm text-[#3b2fc9] font-medium hover:text-[#2f25a8] px-2"
            >
              <Plus className="h-4 w-4" /> Add Row
            </button>
            <button
              type="button"
              onClick={() => append(Array(2).fill({ brandName: '', itemName: '', orderType: 'cases', caseSize: 1, quantity: 1, totalUnits: 1 }))}
              className="text-sm text-gray-500 font-medium hover:text-[#3b2fc9] px-2"
            >
              +2 Rows
            </button>
            <button
              type="button"
              onClick={() => append(Array(3).fill({ brandName: '', itemName: '', orderType: 'cases', caseSize: 1, quantity: 1, totalUnits: 1 }))}
              className="text-sm text-gray-500 font-medium hover:text-[#3b2fc9] px-2"
            >
              +3 Rows
            </button>
            <button
              type="button"
              onClick={() => append(Array(5).fill({ brandName: '', itemName: '', orderType: 'cases', caseSize: 1, quantity: 1, totalUnits: 1 }))}
              className="text-sm text-gray-500 font-medium hover:text-[#3b2fc9] px-2"
            >
              +5 Rows
            </button>
          </div>
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
                <div className="bg-gray-50 px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs sm:text-sm">
                    <span className="font-medium text-gray-900">{format(new Date(req.requestDate), 'dd MMM yyyy, hh:mm a')}</span>
                    <span className="capitalize text-gray-600 font-medium">{req.location}</span>
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
                          <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                          </span>
                          <CheckCircle className="h-3 w-3 text-emerald-600"/> FULFILLED
                        </span>
                      )}
                      {req.status === 'CANCELLED' && (
                        <span className="bg-gradient-to-r from-rose-500/15 to-red-500/15 text-rose-950 border border-rose-400/60 px-2.5 py-0.5 rounded-full text-xs font-black flex items-center gap-1 shadow-2xs">
                          <Trash2 className="h-3 w-3 text-rose-600"/> CANCELLED
                        </span>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                    {req.status === 'PENDING' && (
                      <button
                        onClick={() => handleEdit(req)}
                        className="text-gray-500 hover:text-[#3b2fc9] bg-white border border-gray-200 hover:border-[#3b2fc9] px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-colors flex items-center gap-1.5"
                      >
                        <Pencil className="h-3.5 w-3.5" /> Edit
                      </button>
                    )}
                    <button
                      onClick={() => handleDuplicate(req)}
                      className="text-gray-500 hover:text-[#3b2fc9] bg-white border border-gray-200 hover:border-[#3b2fc9] px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-colors flex items-center gap-1.5"
                    >
                      <Copy className="h-3.5 w-3.5" /> Duplicate
                    </button>
                    {(req.status === 'FULFILLED' || req.status === 'PARTIALLY_FULFILLED') && (
                      <button
                        onClick={() => handleCreateChallan(req)}
                        className="bg-blue-100 text-blue-700 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium hover:bg-blue-200 transition-colors flex items-center gap-1.5"
                        title="Convert to Delivery Challan"
                      >
                        <FileText className="h-3.5 w-3.5" /> Create Challan
                      </button>
                    )}
                  </div>
                </div>

                {/* Mobile Line Items Cards (md:hidden) */}
                <div className="md:hidden divide-y divide-gray-100 p-3">
                  {req.lineItems.map((item, idx) => (
                    <div key={idx} className="py-2.5 first:pt-0 last:pb-0 space-y-1.5">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <span className="font-semibold text-gray-900 text-sm">{item.brandName}</span>
                          <span className="text-gray-500 text-xs block">{item.itemName}</span>
                        </div>
                        <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">
                          {item.orderType}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs bg-gray-50 p-2 rounded-lg">
                        <div>
                          <span className="text-[10px] text-gray-400 uppercase block font-semibold">Requested</span>
                          <span className="font-bold text-gray-800 tabular-nums">
                            {item.quantity} {item.orderType === 'cases' && `(${item.totalUnits} pcs)`}
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] text-gray-400 uppercase block font-semibold">Fulfilled</span>
                          <span className="font-black text-[#3b2fc9] tabular-nums">
                            {item.fulfilledQuantity !== undefined ? `${item.fulfilledQuantity} (${item.fulfilledTotalUnits ?? 0} pcs)` : '-'}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Desktop Line Items Table (hidden md:block) */}
                <div className="hidden md:block p-4 sm:p-6 overflow-x-auto">
                  <table className="w-full text-sm text-left min-w-[540px]">
                    <thead className="text-gray-500 font-medium border-b border-gray-100">
                      <tr>
                        <th className="pb-2 pr-4 min-w-[160px]">Item</th>
                        <th className="pb-2 pr-4">Order Type</th>
                        <th className="pb-2 pr-4 text-right">Req. Qty</th>
                        <th className="pb-2 pr-4 text-right">Req. Units</th>
                        <th className="pb-2 pr-4 text-right text-[#3b2fc9]">Fulf. Qty</th>
                        <th className="pb-2 pr-4 text-right text-[#3b2fc9]">Fulf. Units</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {req.lineItems.map((item, idx) => (
                        <tr key={idx}>
                          <td className="py-2 pr-4"><span className="font-medium text-gray-900">{item.brandName}</span> - {item.itemName}</td>
                          <td className="py-2 pr-4 capitalize text-gray-600">{item.orderType}</td>
                          <td className="py-2 pr-4 text-right text-gray-900">{item.quantity} {item.orderType === 'cases' && <span className="text-gray-400 text-xs">(x{item.caseSize})</span>}</td>
                          <td className="py-2 pr-4 text-right font-medium text-gray-900">{item.totalUnits}</td>
                          <td className="py-2 pr-4 text-right font-medium text-[#3b2fc9]">
                            {item.fulfilledQuantity ?? '-'}
                          </td>
                          <td className="py-2 pr-4 text-right font-medium text-[#3b2fc9]">
                            {item.fulfilledTotalUnits ?? '-'}
                          </td>
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
