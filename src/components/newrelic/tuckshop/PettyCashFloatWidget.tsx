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
  ChevronRight,
  ArrowDownLeft,
  ArrowUpRight,
  Receipt,
  Building2,
  User,
  Eye,
  Filter,
  Smartphone,
  ArrowRight,
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
  updateOpeningFloat,
  computeFloatBalance,
  createDefaultFloat,
  getFloatScopeKey,
  getCounterDisplayName,
  subscribeToAllPendingRequests,
  FloatRequestEntry,
} from '@/services/tuckshopFloatService';
import { NewRelicTuckshopRecord } from '@/services/newrelicTuckshopService';
import { triggerHaptic } from '@/lib/haptics';
import { formatOrdinalDate } from '@/services/hungerboxParser';
import { useAuth } from '@/contexts/AuthContext';
import { RequestAmountDialog } from './RequestAmountDialog';
import { AdminFloatApprovalDialog } from './AdminFloatApprovalModal';

interface Props {
  siteId: string;
  location?: string;
  records: NewRelicTuckshopRecord[];
  isAdmin?: boolean;
  compact?: boolean;
  onRequestAmount?: () => void;
}

export function PettyCashFloatWidget({
  siteId,
  location,
  records,
  isAdmin = false,
  compact = false,
  onRequestAmount,
}: Props) {
  const { user } = useAuth();

  const isMultiSiteManager = Boolean(
    !isAdmin && (
      (user?.assignedSites && user.assignedSites.length > 1) ||
      (user?.pettyCashSites && user.pettyCashSites.length > 1)
    )
  );

  const assignedSiteList = useMemo(() => {
    const list = (user?.assignedSites && user.assignedSites.length > 1)
      ? user.assignedSites
      : (user?.pettyCashSites && user.pettyCashSites.length > 1)
      ? user.pettyCashSites
      : [];
    return list.map((s) => String(s).toLowerCase());
  }, [user]);

  // Determine user available petty cash counters
  const userCounters = useMemo(() => {
    const list: Array<{ scopeKey: string; name: string }> = [];

    if (isMultiSiteManager) {
      const primaryScope = user?.assignedSites?.[0] || user?.pettyCashSites?.[0] || 'ntt_data';
      const siteNames = assignedSiteList
        .map((s) => getCounterDisplayName(s).replace(/\s*\(.*\)/, '').trim())
        .join(', ');
      list.push({ scopeKey: primaryScope, name: `Combined Float (${siteNames})` });
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
  }, [user, siteId, location, isMultiSiteManager, assignedSiteList]);

  const [activeScopeKey, setActiveScopeKey] = useState<string>(() => {
    return userCounters[0]?.scopeKey || getFloatScopeKey(siteId, location);
  });

  useEffect(() => {
    const key = getFloatScopeKey(siteId, location);
    if (!userCounters.some((c) => c.scopeKey === activeScopeKey)) {
      setActiveScopeKey(key);
    }
  }, [siteId, location, userCounters, activeScopeKey]);

  const [floatData, setFloatData] = useState<TuckshopSiteFloat>(() =>
    createDefaultFloat(activeScopeKey)
  );
  const [isLoading, setIsLoading] = useState(true);

  // Modals state
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
  const [isAddAdvanceModalOpen, setIsAddAdvanceModalOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [feedFilter, setFeedFilter] = useState<'all' | 'inflow' | 'outflow'>('all');

  // Advance form state
  const [advAmount, setAdvAmount] = useState<string>('3000');
  const [advMode, setAdvMode] = useState<'cash' | 'upi'>('upi');
  const [advNote, setAdvNote] = useState<string>('Petty cash replenishment');
  const [advTxRef, setAdvTxRef] = useState<string>('');
  const [isSubmittingAdv, setIsSubmittingAdv] = useState(false);

  const [newOpeningFloat, setNewOpeningFloat] = useState<string>('5000');

  // Pending Float Top-Up Requests (Live from tuckshop_float_requests)
  const [allPendingRequests, setAllPendingRequests] = useState<FloatRequestEntry[]>([]);
  const [selectedApprovalReq, setSelectedApprovalReq] = useState<FloatRequestEntry | null>(null);
  const [isApprovalModalOpen, setIsApprovalModalOpen] = useState(false);

  useEffect(() => {
    const unsub = subscribeToAllPendingRequests((items) => {
      setAllPendingRequests(items);
    });
    return () => unsub();
  }, []);

  const pendingRequestsToDisplay = useMemo(() => {
    if (isAdmin) return allPendingRequests;
    return allPendingRequests.filter(
      (r) => r.requestedByEmail === user?.email || r.floatKey === activeScopeKey
    );
  }, [allPendingRequests, isAdmin, user?.email, activeScopeKey]);

  // Real-time subscription to active float document
  useEffect(() => {
    setIsLoading(true);
    const unsub = subscribeToSiteFloat(activeScopeKey, (data) => {
      setFloatData(data);
      setNewOpeningFloat(String(data.openingFloat || 5000));
      setIsLoading(false);
    });
    return () => unsub();
  }, [activeScopeKey]);

  // Compute live balance
  const balance = useMemo(() => {
    const locFilter = activeScopeKey.includes('bangalore')
      ? 'bangalore'
      : activeScopeKey.includes('hyderabad')
      ? 'hyderabad'
      : undefined;

    // Filter tuckshop expenses for this counter or across assigned sites if multi-site
    const counterExpenses = records.filter((r) => {
      if (r.type !== 'expense') return false;
      const rSite = (r.siteId || 'newrelic').toLowerCase();
      if (isMultiSiteManager && assignedSiteList.length > 0) {
        return assignedSiteList.includes(rSite);
      }
      if (activeScopeKey === 'newrelic_hyderabad' || activeScopeKey === 'newrelic_bangalore') {
        return rSite === 'newrelic';
      }
      return rSite === activeScopeKey;
    });

    const allowedSites = isMultiSiteManager && assignedSiteList.length > 0 ? assignedSiteList : undefined;
    return computeFloatBalance(floatData, counterExpenses, locFilter, allowedSites);
  }, [floatData, records, activeScopeKey, isMultiSiteManager, assignedSiteList]);

  // Combined Cashflow Timeline (Advances Inflow (+) and Purchase Outflows (-))
  const cashflowTimeline = useMemo(() => {
    const items: Array<{
      id: string;
      date: string;
      displayDate: string;
      type: 'inflow' | 'outflow';
      category: string;
      amount: number;
      note?: string;
      source: string;
      billUrl?: string;
    }> = [];

    // 1. Inflows from Top-Ups
    floatData.topUps.forEach((t) => {
      items.push({
        id: t.id,
        date: t.date,
        displayDate: formatOrdinalDate(t.date),
        type: 'inflow',
        category: `Advance (${t.mode.toUpperCase()})`,
        amount: t.amount,
        note: t.note || 'Petty cash replenishment',
        source: t.addedBy || 'Admin',
      });
    });

    // 2. Outflows from Tuckshop Purchases
    const cycleStart = floatData.currentCycleStart;
    records
      .filter((r) => {
        if (r.type !== 'expense') return false;
        const rSite = (r.siteId || 'newrelic').toLowerCase();
        if (activeScopeKey === 'newrelic_hyderabad' || activeScopeKey === 'newrelic_bangalore') {
          if (rSite !== 'newrelic') return false;
          if (activeScopeKey === 'newrelic_bangalore') {
            return (r.location || '').toLowerCase().includes('bangalore');
          } else {
            return !(r.location || '').toLowerCase().includes('bangalore');
          }
        }
        return rSite === activeScopeKey;
      })
      .filter((r) => (r.date || '') >= cycleStart)
      .forEach((r) => {
        items.push({
          id: r.id || `exp_${r.date}`,
          date: r.date,
          displayDate: formatOrdinalDate(r.date),
          type: 'outflow',
          category: r.category || 'Supplies',
          amount: Number(r.amount) || 0,
          note: r.description,
          source: r.createdBy || 'Staff',
          billUrl: r.billUrl,
        });
      });

    // Sort descending by date
    return items.sort((a, b) => b.date.localeCompare(a.date));
  }, [floatData, records, activeScopeKey]);

  const filteredTimeline = useMemo(() => {
    if (feedFilter === 'all') return cashflowTimeline;
    return cashflowTimeline.filter((t) => t.type === feedFilter);
  }, [cashflowTimeline, feedFilter]);

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
      await addFloatTopUp(activeScopeKey, {
        amount: amt,
        mode: advMode,
        note: advNote,
        transactionRef: advTxRef.trim() || undefined,
        userEmail: user?.email,
      });
      setIsAddAdvanceModalOpen(false);
      setAdvTxRef('');
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
      await updateOpeningFloat(activeScopeKey, amt, user?.email);
      setIsSettingsModalOpen(false);
    } catch (e: any) {
      alert(e.message || 'Could not update float setting');
    }
  };

  const statusBadge = useMemo(() => {
    if (balance.status === 'optimal') {
      return {
        label: '🟢 Healthy Float',
        bg: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
        barGradient: 'from-emerald-500 to-teal-400',
      };
    }
    if (balance.status === 'warning') {
      return {
        label: '🟡 Low Balance',
        bg: 'bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800',
        barGradient: 'from-amber-500 to-orange-400',
      };
    }
    return {
      label: '🔴 Critical Low',
      bg: 'bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300 border-rose-200 dark:border-rose-800',
      barGradient: 'from-rose-500 to-red-500',
    };
  }, [balance.status]);

  const triggerRequestModal = () => {
    triggerHaptic('light');
    if (onRequestAmount) {
      onRequestAmount();
    } else {
      setIsRequestModalOpen(true);
    }
  };

  if (compact) {
    return (
      <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Wallet className="w-4 h-4 text-indigo-600" />
            <span className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider truncate max-w-[150px]">
              {floatData.counterName}
            </span>
          </div>
          <Badge variant="outline" className={`text-[10px] font-bold ${statusBadge.bg}`}>
            {statusBadge.label}
          </Badge>
        </div>

        <div className="flex items-baseline justify-between">
          <div>
            <span className="text-2xl font-black font-mono text-slate-900 dark:text-white">
              ₹{balance.remainingFloat.toLocaleString('en-IN')}
            </span>
            <span className="text-[11px] text-slate-400 ml-1.5 font-medium">in drawer</span>
          </div>
          <Button
            size="sm"
            onClick={triggerRequestModal}
            className="h-7 text-[11px] font-bold rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950"
          >
            <Send className="w-3 h-3 mr-1" /> Request Amount
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-4 sm:space-y-5 transition-all">
      {/* 1. Header Bar with Counter Selector, Status & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800/80">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-500/10 via-purple-500/10 to-amber-500/10 border border-indigo-200/50 dark:border-indigo-800/50 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0 shadow-xs">
            <Wallet className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm sm:text-base font-black text-slate-900 dark:text-white tracking-tight">
                Petty Cash Float
              </h3>
              <Badge
                variant="outline"
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${statusBadge.bg}`}
              >
                {statusBadge.label} ({balance.remainingPercentage}% left)
              </Badge>
            </div>
            <p className="text-[11px] text-slate-400 font-medium mt-0.5">
              Live drawer cashflow for {floatData.counterName}
            </p>
          </div>
        </div>

        {/* Counter selection tabs (for multi-counter managers e.g. Swamy) */}
        {userCounters.length > 1 && (
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            {userCounters.map((c) => (
              <button
                key={c.scopeKey}
                type="button"
                onClick={() => {
                  triggerHaptic('light');
                  setActiveScopeKey(c.scopeKey);
                }}
                className={`px-2.5 py-1 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                  activeScopeKey === c.scopeKey
                    ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-xs'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                }`}
              >
                {c.name}
              </button>
            ))}
          </div>
        )}

        {/* Action Controls: History & Admin Controls */}
        <div className="flex items-center gap-2 self-start sm:self-center">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              triggerHaptic('light');
              setIsHistoryModalOpen(true);
            }}
            className="h-8 px-3 rounded-xl border-slate-200 dark:border-slate-700 text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            <History className="w-3.5 h-3.5 mr-1.5 text-slate-400" />
            Audit History ({cashflowTimeline.length})
          </Button>

          {isAdmin && (
            <>
              <Button
                size="sm"
                onClick={() => {
                  triggerHaptic('light');
                  setIsAddAdvanceModalOpen(true);
                }}
                className="h-8 px-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-bold text-xs shadow-xs"
              >
                <Plus className="w-3.5 h-3.5 mr-1" />
                Add Advance
              </Button>

              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsSettingsModalOpen(true)}
                className="h-8 w-8 rounded-xl text-slate-400 hover:text-slate-900 dark:hover:text-white"
                title="Configure Base Opening Float"
              >
                <Settings2 className="w-4 h-4" />
              </Button>
            </>
          )}
        </div>
      </div>

      {/* 1.5. Live Staff Float Top-Up Requests Alert Banner */}
      {pendingRequestsToDisplay.length > 0 && (
        <div className="p-4 rounded-3xl bg-gradient-to-r from-amber-500/15 via-orange-500/15 to-amber-600/10 border-2 border-amber-400/50 shadow-md space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center font-bold shadow-xs shrink-0">
                <Coins className="w-4 h-4 fill-slate-950" />
              </div>
              <div>
                <span className="font-black text-xs sm:text-sm text-slate-900 dark:text-white block">
                  {isAdmin
                    ? `${pendingRequestsToDisplay.length} Pending Float Top-Up ${pendingRequestsToDisplay.length === 1 ? 'Request' : 'Requests'} (₹${pendingRequestsToDisplay.reduce((s, r) => s + r.amount, 0).toLocaleString('en-IN')})`
                    : 'Your Pending Petty Cash Top-Up Request'}
                </span>
                <span className="text-[11px] text-amber-700 dark:text-amber-300 font-medium">
                  {isAdmin
                    ? 'Review and pay managers directly via PhonePe or HDFC NetBanking'
                    : 'Awaiting Admin review and payment transfer'}
                </span>
              </div>
            </div>
            {isAdmin && (
              <Badge className="bg-amber-500 text-slate-950 font-black text-[10px] animate-pulse shrink-0">
                Action Required
              </Badge>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {pendingRequestsToDisplay.map((req) => (
              <div
                key={req.id}
                className="p-3.5 rounded-2xl bg-white dark:bg-slate-800/90 border border-amber-200/80 dark:border-amber-800/80 shadow-xs flex flex-col justify-between space-y-2.5"
              >
                <div>
                  <div className="flex items-center justify-between gap-1.5">
                    <span className="font-bold text-xs text-slate-900 dark:text-white truncate">
                      {req.payeeName || req.requestedBy?.split('(')[0]?.trim()}
                    </span>
                    <Badge variant="outline" className="text-[9px] font-bold shrink-0 bg-slate-50 dark:bg-slate-900">
                      {req.counterName}
                    </Badge>
                  </div>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1 block mt-0.5">
                    {req.reason}
                  </span>
                  <div className="mt-1.5 flex items-baseline gap-1.5">
                    <span className="text-lg font-mono font-black text-indigo-600 dark:text-indigo-400">
                      ₹{req.amount.toLocaleString('en-IN')}
                    </span>
                    <span className="text-[10px] text-slate-400">
                      ({formatOrdinalDate(req.date)})
                    </span>
                  </div>
                </div>

                {isAdmin ? (
                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic('medium');
                      setSelectedApprovalReq(req);
                      setIsApprovalModalOpen(true);
                    }}
                    className="w-full py-2 px-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black text-xs flex items-center justify-center gap-1.5 shadow-sm active:scale-95 transition-all cursor-pointer"
                  >
                    <Smartphone className="w-3.5 h-3.5" />
                    <span>Pay ₹{req.amount.toLocaleString('en-IN')} (WhatsApp / UPI)</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                ) : (
                  <Badge variant="outline" className="w-fit text-amber-600 border-amber-300 font-bold text-[10px]">
                    ⏳ Awaiting Admin Approval
                  </Badge>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Admin Approval Dialog for widget direct pay */}
      <AdminFloatApprovalDialog
        request={selectedApprovalReq}
        open={isApprovalModalOpen}
        onOpenChange={setIsApprovalModalOpen}
      />

      {/* 2. Sleek Modern Wallet Display with Embedded Metrics */}
      <div className="rounded-2xl sm:rounded-3xl bg-gradient-to-br from-slate-900 via-[#1a1c2e] to-[#0f172a] text-white p-5 sm:p-6 shadow-xl relative overflow-hidden">
        {/* Ambient subtle glow decoration */}
        <div className="absolute -right-8 -top-8 w-40 h-40 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute right-24 -bottom-10 w-36 h-36 bg-amber-500/10 rounded-full blur-2xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          {/* Left: Main Drawer Balance & Gauge */}
          <div className="space-y-3 min-w-[240px]">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-wider text-indigo-300/90 bg-indigo-500/20 px-2 py-0.5 rounded-full border border-indigo-400/20">
                Available Cash in Drawer
              </span>
              <span className="text-[10px] font-mono text-slate-400">
                Cycle: {formatOrdinalDate(floatData.currentCycleStart)}
              </span>
            </div>

            <div className="flex items-baseline gap-2">
              <span className="text-3xl sm:text-4xl font-mono font-black tracking-tight text-white">
                ₹{balance.remainingFloat.toLocaleString('en-IN')}
              </span>
              <span className="text-xs text-slate-400 font-medium">
                / ₹{balance.totalAdvanceAvailable.toLocaleString('en-IN')} total float
              </span>
            </div>

            {/* Modern Slim Progress Gauge */}
            <div className="space-y-1.5 max-w-sm">
              <div className="w-full bg-white/10 h-2.5 rounded-full overflow-hidden flex shadow-inner">
                <div
                  className={`h-full rounded-full transition-all duration-700 bg-gradient-to-r ${statusBadge.barGradient}`}
                  style={{ width: `${Math.min(100, Math.max(0, balance.remainingPercentage))}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-[10px] text-slate-400 font-medium">
                <span>₹{balance.totalSpent.toLocaleString('en-IN')} spent</span>
                <span className="text-indigo-200 font-bold">{balance.remainingPercentage}% float available</span>
              </div>
            </div>
          </div>

          {/* Right: Clean Metric Pills */}
          <div className="grid grid-cols-3 gap-2.5 sm:gap-3 bg-white/5 border border-white/10 rounded-2xl p-3 sm:p-4 backdrop-blur-md">
            {/* Opening Advance */}
            <div className="space-y-0.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                Base Float
              </span>
              <span className="text-sm sm:text-base font-mono font-bold text-white">
                ₹{balance.openingFloat.toLocaleString('en-IN')}
              </span>
              <span className="text-[9px] text-slate-400 block">Opening limit</span>
            </div>

            {/* Replenishments / Top-Ups */}
            <div className="space-y-0.5 border-l border-white/10 pl-2.5 sm:pl-3">
              <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-300 block">
                Top-Ups
              </span>
              <span className="text-sm sm:text-base font-mono font-bold text-indigo-400">
                +₹{balance.totalTopUps.toLocaleString('en-IN')}
              </span>
              <span className="text-[9px] text-indigo-300/80 block">{floatData.topUps.length} advances</span>
            </div>

            {/* Deducted Expenses */}
            <div className="space-y-0.5 border-l border-white/10 pl-2.5 sm:pl-3">
              <span className="text-[10px] font-bold uppercase tracking-wider text-rose-300 block">
                Spent
              </span>
              <span className="text-sm sm:text-base font-mono font-bold text-rose-400">
                -₹{balance.totalSpent.toLocaleString('en-IN')}
              </span>
              <span className="text-[9px] text-rose-300/80 block">Auto-deducted</span>
            </div>
          </div>
        </div>
      </div>

      {/* 2.b Multi-Site Stall Breakdown (For Multi-Site Managers) */}
      {isMultiSiteManager && assignedSiteList.length > 1 && (
        <div className="p-3.5 sm:p-4 rounded-2xl sm:rounded-3xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 space-y-2.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-indigo-600" />
              Expense Breakdown Across Your Stalls:
            </span>
            <span className="font-mono text-[11px] font-bold text-slate-500">
              Total Spent: ₹{balance.totalSpent.toLocaleString('en-IN')}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {assignedSiteList.map((siteKey) => {
              const stallSpent = records
                .filter(
                  (r) =>
                    r.type === 'expense' &&
                    (r.siteId || 'newrelic').toLowerCase() === siteKey &&
                    (r.date || '') >= (floatData.currentCycleStart || '')
                )
                .reduce((sum, r) => sum + (Number(r.amount) || 0), 0);

              const stallCount = records.filter(
                (r) =>
                  r.type === 'expense' &&
                  (r.siteId || 'newrelic').toLowerCase() === siteKey &&
                  (r.date || '') >= (floatData.currentCycleStart || '')
              ).length;

              return (
                <div
                  key={siteKey}
                  className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 shadow-2xs flex flex-col justify-between"
                >
                  <span className="font-bold text-xs text-slate-900 dark:text-white truncate">
                    {getCounterDisplayName(siteKey).replace(/\s*\(.*\)/, '')}
                  </span>
                  <div className="mt-1 flex items-baseline justify-between">
                    <span className="font-mono font-black text-sm text-rose-600 dark:text-rose-400">
                      ₹{stallSpent.toLocaleString('en-IN')}
                    </span>
                    <span className="text-[10px] text-slate-400">
                      {stallCount} {stallCount === 1 ? 'bill' : 'bills'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 3. Live Cashflow Statement & Purchase Activity Ledger */}
      <div className="space-y-2.5 pt-1">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
              <Receipt className="w-3.5 h-3.5 text-indigo-600" />
              Recent Cashflow Activity
            </span>
            <span className="text-[10px] text-slate-400 font-medium">
              ({cashflowTimeline.length} transactions)
            </span>
          </div>

          {/* Activity filter toggle */}
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-0.5 rounded-xl text-[10px]">
            <button
              type="button"
              onClick={() => setFeedFilter('all')}
              className={`px-2 py-0.5 rounded-lg font-bold transition-all ${
                feedFilter === 'all'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              All
            </button>
            <button
              type="button"
              onClick={() => setFeedFilter('inflow')}
              className={`px-2 py-0.5 rounded-lg font-bold transition-all ${
                feedFilter === 'inflow'
                  ? 'bg-emerald-500 text-white shadow-xs'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              Top-Ups
            </button>
            <button
              type="button"
              onClick={() => setFeedFilter('outflow')}
              className={`px-2 py-0.5 rounded-lg font-bold transition-all ${
                feedFilter === 'outflow'
                  ? 'bg-rose-500 text-white shadow-xs'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              Expenses
            </button>
          </div>
        </div>

        {filteredTimeline.length === 0 ? (
          <div className="py-6 text-center rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 text-xs text-slate-400">
            No transactions found for this period.
          </div>
        ) : (
          <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
            {filteredTimeline.slice(0, 5).map((item) => (
              <div
                key={item.id}
                className="p-2.5 sm:p-3 rounded-2xl bg-slate-50/80 dark:bg-slate-800/40 hover:bg-slate-100 dark:hover:bg-slate-800/80 border border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between text-xs transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                      item.type === 'inflow'
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                        : 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300'
                    }`}
                  >
                    {item.type === 'inflow' ? (
                      <ArrowDownLeft className="w-4 h-4" />
                    ) : (
                      <ArrowUpRight className="w-4 h-4" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 dark:text-white">
                        {item.category}
                      </span>
                      {item.billUrl && (
                        <a
                          href={item.billUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[10px] text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-0.5 bg-indigo-50 dark:bg-indigo-950/40 px-1.5 py-0.5 rounded-md"
                        >
                          <Receipt className="w-2.5 h-2.5" /> Bill
                        </a>
                      )}
                    </div>
                    <span className="text-[10px] text-slate-400 block mt-0.5">
                      {item.displayDate} • {item.note || item.source}
                    </span>
                  </div>
                </div>

                <span
                  className={`font-mono font-black text-xs sm:text-sm ${
                    item.type === 'inflow' ? 'text-emerald-600' : 'text-rose-600'
                  }`}
                >
                  {item.type === 'inflow' ? '+' : '-'}₹{item.amount.toLocaleString('en-IN')}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Internal Request Modal (as fallback or directly opened) */}
      <RequestAmountDialog
        open={isRequestModalOpen}
        onOpenChange={setIsRequestModalOpen}
        siteId={siteId}
        location={location}
        currentBalance={balance.remainingFloat}
      />

      {/* DIALOG 2: ADMIN ADD ADVANCE / REPLENISHMENT */}
      <Dialog open={isAddAdvanceModalOpen} onOpenChange={setIsAddAdvanceModalOpen}>
        <DialogContent className="sm:max-w-[440px] rounded-3xl p-6 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-black flex items-center gap-2">
              <Plus className="w-5 h-5 text-emerald-600" />
              Add Float Advance to Counter
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 pt-2 text-xs">
            <p className="text-slate-500">
              Record cash or UPI advance given to <strong>{floatData.counterName}</strong> staff.
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
                className="h-10 rounded-2xl font-mono text-sm"
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
                UPI Reference / UTR Number (Optional):
              </label>
              <Input
                value={advTxRef}
                onChange={(e) => setAdvTxRef(e.target.value)}
                placeholder="e.g. 431092839201"
                className="h-10 rounded-2xl font-mono text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <label className="font-bold text-slate-700 dark:text-slate-300">
                Note / Description:
              </label>
              <Input
                value={advNote}
                onChange={(e) => setAdvNote(e.target.value)}
                placeholder="e.g. Replenishment via PhonePe"
                className="h-10 rounded-2xl"
              />
            </div>

            <div className="pt-2 flex items-center justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setIsAddAdvanceModalOpen(false)}
                className="rounded-2xl text-xs font-bold"
              >
                Cancel
              </Button>
              <Button
                onClick={handleAddAdvance}
                disabled={isSubmittingAdv}
                className="rounded-2xl text-xs font-black bg-emerald-600 hover:bg-emerald-700 text-white px-4"
              >
                {isSubmittingAdv ? 'Recording...' : 'Record Advance'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* DIALOG 3: FLOAT HISTORY & AUDIT TRAIL */}
      <Dialog open={isHistoryModalOpen} onOpenChange={setIsHistoryModalOpen}>
        <DialogContent className="sm:max-w-[540px] rounded-3xl p-6 bg-white dark:bg-slate-900 max-h-[80vh] overflow-y-auto border border-slate-200/80 dark:border-slate-800 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-black flex items-center gap-2">
              <History className="w-5 h-5 text-indigo-600" />
              {floatData.counterName} Cashflow Audit History
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 pt-2 text-xs">
            {/* Top-Ups List */}
            <div>
              <h4 className="font-bold text-slate-900 dark:text-white uppercase tracking-wider text-[11px] mb-2">
                Recent Advances Received (+):
              </h4>
              {floatData.topUps.length === 0 ? (
                <p className="text-slate-400 py-3 border border-dashed rounded-2xl text-center">
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
                          {t.transactionRef && (
                            <span className="text-[10px] font-mono text-slate-400">
                              Ref: {t.transactionRef}
                            </span>
                          )}
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
        <DialogContent className="sm:max-w-[400px] rounded-3xl p-6 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-black flex items-center gap-2">
              <Settings2 className="w-5 h-5 text-indigo-600" />
              Configure Opening Float
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3.5 pt-2 text-xs">
            <p className="text-slate-500">
              Set the base opening advance for <strong>{floatData.counterName}</strong>.
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
                className="h-10 rounded-2xl font-mono text-sm"
              />
            </div>
            <div className="pt-2 flex items-center justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setIsSettingsModalOpen(false)}
                className="rounded-2xl text-xs font-bold"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSaveOpeningFloat}
                className="rounded-2xl text-xs font-black bg-indigo-600 hover:bg-indigo-700 text-white px-4"
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
