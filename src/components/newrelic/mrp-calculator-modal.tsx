'use client';

import React, { useState, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Calculator,
  Percent,
  IndianRupee,
  Copy,
  Check,
  RotateCcw,
  ArrowRightLeft,
  X,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import { triggerHaptic } from '@/lib/haptics';

interface MrpCalculatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMrp?: number;
}

type CalcMode = 'percent_to_value' | 'value_to_percent';
type DirectionType = 'discount' | 'markup';

const PRESET_PERCENTAGES = [5, 10, 15, 20, 25, 30, 33.33, 35, 40, 50];

export function MrpCalculatorModal({
  isOpen,
  onClose,
  initialMrp,
}: MrpCalculatorModalProps) {
  const [mode, setMode] = useState<CalcMode>('percent_to_value');
  const [direction, setDirection] = useState<DirectionType>('discount');

  // Input states
  const [mrpInput, setMrpInput] = useState<string>(initialMrp ? String(initialMrp) : '');
  const [percentInput, setPercentInput] = useState<string>('20');
  const [valueInput, setValueInput] = useState<string>('');

  const [copiedField, setCopiedField] = useState<'value' | 'percent' | null>(null);

  // When opened with initialMrp, keep state synced
  React.useEffect(() => {
    if (initialMrp && !mrpInput) {
      setMrpInput(String(initialMrp));
    }
  }, [initialMrp]);

  const mrp = parseFloat(mrpInput) || 0;
  const percent = parseFloat(percentInput) || 0;
  const value = parseFloat(valueInput) || 0;

  // Results calculation
  const results = useMemo(() => {
    if (mode === 'percent_to_value') {
      if (mrp <= 0) return null;
      if (direction === 'discount') {
        const diff = (mrp * percent) / 100;
        const finalVal = Math.max(0, mrp - diff);
        return {
          finalValue: finalVal,
          diffAmount: diff,
          effectivePercent: percent,
          label: 'Discounted Price / Cost',
          diffLabel: 'Savings / Margin',
        };
      } else {
        const diff = (mrp * percent) / 100;
        const finalVal = mrp + diff;
        return {
          finalValue: finalVal,
          diffAmount: diff,
          effectivePercent: percent,
          label: 'Price with Markup',
          diffLabel: 'Markup Added',
        };
      }
    } else {
      // value_to_percent
      if (mrp <= 0 || value < 0) return null;
      if (value <= mrp) {
        const diff = mrp - value;
        const calculatedPercent = (diff / mrp) * 100;
        return {
          finalValue: value,
          diffAmount: diff,
          effectivePercent: calculatedPercent,
          label: 'Calculated Discount',
          diffLabel: 'Discount Amount',
          isDiscount: true,
        };
      } else {
        const diff = value - mrp;
        const calculatedPercent = (diff / mrp) * 100;
        return {
          finalValue: value,
          diffAmount: diff,
          effectivePercent: calculatedPercent,
          label: 'Calculated Markup',
          diffLabel: 'Markup Amount',
          isDiscount: false,
        };
      }
    }
  }, [mode, direction, mrp, percent, value]);

  const copyToClipboard = (text: string, field: 'value' | 'percent') => {
    triggerHaptic('light');
    if (navigator?.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 1800);
    }
  };

  const handleReset = () => {
    triggerHaptic('light');
    setMrpInput('');
    setPercentInput('20');
    setValueInput('');
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md w-full p-0 overflow-hidden rounded-3xl bg-white border border-gray-100 shadow-2xl">
        {/* Header with Gradient Accent */}
        <div className="bg-gradient-to-r from-[#181156] via-[#2a1d8f] to-[#3b2fc9] text-white p-5 pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-2xl bg-white/15 backdrop-blur-md border border-white/20 flex items-center justify-center text-amber-300 shadow-xs">
                <Calculator className="w-5 h-5 stroke-[2.2]" />
              </div>
              <div>
                <DialogTitle className="text-base font-black text-white tracking-tight flex items-center gap-2">
                  MRP % Calculator
                </DialogTitle>
                <DialogDescription className="text-xs text-indigo-200 font-medium">
                  Quick margin, discount &amp; procurement cost finder
                </DialogDescription>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-full text-indigo-200 hover:text-white hover:bg-white/10 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Mode Switcher Tabs */}
          <div className="grid grid-cols-2 gap-1.5 bg-black/25 p-1 rounded-2xl mt-4 border border-white/10">
            <button
              type="button"
              onClick={() => {
                triggerHaptic('light');
                setMode('percent_to_value');
              }}
              className={`py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                mode === 'percent_to_value'
                  ? 'bg-white text-[#3b2fc9] shadow-md shadow-black/20'
                  : 'text-indigo-100 hover:text-white'
              }`}
            >
              <Percent className="w-3.5 h-3.5" />
              <span>% to Value</span>
            </button>

            <button
              type="button"
              onClick={() => {
                triggerHaptic('light');
                setMode('value_to_percent');
              }}
              className={`py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                mode === 'value_to_percent'
                  ? 'bg-white text-[#3b2fc9] shadow-md shadow-black/20'
                  : 'text-indigo-100 hover:text-white'
              }`}
            >
              <ArrowRightLeft className="w-3.5 h-3.5" />
              <span>Value to %</span>
            </button>
          </div>
        </div>

        {/* Calculator Body */}
        <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
          {/* Base MRP Input */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-gray-700 flex items-center gap-1">
                <IndianRupee className="w-3.5 h-3.5 text-indigo-600" />
                <span>Base MRP</span>
              </label>
              <span className="text-[10px] text-gray-400 font-medium">Original Retail Price</span>
            </div>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-gray-400">
                ₹
              </span>
              <input
                type="number"
                step="any"
                min="0"
                value={mrpInput}
                onChange={(e) => setMrpInput(e.target.value)}
                placeholder="e.g. 150.00"
                autoFocus
                className="w-full h-11 pl-8 pr-3 bg-gray-50/80 border border-gray-200 rounded-2xl text-base font-black text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#3b2fc9]/25 focus:border-[#3b2fc9] tabular-nums transition-all"
              />
            </div>
          </div>

          {/* Mode 1: Enter Percentage to get Value */}
          {mode === 'percent_to_value' && (
            <div className="space-y-3">
              {/* Direction Toggle: Discount off MRP vs Markup */}
              <div className="flex items-center justify-between gap-2">
                <label className="text-xs font-bold text-gray-700 flex items-center gap-1">
                  <Percent className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Percentage</span>
                </label>
                <div className="flex items-center gap-1 bg-gray-100 p-0.5 rounded-lg border border-gray-200">
                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic('light');
                      setDirection('discount');
                    }}
                    className={`px-2 py-0.5 rounded-md text-[11px] font-bold transition-all flex items-center gap-1 ${
                      direction === 'discount'
                        ? 'bg-emerald-600 text-white shadow-2xs'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    <TrendingDown className="w-3 h-3" />
                    <span>Discount Off</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic('light');
                      setDirection('markup');
                    }}
                    className={`px-2 py-0.5 rounded-md text-[11px] font-bold transition-all flex items-center gap-1 ${
                      direction === 'markup'
                        ? 'bg-indigo-600 text-white shadow-2xs'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    <TrendingUp className="w-3 h-3" />
                    <span>Markup</span>
                  </button>
                </div>
              </div>

              {/* % Input */}
              <div className="relative">
                <input
                  type="number"
                  step="any"
                  min="0"
                  max="100"
                  value={percentInput}
                  onChange={(e) => setPercentInput(e.target.value)}
                  placeholder="e.g. 20"
                  className="w-full h-11 pl-4 pr-9 bg-gray-50/80 border border-gray-200 rounded-2xl text-base font-black text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#3b2fc9]/25 focus:border-[#3b2fc9] tabular-nums transition-all"
                />
                <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-gray-400 pointer-events-none">
                  %
                </span>
              </div>

              {/* Preset Chips */}
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Quick Presets</span>
                <div className="flex flex-wrap gap-1.5">
                  {PRESET_PERCENTAGES.map((p) => {
                    const isSelected = percent === p;
                    return (
                      <button
                        key={p}
                        type="button"
                        onClick={() => {
                          triggerHaptic('light');
                          setPercentInput(String(p));
                        }}
                        className={`h-7 px-2.5 rounded-full text-xs font-bold transition-all tabular-nums ${
                          isSelected
                            ? 'bg-[#3b2fc9] text-white shadow-xs'
                            : 'bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-200'
                        }`}
                      >
                        {p}%
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Mode 2: Enter Value to get Percentage */}
          {mode === 'value_to_percent' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-gray-700 flex items-center gap-1">
                  <IndianRupee className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Actual Value / Purchase Cost</span>
                </label>
                <span className="text-[10px] text-gray-400 font-medium">Your Buying or Offer Price</span>
              </div>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-gray-400">
                  ₹
                </span>
                <input
                  type="number"
                  step="any"
                  min="0"
                  value={valueInput}
                  onChange={(e) => setValueInput(e.target.value)}
                  placeholder="e.g. 120.00"
                  className="w-full h-11 pl-8 pr-3 bg-gray-50/80 border border-gray-200 rounded-2xl text-base font-black text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#3b2fc9]/25 focus:border-[#3b2fc9] tabular-nums transition-all"
                />
              </div>
            </div>
          )}

          {/* Live Result Display Card */}
          {results ? (
            <div className="rounded-2xl p-4 bg-gradient-to-br from-indigo-50/80 via-white to-purple-50/60 border-2 border-indigo-200 shadow-sm space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block">
                    {mode === 'percent_to_value' ? results.label : 'Effective Discount / Margin'}
                  </span>
                  <div className="flex items-baseline gap-2 mt-0.5">
                    <p className="text-2xl font-black text-indigo-950 tabular-nums tracking-tight">
                      {mode === 'percent_to_value'
                        ? `₹${results.finalValue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                        : `${results.effectivePercent.toFixed(2)}%`}
                    </p>
                  </div>
                </div>

                {/* Quick Copy Result Button */}
                <button
                  type="button"
                  onClick={() => {
                    const toCopy = mode === 'percent_to_value'
                      ? results.finalValue.toFixed(2)
                      : results.effectivePercent.toFixed(2);
                    copyToClipboard(toCopy, 'value');
                  }}
                  className="h-9 px-3 rounded-xl bg-white hover:bg-gray-50 border border-indigo-200 text-indigo-700 hover:text-indigo-900 text-xs font-bold flex items-center gap-1.5 shadow-2xs active:scale-95 transition-all"
                  title="Copy result"
                >
                  {copiedField === 'value' ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <span className="text-emerald-700">Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy</span>
                    </>
                  )}
                </button>
              </div>

              {/* Breakdown Grid */}
              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-indigo-100 text-xs">
                <div className="bg-white/80 p-2.5 rounded-xl border border-indigo-100">
                  <span className="text-[10px] text-gray-500 font-semibold block">{results.diffLabel}</span>
                  <span className="text-sm font-black text-gray-900 tabular-nums">
                    ₹{results.diffAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>

                <div className="bg-white/80 p-2.5 rounded-xl border border-indigo-100">
                  <span className="text-[10px] text-gray-500 font-semibold block">
                    {mode === 'percent_to_value' ? 'Percentage Applied' : 'Final Net Price'}
                  </span>
                  <span className="text-sm font-black text-gray-900 tabular-nums">
                    {mode === 'percent_to_value'
                      ? `${results.effectivePercent.toFixed(2)}%`
                      : `₹${results.finalValue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl p-5 bg-gray-50/70 border border-dashed border-gray-200 text-center space-y-1">
              <Calculator className="w-6 h-6 text-gray-400 mx-auto" />
              <p className="text-xs font-bold text-gray-600">Enter MRP to start calculation</p>
              <p className="text-[11px] text-gray-400">
                {mode === 'percent_to_value'
                  ? 'Calculates purchase cost or discounted rate instantly'
                  : 'Calculates the discount % based on your buying price'}
              </p>
            </div>
          )}

          {/* Action Row */}
          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              onClick={handleReset}
              className="h-10 px-4 rounded-xl border border-gray-200 text-gray-600 hover:text-gray-900 hover:bg-gray-50 text-xs font-semibold flex items-center gap-1.5 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Clear</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="flex-1 h-10 rounded-xl bg-[#3b2fc9] hover:bg-indigo-700 text-white text-xs font-bold shadow-sm transition-all flex items-center justify-center gap-1.5 active:scale-98"
            >
              <span>Done</span>
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
