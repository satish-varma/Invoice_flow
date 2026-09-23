'use client';

import React, { useEffect, useState, useMemo } from 'react';

import { TuckshopForm } from '@/components/newrelic/tuckshop/tuckshop-form';
import { TuckshopList } from '@/components/newrelic/tuckshop/tuckshop-list';
import { subscribeToTuckshopRecords, NewRelicTuckshopRecord } from '@/services/newrelicTuckshopService';
import { Loader2, Plus, TrendingDown, IndianRupee } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog';

export default function TuckshopPage() {
  const { role } = useAuth();
  const [records, setRecords] = useState<NewRelicTuckshopRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [dialogInitialTab, setDialogInitialTab] = useState<'expense' | 'sale'>('expense');

  useEffect(() => {
    const unsubscribe = subscribeToTuckshopRecords((data) => {
      setRecords(data);
      setIsLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const existingCategories = useMemo(() => {
    const standard = ['Dosa Batter', 'Bread', 'Fruits', 'Groceries', 'Cutlery', 'Vegetables', 'Sales'];
    const unique = new Set<string>();
    records.forEach(r => {
      if (r.category && !standard.includes(r.category) && r.type === 'expense') {
        unique.add(r.category);
      }
    });
    return Array.from(unique);
  }, [records]);

  const openDialog = (tab: 'expense' | 'sale') => {
    setDialogInitialTab(tab);
    setIsDialogOpen(true);
  };
  
  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-8 py-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tuckshop Tracking</h1>
          <p className="text-sm text-gray-500 mt-1">
            Track daily sales and expenses for Tuckshop items across locations.
          </p>
        </div>
        
        <div className="flex gap-2">
          <button 
            onClick={() => openDialog('expense')}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-red-50 text-red-600 border border-red-200 rounded-lg text-sm font-medium hover:bg-red-100 transition-colors"
          >
            <TrendingDown className="h-4 w-4" /> Add Expense
          </button>
          
          <button 
            onClick={() => openDialog('sale')}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-green-50 text-green-700 border border-green-200 rounded-lg text-sm font-medium hover:bg-green-100 transition-colors"
          >
            <IndianRupee className="h-4 w-4" /> Add Sale
          </button>
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="sm:max-w-[500px] p-0 border-0 overflow-hidden bg-transparent shadow-none">
            <DialogTitle className="sr-only">Log Tuckshop Record</DialogTitle>
            <TuckshopForm 
              initialTab={dialogInitialTab}
              existingCategories={existingCategories} 
              onSuccess={() => setIsDialogOpen(false)} 
            />
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center h-64 gap-4">
          <Loader2 className="h-8 w-8 text-[#3b2fc9] animate-spin" />
          <p className="text-gray-500 font-medium">Loading records...</p>
        </div>
      ) : (
        <>
          <div className="w-full">
            <TuckshopList records={records} showDashboard={role === 'admin'} />
          </div>
        </>
      )}
    </div>
  );
}
