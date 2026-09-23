'use client';

import React, { useState } from 'react';
import { Trash2, TrendingUp, TrendingDown, Filter, FileText, ExternalLink } from 'lucide-react';
import { NewRelicTuckshopRecord, deleteTuckshopRecord } from '@/services/newrelicTuckshopService';
import { useAuth } from '@/contexts/AuthContext';

interface Props {
  records: NewRelicTuckshopRecord[];
}

export function TuckshopList({ records }: Props) {
  const { role, user } = useAuth();
  const [filterType, setFilterType] = useState<'all' | 'expense' | 'sale'>('all');
  
  // Use preferred location if available, otherwise 'all'
  const defaultLoc = user?.preferredLocations?.[0] as 'HYD' | 'BLR' | undefined;
  const [filterLocation, setFilterLocation] = useState<'all' | 'HYD' | 'BLR'>(defaultLoc || 'all');

  // Also update if user object loads later
  React.useEffect(() => {
    if (user?.preferredLocations?.[0] && filterLocation === 'all') {
      const loc = user.preferredLocations[0];
      if (loc === 'HYD' || loc === 'BLR') {
        setFilterLocation(loc);
      }
    }
  }, [user?.preferredLocations]);

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this record?')) {
      await deleteTuckshopRecord(id);
    }
  };

  const filteredRecords = records.filter(record => {
    if (filterType !== 'all' && record.type !== filterType) return false;
    if (filterLocation !== 'all' && record.location !== filterLocation) return false;
    return true;
  });

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden h-full flex flex-col">
      <div className="p-5 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gray-50/50">
        <h3 className="font-semibold text-gray-800 text-lg">Transaction Ledger</h3>
        
        <div className="flex items-center gap-3">
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
            <select
              value={filterLocation}
              onChange={(e) => setFilterLocation(e.target.value as any)}
              className="pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#3b2fc9]/20"
            >
              <option value="all">All Locations</option>
              <option value="BLR">Bangalore (BLR)</option>
              <option value="HYD">Hyderabad (HYD)</option>
            </select>
          </div>
          
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value as any)}
            className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#3b2fc9]/20"
          >
            <option value="all">All Types</option>
            <option value="expense">Expenses Only</option>
            <option value="sale">Sales Only</option>
          </select>
        </div>
      </div>

      <div className="overflow-x-auto flex-1">
        <table className="w-full text-left border-collapse min-w-[700px]">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Date</th>
              <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Location</th>
              <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Category</th>
              <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase">User</th>
              <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Description</th>
              <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase text-center">Bill</th>
              <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase text-right">Amount</th>
              {role === 'admin' && (
                <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase text-right">Actions</th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filteredRecords.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-5 py-8 text-center text-sm text-gray-500">
                  No records found.
                </td>
              </tr>
            ) : (
              filteredRecords.map((record) => (
                <tr key={record.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-5 py-3 text-sm text-gray-600">
                    {new Date(record.date).toLocaleDateString()}
                  </td>
                  <td className="px-5 py-3 text-sm font-medium text-gray-700">
                    {record.location}
                  </td>
                  <td className="px-5 py-3 text-sm text-gray-600 capitalize">
                    {record.category.replace('_', ' ')}
                  </td>
                  <td className="px-5 py-3 text-sm text-gray-500 max-w-[150px] truncate" title={record.createdBy || ''}>
                    {record.createdBy || 'Unknown'}
                  </td>
                  <td className="px-5 py-3 text-sm text-gray-500 max-w-[200px] truncate" title={record.description}>
                    {record.description || '-'}
                  </td>
                  <td className="px-5 py-3 text-center">
                    {record.billUrl ? (
                      <a href={record.billUrl} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center p-1.5 text-blue-600 bg-blue-50 rounded hover:bg-blue-100 transition-colors" title="View Uploaded Bill">
                        <FileText className="h-4 w-4" />
                      </a>
                    ) : (
                      <span className="text-gray-300">-</span>
                    )}
                  </td>
                  <td className={`px-5 py-3 text-sm font-semibold text-right ${record.type === 'expense' ? 'text-red-600' : 'text-green-600'}`}>
                    {record.type === 'expense' ? '-' : '+'}₹{record.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </td>
                  {role === 'admin' && (
                    <td className="px-5 py-3 text-right">
                      <button
                        onClick={() => handleDelete(record.id!)}
                        className="text-gray-400 hover:text-red-500 p-1.5 rounded transition-colors"
                        title="Delete Record"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
