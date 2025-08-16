
"use client";

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar as CalendarIcon, PlusCircle, Trash2, Download, Eraser, Wand2, Loader } from 'lucide-react';
import { format } from "date-fns"
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { extractInvoiceData, ExtractInvoiceDataOutput } from '@/ai/flows/extract-invoice-flow';
import { useToast } from "@/hooks/use-toast"
import { Textarea } from './ui/textarea';
import { Menubar, MenubarMenu, MenubarTrigger } from './ui/menubar';

type LineItem = {
  id: number;
  name: string;
  quantity: number;
  price: number;
};

function fileToDataUri(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

export function InvoiceForm() {
  const [invoiceNumber, setInvoiceNumber] = useState('INV-001');
  const [customerName, setCustomerName] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [lineItems, setLineItems] = useState<LineItem[]>([
    { id: 1, name: '', quantity: 1, price: 0 },
  ]);
  const [isExtracting, setIsExtracting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const invoiceRef = useRef<HTMLDivElement>(null);
  const [isMounted, setIsMounted] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    setIsMounted(true);
    // Setting date in useEffect to avoid hydration mismatch
    setDate(new Date()); 
  }, []);

  const handleAddItem = () => {
    setLineItems([...lineItems, { id: Date.now(), name: '', quantity: 1, price: 0 }]);
  };

  const handleRemoveItem = (id: number) => {
    setLineItems(lineItems.filter(item => item.id !== id));
  };

  const handleItemChange = (id: number, field: keyof Omit<LineItem, 'id'>, value: string | number) => {
    setLineItems(lineItems.map(item =>
      item.id === id ? { ...item, [field]: value } : item
    ));
  };
  
  const { subtotal, tax, total } = useMemo(() => {
    const subtotal = lineItems.reduce((acc, item) => acc + Number(item.quantity) * Number(item.price), 0);
    const taxRate = 0.10; // 10% tax
    const tax = subtotal * taxRate;
    const total = subtotal + tax;
    return { subtotal, tax, total };
  }, [lineItems]);

  const handleClearForm = () => {
    setInvoiceNumber('INV-001');
    setCustomerName('');
    setCustomerAddress('');
    setDate(new Date());
    setLineItems([{ id: Date.now(), name: '', quantity: 1, price: 0 }]);
  };

  const handleDownloadPdf = () => {
    const input = invoiceRef.current;
    if (input) {
      // Add a class to hide elements during PDF capture
      input.classList.add('pdf-capture');
      html2canvas(input, { scale: 2, useCORS: true }).then((canvas) => {
        // Remove the class after capture
        input.classList.remove('pdf-capture');
        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF('p', 'mm', 'a4');
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
        
        let heightLeft = pdfHeight;
        let position = 0;
        const pageHeight = pdf.internal.pageSize.getHeight();

        pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, pdfHeight);
        heightLeft -= pageHeight;

        while (heightLeft > 0) {
          position = heightLeft - pdfHeight;
          pdf.addPage();
          pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, pdfHeight);
          heightLeft -= pageHeight;
        }
        
        pdf.save(`invoice-${invoiceNumber || 'untitled'}.pdf`);
      });
    }
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsExtracting(true);
    try {
        const dataUri = await fileToDataUri(file);
        const result: ExtractInvoiceDataOutput = await extractInvoiceData({ photoDataUri: dataUri });

        if (result.invoiceNumber) setInvoiceNumber(result.invoiceNumber);
        if (result.customerName) setCustomerName(result.customerName);
        if (result.date) {
            // Add time to the date to avoid timezone issues
            const parsedDate = new Date(result.date + 'T00:00:00');
            if (!isNaN(parsedDate.getTime())) {
              setDate(parsedDate);
            }
        }
        if (result.lineItems && result.lineItems.length > 0) {
            setLineItems(result.lineItems.map((item, index) => ({
                id: Date.now() + index,
                ...item,
            })));
        } else {
             setLineItems([{ id: Date.now(), name: '', quantity: 1, price: 0 }]);
        }
        toast({
            title: "Extraction Complete",
            description: "Invoice data has been filled in.",
        })
    } catch (error) {
        console.error("Failed to extract invoice data:", error);
        toast({
            variant: "destructive",
            title: "Extraction Failed",
            description: "Could not extract data from the image. Please try another image.",
        })
    } finally {
        setIsExtracting(false);
        // Reset file input to allow re-uploading the same file
        if(fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    }
  };

  if (!isMounted) {
      return (
        <div className="flex items-center justify-center min-h-screen">
          <Loader className="h-8 w-8 animate-spin" />
        </div>
      );
  }

  return (
    <>
      <div className="mb-8">
        <div className='flex justify-between items-center mb-4'>
            <div>
              <h1 className="text-4xl font-headline font-bold text-primary">
                InvoiceFlow
              </h1>
              <p className="text-muted-foreground">
                Create professional invoices, or upload an image to have AI extract the data for you.
              </p>
            </div>
            <Menubar>
                <MenubarMenu>
                    <MenubarTrigger>
                        <Button onClick={() => fileInputRef.current?.click()} disabled={isExtracting} className='bg-transparent text-foreground hover:bg-transparent p-0 h-auto'>
                            {isExtracting ? (
                                <>
                                    <Loader className="mr-2 h-4 w-4 animate-spin" />
                                    Extracting...
                                </>
                            ) : (
                            <>
                                <Wand2 className="mr-2 h-4 w-4" />
                                    Autofill from Image
                            </>
                            )}
                        </Button>
                    </MenubarTrigger>
                </MenubarMenu>
                <MenubarMenu>
                    <MenubarTrigger>
                        <Button onClick={handleDownloadPdf} style={{backgroundColor: "hsl(var(--accent))", color: "hsl(var(--accent-foreground))"}} className='p-0 h-auto bg-transparent hover:bg-transparent text-accent-foreground'>
                            <Download className="mr-2 h-4 w-4" /> Download PDF
                        </Button>
                    </MenubarTrigger>
                </MenubarMenu>
                <MenubarMenu>
                     <MenubarTrigger>
                        <Button onClick={handleClearForm} variant="outline" className="text-destructive border-destructive hover:bg-destructive/10 hover:text-destructive p-0 h-auto bg-transparent">
                            <Eraser className="mr-2 h-4 w-4" /> Clear Form
                        </Button>
                    </MenubarTrigger>
                </MenubarMenu>
            </Menubar>
            <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                className="hidden"
                accept="image/*"
                disabled={isExtracting}
            />
        </div>
      </div>
          <Card ref={invoiceRef} className="w-full shadow-lg">
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
                        <Input id="invoiceNumber" value={invoiceNumber} onChange={e => setInvoiceNumber(e.target.value)} className="max-w-[150px] h-8 text-right" />
                      </div>
                  </div>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              <div className="grid grid-cols-2 gap-8">
                  <div>
                      <h3 className='font-semibold text-muted-foreground mb-2'>BILL TO</h3>
                      <Input id="customerName" placeholder="Customer Name" value={customerName} onChange={e => setCustomerName(e.target.value)} className="mb-2"/>
                      <Textarea id="customerAddress" placeholder="Customer Address" value={customerAddress} onChange={e => setCustomerAddress(e.target.value)} />
                  </div>
                  <div className='grid grid-cols-2 gap-4 text-sm'>
                      <div className="font-semibold text-muted-foreground">Invoice Date</div>
                      <div>
                          <Popover>
                              <PopoverTrigger asChild>
                                <Button
                                  id="date"
                                  variant={"outline"}
                                  className="w-full justify-start text-left font-normal"
                                >
                                  <CalendarIcon className="mr-2 h-4 w-4" />
                                  {date ? format(date, "PPP") : <span>Pick a date</span>}
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-auto p-0" align="end">
                                <Calendar
                                  mode="single"
                                  selected={date}
                                  onSelect={setDate}
                                  initialFocus
                                />
                              </PopoverContent>
                            </Popover>
                      </div>

                      <div className="font-semibold text-muted-foreground">Due Date</div>
                      <div>{date ? format(new Date(date.getTime() + 15 * 24 * 60 * 60 * 1000), "PPP") : '-'}</div>

                      <div className="font-semibold text-muted-foreground">Period</div>
                      <div>{date ? format(date, "MMMM yyyy") : '-'}</div>
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
                      <TableHead className="text-right no-print w-[80px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lineItems.map((item) => (
                      <TableRow key={item.id} className="hover:bg-muted/20">
                        <TableCell>
                          <Input placeholder="Item description" value={item.name} onChange={e => handleItemChange(item.id, 'name', e.target.value)} />
                        </TableCell>
                        <TableCell>
                          <Input className="text-right" type="number" value={item.quantity} onChange={e => handleItemChange(item.id, 'quantity', parseFloat(e.target.value) || 0)} min="1" />
                        </TableCell>
                        <TableCell>
                          <Input className="text-right" type="number" value={item.price} onChange={e => handleItemChange(item.id, 'price', parseFloat(e.target.value) || 0)} min="0" step="0.01" placeholder="0.00" />
                        </TableCell>
                        <TableCell className="font-medium text-right">{!isNaN(item.quantity) && !isNaN(item.price) ? (Number(item.quantity) * Number(item.price)).toFixed(2) : '0.00'}</TableCell>
                        <TableCell className="text-right no-print">
                          <Button variant="ghost" size="icon" onClick={() => handleRemoveItem(item.id)} aria-label="Remove item">
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="mt-4 no-print">
                <Button onClick={handleAddItem} variant="outline" size="sm" className="bg-transparent hover:bg-accent/10">
                  <PlusCircle className="mr-2 h-4 w-4" /> Add Item
                </Button>
              </div>
            </CardContent>
            <CardFooter className="bg-muted/20 p-6 flex-col items-end gap-4">
              <div className="w-full max-w-sm text-sm grid gap-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className='font-medium'>{subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Tax (10%)</span>
                  <span className='font-medium'>{tax.toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-bold text-lg border-t pt-2 mt-2">
                  <span>Total</span>
                  <span>{total.toFixed(2)}</span>
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
    </>
  );
}
