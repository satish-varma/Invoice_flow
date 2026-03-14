
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
            str += (n4 != 0) ? (a[n4] || b[n4]) + 'hundred ' : ''; // n4 is a single digit, so b[n4] is correct for tens place if it were two digits, but here it's a single digit. The original `b[match[4][0]] + ' ' + a[match[4][1]]` was incorrect for a single digit. For a single digit, it should just be `a[n4]`.
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

    return (
        <div ref={ref} className="invoice-preview-container bg-white text-black p-8">
            <Card className="w-full shadow-none border-0" style={{ width: '800px', borderRadius: '0' }}>
                <div data-pdf-body>
                    <CardHeader className="p-6">
                        <div className='text-center pb-4'>
                            <CardTitle className="text-2xl font-bold tracking-tight">BILL OF SUPPLY</CardTitle>
                            <p className='text-sm'>(Original For Recipient)</p>
                        </div>
                        {activeProfile ? (
                            <div className='flex justify-between items-start'>
                                <div className="space-y-1">
                                    <p className='font-bold text-xl'>{activeProfile.companyName}</p>
                                    <p className='text-sm w-64' style={{ whiteSpace: 'pre-wrap' }}>{activeProfile.companyAddress}</p>
                                    <div className='text-sm mt-1'>
                                        {activeProfile.companyGstin && <p className='mb-0'><span className='font-bold'>GSTIN:</span> {activeProfile.companyGstin}</p>}
                                        {activeProfile.companyPan && <p><span className='font-bold'>PAN:</span> {activeProfile.companyPan}</p>}
                                    </div>
                                </div>
                                <div className="space-y-2 text-sm pt-12">
                                    <div className='grid grid-cols-[120px_1fr]'>
                                        <div className='font-bold'>Invoice No.:</div>
                                        <div>{invoice.invoiceNumber}</div>
                                        <div className='font-bold'>Invoice Date:</div>
                                        <div>{invoice.date ? format(new Date(invoice.date), "P") : ''}</div>
                                        {invoice.period ? (
                                            <>
                                                <div className='font-bold'>Period:</div>
                                                <div>{invoice.period}</div>
                                            </>
                                        ) : null}
                                        {invoice.delivery ? (
                                            <>
                                                <div className='font-bold'>Delivery:</div>
                                                <div>{invoice.delivery}</div>
                                            </>
                                        ) : null}
                                    </div>
                                </div>
                            </div>
                        ) : (<p>Company profile not found.</p>)}
                    </CardHeader>
                    <CardContent className="px-6 pt-0">
                        <Separator className='bg-gray-200' />
                        <div className="grid grid-cols-[65%_35%] gap-8 items-start py-6">
                            <div className="space-y-1">
                                <p className='font-bold text-gray-500'>Bill To:</p>
                                <p className='font-bold'>{invoice.billToName}</p>
                                <p className='text-sm' style={{ whiteSpace: 'pre-wrap' }}>{invoice.billToAddress}</p>
                                {invoice.billToGst && <p className='text-sm'><span className='font-bold'>GSTIN:</span> {invoice.billToGst}</p>}
                            </div>
                            <div className='space-y-1'>
                                <p className='font-bold text-gray-500'>Ship To:</p>
                                <p className='font-bold'>{invoice.shipToName || invoice.billToName}</p>
                                <p className='text-sm' style={{ whiteSpace: 'pre-wrap' }}>{invoice.shipToAddress || invoice.billToAddress}</p>
                                {invoice.shipToGst && <p className='text-sm'><span className='font-bold'>GSTIN:</span> {invoice.shipToGst}</p>}
                            </div>
                        </div>

                        <div className="mt-2">
                            <Table>
                                <TableHeader>
                                    <TableRow className='border-b border-gray-300 bg-gray-50'>
                                        <TableHead className="w-[50px] font-bold text-black">S.No</TableHead>
                                        <TableHead className="w-1/2 font-bold text-black">Item &amp; Description</TableHead>
                                        <TableHead className="w-[100px] text-right font-bold text-black">Qty</TableHead>
                                        <TableHead className="w-[120px] text-right font-bold text-black">Rate ({currencySymbol})</TableHead>
                                        <TableHead className="w-[120px] text-right font-bold text-black">Amount ({currencySymbol})</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {invoice.lineItems.map((item, index) => (
                                        <TableRow key={index} className="border-b-0">
                                            <TableCell>{index + 1}</TableCell>
                                            <TableCell>{item.name}</TableCell>
                                            <TableCell className="text-right">{item.quantity}</TableCell>
                                            <TableCell className="text-right">{currencySymbol} {item.price.toFixed(2)}</TableCell>
                                            <TableCell className="font-medium text-right">{currencySymbol} {(item.quantity * item.price).toFixed(2)}</TableCell>
                                        </TableRow>
                                    ))}
                                    <TableRow className="border-y border-gray-300 bg-gray-50">
                                        <TableCell colSpan={4} className="text-right font-bold">Total</TableCell>
                                        <TableCell className="font-medium text-right font-bold">{currencySymbol} {invoice.subtotal.toFixed(2)}</TableCell>
                                    </TableRow>
                                </TableBody>
                            </Table>
                        </div>
                        <div className='mt-8 flex justify-between items-start'>
                            <div className="w-3/5">
                                {/* This space is intentionally left blank to push the summary to the right */}
                            </div>
                            <div className="w-2/5 max-w-sm text-sm">
                                <table className="w-full">
                                    <tbody>
                                        <tr>
                                            <td className="py-1">Subtotal</td>
                                            <td className="py-1 text-right">{invoice.subtotal.toFixed(2)}</td>
                                        </tr>
                                        {invoice.taxes?.map((tax, index) => (
                                            <tr key={index}>
                                                <td className="py-1">{tax.name}</td>
                                                <td className="py-1 text-right">{tax.amount.toFixed(2)}</td>
                                            </tr>
                                        ))}
                                        <tr className="font-bold text-lg border-t mt-2">
                                            <td className="py-2">Total Amount</td>
                                            <td className="py-2 text-right">{currencySymbol} {invoice.total.toFixed(2)}</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>
                        <div className='text-sm mt-4'>
                            <span className='font-bold'>In Words:</span> {inWords(invoice.total)}
                        </div>
                    </CardContent>
                </div>
                {activeProfile && (
                    <div data-pdf-footer>
                        <CardFooter className="p-6 flex-col items-start gap-4 border-t border-gray-200 mt-8">
                            <div className='w-full grid grid-cols-[70%_30%] gap-8'>
                                <div className='text-xs'>
                                    <p className='font-semibold mb-2'>Bank Details</p>
                                    <div className='grid grid-cols-[120px_1fr]'>
                                        <div className='font-bold'>Beneficiary Name:</div>
                                        <div>{activeProfile.bankBeneficiary}</div>
                                        <div className='font-bold'>Bank Name:</div>
                                        <div>{activeProfile.bankName}</div>
                                        <div className='font-bold'>Account Number:</div>
                                        <div>{activeProfile.bankAccount}</div>
                                        <div className='font-bold'>IFSC Code:</div>
                                        <div>{activeProfile.bankIfsc}</div>
                                        <div className='font-bold'>Branch:</div>
                                        <div>{activeProfile.bankBranch}</div>
                                    </div>
                                </div>
                                <div className='flex flex-col justify-end items-center h-full text-sm'>
                                    <div className='text-center w-full'>
                                        <p className="mb-2">For {activeProfile.companyName}</p>
                                        {activeProfile.stampLogoUrl && (
                                            <div className='relative w-[80px] h-[80px] mx-auto'>
                                                <Image src={activeProfile.stampLogoUrl} alt="Company Stamp" fill sizes="80px" className="object-contain" priority />
                                            </div>
                                        )}
                                        <p className="-mt-2">Authorized Signature</p>
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
