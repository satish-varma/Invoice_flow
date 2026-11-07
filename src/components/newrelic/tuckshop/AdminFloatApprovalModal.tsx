'use client';

import React, { useState, useEffect } from 'react';
import {
  Bell,
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

export function AdminFloatNotificationPill() {
  const { role } = useAuth();
  const isAdmin = role === 'admin' || role === 'superadmin';
  const [pendingRequests, setPendingRequests] = useState<FloatRequestEntry[]>([]);
  const [selectedReq, setSelectedReq] = useState<FloatRequestEntry | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Approval form
  const [mode, setMode] = useState<'upi' | 'cash'>('upi');
  const [transactionRef, setTransactionRef] = useState('');
  const [adminNote, setAdminNote] = useState('');
  const [declineReason, setDeclineReason] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDeclining, setIsDeclining] = useState(false);

  useEffect(() => {
    if (!isAdmin) return;
    const unsub = subscribeToAllPendingRequests((items) => {
      setPendingRequests(items);
    });
    return () => unsub();
  }, [isAdmin]);

  if (!isAdmin || pendingRequests.length === 0) return null;

  const handleOpenRequest = (req: FloatRequestEntry) => {
    triggerHaptic('medium');
    setSelectedReq(req);
    setMode(req.preferredMode || 'upi');
    setTransactionRef('');
    setAdminNote(`Approved top-up of ₹${req.amount.toLocaleString('en-IN')}`);
    setIsDeclining(false);
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

  return (
    <>
      {/* Top Bar Notification Badge / Button */}
      <button
        type="button"
        onClick={() => handleOpenRequest(pendingRequests[0])}
        className="px-2.5 py-1 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 text-xs font-black flex items-center gap-1.5 shadow-md shadow-amber-950/20 animate-pulse hover:scale-105 active:scale-95 transition-all"
        title="Pending Petty Cash Top-Up Requests"
      >
        <Coins className="w-3.5 h-3.5 fill-slate-950" />
        <span>
          {pendingRequests.length} Cash {pendingRequests.length === 1 ? 'Request' : 'Requests'}
        </span>
      </button>

      {/* Admin Approval Dialog */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-[480px] rounded-3xl p-6 bg-white dark:bg-slate-900 shadow-2xl">
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
                    <span className="text-lg font-mono font-black text-indigo-600 dark:text-indigo-400">
                      ₹{selectedReq.amount.toLocaleString('en-IN')}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold uppercase block">
                      Current Drawer Float
                    </span>
                    <span className="text-lg font-mono font-black text-slate-900 dark:text-white">
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
                /* Approve View */
                <div className="space-y-3 pt-1">
                  <div className="space-y-1.5">
                    <label className="font-bold text-slate-700 dark:text-slate-300">
                      Transfer / Handover Mode:
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { id: 'upi', label: '📱 UPI Transfer (PhonePe/GPay)' },
                        { id: 'cash', label: '💵 Physical Cash Handover' },
                      ].map((m) => (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => setMode(m.id as any)}
                          className={`py-2 rounded-xl font-bold text-xs border transition-all ${
                            mode === m.id
                              ? 'border-emerald-600 bg-emerald-50 text-emerald-950 ring-2 ring-emerald-600/50 shadow-xs'
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
                      UPI UTR / Reference ID (Optional):
                    </label>
                    <Input
                      value={transactionRef}
                      onChange={(e) => setTransactionRef(e.target.value)}
                      placeholder="e.g. UTR 431209384920"
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
                        className="rounded-xl text-xs font-bold"
                      >
                        Cancel
                      </Button>
                      <Button
                        onClick={handleApprove}
                        disabled={isProcessing}
                        className="rounded-xl text-xs font-black bg-emerald-600 hover:bg-emerald-700 text-white"
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
                      className="h-10 rounded-xl"
                    />
                  </div>

                  <div className="pt-2 flex items-center justify-end gap-2">
                    <Button
                      variant="outline"
                      onClick={() => setIsDeclining(false)}
                      className="rounded-xl text-xs font-bold"
                    >
                      Back to Approve
                    </Button>
                    <Button
                      onClick={handleReject}
                      disabled={isProcessing}
                      className="rounded-xl text-xs font-black bg-rose-600 hover:bg-rose-700 text-white"
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
