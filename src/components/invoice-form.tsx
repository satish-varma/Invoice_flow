"use client";

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar as CalendarIcon, PlusCircle, Trash2, Download, Eraser } from 'lucide-react';
import { format } from "date-fns"
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

type LineItem = {
  id: number;
  name: string;
  quantity: number;
  price: number;
};

export function InvoiceForm() {
  const [invoiceNumber, setInvoiceNumber] = useState('INV-001');
  const [customerName, setCustomerName] = useState('');
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [lineItems, setLineItems] = useState<LineItem[]>([
    { id: 1, name: '', quantity: 1, price: 0 },
  ]);

  const invoiceRef = useRef<HTMLDivElement>(null);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    // Set initial date on mount to avoid hydration mismatch
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
    const taxRate = 0.10;
    const tax = subtotal * taxRate;
    const total = subtotal + tax;
    return { subtotal, tax, total };
  }, [lineItems]);

  const handleClearForm = () => {
    setInvoiceNumber('INV-001');
    setCustomerName('');
    setDate(new Date());
    setLineItems([{ id: Date.now(), name: '', quantity: 1, price: 0 }]);
  };

  const handleDownloadPdf = () => {
    const input = invoiceRef.current;
    if (input) {
      input.classList.add('pdf-capture');
      html2canvas(input, { scale: 2, useCORS: true }).then((canvas) => {
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

  if (!isMounted) {
      return null;
  }

  return (
    <>
      <Card ref={invoiceRef} className="w-full shadow-lg">
        <CardHeader className="bg-muted/30">
          <div className="flex flex-col md:flex-row justify-between items-start gap-4">
            <div>
              <CardTitle className="mb-4 text-3xl font-headline text-primary">Invoice</CardTitle>
              <div className="grid gap-2">
                <div className="flex items-center gap-2">
                  <label htmlFor="invoiceNumber" className="text-sm font-medium w-24">Invoice #</label>
                  <Input id="invoiceNumber" value={invoiceNumber} onChange={e => setInvoiceNumber(e.target.value)} className="max-w-xs" />
                </div>
              </div>
            </div>
            <div className="grid gap-2 text-sm w-full md:w-auto md:text-right">
                <div className="flex items-center gap-2 md:justify-end">
                  <label htmlFor="customerName" className="font-medium w-24 md:w-auto">Customer</label>
                  <Input id="customerName" placeholder="Customer Name" value={customerName} onChange={e => setCustomerName(e.target.value)} className="max-w-xs"/>
                </div>
                <div className="flex items-center gap-2 md:justify-end">
                   <label htmlFor="date" className="font-medium w-24 md:w-auto">Date</label>
                   <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        id="date"
                        variant={"outline"}
                        className="w-[240px] justify-start text-left font-normal"
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
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-1/2">Item</TableHead>
                  <TableHead className="w-[100px]">Quantity</TableHead>
                  <TableHead className="w-[120px]">Price</TableHead>
                  <TableHead className="w-[120px]">Total</TableHead>
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
                      <Input type="number" value={item.quantity} onChange={e => handleItemChange(item.id, 'quantity', parseFloat(e.target.value) || 0)} min="1" />
                    </TableCell>
                    <TableCell>
                      <Input type="number" value={item.price} onChange={e => handleItemChange(item.id, 'price', parseFloat(e.target.value) || 0)} min="0" step="0.01" placeholder="$0.00" />
                    </TableCell>
                    <TableCell className="font-medium">${(Number(item.quantity) * Number(item.price)).toFixed(2)}</TableCell>
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
          <div className="p-6 no-print">
            <Button onClick={handleAddItem} variant="outline" size="sm" className="bg-transparent hover:bg-accent/10">
              <PlusCircle className="mr-2 h-4 w-4" /> Add Item
            </Button>
          </div>
        </CardContent>
        <CardFooter className="bg-muted/30 p-6">
          <div className="w-full flex justify-end">
            <div className="grid gap-2 w-full max-w-sm text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <span>${subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Tax (10%)</span>
                <span>${tax.toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-bold text-base border-t pt-2 mt-2">
                <span>Total</span>
                <span>${total.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </CardFooter>
      </Card>
      <div className="mt-6 flex justify-end gap-4">
        <Button onClick={handleClearForm} variant="outline" className="text-destructive border-destructive hover:bg-destructive/10 hover:text-destructive">
          <Eraser className="mr-2 h-4 w-4" /> Clear Form
        </Button>
        <Button onClick={handleDownloadPdf} style={{backgroundColor: "hsl(var(--accent))", color: "hsl(var(--accent-foreground))"}}>
          <Download className="mr-2 h-4 w-4" /> Download PDF
        </Button>
      </div>
    </>
  );
}