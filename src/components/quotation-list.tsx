
"use client";

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Quotation } from '@/services/quotationService';
import { format } from 'date-fns';
import { Download, FileSpreadsheet } from 'lucide-react';
import { exportToCSV } from '@/lib/export';

interface QuotationListProps {
    quotations: Quotation[];
    onSelectQuotation: (quotation: Quotation) => void;
    onDownloadQuotation: (quotation: Quotation) => void;
}

export function QuotationList({ quotations, onSelectQuotation, onDownloadQuotation }: QuotationListProps) {

    const handleDownloadClick = (e: React.MouseEvent, quotation: Quotation) => {
        e.stopPropagation(); // Prevent row click event
        onDownloadQuotation(quotation);
    };

    return (
        <Card className="h-full">
            <CardHeader className="pb-3">
                <div className="flex justify-between items-center">
                    <CardTitle className="text-xl font-bold">Recent Quotations</CardTitle>
                    <Button variant="outline" size="sm" className="h-9" onClick={() => exportToCSV(quotations, 'recent-quotations.csv')}>
                        <FileSpreadsheet className="h-4 w-4 mr-1" />
                        CSV
                    </Button>
                </div>
            </CardHeader>
            <CardContent>
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
                                className="cursor-pointer transition-all hover:shadow-md hover:scale-[1.02] hover:bg-muted/50"
                            >
                                <TableCell className="font-medium">{quotation.quotationNumber}</TableCell>
                                <TableCell>{quotation.billToName}</TableCell>
                                <TableCell>{format(new Date(quotation.quotationDate), 'PPP')}</TableCell>
                                <TableCell className="text-right">{(Number(quotation.total) || 0).toFixed(2)}</TableCell>
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
            </CardContent>
        </Card>
    );
}
