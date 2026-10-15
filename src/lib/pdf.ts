
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

function arrayBufferToBase64(buffer: ArrayBuffer): string {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
}

export interface GeneratedPdfResult {
    blob: Blob;
    url: string;
    fileName: string;
    arrayBuffer: ArrayBuffer;
}

/**
 * Generates a multi-page PDF from an HTML element with discrete body, signature, and footer sections.
 * Supports Desktop Web, Mobile Browser (Web Share), and Native Capacitor Android.
 */
export async function generateAndSavePdf(
    element: HTMLElement,
    fileName: string,
    mode: 'preview'
): Promise<string>;
export async function generateAndSavePdf(
    element: HTMLElement,
    fileName: string,
    mode?: 'save'
): Promise<GeneratedPdfResult>;
export async function generateAndSavePdf(
    element: HTMLElement,
    fileName: string,
    mode?: 'save' | 'preview'
): Promise<GeneratedPdfResult | string>;
export async function generateAndSavePdf(
    element: HTMLElement,
    fileName: string,
    mode: 'save' | 'preview' = 'save'
): Promise<GeneratedPdfResult | string> {
    console.log("Starting PDF generation for:", fileName);
    
    // 0. Wait for all images to be loaded
    const images = Array.from(element.querySelectorAll('img'));
    console.log(`Waiting for ${images.length} images to load...`);
    await Promise.all(images.map(img => {
        if (img.complete) return Promise.resolve(null);
        return new Promise((resolve) => {
            img.onload = () => resolve(null);
            img.onerror = () => resolve(null);
        });
    }));

    try {
        console.log("Starting Capture...");
        const canvas = await html2canvas(element, {
            scale: 1.5, // 1.5 is a sweet spot for high res without hitting memory limits
            useCORS: true,
            logging: false,
            backgroundColor: '#ffffff',
            imageTimeout: 15000,
            windowWidth: 1200, // Forces desktop layout viewport so 794px A4 element is not squished on 390px mobile screens
            scrollX: 0,
            scrollY: 0,
            ignoreElements: (el) => el.classList.contains('no-print')
        });

        console.log("Canvas captured. Size:", canvas.width, "x", canvas.height);
        
        const pdf = new jsPDF('p', 'mm', 'a4', true); // Use compression
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = pdf.internal.pageSize.getHeight();
        
        // Calculate the height of the image in mm to match PDF width
        const imgWidth = canvas.width;
        const imgHeight = (canvas.height * pdfWidth) / imgWidth;
        
        let heightLeft = imgHeight;
        let position = 0;

        // Use JPEG for PDF embedding - much more stable for large files
        const imgData = canvas.toDataURL('image/jpeg', 0.95);

        pdf.addImage(imgData, 'JPEG', 0, position, pdfWidth, imgHeight, undefined, 'FAST');
        heightLeft -= pdfHeight;

        while (heightLeft > 0) {
            position = heightLeft - imgHeight;
            pdf.addPage();
            pdf.addImage(imgData, 'JPEG', 0, position, pdfWidth, imgHeight, undefined, 'FAST');
            heightLeft -= pdfHeight;
        }

        if (mode === 'save') {
            const safeName = fileName.replace(/[/\\?%*:|"<>#]/g, '-').replace(/\s+/g, '_');
            const finalName = safeName.toLowerCase().endsWith('.pdf') ? safeName : `${safeName}.pdf`;
            
            console.log("Preparing file output for:", finalName);
            const arrayBuffer = pdf.output('arraybuffer');
            const blob = new Blob([arrayBuffer], { type: 'application/pdf' });
            const blobUrl = URL.createObjectURL(blob);
            const base64Data = arrayBufferToBase64(arrayBuffer);

            // 1. Native AndroidBridge (MediaStore.Downloads + Notification + Auto-view, 100% in-app)
            if (typeof window !== 'undefined' && (window as any).AndroidBridge?.savePdfToDownloads) {
                console.log("Using native AndroidBridge for in-app download...");
                try {
                    const ok = (window as any).AndroidBridge.savePdfToDownloads(base64Data, finalName, 'Delivery Challan');
                    if (ok) {
                        return {
                            blob,
                            url: blobUrl,
                            fileName: finalName,
                            arrayBuffer,
                        };
                    }
                } catch (bridgeErr) {
                    console.warn("AndroidBridge save failed, trying fallback:", bridgeErr);
                }
            }

            // 2. Native Capacitor Android / iOS Handling
            if (Capacitor.isNativePlatform()) {
                console.log("Native Capacitor detected, saving via Filesystem & Share...");
                try {
                    // Save to Documents directory (accessible to user)
                    await Filesystem.writeFile({
                        path: finalName,
                        data: base64Data,
                        directory: Directory.Documents
                    });
                    console.log("File written to Documents:", finalName);
                } catch (docErr) {
                    console.warn("Documents write failed, falling back to cache:", docErr);
                    try {
                        const savedFile = await Filesystem.writeFile({
                            path: finalName,
                            data: base64Data,
                            directory: Directory.Cache
                        });
                        await Share.share({
                            title: finalName,
                            text: `Delivery Challan ${finalName}`,
                            url: savedFile.uri,
                            dialogTitle: `Save or Open ${finalName}`,
                        });
                    } catch (shareErr) {
                        console.warn("Share fallback failed:", shareErr);
                    }
                }
                return {
                    blob,
                    url: blobUrl,
                    fileName: finalName,
                    arrayBuffer,
                };
            }

            // 3. Mobile Browser Web Share API Handling (Chrome on Android, Safari on iOS)
            if (typeof navigator !== 'undefined' && typeof navigator.canShare === 'function') {
                try {
                    const file = new File([blob], finalName, { type: 'application/pdf' });
                    if (navigator.canShare({ files: [file] })) {
                        console.log("Using Web Share API with File object...");
                        await navigator.share({
                            files: [file],
                            title: finalName,
                            text: `Delivery Challan: ${finalName}`,
                        });
                        console.log("Web Share completed.");
                        return {
                            blob,
                            url: blobUrl,
                            fileName: finalName,
                            arrayBuffer,
                        };
                    }
                } catch (shareErr: any) {
                    if (shareErr.name === 'AbortError') {
                        console.log("User dismissed share dialog.");
                        return {
                            blob,
                            url: blobUrl,
                            fileName: finalName,
                            arrayBuffer,
                        };
                    }
                    console.warn("Web Share failed, falling back to anchor download:", shareErr);
                }
            }

            // 4. Desktop / Standard Browser Anchor Download (Immediate 1-click download, NO POPUP!)
            console.log("Triggering anchor download for desktop...");
            const link = document.createElement('a');
            link.style.display = 'none';
            link.href = blobUrl;
            link.download = finalName;
            document.body.appendChild(link);
            link.click();
            
            setTimeout(() => {
                if (link.parentNode) {
                    link.parentNode.removeChild(link);
                }
                URL.revokeObjectURL(blobUrl);
            }, 3000);

            console.log("PDF Saved directly as:", finalName, "Blob Size:", (blob.size / 1024).toFixed(2), "KB");

            return {
                blob,
                url: blobUrl,
                fileName: finalName,
                arrayBuffer,
            };
        } else {
            console.log("Generating Preview Blob...");
            const blob = pdf.output('blob');
            return URL.createObjectURL(blob);
        }
    } catch (error) {
        console.error("CRITICAL ERROR generating PDF:", error);
        throw error;
    }
}
