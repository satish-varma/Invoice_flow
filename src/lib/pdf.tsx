
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { renderToStaticMarkup } from 'react-dom/server';
import { Invoice } from '@/services/invoiceService';
import { InvoicePreview } from '@/components/invoice-preview';

export async function generateInvoicePdf(invoice: Invoice): Promise<string> {
    const invoiceElement = document.createElement('div');
    // Hide the element from the user's view
    invoiceElement.style.position = 'absolute';
    invoiceElement.style.left = '-9999px';
    invoiceElement.style.top = '-9999px';
    invoiceElement.style.width = '800px'; 
    
    const staticMarkup = renderToStaticMarkup(
        // Basic HTML structure with Tailwind CSS link is needed if your component uses it for styling during SSR
        // However, since InvoicePreview uses inline styles or simple classNames that map to a design system, it should be okay.
        <html lang="en">
            <body>
                <div style={{width: '800px'}}>
                     <InvoicePreview invoice={invoice} />
                </div>
            </body>
        </html>
    );
    invoiceElement.innerHTML = staticMarkup;
    document.body.appendChild(invoiceElement);
    
    const input = invoiceElement.querySelector('.invoice-preview-container') as HTMLElement;
    
    if (!input) {
        document.body.removeChild(invoiceElement);
        throw new Error("Could not find invoice preview element for PDF generation.");
    }
      
    // Add a class for specific PDF styling if needed
    input.classList.add('pdf-capture');

    const canvas = await html2canvas(input, { scale: 2, useCORS: true, logging: false });
    
    // Remove the class after capture
    input.classList.remove('pdf-capture');
    
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
    
    pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
    
    // Cleanup the temporary element
    document.body.removeChild(invoiceElement);

    // Return the PDF as a data URL
    return pdf.output('datauristring');
};

export async function downloadInvoicePdf(invoice: Invoice) {
    const pdfDataUri = await generateInvoicePdf(invoice);
    const link = document.createElement('a');
    link.href = pdfDataUri;
    link.download = `invoice-${invoice.invoiceNumber || 'untitled'}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}
