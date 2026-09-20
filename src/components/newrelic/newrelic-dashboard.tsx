'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { NewRelicChallan } from '@/types/newrelicChallan';
import { TrendingUp, TrendingDown, DollarSign, Package, Activity } from 'lucide-react';
import { cn } from '@/lib/utils';

interface NewRelicDashboardProps {
  challans: NewRelicChallan[];
}

const formatCurrency = (val: number) =>
  `₹${val.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function NewRelicDashboard({ challans }: NewRelicDashboardProps) {
  const calculateMetrics = (items: NewRelicChallan[]) => {
    let totalMrp = 0;
    let totalPCost = 0;
    let totalTransport = 0;
    let totalOther = 0;

    items.forEach((c) => {
      totalTransport += Number(c.transportCost || 0);
      totalOther += Number(c.otherCharges || 0);
      let thisChallanItemPCost = 0;
      c.lineItems?.forEach((item) => {
        const qty = Number(item.quantity || 0);
        totalMrp += Number(item.mrp || 0) * qty;
        thisChallanItemPCost += Number(item.procurementCost || 0) * qty;
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

  const StatCard = ({ title, value, subtext, icon: Icon, valueClass }: any) => (
    <Card className="shadow-sm border-gray-200">
      <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
        <CardTitle className="text-sm font-medium text-gray-500">{title}</CardTitle>
        <Icon className="w-4 h-4 text-gray-400" />
      </CardHeader>
      <CardContent>
        <div className={cn("text-2xl font-bold", valueClass)}>{value}</div>
        <p className="text-xs text-gray-500 mt-1">{subtext}</p>
      </CardContent>
    </Card>
  );

  if (challans.length === 0) return null;

  return (
    <div className="space-y-4 mb-8">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Volume"
          value={allMetrics.volume.toString()}
          subtext={`${blrMetrics.volume} BLR | ${hydMetrics.volume} HYD`}
          icon={Package}
        />
        <StatCard
          title="Total Revenue"
          value={formatCurrency(allMetrics.revenue)}
          subtext={`${formatCurrency(blrMetrics.revenue)} BLR | ${formatCurrency(hydMetrics.revenue)} HYD`}
          icon={Activity}
          valueClass="text-blue-600"
        />
        <StatCard
          title="Total Profit"
          value={formatCurrency(allMetrics.profit)}
          subtext={`${formatCurrency(blrMetrics.profit)} BLR | ${formatCurrency(hydMetrics.profit)} HYD`}
          icon={DollarSign}
          valueClass={allMetrics.profit >= 0 ? "text-green-600" : "text-red-600"}
        />
        <StatCard
          title="Profit Margin"
          value={`${allMetrics.margin.toFixed(2)}%`}
          subtext={`${blrMetrics.margin.toFixed(2)}% BLR | ${hydMetrics.margin.toFixed(2)}% HYD`}
          icon={allMetrics.margin >= 0 ? TrendingUp : TrendingDown}
          valueClass={allMetrics.margin >= 0 ? "text-green-600" : "text-red-600"}
        />
      </div>
    </div>
  );
}
