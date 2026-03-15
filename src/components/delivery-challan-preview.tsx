
import React from 'react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format } from "date-fns";
import { Separator } from './ui/separator';
import type { Settings } from '@/services/settingsService';
import { Challan } from '@/services/challanService';

interface DeliveryChallanPreviewProps {
    challan: Challan;
    settings: Settings;
}

export const DeliveryChallanPreview = React.forwardRef<HTMLDivElement, DeliveryChallanPreviewProps>(({ challan, settings }, ref) => {

    const activeProfile = settings.companyProfiles?.find(p => p.id === challan.companyProfileId);
    const gstRate = challan.subtotal > 0 ? (challan.gstAmount / challan.subtotal) * 100 : 0;

    return (
        <div ref={ref} className="invoice-preview-container bg-white text-black p-8">
            <Card className="w-full shadow-none border-0" style={{ width: '800px', borderRadius: '0' }}>
                <div data-pdf-body>
                    <CardHeader className="p-6">
                        <div className='text-center pb-4'>
                            <CardTitle className="text-2xl font-bold tracking-tight">DELIVERY CHALLAN</CardTitle>
                            <p className='text-sm'>(Original For Recipient)</p>
                        </div>
                        {activeProfile ? (
                            <div className='flex justify-between items-start'>
                                <div className="space-y-1">
                                    {activeProfile.logoUrl && (
                                        <div className='relative w-32 h-16 mb-4'>
                                            {/* eslint-disable-next-line @next/next/no-img-element */}
                                            <img src={activeProfile.logoUrl} alt="Company Logo" style={{ objectFit: 'contain', width: '100%', height: '100%', objectPosition: 'left' }} />
                                        </div>
                                    )}
                                    <p className='font-bold text-xl'>{activeProfile.companyName}</p>
                                    <p className='text-sm w-64' style={{ whiteSpace: 'pre-wrap' }}>{activeProfile.companyAddress}</p>
                                    <div className='text-sm mt-1'>
                                        {activeProfile.companyGstin && <p className='mb-0'><span className='font-bold'>GSTIN:</span> {activeProfile.companyGstin}</p>}
                                        {activeProfile.companyPhone && <p><span className='font-bold'>Mobile:</span> {activeProfile.companyPhone}</p>}
                                        {activeProfile.companyEmail && <p><span className='font-bold'>Email:</span> {activeProfile.companyEmail}</p>}
                                    </div>
                                </div>
                                <div className="space-y-2 text-sm pt-4">
                                    <div className='grid grid-cols-[80px_1fr]'>
                                        <div className='font-bold uppercase'>DC No:</div>
                                        <div>{challan.dcNumber}</div>
                                        <div className='font-bold uppercase'>DC Date:</div>
                                        <div>{challan.dcDate ? format(new Date(challan.dcDate), "P") : ''}</div>
                                    </div>
                                </div>
                            </div>
                        ) : (<p>Company profile not found.</p>)}
                    </CardHeader>
                    <CardContent className="px-6 pt-0">
                        <Separator className='bg-gray-200' />
                        <div className="grid grid-cols-2 gap-8 items-start py-6">
                            <div className="space-y-1">
                                <p className='font-bold text-gray-500 uppercase'>Bill To</p>
                                <p className='font-bold'>{challan.billToName}</p>
                                <p className='text-sm' style={{ whiteSpace: 'pre-wrap' }}>{challan.billToAddress}</p>
                            </div>
                            <div className='space-y-1'>
                                <p className='font-bold text-gray-500 uppercase'>Ship To</p>
                                <p className='font-bold'>{challan.shipToName || challan.billToName}</p>
                                <p className='text-sm' style={{ whiteSpace: 'pre-wrap' }}>{challan.shipToAddress || challan.billToAddress}</p>
                            </div>
                        </div>

                        <div className="mt-2">
                            <Table>
                                <TableHeader>
                                    <TableRow className='border-b border-gray-300 bg-gray-50'>
                                        <TableHead className="w-[50px] font-bold text-black uppercase">S.No.</TableHead>
                                        <TableHead className="w-2/5 font-bold text-black uppercase">Item Name</TableHead>
                                        {challan.lineItems.some(i => i.hsnCode) && (
                                            <TableHead className="font-bold text-black uppercase">HSN Code</TableHead>
                                        )}
                                        <TableHead className="font-bold text-black uppercase">Unit</TableHead>
                                        <TableHead className="text-right font-bold text-black uppercase">Qty</TableHead>
                                        <TableHead className="text-right font-bold text-black uppercase">Unit Price</TableHead>
                                        <TableHead className="text-right font-bold text-black uppercase">Total</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {challan.lineItems.map((item, index) => (
                                        <TableRow key={index} className="border-b-0">
                                            <TableCell>{index + 1}</TableCell>
                                            <TableCell>{item.name}</TableCell>
                                            {challan.lineItems.some(i => i.hsnCode) && (
                                                <TableCell>{item.hsnCode || '-'}</TableCell>
                                            )}
                                            <TableCell>{item.unit || '-'}</TableCell>
                                            <TableCell className="text-right">{item.quantity}</TableCell>
                                            <TableCell className="text-right">{(Number(item.unitPrice) || 0).toFixed(2)}</TableCell>
                                            <TableCell className="font-medium text-right">{(Number(item.total) || 0).toFixed(2)}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                        <div className='mt-8 flex justify-between items-start'>
                            <div className="w-3/5">
                                {activeProfile && activeProfile.bankBeneficiary && (
                                    <div className='text-[10px] text-gray-500'>
                                        <p className='font-bold mb-2 uppercase tracking-widest'>Bank Details</p>
                                        <div className='grid grid-cols-[100px_1fr]'>
                                            <div className='font-bold uppercase'>Beneficiary:</div>
                                            <div>{activeProfile.bankBeneficiary}</div>
                                            <div className='font-bold uppercase'>Account:</div>
                                            <div>{activeProfile.bankAccount}</div>
                                            <div className='font-bold uppercase'>IFSC:</div>
                                            <div>{activeProfile.bankIfsc}</div>
                                            <div className='font-bold uppercase'>Bank:</div>
                                            <div>{activeProfile.bankName}</div>
                                        </div>
                                    </div>
                                )}
                                <div className='text-xs mt-8'>
                                    <p><span className='font-bold uppercase text-[10px] text-gray-400 tracking-wider'>Note:</span> {challan.note}</p>
                                </div>
                            </div>
                            <div className="w-2/5 max-w-sm text-sm">
                                <table className="w-full">
                                    <tbody>
                                        <tr>
                                            <td className="py-1 text-right font-bold uppercase text-xs text-gray-500">Subtotal</td>
                                            <td className="py-1 text-right w-[100px]">{(Number(challan.subtotal) || 0).toFixed(2)}</td>
                                        </tr>
                                        {gstRate > 0 ? (
                                            <tr>
                                                <td className="py-1 text-right font-bold uppercase text-xs text-gray-500">GST @{(Number(gstRate) || 0).toFixed(2)}%</td>
                                                <td className="py-1 text-right">{(Number(challan.gstAmount) || 0).toFixed(2)}</td>
                                            </tr>
                                        ) : null}
                                        {challan.shipping > 0 ? (
                                            <tr>
                                                <td className="py-1 text-right font-bold uppercase text-xs text-gray-500">Shipping</td>
                                                <td className="py-1 text-right">{(Number(challan.shipping) || 0).toFixed(2)}</td>
                                            </tr>
                                        ) : null}
                                        {challan.other > 0 ? (
                                            <tr>
                                                <td className="py-1 text-right font-bold uppercase text-xs text-gray-500">Other</td>
                                                <td className="py-1 text-right">{(Number(challan.other) || 0).toFixed(2)}</td>
                                            </tr>
                                        ) : null}
                                        <tr className="font-bold text-lg">
                                            <td className="py-2 text-right border-t border-black uppercase">Total</td>
                                            <td className="py-2 text-right border-t border-black">{(Number(challan.total) || 0).toFixed(2)}</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </CardContent>
                </div>

                <div data-pdf-signature className='mt-12'>
                    {activeProfile && (
                        <div className='flex justify-end items-end h-full text-sm px-6'>
                            <div className='text-center w-full max-w-sm'>
                                <p className="mb-2 uppercase text-[10px] font-bold text-gray-400 tracking-widest leading-none">Authorized Signatory</p>
                                <p className="mb-2 italic text-xs">For {activeProfile.companyName}</p>

                                <div style={{ position: 'relative', width: '110px', height: '80px', margin: '0 auto' }}>
                                    {activeProfile.stampLogoUrl && (
                                        /* eslint-disable-next-line @next/next/no-img-element */
                                        <img src={activeProfile.stampLogoUrl} alt="Company Stamp" style={{ objectFit: 'contain', width: '100%', height: '100%' }} />
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                <div data-pdf-footer>
                    <CardFooter className="p-4 text-center text-[10px] text-gray-500 border-t border-gray-200 mt-8">
                        <div className='w-full'>
                            <p>For questions concerning this document, please contact: </p>
                            <p>
                                {activeProfile?.companyName}
                                {activeProfile?.companyPhone && ` | ${activeProfile.companyPhone}`}
                                {activeProfile?.companyEmail && ` | ${activeProfile.companyEmail}`}
                            </p>
                        </div>
                    </CardFooter>
                </div>
            </Card>
        </div>
    );
});
DeliveryChallanPreview.displayName = "DeliveryChallanPreview";
