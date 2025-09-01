
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

/**
 * Generates and saves a multi-page PDF from an HTML element.
 * @param element The HTML element to render into the PDF.
 * @param fileName The desired name of the output PDF file.
 */
export async function generateAndSavePdf(element: HTMLElement, fileName: string) {
    if (!element) {
        console.error("PDF generation failed: element not found.");
        return;
    }

    try {
        // Use a higher scale for better quality
        const canvas = await html2canvas(element, { scale: 2, useCORS: true });
        const imgData = canvas.toDataURL('image/png');
        
        const pdf = new jsPDF({
            orientation: 'p',
            unit: 'mm',
            format: 'a4'
        });

        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = pdf.internal.pageSize.getHeight();
        const canvasWidth = canvas.width;
        const canvasHeight = canvas.height;
        const canvasAspectRatio = canvasWidth / canvasHeight;
        
        // Calculate the height of the image when fitted to the PDF's width
        const imgHeightInPdf = pdfWidth / canvasAspectRatio;

        let heightLeft = imgHeightInPdf;
        let position = 0;

        // Add the first page
        pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, imgHeightInPdf);
        heightLeft -= pdfHeight;

        // Add new pages if the content is taller than one page
        while (heightLeft > 0) {
            position = heightLeft - imgHeightInPdf;
            pdf.addPage();
            pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, imgHeightInPdf);
            heightLeft -= pdfHeight;
        }

        pdf.save(fileName);

    } catch (error) {
        console.error("Error generating PDF:", error);
        // Optionally, throw the error or show a notification to the user
        throw new Error("Failed to generate PDF.");
    }
}
