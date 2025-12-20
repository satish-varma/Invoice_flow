
import React from 'react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format } from "date-fns";
import { Separator } from './ui/separator';
import type { Settings } from '@/services/settingsService';
import { Quotation, ColumnDef } from '@/services/quotationService';

interface QuotationPreviewProps {
    quotation: Quotation;
    settings: Settings;
}

export const QuotationPreview = React.forwardRef<HTMLDivElement, QuotationPreviewProps>(({ quotation, settings }, ref) => {
    
    const activeProfile = settings.companyProfiles?.find(p => p.id === quotation.companyProfileId);
    const gstRate = quotation.subtotal > 0 ? (quotation.gstAmount / (quotation.subtotal - (quotation.totalDiscount || 0))) * 100 : 0;
    
    const columns = quotation.columns || [
        { id: 'name', label: 'Item Name/Description' },
        { id: 'unit', label: 'Unit' },
        { id: 'quantity', label: 'Qty' },
        { id: 'unitPrice', label: 'Unit Price' },
        { id: 'discount', label: 'Discount'},
    ];

    const hasDiscount = quotation.lineItems.some(item => item.discount && item.discount > 0);
    const previewColumns = hasDiscount ? columns : columns.filter(c => c.id !== 'discount');


    const inWords = (num: number): string => {
        const a = ['','one ','two ','three ','four ', 'five ','six ','seven ','eight ','nine ','ten ','eleven ','twelve ','thirteen ','fourteen ','fifteen ','sixteen ','seventeen ','eighteen ','nineteen '];
        const b = ['', '', 'twenty','thirty','forty','fifty', 'sixty','seventy','eighty','ninety'];
        
        const convert = (n: string): string => {
            let str = '';
            const num = Number(n);
             if (num === 0) return '';
            const match = n.match(/^(\d{2})(\d{2})(\d{2})(\d{1})(\d{2})$/);
            if (!match) return '';
            str += (Number(match[1]) != 0) ? (a[Number(match[1])] || b[match[1][0]] + ' ' + a[match[1][1]]) + 'crore ' : '';
            str += (Number(match[2]) != 0) ? (a[Number(match[2])] || b[match[2][0]] + ' ' + a[match[2][1]]) + 'lakh ' : '';
            str += (Number(match[3]) != 0) ? (a[Number(match[3])] || b[match[3][0]] + ' ' + a[match[3][1]]) + 'thousand ' : '';
            str += (Number(match[4]) != 0) ? (a[Number(match[4])] || b[match[4][0]] + ' ' + a[match[4][1]]) + 'hundred ' : '';
            str += (Number(match[5]) != 0) ? ((str != '') ? 'and ' : '') + (a[Number(match[5])] || b[match[5][0]] + ' ' + a[match[5][1]]) : '';
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
                finalWords += ' And ' + formattedDecimalWords + ' Paise';
            } else {
                 finalWords = formattedDecimalWords + ' Paise';
            }
        }
        
        return finalWords ? finalWords + ' Only' : 'Zero Only';
    };

    return (
        <div ref={ref} className="invoice-preview-container bg-white text-black p-8">
            <Card className="w-full shadow-none border-0" style={{width: '800px', borderRadius: '0'}}>
                 <div data-pdf-body>
                    <CardHeader className="p-6">
                        <div className='text-center pb-4'>
                            <CardTitle className="text-2xl font-bold tracking-tight">QUOTATION</CardTitle>
                        </div>
                        {activeProfile ? (
                        <div className='flex justify-between items-start'>
                            <div className="space-y-1">
                                <p className='font-bold text-xl'>{activeProfile.companyName}</p>
                                <p className='text-sm w-64' style={{whiteSpace: 'pre-wrap'}}>{activeProfile.companyAddress}</p>
                                <div className='text-sm mt-1'>
                                    {activeProfile.companyGstin && <p className='mb-0'><span className='font-bold'>GSTIN:</span> {activeProfile.companyGstin}</p>}
                                    <p><span className='font-bold'>Mobile:</span> +91 7709632898</p>
                                </div>
                            </div>
                            <div className="space-y-2 text-sm pt-12">
                                <div className='grid grid-cols-[100px_1fr]'>
                                    <div className='font-bold'>Quotation No:</div>
                                    <div>{quotation.quotationNumber}</div>
                                    <div className='font-bold'>Date:</div>
                                    <div>{quotation.quotationDate ? format(new Date(quotation.quotationDate), "P") : ''}</div>
                                    <div className='font-bold'>Valid Till:</div>
                                    <div>{quotation.validityDate ? format(new Date(quotation.validityDate), "P") : ''}</div>
                                </div>
                            </div>
                        </div>
                        ) : ( <p>Company profile not found.</p> )}
                    </CardHeader>
                    <CardContent className="px-6 pt-0">
                        <Separator className='bg-gray-200'/>
                        <div className="grid grid-cols-2 gap-8 items-start py-6">
                            <div className="space-y-1">
                                <p className='font-bold text-gray-500'>TO</p>
                                <p className='font-bold'>{quotation.billToName}</p>
                                <p className='text-sm' style={{whiteSpace: 'pre-wrap'}}>{quotation.billToAddress}</p>
                            </div>
                        </div>
                        
                        <div className="mt-2">
                            <Table>
                            <TableHeader>
                                <TableRow className='border-b border-gray-300 bg-gray-50'>
                                    <TableHead className="w-[50px] font-bold text-black">S.NO.</TableHead>
                                    {previewColumns.map(col => (
                                        <TableHead key={col.id} className={`font-bold text-black ${['quantity', 'unitPrice', 'discount'].includes(col.id) ? 'text-right' : ''}`}>{col.label}</TableHead>
                                    ))}
                                    <TableHead className="text-right font-bold text-black">TOTAL</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {quotation.lineItems.map((item, index) => (
                                <TableRow key={index} className="border-b-0">
                                    <TableCell>{index + 1}</TableCell>
                                    {previewColumns.map(col => {
                                        const isDefault = ['name', 'unit', 'quantity', 'unitPrice', 'discount'].includes(col.id);
                                        const value = isDefault ? (item as any)[col.id] : item.customFields?.[col.id] || '';
                                        const isNumeric = ['quantity', 'unitPrice', 'discount'].includes(col.id);
                                        const displayValue = isNumeric ? (Number(value) || 0).toFixed(2) : value;

                                         return (
                                             <TableCell key={col.id} className={isNumeric ? 'text-right' : ''}>
                                                {displayValue}
                                             </TableCell>
                                         );
                                    })}
                                    <TableCell className="font-medium text-right">{item.total.toFixed(2)}</TableCell>
                                </TableRow>
                                ))}
                            </TableBody>
                            </Table>
                        </div>
                         <div className='mt-8 flex justify-between items-start'>
                             <div className="w-3/5">
                                <div className='text-xs'>
                                    <p className='font-semibold'>Terms and Conditions</p>
                                    <p className='whitespace-pre-wrap'>{quotation.terms}</p>
                                </div>
                             </div>
                             <div className="w-2/5 max-w-sm text-sm">
                                <table className="w-full">
                                    <tbody>
                                        <tr>
                                            <td className="py-1 text-right font-bold">SUBTOTAL</td>
                                            <td className="py-1 text-right w-[100px]">{quotation.subtotal.toFixed(2)}</td>
                                        </tr>
                                        {quotation.totalDiscount && quotation.totalDiscount > 0 && (
                                            <tr>
                                                <td className="py-1 text-right font-bold">TOTAL DISCOUNT</td>
                                                <td className="py-1 text-right text-red-600">-{quotation.totalDiscount.toFixed(2)}</td>
                                            </tr>
                                        )}
                                        <tr>
                                            <td className="py-1 text-right font-bold">GST @{gstRate.toFixed(2)}%</td>
                                            <td className="py-1 text-right">{quotation.gstAmount.toFixed(2)}</td>
                                        </tr>
                                        <tr>
                                            <td className="py-1 text-right font-bold">SHIPPING/HANDLING</td>
                                            <td className="py-1 text-right">{quotation.shipping.toFixed(2)}</td>
                                        </tr>
                                        <tr>
                                            <td className="py-1 text-right font-bold">OTHER</td>
                                            <td className="py-1 text-right">{quotation.other.toFixed(2)}</td>
                                        </tr>
                                        <tr className="font-bold text-lg">
                                            <td className="py-2 text-right border-t border-black">TOTAL</td>
                                            <td className="py-2 text-right border-t border-black">{quotation.total.toFixed(2)}</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <div className="flex justify-between items-center mt-8 text-sm">
                            <div className='w-3/5 self-center'>
                                <span className='font-bold'>In Words:</span> {inWords(quotation.total)}
                            </div>
                             {activeProfile && (
                                <div className='text-center w-2/5'>
                                    <p className="mb-2">For {activeProfile.companyName}</p>
                                    
                                    <div style={{ position: 'relative', width: '110px', height: '80px', margin: '0 auto' }}>
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img src="/sigwithsign.png" alt="Company Signature" style={{ objectFit: 'contain', width: '100%', height: '100%' }} />
                                    </div>
                                    <p className="pt-2">Authorized Signature</p>
                                </div>
                            )}
                        </div>
                    </CardContent>
                </div>
                
                 <div data-pdf-signature className="pt-8">
                </div>

                <div data-pdf-footer>
                     <CardFooter className="p-2 text-center text-xs text-gray-500 border-t border-gray-200">
                       <div className='w-full'>
                           <p>For questions concerning this invoice, please contact: </p>
                           <p>Satish Varma, (91) 7709632898, thegutguru.in@gmail.com | www.thegutguru.in</p>
                       </div>
                    </CardFooter>
                </div>
            </Card>
        </div>
    );
});
QuotationPreview.displayName = "QuotationPreview";

    