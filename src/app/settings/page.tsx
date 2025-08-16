
'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { getSettings, saveSettings, Settings } from '@/services/settingsService';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Loader, Save, Trash2, Upload } from 'lucide-react';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import Image from 'next/image';
import Link from 'next/link';

function fileToDataUri(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

export default function SettingsPage() {
    const [settings, setSettings] = useState<Settings>({
        billToName: '',
        billToAddress: '',
        billToGst: '',
        shipToName: '',
        shipToAddress: '',
        shipToGst: '',
        signatures: [],
        defaultSignatureId: '',
    });
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const signatureInputRef = useRef<HTMLInputElement>(null);
    const { toast } = useToast();

    useEffect(() => {
        async function loadSettings() {
            setIsLoading(true);
            const loadedSettings = await getSettings();
            if (loadedSettings) {
                setSettings(loadedSettings);
            }
            setIsLoading(false);
        }
        loadSettings();
    }, []);

    const handleInputChange = (field: keyof Settings, value: string) => {
        setSettings(prev => ({ ...prev, [field]: value }));
    };
    
    const handleSignatureUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        try {
            const dataUri = await fileToDataUri(file);
            const newSignature = {
                id: `sig_${Date.now()}`,
                name: file.name,
                url: dataUri,
            };
            const updatedSignatures = [...(settings.signatures || []), newSignature];
            setSettings(prev => ({ ...prev, signatures: updatedSignatures }));
            
            // If it's the first signature, set it as default
            if (updatedSignatures.length === 1) {
                handleInputChange('defaultSignatureId', newSignature.id);
            }

            toast({ title: "Signature Uploaded", description: "Remember to save your changes." });

        } catch (error) {
            console.error("Failed to upload signature:", error);
            toast({ variant: "destructive", title: "Upload Failed", description: "Could not process the signature file." });
        } finally {
            if (signatureInputRef.current) {
                signatureInputRef.current.value = '';
            }
        }
    };
    
    const handleRemoveSignature = (id: string) => {
        const updatedSignatures = settings.signatures?.filter(sig => sig.id !== id) || [];
        const isDefaultRemoved = settings.defaultSignatureId === id;

        setSettings(prev => ({
            ...prev,
            signatures: updatedSignatures,
            // If the default signature was removed, reset it.
            defaultSignatureId: isDefaultRemoved ? (updatedSignatures[0]?.id || '') : prev.defaultSignatureId,
        }));
    }

    const handleSaveChanges = async () => {
        setIsSaving(true);
        try {
            await saveSettings(settings);
            toast({ title: "Settings Saved", description: "Your default settings have been updated." });
        } catch (error) {
            console.error("Failed to save settings:", error);
            toast({ variant: "destructive", title: "Save Failed", description: "Could not save your settings. Please try again." });
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <Loader className="h-8 w-8 animate-spin" />
            </div>
        );
    }

    return (
        <main className="min-h-screen bg-background flex flex-col items-center p-4 sm:p-8">
            <div className="w-full max-w-4xl mx-auto">
                <div className="flex items-center justify-between mb-8">
                    <div>
                         <Button variant="outline" asChild>
                            <Link href="/">
                                <ArrowLeft className="mr-2 h-4 w-4" />
                                Back to Create
                            </Link>
                        </Button>
                        <h1 className="text-4xl font-headline font-bold text-primary mt-4">Settings</h1>
                        <p className="text-muted-foreground">Manage your default invoice information and signatures.</p>
                    </div>
                     <Button onClick={handleSaveChanges} disabled={isSaving}>
                        {isSaving ? <><Loader className="mr-2 h-4 w-4 animate-spin" /> Saving...</> : <><Save className="mr-2 h-4 w-4" /> Save Changes</>}
                    </Button>
                </div>

                <div className="grid gap-8">
                    <Card>
                        <CardHeader>
                            <CardTitle>Default "Bill To" & "Ship To" Information</CardTitle>
                            <CardDescription>This information will be used to pre-fill new invoices.</CardDescription>
                        </CardHeader>
                        <CardContent className="grid md:grid-cols-2 gap-8">
                            <div className="space-y-4">
                                <h3 className="font-bold text-lg">Bill To Details</h3>
                                <div className="space-y-2">
                                    <Label htmlFor="billToName">Name</Label>
                                    <Input id="billToName" value={settings.billToName} onChange={e => handleInputChange('billToName', e.target.value)} />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="billToAddress">Address</Label>
                                    <Textarea id="billToAddress" value={settings.billToAddress} onChange={e => handleInputChange('billToAddress', e.target.value)} />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="billToGst">GST No.</Label>
                                    <Input id="billToGst" value={settings.billToGst} onChange={e => handleInputChange('billToGst', e.target.value)} />
                                </div>
                            </div>
                            <div className="space-y-4">
                                <h3 className="font-bold text-lg">Ship To Details</h3>
                                <div className="space-y-2">
                                    <Label htmlFor="shipToName">Name</Label>
                                    <Input id="shipToName" value={settings.shipToName} onChange={e => handleInputChange('shipToName', e.target.value)} />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="shipToAddress">Address</Label>
                                    <Textarea id="shipToAddress" value={settings.shipToAddress} onChange={e => handleInputChange('shipToAddress', e.target.value)} />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="shipToGst">GSTIN</Label>
                                    <Input id="shipToGst" value={settings.shipToGst} onChange={e => handleInputChange('shipToGst', e.target.value)} />
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Signature Management</CardTitle>
                            <CardDescription>Upload your signatures and select a default for new invoices.</CardDescription>
                        </CardHeader>
                        <CardContent>
                             <input type="file" ref={signatureInputRef} onChange={handleSignatureUpload} className="hidden" accept="image/*" />
                             <Button variant="outline" onClick={() => signatureInputRef.current?.click()}><Upload className="mr-2 h-4 w-4" />Upload Signature</Button>
                        
                            {settings.signatures && settings.signatures.length > 0 && (
                                <div className="mt-6">
                                    <Label>Select Default Signature</Label>
                                     <RadioGroup
                                        value={settings.defaultSignatureId}
                                        onValueChange={(id) => handleInputChange('defaultSignatureId', id)}
                                        className="mt-2 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4"
                                    >
                                        {settings.signatures.map(sig => (
                                            <div key={sig.id} className="relative group">
                                                <Label htmlFor={sig.id} className="block border-2 rounded-md p-2 cursor-pointer has-[:checked]:border-primary">
                                                    <div className="flex items-center space-x-2">
                                                         <RadioGroupItem value={sig.id} id={sig.id} />
                                                        <div className="flex-grow">
                                                            <div className="bg-gray-100 rounded-md p-2 h-24 flex items-center justify-center">
                                                                <Image src={sig.url} alt={sig.name} width={120} height={40} className="object-contain max-h-full" />
                                                            </div>
                                                            <p className="text-sm font-normal mt-2 truncate" title={sig.name}>{sig.name}</p>
                                                        </div>
                                                    </div>
                                                </Label>
                                                <Button 
                                                    variant="destructive" 
                                                    size="icon" 
                                                    className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                                                    onClick={() => handleRemoveSignature(sig.id)}
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        ))}
                                    </RadioGroup>
                                </div>
                            )}
                        </CardContent>
                         <CardFooter>
                            <p className="text-xs text-muted-foreground">The default signature will appear on all newly created invoices and PDFs.</p>
                         </CardFooter>
                    </Card>
                </div>
            </div>
        </main>
    );
}
