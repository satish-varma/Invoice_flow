
"use client";

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Invoice } from '@/services/invoiceService';
import { format } from 'date-fns';
import { Download } from 'lucide-react';

interface InvoiceListProps {
    invoices: Invoice[];
    onSelectInvoice: (invoice: Invoice) => void;
    onDownloadInvoice: (invoice: Invoice) => void;
}

export function InvoiceList({ invoices, onSelectInvoice, onDownloadInvoice }: InvoiceListProps) {
    
    const handleDownloadClick = (e: React.MouseEvent, invoice: Invoice) => {
        e.stopPropagation(); // Prevent row click event
        onDownloadInvoice(invoice);
    };
    
    return (
        <Card className="h-full">
            <CardHeader>
                <CardTitle>Recent Invoices</CardTitle>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Number</TableHead>
                            <TableHead>Customer</TableHead>
                            <TableHead>Date</TableHead>
                            <TableHead className="text-right">Amount</TableHead>
                            <TableHead className="text-right w-[100px]">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {invoices.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={5} className="text-center text-muted-foreground">
                                    No invoices yet.
                                </TableCell>
                            </TableRow>
                        )}
                        {invoices.map((invoice) => (
                            <TableRow 
                                key={invoice.id} 
                                onClick={() => onSelectInvoice(invoice)}
                                className="cursor-pointer transition-all hover:shadow-md hover:scale-[1.02] hover:bg-muted/50"
                            >
                                <TableCell className="font-medium">{invoice.invoiceNumber}</TableCell>
                                <TableCell>{invoice.customerName}</TableCell>
                                <TableCell>{format(new Date(invoice.date), 'PPP')}</TableCell>
                                <TableCell className="text-right">{invoice.total.toFixed(2)}</TableCell>
                                <TableCell className="text-right">
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={(e) => handleDownloadClick(e, invoice)}
                                        aria-label="Download invoice"
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
