'use client';

import React, { useState, useRef } from 'react';
import { Loader2, Paperclip, UploadCloud, Trash2, Camera, Eye, X, Download } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { NewRelicChallan, addSignedCopyUrl, removeSignedCopyUrl, addGoodsReceivedUrl, removeGoodsReceivedUrl } from '@/services/newrelicChallanService';
import { uploadStorageFile, deleteStorageFile } from '@/services/storageService';
import { useAuth } from '@/contexts/AuthContext';
import { Badge } from '@/components/ui/badge';

interface NewRelicAttachmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  challan: NewRelicChallan;
  onUpdate: () => void;
  title: string;
  type: 'signed_copy' | 'goods_received';
}

export function NewRelicAttachmentModal({ isOpen, onClose, challan, onUpdate, title, type }: NewRelicAttachmentModalProps) {
  const { toast } = useToast();
  const { user, role } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [isUploading, setIsUploading] = useState(false);
  const [deletingUrl, setDeletingUrl] = useState<string | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  
  // Use local state to instantly reflect uploads and deletions in the UI
  const initialUrls = type === 'signed_copy' ? challan.signedCopyUrls : challan.goodsReceivedInvoiceUrls;
  const [localCopies, setLocalCopies] = useState<string[]>(initialUrls || []);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;
    
    setIsUploading(true);
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        
        // Basic validation
        if (file.size > 10 * 1024 * 1024) {
          throw new Error(`File ${file.name} is too large (max 10MB)`);
        }
        
        
        if (type === 'signed_copy') {
          const url = await uploadStorageFile(challan.dcNumber, file, 'newrelic-signed-dcs', 'signed_');
          await addSignedCopyUrl(challan.id!, url, user?.email || null);
          setLocalCopies(prev => [...prev, url]);
        } else {
          const url = await uploadStorageFile(challan.dcNumber, file, 'newrelic-goods-received-dcs', 'goods_');
          await addGoodsReceivedUrl(challan.id!, url, user?.email || null);
          setLocalCopies(prev => [...prev, url]);
        }
      }
      
      toast({ title: 'Success', description: `${title} uploaded successfully` });
      onUpdate();
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Upload failed', description: err.message });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDelete = async (url: string) => {
    if (!confirm('Are you sure you want to delete this signed copy?')) return;
    
    setDeletingUrl(url);
    try {
      await deleteStorageFile(url);
      if (type === 'signed_copy') {
        await removeSignedCopyUrl(challan.id!, url, user?.email || null);
      } else {
        await removeGoodsReceivedUrl(challan.id!, url, user?.email || null);
      }
      setLocalCopies(prev => prev.filter(u => u !== url));
      toast({ title: 'Success', description: 'File deleted successfully' });
      onUpdate();
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Delete failed', description: err.message });
    } finally {
      setDeletingUrl(null);
    }
  };

  const handleDownload = (url: string, isPdf: boolean) => {
    try {
      const prefix = type === 'signed_copy' ? 'signed_copy' : 'goods_received';
      const filename = `${prefix}_${challan.dcNumber}.${isPdf ? 'pdf' : 'jpg'}`;
      // Route the download through our Next.js API to bypass Firebase CORS restrictions
      const proxyUrl = `/api/download?url=${encodeURIComponent(url)}&filename=${encodeURIComponent(filename)}`;
      
      const link = document.createElement('a');
      link.href = proxyUrl;
      link.download = filename; // The API also sets Content-Disposition to enforce this
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      toast({ variant: 'destructive', title: 'Download failed', description: 'Could not download the file.' });
      // Fallback: open in new tab
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
                <Paperclip className="h-5 w-5" />
                <DialogTitle className="text-xl">{title}</DialogTitle>
              </div>
              <Badge variant="outline" className="font-mono text-sm bg-blue-50 text-blue-700 border-blue-200">
                {challan.dcNumber}
              </Badge>
            </div>
            <DialogDescription>
              Upload and manage {title.toLowerCase()} for the delivery challan. You can upload images or PDF files.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto p-6 bg-gray-50 flex flex-col gap-6">
            
            {/* Upload Area */}
            <div className="bg-white border-2 border-dashed border-gray-200 rounded-xl p-8 flex flex-col items-center justify-center text-center gap-4 transition-colors hover:border-[#3b2fc9] hover:bg-blue-50/50">
              <div className="bg-blue-100 p-3 rounded-full text-[#3b2fc9]">
                <UploadCloud className="h-6 w-6" />
              </div>
              <div>
                <p className="font-medium text-gray-900">Click to upload or drag and drop</p>
                <p className="text-xs text-gray-500 mt-1">SVG, PNG, JPG or PDF (max. 10MB)</p>
              </div>
              
              <div className="flex gap-3 mt-2">
                <Button 
                  onClick={() => fileInputRef.current?.click()} 
                  disabled={isUploading}
                  variant="default"
                  className="bg-[#3b2fc9] hover:bg-[#2a229c]"
                >
                  {isUploading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Paperclip className="h-4 w-4 mr-2" />}
                  Select File(s)
                </Button>
                
                {/* Native mobile camera capture support */}
                <div className="relative sm:hidden">
                  <Button 
                    variant="outline" 
                    disabled={isUploading}
                    className="overflow-hidden"
                  >
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
                  No {title.toLowerCase()} uploaded yet.
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                  {localCopies.map((url, idx) => {
                    const isPdf = url.includes('.pdf?alt=media');
                    return (
                      <div key={idx} className="relative group bg-white border border-gray-200 rounded-lg overflow-hidden aspect-square flex items-center justify-center shadow-sm hover:shadow-md transition-all">
                        {isPdf ? (
                          <div className="flex flex-col items-center gap-2 text-red-500">
                            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>
                            <span className="text-xs font-medium text-gray-600">PDF Document</span>
                          </div>
                        ) : (
                          <img src={url} alt={`Signed copy ${idx + 1}`} className="object-cover w-full h-full" />
                        )}
                        
                        {/* Overlay Actions */}
                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 backdrop-blur-[2px]">
                          {isPdf ? (
                            <a href={url} target="_blank" rel="noopener noreferrer" className="p-2 bg-white rounded-full text-gray-900 hover:text-[#3b2fc9] hover:bg-blue-50 transition-colors" title="Open PDF">
                              <Eye className="h-4 w-4" />
                            </a>
                          ) : (
                            <button onClick={() => setPreviewImage(url)} className="p-2 bg-white rounded-full text-gray-900 hover:text-[#3b2fc9] hover:bg-blue-50 transition-colors" title="Preview Image">
                              <Eye className="h-4 w-4" />
                            </button>
                          )}
                          
                          <button 
                            onClick={() => handleDownload(url, isPdf)}
                            className="p-2 bg-white rounded-full text-gray-900 hover:text-[#3b2fc9] hover:bg-blue-50 transition-colors" 
                            title="Download"
                          >
                            <Download className="h-4 w-4" />
                          </button>
                          
                          {(role === 'admin' || role === 'superadmin') && (
                            <button 
                              onClick={() => handleDelete(url)} 
                              disabled={deletingUrl === url}
                              className="p-2 bg-white rounded-full text-gray-900 hover:text-red-600 hover:bg-red-50 transition-colors"
                              title="Delete"
                            >
                              {deletingUrl === url ? <Loader2 className="h-4 w-4 animate-spin text-red-600" /> : <Trash2 className="h-4 w-4" />}
                            </button>
                          )}
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
            <Button onClick={onClose} className="w-full sm:w-auto bg-gray-900 hover:bg-gray-800 text-white">
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
            onClick={() => setPreviewImage(null)} 
            className="absolute -top-12 right-0 p-2 text-white hover:text-gray-300 transition-colors z-50 bg-black/20 rounded-full backdrop-blur-sm"
          >
            <X className="h-6 w-6" />
          </button>
          {previewImage && (
            <img src={previewImage} alt="Preview" className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl" />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
