
"use client";

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Quotation } from '@/services/quotationService';
import { format } from 'date-fns';
import { Download, FileSpreadsheet, FileText, Calendar } from 'lucide-react';
import { exportToCSV } from '@/lib/export';
import { triggerHaptic } from '@/lib/haptics';

interface QuotationListProps {
    quotations: Quotation[];
    onSelectQuotation: (quotation: Quotation) => void;
    onDownloadQuotation: (quotation: Quotation) => void;
}

export function QuotationList({ quotations, onSelectQuotation, onDownloadQuotation }: QuotationListProps) {
    const handleDownloadClick = (e: React.MouseEvent, quotation: Quotation) => {
        e.stopPropagation();
        triggerHaptic('light');
        onDownloadQuotation(quotation);
    };

    const formatDate = (dateStr: string) => {
        try {
            return format(new Date(dateStr), 'dd MMM yyyy');
        } catch {
            return dateStr;
        }
    };

    return (
        <Card className="rounded-2xl sm:rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-[0_4px_16px_-4px_rgba(0,0,0,0.06)] overflow-hidden">
            <CardHeader className="p-4 sm:p-6 pb-3 sm:pb-4 border-b border-slate-100 dark:border-slate-800">
                <div className="flex justify-between items-center">
                    <div>
                        <CardTitle className="text-base sm:text-xl font-black text-slate-900 dark:text-white tracking-tight">
                            Recent Quotations
                        </CardTitle>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                            {quotations.length} total saved proposals
                        </p>
                    </div>
                    <Button 
                        variant="outline" 
                        size="sm" 
                        className="h-9 rounded-xl font-bold text-xs border-slate-200 dark:border-slate-800 active:scale-95" 
                        onClick={() => {
                            triggerHaptic('light');
                            exportToCSV(quotations, 'recent-quotations.csv');
                        }}
                    >
                        <FileSpreadsheet className="h-3.5 w-3.5 mr-1 text-indigo-600" />
                        CSV
                    </Button>
                </div>
            </CardHeader>
            <CardContent className="p-3 sm:p-6">
                {/* ── MOBILE SQUIRCLE CARDS ─────────────────────── */}
                <div className="md:hidden space-y-2.5">
                    {quotations.length === 0 ? (
                        <div className="text-center py-10 text-slate-400">
                            <FileText className="h-8 w-8 mx-auto mb-2 opacity-40 text-indigo-500" />
                            <p className="text-xs font-semibold">No quotations yet</p>
                        </div>
                    ) : (
                        quotations.map((quotation) => (
                            <div
                                key={quotation.id}
                                onClick={() => {
                                    triggerHaptic('light');
                                    onSelectQuotation(quotation);
                                }}
                                className="rounded-2xl border border-slate-200/80 dark:border-slate-800 p-3.5 bg-slate-50/50 dark:bg-slate-800/40 active:scale-[0.98] transition-all flex items-center justify-between gap-3 shadow-xs"
                            >
                                <div className="min-w-0">
                                    <p className="font-mono font-black text-sm text-indigo-600 dark:text-indigo-400 truncate">
                                        {quotation.quotationNumber}
                                    </p>
                                    <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 truncate mt-0.5">
                                        {quotation.billToName || 'No Customer'}
                                    </p>
                                    <p className="text-[11px] text-slate-400 mt-1 flex items-center gap-1">
                                        <Calendar className="h-3 w-3" />
                                        {formatDate(quotation.quotationDate)}
                                    </p>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                    <p className="font-mono font-black text-sm text-slate-900 dark:text-white">
                                        ₹{(Number(quotation.total) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </p>
                                    <Button
                                        variant="outline"
                                        size="icon"
                                        className="h-9 w-9 rounded-xl border-slate-200 dark:border-slate-700 text-indigo-600 active:scale-90"
                                        onClick={(e) => handleDownloadClick(e, quotation)}
                                        aria-label="Download quotation"
                                    >
                                        <Download className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {/* ── DESKTOP TABLE ───────────────────────────── */}
                <div className="hidden md:block">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Quotation #</TableHead>
                                <TableHead>Customer</TableHead>
                                <TableHead>Date</TableHead>
                                <TableHead className="text-right">Amount</TableHead>
                                <TableHead className="text-right w-[100px]">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {quotations.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center text-muted-foreground">
                                        No quotations yet.
                                    </TableCell>
                                </TableRow>
                            )}
                            {quotations.map((quotation) => (
                                <TableRow
                                    key={quotation.id}
                                    onClick={() => onSelectQuotation(quotation)}
                                    className="cursor-pointer transition-all hover:shadow-md hover:scale-[1.01] hover:bg-muted/50"
                                >
                                    <TableCell className="font-mono font-bold text-primary">{quotation.quotationNumber}</TableCell>
                                    <TableCell className="font-medium">{quotation.billToName}</TableCell>
                                    <TableCell>{format(new Date(quotation.quotationDate), 'dd MMM yyyy')}</TableCell>
                                    <TableCell className="text-right font-mono font-bold">{(Number(quotation.total) || 0).toFixed(2)}</TableCell>
                                    <TableCell className="text-right">
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={(e) => handleDownloadClick(e, quotation)}
                                            aria-label="Download quotation"
                                        >
                                            <Download className="h-4 w-4" />
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>
        </Card>
    );
}
