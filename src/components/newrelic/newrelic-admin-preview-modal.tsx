'use client';

import { NewRelicChallan } from '@/types/challan';
import React from 'react';
import { Receipt, ShieldAlert } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface NewRelicAdminPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  challan: NewRelicChallan | null;
}

export function NewRelicAdminPreviewModal({
  isOpen,
  onClose,
  challan,
}: NewRelicAdminPreviewModalProps) {
  const { role } = useAuth();

  // Strict Admin-Only Guard: Reject rendering if not admin
  if (!challan || role !== 'admin') return null;

  const totalItems = challan.lineItems?.length || 0;
  const totalQty =
    challan.lineItems?.reduce((acc, item) => acc + (Number(item.quantity) || 0), 0) || 0;
  const totalMrp =
    challan.lineItems?.reduce(
      (acc, item) => acc + (Number(item.mrp) || 0) * (Number(item.quantity) || 0),
      0
    ) || 0;
  const totalPCost =
    challan.lineItems?.reduce(
      (acc, item) => acc + (Number(item.procurementCost) || 0) * (Number(item.quantity) || 0),
      0
    ) || 0;

  const totalMarginAmount = totalMrp - totalPCost;
  const overallMarginPct = totalMrp > 0 ? (totalMarginAmount / totalMrp) * 100 : 0;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-[900px] max-h-[90vh] flex flex-col p-0 overflow-hidden rounded-2xl bg-white shadow-2xl">
        <DialogHeader className="px-6 py-4 border-b border-gray-200 bg-gray-50/80 shadow-xs shrink-0 flex flex-row items-center justify-between z-10">
          <div className="flex items-center gap-2.5 text-[#3b2fc9]">
            <div className="p-2 bg-indigo-50 rounded-xl text-[#3b2fc9] border border-indigo-100">
              <Receipt className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <DialogTitle className="text-lg sm:text-xl font-bold text-gray-900">
                  Admin Quick View: {challan.dcNumber || 'Document'}
                </DialogTitle>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-rose-50 text-rose-700 border border-rose-200 flex items-center gap-1">
                  <ShieldAlert className="h-3 w-3 text-rose-600" />
                  Admin Only
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-0.5">
                Financial margins and procurement rates are restricted strictly to administrators.
              </p>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
          <div className="border border-gray-200 rounded-xl overflow-hidden bg-white shadow-xs">
            <Table>
              <TableHeader className="bg-gray-50">
                <TableRow>
                  <TableHead className="font-semibold text-gray-900 text-xs">Brand</TableHead>
                  <TableHead className="font-semibold text-gray-900 text-xs">Item Name</TableHead>
                  <TableHead className="font-semibold text-gray-900 text-center text-xs">Qty</TableHead>
                  <TableHead className="font-semibold text-gray-900 text-center text-xs">Expiry</TableHead>
                  <TableHead className="font-semibold text-gray-900 text-right text-xs">MRP</TableHead>
                  <TableHead className="font-semibold text-gray-900 text-right text-xs">P.Cost</TableHead>
                  <TableHead className="font-semibold text-gray-900 text-right text-xs">Margin %</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {challan.lineItems?.map((item, idx) => {
                  const mrp = Number(item.mrp) || 0;
                  const pCost = Number(item.procurementCost) || 0;
                  const marginAmt = mrp - pCost;
                  const marginPct = mrp > 0 ? ((mrp - pCost) / mrp) * 100 : null;

                  return (
                    <TableRow key={item.id || idx} className="hover:bg-slate-50/80 transition-colors">
                      <TableCell className="text-gray-600 text-xs font-medium">
                        {item.brandName || '-'}
                      </TableCell>
                      <TableCell className="font-semibold text-gray-900 text-xs">
                        {item.itemName}
                      </TableCell>
                      <TableCell className="text-center font-mono text-xs">
                        {item.quantity}
                      </TableCell>
                      <TableCell className="text-center text-xs text-gray-500">
                        {item.expiry || '-'}
                      </TableCell>
                      <TableCell className="text-right font-mono font-medium text-xs">
                        ₹{mrp.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs text-slate-700">
                        ₹{pCost.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell className="text-right">
                        {marginPct !== null ? (
                          <div className="flex flex-col items-end">
                            <span
                              className={cn(
                                'inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-black font-mono border',
                                marginPct >= 20
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                  : marginPct >= 10
                                  ? 'bg-blue-50 text-blue-700 border-blue-200'
                                  : marginPct >= 0
                                  ? 'bg-amber-50 text-amber-700 border-amber-200'
                                  : 'bg-rose-50 text-rose-700 border-rose-200'
                              )}
                            >
                              {marginPct >= 0 ? `+${marginPct.toFixed(1)}%` : `${marginPct.toFixed(1)}%`}
                            </span>
                            <span className="text-[10px] text-gray-400 font-mono mt-0.5">
                              ₹{marginAmt.toFixed(2)}/u
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400 font-mono">-</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {/* Financial Summary Box */}
          <div className="flex flex-wrap items-center justify-between gap-4 py-3.5 px-4 bg-gray-50/90 border border-gray-200 rounded-xl text-xs sm:text-sm text-gray-700">
            <div className="flex flex-wrap gap-4 font-medium">
              <span>
                Total Items: <strong className="text-gray-900">{totalItems}</strong>
              </span>
              <span>
                Total Qty: <strong className="text-gray-900">{totalQty}</strong>
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-4">
              <span>
                Total MRP: <strong className="text-gray-900 font-mono">₹{totalMrp.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
              </span>
              <span>
                Total P.Cost: <strong className="text-gray-900 font-mono">₹{totalPCost.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
              </span>
              <span className="flex items-center gap-1.5 pl-3 border-l border-gray-300">
                Overall Margin:
                <strong
                  className={cn(
                    'px-2 py-0.5 rounded-lg font-mono font-black text-xs sm:text-sm',
                    overallMarginPct >= 20
                      ? 'bg-emerald-100 text-emerald-800'
                      : overallMarginPct >= 10
                      ? 'bg-blue-100 text-blue-800'
                      : overallMarginPct >= 0
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-rose-100 text-rose-800'
                  )}
                >
                  ₹{totalMarginAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (
                  {overallMarginPct >= 0 ? `+${overallMarginPct.toFixed(1)}%` : `${overallMarginPct.toFixed(1)}%`})
                </strong>
              </span>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
