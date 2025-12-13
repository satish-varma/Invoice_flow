
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

/**
 * Generates and saves a multi-page PDF from an HTML element,
 * ensuring the footer is not split across pages.
 * @param element The HTML element to render into the PDF.
 * @param fileName The desired name of the output PDF file.
 */
export async function generateAndSavePdf(element: HTMLElement, fileName:string) {
    const bodyElement = element.querySelector('[data-pdf-body]') as HTMLElement;
    const footerElement = element.querySelector('[data-pdf-footer]') as HTMLElement;

    if (!bodyElement || !footerElement) {
        console.error("PDF generation failed: body or footer element not found.");
        throw new Error("Required PDF structure (body or footer) not found.");
    }
    
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

        // 2. Process Footer
        const footerCanvas = await html2canvas(footerElement, canvasOptions);
        const footerImgData = footerCanvas.toDataURL('image/jpeg', 0.95);
        const footerImgHeight = (footerCanvas.height * pdfWidth) / footerCanvas.width;
        
        // 3. Calculate position for the footer
        const lastPage = pdf.getNumberOfPages();
        pdf.setPage(lastPage);
        
        const bodyHeightOnLastPage = bodyImgHeight % pdfHeight || (bodyImgHeight > 0 ? pdfHeight : 0);
        const spaceLeftOnLastPage = pdfHeight - bodyHeightOnLastPage;

        if (footerImgHeight > spaceLeftOnLastPage) {
            pdf.addPage();
            pdf.addImage(footerImgData, 'JPEG', 0, 0, pdfWidth, footerImgHeight, undefined, 'FAST');
        } else {
            pdf.addImage(footerImgData, 'JPEG', 0, bodyHeightOnLastPage, pdfWidth, footerImgHeight, undefined, 'FAST');
        }

        // 4. Save PDF
        pdf.save(fileName);

    } catch (error) {
        console.error("Error generating PDF:", error);
        throw new Error("Failed to generate PDF.");
    } finally {
        if (manifestLink) {
            document.head.appendChild(manifestLink);
        }
    }
}
