'use client';

import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Download, Share2, FileText, CheckCircle2 } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

interface PdfReadyModalProps {
  isOpen: boolean;
  onClose: () => void;
  pdfData: {
    blob: Blob;
    url: string;
    fileName: string;
    arrayBuffer?: ArrayBuffer;
  } | null;
  onViewDocument?: () => void;
}

export function PdfDownloadReadyModal({
  isOpen,
  onClose,
  pdfData,
  onViewDocument,
}: PdfReadyModalProps) {
  if (!pdfData) return null;

  const fileSizeKb = (pdfData.blob.size / 1024).toFixed(1);

  const handleSaveOrShare = async () => {
    // 1. Try Native Capacitor Filesystem & Share
    if (Capacitor.isNativePlatform()) {
      try {
        let base64 = '';
        if (pdfData.arrayBuffer) {
          const bytes = new Uint8Array(pdfData.arrayBuffer);
          let binary = '';
          for (let i = 0; i < bytes.byteLength; i++) {
            binary += String.fromCharCode(bytes[i]);
          }
          base64 = window.btoa(binary);
        } else {
          const reader = new FileReader();
          base64 = await new Promise<string>((resolve) => {
            reader.onloadend = () => {
              const res = reader.result as string;
              resolve(res.split(',')[1] || '');
            };
            reader.readAsDataURL(pdfData.blob);
          });
        }

        const saved = await Filesystem.writeFile({
          path: pdfData.fileName,
          data: base64,
          directory: Directory.Cache,
        });

        await Share.share({
          title: pdfData.fileName,
          text: `Delivery Challan: ${pdfData.fileName}`,
          url: saved.uri,
          dialogTitle: 'Save or Share Delivery Challan',
        });
        return;
      } catch (nativeErr) {
        console.warn('Capacitor native share failed, falling back:', nativeErr);
      }
    }

    // 2. Mobile Browser Web Share API (Has fresh user activation here!)
    if (typeof navigator !== 'undefined' && typeof navigator.canShare === 'function') {
      try {
        const file = new File([pdfData.blob], pdfData.fileName, { type: 'application/pdf' });
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({
            files: [file],
            title: pdfData.fileName,
            text: `Delivery Challan: ${pdfData.fileName}`,
          });
          return;
        }
      } catch (shareErr: any) {
        if (shareErr.name === 'AbortError') return;
        console.warn('Web Share failed, falling back:', shareErr);
      }
    }

    // 3. Browser direct download / new tab fallback
    const link = document.createElement('a');
    link.href = pdfData.url;
    link.download = pdfData.fileName;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    setTimeout(() => {
      if (link.parentNode) link.parentNode.removeChild(link);
    }, 2000);
  };

  const handleOpenPdf = () => {
    window.open(pdfData.url, '_blank');
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-[92vw] max-w-[420px] p-5 rounded-2xl bg-white shadow-2xl border border-gray-100">
        <DialogHeader className="text-center sm:text-center pb-2">
          <div className="mx-auto w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mb-3 shadow-xs">
            <CheckCircle2 className="w-6 h-6 stroke-[2.5]" />
          </div>
          <DialogTitle className="text-lg font-black text-gray-900 tracking-tight">
            Delivery Challan Ready
          </DialogTitle>
          <DialogDescription className="text-xs text-gray-500 font-medium truncate max-w-[320px] mx-auto mt-1">
            {pdfData.fileName} • {fileSizeKb} KB
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2.5 pt-2">
          {/* Main Action: Save / Share via Native Sheet */}
          <Button
            type="button"
            onClick={handleSaveOrShare}
            className="w-full h-12 bg-gradient-to-r from-[#3b2fc9] to-[#5143eb] hover:from-[#2f25a3] hover:to-[#3b2fc9] text-white font-bold text-sm rounded-xl shadow-md active:scale-[0.98] transition-all flex items-center justify-center gap-2"
          >
            <Share2 className="w-4 h-4" />
            <span>Save or Share PDF</span>
          </Button>

          {/* Direct Download / Open in Browser */}
          <Button
            type="button"
            variant="outline"
            onClick={handleOpenPdf}
            className="w-full h-11 border-gray-200 text-gray-700 hover:bg-gray-50 font-semibold text-xs rounded-xl flex items-center justify-center gap-2"
          >
            <Download className="w-4 h-4 text-gray-500" />
            <span>Open in PDF Viewer</span>
          </Button>

          {/* View Document In-App */}
          {onViewDocument && (
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                onClose();
                onViewDocument();
              }}
              className="w-full h-10 text-gray-500 hover:text-gray-800 text-xs font-medium flex items-center justify-center gap-1.5"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Preview On Screen</span>
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
