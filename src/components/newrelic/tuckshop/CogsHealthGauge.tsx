'use client';

import React from 'react';
import {
  ChefHat,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  TrendingDown,
  Info,
  DollarSign,
  Sparkles,
  ArrowRight,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { CategoryFinancialItem } from '@/services/tuckshopPnLService';
import { triggerHaptic } from '@/lib/haptics';

interface Props {
  cogsAmount: number;
  netRevenue: number;
  grossSales: number;
  cogsPercentage: number; // e.g. 28.5%
  topIngredients?: CategoryFinancialItem[];
  compact?: boolean;
}

export function CogsHealthGauge({
  cogsAmount,
  netRevenue,
  grossSales,
  cogsPercentage,
  topIngredients = [],
  compact = false,
}: Props) {
  // Determine Health Tier:
  // 🟢 Optimal (< 35%): Healthy food margin
  // 🟡 Watch (35% - 45%): High ingredient cost
  // 🔴 Alert (> 45%): Ingredients eating into HungerBox payout
  const isOptimal = cogsPercentage < 35;
  const isWatch = cogsPercentage >= 35 && cogsPercentage <= 45;
  const isAlert = cogsPercentage > 45;

  // Cost per HungerBox rupee earned (e.g. ₹0.28 per ₹1.00 net revenue)
  const costPerRupee = netRevenue > 0 ? (cogsAmount / netRevenue).toFixed(2) : '0.00';
  const costPerGrossRupee = grossSales > 0 ? (cogsAmount / grossSales).toFixed(2) : '0.00';

  // Gauge needle or progress percentage clamp (0 - 100)
  const clampedProgress = Math.min(100, Math.max(0, cogsPercentage));

  const tierBadge = isOptimal ? (
    <Badge className="bg-emerald-500 hover:bg-emerald-600 text-white font-black text-[11px] px-2.5 py-0.5 shadow-xs">
      🟢 Optimal (&lt; 35%)
    </Badge>
  ) : isWatch ? (
    <Badge className="bg-amber-500 hover:bg-amber-600 text-white font-black text-[11px] px-2.5 py-0.5 shadow-xs">
      🟡 Watch (35% – 45%)
    </Badge>
  ) : (
    <Badge className="bg-rose-600 hover:bg-rose-700 text-white font-black text-[11px] px-2.5 py-0.5 shadow-xs animate-pulse">
      🔴 Alert (&gt; 45%)
    </Badge>
  );

  const tierMessage = isOptimal
    ? 'Healthy Food Margin — High profitability retention. Raw material consumption is well-managed.'
    : isWatch
    ? 'Moderate Ingredient Cost — Portions or ingredient wastage should be audited to protect margin.'
    : 'Critical Ingredient Spend — Raw materials are eating heavily into your HungerBox net bank settlement!';

  if (compact) {
    return (
      <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <ChefHat className="w-4 h-4 text-cyan-600" />
            <span className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">
              Food Cost % (COGS)
            </span>
          </div>
          {tierBadge}
        </div>

        <div className="flex items-baseline justify-between">
          <div>
            <span className="text-2xl font-black font-mono text-slate-900 dark:text-white">
              {cogsPercentage}%
            </span>
            <span className="text-[11px] text-slate-400 ml-1.5 font-medium">of net payout</span>
          </div>
          <span className="text-xs font-mono font-bold text-cyan-700 dark:text-cyan-400">
            ₹{costPerRupee} / ₹1.00 net
          </span>
        </div>

        {/* Progress bar */}
        <div className="w-full bg-slate-100 dark:bg-slate-800 h-2.5 rounded-full overflow-hidden relative">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              isOptimal ? 'bg-emerald-500' : isWatch ? 'bg-amber-500' : 'bg-rose-600'
            }`}
            style={{ width: `${clampedProgress}%` }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="p-5 sm:p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div className="flex items-center gap-3">
          <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 shadow-md ${
            isOptimal
              ? 'bg-emerald-50 text-emerald-600 border border-emerald-200'
              : isWatch
              ? 'bg-amber-50 text-amber-600 border border-amber-200'
              : 'bg-rose-50 text-rose-600 border border-rose-200'
          }`}>
            <ChefHat className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-black text-slate-900 dark:text-white">
                Raw Material Food Cost % (COGS) Health Gauge
              </h3>
              {tierBadge}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Live ingredient efficiency benchmarked against HungerBox cashless settlements.
            </p>
          </div>
        </div>

        {/* Cost Per Rupee Banner */}
        <div className="px-3.5 py-2 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700 text-right shrink-0">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
            Ingredient Cost Ratio
          </span>
          <span className="text-sm sm:text-base font-black font-mono text-slate-900 dark:text-white">
            ₹{costPerRupee} <span className="text-xs font-normal text-slate-400">spent per ₹1.00 net</span>
          </span>
        </div>
      </div>

      {/* Main Gauge Visual Strip */}
      <div className="p-4 rounded-2xl bg-gradient-to-br from-slate-50 via-slate-50/50 to-white dark:from-slate-800/40 dark:to-slate-900 border border-slate-200/60 dark:border-slate-700 space-y-3">
        <div className="flex items-center justify-between text-xs">
          <span className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
            <span>Current Food Cost Ratio:</span>
            <strong className="text-base font-mono font-black text-slate-900 dark:text-white">
              {cogsPercentage}%
            </strong>
          </span>
          <span className="font-mono text-[11px] text-slate-400">
            Raw Material Spend: <strong>₹{cogsAmount.toLocaleString('en-IN')}</strong> / Net Payout: <strong>₹{netRevenue.toLocaleString('en-IN')}</strong>
          </span>
        </div>

        {/* Segmented Multi-Zone Gauge Track */}
        <div className="space-y-1.5">
          <div className="h-4 w-full bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden flex relative">
            {/* Zone 1: Optimal (0 - 35%) */}
            <div className="w-[35%] bg-emerald-500/20 border-r border-emerald-500/40 relative">
              <span className="absolute left-2 top-0 text-[8px] font-black text-emerald-800 dark:text-emerald-300">
                OPTIMAL (&lt;35%)
              </span>
            </div>
            {/* Zone 2: Watch (35 - 45%) */}
            <div className="w-[10%] bg-amber-500/20 border-r border-amber-500/40 relative">
              <span className="absolute left-1 top-0 text-[8px] font-black text-amber-800 dark:text-amber-300">
                WATCH
              </span>
            </div>
            {/* Zone 3: Alert (45 - 100%) */}
            <div className="w-[55%] bg-rose-500/20 relative">
              <span className="absolute left-2 top-0 text-[8px] font-black text-rose-800 dark:text-rose-300">
                CRITICAL (&gt;45%)
              </span>
            </div>

            {/* Active Needle Indicator */}
            <div
              className={`absolute top-0 bottom-0 rounded-full shadow-md transition-all duration-700 ${
                isOptimal ? 'bg-emerald-500' : isWatch ? 'bg-amber-500' : 'bg-rose-600'
              }`}
              style={{ width: `${clampedProgress}%` }}
            />
          </div>

          <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono">
            <span>0% (Zero Raw Material)</span>
            <span className="text-emerald-600 font-bold">35% Threshold</span>
            <span className="text-amber-600 font-bold">45% Danger Line</span>
            <span>100% (No Margin)</span>
          </div>
        </div>

        {/* Dynamic Context Banner */}
        <div className={`p-3 rounded-xl border text-xs flex items-center gap-2.5 ${
          isOptimal
            ? 'bg-emerald-50/70 border-emerald-200 text-emerald-900 dark:bg-emerald-950/30 dark:border-emerald-800 dark:text-emerald-300'
            : isWatch
            ? 'bg-amber-50/70 border-amber-200 text-amber-900 dark:bg-amber-950/30 dark:border-amber-800 dark:text-amber-300'
            : 'bg-rose-50/70 border-rose-200 text-rose-900 dark:bg-rose-950/30 dark:border-rose-800 dark:text-rose-300'
        }`}>
          {isOptimal ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600" />
          )}
          <span className="font-medium leading-relaxed">{tierMessage}</span>
        </div>
      </div>

      {/* Top Ingredient Contributors */}
      {topIngredients.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-slate-700 dark:text-slate-300">
              Primary Ingredient Spend Drivers:
            </span>
            <span className="text-[11px] text-slate-400">
              Share of food cost
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {topIngredients.slice(0, 4).map((ing) => (
              <div
                key={ing.category}
                className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700 flex flex-col justify-between"
              >
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
                  {ing.normalizedName}
                </span>
                <div className="flex items-center justify-between text-[11px] mt-1 pt-1 border-t border-slate-200/40 dark:border-slate-700">
                  <span className="font-mono font-black text-slate-900 dark:text-white">
                    ₹{ing.amount.toLocaleString('en-IN')}
                  </span>
                  <span className="text-[10px] font-bold text-cyan-600 dark:text-cyan-400">
                    {ing.percentageOfGroup}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
