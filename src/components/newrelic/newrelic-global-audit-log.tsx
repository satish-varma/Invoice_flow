'use client';

import React, { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { getGlobalAuditLogs } from '@/services/newrelicChallanService';
import type { NewRelicChallanHistory } from '@/services/newrelicChallanService';
import { Loader2, Plus, Edit2, Trash2, RefreshCcw, Activity } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

const formatAuthorName = (email?: string | null) => {
  if (!email) return 'System';
  return email.split('@')[0];
};

export function NewRelicGlobalAuditLog() {
  const [logs, setLogs] = useState<NewRelicChallanHistory[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const data = await getGlobalAuditLogs();
      setLogs(data);
      setLoading(false);
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <div className="text-center p-8 text-gray-500 bg-gray-50 rounded-md">
        <Activity className="h-10 w-10 mx-auto text-gray-300 mb-3" />
        <p>No activity recorded yet.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50 flex items-center gap-2">
        <Activity className="h-5 w-5 text-gray-500" />
        <h3 className="font-semibold text-gray-900">Global Activity Feed</h3>
      </div>
      <div className="p-6">
        <div className="relative border-l-2 border-gray-100 ml-3 space-y-6 max-h-[600px] overflow-y-auto pr-4 custom-scrollbar">
          {logs.map((log) => {
            const isCreate = log.action === 'CREATED';
            const isDelete = log.action === 'DELETED';
            const isRestore = log.action === 'RESTORED';
            
            let Icon = Edit2;
            let iconColor = 'text-blue-500';
            let bgColor = 'bg-blue-50';
            let borderColor = 'border-blue-100';

            if (isCreate) {
              Icon = Plus;
              iconColor = 'text-emerald-500';
              bgColor = 'bg-emerald-50';
              borderColor = 'border-emerald-100';
            } else if (isDelete) {
              Icon = Trash2;
              iconColor = 'text-red-500';
              bgColor = 'bg-red-50';
              borderColor = 'border-red-100';
            } else if (isRestore) {
              Icon = RefreshCcw;
              iconColor = 'text-amber-500';
              bgColor = 'bg-amber-50';
              borderColor = 'border-amber-100';
            }

            return (
              <div key={log.id} className="relative pl-6">
                <div className={`absolute -left-[17px] top-1 h-8 w-8 rounded-full border-2 border-white flex items-center justify-center ${bgColor} ${iconColor} shadow-sm z-10`}>
                  <Icon className="h-4 w-4" />
                </div>
                <div className={`bg-white rounded-lg p-4 border ${borderColor} shadow-sm hover:shadow-md transition-shadow`}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-gray-900">
                        {formatAuthorName(log.editedBy)}
                      </span>
                      <span className="text-gray-500 text-sm">
                        {log.action?.toLowerCase()} challan
                      </span>
                      <Badge variant="outline" className="font-mono text-xs">
                        {log.previousData?.dcNumber}
                      </Badge>
                    </div>
                    {log.editedAt && (
                      <span className="text-xs text-gray-400">
                        {format(new Date(log.editedAt), 'dd MMM yyyy, HH:mm')}
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-gray-600 bg-gray-50 rounded p-2 border border-gray-100 flex justify-between items-center">
                    <div>
                      <div className="flex flex-wrap gap-2 text-xs text-gray-500 mt-1">
                        <span>Items: {log.previousData?.lineItems?.length || 0}</span>
                        <span className="text-gray-300">|</span>
                        {(() => {
                          const mrpTotal = (log.previousData?.lineItems || []).reduce((sum, item) => sum + ((item.mrp || 0) * (item.quantity || 1)), 0);
                          const revenue = mrpTotal - (mrpTotal * 0.055);
                          const cost = (log.previousData?.procurementCost || 0) + (log.previousData?.transportCost || 0) + (log.previousData?.otherCharges || 0);
                          const profit = revenue - cost;
                          return <span>Profit: ₹{profit.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>;
                        })()}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
