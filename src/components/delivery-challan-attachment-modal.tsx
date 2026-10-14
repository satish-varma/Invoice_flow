'use client';

import React, { useState, useRef } from 'react';
import { Loader2, Paperclip, UploadCloud, Trash2, Eye, X, Download, FileText, CheckCircle2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Challan, addChallanAttachment, removeChallanAttachment } from '@/services/challanService';
import { uploadStorageFile, deleteStorageFile } from '@/services/storageService';
import { useAuth } from '@/contexts/AuthContext';
import { triggerHaptic } from '@/lib/haptics';

interface DeliveryChallanAttachmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  challan: Challan | null;
  onUpdate: () => void;
  type: 'signed_copy' | 'invoice';
}

export function DeliveryChallanAttachmentModal({
  isOpen,
  onClose,
  challan,
  onUpdate,
  type,
}: DeliveryChallanAttachmentModalProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isUploading, setIsUploading] = useState(false);
  const [deletingUrl, setDeletingUrl] = useState<string | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  if (!challan) return null;

  const title = type === 'signed_copy' ? 'Signed DC Copy' : 'Goods Received / Purchase Invoice';
  const folderName = type === 'signed_copy' ? 'delivery-challan-signed-dcs' : 'delivery-challan-invoices';
  const prefix = type === 'signed_copy' ? 'signed_' : 'invoice_';
  const currentUrls: string[] =
    (type === 'signed_copy' ? challan.signedCopyUrls : challan.goodsReceivedInvoiceUrls) || [];

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0 || !challan.id) return;

    setIsUploading(true);
    triggerHaptic('medium');

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (file.size > 15 * 1024 * 1024) {
          throw new Error(`File ${file.name} is too large (max 15MB)`);
        }

        const url = await uploadStorageFile(challan.dcNumber, file, folderName, prefix);
        await addChallanAttachment(challan.id, url, type, user?.email);
      }

      toast({
        title: 'Upload Successful',
        description: `${title} uploaded for ${challan.dcNumber}.`,
      });
      onUpdate();
    } catch (err: any) {
      console.error('Attachment upload error:', err);
      toast({
        variant: 'destructive',
        title: 'Upload Failed',
        description: err.message || 'Could not upload attachment.',
      });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDelete = async (url: string) => {
    if (!challan.id) return;
    if (!confirm('Are you sure you want to delete this document attachment?')) return;

    triggerHaptic('medium');
    setDeletingUrl(url);

    try {
      await deleteStorageFile(url);
      await removeChallanAttachment(challan.id, url, type, user?.email);
      toast({
        title: 'Document Deleted',
        description: 'Attachment removed successfully.',
      });
      onUpdate();
    } catch (err: any) {
      console.error('Delete attachment error:', err);
      toast({
        variant: 'destructive',
        title: 'Delete Failed',
        description: err.message || 'Could not delete attachment.',
      });
    } finally {
      setDeletingUrl(null);
    }
  };

  const handleDownload = (url: string) => {
    triggerHaptic('light');
    const isPdf = url.toLowerCase().includes('.pdf');
    const safeDc = (challan.dcNumber || 'dc').replace(/[/\\?%*:|"<>#]/g, '-');
    const filename = `${prefix}${safeDc}.${isPdf ? 'pdf' : 'jpg'}`;
    const proxyUrl = `/api/download?url=${encodeURIComponent(url)}&filename=${encodeURIComponent(filename)}`;

    const a = document.createElement('a');
    a.href = proxyUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="max-w-md rounded-2xl p-5 bg-white shadow-2xl border border-gray-200">
          <DialogHeader className="border-b pb-3">
            <div className="flex items-center gap-2 text-indigo-700">
              <Paperclip className="h-5 w-5" />
              <DialogTitle className="text-base font-bold text-gray-900">
                {title}
              </DialogTitle>
            </div>
            <DialogDescription className="text-xs text-gray-500 pt-1">
              DC Number: <span className="font-mono font-bold text-gray-900">{challan.dcNumber}</span> • Consignee:{' '}
              <span className="font-semibold text-gray-800">{challan.shipToName || challan.billToName || 'Consignee'}</span>
            </DialogDescription>
          </DialogHeader>

          {/* Upload Button Area */}
          <div className="pt-2">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              className="hidden"
              multiple
              accept="image/*,application/pdf"
              disabled={isUploading}
            />

            <Button
              type="button"
              onClick={() => {
                triggerHaptic('light');
                fileInputRef.current?.click();
              }}
              disabled={isUploading}
              className="w-full h-11 rounded-xl bg-indigo-50 hover:bg-indigo-100 border border-indigo-200/80 text-indigo-700 text-xs font-bold flex items-center justify-center gap-2 shadow-2xs transition-all"
            >
              {isUploading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin text-indigo-600" />
                  <span>Uploading to Cloud Storage...</span>
                </>
              ) : (
                <>
                  <UploadCloud className="h-4 w-4 text-indigo-600" />
                  <span>Upload {title} (PDF or Image)</span>
                </>
              )}
            </Button>
          </div>

          {/* Existing Uploaded Files List */}
          <div className="space-y-2 max-h-[300px] overflow-y-auto pt-2">
            {currentUrls.length === 0 ? (
              <div className="p-6 text-center rounded-xl bg-gray-50 border border-dashed border-gray-200">
                <p className="text-xs text-gray-400 font-medium">No files uploaded yet.</p>
                <p className="text-[11px] text-gray-400 mt-0.5">
                  Click the button above to upload signed receipts or scanned invoices.
                </p>
              </div>
            ) : (
              currentUrls.map((url, index) => {
                const isPdf = url.toLowerCase().includes('.pdf');
                const isDeleting = deletingUrl === url;

                return (
                  <div
                    key={url}
                    className="flex items-center justify-between p-3 rounded-xl bg-gray-50 hover:bg-gray-100/80 border border-gray-200 transition-all text-xs"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0">
                        <FileText className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold text-gray-900 truncate">
                          Attachment #{index + 1}
                        </p>
                        <span className="text-[10px] text-gray-400 uppercase font-mono font-bold">
                          {isPdf ? 'PDF Document' : 'Image Scan'}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      {/* View */}
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          if (isPdf) {
                            window.open(url, '_blank');
                          } else {
                            setPreviewImage(url);
                          }
                        }}
                        className="h-8 w-8 text-gray-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg"
                        title="View Attachment"
                      >
                        <Eye className="w-4 h-4" />
                      </Button>

                      {/* Download */}
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDownload(url)}
                        className="h-8 w-8 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg"
                        title="Download Attachment"
                      >
                        <Download className="w-4 h-4" />
                      </Button>

                      {/* Delete */}
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        disabled={isDeleting}
                        onClick={() => handleDelete(url)}
                        className="h-8 w-8 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                        title="Delete Attachment"
                      >
                        {isDeleting ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-red-500" />
                        ) : (
                          <Trash2 className="w-4 h-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Image Preview Sub-Dialog */}
      {previewImage && (
        <Dialog open={!!previewImage} onOpenChange={() => setPreviewImage(null)}>
          <DialogContent className="max-w-2xl p-2 bg-slate-950 text-white border-0 rounded-2xl overflow-hidden flex flex-col items-center">
            <div className="w-full flex justify-between items-center p-2">
              <span className="text-xs font-bold text-gray-300">Image Preview</span>
              <button
                type="button"
                onClick={() => setPreviewImage(null)}
                className="p-1 rounded-lg text-gray-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewImage}
              alt="Document Scan"
              className="max-h-[75vh] w-auto object-contain rounded-lg shadow-lg"
            />
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
