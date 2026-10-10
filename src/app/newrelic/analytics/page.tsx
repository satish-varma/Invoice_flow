'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { getNewRelicChallans } from '@/services/newrelicChallanService';
import { getTuckshopRecords, NewRelicTuckshopRecord } from '@/services/newrelicTuckshopService';
import { getEmployees, getAllSalaryPayments } from '@/services/newrelicEmployeeService';
import { NewRelicChallan } from '@/types/challan';
import { NewRelicEmployee, NewRelicSalaryPayment } from '@/types/employee';
import { useAuth } from '@/contexts/AuthContext';
import {
  Loader2,
  ArrowLeft,
  BarChart2,
  TrendingUp,
  TrendingDown,
  PieChart as PieChartIcon,
  MapPin,
  DollarSign,
  Users,
  Store,
  Truck,
  ArrowUpRight,
  ArrowDownRight,
  ShieldAlert,
} from 'lucide-react';
import Link from 'next/link';
import { FinancialGate } from '@/components/newrelic/financial-gate';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  LineChart,
  Line,
  AreaChart,
  Area,
} from 'recharts';

const COLORS = ['#3b2fc9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#6366f1'];

export default function AnalyticsDashboardPage() {
  const { role } = useAuth();
  const isAdmin = role === 'admin' || role === 'superadmin' || role === 'manager';

  const [challans, setChallans] = useState<NewRelicChallan[]>([]);
  const [tuckshopRecords, setTuckshopRecords] = useState<NewRelicTuckshopRecord[]>([]);
  const [employees, setEmployees] = useState<NewRelicEmployee[]>([]);
  const [salaryPayments, setSalaryPayments] = useState<NewRelicSalaryPayment[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Active view tab: 'overview' | 'comparison' | 'ledger'
  const [activeTab, setActiveTab] = useState<'comparison' | 'ledger' | 'overview'>('comparison');

  useEffect(() => {
    async function loadData() {
      try {
        const [dcData, tuckData, empData, payData] = await Promise.all([
          getNewRelicChallans(),
          getTuckshopRecords().catch(() => []),
          getEmployees().catch(() => []),
          getAllSalaryPayments().catch(() => []),
        ]);
        setChallans(dcData);
        setTuckshopRecords(tuckData);
        setEmployees(empData);
        setSalaryPayments(payData);
      } catch (err) {
        console.error('Failed to load executive analytics data', err);
      } finally {
        setIsLoading(false);
      }
    }

    if (isAdmin) {
      loadData();
    } else {
      setIsLoading(false);
    }
  }, [isAdmin]);

  const formatCurrency = (val: number) => {
    if (Math.abs(val) >= 10000000) return `₹${(val / 10000000).toFixed(2)}Cr`;
    if (Math.abs(val) >= 100000) return `₹${(val / 100000).toFixed(2)}L`;
    return `₹${val.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
  };

  /* ─────────────────────────────────────────────────────────────
     1. LOCATION COMPARISON DASHBOARD (HYDERABAD vs BANGALORE)
  ───────────────────────────────────────────────────────────── */
  const locationComparison = useMemo(() => {
    const hyd = {
      location: 'Hyderabad',
      procurementCost: 0,
      tuckshopSales: 0,
      tuckshopExpenses: 0,
      dcCount: 0,
      unitsDelivered: 0,
      activeEmployees: 0,
      totalPayroll: 0,
      vendors: {} as Record<string, number>,
    };

    const blr = {
      location: 'Bangalore',
      procurementCost: 0,
      tuckshopSales: 0,
      tuckshopExpenses: 0,
      dcCount: 0,
      unitsDelivered: 0,
      activeEmployees: 0,
      totalPayroll: 0,
      vendors: {} as Record<string, number>,
    };

    // Tally DC Procurement Costs & Units
    challans.forEach((c) => {
      const loc = c.location === 'bangalore' ? blr : hyd;
      loc.dcCount++;

      let lineItemsCost = 0;
      (c.lineItems || []).forEach((item) => {
        const qty = Number(item.quantity) || 0;
        loc.unitsDelivered += qty;
        const pCost = Number(item.procurementCost) || 0;
        lineItemsCost += pCost * qty;

        // Vendor / Brand reliance
        const brand = (item.brandName || 'Unspecified').trim();
        loc.vendors[brand] = (loc.vendors[brand] || 0) + (pCost > 0 ? pCost * qty : qty * 10);
      });

      const totalDcCost = (c.procurementCost !== undefined && c.procurementCost !== null ? Number(c.procurementCost) : lineItemsCost)
        + Number(c.transportCost || 0)
        + Number(c.otherCharges || 0);

      loc.procurementCost += totalDcCost;
    });

    // Tally Tuckshop Revenue & Daily Expenses
    tuckshopRecords.forEach((t) => {
      const isBlr = (t.location || '').toLowerCase().includes('bangalore') || (t.location || '').toLowerCase().includes('blr');
      const loc = isBlr ? blr : hyd;
      const amt = Number(t.amount) || 0;
      if (t.type === 'sale') {
        loc.tuckshopSales += amt;
      } else {
        loc.tuckshopExpenses += amt;
      }
    });

    // Tally Employees & Base Salaries
    employees.forEach((e) => {
      if (!e.isActive) return;
      if (e.location === 'bangalore') {
        blr.activeEmployees++;
        blr.totalPayroll += (Number(e.monthlySalary) || 0);
      } else {
        hyd.activeEmployees++;
        hyd.totalPayroll += (Number(e.monthlySalary) || 0);
      }
    });

    // Top vendors per location
    const hydTopVendors = Object.entries(hyd.vendors)
      .map(([brand, spend]) => ({ brand, spend }))
      .sort((a, b) => b.spend - a.spend)
      .slice(0, 5);

    const blrTopVendors = Object.entries(blr.vendors)
      .map(([brand, spend]) => ({ brand, spend }))
      .sort((a, b) => b.spend - a.spend)
      .slice(0, 5);

    return { hyd, blr, hydTopVendors, blrTopVendors };
  }, [challans, tuckshopRecords, employees]);

  /* ─────────────────────────────────────────────────────────────
     2. MONTHLY PROCUREMENT VS SALES LEDGER (P&L CALCULATION)
  ───────────────────────────────────────────────────────────── */
  const monthlyLedger = useMemo(() => {
    const map: Record<string, {
      monthKey: string;
      monthLabel: string;
      dcProcurementCost: number;
      tuckshopSales: number;
      tuckshopExpenses: number;
      payrollPaid: number;
      totalRevenue: number;
      totalOperatingCost: number;
      netProfit: number;
      profitMarginPercent: number;
    }> = {};

    const getMonthKey = (dateStr: string) => {
      try {
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return null;
        return d.toISOString().substring(0, 7); // YYYY-MM
      } catch {
        return null;
      }
    };

    // 1. Process Challans Procurement Cost
    challans.forEach((c) => {
      const key = getMonthKey(c.dcDate);
      if (!key) return;

      if (!map[key]) {
        const d = new Date(`${key}-01`);
        map[key] = {
          monthKey: key,
          monthLabel: d.toLocaleString('en-IN', { month: 'short', year: '2-digit' }),
          dcProcurementCost: 0,
          tuckshopSales: 0,
          tuckshopExpenses: 0,
          payrollPaid: 0,
          totalRevenue: 0,
          totalOperatingCost: 0,
          netProfit: 0,
          profitMarginPercent: 0,
        };
      }

      let lineItemsCost = 0;
      (c.lineItems || []).forEach((item) => {
        lineItemsCost += (Number(item.procurementCost) || 0) * (Number(item.quantity) || 1);
      });

      const totalCost = (c.procurementCost !== undefined && c.procurementCost !== null ? Number(c.procurementCost) : lineItemsCost)
        + Number(c.transportCost || 0)
        + Number(c.otherCharges || 0);

      map[key].dcProcurementCost += totalCost;
    });

    // 2. Process Tuckshop Sales & Expenses
    tuckshopRecords.forEach((t) => {
      const key = getMonthKey(t.date);
      if (!key) return;

      if (!map[key]) {
        const d = new Date(`${key}-01`);
        map[key] = {
          monthKey: key,
          monthLabel: d.toLocaleString('en-IN', { month: 'short', year: '2-digit' }),
          dcProcurementCost: 0,
          tuckshopSales: 0,
          tuckshopExpenses: 0,
          payrollPaid: 0,
          totalRevenue: 0,
          totalOperatingCost: 0,
          netProfit: 0,
          profitMarginPercent: 0,
        };
      }

      const amt = Number(t.amount) || 0;
      if (t.type === 'sale') {
        map[key].tuckshopSales += amt;
      } else {
        map[key].tuckshopExpenses += amt;
      }
    });

    // 3. Process Disbursed Payroll (from salary payments)
    salaryPayments.forEach((p) => {
      const key = p.month || (p.paymentDate ? getMonthKey(p.paymentDate) : null);
      if (!key) return;

      if (!map[key]) {
        const d = new Date(`${key}-01`);
        map[key] = {
          monthKey: key,
          monthLabel: d.toLocaleString('en-IN', { month: 'short', year: '2-digit' }),
          dcProcurementCost: 0,
          tuckshopSales: 0,
          tuckshopExpenses: 0,
          payrollPaid: 0,
          totalRevenue: 0,
          totalOperatingCost: 0,
          netProfit: 0,
          profitMarginPercent: 0,
        };
      }

      map[key].payrollPaid += Number(p.netPaidAmount || p.attendanceEarned || 0);
    });

    // Finalize Totals & Net P&L per month
    const list = Object.values(map).map((row) => {
      const totalRevenue = row.tuckshopSales;
      const totalOperatingCost = row.dcProcurementCost + row.tuckshopExpenses + row.payrollPaid;
      const netProfit = totalRevenue - totalOperatingCost;
      const profitMarginPercent = totalRevenue > 0 ? parseFloat(((netProfit / totalRevenue) * 100).toFixed(1)) : 0;

      return {
        ...row,
        totalRevenue,
        totalOperatingCost,
        netProfit,
        profitMarginPercent,
      };
    });

    return list.sort((a, b) => a.monthKey.localeCompare(b.monthKey));
  }, [challans, tuckshopRecords, salaryPayments]);

  // Overall Financial Totals
  const overallFinancials = useMemo(() => {
    let totalRev = 0;
    let totalProcurement = 0;
    let totalExpenses = 0;
    let totalPayroll = 0;

    monthlyLedger.forEach((m) => {
      totalRev += m.totalRevenue;
      totalProcurement += m.dcProcurementCost;
      totalExpenses += m.tuckshopExpenses;
      totalPayroll += m.payrollPaid;
    });

    const totalCost = totalProcurement + totalExpenses + totalPayroll;
    const netProfit = totalRev - totalCost;
    const netMargin = totalRev > 0 ? (netProfit / totalRev) * 100 : 0;

    return {
      totalRev,
      totalProcurement,
      totalExpenses,
      totalPayroll,
      totalCost,
      netProfit,
      netMargin,
    };
  }, [monthlyLedger]);

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center p-8 bg-white rounded-2xl border border-gray-200 shadow-sm max-w-md">
          <ShieldAlert className="h-10 w-10 text-amber-500 mx-auto mb-3" />
          <h2 className="text-base font-bold text-gray-800">Restricted Access</h2>
          <p className="text-xs text-gray-500 mt-1">Executive Insights & Reporting are only accessible by Administrators and Managers.</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="h-8 w-8 animate-spin text-[#3b2fc9]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50/50 pb-20">
      <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6">

        {/* ── Header ── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <Link href="/newrelic" className="p-2 -ml-2 rounded-full hover:bg-gray-100 transition-colors text-gray-500">
                <ArrowLeft className="h-5 w-5" />
              </Link>
              <h1 className="text-2xl font-black text-gray-900 tracking-tight flex items-center gap-2">
                <BarChart2 className="h-6 w-6 text-[#3b2fc9]" />
                Executive Insights & P&L Reporting
              </h1>
            </div>
            <p className="text-xs text-gray-500 ml-10">
              Cross-location comparison (HYD vs BLR), monthly procurement vs tuckshop revenue, and cafeteria P&L ledger.
            </p>
          </div>

          {/* Navigation Pill Switcher */}
          <div className="flex items-center gap-1.5 p-1 bg-white border border-gray-200 rounded-xl shadow-xs">
            <button
              onClick={() => setActiveTab('comparison')}
              className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeTab === 'comparison'
                  ? 'bg-[#3b2fc9] text-white shadow-xs'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              <MapPin className="h-3.5 w-3.5" />
              HYD vs BLR Comparison
            </button>
            <button
              onClick={() => setActiveTab('ledger')}
              className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeTab === 'ledger'
                  ? 'bg-[#3b2fc9] text-white shadow-xs'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              <DollarSign className="h-3.5 w-3.5" />
              Monthly P&L Ledger
            </button>
          </div>
        </div>

        {/* ── Protected Financial Content Gated Behind Password ── */}
        <FinancialGate
          title="Executive Financials & P&L Locked"
          description="Cafeteria P&L, monthly procurement spend, tuckshop revenue, and vendor margins are protected. Authenticate to view."
        >
          {/* ── Executive KPI Metric Cards ── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className="bg-white p-4 rounded-2xl border border-gray-200/80 shadow-xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block">Tuckshop Revenue</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-xl font-black text-emerald-600">{formatCurrency(overallFinancials.totalRev)}</span>
            </div>
            <span className="text-[11px] text-gray-500 mt-1 flex items-center gap-1">
              <Store className="h-3 w-3 text-emerald-500" /> Total registered sales
            </span>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-gray-200/80 shadow-xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block">DC Procurement Cost</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-xl font-black text-blue-600">{formatCurrency(overallFinancials.totalProcurement)}</span>
            </div>
            <span className="text-[11px] text-gray-500 mt-1 flex items-center gap-1">
              <Truck className="h-3 w-3 text-blue-500" /> Goods & Transport (DCs)
            </span>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-gray-200/80 shadow-xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block">Staff Payroll Disbursed</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-xl font-black text-amber-600">{formatCurrency(overallFinancials.totalPayroll)}</span>
            </div>
            <span className="text-[11px] text-gray-500 mt-1 flex items-center gap-1">
              <Users className="h-3 w-3 text-amber-500" /> Attendance-based pay
            </span>
          </div>

          <div className={`p-4 rounded-2xl border shadow-xs ${
            overallFinancials.netProfit >= 0 ? 'bg-emerald-50/50 border-emerald-200' : 'bg-red-50/50 border-red-200'
          }`}>
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500 block">Net Cafeteria P&L</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className={`text-xl font-black ${overallFinancials.netProfit >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                {formatCurrency(overallFinancials.netProfit)}
              </span>
              <span className={`text-xs font-bold ${overallFinancials.netProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                {overallFinancials.netMargin.toFixed(1)}%
              </span>
            </div>
            <span className="text-[11px] text-gray-500 mt-1 block">
              {overallFinancials.netProfit >= 0 ? 'Net Operating Surplus' : 'Operating Deficit'}
            </span>
          </div>
        </div>

        {/* ─────────────────────────────────────────────────────────────
            TAB 1: HYDERABAD VS BANGALORE LOCATION COMPARISON
        ───────────────────────────────────────────────────────────── */}
        {activeTab === 'comparison' && (
          <div className="space-y-6">
            
            {/* Side-by-Side KPI Matrix */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden">
              <div className="p-4 sm:p-5 border-b border-gray-100 flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-gray-900 text-sm flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-[#3b2fc9]" />
                    HYD vs BLR Head-to-Head Performance
                  </h3>
                  <p className="text-xs text-gray-500">Comparing operational footprint and costs across both distribution centers.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-gray-100">
                {/* Hyderabad Column */}
                <div className="p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="h-8 w-8 rounded-full bg-[#3b2fc9]/10 text-[#3b2fc9] flex items-center justify-center font-bold text-xs">
                        HYD
                      </div>
                      <span className="font-bold text-base text-gray-900">Hyderabad DC</span>
                    </div>
                    <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-blue-50 text-[#3b2fc9]">
                      {locationComparison.hyd.activeEmployees} Staff Members
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
                      <span className="text-gray-400 block text-[10px] uppercase font-bold">Procurement Spend</span>
                      <span className="font-extrabold text-base text-gray-900 block mt-0.5">
                        {formatCurrency(locationComparison.hyd.procurementCost)}
                      </span>
                      <span className="text-[10px] text-gray-500">{locationComparison.hyd.dcCount} DCs Filed</span>
                    </div>

                    <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
                      <span className="text-gray-400 block text-[10px] uppercase font-bold">Tuckshop Revenue</span>
                      <span className="font-extrabold text-base text-emerald-600 block mt-0.5">
                        {formatCurrency(locationComparison.hyd.tuckshopSales)}
                      </span>
                      <span className="text-[10px] text-gray-500">Sales recorded</span>
                    </div>

                    <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
                      <span className="text-gray-400 block text-[10px] uppercase font-bold">Units Consumed</span>
                      <span className="font-extrabold text-base text-purple-700 block mt-0.5">
                        {locationComparison.hyd.unitsDelivered.toLocaleString('en-IN')}
                      </span>
                      <span className="text-[10px] text-gray-500">Total item packs</span>
                    </div>

                    <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
                      <span className="text-gray-400 block text-[10px] uppercase font-bold">Monthly Payroll Base</span>
                      <span className="font-extrabold text-base text-amber-700 block mt-0.5">
                        {formatCurrency(locationComparison.hyd.totalPayroll)}
                      </span>
                      <span className="text-[10px] text-gray-500">Active base salaries</span>
                    </div>
                  </div>

                  {/* Top Vendor Reliance HYD */}
                  <div className="pt-2">
                    <span className="text-[11px] font-bold text-gray-700 block mb-2">Top Brands by Procurement Volume</span>
                    <div className="space-y-1.5">
                      {locationComparison.hydTopVendors.map((v, i) => (
                        <div key={i} className="flex items-center justify-between text-xs py-1 px-2.5 bg-gray-50/70 rounded-lg">
                          <span className="font-medium text-gray-700 truncate">{v.brand}</span>
                          <span className="font-bold text-gray-900">{formatCurrency(v.spend)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Bangalore Column */}
                <div className="p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="h-8 w-8 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-xs">
                        BLR
                      </div>
                      <span className="font-bold text-base text-gray-900">Bangalore DC</span>
                    </div>
                    <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700">
                      {locationComparison.blr.activeEmployees} Staff Members
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
                      <span className="text-gray-400 block text-[10px] uppercase font-bold">Procurement Spend</span>
                      <span className="font-extrabold text-base text-gray-900 block mt-0.5">
                        {formatCurrency(locationComparison.blr.procurementCost)}
                      </span>
                      <span className="text-[10px] text-gray-500">{locationComparison.blr.dcCount} DCs Filed</span>
                    </div>

                    <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
                      <span className="text-gray-400 block text-[10px] uppercase font-bold">Tuckshop Revenue</span>
                      <span className="font-extrabold text-base text-emerald-600 block mt-0.5">
                        {formatCurrency(locationComparison.blr.tuckshopSales)}
                      </span>
                      <span className="text-[10px] text-gray-500">Sales recorded</span>
                    </div>

                    <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
                      <span className="text-gray-400 block text-[10px] uppercase font-bold">Units Consumed</span>
                      <span className="font-extrabold text-base text-purple-700 block mt-0.5">
                        {locationComparison.blr.unitsDelivered.toLocaleString('en-IN')}
                      </span>
                      <span className="text-[10px] text-gray-500">Total item packs</span>
                    </div>

                    <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
                      <span className="text-gray-400 block text-[10px] uppercase font-bold">Monthly Payroll Base</span>
                      <span className="font-extrabold text-base text-amber-700 block mt-0.5">
                        {formatCurrency(locationComparison.blr.totalPayroll)}
                      </span>
                      <span className="text-[10px] text-gray-500">Active base salaries</span>
                    </div>
                  </div>

                  {/* Top Vendor Reliance BLR */}
                  <div className="pt-2">
                    <span className="text-[11px] font-bold text-gray-700 block mb-2">Top Brands by Procurement Volume</span>
                    <div className="space-y-1.5">
                      {locationComparison.blrTopVendors.map((v, i) => (
                        <div key={i} className="flex items-center justify-between text-xs py-1 px-2.5 bg-gray-50/70 rounded-lg">
                          <span className="font-medium text-gray-700 truncate">{v.brand}</span>
                          <span className="font-bold text-gray-900">{formatCurrency(v.spend)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Side-by-Side Visual Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Procurement Spend Comparison */}
              <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs">
                <h4 className="text-sm font-bold text-gray-800 mb-4 flex items-center gap-2">
                  <BarChart2 className="h-4 w-4 text-[#3b2fc9]" />
                  Procurement Cost by Location
                </h4>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={[
                        { name: 'Hyderabad', Cost: locationComparison.hyd.procurementCost, Revenue: locationComparison.hyd.tuckshopSales },
                        { name: 'Bangalore', Cost: locationComparison.blr.procurementCost, Revenue: locationComparison.blr.tuckshopSales },
                      ]}
                      margin={{ top: 10, right: 10, left: 10, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} />
                      <YAxis axisLine={false} tickLine={false} tickFormatter={formatCurrency} />
                      <Tooltip formatter={(val: number) => formatCurrency(val)} />
                      <Legend />
                      <Bar dataKey="Cost" fill="#3b2fc9" name="Procurement (DCs)" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="Revenue" fill="#10b981" name="Tuckshop Revenue" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Units Consumed vs Staffing */}
              <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs">
                <h4 className="text-sm font-bold text-gray-800 mb-4 flex items-center gap-2">
                  <Users className="h-4 w-4 text-purple-600" />
                  Staffing & Payroll Comparison
                </h4>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={[
                        { name: 'Hyderabad', Staff: locationComparison.hyd.activeEmployees, Payroll: locationComparison.hyd.totalPayroll },
                        { name: 'Bangalore', Staff: locationComparison.blr.activeEmployees, Payroll: locationComparison.blr.totalPayroll },
                      ]}
                      margin={{ top: 10, right: 10, left: 10, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} />
                      <YAxis axisLine={false} tickLine={false} tickFormatter={formatCurrency} />
                      <Tooltip formatter={(val: number, name: string) => name === 'Staff' ? `${val} people` : formatCurrency(val)} />
                      <Legend />
                      <Bar dataKey="Payroll" fill="#f59e0b" name="Monthly Payroll Base (₹)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

          </div>
        )}

        {/* ─────────────────────────────────────────────────────────────
            TAB 2: MONTHLY PROCUREMENT VS SALES LEDGER (P&L)
        ───────────────────────────────────────────────────────────── */}
        {activeTab === 'ledger' && (
          <div className="space-y-6">

            {/* Visual Revenue vs Operating Cost Trend */}
            <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs">
              <h3 className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-emerald-600" />
                Monthly Revenue vs Total Operating Costs & Net Margin
              </h3>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={monthlyLedger} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.8}/>
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorCost" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#ef4444" stopOpacity={0.8}/>
                        <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                    <XAxis dataKey="monthLabel" axisLine={false} tickLine={false} />
                    <YAxis axisLine={false} tickLine={false} tickFormatter={formatCurrency} />
                    <Tooltip formatter={(val: number) => formatCurrency(val)} />
                    <Legend />
                    <Area type="monotone" dataKey="totalRevenue" name="Tuckshop Revenue" stroke="#10b981" fillOpacity={1} fill="url(#colorRev)" />
                    <Area type="monotone" dataKey="totalOperatingCost" name="Total Costs (DC + Payroll + Exp)" stroke="#ef4444" fillOpacity={1} fill="url(#colorCost)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Monthly Profit & Loss Detailed Table */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden">
              <div className="p-4 border-b border-gray-100 flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-gray-900 text-sm">Monthly Cafeteria P&L Ledger</h3>
                  <p className="text-xs text-gray-500">Reconciled breakdown of procurement goods, tuckshop sales, staff pay, and net profit.</p>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-gray-50 border-b border-gray-200 text-gray-600 font-bold uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="p-3.5">Month</th>
                      <th className="p-3.5 text-right text-emerald-700">Tuckshop Revenue</th>
                      <th className="p-3.5 text-right text-blue-700">DC Goods Cost</th>
                      <th className="p-3.5 text-right text-gray-600">Daily Expenses</th>
                      <th className="p-3.5 text-right text-amber-700">Disbursed Payroll</th>
                      <th className="p-3.5 text-right font-bold text-gray-900">Total Operating Cost</th>
                      <th className="p-3.5 text-right font-black">Net Profit / Loss</th>
                      <th className="p-3.5 text-center">Net Margin</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {monthlyLedger.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="p-8 text-center text-gray-400">
                          No financial records available yet to generate the ledger.
                        </td>
                      </tr>
                    ) : (
                      monthlyLedger.map((row) => (
                        <tr key={row.monthKey} className="hover:bg-gray-50/80 transition-colors">
                          <td className="p-3.5 font-bold text-gray-900 whitespace-nowrap">
                            {row.monthLabel}
                            <span className="block text-[10px] text-gray-400 font-normal">{row.monthKey}</span>
                          </td>
                          <td className="p-3.5 text-right font-semibold text-emerald-700">
                            {formatCurrency(row.tuckshopSales)}
                          </td>
                          <td className="p-3.5 text-right text-blue-700">
                            {formatCurrency(row.dcProcurementCost)}
                          </td>
                          <td className="p-3.5 text-right text-gray-600">
                            {formatCurrency(row.tuckshopExpenses)}
                          </td>
                          <td className="p-3.5 text-right text-amber-700">
                            {formatCurrency(row.payrollPaid)}
                          </td>
                          <td className="p-3.5 text-right font-bold text-gray-900">
                            {formatCurrency(row.totalOperatingCost)}
                          </td>
                          <td className={`p-3.5 text-right font-black ${
                            row.netProfit >= 0 ? 'text-emerald-600' : 'text-red-600'
                          }`}>
                            {row.netProfit >= 0 ? `+${formatCurrency(row.netProfit)}` : formatCurrency(row.netProfit)}
                          </td>
                          <td className="p-3.5 text-center">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              row.profitMarginPercent >= 0
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-red-100 text-red-800'
                            }`}>
                              {row.profitMarginPercent}%
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                  {monthlyLedger.length > 0 && (
                    <tfoot className="bg-gray-50 font-bold border-t border-gray-200">
                      <tr>
                        <td className="p-3.5 text-gray-800">Total YTD</td>
                        <td className="p-3.5 text-right text-emerald-700">{formatCurrency(overallFinancials.totalRev)}</td>
                        <td className="p-3.5 text-right text-blue-700">{formatCurrency(overallFinancials.totalProcurement)}</td>
                        <td className="p-3.5 text-right text-gray-600">{formatCurrency(overallFinancials.totalExpenses)}</td>
                        <td className="p-3.5 text-right text-amber-700">{formatCurrency(overallFinancials.totalPayroll)}</td>
                        <td className="p-3.5 text-right text-gray-900">{formatCurrency(overallFinancials.totalCost)}</td>
                        <td className={`p-3.5 text-right font-black ${overallFinancials.netProfit >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                          {overallFinancials.netProfit >= 0 ? `+${formatCurrency(overallFinancials.netProfit)}` : formatCurrency(overallFinancials.netProfit)}
                        </td>
                        <td className="p-3.5 text-center">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            overallFinancials.netMargin >= 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                          }`}>
                            {overallFinancials.netMargin.toFixed(1)}%
                          </span>
                        </td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>

          </div>
        )}
        </FinancialGate>

      </div>
    </div>
  );
}
