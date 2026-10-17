'use client';

import { DeclarationForm } from '@/components/declarations/declaration-form';
import { AppShell } from '@/components/app-shell';
import { ArrowLeft, Sparkles, FileCheck2 } from 'lucide-react';
import Link from 'next/link';
import { triggerHaptic } from '@/lib/haptics';

export default function DeclarationsPage() {
  return (
    <AppShell>
      <main className="min-h-screen bg-slate-50/60 dark:bg-slate-950 flex flex-col items-center p-3 sm:p-8">
        <div className="w-full max-w-7xl mx-auto space-y-6">
          {/* Mobile Large Title Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic('light');
                    window.history.back();
                  }}
                  className="sm:hidden p-2 -ml-2 rounded-xl text-slate-600 dark:text-slate-300 active:scale-95 transition-all"
                >
                  <ArrowLeft className="h-5 w-5" />
                </button>
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-gradient-to-r from-teal-500/10 via-cyan-500/10 to-teal-500/10 border border-teal-500/20 text-teal-600 dark:text-teal-400 text-[10px] sm:text-xs font-black tracking-widest uppercase shadow-xs">
                  <Sparkles className="h-3 w-3 animate-pulse" />
                  COMPLIANCE & TAX
                </div>
              </div>

              <h1 className="text-2xl sm:text-4xl font-black text-slate-900 dark:text-white tracking-tight">
                GST Declaration Generator
              </h1>
              <p className="text-slate-500 dark:text-slate-400 text-xs sm:text-sm font-medium">
                Generate official URD GST Declaration letterheads for EatGood Technologies (HungerBox)
              </p>
            </div>

            <div className="hidden sm:flex items-center gap-2">
              <Link
                href="/"
                onClick={() => triggerHaptic('light')}
                className="inline-flex items-center gap-2 h-10 px-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-bold text-slate-700 dark:text-slate-200 shadow-2xs hover:bg-slate-50 active:scale-95 transition-all"
              >
                <ArrowLeft className="h-4 w-4" />
                <span>Back to Home</span>
              </Link>
            </div>
          </div>

          <DeclarationForm />
        </div>
      </main>
    </AppShell>
  );
}
