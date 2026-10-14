'use client';
import { NewRelicChallan } from '@/types/challan';

import React, { useState } from 'react';
import { format } from 'date-fns';
import { Trash2, Download, Edit2, Copy, RefreshCcw, History, Eye, Receipt, MoreVertical, FileText, Share2, ChevronDown, ChevronUp } from 'lucide-react';
import { triggerHaptic } from '@/lib/haptics';
import { useToast } from '@/hooks/use-toast';
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
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleteConfirmChallan, setDeleteConfirmChallan] = useState<NewRelicChallan | null>(null);
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());

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

  const handleShareChallan = async (challan: NewRelicChallan) => {
    triggerHaptic('medium');
    const locLabel = NEWRELIC_LOCATIONS[challan.location]?.label || challan.location;
    const dateFormatted = challan.dcDate ? format(new Date(challan.dcDate), 'dd MMM yyyy') : '';
    const itemsCount = challan.lineItems?.length || 0;
    const totalQty = (challan.lineItems || []).reduce((sum, item) => sum + (item.quantity || 1), 0);
    const mrpTotal = (challan.lineItems || []).reduce((sum, item) => sum + ((item.mrp || 0) * (item.quantity || 1)), 0);

    const shareText = `📦 Delivery Challan: ${challan.dcNumber}\n📍 Location: ${locLabel}\n📅 Date: ${dateFormatted}\n📋 Items: ${itemsCount} items (${totalQty} units)\n💰 Total MRP: ₹${mrpTotal.toLocaleString('en-IN')}`;

    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: `Challan ${challan.dcNumber}`,
          text: shareText,
        });
        return;
      } catch (err: any) {
        if (err.name === 'AbortError') return;
      }
    }

    // Fallback: copy to clipboard or WhatsApp
    const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(shareText)}`;
    window.open(waUrl, '_blank');
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
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-10 text-center">
        <p className="text-gray-400 text-sm">No challans yet. Create your first one above.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="px-4 sm:px-6 py-4 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <h3 className="font-semibold text-gray-900 text-sm sm:text-base">Saved Challans</h3>
        <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 text-xs sm:text-sm text-gray-500">
          <span>{challans.length} document{challans.length !== 1 ? 's' : ''}</span>
          {role === 'admin' && showFinancials && (
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
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span className="text-gray-600">MRP: ₹{totals.mrp.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    <span className="text-red-500/80">Comm: -₹{totals.commission.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    <span className="text-gray-600">Goods: ₹{totals.goods.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    <span className="text-gray-600">Trans: ₹{totals.transport.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    <span className={`font-semibold ${profit >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                      Profit: ₹{profit.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
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

      {/* Mobile Feed Style Card List (< sm) */}
      <div className="block sm:hidden divide-y divide-gray-100 bg-gray-50/50 p-2.5 space-y-3">
        {challans.map((challan) => {
          const mrpTotal = (challan.lineItems || []).reduce((acc, item) => acc + ((item.mrp || 0) * (item.quantity || 1)), 0);
          const topItems = (challan.lineItems || []).slice(0, 2);
          const extraItemsCount = (challan.lineItems?.length || 0) - 2;

          return (
            <div
              key={challan.id}
              className={`bg-white rounded-2xl border p-4 shadow-2xs space-y-3 transition-all hover:shadow-md ${
                challan.location === 'hyderabad'
                  ? 'border-l-4 border-l-blue-500 border-gray-200/90'
                  : 'border-l-4 border-l-emerald-500 border-gray-200/90'
              }`}
            >
              {/* Card Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <input
                    type="checkbox"
                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                    checked={!!challan.id && selectedIds.has(challan.id)}
                    onChange={(e) => challan.id && handleSelectOne(challan.id, e.target.checked)}
                  />
                  <div>
                    <span className="font-mono font-black text-indigo-950 text-base leading-tight block">
                      {challan.dcNumber}
                    </span>
                    <span className="text-[11px] text-gray-500 font-medium">
                      📅 {challan.dcDate ? format(new Date(challan.dcDate), 'dd MMM yyyy') : '—'}
                    </span>
                  </div>
                </div>

                <Badge
                  variant="outline"
                  className={
                    challan.location === 'hyderabad'
                      ? 'border-blue-300 text-blue-800 bg-gradient-to-r from-blue-50 to-indigo-50 text-xs px-2.5 py-1 rounded-full font-bold shadow-2xs'
                      : 'border-emerald-300 text-emerald-800 bg-gradient-to-r from-emerald-50 to-teal-50 text-xs px-2.5 py-1 rounded-full font-bold shadow-2xs'
                  }
                >
                  📍 {NEWRELIC_LOCATIONS[challan.location]?.label ?? challan.location}
                </Badge>
              </div>

              {/* Items Preview Snippet with Tap-to-Expand */}
              {(() => {
                const isExpanded = challan.id ? expandedCards.has(challan.id) : false;
                const items = challan.lineItems || [];

                return (
                  <div className="bg-gray-50/90 rounded-xl p-2.5 text-xs text-gray-600 space-y-1.5 transition-all">
                    <div className="flex items-center justify-between font-medium text-gray-700">
                      <span className="flex items-center gap-1.5">
                        <FileText className="w-3.5 h-3.5 text-gray-400" />
                        <span>{items.length} line item{items.length !== 1 ? 's' : ''}</span>
                      </span>
                      {mrpTotal > 0 && (
                        <span className="font-semibold text-gray-900">
                          ₹{mrpTotal.toLocaleString('en-IN')}
                        </span>
                      )}
                    </div>

                    {!isExpanded ? (
                      <div>
                        {topItems.length > 0 && (
                          <p className="text-[11px] text-gray-500 truncate">
                            {topItems.map(i => `${i.quantity}x ${i.itemName}`).join(', ')}
                            {extraItemsCount > 0 ? ` +${extraItemsCount} more` : ''}
                          </p>
                        )}
                        {items.length > 2 && (
                          <button
                            type="button"
                            onClick={() => challan.id && toggleCardExpand(challan.id)}
                            className="text-[11px] text-[#3b2fc9] font-semibold flex items-center gap-1 mt-1 hover:underline cursor-pointer"
                          >
                            <span>Show all {items.length} items</span>
                            <ChevronDown className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-1.5 pt-1 border-t border-gray-200/70 animate-in fade-in duration-200">
                        <div className="max-h-48 overflow-y-auto space-y-1 pr-1">
                          {items.map((item, idx) => (
                            <div key={idx} className="flex items-center justify-between text-[11px] py-0.5 border-b border-gray-100 last:border-0">
                              <span className="text-gray-700 truncate pr-2">
                                <span className="font-semibold text-gray-900">{item.quantity}x</span> {item.itemName}
                              </span>
                              <span className="text-gray-500 font-medium shrink-0">
                                ₹{((item.mrp || 0) * (item.quantity || 1)).toLocaleString('en-IN')}
                              </span>
                            </div>
                          ))}
                        </div>
                        <button
                          type="button"
                          onClick={() => challan.id && toggleCardExpand(challan.id)}
                          className="text-[11px] text-gray-500 font-semibold flex items-center gap-1 pt-1 hover:text-gray-700 cursor-pointer"
                        >
                          <span>Collapse items</span>
                          <ChevronUp className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Author & Audit Info (if admin or trash) */}
              {role === 'admin' && (
                <div className="flex items-center justify-between text-[11px] text-gray-400 pt-0.5">
                  <span>{isTrashView ? 'Deleted by' : 'Created by'}</span>
                  <span className="font-medium text-gray-600 truncate max-w-[170px]">
                    {formatAuthorName((isTrashView ? challan.deletedBy : (challan.createdBy || challan.updatedBy)))}
                    {(isTrashView ? challan.deletedAt : challan.createdAt) && (
                      <span className="text-gray-400 ml-1">
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
                  <div className="bg-indigo-50/50 border border-indigo-100/70 rounded-xl p-2.5 text-xs space-y-1">
                    <div className="flex justify-between text-gray-600">
                      <span>Net Revenue:</span>
                      <span className="font-medium">₹{revenue.toLocaleString('en-IN', { maximumFractionDigits: 1 })}</span>
                    </div>
                    <div className="flex justify-between text-gray-600">
                      <span>Total Cost:</span>
                      <span className="font-medium">₹{totalCost.toLocaleString('en-IN', { maximumFractionDigits: 1 })}</span>
                    </div>
                    <div className="flex justify-between pt-1 border-t border-indigo-100/80 font-bold">
                      <span className={profit >= 0 ? 'text-emerald-700' : 'text-red-700'}>Est. Profit:</span>
                      <span className={profit >= 0 ? 'text-emerald-700' : 'text-red-700'}>
                        ₹{profit.toLocaleString('en-IN', { maximumFractionDigits: 1 })}
                      </span>
                    </div>
                  </div>
                );
              })()}

              {/* Mobile Actions: Primary View/PDF Button + Share + 3-Dot Overflow Menu */}
              <div className="flex items-center gap-1.5 sm:gap-2 pt-1 flex-wrap">
                {isTrashView ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 h-10 text-xs gap-1.5 border-emerald-200 text-emerald-700 hover:bg-emerald-50 rounded-xl font-semibold"
                    onClick={() => {
                      triggerHaptic('medium');
                      onRestoreChallan && challan.id && onRestoreChallan(challan.id);
                    }}
                  >
                    <RefreshCcw className="h-4 w-4" /> Restore Challan
                  </Button>
                ) : (
                  <>
                    {/* View Document */}
                    <Button
                      variant="default"
                      size="sm"
                      className="h-9 px-3 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs active:scale-95 transition-transform"
                      onClick={() => {
                        triggerHaptic('light');
                        onPreviewChallan ? onPreviewChallan(challan) : onDownloadChallan(challan);
                      }}
                      title="View Document"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      <span>View</span>
                    </Button>

                    {/* Admin Quick View (in main view) */}
                    {role === 'admin' && onAdminPreviewChallan && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-9 px-2.5 border-indigo-200 bg-indigo-50/90 hover:bg-indigo-100 text-indigo-700 rounded-xl text-xs font-bold flex items-center gap-1.5 active:scale-95 transition-transform shadow-2xs"
                        onClick={() => {
                          triggerHaptic('light');
                          onAdminPreviewChallan(challan);
                        }}
                        title="Admin Quick View"
                      >
                        <Receipt className="h-3.5 w-3.5" />
                        <span>Quick View</span>
                      </Button>
                    )}

                    {/* Edit Challan (in main view) */}
                    {role !== 'user' && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-9 px-2.5 border-amber-200 bg-amber-50/90 hover:bg-amber-100 text-amber-800 rounded-xl text-xs font-bold flex items-center gap-1.5 active:scale-95 transition-transform shadow-2xs"
                        onClick={() => {
                          triggerHaptic('light');
                          onSelectChallan(challan);
                        }}
                        title="Edit Challan"
                      >
                        <Edit2 className="h-3.5 w-3.5 text-amber-600" />
                        <span>Edit</span>
                      </Button>
                    )}

                    {/* Quick PDF Download Button */}
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-9 w-9 p-0 border-blue-200 bg-blue-50/80 hover:bg-blue-100 text-blue-700 rounded-xl active:scale-95 transition-transform shadow-2xs"
                      onClick={() => {
                        triggerHaptic('medium');
                        onDownloadChallan(challan);
                      }}
                      title="Download PDF"
                    >
                      <Download className="h-3.5 w-3.5 text-blue-600" />
                    </Button>

                    {/* Native Share / WhatsApp Dispatch Button */}
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-9 w-9 p-0 border-emerald-200 bg-emerald-50/80 hover:bg-emerald-100 text-emerald-700 rounded-xl active:scale-95 transition-transform shadow-2xs"
                      onClick={() => handleShareChallan(challan)}
                      title="Share Summary"
                    >
                      <Share2 className="h-3.5 w-3.5 text-emerald-600" />
                    </Button>

                    {/* Three-Dot Overflow Menu (Contains Duplicate, History, and Delete) */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-9 w-9 p-0 border-gray-200 text-gray-600 hover:text-gray-900 rounded-xl ml-auto active:scale-95 transition-transform"
                          aria-label="More actions"
                        >
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48 rounded-xl shadow-lg">
                        {role !== 'user' && (
                          <DropdownMenuItem
                            onClick={() => {
                              triggerHaptic('light');
                              onDuplicateChallan(challan);
                            }}
                            className="cursor-pointer gap-2 py-2"
                          >
                            <Copy className="h-4 w-4 text-amber-500" />
                            <span>Duplicate Challan</span>
                          </DropdownMenuItem>
                        )}
                        {role === 'admin' && onViewHistory && (
                          <DropdownMenuItem
                            onClick={() => {
                              triggerHaptic('light');
                              onViewHistory(challan);
                            }}
                            className="cursor-pointer gap-2 py-2"
                          >
                            <History className="h-4 w-4 text-blue-500" />
                            <span>Edit History</span>
                          </DropdownMenuItem>
                        )}
                        {role === 'admin' && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => {
                                triggerHaptic('warning');
                                setDeleteConfirmChallan(challan);
                              }}
                              className="cursor-pointer gap-2 py-2 text-red-600 focus:text-red-600 focus:bg-red-50"
                            >
                              <Trash2 className="h-4 w-4 text-red-500" />
                              <span>{isTrashView ? 'Delete Permanently' : 'Delete Challan'}</span>
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Desktop Table View (>= sm) */}
      <div className="hidden sm:block overflow-x-auto">
        <Table>
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
              {role === 'admin' && (
                <>
                  <TableHead className="font-bold text-gray-700 text-xs uppercase tracking-wider">{isTrashView ? 'Deleted By' : 'Author'}</TableHead>
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
                <TableCell className="font-mono font-bold text-indigo-950">
                  {challan.dcNumber}
                </TableCell>
                <TableCell className="text-gray-600 font-medium text-xs">
                  {challan.dcDate
                    ? format(new Date(challan.dcDate), 'dd-MM-yyyy')
                    : '—'}
                </TableCell>
                <TableCell>
                  <Badge
                    variant="outline"
                    className={
                      challan.location === 'hyderabad'
                        ? 'border-blue-300 text-blue-800 bg-gradient-to-r from-blue-50 to-indigo-50 font-bold px-2.5 py-0.5 rounded-full shadow-2xs'
                        : 'border-emerald-300 text-emerald-800 bg-gradient-to-r from-emerald-50 to-teal-50 font-bold px-2.5 py-0.5 rounded-full shadow-2xs'
                    }
                  >
                    📍 {NEWRELIC_LOCATIONS[challan.location]?.label ?? challan.location}
                  </Badge>
                </TableCell>
                <TableCell className="text-center text-gray-600">
                  {challan.lineItems?.length ?? 0}
                </TableCell>
                {role === 'admin' && (
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
                    {showFinancials && (() => {
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
                            <TableCell className="text-right whitespace-nowrap align-top pt-3">
                              <div className="flex flex-col text-[11px] items-end leading-tight">
                                <span className="text-gray-600" title="Total MRP">₹{mrpTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                <span className="text-gray-400" title="5.5% Commission">- ₹{commission.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                <span className="font-medium text-[13px] text-gray-900 border-t border-gray-200 mt-1 pt-1 w-full text-right">
                                  ₹{revenue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell className="text-right whitespace-nowrap align-top pt-3">
                              <div className="flex flex-col text-[11px] items-end leading-tight text-gray-500">
                                <span>Goods: ₹{pCost.toLocaleString('en-IN')}</span>
                                <span>Trans: ₹{tCost.toLocaleString('en-IN')}</span>
                                <span>Other: ₹{oCost.toLocaleString('en-IN')}</span>
                                <span className="font-medium text-[13px] text-gray-900 border-t border-gray-200 mt-1 pt-1 w-full text-right">
                                  ₹{totalCost.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell className="text-right font-medium whitespace-nowrap align-top pt-3">
                              <div className="flex flex-col items-end w-full h-full justify-end pb-[2px]">
                                <span className={profit >= 0 ? "text-emerald-700" : "text-red-700"}>
                                  ₹{profit.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </span>
                              </div>
                            </TableCell>
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
                        {role !== 'user' && (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-gray-500 hover:text-[#3b2fc9]"
                              onClick={() => onSelectChallan(challan)}
                              title="Edit"
                            >
                              <Edit2 className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-gray-500 hover:text-amber-500"
                              onClick={() => onDuplicateChallan(challan)}
                              title="Duplicate with next DC number"
                            >
                              <Copy className="h-4 w-4" />
                            </Button>
                          </>
                        )}
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
                        {role === 'admin' && (
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
      <AlertDialog open={!!deleteConfirmChallan} onOpenChange={(open) => !open && setDeleteConfirmChallan(null)}>
        <AlertDialogContent className="w-[90vw] max-w-lg rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>{isTrashView ? 'Permanently Delete?' : 'Delete Challan?'}</AlertDialogTitle>
            <AlertDialogDescription>
              {isTrashView ? (
                <>This will <strong>permanently destroy</strong> challan <strong>{deleteConfirmChallan?.dcNumber}</strong>. This action cannot be undone.</>
              ) : (
                <>This will move challan <strong>{deleteConfirmChallan?.dcNumber}</strong> to the Trash view.</>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-500 hover:bg-red-600 rounded-xl"
              onClick={() => {
                if (deleteConfirmChallan?.id) {
                  onDeleteChallan(deleteConfirmChallan.id);
                }
                setDeleteConfirmChallan(null);
              }}
            >
              {isTrashView ? 'Delete Permanently' : 'Move to Trash'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
