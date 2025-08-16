
import React from 'react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format } from "date-fns";
import { Invoice } from '@/services/invoiceService';
import { Separator } from './ui/separator';

interface InvoicePreviewProps {
    invoice: Invoice;
}

export const InvoicePreview = React.forwardRef<HTMLDivElement, InvoicePreviewProps>(({ invoice }, ref) => {
    
    const inWords = (num: number): string => {
        const a = ['','one ','two ','three ','four ', 'five ','six ','seven ','eight ','nine ','ten ','eleven ','twelve ','thirteen ','fourteen ','fifteen ','sixteen ','seventeen ','eighteen ','nineteen '];
        const b = ['', '', 'twenty','thirty','forty','fifty', 'sixty','seventy','eighty','ninety'];
        const n = ('000000000' + num).substr(-9).match(/^(\d{2})(\d{2})(\d{2})(\d{1})(\d{2})$/);
        if (!n) return '';
        let str = '';
        str += (Number(n[1]) != 0) ? (a[Number(n[1])] || b[n[1][0]] + ' ' + a[n[1][1]]) + 'crore ' : '';
        str += (Number(n[2]) != 0) ? (a[Number(n[2])] || b[n[2][0]] + ' ' + a[n[2][1]]) + 'lakh ' : '';
        str += (Number(n[3]) != 0) ? (a[Number(n[3])] || b[n[3][0]] + ' ' + a[n[3][1]]) + 'thousand ' : '';
        str += (Number(n[4]) != 0) ? (a[Number(n[4])] || b[n[4][0]] + ' ' + a[n[4][1]]) + 'hundred ' : '';
        str += (Number(n[5]) != 0) ? ((str != '') ? 'and ' : '') + (a[Number(n[5])] || b[n[5][0]] + ' ' + a[n[5][1]]) : '';
        return str.trim().split(' ').map(s => s.charAt(0).toUpperCase() + s.substring(1)).join(' ') + ' Only';
    };
    
    return (
        <div ref={ref} className="invoice-preview-container bg-white">
            <Card className="w-full shadow-none border-2 border-black" style={{width: '800px', borderRadius: '0'}}>
                <CardHeader className="p-0">
                    <div className='text-center p-2 border-b-2 border-black'>
                        <CardTitle className="text-xl font-bold tracking-tight">BILL TO SUPPLY</CardTitle>
                    </div>
                    <div className='flex justify-between items-center p-2'>
                        <p className='font-bold text-lg'>THE GUT GURU</p>
                        <p className='text-xs'>Original For recipient</p>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="grid grid-cols-2 border-y-2 border-black">
                        <div className="border-r-2 border-black p-2">
                             <p className='font-bold'>From:</p>
                             <p className='font-bold'>THE GUT GURU</p>
                             <p className='text-sm' style={{whiteSpace: 'pre-wrap'}}>H NO.6-46/3/A, Venkateswarao nagar, Chanda Nagar, Hyderabad-500050</p>
                             <p className='text-sm'><span className='font-bold'>GSTIN:</span> 36DDTPJ6536D1Z8</p>
                             <p className='text-sm'><span className='font-bold'>PAN:</span> DDTPJ6536D</p>
                        </div>
                        <div className="p-2">
                             <div className='grid grid-cols-[100px_1fr]'>
                                <div className='font-bold'>Invoice Date:</div>
                                <div>{invoice.date ? format(new Date(invoice.date), "P") : ''}</div>
                                <div className='font-bold'>Invoice No.:</div>
                                <div>{invoice.invoiceNumber}</div>
                                <div className='font-bold'>Period:</div>
                                <div>{invoice.period}</div>
                                <div className='font-bold'>Delivery:</div>
                                <div>{invoice.delivery}</div>
                            </div>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 border-b-2 border-black">
                        <div className="border-r-2 border-black p-2">
                            <p className='font-bold p-1 bg-gray-200'>Bill To:</p>
                            <p className='font-bold'>{invoice.billToName}</p>
                            <p style={{whiteSpace: 'pre-wrap'}}>{invoice.billToAddress}</p>
                            <p><span className='font-bold'>GST NO:</span> {invoice.billToGst}</p>
                        </div>
                         <div className='p-2'>
                            <p className='font-bold p-1 bg-gray-200'>Ship To:</p>
                            <p className='font-bold'>{invoice.shipToName}</p>
                            <p style={{whiteSpace: 'pre-wrap'}}>{invoice.shipToAddress}</p>
                            <p><span className='font-bold'>GSTIN:</span> {invoice.shipToGst}</p>
                        </div>
                    </div>
                    
                    <div className="mt-0">
                        <Table>
                        <TableHeader>
                            <TableRow className='border-b-2 border-black'>
                                <TableHead className="w-[50px] border-r-2 border-black font-bold text-black">S.No</TableHead>
                                <TableHead className="w-1/2 border-r-2 border-black font-bold text-black">Item & Description</TableHead>
                                <TableHead className="w-[100px] text-right border-r-2 border-black font-bold text-black">Qty</TableHead>
                                <TableHead className="w-[120px] text-right border-r-2 border-black font-bold text-black">Rate</TableHead>
                                <TableHead className="w-[120px] text-right font-bold text-black">Amount</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {invoice.lineItems.map((item, index) => (
                            <TableRow key={index} className="border-b border-black/20">
                                <TableCell className='border-r-2 border-black'>{index + 1}</TableCell>
                                <TableCell className='border-r-2 border-black'>{item.name}</TableCell>
                                <TableCell className="text-right border-r-2 border-black">{item.quantity}</TableCell>
                                <TableCell className="text-right border-r-2 border-black">{item.price.toFixed(2)}</TableCell>
                                <TableCell className="font-medium text-right">{(item.quantity * item.price).toFixed(2)}</TableCell>
                            </TableRow>
                            ))}
                             <TableRow className="border-y-2 border-black">
                                <TableCell className='border-r-2 border-black' colSpan={3}></TableCell>
                                <TableCell className="text-right border-r-2 border-black font-bold">Total</TableCell>
                                <TableCell className="font-medium text-right font-bold">{invoice.subtotal.toFixed(2)}</TableCell>
                            </TableRow>
                        </TableBody>
                        </Table>
                    </div>
                    <div className='grid grid-cols-2 border-b-2 border-black'>
                        <div className='border-r-2 border-black p-1'>
                           <span className='font-bold'>In Words</span>: {inWords(invoice.total)}
                        </div>
                        <div>
                             <div className='grid grid-cols-2 border-t-2 border-black'>
                                <div className='p-1 border-r-2 border-black font-bold'>Total Amount</div>
                                <div className='p-1 text-right font-bold'>{invoice.total.toFixed(2)}</div>
                            </div>
                        </div>
                    </div>
                     <div className='text-sm p-2'>
                        <p className='font-semibold'>Bank Details</p>
                        <div className='grid grid-cols-[150px_1fr]'>
                            <div className='font-bold'>Beneficiary Name:</div>
                            <div>THE GUT GURU</div>
                            <div className='font-bold'>Bank Name:</div>
                            <div>HDFC BANK LTD</div>
                            <div className='font-bold'>Account Number:</div>
                            <div>50200095177481</div>
                            <div className='font-bold'>IFSC Code:</div>
                            <div>HDFC0000045</div>
                            <div className='font-bold'>Branch:</div>
                            <div>HYDERABAD - CHANDA NAGAR</div>
                        </div>
                    </div>
                </CardContent>
                <CardFooter className="p-0 flex-col items-start gap-4 border-t-2 border-black">
                    <div className='w-full'>
                         <div className='grid grid-cols-2'>
                            <div className='p-1 border-r-2 border-black'>For THE GUT GURU</div>
                            <div className='p-1'></div>
                         </div>
                         <div className='flex justify-between items-end p-4 h-24'>
                            <img src='https://placehold.co/150x50.png' alt='Hyderabad logo' className='h-12' data-ai-hint="company logo" />
                            <p className='text-sm'>Authorized Signature</p>
                         </div>
                    </div>
                </CardFooter>
            </Card>
        </div>
    );
});
InvoicePreview.displayName = "InvoicePreview";
