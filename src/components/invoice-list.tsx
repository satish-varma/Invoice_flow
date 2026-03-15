
"use client";

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Invoice } from '@/services/invoiceService';
import { format } from 'date-fns';
import { Download, Search, Filter, FileSpreadsheet } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { exportToCSV } from '@/lib/export';


interface InvoiceListProps {
    invoices: Invoice[];
    onSelectInvoice: (invoice: Invoice) => void;
    onDownloadInvoice: (invoice: Invoice) => void;
}

const statusMap = {
    paid: { label: 'Paid', class: 'bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 border-emerald-200' },
    pending: { label: 'Pending', class: 'bg-amber-500/10 text-amber-600 hover:bg-amber-500/20 border-amber-200' },
    cancelled: { label: 'Cancelled', class: 'bg-rose-500/10 text-rose-600 hover:bg-rose-500/20 border-rose-200' },
};

export function InvoiceList({ invoices, onSelectInvoice, onDownloadInvoice }: InvoiceListProps) {
    const [searchTerm, setSearchTerm] = React.useState('');
    const [statusFilter, setStatusFilter] = React.useState<'all' | 'pending' | 'paid' | 'cancelled'>('all');

    const handleDownloadClick = (e: React.MouseEvent, invoice: Invoice) => {
        e.stopPropagation(); // Prevent row click event
        onDownloadInvoice(invoice);
    };

    const filteredInvoices = invoices.filter(invoice => {
        const matchesSearch = (invoice.invoiceNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (invoice.billToName || invoice.customerName || '').toLowerCase().includes(searchTerm.toLowerCase()));
        const matchesStatus = statusFilter === 'all' || (invoice.status || 'pending') === statusFilter;
        return matchesSearch && matchesStatus;
    });

    return (
        <Card className="h-full">
            <CardHeader className="pb-3">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <CardTitle className="text-xl font-bold">Recent Invoices</CardTitle>
                    <div className="flex w-full md:w-auto gap-2">
                        <div className="relative flex-1 md:w-64">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search invoices..."
                                className="pl-9 h-9"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <Select value={statusFilter} onValueChange={(v: any) => setStatusFilter(v)}>
                            <SelectTrigger className="w-[130px] h-9">
                                <Filter className="h-4 w-4 mr-2" />
                                <SelectValue placeholder="Status" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Status</SelectItem>
                                <SelectItem value="pending">Pending</SelectItem>
                                <SelectItem value="paid">Paid</SelectItem>
                                <SelectItem value="cancelled">Cancelled</SelectItem>
                            </SelectContent>
                        </Select>
                        <Button variant="outline" size="sm" className="h-9 px-2" onClick={() => exportToCSV(filteredInvoices, 'recent-invoices.csv')}>
                            <FileSpreadsheet className="h-4 w-4 mr-1" />
                            CSV
                        </Button>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                <div className="rounded-md border">
                    <Table>
                        <TableHeader>
                            <TableRow className="hover:bg-transparent bg-muted/30">
                                <TableHead className="w-[120px]">Number</TableHead>
                                <TableHead>Customer</TableHead>
                                <TableHead className="w-[100px]">Status</TableHead>
                                <TableHead className="text-right">Amount</TableHead>
                                <TableHead className="text-right w-[80px]">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredInvoices.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">
                                        No invoices found matching your criteria.
                                    </TableCell>
                                </TableRow>
                            )}
                            {filteredInvoices.map((invoice) => {
                                const status = invoice.status || 'pending';
                                const badgeStyle = statusMap[status];

                                return (
                                    <TableRow
                                        key={invoice.id}
                                        onClick={() => onSelectInvoice(invoice)}
                                        className="cursor-pointer transition-all hover:bg-muted/50 group"
                                    >
                                        <TableCell className="font-bold text-primary group-hover:underline">{invoice.invoiceNumber}</TableCell>
                                        <TableCell className="max-w-[200px] truncate">{invoice.billToName || invoice.customerName}</TableCell>
                                        <TableCell>
                                            <Badge variant="outline" className={`font-medium ${badgeStyle.class}`}>
                                                {badgeStyle.label}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-right font-semibold">₹{(Number(invoice.total) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</TableCell>
                                        <TableCell className="text-right">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={(e) => handleDownloadClick(e, invoice)}
                                                className="h-8 w-8 text-muted-foreground hover:text-primary transition-colors"
                                            >
                                                <Download className="h-4 w-4" />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>
        </Card>
    );
}
