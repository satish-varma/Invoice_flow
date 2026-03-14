
import React from 'react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format } from "date-fns";
import { Invoice } from '@/services/invoiceService';
import { Separator } from './ui/separator';
import type { Settings, CompanyProfile } from '@/services/settingsService';
import Image from 'next/image';

interface InvoicePreviewProps {
    invoice: Invoice;
    settings: Settings;
}

export const InvoicePreview = React.forwardRef<HTMLDivElement, InvoicePreviewProps>(({ invoice, settings }, ref) => {

    const currencySymbol = settings.currencySymbol || '₹';
    const isINR = settings.currency === 'INR' || !settings.currency;
    const activeProfile = settings.companyProfiles?.find(p => p.id === invoice.companyProfileId);
    const template = settings.pdfTemplate || 'classic';
    const primaryColor = settings.primaryColor || '#3b82f6';

    const inWords = (num: number): string => {
        const a = ['', 'one ', 'two ', 'three ', 'four ', 'five ', 'six ', 'seven ', 'eight ', 'nine ', 'ten ', 'eleven ', 'twelve ', 'thirteen ', 'fourteen ', 'fifteen ', 'sixteen ', 'seventeen ', 'eighteen ', 'nineteen '];
        const b = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];

        const convert = (n: string): string => {
            let str = '';
            const num = Number(n);
            if (num === 0) return '';
            const match = n.match(/^(\d{2})(\d{2})(\d{2})(\d{1})(\d{2})$/);
            if (!match) return '';

            const n1 = Number(match[1]);
            const n2 = Number(match[2]);
            const n3 = Number(match[3]);
            const n4 = Number(match[4]);
            const n5 = Number(match[5]);

            str += (n1 != 0) ? (a[n1] || b[Number(match[1][0])] + ' ' + a[Number(match[1][1])]) + 'crore ' : '';
            str += (n2 != 0) ? (a[n2] || b[Number(match[2][0])] + ' ' + a[Number(match[2][1])]) + 'lakh ' : '';
            str += (n3 != 0) ? (a[n3] || b[Number(match[3][0])] + ' ' + a[Number(match[3][1])]) + 'thousand ' : '';
            str += (n4 != 0) ? (a[n4] || b[n4]) + 'hundred ' : '';
            str += (n5 != 0) ? ((str != '') ? 'and ' : '') + (a[n5] || b[Number(match[5][0])] + ' ' + a[Number(match[5][1])]) : '';
            return str;
        }

        const numStr = num.toFixed(2);
        const [integerPart, decimalPart] = numStr.split('.');
        let integerWords = '';
        if (Number(integerPart) > 0) {
            integerWords = convert(('000000000' + integerPart).substr(-9));
        }

        let finalWords = integerWords.trim().split(' ').map(s => s.charAt(0).toUpperCase() + s.substring(1)).join(' ');

        if (Number(decimalPart) > 0) {
            let decimalWords = '';
            if (Number(decimalPart) > 0) {
                decimalWords = convert(('000000000' + decimalPart).substr(-9));
            }
            const formattedDecimalWords = decimalWords.trim().split(' ').map(s => s.charAt(0).toUpperCase() + s.substring(1)).join(' ');

            if (finalWords) {
                finalWords += ' And ' + formattedDecimalWords + (isINR ? ' Paise' : ' Cents');
            } else {
                finalWords = formattedDecimalWords + (isINR ? ' Paise' : ' Cents');
            }
        }

        return finalWords ? finalWords + ' Only' : 'Zero Only';
    };

    const renderHeader = () => {
        if (!activeProfile) return <p>Company profile not found.</p>;

        if (template === 'modern') {
            return (
                <div className='flex justify-between items-start border-b pb-8' style={{ borderColor: primaryColor }}>
                    <div className="space-y-2">
                        <p className='font-bold text-3xl' style={{ color: primaryColor }}>{activeProfile.companyName}</p>
                        <p className='text-sm w-80 text-gray-600' style={{ whiteSpace: 'pre-wrap' }}>{activeProfile.companyAddress}</p>
                        <div className='text-xs text-gray-500'>
                            {activeProfile.companyGstin && <p><span className='font-bold'>GSTIN:</span> {activeProfile.companyGstin}</p>}
                            {activeProfile.companyPan && <p><span className='font-bold'>PAN:</span> {activeProfile.companyPan}</p>}
                        </div>
                    </div>
                    <div className="text-right space-y-1">
                        <h1 className='text-4xl font-black uppercase tracking-tighter' style={{ color: primaryColor }}>Invoice</h1>
                        <p className='text-sm font-bold'>#{invoice.invoiceNumber}</p>
                        <p className='text-sm text-gray-500'>{invoice.date ? format(new Date(invoice.date), "MMMM dd, yyyy") : ''}</p>
                    </div>
                </div>
            );
        }

        if (template === 'minimal') {
            return (
                <div className='text-center space-y-4 pb-8 border-b'>
                    <h1 className='text-sm uppercase tracking-[0.2em] text-gray-400'>Bill of Supply</h1>
                    <p className='font-light text-5xl tracking-tight'>{activeProfile.companyName}</p>
                    <p className='text-xs uppercase text-gray-500 max-w-md mx-auto'>{activeProfile.companyAddress}</p>
                    <div className='flex justify-center gap-8 text-[10px] uppercase tracking-widest text-gray-400 pt-2'>
                        <span>Inv: {invoice.invoiceNumber}</span>
                        <span>Date: {invoice.date ? format(new Date(invoice.date), "dd/MM/yyyy") : ''}</span>
                        {activeProfile.companyGstin && <span>GST: {activeProfile.companyGstin}</span>}
                    </div>
                </div>
            );
        }

        // Classic (Default)
        return (
            <>
                <div className='text-center pb-4'>
                    <CardTitle className="text-2xl font-bold tracking-tight">BILL OF SUPPLY</CardTitle>
                    <p className='text-sm'>(Original For Recipient)</p>
                </div>
                <div className='flex justify-between items-start'>
                    <div className="space-y-1">
                        <p className='font-bold text-xl'>{activeProfile.companyName}</p>
                        <p className='text-sm w-64' style={{ whiteSpace: 'pre-wrap' }}>{activeProfile.companyAddress}</p>
                        <div className='text-sm mt-1 text-gray-600'>
                            {activeProfile.companyGstin && <p className='mb-0'><span className='font-bold text-black'>GSTIN:</span> {activeProfile.companyGstin}</p>}
                            {activeProfile.companyPan && <p><span className='font-bold text-black'>PAN:</span> {activeProfile.companyPan}</p>}
                        </div>
                    </div>
                    <div className="space-y-2 text-sm pt-12">
                        <div className='grid grid-cols-[120px_1fr]'>
                            <div className='font-bold'>Invoice No.:</div>
                            <div>{invoice.invoiceNumber}</div>
                            <div className='font-bold'>Invoice Date:</div>
                            <div>{invoice.date ? format(new Date(invoice.date), "P") : ''}</div>
                            {invoice.period && <><div className='font-bold'>Period:</div><div>{invoice.period}</div></>}
                            {invoice.delivery && <><div className='font-bold'>Delivery:</div><div>{invoice.delivery}</div></>}
                        </div>
                    </div>
                </div>
            </>
        );
    };

    return (
        <div ref={ref} className="invoice-preview-container bg-white text-black p-8">
            <Card className="w-full shadow-none border-0" style={{ width: '800px', borderRadius: '0' }}>
                <div data-pdf-body>
                    <CardHeader className="p-6">
                        {renderHeader()}
                    </CardHeader>
                    <CardContent className="px-6 pt-0">
                        {template === 'classic' && <Separator className='bg-gray-200' />}

                        <div className={`grid grid-cols-[65%_35%] gap-8 items-start py-6 ${template === 'minimal' ? 'border-b mb-6' : ''}`}>
                            <div className="space-y-1">
                                <p className='font-bold text-gray-500 uppercase text-[10px] tracking-wider'>Bill To:</p>
                                <p className='font-bold text-lg'>{invoice.billToName}</p>
                                <p className='text-sm text-gray-600 font-medium' style={{ whiteSpace: 'pre-wrap' }}>{invoice.billToAddress}</p>
                                {invoice.billToGst && <p className='text-xs text-gray-400 mt-1'>GSTIN: {invoice.billToGst}</p>}
                            </div>
                            <div className='space-y-1'>
                                <p className='font-bold text-gray-500 uppercase text-[10px] tracking-wider'>Ship To:</p>
                                <p className='font-bold text-lg'>{invoice.shipToName || invoice.billToName}</p>
                                <p className='text-sm text-gray-600 font-medium' style={{ whiteSpace: 'pre-wrap' }}>{invoice.shipToAddress || invoice.billToAddress}</p>
                                {invoice.shipToGst && <p className='text-xs text-gray-400 mt-1'>GSTIN: {invoice.shipToGst}</p>}
                            </div>
                        </div>

                        <div className="mt-2">
                            <Table>
                                <TableHeader>
                                    <TableRow className={`border-b ${template === 'minimal' ? 'bg-transparent' : 'bg-gray-50'}`} style={{ borderBottomColor: template === 'modern' ? primaryColor : undefined }}>
                                        <TableHead className="w-[50px] font-bold text-black uppercase text-[10px] tracking-widest">S.No</TableHead>
                                        <TableHead className="w-1/2 font-bold text-black uppercase text-[10px] tracking-widest">Item &amp; Description</TableHead>
                                        <TableHead className="w-[100px] text-right font-bold text-black uppercase text-[10px] tracking-widest">Qty</TableHead>
                                        <TableHead className="w-[120px] text-right font-bold text-black uppercase text-[10px] tracking-widest">Rate ({currencySymbol})</TableHead>
                                        <TableHead className="w-[120px] text-right font-bold text-black uppercase text-[10px] tracking-widest">Amount ({currencySymbol})</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {invoice.lineItems.map((item, index) => (
                                        <TableRow key={index} className="border-b-0 hover:bg-transparent">
                                            <TableCell className='py-4'>{index + 1}</TableCell>
                                            <TableCell className='py-4 font-medium'>{item.name}</TableCell>
                                            <TableCell className="text-right py-4">{item.quantity}</TableCell>
                                            <TableCell className="text-right py-4">{currencySymbol} {item.price.toFixed(2)}</TableCell>
                                            <TableCell className="font-bold text-right py-4">{currencySymbol} {(item.quantity * item.price).toFixed(2)}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>

                        <div className='mt-8 pt-4 border-t' style={{ borderTopWidth: template === 'modern' ? '2px' : '1px', borderTopColor: template === 'modern' ? primaryColor : undefined }}>
                            <div className='flex justify-between items-start'>
                                <div className="w-3/5">
                                    <div className='text-sm'>
                                        <span className='font-bold text-gray-500 uppercase text-[10px] tracking-wider block mb-1'>Total in Words</span>
                                        <p className='font-medium italic text-gray-700'>{inWords(invoice.total)}</p>
                                    </div>
                                </div>
                                <div className="w-2/5 max-w-sm text-sm">
                                    <table className="w-full">
                                        <tbody className='space-y-2'>
                                            <tr>
                                                <td className="py-1 text-gray-500 font-medium">Subtotal</td>
                                                <td className="py-1 text-right font-bold">{currencySymbol} {invoice.subtotal.toFixed(2)}</td>
                                            </tr>
                                            {invoice.taxes?.map((tax, index) => (
                                                <tr key={index}>
                                                    <td className="py-1 text-gray-500 font-medium">{tax.name}</td>
                                                    <td className="py-1 text-right font-bold">{currencySymbol} {tax.amount.toFixed(2)}</td>
                                                </tr>
                                            ))}
                                            <tr className="border-t-2" style={{ borderTopColor: template === 'modern' ? primaryColor : undefined }}>
                                                <td className="py-3 font-bold text-lg uppercase tracking-wider" style={{ color: template === 'modern' ? primaryColor : undefined }}>Grand Total</td>
                                                <td className="py-3 text-right font-black text-xl" style={{ color: template === 'modern' ? primaryColor : undefined }}>{currencySymbol} {invoice.total.toFixed(2)}</td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </div>
                {activeProfile && (
                    <div data-pdf-footer>
                        <CardFooter className="p-6 flex-col items-start gap-4 border-t border-gray-100 mt-12">
                            <div className='w-full grid grid-cols-[70%_30%] gap-8'>
                                <div className='text-[10px] text-gray-400'>
                                    <p className='font-bold mb-2 uppercase tracking-widest text-gray-500'>Payment Information</p>
                                    <div className='grid grid-cols-[100px_1fr] gap-y-1'>
                                        <div className='font-bold uppercase'>Beneficiary:</div>
                                        <div className='text-gray-600'>{activeProfile.bankBeneficiary}</div>
                                        <div className='font-bold uppercase'>Bank:</div>
                                        <div className='text-gray-600'>{activeProfile.bankName}</div>
                                        <div className='font-bold uppercase'>Account:</div>
                                        <div className='text-gray-600 font-bold'>{activeProfile.bankAccount}</div>
                                        <div className='font-bold uppercase'>IFSC:</div>
                                        <div className='text-gray-600'>{activeProfile.bankIfsc}</div>
                                    </div>
                                </div>
                                <div className='flex flex-col justify-end items-center h-full text-xs'>
                                    <div className='text-center w-full'>
                                        <p className="mb-2 font-bold text-gray-500 uppercase tracking-widest">Authorized Signatory</p>
                                        {activeProfile.stampLogoUrl && (
                                            <div className='relative w-[80px] h-[80px] mx-auto my-2 opacity-80'>
                                                <Image src={activeProfile.stampLogoUrl} alt="Company Stamp" fill sizes="80px" className="object-contain" priority />
                                            </div>
                                        )}
                                        <p className="mt-2 text-gray-600 italic">For {activeProfile.companyName}</p>
                                    </div>
                                </div>
                            </div>
                        </CardFooter>
                    </div>
                )}
            </Card>
        </div>
    );
});
InvoicePreview.displayName = "InvoicePreview";
