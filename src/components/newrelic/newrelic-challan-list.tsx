'use client';
import { NewRelicChallan } from '@/types/challan';

import React, { useState, useRef } from 'react';
import { format } from 'date-fns';
import { Trash2, Download, Edit2, Copy, RefreshCcw, History, Eye, Receipt, MoreVertical, FileText, ChevronDown, ChevronUp, FileCheck, Paperclip, Edit, Package, Calendar, AlertTriangle } from 'lucide-react';
import { triggerHaptic } from '@/lib/haptics';
import { useToast } from '@/hooks/use-toast';
import { NewRelicAttachmentModal } from './newrelic-attachment-modal';
import { RollingCashCounter } from '@/components/effects/RollingCashCounter';
import { TiltCard } from '@/components/effects/TiltCard';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {NEWRELIC_LOCATIONS} from '@/services/newrelicChallanService';
import { useAuth } from '@/contexts/AuthContext';
import { hasPermission } from '@/types/permissions';
import { logAuditEvent } from '@/services/auditService';

interface NewRelicChallanListProps {
  challans: NewRelicChallan[];
  onSelectChallan: (c: NewRelicChallan) => void;
  onDownloadChallan: (c: NewRelicChallan) => void;
  onDeleteChallan: (id: string) => void;
  onDuplicateChallan: (c: NewRelicChallan) => void;
  onViewHistory?: (c: NewRelicChallan) => void;
  onPreviewChallan?: (c: NewRelicChallan) => void;
  onAdminPreviewChallan?: (c: NewRelicChallan) => void;
  isTrashView?: boolean;
  onRestoreChallan?: (id: string) => void;
  role?: string | null;
  showFinancials?: boolean;
}

const formatAuthorName = (email?: string | null) => {
  if (!email) return 'System';
  return email.split('@')[0];
};

export function NewRelicChallanList({
  challans,
  onSelectChallan,
  onDownloadChallan,
  onDeleteChallan,
  onDuplicateChallan,
  onViewHistory,
  onPreviewChallan,
  onAdminPreviewChallan,
  isTrashView,
  onRestoreChallan,
  role,
  showFinancials,
}: NewRelicChallanListProps) {
  const { toast } = useToast();
  const { user, role: authRole, canDelete, isReadOnly } = useAuth();
  const effectiveRole = role || authRole;
  const canViewSignedCopies = effectiveRole !== 'guest' && hasPermission(user, 'signed_copies');
  const hasDeleteClearance = canDelete && !isReadOnly && effectiveRole !== 'guest';
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleteConfirmChallan, setDeleteConfirmChallan] = useState<NewRelicChallan | null>(null);
  const [deleteConfirmationInput, setDeleteConfirmationInput] = useState('');
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());
  const [attachmentModal, setAttachmentModal] = useState<{
    challan: NewRelicChallan;
    type: 'signed_copy' | 'goods_received';
  } | null>(null);

  // Swipe-to-action state on mobile cards
  const [swipedId, setSwipedId] = useState<string | null>(null);
  const swipeStartX = useRef<number>(0);
  const swipeStartY = useRef<number>(0);
  const SWIPE_THRESHOLD = 50;

  const handleCardTouchStart = (e: React.TouchEvent) => {
    swipeStartX.current = e.touches[0].clientX;
    swipeStartY.current = e.touches[0].clientY;
  };

  const handleCardTouchEnd = (e: React.TouchEvent, challan: NewRelicChallan) => {
    const dx = swipeStartX.current - e.changedTouches[0].clientX;
    const dy = Math.abs(swipeStartY.current - e.changedTouches[0].clientY);
    // Only trigger swipe on predominantly horizontal motion
    if (dx > SWIPE_THRESHOLD && dy < 40) {
      triggerHaptic('light');
      setSwipedId(prev => (prev === challan.id ? null : (challan.id ?? null)));
    } else if (dx < -20) {
      setSwipedId(null);
    }
  };

  const toggleCardExpand = (id: string) => {
    triggerHaptic('light');
    setExpandedCards(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(challans.filter(c => c.id).map(c => c.id as string)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleSelectOne = (id: string, checked: boolean) => {
    const next = new Set(selectedIds);
    if (checked) {
      next.add(id);
    } else {
      next.delete(id);
    }
    setSelectedIds(next);
  };

  if (challans.length === 0) {
    return (
      <div className="theme-card rounded-2xl shadow-sm p-10 text-center">
        <p className="theme-text-muted text-sm">No challans yet. Create your first one above.</p>
      </div>
    );
  }

  return (
    <div className="theme-card rounded-2xl shadow-sm overflow-hidden w-full max-w-full min-w-0">
      <div className="px-4 sm:px-6 py-4 border-b border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <h3 className="font-semibold theme-text-primary text-sm sm:text-base">Saved Challans</h3>
        <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 text-xs sm:text-sm text-gray-500">
          <span>{challans.length} document{challans.length !== 1 ? 's' : ''}</span>
          {(role === 'admin' || role === 'superadmin') && (
            <>
              <span className="hidden sm:inline text-gray-300">|</span>
              {(() => {
                const totals = challans.reduce((acc, c) => {
                  const mrp = (c.lineItems || []).reduce((sum, i) => sum + ((i.mrp || 0) * (i.quantity || 1)), 0);
                  const comm = mrp * 0.055;
                  
                  acc.mrp += mrp;
                  acc.commission += comm;

                  let pCost = 0;
                  if (c.procurementCost !== undefined && c.procurementCost !== null) {
                    pCost = Number(c.procurementCost);
                  } else {
                    pCost = (c.lineItems || []).reduce((sum, item: any) => sum + ((Number(item.procurementCost) || 0) * (Number(item.quantity) || 1)), 0);
                  }
                  
                  acc.goods += pCost;
                  acc.transport += (c.transportCost || 0);
                  
                  return acc;
                }, { mrp: 0, commission: 0, goods: 0, transport: 0 });
                
                const revenue = totals.mrp - totals.commission;
                const cost = totals.goods + totals.transport + challans.reduce((acc, c) => acc + (c.otherCharges || 0), 0);
                const profit = revenue - cost;

                return (
                  <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 text-[11px] sm:text-xs">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-md font-black bg-indigo-50 text-indigo-700 border border-indigo-200/80">
                      Total: ₹{totals.mrp.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                    </span>
                    {showFinancials && (
                      <>
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md font-semibold bg-rose-50 text-rose-700 border border-rose-200/80">
                          Comm: -₹{totals.commission.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                        </span>
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                          Goods: ₹{totals.goods.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                        </span>
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                          Trans: ₹{totals.transport.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                        </span>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-md font-black border ${
                          profit >= 0 
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-300' 
                            : 'bg-rose-50 text-rose-800 border-rose-300'
                        }`}>
                          Profit: ₹{profit.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                        </span>
                      </>
                    )}
                  </div>
                );
              })()}
            </>
          )}
        </div>
      </div>

      {/* Floating Selection Bar */}
      {selectedIds.size > 0 && role === 'admin' && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-gray-900 text-white px-6 py-3 rounded-full shadow-2xl border border-gray-700 z-50 flex flex-wrap items-center justify-center gap-4 animate-in slide-in-from-bottom-8">
          {(() => {
            const challansToAggregate = challans.filter(c => c.id && selectedIds.has(c.id));
            const totals = challansToAggregate.reduce((acc, c) => {
              const mrp = (c.lineItems || []).reduce((sum, i) => sum + ((i.mrp || 0) * (i.quantity || 1)), 0);
              acc.mrp += mrp;
              return acc;
            }, { mrp: 0 });

            return (
              <>
                <div className="flex items-center gap-2 pr-4 border-r border-gray-700 font-medium">
                  <span className="bg-[#3b2fc9] text-white text-xs px-2 py-0.5 rounded-full">{selectedIds.size}</span>
                  Selected
                </div>
                <div className="flex items-center gap-4 text-sm font-bold">
                  <span>MRP: ₹{totals.mrp.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
                <button 
                  onClick={() => handleSelectAll(false)}
                  className="ml-2 text-gray-400 hover:text-white transition-colors text-sm"
                >
                  Clear
                </button>
              </>
            );
          })()}
        </div>
      )}

      {/* Mobile Feed Style Card List (< lg) */}
      <div className="block lg:hidden p-2.5 sm:p-3 space-y-3.5 bg-transparent">
        {challans.map((challan) => {
          const mrpTotal = (challan.lineItems || []).reduce((acc, item) => acc + ((item.mrp || 0) * (item.quantity || 1)), 0);
          const topItems = (challan.lineItems || []).slice(0, 2);
          const extraItemsCount = (challan.lineItems?.length || 0) - 2;

          return (
            <TiltCard
              key={challan.id}
              className="relative overflow-hidden rounded-3xl theme-card theme-card-shimmer shadow-lg transition-all group"
            >
              {/* Swipe Action Reveal Rail (revealed behind card when swiped left) */}
              <div className="absolute inset-y-0 right-0 flex items-stretch z-0">
                <button
                  type="button"
                  className="w-20 bg-purple-600 hover:bg-purple-700 active:bg-purple-800 text-white flex flex-col items-center justify-center gap-1 transition-colors px-1 shadow-inner"
                  onClick={() => {
                    triggerHaptic('light');
                    onDuplicateChallan(challan);
                    setSwipedId(null);
                  }}
                  title="Duplicate Challan"
                >
                  <Copy className="h-5 w-5 stroke-[2.2]" />
                  <span className="text-[11px] font-bold">Duplicate</span>
                </button>
                <button
                  type="button"
                  className="w-16 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white flex flex-col items-center justify-center gap-1 transition-colors px-1 shadow-inner"
                  onClick={() => {
                    triggerHaptic('medium');
                    onDownloadChallan(challan);
                    setSwipedId(null);
                  }}
                  title="Download PDF"
                >
                  <Download className="h-5 w-5 stroke-[2.2]" />
                  <span className="text-[11px] font-bold">PDF</span>
                </button>
              </div>

              {/* The swipeable card surface */}
              <div
                className={`relative z-10 theme-card rounded-3xl p-4 space-y-3 transition-transform duration-200 ease-out ${
                  challan.location === 'hyderabad'
                    ? 'border-t-4 border-t-sky-500'
                    : 'border-t-4 border-t-emerald-500'
                } ${swipedId === challan.id ? '-translate-x-36 shadow-md' : 'translate-x-0'}`}
                onTouchStart={handleCardTouchStart}
                onTouchEnd={(e) => handleCardTouchEnd(e, challan)}
                onClick={() => {
                  if (swipedId === challan.id) setSwipedId(null);
                }}
              >
                {/* Card Header: Checkbox, DC Number, Date, Location Pill */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3 min-w-0">
                    <input
                      type="checkbox"
                      className="rounded-lg border-slate-300 text-indigo-600 focus:ring-indigo-500 w-5 h-5 shrink-0"
                      checked={!!challan.id && selectedIds.has(challan.id)}
                      onChange={(e) => challan.id && handleSelectOne(challan.id, e.target.checked)}
                    />
                    <div className="min-w-0">
                      <span className="font-mono font-black tabular-nums text-slate-950 dark:text-white text-base sm:text-lg leading-tight block truncate">
                        {challan.dcNumber}
                      </span>
                      <span className="text-xs text-slate-500 dark:text-slate-400 font-semibold tabular-nums flex items-center gap-1 mt-0.5">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        {challan.dcDate ? format(new Date(challan.dcDate), 'dd MMM yyyy') : '—'}
                      </span>
                    </div>
                  </div>

                  {/* Contextual Location Pill Badge */}
                  <Badge
                    variant="outline"
                    className={
                      challan.location === 'hyderabad'
                        ? 'border-sky-300 text-sky-800 dark:text-sky-300 bg-sky-50 dark:bg-sky-950/60 text-xs px-2.5 py-1 rounded-full font-black shadow-2xs flex items-center gap-1.5 shrink-0'
                        : 'border-emerald-300 text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 text-xs px-2.5 py-1 rounded-full font-black shadow-2xs flex items-center gap-1.5 shrink-0'
                    }
                  >
                    <span className={`w-2 h-2 rounded-full ${
                      challan.location === 'hyderabad' ? 'bg-sky-500' : 'bg-emerald-500'
                    }`} />
                    <span>{NEWRELIC_LOCATIONS[challan.location]?.label ?? challan.location}</span>
                  </Badge>
                </div>

                {/* Total Value & Item Count Inset Banner */}
                <div className="flex items-center justify-between theme-card-subtle rounded-2xl p-3">
                  <div>
                    <span className="text-[11px] uppercase font-bold tracking-wider theme-text-muted block">
                      Total Value
                    </span>
                    <RollingCashCounter
                      value={mrpTotal}
                      className="text-xl font-black font-mono tracking-tight theme-text-primary block"
                    />
                  </div>
                  <div className="text-right">
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full theme-card theme-text-primary shadow-2xs">
                      <Package className="w-3.5 h-3.5 text-[var(--theme-accent)]" />
                      {(challan.lineItems || []).length} Item{(challan.lineItems || []).length !== 1 ? 's' : ''}
                    </span>
                  </div>
                </div>

                {/* Items Preview Snippet with Tap-to-Expand */}
                {(() => {
                  const isExpanded = challan.id ? expandedCards.has(challan.id) : false;
                  const items = challan.lineItems || [];

                  return (
                    <div className="theme-card-subtle rounded-2xl p-3 text-xs theme-text-primary space-y-1.5">
                      {!isExpanded ? (
                        <div>
                          {topItems.length > 0 && (
                            <p className="text-xs theme-text-muted truncate leading-relaxed">
                              <span className="font-semibold theme-text-primary">{topItems.map(i => `${i.quantity}x ${i.itemName}`).join(', ')}</span>
                              {extraItemsCount > 0 ? ` +${extraItemsCount} more` : ''}
                            </p>
                          )}
                          {items.length > 2 && (
                            <button
                              type="button"
                              onClick={() => challan.id && toggleCardExpand(challan.id)}
                              className="text-xs text-indigo-600 dark:text-indigo-400 font-bold flex items-center gap-1 mt-1.5 hover:underline cursor-pointer"
                            >
                              <span>Show all {items.length} items</span>
                              <ChevronDown className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      ) : (
                        <div className="space-y-1.5 pt-1 border-t border-slate-200/70 dark:border-slate-700 animate-in fade-in duration-200">
                          <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                            {items.map((item, idx) => (
                              <div key={idx} className="flex items-center justify-between text-xs py-1 border-b border-slate-100 dark:border-slate-800 last:border-0">
                                <span className="text-slate-800 dark:text-slate-200 truncate pr-2">
                                  <span className="font-black tabular-nums text-slate-950 dark:text-white">{item.quantity}×</span> {item.itemName}
                                </span>
                                <span className="text-slate-700 dark:text-slate-300 font-bold tabular-nums shrink-0">
                                  ₹{((item.mrp || 0) * (item.quantity || 1)).toLocaleString('en-IN')}
                                </span>
                              </div>
                            ))}
                          </div>
                          <button
                            type="button"
                            onClick={() => challan.id && toggleCardExpand(challan.id)}
                            className="text-xs text-slate-500 font-bold flex items-center gap-1 pt-1.5 hover:text-slate-700 cursor-pointer"
                          >
                            <span>Collapse items</span>
                            <ChevronUp className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* Author & Audit Info (if admin or trash) */}
                {role === 'admin' && (
                  <div className="flex items-center justify-between text-xs text-slate-400 pt-0.5">
                    <span>{isTrashView ? 'Deleted by' : 'Created by'}</span>
                    <span className="font-semibold text-slate-600 dark:text-slate-300 truncate max-w-[190px]">
                      {formatAuthorName((isTrashView ? challan.deletedBy : (challan.createdBy || challan.updatedBy)))}
                      {(isTrashView ? challan.deletedAt : challan.createdAt) && (
                        <span className="text-slate-400 ml-1 font-normal">
                          · {format(new Date(isTrashView ? challan.deletedAt! : challan.createdAt!), 'dd MMM')}
                        </span>
                      )}
                    </span>
                  </div>
                )}

                {/* Admin Financials Snapshot */}
                {role === 'admin' && showFinancials && (() => {
                  const commission = mrpTotal * 0.055;
                  const revenue = mrpTotal - commission;
                  let pCost = 0;
                  if (challan.procurementCost !== undefined && challan.procurementCost !== null) {
                    pCost = Number(challan.procurementCost);
                  } else {
                    pCost = (challan.lineItems || []).reduce((sum, item: any) => sum + ((Number(item.procurementCost) || 0) * (Number(item.quantity) || 1)), 0);
                  }
                  const tCost = challan.transportCost || 0;
                  const oCost = challan.otherCharges || 0;
                  const totalCost = pCost + tCost + oCost;
                  const profit = revenue - totalCost;

                  return (
                    <div className="bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/60 rounded-2xl p-3 text-xs space-y-1.5">
                      <div className="flex justify-between items-center text-slate-600 dark:text-slate-400 font-medium">
                        <span className="truncate pr-2">Net Revenue (less 5.5% comm):</span>
                        <span className="font-bold font-mono text-slate-900 dark:text-slate-200 shrink-0">₹{revenue.toLocaleString('en-IN', { maximumFractionDigits: 1 })}</span>
                      </div>
                      <div className="flex justify-between items-center text-slate-600 dark:text-slate-400 font-medium">
                        <span className="truncate pr-2">Total Cost (P.Cost + Transport):</span>
                        <span className="font-bold font-mono text-slate-900 dark:text-slate-200 shrink-0">₹{totalCost.toLocaleString('en-IN', { maximumFractionDigits: 1 })}</span>
                      </div>
                      <div className="flex justify-between items-center pt-1.5 border-t border-indigo-100 dark:border-indigo-900/60 font-black">
                        <span className={`truncate pr-2 ${profit >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-700 dark:text-red-400'}`}>Est. Profit:</span>
                        <span className={`font-mono text-sm shrink-0 ${profit >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-700 dark:text-red-400'}`}>
                          ₹{profit.toLocaleString('en-IN', { maximumFractionDigits: 1 })}
                        </span>
                      </div>
                    </div>
                  );
                })()}

                {/* Mobile Attachment Buttons: Signed DC & Invoice */}
                {!isTrashView && (
                  <div className={`grid ${canViewSignedCopies ? 'grid-cols-2' : 'grid-cols-1'} gap-2 pt-1 border-t border-slate-100 dark:border-slate-800`}>
                    {canViewSignedCopies && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          triggerHaptic('light');
                          setAttachmentModal({ challan, type: 'signed_copy' });
                        }}
                        className={`h-10 px-3 rounded-2xl text-xs font-bold flex items-center justify-center gap-2 border transition-all active:scale-[0.98] ${
                          (challan.signedCopyUrls?.length ?? 0) > 0
                            ? 'bg-emerald-50/90 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 shadow-2xs'
                            : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50'
                        }`}
                        title="Upload or view Signed Delivery Challan copy"
                      >
                        <FileCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                        <span className="truncate">Signed DC</span>
                        {(challan.signedCopyUrls?.length ?? 0) > 0 ? (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-600 text-white text-[10px] font-black shrink-0">
                            {challan.signedCopyUrls!.length}
                          </span>
                        ) : (
                          <span className="text-[11px] text-slate-400 font-semibold shrink-0">+Upload</span>
                        )}
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        triggerHaptic('light');
                        setAttachmentModal({ challan, type: 'goods_received' });
                      }}
                      className={`h-10 px-3 rounded-2xl text-xs font-bold flex items-center justify-center gap-2 border transition-all active:scale-[0.98] ${
                        (challan.goodsReceivedInvoiceUrls?.length ?? 0) > 0
                          ? 'bg-blue-50/90 dark:bg-blue-950/40 border-blue-300 dark:border-blue-800 text-blue-800 dark:text-blue-300 shadow-2xs'
                          : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50'
                      }`}
                      title="Upload or view Goods Received / Purchase Invoice"
                    >
                      <Receipt className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                      <span className="truncate">Invoice</span>
                      {(challan.goodsReceivedInvoiceUrls?.length ?? 0) > 0 ? (
                        <span className="px-2 py-0.5 rounded-full bg-blue-600 text-white text-[10px] font-black shrink-0">
                          {challan.goodsReceivedInvoiceUrls!.length}
                        </span>
                      ) : (
                        <span className="text-[11px] text-slate-400 font-semibold shrink-0">+Upload</span>
                      )}
                    </button>
                  </div>
                )}

                {/* Mobile Actions: View, PDF, Edit, Duplicate in the EXACT SAME LINE */}
                <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                  {isTrashView ? (
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full h-11 text-xs gap-1.5 border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 rounded-2xl font-bold shadow-2xs"
                      onClick={(e) => {
                        e.stopPropagation();
                        triggerHaptic('medium');
                        onRestoreChallan && challan.id && onRestoreChallan(challan.id);
                      }}
                    >
                      <RefreshCcw className="h-4 w-4 text-emerald-600" /> Restore Challan
                    </Button>
                  ) : (
                    <div className={`grid ${role === 'admin' && onAdminPreviewChallan ? 'grid-cols-5' : 'grid-cols-4'} gap-1.5 sm:gap-2`}>
                      {/* View Document */}
                      <Button
                        variant="default"
                        size="sm"
                        className="h-10 px-1 bg-gradient-to-r from-indigo-600 to-[#3b2fc9] hover:from-indigo-700 hover:to-[#2d23a0] text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1 shadow-xs active:scale-95 transition-transform"
                        onClick={(e) => {
                          e.stopPropagation();
                          triggerHaptic('light');
                          onPreviewChallan ? onPreviewChallan(challan) : onDownloadChallan(challan);
                        }}
                        title="View Challan"
                      >
                        <Eye className="h-4 w-4 shrink-0" />
                        <span className="truncate">View</span>
                      </Button>

                      {/* PDF Download */}
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-10 px-1 border-blue-200 dark:border-blue-800 bg-blue-50/90 dark:bg-blue-950/40 hover:bg-blue-100 text-blue-700 dark:text-blue-300 rounded-xl text-xs font-bold flex items-center justify-center gap-1 active:scale-95 transition-transform shadow-2xs"
                        onClick={(e) => {
                          e.stopPropagation();
                          triggerHaptic('medium');
                          onDownloadChallan(challan);
                        }}
                        title="Download PDF"
                      >
                        <Download className="h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" />
                        <span className="truncate">PDF</span>
                      </Button>

                      {/* Edit */}
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-10 px-1 border-amber-200 dark:border-amber-800 bg-amber-50/90 dark:bg-amber-950/40 hover:bg-amber-100 text-amber-800 dark:text-amber-200 rounded-xl text-xs font-bold flex items-center justify-center gap-1 active:scale-95 transition-transform shadow-2xs"
                        onClick={(e) => {
                          e.stopPropagation();
                          triggerHaptic('light');
                          onSelectChallan(challan);
                        }}
                        title="Edit Challan"
                      >
                        <Edit2 className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
                        <span className="truncate">Edit</span>
                      </Button>

                      {/* Duplicate */}
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-10 px-1 border-purple-200 dark:border-purple-800 bg-purple-50/90 dark:bg-purple-950/40 hover:bg-purple-100 text-purple-800 dark:text-purple-200 rounded-xl text-xs font-bold flex items-center justify-center gap-1 active:scale-95 transition-transform shadow-2xs"
                        onClick={(e) => {
                          e.stopPropagation();
                          triggerHaptic('light');
                          onDuplicateChallan(challan);
                        }}
                        title="Duplicate Challan"
                      >
                        <Copy className="h-4 w-4 shrink-0 text-purple-600 dark:text-purple-400" />
                        <span className="truncate">Copy</span>
                      </Button>

                      {/* Admin Quick View (Admin Only) */}
                      {role === 'admin' && onAdminPreviewChallan && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-10 px-1 border-rose-200 dark:border-rose-800 bg-rose-50/90 dark:bg-rose-950/40 hover:bg-rose-100 text-rose-700 dark:text-rose-300 rounded-xl text-xs font-bold flex items-center justify-center gap-1 active:scale-95 transition-transform shadow-2xs"
                          onClick={(e) => {
                            e.stopPropagation();
                            triggerHaptic('light');
                            onAdminPreviewChallan(challan);
                          }}
                          title="Admin Quick View (Margins & Costs)"
                        >
                          <Receipt className="h-4 w-4 shrink-0 text-rose-600 dark:text-rose-400" />
                          <span className="truncate">Margin</span>
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </TiltCard>
          );
        })}
      </div>

      {/* Desktop Table View (>= lg) */}
      <div className="hidden lg:block overflow-x-auto min-w-0 w-full max-w-full">
        <Table className="min-w-[1050px]">
          <TableHeader>
            <TableRow className="bg-gradient-to-r from-slate-50 via-indigo-50/40 to-slate-50 border-b border-indigo-100/70 hover:bg-slate-50">
              <TableHead className="w-[40px] pl-4">
                <input 
                  type="checkbox"
                  className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                  checked={challans.length > 0 && selectedIds.size === challans.filter(c => c.id).length}
                  onChange={(e) => handleSelectAll(e.target.checked)}
                />
              </TableHead>
              <TableHead className="font-bold text-gray-700 text-xs uppercase tracking-wider">DC No</TableHead>
              <TableHead className="font-bold text-gray-700 text-xs uppercase tracking-wider">Date</TableHead>
              <TableHead className="font-bold text-gray-700 text-xs uppercase tracking-wider">Location</TableHead>
              <TableHead className="font-bold text-gray-700 text-xs uppercase tracking-wider text-center">Items</TableHead>
              {(role === 'admin' || role === 'superadmin') && (
                <>
                  <TableHead className="font-bold text-gray-700 text-xs uppercase tracking-wider">{isTrashView ? 'Deleted By' : 'Author'}</TableHead>
                  <TableHead className="font-bold text-[#3b2fc9] text-xs uppercase tracking-wider text-right">Value (MRP)</TableHead>
                  {showFinancials && (
                    <>
                      <TableHead className="font-bold text-gray-700 text-xs uppercase tracking-wider text-right">Rev</TableHead>
                      <TableHead className="font-bold text-gray-700 text-xs uppercase tracking-wider text-right">Cost</TableHead>
                      <TableHead className="font-bold text-gray-700 text-xs uppercase tracking-wider text-right">Profit</TableHead>
                    </>
                  )}
                </>
              )}
              <TableHead className="font-bold text-gray-700 text-xs uppercase tracking-wider text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {challans.map((challan) => (
              <TableRow key={challan.id} className="hover:bg-indigo-50/30 transition-colors">
                <TableCell className="pl-4">
                  <input
                    type="checkbox"
                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                    checked={!!challan.id && selectedIds.has(challan.id)}
                    onChange={(e) => challan.id && handleSelectOne(challan.id, e.target.checked)}
                  />
                </TableCell>
                <TableCell className="font-mono font-bold tabular-nums text-indigo-950">
                  {challan.dcNumber}
                </TableCell>
                <TableCell className="text-gray-600 font-medium text-xs tabular-nums">
                  {challan.dcDate
                    ? format(new Date(challan.dcDate), 'dd-MM-yyyy')
                    : '—'}
                </TableCell>
                <TableCell>
                  <Badge
                    variant="outline"
                    className={
                      challan.location === 'hyderabad'
                        ? 'border-sky-300 text-sky-800 bg-gradient-to-r from-sky-50 to-blue-50 font-bold px-2.5 py-0.5 rounded-full shadow-2xs inline-flex items-center gap-1.5'
                        : 'border-emerald-300 text-emerald-800 bg-gradient-to-r from-emerald-50 to-teal-50 font-bold px-2.5 py-0.5 rounded-full shadow-2xs inline-flex items-center gap-1.5'
                    }
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${
                      challan.location === 'hyderabad' ? 'bg-sky-500' : 'bg-emerald-500'
                    }`} />
                    <span>{NEWRELIC_LOCATIONS[challan.location]?.label ?? challan.location}</span>
                  </Badge>
                </TableCell>
                <TableCell className="text-center text-gray-700 font-bold tabular-nums">
                  {challan.lineItems?.length ?? 0}
                </TableCell>
                {(role === 'admin' || role === 'superadmin') && (
                  <>
                    <TableCell>
                      <div className="flex flex-col text-[11px]">
                        <span className="font-medium text-gray-700 truncate max-w-[150px]" title={(isTrashView ? challan.deletedBy : (challan.createdBy || challan.updatedBy)) || 'System'}>
                          {formatAuthorName((isTrashView ? challan.deletedBy : (challan.createdBy || challan.updatedBy)))}
                        </span>
                        {(isTrashView ? challan.deletedAt : challan.createdAt) && (
                          <span className="text-gray-400">
                            {format(new Date((isTrashView ? challan.deletedAt : challan.createdAt)), 'dd-MMM-yy')}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    {(() => {
                      const mrpTotal = (challan.lineItems || []).reduce((acc, item) => acc + ((item.mrp || 0) * (item.quantity || 1)), 0);
                      const commission = mrpTotal * 0.055;
                      const revenue = mrpTotal - commission;
                      
                      let pCost = 0;
                      if (challan.procurementCost !== undefined && challan.procurementCost !== null) {
                        pCost = Number(challan.procurementCost);
                      } else {
                        pCost = (challan.lineItems || []).reduce((sum, item: any) => sum + ((Number(item.procurementCost) || 0) * (Number(item.quantity) || 1)), 0);
                      }
                      
                      const tCost = challan.transportCost || 0;
                      const oCost = challan.otherCharges || 0;
                      const totalCost = pCost + tCost + oCost;
                      const profit = revenue - totalCost;

                      return (
                        <>
                          <TableCell className="text-right whitespace-nowrap align-top pt-3 tabular-nums font-mono font-bold text-[#3b2fc9] text-xs">
                            ₹{mrpTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </TableCell>
                          {showFinancials && (
                            <>
                              <TableCell className="text-right whitespace-nowrap align-top pt-3">
                                <div className="flex flex-col text-[11px] items-end leading-tight tabular-nums">
                                  <span className="text-gray-400" title="5.5% Commission">- ₹{commission.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                  <span className="font-bold text-[13px] text-gray-900 border-t border-gray-200 mt-1 pt-1 w-full text-right">
                                     ₹{revenue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                  </span>
                                </div>
                              </TableCell>
                              <TableCell className="text-right whitespace-nowrap align-top pt-3">
                                <div className="flex flex-col text-[11px] items-end leading-tight text-gray-500 tabular-nums">
                                  <span>Goods: ₹{pCost.toLocaleString('en-IN')}</span>
                                  <span>Trans: ₹{tCost.toLocaleString('en-IN')}</span>
                                  <span>Other: ₹{oCost.toLocaleString('en-IN')}</span>
                                  <span className="font-bold text-[13px] text-gray-900 border-t border-gray-200 mt-1 pt-1 w-full text-right">
                                     ₹{totalCost.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                  </span>
                                </div>
                              </TableCell>
                              <TableCell className="text-right font-medium whitespace-nowrap align-top pt-3">
                                <div className="flex flex-col items-end w-full h-full justify-end pb-[2px] tabular-nums font-bold">
                                  <span className={profit >= 0 ? "text-emerald-700" : "text-red-700"}>
                                    ₹{profit.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                  </span>
                                </div>
                              </TableCell>
                            </>
                          )}
                        </>
                      );
                    })()}
                  </>
                )}
                <TableCell>
                  <div className="flex items-center justify-end gap-1">
                    {isTrashView ? (
                      role === 'admin' ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 gap-1 mr-2"
                          onClick={() => onRestoreChallan && challan.id && onRestoreChallan(challan.id)}
                          title="Restore"
                        >
                          <RefreshCcw className="h-4 w-4" /> Restore
                        </Button>
                      ) : null
                    ) : (
                      <>
                        {/* Attachment: Signed DC */}
                        {canViewSignedCopies && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              triggerHaptic('light');
                              setAttachmentModal({ challan, type: 'signed_copy' });
                            }}
                            className={`h-7 px-1.5 rounded-lg text-[10px] font-bold flex items-center gap-1 ${
                              (challan.signedCopyUrls?.length ?? 0) > 0
                                ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200/80 shadow-2xs'
                                : 'text-gray-400 hover:text-emerald-700 hover:bg-emerald-50'
                            }`}
                            title="Manage Signed Copies"
                          >
                            <Paperclip className="w-3 h-3 text-emerald-600" />
                            <span className="hidden xl:inline">Signed</span>
                            {(challan.signedCopyUrls?.length ?? 0) > 0 && (
                              <span className="ml-0.5 px-1 py-0.2 rounded-full bg-emerald-600 text-white text-[8px] font-black">
                                {challan.signedCopyUrls!.length}
                              </span>
                            )}
                          </Button>
                        )}

                        {/* Attachment: Invoice */}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            triggerHaptic('light');
                            setAttachmentModal({ challan, type: 'goods_received' });
                          }}
                          className={`h-7 px-1.5 rounded-lg text-[10px] font-bold flex items-center gap-1 ${
                            (challan.goodsReceivedInvoiceUrls?.length ?? 0) > 0
                              ? 'bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200/80 shadow-2xs'
                              : 'text-gray-400 hover:text-blue-700 hover:bg-blue-50'
                          }`}
                          title="Goods Received Invoice"
                        >
                          <FileText className="w-3 h-3 text-blue-600" />
                          <span className="hidden xl:inline">Invoice</span>
                          {(challan.goodsReceivedInvoiceUrls?.length ?? 0) > 0 && (
                            <span className="ml-0.5 px-1 py-0.2 rounded-full bg-blue-600 text-white text-[8px] font-black">
                              {challan.goodsReceivedInvoiceUrls!.length}
                            </span>
                          )}
                        </Button>

                        {/* Edit in Form */}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-gray-500 hover:text-[#3b2fc9] hover:bg-indigo-50"
                          onClick={() => {
                            triggerHaptic('light');
                            onSelectChallan(challan);
                          }}
                          title="Edit in Form"
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-gray-500 hover:text-purple-600"
                          onClick={() => {
                            triggerHaptic('light');
                            onDuplicateChallan(challan);
                          }}
                          title="Duplicate with next DC number"
                        >
                          <Copy className="h-4 w-4 text-purple-600" />
                        </Button>
                        {onPreviewChallan && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-gray-500 hover:text-[#3b2fc9]"
                            onClick={() => onPreviewChallan(challan)}
                            title="Preview Document"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        )}
                        {role === 'admin' && onAdminPreviewChallan && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-gray-500 hover:text-[#3b2fc9]"
                            onClick={() => onAdminPreviewChallan(challan)}
                            title="Admin Quick View"
                          >
                            <Receipt className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-gray-500 hover:text-[#3b2fc9]"
                          onClick={() => onDownloadChallan(challan)}
                          title="Download PDF"
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                        {role === 'admin' && onViewHistory && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-gray-500 hover:text-[#3b2fc9]"
                            onClick={() => onViewHistory(challan)}
                            title="View Edit History"
                          >
                            <History className="h-4 w-4" />
                          </Button>
                        )}
                      </>
                    )}
                        {hasDeleteClearance && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-gray-400 hover:text-red-500"
                            title="Delete"
                            onClick={() => setDeleteConfirmChallan(challan)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Shared Delete Confirmation Alert Dialog */}
      <AlertDialog
        open={!!deleteConfirmChallan}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteConfirmChallan(null);
            setDeleteConfirmationInput('');
          }
        }}
      >
        <AlertDialogContent className="w-[90vw] max-w-lg rounded-2xl">
          <AlertDialogHeader>
            <div className="flex items-center gap-2.5 text-red-600 mb-1">
              <div className="p-2 rounded-xl bg-red-100 dark:bg-red-950/50">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <AlertDialogTitle className="text-base sm:text-lg font-bold text-gray-900 dark:text-gray-100">
                {isTrashView ? 'Permanent Destroy Safeguard' : 'Delete Challan Safeguard'}
              </AlertDialogTitle>
            </div>
            <AlertDialogDescription asChild>
              <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-300 space-y-3 pt-1">
                <p>
                  {isTrashView ? (
                    <>
                      This will <strong className="text-red-600 font-bold">permanently destroy</strong> all records, line items, and audit history for this challan. This cannot be undone.
                    </>
                  ) : (
                    <>
                      This will remove challan <strong className="text-gray-900 dark:text-white font-mono">{deleteConfirmChallan?.dcNumber}</strong> and move it to Trash.
                    </>
                  )}
                </p>
                <div className="p-3 rounded-xl bg-gray-50 dark:bg-gray-800/60 border border-gray-200/80 dark:border-gray-700 space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-gray-500">DC Number:</span>
                    <span className="font-mono font-bold text-gray-900 dark:text-gray-100 select-all">
                      {deleteConfirmChallan?.dcNumber}
                    </span>
                  </div>
                  {deleteConfirmChallan?.location && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">Location:</span>
                      <span className="font-medium text-gray-800 dark:text-gray-200">
                        {deleteConfirmChallan.location}
                      </span>
                    </div>
                  )}
                  {deleteConfirmChallan?.dcDate && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">Date:</span>
                      <span className="font-medium text-gray-800 dark:text-gray-200">
                        {format(new Date(deleteConfirmChallan.dcDate), 'dd MMM yyyy')}
                      </span>
                    </div>
                  )}
                  {deleteConfirmChallan?.lineItems && deleteConfirmChallan.lineItems.length > 0 && (
                    <>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Items:</span>
                        <span className="font-medium text-gray-800 dark:text-gray-200">
                          {deleteConfirmChallan.lineItems.length} items
                        </span>
                      </div>
                      <div className="flex justify-between pt-1 border-t border-gray-200 dark:border-gray-700 font-bold">
                        <span className="text-gray-500">Total MRP:</span>
                        <span className="font-mono text-gray-900 dark:text-gray-100">
                          ₹{deleteConfirmChallan.lineItems
                            .reduce((acc, item) => acc + (item.mrp || 0) * (item.quantity || 1), 0)
                            .toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>
                    </>
                  )}
                </div>
                <div className="space-y-1.5 pt-1">
                  <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 block">
                    To confirm, type <span className="font-mono font-bold text-red-600 select-all">{deleteConfirmChallan?.dcNumber}</span> below:
                  </label>
                  <Input
                    value={deleteConfirmationInput}
                    onChange={(e) => setDeleteConfirmationInput(e.target.value)}
                    placeholder={deleteConfirmChallan?.dcNumber}
                    className="font-mono text-sm border-red-200 focus-visible:ring-red-500/30"
                    autoFocus
                  />
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-0 mt-2">
            <AlertDialogCancel
              onClick={() => {
                setDeleteConfirmChallan(null);
                setDeleteConfirmationInput('');
              }}
              className="rounded-xl text-xs font-semibold"
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold disabled:opacity-40 disabled:cursor-not-allowed"
              disabled={
                deleteConfirmationInput.trim().toUpperCase() !==
                (deleteConfirmChallan?.dcNumber || '').trim().toUpperCase()
              }
              onClick={() => {
                if (deleteConfirmChallan?.id) {
                  logAuditEvent({
                    actorEmail: user?.email || 'user',
                    actorRole: effectiveRole || 'user',
                    action: 'dc_deleted',
                    actionLabel: isTrashView ? 'Permanently Destroyed DC' : 'Moved DC to Trash',
                    targetType: 'challan',
                    targetId: deleteConfirmChallan.id,
                    targetLabel: deleteConfirmChallan.dcNumber,
                    details: { location: deleteConfirmChallan.location, isTrashView: !!isTrashView },
                  });
                  onDeleteChallan(deleteConfirmChallan.id);
                }
                setDeleteConfirmChallan(null);
                setDeleteConfirmationInput('');
              }}
            >
              {isTrashView ? 'Confirm & Destroy Permanently' : 'Confirm & Move to Trash'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Attachment Modal (Signed DC / Invoice) ── */}
      {attachmentModal && (
        <NewRelicAttachmentModal
          isOpen={!!attachmentModal}
          onClose={() => setAttachmentModal(null)}
          challan={attachmentModal.challan}
          type={attachmentModal.type}
          title={attachmentModal.type === 'signed_copy' ? 'Signed Copies' : 'Goods Received Invoice'}
          onUpdate={(updatedUrls) => {
            if (updatedUrls && attachmentModal.challan) {
              if (attachmentModal.type === 'signed_copy') {
                attachmentModal.challan.signedCopyUrls = updatedUrls;
              } else {
                attachmentModal.challan.goodsReceivedInvoiceUrls = updatedUrls;
              }
            }
          }}
        />
      )}
    </div>
  );
}
