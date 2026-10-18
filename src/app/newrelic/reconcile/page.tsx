'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Upload, CheckCircle2, FileSpreadsheet, ArrowLeft, Filter, Sparkles, X, BookOpen } from 'lucide-react';
import { useRouter } from 'next/navigation';
import * as XLSX from 'xlsx';
import { NewRelicChallan } from '@/types/challan';
import { getNewRelicChallans, NEWRELIC_LOCATIONS } from '@/services/newrelicChallanService';
import { getAliases, saveAlias, deleteAlias, AliasMapping } from '@/services/aliasMappingService';
import { useAuth } from '@/contexts/AuthContext';
import { triggerHaptic } from '@/lib/haptics';

interface Difference {
  dcs: string[];
  item: string;
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
    // Strictly restrict Reconcile to admin, superadmin, and guest (read-only)
    if (role && role !== 'admin' && role !== 'superadmin' && role !== 'guest') {
      router.push('/newrelic');
    }
  }, [role, router]);

  useEffect(() => {
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
        
        const dcs = String(dcRaw).split(',').map(s => s.trim()).filter(Boolean);
        const brand = brandCol !== -1 && row[brandCol] ? String(row[brandCol]) : '';
        const desc = descCol !== -1 && row[descCol] ? String(row[descCol]) : '';
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

      // Parse our items, now including date
      const ourItems: { dcNumber: string, dateStr: string, brand: string, desc: string, qty: number, val: number }[] = [];
      displayChallans.forEach(c => {
        const cDate = new Date(c.dcDate);
        const y = cDate.getFullYear();
        const m = String(cDate.getMonth() + 1).padStart(2, '0');
        const d = String(cDate.getDate()).padStart(2, '0');
        const dateStr = `${y}-${m}-${d}`;

        if (c.lineItems) {
          c.lineItems.forEach(item => {
            ourItems.push({
              dcNumber: c.dcNumber,
              dateStr,
              brand: item.brandName || '',
              desc: item.itemName || '',
              qty: item.quantity,
              val: item.quantity * (item.mrp || 0)
            });
          });
        }
      });

      const diffs: Difference[] = [];
      
      const isMatch = (brand1: string, desc1: string, brand2: string, desc2: string) => {
         let s1 = (brand1 + ' ' + desc1).toLowerCase().replace(/&/g, 'and').replace(/juice/g, '');
         let s2 = (brand2 + ' ' + desc2).toLowerCase().replace(/&/g, 'and').replace(/juice/g, '');
         const words1 = s1.split(/[^a-z0-9]/).filter(Boolean);
         const words2 = s2.split(/[^a-z0-9]/).filter(Boolean);
         let matches = 0;
         words1.forEach(w1 => {
             if (words2.some(w2 => w2 === w1 || (w2.length > 3 && w1.includes(w2)) || (w1.length > 3 && w2.includes(w1)))) matches++;
         });
         const score = matches / Math.max(words1.length, words2.length);
         return score >= 0.5; // at least 50% match
      };
      
      aggData.forEach(aggItem => {
        const aggFullName = `${aggItem.brand} ${aggItem.desc}`.trim();
        const alias = aliases.find(a => a.aggregatorName.toLowerCase() === aggFullName.toLowerCase());
        
        // Find matching items in our system regardless of strict date
        const matchedOurItemsTotal = ourItems.filter(item => {
          if (!aggItem.dcs.includes(item.dcNumber)) return false;
          
          if (alias) {
             const ourFullName = `${item.brand} ${item.desc}`.trim();
             return ourFullName.toLowerCase() === alias.internalName.toLowerCase();
          }
          
          return isMatch(item.brand, item.desc, aggItem.brand, aggItem.desc);
        });
        
        let actualOurTotalQty = 0;
        let actualOurTotalVal = 0;
        matchedOurItemsTotal.forEach(i => {
           actualOurTotalQty += i.qty;
           actualOurTotalVal += i.val;
           // Mark as matched so we can find orphans later
           (i as any)._matched = true;
        });

        // If quantities don't match, or they do but price doesn't
        if (actualOurTotalQty !== aggItem.totalQty || actualOurTotalVal !== aggItem.totalVal) {
             diffs.push({
               dcs: aggItem.dcs,
               item: `${aggItem.brand} ${aggItem.desc}`,
               aggQty: aggItem.totalQty,
               aggVal: aggItem.totalVal,
               ourQty: actualOurTotalQty,
               ourVal: actualOurTotalVal,
               issue: actualOurTotalQty === 0 ? "Missing in our system" : actualOurTotalQty !== aggItem.totalQty ? "Quantity mismatch" : "Price mismatch",
               status: actualOurTotalQty === 0 ? 'missing' : 'mismatch'
             });
        } else {
             diffs.push({
               dcs: aggItem.dcs,
               item: `${aggItem.brand} ${aggItem.desc}`,
               aggQty: aggItem.totalQty,
               aggVal: aggItem.totalVal,
               ourQty: actualOurTotalQty,
               ourVal: actualOurTotalVal,
               issue: "Perfect Match",
               status: 'match'
             });
        }
      });
      
      // Check for items in our system that were never matched to an aggregator row
      ourItems.forEach(ourItem => {
        if (!(ourItem as any)._matched) {
          diffs.push({
            dcs: [ourItem.dcNumber],
            item: `${ourItem.brand} ${ourItem.desc}`,
            aggQty: 0,
            aggVal: 0,
            ourQty: ourItem.qty,
            ourVal: ourItem.val,
            issue: "Missing in aggregator invoice",
            status: 'missing'
          });
        }
      });
      
      ourItems.forEach(ourItem => {
        const ourFullName = `${ourItem.brand} ${ourItem.desc}`.trim();
        const alias = aliases.find(a => a.internalName.toLowerCase() === ourFullName.toLowerCase());
        
        const matched = aggData.find(a => {
          if (!a.dcs.includes(ourItem.dcNumber)) return false;
          
          if (alias) {
            const aggFullName = `${a.brand} ${a.desc}`.trim();
            return aggFullName.toLowerCase() === alias.aggregatorName.toLowerCase();
          }
          
          return isMatch(ourItem.brand, ourItem.desc, a.brand, a.desc);
        });
        
        if (!matched) {
          diffs.push({
            dcs: [ourItem.dcNumber],
            item: `${ourItem.brand} ${ourItem.desc}`,
            aggQty: 0,
            aggVal: 0,
            ourQty: ourItem.qty,
            ourVal: ourItem.val,
            issue: "Missing in aggregator invoice",
            status: 'missing'
          });
        }
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

  if (role !== 'admin' && role !== 'superadmin' && role !== 'guest') {
    return (
      <div className="min-h-screen bg-transparent flex items-center justify-center">
        <p className="text-gray-500">Access Denied</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-transparent pb-28">
      <div className="max-w-6xl mx-auto px-3 sm:px-8 py-4 sm:py-8 space-y-5 sm:space-y-6">
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
                            <span className="text-[10px] text-slate-400 uppercase font-bold block">Our Record</span>
                            <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{diff.ourQty} pcs</span>
                            <span className="text-slate-500 font-mono block text-[11px]">₹{diff.ourVal.toLocaleString('en-IN')}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                </div>

                {/* Desktop Table (hidden md:block) */}
                <div className="hidden md:block overflow-x-auto max-h-[500px]">
                  <table className="w-full text-sm text-left min-w-[700px]">
                    <thead className="bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold sticky top-0 shadow-xs">
                      <tr>
                        <th className="px-4 py-3 border-b">DC Numbers</th>
                        <th className="px-4 py-3 border-b">Item Name</th>
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
