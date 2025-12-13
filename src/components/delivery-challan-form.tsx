
"use client";

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar as CalendarIcon, PlusCircle, Trash2, Wand2, Loader, Save, FilePlus, ListOrdered, Settings as SettingsIcon, Truck } from 'lucide-react';
import { format } from "date-fns"
import { extractChallanData, ExtractChallanOutput } from '@/ai/flows/extract-challan-flow';
import { useToast } from "@/hooks/use-toast"
import { Textarea } from './ui/textarea';
import { Challan, saveChallan, ChallanLineItem } from '@/services/challanService';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getSettings, Settings, CompanyProfile } from '@/services/settingsService';

interface DeliveryChallanFormProps {
    initialData?: Challan | null;
    onChallanSave: (savedChallan?: Challan) => void;
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

export function DeliveryChallanForm({ initialData, onChallanSave, onAddNew }: DeliveryChallanFormProps) {
    const [dcNumber, setDcNumber] = useState('');
    const [dcDate, setDcDate] = useState<Date | undefined>(new Date());
    
    const [billToName, setBillToName] = useState('');
    const [billToAddress, setBillToAddress] = useState('');

    const [shipToName, setShipToName] = useState('');
    const [shipToAddress, setShipToAddress] = useState('');
    
    const [lineItems, setLineItems] = useState<ChallanLineItem[]>([
        { id: 1, name: '', hsnCode: '', quantity: 1, unitPrice: 0, total: 0 },
    ]);
    const [note, setNote] = useState('The above goods sent on returnable basis not for sale');
    
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
                if (loadedSettings.defaultShipToContact && loadedSettings.shipToContacts) {
                    const defaultContact = loadedSettings.shipToContacts.find(c => c.id === loadedSettings.defaultShipToContact);
                    if (defaultContact) {
                        setShipToName(defaultContact.name);
                        setShipToAddress(defaultContact.address);
                    }
                }
            }
        }
        loadSettingsAndApplyDefaults();
    }, [initialData]);

    useEffect(() => {
        if (initialData) {
            setDcNumber(initialData.dcNumber);
            setDcDate(new Date(initialData.dcDate));
            setBillToName(initialData.billToName || '');
            setBillToAddress(initialData.billToAddress || '');
            setShipToName(initialData.shipToName || '');
            setShipToAddress(initialData.shipToAddress || '');
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
            setNote(initialData.note || 'The above goods sent on returnable basis not for sale');
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

    const handleItemChange = (id: number, field: keyof Omit<ChallanLineItem, 'id' | 'total'>, value: string | number) => {
        setLineItems(lineItems.map(item =>
            item.id === id ? { ...item, [field]: value } : item
        ));
    };
    
    const handleClearForm = (shouldCallback = true) => {
        setDcNumber('');
        setDcDate(new Date());
        setBillToName('');
        setBillToAddress('');
        setShipToName('');
        setShipToAddress('');
        setLineItems([{ id: Date.now(), name: '', hsnCode: '', quantity: 1, unitPrice: 0, total: 0 }]);
        setGstRate(5);
        setShipping(0);
        setOther(0);
        setNote('The above goods sent on returnable basis not for sale');
        if (shouldCallback) {
            onAddNew();
        }
    };
  
    const handleSaveChallan = async (andDownload = false) => {
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
            const challanData: Omit<Challan, 'dcNumber' | 'createdAt'> & {id?: string} = {
                dcDate: dcDate?.toISOString() || new Date().toISOString(),
                companyProfileId: activeCompanyProfile.id,
                billToName,
                billToAddress,
                shipToName: shipToName || billToName,
                shipToAddress: shipToAddress || billToAddress,
                lineItems: lineItems.map(({ id, ...item }) => item),
                subtotal,
                gstAmount,
                shipping: Number(shipping),
                other: Number(other),
                total,
                note,
            };

            if(initialData?.id) {
                challanData.id = initialData.id;
            }

            const savedChallan = await saveChallan(challanData);
            toast({
                title: initialData ? "Challan Updated" : "Challan Saved",
                description: `Your challan has been successfully ${initialData ? 'updated' : 'saved'}.`,
            });
            
            if (andDownload) {
                onChallanSave(savedChallan);
            } else {
                onChallanSave();
            }

        } catch (error) {
            console.error("Failed to save challan:", error);
            const errorMessage = error instanceof Error ? error.message : "Could not save the challan. Please try again.";
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
            const result: ExtractChallanOutput = await extractChallanData({ photoDataUri: dataUri });
            
            if (result.dcNumber) setDcNumber(result.dcNumber);
            if (result.dcDate) setDcDate(new Date(result.dcDate));
            if (result.billToName) setBillToName(result.billToName);
            if (result.billToAddress) setBillToAddress(result.billToAddress);
            if (result.shipToName) setShipToName(result.shipToName);
            if (result.shipToAddress) setShipToAddress(result.shipToAddress);
            
            if (!result.shipToName && result.billToName) setShipToName(result.billToName);
            if (!result.shipToAddress && result.billToAddress) setShipToAddress(result.billToAddress);

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
            if (result.total) { /* Not setting total directly */ }

            toast({
                title: "Extraction Complete",
                description: "Challan data has been filled in.",
            });
        } catch (error) {
            console.error("Failed to extract challan data:", error);
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
        const billTo = (settings.billToContacts || []).map(c => ({...c, type: 'billTo'}));
        const shipTo = (settings.shipToContacts || []).map(c => ({...c, type: 'shipTo'}));
        return [...billTo, ...shipTo];
    }, [settings.billToContacts, settings.shipToContacts]);


    const handleContactSelect = (value: string, section: 'billTo' | 'shipTo') => {
        const [id, type] = value.split('|');
        const contact = combinedContacts.find(c => c.id === id && c.type === type);
        
        if (contact) {
            if (section === 'billTo') {
                setBillToName(contact.name);
                setBillToAddress(contact.address);
            } else { // 'shipTo'
                setShipToName(contact.name);
                setShipToAddress(contact.address);
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
        if (pathname !== '/delivery-challan') {
          router.push('/delivery-challan');
        }
        onAddNew();
    };

  return (
    <>
      <div className="mb-8">
        <div className='flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-4'>
            <div>
              <h1 className="text-4xl font-headline font-bold text-primary">
                Delivery Challan
              </h1>
              <p className="text-muted-foreground text-sm sm:text-base">
                {initialData ? `Editing DC #${initialData.dcNumber}` : 'Create a new delivery challan.'}
              </p>
            </div>
        </div>
        <div className='bg-card p-2 rounded-lg shadow-sm w-full flex flex-col sm:flex-row items-center justify-between gap-2 flex-wrap'>
          <nav className="flex items-center gap-1 flex-wrap">
              <Button asChild variant="ghost" className={pathname === '/' ? 'text-primary' : ''}>
                  <Link href="/"><FilePlus /> New Invoice</Link>
              </Button>
              <Button variant="ghost" onClick={handleNewClick}>
                  <Truck /> New Challan
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
              <Button onClick={() => handleSaveChallan(false)} disabled={isSaving} variant="secondary">
                  {isSaving ? <Loader className="animate-spin" /> : <Save />}
                  {initialData ? 'Update' : 'Save'}
              </Button>
              <Button onClick={() => handleSaveChallan(true)} disabled={isSaving} className="bg-accent text-accent-foreground hover:bg-accent/90">
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
              <CardTitle>Challan Details</CardTitle>
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
                
                <h3 className="font-bold text-lg mb-4 mt-8">Bill To</h3>
                 <div className="space-y-2">
                    <div>
                        <Label>Select Saved Contact</Label>
                        <Select onValueChange={(value) => handleContactSelect(value, 'billTo')}>
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
                        <Label htmlFor="dcNumber" className="text-sm font-medium w-24">DC #</Label>
                        <Input id="dcNumber" value={dcNumber} onChange={e => setDcNumber(e.target.value)} className="max-w-[200px]" readOnly placeholder="Auto-generated" />
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
                                {dcDate ? format(dcDate, "PPP") : <span>Pick a date</span>}
                            </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="end">
                            <Calendar
                                mode="single"
                                selected={dcDate}
                                onSelect={setDcDate}
                                initialFocus
                            />
                            </PopoverContent>
                        </Popover>
                    </div>
                </div>

                <h3 className="font-bold text-lg mb-4 mt-8">Ship To</h3>
                <div className="space-y-2">
                    <div>
                        <Label>Select Saved Contact</Label>
                        <Select onValueChange={(value) => handleContactSelect(value, 'shipTo')}>
                            <SelectTrigger>
                                <SelectValue placeholder="Select a contact" />
                            </SelectTrigger>
                            <SelectContent>
                                {combinedContacts.map((c) => 
                                <SelectItem key={`${c.id}-${c.type}-ship`} value={`${c.id}|${c.type}`}>
                                    {c.displayName} ({c.type === 'billTo' ? 'Bill' : 'Ship'})
                                </SelectItem>
                                )}
                            </SelectContent>
                        </Select>
                    </div>
                    <div>
                        <Label htmlFor='shipToName'>Name</Label>
                        <Input id="shipToName" placeholder="Shipping Company Name" value={shipToName} onChange={e => setShipToName(e.target.value)} />
                    </div>
                    <div>
                        <Label htmlFor='shipToAddress'>Address</Label>
                        <Textarea id="shipToAddress" placeholder="Shipping Address" value={shipToAddress} onChange={e => setShipToAddress(e.target.value)} />
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
                    {activeCompanyProfile?.bankBeneficiary && (
                        <div className='text-xs text-muted-foreground'>
                            <p className='font-semibold'>Bank Details</p>
                            <p>Name: {activeCompanyProfile.bankBeneficiary}</p>
                            <p>Account No: {activeCompanyProfile.bankAccount}</p>
                            <p>IFSC: {activeCompanyProfile.bankIfsc}</p>
                            <p>Bank: {activeCompanyProfile.bankName}</p>
                        </div>
                    )}
                    <div>
                        <Label>Note</Label>
                        <Textarea value={note} onChange={e => setNote(e.target.value)} />
                    </div>
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

    