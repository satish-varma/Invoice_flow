
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

/**
 * Generates a multi-page PDF from an HTML element with discrete body, signature, and footer sections.
 * @param element The HTML element to render into the PDF.
 * @param fileName The desired name of the output PDF file (used only in 'save' mode).
 * @param mode 'save' to trigger download, 'preview' to return data URI.
 * @returns Promise<string | void> Data URI if mode is 'preview', void otherwise.
 */
export async function generateAndSavePdf(element: HTMLElement, fileName: string, mode: 'save' | 'preview' = 'save'): Promise<string | void> {
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
            
            console.log("Triggering save for:", finalName);
            // jsPDF save() is generally robust
            pdf.save(finalName);
            
            // Return size for logging
            const blob = pdf.output('blob');
            console.log("PDF Generated. Blob Size:", (blob.size / 1024).toFixed(2), "KB");
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
