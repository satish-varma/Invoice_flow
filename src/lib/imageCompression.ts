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
