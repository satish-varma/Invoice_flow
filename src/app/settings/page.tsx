
'use client';

import React, { useState, useEffect, useCallback } from 'react';
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
    BillToContact,
    ShipToContact,
    Settings,
} from '@/services/settingsService';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Loader, PlusCircle, Pencil, Trash2, Star } from 'lucide-react';
import Link from 'next/link';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog';


type ContactType = 'billTo' | 'shipTo';

export default function SettingsPage() {
    const [settings, setSettings] = useState<Settings>({ billToContacts: [], shipToContacts: [] });
    
    const [newBillTo, setNewBillTo] = useState<Omit<BillToContact, 'id'>>({ displayName: '', name: '', address: '', gst: '' });
    const [newShipTo, setNewShipTo] = useState<Omit<ShipToContact, 'id'>>({ displayName: '', name: '', address: '', gst: '' });
    
    const [editingContact, setEditingContact] = useState<BillToContact | ShipToContact | null>(null);
    const [editingContactType, setEditingContactType] = useState<ContactType | null>(null);
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);


    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const { toast } = useToast();

    const loadSettings = useCallback(async () => {
        setIsLoading(true);
        const loadedSettings = await getSettings();
        setSettings(loadedSettings);
        setIsLoading(false);
    }, []);

    useEffect(() => {
        loadSettings();
    }, [loadSettings]);

    const handleInputChange = (form: 'newBillTo' | 'newShipTo' | 'edit', field: string, value: string) => {
        if (form === 'newBillTo') {
            setNewBillTo(prev => ({ ...prev, [field]: value }));
        } else if (form === 'newShipTo') {
            setNewShipTo(prev => ({ ...prev, [field]: value }));
        } else {
            setEditingContact(prev => prev ? { ...prev, [field]: value } : null);
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
                setNewBillTo({ displayName: '', name: '', address: '', gst: '' });
            } else {
                await saveShipToContact(contactData);
                setNewShipTo({ displayName: '', name: '', address: '', gst: '' });
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

    const handleEditClick = (contact: BillToContact | ShipToContact, type: ContactType) => {
        setEditingContact(JSON.parse(JSON.stringify(contact))); // Deep copy to avoid state mutation issues
        setEditingContactType(type);
        setIsEditDialogOpen(true);
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
            setIsEditDialogOpen(false);
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

    const handleSetDefault = async (type: ContactType, id: string) => {
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


    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <Loader className="h-8 w-8 animate-spin" />
            </div>
        );
    }

    return (
        <main className="min-h-screen bg-background flex flex-col items-center p-4 sm:p-8">
            <div className="w-full max-w-6xl mx-auto">
                <div className="flex items-center justify-between mb-8">
                    <div>
                         <Button variant="outline" asChild>
                            <Link href="/">
                                <ArrowLeft className="mr-2 h-4 w-4" />
                                Back to Create
                            </Link>
                        </Button>
                        <h1 className="text-4xl font-headline font-bold text-primary mt-4">Settings</h1>
                        <p className="text-muted-foreground">Manage your saved "Bill To" and "Ship To" contacts and set defaults.</p>
                    </div>
                </div>

                <div className="grid md:grid-cols-2 gap-8">
                    {/* Bill To Section */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Manage "Bill To" Contacts</CardTitle>
                            <CardDescription>Add, view, and remove billing contacts.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="p-4 border rounded-lg space-y-4">
                               <h3 className="font-bold">Add New "Bill To" Contact</h3>
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
                                    <Label htmlFor="billToGst">GST No.</Label>
                                    <Input id="billToGst" placeholder="Client GST Number" value={newBillTo.gst} onChange={e => handleInputChange('newBillTo', 'gst', e.target.value)} />
                                </div>
                                <Button onClick={() => handleAddContact('billTo')} disabled={isSaving} size="sm">
                                    {isSaving ? <Loader className="mr-2 h-4 w-4 animate-spin" /> : <PlusCircle className="mr-2 h-4 w-4" />} Add Bill To
                                </Button>
                            </div>
                             <div className="space-y-2">
                                <h3 className="font-bold">Saved "Bill To" Contacts</h3>
                                <div className="rounded-md border">
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
                                                        <Button variant="ghost" size="icon" onClick={() => handleSetDefault('billTo', c.id)} disabled={isSaving} title="Make Default">
                                                            <Star className={`h-4 w-4 ${settings.defaultBillToContact === c.id ? 'text-yellow-500 fill-yellow-500' : 'text-gray-400'}`} />
                                                        </Button>
                                                        <Button variant="ghost" size="icon" onClick={() => handleEditClick(c, 'billTo')} disabled={isSaving}><Pencil className="h-4 w-4" /></Button>
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
                            <CardTitle>Manage "Ship To" Contacts</CardTitle>
                            <CardDescription>Add, view, and remove shipping contacts.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                             <div className="p-4 border rounded-lg space-y-4">
                               <h3 className="font-bold">Add New "Ship To" Contact</h3>
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
                                <Button onClick={() => handleAddContact('shipTo')} disabled={isSaving} size="sm">
                                    {isSaving ? <Loader className="mr-2 h-4 w-4 animate-spin" /> : <PlusCircle className="mr-2 h-4 w-4" />} Add Ship To
                                </Button>
                            </div>
                            <div className="space-y-2">
                                <h3 className="font-bold">Saved "Ship To" Contacts</h3>
                                <div className="rounded-md border">
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
                                                         <Button variant="ghost" size="icon" onClick={() => handleSetDefault('shipTo', c.id)} disabled={isSaving} title="Make Default">
                                                            <Star className={`h-4 w-4 ${settings.defaultShipToContact === c.id ? 'text-yellow-500 fill-yellow-500' : 'text-gray-400'}`} />
                                                        </Button>
                                                        <Button variant="ghost" size="icon" onClick={() => handleEditClick(c, 'shipTo')} disabled={isSaving}><Pencil className="h-4 w-4" /></Button>
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
            </div>
            {editingContact && (
                <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Edit {editingContactType === 'billTo' ? 'Bill To' : 'Ship To'} Contact</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                            <div className="space-y-2">
                                <Label htmlFor="editDisplayName">Display Name</Label>
                                <Input id="editDisplayName" value={editingContact.displayName} onChange={e => handleInputChange('edit', 'displayName', e.target.value)} />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="editName">Name</Label>
                                <Input id="editName" value={editingContact.name} onChange={e => handleInputChange('edit', 'name', e.target.value)} />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="editAddress">Address</Label>
                                <Textarea id="editAddress" value={editingContact.address} onChange={e => handleInputChange('edit', 'address', e.target.value)} />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="editGst">GST No.</Label>
                                <Input id="editGst" value={editingContact.gst} onChange={e => handleInputChange('edit', 'gst', e.target.value)} />
                            </div>
                        </div>
                        <DialogFooter>
                            <DialogClose asChild><Button variant="outline" onClick={() => setEditingContact(null)}>Cancel</Button></DialogClose>
                            <Button onClick={handleUpdateContact} disabled={isSaving}>
                                {isSaving ? <Loader className="mr-2 h-4 w-4 animate-spin" /> : 'Save Changes'}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            )}
        </main>
    );
}
