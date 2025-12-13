
"use client";

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar as CalendarIcon, PlusCircle, Trash2, Wand2, Loader, Save, FilePlus, ListOrdered, Settings as SettingsIcon, Truck, FileText } from 'lucide-react';
import { format } from "date-fns"
import { extractQuotationData, ExtractQuotationOutput } from '@/ai/flows/extract-quotation-flow';
import { useToast } from "@/hooks/use-toast"
import { Textarea } from './ui/textarea';
import { Quotation, saveQuotation, QuotationLineItem } from '@/services/quotationService';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getSettings, Settings, CompanyProfile, BillToContact, ShipToContact } from '@/services/settingsService';

interface QuotationFormProps {
    initialData?: Quotation | null;
    onQuotationSave: (savedQuotation?: Quotation) => void;
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

type CombinedContact = (BillToContact & { type: 'billTo' }) | (ShipToContact & { type: 'shipTo' });

export function QuotationForm({ initialData, onQuotationSave, onAddNew }: QuotationFormProps) {
    const [quotationNumber, setQuotationNumber] = useState('');
    const [quotationDate, setQuotationDate] = useState<Date | undefined>(undefined);
    const [validityDate, setValidityDate] = useState<Date | undefined>(undefined);
    
    const [billToName, setBillToName] = useState('');
    const [billToAddress, setBillToAddress] = useState('');
    
    const [lineItems, setLineItems] = useState<QuotationLineItem[]>([
        { id: 1, name: '', hsnCode: '', quantity: 1, unitPrice: 0, total: 0 },
    ]);
    const [terms, setTerms] = useState('1. Price: Inclusive of all taxes\n2. Delivery: 2-3 days from the date of receipt of purchase order\n3. Payment: 100% advance along with purchase order');
    
    const [gstRate, setGstRate] = useState(5);
    const [shipping, setShipping] = useState(0);
    const [other, setOther] = useState(0);

    const [isExtracting, setIsExtracting] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const pathname = usePathname();
    const router = useRouter();
    
    const [settings, setSettings] = useState<Settings>({ companyProfiles: [], billToContacts: [], shipToContacts: [] });
    const [activeCompanyProfile, setActiveCompanyProfile] = useState<CompanyProfile | null>(null);

    const { toast } = useToast();

    const subtotal = useMemo(() => {
        return lineItems.reduce((acc, item) => acc + item.total, 0);
    }, [lineItems]);
    
    const gstAmount = useMemo(() => {
        return (subtotal * gstRate) / 100;
    }, [subtotal, gstRate]);

    const total = useMemo(() => {
        return subtotal + gstAmount + Number(shipping) + Number(other);
    }, [subtotal, gstAmount, shipping, other]);
    
    useEffect(() => {
        if(!initialData){
            setQuotationDate(new Date());
            setValidityDate(new Date());
        }
    }, [initialData]);

    useEffect(() => {
        async function loadSettingsAndApplyDefaults() {
            const loadedSettings = await getSettings();
            setSettings(loadedSettings);

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

            if (!initialData) {
                if (loadedSettings.defaultBillToContact && loadedSettings.billToContacts) {
                    const defaultContact = loadedSettings.billToContacts.find(c => c.id === loadedSettings.defaultBillToContact);
                    if (defaultContact) {
                        setBillToName(defaultContact.name);
                        setBillToAddress(defaultContact.address);
                    }
                }
            }
        }
        loadSettingsAndApplyDefaults();
    }, [initialData]);

    useEffect(() => {
        if (initialData) {
            setQuotationNumber(initialData.quotationNumber);
            setQuotationDate(new Date(initialData.quotationDate));
            setValidityDate(new Date(initialData.validityDate));
            setBillToName(initialData.billToName || '');
            setBillToAddress(initialData.billToAddress || '');
            setLineItems(initialData.lineItems.map((item, index) => ({
                id: item.id || Date.now() + index,
                name: item.name || '',
                hsnCode: item.hsnCode || '',
                quantity: item.quantity || 0,
                unitPrice: item.unitPrice || 0,
                total: item.total || 0,
            })));
            const calculatedGstRate = initialData.subtotal > 0 ? (initialData.gstAmount / initialData.subtotal) * 100 : 5;
            setGstRate(calculatedGstRate);
            setShipping(initialData.shipping || 0);
            setOther(initialData.other || 0);
            setTerms(initialData.terms || '1. Price: Inclusive of all taxes\n2. Delivery: 2-3 days from the date of receipt of purchase order\n3. Payment: 100% advance along with purchase order');
        } else {
            handleClearForm(false);
        }
    }, [initialData]);
    
    useEffect(() => {
        setLineItems(items => items.map(item => ({
            ...item,
            total: (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0)
        })));
    }, [lineItems.map(i => `${i.quantity}-${i.unitPrice}`).join(',')]);

    const handleAddItem = () => {
        setLineItems([...lineItems, { id: Date.now(), name: '', hsnCode: '', quantity: 1, unitPrice: 0, total: 0 }]);
    };

    const handleRemoveItem = (id: number) => {
        setLineItems(lineItems.filter(item => item.id !== id));
    };

    const handleItemChange = (id: number, field: keyof Omit<QuotationLineItem, 'id' | 'total'>, value: string | number) => {
        setLineItems(lineItems.map(item =>
            item.id === id ? { ...item, [field]: value } : item
        ));
    };
    
    const handleClearForm = (shouldCallback = true) => {
        setQuotationNumber('');
        setQuotationDate(new Date());
        setValidityDate(new Date());
        setBillToName('');
        setBillToAddress('');
        setLineItems([{ id: Date.now(), name: '', hsnCode: '', quantity: 1, unitPrice: 0, total: 0 }]);
        setGstRate(5);
        setShipping(0);
        setOther(0);
        setTerms('1. Price: Inclusive of all taxes\n2. Delivery: 2-3 days from the date of receipt of purchase order\n3. Payment: 100% advance along with purchase order');
        if (shouldCallback) {
            onAddNew();
        }
    };
  
    const handleSaveQuotation = async (andDownload = false) => {
        if(!billToName) {
            toast({ variant: "destructive", title: "Bill To Name is required" });
            return;
        }
        if (!activeCompanyProfile) {
            toast({ variant: "destructive", title: "Company Profile is required", description: "Please select a company profile or add one in settings." });
            return;
        }

        setIsSaving(true);
        try {
            const quotationData: Omit<Quotation, 'quotationNumber' | 'createdAt'> & {id?: string} = {
                quotationDate: quotationDate?.toISOString() || new Date().toISOString(),
                validityDate: validityDate?.toISOString() || new Date().toISOString(),
                companyProfileId: activeCompanyProfile.id,
                billToName,
                billToAddress,
                lineItems: lineItems.map(({ id, ...item }) => item),
                subtotal,
                gstAmount,
                shipping: Number(shipping),
                other: Number(other),
                total,
                terms,
            };

            if(initialData?.id) {
                quotationData.id = initialData.id;
            }

            const savedQuotation = await saveQuotation(quotationData);
            toast({
                title: initialData ? "Quotation Updated" : "Quotation Saved",
                description: `Your quotation has been successfully ${initialData ? 'updated' : 'saved'}.`,
            });
            
            if (andDownload) {
                onQuotationSave(savedQuotation);
            } else {
                onQuotationSave();
            }

        } catch (error) {
            console.error("Failed to save quotation:", error);
            const errorMessage = error instanceof Error ? error.message : "Could not save the quotation. Please try again.";
            toast({ variant: "destructive", title: "Save Failed", description: errorMessage });
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
            const result: ExtractQuotationOutput = await extractQuotationData({ photoDataUri: dataUri });
            
            if (result.quotationNumber) setQuotationNumber(result.quotationNumber);
            if (result.quotationDate) setQuotationDate(new Date(result.quotationDate));
            if (result.validityDate) setValidityDate(new Date(result.validityDate));
            if (result.billToName) setBillToName(result.billToName);
            if (result.billToAddress) setBillToAddress(result.billToAddress);

            if (result.lineItems && result.lineItems.length > 0) {
                setLineItems(result.lineItems.map((item, index) => ({
                    id: Date.now() + index,
                    ...item,
                    hsnCode: item.hsnCode || '',
                    total: item.quantity * item.unitPrice,
                })));
            }
             if (result.subtotal) { /* Not setting subtotal directly */ }
            if (result.gstAmount) {
                 const extractedSubtotal = result.subtotal || subtotal;
                if(extractedSubtotal > 0) {
                    setGstRate((result.gstAmount / extractedSubtotal) * 100);
                }
            }
            if (result.shipping) setShipping(result.shipping);
            if (result.other) setOther(result.other);
            if(result.terms) setTerms(result.terms);

            toast({
                title: "Extraction Complete",
                description: "Quotation data has been filled in.",
            });
        } catch (error) {
            console.error("Failed to extract quotation data:", error);
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

    const combinedContacts = useMemo(() => {
        const billTo = (settings.billToContacts || []).map(c => ({...c, type: 'billTo' as const}));
        const shipTo = (settings.shipToContacts || []).map(c => ({...c, type: 'shipTo' as const}));
        return [...billTo, ...shipTo];
    }, [settings.billToContacts, settings.shipToContacts]);


    const handleContactSelect = (value: string) => {
        const [id, type] = value.split('|');
        const contact = combinedContacts.find(c => c.id === id && c.type === type);
        
        if (contact) {
            setBillToName(contact.name);
            setBillToAddress(contact.address);
        }
    };
  
    const handleCompanyProfileSelect = (id: string) => {
        const profile = settings.companyProfiles?.find(p => p.id === id);
        if(profile) {
          setActiveCompanyProfile(profile);
        }
    }

    const handleNewClick = () => {
        if (pathname !== '/quotation') {
          router.push('/quotation');
        }
        onAddNew();
    };

  return (
    <>
      <div className="mb-8">
        <div className='flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-4'>
            <div>
              <h1 className="text-4xl font-headline font-bold text-primary">
                Quotation
              </h1>
              <p className="text-muted-foreground text-sm sm:text-base">
                {initialData ? `Editing Quotation #${initialData.quotationNumber}` : 'Create a new quotation.'}
              </p>
            </div>
        </div>
        <div className='bg-card p-2 rounded-lg shadow-sm w-full flex flex-col sm:flex-row items-center justify-between gap-2 flex-wrap'>
          <nav className="flex items-center gap-1 flex-wrap">
              <Button asChild variant="ghost" className={pathname === '/' ? 'text-primary' : ''}>
                  <Link href="/"><FilePlus /> New Invoice</Link>
              </Button>
              <Button variant="ghost" onClick={handleNewClick}>
                  <FileText /> New Quotation
              </Button>
              <Button asChild variant="ghost" className={pathname === '/delivery-challan' ? 'text-primary' : ''}>
                  <Link href="/delivery-challan"><Truck /> Delivery Challan</Link>
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
              <Button onClick={() => handleSaveQuotation(false)} disabled={isSaving} variant="secondary">
                  {isSaving ? <Loader className="animate-spin" /> : <Save />}
                  {initialData ? 'Update' : 'Save'}
              </Button>
              <Button onClick={() => handleSaveQuotation(true)} disabled={isSaving} className="bg-accent text-accent-foreground hover:bg-accent/90">
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
              <CardTitle>Quotation Details</CardTitle>
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
                    </div>
                ) : (
                    <div className="text-sm text-muted-foreground p-4 border-dashed border rounded-md">
                        No company profile selected. Please <Link href="/settings" className="text-primary underline">add or select a profile</Link>.
                    </div>
                )}
                
                <h3 className="font-bold text-lg mb-4 mt-8">To (Company)</h3>
                 <div className="space-y-2">
                    <div>
                        <Label>Select Saved Contact</Label>
                        <Select onValueChange={(value) => handleContactSelect(value)}>
                            <SelectTrigger>
                                <SelectValue placeholder="Select a contact" />
                            </SelectTrigger>
                            <SelectContent>
                                {combinedContacts.map((c) => 
                                <SelectItem key={`${c.id}-${c.type}`} value={`${c.id}|${c.type}`}>
                                    {c.displayName} ({c.type === 'billTo' ? 'Bill' : 'Ship'})
                                </SelectItem>
                                )}
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
                </div>
              </div>

              {/* Right Column */}
              <div>
                <div className="space-y-4">
                    <div className='flex items-center gap-2'>
                        <Label htmlFor="quotationNumber" className="text-sm font-medium w-28">Quotation #</Label>
                        <Input id="quotationNumber" value={quotationNumber} onChange={e => setQuotationNumber(e.target.value)} className="max-w-[200px]" readOnly placeholder="Auto-generated" />
                    </div>
                    <div>
                        <Label>Quotation Date</Label>
                        <Popover>
                            <PopoverTrigger asChild>
                            <Button
                                id="date"
                                variant={"outline"}
                                className="w-full justify-start text-left font-normal"
                            >
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {quotationDate ? format(quotationDate, "PPP") : <span>Pick a date</span>}
                            </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="end">
                            <Calendar
                                mode="single"
                                selected={quotationDate}
                                onSelect={setQuotationDate}
                                initialFocus
                            />
                            </PopoverContent>
                        </Popover>
                    </div>
                    <div>
                        <Label>Validity Date</Label>
                         <Popover>
                            <PopoverTrigger asChild>
                            <Button
                                id="validityDate"
                                variant={"outline"}
                                className="w-full justify-start text-left font-normal"
                            >
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {validityDate ? format(validityDate, "PPP") : <span>Pick a date</span>}
                            </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="end">
                            <Calendar
                                mode="single"
                                selected={validityDate}
                                onSelect={setValidityDate}
                                initialFocus
                            />
                            </PopoverContent>
                        </Popover>
                    </div>
                </div>
              </div>
            </CardContent>

            <CardContent className="p-4 sm:p-6">
              <div className="mt-6 overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-2/5">Item Name</TableHead>
                      <TableHead className="w-[120px]">HSN Code</TableHead>
                      <TableHead className="w-[100px] text-right">Qty</TableHead>
                      <TableHead className="w-[150px] text-right">Unit Price</TableHead>
                      <TableHead className="w-[120px] text-right">Total</TableHead>
                      <TableHead className="text-right no-print w-[80px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lineItems.map((item, index) => (
                      <TableRow key={item.id} className="animate-fade-in-down hover:bg-muted/20">
                        <TableCell>
                          <Input placeholder="Item description" value={item.name || ''} onChange={e => handleItemChange(item.id, 'name', e.target.value)} />
                        </TableCell>
                         <TableCell>
                          <Input placeholder="HSN Code" value={item.hsnCode || ''} onChange={e => handleItemChange(item.id, 'hsnCode', e.target.value)} />
                        </TableCell>
                        <TableCell>
                          <Input className="text-right" type="number" value={item.quantity} onChange={e => handleItemChange(item.id, 'quantity', parseFloat(e.target.value) || 0)} min="0" />
                        </TableCell>
                        <TableCell>
                          <Input className="text-right" type="number" value={item.unitPrice} onChange={e => handleItemChange(item.id, 'unitPrice', parseFloat(e.target.value) || 0)} min="0" step="0.01" />
                        </TableCell>
                        <TableCell className="font-medium text-right">{item.total.toFixed(2)}</TableCell>
                        <TableCell className="text-right no-print">
                          <Button variant="ghost" size="icon" onClick={() => handleRemoveItem(item.id)} aria-label="Remove item" className="active:scale-95">
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="mt-4 no-print">
                <Button onClick={handleAddItem} variant="outline" size="sm" className="bg-transparent hover:bg-accent/10 active:scale-95">
                  <PlusCircle className="mr-2 h-4 w-4" /> Add Item
                </Button>
              </div>
            </CardContent>
            <CardFooter className="bg-muted/20 p-4 sm:p-6 flex justify-between items-start gap-8">
                <div className="w-full space-y-4">
                     <div>
                        <Label>Terms &amp; Conditions</Label>
                        <Textarea value={terms} onChange={e => setTerms(e.target.value)} rows={5}/>
                    </div>
                    {activeCompanyProfile?.bankBeneficiary && (
                        <div className='text-xs text-muted-foreground'>
                            <p className='font-semibold'>Bank Details</p>
                            <p>Name: {activeCompanyProfile.bankBeneficiary}</p>
                            <p>Account No: {activeCompanyProfile.bankAccount}</p>
                            <p>IFSC: {activeCompanyProfile.bankIfsc}</p>
                            <p>Bank: {activeCompanyProfile.bankName}</p>
                        </div>
                    )}
                </div>
                <div className="w-full max-w-sm space-y-2 text-sm">
                     <div className="flex justify-between">
                        <span className="text-muted-foreground">Subtotal</span>
                        <span className='font-medium'>{subtotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                         <div className="flex items-center gap-1">
                            <span className="text-muted-foreground">GST @</span>
                            <Input 
                                type="number" 
                                value={gstRate} 
                                onChange={e => setGstRate(parseFloat(e.target.value) || 0)} 
                                className="h-8 text-right w-16"
                                placeholder="5"
                            />
                            <span className="text-muted-foreground">%</span>
                        </div>
                        <span className='font-medium'>{gstAmount.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">Shipping/Handling</span>
                         <Input type="number" value={shipping} onChange={e => setShipping(parseFloat(e.target.value) || 0)} className="h-8 text-right max-w-[120px]" />
                    </div>
                    <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">Other</span>
                        <Input type="number" value={other} onChange={e => setOther(parseFloat(e.target.value) || 0)} className="h-8 text-right max-w-[120px]" />
                    </div>
                    <div className="flex justify-between font-bold text-lg border-t pt-2 mt-2">
                      <span>Total</span>
                      <span>{total.toFixed(2)}</span>
                    </div>
                </div>
            </CardFooter>
          </Card>
    </>
  );
}

    