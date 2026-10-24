'use client';

import React, { useState, useEffect } from 'react';
import {
  RefreshCw,
  X,
  Sparkles,
  ShieldCheck,
  Zap,
  Calendar,
  Building2,
  CheckCircle2,
  AlertCircle,
  Clock,
  ArrowRight,
  Database,
  ChevronDown,
  ChevronUp,
  Tag,
  Loader2,
} from 'lucide-react';
import { NewRelicLocation } from '@/types/challan';
import { NEWRELIC_LOCATIONS } from '@/services/newrelicChallanService';
import {
  previewSeedPricingFromChallans,
  seedPricingFromChallans,
  SeedPricingPreview,
  SeedPricingResult,
  SeedPricingOptions,
} from '@/services/newrelicPricingService';
import { triggerHaptic } from '@/lib/haptics';

interface SeedHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeLocation: NewRelicLocation;
  onSeedSuccess: (result: SeedPricingResult) => void;
}

export default function SeedHistoryModal({
  isOpen,
  onClose,
  activeLocation,
  onSeedSuccess,
}: SeedHistoryModalProps) {
  // Settings
  const [selectedLocation, setSelectedLocation] = useState<NewRelicLocation | 'all'>(activeLocation);
  const [strategy, setStrategy] = useState<'missing_only' | 'overwrite_all'>('missing_only');
  const [dateRange, setDateRange] = useState<'last_30_days' | 'last_90_days' | 'all'>('last_90_days');

  // Preview & Processing state
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [preview, setPreview] = useState<SeedPricingPreview | null>(null);
  const [previewError, setPreviewError] = useState('');

  // Seeding progress state
  const [isSeeding, setIsSeeding] = useState(false);
  const [progress, setProgress] = useState<{
    stage: string;
    current: number;
    total: number;
    percent: number;
    statusText: string;
  }>({
    stage: 'idle',
    current: 0,
    total: 0,
    percent: 0,
    statusText: '',
  });

  // Final result
  const [result, setResult] = useState<SeedPricingResult | null>(null);
  const [showSampleItems, setShowSampleItems] = useState(false);

  // Sync selectedLocation when activeLocation changes
  useEffect(() => {
    setSelectedLocation(activeLocation);
  }, [activeLocation]);

  // Load preview whenever modal opens or settings change
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    setIsPreviewLoading(true);
    setPreviewError('');
    setResult(null);

    previewSeedPricingFromChallans({
      location: selectedLocation,
      strategy,
      dateRange,
    })
      .then((data) => {
        if (isMounted) {
          setPreview(data);
          setIsPreviewLoading(false);
        }
      })
      .catch((err) => {
        if (isMounted) {
          console.error('Failed to preview challan seed:', err);
          setPreviewError(err.message || 'Could not scan challan history');
          setIsPreviewLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, selectedLocation, strategy, dateRange]);

  if (!isOpen) return null;

  const handleStartSeed = async () => {
    triggerHaptic('medium');
    setIsSeeding(true);
    setResult(null);
    setPreviewError('');

    try {
      const seedResult = await seedPricingFromChallans({
        location: selectedLocation,
        strategy,
        dateRange,
        onProgress: (p) => {
          setProgress(p);
        },
      });

      triggerHaptic('success');
      setResult(seedResult);
      onSeedSuccess(seedResult);
    } catch (err: any) {
      triggerHaptic('warning');
      setPreviewError(err.message || 'Seeding failed. Please check your connection and try again.');
    } finally {
      setIsSeeding(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-xl w-full p-5 sm:p-6 shadow-2xl border border-slate-200 dark:border-slate-800 animate-in fade-in zoom-in-95 my-auto">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white flex items-center justify-center font-black shadow-md shadow-indigo-500/20 shrink-0">
              <Sparkles className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base font-bold text-slate-900 dark:text-white leading-tight">
                  Seed Pricing from History
                </h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                  Fast Batch Sync
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                Automatically extract procurement costs, MRPs, and margins from your delivery challans
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSeeding}
            className="p-1.5 rounded-full text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Configuration Options */}
        <div className="mt-4 space-y-3.5">
          {/* 1. Target Location & Date Range */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                Target Location:
              </label>
              <div className="flex items-center border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800/60">
                <Building2 className="w-3.5 h-3.5 text-slate-400 mr-2 shrink-0" />
                <select
                  value={selectedLocation}
                  disabled={isSeeding}
                  onChange={(e) => setSelectedLocation(e.target.value as any)}
                  className="w-full bg-transparent text-xs font-bold text-slate-800 dark:text-slate-200 focus:outline-none cursor-pointer"
                >
                  <option value={activeLocation}>
                    {NEWRELIC_LOCATIONS[activeLocation]?.label} (Active Only)
                  </option>
                  <option value="all">All Locations (Hyderabad + Bangalore)</option>
                  {Object.entries(NEWRELIC_LOCATIONS).map(([key, loc]) => (
                    key !== activeLocation ? (
                      <option key={key} value={key}>
                        {(loc as { label: string }).label} Only
                      </option>
                    ) : null
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                Challan Date Window:
              </label>
              <div className="flex items-center border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800/60">
                <Calendar className="w-3.5 h-3.5 text-slate-400 mr-2 shrink-0" />
                <select
                  value={dateRange}
                  disabled={isSeeding}
                  onChange={(e) => setDateRange(e.target.value as any)}
                  className="w-full bg-transparent text-xs font-bold text-slate-800 dark:text-slate-200 focus:outline-none cursor-pointer"
                >
                  <option value="last_90_days">Last 90 Days (Recommended)</option>
                  <option value="last_30_days">Last 30 Days (Fastest, latest costs)</option>
                  <option value="all">All History (Complete archive)</option>
                </select>
              </div>
            </div>
          </div>

          {/* 2. Import Strategy */}
          <div>
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1.5">
              Import Strategy:
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <button
                type="button"
                disabled={isSeeding}
                onClick={() => {
                  triggerHaptic('light');
                  setStrategy('missing_only');
                }}
                className={`p-3 rounded-2xl border text-left transition-all relative ${
                  strategy === 'missing_only'
                    ? 'bg-emerald-50/70 dark:bg-emerald-950/40 border-emerald-400 ring-2 ring-emerald-400/20 shadow-xs'
                    : 'bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-800 dark:text-emerald-300 mb-1">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  <span>Safe Mode (Fill Missing Only)</span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight">
                  Only adds items not currently in pricing table. Preserves all your manual price edits.
                </p>
              </button>

              <button
                type="button"
                disabled={isSeeding}
                onClick={() => {
                  triggerHaptic('light');
                  setStrategy('overwrite_all');
                }}
                className={`p-3 rounded-2xl border text-left transition-all relative ${
                  strategy === 'overwrite_all'
                    ? 'bg-indigo-50/70 dark:bg-indigo-950/40 border-indigo-400 ring-2 ring-indigo-400/20 shadow-xs'
                    : 'bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-800 dark:text-indigo-300 mb-1">
                  <Zap className="w-4 h-4 text-indigo-600" />
                  <span>Update Mode (Sync All Latest)</span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight">
                  Refreshes all prices with the newest procurement cost found in recent delivery challans.
                </p>
              </button>
            </div>
          </div>
        </div>

        {/* Live Preview Analysis Box */}
        <div className="mt-4 bg-slate-50 dark:bg-slate-800/40 rounded-2xl p-3.5 border border-slate-200 dark:border-slate-700">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
              <Database className="w-3.5 h-3.5 text-indigo-600" />
              <span>Challan Analysis Preview</span>
            </span>
            {isPreviewLoading && (
              <span className="text-[11px] text-slate-400 flex items-center gap-1 font-medium">
                <Loader2 className="w-3 h-3 animate-spin text-indigo-600" />
                Scanning...
              </span>
            )}
          </div>

          {preview && !isPreviewLoading ? (
            <div className="space-y-3">
              {/* Metric stats row */}
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-white dark:bg-slate-800 p-2.5 rounded-xl border border-slate-200/80 dark:border-slate-700 text-center shadow-2xs">
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Challans</p>
                  <p className="text-base sm:text-lg font-black text-slate-900 dark:text-white font-mono mt-0.5">
                    {preview.totalChallansScanned}
                  </p>
                </div>
                <div className="bg-white dark:bg-slate-800 p-2.5 rounded-xl border border-slate-200/80 dark:border-slate-700 text-center shadow-2xs">
                  <p className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">New Items</p>
                  <p className="text-base sm:text-lg font-black text-emerald-700 dark:text-emerald-400 font-mono mt-0.5">
                    +{preview.newItemsCount}
                  </p>
                </div>
                <div className="bg-white dark:bg-slate-800 p-2.5 rounded-xl border border-slate-200/80 dark:border-slate-700 text-center shadow-2xs">
                  <p className="text-[10px] font-bold text-indigo-700 dark:text-indigo-400 uppercase tracking-wider">
                    {strategy === 'missing_only' ? 'Will Skip' : 'Will Update'}
                  </p>
                  <p className="text-base sm:text-lg font-black text-indigo-700 dark:text-indigo-400 font-mono mt-0.5">
                    {preview.updateItemsCount}
                  </p>
                </div>
              </div>

              {/* Brand Summary Pills */}
              {Object.keys(preview.brandSummary).length > 0 && (
                <div>
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                    Top Brands Found:
                  </p>
                  <div className="flex items-center gap-1.5 flex-wrap max-h-16 overflow-y-auto no-scrollbar">
                    {Object.entries(preview.brandSummary)
                      .sort((a, b) => b[1] - a[1])
                      .slice(0, 10)
                      .map(([brand, count]) => (
                        <span
                          key={brand}
                          className="text-[10px] font-semibold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-2 py-0.5 rounded-md text-slate-700 dark:text-slate-300"
                        >
                          {brand} <strong className="text-indigo-600 dark:text-indigo-400">({count})</strong>
                        </span>
                      ))}
                  </div>
                </div>
              )}

              {/* Toggle Sample Items Table */}
              {preview.sampleItems.length > 0 && (
                <div>
                  <button
                    type="button"
                    onClick={() => setShowSampleItems(!showSampleItems)}
                    className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
                  >
                    <span>{showSampleItems ? 'Hide Sample Items' : `Preview Sample Items (${preview.sampleItems.length})`}</span>
                    {showSampleItems ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  </button>

                  {showSampleItems && (
                    <div className="mt-2 max-h-40 overflow-y-auto border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800">
                      <table className="w-full text-[11px] text-left">
                        <thead className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 text-slate-500 sticky top-0">
                          <tr>
                            <th className="p-1.5 pl-2.5">Item</th>
                            <th className="p-1.5">MRP</th>
                            <th className="p-1.5">P.Cost</th>
                            <th className="p-1.5 pr-2.5">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                          {preview.sampleItems.map((item, idx) => (
                            <tr key={idx} className="hover:bg-slate-50/50">
                              <td className="p-1.5 pl-2.5 truncate max-w-[140px]">
                                <span className="font-semibold text-slate-800 dark:text-slate-200">{item.brandName}</span>{' '}
                                <span className="text-slate-500">{item.itemName}</span>
                              </td>
                              <td className="p-1.5 font-mono text-slate-600 dark:text-slate-300">₹{item.mrp}</td>
                              <td className="p-1.5 font-mono font-bold text-emerald-600">₹{item.purchaseCost}</td>
                              <td className="p-1.5 pr-2.5">
                                {item.isNew ? (
                                  <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200">
                                    NEW
                                  </span>
                                ) : (
                                  <span className="text-[9px] font-semibold text-slate-500 bg-slate-100 px-1.5 py-0.2 rounded">
                                    EXISTS
                                  </span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : isPreviewLoading ? (
            <div className="py-6 text-center space-y-1.5 text-slate-400">
              <Loader2 className="w-5 h-5 animate-spin mx-auto text-indigo-600" />
              <p className="text-xs">Analyzing historical delivery challans...</p>
            </div>
          ) : previewError ? (
            <div className="flex items-center gap-2 text-rose-600 text-xs p-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{previewError}</span>
            </div>
          ) : (
            <p className="text-xs text-slate-500 text-center py-4">No challan data found for this filter.</p>
          )}
        </div>

        {/* Progress Bar (Visible while seeding) */}
        {isSeeding && (
          <div className="mt-4 bg-indigo-50/80 dark:bg-indigo-950/40 p-3.5 rounded-2xl border border-indigo-200 dark:border-indigo-800 space-y-2">
            <div className="flex items-center justify-between text-xs font-bold">
              <span className="text-indigo-950 dark:text-indigo-200 flex items-center gap-1.5">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-600" />
                <span>{progress.statusText || 'Processing...'}</span>
              </span>
              <span className="font-mono text-indigo-700 dark:text-indigo-300">{progress.percent}%</span>
            </div>
            <div className="w-full bg-indigo-200/60 dark:bg-indigo-900 h-2 rounded-full overflow-hidden">
              <div
                className="bg-indigo-600 h-full rounded-full transition-all duration-300 ease-out"
                style={{ width: `${progress.percent}%` }}
              />
            </div>
          </div>
        )}

        {/* Success Result Box */}
        {result && (
          <div className="mt-4 bg-emerald-50 dark:bg-emerald-950/40 p-3.5 rounded-2xl border border-emerald-200 dark:border-emerald-800 flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            <div className="text-xs space-y-0.5">
              <p className="font-bold text-emerald-900 dark:text-emerald-200">
                Seeding Completed in {(result.durationMs / 1000).toFixed(1)}s!
              </p>
              <p className="text-emerald-700 dark:text-emerald-400">
                Added <strong>{result.seeded}</strong> new items, updated <strong>{result.updated}</strong> existing items (
                {result.skipped} skipped).
              </p>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="mt-5 flex items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
          <button
            type="button"
            onClick={onClose}
            disabled={isSeeding}
            className="flex-1 h-11 rounded-2xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-300 transition-colors disabled:opacity-50"
          >
            {result ? 'Done' : 'Cancel'}
          </button>

          {!result ? (
            <button
              type="button"
              onClick={handleStartSeed}
              disabled={isSeeding || isPreviewLoading || !preview || (preview.newItemsCount === 0 && preview.updateItemsCount === 0)}
              className="flex-1 h-11 bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] disabled:opacity-50 text-white rounded-2xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-md shadow-indigo-600/25 transition-all"
            >
              {isSeeding ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Processing...</span>
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4" />
                  <span>
                    {strategy === 'missing_only'
                      ? `Seed ${preview?.newItemsCount || 0} New Items`
                      : `Sync All ${preview?.uniqueKeysFound || 0} Items`}
                  </span>
                </>
              )}
            </button>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="flex-1 h-11 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 shadow-md shadow-emerald-600/25 transition-all"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Close & View Updated Table</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
