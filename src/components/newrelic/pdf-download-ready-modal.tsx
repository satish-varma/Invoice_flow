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
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { useToast } from '@/hooks/use-toast';

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

  // Helper to extract base64 string
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

  // Helper to cache on server and get universal HTTPS download URL
  const getServerUrls = async (base64: string): Promise<{ downloadUrl: string; viewUrl: string }> => {
    const res = await fetch('/api/download-pdf', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pdfBase64: base64,
        filename: pdfData.fileName,
      }),
    });
    if (!res.ok) throw new Error('Failed to prepare download link');
    const data = await res.json();
    return { downloadUrl: data.downloadUrl, viewUrl: data.viewUrl };
  };

  // 1. Direct Download Handler (Universal: Android DownloadManager via real HTTPS URL)
  const handleDownload = async () => {
    try {
      setIsProcessing(true);
      toast({
        title: 'Starting Download...',
        description: `Saving ${pdfData.fileName} to your device`,
      });

      const base64 = await getBase64();

      // If native Capacitor app, also save directly into Documents
      if (Capacitor.isNativePlatform()) {
        try {
          await Filesystem.writeFile({
            path: pdfData.fileName,
            data: base64,
            directory: Directory.Documents,
          });
        } catch (capErr) {
          console.warn('Capacitor native filesystem write skipped/failed:', capErr);
        }
      }

      // Universal Server URL Download (Triggers Android Native DownloadManager in WebView & standard browser download)
      const { downloadUrl } = await getServerUrls(base64);
      
      // 1. DOM anchor click
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = pdfData.fileName;
      document.body.appendChild(link);
      link.click();
      setTimeout(() => {
        if (link.parentNode) link.parentNode.removeChild(link);
      }, 1000);

      // 2. Direct location trigger for Android WebView DownloadListener
      setTimeout(() => {
        window.location.href = downloadUrl;
      }, 300);

    } catch (err) {
      console.error('Download error:', err);
      toast({
        variant: 'destructive',
        title: 'Download failed',
        description: 'Please try "Open in PDF Viewer" or "Share" instead.',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // 2. Open / View in Native PDF Viewer Handler
  const handleOpenPdf = async () => {
    try {
      setIsProcessing(true);
      const base64 = await getBase64();
      const { viewUrl } = await getServerUrls(base64);
      
      if (Capacitor.isNativePlatform()) {
        window.open(viewUrl, '_system');
      } else {
        const win = window.open(viewUrl, '_blank');
        if (!win) {
          window.location.href = viewUrl;
        }
      }
    } catch (err) {
      console.error('Error opening PDF:', err);
      window.open(pdfData.url, '_blank');
    } finally {
      setIsProcessing(false);
    }
  };

  // 3. Native Share Sheet Handler (WhatsApp, Drive, Gmail)
  const handleShare = async () => {
    try {
      setIsProcessing(true);
      const base64 = await getBase64();

      // Native Capacitor Share if available
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

      // Web Share API with File object
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

      // Fallback: Share server view URL
      const { viewUrl } = await getServerUrls(base64);
      if (typeof navigator !== 'undefined' && navigator.share) {
        await navigator.share({
          title: pdfData.fileName,
          text: `Delivery Challan: ${pdfData.fileName}`,
          url: viewUrl,
        });
        setIsProcessing(false);
        return;
      }

      // If no share sheet supported, trigger download
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
