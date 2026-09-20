'use client';

import React from 'react';
import { Receipt } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { NewRelicChallan } from '@/services/newrelicChallanService';
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
  if (!challan) return null;

  const totalItems = challan.lineItems?.length || 0;
  const totalQty = challan.lineItems?.reduce((acc, item) => acc + (Number(item.quantity) || 0), 0) || 0;
  const totalMrp = challan.lineItems?.reduce((acc, item) => acc + ((Number(item.mrp) || 0) * (Number(item.quantity) || 0)), 0) || 0;
  const totalPCost = challan.lineItems?.reduce((acc, item) => acc + ((Number(item.procurementCost) || 0) * (Number(item.quantity) || 0)), 0) || 0;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-[850px] max-h-[90vh] flex flex-col p-0 overflow-hidden rounded-2xl bg-white">
        <DialogHeader className="px-6 py-4 border-b border-gray-200 bg-gray-50 shadow-sm shrink-0 flex flex-row items-center justify-between z-10">
          <div className="flex items-center gap-2 text-[#3b2fc9]">
            <Receipt className="h-5 w-5" />
            <DialogTitle className="text-xl">Admin Data: {challan.dcNumber || 'New Document'}</DialogTitle>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-4 md:p-6">
          <div className="border border-gray-200 rounded-xl overflow-hidden mb-6">
            <Table>
              <TableHeader className="bg-gray-50">
                <TableRow>
                  <TableHead className="font-semibold text-gray-900">Brand</TableHead>
                  <TableHead className="font-semibold text-gray-900">Item Name</TableHead>
                  <TableHead className="font-semibold text-gray-900 text-center">Qty</TableHead>
                  <TableHead className="font-semibold text-gray-900 text-right">MRP</TableHead>
                  <TableHead className="font-semibold text-gray-900 text-right">P.Cost</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {challan.lineItems?.map((item, idx) => (
                  <TableRow key={item.id || idx}>
                    <TableCell className="text-gray-600">{item.brandName || '-'}</TableCell>
                    <TableCell className="font-medium text-gray-900">{item.itemName}</TableCell>
                    <TableCell className="text-center">{item.quantity}</TableCell>
                    <TableCell className="text-right">₹{(item.mrp || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                    <TableCell className="text-right">₹{(item.procurementCost || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4 py-3 px-4 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700">
            <div className="flex gap-4">
              <span>Items: <strong className="text-gray-900">{totalItems}</strong></span>
              <span>Total Qty: <strong className="text-gray-900">{totalQty}</strong></span>
            </div>
            <div className="flex gap-4">
              <span>Total MRP: <strong className="text-gray-900">₹{totalMrp.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></span>
              <span>Total P.Cost: <strong className="text-gray-900">₹{totalPCost.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></span>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
