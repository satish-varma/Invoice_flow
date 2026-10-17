'use client';

import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { saveTuckshopRecord, uploadTuckshopBill, NewRelicTuckshopRecord } from '@/services/newrelicTuckshopService';
import { PlusCircle, Loader2, IndianRupee, TrendingDown } from 'lucide-react';
import { SiteId, SITE_OPTIONS, resolveSiteId, COMPANY_SITES } from '@/types/site';
import { triggerHaptic } from '@/lib/haptics';

interface Props {
  existingCategories: string[];
  initialTab?: 'expense' | 'sale';
  editRecord?: NewRelicTuckshopRecord | null;
  onSuccess?: () => void;
}

export function TuckshopForm({ existingCategories, initialTab = 'expense', editRecord, onSuccess }: Props) {
  const { user, role } = useAuth();
  const isAdmin = role === 'admin' || role === 'superadmin';
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'expense' | 'sale'>(editRecord?.type || initialTab);

  const [date, setDate] = useState<string>(
    editRecord?.date ? editRecord.date.split('T')[0] : new Date().toISOString().split('T')[0]
  );
  
  // Map full names to codes since they are stored as 'bangalore' / 'hyderabad' in users collection
  const getMappedLocation = (locStr?: string) => {
    if (!locStr) return undefined;
    if (locStr.toLowerCase() === 'bangalore' || locStr === 'BLR') return 'BLR';
    if (locStr.toLowerCase() === 'hyderabad' || locStr === 'HYD') return 'HYD';
    return undefined;
  };

  const [selectedSite, setSelectedSite] = useState<SiteId>(() => {
    if (editRecord?.siteId) return resolveSiteId(editRecord.siteId);
    return user?.assignedSite ? resolveSiteId(user.assignedSite) : 'newrelic';
  });

  const effectiveSite = isAdmin ? selectedSite : (user?.assignedSite ? resolveSiteId(user.assignedSite) : 'newrelic');
  const isHydOnlySite = effectiveSite === 'dsm' || effectiveSite === 'ntt_data';
  
  const defaultLoc = isHydOnlySite ? 'HYD' : getMappedLocation(user?.preferredLocations?.[0]);
  const [location, setLocation] = useState<'HYD' | 'BLR'>(
    (editRecord?.location as 'HYD' | 'BLR') || defaultLoc || (isHydOnlySite ? 'HYD' : 'BLR')
  );

  const handleSiteChange = (newSite: SiteId) => {
    setSelectedSite(newSite);
    if (newSite === 'dsm' || newSite === 'ntt_data') {
      setLocation('HYD');
    }
  };

  // Expense states
  const isPredefinedCategory = ['Dosa Batter', 'Vegetables', 'Groceries', 'Bread', 'Cutlery', 'Fruits'].includes(
    editRecord?.category || ''
  );
  const [category, setCategory] = useState<string>(
    editRecord
      ? isPredefinedCategory
        ? editRecord.category
        : 'other'
      : 'Dosa Batter'
  );
  const [customCategory, setCustomCategory] = useState<string>(
    editRecord && !isPredefinedCategory ? editRecord.category : ''
  );
  const [expenseAmount, setExpenseAmount] = useState<string>(
    editRecord && editRecord.type === 'expense' ? String(editRecord.amount) : ''
  );
  const [expenseDesc, setExpenseDesc] = useState<string>(
    editRecord?.description || ''
  );
  const [billFile, setBillFile] = useState<File | null>(null);
  
  // Sale states
  const [saleAmount, setSaleAmount] = useState<string>(
    editRecord && editRecord.type === 'sale' ? String(editRecord.amount) : ''
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = activeTab === 'expense' ? expenseAmount : saleAmount;
    
    if (!amount || Number(amount) <= 0) {
      toast({
        variant: 'destructive',
        title: 'Validation Error',
        description: 'Amount must be greater than 0',
      });
      return;
    }
    
    const finalCategory = category === 'other' ? customCategory.trim() : category;
    
    if (activeTab === 'expense' && !finalCategory) {
      toast({
        variant: 'destructive',
        title: 'Validation Error',
        description: 'Please select or enter an expense category.',
      });
      return;
    }

    setIsSaving(true);
    try {
      let billUrl = editRecord?.billUrl || undefined;
      if (activeTab === 'expense' && billFile) {
        billUrl = await uploadTuckshopBill(billFile);
      }

      const record: Partial<NewRelicTuckshopRecord> = {
        ...(editRecord?.id ? { id: editRecord.id } : {}),
        siteId: effectiveSite,
        date,
        location: isHydOnlySite ? 'HYD' : location,
        type: activeTab,
        category: activeTab === 'sale' ? 'Sales' : finalCategory,
        amount: Number(amount),
        description: activeTab === 'expense' ? (expenseDesc.trim() || undefined) : 'Daily Total Sale',
        billUrl,
      };

      await saveTuckshopRecord(record, user?.email || null);
      toast({ title: editRecord ? 'Record updated successfully' : 'Record saved successfully' });
      
      // Reset form
      if (activeTab === 'expense') {
        setExpenseAmount('');
        setExpenseDesc('');
        setBillFile(null);
        if (category === 'other') setCustomCategory('');
      } else {
        setSaleAmount('');
      }
      
      if (onSuccess) onSuccess();
    } catch (err) {
      console.error(err);
      toast({
        variant: 'destructive',
        title: 'Save failed',
        description: err instanceof Error ? err.message : 'Unknown error',
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Combine standard and existing into unique array
  const standardCategories = ['Dosa Batter', 'Vegetables', 'Groceries', 'Bread', 'Cutlery', 'Fruits'];
  const allCategories = Array.from(new Set([...standardCategories, ...existingCategories]));

  return (
    <div className="bg-white rounded-t-3xl sm:rounded-3xl shadow-xl border border-gray-100 overflow-hidden flex flex-col max-h-[92vh] sm:max-h-[85vh]">
      {/* Mobile Drag Handle */}
      <div className="sm:hidden w-12 h-1.5 bg-slate-300 rounded-full mx-auto mt-2.5 mb-1 shrink-0" />

      {/* Header & Tabs */}
      <div className="p-4 sm:p-5 border-b border-gray-100 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2.5">
          <div className={`p-2 sm:p-2.5 rounded-2xl text-white shadow-xs ${activeTab === 'expense' ? 'bg-gradient-to-tr from-rose-600 to-red-600' : 'bg-gradient-to-tr from-emerald-600 to-teal-600'}`}>
            {activeTab === 'expense' ? <TrendingDown className="h-5 w-5" /> : <IndianRupee className="h-5 w-5" />}
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
              {editRecord ? `Edit ${activeTab === 'expense' ? 'Expense' : 'Sale'}` : activeTab === 'expense' ? 'Log Expense' : 'Log Daily Sale'}
            </h2>
            <p className="text-xs text-slate-500 font-medium">Tuckshop Ledger</p>
          </div>
        </div>

        {!editRecord && (
          <div className="flex items-center p-1 bg-slate-100 rounded-2xl border border-slate-200">
            <button
              type="button"
              onClick={() => {
                triggerHaptic('light');
                setActiveTab('expense');
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all ${
                activeTab === 'expense'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Expense
            </button>
            <button
              type="button"
              onClick={() => {
                triggerHaptic('light');
                setActiveTab('sale');
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all ${
                activeTab === 'sale'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Sale
            </button>
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {isAdmin && (
              <div className="sm:col-span-2">
                <label className="block text-xs sm:text-sm font-bold text-slate-700 mb-1.5">
                  Company Site <span className="text-rose-500">*</span>
                </label>
                <select
                  value={selectedSite}
                  onChange={(e) => handleSiteChange(e.target.value as SiteId)}
                  className="w-full h-12 sm:h-10 px-3 text-sm border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#3b2fc9]/20 focus:border-[#3b2fc9] bg-white font-semibold text-slate-800 shadow-2xs"
                >
                  {SITE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label} ({COMPANY_SITES[opt.value]?.tagline || opt.value})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="block text-xs sm:text-sm font-bold text-slate-700 mb-1.5">Date <span className="text-rose-500">*</span></label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full h-12 sm:h-10 px-3 text-sm border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#3b2fc9]/20 focus:border-[#3b2fc9] bg-white font-semibold text-slate-800 shadow-2xs"
              />
            </div>

            <div>
              <label className="block text-xs sm:text-sm font-bold text-slate-700 mb-1.5">Location <span className="text-rose-500">*</span></label>
              <select
                value={location}
                disabled={isHydOnlySite}
                onChange={(e) => setLocation(e.target.value as 'HYD' | 'BLR')}
                className={`w-full h-12 sm:h-10 px-3 text-sm border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#3b2fc9]/20 focus:border-[#3b2fc9] bg-white font-semibold text-slate-800 shadow-2xs ${isHydOnlySite ? 'bg-slate-100 text-slate-500 cursor-not-allowed' : ''}`}
              >
                {!isHydOnlySite && <option value="BLR">Bangalore (BLR)</option>}
                <option value="HYD">Hyderabad (HYD)</option>
              </select>
              {isHydOnlySite && (
                <span className="text-[10px] text-amber-600 font-bold mt-1 block">
                  📍 Locked to Hyderabad for {COMPANY_SITES[effectiveSite]?.name || effectiveSite}
                </span>
              )}
            </div>

            {activeTab === 'expense' ? (
              <>
                <div>
                  <label className="block text-xs sm:text-sm font-bold text-slate-700 mb-1.5">Expense Category <span className="text-rose-500">*</span></label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full h-12 sm:h-10 px-3 text-sm border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#3b2fc9]/20 focus:border-[#3b2fc9] bg-white font-semibold text-slate-800 shadow-2xs"
                  >
                    {allCategories.map((cat, i) => (
                      <option key={i} value={cat}>{cat}</option>
                    ))}
                    <option value="other">Other (Add New)</option>
                  </select>
                  
                  {category === 'other' && (
                    <div className="mt-2.5">
                      <input
                        type="text"
                        required
                        value={customCategory}
                        onChange={(e) => setCustomCategory(e.target.value)}
                        placeholder="Enter new category name"
                        className="w-full h-12 sm:h-10 px-3 text-sm border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#3b2fc9]/20 focus:border-[#3b2fc9] bg-white font-medium text-slate-800 shadow-2xs"
                      />
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-xs sm:text-sm font-bold text-slate-700 mb-1.5">Amount (₹) <span className="text-rose-500">*</span></label>
                  <input
                    type="number"
                    required
                    min="0"
                    step="0.01"
                    value={expenseAmount}
                    onChange={(e) => setExpenseAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full h-12 sm:h-10 px-3 text-sm font-mono font-bold border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#3b2fc9]/20 focus:border-[#3b2fc9] bg-white text-slate-800 shadow-2xs"
                  />
                </div>
                
                <div>
                  <label className="block text-xs sm:text-sm font-bold text-slate-700 mb-1.5">Upload Bill (Optional)</label>
                  <div className="relative">
                    <input
                      type="file"
                      accept="image/*,.pdf"
                      onChange={(e) => setBillFile(e.target.files?.[0] || null)}
                      className="w-full text-xs text-slate-500 file:mr-3 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 cursor-pointer"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs sm:text-sm font-bold text-slate-700 mb-1.5">Notes / Description</label>
                  <input
                    type="text"
                    value={expenseDesc}
                    onChange={(e) => setExpenseDesc(e.target.value)}
                    placeholder="Optional notes..."
                    className="w-full h-12 sm:h-10 px-3 text-sm border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#3b2fc9]/20 focus:border-[#3b2fc9] bg-white font-medium text-slate-800 shadow-2xs"
                  />
                </div>
              </>
            ) : (
              <div className="sm:col-span-2">
                <label className="block text-xs sm:text-sm font-bold text-slate-700 mb-1.5">Total Daily Sale (₹) <span className="text-rose-500">*</span></label>
                <input
                  type="number"
                  required
                  min="0"
                  step="0.01"
                  value={saleAmount}
                  onChange={(e) => setSaleAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full h-12 sm:h-10 px-3 text-sm font-mono font-bold border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600 bg-white text-slate-800 shadow-2xs"
                />
                <p className="text-xs text-slate-500 font-medium mt-2">
                  Enter the complete total sales collected for the selected date and location.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Sticky Bottom Thumb Bar */}
        <div className="p-4 sm:p-5 border-t border-slate-100 bg-slate-50/80 flex items-center justify-end pb-[max(1rem,env(safe-area-inset-bottom))] shrink-0">
          <button
            type="submit"
            disabled={isSaving}
            className={`w-full sm:w-auto h-12 sm:h-11 px-8 text-white text-sm font-black rounded-2xl disabled:opacity-60 flex items-center justify-center gap-2 shadow-lg transition-all active:scale-95 ${
              activeTab === 'sale'
                ? 'bg-gradient-to-r from-emerald-600 to-teal-600 shadow-emerald-900/20 hover:from-emerald-700 hover:to-teal-700'
                : 'bg-gradient-to-r from-[#3b2fc9] to-indigo-600 shadow-indigo-900/20 hover:from-[#2a2296] hover:to-indigo-700'
            }`}
          >
            {isSaving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <PlusCircle className="h-4 w-4" />
            )}
            {editRecord ? 'Update Record' : activeTab === 'sale' ? 'Record Sale' : 'Save Expense'}
          </button>
        </div>
      </form>
    </div>
  );
}
