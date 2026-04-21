
'use client';

import React, { useState, useEffect } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Save, FilePlus, Plus, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { getSettings, Settings } from '@/services/settingsService';
import { savePayslip, Payslip } from '@/services/payslipService';
import { MONTH_NAMES } from '@/lib/payslipConstants';

const earningDeductionSchema = z.object({
    label: z.string().min(1, 'Required'),
    amount: z.coerce.number().min(0),
});

const formSchema = z.object({
    companyProfileId: z.string().min(1, 'Company profile required'),
    payPeriodMonth: z.coerce.number().min(1).max(12),
    payPeriodYear: z.coerce.number().min(2020).max(2100),
    payDate: z.string().min(1, 'Pay date required'),
    employeeName: z.string().min(2, 'Required'),
    employeeId: z.string().optional(),
    designation: z.string().min(1, 'Required'),
    department: z.string().optional(),
    bankAccount: z.string().optional(),
    panNumber: z.string().optional(),
    pfNumber: z.string().optional(),
    workingDays: z.coerce.number().min(1),
    paidDays: z.coerce.number().min(0),
    lopDays: z.coerce.number().min(0),
    earnings: z.array(earningDeductionSchema).min(1, 'At least one earning required'),
    deductions: z.array(earningDeductionSchema),
});

type FormValues = z.infer<typeof formSchema>;

interface PayslipFormProps {
    initialData: Payslip | null;
    onPayslipSave: (payslip?: Payslip) => void;
    onAddNew: () => void;
}

const defaultEarnings = [
    { label: 'Basic Salary', amount: 0 },
    { label: 'House Rent Allowance (HRA)', amount: 0 },
    { label: 'Conveyance Allowance', amount: 0 },
    { label: 'Special Allowance', amount: 0 },
];

const defaultDeductions = [
    { label: 'Provident Fund (PF)', amount: 0 },
    { label: 'Professional Tax', amount: 0 },
];

export function PayslipForm({ initialData, onPayslipSave, onAddNew }: PayslipFormProps) {
    const [settings, setSettings] = useState<Settings | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const { toast } = useToast();

    const now = new Date();
    const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    const form = useForm<FormValues>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            companyProfileId: initialData?.companyProfileId || '',
            payPeriodMonth: initialData?.payPeriodMonth || (prevMonth.getMonth() + 1),
            payPeriodYear: initialData?.payPeriodYear || prevMonth.getFullYear(),
            payDate: initialData?.payDate ? new Date(initialData.payDate).toISOString().split('T')[0] : now.toISOString().split('T')[0],
            employeeName: initialData?.employeeName || '',
            employeeId: initialData?.employeeId || '',
            designation: initialData?.designation || '',
            department: initialData?.department || '',
            bankAccount: initialData?.bankAccount || '',
            panNumber: initialData?.panNumber || '',
            pfNumber: initialData?.pfNumber || '',
            workingDays: initialData?.workingDays ?? 26,
            paidDays: initialData?.paidDays ?? 26,
            lopDays: initialData?.lopDays ?? 0,
            earnings: initialData?.earnings || defaultEarnings,
            deductions: initialData?.deductions || defaultDeductions,
        },
    });

    const earningsArray = useFieldArray({ control: form.control, name: 'earnings' });
    const deductionsArray = useFieldArray({ control: form.control, name: 'deductions' });

    const watchEarnings = form.watch('earnings');
    const watchDeductions = form.watch('deductions');

    const grossEarnings = watchEarnings.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
    const totalDeductions = watchDeductions.reduce((sum, d) => sum + (Number(d.amount) || 0), 0);
    const netPay = grossEarnings - totalDeductions;

    useEffect(() => {
        getSettings().then(s => {
            setSettings(s);
            if (!initialData && s.defaultCompanyProfile) {
                form.setValue('companyProfileId', s.defaultCompanyProfile);
            }
        });
    }, [initialData, form]);

    async function onSubmit(values: FormValues) {
        setIsSaving(true);
        try {
            const payload = {
                ...values,
                employeeId: values.employeeId || '',
                grossEarnings,
                totalDeductions,
                netPay,
                id: initialData?.id,
            };
            const saved = await savePayslip(payload);
            toast({ title: 'Payslip Saved' });
            onPayslipSave(saved);
        } catch (e) {
            toast({ variant: 'destructive', title: 'Error', description: 'Failed to save payslip.' });
        } finally {
            setIsSaving(false);
        }
    }

    return (
        <Card className="w-full">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                <CardTitle className="text-xl font-bold text-primary">
                    {initialData ? `Edit Payslip: ${initialData.payslipNumber}` : 'Generate Payslip'}
                </CardTitle>
                <Button variant="outline" size="sm" onClick={onAddNew}>
                    <FilePlus className="mr-2 h-4 w-4" /> New
                </Button>
            </CardHeader>
            <CardContent>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                        {/* Company & Period */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <FormField control={form.control} name="companyProfileId" render={({ field }) => (
                                <FormItem className="col-span-2">
                                    <FormLabel>Company Profile</FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value}>
                                        <FormControl><SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger></FormControl>
                                        <SelectContent>
                                            {settings?.companyProfiles?.map(p => (
                                                <SelectItem key={p.id} value={p.id}>{p.profileName}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )} />
                            <FormField control={form.control} name="payPeriodMonth" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Pay Month</FormLabel>
                                    <Select onValueChange={v => field.onChange(Number(v))} value={String(field.value)}>
                                        <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                                        <SelectContent>
                                            {MONTH_NAMES.map((m, i) => (
                                                <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )} />
                            <FormField control={form.control} name="payPeriodYear" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Year</FormLabel>
                                    <FormControl><Input type="number" {...field} /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )} />
                        </div>

                        <FormField control={form.control} name="payDate" render={({ field }) => (
                            <FormItem className="max-w-xs">
                                <FormLabel>Pay Date</FormLabel>
                                <FormControl><Input type="date" {...field} /></FormControl>
                                <FormMessage />
                            </FormItem>
                        )} />

                        <Separator />

                        {/* Employee Details */}
                        <p className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Employee Details</p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <FormField control={form.control} name="employeeName" render={({ field }) => (
                                <FormItem><FormLabel>Full Name</FormLabel><FormControl><Input placeholder="Name" {...field} /></FormControl><FormMessage /></FormItem>
                            )} />
                            <FormField control={form.control} name="employeeId" render={({ field }) => (
                                <FormItem><FormLabel>Employee ID</FormLabel><FormControl><Input placeholder="EMP001" {...field} /></FormControl><FormMessage /></FormItem>
                            )} />
                            <FormField control={form.control} name="designation" render={({ field }) => (
                                <FormItem><FormLabel>Designation</FormLabel><FormControl><Input placeholder="Operations Manager" {...field} /></FormControl><FormMessage /></FormItem>
                            )} />
                            <FormField control={form.control} name="department" render={({ field }) => (
                                <FormItem><FormLabel>Department</FormLabel><FormControl><Input placeholder="Operations" {...field} /></FormControl><FormMessage /></FormItem>
                            )} />
                            <FormField control={form.control} name="bankAccount" render={({ field }) => (
                                <FormItem><FormLabel>Bank Account No.</FormLabel><FormControl><Input placeholder="Account number" {...field} /></FormControl><FormMessage /></FormItem>
                            )} />
                            <FormField control={form.control} name="panNumber" render={({ field }) => (
                                <FormItem><FormLabel>PAN Number</FormLabel><FormControl><Input placeholder="ABCDE1234F" {...field} /></FormControl><FormMessage /></FormItem>
                            )} />
                        </div>

                        <Separator />

                        {/* Attendance */}
                        <p className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Attendance</p>
                        <div className="grid grid-cols-3 gap-4">
                            <FormField control={form.control} name="workingDays" render={({ field }) => (
                                <FormItem><FormLabel>Working Days</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                            )} />
                            <FormField control={form.control} name="paidDays" render={({ field }) => (
                                <FormItem><FormLabel>Paid Days</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                            )} />
                            <FormField control={form.control} name="lopDays" render={({ field }) => (
                                <FormItem><FormLabel>LOP Days</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                            )} />
                        </div>

                        <Separator />

                        {/* Earnings */}
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <p className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Earnings</p>
                                <Button type="button" variant="outline" size="sm" onClick={() => earningsArray.append({ label: '', amount: 0 })}>
                                    <Plus className="h-3 w-3 mr-1" /> Add
                                </Button>
                            </div>
                            {earningsArray.fields.map((field, i) => (
                                <div key={field.id} className="flex gap-3 items-end">
                                    <FormField control={form.control} name={`earnings.${i}.label`} render={({ field }) => (
                                        <FormItem className="flex-1"><FormLabel className={i > 0 ? 'sr-only' : ''}>Component</FormLabel><FormControl><Input placeholder="e.g. Basic Salary" {...field} /></FormControl><FormMessage /></FormItem>
                                    )} />
                                    <FormField control={form.control} name={`earnings.${i}.amount`} render={({ field }) => (
                                        <FormItem className="w-36"><FormLabel className={i > 0 ? 'sr-only' : ''}>Amount (₹)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                                    )} />
                                    <Button type="button" variant="ghost" size="icon" className="text-destructive mb-0" onClick={() => earningsArray.remove(i)}>
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>
                            ))}
                            <div className="flex justify-end pr-10 pt-1 text-sm font-semibold">
                                Gross: ₹{grossEarnings.toLocaleString('en-IN')}
                            </div>
                        </div>

                        <Separator />

                        {/* Deductions */}
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <p className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Deductions</p>
                                <Button type="button" variant="outline" size="sm" onClick={() => deductionsArray.append({ label: '', amount: 0 })}>
                                    <Plus className="h-3 w-3 mr-1" /> Add
                                </Button>
                            </div>
                            {deductionsArray.fields.map((field, i) => (
                                <div key={field.id} className="flex gap-3 items-end">
                                    <FormField control={form.control} name={`deductions.${i}.label`} render={({ field }) => (
                                        <FormItem className="flex-1"><FormLabel className={i > 0 ? 'sr-only' : ''}>Component</FormLabel><FormControl><Input placeholder="e.g. Provident Fund" {...field} /></FormControl><FormMessage /></FormItem>
                                    )} />
                                    <FormField control={form.control} name={`deductions.${i}.amount`} render={({ field }) => (
                                        <FormItem className="w-36"><FormLabel className={i > 0 ? 'sr-only' : ''}>Amount (₹)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                                    )} />
                                    <Button type="button" variant="ghost" size="icon" className="text-destructive" onClick={() => deductionsArray.remove(i)}>
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>
                            ))}
                            <div className="flex justify-end pr-10 pt-1 text-sm font-semibold text-destructive">
                                Total Deductions: ₹{totalDeductions.toLocaleString('en-IN')}
                            </div>
                        </div>

                        {/* Net Pay Summary */}
                        <div className="rounded-lg bg-primary/10 border border-primary/20 p-4 flex justify-between items-center">
                            <div>
                                <p className="text-sm text-muted-foreground">Net Pay</p>
                                <p className="text-2xl font-bold text-primary">₹{netPay.toLocaleString('en-IN')}</p>
                            </div>
                            <Button type="submit" disabled={isSaving} size="lg">
                                {isSaving ? 'Saving...' : <><Save className="mr-2 h-4 w-4" /> Save & Download</>}
                            </Button>
                        </div>
                    </form>
                </Form>
            </CardContent>
        </Card>
    );
}
