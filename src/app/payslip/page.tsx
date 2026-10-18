
'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Loader, ArrowLeft, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { triggerHaptic } from '@/lib/haptics';
import { getSettings, Settings } from '@/services/settingsService';
import { generateAndSavePdf } from '@/lib/pdf';
import { AppShell } from '@/components/app-shell';
import { PayslipForm } from '@/components/payslip-form';
import { PayslipList } from '@/components/payslip-list';
import { PayslipPreview } from '@/components/payslip-preview';
import { getPayslips, Payslip, deletePayslip } from '@/services/payslipService';
import { MONTH_NAMES } from '@/lib/payslipConstants';
import { useAuth } from '@/contexts/AuthContext';

export default function PayslipPage() {
    const { role, isReadOnly } = useAuth();
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
        if (isReadOnly || role === 'guest') {
            toast({ variant: 'destructive', title: 'Read-Only Mode', description: 'Guest account cannot delete payslips.' });
            return;
        }
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
            <main className="min-h-screen bg-slate-50/60 dark:bg-slate-950 flex flex-col items-center p-3 sm:p-8">
                <div className="w-full max-w-7xl mx-auto space-y-6">
                    {/* Mobile Large Title Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <div className="space-y-1">
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => {
                                        triggerHaptic('light');
                                        window.history.back();
                                    }}
                                    className="sm:hidden p-2 -ml-2 rounded-xl text-slate-600 dark:text-slate-300 active:scale-95 transition-all"
                                >
                                    <ArrowLeft className="h-5 w-5" />
                                </button>
                                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-[10px] sm:text-xs font-black tracking-widest uppercase shadow-xs">
                                    <Sparkles className="h-3 w-3 animate-pulse" />
                                    PAYROLL & HR
                                </div>
                            </div>

                            <h1 className="text-2xl sm:text-4xl font-black text-slate-900 dark:text-white tracking-tight">
                                Payslip Generator
                            </h1>
                            <p className="text-slate-500 dark:text-slate-400 text-xs sm:text-sm font-medium">
                                Generate official salary slips with automatic PF, tax deductions & PDF export
                            </p>
                        </div>

                        <div className="hidden sm:flex items-center gap-2">
                            <Link
                                href="/"
                                onClick={() => triggerHaptic('light')}
                                className="inline-flex items-center gap-2 h-10 px-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-bold text-slate-700 dark:text-slate-200 shadow-2xs hover:bg-slate-50 active:scale-95 transition-all"
                            >
                                <ArrowLeft className="h-4 w-4" />
                                <span>Back to Home</span>
                            </Link>
                        </div>
                    </div>

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
                                    <Loader className="h-8 w-8 animate-spin text-emerald-600" />
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
