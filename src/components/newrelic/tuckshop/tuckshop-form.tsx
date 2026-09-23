'use client';

import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { saveTuckshopRecord, NewRelicTuckshopRecord, TuckshopType, TuckshopCategory } from '@/services/newrelicTuckshopService';
import { PlusCircle, Loader2 } from 'lucide-react';

export function TuckshopForm() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);

  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [location, setLocation] = useState<'HYD' | 'BLR'>('BLR');
  const [type, setType] = useState<TuckshopType>('expense');
  const [category, setCategory] = useState<TuckshopCategory>('dosa_batter');
  const [amount, setAmount] = useState<string>('');
  const [description, setDescription] = useState<string>('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || Number(amount) <= 0) {
      toast({
        variant: 'destructive',
        title: 'Validation Error',
        description: 'Amount must be greater than 0',
      });
      return;
    }

    setIsSaving(true);
    try {
      const record: Partial<NewRelicTuckshopRecord> = {
        date,
        location,
        type,
        category: type === 'sale' ? 'sales' : category,
        amount: Number(amount),
        description: description.trim() || undefined,
      };

      await saveTuckshopRecord(record, user?.email || null);
      toast({ title: 'Record saved successfully' });
      
      // Reset form
      setAmount('');
      setDescription('');
      if (type === 'sale') setType('expense');
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

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50 flex items-center gap-2">
        <PlusCircle className="h-5 w-5 text-[#3b2fc9]" />
        <h2 className="text-lg font-bold text-gray-800">Add New Record</h2>
      </div>

      <form onSubmit={handleSubmit} className="p-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 mb-6">
          
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Date <span className="text-red-500">*</span></label>
            <input
              type="date"
              required
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#3b2fc9]/20 focus:border-[#3b2fc9]"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Location <span className="text-red-500">*</span></label>
            <select
              value={location}
              onChange={(e) => setLocation(e.target.value as 'HYD' | 'BLR')}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#3b2fc9]/20 focus:border-[#3b2fc9]"
            >
              <option value="BLR">Bangalore (BLR)</option>
              <option value="HYD">Hyderabad (HYD)</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Type <span className="text-red-500">*</span></label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="type"
                  value="expense"
                  checked={type === 'expense'}
                  onChange={() => setType('expense')}
                  className="text-[#3b2fc9] focus:ring-[#3b2fc9]"
                />
                <span className="text-sm">Expense</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="type"
                  value="sale"
                  checked={type === 'sale'}
                  onChange={() => setType('sale')}
                  className="text-green-600 focus:ring-green-600"
                />
                <span className="text-sm">Sale (Revenue)</span>
              </label>
            </div>
          </div>

          {type === 'expense' && (
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Category <span className="text-red-500">*</span></label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as TuckshopCategory)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#3b2fc9]/20 focus:border-[#3b2fc9]"
              >
                <option value="dosa_batter">Dosa Batter</option>
                <option value="bread">Bread</option>
                <option value="fruits">Fruits</option>
                <option value="groceries">Groceries</option>
                <option value="cutlery">Cutlery</option>
                <option value="other">Other Expense</option>
              </select>
            </div>
          )}

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Amount (₹) <span className="text-red-500">*</span></label>
            <input
              type="number"
              required
              min="0"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#3b2fc9]/20 focus:border-[#3b2fc9]"
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Notes / Description</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional notes..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#3b2fc9]/20 focus:border-[#3b2fc9]"
            />
          </div>
        </div>

        <div className="flex justify-end border-t border-gray-100 pt-5">
          <button
            type="submit"
            disabled={isSaving}
            className="px-6 py-2 bg-[#3b2fc9] text-white font-medium rounded-lg hover:bg-[#2a2296] disabled:opacity-70 flex items-center gap-2"
          >
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Save Record
          </button>
        </div>
      </form>
    </div>
  );
}
