
'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Download, Edit, Trash2, Receipt, User } from 'lucide-react';
import { Payslip } from '@/services/payslipService';
import { MONTH_NAMES } from '@/lib/payslipConstants';

interface PayslipListProps {
    payslips: Payslip[];
    onSelectPayslip: (p: Payslip) => void;
    onDownloadPayslip: (p: Payslip) => void;
    onDeletePayslip?: (id: string) => void;
}

const formatINR = (n: number) => '₹' + (n || 0).toLocaleString('en-IN');

export function PayslipList({ payslips, onSelectPayslip, onDownloadPayslip, onDeletePayslip }: PayslipListProps) {
    return (
        <Card className="w-full">
            <CardHeader>
                <CardTitle className="text-xl font-bold flex items-center gap-2">
                    <Receipt className="h-5 w-5" /> Recent Payslips
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
                {payslips.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground text-sm">
                        <p>No payslips generated yet.</p>
                    </div>
                ) : (
                    payslips.map((p) => (
                        <div key={p.id}
                            className="group flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent transition-colors"
                        >
                            <div className="space-y-0.5 min-w-0">
                                <div className="flex items-center gap-2">
                                    <span className="font-bold text-xs text-primary">{p.payslipNumber}</span>
                                    <span className="text-xs text-muted-foreground">
                                        {MONTH_NAMES[(p.payPeriodMonth || 1) - 1]} {p.payPeriodYear}
                                    </span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <User className="h-3 w-3 text-muted-foreground" />
                                    <p className="text-sm font-medium truncate">{p.employeeName}</p>
                                </div>
                                <p className="text-xs text-muted-foreground">{p.designation}</p>
                                <p className="text-xs font-semibold text-green-600">Net: {formatINR(p.netPay)}</p>
                            </div>
                            <div className="flex items-center gap-1 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onDownloadPayslip(p)} title="Download">
                                    <Download className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onSelectPayslip(p)} title="Edit">
                                    <Edit className="h-4 w-4" />
                                </Button>
                                {onDeletePayslip && (
                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => onDeletePayslip(p.id!)} title="Delete">
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                )}
                            </div>
                        </div>
                    ))
                )}
            </CardContent>
        </Card>
    );
}
