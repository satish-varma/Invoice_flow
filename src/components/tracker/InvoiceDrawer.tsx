'use client';

import React, { useEffect, useState } from 'react';
import { X, Eye, Download, CheckCircle, Clock } from 'lucide-react';
import { Invoice } from '@/lib/tracker/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface InvoiceDrawerProps {
  invoice: Invoice | null;
  onClose: () => void;
  isOpen: boolean;
  onStatusChange?: (id: string, newStatus: string) => Promise<void>;
}

export function InvoiceDrawer({ invoice, onClose, isOpen, onStatusChange }: InvoiceDrawerProps) {
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen || !invoice) return null;

  const handleToggleStatus = async () => {
    if (!onStatusChange) return;
    const targetStatus = invoice.status === 'Paid' ? 'Pending' : 'Paid';
    setIsUpdatingStatus(true);
    try {
      await onStatusChange(invoice.id, targetStatus);
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const downloadUrl = `/api/tracker/download/${encodeURIComponent(invoice.id)}`;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="relative w-full max-w-md bg-white shadow-2xl flex flex-col h-full z-10 animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div>
            <h2 className="text-base font-bold text-gray-900">Remittance Details</h2>
            <p className="text-xs text-gray-500 font-mono">{invoice.id}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Status Banner */}
          <div className="flex items-center justify-between p-3.5 rounded-lg bg-gray-50 border border-gray-200">
            <div className="flex items-center gap-2">
              {invoice.status === 'Paid' ? (
                <CheckCircle className="h-4 w-4 text-emerald-600" />
              ) : (
                <Clock className="h-4 w-4 text-amber-600" />
              )}
              <span className="text-xs font-semibold text-gray-700">Remittance Status</span>
            </div>
            <Badge
              variant="outline"
              className={
                invoice.status === 'Paid'
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200 font-bold'
                  : 'bg-amber-50 text-amber-700 border-amber-200 font-bold'
              }
            >
              {invoice.status}
            </Badge>
          </div>

          {/* Amount Card */}
          <div className="p-4 rounded-xl bg-indigo-50/60 border border-indigo-100 text-center">
            <span className="text-xs font-semibold text-indigo-700 uppercase tracking-wider">Net Payable Remittance</span>
            <div className="text-3xl font-extrabold text-indigo-950 mt-1">
              ₹{invoice.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
            {invoice.serviceDateRange && (
              <p className="text-xs text-indigo-600 mt-1">Service: {invoice.serviceDateRange}</p>
            )}
          </div>

          {/* Info Key-Value */}
          <div className="space-y-3 border-t border-b border-gray-100 py-4">
            <div className="flex justify-between text-xs">
              <span className="text-gray-500 font-medium">Payment Advice Date</span>
              <span className="text-gray-900 font-semibold">{invoice.date}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-gray-500 font-medium">Location</span>
              <span className="text-gray-900 font-semibold">{invoice.location}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-gray-500 font-medium">Stall / Vendor</span>
              <span className="text-gray-900 font-semibold">{invoice.stall}</span>
            </div>
            {invoice.syncedAt && (
              <div className="flex justify-between text-xs">
                <span className="text-gray-500 font-medium">Synced At</span>
                <span className="text-gray-500 font-mono">
                  {new Date(invoice.syncedAt).toLocaleDateString()}
                </span>
              </div>
            )}
          </div>

          {/* PDF Preview / Actions */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wider">Attached Payment Advice PDF</h3>
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1 text-xs"
                onClick={() => window.open(downloadUrl, '_blank')}
              >
                <Eye className="h-3.5 w-3.5 mr-1.5" />
                Preview PDF
              </Button>
              <Button
                variant="default"
                className="flex-1 text-xs bg-indigo-600 hover:bg-indigo-700"
                onClick={() => {
                  const link = document.createElement('a');
                  link.href = downloadUrl;
                  link.download = `${invoice.id}.pdf`;
                  document.body.appendChild(link);
                  link.click();
                  document.body.removeChild(link);
                }}
              >
                <Download className="h-3.5 w-3.5 mr-1.5" />
                Download
              </Button>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-gray-200 bg-gray-50 flex items-center gap-2">
          {onStatusChange && (
            <Button
              onClick={handleToggleStatus}
              disabled={isUpdatingStatus}
              className={`w-full text-xs font-bold ${
                invoice.status === 'Paid'
                  ? 'bg-amber-600 hover:bg-amber-700 text-white'
                  : 'bg-emerald-600 hover:bg-emerald-700 text-white'
              }`}
            >
              {isUpdatingStatus
                ? 'Updating...'
                : invoice.status === 'Paid'
                ? 'Mark as Pending'
                : 'Mark as Paid'}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
