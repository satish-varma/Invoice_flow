'use client';

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  RefreshCw,
  UploadCloud,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Calendar,
  Sparkles,
  Zap,
  Building2,
  Layers,
  ArrowRight,
  TrendingUp,
  Clock,
} from 'lucide-react';
import { COMPANY_SITES, SiteId } from '@/types/site';
import { triggerHaptic } from '@/lib/haptics';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  siteId?: string;
  onSyncComplete?: () => void;
}

export function HungerBoxSyncModal({
  open,
  onOpenChange,
  siteId = 'newrelic',
  onSyncComplete,
}: Props) {
  const [activeTab, setActiveTab] = useState<'worker' | 'upload'>('worker');

  // Worker sync state
  const [workerStatus, setWorkerStatus] = useState<{
    configured: boolean;
    workerUrl?: string;
    recentOrders?: number;
    latestOrderDate?: string;
    latestSyncedAt?: string;
  }>({ configured: false });

  const [selectedSite, setSelectedSite] = useState<string>(siteId);
  const [dateRangePreset, setDateRangePreset] = useState<'today' | 'yesterday' | 'week' | 'month'>('today');
  const [startDate, setStartDate] = useState<string>(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });
  const [endDate, setEndDate] = useState<string>(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });

  const [isSyncing, setIsSyncing] = useState(false);
  const [syncFeedback, setSyncFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
    details?: any;
  } | null>(null);

  // File upload state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [filePreview, setFilePreview] = useState<{
    totalSales: number;
    validOrders: number;
    dailyAggregates: any[];
  } | null>(null);

  // Fetch worker configuration status
  useEffect(() => {
    if (open) {
      fetch('/api/tuckshop/sync/hungerbox')
        .then((res) => res.json())
        .then((data) => {
          if (data.success) {
            setWorkerStatus({
              configured: data.workerConfigured,
              workerUrl: data.workerUrl,
              recentOrders: data.recentTelemetryCount,
              latestOrderDate: data.latestOrderDate,
              latestSyncedAt: data.latestSyncedAt,
            });
          }
        })
        .catch((err) => console.warn('Could not check worker status:', err));
    }
  }, [open]);

  // Handle preset date selection
  const handleSelectPreset = (preset: 'today' | 'yesterday' | 'week' | 'month') => {
    setDateRangePreset(preset);
    const now = new Date();
    const formatYmd = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

    if (preset === 'today') {
      const todayStr = formatYmd(now);
      setStartDate(todayStr);
      setEndDate(todayStr);
    } else if (preset === 'yesterday') {
      const y = new Date(now);
      y.setDate(y.getDate() - 1);
      const yStr = formatYmd(y);
      setStartDate(yStr);
      setEndDate(yStr);
    } else if (preset === 'week') {
      const w = new Date(now);
      w.setDate(w.getDate() - 7);
      setStartDate(formatYmd(w));
      setEndDate(formatYmd(now));
    } else if (preset === 'month') {
      const m = new Date(now.getFullYear(), now.getMonth(), 1);
      setStartDate(formatYmd(m));
      setEndDate(formatYmd(now));
    }
  };

  // Trigger Worker Sync
  const handleTriggerWorker = async () => {
    triggerHaptic('medium');
    setIsSyncing(true);
    setSyncFeedback(null);

    try {
      const res = await fetch('/api/tuckshop/sync/hungerbox', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'worker_sync',
          startDate,
          endDate,
          siteId: selectedSite,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setSyncFeedback({
          type: 'success',
          message: data.message || 'Worker sync executed successfully!',
          details: data.feedResults,
        });
        if (onSyncComplete) onSyncComplete();
      } else {
        setSyncFeedback({
          type: 'error',
          message: data.error || 'Worker sync failed. Please verify credentials.',
        });
      }
    } catch (err: any) {
      setSyncFeedback({
        type: 'error',
        message: err.message || 'Failed to trigger worker',
      });
    } finally {
      setIsSyncing(false);
    }
  };

  // Handle File selection for preview
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    setSyncFeedback(null);
    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('siteId', selectedSite);
      formData.append('previewOnly', 'true');

      const res = await fetch('/api/tuckshop/sync/hungerbox', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (data.success && data.dailyAggregates) {
        setFilePreview({
          totalSales: data.totalSales,
          validOrders: data.validOrders,
          dailyAggregates: data.dailyAggregates,
        });
      } else {
        setSyncFeedback({
          type: 'error',
          message: data.error || 'Failed to extract sales data from report.',
        });
        setFilePreview(null);
      }
    } catch (err: any) {
      setSyncFeedback({
        type: 'error',
        message: err.message || 'Error parsing report file.',
      });
    } finally {
      setIsUploading(false);
    }
  };

  // Confirm and feed file data into Firestore & Turso
  const handleConfirmFileUpload = async () => {
    if (!selectedFile) return;
    triggerHaptic('heavy');
    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('siteId', selectedSite);
      formData.append('previewOnly', 'false');

      const res = await fetch('/api/tuckshop/sync/hungerbox', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (data.success) {
        setSyncFeedback({
          type: 'success',
          message: data.message || 'HungerBox sales successfully imported!',
          details: data.feedResults,
        });
        setFilePreview(null);
        setSelectedFile(null);
        if (onSyncComplete) onSyncComplete();
      } else {
        setSyncFeedback({
          type: 'error',
          message: data.error || 'Failed to feed records into Tuckshop.',
        });
      }
    } catch (err: any) {
      setSyncFeedback({
        type: 'error',
        message: err.message || 'Failed to process file import.',
      });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full sm:max-w-[620px] max-h-[92vh] sm:max-h-[88vh] p-0 rounded-t-3xl sm:rounded-3xl border-0 overflow-hidden bg-white dark:bg-slate-900 shadow-2xl flex flex-col">
        {/* Header Banner */}
        <div className="bg-gradient-to-r from-[#2c1d24] via-[#43232f] to-[#1e1b4b] p-5 sm:p-6 text-white relative shrink-0">
          <div className="flex items-center justify-between gap-3 relative z-10">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-400/20 border border-amber-300/40 flex items-center justify-center text-amber-300 shrink-0">
                <Zap className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <DialogTitle className="text-lg font-black text-white">
                    HungerBox Cashless Sync
                  </DialogTitle>
                  <span className="text-[10px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 px-2 py-0.5 rounded-full">
                    100% Digital
                  </span>
                </div>
                <DialogDescription className="text-xs text-rose-100/80 font-medium mt-0.5">
                  Automate and feed HungerBox app purchases directly into your Tuckshop sales ledger.
                </DialogDescription>
              </div>
            </div>
          </div>

          {/* Mode Switcher Tabs */}
          <div className="flex items-center gap-2 mt-4 pt-3 border-t border-white/10">
            <button
              onClick={() => {
                triggerHaptic('light');
                setActiveTab('worker');
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'worker'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'bg-white/10 text-rose-100 hover:bg-white/20'
              }`}
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Automated Worker Sync
            </button>

            <button
              onClick={() => {
                triggerHaptic('light');
                setActiveTab('upload');
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'upload'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'bg-white/10 text-rose-100 hover:bg-white/20'
              }`}
            >
              <UploadCloud className="w-3.5 h-3.5" />
              Upload Report File (.xlsx / .csv)
            </button>
          </div>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-5 flex-1">
          {/* Site Target Selection */}
          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-[#3b2fc9]" />
              Target Company Site
            </Label>
            <div className="grid grid-cols-3 gap-2">
              {Object.values(COMPANY_SITES).map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setSelectedSite(s.id)}
                  className={`p-2.5 rounded-2xl border text-left transition-all ${
                    selectedSite === s.id
                      ? 'border-[#3b2fc9] bg-indigo-50/50 dark:bg-indigo-950/40 font-bold text-[#3b2fc9] shadow-xs ring-1 ring-[#3b2fc9]'
                      : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300'
                  }`}
                >
                  <p className="text-xs truncate">{s.name}</p>
                  <p className="text-[10px] text-slate-400 font-medium truncate">{s.allowedLocations[0] || 'Main'}</p>
                </button>
              ))}
            </div>
          </div>

          {/* TAB 1: AUTOMATED WORKER SYNC */}
          {activeTab === 'worker' && (
            <div className="space-y-5">
              {/* Worker Status Notice */}
              <div
                className={`p-3.5 rounded-2xl border text-xs space-y-2 ${
                  workerStatus.configured
                    ? 'bg-emerald-50/80 border-emerald-200 text-emerald-900 dark:bg-emerald-950/30 dark:border-emerald-800 dark:text-emerald-300'
                    : 'bg-amber-50/80 border-amber-200 text-amber-900 dark:bg-amber-950/30 dark:border-amber-800 dark:text-amber-300'
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-2.5 h-2.5 rounded-full ${
                        workerStatus.configured ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
                      }`}
                    />
                    <div>
                      <p className="font-bold">
                        {workerStatus.configured
                          ? 'HungerBox Background Worker Configured'
                          : 'HungerBox Worker Not Configured Yet'}
                      </p>
                      <p className="text-[11px] opacity-80">
                        {workerStatus.configured
                          ? `Endpoint: ${workerStatus.workerUrl || 'active'}`
                          : 'You can configure credentials in Tracker Settings or upload reports directly.'}
                      </p>
                    </div>
                  </div>
                  <Button asChild size="sm" variant="outline" className="h-7 text-[11px] font-bold rounded-xl shrink-0">
                    <a href="/tracker/settings" target="_blank" rel="noopener noreferrer">
                      Settings <ExternalLink className="w-3 h-3 ml-1" />
                    </a>
                  </Button>
                </div>

                {/* Real-time Telemetry Health Strip */}
                <div className="pt-2 border-t border-slate-200/60 dark:border-slate-800 flex items-center justify-between text-[11px] font-mono">
                  <span>
                    Pulled Telemetry: <strong className="font-black">{workerStatus.recentOrders || 0} orders</strong>
                  </span>
                  <span>
                    Last Synced: <strong>{workerStatus.latestSyncedAt ? new Date(workerStatus.latestSyncedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : 'Never'}</strong>
                  </span>
                </div>
              </div>

              {/* Date Presets */}
              <div className="space-y-2">
                <Label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-[#3b2fc9]" />
                  Sync Date Range
                </Label>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { id: 'today', label: 'Today' },
                    { id: 'yesterday', label: 'Yesterday' },
                    { id: 'week', label: 'Last 7 Days' },
                    { id: 'month', label: 'This Month' },
                  ].map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => handleSelectPreset(p.id as any)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                        dateRangePreset === p.id
                          ? 'bg-[#3b2fc9] text-white shadow-xs'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div>
                    <Label className="text-[10px] text-slate-400 font-bold uppercase">From Date</Label>
                    <Input
                      type="date"
                      value={startDate}
                      onChange={(e) => {
                        setDateRangePreset('today' as any);
                        setStartDate(e.target.value);
                      }}
                      className="h-9 text-xs rounded-xl"
                    />
                  </div>
                  <div>
                    <Label className="text-[10px] text-slate-400 font-bold uppercase">To Date</Label>
                    <Input
                      type="date"
                      value={endDate}
                      onChange={(e) => {
                        setDateRangePreset('today' as any);
                        setEndDate(e.target.value);
                      }}
                      className="h-9 text-xs rounded-xl"
                    />
                  </div>
                </div>
              </div>

              {/* Trigger Worker CTA */}
              <Button
                onClick={handleTriggerWorker}
                disabled={isSyncing}
                className="w-full h-11 rounded-2xl bg-[#3b2fc9] hover:bg-[#2f24a8] text-white font-black text-sm shadow-md transition-all active:scale-95"
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${isSyncing ? 'animate-spin' : ''}`} />
                {isSyncing ? 'Pulling Sales from HungerBox...' : 'Start Automated Sync'}
              </Button>
            </div>
          )}

          {/* TAB 2: REPORT FILE UPLOAD (FALLBACK & ZERO DOWNTIME) */}
          {activeTab === 'upload' && (
            <div className="space-y-4">
              {/* Direct HungerBox Admin Link */}
              <div className="p-3.5 bg-blue-50/80 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-2xl text-xs text-blue-900 dark:text-blue-300 flex items-center justify-between gap-3">
                <div>
                  <p className="font-bold">HungerBox Portal Download Link</p>
                  <p className="text-[11px] opacity-80 mt-0.5">
                    Download the sales report Excel/CSV from HungerBox Vendor Admin, then drop it below.
                  </p>
                </div>
                <Button asChild size="sm" variant="outline" className="h-8 text-xs font-bold rounded-xl shrink-0 border-blue-300 bg-white dark:bg-slate-800 text-blue-700">
                  <a
                    href="https://admin.hungerbox.com/va/reporting/download-reports"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Open HungerBox <ExternalLink className="w-3 h-3 ml-1.5" />
                  </a>
                </Button>
              </div>

              {/* File Dropzone */}
              <label
                htmlFor="hb-file-input"
                className={`border-2 border-dashed rounded-3xl p-6 flex flex-col items-center justify-center gap-2 cursor-pointer transition-all ${
                  selectedFile
                    ? 'border-emerald-400 bg-emerald-50/20 dark:bg-emerald-950/10'
                    : 'border-slate-300 dark:border-slate-700 hover:border-[#3b2fc9] bg-slate-50/50 dark:bg-slate-800/20'
                }`}
              >
                <input
                  id="hb-file-input"
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <FileSpreadsheet className={`w-10 h-10 ${selectedFile ? 'text-emerald-600' : 'text-slate-400'}`} />
                <div className="text-center">
                  <p className="text-xs font-bold text-slate-800 dark:text-white">
                    {selectedFile ? selectedFile.name : 'Click or drag HungerBox report here'}
                  </p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Supports .xlsx, .xls, and .csv files from download-reports
                  </p>
                </div>
              </label>

              {/* File Preview Details */}
              {isUploading && (
                <div className="p-4 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
                  <RefreshCw className="w-4 h-4 animate-spin text-[#3b2fc9]" />
                  Processing and analyzing report data...
                </div>
              )}

              {filePreview && (
                <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200/80 dark:border-slate-700 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">
                        Extracted Report Summary
                      </p>
                      <p className="text-[11px] text-slate-500">
                        {filePreview.validOrders} valid orders found across {filePreview.dailyAggregates.length} date(s)
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-bold text-slate-400 uppercase">Gross Sales</p>
                      <p className="text-base font-black text-emerald-600 dark:text-emerald-400 font-mono">
                        ₹{Math.round(filePreview.totalSales).toLocaleString('en-IN')}
                      </p>
                    </div>
                  </div>

                  {/* Day-by-Day Breakdown */}
                  <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                    {filePreview.dailyAggregates.map((agg, i) => (
                      <div
                        key={i}
                        className="p-2.5 bg-white dark:bg-slate-800 rounded-xl border border-slate-200/60 dark:border-slate-700 flex items-center justify-between text-xs"
                      >
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-[10px] font-mono font-bold">
                            {agg.date}
                          </Badge>
                          <span className="font-bold text-slate-700 dark:text-slate-300">
                            {agg.locationName}
                          </span>
                          <span className="text-[11px] text-slate-400">
                            ({agg.orderCount} orders)
                          </span>
                        </div>
                        <span className="font-mono font-black text-slate-900 dark:text-white">
                          ₹{Math.round(agg.totalAmount).toLocaleString('en-IN')}
                        </span>
                      </div>
                    ))}
                  </div>

                  <Button
                    onClick={handleConfirmFileUpload}
                    className="w-full h-10 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs shadow-md transition-all active:scale-95"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
                    Confirm & Feed into Tuckshop Ledger
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Sync Feedback Alert */}
          {syncFeedback && (
            <div
              className={`p-4 rounded-2xl border text-xs space-y-2 ${
                syncFeedback.type === 'success'
                  ? 'bg-emerald-50 text-emerald-900 border-emerald-200 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-200'
                  : 'bg-rose-50 text-rose-900 border-rose-200 dark:bg-rose-950/40 dark:border-rose-800 dark:text-rose-200'
              }`}
            >
              <div className="flex items-center gap-2 font-bold">
                {syncFeedback.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                )}
                <span>{syncFeedback.message}</span>
              </div>

              {Array.isArray(syncFeedback.details) && syncFeedback.details.length > 0 && (
                <div className="pt-2 border-t border-emerald-200/60 dark:border-emerald-800/60 space-y-1">
                  <p className="text-[10px] font-black uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
                    Updated Tuckshop Records:
                  </p>
                  {syncFeedback.details.map((d: any, i: number) => (
                    <div key={i} className="flex items-center justify-between text-[11px] font-mono">
                      <span>
                        {d.date} ({d.siteName}):
                      </span>
                      <span className="font-black">
                        ₹{Math.round(d.amount).toLocaleString('en-IN')} ({d.action})
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 dark:bg-slate-800/60 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs shrink-0">
          <p className="text-[11px] text-slate-400 font-medium">
            Cashless Tuckshop Mode &bull; HungerBox App Orders
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="h-8 rounded-xl font-bold text-xs"
          >
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
