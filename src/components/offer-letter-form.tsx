
'use client';

import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Save, FilePlus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { getSettings, Settings } from '@/services/settingsService';
import { saveOfferLetter, OfferLetter } from '@/services/offerLetterService';
import { Separator } from '@/components/ui/separator';

const formSchema = z.object({
  employeeName: z.string().min(2, 'Employee name is required'),
  employeeAddress: z.string().min(5, 'Address is required'),
  employeeEmail: z.string().email('Valid email is required'),
  position: z.string().min(2, 'Position is required'),
  offerDate: z.string().min(1, 'Offer date is required'),
  proposedStartDate: z.string().min(1, 'Proposed start date is required'),
  compensation: z.coerce.number().min(1, 'Compensation must be greater than 0'),
  probationPeriod: z.string().min(1, 'Probation period is required'),
  workHours: z.string().optional(),
  noticePeriodProbation: z.string().optional(),
  noticePeriodPostConfirmation: z.string().optional(),
  annualLeaves: z.coerce.number().optional(),
  customTerms: z.string().optional(),
  companyProfileId: z.string().min(1, 'Company profile is required'),
});

interface OfferLetterFormProps {
  initialData: OfferLetter | null;
  onOfferSave: (offer?: OfferLetter) => void;
  onAddNew: () => void;
}

export function OfferLetterForm({ initialData, onOfferSave, onAddNew }: OfferLetterFormProps) {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      employeeName: initialData?.employeeName || '',
      employeeAddress: initialData?.employeeAddress || '',
      employeeEmail: initialData?.employeeEmail || '',
      position: initialData?.position || '',
      offerDate: initialData?.offerDate ? new Date(initialData.offerDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
      proposedStartDate: initialData?.proposedStartDate ? new Date(initialData.proposedStartDate).toISOString().split('T')[0] : '',
      compensation: initialData?.compensation || 0,
      probationPeriod: initialData?.probationPeriod || '3 months',
      workHours: initialData?.workHours || '9:00 AM to 6:00 PM, 5 working days in a week',
      noticePeriodProbation: initialData?.noticePeriodProbation || '15 days',
      noticePeriodPostConfirmation: initialData?.noticePeriodPostConfirmation || '30 days',
      annualLeaves: initialData?.annualLeaves || 12,
      customTerms: initialData?.customTerms || '',
      companyProfileId: initialData?.companyProfileId || '',
    },
  });

  useEffect(() => {
    const fetchSettings = async () => {
      const s = await getSettings();
      setSettings(s);
      if (!initialData && s.defaultCompanyProfile) {
        form.setValue('companyProfileId', s.defaultCompanyProfile);
      }
    };
    fetchSettings();
  }, [initialData, form]);

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsSaving(true);
    try {
      const offerData = {
        ...values,
        id: initialData?.id,
      };

      const savedOffer = await saveOfferLetter(offerData);
      toast({ title: 'Offer Letter Saved', description: 'The offer letter has been successfully saved.' });
      onOfferSave(savedOffer);
    } catch (error) {
      console.error(error);
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to save offer letter.' });
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Card className="w-full">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <CardTitle className="text-xl font-bold text-primary">
          {initialData ? `Edit Offer: ${initialData.offerNumber}` : 'Create New Offer Letter'}
        </CardTitle>
        <Button variant="outline" size="sm" onClick={onAddNew}>
          <FilePlus className="mr-2 h-4 w-4" /> New
        </Button>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="companyProfileId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Company Profile</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select profile" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {settings?.companyProfiles?.map((profile) => (
                          <SelectItem key={profile.id} value={profile.id}>
                            {profile.profileName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="offerDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Offer Date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <Separator />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="employeeName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Candidate Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Full Name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

               <FormField
                control={form.control}
                name="employeeEmail"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Candidate Email</FormLabel>
                    <FormControl>
                      <Input placeholder="email@example.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="employeeAddress"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Residential Address</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Full address" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Separator />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="position"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Job Position</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. Software Engineer" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="proposedStartDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Proposed Start Date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="compensation"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Annual CTC (₹)</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="600000" {...field} value={field.value || ''} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="probationPeriod"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Probation Period</FormLabel>
                    <FormControl>
                      <Input placeholder="3 months" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <Separator />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="noticePeriodProbation"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notice Period (Probation)</FormLabel>
                    <FormControl>
                      <Input placeholder="15 days" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="noticePeriodPostConfirmation"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notice Period (Post Confirmation)</FormLabel>
                    <FormControl>
                      <Input placeholder="30 days" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                    control={form.control}
                    name="workHours"
                    render={({ field }) => (
                    <FormItem>
                        <FormLabel>Standard Work Hours/Days</FormLabel>
                        <FormControl>
                        <Input placeholder="9:00 AM to 6:00 PM..." {...field} />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="annualLeaves"
                    render={({ field }) => (
                    <FormItem>
                        <FormLabel>Annual Leaves</FormLabel>
                        <FormControl>
                        <Input type="number" {...field} value={field.value || ''} />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                    )}
                />
            </div>

            <FormField
              control={form.control}
              name="customTerms"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Other/Custom Terms</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Additional specific terms..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end pt-4">
              <Button type="submit" disabled={isSaving} className="w-full sm:w-auto">
                {isSaving ? 'Processing...' : <><Save className="mr-2 h-4 w-4" /> Save Offer Letter</>}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
