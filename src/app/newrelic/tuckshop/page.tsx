'use client';

import React, { useEffect, useState } from 'react';
import { TuckshopDashboard } from '@/components/newrelic/tuckshop/tuckshop-dashboard';
import { TuckshopForm } from '@/components/newrelic/tuckshop/tuckshop-form';
import { TuckshopList } from '@/components/newrelic/tuckshop/tuckshop-list';
import { subscribeToTuckshopRecords, NewRelicTuckshopRecord } from '@/services/newrelicTuckshopService';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

export default function TuckshopPage() {
  const { role } = useAuth();
  const [records, setRecords] = useState<NewRelicTuckshopRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = subscribeToTuckshopRecords((data) => {
      setRecords(data);
      setIsLoading(false);
    });
    return () => unsubscribe();
  }, []);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-8 py-8 space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tuckshop Tracking</h1>
          <p className="text-sm text-gray-500 mt-1">
            Track daily sales and expenses for Tuckshop items across locations.
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center h-64 gap-4">
          <Loader2 className="h-8 w-8 text-[#3b2fc9] animate-spin" />
          <p className="text-gray-500 font-medium">Loading records...</p>
        </div>
      ) : (
        <>
          {role === 'admin' && <TuckshopDashboard records={records} />}
          
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-4">
              <TuckshopForm />
            </div>
            
            <div className="lg:col-span-8">
              <TuckshopList records={records} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
