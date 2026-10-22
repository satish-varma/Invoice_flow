'use client';

import React, { useEffect, useState, Suspense } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  CalendarDays,
  ArrowLeft,
  Loader2,
  CalendarCheck,
  Building2,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { NewRelicEmployee } from '@/types/employee';
import { SITE_OPTIONS, SiteId, resolveSiteId } from '@/types/site';
import { getActiveEmployees } from '@/services/newrelicEmployeeService';
import { LeavesAndHolidaysTab } from '@/components/newrelic/attendance/LeavesAndHolidaysTab';
import { triggerHaptic } from '@/lib/haptics';

function LeavesPageContent() {
  const router = useRouter();
  const { user, role, isReadOnly } = useAuth();
  const isOwnerOrAdmin = role === 'admin' || role === 'superadmin' || role === 'manager';
  const assignedSite = user?.assignedSite || 'newrelic';
  const [activeSiteFilter, setActiveSiteFilter] = useState<string>(() =>
    role === 'admin' || role === 'superadmin' ? 'all' : assignedSite
  );
  const [employees, setEmployees] = useState<NewRelicEmployee[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const siteParam = role === 'admin' || role === 'superadmin' ? undefined : assignedSite;
    getActiveEmployees(undefined, siteParam)
      .then((list) => {
        setEmployees(list);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [role, assignedSite]);

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-8 py-4 sm:py-8 space-y-6">
      {/* Navigation Breadcrumb */}
        <div className="flex items-center justify-between gap-3">
          <Link
            href="/newrelic/attendance"
            onClick={() => triggerHaptic('light')}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-indigo-600 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs transition-all active:scale-95 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Attendance & Clock-In
          </Link>

          {(role === 'admin' || role === 'superadmin') && (
            <div className="flex items-center gap-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Site Filter:</label>
              <select
                value={activeSiteFilter}
                onChange={(e) => setActiveSiteFilter(e.target.value)}
                className="h-9 px-3 text-xs font-bold border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
              >
                <option value="all">All Sites (Hyderabad & Bangalore)</option>
                {SITE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Hero Banner */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-[#134e4a] via-[#0f766e] to-[#1e1b4b] p-6 sm:p-8 text-white shadow-xl border border-white/10">
          <div className="absolute -top-24 -right-24 w-60 h-60 bg-teal-400/20 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 -left-24 w-60 h-60 bg-emerald-500/15 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <span className="text-[10px] font-extrabold tracking-widest uppercase bg-teal-300 text-teal-950 px-2 py-0.5 rounded-full">
                  Staff Roster & Leave Policy
                </span>
                <span className="text-[10px] bg-white/15 px-2.5 py-0.5 rounded-full font-bold border border-white/20 text-white">
                  Hyderabad &amp; Bangalore
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white flex items-center gap-2.5">
                <CalendarDays className="h-7 w-7 text-teal-300" />
                Leaves &amp; Holiday Calendar
              </h1>
              <p className="text-xs sm:text-sm text-teal-100/90 mt-1.5 max-w-2xl font-medium">
                Record planned leaves (Casual, Sick, Paid), review staff approvals, and inspect site-specific public holidays that automatically credit towards monthly payroll.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Link
                href="/newrelic/attendance?tab=payroll"
                className="px-4 py-2.5 rounded-2xl bg-white/15 hover:bg-white/25 border border-white/20 text-white text-xs font-bold transition-all flex items-center gap-2 backdrop-blur-md"
              >
                <CalendarCheck className="w-4 h-4 text-teal-200" />
                View Monthly Payroll
              </Link>
            </div>
          </div>
        </div>

        {/* Main Panel */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          {isLoading ? (
            <div className="p-16 flex flex-col items-center justify-center gap-3 text-slate-400">
              <Loader2 className="w-7 h-7 animate-spin text-teal-600" />
              <p className="text-xs font-semibold">Loading leaves and holiday calendar…</p>
            </div>
          ) : (
            <LeavesAndHolidaysTab
              employees={employees}
              userEmail={user?.email || undefined}
              isOwnerOrAdmin={isOwnerOrAdmin}
              activeSiteFilter={activeSiteFilter}
            />
          )}
        </div>
      </div>
  );
}

export default function LeavesPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-teal-600" />
        </div>
      }
    >
      <LeavesPageContent />
    </Suspense>
  );
}
