'use client';

import React, { useState, useRef } from 'react';
import { Loader2, Paperclip, UploadCloud, Trash2, Camera, Eye, X, Download, FileText, Sparkles } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Challan, addChallanAttachment, removeChallanAttachment } from '@/services/challanService';
import { uploadStorageFile, deleteStorageFile } from '@/services/storageService';
import { useAuth } from '@/contexts/AuthContext';
import { hasPermission } from '@/types/permissions';
import { triggerHaptic } from '@/lib/haptics';
import { compressDocumentFile, formatFileSize } from '@/lib/imageCompression';

interface DeliveryChallanAttachmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  challan: Challan | null;
  onUpdate?: (updatedUrls?: string[]) => void;
  title?: string;
  type: 'signed_copy' | 'invoice' | 'goods_received';
}

export function DeliveryChallanAttachmentModal({
  isOpen,
  onClose,
  challan,
  onUpdate,
  title,
  type,
}: DeliveryChallanAttachmentModalProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatusText, setUploadStatusText] = useState<string>('');
  const [isDragging, setIsDragging] = useState(false);
  const [deletingUrl, setDeletingUrl] = useState<string | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const isSigned = type === 'signed_copy';
  const defaultTitle = isSigned ? 'Signed Copies' : 'Goods Received Invoice';
  const displayTitle = title || defaultTitle;
  const folderName = isSigned ? 'delivery-challan-signed-dcs' : 'delivery-challan-invoices';
  const prefix = isSigned ? 'signed_' : 'goods_';
  const attachmentType = isSigned ? 'signed_copy' : 'invoice';

  // Use local state to instantly reflect uploads and deletions in the UI
  const initialUrls = challan
    ? isSigned
      ? challan.signedCopyUrls
      : challan.goodsReceivedInvoiceUrls
    : [];
  const [localCopies, setLocalCopies] = useState<string[]>(initialUrls || []);

  // Update localCopies if challan prop changes
  React.useEffect(() => {
    if (challan) {
      const urls = isSigned ? challan.signedCopyUrls : challan.goodsReceivedInvoiceUrls;
      setLocalCopies(urls || []);
    }
  }, [challan, isSigned]);

  const isForbidden = isSigned && (user?.role === 'guest' || !hasPermission(user, 'signed_copies'));
  if (isForbidden || !challan) return null;

  const safeDcNumber = (challan.dcNumber || 'dc').replace(/[/\\?%*:|"<>#]/g, '-');

  const processFiles = async (fileList: FileList | File[]) => {
    if (!challan.id || fileList.length === 0) return;

    setIsUploading(true);
    triggerHaptic('medium');

    try {
      const uploadedUrls: string[] = [];
      const compressionNotes: string[] = [];

      for (let i = 0; i < fileList.length; i++) {
        let file = fileList[i];

        // Safety pre-check: Reject absurdly large files (> 35MB) before processing
        if (file.size > 35 * 1024 * 1024) {
          throw new Error(`File "${file.name}" is too large (${formatFileSize(file.size)}). Max allowed is 20MB.`);
        }

        // Automatic smart compression for document photos (preserves sharp 2048px text/stamps)
        if (file.type && file.type.startsWith('image/') && !file.type.includes('svg')) {
          setUploadStatusText(`Compressing ${file.name}...`);
          const compResult = await compressDocumentFile(file, 2048, 2048, 0.85);
          if (compResult.compressed) {
            compressionNotes.push(
              `${formatFileSize(compResult.originalSize)} → ${formatFileSize(compResult.compressedSize)} (-${compResult.savingsPercent}%)`
            );
            file = compResult.file;
          }
        }

        // Final size check: max 20MB
        if (file.size > 20 * 1024 * 1024) {
          throw new Error(`File "${file.name}" is too large (${formatFileSize(file.size)}). Max allowed is 20MB.`);
        }

        setUploadStatusText(`Uploading ${file.name}...`);
        const url = await uploadStorageFile(safeDcNumber, file, folderName, prefix);
        await addChallanAttachment(challan.id, url, attachmentType, user?.email || null);
        uploadedUrls.push(url);
      }

      const nextCopies = [...localCopies, ...uploadedUrls];
      setLocalCopies(nextCopies);

      // Mutate local challan object in place for instant reactivity
      if (isSigned) {
        challan.signedCopyUrls = nextCopies;
      } else {
        challan.goodsReceivedInvoiceUrls = nextCopies;
      }

      const noteText = compressionNotes.length > 0 ? ` (${compressionNotes.join(', ')})` : '';
      toast({
        title: 'Success',
        description: `${displayTitle} uploaded successfully for ${challan.dcNumber}${noteText}`,
      });
      onUpdate?.(nextCopies);
    } catch (err: any) {
      console.error('Attachment upload error:', err);
      toast({
        variant: 'destructive',
        title: 'Upload failed',
        description: err.message || 'Could not upload file.',
      });
    } finally {
      setIsUploading(false);
      setUploadStatusText('');
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;
    await processFiles(files);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      await processFiles(e.dataTransfer.files);
    }
  };

  const handleDelete = async (url: string) => {
    if (!challan.id) return;
    if (!confirm(`Are you sure you want to delete this ${displayTitle.toLowerCase()}?`)) return;

    triggerHaptic('medium');
    setDeletingUrl(url);

    try {
      await deleteStorageFile(url);
      await removeChallanAttachment(challan.id, url, attachmentType, user?.email || null);

      const nextCopies = localCopies.filter((u) => u !== url);
      setLocalCopies(nextCopies);

      // Mutate local challan object in place
      if (isSigned) {
        challan.signedCopyUrls = nextCopies;
      } else {
        challan.goodsReceivedInvoiceUrls = nextCopies;
      }

      toast({
        title: 'Deleted',
        description: 'File removed successfully',
      });
      onUpdate?.(nextCopies);
    } catch (err: any) {
      console.error('Delete attachment error:', err);
      toast({
        variant: 'destructive',
        title: 'Delete failed',
        description: err.message || 'Could not delete attachment.',
      });
    } finally {
      setDeletingUrl(null);
    }
  };

  const handleDownload = (url: string, isPdf: boolean) => {
    try {
      triggerHaptic('light');
      const filename = `${prefix}${safeDcNumber}.${isPdf ? 'pdf' : 'jpg'}`;
      const proxyUrl = `/api/download?url=${encodeURIComponent(url)}&filename=${encodeURIComponent(filename)}`;

      const link = document.createElement('a');
      link.href = proxyUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch {
      window.open(url, '_blank');
    }
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col p-0 overflow-hidden rounded-2xl">
          <DialogHeader className="px-6 pt-6 pb-4 border-b border-gray-100 bg-white">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-[#3b2fc9]">
                {isSigned ? <Paperclip className="h-5 w-5" /> : <FileText className="h-5 w-5" />}
                <DialogTitle className="text-xl font-bold">{displayTitle}</DialogTitle>
              </div>
              <Badge variant="outline" className="font-mono text-sm bg-blue-50 text-blue-700 border-blue-200">
                {challan.dcNumber}
              </Badge>
            </div>
            <DialogDescription className="text-xs text-gray-500 pt-1">
              Upload and manage {displayTitle.toLowerCase()} for the delivery challan. You can upload images or PDF files.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto p-6 bg-gray-50 flex flex-col gap-6">
            {/* Upload Area */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              className={`bg-white border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center text-center gap-4 transition-colors ${
                isDragging
                  ? 'border-[#3b2fc9] bg-blue-50'
                  : 'border-gray-200 hover:border-[#3b2fc9] hover:bg-blue-50/50'
              }`}
            >
              <div className="bg-blue-100 p-3 rounded-full text-[#3b2fc9]">
                <UploadCloud className="h-6 w-6" />
              </div>
              <div>
                <p className="font-medium text-gray-900">Click to upload or drag and drop</p>
                <p className="text-xs text-gray-500 mt-1">SVG, PNG, JPG or PDF (up to 20MB · Images auto-compressed)</p>
                <div className="mt-2 inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200/80 rounded-full px-2.5 py-0.5">
                  <Sparkles className="w-3 h-3 text-emerald-600 shrink-0" />
                  <span>Smart Auto-Compression Active (Preserves 2048px text clarity)</span>
                </div>
              </div>

              <div className="flex gap-3 mt-2">
                <Button
                  onClick={() => {
                    triggerHaptic('light');
                    fileInputRef.current?.click();
                  }}
                  disabled={isUploading}
                  variant="default"
                  className="bg-[#3b2fc9] hover:bg-[#2a229c] text-white"
                >
                  {isUploading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      <span>{uploadStatusText || 'Uploading...'}</span>
                    </>
                  ) : (
                    <>
                      <Paperclip className="h-4 w-4 mr-2" />
                      <span>Select File(s)</span>
                    </>
                  )}
                </Button>

                {/* Native mobile camera capture support */}
                <div className="relative sm:hidden">
                  <Button variant="outline" disabled={isUploading} className="overflow-hidden">
                    <Camera className="h-4 w-4 mr-2 text-gray-600" />
                    Take Photo
                  </Button>
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="absolute inset-0 opacity-0 cursor-pointer"
                    onChange={handleFileUpload}
                    disabled={isUploading}
                  />
                </div>
              </div>

              <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                multiple
                accept="image/*,application/pdf"
                onChange={handleFileUpload}
              />
            </div>

            {/* Gallery */}
            <div>
              <h4 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                Uploaded Files <Badge variant="secondary">{localCopies.length}</Badge>
              </h4>

              {localCopies.length === 0 ? (
                <div className="text-center py-8 bg-white rounded-lg border border-gray-100 text-gray-500 text-sm">
                  No {displayTitle.toLowerCase()} uploaded yet.
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                  {localCopies.map((url, idx) => {
                    const isPdf = url.toLowerCase().includes('.pdf');
                    return (
                      <div
                        key={idx}
                        className="relative group bg-white border border-gray-200 rounded-lg overflow-hidden aspect-square flex items-center justify-center shadow-xs hover:shadow-md transition-all"
                      >
                        {isPdf ? (
                          <div className="flex flex-col items-center gap-2 text-red-500">
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              width="32"
                              height="32"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                              <polyline points="14 2 14 8 20 8" />
                            </svg>
                            <span className="text-xs font-medium text-gray-600">PDF Document</span>
                          </div>
                        ) : (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={url}
                            alt={`${displayTitle} ${idx + 1}`}
                            className="object-cover w-full h-full"
                          />
                        )}

                        {/* Overlay Actions */}
                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 backdrop-blur-[2px]">
                          {isPdf ? (
                            <a
                              href={url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-2 bg-white rounded-full text-gray-900 hover:text-[#3b2fc9] hover:bg-blue-50 transition-colors"
                              title="Open PDF"
                            >
                              <Eye className="h-4 w-4" />
                            </a>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setPreviewImage(url)}
                              className="p-2 bg-white rounded-full text-gray-900 hover:text-[#3b2fc9] hover:bg-blue-50 transition-colors"
                              title="Preview Image"
                            >
                              <Eye className="h-4 w-4" />
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => handleDownload(url, isPdf)}
                            className="p-2 bg-white rounded-full text-gray-900 hover:text-[#3b2fc9] hover:bg-blue-50 transition-colors"
                            title="Download"
                          >
                            <Download className="h-4 w-4" />
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDelete(url)}
                            disabled={deletingUrl === url}
                            className="p-2 bg-white rounded-full text-gray-900 hover:text-red-600 hover:bg-red-50 transition-colors"
                            title="Delete"
                          >
                            {deletingUrl === url ? (
                              <Loader2 className="h-4 w-4 animate-spin text-red-600" />
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="px-6 py-4 border-t border-gray-100 bg-white sm:justify-between">
            <div className="text-sm text-gray-500 hidden sm:block">
              Changes are saved automatically.
            </div>
            <Button
              type="button"
              onClick={onClose}
              className="w-full sm:w-auto bg-gray-900 hover:bg-gray-800 text-white"
            >
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Image Preview Modal */}
      <Dialog open={!!previewImage} onOpenChange={(open) => !open && setPreviewImage(null)}>
        <DialogContent className="max-w-4xl bg-transparent border-none shadow-none flex items-center justify-center p-0">
          <DialogTitle className="sr-only">Image Preview</DialogTitle>
          <button
            type="button"
            onClick={() => setPreviewImage(null)}
            className="absolute -top-12 right-0 p-2 text-white hover:text-gray-300 transition-colors z-50 bg-black/20 rounded-full backdrop-blur-sm"
          >
            <X className="h-6 w-6" />
          </button>
          {previewImage && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={previewImage}
              alt="Preview"
              className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl"
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
