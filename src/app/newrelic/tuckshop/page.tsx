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
import { triggerHaptic } from '@/lib/haptics';

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
    <div className="max-w-6xl mx-auto px-3 sm:px-8 py-4 sm:py-8 space-y-4 sm:space-y-6">
      {/* The Gut Guru Tracker - Tuckshop Operations Hero Banner */}
      <div className="rounded-2xl sm:rounded-3xl bg-gradient-to-r from-[#2c1d24] via-[#43232f] to-[#1e1b4b] p-4 sm:p-6 text-white shadow-xl relative overflow-hidden">
        <div className="absolute -right-10 -top-10 w-44 h-44 bg-purple-500/20 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute right-32 -bottom-10 w-36 h-36 bg-amber-500/15 rounded-full blur-2xl pointer-events-none" />

        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/gut_guru_logo.png"
              alt="The Gut Guru"
              className="w-12 h-12 sm:w-14 sm:h-14 rounded-full border-2 border-amber-300/40 shadow-md object-contain bg-black/20 shrink-0"
            />
            <div>
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <span className="text-[10px] font-black uppercase tracking-wider bg-amber-400/20 text-amber-300 border border-amber-400/30 px-2 py-0.5 rounded-full">
                  Live Counter
                </span>
                {!isAdmin && (
                  <span className="text-[10px] font-black bg-white/20 text-white px-2 py-0.5 rounded-full uppercase tracking-wider">
                    {siteConfig.name}
                  </span>
                )}
              </div>
              <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white">
                {isAdmin ? 'Tuckshop Ledger & Sales' : `${siteConfig.name} Tuckshop`}
              </h1>
              <p className="text-xs text-rose-100/80 font-medium mt-0.5">
                {isAdmin
                  ? 'Real-time sales, raw materials, vendor expenses & daily net profit.'
                  : `Track daily tuckshop operations for ${siteConfig.name} (${siteConfig.allowedLocations.join(', ')}).`}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:flex gap-2.5">
            <button 
              onClick={() => {
                triggerHaptic('medium');
                openDialog('expense');
              }}
              className="flex items-center justify-center gap-2 px-4 py-3 sm:py-2.5 bg-gradient-to-r from-rose-600 to-red-600 text-white rounded-2xl text-xs sm:text-sm font-black shadow-lg shadow-rose-950/30 hover:from-rose-700 hover:to-red-700 transition-all active:scale-95"
            >
              <TrendingDown className="h-4 w-4" /> Add Expense
            </button>
            
            <button 
              onClick={() => {
                triggerHaptic('medium');
                openDialog('sale');
              }}
              className="flex items-center justify-center gap-2 px-4 py-3 sm:py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-2xl text-xs sm:text-sm font-black shadow-lg shadow-emerald-950/30 hover:from-emerald-700 hover:to-teal-700 transition-all active:scale-95"
            >
              <IndianRupee className="h-4 w-4" /> Log Sale
            </button>
          </div>
        </div>
      </div>
        
      <Dialog open={isDialogOpen} onOpenChange={(open) => {
        setIsDialogOpen(open);
        if (!open) setEditingRecord(null);
      }}>
        <DialogContent className="w-full sm:max-w-[520px] max-h-[92vh] sm:max-h-[85vh] bottom-0 top-auto sm:top-[50%] sm:bottom-auto translate-y-0 sm:translate-y-[-50%] rounded-t-3xl sm:rounded-3xl p-0 border-0 overflow-hidden bg-white shadow-2xl flex flex-col">
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
