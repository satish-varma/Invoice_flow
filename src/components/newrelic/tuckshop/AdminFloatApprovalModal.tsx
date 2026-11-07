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
  Edit2,
  Phone,
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
  resolveManagerPaymentDetails,
} from '@/services/tuckshopFloatService';
import { triggerHaptic } from '@/lib/haptics';
import { useAuth } from '@/contexts/AuthContext';
import { useSearchParams } from 'next/navigation';

const QUICK_UPI_HANDLES = ['@ybl', '@upi', '@paytm', '@okaxis', '@okhdfcbank'];

interface AdminFloatApprovalDialogProps {
  request: FloatRequestEntry | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

/**
 * Universal Modal for reviewing, generating PhonePe QR, and approving/declining float requests
 */
export function AdminFloatApprovalDialog({
  request,
  open,
  onOpenChange,
  onSuccess,
}: AdminFloatApprovalDialogProps) {
  const [payeeName, setPayeeName] = useState('');
  const [payeePhone, setPayeePhone] = useState('');
  const [payeeUpi, setPayeeUpi] = useState('');
  const [isEditingUpi, setIsEditingUpi] = useState(false);

  const [mode, setMode] = useState<'upi' | 'bank_transfer'>('upi');
  const [transactionRef, setTransactionRef] = useState('');
  const [adminNote, setAdminNote] = useState('');
  const [declineReason, setDeclineReason] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDeclining, setIsDeclining] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  useEffect(() => {
    if (!request || !open) return;

    const pref = (request.preferredMode || '').toLowerCase();
    setMode(pref.includes('bank') ? 'bank_transfer' : 'upi');
    setTransactionRef('');
    setAdminNote(`Approved top-up of ₹${request.amount.toLocaleString('en-IN')}`);
    setIsDeclining(false);
    setShowQr(false);
    setIsEditingUpi(false);

    const initialName = request.payeeName || request.requestedBy?.split('(')[0]?.trim() || 'Manager';
    const initialPhone = request.payeePhone || '';
    const initialUpi = request.payeeUpi || (initialPhone ? `${initialPhone}@ybl` : '');

    setPayeeName(initialName);
    setPayeePhone(initialPhone);
    setPayeeUpi(initialUpi);

    resolveManagerPaymentDetails(request).then((resolved) => {
      if (resolved.name) setPayeeName(resolved.name);
      if (resolved.phone) setPayeePhone(resolved.phone);
      if (!initialUpi && resolved.upiId) setPayeeUpi(resolved.upiId);
    }).catch((e) => {
      console.warn('[AdminFloat] Failed to resolve employee details:', e);
    });
  }, [request, open]);

  if (!request) return null;

  const handleApprove = async () => {
    triggerHaptic('heavy');
    setIsProcessing(true);
    try {
      const res = await fetch('/api/tuckshop/float', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'approve',
          requestId: request.id,
          mode,
          transactionRef: transactionRef.trim() || undefined,
          note: adminNote.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (data.success) {
        onOpenChange(false);
        if (onSuccess) onSuccess();
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
    triggerHaptic('medium');
    setIsProcessing(true);
    try {
      const res = await fetch('/api/tuckshop/float', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'reject',
          requestId: request.id,
          reason: declineReason.trim() || 'Declined by Admin',
        }),
      });
      const data = await res.json();
      if (data.success) {
        onOpenChange(false);
        if (onSuccess) onSuccess();
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

  const handleQuickHandle = (handle: string) => {
    const rawNumber = payeePhone.replace(/\D/g, '').slice(-10) || payeeUpi.split('@')[0];
    if (rawNumber) {
      setPayeeUpi(`${rawNumber}${handle}`);
      triggerHaptic('light');
    }
  };

  const cleanUpi = payeeUpi.trim();
  const upiIntentUrl = cleanUpi
    ? `upi://pay?pa=${encodeURIComponent(cleanUpi)}&pn=${encodeURIComponent(payeeName)}&am=${request.amount}&cu=INR&tn=${encodeURIComponent('Tuckshop-Petty-Cash')}`
    : '';
  const qrCodeUrl = upiIntentUrl
    ? `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(upiIntentUrl)}`
    : '';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full sm:max-w-[520px] rounded-3xl p-5 sm:p-6 bg-white dark:bg-slate-900 shadow-2xl border border-slate-200/80 dark:border-slate-800 max-h-[92vh] overflow-y-auto">
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

        <div className="space-y-4 pt-1 text-xs">
          {/* Applicant & Location Card */}
          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-slate-400" />
                <div>
                  <span className="font-bold text-slate-900 dark:text-white text-sm block">
                    {payeeName || request.requestedBy}
                  </span>
                  <span className="text-[10px] text-slate-400 font-medium">
                    {request.requestedByEmail || request.requestedBy}
                  </span>
                </div>
              </div>
              <Badge variant="outline" className="font-bold text-[10px] bg-white dark:bg-slate-800">
                {request.counterName}
              </Badge>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-200/60 dark:border-slate-700">
              <div>
                <span className="text-[10px] text-slate-400 font-bold uppercase block">
                  Amount Requested
                </span>
                <span className="text-xl font-mono font-black text-indigo-600 dark:text-indigo-400">
                  ₹{request.amount.toLocaleString('en-IN')}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 font-bold uppercase block">
                  Current Drawer Float
                </span>
                <span className="text-xl font-mono font-black text-slate-900 dark:text-white">
                  ₹{(request.currentBalance || 0).toLocaleString('en-IN')}
                </span>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-200/60 dark:border-slate-700">
              <span className="text-[10px] text-slate-400 font-bold uppercase block">
                Purpose / Supplies Needed:
              </span>
              <p className="text-slate-700 dark:text-slate-300 font-medium mt-0.5">
                {request.reason}
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
                <div className="p-3.5 rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800 space-y-3">
                  {/* Destination Manager Information */}
                  <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-indigo-100 dark:border-indigo-900/60 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                        <Phone className="w-3.5 h-3.5 text-indigo-600" />
                        <span className="font-bold text-[11px]">Payee (Employee Directory):</span>
                      </div>
                      <span className="font-mono font-bold text-xs text-indigo-900 dark:text-indigo-300">
                        {payeePhone ? `+91 ${payeePhone}` : 'No phone linked'}
                      </span>
                    </div>

                    {/* UPI Address field with Live Edit */}
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-slate-400 font-bold uppercase shrink-0">UPI ID:</span>
                      {isEditingUpi ? (
                        <Input
                          value={payeeUpi}
                          onChange={(e) => setPayeeUpi(e.target.value)}
                          placeholder="e.g. 9963598597@ybl"
                          className="h-7 text-xs font-mono font-bold"
                          autoFocus
                        />
                      ) : (
                        <span className="font-mono font-black text-slate-900 dark:text-white text-xs truncate">
                          {payeeUpi || 'Not set'}
                        </span>
                      )}

                      <button
                        type="button"
                        onClick={() => setIsEditingUpi(!isEditingUpi)}
                        className="p-1 rounded text-indigo-600 hover:bg-indigo-50 dark:hover:bg-slate-800 shrink-0 text-[10px] font-bold flex items-center gap-0.5"
                      >
                        <Edit2 className="w-3 h-3" />
                        {isEditingUpi ? 'Done' : 'Change'}
                      </button>

                      {payeeUpi && (
                        <button
                          type="button"
                          onClick={() => copyToClipboard(payeeUpi, 'upi')}
                          className="p-1 rounded text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 shrink-0 text-[10px] font-bold flex items-center gap-0.5"
                        >
                          {copiedField === 'upi' ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                        </button>
                      )}
                    </div>

                    {/* Quick Handle Selection Pills */}
                    {isEditingUpi && (
                          <div className="flex items-center gap-1 pt-1 flex-wrap">
                            <span className="text-[9px] text-slate-400 font-bold">Quick Handles:</span>
                            {QUICK_UPI_HANDLES.map((handle) => (
                              <button
                                key={handle}
                                type="button"
                                onClick={() => handleQuickHandle(handle)}
                                className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-slate-100 dark:bg-slate-800 hover:bg-indigo-100 text-slate-700 dark:text-slate-300 font-mono"
                              >
                                {handle}
                              </button>
                            ))}
                          </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="font-bold text-indigo-950 dark:text-indigo-200 flex items-center gap-1.5">
                      <Smartphone className="w-4 h-4 text-indigo-600" /> 1-Click PhonePe / QR Payment
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowQr(!showQr)}
                      className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
                    >
                      <QrCode className="w-3.5 h-3.5" />
                      {showQr ? 'Hide QR' : 'Show Scanner QR'}
                    </button>
                  </div>

                  {showQr ? (
                    <div className="py-3 flex flex-col items-center justify-center bg-white dark:bg-slate-900 rounded-2xl p-4 border border-indigo-100 shadow-md text-center space-y-2.5">
                      {qrCodeUrl ? (
                        <>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={qrCodeUrl}
                            alt={`QR Code to pay ${payeeName}`}
                            className="w-44 h-44 rounded-xl border border-slate-100 shadow-xs"
                          />
                          <div>
                            <span className="font-bold text-slate-900 dark:text-white text-xs block">
                              Pay {payeeName}
                            </span>
                            <span className="font-mono text-[11px] text-indigo-600 font-bold block">
                              {payeeUpi}
                            </span>
                            <span className="text-[10px] text-slate-400 font-medium">
                              Scan with PhonePe, Google Pay, or Paytm to pay ₹{request.amount.toLocaleString('en-IN')}
                            </span>
                          </div>
                        </>
                      ) : (
                        <p className="text-rose-500 font-bold text-xs py-4">
                          Please enter a valid PhonePe / UPI ID above to generate the QR code.
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-[11px] text-indigo-900/80 dark:text-indigo-300">
                        Pay <strong>{payeeName}</strong> directly on PhonePe with <strong>₹{request.amount.toLocaleString('en-IN')}</strong>:
                      </p>
                      {upiIntentUrl ? (
                        <a
                          href={upiIntentUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md shadow-indigo-950/20 active:scale-95 transition-all"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          ⚡ Open &amp; Pay ₹{request.amount.toLocaleString('en-IN')} on PhonePe App
                        </a>
                      ) : (
                        <p className="text-amber-600 text-xs font-bold">
                          Add the manager&apos;s UPI ID above to open PhonePe.
                        </p>
                      )}
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

                  {payeePhone && (
                    <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-emerald-100 flex items-center justify-between">
                      <div>
                        <span className="text-[10px] text-slate-400 font-bold block uppercase">Beneficiary Mobile</span>
                        <span className="font-bold font-mono text-slate-900 dark:text-white">+91 {payeePhone}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => copyToClipboard(payeePhone, 'phone')}
                        className="h-7 px-2 text-[10px] font-bold rounded-lg border border-slate-200 hover:bg-slate-50 flex items-center gap-1"
                      >
                        {copiedField === 'phone' ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                        {copiedField === 'phone' ? 'Copied' : 'Copy'}
                      </button>
                    </div>
                  )}

                  <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-emerald-100 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] text-slate-400 font-bold block uppercase">Transfer Amount</span>
                      <span className="font-mono font-black text-emerald-700 text-sm">₹{request.amount.toLocaleString('en-IN')}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(String(request.amount), 'amount')}
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
                    onClick={() => onOpenChange(false)}
                    className="rounded-2xl text-xs font-bold"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleApprove}
                    disabled={isProcessing}
                    className="rounded-2xl text-xs font-black bg-emerald-600 hover:bg-emerald-700 text-white shadow-md active:scale-95"
                  >
                    {isProcessing ? 'Crediting...' : `Approve & Credit ₹${request.amount.toLocaleString('en-IN')}`}
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
      </DialogContent>
    </Dialog>
  );
}

export function AdminFloatNotificationPill({ compact }: { compact?: boolean }) {
  const { role } = useAuth();
  const searchParams = useSearchParams();
  const isAdmin = role === 'admin' || role === 'superadmin';
  const [pendingRequests, setPendingRequests] = useState<FloatRequestEntry[]>([]);
  const [selectedReq, setSelectedReq] = useState<FloatRequestEntry | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

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
        setSelectedReq(match);
        setIsModalOpen(true);
      }
    }
  }, [searchParams, pendingRequests, isAdmin]);

  if (!isAdmin || pendingRequests.length === 0) return null;

  const totalPendingAmount = pendingRequests.reduce((sum, r) => sum + r.amount, 0);

  return (
    <>
      <button
        type="button"
        onClick={() => {
          triggerHaptic('medium');
          setSelectedReq(pendingRequests[0]);
          setIsModalOpen(true);
        }}
        className="px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-full bg-gradient-to-r from-amber-400 via-amber-500 to-orange-500 text-slate-950 font-black flex items-center gap-1.5 shadow-md shadow-amber-950/20 animate-pulse hover:scale-105 active:scale-95 transition-all cursor-pointer whitespace-nowrap text-xs shrink-0"
        title="Pending Petty Cash Top-Up Requests"
      >
        <Coins className="w-3.5 h-3.5 fill-slate-950 shrink-0" />
        <span className="hidden sm:inline">
          {pendingRequests.length} Cash {pendingRequests.length === 1 ? 'Request' : 'Requests'} (₹{totalPendingAmount.toLocaleString('en-IN')})
        </span>
        <span className="sm:hidden text-[11px] font-black">
          {pendingRequests.length} Req (₹{totalPendingAmount >= 1000 ? `${Math.round(totalPendingAmount / 1000)}k` : totalPendingAmount})
        </span>
      </button>

      <AdminFloatApprovalDialog
        request={selectedReq}
        open={isModalOpen}
        onOpenChange={setIsModalOpen}
      />
    </>
  );
}

/**
 * Mobile Top Banner for Admins in Capacitor / Mobile Viewport
 */
export function AdminFloatMobileBanner() {
  const { role } = useAuth();
  const isAdmin = role === 'admin' || role === 'superadmin';
  const [pendingRequests, setPendingRequests] = useState<FloatRequestEntry[]>([]);
  const [selectedReq, setSelectedReq] = useState<FloatRequestEntry | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    if (!isAdmin) return;
    const unsub = subscribeToAllPendingRequests((items) => {
      setPendingRequests(items);
    });
    return () => unsub();
  }, [isAdmin]);

  if (!isAdmin || pendingRequests.length === 0) return null;

  const totalAmount = pendingRequests.reduce((sum, r) => sum + r.amount, 0);

  return (
    <>
      <div 
        onClick={() => {
          triggerHaptic('medium');
          setSelectedReq(pendingRequests[0]);
          setIsModalOpen(true);
        }}
        className="sm:hidden bg-gradient-to-r from-amber-500 via-amber-600 to-orange-600 text-slate-950 px-3.5 py-2 flex items-center justify-between shadow-md border-b border-amber-400/40 relative z-20 cursor-pointer active:brightness-95 transition-all"
      >
        <div className="flex items-center gap-2 min-w-0">
          <Coins className="w-4 h-4 fill-slate-950 shrink-0 animate-bounce" />
          <div className="flex flex-col min-w-0">
            <span className="text-xs font-black leading-tight text-white truncate">
              {pendingRequests.length} Petty Cash Top-Up {pendingRequests.length === 1 ? 'Request' : 'Requests'}
            </span>
            <span className="text-[10px] font-bold text-amber-100">
              Total ₹{totalAmount.toLocaleString('en-IN')} pending approval
            </span>
          </div>
        </div>
        
        <button
          type="button"
          className="px-2.5 py-1 rounded-full bg-slate-950 text-amber-300 font-black text-[11px] shadow-sm flex items-center gap-1 shrink-0"
        >
          <span>Review &amp; Pay</span>
          <ArrowRight className="w-3 h-3" />
        </button>
      </div>

      <AdminFloatApprovalDialog
        request={selectedReq}
        open={isModalOpen}
        onOpenChange={setIsModalOpen}
      />
    </>
  );
}
