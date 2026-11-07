'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Wallet,
  Plus,
  Send,
  AlertTriangle,
  CheckCircle2,
  Clock,
  History,
  TrendingDown,
  Sparkles,
  ShieldCheck,
  RefreshCw,
  Coins,
  Settings2,
  ExternalLink,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  TuckshopSiteFloat,
  subscribeToSiteFloat,
  addFloatTopUp,
  requestFloatTopUp,
  updateOpeningFloat,
  computeFloatBalance,
  createDefaultFloat,
} from '@/services/tuckshopFloatService';
import { NewRelicTuckshopRecord } from '@/services/newrelicTuckshopService';
import { triggerHaptic } from '@/lib/haptics';
import { COMPANY_SITES, SiteId } from '@/types/site';
import { formatOrdinalDate } from '@/services/hungerboxParser';
import { useAuth } from '@/contexts/AuthContext';

interface Props {
  siteId: string;
  records: NewRelicTuckshopRecord[];
  isAdmin?: boolean;
  compact?: boolean;
}

export function PettyCashFloatWidget({
  siteId,
  records,
  isAdmin = false,
  compact = false,
}: Props) {
  const { user } = useAuth();
  const [floatData, setFloatData] = useState<TuckshopSiteFloat>(() =>
    createDefaultFloat(siteId as SiteId)
  );
  const [isLoading, setIsLoading] = useState(true);

  // Modals state
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
  const [isAddAdvanceModalOpen, setIsAddAdvanceModalOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);

  // Form states
  const [reqAmount, setReqAmount] = useState<string>('2000');
  const [reqReason, setReqReason] = useState<string>('Morning bread, fresh veggies & milk');
  const [isSubmittingReq, setIsSubmittingReq] = useState(false);

  const [advAmount, setAdvAmount] = useState<string>('3000');
  const [advMode, setAdvMode] = useState<'cash' | 'upi'>('upi');
  const [advNote, setAdvNote] = useState<string>('Petty cash replenishment via UPI');
  const [isSubmittingAdv, setIsSubmittingAdv] = useState(false);

  const [newOpeningFloat, setNewOpeningFloat] = useState<string>('5000');

  // Real-time subscription to float document for this site
  useEffect(() => {
    setIsLoading(true);
    const unsub = subscribeToSiteFloat(siteId, (data) => {
      setFloatData(data);
      setNewOpeningFloat(String(data.openingFloat || 5000));
      setIsLoading(false);
    });
    return () => unsub();
  }, [siteId]);

  // Compute live balance
  const balance = useMemo(() => {
    // Filter records belonging to this site
    const siteExpenses = records.filter(
      (r) => (r.siteId || 'newrelic') === siteId && r.type === 'expense'
    );
    return computeFloatBalance(floatData, siteExpenses);
  }, [floatData, records, siteId]);

  // Handle Staff Top-Up Request
  const handleSendRequest = async () => {
    const amt = parseFloat(reqAmount);
    if (isNaN(amt) || amt <= 0) {
      alert('Please enter a valid request amount');
      return;
    }
    triggerHaptic('medium');
    setIsSubmittingReq(true);
    try {
      await requestFloatTopUp(siteId, {
        amount: amt,
        reason: reqReason,
        userEmail: user?.email,
      });
      setIsRequestModalOpen(false);
      alert(`Float top-up request for ₹${amt.toLocaleString('en-IN')} submitted successfully!`);
    } catch (e: any) {
      alert(e.message || 'Could not submit float request');
    } finally {
      setIsSubmittingReq(false);
    }
  };

  // Handle Admin Advance Top-Up
  const handleAddAdvance = async () => {
    const amt = parseFloat(advAmount);
    if (isNaN(amt) || amt <= 0) {
      alert('Please enter a valid advance amount');
      return;
    }
    triggerHaptic('medium');
    setIsSubmittingAdv(true);
    try {
      await addFloatTopUp(siteId, {
        amount: amt,
        mode: advMode,
        note: advNote,
        userEmail: user?.email,
      });
      setIsAddAdvanceModalOpen(false);
    } catch (e: any) {
      alert(e.message || 'Could not record advance');
    } finally {
      setIsSubmittingAdv(false);
    }
  };

  // Handle Update Opening Float
  const handleSaveOpeningFloat = async () => {
    const amt = parseFloat(newOpeningFloat);
    if (isNaN(amt) || amt < 0) return;
    try {
      await updateOpeningFloat(siteId, amt, user?.email);
      setIsSettingsModalOpen(false);
    } catch (e: any) {
      alert(e.message || 'Could not update float setting');
    }
  };

  const statusColor =
    balance.status === 'optimal'
      ? 'text-emerald-700 bg-emerald-50 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300'
      : balance.status === 'warning'
      ? 'text-amber-700 bg-amber-50 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300'
      : 'text-rose-700 bg-rose-50 border-rose-300 dark:bg-rose-950/40 dark:text-rose-300';

  const siteName = COMPANY_SITES[siteId as SiteId]?.name || siteId;

  if (compact) {
    return (
      <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Wallet className="w-4 h-4 text-indigo-600" />
            <span className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">
              Petty Cash Float
            </span>
          </div>
          <Badge variant="outline" className={`text-[10px] font-bold ${statusColor}`}>
            {balance.statusText}
          </Badge>
        </div>

        <div className="flex items-baseline justify-between">
          <div>
            <span className="text-2xl font-black font-mono text-slate-900 dark:text-white">
              ₹{balance.remainingFloat.toLocaleString('en-IN')}
            </span>
            <span className="text-[11px] text-slate-400 ml-1.5 font-medium">available</span>
          </div>
          <Button
            size="sm"
            onClick={() => {
              triggerHaptic('light');
              setIsRequestModalOpen(true);
            }}
            className="h-7 text-[11px] font-bold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white"
          >
            <Send className="w-3 h-3 mr-1" /> Top-Up
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-5 sm:p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-4">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-300/40 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0 shadow-md">
            <Coins className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-black text-slate-900 dark:text-white">
                Petty Cash Float &amp; Supplier Payout Tracker
              </h3>
              <Badge
                variant="outline"
                className="text-[10px] font-bold bg-amber-50 text-amber-900 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300"
              >
                ⚡ 100% Cashless App Sales
              </Badge>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Because all customer orders are cashless HungerBox payments, physical expenses rely on this company cash float.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button
            onClick={() => {
              triggerHaptic('light');
              setIsRequestModalOpen(true);
            }}
            className="h-9 px-3.5 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-slate-950 font-black text-xs shadow-md shadow-amber-950/20 active:scale-95"
          >
            <Send className="w-3 h-3 mr-1.5" />
            Request Float Top-Up
          </Button>

          {isAdmin && (
            <Button
              onClick={() => {
                triggerHaptic('light');
                setIsAddAdvanceModalOpen(true);
              }}
              className="h-9 px-3.5 rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-bold text-xs shadow-md shadow-indigo-950/20 active:scale-95"
            >
              <Plus className="w-3 h-3 mr-1.5" />
              Add Float Advance
            </Button>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              triggerHaptic('light');
              setIsHistoryModalOpen(true);
            }}
            className="h-9 px-3 rounded-2xl border-slate-200 dark:border-slate-700 text-xs font-bold"
          >
            <History className="w-3 h-3 mr-1 text-slate-400" />
            History
          </Button>

          {isAdmin && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsSettingsModalOpen(true)}
              className="h-9 w-9 rounded-2xl text-slate-400 hover:text-slate-900 dark:hover:text-white"
              title="Configure Base Opening Float"
            >
              <Settings2 className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Main Float Balance Cards Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* 1. Remaining Cash Float (Hero) */}
        <div className="p-4 rounded-2xl bg-gradient-to-br from-indigo-50/80 via-white to-purple-50/40 dark:from-indigo-950/40 dark:via-slate-900 dark:to-purple-950/20 border-2 border-indigo-400/80 shadow-md col-span-2 sm:col-span-1">
          <span className="text-[10px] font-black uppercase tracking-wider text-indigo-700 dark:text-indigo-300 block mb-1">
            Cash Float Remaining
          </span>
          <p className="text-2xl font-mono font-black text-slate-950 dark:text-white tracking-tight">
            ₹{balance.remainingFloat.toLocaleString('en-IN')}
          </p>
          <div className="flex items-center justify-between text-[10px] text-indigo-700 dark:text-indigo-400 font-bold mt-2 pt-2 border-t border-indigo-200/60 dark:border-indigo-900/60">
            <span>{balance.remainingPercentage}% left</span>
            <span>{balance.status === 'optimal' ? '🟢 Safe' : balance.status === 'warning' ? '🟡 Low' : '🔴 Critical'}</span>
          </div>
        </div>

        {/* 2. Opening Float Advance */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col justify-between">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
              Opening Float Advance
            </span>
            <p className="text-xl font-mono font-bold text-slate-900 dark:text-white">
              ₹{balance.openingFloat.toLocaleString('en-IN')}
            </p>
          </div>
          <span className="text-[10px] text-slate-400 mt-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            Monthly base cash advance
          </span>
        </div>

        {/* 3. Mid-Month Top-Ups */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col justify-between">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
              Top-Ups Added (+)
            </span>
            <p className="text-xl font-mono font-bold text-indigo-600 dark:text-indigo-400">
              +₹{balance.totalTopUps.toLocaleString('en-IN')}
            </p>
          </div>
          <span className="text-[10px] text-slate-400 mt-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            {floatData.topUps.length} replenishments logged
          </span>
        </div>

        {/* 4. Total Supplies Expenses Deducted */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col justify-between">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
              Supplies Spent (-)
            </span>
            <p className="text-xl font-mono font-bold text-rose-600 dark:text-rose-400">
              -₹{balance.totalSpent.toLocaleString('en-IN')}
            </p>
          </div>
          <span className="text-[10px] text-rose-600/80 font-bold mt-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            Morning raw materials &amp; supplies
          </span>
        </div>
      </div>

      {/* Visual Float Health Bar */}
      <div className="space-y-1.5 p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700">
        <div className="flex items-center justify-between text-xs">
          <span className="font-bold text-slate-700 dark:text-slate-300">
            Float Drawdown:
          </span>
          <span className="font-mono text-[11px] text-slate-500">
            ₹{balance.remainingFloat.toLocaleString('en-IN')} remaining of ₹{balance.totalAdvanceAvailable.toLocaleString('en-IN')} advance
          </span>
        </div>

        <div className="w-full bg-slate-200 dark:bg-slate-700 h-3 rounded-full overflow-hidden flex">
          <div
            className={`h-full transition-all duration-500 ${
              balance.status === 'optimal'
                ? 'bg-emerald-500'
                : balance.status === 'warning'
                ? 'bg-amber-500'
                : 'bg-rose-600'
            }`}
            style={{ width: `${Math.min(100, Math.max(0, balance.remainingPercentage))}%` }}
          />
        </div>

        <div className="flex items-center justify-between text-[10px] text-slate-400">
          <span>0% Depleted</span>
          <span className="font-bold">{balance.statusText}</span>
          <span>100% Full Float</span>
        </div>
      </div>

      {/* DIALOG 1: STAFF TOP-UP REQUEST */}
      <Dialog open={isRequestModalOpen} onOpenChange={setIsRequestModalOpen}>
        <DialogContent className="sm:max-w-[440px] rounded-3xl p-6 bg-white dark:bg-slate-900">
          <DialogHeader>
            <DialogTitle className="text-base font-black flex items-center gap-2">
              <Send className="w-5 h-5 text-indigo-600" />
              Request Petty Cash Float Top-Up
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 pt-2 text-xs">
            <p className="text-slate-500">
              Submit an emergency float replenishment request for <strong>{siteName}</strong>.
            </p>

            <div className="space-y-1.5">
              <label className="font-bold text-slate-700 dark:text-slate-300">
                Quick Select Amount:
              </label>
              <div className="grid grid-cols-4 gap-2">
                {['1000', '2000', '3000', '5000'].map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => {
                      triggerHaptic('light');
                      setReqAmount(amt);
                    }}
                    className={`py-2 rounded-xl font-bold font-mono text-xs border transition-all ${
                      reqAmount === amt
                        ? 'border-indigo-600 bg-indigo-50 text-indigo-900 ring-2 ring-indigo-600/60 shadow-xs'
                        : 'border-slate-200 dark:border-slate-700 hover:border-slate-300'
                    }`}
                  >
                    ₹{Number(amt).toLocaleString('en-IN')}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="font-bold text-slate-700 dark:text-slate-300">
                Custom Amount (₹):
              </label>
              <Input
                type="number"
                value={reqAmount}
                onChange={(e) => setReqAmount(e.target.value)}
                placeholder="e.g. 2500"
                className="h-10 rounded-xl font-mono text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <label className="font-bold text-slate-700 dark:text-slate-300">
                Reason / Required Supplies:
              </label>
              <Input
                value={reqReason}
                onChange={(e) => setReqReason(e.target.value)}
                placeholder="e.g. Morning milk, vegetables, gas cylinder"
                className="h-10 rounded-xl"
              />
            </div>

            <div className="pt-2 flex items-center justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setIsRequestModalOpen(false)}
                className="rounded-xl text-xs font-bold"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSendRequest}
                disabled={isSubmittingReq}
                className="rounded-xl text-xs font-black bg-indigo-600 hover:bg-indigo-700 text-white"
              >
                {isSubmittingReq ? 'Submitting...' : 'Send Request'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* DIALOG 2: ADMIN ADD ADVANCE / REPLENISHMENT */}
      <Dialog open={isAddAdvanceModalOpen} onOpenChange={setIsAddAdvanceModalOpen}>
        <DialogContent className="sm:max-w-[440px] rounded-3xl p-6 bg-white dark:bg-slate-900">
          <DialogHeader>
            <DialogTitle className="text-base font-black flex items-center gap-2">
              <Plus className="w-5 h-5 text-emerald-600" />
              Add Float Advance to Counter
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 pt-2 text-xs">
            <p className="text-slate-500">
              Record cash or UPI advance given to <strong>{siteName}</strong> counter staff.
            </p>

            <div className="space-y-1.5">
              <label className="font-bold text-slate-700 dark:text-slate-300">
                Amount Handed Over (₹):
              </label>
              <Input
                type="number"
                value={advAmount}
                onChange={(e) => setAdvAmount(e.target.value)}
                placeholder="e.g. 3000"
                className="h-10 rounded-xl font-mono text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <label className="font-bold text-slate-700 dark:text-slate-300">
                Transfer Mode:
              </label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: 'upi', label: '📱 UPI Transfer' },
                  { id: 'cash', label: '💵 Physical Cash' },
                ].map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setAdvMode(m.id as any)}
                    className={`py-2 rounded-xl font-bold text-xs border transition-all ${
                      advMode === m.id
                        ? 'border-indigo-600 bg-indigo-50 text-indigo-900 ring-2 ring-indigo-600/60 shadow-xs'
                        : 'border-slate-200 dark:border-slate-700 hover:border-slate-300'
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="font-bold text-slate-700 dark:text-slate-300">
                Note / Description:
              </label>
              <Input
                value={advNote}
                onChange={(e) => setAdvNote(e.target.value)}
                placeholder="e.g. Replenishment via PhonePe to Ramesh"
                className="h-10 rounded-xl"
              />
            </div>

            <div className="pt-2 flex items-center justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setIsAddAdvanceModalOpen(false)}
                className="rounded-xl text-xs font-bold"
              >
                Cancel
              </Button>
              <Button
                onClick={handleAddAdvance}
                disabled={isSubmittingAdv}
                className="rounded-xl text-xs font-black bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                {isSubmittingAdv ? 'Recording...' : 'Record Advance'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* DIALOG 3: FLOAT HISTORY */}
      <Dialog open={isHistoryModalOpen} onOpenChange={setIsHistoryModalOpen}>
        <DialogContent className="sm:max-w-[500px] rounded-3xl p-6 bg-white dark:bg-slate-900 max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base font-black flex items-center gap-2">
              <History className="w-5 h-5 text-indigo-600" />
              Petty Cash Float Audit History
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 pt-2 text-xs">
            {/* Top-Ups List */}
            <div>
              <h4 className="font-bold text-slate-900 dark:text-white uppercase tracking-wider text-[11px] mb-2">
                Recent Advances &amp; Top-Ups:
              </h4>
              {floatData.topUps.length === 0 ? (
                <p className="text-slate-400 py-2 border border-dashed rounded-xl text-center">
                  No top-ups recorded in this cycle.
                </p>
              ) : (
                <div className="space-y-2">
                  {floatData.topUps.map((t) => (
                    <div
                      key={t.id}
                      className="p-3 rounded-2xl bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-200/60 dark:border-indigo-900/60 flex items-center justify-between"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-black text-indigo-950 dark:text-indigo-200">
                            +₹{t.amount.toLocaleString('en-IN')}
                          </span>
                          <Badge variant="outline" className="text-[9px] uppercase font-bold">
                            {t.mode}
                          </Badge>
                        </div>
                        <span className="text-[11px] text-slate-500 block mt-0.5">{t.note}</span>
                      </div>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {formatOrdinalDate(t.date)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Requests List */}
            {floatData.requests.length > 0 && (
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                <h4 className="font-bold text-slate-900 dark:text-white uppercase tracking-wider text-[11px] mb-2">
                  Staff Top-Up Requests:
                </h4>
                <div className="space-y-2">
                  {floatData.requests.map((r) => (
                    <div
                      key={r.id}
                      className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700 flex items-center justify-between"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-black text-slate-900 dark:text-white">
                            ₹{r.amount.toLocaleString('en-IN')}
                          </span>
                          <Badge
                            className={`text-[9px] font-bold ${
                              r.status === 'pending'
                                ? 'bg-amber-500 text-white'
                                : r.status === 'approved'
                                ? 'bg-emerald-600 text-white'
                                : 'bg-slate-400 text-white'
                            }`}
                          >
                            {r.status}
                          </Badge>
                        </div>
                        <span className="text-[11px] text-slate-500 block mt-0.5">{r.reason}</span>
                      </div>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {formatOrdinalDate(r.date)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* DIALOG 4: SETTINGS / OPENING FLOAT */}
      <Dialog open={isSettingsModalOpen} onOpenChange={setIsSettingsModalOpen}>
        <DialogContent className="sm:max-w-[400px] rounded-3xl p-6 bg-white dark:bg-slate-900">
          <DialogHeader>
            <DialogTitle className="text-base font-black flex items-center gap-2">
              <Settings2 className="w-5 h-5 text-indigo-600" />
              Configure Opening Float
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3.5 pt-2 text-xs">
            <p className="text-slate-500">
              Set the base opening advance for <strong>{siteName}</strong>.
            </p>
            <div className="space-y-1.5">
              <label className="font-bold text-slate-700 dark:text-slate-300">
                Opening Float (₹):
              </label>
              <Input
                type="number"
                value={newOpeningFloat}
                onChange={(e) => setNewOpeningFloat(e.target.value)}
                placeholder="5000"
                className="h-10 rounded-xl font-mono text-sm"
              />
            </div>
            <div className="pt-2 flex items-center justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setIsSettingsModalOpen(false)}
                className="rounded-xl text-xs font-bold"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSaveOpeningFloat}
                className="rounded-xl text-xs font-black bg-indigo-600 hover:bg-indigo-700 text-white"
              >
                Save Setting
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
