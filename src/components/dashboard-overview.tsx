
"use client";

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Invoice } from '@/services/invoiceService';
import { Settings } from '@/services/settingsService';
import { Quotation } from '@/services/quotationService';
import { Challan } from '@/services/challanService';
import { IndianRupee, FileText, TrendingUp, Calendar, CreditCard, FileSearch, Truck } from 'lucide-react';

interface DashboardOverviewProps {
    invoices: Invoice[];
    quotations?: Quotation[];
    challans?: Challan[];
    settings: Settings | null;
}

export function DashboardOverview({ invoices, quotations = [], challans = [], settings }: DashboardOverviewProps) {
    const currencySymbol = settings?.currencySymbol || '₹';
    const totalRevenue = invoices.reduce((acc, inv) => acc + (inv.total || 0), 0);
    const invoiceCount = invoices.length;
    const quotationCount = quotations.length;
    const challanCount = challans.length;

    // Calculate current month's revenue
    const now = new Date();
    const currentMonthInvoices = invoices.filter(inv => {
        const invDate = new Date(inv.date);
        return invDate.getMonth() === now.getMonth() && invDate.getFullYear() === now.getFullYear();
    });
    const currentMonthRevenue = currentMonthInvoices.reduce((acc, inv) => acc + (inv.total || 0), 0);
    const unpaidRevenue = invoices.filter(inv => inv.status === 'pending' || !inv.status).reduce((acc, inv) => acc + (inv.total || 0), 0);

    const stats = [
        {
            title: "Total Revenue",
            value: `${currencySymbol}${totalRevenue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
            icon: CreditCard,
            description: "Lifetime revenue collected",
            color: "text-emerald-500",
            bg: "bg-emerald-500/10"
        },
        {
            title: "Current Month",
            value: `${currencySymbol}${currentMonthRevenue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
            icon: Calendar,
            description: `Revenue in ${now.toLocaleString('default', { month: 'long' })}`,
            color: "text-blue-500",
            bg: "bg-blue-500/10"
        },
        {
            title: "Total Invoices",
            value: invoiceCount.toString(),
            icon: FileText,
            description: "Number of invoices generated",
            color: "text-purple-500",
            bg: "bg-purple-500/10"
        },
        {
            title: "Unpaid Revenue",
            value: `${currencySymbol}${unpaidRevenue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
            icon: CreditCard,
            description: "Total of pending invoices",
            color: "text-rose-500",
            bg: "bg-rose-500/10"
        },
        {
            title: "Quotations",
            value: quotationCount.toString(),
            icon: FileSearch,
            description: "Active business proposals",
            color: "text-orange-500",
            bg: "bg-orange-500/10"
        },
        {
            title: "Challans",
            value: challanCount.toString(),
            icon: Truck,
            description: "Delivery documents issued",
            color: "text-cyan-500",
            bg: "bg-cyan-500/10"
        }
    ];


    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-8">
            {stats.map((stat, index) => (
                <Card key={index} className="overflow-hidden border-none shadow-md hover:shadow-lg transition-shadow duration-300">
                    <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                            {stat.title}
                        </CardTitle>
                        <div className={`p-2 rounded-lg ${stat.bg}`}>
                            <stat.icon className={`h-4 w-4 ${stat.color}`} />
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stat.value}</div>
                        <p className="text-xs text-muted-foreground mt-1">
                            {stat.description}
                        </p>
                    </CardContent>
                </Card>
            ))}
        </div>
    );
}
