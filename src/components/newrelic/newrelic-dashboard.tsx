'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { NewRelicChallan } from '@/types/challan';
import { TrendingUp, TrendingDown, DollarSign, Package, Activity } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

interface NewRelicDashboardProps {
  challans: NewRelicChallan[];
  showFinancials?: boolean;
}

const formatCurrency = (val: number) =>
  `₹${val.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function NewRelicDashboard({ challans, showFinancials }: NewRelicDashboardProps) {
  if (!showFinancials) return null;
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

    return { volume: items.length, revenue, cost, profit, margin };
  };

  const allMetrics = calculateMetrics(challans);
  const blrMetrics = calculateMetrics(challans.filter((c) => c.location === 'bangalore'));
  const hydMetrics = calculateMetrics(challans.filter((c) => c.location === 'hyderabad'));

  const StatCard = ({ title, value, subtext, icon: Icon, cardBg, iconBg, valueClass }: any) => (
    <Card className={cn("shadow-xs hover:shadow-md transition-shadow border overflow-hidden relative", cardBg || "bg-white border-gray-200")}>
      <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
        <CardTitle className="text-xs font-bold text-gray-600 uppercase tracking-wider">{title}</CardTitle>
        <div className={cn("w-8 h-8 rounded-xl flex items-center justify-center shadow-xs", iconBg || "bg-gray-100 text-gray-600")}>
          <Icon className="w-4 h-4" />
        </div>
      </CardHeader>
      <CardContent>
        <div className={cn("text-2xl font-black tracking-tight", valueClass)}>{value}</div>
        <p className="text-[11px] font-semibold text-gray-500 mt-1 flex items-center gap-1.5">{subtext}</p>
      </CardContent>
    </Card>
  );

  if (challans.length === 0) return null;

  return (
    <div className="space-y-4 mb-6">
      <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">
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
