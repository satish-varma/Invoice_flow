"use client";

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Challan } from '@/services/challanService';
import { format } from 'date-fns';
import {
  Download,
  FileSpreadsheet,
  Search,
  Copy,
  Check,
  Building2,
  Calendar,
  ChevronRight,
  Truck,
  Package,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { exportToCSV } from '@/lib/export';
import { triggerHaptic } from '@/lib/haptics';

interface ChallanListProps {
  challans: Challan[];
  onSelectChallan: (challan: Challan) => void;
  onDownloadChallan: (challan: Challan) => void;
}

export function ChallanList({
  challans,
  onSelectChallan,
  onDownloadChallan,
}: ChallanListProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleDownloadClick = (e: React.MouseEvent, challan: Challan) => {
    e.stopPropagation();
    triggerHaptic('medium');
    onDownloadChallan(challan);
  };

  const handleCopyDcNumber = (e: React.MouseEvent, num: string) => {
    e.stopPropagation();
    triggerHaptic('light');
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(num);
      setCopiedId(num);
      setTimeout(() => setCopiedId(null), 1800);
    }
  };

  const filteredChallans = challans.filter((c) => {
    const q = searchTerm.toLowerCase();
    const dcMatch = (c.dcNumber || '').toLowerCase().includes(q);
    const clientMatch = (c.billToName || '').toLowerCase().includes(q) || (c.shipToName || '').toLowerCase().includes(q);
    return dcMatch || clientMatch;
  });

  return (
    <Card className="rounded-2xl border border-gray-200/80 shadow-sm overflow-hidden bg-white">
      <CardHeader className="p-4 sm:p-5 border-b border-gray-100 bg-gray-50/50">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div>
            <div className="flex items-center gap-2">
              <CardTitle className="text-base sm:text-lg font-black text-gray-900 tracking-tight">
                Recent Delivery Challans
              </CardTitle>
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200/60 font-mono">
                {filteredChallans.length}
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-0.5">
              Material dispatch documents, quantities &amp; returnable receipts
            </p>
          </div>

          <div className="flex w-full sm:w-auto items-center gap-2">
            <div className="relative flex-1 sm:w-60">
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-gray-400" />
              <Input
                placeholder="Search DC # or customer..."
                className="pl-8 h-9 text-xs rounded-xl border-gray-200 bg-white"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <Button
              variant="outline"
              size="sm"
              className="h-9 px-3 rounded-xl border-gray-200 text-xs font-bold text-gray-700 hover:bg-gray-100 shrink-0"
              onClick={() => {
                triggerHaptic('light');
                exportToCSV(filteredChallans, 'delivery-challans-export.csv');
              }}
              title="Export filtered challans to CSV"
            >
              <FileSpreadsheet className="h-3.5 w-3.5 mr-1.5 text-emerald-600" />
              CSV
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        {filteredChallans.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-center">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mb-3">
              <Truck className="w-6 h-6" />
            </div>
            <p className="text-sm font-bold text-gray-800">No delivery challans found</p>
            <p className="text-xs text-gray-400 mt-1">
              Create your first dispatch challan using the form above.
            </p>
          </div>
        ) : (
          <>
            {/* ── MOBILE CARD VIEW (md:hidden) ── */}
            <div className="md:hidden divide-y divide-gray-100">
              {filteredChallans.map((challan) => {
                const itemCount = challan.lineItems?.length || 0;

                return (
                  <div
                    key={challan.id}
                    onClick={() => {
                      triggerHaptic('light');
                      onSelectChallan(challan);
                    }}
                    className="p-4 active:bg-gray-50 transition-colors space-y-2.5 cursor-pointer"
                  >
                    {/* Top Row: DC # + Items Pill */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="font-mono font-bold text-sm text-[#3b2fc9] truncate">
                          {challan.dcNumber}
                        </span>
                        <button
                          type="button"
                          onClick={(e) => handleCopyDcNumber(e, challan.dcNumber)}
                          className="p-1 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                          title="Copy DC #"
                        >
                          {copiedId === challan.dcNumber ? (
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>

                      <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200/80">
                        <Package className="w-3 h-3 text-blue-500" />
                        {itemCount} {itemCount === 1 ? 'item' : 'items'}
                      </span>
                    </div>

                    {/* Middle: Customer + Date */}
                    <div className="flex items-center justify-between text-xs text-gray-600 gap-2">
                      <div className="flex items-center gap-1.5 truncate">
                        <Building2 className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                        <span className="font-semibold text-gray-800 truncate">
                          {challan.billToName || 'General Consignee'}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 text-gray-400 shrink-0 font-medium text-[11px]">
                        <Calendar className="w-3 h-3" />
                        <span>
                          {challan.dcDate
                            ? format(new Date(challan.dcDate), 'dd MMM yyyy')
                            : '—'}
                        </span>
                      </div>
                    </div>

                    {/* Bottom Row: Amount + Actions */}
                    <div className="flex items-center justify-between pt-1 border-t border-gray-50 gap-2">
                      <div>
                        <span className="text-[10px] text-gray-400 uppercase font-bold tracking-wider block">
                          Total Value
                        </span>
                        <p className="text-base font-black text-gray-900 font-mono tabular-nums leading-tight">
                          ₹{(Number(challan.total) || 0).toLocaleString('en-IN', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </p>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => handleDownloadClick(e, challan)}
                          className="h-8 px-2.5 rounded-lg border-gray-200 text-xs font-bold text-gray-700 hover:bg-gray-100 flex items-center gap-1 shadow-2xs"
                        >
                          <Download className="w-3.5 h-3.5 text-blue-600" />
                          <span>PDF</span>
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 px-2 text-xs font-semibold text-indigo-600 hover:bg-indigo-50 flex items-center gap-0.5"
                        >
                          <span>Edit</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* ── DESKTOP DATA TABLE (hidden md:block) ── */}
            <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent bg-gray-50/70 border-b border-gray-100">
                    <TableHead className="w-[140px] text-xs font-bold text-gray-600">
                      DC #
                    </TableHead>
                    <TableHead className="text-xs font-bold text-gray-600">
                      Consignee / Customer
                    </TableHead>
                    <TableHead className="w-[130px] text-xs font-bold text-gray-600">
                      Date
                    </TableHead>
                    <TableHead className="w-[100px] text-xs font-bold text-gray-600">
                      Items
                    </TableHead>
                    <TableHead className="text-right text-xs font-bold text-gray-600">
                      Total Value
                    </TableHead>
                    <TableHead className="text-right w-[100px] text-xs font-bold text-gray-600">
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredChallans.map((challan) => {
                    const itemCount = challan.lineItems?.length || 0;

                    return (
                      <TableRow
                        key={challan.id}
                        onClick={() => {
                          triggerHaptic('light');
                          onSelectChallan(challan);
                        }}
                        className="cursor-pointer transition-colors hover:bg-indigo-50/30 group border-b border-gray-100"
                      >
                        <TableCell className="font-mono font-bold text-sm text-[#3b2fc9] group-hover:underline">
                          {challan.dcNumber}
                        </TableCell>
                        <TableCell className="max-w-[220px] truncate font-medium text-gray-800 text-sm">
                          {challan.billToName || '—'}
                        </TableCell>
                        <TableCell className="text-xs text-gray-500 font-medium">
                          {challan.dcDate
                            ? format(new Date(challan.dcDate), 'dd MMM yyyy')
                            : '—'}
                        </TableCell>
                        <TableCell>
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200/80">
                            {itemCount} {itemCount === 1 ? 'item' : 'items'}
                          </span>
                        </TableCell>
                        <TableCell className="text-right font-mono font-black text-sm text-gray-900 tabular-nums">
                          ₹{(Number(challan.total) || 0).toLocaleString('en-IN', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => handleDownloadClick(e, challan)}
                            className="h-8 w-8 rounded-lg text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                            title="Download PDF"
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
          </>
        )}
      </CardContent>
    </Card>
  );
}
