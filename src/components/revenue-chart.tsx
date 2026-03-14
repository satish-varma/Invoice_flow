
"use client";

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Invoice } from '@/services/invoiceService';
import { Settings } from '@/services/settingsService';
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    AreaChart,
    Area
} from 'recharts';
import { format, subMonths, startOfMonth, isAfter } from 'date-fns';

interface RevenueChartProps {
    invoices: Invoice[];
    settings: Settings | null;
}

export function RevenueChart({ invoices, settings }: RevenueChartProps) {
    const currencySymbol = settings?.currencySymbol || '₹';

    // Generate last 6 months
    const last6Months = Array.from({ length: 6 }, (_, i) => {
        const d = subMonths(new Date(), i);
        return {
            month: format(d, 'MMM'),
            date: startOfMonth(d),
            revenue: 0
        };
    }).reverse();

    // Map invoices to months
    invoices.forEach(inv => {
        const invDate = new Date(inv.date);
        const monthData = last6Months.find(m =>
            invDate.getMonth() === m.date.getMonth() &&
            invDate.getFullYear() === m.date.getFullYear()
        );
        if (monthData) {
            monthData.revenue += (inv.total || 0);
        }
    });

    const CustomTooltip = ({ active, payload, label }: any) => {
        if (active && payload && payload.length) {
            return (
                <div className="bg-background border rounded-lg shadow-lg p-3">
                    <p className="font-bold text-sm mb-1">{label}</p>
                    <p className="text-primary font-medium">
                        {currencySymbol}{payload[0].value.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </p>
                </div>
            );
        }
        return null;
    };

    return (
        <Card className="col-span-full shadow-md border-none overflow-hidden">
            <CardHeader>
                <CardTitle className="text-xl font-bold">Revenue Trends</CardTitle>
                <CardDescription>Monthly revenue performance over the last 6 months</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="h-[300px] w-full mt-4">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={last6Months}>
                            <defs>
                                <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--muted))" />
                            <XAxis
                                dataKey="month"
                                axisLine={false}
                                tickLine={false}
                                tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                                dy={10}
                            />
                            <YAxis
                                axisLine={false}
                                tickLine={false}
                                tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                                tickFormatter={(value) => `${currencySymbol}${value >= 1000 ? (value / 1000).toFixed(1) + 'k' : value}`}
                            />
                            <Tooltip content={<CustomTooltip />} />
                            <Area
                                type="monotone"
                                dataKey="revenue"
                                stroke="hsl(var(--primary))"
                                strokeWidth={2}
                                fillOpacity={1}
                                fill="url(#colorRevenue)"
                                animationDuration={1500}
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </CardContent>
        </Card>
    );
}
