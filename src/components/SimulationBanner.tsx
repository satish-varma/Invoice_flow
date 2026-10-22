'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { COMPANY_SITES } from '@/types/site';
import { triggerHaptic } from '@/lib/haptics';
import { Eye, LogOut, ShieldAlert, Sparkles, Building2, Layers } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function SimulationBanner() {
  const { isSimulating, simulatedUser, stopSimulation } = useAuth();
  const router = useRouter();

  if (!isSimulating || !simulatedUser) {
    return null;
  }

  const siteName = simulatedUser.assignedSite
    ? COMPANY_SITES[simulatedUser.assignedSite]?.name || simulatedUser.assignedSite
    : 'All Sites';

  const handleExit = () => {
    triggerHaptic('medium');
    stopSimulation();
    router.push('/admin/users');
  };

  return (
    <aside
      aria-label="Admin simulation mode active"
      className="sticky top-0 z-[100] w-full bg-gradient-to-r from-purple-950 via-indigo-950 to-slate-950 text-white shadow-xl border-b border-purple-500/30 backdrop-blur-md animate-in slide-in-from-top-3 duration-300"
    >
      <div className="max-w-7xl mx-auto px-3 sm:px-6 py-2.5 flex flex-wrap items-center justify-between gap-2.5">
        {/* Left: Indicator & Simulated Account info */}
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-purple-500/20 border border-purple-400/40 text-purple-300 text-[10px] sm:text-xs font-black tracking-wider uppercase shrink-0">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
            <Eye className="w-3.5 h-3.5 text-purple-300" />
            <span className="hidden sm:inline">Simulating User View</span>
            <span className="sm:hidden">Simulating</span>
          </div>

          <div className="flex items-center gap-2 min-w-0 flex-wrap">
            <span className="text-xs sm:text-sm font-black text-white truncate max-w-[200px] sm:max-w-xs" title={simulatedUser.email}>
              {simulatedUser.email}
            </span>

            {/* Role pill */}
            <span className="px-2 py-0.2 rounded-full text-[10px] font-black uppercase tracking-wider bg-white/10 text-purple-200 border border-white/15 shrink-0">
              {simulatedUser.role === 'guest' ? 'GUEST (READ-ONLY)' : simulatedUser.role.toUpperCase()}
            </span>

            {/* Site pill */}
            <span className="hidden md:inline-flex items-center gap-1 px-2 py-0.2 rounded-full text-[10px] font-bold bg-white/10 text-indigo-200 border border-white/15 shrink-0">
              <Building2 className="w-2.5 h-2.5" />
              {siteName}
            </span>

            {/* Endpoints pill */}
            {simulatedUser.allowedTabs && simulatedUser.allowedTabs.length > 0 && (
              <span className="hidden lg:inline-flex items-center gap-1 px-2 py-0.2 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 shrink-0">
                <Layers className="w-2.5 h-2.5" />
                {simulatedUser.allowedTabs.length} Tabs
              </span>
            )}
          </div>
        </div>

        {/* Right: Exit Simulation Button */}
        <div className="flex items-center gap-2 shrink-0">
          <Button
            type="button"
            size="sm"
            onClick={handleExit}
            className="h-8 px-3 rounded-xl bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-700 hover:to-amber-700 text-white font-bold text-xs shadow-md shadow-rose-900/30 flex items-center gap-1.5 active:scale-95 transition-all cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Exit Preview</span>
          </Button>
        </div>
      </div>
    </aside>
  );
}
