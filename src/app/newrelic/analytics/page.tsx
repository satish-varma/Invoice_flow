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
  ShieldAlert,
  Calendar,
  Filter,
  RefreshCw,
  Tag,
  Layers,
  FileSpreadsheet,
  Package,
  Award,
  Search,
  CheckCircle,
  Percent,
  Receipt,
  X,
  ChevronRight,
} from 'lucide-react';
import Link from 'next/link';
import * as XLSX from 'xlsx';
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
  ComposedChart,
} from 'recharts';

const PALETTE = ['#3b2fc9', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#06b6d4', '#f97316', '#64748b'];

type DatePreset = 'all' | 'this_month' | 'last_month' | 'last_30_days' | 'last_90_days' | 'this_year' | 'custom';
type CycleFilter = 'all' | 'cycle_1' | 'cycle_2';
type LocationFilter = 'all' | 'hyderabad' | 'bangalore';
type TabKey = 'overview' | 'brands' | 'comparison' | 'ledger';
type Granularity = 'daily' | 'weekly' | 'monthly';

export default function AnalyticsDashboardPage() {
  const { role, user } = useAuth();
  const isAdmin = role === 'admin' || role === 'superadmin' || role === 'manager';

  // Raw fetched data
  const [challans, setChallans] = useState<NewRelicChallan[]>([]);
  const [tuckshopRecords, setTuckshopRecords] = useState<NewRelicTuckshopRecord[]>([]);
  const [employees, setEmployees] = useState<NewRelicEmployee[]>([]);
  const [salaryPayments, setSalaryPayments] = useState<NewRelicSalaryPayment[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Active navigation tab
  const [activeTab, setActiveTab] = useState<TabKey>('overview');

  // Filter States
  const [selectedSite, setSelectedSite] = useState<string>(user?.assignedSite || 'all');
  const [locationFilter, setLocationFilter] = useState<LocationFilter>('all');
  const [cycleFilter, setCycleFilter] = useState<CycleFilter>('all');
  const [datePreset, setDatePreset] = useState<DatePreset>('all');
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');
  const [selectedBrand, setSelectedBrand] = useState<string>('all');
  const [brandSearch, setBrandSearch] = useState<string>('');
  const [timeGranularity, setTimeGranularity] = useState<Granularity>('monthly');

  // Load Initial Datasets
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

  // Format currency helpers
  const formatCurrency = (val: number) => {
    if (Math.abs(val) >= 10000000) return `₹${(val / 10000000).toFixed(2)}Cr`;
    if (Math.abs(val) >= 100000) return `₹${(val / 100000).toFixed(2)}L`;
    return `₹${Math.round(val).toLocaleString('en-IN')}`;
  };

  const formatFullCurrency = (val: number) => {
    return `₹${Math.round(val).toLocaleString('en-IN')}`;
  };

  // Determine Effective Date Range based on Preset
  const computedDateRange = useMemo(() => {
    const today = new Date();
    const y = today.getFullYear();
    const m = today.getMonth();

    if (datePreset === 'this_month') {
      const start = new Date(y, m, 1).toISOString().substring(0, 10);
      const end = new Date(y, m + 1, 0).toISOString().substring(0, 10);
      return { start, end };
    }
    if (datePreset === 'last_month') {
      const start = new Date(y, m - 1, 1).toISOString().substring(0, 10);
      const end = new Date(y, m, 0).toISOString().substring(0, 10);
      return { start, end };
    }
    if (datePreset === 'last_30_days') {
      const past = new Date();
      past.setDate(past.getDate() - 30);
      return { start: past.toISOString().substring(0, 10), end: today.toISOString().substring(0, 10) };
    }
    if (datePreset === 'last_90_days') {
      const past = new Date();
      past.setDate(past.getDate() - 90);
      return { start: past.toISOString().substring(0, 10), end: today.toISOString().substring(0, 10) };
    }
    if (datePreset === 'this_year') {
      const start = `${y}-01-01`;
      const end = `${y}-12-31`;
      return { start, end };
    }
    if (datePreset === 'custom') {
      return { start: customStartDate || '1970-01-01', end: customEndDate || '2099-12-31' };
    }
    return { start: '1970-01-01', end: '2099-12-31' };
  }, [datePreset, customStartDate, customEndDate]);

  // Extract all unique brands present in Challans
  const availableBrands = useMemo(() => {
    const set = new Set<string>();
    challans.forEach((c) => {
      (c.lineItems || []).forEach((item) => {
        const b = (item.brandName || '').trim();
        if (b) set.add(b);
      });
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [challans]);

  // Date & Cycle check helper
  const matchesDateAndCycle = (dateString: string) => {
    if (!dateString) return false;
    const dateOnly = dateString.substring(0, 10);
    if (dateOnly < computedDateRange.start || dateOnly > computedDateRange.end) {
      return false;
    }
    if (cycleFilter !== 'all') {
      const day = parseInt(dateOnly.substring(8, 10), 10);
      if (cycleFilter === 'cycle_1' && day > 15) return false;
      if (cycleFilter === 'cycle_2' && day <= 15) return false;
    }
    return true;
  };

  // Filtered Challans
  const filteredChallans = useMemo(() => {
    // Delivery challans are strictly for NewRelic. If DSM or NTT Data is filtered, challans are empty.
    if (selectedSite === 'dsm' || selectedSite === 'ntt_data') return [];

    return challans.filter((c) => {
      if (locationFilter !== 'all' && c.location !== locationFilter) return false;
      if (!matchesDateAndCycle(c.dcDate)) return false;
      if (selectedBrand !== 'all') {
        const hasBrand = (c.lineItems || []).some(
          (item) => (item.brandName || '').trim().toLowerCase() === selectedBrand.toLowerCase()
        );
        if (!hasBrand) return false;
      }
      return true;
    });
  }, [challans, selectedSite, locationFilter, selectedBrand, computedDateRange, cycleFilter]);

  // Filtered Tuckshop Records
  const filteredTuckshop = useMemo(() => {
    return tuckshopRecords.filter((t) => {
      if (selectedSite !== 'all' && resolveSiteId(t.siteId) !== selectedSite) return false;
      if (locationFilter !== 'all') {
        const tLoc = (t.location || '').toLowerCase();
        if (locationFilter === 'hyderabad' && !tLoc.includes('hyd')) return false;
        if (locationFilter === 'bangalore' && !tLoc.includes('blr') && !tLoc.includes('bangalore')) return false;
      }
      if (!matchesDateAndCycle(t.date)) return false;
      return true;
    });
  }, [tuckshopRecords, selectedSite, locationFilter, computedDateRange, cycleFilter]);

  // Filtered Employees
  const filteredEmployees = useMemo(() => {
    return employees.filter((e) => {
      if (!e.isActive) return false;
      if (selectedSite !== 'all' && resolveSiteId(e.siteId) !== selectedSite) return false;
      if (locationFilter !== 'all' && e.location !== locationFilter) return false;
      return true;
    });
  }, [employees, selectedSite, locationFilter]);

  // Filtered Salary Payments
  const filteredSalaryPayments = useMemo(() => {
    const empDocIds = new Set(filteredEmployees.map((e) => e.id));
    return salaryPayments.filter((p) => {
      if (selectedSite !== 'all' && !empDocIds.has(p.employeeDocId)) return false;
      const paymentDate = p.paymentDate || `${p.month}-01`;
      if (!matchesDateAndCycle(paymentDate)) return false;
      return true;
    });
  }, [salaryPayments, filteredEmployees, selectedSite, computedDateRange, cycleFilter]);

  // Count active filters for badge
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (selectedSite !== 'all') count++;
    if (locationFilter !== 'all') count++;
    if (cycleFilter !== 'all') count++;
    if (datePreset !== 'all') count++;
    if (selectedBrand !== 'all') count++;
    return count;
  }, [selectedSite, locationFilter, cycleFilter, datePreset, selectedBrand]);

  const resetAllFilters = () => {
    setSelectedSite('all');
    setLocationFilter('all');
    setCycleFilter('all');
    setDatePreset('all');
    setCustomStartDate('');
    setCustomEndDate('');
    setSelectedBrand('all');
  };

  /* ─────────────────────────────────────────────────────────────
     1. BRAND & ITEM LEVEL INTELLIGENCE
  ───────────────────────────────────────────────────────────── */
  const brandAnalytics = useMemo(() => {
    const map: Record<string, {
      brand: string;
      totalUnits: number;
      procurementSpend: number;
      totalMrpValue: number;
      dcCount: number;
      uniqueProducts: Set<string>;
    }> = {};

    let grandTotalUnits = 0;
    let grandTotalProcurement = 0;
    let grandTotalMrp = 0;

    filteredChallans.forEach((c) => {
      const seenInThisDc = new Set<string>();
      (c.lineItems || []).forEach((item) => {
        const brand = (item.brandName || 'Unbranded').trim() || 'Unbranded';
        if (selectedBrand !== 'all' && brand.toLowerCase() !== selectedBrand.toLowerCase()) {
          return;
        }

        const qty = Number(item.quantity) || 0;
        const pCost = Number(item.procurementCost) || 0;
        const mrp = Number(item.mrp) || 0;
        const lineSpend = pCost > 0 ? pCost * qty : 0;
        const lineMrp = mrp > 0 ? mrp * qty : 0;

        if (!map[brand]) {
          map[brand] = {
            brand,
            totalUnits: 0,
            procurementSpend: 0,
            totalMrpValue: 0,
            dcCount: 0,
            uniqueProducts: new Set(),
          };
        }

        map[brand].totalUnits += qty;
        map[brand].procurementSpend += lineSpend;
        map[brand].totalMrpValue += lineMrp;
        if (item.itemName) map[brand].uniqueProducts.add(item.itemName.trim());

        if (!seenInThisDc.has(brand)) {
          seenInThisDc.add(brand);
          map[brand].dcCount += 1;
        }

        grandTotalUnits += qty;
        grandTotalProcurement += lineSpend;
        grandTotalMrp += lineMrp;
      });
    });

    const list = Object.values(map).map((b) => {
      const markupPercent = b.procurementSpend > 0
        ? ((b.totalMrpValue - b.procurementSpend) / b.procurementSpend) * 100
        : 0;
      const shareOfSpend = grandTotalProcurement > 0
        ? (b.procurementSpend / grandTotalProcurement) * 100
        : 0;

      return {
        ...b,
        productCount: b.uniqueProducts.size,
        markupPercent,
        shareOfSpend,
      };
    });

    // Sort by procurement spend desc
    list.sort((a, b) => b.procurementSpend - a.procurementSpend);

    const top10 = list.slice(0, 10);
    const top10Spend = top10.reduce((s, b) => s + b.procurementSpend, 0);
    const otherSpend = Math.max(0, grandTotalProcurement - top10Spend);

    const spendDonutData = [
      ...top10.map((b) => ({ name: b.brand, value: b.procurementSpend })),
      ...(otherSpend > 0 ? [{ name: 'Other Brands', value: otherSpend }] : []),
    ];

    return {
      list,
      top10,
      spendDonutData,
      grandTotalUnits,
      grandTotalProcurement,
      grandTotalMrp,
    };
  }, [filteredChallans, selectedBrand]);

  /* ─────────────────────────────────────────────────────────────
     2. TUCKSHOP CATEGORY EXPENSES BREAKDOWN
  ───────────────────────────────────────────────────────────── */
  const tuckshopExpenseCategories = useMemo(() => {
    const map: Record<string, number> = {};
    let totalExpenses = 0;
    filteredTuckshop.forEach((t) => {
      if (t.type === 'expense') {
        const cat = (t.category || 'General Miscellaneous').trim();
        const amt = Number(t.amount) || 0;
        map[cat] = (map[cat] || 0) + amt;
        totalExpenses += amt;
      }
    });

    const entries = Object.entries(map).map(([name, value]) => ({
      name,
      value,
      share: totalExpenses > 0 ? (value / totalExpenses) * 100 : 0,
    })).sort((a, b) => b.value - a.value);

    return { entries, totalExpenses };
  }, [filteredTuckshop]);

  /* ─────────────────────────────────────────────────────────────
     3. TIME-SERIES TRENDS (DAILY / WEEKLY / MONTHLY)
  ───────────────────────────────────────────────────────────── */
  const timeSeriesData = useMemo(() => {
    const map: Record<string, {
      periodKey: string;
      label: string;
      revenue: number;
      procurement: number;
      expenses: number;
      payroll: number;
      totalCost: number;
      netProfit: number;
      unitsDelivered: number;
      dcCount: number;
    }> = {};

    const getKey = (isoDate: string): { key: string; label: string } => {
      const d = new Date(isoDate);
      if (isNaN(d.getTime())) return { key: 'unknown', label: 'Unknown' };

      if (timeGranularity === 'daily') {
        const key = isoDate.substring(0, 10);
        const label = d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
        return { key, label };
      }
      if (timeGranularity === 'weekly') {
        const oneJan = new Date(d.getFullYear(), 0, 1);
        const numberOfDays = Math.floor((d.getTime() - oneJan.getTime()) / (24 * 60 * 60 * 1000));
        const weekNum = Math.ceil((d.getDay() + 1 + numberOfDays) / 7);
        const key = `${d.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
        const label = `W${weekNum} '${String(d.getFullYear()).slice(-2)}`;
        return { key, label };
      }
      // Monthly default
      const key = isoDate.substring(0, 7);
      const label = d.toLocaleString('en-IN', { month: 'short', year: '2-digit' });
      return { key, label };
    };

    const getOrInit = (key: string, label: string) => {
      if (!map[key]) {
        map[key] = {
          periodKey: key,
          label,
          revenue: 0,
          procurement: 0,
          expenses: 0,
          payroll: 0,
          totalCost: 0,
          netProfit: 0,
          unitsDelivered: 0,
          dcCount: 0,
        };
      }
      return map[key];
    };

    // 1. Tally DC Procurement Costs & Units
    filteredChallans.forEach((c) => {
      const { key, label } = getKey(c.dcDate);
      if (key === 'unknown') return;
      const row = getOrInit(key, label);
      row.dcCount += 1;

      let lineItemsCost = 0;
      (c.lineItems || []).forEach((item) => {
        const qty = Number(item.quantity) || 0;
        const pCost = Number(item.procurementCost) || 0;
        row.unitsDelivered += qty;
        lineItemsCost += pCost * qty;
      });

      const totalDcCost = (c.procurementCost !== undefined && c.procurementCost !== null ? Number(c.procurementCost) : lineItemsCost)
        + Number(c.transportCost || 0)
        + Number(c.otherCharges || 0);

      row.procurement += totalDcCost;
    });

    // 2. Tally Tuckshop Revenue & Expenses
    filteredTuckshop.forEach((t) => {
      const { key, label } = getKey(t.date);
      if (key === 'unknown') return;
      const row = getOrInit(key, label);
      const amt = Number(t.amount) || 0;
      if (t.type === 'sale') {
        row.revenue += amt;
      } else {
        row.expenses += amt;
      }
    });

    // 3. Tally Disbursed Payroll
    filteredSalaryPayments.forEach((p) => {
      const pDate = p.paymentDate || `${p.month}-01`;
      const { key, label } = getKey(pDate);
      if (key === 'unknown') return;
      const row = getOrInit(key, label);
      row.payroll += Number(p.netPaidAmount || p.attendanceEarned || 0);
    });

    const list = Object.values(map).map((row) => {
      const totalCost = row.procurement + row.expenses + row.payroll;
      const netProfit = row.revenue - totalCost;
      return {
        ...row,
        totalCost,
        netProfit,
        profitMargin: row.revenue > 0 ? parseFloat(((netProfit / row.revenue) * 100).toFixed(1)) : 0,
      };
    });

    return list.sort((a, b) => a.periodKey.localeCompare(b.periodKey));
  }, [filteredChallans, filteredTuckshop, filteredSalaryPayments, timeGranularity]);

  /* ─────────────────────────────────────────────────────────────
     4. OVERALL FINANCIAL TOTALS & METRICS
  ───────────────────────────────────────────────────────────── */
  const overallTotals = useMemo(() => {
    let revenue = 0;
    let procurement = 0;
    let expenses = 0;
    let payroll = 0;
    let units = 0;
    let dcCount = filteredChallans.length;

    filteredTuckshop.forEach((t) => {
      const amt = Number(t.amount) || 0;
      if (t.type === 'sale') revenue += amt;
      else expenses += amt;
    });

    filteredChallans.forEach((c) => {
      let lineCost = 0;
      (c.lineItems || []).forEach((item) => {
        const qty = Number(item.quantity) || 0;
        units += qty;
        lineCost += (Number(item.procurementCost) || 0) * qty;
      });
      const dcTotal = (c.procurementCost !== undefined && c.procurementCost !== null ? Number(c.procurementCost) : lineCost)
        + Number(c.transportCost || 0)
        + Number(c.otherCharges || 0);
      procurement += dcTotal;
    });

    filteredSalaryPayments.forEach((p) => {
      payroll += Number(p.netPaidAmount || p.attendanceEarned || 0);
    });

    const totalOperatingCost = procurement + expenses + payroll;
    const netProfit = revenue - totalOperatingCost;
    const netMarginPercent = revenue > 0 ? (netProfit / revenue) * 100 : 0;
    const avgDcValue = dcCount > 0 ? procurement / dcCount : 0;
    const costPerUnit = units > 0 ? procurement / units : 0;

    return {
      revenue,
      procurement,
      expenses,
      payroll,
      totalOperatingCost,
      netProfit,
      netMarginPercent,
      units,
      dcCount,
      avgDcValue,
      costPerUnit,
    };
  }, [filteredChallans, filteredTuckshop, filteredSalaryPayments]);

  // Operating Cost Breakdown Donut Data
  const costBreakdownData = useMemo(() => {
    return [
      { name: 'DC Goods Procurement', value: overallTotals.procurement, color: '#3b2fc9' },
      { name: 'Staff Payroll Disbursed', value: overallTotals.payroll, color: '#f59e0b' },
      { name: 'Daily Tuckshop Expenses', value: overallTotals.expenses, color: '#ec4899' },
    ].filter((item) => item.value > 0);
  }, [overallTotals]);

  /* ─────────────────────────────────────────────────────────────
     5. LOCATION COMPARISON DASHBOARD (HYD vs BLR)
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

    filteredChallans.forEach((c) => {
      const loc = c.location === 'bangalore' ? blr : hyd;
      loc.dcCount++;

      let lineItemsCost = 0;
      (c.lineItems || []).forEach((item) => {
        const qty = Number(item.quantity) || 0;
        loc.unitsDelivered += qty;
        const pCost = Number(item.procurementCost) || 0;
        lineItemsCost += pCost * qty;

        const brand = (item.brandName || 'Unspecified').trim();
        loc.vendors[brand] = (loc.vendors[brand] || 0) + (pCost > 0 ? pCost * qty : qty * 10);
      });

      const totalDcCost = (c.procurementCost !== undefined && c.procurementCost !== null ? Number(c.procurementCost) : lineItemsCost)
        + Number(c.transportCost || 0)
        + Number(c.otherCharges || 0);

      loc.procurementCost += totalDcCost;
    });

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

    filteredEmployees.forEach((e) => {
      if (e.location === 'bangalore') {
        blr.activeEmployees++;
        blr.totalPayroll += (Number(e.monthlySalary) || 0);
      } else {
        hyd.activeEmployees++;
        hyd.totalPayroll += (Number(e.monthlySalary) || 0);
      }
    });

    const hydTopVendors = Object.entries(hyd.vendors)
      .map(([brand, spend]) => ({ brand, spend }))
      .sort((a, b) => b.spend - a.spend)
      .slice(0, 5);

    const blrTopVendors = Object.entries(blr.vendors)
      .map(([brand, spend]) => ({ brand, spend }))
      .sort((a, b) => b.spend - a.spend)
      .slice(0, 5);

    // Efficiency Metrics
    const hydCostPerUnit = hyd.unitsDelivered > 0 ? hyd.procurementCost / hyd.unitsDelivered : 0;
    const blrCostPerUnit = blr.unitsDelivered > 0 ? blr.procurementCost / blr.unitsDelivered : 0;

    const hydRevPerStaff = hyd.activeEmployees > 0 ? hyd.tuckshopSales / hyd.activeEmployees : 0;
    const blrRevPerStaff = blr.activeEmployees > 0 ? blr.tuckshopSales / blr.activeEmployees : 0;

    const hydNet = hyd.tuckshopSales - (hyd.procurementCost + hyd.tuckshopExpenses + hyd.totalPayroll);
    const blrNet = blr.tuckshopSales - (blr.procurementCost + blr.tuckshopExpenses + blr.totalPayroll);

    return {
      hyd,
      blr,
      hydTopVendors,
      blrTopVendors,
      hydCostPerUnit,
      blrCostPerUnit,
      hydRevPerStaff,
      blrRevPerStaff,
      hydNet,
      blrNet,
    };
  }, [filteredChallans, filteredTuckshop, filteredEmployees]);

  /* ─────────────────────────────────────────────────────────────
     6. CUMULATIVE RUNNING CASH FLOW & MONTHLY P&L LEDGER
  ───────────────────────────────────────────────────────────── */
  const ledgerReport = useMemo(() => {
    let runningNet = 0;
    return timeSeriesData.map((row) => {
      runningNet += row.netProfit;
      return {
        ...row,
        runningNetProfit: runningNet,
      };
    });
  }, [timeSeriesData]);

  /* ─────────────────────────────────────────────────────────────
     7. EXPORT COMPREHENSIVE ANALYTICS TO EXCEL
  ───────────────────────────────────────────────────────────── */
  const handleExportExcel = () => {
    try {
      const wb = XLSX.utils.book_new();

      // Sheet 1: Monthly Ledger
      const ledgerRows = ledgerReport.map((r) => ({
        Period: r.label,
        'Key (YYYY-MM)': r.periodKey,
        'Tuckshop Sales (INR)': r.revenue,
        'DC Procurement Spend (INR)': r.procurement,
        'Tuckshop Daily Expenses (INR)': r.expenses,
        'Disbursed Payroll (INR)': r.payroll,
        'Total Operating Cost (INR)': r.totalCost,
        'Net Profit / Deficit (INR)': r.netProfit,
        'Net Margin %': `${r.profitMargin}%`,
        'Cumulative Net Profit (INR)': r.runningNetProfit,
        'Units Delivered': r.unitsDelivered,
        'DCs Filed': r.dcCount,
      }));

      // Sheet 2: Brand Intelligence
      const brandRows = brandAnalytics.list.map((b) => ({
        'Brand Name': b.brand,
        'Procurement Spend (INR)': b.procurementSpend,
        'Retail MRP Value (INR)': b.totalMrpValue,
        'Markup %': `${b.markupPercent.toFixed(1)}%`,
        'Total Units Delivered': b.totalUnits,
        'Share of Spend %': `${b.shareOfSpend.toFixed(1)}%`,
        'DC Count': b.dcCount,
        'Product Varieties Count': b.productCount,
      }));

      const wsLedger = XLSX.utils.json_to_sheet(ledgerRows);
      const wsBrands = XLSX.utils.json_to_sheet(brandRows);

      XLSX.utils.book_append_sheet(wb, wsLedger, 'Monthly Ledger & PnL');
      XLSX.utils.book_append_sheet(wb, wsBrands, 'Brand Intelligence');

      const dateStr = new Date().toISOString().substring(0, 10);
      XLSX.writeFile(wb, `TheGutGuru_Executive_Analytics_${dateStr}.xlsx`);
    } catch (e: any) {
      alert(`Export failed: ${e.message}`);
    }
  };

  // Filtered Brand List for Tab 2
  const searchedBrands = useMemo(() => {
    if (!brandSearch.trim()) return brandAnalytics.list;
    const q = brandSearch.toLowerCase();
    return brandAnalytics.list.filter((b) => b.brand.toLowerCase().includes(q));
  }, [brandAnalytics.list, brandSearch]);

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
        <div className="flex items-center gap-2 text-sm text-gray-500 font-medium">
          <Loader2 className="h-6 w-6 animate-spin text-[#3b2fc9]" />
          Loading analytics & insights...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50/50 pb-20">
      <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6">

        {/* ── Brand Hero Header ── */}
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
                    Executive Analytics & BI
                  </span>
                </div>
                <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white flex items-center gap-2">
                  <BarChart2 className="h-6 w-6 text-amber-300" />
                  Executive Insights & P&L Reporting
                </h1>
                <p className="text-xs text-gray-300 mt-1 max-w-2xl leading-relaxed">
                  Interactive multi-filter dashboard: HYD vs BLR head-to-head, brand procurement share, monthly P&L ledger, and operational unit throughput.
                </p>
              </div>
            </div>

            {/* Quick Actions & Navigation Pill Switcher */}
            <div className="flex items-center gap-2 flex-wrap self-start lg:self-auto">
              <button
                type="button"
                onClick={handleExportExcel}
                className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md transition-all active:scale-98"
                title="Download full analytics as Excel"
              >
                <FileSpreadsheet className="h-3.5 w-3.5" />
                <span>Export Report</span>
              </button>

              <div className="flex items-center gap-1 p-1 bg-white/10 backdrop-blur-md border border-white/15 rounded-xl shadow-xs overflow-x-auto">
                <button
                  onClick={() => setActiveTab('overview')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap ${
                    activeTab === 'overview'
                      ? 'bg-gradient-to-r from-amber-500 to-rose-500 text-white shadow-md'
                      : 'text-white/80 hover:bg-white/20'
                  }`}
                >
                  <TrendingUp className="h-3.5 w-3.5" />
                  Overview
                </button>
                <button
                  onClick={() => setActiveTab('brands')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap ${
                    activeTab === 'brands'
                      ? 'bg-gradient-to-r from-amber-500 to-rose-500 text-white shadow-md'
                      : 'text-white/80 hover:bg-white/20'
                  }`}
                >
                  <Tag className="h-3.5 w-3.5" />
                  Brands & Vendors
                </button>
                <button
                  onClick={() => setActiveTab('comparison')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap ${
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
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap ${
                    activeTab === 'ledger'
                      ? 'bg-gradient-to-r from-amber-500 to-rose-500 text-white shadow-md'
                      : 'text-white/80 hover:bg-white/20'
                  }`}
                >
                  <DollarSign className="h-3.5 w-3.5" />
                  P&L Ledger
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ── Advanced Multi-Filter Control Console ── */}
        <div className="bg-white rounded-2xl border border-gray-200/90 shadow-sm p-4 sm:p-5 space-y-3.5 transition-all">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-100 pb-3">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-[#3b2fc9]" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-gray-800">
                Advanced Analytics Filters
              </h3>
              {activeFiltersCount > 0 && (
                <span className="text-[10px] font-extrabold bg-[#3b2fc9] text-white px-2 py-0.5 rounded-full">
                  {activeFiltersCount} Active
                </span>
              )}
            </div>

            {activeFiltersCount > 0 && (
              <button
                type="button"
                onClick={resetAllFilters}
                className="text-xs text-red-600 hover:text-red-700 font-semibold flex items-center gap-1 transition-colors self-start sm:self-auto"
              >
                <RefreshCw className="h-3 w-3" />
                Reset Filters
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
            {/* 1. Date Range Preset */}
            <div>
              <label className="block text-[11px] font-bold text-gray-600 mb-1">Timeframe</label>
              <select
                value={datePreset}
                onChange={(e) => setDatePreset(e.target.value as DatePreset)}
                className="w-full h-9 px-2.5 text-xs font-semibold bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#3b2fc9]/20 focus:border-[#3b2fc9]"
              >
                <option value="all">📅 All Time</option>
                <option value="this_month">📅 This Month</option>
                <option value="last_month">📅 Last Month</option>
                <option value="last_30_days">📅 Last 30 Days</option>
                <option value="last_90_days">📅 Last 90 Days</option>
                <option value="this_year">📅 This Year (YTD)</option>
                <option value="custom">📅 Custom Date Range</option>
              </select>
            </div>

            {/* 2. Billing Cycle Filter */}
            <div>
              <label className="block text-[11px] font-bold text-gray-600 mb-1">Invoice Cycle</label>
              <select
                value={cycleFilter}
                onChange={(e) => setCycleFilter(e.target.value as CycleFilter)}
                className="w-full h-9 px-2.5 text-xs font-semibold bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#3b2fc9]/20 focus:border-[#3b2fc9]"
              >
                <option value="all">🔄 All Dates (Full Month)</option>
                <option value="cycle_1">🔄 Cycle 1 (1st - 15th)</option>
                <option value="cycle_2">🔄 Cycle 2 (16th - End)</option>
              </select>
            </div>

            {/* 3. Location Filter */}
            <div>
              <label className="block text-[11px] font-bold text-gray-600 mb-1">DC Hub Location</label>
              <select
                value={locationFilter}
                onChange={(e) => setLocationFilter(e.target.value as LocationFilter)}
                className="w-full h-9 px-2.5 text-xs font-semibold bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#3b2fc9]/20 focus:border-[#3b2fc9]"
              >
                <option value="all">📍 All Locations (HYD & BLR)</option>
                <option value="hyderabad">📍 Hyderabad Hub</option>
                <option value="bangalore">📍 Bangalore Hub</option>
              </select>
            </div>

            {/* 4. Company Site Filter */}
            <div>
              <label className="block text-[11px] font-bold text-gray-600 mb-1">Company Site</label>
              <select
                value={selectedSite}
                onChange={(e) => setSelectedSite(e.target.value)}
                className="w-full h-9 px-2.5 text-xs font-semibold bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#3b2fc9]/20 focus:border-[#3b2fc9]"
              >
                <option value="all">🏢 All Company Sites</option>
                {SITE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* 5. Brand / Vendor Filter */}
            <div>
              <label className="block text-[11px] font-bold text-gray-600 mb-1">Brand / Vendor</label>
              <select
                value={selectedBrand}
                onChange={(e) => setSelectedBrand(e.target.value)}
                className="w-full h-9 px-2.5 text-xs font-semibold bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#3b2fc9]/20 focus:border-[#3b2fc9]"
              >
                <option value="all">🏷️ All Brands ({availableBrands.length})</option>
                {availableBrands.map((b) => (
                  <option key={b} value={b}>
                    🏷️ {b}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Custom Date Inputs if selected */}
          {datePreset === 'custom' && (
            <div className="pt-2 flex flex-col sm:flex-row items-center gap-3 bg-gray-50 p-3 rounded-xl border border-gray-200/80 animate-in fade-in">
              <span className="text-xs font-bold text-gray-700">Custom Date Range:</span>
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="h-8 px-2.5 text-xs border border-gray-200 rounded-lg bg-white"
                />
                <span className="text-xs text-gray-400">to</span>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="h-8 px-2.5 text-xs border border-gray-200 rounded-lg bg-white"
                />
              </div>
            </div>
          )}

          {/* Active Filter Chips Ribbon */}
          {activeFiltersCount > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap pt-1 text-[11px]">
              <span className="text-gray-400 font-medium">Filtering by:</span>
              {selectedSite !== 'all' && (
                <span className="bg-indigo-50 text-[#3b2fc9] border border-indigo-200 px-2 py-0.5 rounded-md font-semibold flex items-center gap-1">
                  Site: {COMPANY_SITES[selectedSite as SiteId]?.name || selectedSite}
                  <button onClick={() => setSelectedSite('all')} className="hover:text-red-600"><X className="h-3 w-3" /></button>
                </span>
              )}
              {locationFilter !== 'all' && (
                <span className="bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-md font-semibold flex items-center gap-1 capitalize">
                  Location: {locationFilter}
                  <button onClick={() => setLocationFilter('all')} className="hover:text-red-600"><X className="h-3 w-3" /></button>
                </span>
              )}
              {cycleFilter !== 'all' && (
                <span className="bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.5 rounded-md font-semibold flex items-center gap-1">
                  {cycleFilter === 'cycle_1' ? 'Cycle 1 (1-15)' : 'Cycle 2 (16-End)'}
                  <button onClick={() => setCycleFilter('all')} className="hover:text-red-600"><X className="h-3 w-3" /></button>
                </span>
              )}
              {datePreset !== 'all' && (
                <span className="bg-purple-50 text-purple-700 border border-purple-200 px-2 py-0.5 rounded-md font-semibold flex items-center gap-1 capitalize">
                  Date: {datePreset.replace(/_/g, ' ')}
                  <button onClick={() => setDatePreset('all')} className="hover:text-red-600"><X className="h-3 w-3" /></button>
                </span>
              )}
              {selectedBrand !== 'all' && (
                <span className="bg-rose-50 text-rose-700 border border-rose-200 px-2 py-0.5 rounded-md font-semibold flex items-center gap-1">
                  Brand: {selectedBrand}
                  <button onClick={() => setSelectedBrand('all')} className="hover:text-red-600"><X className="h-3 w-3" /></button>
                </span>
              )}
            </div>
          )}
        </div>

        {/* ── Protected Financial Content Gated Behind Password ── */}
        <FinancialGate
          title="Executive Financials & P&L Locked"
          description="Cafeteria P&L, monthly procurement spend, tuckshop revenue, and vendor margins are protected. Authenticate to view."
        >
          {/* ── Executive KPI Metric Cards with Rich Gradients ── */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {/* 1. Tuckshop Revenue */}
            <div className="bg-gradient-to-br from-emerald-50/90 via-white to-teal-50/50 p-4 rounded-2xl border border-emerald-200/80 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-black uppercase tracking-wider text-emerald-800">Tuckshop Revenue</span>
                <div className="p-1.5 rounded-lg bg-emerald-600 text-white shadow-xs">
                  <Store className="h-3.5 w-3.5" />
                </div>
              </div>
              <div>
                <span className="text-lg sm:text-xl font-black text-emerald-950 tracking-tight block">
                  {formatCurrency(overallTotals.revenue)}
                </span>
                <span className="text-[10px] font-bold text-emerald-700/80 mt-0.5 block">
                  Total Sales
                </span>
              </div>
            </div>

            {/* 2. DC Procurement Cost */}
            <div className="bg-gradient-to-br from-blue-50/90 via-white to-sky-50/50 p-4 rounded-2xl border border-blue-200/80 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-black uppercase tracking-wider text-blue-800">Procurement Cost</span>
                <div className="p-1.5 rounded-lg bg-blue-600 text-white shadow-xs">
                  <Truck className="h-3.5 w-3.5" />
                </div>
              </div>
              <div>
                <span className="text-lg sm:text-xl font-black text-blue-950 tracking-tight block">
                  {formatCurrency(overallTotals.procurement)}
                </span>
                <span className="text-[10px] font-bold text-blue-700/80 mt-0.5 block">
                  {overallTotals.dcCount} DCs filed
                </span>
              </div>
            </div>

            {/* 3. Retail MRP Delivery Value */}
            <div className="bg-gradient-to-br from-indigo-50/90 via-white to-purple-50/50 p-4 rounded-2xl border border-indigo-200/80 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-black uppercase tracking-wider text-indigo-800">Total MRP Value</span>
                <div className="p-1.5 rounded-lg bg-[#3b2fc9] text-white shadow-xs">
                  <Receipt className="h-3.5 w-3.5" />
                </div>
              </div>
              <div>
                <span className="text-lg sm:text-xl font-black text-indigo-950 tracking-tight block">
                  {formatCurrency(brandAnalytics.grandTotalMrp)}
                </span>
                <span className="text-[10px] font-bold text-indigo-700/80 mt-0.5 block">
                  Goods Retail Worth
                </span>
              </div>
            </div>

            {/* 4. Units Delivered */}
            <div className="bg-gradient-to-br from-purple-50/90 via-white to-pink-50/50 p-4 rounded-2xl border border-purple-200/80 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-black uppercase tracking-wider text-purple-800">Units Delivered</span>
                <div className="p-1.5 rounded-lg bg-purple-600 text-white shadow-xs">
                  <Package className="h-3.5 w-3.5" />
                </div>
              </div>
              <div>
                <span className="text-lg sm:text-xl font-black text-purple-950 tracking-tight block">
                  {overallTotals.units.toLocaleString('en-IN')}
                </span>
                <span className="text-[10px] font-bold text-purple-700/80 mt-0.5 block">
                  {formatCurrency(overallTotals.costPerUnit)}/unit avg
                </span>
              </div>
            </div>

            {/* 5. Staff Payroll */}
            <div className="bg-gradient-to-br from-amber-50/90 via-white to-orange-50/50 p-4 rounded-2xl border border-amber-200/80 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-black uppercase tracking-wider text-amber-800">Staff Payroll</span>
                <div className="p-1.5 rounded-lg bg-amber-500 text-white shadow-xs">
                  <Users className="h-3.5 w-3.5" />
                </div>
              </div>
              <div>
                <span className="text-lg sm:text-xl font-black text-amber-950 tracking-tight block">
                  {formatCurrency(overallTotals.payroll)}
                </span>
                <span className="text-[10px] font-bold text-amber-700/80 mt-0.5 block">
                  Disbursed Salaries
                </span>
              </div>
            </div>

            {/* 6. Net Cafeteria P&L */}
            <div className={`p-4 rounded-2xl border shadow-xs flex flex-col justify-between ${
              overallTotals.netProfit >= 0
                ? 'bg-gradient-to-br from-emerald-50/90 via-white to-teal-50/50 border-emerald-200/80'
                : 'bg-gradient-to-br from-rose-50/90 via-white to-red-50/50 border-rose-200/80'
            }`}>
              <div className="flex items-center justify-between mb-2">
                <span className={`text-[10px] font-black uppercase tracking-wider ${
                  overallTotals.netProfit >= 0 ? 'text-emerald-800' : 'text-rose-800'
                }`}>
                  Net Cafeteria P&L
                </span>
                <div className={`p-1.5 rounded-lg text-white shadow-xs ${
                  overallTotals.netProfit >= 0 ? 'bg-emerald-600' : 'bg-rose-600'
                }`}>
                  <DollarSign className="h-3.5 w-3.5" />
                </div>
              </div>
              <div>
                <div className="flex items-baseline gap-1.5 flex-wrap">
                  <span className={`text-lg sm:text-xl font-black tracking-tight ${
                    overallTotals.netProfit >= 0 ? 'text-emerald-950' : 'text-rose-950'
                  }`}>
                    {formatCurrency(overallTotals.netProfit)}
                  </span>
                  <span className={`text-[10px] font-extrabold px-1.5 py-0.2 rounded ${
                    overallTotals.netProfit >= 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                  }`}>
                    {overallTotals.netMarginPercent.toFixed(1)}%
                  </span>
                </div>
                <span className={`text-[10px] font-bold mt-0.5 block ${
                  overallTotals.netProfit >= 0 ? 'text-emerald-700/80' : 'text-rose-700/80'
                }`}>
                  {overallTotals.netProfit >= 0 ? 'Operating Surplus' : 'Operating Deficit'}
                </span>
              </div>
            </div>
          </div>

          {/* ─────────────────────────────────────────────────────────────
              TAB 1: EXECUTIVE OVERVIEW & TREND CHARTS
          ───────────────────────────────────────────────────────────── */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Trend Chart: Revenue vs Operating Costs vs Net Profit */}
              <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-emerald-600" />
                      Sales Revenue vs Total Operating Costs & Net P&L Trend
                    </h3>
                    <p className="text-xs text-gray-500">
                      Visualizing cafeteria cash inflows against goods procurement, payroll, and daily expenses.
                    </p>
                  </div>

                  {/* Granularity Selector */}
                  <div className="flex items-center gap-1 p-1 bg-gray-100 rounded-xl text-xs font-semibold self-start sm:self-auto">
                    {(['daily', 'weekly', 'monthly'] as const).map((g) => (
                      <button
                        key={g}
                        onClick={() => setTimeGranularity(g)}
                        className={`px-2.5 py-1 rounded-lg capitalize transition-all ${
                          timeGranularity === g
                            ? 'bg-white text-[#3b2fc9] shadow-xs font-bold'
                            : 'text-gray-500 hover:text-gray-800'
                        }`}
                      >
                        {g}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="h-80 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={timeSeriesData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.7}/>
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0.05}/>
                        </linearGradient>
                        <linearGradient id="colorCost" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#ef4444" stopOpacity={0.7}/>
                          <stop offset="95%" stopColor="#ef4444" stopOpacity={0.05}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                      <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 11 }} />
                      <YAxis axisLine={false} tickLine={false} tickFormatter={formatCurrency} tick={{ fontSize: 11 }} />
                      <Tooltip formatter={(val: number) => formatCurrency(val)} />
                      <Legend />
                      <Area type="monotone" dataKey="revenue" name="Tuckshop Revenue" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorRev)" />
                      <Area type="monotone" dataKey="totalCost" name="Total Operating Cost" stroke="#ef4444" strokeWidth={2} fillOpacity={1} fill="url(#colorCost)" />
                      <Line type="monotone" dataKey="netProfit" name="Net P&L" stroke="#3b2fc9" strokeWidth={2.5} dot={{ r: 3 }} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Grid 2: Operating Cost Structure Donut + Delivery Volume Throughput */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Donut Chart: Operating Cost Composition */}
                <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs flex flex-col justify-between">
                  <div>
                    <h4 className="text-sm font-bold text-gray-800 mb-1 flex items-center gap-2">
                      <PieChartIcon className="h-4 w-4 text-[#3b2fc9]" />
                      Operating Cost Composition
                    </h4>
                    <p className="text-xs text-gray-500 mb-4">Breakdown of operational spend between stock goods, staff salaries, and misc expenses.</p>
                  </div>

                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={costBreakdownData}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          innerRadius={55}
                          outerRadius={85}
                          paddingAngle={3}
                        >
                          {costBreakdownData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(val: number) => formatFullCurrency(val)} />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="grid grid-cols-3 gap-2 pt-3 border-t border-gray-100 text-center text-xs">
                    <div>
                      <span className="text-[10px] text-gray-400 block font-medium">Procurement</span>
                      <span className="font-bold text-[#3b2fc9]">{formatCurrency(overallTotals.procurement)}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-gray-400 block font-medium">Payroll</span>
                      <span className="font-bold text-amber-600">{formatCurrency(overallTotals.payroll)}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-gray-400 block font-medium">Expenses</span>
                      <span className="font-bold text-pink-600">{formatCurrency(overallTotals.expenses)}</span>
                    </div>
                  </div>
                </div>

                {/* Composed Chart: Delivered Units vs Total DCs */}
                <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs flex flex-col justify-between">
                  <div>
                    <h4 className="text-sm font-bold text-gray-800 mb-1 flex items-center gap-2">
                      <Truck className="h-4 w-4 text-purple-600" />
                      Delivery Units Throughput & DCs Filed
                    </h4>
                    <p className="text-xs text-gray-500 mb-4">Tracking aggregate pack volume and distribution challans delivered over time.</p>
                  </div>

                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={timeSeriesData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                        <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 11 }} />
                        <YAxis yAxisId="left" axisLine={false} tickLine={false} tick={{ fontSize: 11 }} />
                        <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tick={{ fontSize: 11 }} />
                        <Tooltip />
                        <Legend />
                        <Bar yAxisId="left" dataKey="unitsDelivered" name="Units Delivered" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                        <Line yAxisId="right" type="monotone" dataKey="dcCount" name="DCs Filed" stroke="#f59e0b" strokeWidth={2.5} dot={{ r: 3 }} />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-gray-100 text-xs text-gray-600">
                    <span>Total Goods Consumed: <strong>{overallTotals.units.toLocaleString('en-IN')} units</strong></span>
                    <span>Total Logistics Runs: <strong>{overallTotals.dcCount} DCs</strong></span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ─────────────────────────────────────────────────────────────
              TAB 2: BRAND & PRODUCT CATEGORY INTELLIGENCE
          ───────────────────────────────────────────────────────────── */}
          {activeTab === 'brands' && (
            <div className="space-y-6">
              {/* Brand Top 10 Spending Chart + Share Donut */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Horizontal Bar Chart: Top 10 Brands by Spend */}
                <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs">
                  <h4 className="text-sm font-bold text-gray-800 mb-1 flex items-center gap-2">
                    <Award className="h-4 w-4 text-amber-500" />
                    Top 10 Procured Brands (By Procurement Spend)
                  </h4>
                  <p className="text-xs text-gray-500 mb-4">Highest volume brand partners delivering stock to our cafeterias.</p>

                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        layout="vertical"
                        data={brandAnalytics.top10}
                        margin={{ top: 5, right: 20, left: 40, bottom: 5 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0f0f0" />
                        <XAxis type="number" tickFormatter={formatCurrency} axisLine={false} tickLine={false} tick={{ fontSize: 10 }} />
                        <YAxis type="category" dataKey="brand" axisLine={false} tickLine={false} tick={{ fontSize: 11 }} width={90} />
                        <Tooltip formatter={(val: number) => formatCurrency(val)} />
                        <Bar dataKey="procurementSpend" name="Spend" fill="#3b2fc9" radius={[0, 4, 4, 0]}>
                          {brandAnalytics.top10.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={PALETTE[index % PALETTE.length]} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Donut Chart: Brand Concentration Share */}
                <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs flex flex-col justify-between">
                  <div>
                    <h4 className="text-sm font-bold text-gray-800 mb-1 flex items-center gap-2">
                      <PieChartIcon className="h-4 w-4 text-purple-600" />
                      Brand Spend Concentration Share
                    </h4>
                    <p className="text-xs text-gray-500 mb-4">Proportion of procurement budget concentrated among top brands.</p>
                  </div>

                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={brandAnalytics.spendDonutData}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          innerRadius={50}
                          outerRadius={85}
                          paddingAngle={2}
                        >
                          {brandAnalytics.spendDonutData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={PALETTE[index % PALETTE.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(val: number) => formatCurrency(val)} />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="pt-2 text-center text-xs text-gray-500 border-t border-gray-100">
                    Total Brands Tracked: <strong>{brandAnalytics.list.length}</strong> · Top 10 represent{' '}
                    <strong>
                      {brandAnalytics.grandTotalProcurement > 0
                        ? ((brandAnalytics.top10.reduce((s, b) => s + b.procurementSpend, 0) / brandAnalytics.grandTotalProcurement) * 100).toFixed(1)
                        : 0}%
                    </strong>{' '}
                    of all procurement.
                  </div>
                </div>
              </div>

              {/* Detailed Brand Ranking & Margin Table */}
              <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden">
                <div className="p-4 sm:p-5 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h3 className="font-bold text-gray-900 text-sm">Brand & Vendor Intelligence Directory</h3>
                    <p className="text-xs text-gray-500">Unit throughput, procurement spend, retail worth, and markup by brand partner.</p>
                  </div>

                  <div className="relative w-full sm:w-64">
                    <Search className="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      value={brandSearch}
                      onChange={(e) => setBrandSearch(e.target.value)}
                      placeholder="Search brand or vendor..."
                      className="w-full h-8 pl-8 pr-3 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#3b2fc9] bg-gray-50/50"
                    />
                  </div>
                </div>

                <div className="overflow-x-auto max-h-96">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-gray-50 border-b border-gray-200 text-gray-600 font-bold uppercase tracking-wider text-[10px] sticky top-0 z-10">
                      <tr>
                        <th className="p-3">Rank</th>
                        <th className="p-3">Brand Name</th>
                        <th className="p-3 text-right">Units Delivered</th>
                        <th className="p-3 text-right text-blue-700">Procurement Spend</th>
                        <th className="p-3 text-right text-indigo-700">Retail MRP Value</th>
                        <th className="p-3 text-center">Gross Markup</th>
                        <th className="p-3 text-right">Share %</th>
                        <th className="p-3 text-center">DC Presence</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {searchedBrands.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="p-6 text-center text-gray-400">
                            No matching brands found.
                          </td>
                        </tr>
                      ) : (
                        searchedBrands.map((b, idx) => (
                          <tr key={b.brand} className="hover:bg-gray-50/80 transition-colors">
                            <td className="p-3 font-mono text-gray-400 text-[11px]">#{idx + 1}</td>
                            <td className="p-3 font-semibold text-gray-900">
                              {b.brand}
                              <span className="block text-[10px] text-gray-400 font-normal">
                                {b.productCount} product varieties
                              </span>
                            </td>
                            <td className="p-3 text-right font-medium text-gray-800">
                              {b.totalUnits.toLocaleString('en-IN')}
                            </td>
                            <td className="p-3 text-right font-bold text-blue-700">
                              {formatCurrency(b.procurementSpend)}
                            </td>
                            <td className="p-3 text-right font-bold text-indigo-700">
                              {formatCurrency(b.totalMrpValue)}
                            </td>
                            <td className="p-3 text-center">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                b.markupPercent > 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-700'
                              }`}>
                                +{b.markupPercent.toFixed(1)}%
                              </span>
                            </td>
                            <td className="p-3 text-right font-semibold text-gray-700">
                              {b.shareOfSpend.toFixed(1)}%
                            </td>
                            <td className="p-3 text-center text-gray-500">
                              {b.dcCount} DCs
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Tuckshop Expense Category Breakdown */}
              {tuckshopExpenseCategories.entries.length > 0 && (
                <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs space-y-4">
                  <h4 className="text-sm font-bold text-gray-800 flex items-center gap-2">
                    <Receipt className="h-4 w-4 text-pink-600" />
                    Tuckshop Daily Operational Expense Categories ({formatCurrency(tuckshopExpenseCategories.totalExpenses)})
                  </h4>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    {tuckshopExpenseCategories.entries.slice(0, 8).map((cat, idx) => (
                      <div key={idx} className="bg-gray-50 p-3 rounded-xl border border-gray-100">
                        <span className="text-gray-400 block text-[10px] uppercase font-bold truncate">{cat.name}</span>
                        <span className="font-extrabold text-base text-gray-900 block mt-0.5">{formatCurrency(cat.value)}</span>
                        <span className="text-[10px] text-pink-600 font-semibold">{cat.share.toFixed(1)}% of expenses</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ─────────────────────────────────────────────────────────────
              TAB 3: HYDERABAD VS BANGALORE LOCATION COMPARISON
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
                    <p className="text-xs text-gray-500">Comparing operational footprint, sales volume, and costs across distribution hubs.</p>
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
                        <span className="font-bold text-base text-gray-900">Hyderabad Hub</span>
                      </div>
                      <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-blue-50 text-[#3b2fc9]">
                        {locationComparison.hyd.activeEmployees} Active Staff
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
                        <span className="text-gray-400 block text-[10px] uppercase font-bold">Monthly Base Payroll</span>
                        <span className="font-extrabold text-base text-amber-700 block mt-0.5">
                          {formatCurrency(locationComparison.hyd.totalPayroll)}
                        </span>
                        <span className="text-[10px] text-gray-500">Staff salaries</span>
                      </div>
                    </div>

                    {/* Top Vendor Reliance HYD */}
                    <div className="pt-2">
                      <span className="text-[11px] font-bold text-gray-700 block mb-2">Top Brands in Hyderabad</span>
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
                        <span className="font-bold text-base text-gray-900">Bangalore Hub</span>
                      </div>
                      <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700">
                        {locationComparison.blr.activeEmployees} Active Staff
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
                        <span className="text-gray-400 block text-[10px] uppercase font-bold">Monthly Base Payroll</span>
                        <span className="font-extrabold text-base text-amber-700 block mt-0.5">
                          {formatCurrency(locationComparison.blr.totalPayroll)}
                        </span>
                        <span className="text-[10px] text-gray-500">Staff salaries</span>
                      </div>
                    </div>

                    {/* Top Vendor Reliance BLR */}
                    <div className="pt-2">
                      <span className="text-[11px] font-bold text-gray-700 block mb-2">Top Brands in Bangalore</span>
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
                {/* Spend & Revenue Comparison */}
                <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs">
                  <h4 className="text-sm font-bold text-gray-800 mb-4 flex items-center gap-2">
                    <BarChart2 className="h-4 w-4 text-[#3b2fc9]" />
                    Procurement Cost vs Tuckshop Revenue by Hub
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

                {/* Efficiency Indicators: Cost per Unit & Staff Productivity */}
                <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs">
                  <h4 className="text-sm font-bold text-gray-800 mb-4 flex items-center gap-2">
                    <Percent className="h-4 w-4 text-purple-600" />
                    Unit Cost Efficiency & Staff Productivity
                  </h4>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={[
                          { name: 'Hyderabad', 'Cost Per Unit (₹)': Math.round(locationComparison.hydCostPerUnit), 'Revenue Per Staff (₹)': Math.round(locationComparison.hydRevPerStaff) },
                          { name: 'Bangalore', 'Cost Per Unit (₹)': Math.round(locationComparison.blrCostPerUnit), 'Revenue Per Staff (₹)': Math.round(locationComparison.blrRevPerStaff) },
                        ]}
                        margin={{ top: 10, right: 10, left: 10, bottom: 0 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} />
                        <YAxis axisLine={false} tickLine={false} tickFormatter={formatCurrency} />
                        <Tooltip formatter={(val: number) => formatCurrency(val)} />
                        <Legend />
                        <Bar dataKey="Cost Per Unit (₹)" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="Revenue Per Staff (₹)" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ─────────────────────────────────────────────────────────────
              TAB 4: MONTHLY FINANCIAL LEDGER & CASH FLOW
          ───────────────────────────────────────────────────────────── */}
          {activeTab === 'ledger' && (
            <div className="space-y-6">
              {/* Cumulative Running Cash Flow Curve */}
              <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-emerald-600" />
                      Cumulative Running Net Profit & Surplus Curve
                    </h3>
                    <p className="text-xs text-gray-500">Tracking aggregate profit growth and cumulative liquidity position over time.</p>
                  </div>
                  <span className={`text-xs font-extrabold px-3 py-1 rounded-full border self-start sm:self-auto ${
                    overallTotals.netProfit >= 0
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                      : 'bg-red-50 text-red-800 border-red-200'
                  }`}>
                    Cumulative: {formatCurrency(overallTotals.netProfit)} ({overallTotals.netMarginPercent.toFixed(1)}%)
                  </span>
                </div>

                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={ledgerReport} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                      <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 11 }} />
                      <YAxis axisLine={false} tickLine={false} tickFormatter={formatCurrency} tick={{ fontSize: 11 }} />
                      <Tooltip formatter={(val: number) => formatCurrency(val)} />
                      <Legend />
                      <Line type="monotone" dataKey="runningNetProfit" name="Cumulative Net Profit (₹)" stroke="#10b981" strokeWidth={3} dot={{ r: 4 }} />
                      <Line type="monotone" dataKey="netProfit" name="Monthly P&L (₹)" stroke="#3b2fc9" strokeWidth={1.5} strokeDasharray="4 4" dot={{ r: 3 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Monthly Profit & Loss Detailed Table */}
              <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden">
                <div className="p-4 sm:p-5 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h3 className="font-bold text-gray-900 text-sm">Monthly Cafeteria P&L Ledger</h3>
                    <p className="text-xs text-gray-500">Reconciled statement of tuckshop revenue, procurement goods, staff pay, and net profit.</p>
                  </div>
                  <button
                    type="button"
                    onClick={handleExportExcel}
                    className="h-8 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-colors self-start sm:self-auto"
                  >
                    <FileSpreadsheet className="h-3.5 w-3.5" />
                    Download Excel (.xlsx)
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-gray-50 border-b border-gray-200 text-gray-600 font-bold uppercase tracking-wider text-[10px]">
                      <tr>
                        <th className="p-3.5">Period</th>
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
                      {ledgerReport.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="p-8 text-center text-gray-400">
                            No financial records available yet to generate the ledger.
                          </td>
                        </tr>
                      ) : (
                        ledgerReport.map((row) => (
                          <tr key={row.periodKey} className="hover:bg-gray-50/80 transition-colors">
                            <td className="p-3.5 font-bold text-gray-900 whitespace-nowrap">
                              {row.label}
                              <span className="block text-[10px] text-gray-400 font-normal">{row.periodKey}</span>
                            </td>
                            <td className="p-3.5 text-right font-semibold text-emerald-700">
                              {formatCurrency(row.revenue)}
                            </td>
                            <td className="p-3.5 text-right text-blue-700">
                              {formatCurrency(row.procurement)}
                            </td>
                            <td className="p-3.5 text-right text-gray-600">
                              {formatCurrency(row.expenses)}
                            </td>
                            <td className="p-3.5 text-right text-amber-700">
                              {formatCurrency(row.payroll)}
                            </td>
                            <td className="p-3.5 text-right font-bold text-gray-900">
                              {formatCurrency(row.totalCost)}
                            </td>
                            <td className={`p-3.5 text-right font-black ${
                              row.netProfit >= 0 ? 'text-emerald-600' : 'text-red-600'
                            }`}>
                              {row.netProfit >= 0 ? `+${formatCurrency(row.netProfit)}` : formatCurrency(row.netProfit)}
                            </td>
                            <td className="p-3.5 text-center">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                row.profitMargin >= 0
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-red-100 text-red-800'
                              }`}>
                                {row.profitMargin}%
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                    {ledgerReport.length > 0 && (
                      <tfoot className="bg-gray-50 font-bold border-t border-gray-200">
                        <tr>
                          <td className="p-3.5 text-gray-800">Total Filtered Period</td>
                          <td className="p-3.5 text-right text-emerald-700">{formatCurrency(overallTotals.revenue)}</td>
                          <td className="p-3.5 text-right text-blue-700">{formatCurrency(overallTotals.procurement)}</td>
                          <td className="p-3.5 text-right text-gray-600">{formatCurrency(overallTotals.expenses)}</td>
                          <td className="p-3.5 text-right text-amber-700">{formatCurrency(overallTotals.payroll)}</td>
                          <td className="p-3.5 text-right text-gray-900">{formatCurrency(overallTotals.totalOperatingCost)}</td>
                          <td className={`p-3.5 text-right font-black ${overallTotals.netProfit >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                            {overallTotals.netProfit >= 0 ? `+${formatCurrency(overallTotals.netProfit)}` : formatCurrency(overallTotals.netProfit)}
                          </td>
                          <td className="p-3.5 text-center">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              overallTotals.netMarginPercent >= 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                            }`}>
                              {overallTotals.netMarginPercent.toFixed(1)}%
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
