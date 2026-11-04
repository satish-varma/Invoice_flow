'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Upload, CheckCircle2, FileSpreadsheet, ArrowLeft, Filter, Sparkles, X, BookOpen, Package, Search, ChevronDown, ChevronUp, Eye, EyeOff, Layers, Download, Award, TrendingUp, Tag } from 'lucide-react';
import { useRouter } from 'next/navigation';
import * as XLSX from 'xlsx';
import { NewRelicChallan } from '@/types/challan';
import { getNewRelicChallans, NEWRELIC_LOCATIONS } from '@/services/newrelicChallanService';
import { getAliases, saveAlias, deleteAlias, AliasMapping } from '@/services/aliasMappingService';
import { useAuth } from '@/contexts/AuthContext';
import { triggerHaptic } from '@/lib/haptics';
import { hasPermission } from '@/types/permissions';

interface Difference {
  dcs: string[];
  item: string;
  mrp: number;
  aggQty: number;
  aggVal: number;
  ourQty: number;
  ourVal: number;
  issue: string;
  status: 'match' | 'mismatch' | 'missing';
}

export default function ReconcilePage() {
  const router = useRouter();
  const { role, user, isReadOnly } = useAuth();
  
  const [challans, setChallans] = useState<NewRelicChallan[]>([]);
  const [aliases, setAliases] = useState<AliasMapping[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Alias Modal
  const [isAliasModalOpen, setIsAliasModalOpen] = useState(false);
  const [aliasForm, setAliasForm] = useState({ internalName: '', aggregatorName: '' });
  
  // Filters
  const [filterLocation, setFilterLocation] = useState<string>('all');
  const [filterMonth, setFilterMonth] = useState<string>(() => new Date().getMonth().toString());
  const [filterYear, setFilterYear] = useState<string>(() => new Date().getFullYear().toString());
  const [filterCycle, setFilterCycle] = useState<string>(() => new Date().getDate() <= 15 ? '1-15' : '16-31');

  const [fileName, setFileName] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [differences, setDifferences] = useState<Difference[] | null>(null);
  const [summary, setSummary] = useState({
    aggVal: 0,
    ourVal: 0,
    diff: 0,
  });
  
  const [filterTab, setFilterTab] = useState<'all' | 'issues' | 'matches'>('issues');
  
  // Cycle Items Ledger View
  const [showCycleLedger, setShowCycleLedger] = useState(false);
  const [cycleSearchTerm, setCycleSearchTerm] = useState('');
  const [selectedBrandFilter, setSelectedBrandFilter] = useState<string>('all');
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [data, aliasData] = await Promise.all([
          getNewRelicChallans(),
          getAliases()
        ]);
        setChallans(data);
        setAliases(aliasData);
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, []);

  useEffect(() => {
    // Strictly restrict Reconcile to users with tuckshop_reconcile permission or admin
    if (user && role && role !== 'admin' && role !== 'superadmin' && !hasPermission(user, 'tuckshop_reconcile')) {
      router.push('/newrelic');
    }
  }, [user, role, router]);

  const hasInitializedRef = useRef(false);
  useEffect(() => {
    if (hasInitializedRef.current) return;
    if (!user) return;
    hasInitializedRef.current = true;
    if (user?.preferredLocations && user.preferredLocations.length > 0) {
      setFilterLocation('preferred');
    }
  }, [user]);

  const availableYears = useMemo(() => {
    return Array.from(new Set(challans.map(c => new Date(c.dcDate).getFullYear()))).sort((a, b) => b - a);
  }, [challans]);

  const displayChallans = useMemo(() => {
    let list = challans.filter(c => !c.isDeleted);
    
    if (filterLocation !== 'all') {
      if (filterLocation === 'preferred' && user?.preferredLocations) {
        list = list.filter((c) => user.preferredLocations!.includes(c.location));
      } else {
        list = list.filter((c) => c.location === filterLocation);
      }
    }
    if (filterMonth !== 'all') {
      list = list.filter((c) => new Date(c.dcDate).getMonth().toString() === filterMonth);
    }
    if (filterYear !== 'all') {
      list = list.filter((c) => new Date(c.dcDate).getFullYear().toString() === filterYear);
    }
    if (filterCycle !== 'all') {
      list = list.filter((c) => {
        const d = new Date(c.dcDate).getDate();
        if (filterCycle === '1-15') return d >= 1 && d <= 15;
        if (filterCycle === '16-31') return d >= 16;
        return true;
      });
    }
    return list;
  }, [challans, filterLocation, filterMonth, filterYear, filterCycle, user]);

  const cycleItemsBreakdown = useMemo(() => {
    const map = new Map<string, {
      brand: string;
      desc: string;
      fullName: string;
      dcs: Set<string>;
      dcSplits: Record<string, number>;
      totalQty: number;
      mrp: number;
      totalVal: number;
    }>();

    displayChallans.forEach(c => {
      const dcNum = c.dcNumber || 'Unknown DC';
      c.lineItems?.forEach(item => {
        const brand = (item.brandName || '').trim();
        const desc = (item.itemName || '').trim();
        const fullName = `${brand} ${desc}`.trim();
        const mrp = Number(item.mrp) || 0;
        const qty = Number(item.quantity) || 0;
        const key = `${fullName.toLowerCase()}__${mrp}`;

        const existing = map.get(key) || {
          brand,
          desc,
          fullName,
          dcs: new Set<string>(),
          dcSplits: {},
          totalQty: 0,
          mrp,
          totalVal: 0,
        };
        if (c.dcNumber) existing.dcs.add(c.dcNumber);
        existing.dcSplits[dcNum] = (existing.dcSplits[dcNum] || 0) + qty;
        existing.totalQty += qty;
        existing.totalVal += qty * mrp;
        map.set(key, existing);
      });
    });

    return Array.from(map.values()).sort((a, b) => a.fullName.localeCompare(b.fullName));
  }, [displayChallans]);

  const availableBrands = useMemo(() => {
    const set = new Set<string>();
    cycleItemsBreakdown.forEach(item => {
      if (item.brand) set.add(item.brand);
    });
    return Array.from(set).sort();
  }, [cycleItemsBreakdown]);

  const filteredCycleItems = useMemo(() => {
    return cycleItemsBreakdown.filter(item => {
      if (selectedBrandFilter !== 'all' && item.brand.toLowerCase() !== selectedBrandFilter.toLowerCase()) {
        return false;
      }
      if (!cycleSearchTerm) return true;
      const term = cycleSearchTerm.toLowerCase();
      const matchName = item.fullName.toLowerCase().includes(term);
      const matchDC = Array.from(item.dcs).some(dc => dc.toLowerCase().includes(term));
      return matchName || matchDC;
    });
  }, [cycleItemsBreakdown, selectedBrandFilter, cycleSearchTerm]);

  const cycleTotals = useMemo(() => {
    return cycleItemsBreakdown.reduce(
      (acc, item) => ({
        totalQty: acc.totalQty + item.totalQty,
        totalVal: acc.totalVal + item.totalVal,
      }),
      { totalQty: 0, totalVal: 0 }
    );
  }, [cycleItemsBreakdown]);

  const ledgerKPIs = useMemo(() => {
    let totalQty = 0;
    let totalVal = 0;
    let mrpSum = 0;
    const brandMap: Record<string, { qty: number; val: number }> = {};
    let topItem: { name: string; qty: number } = { name: '—', qty: 0 };

    cycleItemsBreakdown.forEach(item => {
      totalQty += item.totalQty;
      totalVal += item.totalVal;
      mrpSum += item.mrp * item.totalQty;

      const brandKey = item.brand || 'Unbranded';
      if (!brandMap[brandKey]) brandMap[brandKey] = { qty: 0, val: 0 };
      brandMap[brandKey].qty += item.totalQty;
      brandMap[brandKey].val += item.totalVal;

      if (item.totalQty > topItem.qty) {
        topItem = { name: item.fullName, qty: item.totalQty };
      }
    });

    let topBrand: { name: string; qty: number; val: number } = { name: '—', qty: 0, val: 0 };
    Object.entries(brandMap).forEach(([bName, bData]) => {
      if (bData.qty > topBrand.qty) {
        topBrand = { name: bName, qty: bData.qty, val: bData.val };
      }
    });

    const avgMrp = totalQty > 0 ? mrpSum / totalQty : 0;

    return {
      totalQty,
      totalVal,
      topBrand,
      topItem,
      avgMrp,
      uniqueSkuCount: cycleItemsBreakdown.length,
    };
  }, [cycleItemsBreakdown]);

  const handleExportLedgerExcel = () => {
    triggerHaptic('medium');
    if (cycleItemsBreakdown.length === 0) {
      alert("No cycle items to export.");
      return;
    }

    const monthName = !isNaN(Number(filterMonth))
      ? new Date(2000, Number(filterMonth), 1).toLocaleString('default', { month: 'short' })
      : filterMonth;

    const exportRows = cycleItemsBreakdown.map((item, index) => {
      const dcSplitsText = Object.entries(item.dcSplits)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([dc, q]) => `${dc}: ${q} pcs`)
        .join(' | ');

      return {
        '#': index + 1,
        'Brand': item.brand,
        'Item Description': item.desc,
        'Full Product Name': item.fullName,
        'Dispatched DCs': Array.from(item.dcs).join(', '),
        'Per-DC Quantities': dcSplitsText,
        'MRP (₹)': item.mrp,
        'Total Cycle Qty (pcs)': item.totalQty,
        'Total Value (₹)': item.totalVal,
      };
    });

    const ws = XLSX.utils.json_to_sheet(exportRows);

    const colWidths = [
      { wch: 5 },
      { wch: 18 },
      { wch: 32 },
      { wch: 36 },
      { wch: 22 },
      { wch: 38 },
      { wch: 10 },
      { wch: 18 },
      { wch: 16 },
    ];
    ws['!cols'] = colWidths;

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Cycle Item Ledger');

    const outFileName = `Cycle_Ledger_${filterLocation}_${monthName}_${filterYear}_Cycle${filterCycle}.xlsx`;
    XLSX.writeFile(wb, outFileName);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (filterLocation === 'all' || filterMonth === 'all' || filterYear === 'all' || filterCycle === 'all') {
      alert("Please select Location, Year, Month, and Cycle before uploading the invoice.");
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setFileName(file.name);
    setIsProcessing(true);
    
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      const rows = XLSX.utils.sheet_to_json<any[]>(worksheet, { header: 1 });
      
      if (rows.length < 2) {
        throw new Error("File seems empty or invalid");
      }
      
      const headerRow = rows[0].map((h: any) => String(h).trim().toLowerCase());
      
      const dcCol = headerRow.findIndex(h => h.includes('dc no'));
      const brandCol = headerRow.findIndex(h => h.includes('brand name'));
      const descCol = headerRow.findIndex(h => h.includes('description'));
      const qtyCol = headerRow.findIndex(h => h.includes('total qty') || h.includes('total quantity'));
      const valCol = headerRow.findIndex(h => h.includes('total value'));
      
      if (dcCol === -1 || qtyCol === -1 || valCol === -1) {
        throw new Error("Could not find required columns (DC No., Total Qty, Total Value) in the header row.");
      }
      
      const aggData: { dcs: string[], brand: string, desc: string, totalQty: number, totalVal: number, dailyData: { dateStr: string, qty: number }[] }[] = [];
      
      // Identify date columns
      const dateColumns: { index: number, dateStr: string }[] = [];
      headerRow.forEach((h: any, idx: number) => {
        const hStr = String(h).trim();
        // Look for date-like headers: e.g. "9/16/2026", "2026-09-16", or excel serial dates (46250)
        let parsedDate: Date | null = null;
        if (!isNaN(Number(hStr)) && Number(hStr) > 40000) {
          // Excel serial date
          parsedDate = new Date((Number(hStr) - (25567 + 1)) * 86400 * 1000);
        } else if (hStr.match(/^\d{1,4}[-/]\d{1,2}[-/]\d{1,4}/)) {
          parsedDate = new Date(hStr);
        }

        if (parsedDate && !isNaN(parsedDate.getTime())) {
          // Format to YYYY-MM-DD for easy comparison
          const y = parsedDate.getFullYear();
          const m = String(parsedDate.getMonth() + 1).padStart(2, '0');
          const d = String(parsedDate.getDate()).padStart(2, '0');
          dateColumns.push({ index: idx, dateStr: `${y}-${m}-${d}` });
        }
      });

      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (!row || row.length === 0) continue;
        if (String(row[0]).toLowerCase() === 'total') continue;
        
        const dcRaw = row[dcCol];
        if (!dcRaw) continue;
        
        const dcs = (String(dcRaw).match(/[A-Za-z]{2,}\s*\d+/g) || String(dcRaw).split(/[,./;\s]+/))
          .map(s => s.replace(/\s+/g, '').toUpperCase())
          .filter(Boolean);
        const brand = brandCol !== -1 && row[brandCol] ? String(row[brandCol]).trim() : '';
        const desc = descCol !== -1 && row[descCol] ? String(row[descCol]).trim() : '';
        const totalQty = parseInt(row[qtyCol], 10) || 0;
        const totalVal = parseFloat(row[valCol]) || 0;
        
        const dailyData: { dateStr: string, qty: number }[] = [];
        dateColumns.forEach(col => {
          const qty = parseInt(row[col.index], 10) || 0;
          if (qty > 0) {
            dailyData.push({ dateStr: col.dateStr, qty });
          }
        });

        if (totalQty > 0 || dailyData.length > 0) {
          aggData.push({ dcs, brand, desc, totalQty, totalVal, dailyData });
        }
      }

      // Parse our items, including date, mrp, and fullName
      const ourItems: {
        dcNumber: string;
        dateStr: string;
        brand: string;
        desc: string;
        fullName: string;
        qty: number;
        mrp: number;
        val: number;
        _matched?: boolean;
      }[] = [];

      displayChallans.forEach(c => {
        const cDate = new Date(c.dcDate);
        const y = cDate.getFullYear();
        const m = String(cDate.getMonth() + 1).padStart(2, '0');
        const d = String(cDate.getDate()).padStart(2, '0');
        const dateStr = `${y}-${m}-${d}`;

        if (c.lineItems) {
          c.lineItems.forEach(item => {
            const brand = (item.brandName || '').trim();
            const desc = (item.itemName || '').trim();
            const qty = Number(item.quantity) || 0;
            const mrp = Number(item.mrp) || 0;
            ourItems.push({
              dcNumber: (c.dcNumber || '').trim(),
              dateStr,
              brand,
              desc,
              fullName: `${brand} ${desc}`.trim(),
              qty,
              mrp,
              val: qty * mrp,
              _matched: false,
            });
          });
        }
      });

      const normalize = (s: string) =>
        s
          .toLowerCase()
          .replace(/&/g, 'and')
          .replace(/juice/g, '')
          .replace(/alphonse/g, 'alphonso')
          .replace(/penut/g, 'peanut')
          .replace(/yogabar/g, 'yoga bar')
          .replace(/butter\s*milk/g, 'buttermilk')
          .replace(/[^a-z0-9]/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();

      const getMatchScore = (name1: string, name2: string) => {
        const n1 = normalize(name1);
        const n2 = normalize(name2);
        if (n1 === n2) return 1.0;
        const w1 = n1.split(' ').filter(Boolean);
        const w2 = n2.split(' ').filter(Boolean);
        let matches = 0;
        for (const word of w1) {
          if (w2.includes(word)) matches += 1;
          else if (w2.some(w => (w.length > 3 && word.includes(w)) || (word.length > 3 && w.includes(word)))) matches += 0.8;
        }
        const union = w1.length + w2.length - matches;
        return union > 0 ? matches / union : 0;
      };

      const diffs: Difference[] = [];

      aggData.forEach(aggItem => {
        const aggFullName = `${aggItem.brand} ${aggItem.desc}`.trim();
        const alias = aliases.find(a => a.aggregatorName.toLowerCase() === aggFullName.toLowerCase());

        let actualOurTotalQty = 0;
        let actualOurTotalVal = 0;
        let matchedMrp = 0;

        for (const dc of aggItem.dcs) {
          const dcUpper = dc.toUpperCase();
          const candidates = ourItems.filter(i => !i._matched && i.dcNumber.toUpperCase() === dcUpper);

          let bestItem: typeof ourItems[0] | null = null;
          let bestScore = 0;

          for (const cand of candidates) {
            let score = 0;
            if (alias && cand.fullName.toLowerCase() === alias.internalName.toLowerCase()) {
              score = 10.0;
            } else {
              score = getMatchScore(aggFullName, cand.fullName);
            }

            if (score > bestScore) {
              bestScore = score;
              bestItem = cand;
            }
          }

          if (bestItem && bestScore >= 0.55) {
            bestItem._matched = true;
            actualOurTotalQty += bestItem.qty;
            actualOurTotalVal += bestItem.val;
            matchedMrp = bestItem.mrp;
          }
        }

        if (matchedMrp === 0 && aggItem.totalQty > 0) {
          matchedMrp = Math.round((aggItem.totalVal / aggItem.totalQty) * 100) / 100;
        }

        const isExactMatch = actualOurTotalQty === aggItem.totalQty && actualOurTotalVal === aggItem.totalVal;

        if (isExactMatch) {
          diffs.push({
            dcs: aggItem.dcs,
            item: aggFullName,
            mrp: matchedMrp,
            aggQty: aggItem.totalQty,
            aggVal: aggItem.totalVal,
            ourQty: actualOurTotalQty,
            ourVal: actualOurTotalVal,
            issue: 'Perfect Match',
            status: 'match',
          });
        } else {
          diffs.push({
            dcs: aggItem.dcs,
            item: aggFullName,
            mrp: matchedMrp,
            aggQty: aggItem.totalQty,
            aggVal: aggItem.totalVal,
            ourQty: actualOurTotalQty,
            ourVal: actualOurTotalVal,
            issue:
              actualOurTotalQty === 0
                ? 'Missing in our system'
                : actualOurTotalQty !== aggItem.totalQty
                ? 'Quantity mismatch'
                : 'Price mismatch',
            status: actualOurTotalQty === 0 ? 'missing' : 'mismatch',
          });
        }
      });

      // Collect remaining unmatched items from our system (grouped by name & MRP across DCs)
      const unmatchedMap = new Map<string, {
        dcs: Set<string>;
        fullName: string;
        qty: number;
        mrp: number;
        val: number;
      }>();

      ourItems.forEach(ourItem => {
        if (!ourItem._matched) {
          const key = `${ourItem.fullName.toLowerCase()}__${ourItem.mrp}`;
          const existing = unmatchedMap.get(key) || {
            dcs: new Set<string>(),
            fullName: ourItem.fullName,
            qty: 0,
            mrp: ourItem.mrp,
            val: 0,
          };
          existing.dcs.add(ourItem.dcNumber);
          existing.qty += ourItem.qty;
          existing.val += ourItem.val;
          unmatchedMap.set(key, existing);
        }
      });

      unmatchedMap.forEach(item => {
        diffs.push({
          dcs: Array.from(item.dcs),
          item: item.fullName,
          mrp: item.mrp,
          aggQty: 0,
          aggVal: 0,
          ourQty: item.qty,
          ourVal: item.val,
          issue: 'Missing in aggregator invoice',
          status: 'missing',
        });
      });

      const totalOurVal = ourItems.reduce((acc, curr) => acc + curr.val, 0);
      const totalAggVal = aggData.reduce((acc, curr) => acc + curr.totalVal, 0);

      setSummary({
        aggVal: totalAggVal,
        ourVal: totalOurVal,
        diff: totalAggVal - totalOurVal,
      });
      
      setDifferences(diffs);
      
    } catch (err: any) {
      alert("Error processing file: " + err.message);
    } finally {
      setIsProcessing(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleSaveAlias = async () => {
    if (isReadOnly || role === 'guest') {
      alert('Read-Only Mode: Guest account cannot add alias mappings.');
      return;
    }
    if (!aliasForm.internalName || !aliasForm.aggregatorName) return;
    try {
      const newAlias: AliasMapping = {
        id: Math.random().toString(36).substr(2, 9),
        internalName: aliasForm.internalName,
        aggregatorName: aliasForm.aggregatorName
      };
      await saveAlias(newAlias);
      setAliases([...aliases, newAlias]);
      setAliasForm({ internalName: '', aggregatorName: '' });
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteAlias = async (id: string) => {
    if (isReadOnly || role === 'guest') {
      alert('Read-Only Mode: Guest account cannot delete alias mappings.');
      return;
    }
    try {
      await deleteAlias(id);
      setAliases(aliases.filter(a => a.id !== id));
    } catch (e) {
      console.error(e);
    }
  };

  if (role !== 'admin' && role !== 'superadmin' && !hasPermission(user, 'tuckshop_reconcile')) {
    return (
      <div className="min-h-screen bg-transparent flex items-center justify-center">
        <p className="text-gray-500">Access Denied</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-transparent pb-28">
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-8 py-4 sm:py-8 space-y-5 sm:space-y-6">
        {(isReadOnly || role === 'guest') && (
          <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between text-amber-700 dark:text-amber-400">
            <div className="flex items-center gap-2 text-xs font-bold">
              <span>👁️</span>
              <span>Guest Mode (Read-Only) — Reconcile inspection enabled. Alias editing is disabled.</span>
            </div>
            <span className="text-[10px] font-black uppercase tracking-wider bg-amber-500/20 px-2 py-0.5 rounded-full">
              Read-Only
            </span>
          </div>
        )}
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <button 
                onClick={() => {
                  triggerHaptic('light');
                  router.push('/newrelic');
                }}
                className="h-9 px-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800 font-bold text-xs inline-flex items-center gap-1.5 active:scale-95 transition-all shadow-xs"
                aria-label="Back to dashboard"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Back
              </button>
              <span className="uppercase text-[10px] sm:text-xs font-black tracking-widest text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-2.5 py-1 rounded-full border border-indigo-200/60 dark:border-indigo-800/60 inline-flex items-center gap-1.5 shadow-xs">
                <Sparkles className="w-3 h-3 text-indigo-500" />
                Audit • Reconciliation
              </span>
            </div>
            <h1 className="text-2xl sm:text-4xl font-black text-slate-900 dark:text-white tracking-tight">
              Reconcile Invoice
            </h1>
            <p className="text-xs sm:text-sm font-medium text-slate-500 dark:text-slate-400 mt-1">
              Upload aggregator Excel to audit and match against internal DC ledger.
            </p>
          </div>

          <div className="flex justify-end">
            <button
              onClick={() => {
                triggerHaptic('light');
                setIsAliasModalOpen(true);
              }}
              className="w-full sm:w-auto h-11 px-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-indigo-600 dark:text-indigo-400 font-black text-xs sm:text-sm rounded-2xl shadow-xs hover:bg-indigo-50/50 dark:hover:bg-indigo-950/30 active:scale-95 transition-all inline-flex items-center justify-center gap-2"
            >
              <BookOpen className="h-4 w-4" />
              SKU Alias Dictionary
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white dark:bg-slate-900 p-4 sm:p-6 rounded-2xl sm:rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-[0_4px_16px_-4px_rgba(0,0,0,0.06)] space-y-4">
          <div className="flex items-center gap-2 text-slate-800 dark:text-slate-200 font-bold pb-2 border-b border-slate-100 dark:border-slate-800 text-sm">
            <Filter className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
            <span>Step 1: Select Billing Cycle & Location</span>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 sm:gap-4">
            <div className="space-y-1.5">
              <label className="text-[11px] font-black uppercase text-slate-400 tracking-wider">Location</label>
              <select
                value={filterLocation}
                onChange={(e) => {
                  triggerHaptic('light');
                  setFilterLocation(e.target.value);
                }}
                className="h-12 sm:h-10 w-full px-3 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 bg-white dark:bg-slate-800 capitalize shadow-xs"
              >
                <option value="all" disabled>Select Location</option>
                {user?.preferredLocations && user.preferredLocations.length > 0 && (
                  <option value="preferred">My Preferred Locations</option>
                )}
                {Object.entries(NEWRELIC_LOCATIONS).map(([key, loc]) => (
                  <option key={key} value={key}>{loc.label}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-black uppercase text-slate-400 tracking-wider">Year</label>
              <select
                value={filterYear}
                onChange={(e) => {
                  triggerHaptic('light');
                  setFilterYear(e.target.value);
                }}
                className="h-12 sm:h-10 w-full px-3 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 bg-white dark:bg-slate-800 shadow-xs"
              >
                <option value="all" disabled>Select Year</option>
                {availableYears.map(year => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-black uppercase text-slate-400 tracking-wider">Month</label>
              <select
                value={filterMonth}
                onChange={(e) => {
                  triggerHaptic('light');
                  setFilterMonth(e.target.value);
                }}
                className="h-12 sm:h-10 w-full px-3 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 bg-white dark:bg-slate-800 shadow-xs"
              >
                <option value="all" disabled>Select Month</option>
                {Array.from({ length: 12 }, (_, i) => {
                  const date = new Date(2000, i, 1);
                  return <option key={i} value={i}>{date.toLocaleString('default', { month: 'long' })}</option>;
                })}
              </select>
            </div>
            
            <div className="space-y-1.5">
              <label className="text-[11px] font-black uppercase text-slate-400 tracking-wider">Cycle</label>
              <select
                value={filterCycle}
                onChange={(e) => {
                  triggerHaptic('light');
                  setFilterCycle(e.target.value);
                }}
                className="h-12 sm:h-10 w-full px-3 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 bg-white dark:bg-slate-800 shadow-xs"
              >
                <option value="all" disabled>Select Cycle</option>
                <option value="1-15">1st - 15th</option>
                <option value="16-31">16th - End</option>
              </select>
            </div>
          </div>

          <div className="pt-2 text-xs sm:text-sm text-slate-500 dark:text-slate-400 flex items-center justify-between">
            <span>Found <strong className="text-slate-900 dark:text-white font-mono font-bold">{displayChallans.length} challans</strong> matching current filters.</span>
          </div>
        </div>

        {/* Cycle Dispatch Ledger: Item Quantities & MRPs */}
        {displayChallans.length > 0 && (
          <div className="bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-[0_4px_16px_-4px_rgba(0,0,0,0.06)] overflow-hidden">
            <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 rounded-xl border border-indigo-200/60 dark:border-indigo-800/60">
                  <Package className="h-4 w-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-black text-slate-900 dark:text-white text-sm sm:text-base">
                      Cycle Dispatch Ledger
                    </h3>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-mono">
                      {cycleItemsBreakdown.length} Items
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                    Individual quantities and MRPs dispatched across the {displayChallans.length} challans in this cycle.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 self-end sm:self-auto">
                <div className="text-right mr-2 hidden sm:block">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Total Dispatched</span>
                  <span className="text-xs font-mono font-black text-slate-900 dark:text-white">
                    {cycleTotals.totalQty.toLocaleString('en-IN')} pcs • ₹{cycleTotals.totalVal.toLocaleString('en-IN')}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic('light');
                    setShowCycleLedger(!showCycleLedger);
                  }}
                  className="h-9 px-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/60 inline-flex items-center gap-1.5 shadow-2xs active:scale-95 transition-all"
                >
                  {showCycleLedger ? <EyeOff className="w-3.5 h-3.5 text-slate-500" /> : <Eye className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />}
                  <span>{showCycleLedger ? 'Hide Ledger' : 'View Item Ledger & MRPs'}</span>
                  {showCycleLedger ? <ChevronUp className="w-3.5 h-3.5 ml-0.5 opacity-60" /> : <ChevronDown className="w-3.5 h-3.5 ml-0.5 opacity-60" />}
                </button>
              </div>
            </div>

            {showCycleLedger && (
              <div className="p-4 sm:p-5 space-y-4 animate-in fade-in duration-200">
                {/* 5. Executive KPI Strip */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
                  {/* Total Units */}
                  <div className="p-3 sm:p-3.5 bg-gradient-to-br from-indigo-50/70 to-indigo-100/30 dark:from-indigo-950/40 dark:to-indigo-900/20 border border-indigo-200/60 dark:border-indigo-800/60 rounded-2xl">
                    <div className="flex items-center justify-between text-indigo-700 dark:text-indigo-400 mb-1">
                      <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-wider">Total Dispatched</span>
                      <Package className="w-3.5 h-3.5" />
                    </div>
                    <div className="text-base sm:text-lg font-black font-mono text-slate-900 dark:text-white">
                      {ledgerKPIs.totalQty.toLocaleString('en-IN')} <span className="text-xs font-semibold text-slate-500">pcs</span>
                    </div>
                    <div className="text-[10px] font-medium text-slate-500 dark:text-slate-400 mt-0.5">
                      Across {displayChallans.length} challans • {ledgerKPIs.uniqueSkuCount} SKUs
                    </div>
                  </div>

                  {/* Gross Value */}
                  <div className="p-3 sm:p-3.5 bg-gradient-to-br from-emerald-50/70 to-emerald-100/30 dark:from-emerald-950/40 dark:to-emerald-900/20 border border-emerald-200/60 dark:border-emerald-800/60 rounded-2xl">
                    <div className="flex items-center justify-between text-emerald-700 dark:text-emerald-400 mb-1">
                      <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-wider">Gross Value</span>
                      <TrendingUp className="w-3.5 h-3.5" />
                    </div>
                    <div className="text-base sm:text-lg font-black font-mono text-emerald-700 dark:text-emerald-400">
                      ₹{ledgerKPIs.totalVal.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                    </div>
                    <div className="text-[10px] font-medium text-slate-500 dark:text-slate-400 mt-0.5">
                      Avg MRP: ₹{ledgerKPIs.avgMrp.toFixed(2)} / unit
                    </div>
                  </div>

                  {/* Top Brand */}
                  <div className="p-3 sm:p-3.5 bg-gradient-to-br from-amber-50/70 to-amber-100/30 dark:from-amber-950/40 dark:to-amber-900/20 border border-amber-200/60 dark:border-amber-800/60 rounded-2xl">
                    <div className="flex items-center justify-between text-amber-700 dark:text-amber-400 mb-1">
                      <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-wider">Top Brand</span>
                      <Award className="w-3.5 h-3.5" />
                    </div>
                    <div className="text-sm sm:text-base font-black text-slate-900 dark:text-white truncate" title={ledgerKPIs.topBrand.name}>
                      {ledgerKPIs.topBrand.name}
                    </div>
                    <div className="text-[10px] font-mono font-bold text-amber-700 dark:text-amber-400 mt-0.5">
                      {ledgerKPIs.topBrand.qty.toLocaleString('en-IN')} pcs (₹{ledgerKPIs.topBrand.val.toLocaleString('en-IN', { maximumFractionDigits: 0 })})
                    </div>
                  </div>

                  {/* Top SKU by Qty */}
                  <div className="p-3 sm:p-3.5 bg-gradient-to-br from-sky-50/70 to-sky-100/30 dark:from-sky-950/40 dark:to-sky-900/20 border border-sky-200/60 dark:border-sky-800/60 rounded-2xl">
                    <div className="flex items-center justify-between text-sky-700 dark:text-sky-400 mb-1">
                      <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-wider">Top Volume SKU</span>
                      <Tag className="w-3.5 h-3.5" />
                    </div>
                    <div className="text-xs sm:text-sm font-black text-slate-900 dark:text-white truncate" title={ledgerKPIs.topItem.name}>
                      {ledgerKPIs.topItem.name}
                    </div>
                    <div className="text-[10px] font-mono font-bold text-sky-700 dark:text-sky-400 mt-0.5">
                      {ledgerKPIs.topItem.qty.toLocaleString('en-IN')} units dispatched
                    </div>
                  </div>
                </div>

                {/* Search Bar & 3. Export Excel Button */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pt-1">
                  <div className="relative flex-1 max-w-md">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search items, brands, or DC numbers..."
                      value={cycleSearchTerm}
                      onChange={(e) => setCycleSearchTerm(e.target.value)}
                      className="h-9 w-full pl-9 pr-8 text-xs bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-slate-800 dark:text-slate-100"
                    />
                    {cycleSearchTerm && (
                      <button
                        onClick={() => setCycleSearchTerm('')}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-auto">
                    <button
                      type="button"
                      onClick={handleExportLedgerExcel}
                      className="h-9 px-3.5 rounded-xl border border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300 text-xs font-bold inline-flex items-center gap-1.5 shadow-2xs active:scale-95 transition-all"
                      title="Download Cycle Item Ledger as Excel (.xlsx)"
                    >
                      <Download className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                      <span>Export Ledger (.xlsx)</span>
                    </button>
                  </div>
                </div>

                {/* 2. Brand Filter Chips */}
                {availableBrands.length > 0 && (
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1 pt-0.5 no-scrollbar">
                    <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider mr-1 hidden sm:inline">
                      Brand:
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        triggerHaptic('light');
                        setSelectedBrandFilter('all');
                      }}
                      className={`h-7 px-3 rounded-full text-xs font-bold transition-all whitespace-nowrap inline-flex items-center gap-1.5 ${
                        selectedBrandFilter === 'all'
                          ? 'bg-indigo-600 text-white shadow-xs shadow-indigo-600/30'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                      }`}
                    >
                      <span>All Brands</span>
                      <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${selectedBrandFilter === 'all' ? 'bg-indigo-700 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'}`}>
                        {cycleItemsBreakdown.length}
                      </span>
                    </button>
                    {availableBrands.map(b => {
                      const count = cycleItemsBreakdown.filter(i => i.brand.toLowerCase() === b.toLowerCase()).length;
                      const isSelected = selectedBrandFilter.toLowerCase() === b.toLowerCase();
                      return (
                        <button
                          key={b}
                          type="button"
                          onClick={() => {
                            triggerHaptic('light');
                            setSelectedBrandFilter(isSelected ? 'all' : b);
                          }}
                          className={`h-7 px-3 rounded-full text-xs font-bold transition-all whitespace-nowrap inline-flex items-center gap-1.5 ${
                            isSelected
                              ? 'bg-indigo-600 text-white shadow-xs shadow-indigo-600/30'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                          }`}
                        >
                          <span>{b}</span>
                          <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${isSelected ? 'bg-indigo-700 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'}`}>
                            {count}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Ledger Table with 1. Per-DC Quantity Breakdown */}
                <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-2xs max-h-[440px] overflow-y-auto">
                  {filteredCycleItems.length === 0 ? (
                    <div className="p-8 text-center text-slate-500 dark:text-slate-400 text-xs font-medium">
                      No items match your filter criteria. Try clearing search or choosing &ldquo;All Brands&rdquo;.
                    </div>
                  ) : (
                    <table className="w-full text-xs text-left">
                      <thead className="bg-slate-100/90 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-black uppercase tracking-wider sticky top-0 shadow-xs text-[10px] z-10">
                        <tr>
                          <th className="px-3.5 py-2.5">Item & Brand</th>
                          <th className="px-3.5 py-2.5">DC Breakdown (1. Per-DC Qty)</th>
                          <th className="px-3.5 py-2.5 text-right">MRP</th>
                          <th className="px-3.5 py-2.5 text-right">Cycle Total Qty</th>
                          <th className="px-3.5 py-2.5 text-right">Total Value</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900 font-medium">
                        {filteredCycleItems.map((item, idx) => (
                          <tr key={idx} className="hover:bg-indigo-50/30 dark:hover:bg-indigo-950/20 transition-colors">
                            <td className="px-3.5 py-2.5 max-w-[240px]">
                              <span className="font-bold text-slate-900 dark:text-white block leading-tight">{item.fullName}</span>
                              {item.brand && (
                                <span className="inline-block mt-0.5 text-[9px] font-bold uppercase tracking-wider text-slate-400">
                                  {item.brand}
                                </span>
                              )}
                            </td>
                            {/* 1. Per-DC breakdown badges */}
                            <td className="px-3.5 py-2.5">
                              <div className="flex flex-wrap gap-1 max-w-sm">
                                {Object.entries(item.dcSplits)
                                  .sort(([a], [b]) => a.localeCompare(b))
                                  .map(([dc, q]) => (
                                    <span
                                      key={dc}
                                      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/70 border border-indigo-200/60 dark:border-indigo-800/60 font-mono text-[10px] text-indigo-700 dark:text-indigo-300 font-semibold"
                                    >
                                      <span>{dc}:</span>
                                      <span className="text-slate-900 dark:text-white font-extrabold">{q}</span>
                                    </span>
                                  ))}
                              </div>
                            </td>
                            <td className="px-3.5 py-2.5 text-right font-mono font-bold text-slate-800 dark:text-slate-200">
                              ₹{item.mrp.toFixed(2)}
                            </td>
                            <td className="px-3.5 py-2.5 text-right font-mono font-black text-slate-900 dark:text-white">
                              {item.totalQty.toLocaleString('en-IN')} pcs
                            </td>
                            <td className="px-3.5 py-2.5 text-right font-mono font-bold text-emerald-700 dark:text-emerald-400">
                              ₹{item.totalVal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Upload & Results */}
        {!differences ? (
          <div className="bg-white dark:bg-slate-900 p-4 sm:p-6 rounded-2xl sm:rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-[0_4px_16px_-4px_rgba(0,0,0,0.06)] space-y-4">
            <div className="flex items-center gap-2 text-slate-800 dark:text-slate-200 font-bold pb-2 border-b border-slate-100 dark:border-slate-800 text-sm">
              <FileSpreadsheet className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
              <span>Step 2: Upload Excel File</span>
            </div>
            
            <input
              type="file"
              accept=".xlsx, .xls, .csv"
              className="hidden"
              ref={fileInputRef}
              onChange={handleFileUpload}
            />
            
            <button
              onClick={() => {
                triggerHaptic('medium');
                fileInputRef.current?.click();
              }}
              disabled={isProcessing || isLoading || filterLocation === 'all' || filterMonth === 'all' || filterYear === 'all' || filterCycle === 'all'}
              className="w-full py-12 sm:py-16 border-2 border-dashed border-indigo-300 dark:border-indigo-800 bg-indigo-50/50 dark:bg-indigo-950/20 hover:bg-indigo-100/50 dark:hover:bg-indigo-950/40 rounded-2xl sm:rounded-3xl flex flex-col items-center justify-center gap-3 transition-all active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isProcessing ? (
                <div className="h-9 w-9 border-4 border-indigo-300 border-t-indigo-600 rounded-full animate-spin" />
              ) : (
                <>
                  <div className="p-4 bg-white dark:bg-slate-800 shadow-md rounded-2xl text-indigo-600 dark:text-indigo-400">
                    <Upload className="h-8 w-8 stroke-[2.2]" />
                  </div>
                  <div className="text-center px-4">
                    <span className="block font-black text-indigo-950 dark:text-indigo-200 text-base sm:text-lg">Select Excel or CSV File</span>
                    <span className="block text-xs sm:text-sm text-indigo-600/70 dark:text-indigo-400/70 mt-1">Make sure you selected cycle and location above first.</span>
                  </div>
                </>
              )}
            </button>
          </div>
        ) : (
          <div className="bg-white dark:bg-slate-900 p-4 sm:p-6 rounded-2xl sm:rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-[0_4px_16px_-4px_rgba(0,0,0,0.06)] space-y-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="font-black text-slate-900 dark:text-white text-base">Reconciliation Results</h3>
              <button
                onClick={() => {
                  triggerHaptic('light');
                  setDifferences(null);
                  setFileName('');
                }}
                className="h-9 px-3.5 text-xs font-bold text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors active:scale-95"
              >
                Start Over
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4">
              <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 p-4 rounded-2xl shadow-xs">
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Aggregator Total Value</p>
                <p className="text-xl sm:text-2xl font-mono font-black text-slate-900 dark:text-white mt-1">₹{summary.aggVal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
              </div>
              <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 p-4 rounded-2xl shadow-xs">
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Our System Total</p>
                <p className="text-xl sm:text-2xl font-mono font-black text-slate-900 dark:text-white mt-1">₹{summary.ourVal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
              </div>
              <div className={`p-4 rounded-2xl border shadow-xs ${summary.diff === 0 ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200' : 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-900 dark:text-rose-200'}`}>
                <p className="text-xs font-semibold opacity-80">Difference</p>
                <p className="text-xl sm:text-2xl font-mono font-black mt-1">₹{Math.abs(summary.diff).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
                <p className="text-[11px] font-bold mt-1">{summary.diff > 0 ? "Aggregator is charging MORE" : summary.diff < 0 ? "Aggregator is charging LESS" : "Perfect Match"}</p>
              </div>
            </div>

            {/* Filter Tabs */}
            <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-x-auto">
              <button 
                onClick={() => {
                  triggerHaptic('light');
                  setFilterTab('all');
                }} 
                className={`flex-1 h-10 px-3 rounded-xl text-xs font-black transition-all whitespace-nowrap active:scale-95 ${
                  filterTab === 'all' 
                    ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs' 
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                All ({differences.length})
              </button>
              <button 
                onClick={() => {
                  triggerHaptic('light');
                  setFilterTab('issues');
                }} 
                className={`flex-1 h-10 px-3 rounded-xl text-xs font-black transition-all whitespace-nowrap active:scale-95 ${
                  filterTab === 'issues' 
                    ? 'bg-rose-600 text-white shadow-xs' 
                    : 'text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30'
                }`}
              >
                Issues ({differences.filter(d => d.status !== 'match').length})
              </button>
              <button 
                onClick={() => {
                  triggerHaptic('light');
                  setFilterTab('matches');
                }} 
                className={`flex-1 h-10 px-3 rounded-xl text-xs font-black transition-all whitespace-nowrap active:scale-95 ${
                  filterTab === 'matches' 
                    ? 'bg-emerald-600 text-white shadow-xs' 
                    : 'text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30'
                }`}
              >
                Matches ({differences.filter(d => d.status === 'match').length})
              </button>
            </div>

            {differences.filter(d => filterTab === 'all' || (filterTab === 'issues' && d.status !== 'match') || (filterTab === 'matches' && d.status === 'match')).length === 0 ? (
              <div className="p-10 text-center bg-slate-50 dark:bg-slate-800/40 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">
                <CheckCircle2 className="h-10 w-10 text-emerald-500 mx-auto mb-2 opacity-80" />
                <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300">No items found for this view.</h3>
              </div>
            ) : (
              <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs">
                {/* Mobile Cards (md:hidden) */}
                <div className="md:hidden divide-y divide-slate-100 dark:divide-slate-800 max-h-[550px] overflow-y-auto">
                  {differences
                    .filter(d => filterTab === 'all' || (filterTab === 'issues' && d.status !== 'match') || (filterTab === 'matches' && d.status === 'match'))
                    .map((diff, idx) => (
                      <div key={idx} className={`p-4 space-y-2.5 ${diff.status === 'match' ? 'bg-emerald-50/30 dark:bg-emerald-950/15' : diff.status === 'missing' ? 'bg-rose-50/30 dark:bg-rose-950/15' : 'bg-amber-50/30 dark:bg-amber-950/15'}`}>
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <span className="font-bold text-slate-900 dark:text-white text-sm block leading-snug">
                              {diff.item}
                            </span>
                            <span className="text-[11px] text-slate-400 font-mono mt-0.5 block truncate" title={diff.dcs.join(', ')}>
                              DC: {diff.dcs.join(', ')}
                            </span>
                          </div>
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-wider shrink-0 ${
                            diff.status === 'match' ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300' : diff.status === 'missing' ? 'bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300' : 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300'
                          }`}>
                            {diff.issue}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-xs bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-2xs">
                          <div>
                            <span className="text-[10px] text-slate-400 uppercase font-bold block">Aggregator</span>
                            <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{diff.aggQty} pcs</span>
                            <span className="text-slate-500 font-mono block text-[11px]">₹{diff.aggVal.toLocaleString('en-IN')}</span>
                          </div>
                          <div className="text-right">
                            <span className="text-[10px] text-slate-400 uppercase font-bold block">
                              Our Record {diff.mrp > 0 ? `(MRP ₹${diff.mrp.toFixed(0)})` : ''}
                            </span>
                            <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{diff.ourQty} pcs</span>
                            <span className="text-slate-500 font-mono block text-[11px]">₹{diff.ourVal.toLocaleString('en-IN')}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                </div>

                {/* Desktop Table (hidden md:block) */}
                <div className="hidden md:block overflow-x-auto max-h-[500px]">
                  <table className="w-full text-sm text-left min-w-[760px]">
                    <thead className="bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold sticky top-0 shadow-xs">
                      <tr>
                        <th className="px-4 py-3 border-b">DC Numbers</th>
                        <th className="px-4 py-3 border-b">Item Name</th>
                        <th className="px-4 py-3 border-b text-right">MRP</th>
                        <th className="px-4 py-3 border-b text-right">Agg. Qty</th>
                        <th className="px-4 py-3 border-b text-right">Our Qty</th>
                        <th className="px-4 py-3 border-b text-right">Agg. Value</th>
                        <th className="px-4 py-3 border-b text-right">Our Value</th>
                        <th className="px-4 py-3 border-b">Issue</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900">
                      {differences
                        .filter(d => filterTab === 'all' || (filterTab === 'issues' && d.status !== 'match') || (filterTab === 'matches' && d.status === 'match'))
                        .map((diff, idx) => (
                        <tr key={idx} className={`hover:bg-slate-50/50 dark:hover:bg-slate-800/50 ${diff.status === 'match' ? 'bg-emerald-50/20' : diff.status === 'missing' ? 'bg-rose-50/20' : 'bg-amber-50/20'}`}>
                          <td className="px-4 py-3 font-mono font-medium text-slate-900 dark:text-white max-w-[150px] truncate" title={diff.dcs.join(', ')}>
                            {diff.dcs.join(', ')}
                          </td>
                          <td className="px-4 py-3 text-slate-600 dark:text-slate-300 max-w-[200px] truncate" title={diff.item}>{diff.item}</td>
                          <td className="px-4 py-3 text-right font-mono font-bold text-slate-700 dark:text-slate-300">
                            {diff.mrp > 0 ? `₹${diff.mrp.toFixed(2)}` : '—'}
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-slate-900 dark:text-white">{diff.aggQty}</td>
                          <td className="px-4 py-3 text-right font-mono text-slate-900 dark:text-white">{diff.ourQty}</td>
                          <td className="px-4 py-3 text-right font-mono font-bold text-slate-900 dark:text-white">₹{diff.aggVal.toLocaleString('en-IN')}</td>
                          <td className="px-4 py-3 text-right font-mono font-bold text-slate-900 dark:text-white">₹{diff.ourVal.toLocaleString('en-IN')}</td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-semibold ${
                              diff.status === 'match' ? 'bg-emerald-100 text-emerald-700' : diff.status === 'missing' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'
                            }`}>
                              {diff.issue}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* SKU Alias Modal -> Bottom Sheet on Mobile */}
      {isAliasModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl w-full sm:max-w-2xl max-h-[92vh] sm:max-h-[85vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in slide-in-from-bottom sm:zoom-in-95">
            {/* Drag Handle on Mobile */}
            <div className="sm:hidden w-12 h-1.5 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto mt-2.5 mb-1 shrink-0" />

            <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800">
              <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">SKU Alias Dictionary</h2>
              <button 
                onClick={() => {
                  triggerHaptic('light');
                  setIsAliasModalOpen(false);
                }} 
                className="h-8 w-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            
            <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40">
              <div className="flex flex-col sm:flex-row gap-2.5 sm:gap-3">
                <input
                  type="text"
                  placeholder="Internal Name (e.g. Storia Banana Milkshake)"
                  value={aliasForm.internalName}
                  onChange={(e) => setAliasForm({...aliasForm, internalName: e.target.value})}
                  className="flex-1 h-12 sm:h-10 px-3.5 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 bg-white dark:bg-slate-900"
                />
                <input
                  type="text"
                  placeholder="Aggregator Name (e.g. Storia Bnana shake)"
                  value={aliasForm.aggregatorName}
                  onChange={(e) => setAliasForm({...aliasForm, aggregatorName: e.target.value})}
                  className="flex-1 h-12 sm:h-10 px-3.5 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 bg-white dark:bg-slate-900"
                />
                <button
                  onClick={() => {
                    triggerHaptic('medium');
                    handleSaveAlias();
                  }}
                  className="h-12 sm:h-10 px-5 bg-indigo-600 text-white rounded-2xl font-black text-xs sm:text-sm hover:bg-indigo-700 active:scale-95 transition-all shrink-0 shadow-md"
                >
                  Add Alias
                </button>
              </div>
            </div>
            
            <div className="overflow-y-auto p-4 sm:p-5 pb-[max(1rem,env(safe-area-inset-bottom))]">
              {aliases.length === 0 ? (
                <p className="text-xs sm:text-sm font-medium text-slate-400 text-center py-6">No aliases created yet.</p>
              ) : (
                <div className="space-y-2.5">
                  {aliases.map(alias => (
                    <div key={alias.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 rounded-2xl shadow-xs gap-2">
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-black uppercase text-indigo-600 dark:text-indigo-400 w-20 shrink-0">Internal:</span>
                          <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">{alias.internalName}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-black uppercase text-slate-400 w-20 shrink-0">Aggregator:</span>
                          <span className="text-xs sm:text-sm font-medium text-slate-600 dark:text-slate-300">{alias.aggregatorName}</span>
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          triggerHaptic('medium');
                          handleDeleteAlias(alias.id);
                        }}
                        className="h-8 px-3 text-xs font-bold text-rose-600 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 rounded-xl transition-all self-end sm:self-auto active:scale-95"
                      >
                        Delete
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
