
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

/**
 * Generates and saves a multi-page PDF from an HTML element,
 * ensuring the footer is not split across pages.
 * @param element The HTML element to render into the PDF.
 * @param fileName The desired name of the output PDF file.
 */
export async function generateAndSavePdf(element: HTMLElement, fileName: string) {
    const bodyElement = element.querySelector('[data-pdf-body]') as HTMLElement;
    const footerElement = element.querySelector('[data-pdf-footer]') as HTMLElement;

    if (!bodyElement || !footerElement) {
        console.error("PDF generation failed: body or footer element not found.");
        return;
    }

    try {
        const pdf = new jsPDF({
            orientation: 'p',
            unit: 'mm',
            format: 'a4'
        });

        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = pdf.internal.pageSize.getHeight();
        const canvasOptions = { scale: 2, useCORS: true };
        const jpegQuality = 0.9; // High quality JPEG

        // 1. Process Body
        const bodyCanvas = await html2canvas(bodyElement, canvasOptions);
        const bodyImgData = bodyCanvas.toDataURL('image/jpeg', jpegQuality);
        const bodyCanvasWidth = bodyCanvas.width;
        const bodyCanvasHeight = bodyCanvas.height;
        const bodyAspectRatio = bodyCanvasWidth / bodyCanvasHeight;
        const bodyImgHeightInPdf = pdfWidth / bodyAspectRatio;

        let heightLeft = bodyImgHeightInPdf;
        let position = 0;

        pdf.addImage(bodyImgData, 'JPEG', 0, position, pdfWidth, bodyImgHeightInPdf, undefined, 'FAST');
        heightLeft -= pdfHeight;

        while (heightLeft > 0) {
            position = heightLeft - bodyImgHeightInPdf;
            pdf.addPage();
            pdf.addImage(bodyImgData, 'JPEG', 0, position, pdfWidth, bodyImgHeightInPdf, undefined, 'FAST');
            heightLeft -= pdfHeight;
        }

        // 2. Process Footer
        const footerCanvas = await html2canvas(footerElement, canvasOptions);
        const footerImgData = footerCanvas.toDataURL('image/jpeg', jpegQuality);
        const footerCanvasWidth = footerCanvas.width;
        const footerCanvasHeight = footerCanvas.height;
        const footerAspectRatio = footerCanvasWidth / footerCanvasHeight;
        const footerImgHeightInPdf = pdfWidth / footerAspectRatio;

        // 3. Calculate position for the footer
        const bodyHeightOnLastPage = bodyImgHeightInPdf % pdfHeight || pdfHeight; // Use pdfHeight if it's a full page
        const spaceLeftOnLastPage = pdfHeight - bodyHeightOnLastPage;

        if (footerImgHeightInPdf > spaceLeftOnLastPage) {
            pdf.addPage();
            position = 0; // Top of the new page
        } else {
            position = bodyHeightOnLastPage;
        }

        pdf.addImage(footerImgData, 'JPEG', 0, position, pdfWidth, footerImgHeightInPdf, undefined, 'FAST');

        // 4. Save PDF
        pdf.save(fileName);

    } catch (error) {
        console.error("Error generating PDF:", error);
        throw new Error("Failed to generate PDF.");
    }
}
