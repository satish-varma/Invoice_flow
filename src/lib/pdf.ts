
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

        // 1. Process Body
        const bodyCanvas = await html2canvas(bodyElement, canvasOptions);
        const bodyImgData = bodyCanvas.toDataURL('image/png');
        const bodyCanvasWidth = bodyCanvas.width;
        const bodyCanvasHeight = bodyCanvas.height;
        const bodyAspectRatio = bodyCanvasWidth / bodyCanvasHeight;
        const bodyImgHeightInPdf = pdfWidth / bodyAspectRatio;

        let heightLeft = bodyImgHeightInPdf;
        let position = 0;

        pdf.addImage(bodyImgData, 'PNG', 0, position, pdfWidth, bodyImgHeightInPdf);
        heightLeft -= pdfHeight;

        while (heightLeft > 0) {
            position = heightLeft - bodyImgHeightInPdf;
            pdf.addPage();
            pdf.addImage(bodyImgData, 'PNG', 0, position, pdfWidth, bodyImgHeightInPdf);
            heightLeft -= pdfHeight;
        }

        // 2. Process Footer
        const footerCanvas = await html2canvas(footerElement, canvasOptions);
        const footerImgData = footerCanvas.toDataURL('image/png');
        const footerCanvasWidth = footerCanvas.width;
        const footerCanvasHeight = footerCanvas.height;
        const footerAspectRatio = footerCanvasWidth / footerCanvasHeight;
        const footerImgHeightInPdf = pdfWidth / footerAspectRatio;

        // 3. Check if footer fits on the last page
        const spaceOnLastPage = pdfHeight - (bodyImgHeightInPdf % pdfHeight);

        if (footerImgHeightInPdf > spaceOnLastPage) {
            pdf.addPage();
            position = 0; // Reset position to top of new page
        } else {
            // Position it after the body content on the same page
            position = bodyImgHeightInPdf % pdfHeight;
            if (position === 0) {
              // This case happens if the body ends exactly at the page bottom.
              // We still need to check if footer fits.
              // If we are here, it means it *does* fit, but position should not be 0.
              // Let's re-calculate position based on the last page's content height.
              const bodyHeightOnLastPage = bodyImgHeightInPdf - (pdf.internal.getNumberOfPages() - 1) * pdfHeight;
              position = bodyHeightOnLastPage;
            }
        }
        
        // Add a small margin if placing on the same page
        if (position !== 0) {
            position += 5; 
        }

        // If the adjusted position plus footer height exceeds page, new page.
        if(position + footerImgHeightInPdf > pdfHeight) {
            pdf.addPage();
            position = 0;
        }


        pdf.addImage(footerImgData, 'PNG', 0, position, pdfWidth, footerImgHeightInPdf);

        // 4. Save PDF
        pdf.save(fileName);

    } catch (error) {
        console.error("Error generating PDF:", error);
        throw new Error("Failed to generate PDF.");
    }
}
