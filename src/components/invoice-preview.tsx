
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
        return str.trim().split(' ').map(s => s.charAt(0).toUpperCase() + s.substring(1)).join(' ') + ' Rupees';
    };
    
    return (
        <div ref={ref} className="invoice-preview-container bg-white">
            <Card className="w-full shadow-none border-2 border-black" style={{width: '800px', borderRadius: '0'}}>
                <CardHeader className="p-0">
                    <div className='text-center p-2 border-b-2 border-black'>
                        <CardTitle className="text-xl font-bold tracking-tight">BILL TO SUPPLY</CardTitle>
                    </div>
                    <div className='flex justify-between items-center p-2 border-b-2 border-black'>
                        <p className='font-bold text-lg'>THE GUT GURU</p>
                        <p className='text-xs'>Original For recipient</p>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="grid grid-cols-2">
                        <div className="border-r-2 border-black">
                            <div className='grid grid-cols-[80px_1fr]'>
                                <div className='font-bold p-1 border-b-2 border-r-2 border-black'>GSTIN</div>
                                <div className='p-1 border-b-2 border-black'>36DDTPJ6536D1Z8</div>
                                <div className='font-bold p-1 border-b-2 border-r-2 border-black'>Branch</div>
                                <div className='p-1 border-b-2 border-black'>Telangana</div>
                                <div className='font-bold p-1 border-b-2 border-r-2 border-black'>PAN</div>
                                <div className='p-1 border-b-2 border-black'>DDTPJ6536D</div>
                                <div className='font-bold p-1 border-r-2 border-black'>Address</div>
                                <div className='p-1'>H NO.6-46/3/A, Venkateswarao nagar, Chanda Nagar, Hyderabad-500050</div>
                            </div>
                        </div>
                        <div >
                            <div className='grid grid-cols-[100px_1fr] border-b-2 border-black'>
                                <div className='font-bold p-1 border-r-2 border-black'>Invoice Date</div>
                                <div className='p-1'>{invoice.date ? format(new Date(invoice.date), "P") : ''}</div>
                                <div className='font-bold p-1 border-b-2 border-t-2 border-r-2 border-black'>Invoice No.</div>
                                <div className='p-1 border-b-2 border-t-2 border-black'>{invoice.invoiceNumber}</div>
                                <div className='font-bold p-1 border-b-2 border-r-2 border-black'>Period</div>
                                <div className='p-1 border-b-2 border-black'>{invoice.period}</div>
                                <div className='font-bold p-1 border-r-2 border-black'>DELIVERY</div>
                                <div className='p-1'>{invoice.delivery}</div>
                            </div>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 border-t-2 border-black">
                        <div className="border-r-2 border-black">
                             <div className='grid grid-cols-[80px_1fr]'>
                                <div className='font-bold p-1 border-b-2 border-black bg-gray-200 col-span-2'>Circle-10</div>
                                <div className='font-bold p-1 border-b-2 border-r-2 border-black'>Name</div>
                                <div className='p-1 border-b-2 border-black font-bold'>{invoice.billToName}</div>
                                <div className='font-bold p-1 border-b-2 border-r-2 border-black'>Address</div>
                                <div className='p-1 border-b-2 border-black' style={{whiteSpace: 'pre-wrap'}}>{invoice.billToAddress}</div>
                                <div className='font-bold p-1 border-r-2 border-black'>GST NO</div>
                                <div className='p-1'>{invoice.billToGst}</div>
                             </div>
                        </div>
                         <div>
                            <div className='grid grid-cols-[80px_1fr]'>
                                <div className='font-bold p-1 border-b-2 border-black bg-gray-200 col-span-2'>SHIP TO {invoice.shipToName}</div>
                                <div className='font-bold p-1 border-b-2 border-r-2 border-black'>NAME</div>
                                <div className='p-1 border-b-2 border-black font-bold'>{invoice.shipToName}</div>
                                <div className='font-bold p-1 border-b-2 border-r-2 border-black'>ADDRESS</div>
                                <div className='p-1 border-b-2 border-black' style={{whiteSpace: 'pre-wrap'}}>{invoice.shipToAddress}</div>
                                <div className='font-bold p-1 border-r-2 border-black'>GSTIN</div>
                                <div className='p-1'>{invoice.shipToGst}</div>
                             </div>
                        </div>
                    </div>
                    
                    <div className="mt-0 border-t-2 border-black">
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
                            <TableRow key={index} className="border-b-2 border-black">
                                <TableCell className='border-r-2 border-black'>{index + 1}</TableCell>
                                <TableCell className='border-r-2 border-black'>{item.name}</TableCell>
                                <TableCell className="text-right border-r-2 border-black">{item.quantity}</TableCell>
                                <TableCell className="text-right border-r-2 border-black">{item.price.toFixed(2)}</TableCell>
                                <TableCell className="font-medium text-right">{(item.quantity * item.price).toFixed(2)}</TableCell>
                            </TableRow>
                            ))}
                             <TableRow className="border-b-2 border-black">
                                <TableCell className='border-r-2 border-black'></TableCell>
                                <TableCell className='border-r-2 border-black'></TableCell>
                                <TableCell className="text-right border-r-2 border-black"></TableCell>
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
                            <div className='grid grid-cols-2'>
                                <div className='p-1 border-r-2 border-black'>Hunger Box</div>
                                <div className='p-1 text-right'>-</div>
                            </div>
                            <div className='grid grid-cols-2 border-t-2 border-black'>
                                <div className='p-1 border-r-2 border-black font-bold'>Total Amount</div>
                                <div className='p-1 text-right font-bold'>{invoice.total.toFixed(2)}</div>
                            </div>
                        </div>
                    </div>
                     <div className='text-sm'>
                        <div className='grid grid-cols-[150px_1fr]'>
                            <div className='font-bold p-1 border-b border-r-2 border-black'>Beneficiary Name:</div>
                            <div className='p-1 border-b border-black'>THE GUT GURU</div>
                        </div>
                        <div className='grid grid-cols-[150px_1fr]'>
                            <div className='font-bold p-1 border-b border-r-2 border-black'>IFSC Code:</div>
                            <div className='p-1 border-b border-black'>HDFC0000045</div>
                        </div>
                        <div className='grid grid-cols-[150px_1fr]'>
                            <div className='font-bold p-1 border-b border-r-2 border-black'>Account Number:</div>
                            <div className='p-1 border-b border-black'>50200095177481</div>
                        </div>
                         <div className='grid grid-cols-[150px_1fr]'>
                            <div className='font-bold p-1 border-b-2 border-r-2 border-black'>Branch Branch:</div>
                            <div className='p-1 border-b-2 border-black'>HYDERABAD - CHANDA NAGAR</div>
                        </div>
                         <div className='grid grid-cols-[150px_1fr]'>
                            <div className='font-bold p-1 border-b-2 border-r-2 border-black'>Bank Name:</div>
                            <div className='p-1 border-b-2 border-black'>HDFC BANK LTD</div>
                        </div>
                    </div>
                </CardContent>
                <CardFooter className="p-0 flex-col items-start gap-4">
                    <div className='w-full'>
                         <div className='grid grid-cols-[150px_1fr]'>
                            <div className='p-1 border-r-2 border-black'>For THE GUT GURU</div>
                            <div className='p-1'></div>
                         </div>
                         <div className='flex justify-between items-end p-4 h-24'>
                            <img src='/hyderabad-logo.png' alt='Hyderabad logo' className='h-12' />
                            <p className='text-sm'>Authorized Signature</p>
                         </div>
                    </div>
                    <div className='grid grid-cols-5 w-full text-center'>
                        <div className='border-r-2 border-t-2 border-black h-8'></div>
                        <div className='border-r-2 border-t-2 border-black h-8'></div>
                        <div className='border-r-2 border-t-2 border-black h-8'></div>
                        <div className='border-r-2 border-t-2 border-black h-8'></div>
                        <div className='border-t-2 border-black h-8'></div>
                    </div>
                </CardFooter>
            </Card>
        </div>
    );
});
InvoicePreview.displayName = "InvoicePreview";

    