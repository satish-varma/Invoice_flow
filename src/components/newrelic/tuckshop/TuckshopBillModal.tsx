'use client';

import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  FileText,
  ZoomIn,
  ZoomOut,
  RotateCw,
  ExternalLink,
  Download,
  X,
  MapPin,
  Calendar,
  IndianRupee,
  User,
  Building2,
} from 'lucide-react';
import { NewRelicTuckshopRecord } from '@/services/newrelicTuckshopService';
import { COMPANY_SITES, resolveSiteId } from '@/types/site';
import { getCategoryBadge } from './tuckshop-dashboard';
import { triggerHaptic } from '@/lib/haptics';

interface Props {
  record: NewRelicTuckshopRecord | null;
  isOpen: boolean;
  onClose: () => void;
}

export function TuckshopBillModal({ record, isOpen, onClose }: Props) {
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);

  if (!record || !record.billUrl) return null;

  const siteId = resolveSiteId(record.siteId);
  const siteName = COMPANY_SITES[siteId]?.name || siteId;
  const badge = getCategoryBadge(record.category, record.type);

  const handleZoomIn = () => {
    triggerHaptic('light');
    setZoom((z) => Math.min(z + 0.25, 3));
  };

  const handleZoomOut = () => {
    triggerHaptic('light');
    setZoom((z) => Math.max(z - 0.25, 0.5));
  };

  const handleRotate = () => {
    triggerHaptic('light');
    setRotation((r) => (r + 90) % 360);
  };

  const handleReset = () => {
    triggerHaptic('light');
    setZoom(1);
    setRotation(0);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl max-h-[92vh] flex flex-col p-0 overflow-hidden bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-2xl rounded-3xl">
        {/* Header */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-[#1e1b4b] via-[#3b2fc9] to-[#4f46e5] text-white flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center shrink-0">
              <FileText className="w-5 h-5 text-indigo-200" />
            </div>
            <div className="min-w-0">
              <DialogTitle className="text-base sm:text-lg font-black text-white tracking-tight flex items-center gap-2 truncate">
                <span>Receipt &amp; Bill Inspector</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-white/20 text-white font-bold">
                  {badge.emoji} {badge.label}
                </span>
              </DialogTitle>
              <p className="text-xs text-indigo-100 font-medium truncate">
                {record.description || 'Uploaded proof of expense'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <a
              href={record.billUrl}
              target="_blank"
              rel="noreferrer"
              onClick={() => triggerHaptic('light')}
              className="p-2 rounded-xl bg-white/15 hover:bg-white/25 text-white transition-colors"
              title="Open raw file in new tab"
            >
              <ExternalLink className="w-4 h-4" />
            </a>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="h-9 w-9 rounded-xl hover:bg-white/20 text-white"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Record Metadata Chip Bar */}
        <div className="px-5 py-3 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-3">
            <span className="flex items-center gap-1 font-bold text-slate-700 dark:text-slate-300">
              <Calendar className="w-3.5 h-3.5 text-indigo-600" />
              {new Date(record.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
            </span>

            <span className="flex items-center gap-1 font-bold text-emerald-700 dark:text-emerald-400">
              <MapPin className="w-3.5 h-3.5" />
              {record.location}
            </span>

            <span className="flex items-center gap-1 font-bold text-indigo-700 dark:text-indigo-300">
              <Building2 className="w-3.5 h-3.5" />
              {siteName}
            </span>

            <span className="flex items-center gap-1 font-medium text-slate-500 dark:text-slate-400">
              <User className="w-3.5 h-3.5" />
              By: <strong className="text-slate-800 dark:text-slate-200">{record.createdBy || 'Staff'}</strong>
            </span>
          </div>

          <div className="flex items-center gap-1 font-mono font-black text-base text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/60 px-3 py-1 rounded-xl border border-rose-200 dark:border-rose-900">
            -₹{record.amount.toLocaleString('en-IN')}
          </div>
        </div>

        {/* Image Preview Box with Controls */}
        <div className="relative flex-1 min-h-[380px] max-h-[550px] bg-slate-950 flex items-center justify-center overflow-hidden select-none p-4">
          <div
            className="transition-transform duration-200 ease-out flex items-center justify-center max-w-full max-h-full"
            style={{
              transform: `scale(${zoom}) rotate(${rotation}deg)`,
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={record.billUrl}
              alt="Receipt Bill"
              className="max-h-[500px] w-auto max-w-full object-contain rounded-lg shadow-2xl"
            />
          </div>

          {/* Floating Image Control Bar */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-1.5 p-1.5 bg-slate-900/90 backdrop-blur-md rounded-2xl border border-white/20 shadow-xl text-white">
            <button
              type="button"
              onClick={handleZoomOut}
              className="p-2 rounded-xl hover:bg-white/20 transition-colors"
              title="Zoom Out"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <span className="text-[11px] font-mono font-bold px-2">
              {Math.round(zoom * 100)}%
            </span>
            <button
              type="button"
              onClick={handleZoomIn}
              className="p-2 rounded-xl hover:bg-white/20 transition-colors"
              title="Zoom In"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <span className="w-px h-4 bg-white/20 mx-1" />
            <button
              type="button"
              onClick={handleRotate}
              className="p-2 rounded-xl hover:bg-white/20 transition-colors"
              title="Rotate 90°"
            >
              <RotateCw className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={handleReset}
              className="px-2.5 py-1 text-xs font-bold rounded-xl hover:bg-white/20 transition-colors"
              title="Reset Zoom & Rotation"
            >
              Reset
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
