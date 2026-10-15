'use client';

import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Download, Share2, FileText, CheckCircle2, Loader2, ExternalLink } from 'lucide-react';
import { Capacitor, registerPlugin } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { useToast } from '@/hooks/use-toast';

interface AndroidPdfPluginType {
  savePdf(options: { base64: string; fileName: string }): Promise<{ success: boolean }>;
  openPdf(options: { base64: string; fileName: string }): Promise<{ success: boolean }>;
  sharePdf(options: { base64: string; fileName: string }): Promise<{ success: boolean }>;
}

const AndroidPdf = registerPlugin<AndroidPdfPluginType>('AndroidPdf');

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
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);

  if (!pdfData) return null;

  const fileSizeKb = (pdfData.blob.size / 1024).toFixed(1);

  /**
   * Extract clean base64 string from arrayBuffer or blob.
   */
  const getBase64 = async (): Promise<string> => {
    if (pdfData.arrayBuffer) {
      const bytes = new Uint8Array(pdfData.arrayBuffer);
      let binary = '';
      for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      return window.btoa(binary);
    }
    const reader = new FileReader();
    return new Promise<string>((resolve) => {
      reader.onloadend = () => {
        const res = reader.result as string;
        resolve(res.split(',')[1] || '');
      };
      reader.readAsDataURL(pdfData.blob);
    });
  };

  // 1. Download to Phone — 100% in-app, never opens external browser
  const handleDownload = async () => {
    try {
      setIsProcessing(true);
      const base64 = await getBase64();

      // Priority 1: Direct AndroidBridge JavaScriptInterface (100% in-app, MediaStore.Downloads, no Chrome)
      if (typeof window !== 'undefined' && (window as any).AndroidBridge?.savePdfToDownloads) {
        toast({
          title: 'Saving to Downloads...',
          description: `Saving ${pdfData.fileName} to your device`,
        });
        const ok = (window as any).AndroidBridge.savePdfToDownloads(
          base64,
          pdfData.fileName,
          'Delivery Challan'
        );
        if (ok) {
          toast({
            title: 'Saved to Downloads',
            description: `${pdfData.fileName} is in your phone's Downloads folder`,
          });
          setTimeout(() => onClose(), 800);
          setIsProcessing(false);
          return;
        }
      }

      // Priority 2: Capacitor Native Plugin AndroidPdf
      try {
        const res = await AndroidPdf.savePdf({ base64, fileName: pdfData.fileName });
        if (res?.success) {
          toast({
            title: 'Saved to Downloads',
            description: `${pdfData.fileName} is in your phone's Downloads folder`,
          });
          setTimeout(() => onClose(), 800);
          setIsProcessing(false);
          return;
        }
      } catch (plugErr) {
        // Plugin not loaded (running in web browser)
      }

      // Priority 3: Capacitor Native Filesystem
      if (Capacitor.isNativePlatform()) {
        try {
          await Filesystem.writeFile({
            path: pdfData.fileName,
            data: base64,
            directory: Directory.Documents,
          });
          toast({
            title: 'Saved!',
            description: `${pdfData.fileName} saved to Documents`,
          });
          setTimeout(() => onClose(), 800);
          setIsProcessing(false);
          return;
        } catch (capErr) {
          console.warn('Capacitor filesystem write failed:', capErr);
        }
      }

      // Priority 4: Browser Local Blob Download (Never navigates to external URLs, stays 100% on page)
      const localUrl = URL.createObjectURL(pdfData.blob);
      const link = document.createElement('a');
      link.href = localUrl;
      link.download = pdfData.fileName;
      document.body.appendChild(link);
      link.click();
      setTimeout(() => {
        if (link.parentNode) link.parentNode.removeChild(link);
        URL.revokeObjectURL(localUrl);
        onClose();
      }, 1000);
      toast({
        title: 'Download Started',
        description: `Saved ${pdfData.fileName} to your device.`,
      });

    } catch (err) {
      console.error('Download error:', err);
      toast({
        variant: 'destructive',
        title: 'Download failed',
        description: 'Please try "Share" instead.',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // 2. Open in PDF Viewer — opens natively via FileProvider or browser blob
  const handleOpenPdf = async () => {
    try {
      setIsProcessing(true);
      const base64 = await getBase64();

      // Priority 1: Native AndroidBridge via FileProvider (100% in-app, no Chrome)
      if (typeof window !== 'undefined' && (window as any).AndroidBridge?.openPdf) {
        const ok = (window as any).AndroidBridge.openPdf(base64, pdfData.fileName);
        if (ok) {
          setIsProcessing(false);
          return;
        }
      }

      // Priority 2: Capacitor Native Plugin
      try {
        const res = await AndroidPdf.openPdf({ base64, fileName: pdfData.fileName });
        if (res?.success) {
          setIsProcessing(false);
          return;
        }
      } catch (ignored) {}

      // Priority 3: Native Share / Filesystem
      if (Capacitor.isNativePlatform()) {
        try {
          const saved = await Filesystem.writeFile({
            path: pdfData.fileName,
            data: base64,
            directory: Directory.Cache,
          });
          await Share.share({
            title: pdfData.fileName,
            url: saved.uri,
            dialogTitle: 'Open Delivery Challan',
          });
          setIsProcessing(false);
          return;
        } catch (capErr) {
          console.warn('Capacitor open failed:', capErr);
        }
      }

      // Priority 4: In-browser blob view
      const localUrl = URL.createObjectURL(pdfData.blob);
      window.open(localUrl, '_blank');
    } catch (err) {
      console.error('Error opening PDF:', err);
      window.open(pdfData.url, '_blank');
    } finally {
      setIsProcessing(false);
    }
  };

  // 3. Share — native Android share sheet or Web Share API
  const handleShare = async () => {
    try {
      setIsProcessing(true);
      const base64 = await getBase64();

      // Priority 1: Native AndroidBridge via FileProvider intent
      if (typeof window !== 'undefined' && (window as any).AndroidBridge?.sharePdf) {
        const ok = (window as any).AndroidBridge.sharePdf(base64, pdfData.fileName);
        if (ok) {
          setIsProcessing(false);
          return;
        }
      }

      // Priority 2: Capacitor Native Plugin
      try {
        const res = await AndroidPdf.sharePdf({ base64, fileName: pdfData.fileName });
        if (res?.success) {
          setIsProcessing(false);
          return;
        }
      } catch (ignored) {}

      // Priority 3: Native Capacitor Share
      if (Capacitor.isNativePlatform()) {
        try {
          const saved = await Filesystem.writeFile({
            path: pdfData.fileName,
            data: base64,
            directory: Directory.Cache,
          });
          await Share.share({
            title: pdfData.fileName,
            text: `Delivery Challan: ${pdfData.fileName}`,
            url: saved.uri,
            dialogTitle: 'Share Delivery Challan',
          });
          setIsProcessing(false);
          return;
        } catch (capErr) {
          console.warn('Capacitor native share failed:', capErr);
        }
      }

      // Priority 4: Web Share API with File object
      if (typeof navigator !== 'undefined' && typeof navigator.canShare === 'function') {
        const file = new File([pdfData.blob], pdfData.fileName, { type: 'application/pdf' });
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({
            files: [file],
            title: pdfData.fileName,
            text: `Delivery Challan: ${pdfData.fileName}`,
          });
          setIsProcessing(false);
          return;
        }
      }

      // Fallback: trigger local download
      await handleDownload();
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        console.error('Share error:', err);
      }
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-[92vw] max-w-[420px] p-5 rounded-2xl bg-white shadow-2xl border border-gray-100 z-[9999]">
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
          {/* Main Action: Download / Save to Device */}
          <Button
            type="button"
            disabled={isProcessing}
            onClick={handleDownload}
            className="w-full h-12 bg-gradient-to-r from-[#3b2fc9] to-[#5143eb] hover:from-[#2f25a3] hover:to-[#3b2fc9] text-white font-bold text-sm rounded-xl shadow-md active:scale-[0.98] transition-all flex items-center justify-center gap-2"
          >
            {isProcessing ? (
              <Loader2 className="w-4 h-4 animate-spin text-white" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            <span>Download to Phone</span>
          </Button>

          {/* Action 2: Share via WhatsApp / Apps */}
          <Button
            type="button"
            variant="outline"
            disabled={isProcessing}
            onClick={handleShare}
            className="w-full h-11 border-emerald-200 bg-emerald-50/50 hover:bg-emerald-50 text-emerald-800 font-semibold text-xs rounded-xl flex items-center justify-center gap-2"
          >
            <Share2 className="w-4 h-4 text-emerald-600" />
            <span>Share (WhatsApp / Drive / Print)</span>
          </Button>

          {/* Action 3: Open in External PDF Viewer */}
          <Button
            type="button"
            variant="outline"
            disabled={isProcessing}
            onClick={handleOpenPdf}
            className="w-full h-10 border-gray-200 text-gray-700 hover:bg-gray-50 font-medium text-xs rounded-xl flex items-center justify-center gap-2"
          >
            <ExternalLink className="w-3.5 h-3.5 text-gray-500" />
            <span>Open in PDF Viewer</span>
          </Button>

          {/* Action 4: Preview On Screen Inside App */}
          {onViewDocument && (
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                onClose();
                onViewDocument();
              }}
              className="w-full h-9 text-gray-400 hover:text-gray-700 text-xs font-medium flex items-center justify-center gap-1.5"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Preview Full Document On Screen</span>
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
