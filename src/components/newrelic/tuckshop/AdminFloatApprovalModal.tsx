'use client';

import React, { useState, useEffect } from 'react';
import {
  Coins,
  CheckCircle2,
  XCircle,
  Clock,
  Send,
  Building2,
  DollarSign,
  AlertTriangle,
  ArrowRight,
  ShieldCheck,
  User,
  QrCode,
  ExternalLink,
  Copy,
  Smartphone,
  Landmark,
  Check,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  FloatRequestEntry,
  subscribeToAllPendingRequests,
} from '@/services/tuckshopFloatService';
import { triggerHaptic } from '@/lib/haptics';
import { formatOrdinalDate } from '@/services/hungerboxParser';
import { useAuth } from '@/contexts/AuthContext';
import { useSearchParams } from 'next/navigation';

export function AdminFloatNotificationPill() {
  const { role } = useAuth();
  const searchParams = useSearchParams();
  const isAdmin = role === 'admin' || role === 'superadmin';
  const [pendingRequests, setPendingRequests] = useState<FloatRequestEntry[]>([]);
  const [selectedReq, setSelectedReq] = useState<FloatRequestEntry | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Approval form
  const [mode, setMode] = useState<'upi' | 'bank_transfer'>('upi');
  const [transactionRef, setTransactionRef] = useState('');
  const [adminNote, setAdminNote] = useState('');
  const [declineReason, setDeclineReason] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDeclining, setIsDeclining] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  useEffect(() => {
    if (!isAdmin) return;
    const unsub = subscribeToAllPendingRequests((items) => {
      setPendingRequests(items);
    });
    return () => unsub();
  }, [isAdmin]);

  // Handle URL deep-link query parameter e.g. /newrelic/tuckshop?floatReq=req_xxx
  useEffect(() => {
    if (!isAdmin || pendingRequests.length === 0) return;
    const floatReqId = searchParams?.get('floatReq');
    if (floatReqId) {
      const match = pendingRequests.find((r) => r.id === floatReqId);
      if (match) {
        handleOpenRequest(match);
      }
    }
  }, [searchParams, pendingRequests, isAdmin]);

  if (!isAdmin || pendingRequests.length === 0) return null;

  const handleOpenRequest = (req: FloatRequestEntry) => {
    triggerHaptic('medium');
    setSelectedReq(req);
    const pref = (req.preferredMode || '').toLowerCase();
    setMode(pref.includes('bank') ? 'bank_transfer' : 'upi');
    setTransactionRef('');
    setAdminNote(`Approved top-up of ₹${req.amount.toLocaleString('en-IN')}`);
    setIsDeclining(false);
    setShowQr(false);
    setIsModalOpen(true);
  };

  const handleApprove = async () => {
    if (!selectedReq) return;
    triggerHaptic('heavy');
    setIsProcessing(true);
    try {
      const res = await fetch('/api/tuckshop/float', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'approve',
          requestId: selectedReq.id,
          mode,
          transactionRef: transactionRef.trim() || undefined,
          note: adminNote.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setIsModalOpen(false);
        setSelectedReq(null);
      } else {
        alert(data.error || 'Approval failed');
      }
    } catch (e: any) {
      alert(e.message || 'Error approving request');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReject = async () => {
    if (!selectedReq) return;
    triggerHaptic('medium');
    setIsProcessing(true);
    try {
      const res = await fetch('/api/tuckshop/float', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'reject',
          requestId: selectedReq.id,
          reason: declineReason.trim() || 'Declined by Admin',
        }),
      });
      const data = await res.json();
      if (data.success) {
        setIsModalOpen(false);
        setSelectedReq(null);
      } else {
        alert(data.error || 'Decline failed');
      }
    } catch (e: any) {
      alert(e.message || 'Error declining request');
    } finally {
      setIsProcessing(false);
    }
  };

  const copyToClipboard = (text: string, fieldId: string) => {
    navigator.clipboard.writeText(text);
    triggerHaptic('light');
    setCopiedField(fieldId);
    setTimeout(() => setCopiedField(null), 2000);
  };

  // Resolve PhonePe / UPI payment link
  const payeeUpi = (selectedReq as any)?.payeeUpi || (selectedReq as any)?.upiId || '7709632898@ybl';
  const payeeName = selectedReq?.requestedBy?.split('(')[0]?.trim() || 'Manager';
  const upiIntentUrl = selectedReq
    ? `upi://pay?pa=${encodeURIComponent(payeeUpi)}&pn=${encodeURIComponent(payeeName)}&am=${selectedReq.amount}&cu=INR&tn=${encodeURIComponent('Tuckshop-Petty-Cash')}`
    : '';
  const qrCodeUrl = upiIntentUrl
    ? `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(upiIntentUrl)}`
    : '';

  return (
    <>
      {/* Top Bar Notification Badge / Button */}
      <button
        type="button"
        onClick={() => handleOpenRequest(pendingRequests[0])}
        className="px-3 py-1.5 rounded-full bg-gradient-to-r from-amber-400 via-amber-500 to-orange-500 text-slate-950 text-xs font-black flex items-center gap-1.5 shadow-md shadow-amber-950/20 animate-pulse hover:scale-105 active:scale-95 transition-all cursor-pointer whitespace-nowrap"
        title="Pending Petty Cash Top-Up Requests"
      >
        <Coins className="w-3.5 h-3.5 fill-slate-950" />
        <span>
          {pendingRequests.length} Cash {pendingRequests.length === 1 ? 'Request' : 'Requests'} (₹{pendingRequests.reduce((sum, r) => sum + r.amount, 0).toLocaleString('en-IN')})
        </span>
      </button>

      {/* Admin Approval Dialog */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="w-full sm:max-w-[500px] rounded-3xl p-5 sm:p-6 bg-white dark:bg-slate-900 shadow-2xl border border-slate-200/80 dark:border-slate-800">
          <DialogHeader>
            <DialogTitle className="text-base font-black flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Coins className="w-5 h-5 text-amber-500" />
                Review Petty Cash Float Request
              </span>
              <Badge className="bg-amber-100 text-amber-900 border-amber-300 font-bold text-[10px]">
                Pending Approval
              </Badge>
            </DialogTitle>
          </DialogHeader>

          {selectedReq && (
            <div className="space-y-4 pt-2 text-xs">
              {/* Applicant & Location Card */}
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-slate-400" />
                    <span className="font-bold text-slate-900 dark:text-white text-sm">
                      {selectedReq.requestedBy}
                    </span>
                  </div>
                  <Badge variant="outline" className="font-bold text-[10px]">
                    {selectedReq.counterName}
                  </Badge>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-200/60 dark:border-slate-700">
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold uppercase block">
                      Amount Requested
                    </span>
                    <span className="text-xl font-mono font-black text-indigo-600 dark:text-indigo-400">
                      ₹{selectedReq.amount.toLocaleString('en-IN')}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold uppercase block">
                      Current Drawer Float
                    </span>
                    <span className="text-xl font-mono font-black text-slate-900 dark:text-white">
                      ₹{(selectedReq.currentBalance || 0).toLocaleString('en-IN')}
                    </span>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-200/60 dark:border-slate-700">
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">
                    Purpose / Supplies Needed:
                  </span>
                  <p className="text-slate-700 dark:text-slate-300 font-medium mt-0.5">
                    {selectedReq.reason}
                  </p>
                </div>
              </div>

              {!isDeclining ? (
                /* Approve & Payment View */
                <div className="space-y-3.5 pt-1">
                  {/* Automated Payment Mode Switcher */}
                  <div className="space-y-1.5">
                    <label className="font-bold text-slate-700 dark:text-slate-300">
                      Payment Transfer Method:
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          triggerHaptic('light');
                          setMode('upi');
                        }}
                        className={`py-2.5 px-3 rounded-2xl font-bold text-xs border flex items-center justify-center gap-2 transition-all ${
                          mode === 'upi'
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
                          setMode('bank_transfer');
                        }}
                        className={`py-2.5 px-3 rounded-2xl font-bold text-xs border flex items-center justify-center gap-2 transition-all ${
                          mode === 'bank_transfer'
                            ? 'border-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-950 dark:text-emerald-200 ring-2 ring-emerald-600/50 shadow-xs'
                            : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-slate-300'
                        }`}
                      >
                        <Landmark className="w-4 h-4 text-emerald-600" />
                        <span>HDFC NetBanking</span>
                      </button>
                    </div>
                  </div>

                  {/* Mode 1: 1-Click PhonePe / UPI Fast Automation */}
                  {mode === 'upi' && (
                    <div className="p-3.5 rounded-2xl bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-indigo-950 dark:text-indigo-200 flex items-center gap-1.5">
                          <Smartphone className="w-4 h-4 text-indigo-600" /> 1-Click PhonePe Payment
                        </span>
                        <button
                          type="button"
                          onClick={() => setShowQr(!showQr)}
                          className="text-[11px] font-bold text-indigo-600 hover:underline flex items-center gap-1"
                        >
                          <QrCode className="w-3.5 h-3.5" />
                          {showQr ? 'Hide QR' : 'Scan PhonePe QR'}
                        </button>
                      </div>

                      {showQr ? (
                        <div className="py-2 flex flex-col items-center justify-center bg-white dark:bg-slate-900 rounded-xl p-3 border border-indigo-100 shadow-xs text-center space-y-2">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={qrCodeUrl}
                            alt="PhonePe QR Code"
                            className="w-36 h-36 rounded-lg"
                          />
                          <p className="text-[10px] text-slate-500 font-medium">
                            Scan with PhonePe or any UPI app to pay ₹{selectedReq.amount.toLocaleString('en-IN')}
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <p className="text-[11px] text-indigo-900/80 dark:text-indigo-300">
                            Tap below to immediately launch PhonePe with <strong>₹{selectedReq.amount.toLocaleString('en-IN')}</strong> pre-filled:
                          </p>
                          <a
                            href={upiIntentUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md shadow-indigo-950/20 active:scale-95 transition-all"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                            ⚡ Open &amp; Pay ₹{selectedReq.amount.toLocaleString('en-IN')} on PhonePe App
                          </a>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Mode 2: HDFC NetBanking Fast Copy & Direct Link */}
                  {mode === 'bank_transfer' && (
                    <div className="p-3.5 rounded-2xl bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-emerald-950 dark:text-emerald-200 flex items-center gap-1.5">
                          <Landmark className="w-4 h-4 text-emerald-600" /> HDFC NetBanking Transfer
                        </span>
                        <a
                          href="https://netbanking.hdfcbank.com/netbanking/"
                          target="_blank"
                          rel="noreferrer"
                          className="text-[11px] font-bold text-emerald-700 hover:underline flex items-center gap-1"
                        >
                          <ExternalLink className="w-3 h-3" /> Open HDFC Portal
                        </a>
                      </div>

                      <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-emerald-100 flex items-center justify-between">
                        <div>
                          <span className="text-[10px] text-slate-400 font-bold block uppercase">Beneficiary Name</span>
                          <span className="font-bold text-slate-900 dark:text-white">{payeeName}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => copyToClipboard(payeeName, 'name')}
                          className="h-7 px-2 text-[10px] font-bold rounded-lg border border-slate-200 hover:bg-slate-50 flex items-center gap-1"
                        >
                          {copiedField === 'name' ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                          {copiedField === 'name' ? 'Copied' : 'Copy'}
                        </button>
                      </div>

                      <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-emerald-100 flex items-center justify-between">
                        <div>
                          <span className="text-[10px] text-slate-400 font-bold block uppercase">Transfer Amount</span>
                          <span className="font-mono font-black text-emerald-700 text-sm">₹{selectedReq.amount.toLocaleString('en-IN')}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => copyToClipboard(String(selectedReq.amount), 'amount')}
                          className="h-7 px-2 text-[10px] font-bold rounded-lg border border-slate-200 hover:bg-slate-50 flex items-center gap-1"
                        >
                          {copiedField === 'amount' ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                          {copiedField === 'amount' ? 'Copied' : 'Copy'}
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <label className="font-bold text-slate-700 dark:text-slate-300">
                      UTR / Transfer Reference Number (Optional):
                    </label>
                    <Input
                      value={transactionRef}
                      onChange={(e) => setTransactionRef(e.target.value)}
                      placeholder="e.g. 431209384920"
                      className="h-9 rounded-xl font-mono text-xs"
                    />
                  </div>

                  <div className="pt-2 flex items-center justify-between gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => setIsDeclining(true)}
                      className="text-rose-600 hover:text-rose-700 hover:bg-rose-50 text-xs font-bold"
                    >
                      Decline Request...
                    </Button>

                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        onClick={() => setIsModalOpen(false)}
                        className="rounded-2xl text-xs font-bold"
                      >
                        Cancel
                      </Button>
                      <Button
                        onClick={handleApprove}
                        disabled={isProcessing}
                        className="rounded-2xl text-xs font-black bg-emerald-600 hover:bg-emerald-700 text-white shadow-md active:scale-95"
                      >
                        {isProcessing ? 'Crediting...' : `Approve & Credit ₹${selectedReq.amount.toLocaleString('en-IN')}`}
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                /* Decline View */
                <div className="space-y-3 pt-1">
                  <div className="space-y-1.5">
                    <label className="font-bold text-rose-700 dark:text-rose-400">
                      Reason for Declining:
                    </label>
                    <Input
                      value={declineReason}
                      onChange={(e) => setDeclineReason(e.target.value)}
                      placeholder="e.g. Existing float balance is sufficient for today"
                      className="h-10 rounded-2xl"
                    />
                  </div>

                  <div className="pt-2 flex items-center justify-end gap-2">
                    <Button
                      variant="outline"
                      onClick={() => setIsDeclining(false)}
                      className="rounded-2xl text-xs font-bold"
                    >
                      Back to Approve
                    </Button>
                    <Button
                      onClick={handleReject}
                      disabled={isProcessing}
                      className="rounded-2xl text-xs font-black bg-rose-600 hover:bg-rose-700 text-white"
                    >
                      {isProcessing ? 'Declining...' : 'Confirm Decline'}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
