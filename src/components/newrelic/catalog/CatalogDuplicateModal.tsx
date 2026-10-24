'use client';

import React, { useState, useMemo } from 'react';
import { CatalogItem } from '@/types/challan';
import {
  DuplicateGroup,
  detectDuplicateCatalogGroups,
  mergeDuplicateGroup,
} from '@/services/newrelicDuplicateDetector';
import { getCatalogDocId } from '@/services/newrelicCatalogService';
import {
  X,
  GitMerge,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  ShieldCheck,
  Check,
  Loader2,
  Trash2,
  Info,
  ChevronRight,
  RefreshCw,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { triggerHaptic } from '@/lib/haptics';

interface CatalogDuplicateModalProps {
  isOpen: boolean;
  onClose: () => void;
  catalogItems: CatalogItem[];
  onMergedSuccess: (updatedItem: CatalogItem, deletedIds: string[]) => void;
  onBatchMergedSuccess: (updatedItems: CatalogItem[], allDeletedIds: string[]) => void;
  isReadOnly?: boolean;
}

export function CatalogDuplicateModal({
  isOpen,
  onClose,
  catalogItems,
  onMergedSuccess,
  onBatchMergedSuccess,
  isReadOnly = false,
}: CatalogDuplicateModalProps) {
  // Detected duplicate groups
  const initialGroups = useMemo(() => {
    if (!isOpen) return [];
    return detectDuplicateCatalogGroups(catalogItems);
  }, [isOpen, catalogItems]);

  const [activeGroups, setActiveGroups] = useState<DuplicateGroup[]>(initialGroups);
  // Track selected keeper per group { [groupId]: keeperId }
  const [selectedKeepers, setSelectedKeepers] = useState<Record<string, string>>({});
  // Track ongoing merge state
  const [isMerging, setIsMerging] = useState(false);
  const [mergingGroupId, setMergingGroupId] = useState<string | null>(null);
  const [batchProgress, setBatchProgress] = useState<{ current: number; total: number } | null>(null);

  // Sync initial groups when modal opens or catalog items change
  React.useEffect(() => {
    if (isOpen) {
      const groups = detectDuplicateCatalogGroups(catalogItems);
      setActiveGroups(groups);
      const keepers: Record<string, string> = {};
      groups.forEach(g => {
        keepers[g.id] = g.suggestedKeeperId;
      });
      setSelectedKeepers(keepers);
    }
  }, [isOpen, catalogItems]);

  if (!isOpen) return null;

  const totalRedundantItems = activeGroups.reduce((acc, g) => acc + (g.items.length - 1), 0);
  const highConfidenceGroups = activeGroups.filter(g => g.similarityScore >= 90);

  const getItemDocId = (item: CatalogItem) =>
    item.id || getCatalogDocId(item.brandName, item.itemName);

  const handleSelectKeeper = (groupId: string, itemId: string) => {
    triggerHaptic();
    setSelectedKeepers(prev => ({
      ...prev,
      [groupId]: itemId,
    }));
  };

  const handleIgnoreGroup = (groupId: string) => {
    triggerHaptic();
    setActiveGroups(prev => prev.filter(g => g.id !== groupId));
  };

  // 1-Click Merge Single Group
  const handleMergeGroup = async (group: DuplicateGroup) => {
    if (isReadOnly) return;
    triggerHaptic();
    const keeperId = selectedKeepers[group.id] || group.suggestedKeeperId;
    setMergingGroupId(group.id);
    setIsMerging(true);

    try {
      const { mergedItem, deletedIds } = await mergeDuplicateGroup(group, keeperId);
      setActiveGroups(prev => prev.filter(g => g.id !== group.id));
      onMergedSuccess(mergedItem, deletedIds);
    } catch (error) {
      console.error('Error merging duplicate group:', error);
      alert('Failed to merge duplicate group. Please check write permissions and try again.');
    } finally {
      setIsMerging(false);
      setMergingGroupId(null);
    }
  };

  // Batch Merge All High-Confidence (>90%) or All Groups
  const handleBatchMerge = async (groupsToMerge: DuplicateGroup[]) => {
    if (isReadOnly || groupsToMerge.length === 0) return;
    triggerHaptic();

    const confirmed = window.confirm(
      `Are you sure you want to merge ${groupsToMerge.length} duplicate group(s)?\n` +
      `This will update the best candidate item in each group and permanently remove redundant entries.`
    );
    if (!confirmed) return;

    setIsMerging(true);
    setBatchProgress({ current: 0, total: groupsToMerge.length });

    const updatedItems: CatalogItem[] = [];
    const allDeletedIds: string[] = [];
    const mergedGroupIds = new Set<string>();

    try {
      for (let i = 0; i < groupsToMerge.length; i++) {
        const group = groupsToMerge[i];
        setBatchProgress({ current: i + 1, total: groupsToMerge.length });
        const keeperId = selectedKeepers[group.id] || group.suggestedKeeperId;
        const res = await mergeDuplicateGroup(group, keeperId);
        updatedItems.push(res.mergedItem);
        allDeletedIds.push(...res.deletedIds);
        mergedGroupIds.add(group.id);
      }

      setActiveGroups(prev => prev.filter(g => !mergedGroupIds.has(g.id)));
      onBatchMergedSuccess(updatedItems, allDeletedIds);
    } catch (error) {
      console.error('Error batch merging duplicate groups:', error);
      alert('Batch merge encountered an error. Remaining groups have been kept intact.');
    } finally {
      setIsMerging(false);
      setBatchProgress(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center border border-indigo-200 dark:border-indigo-800 shadow-sm">
              <GitMerge className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                  Duplicate Detector & Smart Merger
                </h2>
                {activeGroups.length > 0 && (
                  <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
                    {activeGroups.length} Groups Found
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Automatically identifies spelling variations, singular/plural brand aliases, and redundant items.
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              triggerHaptic();
              onClose();
            }}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Action & Stats Subheader */}
        {activeGroups.length > 0 && (
          <div className="px-4 py-3 bg-indigo-50/60 dark:bg-indigo-950/30 border-b border-indigo-100 dark:border-indigo-900/50 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-4 text-slate-600 dark:text-slate-300">
              <span className="flex items-center gap-1.5 font-medium">
                <span className="h-2 w-2 rounded-full bg-indigo-500 animate-pulse" />
                {totalRedundantItems} duplicate entry to clean
              </span>
              <span className="text-slate-300 dark:text-slate-700">|</span>
              <span className="text-slate-500 dark:text-slate-400">
                {highConfidenceGroups.length} high-confidence (&ge;90%)
              </span>
            </div>

            <div className="flex items-center gap-2">
              {highConfidenceGroups.length > 0 && (
                <button
                  onClick={() => handleBatchMerge(highConfidenceGroups)}
                  disabled={isMerging || isReadOnly}
                  className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-medium shadow-sm transition flex items-center gap-1.5 disabled:opacity-50 text-xs"
                >
                  {isMerging && batchProgress ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Merging {batchProgress.current}/{batchProgress.total}...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-3.5 w-3.5" />
                      Merge All High-Confidence ({highConfidenceGroups.length})
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        )}

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          {activeGroups.length === 0 ? (
            <div className="py-16 px-4 text-center flex flex-col items-center justify-center">
              <div className="h-16 w-16 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-200 dark:border-emerald-800 mb-4 shadow-sm">
                <ShieldCheck className="h-8 w-8" />
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                No Duplicates Detected!
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mt-1 mb-6">
                Your catalog is clean and healthy. All brand names, flavors, and items are distinct without redundant duplicates.
              </p>
              <button
                onClick={() => {
                  triggerHaptic();
                  onClose();
                }}
                className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-slate-200 text-white dark:text-slate-900 font-medium text-xs shadow-sm transition"
              >
                Close Detector
              </button>
            </div>
          ) : (
            activeGroups.map((group, idx) => {
              const currentKeeperId = selectedKeepers[group.id] || group.suggestedKeeperId;
              const keeperItem = group.items.find(i => getItemDocId(i) === currentKeeperId) || group.items[0];
              const duplicates = group.items.filter(i => getItemDocId(i) !== currentKeeperId);

              // Calculate combined sites
              const allSites = Array.from(
                new Set(group.items.flatMap(i => i.applicableSites || ['newrelic']))
              );
              const isAllSites = allSites.includes('all') || allSites.length >= 3;

              // Best MRP & CaseSize
              const bestMrp = keeperItem.mrp || duplicates.find(d => d.mrp !== undefined)?.mrp;
              const bestCase = keeperItem.caseSize || duplicates.find(d => d.caseSize !== undefined)?.caseSize;

              const isGroupMerging = mergingGroupId === group.id;

              return (
                <div
                  key={group.id}
                  className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden bg-white dark:bg-slate-900 shadow-sm transition hover:border-slate-300 dark:hover:border-slate-700"
                >
                  {/* Group Header */}
                  <div className="px-4 py-3 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 text-[11px] font-bold rounded-md bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                        Match #{idx + 1}
                      </span>
                      <span
                        className={cn(
                          'px-2 py-0.5 text-[11px] font-semibold rounded-md border',
                          group.similarityScore >= 95
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800'
                            : group.similarityScore >= 90
                            ? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800'
                            : 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800'
                        )}
                      >
                        {group.similarityScore}% Match
                      </span>
                      <span className="text-xs text-slate-600 dark:text-slate-300 font-medium">
                        {group.primaryReason}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleIgnoreGroup(group.id)}
                        disabled={isMerging}
                        className="px-2.5 py-1 text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition"
                      >
                        Ignore
                      </button>
                      <button
                        onClick={() => handleMergeGroup(group)}
                        disabled={isMerging || isReadOnly}
                        className="px-3 py-1 text-xs font-semibold rounded-md bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm transition flex items-center gap-1.5 disabled:opacity-50"
                      >
                        {isGroupMerging ? (
                          <>
                            <Loader2 className="h-3 w-3 animate-spin" />
                            Merging...
                          </>
                        ) : (
                          <>
                            <GitMerge className="h-3 w-3" />
                            1-Click Merge
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Candidate Items List */}
                  <div className="p-3 sm:p-4 space-y-2.5">
                    <div className="text-[11px] uppercase tracking-wider font-semibold text-slate-400 dark:text-slate-500">
                      Select which version to KEEP (other versions will be merged into it):
                    </div>

                    <div className="grid grid-cols-1 gap-2">
                      {group.items.map(item => {
                        const itemId = getItemDocId(item);
                        const isKeeper = itemId === currentKeeperId;

                        return (
                          <div
                            key={itemId}
                            onClick={() => handleSelectKeeper(group.id, itemId)}
                            className={cn(
                              'p-3 rounded-lg border text-xs cursor-pointer transition flex flex-col sm:flex-row sm:items-center justify-between gap-2.5',
                              isKeeper
                                ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/30 ring-1 ring-emerald-500/50'
                                : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-900'
                            )}
                          >
                            <div className="flex items-center gap-3">
                              <div
                                className={cn(
                                  'h-5 w-5 rounded-full flex items-center justify-center border transition',
                                  isKeeper
                                    ? 'border-emerald-500 bg-emerald-500 text-white'
                                    : 'border-slate-300 dark:border-slate-600 text-transparent'
                                )}
                              >
                                <Check className="h-3.5 w-3.5 stroke-[3]" />
                              </div>

                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="font-semibold text-slate-900 dark:text-slate-100 text-sm">
                                    {item.brandName} - {item.itemName}
                                  </span>
                                  {isKeeper && (
                                    <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-emerald-600 text-white">
                                      KEEPER
                                    </span>
                                  )}
                                </div>
                                <div className="text-[11px] text-slate-400 dark:text-slate-500 font-mono mt-0.5">
                                  ID: {itemId}
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-3 self-end sm:self-center">
                              <div className="text-right">
                                <div className="text-[11px] text-slate-400">Ref MRP</div>
                                <div className="font-medium text-slate-700 dark:text-slate-300">
                                  {item.mrp ? `₹${item.mrp}` : <span className="text-slate-400 italic">None</span>}
                                </div>
                              </div>

                              <div className="text-right">
                                <div className="text-[11px] text-slate-400">Case Size</div>
                                <div className="font-medium text-slate-700 dark:text-slate-300">
                                  {item.caseSize || <span className="text-slate-400 italic">None</span>}
                                </div>
                              </div>

                              <div className="text-right">
                                <div className="text-[11px] text-slate-400">Sites</div>
                                <div className="flex items-center gap-1">
                                  {item.applicableSites?.includes('all') ? (
                                    <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                                      All
                                    </span>
                                  ) : (
                                    (item.applicableSites || ['newrelic']).map(s => (
                                      <span
                                        key={s}
                                        className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 capitalize"
                                      >
                                        {s === 'newrelic' ? 'NR' : s === 'ntt_data' ? 'NTT' : s}
                                      </span>
                                    ))
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Result Preview Box */}
                    <div className="mt-2.5 p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 text-xs flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                        <Info className="h-4 w-4 text-indigo-500 shrink-0" />
                        <span>
                          <strong>Result after merge:</strong> Keep{' '}
                          <code className="text-indigo-600 dark:text-indigo-400 font-semibold">
                            {keeperItem.brandName} - {keeperItem.itemName}
                          </code>
                          {' '}(MRP: {bestMrp ? `₹${bestMrp}` : 'None'}, Case: {bestCase || 'None'}, Sites:{' '}
                          {isAllSites ? 'All' : allSites.join(', ')}).
                        </span>
                      </div>
                      <span className="text-[11px] text-rose-500 dark:text-rose-400 font-medium">
                        Will delete {duplicates.length} duplicate entry
                      </span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50">
          <div className="text-xs text-slate-500 dark:text-slate-400">
            {activeGroups.length > 0
              ? `${activeGroups.length} duplicate group(s) pending review.`
              : 'All duplicates have been resolved.'}
          </div>
          <button
            onClick={() => {
              triggerHaptic();
              onClose();
            }}
            className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium text-xs transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
