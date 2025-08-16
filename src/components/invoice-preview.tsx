
import React from 'react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format } from "date-fns";
import { Invoice } from '@/services/invoiceService';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';

interface InvoicePreviewProps {
    invoice: Invoice;
}

export const InvoicePreview = React.forwardRef<HTMLDivElement, InvoicePreviewProps>(({ invoice }, ref) => {
    return (
        <Card ref={ref} className="w-full shadow-lg" style={{width: '800px'}}>
             <CardHeader className="bg-muted/20 p-6">
              <div className="flex justify-between items-start">
                  <div className='flex items-center gap-4'>
                      <div className="bg-primary p-3 rounded-lg">
                          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary-foreground"><path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-1V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2Z"/><path d="M9 14h6"/><path d="M12 11v6"/></svg>
                      </div>
                      <div>
                          <p className="font-bold text-lg">The Gut Guru</p>
                          <p className='text-sm text-muted-foreground'>H NO.6-46/3/A, Venkateswarao nagar, Chanda Nagar, Hyderabad-500050</p>
                      </div>
                  </div>
                  <div className="text-right">
                      <CardTitle className="text-4xl font-bold text-primary tracking-tight">INVOICE</CardTitle>
                      <div className="flex items-center justify-end gap-2 mt-2">
                        <label htmlFor="invoiceNumber" className="text-sm font-medium">#</label>
                        <Input id="invoiceNumber" value={invoice.invoiceNumber} className="max-w-[150px] h-8 text-right" readOnly />
                      </div>
                  </div>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              <div className="grid grid-cols-2 gap-8">
                  <div>
                      <h3 className='font-semibold text-muted-foreground mb-2'>BILL TO</h3>
                      <Input id="customerName" value={invoice.customerName} readOnly className="mb-2"/>
                      <Textarea id="customerAddress" value={invoice.customerAddress} readOnly />
                  </div>
                  <div className='grid grid-cols-2 gap-4 text-sm'>
                      <div className="font-semibold text-muted-foreground">Invoice Date</div>
                      <div>{format(new Date(invoice.date), "PPP")}</div>
                      <div className="font-semibold text-muted-foreground">Due Date</div>
                      <div>{format(new Date(new Date(invoice.date).getTime() + 15 * 24 * 60 * 60 * 1000), "PPP")}</div>
                      <div className="font-semibold text-muted-foreground">Period</div>
                      <div>{format(new Date(invoice.date), "MMMM yyyy")}</div>
                  </div>
              </div>
              
              <div className="mt-6">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-1/2">Item</TableHead>
                      <TableHead className="w-[100px] text-right">Quantity</TableHead>
                      <TableHead className="w-[120px] text-right">Price</TableHead>
                      <TableHead className="w-[120px] text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invoice.lineItems.map((item, index) => (
                      <TableRow key={index} className="hover:bg-muted/20">
                        <TableCell>{item.name}</TableCell>
                        <TableCell className="text-right">{item.quantity}</TableCell>
                        <TableCell className="text-right">{item.price.toFixed(2)}</TableCell>
                        <TableCell className="font-medium text-right">{(item.quantity * item.price).toFixed(2)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
            <CardFooter className="bg-muted/20 p-6 flex-col items-end gap-4">
              <div className="w-full max-w-sm text-sm grid gap-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className='font-medium'>{invoice.subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Tax (10%)</span>
                  <span className='font-medium'>{invoice.tax.toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-bold text-lg border-t pt-2 mt-2">
                  <span>Total</span>
                  <span>{invoice.total.toFixed(2)}</span>
                </div>
              </div>
              <div className='text-xs text-muted-foreground text-right w-full pt-4 border-t'>
                  <p className='font-semibold'>Bank Details</p>
                  <p>Beneficiary: THE GUT GURU</p>
                  <p>Bank: HDFC BANK LTD</p>
                  <p>Account Number: 50200095177481</p>
                  <p>IFSC Code: HDFC0000045</p>
              </div>
            </CardFooter>
        </Card>
    );
});
InvoicePreview.displayName = "InvoicePreview";
