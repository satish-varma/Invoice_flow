
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
            <Card className="w-full shadow-none border-0" style={{width: '800px', borderRadius: '0'}}>
                 <div data-pdf-body>
                    <CardHeader className="p-6">
                        <div className='text-center pb-4'>
                            <CardTitle className="text-2xl font-bold tracking-tight">DELIVERY CHALLAN</CardTitle>
                            <p className='text-sm'>(Original For Recipient)</p>
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
                                <div className='grid grid-cols-[80px_1fr]'>
                                    <div className='font-bold'>DC NO:</div>
                                    <div>{challan.dcNumber}</div>
                                    <div className='font-bold'>DC DATE:</div>
                                    <div>{challan.dcDate ? format(new Date(challan.dcDate), "P") : ''}</div>
                                </div>
                            </div>
                        </div>
                        ) : ( <p>Company profile not found.</p> )}
                    </CardHeader>
                    <CardContent className="px-6 pt-0">
                        <Separator className='bg-gray-200'/>
                        <div className="grid grid-cols-2 gap-8 items-start py-6">
                            <div className="space-y-1">
                                <p className='font-bold text-gray-500'>BILL TO</p>
                                <p className='font-bold'>{challan.billToName}</p>
                                <p className='text-sm' style={{whiteSpace: 'pre-wrap'}}>{challan.billToAddress}</p>
                            </div>
                            <div className='space-y-1'>
                                <p className='font-bold text-gray-500'>SHIP TO</p>
                                 <p className='font-bold'>{challan.shipToName || challan.billToName}</p>
                                <p className='text-sm' style={{whiteSpace: 'pre-wrap'}}>{challan.shipToAddress || challan.billToAddress}</p>
                            </div>
                        </div>
                        
                        <div className="mt-2">
                            <Table>
                            <TableHeader>
                                <TableRow className='border-b border-gray-300 bg-gray-50'>
                                    <TableHead className="w-[50px] font-bold text-black">S.NO.</TableHead>
                                    <TableHead className="w-2/5 font-bold text-black">ITEM NAME</TableHead>
                                    <TableHead className="font-bold text-black">HSN CODE</TableHead>
                                    <TableHead className="text-right font-bold text-black">QTY</TableHead>
                                    <TableHead className="text-right font-bold text-black">UNIT PRICE</TableHead>
                                    <TableHead className="text-right font-bold text-black">TOTAL</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {challan.lineItems.map((item, index) => (
                                <TableRow key={index} className="border-b-0">
                                    <TableCell>{index + 1}</TableCell>
                                    <TableCell>{item.name}</TableCell>
                                    <TableCell>{item.hsnCode}</TableCell>
                                    <TableCell className="text-right">{item.quantity}</TableCell>
                                    <TableCell className="text-right">{item.unitPrice.toFixed(2)}</TableCell>
                                    <TableCell className="font-medium text-right">{item.total.toFixed(2)}</TableCell>
                                </TableRow>
                                ))}
                            </TableBody>
                            </Table>
                        </div>
                         <div className='mt-8 flex justify-between items-start'>
                             <div className="w-3/5">
                                {activeProfile && activeProfile.bankBeneficiary && (
                                        <div className='text-xs'>
                                        <p className='font-semibold mb-2'>BANK DETAILS</p>
                                        <div className='grid grid-cols-[100px_1fr]'>
                                            <div className='font-bold'>Name:</div>
                                            <div>{activeProfile.bankBeneficiary}</div>
                                            <div className='font-bold'>Account No:</div>
                                            <div>{activeProfile.bankAccount}</div>
                                            <div className='font-bold'>IFSC:</div>
                                            <div>{activeProfile.bankIfsc}</div>
                                            <div className='font-bold'>Bank:</div>
                                            <div>{activeProfile.bankName}</div>
                                        </div>
                                    </div>
                                )}
                                <div className='text-xs mt-8'>
                                    <p><span className='font-bold'>Note:</span> {challan.note}</p>
                                </div>
                             </div>
                             <div className="w-2/5 max-w-sm text-sm">
                                <table className="w-full">
                                    <tbody>
                                        <tr>
                                            <td className="py-1 text-right font-bold">SUBTOTAL</td>
                                            <td className="py-1 text-right w-[100px]">{challan.subtotal.toFixed(2)}</td>
                                        </tr>
                                        <tr>
                                            <td className="py-1 text-right font-bold">GST @{gstRate.toFixed(2)}%</td>
                                            <td className="py-1 text-right">{challan.gstAmount.toFixed(2)}</td>
                                        </tr>
                                        <tr>
                                            <td className="py-1 text-right font-bold">SHIPPING/HANDLING</td>
                                            <td className="py-1 text-right">{challan.shipping.toFixed(2)}</td>
                                        </tr>
                                            <tr>
                                            <td className="py-1 text-right font-bold">OTHER</td>
                                            <td className="py-1 text-right">{challan.other.toFixed(2)}</td>
                                        </tr>
                                        <tr className="font-bold text-lg">
                                            <td className="py-2 text-right border-t border-black">TOTAL</td>
                                            <td className="py-2 text-right border-t border-black">{challan.total.toFixed(2)}</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </CardContent>
                </div>
                
                 <div data-pdf-signature>
                    {activeProfile && (
                        <div className='flex flex-col justify-end items-end h-full text-sm mt-8 pr-6'>
                            <div className='text-center w-full max-w-sm ml-auto'>
                                <p className="mb-2">For {activeProfile.companyName}</p>
                                
                                <div style={{ position: 'relative', width: '110px', height: '80px', margin: '0 auto' }}>
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img src="/sigwithsign.png" alt="Company Stamp" style={{ objectFit: 'contain', width: '100%', height: '100%' }} />
                                </div>
                                <p className="pt-2">Authorized Signature</p>
                            </div>
                        </div>
                    )}
                </div>

                <div data-pdf-footer>
                     <CardFooter className="p-4 text-center text-xs text-gray-500 border-t border-gray-200 mt-4">
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
DeliveryChallanPreview.displayName = "DeliveryChallanPreview";
