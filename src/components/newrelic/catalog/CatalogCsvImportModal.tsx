'use client';

import React, { useState, useRef } from 'react';
import { CatalogItem } from '@/types/challan';
import { bulkSaveCatalogItems } from '@/services/newrelicCatalogService';
import {
  Upload,
  Download,
  X,
  Check,
  AlertTriangle,
  FileSpreadsheet,
  Loader2,
  Sparkles,
  Info,
} from 'lucide-react';
import { triggerHaptic } from '@/lib/haptics';

interface ParsedCatalogRow {
  brandName: string;
  itemName: string;
  caseSize?: number;
  mrp?: number;
  applicableSites?: ('newrelic' | 'dsm' | 'ntt_data' | 'all')[];
  isExisting: boolean;
  isValid: boolean;
  error?: string;
}

interface CatalogCsvImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  existingCatalog: CatalogItem[];
}

export function CatalogCsvImportModal({
  isOpen,
  onClose,
  onSuccess,
  existingCatalog,
}: CatalogCsvImportModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<ParsedCatalogRow[]>([]);
  const [parseError, setParseError] = useState<string>('');
  const [isImporting, setIsImporting] = useState<boolean>(false);
  const [progress, setProgress] = useState<{
    current: number;
    total: number;
    percent: number;
    statusText: string;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  // Existing lookup set: key = `${brand.toLowerCase()}__${item.toLowerCase()}`
  const existingMap = new Map<string, CatalogItem>();
  existingCatalog.forEach((item) => {
    const key = `${item.brandName.trim().toLowerCase()}__${item.itemName.trim().toLowerCase()}`;
    existingMap.set(key, item);
  });

  function handleDownloadSample() {
    triggerHaptic('light');
    const headers = 'Brand Name,Item Name,Case Size,Ref MRP,Sites';
    const sampleRows = [
      'Haldiram,Soya Sticks,144,50,all',
      'Britannia,Good Day Butter,72,30,newrelic',
      'Storia,Coconut Water,24,40,dsm|newrelic',
      'Coca Cola,Sprite,24,40,all',
      'Cadbury,Oreo,60,25,all',
    ];
    const csvContent = [headers, ...sampleRows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `catalog_sample_template.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  function parseCSVText(text: string): ParsedCatalogRow[] {
    const lines = text
      .split(/\r\n|\n|\r/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    if (lines.length < 2) {
      throw new Error('CSV file appears to be empty or missing header rows.');
    }

    // Parse header
    const rawHeaders = splitCsvLine(lines[0]).map((h) =>
      h.toLowerCase().replace(/[^a-z0-9]/g, '')
    );

    const brandIdx = rawHeaders.findIndex(
      (h) => h.includes('brand') || h.includes('company')
    );
    const itemIdx = rawHeaders.findIndex(
      (h) =>
        h.includes('item') ||
        h.includes('product') ||
        h.includes('description') ||
        h.includes('name')
    );
    const caseIdx = rawHeaders.findIndex(
      (h) =>
        h.includes('case') ||
        h.includes('pack') ||
        h.includes('unitspercase') ||
        h.includes('carton')
    );
    const mrpIdx = rawHeaders.findIndex(
      (h) =>
        h.includes('mrp') ||
        h.includes('price') ||
        h.includes('rate') ||
        h.includes('retail')
    );
    const sitesIdx = rawHeaders.findIndex(
      (h) => h.includes('site') || h.includes('location') || h.includes('applicable')
    );

    if (brandIdx === -1 && itemIdx === -1) {
      throw new Error(
        'Could not detect "Brand Name" and "Item Name" headers. Please check your CSV column titles.'
      );
    }

    const rows: ParsedCatalogRow[] = [];

    for (let i = 1; i < lines.length; i++) {
      const cols = splitCsvLine(lines[i]);
      if (cols.length === 0 || cols.every((c) => c.trim() === '')) continue;

      const brand = brandIdx !== -1 ? cols[brandIdx]?.trim() || '' : '';
      const item = itemIdx !== -1 ? cols[itemIdx]?.trim() || '' : '';
      const caseStr = caseIdx !== -1 ? cols[caseIdx]?.trim() || '' : '';
      const mrpStr = mrpIdx !== -1 ? cols[mrpIdx]?.trim() || '' : '';
      const siteStr = sitesIdx !== -1 ? cols[sitesIdx]?.trim() || '' : '';

      const caseNum = caseStr ? parseFloat(caseStr) : undefined;
      const mrpNum = mrpStr ? parseFloat(mrpStr.replace(/[^0-9.]/g, '')) : undefined;

      let sites: ('newrelic' | 'dsm' | 'ntt_data' | 'all')[] = ['all'];
      if (siteStr) {
        const parsed = siteStr
          .split(/[,|/]/)
          .map((s) => s.trim().toLowerCase())
          .map((s) => {
            if (s.includes('all')) return 'all';
            if (s.includes('relic')) return 'newrelic';
            if (s.includes('dsm')) return 'dsm';
            if (s.includes('ntt')) return 'ntt_data';
            return null;
          })
          .filter(Boolean) as ('newrelic' | 'dsm' | 'ntt_data' | 'all')[];

        if (parsed.length > 0) {
          sites = parsed;
        }
      }

      let isValid = true;
      let error = '';

      if (!brand) {
        isValid = false;
        error = 'Missing brand name';
      } else if (!item) {
        isValid = false;
        error = 'Missing item name';
      } else if (caseNum !== undefined && (isNaN(caseNum) || caseNum <= 0)) {
        isValid = false;
        error = 'Invalid case size';
      } else if (mrpNum !== undefined && (isNaN(mrpNum) || mrpNum < 0)) {
        isValid = false;
        error = 'Invalid MRP';
      }

      const key = `${brand.toLowerCase()}__${item.toLowerCase()}`;
      const isExisting = existingMap.has(key);

      rows.push({
        brandName: brand,
        itemName: item,
        caseSize: caseNum && !isNaN(caseNum) ? caseNum : undefined,
        mrp: mrpNum && !isNaN(mrpNum) ? mrpNum : undefined,
        applicableSites: sites,
        isExisting,
        isValid,
        error: error || undefined,
      });
    }

    return rows;
  }

  function splitCsvLine(line: string): string[] {
    const result: string[] = [];
    let cur = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') {
        if (inQuotes && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (c === ',' && !inQuotes) {
        result.push(cur.trim());
        cur = '';
      } else {
        cur += c;
      }
    }
    result.push(cur.trim());
    return result;
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    setParseError('');
    const selected = e.target.files?.[0];
    if (!selected) return;

    if (!selected.name.toLowerCase().endsWith('.csv')) {
      setParseError('Please select a valid .csv file.');
      return;
    }

    setFile(selected);
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = parseCSVText(text);
        if (parsed.length === 0) {
          setParseError('No data rows found in the CSV file.');
          setParsedRows([]);
        } else {
          setParsedRows(parsed);
          triggerHaptic('success');
        }
      } catch (err: any) {
        setParseError(err.message || 'Failed to parse CSV file.');
        setParsedRows([]);
      }
    };
    reader.readAsText(selected);
  }

  async function handleImport() {
    const validRows = parsedRows.filter((r) => r.isValid);
    if (validRows.length === 0) {
      setParseError('No valid rows found to import.');
      return;
    }

    setIsImporting(true);
    setProgress({
      current: 0,
      total: validRows.length,
      percent: 0,
      statusText: 'Preparing catalog batch...',
    });

    try {
      const itemsToSave = validRows.map((r) => {
        const key = `${r.brandName.trim().toLowerCase()}__${r.itemName.trim().toLowerCase()}`;
        const existing = existingMap.get(key);
        return {
          id: existing?.id,
          brandName: r.brandName,
          itemName: r.itemName,
          defaultQuantity: existing?.defaultQuantity || 1,
          caseSize: r.caseSize !== undefined ? r.caseSize : existing?.caseSize,
          mrp: r.mrp !== undefined ? r.mrp : existing?.mrp,
          applicableSites: r.applicableSites || existing?.applicableSites || ['all'],
        };
      });

      await bulkSaveCatalogItems(itemsToSave, (p) => {
        setProgress(p);
      });

      triggerHaptic('success');
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 500);
    } catch (err: any) {
      setParseError(err.message || 'Failed to save items to catalog.');
      setIsImporting(false);
    }
  }

  const validCount = parsedRows.filter((r) => r.isValid).length;
  const newCount = parsedRows.filter((r) => r.isValid && !r.isExisting).length;
  const updateCount = parsedRows.filter((r) => r.isValid && r.isExisting).length;
  const invalidCount = parsedRows.filter((r) => !r.isValid).length;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl shadow-2xl max-w-2xl w-full p-5 sm:p-6 space-y-4 max-h-[92vh] overflow-y-auto pb-[max(1.25rem,env(safe-area-inset-bottom))] animate-in slide-in-from-bottom duration-200 border-t sm:border border-slate-200 dark:border-slate-800">
        <div className="sm:hidden w-12 h-1.5 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto -mt-1 mb-2 shrink-0" />

        {/* Modal Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 rounded-2xl">
              <FileSpreadsheet className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-black text-slate-900 dark:text-white text-base">
                Import Catalog from CSV
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Bulk add new items or update case sizes &amp; MRPs
              </p>
            </div>
          </div>
          <button
            disabled={isImporting}
            onClick={() => {
              triggerHaptic('light');
              onClose();
            }}
            className="p-1.5 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-40"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Progress Bar during Import */}
        {isImporting && progress && (
          <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-2xl space-y-2 animate-in fade-in duration-150">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-emerald-900 dark:text-emerald-200 flex items-center gap-1.5">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-emerald-600 dark:text-emerald-400" />
                Importing catalog items...
              </span>
              <span className="font-bold text-emerald-700 dark:text-emerald-300">
                {progress.percent}%
              </span>
            </div>
            <div className="w-full bg-emerald-200/60 dark:bg-emerald-900/60 rounded-full h-2 overflow-hidden">
              <div
                className="bg-gradient-to-r from-emerald-600 to-teal-600 h-2 rounded-full transition-all duration-200 ease-out"
                style={{ width: `${progress.percent}%` }}
              />
            </div>
            <div className="flex justify-between items-center text-[11px] text-emerald-700/80 dark:text-emerald-300/80">
              <span className="truncate pr-2">{progress.statusText}</span>
              {progress.total > 0 && (
                <span className="font-mono font-medium shrink-0">
                  {progress.current} / {progress.total}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Upload Zone & Instructions */}
        {!isImporting && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                1. Select CSV File
              </span>
              <button
                type="button"
                onClick={handleDownloadSample}
                className="inline-flex items-center gap-1 text-[11px] font-bold text-[#3b2fc9] dark:text-indigo-400 hover:underline"
              >
                <Download className="h-3 w-3" />
                Download Sample Template
              </button>
            </div>

            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-200 dark:border-slate-700 hover:border-emerald-500 dark:hover:border-emerald-500 rounded-2xl p-6 text-center cursor-pointer transition-colors bg-slate-50/50 dark:bg-slate-800/30 group"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleFileSelect}
                className="hidden"
              />
              <Upload className="h-8 w-8 mx-auto mb-2 text-slate-400 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors" />
              <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
                {file ? file.name : 'Click to upload or drag & drop CSV'}
              </p>
              <p className="text-xs text-slate-400 mt-0.5">
                Columns: Brand Name, Item Name, Case Size, Ref MRP, Sites
              </p>
            </div>

            {parseError && (
              <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-xl text-xs text-red-700 dark:text-red-300 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>{parseError}</span>
              </div>
            )}

            {/* Validation Breakdown Pills */}
            {parsedRows.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
                  <span>2. Preview &amp; Verification</span>
                  <span>{parsedRows.length} total rows parsed</span>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 text-center">
                    <p className="text-[10px] uppercase font-bold text-emerald-700 dark:text-emerald-300">
                      New Items
                    </p>
                    <p className="text-base font-black text-emerald-900 dark:text-emerald-100">
                      +{newCount}
                    </p>
                  </div>
                  <div className="p-2.5 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 text-center">
                    <p className="text-[10px] uppercase font-bold text-blue-700 dark:text-blue-300">
                      Updates
                    </p>
                    <p className="text-base font-black text-blue-900 dark:text-blue-100">
                      {updateCount}
                    </p>
                  </div>
                  <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 text-center">
                    <p className="text-[10px] uppercase font-bold text-amber-700 dark:text-amber-300">
                      Skipped/Invalid
                    </p>
                    <p className="text-base font-black text-amber-900 dark:text-amber-100">
                      {invalidCount}
                    </p>
                  </div>
                </div>

                {/* Preview Table */}
                <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden max-h-52 overflow-y-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold sticky top-0">
                      <tr>
                        <th className="px-3 py-2">Brand</th>
                        <th className="px-3 py-2">Item Name</th>
                        <th className="px-2 py-2">Case</th>
                        <th className="px-2 py-2">MRP</th>
                        <th className="px-2 py-2 text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                      {parsedRows.slice(0, 15).map((r, i) => (
                        <tr
                          key={i}
                          className={r.isValid ? 'hover:bg-slate-50 dark:hover:bg-slate-800/50' : 'bg-red-50/50 dark:bg-red-950/30'}
                        >
                          <td className="px-3 py-1.5 font-bold text-slate-800 dark:text-slate-200 truncate max-w-[100px]">
                            {r.brandName || '—'}
                          </td>
                          <td className="px-3 py-1.5 text-slate-700 dark:text-slate-300 truncate max-w-[140px]">
                            {r.itemName || '—'}
                          </td>
                          <td className="px-2 py-1.5 font-mono text-slate-600 dark:text-slate-400">
                            {r.caseSize ? `${r.caseSize} pcs` : '—'}
                          </td>
                          <td className="px-2 py-1.5 font-mono text-slate-600 dark:text-slate-400">
                            {r.mrp ? `₹${r.mrp}` : '—'}
                          </td>
                          <td className="px-2 py-1.5 text-right">
                            {!r.isValid ? (
                              <span className="inline-block px-1.5 py-0.5 rounded text-[9px] font-bold bg-red-100 text-red-800 dark:bg-red-900/60 dark:text-red-300">
                                {r.error || 'Invalid'}
                              </span>
                            ) : r.isExisting ? (
                              <span className="inline-block px-1.5 py-0.5 rounded text-[9px] font-bold bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-300">
                                Update
                              </span>
                            ) : (
                              <span className="inline-block px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300">
                                New
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {parsedRows.length > 15 && (
                    <div className="p-2 text-center text-[11px] text-slate-400 bg-slate-50 dark:bg-slate-800/50">
                      + {parsedRows.length - 15} more rows will be imported
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Modal Actions */}
        <div className="flex gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
          <button
            type="button"
            disabled={isImporting}
            onClick={() => {
              triggerHaptic('light');
              onClose();
            }}
            className="flex-1 h-11 rounded-2xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 transition-all active:scale-95 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleImport}
            disabled={isImporting || validCount === 0}
            className="flex-1 h-11 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 disabled:opacity-50 text-white text-xs font-bold shadow-md shadow-emerald-500/20 transition-all active:scale-95 flex items-center justify-center gap-1.5"
          >
            {isImporting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                <span>Importing...</span>
              </>
            ) : (
              <>
                <Check className="h-4 w-4" />
                <span>Confirm &amp; Import {validCount > 0 ? `(${validCount})` : ''}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
export default CatalogCsvImportModal;
