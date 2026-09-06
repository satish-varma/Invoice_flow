'use client';

import { useState, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { exportToPdf } from '@/lib/pdf';
import { DeclarationPreview } from './declaration-preview';
import { Download, Loader2 } from 'lucide-react';

export const declarationSchema = z.object({
  vendorName: z.string().min(1, 'Vendor name is required'),
  address: z.string().min(1, 'Address is required'),
  phone: z.string().optional(),
  email: z.string().optional(),
  website: z.string().optional(),
  gstin: z.string().min(1, 'GSTIN or status is required'),
  refNo: z.string().optional(),
  date: z.string().min(1, 'Date is required'),
  place: z.string().min(1, 'Place is required'),
  financialYear: z.string().min(1, 'Financial Year is required'),
  personName: z.string().min(1, 'Person Name is required'),
  designation: z.string().min(1, 'Designation is required'),
  declarationText: z.string().min(1, 'Declaration text is required'),
});

export type DeclarationData = z.infer<typeof declarationSchema>;

const PRESETS: Record<string, Partial<DeclarationData>> = {
  gut_guru: {
    vendorName: 'The Gut Guru.',
    address: 'H NO.6-46/3/A, VENKATESWARA NAGAR, Chanda Nagar, Hyderabad, Telangana, 500050',
    phone: '+91 7700832898',
    email: 'thegutguru.in@gmail.com',
    website: 'www.thegutguru.in',
    gstin: '36DDTPJ6536D1Z8',
    refNo: 'TGG/2026/06532',
    place: 'Hyderabad',
    financialYear: '2026-27',
    personName: 'CHEMARTHI JYOSNA',
    designation: 'Proprieter',
    declarationText: `We, {vendorName}, located at {address}, hereby confirm that we are not registered under GST as we are exempted from GST registration considering our supply of services turnover for the FY {financialYear} is less than the minimum registration turnover limit of Rs. 40 lacs set out under the GST Act.

We hereby further confirm that no TCS should be deducted on the payments made to us for the supply of services made on the EatGood Technologies Pvt. Ltd. (HungerBox) platform.

We hereby agree and confirm that in case any authority makes a demand to pay GST amount, then we alone will be responsible to make payment towards the applicable GST, Interest, Penalty, etc. related to the supply made by us in each such case, without recourse to EatGood Technologies Pvt. Ltd. (Hungerbox).

We hereby agree and confirm that:
1. I / We declare that I am empowered to execute this undertaking and the same is given under the orders of proper authority as per the delegation of power of the organization.`,
  }
};

export function DeclarationForm() {
  const [isExporting, setIsExporting] = useState(false);
  const previewRef = useRef<HTMLDivElement>(null);
  
  const defaultDate = new Date().toISOString().split('T')[0];

  const form = useForm<DeclarationData>({
    resolver: zodResolver(declarationSchema),
    defaultValues: {
      date: defaultDate,
      financialYear: '2026-27',
      ...PRESETS.gut_guru, // Default to Gut Guru
    },
  });

  const handlePresetChange = (value: string) => {
    if (value && PRESETS[value]) {
      const preset = PRESETS[value];
      Object.entries(preset).forEach(([key, val]) => {
        form.setValue(key as keyof DeclarationData, val as string);
      });
    }
  };

  const handleDownload = async () => {
    const isValid = await form.trigger();
    if (!isValid || !previewRef.current) return;
    
    setIsExporting(true);
    const data = form.getValues();
    const filename = `Declaration_${data.vendorName.replace(/[^a-zA-Z0-9]/g, '_')}_${data.date}.pdf`;
    
    try {
      await exportToPdf(previewRef.current, filename);
    } catch (error) {
      console.error('Failed to export PDF:', error);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="grid lg:grid-cols-[400px_1fr] gap-6 items-start">
      <Card>
        <CardHeader className="pb-4 border-b">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">Declaration Details</CardTitle>
              <CardDescription>Fill details or use a preset</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-4 space-y-4">
          <div className="space-y-2 pb-4 border-b">
            <Label>Load Preset</Label>
            <Select onValueChange={handlePresetChange} defaultValue="gut_guru">
              <SelectTrigger>
                <SelectValue placeholder="Select a preset..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="gut_guru">The Gut Guru</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-gray-900">Vendor Info</h3>
            <div className="grid gap-2">
              <Label>Vendor Name</Label>
              <Input {...form.register('vendorName')} placeholder="Company Name" />
            </div>
            <div className="grid gap-2">
              <Label>Address</Label>
              <Input {...form.register('address')} placeholder="Full Address" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label>Phone (opt)</Label>
                <Input {...form.register('phone')} />
              </div>
              <div className="grid gap-2">
                <Label>Email (opt)</Label>
                <Input {...form.register('email')} />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Website (opt)</Label>
              <Input {...form.register('website')} />
            </div>
            <div className="grid gap-2">
              <Label>GSTIN</Label>
              <Input {...form.register('gstin')} placeholder="GST No or 'Applied for'" />
            </div>
          </div>

          <div className="space-y-3 pt-3 border-t">
            <h3 className="text-sm font-semibold text-gray-900">Document Meta</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label>Date</Label>
                <Input type="date" {...form.register('date')} />
              </div>
              <div className="grid gap-2">
                <Label>Place</Label>
                <Input {...form.register('place')} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label>Ref No (opt)</Label>
                <Input {...form.register('refNo')} />
              </div>
              <div className="grid gap-2">
                <Label>Financial Year</Label>
                <Input {...form.register('financialYear')} placeholder="2026-27" />
              </div>
            </div>
          </div>
          
          <div className="space-y-3 pt-3 border-t">
            <h3 className="text-sm font-semibold text-gray-900">Declaration Text</h3>
            <div className="grid gap-2">
              <Label>Text (Supports basic dynamic fields like {'{vendorName}'})</Label>
              <Textarea 
                {...form.register('declarationText')} 
                className="h-32 font-mono text-xs" 
              />
            </div>
          </div>

          <div className="space-y-3 pt-3 border-t">
            <h3 className="text-sm font-semibold text-gray-900">Signatory</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label>Name</Label>
                <Input {...form.register('personName')} />
              </div>
              <div className="grid gap-2">
                <Label>Designation</Label>
                <Input {...form.register('designation')} />
              </div>
            </div>
          </div>
        </CardContent>
        <CardFooter className="bg-gray-50 border-t p-4">
          <Button onClick={handleDownload} disabled={isExporting} className="w-full">
            {isExporting ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Download className="w-4 h-4 mr-2" />
            )}
            Download PDF
          </Button>
        </CardFooter>
      </Card>

      {/* Preview Section */}
      <div className="sticky top-20">
        <div className="bg-gray-200 p-4 rounded-xl shadow-inner overflow-hidden border border-gray-300">
          <div className="mb-2 flex justify-between items-center text-sm text-gray-500 font-medium">
            <span>A4 Document Preview</span>
          </div>
          {/* Scrollable container for preview */}
          <div className="overflow-auto max-h-[calc(100vh-140px)] rounded shadow-sm bg-white border border-gray-200 flex justify-center">
             <div className="scale-[0.6] sm:scale-75 md:scale-90 lg:scale-[0.8] xl:scale-90 origin-top flex-shrink-0">
               <DeclarationPreview data={form.watch()} ref={previewRef} />
             </div>
          </div>
        </div>
      </div>
    </div>
  );
}
