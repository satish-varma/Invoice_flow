
'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { getSettings, saveSettings, Settings } from '@/services/settingsService';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Loader, Save } from 'lucide-react';
import Link from 'next/link';

export default function SettingsPage() {
    const [settings, setSettings] = useState<Settings>({
        billToName: '',
        billToAddress: '',
        billToGst: '',
        shipToName: '',
        shipToAddress: '',
        shipToGst: '',
    });
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
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
                        <p className="text-muted-foreground">Manage your default invoice information.</p>
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
                         <CardFooter>
                            <p className="text-xs text-muted-foreground">This information will be used to pre-fill the "Bill To" and "Ship To" sections when you create a new invoice.</p>
                         </CardFooter>
                    </Card>
                </div>
            </div>
        </main>
    );
}
