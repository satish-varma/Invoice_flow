
"use client";

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Challan } from '@/services/challanService';
import { format } from 'date-fns';
import { Download } from 'lucide-react';

interface ChallanListProps {
    challans: Challan[];
    onSelectChallan: (challan: Challan) => void;
    onDownloadChallan: (challan: Challan) => void;
}

export function ChallanList({ challans, onSelectChallan, onDownloadChallan }: ChallanListProps) {
    
    const handleDownloadClick = (e: React.MouseEvent, challan: Challan) => {
        e.stopPropagation(); // Prevent row click event
        onDownloadChallan(challan);
    };
    
    return (
        <Card className="h-full">
            <CardHeader>
                <CardTitle>Recent Delivery Challans</CardTitle>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>DC #</TableHead>
                            <TableHead>Customer</TableHead>
                            <TableHead>Date</TableHead>
                            <TableHead className="text-right">Amount</TableHead>
                            <TableHead className="text-right w-[100px]">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {challans.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={5} className="text-center text-muted-foreground">
                                    No challans yet.
                                </TableCell>
                            </TableRow>
                        )}
                        {challans.map((challan) => (
                            <TableRow 
                                key={challan.id} 
                                onClick={() => onSelectChallan(challan)}
                                className="cursor-pointer transition-all hover:shadow-md hover:scale-[1.02] hover:bg-muted/50"
                            >
                                <TableCell className="font-medium">{challan.dcNumber}</TableCell>
                                <TableCell>{challan.billToName}</TableCell>
                                <TableCell>{format(new Date(challan.dcDate), 'PPP')}</TableCell>
                                <TableCell className="text-right">{challan.total.toFixed(2)}</TableCell>
                                <TableCell className="text-right">
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={(e) => handleDownloadClick(e, challan)}
                                        aria-label="Download challan"
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
