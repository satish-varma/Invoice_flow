'use client';

import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { saveTuckshopRecord, uploadTuckshopBill, NewRelicTuckshopRecord } from '@/services/newrelicTuckshopService';
import { PlusCircle, Loader2, IndianRupee, TrendingDown } from 'lucide-react';

interface Props {
  existingCategories: string[];
  initialTab?: 'expense' | 'sale';
  onSuccess?: () => void;
}

export function TuckshopForm({ existingCategories, initialTab = 'expense', onSuccess }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'expense' | 'sale'>(initialTab);

  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
  
  // Map full names to codes since they are stored as 'bangalore' / 'hyderabad' in users collection
  const getMappedLocation = (locStr?: string) => {
    if (!locStr) return undefined;
    if (locStr.toLowerCase() === 'bangalore' || locStr === 'BLR') return 'BLR';
    if (locStr.toLowerCase() === 'hyderabad' || locStr === 'HYD') return 'HYD';
    return undefined;
  };
  
  const defaultLoc = getMappedLocation(user?.preferredLocations?.[0]);
  const [location, setLocation] = useState<'HYD' | 'BLR'>(defaultLoc || 'BLR');

  // Also update if user object loads later
  React.useEffect(() => {
    const mappedLoc = getMappedLocation(user?.preferredLocations?.[0]);
    if (mappedLoc && location === 'BLR') {
      setLocation(mappedLoc);
    }
  }, [user?.preferredLocations]);
  
  // Expense states
  const [category, setCategory] = useState<string>('Dosa Batter');
  const [customCategory, setCustomCategory] = useState<string>('');
  const [expenseAmount, setExpenseAmount] = useState<string>('');
  const [expenseDesc, setExpenseDesc] = useState<string>('');
  const [billFile, setBillFile] = useState<File | null>(null);
  
  // Sale states
  const [saleAmount, setSaleAmount] = useState<string>('');

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
      let billUrl = undefined;
      if (activeTab === 'expense' && billFile) {
        billUrl = await uploadTuckshopBill(billFile);
      }

      const record: Partial<NewRelicTuckshopRecord> = {
        date,
        location,
        type: activeTab,
        category: activeTab === 'sale' ? 'Sales' : finalCategory,
        amount: Number(amount),
        description: activeTab === 'expense' ? (expenseDesc.trim() || undefined) : 'Daily Total Sale',
        billUrl,
      };

      await saveTuckshopRecord(record, user?.email || null);
      toast({ title: 'Record saved successfully' });
      
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
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
      <div className={`p-4 border-b border-gray-100 flex items-center gap-2 font-semibold ${activeTab === 'expense' ? 'text-red-600 bg-red-50/50' : 'text-green-600 bg-green-50/50'}`}>
        {activeTab === 'expense' ? <TrendingDown className="h-5 w-5" /> : <IndianRupee className="h-5 w-5" />}
        {activeTab === 'expense' ? 'Log Expense' : 'Log Daily Sale'}
      </div>

      <form onSubmit={handleSubmit} className="p-4 sm:p-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 mb-6">
          
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Date <span className="text-red-500">*</span></label>
            <input
              type="date"
              required
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#3b2fc9]/20 focus:border-[#3b2fc9]"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Location <span className="text-red-500">*</span></label>
            <select
              value={location}
              onChange={(e) => setLocation(e.target.value as 'HYD' | 'BLR')}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#3b2fc9]/20 focus:border-[#3b2fc9]"
            >
              <option value="BLR">Bangalore (BLR)</option>
              <option value="HYD">Hyderabad (HYD)</option>
            </select>
          </div>

          {activeTab === 'expense' ? (
            <>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Expense Category <span className="text-red-500">*</span></label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#3b2fc9]/20 focus:border-[#3b2fc9]"
                >
                  {allCategories.map((cat, i) => (
                    <option key={i} value={cat}>{cat}</option>
                  ))}
                  <option value="other">Other (Add New)</option>
                </select>
                
                {category === 'other' && (
                  <div className="mt-3">
                    <input
                      type="text"
                      required
                      value={customCategory}
                      onChange={(e) => setCustomCategory(e.target.value)}
                      placeholder="Enter new category name"
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#3b2fc9]/20 focus:border-[#3b2fc9]"
                    />
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Amount (₹) <span className="text-red-500">*</span></label>
                <input
                  type="number"
                  required
                  min="0"
                  step="0.01"
                  value={expenseAmount}
                  onChange={(e) => setExpenseAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#3b2fc9]/20 focus:border-[#3b2fc9]"
                />
              </div>
              
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Upload Bill (Optional)</label>
                <div className="relative">
                  <input
                    type="file"
                    accept="image/*,.pdf"
                    onChange={(e) => setBillFile(e.target.files?.[0] || null)}
                    className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-[#3b2fc9]/10 file:text-[#3b2fc9] hover:file:bg-[#3b2fc9]/20 cursor-pointer"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Notes / Description</label>
                <input
                  type="text"
                  value={expenseDesc}
                  onChange={(e) => setExpenseDesc(e.target.value)}
                  placeholder="Optional notes..."
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#3b2fc9]/20 focus:border-[#3b2fc9]"
                />
              </div>
            </>
          ) : (
            <div className="sm:col-span-2">
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Total Daily Sale (₹) <span className="text-red-500">*</span></label>
              <input
                type="number"
                required
                min="0"
                step="0.01"
                value={saleAmount}
                onChange={(e) => setSaleAmount(e.target.value)}
                placeholder="0.00"
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-600/20 focus:border-green-600"
              />
              <p className="text-xs text-gray-500 mt-2">
                Enter the complete total sales collected for the selected date and location.
              </p>
            </div>
          )}

        </div>

        <div className="flex justify-end border-t border-gray-100 pt-5">
          <button
            type="submit"
            disabled={isSaving}
            className={`px-6 py-2 text-white text-sm font-medium rounded-lg disabled:opacity-70 flex items-center gap-2 transition-colors ${
              activeTab === 'sale' ? 'bg-green-600 hover:bg-green-700' : 'bg-[#3b2fc9] hover:bg-[#2a2296]'
            }`}
          >
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlusCircle className="h-4 w-4" />}
            {activeTab === 'sale' ? 'Record Sale' : 'Save Expense'}
          </button>
        </div>
      </form>
    </div>
  );
}
