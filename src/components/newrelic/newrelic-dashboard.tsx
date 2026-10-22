'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { NewRelicChallan } from '@/types/challan';
import { TrendingUp, TrendingDown, DollarSign, Package, Activity, Lock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

interface NewRelicDashboardProps {
  challans: NewRelicChallan[];
  showFinancials?: boolean;
}

const formatCurrency = (val: number) =>
  `₹${val.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function NewRelicDashboard({ challans, showFinancials }: NewRelicDashboardProps) {
  if (challans.length === 0) return null;

  const calculateMetrics = (items: NewRelicChallan[]) => {
    let totalMrp = 0;
    let totalPCost = 0;
    let totalTransport = 0;
    let totalOther = 0;

    items.forEach((c) => {
      totalTransport += Number(c.transportCost || 0);
      totalOther += Number(c.otherCharges || 0);
      let thisChallanItemPCost = 0;
      c.lineItems?.forEach((item: any) => {
        const qty = Number(item.quantity || 0);
        totalMrp += Number(item.mrp || 0) * qty;
        thisChallanItemPCost += (Number(item.procurementCost) || 0) * qty;
      });

      // Prevent double counting: Use the explicitly saved global procurement cost,
      // fallback to the per-item calculation if the global field is missing.
      if (c.procurementCost !== undefined && c.procurementCost !== null) {
         totalPCost += Number(c.procurementCost);
      } else {
         totalPCost += thisChallanItemPCost;
      }
    });

    const revenue = totalMrp - totalMrp * 0.055; // 5.5% commission
    const cost = totalPCost + totalTransport + totalOther;
    const profit = revenue - cost;
    const margin = revenue > 0 ? (profit / revenue) * 100 : 0;

    return { volume: items.length, totalMrp, revenue, cost, profit, margin };
  };

  const allMetrics = calculateMetrics(challans);
  const blrMetrics = calculateMetrics(challans.filter((c) => c.location === 'bangalore'));
  const hydMetrics = calculateMetrics(challans.filter((c) => c.location === 'hyderabad'));

  const StatCard = ({ title, value, subtext, icon: Icon, cardBg, iconBg, valueClass }: any) => (
    <Card className={cn("min-w-0 w-full shadow-[0_4px_16px_-4px_rgba(0,0,0,0.06)] hover:shadow-md transition-shadow border overflow-hidden relative rounded-2xl sm:rounded-3xl", cardBg || "bg-white border-slate-200")}>
      <CardHeader className="min-w-0 flex flex-row items-center justify-between pb-1 sm:pb-2 p-3 sm:p-5 space-y-0">
        <CardTitle className="text-[10px] sm:text-xs font-black text-slate-500 uppercase tracking-wider truncate min-w-0">{title}</CardTitle>
        <div className={cn("w-7 h-7 sm:w-8 sm:h-8 rounded-xl flex items-center justify-center shadow-xs shrink-0", iconBg || "bg-slate-100 text-slate-600")}>
          <Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
        </div>
      </CardHeader>
      <CardContent className="min-w-0 p-3 sm:p-5 pt-0 sm:pt-0">
        <div className={cn("text-base sm:text-2xl font-black font-mono tracking-tight truncate min-w-0", valueClass)}>{value}</div>
        <p className="text-[10px] sm:text-xs font-semibold text-slate-500 mt-0.5 sm:mt-1 block truncate min-w-0" title={subtext}>{subtext}</p>
      </CardContent>
    </Card>
  );

  // If financials are locked / off: Always show Volume and Total Value for cycle to admin
  if (!showFinancials) {
    return (
      <div className="space-y-4 mb-4 sm:mb-6 w-full max-w-full min-w-0">
        <div className="grid gap-2.5 sm:gap-4 grid-cols-2 lg:grid-cols-3 w-full max-w-full min-w-0">
          <StatCard
            title="Total Volume"
            value={allMetrics.volume.toString()}
            subtext={`${blrMetrics.volume} BLR · ${hydMetrics.volume} HYD`}
            icon={Package}
            cardBg="bg-gradient-to-br from-indigo-50/90 via-white to-purple-50/50 border-indigo-200/80"
            iconBg="bg-gradient-to-tr from-indigo-600 to-violet-600 text-white shadow-indigo-200"
            valueClass="text-indigo-950"
          />
          <StatCard
            title="Total Cycle Value"
            value={formatCurrency(allMetrics.totalMrp)}
            subtext={`${formatCurrency(blrMetrics.totalMrp)} BLR · ${formatCurrency(hydMetrics.totalMrp)} HYD`}
            icon={DollarSign}
            cardBg="bg-gradient-to-br from-blue-50/90 via-white to-cyan-50/50 border-blue-200/80"
            iconBg="bg-gradient-to-tr from-blue-600 to-cyan-600 text-white shadow-blue-200"
            valueClass="text-blue-900"
          />
          <Card className="min-w-0 col-span-2 lg:col-span-1 shadow-xs border border-dashed border-slate-300 bg-slate-50/80 rounded-2xl sm:rounded-3xl flex flex-col justify-center p-3.5 sm:p-5">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
              <Lock className="w-4 h-4 text-slate-400 shrink-0" />
              <span className="truncate">Financials Protected</span>
            </div>
            <p className="text-[11px] text-slate-500 mt-1 font-medium leading-snug">
              Unlock financials above to view Net Revenue, Cost Breakdown, and Profit.
            </p>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 mb-4 sm:mb-6 w-full max-w-full min-w-0">
      <div className="grid gap-2.5 sm:gap-4 grid-cols-2 lg:grid-cols-4 w-full max-w-full min-w-0">
        <StatCard
          title="Total Volume"
          value={allMetrics.volume.toString()}
          subtext={`${blrMetrics.volume} BLR · ${hydMetrics.volume} HYD`}
          icon={Package}
          cardBg="bg-gradient-to-br from-indigo-50/90 via-white to-purple-50/50 border-indigo-200/80"
          iconBg="bg-gradient-to-tr from-indigo-600 to-violet-600 text-white shadow-indigo-200"
          valueClass="text-indigo-950"
        />
        <StatCard
          title="Total Revenue"
          value={formatCurrency(allMetrics.revenue)}
          subtext={`${formatCurrency(blrMetrics.revenue)} BLR · ${formatCurrency(hydMetrics.revenue)} HYD`}
          icon={Activity}
          cardBg="bg-gradient-to-br from-blue-50/90 via-white to-cyan-50/50 border-blue-200/80"
          iconBg="bg-gradient-to-tr from-blue-600 to-cyan-600 text-white shadow-blue-200"
          valueClass="text-blue-900"
        />
        <StatCard
          title="Total Profit"
          value={formatCurrency(allMetrics.profit)}
          subtext={`${formatCurrency(blrMetrics.profit)} BLR · ${formatCurrency(hydMetrics.profit)} HYD`}
          icon={DollarSign}
          cardBg={allMetrics.profit >= 0 ? "bg-gradient-to-br from-emerald-50/90 via-white to-teal-50/50 border-emerald-200/80" : "bg-gradient-to-br from-rose-50/90 via-white to-red-50/50 border-rose-200/80"}
          iconBg={allMetrics.profit >= 0 ? "bg-gradient-to-tr from-emerald-600 to-teal-600 text-white shadow-emerald-200" : "bg-gradient-to-tr from-rose-600 to-red-600 text-white shadow-rose-200"}
          valueClass={allMetrics.profit >= 0 ? "text-emerald-900" : "text-rose-900"}
        />
        <StatCard
          title="Profit Margin"
          value={`${allMetrics.margin.toFixed(2)}%`}
          subtext={`${blrMetrics.margin.toFixed(2)}% BLR · ${hydMetrics.margin.toFixed(2)}% HYD`}
          icon={allMetrics.margin >= 0 ? TrendingUp : TrendingDown}
          cardBg={allMetrics.margin >= 0 ? "bg-gradient-to-br from-amber-50/90 via-white to-orange-50/50 border-amber-200/80" : "bg-gradient-to-br from-rose-50/90 via-white to-red-50/50 border-rose-200/80"}
          iconBg={allMetrics.margin >= 0 ? "bg-gradient-to-tr from-amber-500 to-orange-500 text-white shadow-amber-200" : "bg-gradient-to-tr from-rose-600 to-red-600 text-white shadow-rose-200"}
          valueClass={allMetrics.margin >= 0 ? "text-amber-900" : "text-rose-900"}
        />
      </div>
    </div>
  );
}
