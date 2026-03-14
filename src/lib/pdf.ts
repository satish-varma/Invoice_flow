
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
    const bodyElement = element.querySelector('[data-pdf-body]') as HTMLElement;
    const signatureElement = element.querySelector('[data-pdf-signature]') as HTMLElement;
    const footerElement = element.querySelector('[data-pdf-footer]') as HTMLElement;

    if (!bodyElement || !footerElement) {
        console.error("PDF generation failed: body or footer element not found.");
        throw new Error("Required PDF structure (body or footer) not found.");
    }
    
    // Temporarily remove manifest link to prevent CORS issues with html2canvas
    const manifestLink = document.querySelector('link[rel="manifest"]');
    if (manifestLink) {
        manifestLink.remove();
    }

    try {
        const pdf = new jsPDF({
            orientation: 'p',
            unit: 'mm',
            format: 'a4'
        });

        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = pdf.internal.pageSize.getHeight();
        const canvasOptions = { scale: 2, useCORS: true, logging: false };

        // 1. Process Body
        const bodyCanvas = await html2canvas(bodyElement, canvasOptions);
        const bodyImgData = bodyCanvas.toDataURL('image/jpeg', 0.95);
        const bodyImgHeight = (bodyCanvas.height * pdfWidth) / bodyCanvas.width;

        let heightLeft = bodyImgHeight;
        let position = 0;

        pdf.addImage(bodyImgData, 'JPEG', 0, position, pdfWidth, bodyImgHeight, undefined, 'FAST');
        heightLeft -= pdfHeight;

        while (heightLeft > 0) {
            position = heightLeft - bodyImgHeight;
            pdf.addPage();
            pdf.addImage(bodyImgData, 'JPEG', 0, position, pdfWidth, bodyImgHeight, undefined, 'FAST');
            heightLeft -= pdfHeight;
        }
        
        let lastElementBottom = (bodyImgHeight % pdfHeight);
        if (lastElementBottom === 0 && bodyImgHeight > 0) {
            lastElementBottom = pdfHeight;
        }

        // 2. Process Signature (if it exists)
        if (signatureElement) {
            const signatureCanvas = await html2canvas(signatureElement, canvasOptions);
            const signatureImgData = signatureCanvas.toDataURL('image/jpeg', 0.95);
            const signatureImgHeight = (signatureCanvas.height * pdfWidth) / signatureCanvas.width;
            
            const spaceLeftOnPage = pdfHeight - lastElementBottom;

            if (signatureImgHeight > spaceLeftOnPage) {
                pdf.addPage();
                pdf.addImage(signatureImgData, 'JPEG', 0, 0, pdfWidth, signatureImgHeight, undefined, 'FAST');
                lastElementBottom = signatureImgHeight;
            } else {
                pdf.addImage(signatureImgData, 'JPEG', 0, lastElementBottom, pdfWidth, signatureImgHeight, undefined, 'FAST');
                lastElementBottom += signatureImgHeight;
            }
        }

        // 3. Process Footer
        const footerCanvas = await html2canvas(footerElement, canvasOptions);
        const footerImgData = footerCanvas.toDataURL('image/jpeg', 0.95);
        const footerImgHeight = (footerCanvas.height * pdfWidth) / footerCanvas.width;
        
        const spaceLeftForFooter = pdfHeight - lastElementBottom;

        if (footerImgHeight > spaceLeftForFooter) {
            pdf.addPage();
            pdf.addImage(footerImgData, 'JPEG', 0, pdfHeight - footerImgHeight, pdfWidth, footerImgHeight, undefined, 'FAST');
        } else {
            pdf.addImage(footerImgData, 'JPEG', 0, pdfHeight - footerImgHeight, pdfWidth, footerImgHeight, undefined, 'FAST');
        }


        // 4. Save or Return
        if (mode === 'save') {
            pdf.save(fileName);
        } else {
            return pdf.output('datauristring');
        }

    } catch (error) {
        console.error("Error generating PDF:", error);
        throw new Error("Failed to generate PDF.");
    } finally {
        // Re-add the manifest link if it was removed
        if (manifestLink) {
            document.head.appendChild(manifestLink);
        }
    }
}

