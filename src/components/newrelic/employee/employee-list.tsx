'use client';

import React from 'react';
import { NewRelicEmployee } from '@/types/employee';
import { resolveSiteId, COMPANY_SITES } from '@/types/site';
import { Edit2, Trash2, MapPin, IndianRupee, Calendar, UserCheck, UserX, Clock } from 'lucide-react';

interface EmployeeListProps {
  employees: NewRelicEmployee[];
  onEdit: (emp: NewRelicEmployee) => void;
  onDelete: (emp: NewRelicEmployee) => void;
  isAdmin?: boolean;
}

export function EmployeeList({ employees, onEdit, onDelete, isAdmin }: EmployeeListProps) {
  if (employees.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-gray-200 p-10 text-center text-gray-400">
        <p className="text-sm">No employees added yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {employees.map((emp) => {
        const siteId = resolveSiteId(emp.siteId);
        const siteConfig = COMPANY_SITES[siteId];
        const siteBadgeStyles =
          siteId === 'dsm'
            ? 'bg-purple-50 text-purple-700 border-purple-200/60'
            : siteId === 'ntt_data'
            ? 'bg-amber-50 text-amber-700 border-amber-200/60'
            : 'bg-blue-50 text-blue-700 border-blue-200/60';

        return (
          <div
            key={emp.id}
            className={`bg-white rounded-xl border p-4 flex flex-col sm:flex-row sm:items-center gap-4 shadow-sm transition-opacity ${
              emp.isActive ? 'border-gray-200' : 'border-gray-100 opacity-60'
            }`}
          >
            {/* Avatar */}
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div
                className={`h-10 w-10 rounded-full flex items-center justify-center text-white font-semibold text-sm shrink-0 ${
                  emp.location === 'hyderabad' ? 'bg-[#3b2fc9]' : 'bg-emerald-600'
                }`}
              >
                {emp.name.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-semibold text-gray-800 text-sm truncate">{emp.name}</p>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium border ${siteBadgeStyles}`}>
                    {siteConfig?.name || siteId}
                  </span>
                  <span className="text-[10px] font-mono bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">{emp.employeeId}</span>
                  {emp.isActive ? (
                    <span className="text-[10px] bg-emerald-50 text-emerald-600 px-1.5 py-0.5 rounded-full font-medium flex items-center gap-1">
                      <UserCheck className="h-3 w-3" /> Active
                    </span>
                  ) : (
                    <span className="text-[10px] bg-red-50 text-red-500 px-1.5 py-0.5 rounded-full font-medium flex items-center gap-1">
                      <UserX className="h-3 w-3" /> Inactive
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-500 truncate">
                  {emp.designation}
                  {emp.email && <span className="ml-2 text-gray-400">({emp.email})</span>}
                </p>
              </div>
            </div>

          {/* Meta */}
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
            <span className="flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              {emp.location === 'hyderabad' ? 'Hyderabad' : 'Bangalore'}
            </span>
            {isAdmin && (
              <span className="flex items-center gap-1">
                <IndianRupee className="h-3 w-3" />
                {emp.monthlySalary.toLocaleString('en-IN')}/mo
              </span>
            )}
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              Joined {new Date(emp.joinDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
            </span>
            <span className="flex items-center gap-1 bg-indigo-50/70 border border-indigo-100/70 text-indigo-800 px-2 py-0.5 rounded-md font-medium text-[11px]">
              <Clock className="h-3 w-3 text-indigo-600" />
              <span>
                {emp.shiftTiming?.expectedStart || (emp.location === 'bangalore' ? '09:00' : '06:00')} – {emp.shiftTiming?.expectedEnd || (emp.location === 'bangalore' ? '21:00' : '18:00')}
              </span>
              <span className="text-gray-400 text-[10px]">
                (Cutoff: {emp.shiftTiming?.cutoff || (emp.location === 'bangalore' ? '09:30' : '06:30')})
              </span>
            </span>
          </div>

          {/* Actions */}
          {isAdmin && (
            <div className="flex gap-2 shrink-0">
              <button
                onClick={() => onEdit(emp)}
                className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 hover:text-[#3b2fc9] hover:border-[#3b2fc9]/30 transition-colors"
                title="Edit"
              >
                <Edit2 className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => onDelete(emp)}
                className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-red-50 hover:text-red-500 hover:border-red-200 transition-colors"
                title="Delete"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>
        );
      })}
    </div>
  );
}
