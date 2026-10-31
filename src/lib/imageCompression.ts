/**
 * Client-Side Image Compression Utility
 * Resizes and compresses high-resolution smartphone selfies / receipts to lightweight JPEG.
 * Reduces 5MB-10MB camera captures down to ~70KB-100KB, optimizing local IndexedDB storage
 * and enabling instant background uploads over weak 2G/3G/4G network connections.
 */

export async function compressImage(
  dataUri: string,
  maxWidth = 800,
  maxHeight = 800,
  quality = 0.75
): Promise<string> {
  if (typeof window === 'undefined' || !dataUri || !dataUri.startsWith('data:image')) {
    return dataUri;
  }

  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      try {
        let width = img.width;
        let height = img.height;

        // Calculate aspect-ratio preserved dimensions
        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          return resolve(dataUri);
        }

        ctx.drawImage(img, 0, 0, width, height);
        const compressedUri = canvas.toDataURL('image/jpeg', quality);
        resolve(compressedUri);
      } catch (e) {
        console.warn('[ImageCompression] Canvas compression failed, falling back to original:', e);
        resolve(dataUri);
      }
    };

    img.onerror = (e) => {
      console.warn('[ImageCompression] Failed to load image for compression:', e);
      resolve(dataUri);
    };

    img.src = dataUri;
  });
}

export interface DocumentCompressionResult {
  file: File;
  originalSize: number;
  compressedSize: number;
  compressed: boolean;
  savingsPercent: number;
}

/**
 * Format bytes into readable string (e.g. 500 KB, 14.2 MB)
 */
export function formatFileSize(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

/**
 * Client-Side Document & Invoice Image Compression
 * Automatically resizes and compresses high-resolution camera photos / scans of Delivery Challans,
 * invoices, and receipts down from 10MB-20MB to ~300KB-800KB before uploading to cloud storage.
 * Preserves high-clarity document text (up to 2048px, quality 0.85).
 * Non-raster files (e.g. PDFs, SVGs) are passed through untouched.
 */
export async function compressDocumentFile(
  file: File,
  maxWidth = 2048,
  maxHeight = 2048,
  quality = 0.85
): Promise<DocumentCompressionResult> {
  const fallback: DocumentCompressionResult = {
    file,
    originalSize: file?.size || 0,
    compressedSize: file?.size || 0,
    compressed: false,
    savingsPercent: 0,
  };

  // SSR or non-browser guard
  if (typeof window === 'undefined' || typeof document === 'undefined' || !file) {
    return fallback;
  }

  // Only compress raster images; PDFs, SVGs, etc., should not be altered
  if (!file.type || !file.type.startsWith('image/') || file.type.includes('svg')) {
    return fallback;
  }

  // Files already under 250KB are lightweight and don't need recompression
  if (file.size < 250 * 1024) {
    return fallback;
  }

  return new Promise((resolve) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      const dataUri = e.target?.result as string;
      if (!dataUri) return resolve(fallback);

      const img = new Image();
      img.crossOrigin = 'anonymous';

      img.onload = () => {
        try {
          let width = img.width;
          let height = img.height;

          // Maintain aspect ratio while bounding within maxWidth/maxHeight
          if (width > maxWidth || height > maxHeight) {
            if (width > height) {
              height = Math.round((height * maxWidth) / width);
              width = maxWidth;
            } else {
              width = Math.round((width * maxHeight) / height);
              height = maxHeight;
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext('2d');
          if (!ctx) return resolve(fallback);

          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, 0, 0, width, height);

          canvas.toBlob(
            (blob) => {
              if (!blob || blob.size >= file.size) {
                // Keep original if compression didn't save size
                return resolve(fallback);
              }

              const baseName = file.name.replace(/\.[^/.]+$/, '');
              const newFile = new File([blob], `${baseName}.jpg`, {
                type: 'image/jpeg',
                lastModified: Date.now(),
              });

              const savingsPercent = Math.round(((file.size - blob.size) / file.size) * 100);

              resolve({
                file: newFile,
                originalSize: file.size,
                compressedSize: blob.size,
                compressed: true,
                savingsPercent,
              });
            },
            'image/jpeg',
            quality
          );
        } catch (err) {
          console.warn('[DocumentCompression] Canvas processing failed, falling back to original:', err);
          resolve(fallback);
        }
      };

      img.onerror = (err) => {
        console.warn('[DocumentCompression] Image load failed, falling back to original:', err);
        resolve(fallback);
      };

      img.src = dataUri;
    };

    reader.onerror = () => resolve(fallback);
    reader.readAsDataURL(file);
  });
}
