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
      <DialogContent className="w-full sm:w-[96vw] sm:max-w-[850px] h-[94vh] sm:h-auto sm:max-h-[92vh] max-w-full bottom-0 top-auto sm:top-[50%] sm:bottom-auto translate-y-0 sm:translate-y-[-50%] rounded-t-3xl sm:rounded-2xl flex flex-col p-0 overflow-hidden bg-slate-100 shadow-2xl border-0 sm:border border-slate-200">
        {/* Native Mobile Drag Handle */}
        <div className="sm:hidden w-12 h-1.5 bg-slate-300 rounded-full mx-auto mt-2.5 mb-1 shrink-0" />

        <DialogHeader className="px-4 py-2.5 sm:px-6 sm:py-4 border-b border-slate-200 bg-white shadow-xs shrink-0 flex flex-row items-center justify-between gap-2 z-10">
          <div className="flex items-center gap-2 text-[#3b2fc9] min-w-0">
            <Eye className="h-5 w-5 shrink-0 text-[#3b2fc9]" />
            <div className="min-w-0">
              <DialogTitle className="text-base sm:text-lg font-black text-slate-900 tracking-tight truncate">
                {challan.dcNumber || 'Delivery Challan'}
              </DialogTitle>
              <p className="text-[11px] text-slate-500 font-semibold truncate sm:hidden">
                {challan.lineItems?.length || 0} line items • {challan.dcDate ? new Date(challan.dcDate).toLocaleDateString('en-IN') : ''}
              </p>
            </div>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 font-bold border border-blue-200/60 hidden sm:inline-block">
              {challan.lineItems?.length || 0} items
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Zoom Mode Toggle */}
            <div className="flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200">
              <button
                type="button"
                onClick={() => {
                  triggerHaptic('light');
                  setZoomMode('fit');
                }}
                className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all flex items-center gap-1 ${
                  zoomMode === 'fit'
                    ? 'bg-white text-[#3b2fc9] shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
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
                className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all flex items-center gap-1 ${
                  zoomMode === '100%'
                    ? 'bg-white text-[#3b2fc9] shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="100% Size"
              >
                <ZoomIn className="h-3.5 w-3.5" />
                <span>100%</span>
              </button>
            </div>

            {/* Desktop Download PDF Button */}
            <Button
              size="sm"
              onClick={() => {
                triggerHaptic('medium');
                onDownload(challan);
              }}
              className="hidden sm:inline-flex bg-[#3b2fc9] hover:bg-[#3227b0] text-white text-xs font-bold h-9 px-3.5 rounded-xl items-center gap-1.5 shadow-sm active:scale-95 transition-all"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Download PDF</span>
            </Button>
          </div>
        </DialogHeader>

        {/* Scrollable View Area */}
        <div
          ref={containerRef}
          className="flex-1 overflow-auto p-2 sm:p-6 flex justify-center items-start bg-slate-200/80"
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

        {/* Sticky Mobile Bottom Bar */}
        <div className="sm:hidden p-3 bg-white border-t border-slate-200 flex items-center gap-2 shrink-0 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-4px_16px_rgba(0,0,0,0.06)]">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              triggerHaptic('light');
              onClose();
            }}
            className="h-12 px-4 rounded-2xl border-slate-200 text-slate-700 text-xs font-bold shadow-2xs active:scale-95"
          >
            Close
          </Button>
          <Button
            type="button"
            onClick={() => {
              triggerHaptic('medium');
              onDownload(challan);
            }}
            className="flex-1 h-12 rounded-2xl bg-gradient-to-r from-indigo-600 via-[#3b2fc9] to-violet-700 hover:from-indigo-700 hover:to-violet-800 text-white text-xs font-black shadow-lg shadow-indigo-600/30 active:scale-95 flex items-center justify-center gap-1.5"
          >
            <Download className="w-4 h-4" />
            <span>Download PDF</span>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
