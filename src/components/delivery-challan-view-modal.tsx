'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Eye, Download, Maximize2, ZoomIn, ZoomOut, X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { DeliveryChallanPreview } from '@/components/delivery-challan-preview';
import { Challan } from '@/services/challanService';
import { Settings } from '@/services/settingsService';
import { triggerHaptic } from '@/lib/haptics';

interface DeliveryChallanViewModalProps {
  isOpen: boolean;
  onClose: () => void;
  challan: Challan | null;
  settings: Settings | null;
  onDownload: (challan: Challan) => void;
}

export function DeliveryChallanViewModal({
  isOpen,
  onClose,
  challan,
  settings,
  onDownload,
}: DeliveryChallanViewModalProps) {
  const [zoomMode, setZoomMode] = useState<'fit' | '100%'>('fit');
  const [scale, setScale] = useState<number>(0.85);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const computeScale = () => {
      if (!containerRef.current) return;
      const padding = window.innerWidth < 640 ? 16 : 48;
      const availableWidth = containerRef.current.clientWidth - padding;
      if (zoomMode === 'fit') {
        const fitScale = Math.min(1.0, Math.max(0.38, availableWidth / 800));
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

  if (!challan || !settings) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-[96vw] max-w-[850px] max-h-[92vh] flex flex-col p-0 overflow-hidden rounded-2xl bg-gray-100 shadow-2xl border border-gray-200">
        <DialogHeader className="px-4 py-3 sm:px-6 sm:py-4 border-b border-gray-200 bg-white shadow-xs shrink-0 flex flex-row items-center justify-between gap-2 z-10">
          <div className="flex items-center gap-2 text-[#3b2fc9] min-w-0">
            <Eye className="h-5 w-5 shrink-0" />
            <DialogTitle className="text-base sm:text-lg font-black truncate">
              {challan.dcNumber || 'Delivery Challan'}
            </DialogTitle>
            <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 font-semibold border border-blue-200/60 hidden sm:inline-block">
              {challan.lineItems?.length || 0} items
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Zoom Mode Toggle */}
            <div className="flex items-center bg-gray-100 p-0.5 rounded-lg border border-gray-200">
              <button
                type="button"
                onClick={() => {
                  triggerHaptic('light');
                  setZoomMode('fit');
                }}
                className={`px-2.5 py-1 text-xs font-bold rounded-md transition-all flex items-center gap-1 ${
                  zoomMode === 'fit'
                    ? 'bg-white text-[#3b2fc9] shadow-xs'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
                title="Fit to width"
              >
                <Maximize2 className="h-3.5 w-3.5" />
                <span>Fit</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  triggerHaptic('light');
                  setZoomMode('100%');
                }}
                className={`px-2.5 py-1 text-xs font-bold rounded-md transition-all flex items-center gap-1 ${
                  zoomMode === '100%'
                    ? 'bg-white text-[#3b2fc9] shadow-xs'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
                title="100% Size"
              >
                <ZoomIn className="h-3.5 w-3.5" />
                <span>100%</span>
              </button>
            </div>

            <Button
              size="sm"
              onClick={() => {
                triggerHaptic('medium');
                onDownload(challan);
              }}
              className="bg-[#3b2fc9] hover:bg-[#3227b0] text-white text-xs font-bold h-8 px-3 rounded-xl flex items-center gap-1.5 shadow-sm active:scale-95 transition-all"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Download PDF</span>
            </Button>
          </div>
        </DialogHeader>

        {/* Scrollable View Area */}
        <div
          ref={containerRef}
          className="flex-1 overflow-auto p-3 sm:p-6 flex justify-center items-start bg-gray-200/70"
        >
          <div
            style={{
              transform: `scale(${scale})`,
              transformOrigin: 'top center',
              transition: 'transform 0.15s ease-out',
              width: '800px',
              maxWidth: '800px',
              marginBottom: scale < 1 ? `-${Math.round((1 - scale) * 900)}px` : '0px',
            }}
            className="shadow-xl rounded-lg bg-white overflow-hidden shrink-0"
          >
            <DeliveryChallanPreview challan={challan} settings={settings} />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
