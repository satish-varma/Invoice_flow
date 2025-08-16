
"use client";

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar as CalendarIcon, PlusCircle, Trash2, Wand2, Loader, Save, FilePlus, ListOrdered, Settings as SettingsIcon } from 'lucide-react';
import { format } from "date-fns"
import { extractInvoiceData, ExtractInvoiceDataOutput } from '@/ai/flows/extract-invoice-flow';
import { useToast } from "@/hooks/use-toast"
import { Textarea } from './ui/textarea';
import { Menubar, MenubarMenu, MenubarTrigger } from './ui/menubar';
import { Invoice, saveInvoice } from '@/services/invoiceService';
import Link from 'next/link';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getSettings, BillToContact, ShipToContact, Settings } from '@/services/settingsService';

type LineItem = {
  id: number;
  name: string;
  quantity: number;
  price: number;
};

interface InvoiceFormProps {
    initialData?: Invoice | null;
    onInvoiceSave: () => void;
    onAddNew: () => void;
}

function fileToDataUri(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

export function InvoiceForm({ initialData, onInvoiceSave, onAddNew }: InvoiceFormProps) {
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [date, setDate] = useState<Date | undefined>(undefined);
  
  const [period, setPeriod] = useState('');
  const [delivery, setDelivery] = useState('');
  
  const [billToName, setBillToName] = useState('');
  const [billToAddress, setBillToAddress] = useState('');
  const [billToGst, setBillToGst] = useState('');
  
  const [shipToName, setShipToName] = useState('');
  const [shipToAddress, setShipToAddress] = useState('');
  const [shipToGst, setShipToGst] = useState('');
  
  const [lineItems, setLineItems] = useState<LineItem[]>([
    { id: 1, name: '', quantity: 1, price: 0 },
  ]);
  const [isExtracting, setIsExtracting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [settings, setSettings] = useState<Settings>({ billToContacts: [], shipToContacts: [] });

  const { toast } = useToast();

  useEffect(() => {
    // Set date on client mount to avoid hydration mismatch
    if(!initialData) {
      setDate(new Date());
    }
    async function loadSettingsAndApplyDefaults() {
        const loadedSettings = await getSettings();
        if (loadedSettings) {
            setSettings(loadedSettings);

            // Apply defaults only for new invoices
            if (!initialData) {
                if (loadedSettings.defaultBillToContact) {
                    const defaultContact = loadedSettings.billToContacts?.find(c => c.displayName === loadedSettings.defaultBillToContact);
                    if (defaultContact) {
                        setBillToName(defaultContact.name);
                        setBillToAddress(defaultContact.address);
                        setBillToGst(defaultContact.gst);
                    }
                }
                 if (loadedSettings.defaultShipToContact) {
                    const defaultContact = loadedSettings.shipToContacts?.find(c => c.displayName === loadedSettings.defaultShipToContact);
                    if (defaultContact) {
                        setShipToName(defaultContact.name);
                        setShipToAddress(defaultContact.address);
                        setShipToGst(defaultContact.gst);
                    }
                }
            }
        }
    }
    loadSettingsAndApplyDefaults();
  }, [initialData]);

  useEffect(() => {
      if (initialData) {
          setInvoiceNumber(initialData.invoiceNumber);
          setDate(new Date(initialData.date));
          setPeriod(initialData.period || '');
          setDelivery(initialData.delivery || '');
          setBillToName(initialData.billToName || '');
          setBillToAddress(initialData.billToAddress || '');
          setBillToGst(initialData.billToGst || '');
          setShipToName(initialData.shipToName || '');
          setShipToAddress(initialData.shipToAddress || '');
          setShipToGst(initialData.shipToGst || '');
          setLineItems(initialData.lineItems.map((item, index) => ({
              id: item.id || Date.now() + index,
              ...item
          })));
      } else {
        handleClearForm(false); // Don't call onAddNew here to prevent loop
      }
  }, [initialData]);

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
  
  const { subtotal, total } = useMemo(() => {
    const subtotal = lineItems.reduce((acc, item) => acc + Number(item.quantity) * Number(item.price), 0);
    return { subtotal, total: subtotal };
  }, [lineItems]);

  const handleClearForm = (shouldCallback = true) => {
    setInvoiceNumber('');
    setDate(new Date());
    setPeriod('');
    setDelivery('');
    setBillToName('');
    setBillToAddress('');
    setBillToGst('');
    setShipToName('');
    setShipToAddress('');
    setShipToGst('');
    setLineItems([{ id: Date.now(), name: '', quantity: 1, price: 0 }]);
    if (shouldCallback) {
        onAddNew();
    }
  };
  
  const handleSaveInvoice = async () => {
    if(!billToName) {
        toast({
            variant: "destructive",
            title: "Bill To Name is required",
        });
        return;
    }

    setIsSaving(true);
    try {
        const invoiceData: Omit<Invoice, 'id' | 'invoiceNumber' | 'createdAt'> & { id?: string } = {
            date: date?.toISOString() || new Date().toISOString(),
            period,
            delivery,
            billToName,
            billToAddress,
            billToGst,
            shipToName,
            shipToAddress,
            shipToGst,
            lineItems: lineItems.map(({ id, ...item }) => item),
            subtotal,
            total,
            // Deprecated fields, kept for compatibility but should be removed later
            customerName: billToName,
            customerAddress: billToAddress,
            tax: 0,
        };

        if(initialData?.id) {
            invoiceData.id = initialData.id;
        }

        await saveInvoice(invoiceData);
        toast({
            title: initialData ? "Invoice Updated" : "Invoice Saved",
            description: `Your invoice has been successfully ${initialData ? 'updated' : 'saved'}.`,
        });
        onInvoiceSave();
    } catch (error) {
        console.error("Failed to save invoice:", error);
        toast({
            variant: "destructive",
            title: "Save Failed",
            description: "Could not save the invoice. Please try again.",
        })
    } finally {
        setIsSaving(false);
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
        if (result.customerName) setBillToName(result.customerName);
        if (result.date) {
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
        if(fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    }
  };

  const handleContactSelect = (type: 'billTo' | 'shipTo', displayName: string) => {
    const contacts = type === 'billTo' ? settings.billToContacts : settings.shipToContacts;
    const contact = contacts?.find(c => c.displayName === displayName);

    if (contact) {
        if (type === 'billTo') {
            setBillToName(contact.name);
            setBillToAddress(contact.address);
            setBillToGst(contact.gst);
        } else {
            setShipToName(contact.name);
            setShipToAddress(contact.address);
            setShipToGst(contact.gst);
        }
    }
  };

  return (
    <>
      <div className="mb-8">
        <div className='flex justify-between items-center mb-4'>
            <div>
              <h1 className="text-4xl font-headline font-bold text-primary">
                InvoiceFlow
              </h1>
              <p className="text-muted-foreground">
                {initialData ? `Editing Invoice #${initialData.invoiceNumber}` : 'Create a new invoice, or upload an image to have AI extract the data for you.'}
              </p>
            </div>
            <Menubar>
                <MenubarMenu>
                    <MenubarTrigger onClick={() => handleClearForm()} className="cursor-pointer">
                        <FilePlus className="mr-2 h-4 w-4" /> New
                    </MenubarTrigger>
                </MenubarMenu>
                <MenubarMenu>
                    <MenubarTrigger className="cursor-pointer">
                      <Link href="/invoices" className='flex items-center'>
                        <ListOrdered className="mr-2 h-4 w-4" /> Saved Invoices
                      </Link>
                    </MenubarTrigger>
                </MenubarMenu>
                 <MenubarMenu>
                    <MenubarTrigger className="cursor-pointer">
                      <Link href="/settings" className='flex items-center'>
                        <SettingsIcon className="mr-2 h-4 w-4" /> Settings
                      </Link>
                    </MenubarTrigger>
                </MenubarMenu>
                <MenubarMenu>
                    <MenubarTrigger onClick={() => fileInputRef.current?.click()} disabled={isExtracting} className="cursor-pointer">
                        {isExtracting ? (
                            <>
                                <Loader className="mr-2 h-4 w-4 animate-spin" />
                                Extracting...
                            </>
                        ) : (
                        <>
                            <Wand2 className="mr-2 h-4 w-4" />
                                Autofill
                        </>
                        )}
                    </MenubarTrigger>
                </MenubarMenu>
                <MenubarMenu>
                    <MenubarTrigger onClick={handleSaveInvoice} disabled={isSaving} className="cursor-pointer bg-accent text-accent-foreground hover:bg-accent/90 focus:bg-accent data-[state=open]:bg-accent">
                         {isSaving ? (
                            <>
                                <Loader className="mr-2 h-4 w-4 animate-spin" />
                                Saving...
                            </>
                        ) : (
                        <>
                            <Save className="mr-2 h-4 w-4" />
                                {initialData ? 'Update' : 'Save'}
                        </>
                        )}
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
          <Card className="w-full shadow-lg">
            <CardHeader className="bg-muted/20 p-6">
              <CardTitle>Invoice Details</CardTitle>
            </CardHeader>
            <CardContent className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Left Column */}
              <div>
                <h3 className="font-bold text-lg mb-4">From</h3>
                <div className="space-y-2">
                    <p className='font-bold'>THE GUT GURU</p>
                    <p className='text-sm text-muted-foreground'>H NO.6-46/3/A, Venkateswarao nagar, Chanda Nagar, Hyderabad-500050</p>
                    <p className='text-sm text-muted-foreground'>GSTIN: 36DDTPJ6536D1Z8</p>
                    <p className='text-sm text-muted-foreground'>PAN: DDTPJ6536D</p>
                </div>
                
                <h3 className="font-bold text-lg mb-4 mt-8">Bill To</h3>
                 <div className="space-y-2">
                    <div>
                        <Label>Select Saved Contact</Label>
                        <Select onValueChange={(value) => handleContactSelect('billTo', value)}>
                            <SelectTrigger>
                                <SelectValue placeholder="Select a billing contact" />
                            </SelectTrigger>
                            <SelectContent>
                                {(settings.billToContacts || []).map(c => <SelectItem key={c.displayName} value={c.displayName}>{c.displayName}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                    <div>
                        <Label htmlFor='billToName'>Name</Label>
                        <Input id="billToName" placeholder="Company Name" value={billToName} onChange={e => setBillToName(e.target.value)} />
                    </div>
                    <div>
                        <Label htmlFor='billToAddress'>Address</Label>
                        <Textarea id="billToAddress" placeholder="Billing Address" value={billToAddress} onChange={e => setBillToAddress(e.target.value)} />
                    </div>
                    <div>
                        <Label htmlFor='billToGst'>GST No.</Label>
                        <Input id="billToGst" placeholder="GST Number" value={billToGst} onChange={e => setBillToGst(e.target.value)} />
                    </div>
                </div>
              </div>

              {/* Right Column */}
              <div>
                <div className="space-y-4">
                    <div className='flex items-center gap-2'>
                        <Label htmlFor="invoiceNumber" className="text-sm font-medium w-24">Invoice #</Label>
                        <Input id="invoiceNumber" value={invoiceNumber} onChange={e => setInvoiceNumber(e.target.value)} className="max-w-[200px]" readOnly={!!initialData || !invoiceNumber} placeholder="INV-..." />
                    </div>
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
                    <div>
                        <Label htmlFor='period'>Period</Label>
                        <Input id="period" placeholder="e.g. June" value={period} onChange={e => setPeriod(e.target.value)} />
                    </div>
                    <div>
                        <Label htmlFor='delivery'>Delivery</Label>
                        <Input id="delivery" placeholder="e.g. June" value={delivery} onChange={e => setDelivery(e.target.value)} />
                    </div>
                </div>

                <h3 className="font-bold text-lg mb-4 mt-8">Ship To</h3>
                <div className="space-y-2">
                    <div>
                         <Label>Select Saved Contact</Label>
                        <Select onValueChange={(value) => handleContactSelect('shipTo', value)}>
                            <SelectTrigger>
                                <SelectValue placeholder="Select a shipping contact" />
                            </SelectTrigger>
                            <SelectContent>
                                {(settings.shipToContacts || []).map(c => <SelectItem key={c.displayName} value={c.displayName}>{c.displayName}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                    <div>
                        <Label htmlFor='shipToName'>Name</Label>
                        <Input id="shipToName" placeholder="Company Name" value={shipToName} onChange={e => setShipToName(e.target.value)} />
                    </div>
                    <div>
                        <Label htmlFor='shipToAddress'>Address</Label>
                        <Textarea id="shipToAddress" placeholder="Shipping Address" value={shipToAddress} onChange={e => setShipToAddress(e.target.value)} />
                    </div>
                    <div>
                        <Label htmlFor='shipToGst'>GSTIN</Label>
                        <Input id="shipToGst" placeholder="Shipping GSTIN" value={shipToGst} onChange={e => setShipToGst(e.target.value)} />
                    </div>
                </div>
              </div>
            </CardContent>

            <CardContent>
              <div className="mt-6">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-1/2">Item & Description</TableHead>
                      <TableHead className="w-[100px] text-right">Quantity</TableHead>
                      <TableHead className="w-[120px] text-right">Rate</TableHead>
                      <TableHead className="w-[120px] text-right">Amount</TableHead>
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
                          <Input className="text-right" type="number" value={item.quantity} onChange={e => handleItemChange(item.id, 'quantity', parseFloat(e.target.value) || 0)} min="0" />
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
                <div className="flex justify-between font-bold text-lg border-t pt-2 mt-2">
                  <span>Total Amount</span>
                  <span>{total.toFixed(2)}</span>
                </div>
              </div>
              <div className='text-xs text-muted-foreground text-right w-full pt-4 border-t'>
                  <p className='font-semibold'>Bank Details</p>
                  <p>Beneficiary: THE GUT GURU</p>
                  <p>Bank: HDFC BANK LTD</p>
                  <p>Account Number: 50200095177481</p>
                  <p>IFSC Code: HDFC0000045</p>
                  <p>Branch: HYDERABAD - CHANDA NAGAR</p>
              </div>
            </CardFooter>
          </Card>
    </>
  );
}

    