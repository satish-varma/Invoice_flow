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
import { generateAndSavePdf } from '@/lib/pdf';
import { DeclarationPreview } from './declaration-preview';
import { Download, Loader2, Sparkles, FileText } from 'lucide-react';
import { triggerHaptic } from '@/lib/haptics';

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
      await generateAndSavePdf(previewRef.current, filename);
    } catch (error) {
      console.error('Failed to export PDF:', error);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="grid lg:grid-cols-[420px_1fr] gap-6 items-start">
      <div className="rounded-2xl sm:rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-[0_4px_16px_-4px_rgba(0,0,0,0.06)] overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-teal-50 dark:bg-teal-950/40 border border-teal-200/60 dark:border-teal-800/40 flex items-center justify-center text-teal-600 dark:text-teal-400">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                Declaration Details
              </h2>
              <p className="text-xs text-slate-500">Fill details or select a preset</p>
            </div>
          </div>
        </div>

        <div className="p-4 sm:p-5 space-y-4">
          <div className="space-y-1.5 pb-4 border-b border-slate-100 dark:border-slate-800">
            <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">Load Preset</Label>
            <Select onValueChange={(val) => { triggerHaptic('light'); handlePresetChange(val); }} defaultValue="gut_guru">
              <SelectTrigger className="h-11 rounded-2xl text-sm">
                <SelectValue placeholder="Select a preset..." />
              </SelectTrigger>
              <SelectContent className="rounded-2xl">
                <SelectItem value="gut_guru">The Gut Guru</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-3">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-500">Vendor Info</h3>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">Vendor Name</Label>
              <Input {...form.register('vendorName')} placeholder="Company Name" className="h-11 rounded-2xl text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">Address</Label>
              <Input {...form.register('address')} placeholder="Full Address" className="h-11 rounded-2xl text-sm" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">Phone</Label>
                <Input {...form.register('phone')} className="h-11 rounded-2xl text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">Email</Label>
                <Input {...form.register('email')} className="h-11 rounded-2xl text-sm" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">Website</Label>
              <Input {...form.register('website')} className="h-11 rounded-2xl text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">GSTIN</Label>
              <Input {...form.register('gstin')} placeholder="GST No or 'Applied for'" className="h-11 rounded-2xl text-sm font-mono" />
            </div>
          </div>

          <div className="space-y-3 pt-3 border-t border-slate-100 dark:border-slate-800">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-500">Document Meta</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">Date</Label>
                <Input type="date" {...form.register('date')} className="h-11 rounded-2xl text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">Place</Label>
                <Input {...form.register('place')} className="h-11 rounded-2xl text-sm" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">Ref No</Label>
                <Input {...form.register('refNo')} className="h-11 rounded-2xl text-sm font-mono" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">Financial Year</Label>
                <Input {...form.register('financialYear')} placeholder="2026-27" className="h-11 rounded-2xl text-sm" />
              </div>
            </div>
          </div>
          
          <div className="space-y-3 pt-3 border-t border-slate-100 dark:border-slate-800">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-500">Declaration Text</h3>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">Text Content</Label>
              <Textarea 
                {...form.register('declarationText')} 
                className="h-28 font-mono text-xs rounded-2xl resize-none" 
              />
            </div>
          </div>

          <div className="space-y-3 pt-3 border-t border-slate-100 dark:border-slate-800">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-500">Signatory</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">Name</Label>
                <Input {...form.register('personName')} className="h-11 rounded-2xl text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">Designation</Label>
                <Input {...form.register('designation')} className="h-11 rounded-2xl text-sm" />
              </div>
            </div>
          </div>
        </div>

        <div className="p-4 sm:p-5 bg-slate-50/80 dark:bg-slate-800/40 border-t border-slate-100 dark:border-slate-800">
          <button
            type="button"
            onClick={() => {
              triggerHaptic('light');
              handleDownload();
            }}
            disabled={isExporting}
            className="w-full h-12 rounded-2xl bg-gradient-to-r from-teal-600 to-cyan-600 text-white font-bold text-sm shadow-md active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2 transition-all"
          >
            {isExporting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            <span>Download Declaration PDF</span>
          </button>
        </div>
      </div>

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
