
'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
    getSettings,
    saveBillToContact,
    saveShipToContact,
    deleteBillToContact,
    deleteShipToContact,
    updateBillToContact,
    updateShipToContact,
    setDefaultBillToContact,
    setDefaultShipToContact,
    saveCompanyProfile,
    updateCompanyProfile,
    deleteCompanyProfile,
    setDefaultCompanyProfile,
    BillToContact,
    ShipToContact,
    Settings,
    CompanyProfile,
    saveGeneralSettings
} from '@/services/settingsService';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Loader, PlusCircle, Pencil, Trash2, Star, Save } from 'lucide-react';
import Link from 'next/link';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AppShell } from '@/components/app-shell';
import { availableTaxes } from '@/lib/tax-constants';


type ContactType = 'billTo' | 'shipTo';

const initialCompanyProfile: Omit<CompanyProfile, 'id'> = {
    profileName: '',
    companyName: '',
    companyAddress: '',
    companyGstin: '',
    companyPan: '',
    companyPhone: '',
    companyEmail: '',
    invoicePrefix: '',
    bankBeneficiary: '',
    bankName: '',
    bankAccount: '',
    bankIfsc: '',
    bankBranch: '',
    stampLogoUrl: '',
    logoUrl: '',
};

const initialBillToState: Omit<BillToContact, 'id'> = {
    displayName: '', name: '', address: '', gst: ''
};

const initialShipToState: Omit<ShipToContact, 'id'> = {
    displayName: '', name: '', address: '', gst: '', taxes: []
};


export default function SettingsPage() {
    const [settings, setSettings] = useState<Settings>({ companyProfiles: [], billToContacts: [], shipToContacts: [] });

    const [newBillTo, setNewBillTo] = useState<Omit<BillToContact, 'id'>>(initialBillToState);
    const [newShipTo, setNewShipTo] = useState<Omit<ShipToContact, 'id'>>(initialShipToState);

    const [editingContact, setEditingContact] = useState<BillToContact | ShipToContact | null>(null);
    const [editingContactType, setEditingContactType] = useState<ContactType | null>(null);
    const [isContactEditDialogOpen, setIsContactEditDialogOpen] = useState(false);

    const [editingProfile, setEditingProfile] = useState<CompanyProfile | null>(null);
    const [isProfileEditDialogOpen, setIsProfileEditDialogOpen] = useState(false);
    const [stampPreview, setStampPreview] = useState<string | null>(null);
    const [logoPreview, setLogoPreview] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const logoInputRef = useRef<HTMLInputElement>(null);

    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const { toast } = useToast();

    const loadSettings = useCallback(async () => {
        setIsLoading(true);
        try {
            const loadedSettings = await getSettings();
            setSettings(loadedSettings);
        } catch (e) {
            toast({ variant: 'destructive', title: 'Failed to load settings.' })
        } finally {
            setIsLoading(false);
        }
    }, [toast]);

    useEffect(() => {
        loadSettings();
    }, [loadSettings]);

    const handleTaxChange = (form: 'newShipTo' | 'editContact', taxId: string, checked: boolean | 'indeterminate') => {
        const updater = (prev: any) => {
            const currentTaxes = prev.taxes || [];
            if (checked) {
                return { ...prev, taxes: [...currentTaxes, taxId] };
            } else {
                return { ...prev, taxes: currentTaxes.filter((t: string) => t !== taxId) };
            }
        };

        if (form === 'newShipTo') {
            setNewShipTo(updater);
        } else {
            setEditingContact(updater);
        }
    };

    const renderTaxesSelector = (form: 'newShipTo' | 'editContact', contactData: any) => (
        <div className="space-y-2">
            <Label>Applicable Taxes</Label>
            <div className="p-4 border rounded-md grid grid-cols-2 gap-4">
                {availableTaxes.map(tax => (
                    <div key={tax.id} className="flex items-center space-x-2">
                        <Checkbox
                            id={`${form}-${tax.id}`}
                            checked={contactData.taxes?.includes(tax.id)}
                            onCheckedChange={(checked) => handleTaxChange(form, tax.id, checked)}
                        />
                        <label
                            htmlFor={`${form}-${tax.id}`}
                            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                        >
                            {tax.name}
                        </label>
                    </div>
                ))}
            </div>
        </div>
    );

    const handleInputChange = (form: 'newBillTo' | 'newShipTo' | 'editContact', field: string, value: string) => {
        if (form === 'newBillTo') {
            setNewBillTo(prev => ({ ...prev, [field]: value }));
        } else if (form === 'newShipTo') {
            setNewShipTo(prev => ({ ...prev, [field]: value }));
        } else {
            setEditingContact(prev => prev ? { ...prev, [field]: value } : null);
        }
    };

    const handleProfileInputChange = (field: keyof CompanyProfile, value: string) => {
        setEditingProfile(prev => prev ? { ...prev, [field]: value } : null);
    }

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, type: 'stamp' | 'logo') => {
        const file = e.target.files?.[0];
        if (file && editingProfile) {
            const reader = new FileReader();
            reader.onloadend = () => {
                const dataUri = reader.result as string;
                if (type === 'stamp') {
                    setStampPreview(dataUri);
                    handleProfileInputChange('stampLogoUrl', dataUri);
                } else {
                    setLogoPreview(dataUri);
                    handleProfileInputChange('logoUrl', dataUri);
                }
            };
            reader.readAsDataURL(file);
        }
    };

    const handleAddContact = async (type: ContactType) => {
        const contactData = type === 'billTo' ? newBillTo : newShipTo;
        if (!contactData.displayName || !contactData.name) {
            toast({ variant: "destructive", title: "Missing Information", description: "Display Name and Name are required." });
            return;
        }

        setIsSaving(true);
        try {
            if (type === 'billTo') {
                await saveBillToContact(contactData);
                setNewBillTo(initialBillToState);
            } else {
                await saveShipToContact(contactData as Omit<ShipToContact, 'id'>);
                setNewShipTo(initialShipToState);
            }
            await loadSettings();
            toast({ title: "Contact Saved", description: `The new ${type === 'billTo' ? '"Bill To"' : '"Ship To"'} contact has been added.` });
        } catch (error) {
            console.error(`Failed to save ${type} contact:`, error);
            const errorMessage = error instanceof Error ? error.message : "Could not save the contact. Please try again.";
            toast({ variant: "destructive", title: "Save Failed", description: errorMessage });
        } finally {
            setIsSaving(false);
        }
    };

    const handleEditContactClick = (contact: BillToContact | ShipToContact, type: ContactType) => {
        setEditingContact(JSON.parse(JSON.stringify(contact))); // Deep copy
        setEditingContactType(type);
        setIsContactEditDialogOpen(true);
    };

    const handleUpdateContact = async () => {
        if (!editingContact || !editingContactType) return;

        if (!editingContact.displayName || !editingContact.name) {
            toast({ variant: "destructive", title: "Missing Information", description: "Display Name and Name are required." });
            return;
        }

        setIsSaving(true);
        try {
            if (editingContactType === 'billTo') {
                await updateBillToContact(editingContact as BillToContact);
            } else {
                await updateShipToContact(editingContact as ShipToContact);
            }
            await loadSettings();
            setIsContactEditDialogOpen(false);
            setEditingContact(null);
            toast({ title: "Contact Updated", description: "The contact has been successfully updated." });
        } catch (error) {
            console.error(`Failed to update ${editingContactType} contact:`, error);
            const errorMessage = error instanceof Error ? error.message : `Could not update the contact. Please try again.`;
            toast({ variant: "destructive", title: "Update Failed", description: errorMessage });
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteContact = async (type: ContactType, id: string) => {
        setIsSaving(true);
        try {
            if (type === 'billTo') {
                await deleteBillToContact(id);
            } else {
                await deleteShipToContact(id);
            }
            await loadSettings();
            toast({ title: "Contact Deleted", description: "The contact has been removed." });
        } catch (error) {
            console.error(`Failed to delete ${type} contact:`, error);
            toast({ variant: "destructive", title: "Delete Failed", description: `Could not delete the contact. Please try again.` });
        } finally {
            setIsSaving(false);
        }
    };

    const handleSetDefaultContact = async (type: ContactType, id: string) => {
        setIsSaving(true);
        try {
            if (type === 'billTo') {
                await setDefaultBillToContact(id);
            } else {
                await setDefaultShipToContact(id);
            }
            await loadSettings();
            toast({ title: "Default Set", description: `The default ${type === 'billTo' ? '"Bill To"' : '"Ship To"'} contact has been updated.` });
        } catch (error) {
            console.error(`Failed to set default ${type} contact:`, error);
            toast({ variant: "destructive", title: "Update Failed", description: `Could not set the default contact. Please try again.` });
        } finally {
            setIsSaving(false);
        }
    }

    // Company Profile handlers
    const handleAddNewProfile = () => {
        setEditingProfile({ ...initialCompanyProfile, id: '' });
        setStampPreview(null);
        setLogoPreview(null);
        setIsProfileEditDialogOpen(true);
    }

    const handleEditProfileClick = (profile: CompanyProfile) => {
        setEditingProfile(JSON.parse(JSON.stringify(profile)));
        setStampPreview(profile.stampLogoUrl);
        setLogoPreview(profile.logoUrl);
        setIsProfileEditDialogOpen(true);
    };

    const handleSaveProfile = async () => {
        if (!editingProfile || !editingProfile.profileName || !editingProfile.companyName) {
            toast({ variant: "destructive", title: "Missing Information", description: "Profile Name and Company Name are required." });
            return;
        }
        setIsSaving(true);
        try {
            if (editingProfile.id) { // Update existing
                await updateCompanyProfile(editingProfile);
                toast({ title: "Profile Updated", description: "The company profile has been updated." });
            } else { // Create new
                const { id, ...newProfileData } = editingProfile;
                await saveCompanyProfile(newProfileData);
                toast({ title: "Profile Saved", description: "The new company profile has been added." });
            }
            await loadSettings();
            setIsProfileEditDialogOpen(false);
            setEditingProfile(null);
            setStampPreview(null);
            setLogoPreview(null);
        } catch (error) {
            console.error("Failed to save profile:", error);
            const errorMessage = error instanceof Error ? error.message : "Could not save profile.";
            toast({ variant: "destructive", title: "Save Failed", description: errorMessage });
        } finally {
            setIsSaving(false);
        }
    }

    const handleDeleteProfile = async (id: string) => {
        setIsSaving(true);
        try {
            await deleteCompanyProfile(id);
            await loadSettings();
            toast({ title: "Profile Deleted", description: "The company profile has been removed." });
        } catch (error) {
            console.error(`Failed to delete profile:`, error);
            toast({ variant: "destructive", title: "Delete Failed", description: `Could not delete profile. Please try again.` });
        } finally {
            setIsSaving(false);
        }
    };

    const handleSetDefaultProfile = async (id: string) => {
        setIsSaving(true);
        try {
            await setDefaultCompanyProfile(id);
            await loadSettings();
            toast({ title: "Default Set", description: "The default company profile has been updated." });
        } catch (error) {
            console.error(`Failed to set default profile:`, error);
            toast({ variant: "destructive", title: "Update Failed", description: `Could not set the default profile. Please try again.` });
        } finally {
            setIsSaving(false);
        }
    }
    const handleSaveGeneralSettings = async (updates: Partial<Settings>) => {
        setIsSaving(true);
        try {
            await saveGeneralSettings(updates);
            setSettings(prev => ({ ...prev, ...updates }));
            toast({ title: "Settings Saved", description: "Your general preferences have been updated." });
        } catch (error) {
            toast({ variant: "destructive", title: "Error", description: "Failed to save general settings." });
        } finally {
            setIsSaving(false);
        }
    };

    const renderProfileForm = (profile: CompanyProfile | Omit<CompanyProfile, 'id'>) => {
        return (
            <Accordion type="multiple" defaultValue={['item-1', 'item-2', 'item-3', 'item-4', 'item-5']} className="w-full">
                <div className="space-y-2 mb-6">
                    <Label>Profile Name (for your reference)</Label>
                    <Input value={profile.profileName ?? ''} onChange={e => handleProfileInputChange('profileName', e.target.value)} placeholder="e.g., Main Business, Side Hustle" />
                </div>
                <AccordionItem value="item-1">
                    <AccordionTrigger>Company Details (&quot;From&quot; Address)</AccordionTrigger>
                    <AccordionContent className="grid md:grid-cols-2 gap-4 pt-4">
                        <div className="space-y-2 md:col-span-2">
                            <Label>Company Name</Label>
                            <Input value={profile.companyName ?? ''} onChange={e => handleProfileInputChange('companyName', e.target.value)} />
                        </div>
                        <div className="space-y-2 md:col-span-2">
                            <Label>Company Address</Label>
                            <Textarea value={profile.companyAddress ?? ''} onChange={e => handleProfileInputChange('companyAddress', e.target.value)} />
                        </div>
                        <div className="space-y-2">
                            <Label>GSTIN</Label>
                            <Input value={profile.companyGstin ?? ''} onChange={e => handleProfileInputChange('companyGstin', e.target.value)} />
                        </div>
                        <div className="space-y-2">
                            <Label>PAN</Label>
                            <Input value={profile.companyPan ?? ''} onChange={e => handleProfileInputChange('companyPan', e.target.value)} />
                        </div>
                        <div className="space-y-2">
                            <Label>Phone</Label>
                            <Input value={profile.companyPhone ?? ''} onChange={e => handleProfileInputChange('companyPhone', e.target.value)} />
                        </div>
                        <div className="space-y-2">
                            <Label>Email</Label>
                            <Input value={profile.companyEmail ?? ''} onChange={e => handleProfileInputChange('companyEmail', e.target.value)} />
                        </div>
                    </AccordionContent>
                </AccordionItem>
                <AccordionItem value="item-2">
                    <AccordionTrigger>Invoice Numbering</AccordionTrigger>
                    <AccordionContent className="pt-4">
                        <div className="space-y-2">
                            <Label>Invoice Number Prefix</Label>
                            <Input value={profile.invoicePrefix ?? ''} onChange={e => handleProfileInputChange('invoicePrefix', e.target.value)} placeholder="e.g., INV-2024-" />
                            <p className='text-xs text-muted-foreground'>The invoice number will be this prefix followed by an auto-incrementing number.</p>
                        </div>
                    </AccordionContent>
                </AccordionItem>
                <AccordionItem value="item-3">
                    <AccordionTrigger>Bank Details</AccordionTrigger>
                    <AccordionContent className="grid md:grid-cols-2 gap-4 pt-4">
                        <div className="space-y-2"><Label>Beneficiary</Label><Input value={profile.bankBeneficiary ?? ''} onChange={e => handleProfileInputChange('bankBeneficiary', e.target.value)} /></div>
                        <div className="space-y-2"><Label>Bank Name</Label><Input value={profile.bankName ?? ''} onChange={e => handleProfileInputChange('bankName', e.target.value)} /></div>
                        <div className="space-y-2"><Label>Account Number</Label><Input value={profile.bankAccount ?? ''} onChange={e => handleProfileInputChange('bankAccount', e.target.value)} /></div>
                        <div className="space-y-2"><Label>IFSC Code</Label><Input value={profile.bankIfsc ?? ''} onChange={e => handleProfileInputChange('bankIfsc', e.target.value)} /></div>
                        <div className="space-y-2 md:col-span-2"><Label>Branch</Label><Input value={profile.bankBranch ?? ''} onChange={e => handleProfileInputChange('bankBranch', e.target.value)} /></div>
                    </AccordionContent>
                </AccordionItem>
                <AccordionItem value="item-4">
                    <AccordionTrigger>Company Logo (Header)</AccordionTrigger>
                    <AccordionContent className="pt-4">
                        <div className="space-y-4">
                            <div className='flex items-center gap-4'>
                                <div className='flex-1 space-y-2'>
                                    <Label>Upload Logo</Label>
                                    <Input type="file" ref={logoInputRef} onChange={e => handleFileChange(e, 'logo')} accept="image/png, image/jpeg" />
                                    <p className='text-xs text-muted-foreground'>This logo will appear in the top header of your invoices and quotations.</p>
                                </div>
                                {logoPreview && (
                                    <div className='relative w-24 h-24 border rounded-md p-2 bg-white flex items-center justify-center'>
                                        <img src={logoPreview} alt="Logo Preview" className="max-w-full max-h-full object-contain" />
                                        <Button
                                            variant="destructive"
                                            size="icon"
                                            className='absolute -top-2 -right-2 h-6 w-6 rounded-full'
                                            onClick={() => {
                                                setLogoPreview(null);
                                                handleProfileInputChange('logoUrl', '');
                                            }}
                                        >
                                            <Trash2 className='h-3 w-3' />
                                        </Button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </AccordionContent>
                </AccordionItem>
                <AccordionItem value="item-5">
                    <AccordionTrigger>Authorized Stamp (Footer)</AccordionTrigger>
                    <AccordionContent className="pt-4">
                        <div className="space-y-4">
                            <div className='flex items-center gap-4'>
                                <div className='flex-1 space-y-2'>
                                    <Label>Upload Stamp</Label>
                                    <Input type="file" ref={fileInputRef} onChange={e => handleFileChange(e, 'stamp')} accept="image/png, image/jpeg" />
                                    <p className='text-xs text-muted-foreground'>This will appear above the &quot;Authorized Signatory&quot; text in the footer.</p>
                                </div>
                                {stampPreview && (
                                    <div className='relative w-24 h-24 border rounded-md p-2 bg-white flex items-center justify-center'>
                                        <img src={stampPreview} alt="Stamp Preview" className="max-w-full max-h-full object-contain" />
                                        <Button
                                            variant="destructive"
                                            size="icon"
                                            className='absolute -top-2 -right-2 h-6 w-6 rounded-full'
                                            onClick={() => {
                                                setStampPreview(null);
                                                handleProfileInputChange('stampLogoUrl', '');
                                            }}
                                        >
                                            <Trash2 className='h-3 w-3' />
                                        </Button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </AccordionContent>
                </AccordionItem>
            </Accordion>
        );
    }


    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <Loader className="h-8 w-8 animate-spin" />
            </div>
        );
    }

    return (
        <AppShell>
            <main className="min-h-screen bg-background flex flex-col items-center p-4 sm:p-8">
                <div className="w-full max-w-6xl mx-auto">
                    <div className="flex items-center justify-between mb-8">
                        <div>
                            <Button variant="outline" asChild className="mb-4">
                                <Link href="/">
                                    <ArrowLeft className="mr-2 h-4 w-4" />
                                    Back to Create
                                </Link>
                            </Button>
                            <h1 className="text-3xl sm:text-4xl font-headline font-bold text-primary mt-4">Settings</h1>
                            <p className="text-muted-foreground text-sm sm:text-base">Manage your company profiles, invoice settings, and customer contacts.</p>
                        </div>
                    </div>

                    <Tabs defaultValue="company" className="w-full">
                    <TabsList className='mb-4'>
                        <TabsTrigger value="company">Company Profiles</TabsTrigger>
                        <TabsTrigger value="contacts">Contacts</TabsTrigger>
                        <TabsTrigger value="general">General</TabsTrigger>
                    </TabsList>
                    <TabsContent value="company">
                        <Card>
                            <CardHeader>
                                <CardTitle>Company Profiles</CardTitle>
                                <CardDescription>Manage the &quot;From&quot; details that appear on your invoices. You can create multiple profiles.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {settings.companyProfiles?.map(profile => (
                                    <Card key={profile.id} className="overflow-hidden">
                                        <CardHeader className="flex flex-row items-center justify-between bg-muted/30 p-4">
                                            <div className="font-bold">{profile.profileName}</div>
                                            <div className="flex items-center gap-1">
                                                <Button variant="ghost" size="icon" onClick={() => handleSetDefaultProfile(profile.id)} disabled={isSaving} title="Make Default">
                                                    <Star className={`h-5 w-5 ${settings.defaultCompanyProfile === profile.id ? 'text-yellow-500 fill-yellow-500' : 'text-gray-400'}`} />
                                                </Button>
                                                <Button variant="ghost" size="icon" onClick={() => handleEditProfileClick(profile)} disabled={isSaving}><Pencil className="h-4 w-4" /></Button>
                                                <Button variant="ghost" size="icon" onClick={() => handleDeleteProfile(profile.id)} disabled={isSaving}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                                            </div>
                                        </CardHeader>
                                    </Card>
                                ))}
                                {(!settings.companyProfiles || settings.companyProfiles.length === 0) && (
                                    <div className="text-center text-muted-foreground py-8">No company profiles created yet.</div>
                                )}
                            </CardContent>
                            <CardFooter>
                                <Button onClick={handleAddNewProfile} disabled={isSaving}>
                                    <PlusCircle className="mr-2 h-4 w-4" />
                                    Add New Profile
                                </Button>
                            </CardFooter>
                        </Card>
                    </TabsContent>
                    <TabsContent value="contacts">
                        <div className="grid md:grid-cols-2 gap-8">
                            {/* Bill To Section */}
                            <Card>
                                <CardHeader>
                                    <CardTitle>Manage &quot;Bill To&quot; Contacts</CardTitle>
                                    <CardDescription>Add, view, and remove billing contacts.</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="p-4 border rounded-lg space-y-4">
                                        <h3 className="font-bold">Add New &quot;Bill To&quot; Contact</h3>
                                        <div className="space-y-2">
                                            <Label htmlFor="billToDisplayName">Display Name (Unique)</Label>
                                            <Input id="billToDisplayName" placeholder="e.g., Main Client" value={newBillTo.displayName} onChange={e => handleInputChange('newBillTo', 'displayName', e.target.value)} />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="billToName">Name</Label>
                                            <Input id="billToName" placeholder="Client Company Name" value={newBillTo.name} onChange={e => handleInputChange('newBillTo', 'name', e.target.value)} />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="billToAddress">Address</Label>
                                            <Textarea id="billToAddress" placeholder="Client Address" value={newBillTo.address} onChange={e => handleInputChange('newBillTo', 'address', e.target.value)} />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="billToGst">GSTIN</Label>
                                            <Input id="billToGst" placeholder="Client GST Number" value={newBillTo.gst} onChange={e => handleInputChange('newBillTo', 'gst', e.target.value)} />
                                        </div>
                                        <Button onClick={() => handleAddContact('billTo')} disabled={isSaving} size="sm">
                                            {isSaving ? <Loader className="mr-2 h-4 w-4 animate-spin" /> : <PlusCircle className="mr-2 h-4 w-4" />} Add Bill To
                                        </Button>
                                    </div>
                                    <div className="space-y-2">
                                        <h3 className="font-bold">Saved &quot;Bill To&quot; Contacts</h3>
                                        <div className="rounded-md border overflow-x-auto">
                                            <Table>
                                                <TableHeader>
                                                    <TableRow>
                                                        <TableHead>Display Name</TableHead>
                                                        <TableHead>Name</TableHead>
                                                        <TableHead className="text-right">Actions</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {(!settings.billToContacts || settings.billToContacts.length === 0) && <TableRow><TableCell colSpan={3} className="text-center h-24">No contacts saved.</TableCell></TableRow>}
                                                    {settings.billToContacts && settings.billToContacts.map((c, index) => (
                                                        <TableRow key={`${c.id}-${index}`}>
                                                            <TableCell className="font-medium">{c.displayName}</TableCell>
                                                            <TableCell>{c.name}</TableCell>
                                                            <TableCell className="text-right">
                                                                <Button variant="ghost" size="icon" onClick={() => handleSetDefaultContact('billTo', c.id)} disabled={isSaving} title="Make Default">
                                                                    <Star className={`h-4 w-4 ${settings.defaultBillToContact === c.id ? 'text-yellow-500 fill-yellow-500' : 'text-gray-400'}`} />
                                                                </Button>
                                                                <Button variant="ghost" size="icon" onClick={() => handleEditContactClick(c, 'billTo')} disabled={isSaving}><Pencil className="h-4 w-4" /></Button>
                                                                <Button variant="ghost" size="icon" onClick={() => handleDeleteContact('billTo', c.id)} disabled={isSaving}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                                                            </TableCell>
                                                        </TableRow>
                                                    ))}
                                                </TableBody>
                                            </Table>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Ship To Section */}
                            <Card>
                                <CardHeader>
                                    <CardTitle>Manage &quot;Ship To&quot; Contacts</CardTitle>
                                    <CardDescription>Add, view, and remove shipping contacts.</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="p-4 border rounded-lg space-y-4">
                                        <h3 className="font-bold">Add New &quot;Ship To&quot; Contact</h3>
                                        <div className="space-y-2">
                                            <Label htmlFor="shipToDisplayName">Display Name (Unique)</Label>
                                            <Input id="shipToDisplayName" placeholder="e.g., Warehouse" value={newShipTo.displayName} onChange={e => handleInputChange('newShipTo', 'displayName', e.target.value)} />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="shipToName">Name</Label>
                                            <Input id="shipToName" placeholder="Shipping Location Name" value={newShipTo.name} onChange={e => handleInputChange('newShipTo', 'name', e.target.value)} />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="shipToAddress">Address</Label>
                                            <Textarea id="shipToAddress" placeholder="Shipping Address" value={newShipTo.address} onChange={e => handleInputChange('newShipTo', 'address', e.target.value)} />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="shipToGst">GSTIN</Label>
                                            <Input id="shipToGst" placeholder="Shipping GSTIN" value={newShipTo.gst} onChange={e => handleInputChange('newShipTo', 'gst', e.target.value)} />
                                        </div>
                                        {renderTaxesSelector('newShipTo', newShipTo)}
                                        <Button onClick={() => handleAddContact('shipTo')} disabled={isSaving} size="sm">
                                            {isSaving ? <Loader className="mr-2 h-4 w-4 animate-spin" /> : <PlusCircle className="mr-2 h-4 w-4" />} Add Ship To
                                        </Button>
                                    </div>
                                    <div className="space-y-2">
                                        <h3 className="font-bold">Saved &quot;Ship To&quot; Contacts</h3>
                                        <div className="rounded-md border overflow-x-auto">
                                            <Table>
                                                <TableHeader>
                                                    <TableRow>
                                                        <TableHead>Display Name</TableHead>
                                                        <TableHead>Name</TableHead>
                                                        <TableHead className="text-right">Actions</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {(!settings.shipToContacts || settings.shipToContacts.length === 0) && <TableRow><TableCell colSpan={3} className="text-center h-24">No contacts saved.</TableCell></TableRow>}
                                                    {settings.shipToContacts && settings.shipToContacts.map((c, index) => (
                                                        <TableRow key={`${c.id}-${index}`}>
                                                            <TableCell className="font-medium">{c.displayName}</TableCell>
                                                            <TableCell>{c.name}</TableCell>
                                                            <TableCell className="text-right">
                                                                <Button variant="ghost" size="icon" onClick={() => handleSetDefaultContact('shipTo', c.id)} disabled={isSaving} title="Make Default">
                                                                    <Star className={`h-4 w-4 ${settings.defaultShipToContact === c.id ? 'text-yellow-500 fill-yellow-500' : 'text-gray-400'}`} />
                                                                </Button>
                                                                <Button variant="ghost" size="icon" onClick={() => handleEditContactClick(c, 'shipTo')} disabled={isSaving}><Pencil className="h-4 w-4" /></Button>
                                                                <Button variant="ghost" size="icon" onClick={() => handleDeleteContact('shipTo', c.id)} disabled={isSaving}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                                                            </TableCell>
                                                        </TableRow>
                                                    ))}
                                                </TableBody>
                                            </Table>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    </TabsContent>
                    <TabsContent value="general">
                        <Card>
                            <CardHeader>
                                <CardTitle>General Preferences</CardTitle>
                                <CardDescription>Manage global settings like currency and locale.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                <div className="grid md:grid-cols-2 gap-8">
                                    <div className="space-y-4">
                                        <div className="space-y-2">
                                            <Label>Currency</Label>
                                            <Select
                                                value={settings.currency || 'INR'}
                                                onValueChange={(val) => {
                                                    const symbol = val === 'USD' ? '$' : val === 'EUR' ? '€' : val === 'GBP' ? '£' : '₹';
                                                    handleSaveGeneralSettings({ currency: val, currencySymbol: symbol });
                                                }}
                                            >
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Select currency" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="INR">Indian Rupee (₹)</SelectItem>
                                                    <SelectItem value="USD">US Dollar ($)</SelectItem>
                                                    <SelectItem value="EUR">Euro (€)</SelectItem>
                                                    <SelectItem value="GBP">British Pound (£)</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        <div className="space-y-2">
                                            <Label>PDF Template</Label>
                                            <Select
                                                value={settings.pdfTemplate || 'classic'}
                                                onValueChange={(val) => handleSaveGeneralSettings({ pdfTemplate: val })}
                                            >
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Select template" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="classic">Classic (Traditional)</SelectItem>
                                                    <SelectItem value="modern">Modern (Professional)</SelectItem>
                                                    <SelectItem value="minimal">Minimal (Clean)</SelectItem>
                                                </SelectContent>
                                            </Select>
                                            <p className='text-xs text-muted-foreground'>Choose the layout for your generated invoices.</p>
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        <div className="space-y-2">
                                            <Label>Brand Color</Label>
                                            <div className='flex flex-wrap gap-2 mb-4'>
                                                {['#3b82f6', '#10b981', '#ef4444', '#f59e0b', '#8b5cf6', '#000000'].map(color => (
                                                    <button
                                                        key={color}
                                                        className={`w-8 h-8 rounded-full border-2 transition-all ${settings.primaryColor === color ? 'border-primary scale-110 shadow-md' : 'border-transparent'}`}
                                                        style={{ backgroundColor: color }}
                                                        onClick={() => handleSaveGeneralSettings({ primaryColor: color })}
                                                    />
                                                ))}
                                            </div>
                                            <div className='flex items-center gap-2'>
                                                <Input
                                                    type="text"
                                                    value={settings.primaryColor || '#3b82f6'}
                                                    onChange={e => setSettings(prev => ({ ...prev, primaryColor: e.target.value }))}
                                                    className='w-32 font-mono h-8'
                                                />
                                                <Button
                                                    size="sm"
                                                    variant="secondary"
                                                    onClick={() => handleSaveGeneralSettings({ primaryColor: settings.primaryColor })}
                                                    className='h-8'
                                                >
                                                    Apply
                                                </Button>
                                            </div>
                                            <p className='text-xs text-muted-foreground mt-2'>This color will be used for headings and accents in &apos;Modern&apos; template.</p>
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>
                </Tabs>

            </div>
            {/* Edit Profile Dialog */}
            {editingProfile && (
                <Dialog open={isProfileEditDialogOpen} onOpenChange={setIsProfileEditDialogOpen}>
                    <DialogContent className="max-w-3xl">
                        <DialogHeader>
                            <DialogTitle>{editingProfile.id ? 'Edit' : 'Add New'} Company Profile</DialogTitle>
                        </DialogHeader>
                        <div className="max-h-[70vh] overflow-y-auto p-1">
                            {renderProfileForm(editingProfile)}
                        </div>
                        <DialogFooter>
                            <DialogClose asChild><Button variant="outline" onClick={() => setEditingProfile(null)}>Cancel</Button></DialogClose>
                            <Button onClick={handleSaveProfile} disabled={isSaving}>
                                {isSaving ? <Loader className="mr-2 h-4 w-4 animate-spin" /> : 'Save Profile'}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            )}

            {/* Edit Contact Dialog */}
            {editingContact && (
                <Dialog open={isContactEditDialogOpen} onOpenChange={setIsContactEditDialogOpen}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Edit {editingContactType === 'billTo' ? 'Bill To' : 'Ship To'} Contact</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                            <div className="space-y-2">
                                <Label htmlFor="editDisplayName">Display Name</Label>
                                <Input id="editDisplayName" value={editingContact.displayName} onChange={e => handleInputChange('editContact', 'displayName', e.target.value)} />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="editName">Name</Label>
                                <Input id="editName" value={editingContact.name} onChange={e => handleInputChange('editContact', 'name', e.target.value)} />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="editAddress">Address</Label>
                                <Textarea id="editAddress" value={editingContact.address} onChange={e => handleInputChange('editContact', 'address', e.target.value)} />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="editGst">GSTIN</Label>
                                <Input id="editGst" value={editingContact.gst} onChange={e => handleInputChange('editContact', 'gst', e.target.value)} />
                            </div>
                            {editingContactType === 'shipTo' && renderTaxesSelector('editContact', editingContact)}
                        </div>
                        <DialogFooter>
                            <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
                            <Button onClick={handleUpdateContact} disabled={isSaving}>
                                {isSaving ? <Loader className="mr-2 h-4 w-4 animate-spin" /> : 'Save Changes'}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            )}
            </main>
        </AppShell>
    );
}
