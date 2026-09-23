'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { TuckshopDashboard } from '@/components/newrelic/tuckshop/tuckshop-dashboard';
import { TuckshopForm } from '@/components/newrelic/tuckshop/tuckshop-form';
import { TuckshopList } from '@/components/newrelic/tuckshop/tuckshop-list';
import { subscribeToTuckshopRecords, NewRelicTuckshopRecord } from '@/services/newrelicTuckshopService';
import { Loader2, Plus } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

export default function TuckshopPage() {
  const { role } = useAuth();
  const [records, setRecords] = useState<NewRelicTuckshopRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false); // Controls form visibility on mobile/smaller screens

  useEffect(() => {
    const unsubscribe = subscribeToTuckshopRecords((data) => {
      setRecords(data);
      setIsLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const existingCategories = useMemo(() => {
    const standard = ['Dosa Batter', 'Bread', 'Fruits', 'Groceries', 'Cutlery', 'Sales'];
    const unique = new Set<string>();
    records.forEach(r => {
      if (r.category && !standard.includes(r.category) && r.type === 'expense') {
        unique.add(r.category);
      }
    });
    return Array.from(unique);
  }, [records]);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-8 py-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tuckshop Tracking</h1>
          <p className="text-sm text-gray-500 mt-1">
            Track daily sales and expenses for Tuckshop items across locations.
          </p>
        </div>
        
        <button
          onClick={() => setShowForm(!showForm)}
          className="lg:hidden flex items-center justify-center gap-2 px-4 py-2 bg-[#3b2fc9] text-white rounded-lg text-sm font-medium"
        >
          {showForm ? 'Hide Form' : <><Plus className="h-4 w-4" /> Log Record</>}
        </button>
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center h-64 gap-4">
          <Loader2 className="h-8 w-8 text-[#3b2fc9] animate-spin" />
          <p className="text-gray-500 font-medium">Loading records...</p>
        </div>
      ) : (
        <>
          {role === 'admin' && <TuckshopDashboard records={records} />}
          
          <div className="flex flex-col lg:flex-row gap-6 items-start">
            <div className={`w-full lg:w-[400px] shrink-0 ${showForm ? 'block' : 'hidden lg:block'}`}>
              <TuckshopForm existingCategories={existingCategories} />
            </div>
            
            <div className="w-full lg:flex-1">
              <TuckshopList records={records} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
