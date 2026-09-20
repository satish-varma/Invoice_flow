'use client';

import React from 'react';
import { Eye, Download } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { NewRelicChallan } from '@/services/newrelicChallanService';
import { NewRelicChallanPreview } from '@/components/newrelic/newrelic-challan-preview';

interface NewRelicChallanViewModalProps {
  isOpen: boolean;
  onClose: () => void;
  challan: NewRelicChallan | null;
  onDownload: (challan: NewRelicChallan) => void;
}

export function NewRelicChallanViewModal({
  isOpen,
  onClose,
  challan,
  onDownload,
}: NewRelicChallanViewModalProps) {
  if (!challan) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-[850px] max-h-[90vh] flex flex-col p-0 overflow-hidden rounded-2xl bg-[#e5e7eb]">
        <DialogHeader className="px-6 py-4 border-b border-gray-200 bg-white shadow-sm shrink-0 flex flex-row items-center justify-between z-10">
          <div className="flex items-center gap-2 text-[#3b2fc9]">
            <Eye className="h-5 w-5" />
            <DialogTitle className="text-xl">Preview: {challan.dcNumber || 'New Document'}</DialogTitle>
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={() => onDownload(challan)}
              className="h-9 gap-2 bg-[#3b2fc9] hover:bg-[#2a2296] text-white"
            >
              <Download className="h-4 w-4" /> Download PDF
            </Button>
          </div>
        </DialogHeader>

        {/* Scrollable area for the document preview */}
        <div className="flex-1 overflow-y-auto p-4 md:p-8 flex justify-center items-start">
          <div className="shadow-2xl rounded overflow-hidden scale-[0.7] md:scale-100 origin-top bg-white ring-1 ring-black/5">
            <div className="pointer-events-none">
              <NewRelicChallanPreview challan={challan} />
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
