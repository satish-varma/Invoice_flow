
'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Loader } from 'lucide-react';
import { getSettings, Settings } from '@/services/settingsService';
import { generateAndSavePdf } from '@/lib/pdf';
import { AppShell } from '@/components/app-shell';
import { PayslipForm } from '@/components/payslip-form';
import { PayslipList } from '@/components/payslip-list';
import { PayslipPreview } from '@/components/payslip-preview';
import { getPayslips, Payslip, deletePayslip } from '@/services/payslipService';
import { MONTH_NAMES } from '@/lib/payslipConstants';

export default function PayslipPage() {
    const [payslips, setPayslips] = useState<Payslip[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selected, setSelected] = useState<Payslip | null>(null);
    const [toDownload, setToDownload] = useState<Payslip | null>(null);
    const [settings, setSettings] = useState<Settings | null>(null);
    const previewRef = useRef<HTMLDivElement>(null);
    const { toast } = useToast();

    const fetchData = async () => {
        setIsLoading(true);
        try {
            const [ps, s] = await Promise.all([getPayslips(), getSettings()]);
            setPayslips(ps);
            setSettings(s);
        } catch {
            toast({ variant: 'destructive', title: 'Error', description: 'Failed to load payslips.' });
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => { fetchData(); }, []);

    const handleSave = (saved?: Payslip) => {
        fetchData();
        setSelected(null);
        if (saved) setToDownload(saved);
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Delete this payslip?')) return;
        try {
            await deletePayslip(id);
            toast({ title: 'Deleted' });
            fetchData();
        } catch {
            toast({ variant: 'destructive', title: 'Error', description: 'Failed to delete.' });
        }
    };

    useEffect(() => {
        if (!toDownload || !settings) return;
        const timer = setTimeout(async () => {
            if (previewRef.current) {
                const month = MONTH_NAMES[(toDownload.payPeriodMonth || 1) - 1];
                const name = toDownload.employeeName.replace(/\s+/g, '-').toLowerCase();
                const fileName = `payslip-${name}-${month}-${toDownload.payPeriodYear}.pdf`;
                try {
                    await generateAndSavePdf(previewRef.current, fileName);
                } catch {
                    toast({ variant: 'destructive', title: 'Download Failed' });
                } finally {
                    setToDownload(null);
                }
            }
        }, 500);
        return () => clearTimeout(timer);
    }, [toDownload, settings, toast]);

    return (
        <AppShell>
            <main className="min-h-screen bg-background flex flex-col items-center p-4 sm:p-8">
                <div className="w-full max-w-7xl mx-auto">
                    <div className="grid grid-cols-1 gap-8">
                        <div className="w-full">
                            <PayslipForm
                                key={selected?.id || 'new'}
                                initialData={selected}
                                onPayslipSave={handleSave}
                                onAddNew={() => setSelected(null)}
                            />
                        </div>
                        <div className="w-full">
                            {isLoading ? (
                                <div className="flex items-center justify-center p-12">
                                    <Loader className="h-8 w-8 animate-spin" />
                                </div>
                            ) : (
                                <PayslipList
                                    payslips={payslips}
                                    onSelectPayslip={setSelected}
                                    onDownloadPayslip={setToDownload}
                                    onDeletePayslip={handleDelete}
                                />
                            )}
                        </div>
                    </div>
                </div>

                {toDownload && settings && (
                    <div style={{ position: 'fixed', left: '-9999px', top: '-9999px' }}>
                        <PayslipPreview ref={previewRef} payslip={toDownload} settings={settings} />
                    </div>
                )}
            </main>
        </AppShell>
    );
}
