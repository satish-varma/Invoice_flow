
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
import { Invoice, saveInvoice, TaxItem } from '@/services/invoiceService';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getSettings, Settings, CompanyProfile } from '@/services/settingsService';

type LineItem = {
  id: number;
  name: string;
  quantity: number;
  price: number;
};

interface InvoiceFormProps {
    initialData?: Invoice | null;
    onInvoiceSave: (savedInvoice?: Invoice) => void;
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

const months = [
    "January", "February", "March", "April", "May", "June", 
    "July", "August", "September", "October", "November", "December"
];

const availableTaxes = [
    { id: 'SGST2.5', name: 'SGST @ 2.5%', rate: 2.5 },
    { id: 'CGST2.5', name: 'CGST @ 2.5%', rate: 2.5 },
    { id: 'SGST6', name: 'SGST @ 6%', rate: 6 },
    { id: 'CGST6', name: 'CGST @ 6%', rate: 6 },
    { id: 'SGST9', name: 'SGST @ 9%', rate: 9 },
    { id: 'CGST9', name: 'CGST @ 9%', rate: 9 },
    { id: 'SGST14', name: 'SGST @ 14%', rate: 14 },
    { id: 'CGST14', name: 'CGST @ 14%', rate: 14 },
    { id: 'Cess12', name: 'Cess @ 12%', rate: 12 },
];

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

  const [appliedTaxes, setAppliedTaxes] = useState<TaxItem[]>([]);
  
  const [lineItems, setLineItems] = useState<LineItem[]>([
    { id: 1, name: '', quantity: 1, price: 0 },
  ]);
  const [isExtracting, setIsExtracting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pathname = usePathname();
  const router = useRouter();
  
  const [settings, setSettings] = useState<Settings>({ companyProfiles: [], billToContacts: [], shipToContacts: [] });
  const [activeCompanyProfile, setActiveCompanyProfile] = useState<CompanyProfile | null>(null);

  const { toast } = useToast();

  useEffect(() => {
    // Set date on client mount to avoid hydration mismatch
    if(!initialData) {
      setDate(new Date());
      const now = new Date();
      const prevMonthIndex = now.getMonth() === 0 ? 11 : now.getMonth() - 1;
      const prevMonthName = months[prevMonthIndex];
      setPeriod(prevMonthName);
      setDelivery(prevMonthName);
    }
    
    async function loadSettingsAndApplyDefaults() {
        const loadedSettings = await getSettings();
        setSettings(loadedSettings);

        // Determine which profile to use
        let profileToApply: CompanyProfile | undefined;
        if (initialData?.companyProfileId) {
            profileToApply = loadedSettings.companyProfiles?.find(p => p.id === initialData.companyProfileId);
        } else if (loadedSettings.defaultCompanyProfile) {
            profileToApply = loadedSettings.companyProfiles?.find(p => p.id === loadedSettings.defaultCompanyProfile);
        } else if (loadedSettings.companyProfiles && loadedSettings.companyProfiles.length > 0) {
            profileToApply = loadedSettings.companyProfiles[0];
        }

        if (profileToApply) {
            setActiveCompanyProfile(profileToApply);
        }

        // Apply contact defaults only for new invoices
        if (!initialData) {
            if (loadedSettings.defaultBillToContact && loadedSettings.billToContacts) {
                const defaultContact = loadedSettings.billToContacts.find(c => c.id === loadedSettings.defaultBillToContact);
                if (defaultContact) {
                    setBillToName(defaultContact.name);
                    setBillToAddress(defaultContact.address);
                    setBillToGst(defaultContact.gst);
                    // Apply taxes from default contact
                     const taxesToApply = availableTaxes.filter(t => defaultContact.taxes?.includes(t.id));
                    setAppliedTaxes(taxesToApply.map(t => ({ name: t.name, rate: t.rate, amount: 0 })));
                }
            }
             if (loadedSettings.defaultShipToContact && loadedSettings.shipToContacts) {
                const defaultContact = loadedSettings.shipToContacts.find(c => c.id === loadedSettings.defaultShipToContact);
                if (defaultContact) {
                    setShipToName(defaultContact.name);
                    setShipToAddress(defaultContact.address);
                    setShipToGst(defaultContact.gst);
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
          setAppliedTaxes(initialData.taxes || []);
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
  
  const { subtotal, taxTotal, total } = useMemo(() => {
    const subtotal = lineItems.reduce((acc, item) => acc + Number(item.quantity) * Number(item.price), 0);
    
    const calculatedTaxes = appliedTaxes.map(tax => ({
      ...tax,
      amount: (subtotal * tax.rate) / 100,
    }));

    const taxTotal = calculatedTaxes.reduce((acc, tax) => acc + tax.amount, 0);

    // Update state with calculated amounts for saving
    if (JSON.stringify(calculatedTaxes) !== JSON.stringify(appliedTaxes)) {
        setAppliedTaxes(calculatedTaxes);
    }
    
    const total = subtotal + taxTotal;
    
    return { subtotal, taxTotal, total };
  }, [lineItems, appliedTaxes]);

  const handleClearForm = (shouldCallback = true) => {
    setInvoiceNumber('');
    setDate(new Date());
    const now = new Date();
    const prevMonthIndex = now.getMonth() === 0 ? 11 : now.getMonth() - 1;
    const prevMonthName = months[prevMonthIndex];
    setPeriod(prevMonthName);
    setDelivery(prevMonthName);
    setBillToName('');
    setBillToAddress('');
    setBillToGst('');
    setShipToName('');
    setShipToAddress('');
    setShipToGst('');
    setAppliedTaxes([]);
    setLineItems([{ id: Date.now(), name: '', quantity: 1, price: 0 }]);
    if (shouldCallback) {
        onAddNew();
    }
  };
  
  const handleSaveInvoice = async (andDownload = false) => {
    if(!billToName) {
        toast({
            variant: "destructive",
            title: "Bill To Name is required",
        });
        return;
    }
    if (!activeCompanyProfile) {
        toast({
            variant: "destructive",
            title: "Company Profile is required",
            description: "Please select a company profile or add one in settings."
        });
        return;
    }

    setIsSaving(true);
    try {
        const invoiceData: Omit<Invoice, 'invoiceNumber' | 'createdAt'> & { id?: string } = {
            date: date?.toISOString() || new Date().toISOString(),
            companyProfileId: activeCompanyProfile.id,
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
            taxes: appliedTaxes,
            taxTotal,
            total,
            // Deprecated fields, kept for compatibility but should be removed later
            customerName: billToName,
            customerAddress: billToAddress,
            tax: taxTotal, // Use new taxTotal for old field
        };

        if(initialData?.id) {
            invoiceData.id = initialData.id;
        }

        const savedInvoice = await saveInvoice(invoiceData);
        toast({
            title: initialData ? "Invoice Updated" : "Invoice Saved",
            description: `Your invoice has been successfully ${initialData ? 'updated' : 'saved'}.`,
        });
        
        if (andDownload) {
            onInvoiceSave(savedInvoice);
        } else {
            onInvoiceSave();
        }

    } catch (error) {
        console.error("Failed to save invoice:", error);
        const errorMessage = error instanceof Error ? error.message : "Could not save the invoice. Please try again.";
        toast({
            variant: "destructive",
            title: "Save Failed",
            description: errorMessage,
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

        if (result.customerName) setBillToName(result.customerName);

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
            description: "Could not extract data from the file. Please try another file.",
        })
    } finally {
        setIsExtracting(false);
        if(fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    }
  };

  const handleContactSelect = (type: 'billTo' | 'shipTo', id: string) => {
    if (type === 'billTo') {
        const contact = settings.billToContacts?.find(c => c.id === id);
        if (contact) {
            setBillToName(contact.name);
            setBillToAddress(contact.address);
            setBillToGst(contact.gst);

            // Apply taxes from selected contact
            const taxesToApply = availableTaxes.filter(t => contact.taxes?.includes(t.id));
            setAppliedTaxes(taxesToApply.map(t => ({ name: t.name, rate: t.rate, amount: 0 })));
        }
    } else { // 'shipTo'
        const contact = settings.shipToContacts?.find(c => c.id === id);
        if (contact) {
            setShipToName(contact.name);
            setShipToAddress(contact.address);
            setShipToGst(contact.gst);
        }
    }
  };
  
  const handleCompanyProfileSelect = (id: string) => {
    const profile = settings.companyProfiles?.find(p => p.id === id);
    if(profile) {
      setActiveCompanyProfile(profile);
    }
  }

  const handleNewClick = () => {
    handleClearForm(); // This will call onAddNew
    if(pathname !== '/') {
        router.push('/');
    }
  }


  return (
    <>
      <div className="mb-8">
        <div className='flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-4'>
            <div>
              <h1 className="text-4xl font-headline font-bold text-primary">
                InvoiceFlow
              </h1>
              <p className="text-muted-foreground text-sm sm:text-base">
                {initialData ? `Editing Invoice #${initialData.invoiceNumber}` : 'Create a new invoice or upload one to have AI extract the data.'}
              </p>
            </div>
        </div>
        <div className='bg-card p-2 rounded-lg shadow-sm w-full flex flex-col sm:flex-row items-center justify-between gap-2 flex-wrap'>
          <nav className="flex items-center gap-1 flex-wrap">
              <Button variant="ghost" onClick={handleNewClick} className={pathname === '/' ? 'text-primary' : ''}>
                  <FilePlus /> New
              </Button>
              <Button asChild variant="ghost" className={pathname === '/invoices' ? 'text-primary' : ''}>
                  <Link href="/invoices"><ListOrdered /> Saved Invoices</Link>
              </Button>
               <Button asChild variant="ghost" className={pathname === '/settings' ? 'text-primary' : ''}>
                  <Link href="/settings"><SettingsIcon /> Settings</Link>
              </Button>
          </nav>
          <div className="flex items-center gap-2 flex-wrap">
              <Button variant="ghost" onClick={() => fileInputRef.current?.click()} disabled={isExtracting}>
                  {isExtracting ? (
                      <><Loader className="animate-spin" /> Extracting...</>
                  ) : (
                      <><Wand2 /> Autofill</>
                  )}
              </Button>
              <Button onClick={() => handleSaveInvoice(false)} disabled={isSaving} variant="secondary">
                  {isSaving ? <Loader className="animate-spin" /> : <Save />}
                  {initialData ? 'Update' : 'Save'}
              </Button>
              <Button onClick={() => handleSaveInvoice(true)} disabled={isSaving} className="bg-accent text-accent-foreground hover:bg-accent/90">
                  {isSaving ? <Loader className="animate-spin" /> : <Save />}
                  Save &amp; Download
              </Button>
          </div>
        </div>
      </div>
      <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          className="hidden"
          accept="image/*,application/pdf"
          disabled={isExtracting}
      />
          <Card className="w-full shadow-lg">
            <CardHeader className="bg-muted/20 p-4 sm:p-6">
              <CardTitle>Invoice Details</CardTitle>
            </CardHeader>
            <CardContent className="p-4 sm:p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Left Column */}
              <div>
                <h3 className="font-bold text-lg mb-4">From</h3>
                {settings.companyProfiles && settings.companyProfiles.length > 0 && (
                  <div className='mb-4'>
                    <Label>Select Company Profile</Label>
                    <Select onValueChange={handleCompanyProfileSelect} value={activeCompanyProfile?.id}>
                        <SelectTrigger>
                            <SelectValue placeholder="Select a company profile..." />
                        </SelectTrigger>
                        <SelectContent>
                            {settings.companyProfiles.map((p) => <SelectItem key={p.id} value={p.id}>{p.profileName}</SelectItem>)}
                        </SelectContent>
                    </Select>
                  </div>
                )}
                {activeCompanyProfile ? (
                    <div className="space-y-2 text-sm text-muted-foreground">
                        <p className='font-bold text-base text-foreground'>{activeCompanyProfile.companyName}</p>
                        <p style={{whiteSpace: 'pre-wrap'}}>{activeCompanyProfile.companyAddress}</p>
                        {activeCompanyProfile.companyGstin && <p>GSTIN: {activeCompanyProfile.companyGstin}</p>}
                        {activeCompanyProfile.companyPan && <p>PAN: {activeCompanyProfile.companyPan}</p>}
                    </div>
                ) : (
                    <div className="text-sm text-muted-foreground p-4 border-dashed border rounded-md">
                        No company profile selected. Please <Link href="/settings" className="text-primary underline">add or select a profile</Link>.
                    </div>
                )}
                
                <h3 className="font-bold text-lg mb-4 mt-8">Bill To</h3>
                 <div className="space-y-2">
                    <div>
                        <Label>Select Saved Contact</Label>
                        <Select onValueChange={(value) => handleContactSelect('billTo', value)}>
                            <SelectTrigger>
                                <SelectValue placeholder="Select a billing contact" />
                            </SelectTrigger>
                            <SelectContent>
                                {settings.billToContacts && settings.billToContacts.map((c, index) => <SelectItem key={`${c.id}-${index}`} value={c.id}>{c.displayName}</SelectItem>)}
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
                        <Label htmlFor='billToGst'>GSTIN</Label>
                        <Input id="billToGst" placeholder="GST Number" value={billToGst} onChange={e => setBillToGst(e.target.value)} />
                    </div>
                </div>
              </div>

              {/* Right Column */}
              <div>
                <div className="space-y-4">
                    <div className='flex items-center gap-2'>
                        <Label htmlFor="invoiceNumber" className="text-sm font-medium w-24">Invoice #</Label>
                        <Input id="invoiceNumber" value={invoiceNumber} onChange={e => setInvoiceNumber(e.target.value)} className="max-w-[200px]" readOnly={!!initialData || !invoiceNumber} placeholder="Auto-generated" />
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
                        <Select value={period} onValueChange={setPeriod}>
                            <SelectTrigger>
                                <SelectValue placeholder="Select a month" />
                            </SelectTrigger>
                            <SelectContent>
                                {months.map(month => <SelectItem key={month} value={month}>{month}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                    <div>
                        <Label htmlFor='delivery'>Delivery</Label>
                        <Select value={delivery} onValueChange={setDelivery}>
                            <SelectTrigger>
                                <SelectValue placeholder="Select a month" />
                            </SelectTrigger>
                            <SelectContent>
                                {months.map(month => <SelectItem key={month} value={month}>{month}</SelectItem>)}
                            </SelectContent>
                        </Select>
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
                                {settings.shipToContacts && settings.shipToContacts.map((c, index) => <SelectItem key={`${c.id}-${index}`} value={c.id}>{c.displayName}</SelectItem>)}
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

            <CardContent className="p-4 sm:p-6">
              <div className="mt-6 overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-1/2">Item &amp; Description</TableHead>
                      <TableHead className="w-[100px] text-right">Quantity</TableHead>
                      <TableHead className="w-[120px] text-right">Rate</TableHead>
                      <TableHead className="w-[120px] text-right">Amount</TableHead>
                      <TableHead className="text-right no-print w-[80px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lineItems.map((item, index) => (
                      <TableRow key={item.id} className="animate-fade-in-down hover:bg-muted/20">
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
            <CardFooter className="bg-muted/20 p-4 sm:p-6 flex-col items-end gap-4">
              <div className="w-full max-w-sm text-sm grid gap-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className='font-medium'>{subtotal.toFixed(2)}</span>
                </div>
                {appliedTaxes.map((tax, index) => (
                    <div key={index} className="flex justify-between">
                        <span className="text-muted-foreground">{tax.name}</span>
                        <span className='font-medium'>{tax.amount.toFixed(2)}</span>
                    </div>
                ))}
                <div className="flex justify-between font-bold text-lg border-t pt-2 mt-2">
                  <span>Total Amount</span>
                  <span>{total.toFixed(2)}</span>
                </div>
              </div>
               {activeCompanyProfile?.bankBeneficiary && (
              <div className='text-xs text-muted-foreground text-right w-full pt-4 border-t'>
                  <p className='font-semibold'>Bank Details</p>
                  <p>Beneficiary: {activeCompanyProfile.bankBeneficiary}</p>
                  <p>Bank: {activeCompanyProfile.bankName}</p>
                  <p>Account Number: {activeCompanyProfile.bankAccount}</p>
                  <p>IFSC Code: {activeCompanyProfile.bankIfsc}</p>
                  <p>Branch: {activeCompanyProfile.bankBranch}</p>
              </div>
               )}
            </CardFooter>
          </Card>
    </>
  );
}

    