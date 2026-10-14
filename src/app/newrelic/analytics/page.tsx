'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { getNewRelicChallans } from '@/services/newrelicChallanService';
import { getTuckshopRecords, NewRelicTuckshopRecord } from '@/services/newrelicTuckshopService';
import { getEmployees, getAllSalaryPayments } from '@/services/newrelicEmployeeService';
import { NewRelicChallan } from '@/types/challan';
import { NewRelicEmployee, NewRelicSalaryPayment } from '@/types/employee';
import { SiteId, SITE_OPTIONS, resolveSiteId, COMPANY_SITES } from '@/types/site';
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
  const { role, user } = useAuth();
  const isAdmin = role === 'admin' || role === 'superadmin' || role === 'manager';

  const [challans, setChallans] = useState<NewRelicChallan[]>([]);
  const [tuckshopRecords, setTuckshopRecords] = useState<NewRelicTuckshopRecord[]>([]);
  const [employees, setEmployees] = useState<NewRelicEmployee[]>([]);
  const [salaryPayments, setSalaryPayments] = useState<NewRelicSalaryPayment[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Active view tab: 'overview' | 'comparison' | 'ledger'
  const [activeTab, setActiveTab] = useState<'comparison' | 'ledger' | 'overview'>('comparison');
  const [selectedSite, setSelectedSite] = useState<string>(user?.assignedSite || 'all');

  // Filtered data by selected site
  const filteredChallans = useMemo(() => {
    // Delivery challans are strictly for NewRelic. If DSM or NTT Data is filtered, challans are 0.
    if (selectedSite === 'dsm' || selectedSite === 'ntt_data') return [];
    return challans;
  }, [challans, selectedSite]);

  const filteredTuckshop = useMemo(() => {
    if (selectedSite === 'all') return tuckshopRecords;
    return tuckshopRecords.filter((t) => resolveSiteId(t.siteId) === selectedSite);
  }, [tuckshopRecords, selectedSite]);

  const filteredEmployees = useMemo(() => {
    if (selectedSite === 'all') return employees;
    return employees.filter((e) => resolveSiteId(e.siteId) === selectedSite);
  }, [employees, selectedSite]);

  const filteredSalaryPayments = useMemo(() => {
    if (selectedSite === 'all') return salaryPayments;
    const empDocIds = new Set(filteredEmployees.map((e) => e.id));
    return salaryPayments.filter((p) => empDocIds.has(p.employeeDocId));
  }, [salaryPayments, filteredEmployees, selectedSite]);

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
    filteredChallans.forEach((c) => {
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
    filteredTuckshop.forEach((t) => {
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
    filteredEmployees.forEach((e) => {
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
  }, [filteredChallans, filteredTuckshop, filteredEmployees]);

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
    filteredChallans.forEach((c) => {
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
    filteredTuckshop.forEach((t) => {
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
    filteredSalaryPayments.forEach((p) => {
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
  }, [filteredChallans, filteredTuckshop, filteredSalaryPayments]);

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

        {/* ── Brand Hero Banner ── */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-[#2c1d24] via-[#43232f] to-[#1e1b4b] p-5 sm:p-7 text-white shadow-xl border border-white/10">
          <div className="absolute -top-24 -right-24 w-60 h-60 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 -left-24 w-60 h-60 bg-rose-500/15 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-5">
            <div className="flex items-start gap-3.5">
              <Link href="/newrelic" className="p-2.5 rounded-xl bg-white/10 hover:bg-white/20 transition-colors text-white shrink-0 mt-0.5" title="Back to DC Hub">
                <ArrowLeft className="h-5 w-5" />
              </Link>
              <div>
                <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                  <span className="text-[10px] font-extrabold tracking-widest uppercase bg-gradient-to-r from-amber-300 via-rose-300 to-amber-200 text-transparent bg-clip-text">
                    The Gut Guru Tracker
                  </span>
                  <span className="text-[10px] bg-white/15 px-2.5 py-0.5 rounded-full font-bold border border-white/20 text-white/90">
                    Executive Analytics
                  </span>
                </div>
                <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white flex items-center gap-2">
                  <BarChart2 className="h-6 w-6 text-amber-300" />
                  Executive Insights & P&L Reporting
                </h1>
                <p className="text-xs text-gray-300 mt-1 max-w-2xl leading-relaxed">
                  Cross-location performance (HYD vs BLR), monthly procurement spend vs tuckshop revenue, and cafeteria net profit margins.
                </p>
              </div>
            </div>

            {/* Site Filter + Navigation Pill Switcher */}
            <div className="flex items-center gap-2 flex-wrap self-start lg:self-auto">
              {(role === 'admin' || role === 'superadmin') ? (
                <select
                  value={selectedSite}
                  onChange={(e) => setSelectedSite(e.target.value)}
                  className="h-10 px-3 bg-white/10 backdrop-blur-md border border-white/20 rounded-xl text-xs font-bold text-white focus:outline-none focus:ring-2 focus:ring-amber-300/40 shadow-xs"
                >
                  <option value="all" className="text-gray-900">🏢 All Company Sites</option>
                  {SITE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value} className="text-gray-900">
                      {opt.label}
                    </option>
                  ))}
                </select>
              ) : user?.assignedSite ? (
                <span className="px-3 py-1.5 rounded-xl text-xs font-bold bg-white/15 text-white border border-white/20 shadow-xs">
                  {COMPANY_SITES[user.assignedSite]?.name || user.assignedSite}
                </span>
              ) : null}

              <div className="flex items-center gap-1.5 p-1 bg-white/10 backdrop-blur-md border border-white/15 rounded-xl shadow-xs">
                <button
                  onClick={() => setActiveTab('comparison')}
                  className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                    activeTab === 'comparison'
                      ? 'bg-gradient-to-r from-amber-500 to-rose-500 text-white shadow-md'
                      : 'text-white/80 hover:bg-white/20'
                  }`}
                >
                  <MapPin className="h-3.5 w-3.5" />
                  HYD vs BLR
                </button>
                <button
                  onClick={() => setActiveTab('ledger')}
                  className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                    activeTab === 'ledger'
                      ? 'bg-gradient-to-r from-amber-500 to-rose-500 text-white shadow-md'
                      : 'text-white/80 hover:bg-white/20'
                  }`}
                >
                  <DollarSign className="h-3.5 w-3.5" />
                  Monthly P&L Ledger
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ── Protected Financial Content Gated Behind Password ── */}
        <FinancialGate
          title="Executive Financials & P&L Locked"
          description="Cafeteria P&L, monthly procurement spend, tuckshop revenue, and vendor margins are protected. Authenticate to view."
        >
          {/* ── Executive KPI Metric Cards with Rich Gradients ── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {/* Total Revenue */}
            <div className="bg-gradient-to-br from-emerald-50/90 via-white to-teal-50/50 p-4 sm:p-5 rounded-2xl border border-emerald-200/80 shadow-xs flex flex-col justify-between transition-all hover:shadow-md">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-black uppercase tracking-wider text-emerald-800">Tuckshop Revenue</span>
                <div className="p-2 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-600 text-white shadow-xs">
                  <Store className="h-4 w-4" />
                </div>
              </div>
              <div>
                <span className="text-xl sm:text-2xl font-black text-emerald-950 tracking-tight block">
                  {formatCurrency(overallFinancials.totalRev)}
                </span>
                <span className="text-[11px] font-bold text-emerald-700/80 mt-1 block">
                  Total Registered Sales
                </span>
              </div>
            </div>

            {/* DC Procurement Cost */}
            <div className="bg-gradient-to-br from-blue-50/90 via-white to-sky-50/50 p-4 sm:p-5 rounded-2xl border border-blue-200/80 shadow-xs flex flex-col justify-between transition-all hover:shadow-md">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-black uppercase tracking-wider text-blue-800">DC Procurement Cost</span>
                <div className="p-2 rounded-xl bg-gradient-to-tr from-blue-600 to-cyan-600 text-white shadow-xs">
                  <Truck className="h-4 w-4" />
                </div>
              </div>
              <div>
                <span className="text-xl sm:text-2xl font-black text-blue-950 tracking-tight block">
                  {formatCurrency(overallFinancials.totalProcurement)}
                </span>
                <span className="text-[11px] font-bold text-blue-700/80 mt-1 block">
                  Goods & Transport (DCs)
                </span>
              </div>
            </div>

            {/* Staff Payroll */}
            <div className="bg-gradient-to-br from-amber-50/90 via-white to-orange-50/50 p-4 sm:p-5 rounded-2xl border border-amber-200/80 shadow-xs flex flex-col justify-between transition-all hover:shadow-md">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-black uppercase tracking-wider text-amber-800">Staff Payroll Disbursed</span>
                <div className="p-2 rounded-xl bg-gradient-to-tr from-amber-500 to-orange-500 text-white shadow-xs">
                  <Users className="h-4 w-4" />
                </div>
              </div>
              <div>
                <span className="text-xl sm:text-2xl font-black text-amber-950 tracking-tight block">
                  {formatCurrency(overallFinancials.totalPayroll)}
                </span>
                <span className="text-[11px] font-bold text-amber-700/80 mt-1 block">
                  Attendance-Based Pay
                </span>
              </div>
            </div>

            {/* Net Cafeteria P&L */}
            <div className={`p-4 sm:p-5 rounded-2xl border shadow-xs flex flex-col justify-between transition-all hover:shadow-md ${
              overallFinancials.netProfit >= 0
                ? 'bg-gradient-to-br from-indigo-50/90 via-white to-purple-50/50 border-indigo-200/80'
                : 'bg-gradient-to-br from-rose-50/90 via-white to-red-50/50 border-rose-200/80'
            }`}>
              <div className="flex items-center justify-between mb-2">
                <span className={`text-[10px] font-black uppercase tracking-wider ${
                  overallFinancials.netProfit >= 0 ? 'text-indigo-800' : 'text-rose-800'
                }`}>
                  Net Cafeteria P&L
                </span>
                <div className={`p-2 rounded-xl text-white shadow-xs ${
                  overallFinancials.netProfit >= 0
                    ? 'bg-gradient-to-tr from-indigo-600 to-purple-600'
                    : 'bg-gradient-to-tr from-rose-600 to-red-600'
                }`}>
                  <DollarSign className="h-4 w-4" />
                </div>
              </div>
              <div>
                <div className="flex items-baseline gap-2">
                  <span className={`text-xl sm:text-2xl font-black tracking-tight ${
                    overallFinancials.netProfit >= 0 ? 'text-indigo-950' : 'text-rose-950'
                  }`}>
                    {formatCurrency(overallFinancials.netProfit)}
                  </span>
                  <span className={`text-xs font-extrabold px-1.5 py-0.5 rounded-md ${
                    overallFinancials.netProfit >= 0 ? 'bg-indigo-100 text-indigo-700' : 'bg-rose-100 text-rose-700'
                  }`}>
                    {overallFinancials.netMargin.toFixed(1)}%
                  </span>
                </div>
                <span className={`text-[11px] font-bold mt-1 block ${
                  overallFinancials.netProfit >= 0 ? 'text-indigo-700/80' : 'text-rose-700/80'
                }`}>
                  {overallFinancials.netProfit >= 0 ? 'Operating Surplus' : 'Operating Deficit'}
                </span>
              </div>
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
