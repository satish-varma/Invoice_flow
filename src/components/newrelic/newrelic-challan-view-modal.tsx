'use client';

import { NewRelicChallan } from '@/types/challan';

import React, { useState, useEffect, useRef } from 'react';
import { Eye, Download, ZoomIn, ZoomOut, Maximize2, Edit2, FileCheck, Receipt, Paperclip, FileText } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { triggerHaptic } from '@/lib/haptics';
import { NewRelicAttachmentModal } from '@/components/newrelic/newrelic-attachment-modal';
import { NewRelicChallanPreview } from '@/components/newrelic/newrelic-challan-preview';

interface NewRelicChallanViewModalProps {
  isOpen: boolean;
  onClose: () => void;
  challan: NewRelicChallan | null;
  onDownload: (challan: NewRelicChallan) => void;
  onEdit?: (challan: NewRelicChallan) => void;
}

export function NewRelicChallanViewModal({
  isOpen,
  onClose,
  challan: initialChallan,
  onDownload,
  onEdit,
}: NewRelicChallanViewModalProps) {
  const [challan, setChallan] = useState<NewRelicChallan | null>(initialChallan);
  const [zoomMode, setZoomMode] = useState<'fit' | '100%'>('fit');
  const [scale, setScale] = useState<number>(0.8);
  const [activeAttachment, setActiveAttachment] = useState<'signed_copy' | 'goods_received' | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setChallan(initialChallan);
  }, [initialChallan]);

  const allItems = challan?.lineItems ?? [];
  const pageCount = allItems.length <= 10 ? 1 : 1 + Math.ceil((allItems.length - 10) / 18);
  const totalHeight = pageCount * 1123;

  useEffect(() => {
    if (!isOpen) return;

    const computeScale = () => {
      if (!containerRef.current) return;
      const padding = window.innerWidth < 640 ? 16 : 48;
      const availableWidth = containerRef.current.clientWidth - padding;
      if (zoomMode === 'fit') {
        const fitScale = Math.min(1.05, Math.max(0.35, availableWidth / 794));
        setScale(fitScale);
      } else {
        setScale(1.0);
      }
    };

    computeScale();
    window.addEventListener('resize', computeScale);
    const timer = setTimeout(computeScale, 150);
    return () => {
      window.removeEventListener('resize', computeScale);
      clearTimeout(timer);
    };
  }, [isOpen, zoomMode, challan]);

  if (!challan) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-[96vw] max-w-[850px] max-h-[92vh] flex flex-col p-0 overflow-hidden rounded-2xl bg-[#e5e7eb] shadow-2xl">
        <DialogHeader className="px-4 py-3 sm:px-6 sm:py-4 border-b border-gray-200 bg-white shadow-xs shrink-0 flex flex-row items-center justify-between gap-2 z-10">
          <div className="flex items-center gap-2 text-[#3b2fc9] min-w-0">
            <Eye className="h-5 w-5 shrink-0" />
            <DialogTitle className="text-base sm:text-xl font-bold truncate">
              {challan.dcNumber || 'Document'}
            </DialogTitle>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 flex-wrap">
            {/* Signed DC Attachment Button */}
            <button
              type="button"
              onClick={() => {
                triggerHaptic('light');
                setActiveAttachment('signed_copy');
              }}
              className={`px-2 py-1 sm:px-2.5 sm:py-1 rounded-lg text-xs font-bold flex items-center gap-1 border transition-all ${
                (challan.signedCopyUrls?.length ?? 0) > 0
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100 shadow-2xs'
                  : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
              }`}
              title="Manage Signed Copies"
            >
              <FileCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span className="hidden sm:inline">Signed DC</span>
              {(challan.signedCopyUrls?.length ?? 0) > 0 ? (
                <span className="px-1.5 py-0.2 rounded-full bg-emerald-600 text-white text-[9px] font-black">
                  {challan.signedCopyUrls!.length}
                </span>
              ) : (
                <span className="text-[10px] text-gray-400 font-normal">+Upload</span>
              )}
            </button>

            {/* Goods Received Invoice Attachment Button */}
            <button
              type="button"
              onClick={() => {
                triggerHaptic('light');
                setActiveAttachment('goods_received');
              }}
              className={`px-2 py-1 sm:px-2.5 sm:py-1 rounded-lg text-xs font-bold flex items-center gap-1 border transition-all ${
                (challan.goodsReceivedInvoiceUrls?.length ?? 0) > 0
                  ? 'bg-blue-50 text-blue-800 border-blue-300 hover:bg-blue-100 shadow-2xs'
                  : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
              }`}
              title="Manage Goods Received Invoice"
            >
              <Receipt className="w-3.5 h-3.5 text-blue-600" />
              <span className="hidden sm:inline">Invoice</span>
              {(challan.goodsReceivedInvoiceUrls?.length ?? 0) > 0 ? (
                <span className="px-1.5 py-0.2 rounded-full bg-blue-600 text-white text-[9px] font-black">
                  {challan.goodsReceivedInvoiceUrls!.length}
                </span>
              ) : (
                <span className="text-[10px] text-gray-400 font-normal">+Upload</span>
              )}
            </button>

            {/* Edit Button (Takes directly to edit form) */}
            {onEdit && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  triggerHaptic('light');
                  onClose();
                  onEdit(challan);
                }}
                className="h-8 sm:h-9 px-2 sm:px-3 gap-1 border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-900 rounded-xl text-xs font-bold shadow-2xs active:scale-95 transition-all"
                title="Edit in Form"
              >
                <Edit2 className="h-3.5 w-3.5 text-amber-600" />
                <span>Edit</span>
              </Button>
            )}

            {/* Zoom Mode Toggle */}
            <div className="flex items-center bg-gray-100 p-0.5 rounded-lg border border-gray-200">
              <button
                type="button"
                onClick={() => setZoomMode('fit')}
                className={`px-2 py-1 text-[11px] sm:text-xs font-semibold rounded-md transition-all flex items-center gap-1 ${
                  zoomMode === 'fit'
                    ? 'bg-white text-[#3b2fc9] shadow-2xs'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
                title="Fit full document to screen"
              >
                <Maximize2 className="h-3 w-3" />
                <span>Fit</span>
              </button>
              <button
                type="button"
                onClick={() => setZoomMode('100%')}
                className={`px-2 py-1 text-[11px] sm:text-xs font-semibold rounded-md transition-all flex items-center gap-1 ${
                  zoomMode === '100%'
                    ? 'bg-white text-[#3b2fc9] shadow-2xs'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
                title="View actual 100% size (scrollable)"
              >
                <ZoomIn className="h-3 w-3" />
                <span>100%</span>
              </button>
            </div>

            <Button
              onClick={() => onDownload(challan)}
              size="sm"
              className="h-8 sm:h-9 px-2.5 sm:px-3.5 gap-1.5 bg-[#3b2fc9] hover:bg-[#2a2296] text-white rounded-xl text-xs font-semibold shadow-xs"
            >
              <Download className="h-3.5 w-3.5" />
              <span className="hidden xs:inline">PDF</span>
            </Button>
          </div>
        </DialogHeader>

        {/* Scrollable area for the document preview */}
        <div
          ref={containerRef}
          className="flex-1 overflow-x-auto overflow-y-auto p-2 sm:p-6 flex justify-center items-start bg-gray-200/90"
        >
          <div
            style={{
              width: `${794 * scale}px`,
              height: `${totalHeight * scale}px`,
              position: 'relative',
              transition: 'width 0.2s ease, height 0.2s ease',
            }}
            className="shrink-0"
          >
            <div
              style={{
                transform: `scale(${scale})`,
                transformOrigin: 'top left',
                width: '794px',
              }}
              className="shadow-2xl rounded-sm bg-white ring-1 ring-black/10 origin-top-left"
            >
              <div className="pointer-events-none">
                <NewRelicChallanPreview challan={challan} showMrp={true} />
              </div>
            </div>
          </div>
        </div>
      </DialogContent>

      {/* Attachment Modal for View Modal */}
      {activeAttachment && (
        <NewRelicAttachmentModal
          isOpen={!!activeAttachment}
          onClose={() => setActiveAttachment(null)}
          challan={challan}
          type={activeAttachment}
          title={activeAttachment === 'signed_copy' ? 'Signed Copies' : 'Goods Received Invoice'}
          onUpdate={(updatedUrls) => {
            if (updatedUrls) {
              setChallan((prev) => {
                if (!prev) return prev;
                return activeAttachment === 'signed_copy'
                  ? { ...prev, signedCopyUrls: updatedUrls }
                  : { ...prev, goodsReceivedInvoiceUrls: updatedUrls };
              });
            }
          }}
        />
      )}
    </Dialog>
  );
}
