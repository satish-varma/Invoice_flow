'use client';

import React, { useState, useEffect } from 'react';
import {
  Send,
  Wallet,
  Building2,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Smartphone,
  Banknote,
  Receipt,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { triggerHaptic } from '@/lib/haptics';
import { useAuth } from '@/contexts/AuthContext';
import { getFloatScopeKey, getCounterDisplayName, resolveManagerPaymentDetails } from '@/services/tuckshopFloatService';

interface RequestAmountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  siteId?: string;
  location?: string;
  currentBalance?: number;
  onSuccess?: (amount: number) => void;
}

const QUICK_AMOUNTS = [1000, 2000, 3000, 5000];

const QUICK_REASONS = [
  'Morning bread, milk & curd',
  'Fresh vegetables & fruits',
  'Dosa batter & grocery supplies',
  'Gas cylinder refill',
  'Tea/Coffee supplies & disposable cups',
];

export function RequestAmountDialog({
  open,
  onOpenChange,
  siteId = 'newrelic',
  location,
  currentBalance,
  onSuccess,
}: RequestAmountDialogProps) {
  const { user } = useAuth();

  const isMultiSite = Boolean(
    (user?.assignedSites && user.assignedSites.length > 1) ||
    (user?.pettyCashSites && user.pettyCashSites.length > 1)
  );

  const unifiedCounterName = React.useMemo(() => {
    const rawSites = (user?.assignedSites && user.assignedSites.length > 1)
      ? user.assignedSites
      : (user?.pettyCashSites && user.pettyCashSites.length > 1)
      ? user.pettyCashSites
      : [];
    const names = rawSites.map((s) => getCounterDisplayName(s).replace(/\s*\(.*\)/, '').trim());
    return `Multi-Site Operations (${names.join(', ')})`;
  }, [user]);

  // Multi-counter resolution for users with multiple sites
  const availableCounters = React.useMemo(() => {
    const list: Array<{ scopeKey: string; name: string }> = [];

    if (isMultiSite) {
      const primaryScope = user?.assignedSites?.[0] || user?.pettyCashSites?.[0] || 'ntt_data';
      list.push({ scopeKey: primaryScope, name: unifiedCounterName });
      return list;
    }

    if (user?.pettyCashSites && user.pettyCashSites.length > 0) {
      user.pettyCashSites.forEach((s) => {
        if (s === 'newrelic') {
          list.push({ scopeKey: 'newrelic_hyderabad', name: 'New Relic (Hyderabad)' });
          list.push({ scopeKey: 'newrelic_bangalore', name: 'New Relic (Bangalore)' });
        } else {
          list.push({ scopeKey: s, name: getCounterDisplayName(s) });
        }
      });
    } else if (user?.assignedSites && user.assignedSites.length > 1) {
      user.assignedSites.forEach((s) => {
        list.push({ scopeKey: s, name: getCounterDisplayName(s) });
      });
    } else {
      const defaultKey = getFloatScopeKey(siteId, location);
      list.push({ scopeKey: defaultKey, name: getCounterDisplayName(defaultKey) });
    }

    return list;
  }, [user, siteId, location, isMultiSite, unifiedCounterName]);

  const [selectedScope, setSelectedScope] = useState<string>(() => {
    return availableCounters[0]?.scopeKey || getFloatScopeKey(siteId, location);
  });

  useEffect(() => {
    if (availableCounters.length > 0 && !availableCounters.some((c) => c.scopeKey === selectedScope)) {
      setSelectedScope(availableCounters[0].scopeKey);
    }
  }, [availableCounters, selectedScope]);

  const [amount, setAmount] = useState<string>('2000');
  const [reason, setReason] = useState<string>('Morning bread, milk & curd');
  const [preferredMode, setPreferredMode] = useState<'upi' | 'bank_transfer'>('upi');
  const [payeeUpi, setPayeeUpi] = useState<string>('');
  const [managerInfo, setManagerInfo] = useState<{ name: string; phone: string; upiId: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    resolveManagerPaymentDetails({
      requestedByEmail: user?.email,
      requestedBy: (user as any)?.name || user?.email?.split('@')[0],
      siteId,
      location,
    }).then((res) => {
      setManagerInfo(res);
      if (res.upiId) {
        setPayeeUpi((prev) => prev || res.upiId);
      }
    });
  }, [open, user, siteId, location]);

  const selectedCounterObj = availableCounters.find((c) => c.scopeKey === selectedScope) || {
    scopeKey: selectedScope,
    name: getCounterDisplayName(selectedScope),
  };

  const handleSend = async () => {
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      alert('Please enter a valid request amount.');
      return;
    }

    triggerHaptic('heavy');
    setIsSubmitting(true);
    setSuccessMessage(null);

    try {
      const res = await fetch('/api/tuckshop/float', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'request',
          scopeKey: selectedScope,
          counterName: selectedCounterObj.name,
          location: selectedScope.includes('bangalore') ? 'Bangalore' : 'Hyderabad',
          amount: numAmount,
          reason: reason.trim() || 'Supplies purchase',
          preferredMode,
          payeeUpi: payeeUpi.trim() || managerInfo?.upiId || undefined,
          payeePhone: managerInfo?.phone || undefined,
          payeeName: managerInfo?.name || (user as any)?.name || user?.email?.split('@')[0] || undefined,
          currentBalance: currentBalance ?? 0,
        }),
      });

      const data = await res.json();
      if (data.success) {
        triggerHaptic('success');
        setSuccessMessage(`✅ Request for ₹${numAmount.toLocaleString('en-IN')} submitted successfully! WhatsApp notification sent to Admin.`);
        if (onSuccess) onSuccess(numAmount);
        setTimeout(() => {
          onOpenChange(false);
          setSuccessMessage(null);
        }, 1800);
      } else {
        alert(data.error || 'Failed to submit request');
      }
    } catch (e: any) {
      alert(e.message || 'Error sending request');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full sm:max-w-[480px] rounded-3xl p-5 sm:p-6 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-2xl">
        <DialogHeader className="space-y-1">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 text-slate-950 flex items-center justify-center font-bold shadow-md shadow-amber-950/20">
                <Send className="w-5 h-5 fill-slate-950" />
              </div>
              <div>
                <DialogTitle className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                  Request Amount
                </DialogTitle>
                <p className="text-[11px] text-slate-500 font-medium">
                  Petty Cash Float Top-Up for Tuckshop Purchases
                </p>
              </div>
            </div>
          </div>
        </DialogHeader>

        {successMessage ? (
          <div className="py-6 flex flex-col items-center justify-center text-center space-y-3">
            <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <p className="text-sm font-bold text-emerald-800 dark:text-emerald-300 px-4">
              {successMessage}
            </p>
          </div>
        ) : (
          <div className="space-y-4 pt-2 text-xs">
            {/* Multi-Counter Picker or Unified Info */}
            {isMultiSite ? (
              <div className="p-3 rounded-2xl bg-indigo-50/80 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800 space-y-1">
                <div className="flex items-center gap-1.5 font-bold text-indigo-950 dark:text-indigo-200 text-xs">
                  <Building2 className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Unified Multi-Site Float Advance</span>
                </div>
                <p className="text-[11px] text-slate-600 dark:text-slate-400">
                  This single advance covers all your assigned stalls ({(user?.assignedSites || user?.pettyCashSites || [])
                    .map((s) => getCounterDisplayName(s).replace(/\s*\(.*\)/, ''))
                    .join(', ')}). When you spend, record expenses against the specific stall.
                </p>
              </div>
            ) : availableCounters.length > 1 ? (
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-indigo-600" /> Counter Destination:
                </label>
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                  {availableCounters.map((c) => (
                    <button
                      key={c.scopeKey}
                      type="button"
                      onClick={() => {
                        triggerHaptic('light');
                        setSelectedScope(c.scopeKey);
                      }}
                      className={`px-3 py-1.5 rounded-xl font-bold text-xs transition-all whitespace-nowrap ${
                        selectedScope === c.scopeKey
                          ? 'bg-indigo-600 text-white shadow-xs'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
                      }`}
                    >
                      {c.name}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            {/* Notification Banner */}
            <div className="p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-800/60 text-slate-700 dark:text-slate-300 flex items-start gap-2.5">
              <span className="text-base shrink-0 mt-0.5">⚡</span>
              <div>
                <p className="font-bold text-amber-900 dark:text-amber-200">
                  Instant WhatsApp Alert Delivered to Admin
                </p>
                <p className="text-[11px] text-amber-800/80 dark:text-amber-300/80 mt-0.5 leading-relaxed">
                  Submitting this alerts Admin (+91 77096 32898) directly on WhatsApp for quick UPI transfer or cash replenishment.
                </p>
              </div>
            </div>

            {/* Quick Amount Selector */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  Select Amount (₹):
                </label>
                {currentBalance !== undefined && (
                  <span className="text-[11px] font-mono text-slate-500">
                    Drawer: ₹{currentBalance.toLocaleString('en-IN')}
                  </span>
                )}
              </div>
              <div className="grid grid-cols-4 gap-2">
                {QUICK_AMOUNTS.map((amt) => {
                  const isSelected = amount === String(amt);
                  return (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => {
                        triggerHaptic('light');
                        setAmount(String(amt));
                      }}
                      className={`py-2 rounded-2xl font-black font-mono text-xs border transition-all ${
                        isSelected
                          ? 'border-amber-500 bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200 ring-2 ring-amber-500/50 shadow-xs'
                          : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-slate-300'
                      }`}
                    >
                      ₹{amt.toLocaleString('en-IN')}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Custom Amount Input */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                Or Enter Custom Amount (₹):
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold font-mono text-sm">
                  ₹
                </span>
                <Input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="e.g. 2500"
                  className="pl-8 h-10 rounded-2xl font-mono text-sm font-bold"
                />
              </div>
            </div>

            {/* Preferred Payment Mode */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                Preferred Handover Mode:
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic('light');
                    setPreferredMode('upi');
                  }}
                  className={`py-2.5 px-3 rounded-2xl font-bold text-xs border flex items-center justify-center gap-2 transition-all ${
                    preferredMode === 'upi'
                      ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-950 dark:text-indigo-200 ring-2 ring-indigo-600/50 shadow-xs'
                      : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-slate-300'
                  }`}
                >
                  <Smartphone className="w-4 h-4 text-indigo-600" />
                  <span>PhonePe / UPI</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic('light');
                    setPreferredMode('bank_transfer');
                  }}
                  className={`py-2.5 px-3 rounded-2xl font-bold text-xs border flex items-center justify-center gap-2 transition-all ${
                    preferredMode === 'bank_transfer'
                      ? 'border-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-950 dark:text-emerald-200 ring-2 ring-emerald-600/50 shadow-xs'
                      : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-slate-300'
                  }`}
                >
                  <Banknote className="w-4 h-4 text-emerald-600" />
                  <span>HDFC NetBanking</span>
                </button>
              </div>

              {/* UPI ID / Mobile Input */}
              {preferredMode === 'upi' ? (
                <div className="pt-1.5 space-y-1">
                  <Input
                    value={payeeUpi}
                    onChange={(e) => setPayeeUpi(e.target.value)}
                    placeholder="Enter your PhonePe Mobile No or UPI ID (e.g. 9876543210@ybl)"
                    className="h-9 rounded-xl text-xs font-mono"
                  />
                  {managerInfo?.phone && (
                    <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
                      ✓ Auto-detected PhonePe: <strong>+91 {managerInfo.phone}</strong> from employee directory
                    </p>
                  )}
                </div>
              ) : (
                <div className="pt-1.5">
                  <Input
                    value={payeeUpi}
                    onChange={(e) => setPayeeUpi(e.target.value)}
                    placeholder="Enter HDFC Account No &amp; IFSC"
                    className="h-9 rounded-xl text-xs font-mono"
                  />
                </div>
              )}
            </div>

            {/* Reason / Supplies */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                Reason / Required Supplies:
              </label>
              <div className="flex flex-wrap gap-1.5 mb-1.5">
                {QUICK_REASONS.map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => {
                      triggerHaptic('light');
                      setReason(r);
                    }}
                    className={`text-[10px] px-2.5 py-1 rounded-xl font-bold transition-all ${
                      reason === r
                        ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-950'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
              <Input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Morning supplies & bread"
                className="h-10 rounded-2xl text-xs"
              />
            </div>

            {/* Actions */}
            <div className="pt-2 flex items-center justify-end gap-2">
              <Button
                variant="outline"
                type="button"
                onClick={() => onOpenChange(false)}
                className="rounded-2xl text-xs font-bold px-4"
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleSend}
                disabled={isSubmitting}
                className="rounded-2xl text-xs font-black px-5 bg-gradient-to-r from-amber-500 via-amber-600 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-slate-950 shadow-md shadow-amber-950/20 active:scale-95 transition-all"
              >
                {isSubmitting ? (
                  'Notifying Admin...'
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5 mr-1.5 fill-slate-950" />
                    Request Amount (₹{Number(amount || 0).toLocaleString('en-IN')})
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
