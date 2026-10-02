'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Upload, CheckCircle2, FileSpreadsheet, ArrowLeft, Filter } from 'lucide-react';
import { useRouter } from 'next/navigation';
import * as XLSX from 'xlsx';
import { NewRelicChallan } from '@/types/challan';
import { getNewRelicChallans, NEWRELIC_LOCATIONS } from '@/services/newrelicChallanService';
import { getAliases, saveAlias, deleteAlias, AliasMapping } from '@/services/aliasMappingService';
import { useAuth } from '@/contexts/AuthContext';

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
  const { role, user } = useAuth();
  
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
    try {
      await deleteAlias(id);
      setAliases(aliases.filter(a => a.id !== id));
    } catch (e) {
      console.error(e);
    }
  };

  if (role !== 'admin' && role !== 'superadmin') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500">Access Denied</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-12">
      <div className="max-w-6xl mx-auto px-4 sm:px-8 py-8 space-y-6">
        
        {/* Header */}
        <div className="flex items-center gap-4">
          <button 
            onClick={() => router.push('/newrelic')}
            className="p-2 bg-white border border-gray-200 text-gray-500 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Reconcile Invoice</h1>
            <p className="text-sm text-gray-500">Upload an aggregator Excel sheet to compare against our internal system.</p>
          </div>
          <div className="ml-auto">
            <button
              onClick={() => setIsAliasModalOpen(true)}
              className="px-4 py-2 bg-white border border-gray-200 text-[#3b2fc9] font-medium rounded-lg shadow-sm hover:bg-gray-50 transition-colors"
            >
              Alias Dictionary
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm space-y-4">
          <div className="flex items-center gap-2 text-gray-700 font-medium pb-2 border-b border-gray-100">
            <Filter className="h-5 w-5 text-[#3b2fc9]" />
            <h3>Step 1: Select Invoice Details</h3>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-500 uppercase">Location</label>
              <select
                value={filterLocation}
                onChange={(e) => setFilterLocation(e.target.value)}
                className="h-10 w-full px-3 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#3b2fc9]/20 focus:border-[#3b2fc9] bg-white capitalize"
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
              <label className="text-xs font-medium text-gray-500 uppercase">Year</label>
              <select
                value={filterYear}
                onChange={(e) => setFilterYear(e.target.value)}
                className="h-10 w-full px-3 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#3b2fc9]/20 focus:border-[#3b2fc9] bg-white"
              >
                <option value="all" disabled>Select Year</option>
                {availableYears.map(year => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-500 uppercase">Month</label>
              <select
                value={filterMonth}
                onChange={(e) => setFilterMonth(e.target.value)}
                className="h-10 w-full px-3 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#3b2fc9]/20 focus:border-[#3b2fc9] bg-white"
              >
                <option value="all" disabled>Select Month</option>
                {Array.from({ length: 12 }, (_, i) => {
                  const date = new Date(2000, i, 1);
                  return <option key={i} value={i}>{date.toLocaleString('default', { month: 'long' })}</option>;
                })}
              </select>
            </div>
            
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-500 uppercase">Cycle</label>
              <select
                value={filterCycle}
                onChange={(e) => setFilterCycle(e.target.value)}
                className="h-10 w-full px-3 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#3b2fc9]/20 focus:border-[#3b2fc9] bg-white"
              >
                <option value="all" disabled>Select Cycle</option>
                <option value="1-15">1st - 15th</option>
                <option value="16-31">16th - End</option>
              </select>
            </div>
          </div>

          <div className="pt-2 text-sm text-gray-500 flex items-center justify-between">
            <span>The system found <strong className="text-gray-900">{displayChallans.length} challans</strong> matching these filters.</span>
          </div>
        </div>

        {/* Upload & Results */}
        {!differences ? (
          <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm space-y-4">
            <div className="flex items-center gap-2 text-gray-700 font-medium pb-2 border-b border-gray-100">
              <FileSpreadsheet className="h-5 w-5 text-[#3b2fc9]" />
              <h3>Step 2: Upload Excel File</h3>
            </div>
            
            <input
              type="file"
              accept=".xlsx, .xls, .csv"
              className="hidden"
              ref={fileInputRef}
              onChange={handleFileUpload}
            />
            
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isProcessing || isLoading || filterLocation === 'all' || filterMonth === 'all' || filterYear === 'all' || filterCycle === 'all'}
              className="w-full py-16 border-2 border-dashed border-[#3b2fc9]/30 bg-[#3b2fc9]/5 hover:bg-[#3b2fc9]/10 rounded-xl flex flex-col items-center justify-center gap-3 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isProcessing ? (
                <div className="h-8 w-8 border-4 border-[#3b2fc9]/30 border-t-[#3b2fc9] rounded-full animate-spin" />
              ) : (
                <>
                  <div className="p-4 bg-white shadow-sm rounded-full text-[#3b2fc9]">
                    <Upload className="h-8 w-8" />
                  </div>
                  <div className="text-center">
                    <span className="block font-semibold text-[#3b2fc9] text-lg">Select Excel or CSV File</span>
                    <span className="block text-sm text-[#3b2fc9]/70 mt-1">Make sure you selected filters above first.</span>
                  </div>
                </>
              )}
            </button>
          </div>
        ) : (
          <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm space-y-6">
            <div className="flex items-center justify-between pb-2 border-b border-gray-100">
              <h3 className="font-medium text-gray-900">Reconciliation Results</h3>
              <button
                onClick={() => {
                  setDifferences(null);
                  setFileName('');
                }}
                className="px-3 py-1.5 text-sm font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Start Over
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-gray-50 border border-gray-200 p-4 rounded-xl">
                <p className="text-sm text-gray-500">Aggregator Total Value</p>
                <p className="text-2xl font-bold text-gray-900">₹{summary.aggVal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
              </div>
              <div className="bg-gray-50 border border-gray-200 p-4 rounded-xl">
                <p className="text-sm text-gray-500">Our System Total</p>
                <p className="text-2xl font-bold text-gray-900">₹{summary.ourVal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
              </div>
              <div className={`p-4 rounded-xl border ${summary.diff === 0 ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-rose-50 border-rose-200 text-rose-900'}`}>
                <p className="text-sm opacity-80">Difference</p>
                <p className="text-2xl font-bold">₹{Math.abs(summary.diff).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
                <p className="text-xs mt-1">{summary.diff > 0 ? "Aggregator is charging MORE" : summary.diff < 0 ? "Aggregator is charging LESS" : "Perfect Match"}</p>
              </div>
            </div>

            <div className="flex items-center gap-2 border-b border-gray-200">
              <button 
                onClick={() => setFilterTab('all')} 
                className={`px-4 py-2 text-sm font-medium border-b-2 ${filterTab === 'all' ? 'border-[#3b2fc9] text-[#3b2fc9]' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
              >
                All Items ({differences.length})
              </button>
              <button 
                onClick={() => setFilterTab('issues')} 
                className={`px-4 py-2 text-sm font-medium border-b-2 ${filterTab === 'issues' ? 'border-rose-500 text-rose-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
              >
                Issues ({differences.filter(d => d.status !== 'match').length})
              </button>
              <button 
                onClick={() => setFilterTab('matches')} 
                className={`px-4 py-2 text-sm font-medium border-b-2 ${filterTab === 'matches' ? 'border-emerald-500 text-emerald-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
              >
                Perfect Matches ({differences.filter(d => d.status === 'match').length})
              </button>
            </div>

            {differences.filter(d => filterTab === 'all' || (filterTab === 'issues' && d.status !== 'match') || (filterTab === 'matches' && d.status === 'match')).length === 0 ? (
              <div className="p-8 text-center bg-gray-50 border border-gray-100 rounded-xl">
                <CheckCircle2 className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                <h3 className="text-lg font-medium text-gray-600">No items found for this view.</h3>
              </div>
            ) : (
              <div className="border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                <div className="overflow-x-auto max-h-[500px]">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-gray-50 text-gray-600 font-medium sticky top-0 shadow-sm">
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
                    <tbody className="divide-y divide-gray-100 bg-white">
                      {differences
                        .filter(d => filterTab === 'all' || (filterTab === 'issues' && d.status !== 'match') || (filterTab === 'matches' && d.status === 'match'))
                        .map((diff, idx) => (
                        <tr key={idx} className={`hover:bg-gray-50/50 ${diff.status === 'match' ? 'bg-emerald-50/30' : diff.status === 'missing' ? 'bg-rose-50/30' : 'bg-amber-50/30'}`}>
                          <td className="px-4 py-3 font-medium text-gray-900 max-w-[150px] truncate" title={diff.dcs.join(', ')}>
                            {diff.dcs.join(', ')}
                          </td>
                          <td className="px-4 py-3 text-gray-600 max-w-[200px] truncate" title={diff.item}>{diff.item}</td>
                          <td className="px-4 py-3 text-right text-gray-900">{diff.aggQty}</td>
                          <td className="px-4 py-3 text-right text-gray-900">{diff.ourQty}</td>
                          <td className="px-4 py-3 text-right font-medium text-gray-900">₹{diff.aggVal.toLocaleString('en-IN')}</td>
                          <td className="px-4 py-3 text-right font-medium text-gray-900">₹{diff.ourVal.toLocaleString('en-IN')}</td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-medium ${
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

      {isAliasModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[80vh] flex flex-col shadow-xl">
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900">SKU Alias Dictionary</h2>
              <button onClick={() => setIsAliasModalOpen(false)} className="text-gray-400 hover:text-gray-600">&times;</button>
            </div>
            
            <div className="p-5 border-b border-gray-100 bg-gray-50">
              <div className="flex gap-3">
                <input
                  type="text"
                  placeholder="Internal Name (e.g., Storia Banana Milkshake)"
                  value={aliasForm.internalName}
                  onChange={(e) => setAliasForm({...aliasForm, internalName: e.target.value})}
                  className="flex-1 h-10 px-3 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#3b2fc9]/20 focus:border-[#3b2fc9]"
                />
                <input
                  type="text"
                  placeholder="Aggregator Name (e.g., Storia Bnana shake)"
                  value={aliasForm.aggregatorName}
                  onChange={(e) => setAliasForm({...aliasForm, aggregatorName: e.target.value})}
                  className="flex-1 h-10 px-3 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#3b2fc9]/20 focus:border-[#3b2fc9]"
                />
                <button
                  onClick={handleSaveAlias}
                  className="h-10 px-4 bg-[#3b2fc9] text-white rounded-lg font-medium text-sm hover:bg-[#3228ab] transition-colors"
                >
                  Add
                </button>
              </div>
            </div>
            
            <div className="overflow-y-auto p-5">
              {aliases.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-4">No aliases created yet.</p>
              ) : (
                <div className="space-y-3">
                  {aliases.map(alias => (
                    <div key={alias.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-white border border-gray-200 rounded-xl shadow-sm hover:border-[#3b2fc9]/30 transition-colors">
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold uppercase text-[#3b2fc9]/70 w-24">Internal:</span>
                          <span className="text-sm font-medium text-gray-900">{alias.internalName}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold uppercase text-gray-400 w-24">Aggregator:</span>
                          <span className="text-sm text-gray-600">{alias.aggregatorName}</span>
                        </div>
                      </div>
                      <button
                        onClick={() => handleDeleteAlias(alias.id)}
                        className="mt-3 sm:mt-0 px-3 py-1.5 text-xs font-medium text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-lg transition-colors"
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
