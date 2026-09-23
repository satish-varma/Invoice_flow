'use client';

import React, { useState } from 'react';
import { Trash2, TrendingUp, TrendingDown, Filter } from 'lucide-react';
import { NewRelicTuckshopRecord, deleteTuckshopRecord } from '@/services/newrelicTuckshopService';
import { useAuth } from '@/contexts/AuthContext';

interface Props {
  records: NewRelicTuckshopRecord[];
}

export function TuckshopList({ records }: Props) {
  const { role } = useAuth();
  const [filterType, setFilterType] = useState<'all' | 'expense' | 'sale'>('all');
  const [filterLocation, setFilterLocation] = useState<'all' | 'HYD' | 'BLR'>('all');

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
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden mt-6">
      <div className="p-5 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gray-50/50">
        <h3 className="font-semibold text-gray-800 text-lg">Transaction History</h3>
        
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

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Date</th>
              <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Location</th>
              <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Type</th>
              <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Category</th>
              <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Description</th>
              <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase text-right">Amount</th>
              {role === 'admin' && (
                <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase text-right">Actions</th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filteredRecords.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-5 py-8 text-center text-sm text-gray-500">
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
                  <td className="px-5 py-3 text-sm">
                    {record.type === 'expense' ? (
                      <span className="inline-flex items-center gap-1 text-red-600 bg-red-50 px-2 py-0.5 rounded-md font-medium text-xs">
                        <TrendingDown className="h-3 w-3" /> Expense
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-green-600 bg-green-50 px-2 py-0.5 rounded-md font-medium text-xs">
                        <TrendingUp className="h-3 w-3" /> Sale
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-sm text-gray-600 capitalize">
                    {record.category.replace('_', ' ')}
                  </td>
                  <td className="px-5 py-3 text-sm text-gray-500 truncate max-w-[200px]" title={record.description}>
                    {record.description || '-'}
                  </td>
                  <td className={`px-5 py-3 text-sm font-semibold text-right ${record.type === 'expense' ? 'text-red-600' : 'text-green-600'}`}>
                    {record.type === 'expense' ? '-' : '+'}₹{record.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </td>
                  {role === 'admin' && (
                    <td className="px-5 py-3 text-right">
                      <button
                        onClick={() => handleDelete(record.id!)}
                        className="text-gray-400 hover:text-red-500 p-1 rounded transition-colors"
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
