'use client';

import React, { useState } from 'react';
import { Calculator, Percent, ArrowRight, Check, Sparkles, X } from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { triggerHaptic } from '@/lib/haptics';

interface ChallanCalculatorProps {
  currentMrp?: number;
  currentUnitPrice?: number;
  currentPCost?: number;
  onApplyPrice?: (unitPrice: number, pCost?: number) => void;
  triggerButton?: React.ReactNode;
}

export function ChallanCalculator({
  currentMrp = 0,
  currentUnitPrice = 0,
  currentPCost = 0,
  onApplyPrice,
  triggerButton,
}: ChallanCalculatorProps) {
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'discount' | 'margin' | 'target'>('discount');

  // Mode 1: Discount against MRP
  const [mrpInput, setMrpInput] = useState<number | string>(currentMrp || currentUnitPrice || '');
  const [discountPercent, setDiscountPercent] = useState<number | string>(10);

  // Mode 2: Margin & Profit from Price and P.Cost
  const [salePriceInput, setSalePriceInput] = useState<number | string>(currentUnitPrice || '');
  const [pCostInput, setPCostInput] = useState<number | string>(currentPCost || '');

  // Mode 3: Target Margin % to Selling Price
  const [targetCostInput, setTargetCostInput] = useState<number | string>(currentPCost || '');
  const [targetMarginPercent, setTargetMarginPercent] = useState<number | string>(20);

  // Computed values
  const mrpNum = parseFloat(String(mrpInput)) || 0;
  const discNum = parseFloat(String(discountPercent)) || 0;
  const calculatedPriceFromDiscount = mrpNum > 0 ? mrpNum * (1 - discNum / 100) : 0;
  const discountSavings = mrpNum > 0 ? (mrpNum * discNum) / 100 : 0;

  const saleNum = parseFloat(String(salePriceInput)) || 0;
  const costNum = parseFloat(String(pCostInput)) || 0;
  const grossProfit = saleNum - costNum;
  const grossMarginPct = saleNum > 0 ? (grossProfit / saleNum) * 100 : 0;

  const tCostNum = parseFloat(String(targetCostInput)) || 0;
  const tMarginNum = parseFloat(String(targetMarginPercent)) || 0;
  const recommendedSalePrice = tMarginNum < 100 ? tCostNum / (1 - tMarginNum / 100) : 0;

  const handleApply = (price: number, pCost?: number) => {
    triggerHaptic('medium');
    if (onApplyPrice) {
      onApplyPrice(
        Math.round(price * 100) / 100,
        pCost !== undefined ? Math.round(pCost * 100) / 100 : undefined
      );
    }
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {triggerButton || (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => triggerHaptic('light')}
            className="h-7 px-2 text-xs font-bold text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded-lg flex items-center gap-1"
            title="Open MRP & Margin Calculator"
          >
            <Calculator className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Calc</span>
          </Button>
        )}
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-[330px] p-4 rounded-2xl shadow-2xl border border-gray-200 bg-white space-y-3 z-50 animate-in fade-in zoom-in-95"
      >
        <div className="flex items-center justify-between border-b pb-2">
          <div className="flex items-center gap-1.5 text-indigo-700">
            <Calculator className="w-4 h-4" />
            <h4 className="font-bold text-sm tracking-tight">MRP &amp; Margin Calculator</h4>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="p-1 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Tab Selector */}
        <div className="grid grid-cols-3 gap-1 p-1 bg-gray-100 rounded-xl text-[11px] font-bold text-gray-600">
          <button
            type="button"
            onClick={() => setActiveTab('discount')}
            className={`py-1.5 rounded-lg transition-all ${
              activeTab === 'discount'
                ? 'bg-white text-indigo-700 shadow-2xs'
                : 'hover:text-gray-900'
            }`}
          >
            MRP &rarr; %
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('margin')}
            className={`py-1.5 rounded-lg transition-all ${
              activeTab === 'margin'
                ? 'bg-white text-indigo-700 shadow-2xs'
                : 'hover:text-gray-900'
            }`}
          >
            P.Cost Margin
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('target')}
            className={`py-1.5 rounded-lg transition-all ${
              activeTab === 'target'
                ? 'bg-white text-indigo-700 shadow-2xs'
                : 'hover:text-gray-900'
            }`}
          >
            Target Rate
          </button>
        </div>

        {/* Tab 1: MRP - Discount % */}
        {activeTab === 'discount' && (
          <div className="space-y-3 pt-1">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-[11px] text-gray-500 font-semibold">MRP (₹)</Label>
                <Input
                  type="number"
                  placeholder="e.g. 100"
                  value={mrpInput}
                  onChange={(e) => setMrpInput(e.target.value)}
                  className="h-8 text-xs rounded-lg mt-1"
                />
              </div>
              <div>
                <Label className="text-[11px] text-gray-500 font-semibold">Discount %</Label>
                <div className="relative mt-1">
                  <Input
                    type="number"
                    placeholder="e.g. 15"
                    value={discountPercent}
                    onChange={(e) => setDiscountPercent(e.target.value)}
                    className="h-8 text-xs rounded-lg pr-6"
                  />
                  <Percent className="w-3 h-3 text-gray-400 absolute right-2 top-2.5" />
                </div>
              </div>
            </div>

            {/* Quick % Chips */}
            <div className="flex items-center gap-1.5 flex-wrap">
              {[5, 10, 15, 18, 20, 25, 30].map((pct) => (
                <button
                  key={pct}
                  type="button"
                  onClick={() => setDiscountPercent(pct)}
                  className={`px-2 py-0.5 rounded-md text-[10px] font-bold border transition-all ${
                    Number(discountPercent) === pct
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
                  }`}
                >
                  {pct}%
                </button>
              ))}
            </div>

            <div className="p-2.5 rounded-xl bg-indigo-50/70 border border-indigo-100 flex items-center justify-between text-xs">
              <div>
                <span className="text-[10px] text-indigo-600 uppercase font-bold block">
                  Net Selling Price
                </span>
                <p className="font-mono font-black text-sm text-indigo-950">
                  ₹{calculatedPriceFromDiscount.toFixed(2)}
                </p>
                <span className="text-[10px] text-gray-500">
                  Saves ₹{discountSavings.toFixed(2)}
                </span>
              </div>
              {onApplyPrice && (
                <Button
                  size="sm"
                  onClick={() => handleApply(calculatedPriceFromDiscount)}
                  disabled={calculatedPriceFromDiscount <= 0}
                  className="h-7 text-xs bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold"
                >
                  <Check className="w-3 h-3 mr-1" /> Apply
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Tab 2: Margin from Price and P.Cost */}
        {activeTab === 'margin' && (
          <div className="space-y-3 pt-1">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-[11px] text-gray-500 font-semibold">Selling Price (₹)</Label>
                <Input
                  type="number"
                  placeholder="e.g. 50"
                  value={salePriceInput}
                  onChange={(e) => setSalePriceInput(e.target.value)}
                  className="h-8 text-xs rounded-lg mt-1"
                />
              </div>
              <div>
                <Label className="text-[11px] text-gray-500 font-semibold">P.Cost (₹)</Label>
                <Input
                  type="number"
                  placeholder="e.g. 35"
                  value={pCostInput}
                  onChange={(e) => setPCostInput(e.target.value)}
                  className="h-8 text-xs rounded-lg mt-1"
                />
              </div>
            </div>

            <div className="p-2.5 rounded-xl bg-emerald-50/70 border border-emerald-100 flex items-center justify-between text-xs">
              <div>
                <span className="text-[10px] text-emerald-700 uppercase font-bold block">
                  Gross Profit &amp; Margin
                </span>
                <div className="flex items-baseline gap-2">
                  <p className="font-mono font-black text-sm text-emerald-950">
                    ₹{grossProfit.toFixed(2)}
                  </p>
                  <span
                    className={`text-[11px] font-black px-1.5 py-0.2 rounded-full ${
                      grossMarginPct >= 20
                        ? 'bg-emerald-200 text-emerald-800'
                        : grossMarginPct >= 10
                        ? 'bg-amber-200 text-amber-800'
                        : 'bg-red-200 text-red-800'
                    }`}
                  >
                    {grossMarginPct.toFixed(1)}%
                  </span>
                </div>
                <span className="text-[10px] text-gray-500">
                  {grossMarginPct >= 20 ? 'Strong margin' : grossMarginPct >= 10 ? 'Healthy' : 'Slim margin'}
                </span>
              </div>
              {onApplyPrice && (
                <Button
                  size="sm"
                  onClick={() => handleApply(saleNum, costNum)}
                  disabled={saleNum <= 0}
                  className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold"
                >
                  <Check className="w-3 h-3 mr-1" /> Apply
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Tab 3: Target Margin % -> Recommended Selling Price */}
        {activeTab === 'target' && (
          <div className="space-y-3 pt-1">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-[11px] text-gray-500 font-semibold">P.Cost (₹)</Label>
                <Input
                  type="number"
                  placeholder="e.g. 40"
                  value={targetCostInput}
                  onChange={(e) => setTargetCostInput(e.target.value)}
                  className="h-8 text-xs rounded-lg mt-1"
                />
              </div>
              <div>
                <Label className="text-[11px] text-gray-500 font-semibold">Desired Margin %</Label>
                <div className="relative mt-1">
                  <Input
                    type="number"
                    placeholder="e.g. 25"
                    value={targetMarginPercent}
                    onChange={(e) => setTargetMarginPercent(e.target.value)}
                    className="h-8 text-xs rounded-lg pr-6"
                  />
                  <Percent className="w-3 h-3 text-gray-400 absolute right-2 top-2.5" />
                </div>
              </div>
            </div>

            <div className="p-2.5 rounded-xl bg-purple-50/70 border border-purple-100 flex items-center justify-between text-xs">
              <div>
                <span className="text-[10px] text-purple-700 uppercase font-bold block">
                  Recommended Selling Price
                </span>
                <p className="font-mono font-black text-sm text-purple-950">
                  ₹{recommendedSalePrice.toFixed(2)}
                </p>
                <span className="text-[10px] text-gray-500">
                  Yields ₹{(recommendedSalePrice - tCostNum).toFixed(2)} profit
                </span>
              </div>
              {onApplyPrice && (
                <Button
                  size="sm"
                  onClick={() => handleApply(recommendedSalePrice, tCostNum)}
                  disabled={recommendedSalePrice <= 0}
                  className="h-7 text-xs bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-bold"
                >
                  <Check className="w-3 h-3 mr-1" /> Apply
                </Button>
              )}
            </div>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
