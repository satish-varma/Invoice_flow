'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { NewRelicChallan, NewRelicChallanItem, PricingItem } from '@/types/challan';
import { saveNewRelicChallan, NEWRELIC_LOCATIONS } from '@/services/newrelicChallanService';
import { getAllPricingItems, findPricingForItem, buildPricingMap } from '@/services/newrelicPricingService';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { triggerHaptic } from '@/lib/haptics';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Sparkles, Loader2, Check, ExternalLink, Calculator, ArrowRight } from 'lucide-react';

interface QuickCostModalProps {
  isOpen: boolean;
  onClose: () => void;
  challan: NewRelicChallan | null;
  onSaved: (updatedChallan: NewRelicChallan) => void;
  onOpenFullForm?: (challan: NewRelicChallan) => void;
}

export function QuickCostModal({
  isOpen,
  onClose,
  challan,
  onSaved,
  onOpenFullForm,
}: QuickCostModalProps) {
  const { user, role } = useAuth();
  const { toast } = useToast();
  const isAdmin = role === 'admin' || role === 'superadmin';

  const [costs, setCosts] = useState<Record<number, string>>({});
  const [pricingCatalog, setPricingCatalog] = useState<PricingItem[]>([]);
  const [isLoadingCatalog, setIsLoadingCatalog] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [viewFilter, setViewFilter] = useState<'missing_only' | 'all'>('missing_only');

  const firstInputRef = useRef<HTMLInputElement | null>(null);

  // Load pricing catalog once when modal opens
  useEffect(() => {
    if (isOpen && isAdmin) {
      setIsLoadingCatalog(true);
      getAllPricingItems()
        .then((items) => setPricingCatalog(items))
        .catch((err) => console.warn('Failed to load pricing catalog for quick suggestions:', err))
        .finally(() => setIsLoadingCatalog(false));
    }
  }, [isOpen, isAdmin]);

  // Initialize costs from challan line items
  useEffect(() => {
    if (challan?.lineItems) {
      const initialCosts: Record<number, string> = {};
      challan.lineItems.forEach((item, index) => {
        const cost = item.procurementCost;
        if (cost !== undefined && cost !== null && !isNaN(Number(cost)) && Number(cost) > 0) {
          initialCosts[index] = String(cost);
        } else {
          initialCosts[index] = '';
        }
      });
      setCosts(initialCosts);
      setViewFilter('missing_only');
    }
  }, [challan]);

  // Focus the first input after opening
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        firstInputRef.current?.focus();
        firstInputRef.current?.select();
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Calculate suggestions from pricing catalog
  const pricingMap = useMemo(() => {
    return buildPricingMap(pricingCatalog, challan?.dcDate);
  }, [pricingCatalog, challan?.dcDate]);

  const itemSuggestions = useMemo(() => {
    if (!challan?.lineItems || pricingCatalog.length === 0) return {};

    const suggestions: Record<number, number> = {};
    challan.lineItems.forEach((item, index) => {
      const brand = item.brandName || '';
      const name = item.itemName || '';
      if (!name) return;

      const match = findPricingForItem(pricingCatalog, pricingMap, name, brand);
      if (match && match.purchaseCost && match.purchaseCost > 0) {
        suggestions[index] = match.purchaseCost;
      }
    });

    return suggestions;
  }, [challan, pricingCatalog, pricingMap]);

  // Check which items are missing costs
  const missingIndices = useMemo(() => {
    if (!challan?.lineItems) return [];
    return challan.lineItems
      .map((item, idx) => {
        const currentVal = costs[idx];
        const isMissing =
          currentVal === undefined ||
          currentVal.trim() === '' ||
          isNaN(Number(currentVal)) ||
          Number(currentVal) <= 0;
        return isMissing ? idx : -1;
      })
      .filter((idx) => idx !== -1);
  }, [challan, costs]);

  // Available suggestions count for currently missing items
  const applicableSuggestionsCount = useMemo(() => {
    return missingIndices.filter((idx) => itemSuggestions[idx] !== undefined).length;
  }, [missingIndices, itemSuggestions]);

  // Apply single suggestion
  const handleApplySuggestion = (index: number) => {
    const suggested = itemSuggestions[index];
    if (suggested !== undefined) {
      triggerHaptic('light');
      setCosts((prev) => ({ ...prev, [index]: String(suggested) }));
    }
  };

  // Apply all suggestions
  const handleApplyAllSuggestions = () => {
    triggerHaptic('medium');
    setCosts((prev) => {
      const next = { ...prev };
      missingIndices.forEach((idx) => {
        if (itemSuggestions[idx] !== undefined) {
          next[idx] = String(itemSuggestions[idx]);
        }
      });
      return next;
    });
    toast({
      title: 'Suggestions Applied',
      description: `Auto-filled ${applicableSuggestionsCount} vendor costs from Master Catalog.`,
    });
  };

  // Real-time recalculation of total value, costs, and profit margin
  const totals = useMemo(() => {
    if (!challan?.lineItems) return { mrp: 0, cost: 0, marginPct: 0, missingCount: 0 };

    let mrp = 0;
    let cost = 0;
    let missingCount = 0;

    challan.lineItems.forEach((item, index) => {
      const qty = Number(item.quantity) || 1;
      const itemMrp = Number(item.mrp) || 0;
      const itemCostVal = costs[index];
      const itemCost = Number(itemCostVal) || 0;

      mrp += itemMrp * qty;
      cost += itemCost * qty;

      if (!itemCostVal || isNaN(Number(itemCostVal)) || Number(itemCostVal) <= 0) {
        missingCount++;
      }
    });

    const marginAmount = mrp - cost;
    const marginPct = mrp > 0 ? (marginAmount / mrp) * 100 : 0;

    return { mrp, cost, marginPct, missingCount };
  }, [challan, costs]);

  // Save handler
  const handleSaveCosts = async () => {
    if (!challan) return;

    try {
      setIsSaving(true);
      triggerHaptic('medium');

      const updatedLineItems: NewRelicChallanItem[] = (challan.lineItems || []).map((item, index) => {
        const costVal = costs[index];
        const parsedCost = costVal !== undefined && costVal.trim() !== '' ? Number(costVal) : undefined;
        return {
          ...item,
          procurementCost: parsedCost && !isNaN(parsedCost) && parsedCost > 0 ? parsedCost : undefined,
        };
      });

      const updatedChallanData = {
        ...challan,
        lineItems: updatedLineItems,
      };

      const savedResult = await saveNewRelicChallan(updatedChallanData, user?.email || null);

      triggerHaptic('success');
      toast({
        title: 'Procurement Costs Saved',
        description: `Successfully updated line item costs for DC #${challan.dcNumber}.`,
      });

      onSaved(savedResult);
      onClose();
    } catch (err: any) {
      console.error('Failed to save procurement costs:', err);
      toast({
        title: 'Error Saving Costs',
        description: err.message || 'Could not update procurement costs. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (!isAdmin || !challan) return null;

  const itemsToDisplay = (challan.lineItems || []).map((item, index) => ({
    item,
    index,
    isMissing: missingIndices.includes(index),
    suggestedCost: itemSuggestions[index],
  })).filter(({ isMissing }) => (viewFilter === 'missing_only' ? isMissing : true));

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-[95vw] sm:max-w-2xl max-h-[90vh] flex flex-col p-0 overflow-hidden rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl">
        {/* Header */}
        <DialogHeader className="p-5 pb-4 border-b border-slate-100 dark:border-slate-800 bg-gradient-to-r from-amber-50/60 via-indigo-50/20 to-white dark:from-slate-900 dark:via-slate-900 dark:to-slate-900">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300 shadow-xs shrink-0">
                <AlertTriangle className="w-5 h-5 animate-pulse" />
              </div>
              <div>
                <DialogTitle className="text-base sm:text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <span>Quick-Fix Procurement Cost</span>
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-2 flex-wrap">
                  <span className="font-mono font-bold text-slate-900 dark:text-slate-200">
                    DC #{challan.dcNumber}
                  </span>
                  <span>·</span>
                  <Badge variant="outline" className="text-[10px] px-2 py-0 border-slate-200 dark:border-slate-700">
                    {NEWRELIC_LOCATIONS[challan.location]?.label || challan.location}
                  </Badge>
                  <span>·</span>
                  <span className="text-amber-700 dark:text-amber-400 font-bold">
                    {totals.missingCount} {totals.missingCount === 1 ? 'item missing cost' : 'items missing cost'}
                  </span>
                </DialogDescription>
              </div>
            </div>

            {/* Filter Toggle Pill (Missing Only vs All) */}
            <div className="flex items-center p-0.5 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200/80 dark:border-slate-700 text-xs shrink-0">
              <button
                type="button"
                onClick={() => setViewFilter('missing_only')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${
                  viewFilter === 'missing_only'
                    ? 'bg-white dark:bg-slate-900 text-amber-700 dark:text-amber-300 shadow-2xs font-black'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Missing ({totals.missingCount})
              </button>
              <button
                type="button"
                onClick={() => setViewFilter('all')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${
                  viewFilter === 'all'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs font-black'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                All ({challan.lineItems?.length || 0})
              </button>
            </div>
          </div>
        </DialogHeader>

        {/* Catalog Suggestions Banner (if matches exist) */}
        {applicableSuggestionsCount > 0 && (
          <div className="px-5 py-2.5 bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-950/40 dark:to-purple-950/40 border-b border-indigo-100 dark:border-indigo-900/50 flex items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 text-indigo-900 dark:text-indigo-200 font-medium">
              <Sparkles className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
              <span>
                Found <strong>{applicableSuggestionsCount}</strong> matching vendor {applicableSuggestionsCount === 1 ? 'cost' : 'costs'} in Master Pricing Catalog.
              </span>
            </div>
            <button
              type="button"
              onClick={handleApplyAllSuggestions}
              className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold text-xs shadow-xs transition-all active:scale-95 shrink-0 flex items-center gap-1"
            >
              <Sparkles className="w-3 h-3" />
              <span>Apply All ({applicableSuggestionsCount})</span>
            </button>
          </div>
        )}

        {/* Scrollable Line Items List */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3">
          {itemsToDisplay.length === 0 ? (
            <div className="p-8 text-center bg-emerald-50/50 dark:bg-emerald-950/20 rounded-2xl border border-emerald-200/60 dark:border-emerald-800/60 text-emerald-800 dark:text-emerald-200 space-y-2">
              <Check className="w-8 h-8 mx-auto text-emerald-600" />
              <p className="font-extrabold text-sm">All line items have procurement costs!</p>
              <p className="text-xs text-emerald-600 dark:text-emerald-400">
                Switch to &ldquo;All&rdquo; above if you want to review or tweak existing costs.
              </p>
            </div>
          ) : (
            itemsToDisplay.map(({ item, index, isMissing, suggestedCost }, rowIdx) => {
              const currentCost = costs[index] || '';
              const qty = Number(item.quantity) || 1;
              const mrp = Number(item.mrp) || 0;
              const costNum = Number(currentCost) || 0;
              const lineMargin = mrp > 0 ? ((mrp - costNum) / mrp) * 100 : 0;

              return (
                <div
                  key={index}
                  className={`p-3.5 rounded-2xl border transition-all ${
                    isMissing
                      ? 'bg-amber-50/50 dark:bg-amber-950/20 border-amber-300 dark:border-amber-800/80 shadow-2xs'
                      : 'bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    {/* Item Identity */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-black text-xs text-indigo-700 dark:text-indigo-400 uppercase tracking-wide">
                          {item.brandName || 'Unbranded'}
                        </span>
                        <span className="text-slate-300">·</span>
                        <span className="font-bold text-xs text-slate-900 dark:text-slate-100 truncate">
                          {item.itemName}
                        </span>
                        {isMissing && (
                          <span className="px-1.5 py-0.2 rounded-md bg-amber-100 text-amber-900 dark:bg-amber-900 dark:text-amber-200 text-[10px] font-black uppercase tracking-wider">
                            Missing Cost
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-2 flex-wrap">
                        <span>Qty: <strong className="text-slate-700 dark:text-slate-200 font-mono">{qty}</strong></span>
                        <span>·</span>
                        <span>MRP: <strong className="text-slate-700 dark:text-slate-200 font-mono">₹{mrp.toFixed(2)}</strong></span>
                        <span>·</span>
                        <span className="font-mono">Total MRP: ₹{(mrp * qty).toLocaleString('en-IN', { maximumFractionDigits: 1 })}</span>
                      </div>
                    </div>

                    {/* Cost Input & Live Margin preview */}
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5 justify-end">
                          <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                            P.Cost (₹)
                          </label>
                        </div>
                        <div className="relative">
                          <Input
                            ref={rowIdx === 0 && isMissing ? firstInputRef : undefined}
                            type="number"
                            step="0.01"
                            min="0"
                            value={currentCost}
                            onChange={(e) => {
                              const val = e.target.value;
                              setCosts((prev) => ({ ...prev, [index]: val }));
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                handleSaveCosts();
                              }
                            }}
                            placeholder="e.g. 45"
                            className={`w-28 sm:w-32 h-9 text-right font-mono font-bold text-sm rounded-xl transition-all ${
                              isMissing
                                ? 'border-amber-400 bg-amber-50/60 dark:bg-amber-950/40 focus:border-amber-500 focus:ring-amber-500/30'
                                : 'border-slate-200 focus:border-indigo-500'
                            }`}
                          />
                        </div>
                      </div>

                      {/* Live Calculated Line Margin */}
                      <div className="min-w-[70px] text-right">
                        <span className="text-[10px] text-slate-400 block font-bold uppercase tracking-wider">
                          Margin
                        </span>
                        {costNum > 0 ? (
                          <span
                            className={`font-mono font-black text-xs px-2 py-0.5 rounded-full inline-block ${
                              lineMargin >= 20
                                ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                : lineMargin >= 10
                                ? 'bg-blue-50 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                                : 'bg-rose-50 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                            }`}
                          >
                            {lineMargin.toFixed(1)}%
                          </span>
                        ) : (
                          <span className="text-slate-400 font-mono text-xs">—</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Single Suggestion Chip */}
                  {suggestedCost !== undefined && isMissing && (
                    <div className="mt-2.5 pt-2 border-t border-amber-200/50 dark:border-amber-900/40 flex items-center justify-between text-xs">
                      <span className="text-slate-500 flex items-center gap-1 text-[11px]">
                        <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
                        <span>Master Catalog Price: <strong>₹{suggestedCost}</strong></span>
                      </span>
                      <button
                        type="button"
                        onClick={() => handleApplySuggestion(index)}
                        className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 underline hover:no-underline cursor-pointer"
                      >
                        Apply ₹{suggestedCost} →
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer: Live Composite Totals + Save Action */}
        <DialogFooter className="p-4 sm:px-6 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/80 flex flex-col sm:flex-row items-center justify-between gap-3">
          {/* Summary Pills */}
          <div className="flex items-center gap-3 text-xs w-full sm:w-auto justify-between sm:justify-start">
            <div>
              <span className="text-slate-400 text-[10px] block font-bold uppercase">Total MRP</span>
              <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                ₹{totals.mrp.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
            <div className="h-6 w-px bg-slate-200 dark:bg-slate-700" />
            <div>
              <span className="text-slate-400 text-[10px] block font-bold uppercase">Total P.Cost</span>
              <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">
                ₹{totals.cost.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
            <div className="h-6 w-px bg-slate-200 dark:bg-slate-700" />
            <div>
              <span className="text-slate-400 text-[10px] block font-bold uppercase">Proj. Margin</span>
              <span className={`font-mono font-black ${totals.marginPct >= 20 ? 'text-emerald-600' : 'text-amber-600'}`}>
                {totals.marginPct.toFixed(1)}%
              </span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            {onOpenFullForm && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenFullForm(challan);
                }}
                className="text-xs text-slate-500 hover:text-indigo-600 underline px-2 py-1 flex items-center gap-1 font-semibold"
                title="Open full form to edit quantities, brands, or dates"
              >
                <span>Full Form</span>
                <ExternalLink className="w-3 h-3" />
              </button>
            )}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              disabled={isSaving}
              className="rounded-xl text-xs font-bold"
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleSaveCosts}
              disabled={isSaving}
              className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black shadow-md shadow-indigo-200 dark:shadow-none min-w-[110px]"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5 mr-1" />
                  <span>Save Costs</span>
                </>
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
