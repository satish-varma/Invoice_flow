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

import { COMPANY_SITES } from '@/types/site';

export default function TuckshopPage() {
  const { role, user } = useAuth();
  const [records, setRecords] = useState<NewRelicTuckshopRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [dialogInitialTab, setDialogInitialTab] = useState<'expense' | 'sale'>('expense');
  const [editingRecord, setEditingRecord] = useState<NewRelicTuckshopRecord | null>(null);

  const isAdmin = role === 'admin' || role === 'superadmin';
  const assignedSite = user?.assignedSite || 'newrelic';
  const siteConfig = COMPANY_SITES[assignedSite] || COMPANY_SITES.newrelic;

  useEffect(() => {
    const siteFilter = isAdmin ? undefined : assignedSite;
    const unsubscribe = subscribeToTuckshopRecords((data) => {
      setRecords(data);
      setIsLoading(false);
    }, siteFilter);
    return () => unsubscribe();
  }, [isAdmin, assignedSite]);

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
    setEditingRecord(null);
    setDialogInitialTab(tab);
    setIsDialogOpen(true);
  };

  const handleEditRecord = (record: NewRelicTuckshopRecord) => {
    setEditingRecord(record);
    setDialogInitialTab(record.type);
    setIsDialogOpen(true);
  };
  
  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-8 py-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
              {isAdmin ? 'Tuckshop Tracking' : `${siteConfig.name} Tuckshop Tracking`}
            </h1>
            {!isAdmin && (
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                assignedSite === 'dsm'
                  ? 'bg-cyan-100 text-cyan-800'
                  : assignedSite === 'ntt_data'
                  ? 'bg-amber-100 text-amber-800'
                  : 'bg-indigo-100 text-[#3b2fc9]'
              }`}>
                {siteConfig.name}
              </span>
            )}
          </div>
          <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
            {isAdmin
              ? 'Track daily sales and expenses for Tuckshop items across company sites.'
              : `Track daily sales and expenses for ${siteConfig.name} (${siteConfig.allowedLocations.join(', ')}).`}
          </p>
        </div>
        
        <div className="grid grid-cols-2 sm:flex gap-2">
          <button 
            onClick={() => openDialog('expense')}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-3.5 py-2.5 sm:px-4 sm:py-2 bg-red-50 text-red-600 border border-red-200 rounded-xl text-xs sm:text-sm font-semibold hover:bg-red-100 transition-colors shadow-xs active:scale-95"
          >
            <TrendingDown className="h-4 w-4" /> Add Expense
          </button>
          
          <button 
            onClick={() => openDialog('sale')}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-3.5 py-2.5 sm:px-4 sm:py-2 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-xl text-xs sm:text-sm font-semibold hover:bg-emerald-100 transition-colors shadow-xs active:scale-95"
          >
            <IndianRupee className="h-4 w-4" /> Add Sale
          </button>
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) setEditingRecord(null);
        }}>
          <DialogContent className="sm:max-w-[500px] p-0 border-0 overflow-hidden bg-transparent shadow-none">
            <DialogTitle className="sr-only">
              {editingRecord ? 'Edit Tuckshop Record' : 'Log Tuckshop Record'}
            </DialogTitle>
            <TuckshopForm 
              key={editingRecord ? `edit-${editingRecord.id}` : `new-${dialogInitialTab}`}
              initialTab={dialogInitialTab}
              editRecord={editingRecord}
              existingCategories={existingCategories} 
              onSuccess={() => {
                setIsDialogOpen(false);
                setEditingRecord(null);
              }} 
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
            <TuckshopList
              records={records}
              showDashboard={role === 'admin' || role === 'superadmin'}
              onEdit={handleEditRecord}
            />
          </div>
        </>
      )}
    </div>
  );
}
