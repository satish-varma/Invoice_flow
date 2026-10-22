'use client';

import React, { useEffect, useState } from 'react';
import {
  WifiOff,
  Wifi,
  RefreshCw,
  CloudUpload,
  CheckCircle2,
  AlertCircle,
  Clock,
  Trash2,
  X,
  ChevronRight,
  Layers,
} from 'lucide-react';
import { triggerHaptic } from '@/lib/haptics';
import {
  OfflineQueueItem,
  subscribeToOfflineQueue,
  processOfflineQueue,
  removeOfflineItem,
  clearSyncedOfflineItems,
} from '@/services/offlineSyncService';
import { Button } from '@/components/ui/button';

export function NetworkStatusIndicator() {
  const [mounted, setMounted] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [showRestored, setShowRestored] = useState(false);
  const [queue, setQueue] = useState<OfflineQueueItem[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [syncFeedback, setSyncFeedback] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
    if (typeof window === 'undefined' || typeof navigator === 'undefined') return;

    setIsOnline(navigator.onLine);

    // Subscribe to offline queue changes in IndexedDB
    const unsubscribeQueue = subscribeToOfflineQueue((items) => {
      setQueue(items);
    });

    const handleOnline = async () => {
      setIsOnline(true);
      setShowRestored(true);
      triggerHaptic('success');

      // Auto-process queue on reconnect
      setIsSyncing(true);
      try {
        const res = await processOfflineQueue();
        if (res.synced > 0) {
          setSyncFeedback(`Successfully synced ${res.synced} offline item${res.synced > 1 ? 's' : ''}!`);
          setTimeout(() => setSyncFeedback(null), 4000);
        }
      } finally {
        setIsSyncing(false);
      }

      const timer = setTimeout(() => {
        setShowRestored(false);
      }, 3500);
      return () => clearTimeout(timer);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setShowRestored(false);
      triggerHaptic('warning');
    };

    const handleOpenOutbox = () => {
      setShowModal(true);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('open-offline-outbox', handleOpenOutbox);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('open-offline-outbox', handleOpenOutbox);
      unsubscribeQueue();
    };
  }, []);

  if (!mounted) return null;

  const pendingCount = queue.filter((i) => i.status === 'pending' || i.status === 'failed').length;
  const hasItems = queue.length > 0;

  const handleManualSync = async () => {
    if (!isOnline) {
      triggerHaptic('warning');
      return;
    }
    triggerHaptic('medium');
    setIsSyncing(true);
    try {
      const res = await processOfflineQueue();
      if (res.synced > 0) {
        triggerHaptic('success');
        setSyncFeedback(`Synced ${res.synced} item${res.synced > 1 ? 's' : ''}!`);
        setTimeout(() => setSyncFeedback(null), 4000);
      } else if (res.failed > 0) {
        triggerHaptic('warning');
        setSyncFeedback(`${res.failed} item${res.failed > 1 ? 's' : ''} failed to sync.`);
      }
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <>
      {/* Top Banner Notifications */}
      <div
        role="status"
        aria-live="polite"
        className="fixed top-14 sm:top-16 left-0 right-0 z-50 flex justify-center px-4 pointer-events-none animate-in fade-in slide-in-from-top-2 duration-200"
      >
        {!isOnline ? (
          <div className="pointer-events-auto bg-amber-600/95 backdrop-blur-md text-white px-4 py-2.5 rounded-2xl shadow-xl border border-amber-400 flex items-center gap-3 max-w-md text-xs font-medium">
            <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center shrink-0">
              <WifiOff className="w-4 h-4 text-white animate-pulse" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 font-bold leading-tight">
                <span>Offline Mode</span>
                {pendingCount > 0 && (
                  <span className="bg-amber-800/80 text-[10px] px-1.5 py-0.5 rounded-full font-semibold">
                    {pendingCount} Queued
                  </span>
                )}
              </div>
              <p className="text-[11px] text-amber-100 leading-tight mt-0.5">
                Attendance selfies & forms are securely stored locally. Auto-sync will trigger once connected.
              </p>
            </div>
            {hasItems && (
              <button
                type="button"
                onClick={() => {
                  triggerHaptic('light');
                  setShowModal(true);
                }}
                className="px-2.5 py-1.5 rounded-xl bg-white/20 hover:bg-white/30 text-white font-semibold text-[11px] shrink-0 active:scale-95 transition-all"
              >
                View Outbox
              </button>
            )}
          </div>
        ) : showRestored ? (
          <div className="pointer-events-auto bg-emerald-600/95 backdrop-blur-md text-white px-4 py-2 rounded-2xl shadow-xl border border-emerald-500 flex items-center gap-2.5 max-w-sm text-xs font-medium animate-in fade-in slide-in-from-top-1">
            <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center shrink-0">
              <Wifi className="w-3.5 h-3.5 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold leading-tight">Back online</p>
              <p className="text-[11px] text-emerald-100 leading-tight mt-0.5">
                Network connection restored. Syncing offline records...
              </p>
            </div>
          </div>
        ) : syncFeedback ? (
          <div className="pointer-events-auto bg-emerald-600/95 backdrop-blur-md text-white px-4 py-2 rounded-2xl shadow-xl border border-emerald-500 flex items-center gap-2.5 max-w-sm text-xs font-medium animate-in fade-in slide-in-from-top-1">
            <CheckCircle2 className="w-4 h-4 text-emerald-200 shrink-0" />
            <p className="font-bold">{syncFeedback}</p>
          </div>
        ) : null}
      </div>

      {/* Floating Offline Outbox Pill (When online with pending items or when user wants to check Outbox) */}
      {isOnline && pendingCount > 0 && !showRestored && (
        <div className="fixed bottom-20 right-4 sm:bottom-6 sm:right-6 z-40 animate-in fade-in slide-in-from-bottom-2">
          <div className="bg-slate-900/90 hover:bg-slate-900 text-white backdrop-blur-md pl-3.5 pr-2 py-2 rounded-2xl shadow-2xl border border-slate-700 flex items-center gap-2.5 text-xs">
            <CloudUpload className="w-4 h-4 text-amber-400 shrink-0" />
            <button
              type="button"
              onClick={() => {
                triggerHaptic('light');
                setShowModal(true);
              }}
              className="text-left font-medium hover:underline flex items-center gap-1"
            >
              <span>{pendingCount} offline {pendingCount === 1 ? 'item' : 'items'}</span>
              <ChevronRight className="w-3 h-3 text-slate-400" />
            </button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleManualSync}
              disabled={isSyncing}
              className="h-7 text-xs bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold border-0 px-2.5 rounded-xl ml-1"
            >
              {isSyncing ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin mr-1" />
              ) : (
                <CloudUpload className="w-3.5 h-3.5 mr-1" />
              )}
              {isSyncing ? 'Syncing...' : 'Sync Now'}
            </Button>
          </div>
        </div>
      )}

      {/* Offline Outbox Modal / Drawer */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[85vh] animate-in slide-in-from-bottom duration-200">
            {/* Header */}
            <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/40">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                  <Layers className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-white text-base">Offline Outbox</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {queue.length} stored {queue.length === 1 ? 'record' : 'records'} · {pendingCount} awaiting upload
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="w-8 h-8 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center justify-center text-slate-500"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Item List */}
            <div className="p-4 overflow-y-auto flex-1 space-y-2.5">
              {queue.length === 0 ? (
                <div className="py-12 text-center text-slate-400 space-y-2">
                  <CheckCircle2 className="w-10 h-10 mx-auto text-emerald-500/60" />
                  <p className="font-semibold text-slate-700 dark:text-slate-300">Outbox is empty</p>
                  <p className="text-xs text-slate-400 max-w-xs mx-auto">
                    All attendance punches, delivery challans, and stock requests are synced to the cloud.
                  </p>
                </div>
              ) : (
                queue.map((item) => (
                  <div
                    key={item.id}
                    className="p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/60 flex items-start justify-between gap-3 shadow-sm hover:border-slate-300 transition-all"
                  >
                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            item.type === 'attendance-punch'
                              ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300'
                              : item.type === 'challan'
                              ? 'bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300'
                              : 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300'
                          }`}
                        >
                          {item.type === 'attendance-punch'
                            ? 'Attendance Punch'
                            : item.type === 'challan'
                            ? 'Delivery Challan'
                            : 'Stock Request'}
                        </span>
                        <span
                          className={`text-[10px] font-semibold px-2 py-0.5 rounded-full flex items-center gap-1 ${
                            item.status === 'synced'
                              ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300'
                              : item.status === 'syncing'
                              ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 animate-pulse'
                              : item.status === 'failed'
                              ? 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300'
                              : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                          }`}
                        >
                          {item.status === 'synced' && <CheckCircle2 className="w-2.5 h-2.5" />}
                          {item.status === 'syncing' && <RefreshCw className="w-2.5 h-2.5 animate-spin" />}
                          {item.status === 'failed' && <AlertCircle className="w-2.5 h-2.5" />}
                          {item.status.toUpperCase()}
                        </span>
                      </div>
                      <p className="font-bold text-slate-900 dark:text-white text-xs truncate">{item.title}</p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1">{item.summary}</p>
                      <div className="flex items-center gap-2 text-[10px] text-slate-400 pt-0.5">
                        <Clock className="w-3 h-3" />
                        <span>Saved {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        {item.errorMessage && (
                          <span className="text-red-500 font-medium truncate">Error: {item.errorMessage}</span>
                        )}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={async () => {
                        triggerHaptic('light');
                        await removeOfflineItem(item.id);
                      }}
                      className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition-colors shrink-0"
                      title="Delete from local queue"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))
              )}
            </div>

            {/* Footer Actions */}
            <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 flex items-center justify-between gap-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={async () => {
                  triggerHaptic('light');
                  await clearSyncedOfflineItems();
                }}
                className="text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
              >
                Clear Synced
              </Button>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  onClick={handleManualSync}
                  disabled={isSyncing || pendingCount === 0 || !isOnline}
                  className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs rounded-xl"
                >
                  {isSyncing ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin mr-1.5" />
                  ) : (
                    <CloudUpload className="w-3.5 h-3.5 mr-1.5" />
                  )}
                  {isSyncing ? 'Syncing Records...' : `Sync All (${pendingCount})`}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
