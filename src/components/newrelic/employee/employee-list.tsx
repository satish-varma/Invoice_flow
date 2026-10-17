'use client';

import React from 'react';
import { NewRelicEmployee } from '@/types/employee';
import { resolveSiteId, COMPANY_SITES } from '@/types/site';
import { Edit2, Trash2, MapPin, IndianRupee, Calendar, UserCheck, UserX, Clock } from 'lucide-react';

import { triggerHaptic } from '@/lib/haptics';
import { cn } from '@/lib/utils';

interface EmployeeListProps {
  employees: NewRelicEmployee[];
  onEdit: (emp: NewRelicEmployee) => void;
  onDelete: (emp: NewRelicEmployee) => void;
  isAdmin?: boolean;
}

export function EmployeeList({ employees, onEdit, onDelete, isAdmin }: EmployeeListProps) {
  if (employees.length === 0) {
    return (
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 p-12 text-center text-slate-400 shadow-xs">
        <p className="text-sm font-medium">No employees found matching criteria.</p>
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
            ? 'bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border-purple-200/60 dark:border-purple-900/60'
            : siteId === 'ntt_data'
            ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200/60 dark:border-amber-900/60'
            : 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border-blue-200/60 dark:border-blue-900/60';

        return (
          <div
            key={emp.id}
            className={cn(
              "bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl border p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs transition-all",
              emp.isActive
                ? 'border-slate-200/80 dark:border-slate-800'
                : 'border-slate-100 dark:border-slate-800/60 opacity-60'
            )}
          >
            {/* Avatar & Info */}
            <div className="flex items-center gap-3.5 flex-1 min-w-0">
              <div
                className={cn(
                  "h-12 w-12 rounded-2xl flex items-center justify-center text-white font-black text-base shrink-0 shadow-sm",
                  emp.location === 'hyderabad'
                    ? 'bg-gradient-to-br from-[#3b2fc9] to-indigo-600'
                    : 'bg-gradient-to-br from-emerald-600 to-teal-600'
                )}
              >
                {emp.name.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-0.5">
                  <p className="font-bold text-slate-900 dark:text-white text-sm sm:text-base truncate">{emp.name}</p>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${siteBadgeStyles}`}>
                    {siteConfig?.name || siteId}
                  </span>
                  <span className="text-[10px] font-mono font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded-full">
                    {emp.employeeId}
                  </span>
                  {emp.isActive ? (
                    <span className="text-[10px] bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/50 px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                      <UserCheck className="h-3 w-3" /> Active
                    </span>
                  ) : (
                    <span className="text-[10px] bg-red-50 dark:bg-red-950/50 text-red-500 dark:text-red-400 border border-red-200 dark:border-red-900/50 px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                      <UserX className="h-3 w-3" /> Inactive
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                  {emp.designation}
                  {emp.email && <span className="ml-2 text-slate-400">({emp.email})</span>}
                </p>
              </div>
            </div>

            {/* Meta */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-slate-500 dark:text-slate-400 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100 dark:border-slate-800">
              <span className="flex items-center gap-1 font-medium">
                <MapPin className="h-3.5 w-3.5 text-slate-400" />
                {emp.location === 'hyderabad' ? 'Hyderabad' : 'Bangalore'}
              </span>
              {isAdmin && (
                <span className="flex items-center gap-1 font-mono font-bold text-slate-800 dark:text-slate-200">
                  <IndianRupee className="h-3.5 w-3.5 text-[#3b2fc9] dark:text-indigo-400" />
                  ₹{emp.monthlySalary.toLocaleString('en-IN')}/mo
                </span>
              )}
              <span className="flex items-center gap-1 font-medium">
                <Calendar className="h-3.5 w-3.5 text-slate-400" />
                Joined {new Date(emp.joinDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
              </span>
              <span className="flex items-center gap-1 bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-100/70 dark:border-indigo-900/60 text-indigo-800 dark:text-indigo-300 px-2.5 py-1 rounded-xl font-medium text-[11px]">
                <Clock className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
                <span className="font-mono font-semibold">
                  {emp.shiftTiming?.expectedStart || (emp.location === 'bangalore' ? '09:00' : '06:00')} – {emp.shiftTiming?.expectedEnd || (emp.location === 'bangalore' ? '21:00' : '18:00')}
                </span>
                <span className="text-slate-400 text-[10px]">
                  (Cutoff: {emp.shiftTiming?.cutoff || (emp.location === 'bangalore' ? '09:30' : '06:30')})
                </span>
              </span>
            </div>

            {/* Actions */}
            {isAdmin && (
              <div className="flex items-center gap-1.5 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100 dark:border-slate-800">
                <button
                  onClick={() => {
                    triggerHaptic('light');
                    onEdit(emp);
                  }}
                  className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-[#3b2fc9] hover:bg-indigo-50 dark:hover:bg-slate-800 transition-all active:scale-95"
                  title="Edit"
                >
                  <Edit2 className="h-4 w-4" />
                </button>
                <button
                  onClick={() => {
                    triggerHaptic('medium');
                    onDelete(emp);
                  }}
                  className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 transition-all active:scale-95"
                  title="Delete"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
