
'use client';

import React from 'react';
import { format } from 'date-fns';
import { Trash2, Download, Edit2, Copy, RefreshCcw, History, Eye, Receipt } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { NewRelicChallan, NEWRELIC_LOCATIONS } from '@/services/newrelicChallanService';

interface NewRelicChallanListProps {
  challans: NewRelicChallan[];
  onSelectChallan: (c: NewRelicChallan) => void;
  onDownloadChallan: (c: NewRelicChallan) => void;
  onDeleteChallan: (id: string) => void;
  onDuplicateChallan: (c: NewRelicChallan) => void;
  onViewHistory?: (c: NewRelicChallan) => void;
  onPreviewChallan?: (c: NewRelicChallan) => void;
  onAdminPreviewChallan?: (c: NewRelicChallan) => void;
  isTrashView?: boolean;
  onRestoreChallan?: (id: string) => void;
  role?: string | null;
}

const formatAuthorName = (email?: string | null) => {
  if (!email) return 'System';
  return email.split('@')[0];
};

export function NewRelicChallanList({
  challans,
  onSelectChallan,
  onDownloadChallan,
  onDeleteChallan,
  onDuplicateChallan,
  onViewHistory,
  onPreviewChallan,
  onAdminPreviewChallan,
  isTrashView,
  onRestoreChallan,
  role,
}: NewRelicChallanListProps) {
  if (challans.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-10 text-center">
        <p className="text-gray-400 text-sm">No challans yet. Create your first one above.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="px-4 sm:px-6 py-4 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <h3 className="font-semibold text-gray-900 text-sm sm:text-base">Saved Challans</h3>
        <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 text-xs sm:text-sm text-gray-500">
          <span>{challans.length} document{challans.length !== 1 ? 's' : ''}</span>
          {role === 'admin' && (
            <>
              <span className="hidden sm:inline text-gray-300">|</span>
              {(() => {
                const totals = challans.reduce((acc, c) => {
                  const mrp = (c.lineItems || []).reduce((sum, i) => sum + ((i.mrp || 0) * (i.quantity || 1)), 0);
                  const comm = mrp * 0.055;
                  
                  acc.mrp += mrp;
                  acc.commission += comm;
                  acc.goods += (c.procurementCost || 0);
                  acc.transport += (c.transportCost || 0);
                  
                  return acc;
                }, { mrp: 0, commission: 0, goods: 0, transport: 0 });
                
                const revenue = totals.mrp - totals.commission;
                const cost = totals.goods + totals.transport + challans.reduce((acc, c) => acc + (c.otherCharges || 0), 0);
                const profit = revenue - cost;

                return (
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span className="text-gray-600">MRP: ₹{totals.mrp.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    <span className="text-red-500/80">Comm: -₹{totals.commission.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    <span className="text-gray-600">Goods: ₹{totals.goods.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    <span className="text-gray-600">Trans: ₹{totals.transport.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    <span className={`font-semibold ${profit >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                      Profit: ₹{profit.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                );
              })()}
            </>
          )}
        </div>
      </div>

      {/* Mobile Card List (< sm) */}
      <div className="block sm:hidden divide-y divide-gray-100">
        {challans.map((challan) => (
          <div key={challan.id} className="p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="font-mono font-bold text-[#3b2fc9] text-base">
                {challan.dcNumber}
              </span>
              <Badge
                variant="outline"
                className={
                  challan.location === 'hyderabad'
                    ? 'border-blue-200 text-blue-700 bg-blue-50 text-xs'
                    : 'border-emerald-200 text-emerald-700 bg-emerald-50 text-xs'
                }
              >
                {NEWRELIC_LOCATIONS[challan.location]?.label ?? challan.location}
              </Badge>
            </div>

            <div className="flex items-center justify-between text-xs text-gray-500">
              <span>
                Date:{' '}
                <strong className="text-gray-700">
                  {challan.dcDate ? format(new Date(challan.dcDate), 'dd-MM-yyyy') : '—'}
                </strong>
              </span>
              <span>
                Items:{' '}
                <strong className="text-gray-700">{challan.lineItems?.length ?? 0}</strong>
              </span>
            </div>

            {role === 'admin' && (
              <div className="flex items-center justify-between text-[11px] text-gray-500 border-t border-gray-50 pt-2 mt-1">
                <span>{isTrashView ? 'Deleted By:' : 'Created By:'}</span>
                <span className="font-medium text-gray-700 truncate max-w-[150px]" title={(isTrashView ? challan.deletedBy : challan.createdBy) || 'System'}>
                  {formatAuthorName((isTrashView ? challan.deletedBy : challan.createdBy))}
                  {isTrashView && challan.deletedAt && (
                    <span className="text-gray-400 ml-1">
                      ({format(new Date(challan.deletedAt), 'dd-MMM-yy')})
                    </span>
                  )}
                </span>
              </div>
            )}

            {role === 'admin' && (
              <div className="flex flex-col gap-1 text-xs text-gray-500 border-t border-gray-50 pt-2">
                  {(() => {
                    const mrpTotal = (challan.lineItems || []).reduce((acc, item) => acc + ((item.mrp || 0) * (item.quantity || 1)), 0);
                    const commission = mrpTotal * 0.055;
                    const revenue = mrpTotal - commission;
                    
                    const pCost = challan.procurementCost || 0;
                    const tCost = challan.transportCost || 0;
                    const oCost = challan.otherCharges || 0;
                    const totalCost = pCost + tCost + oCost;
                    
                    const profit = revenue - totalCost;

                    return (
                      <>
                        <div className="flex justify-between">
                          <span>Revenue (After 5.5%):</span>
                          <span>₹{revenue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Total Cost:</span>
                          <span>₹{totalCost.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        </div>
                        <div className="flex justify-between pt-1 border-t border-gray-100 font-medium">
                          <span className={profit >= 0 ? "text-emerald-600" : "text-red-600"}>Profit:</span>
                          <strong className={profit >= 0 ? "text-emerald-700" : "text-red-700"}>
                            ₹{profit.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </strong>
                        </div>
                      </>
                    );
                  })()}
              </div>
            )}

            <div className="flex items-center gap-2 pt-1">
              {isTrashView ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 h-9 text-xs gap-1 border-gray-200 text-emerald-600 hover:text-emerald-700 hover:border-emerald-300 hover:bg-emerald-50"
                  onClick={() => onRestoreChallan && challan.id && onRestoreChallan(challan.id)}
                >
                  <RefreshCcw className="h-3.5 w-3.5" /> Restore
                </Button>
              ) : (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 h-9 text-xs gap-1 border-gray-200 text-gray-700 hover:text-[#3b2fc9] hover:border-[#3b2fc9]"
                    onClick={() => onSelectChallan(challan)}
                  >
                    <Edit2 className="h-3.5 w-3.5" /> Edit
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 h-9 text-xs gap-1 border-gray-200 text-gray-700 hover:text-amber-600 hover:border-amber-400"
                    onClick={() => onDuplicateChallan(challan)}
                    title="Duplicate challan with next DC number"
                  >
                    <Copy className="h-3.5 w-3.5" /> Dupe
                  </Button>
                  {onPreviewChallan && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 h-9 text-xs gap-1 border-gray-200 text-gray-700 hover:text-[#3b2fc9] hover:border-[#3b2fc9]"
                      onClick={() => onPreviewChallan(challan)}
                    >
                      <Eye className="h-3.5 w-3.5" /> View
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 h-9 text-xs gap-1 border-gray-200 text-gray-700 hover:text-[#3b2fc9] hover:border-[#3b2fc9]"
                    onClick={() => onDownloadChallan(challan)}
                  >
                    <Download className="h-3.5 w-3.5" /> PDF
                  </Button>
                  {onViewHistory && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 h-9 text-xs gap-1 border-gray-200 text-gray-700 hover:text-[#3b2fc9] hover:border-[#3b2fc9]"
                      onClick={() => onViewHistory(challan)}
                      title="View Edit History"
                    >
                      <History className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </>
              )}
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-9 px-3 text-xs border-gray-200 text-red-500 hover:bg-red-50 hover:border-red-200"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent className="w-[90vw] max-w-lg rounded-2xl">
                  <AlertDialogHeader>
                    <AlertDialogTitle>{isTrashView ? 'Permanently Delete?' : 'Delete Challan?'}</AlertDialogTitle>
                    <AlertDialogDescription>
                      {isTrashView ? (
                        <>This will <strong>permanently destroy</strong> challan <strong>{challan.dcNumber}</strong>. This action cannot be undone.</>
                      ) : (
                        <>This will move challan <strong>{challan.dcNumber}</strong> to the Trash view.</>
                      )}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      className="bg-red-500 hover:bg-red-600"
                      onClick={() => challan.id && onDeleteChallan(challan.id)}
                    >
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        ))}
      </div>

      {/* Desktop Table View (>= sm) */}
      <div className="hidden sm:block overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50 hover:bg-gray-50">
              <TableHead className="font-semibold text-gray-600">DC No</TableHead>
              <TableHead className="font-semibold text-gray-600">Date</TableHead>
              <TableHead className="font-semibold text-gray-600">Location</TableHead>
              <TableHead className="font-semibold text-gray-600 text-center">Items</TableHead>
              {role === 'admin' && (
                <>
                  <TableHead className="font-semibold text-gray-600">{isTrashView ? 'Deleted By' : 'Author'}</TableHead>
                  <TableHead className="font-semibold text-gray-600 text-right">Rev</TableHead>
                  <TableHead className="font-semibold text-gray-600 text-right">Cost</TableHead>
                  <TableHead className="font-semibold text-gray-600 text-right">Profit</TableHead>
                </>
              )}
              <TableHead className="font-semibold text-gray-600 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {challans.map((challan) => (
              <TableRow key={challan.id} className="hover:bg-gray-50/50">
                <TableCell className="font-mono font-medium text-[#3b2fc9]">
                  {challan.dcNumber}
                </TableCell>
                <TableCell className="text-gray-600">
                  {challan.dcDate
                    ? format(new Date(challan.dcDate), 'dd-MM-yyyy')
                    : '—'}
                </TableCell>
                <TableCell>
                  <Badge
                    variant="outline"
                    className={
                      challan.location === 'hyderabad'
                        ? 'border-blue-200 text-blue-700 bg-blue-50'
                        : 'border-emerald-200 text-emerald-700 bg-emerald-50'
                    }
                  >
                    {NEWRELIC_LOCATIONS[challan.location]?.label ?? challan.location}
                  </Badge>
                </TableCell>
                <TableCell className="text-center text-gray-600">
                  {challan.lineItems?.length ?? 0}
                </TableCell>
                {role === 'admin' && (
                  <>
                    <TableCell>
                      <div className="flex flex-col text-[11px]">
                        <span className="font-medium text-gray-700 truncate max-w-[120px]" title={(isTrashView ? challan.deletedBy : challan.createdBy) || 'System'}>
                          {formatAuthorName((isTrashView ? challan.deletedBy : challan.createdBy))}
                        </span>
                        {(isTrashView ? challan.deletedAt : challan.createdAt) && (
                          <span className="text-gray-400">
                            {format(new Date((isTrashView ? challan.deletedAt : challan.createdAt)), 'dd-MMM-yy')}
                          </span>
                        )}
                      </div>
                    </TableCell>
                      {(() => {
                        const mrpTotal = (challan.lineItems || []).reduce((acc, item) => acc + ((item.mrp || 0) * (item.quantity || 1)), 0);
                        const commission = mrpTotal * 0.055;
                        const revenue = mrpTotal - commission;
                        
                        const pCost = challan.procurementCost || 0;
                        const tCost = challan.transportCost || 0;
                        const oCost = challan.otherCharges || 0;
                        const totalCost = pCost + tCost + oCost;
                        
                        const profit = revenue - totalCost;

                        return (
                          <>
                            <TableCell className="text-right whitespace-nowrap align-top pt-3">
                              <div className="flex flex-col text-[11px] items-end leading-tight">
                                <span className="text-gray-600" title="Total MRP">₹{mrpTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                <span className="text-gray-400" title="5.5% Commission">- ₹{commission.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                <span className="font-medium text-[13px] text-gray-900 border-t border-gray-200 mt-1 pt-1 w-full text-right">
                                  ₹{revenue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell className="text-right whitespace-nowrap align-top pt-3">
                              <div className="flex flex-col text-[11px] items-end leading-tight text-gray-500">
                                <span>Goods: ₹{pCost.toLocaleString('en-IN')}</span>
                                <span>Trans: ₹{tCost.toLocaleString('en-IN')}</span>
                                <span>Other: ₹{oCost.toLocaleString('en-IN')}</span>
                                <span className="font-medium text-[13px] text-gray-900 border-t border-gray-200 mt-1 pt-1 w-full text-right">
                                  ₹{totalCost.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell className="text-right font-medium whitespace-nowrap align-top pt-3">
                              <div className="flex flex-col items-end w-full h-full justify-end pb-[2px]">
                                <span className={profit >= 0 ? "text-emerald-700" : "text-red-700"}>
                                  ₹{profit.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </span>
                              </div>
                            </TableCell>
                          </>
                        );
                      })()}
                  </>
                )}
                <TableCell>
                  <div className="flex items-center justify-end gap-1">
                    {isTrashView ? (
                      role === 'admin' ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 gap-1 mr-2"
                          onClick={() => onRestoreChallan && challan.id && onRestoreChallan(challan.id)}
                          title="Restore"
                        >
                          <RefreshCcw className="h-4 w-4" /> Restore
                        </Button>
                      ) : null
                    ) : (
                      <>
                        {role !== 'user' && (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-gray-500 hover:text-[#3b2fc9]"
                              onClick={() => onSelectChallan(challan)}
                              title="Edit"
                            >
                              <Edit2 className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-gray-500 hover:text-amber-500"
                              onClick={() => onDuplicateChallan(challan)}
                              title="Duplicate with next DC number"
                            >
                              <Copy className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                        {onPreviewChallan && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-gray-500 hover:text-[#3b2fc9]"
                            onClick={() => onPreviewChallan(challan)}
                            title="Preview Document"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        )}
                        {role === 'admin' && onAdminPreviewChallan && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-gray-500 hover:text-[#3b2fc9]"
                            onClick={() => onAdminPreviewChallan(challan)}
                            title="Admin Quick View"
                          >
                            <Receipt className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-gray-500 hover:text-[#3b2fc9]"
                          onClick={() => onDownloadChallan(challan)}
                          title="Download PDF"
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                        {role === 'admin' && onViewHistory && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-gray-500 hover:text-[#3b2fc9]"
                            onClick={() => onViewHistory(challan)}
                            title="View Edit History"
                          >
                            <History className="h-4 w-4" />
                          </Button>
                        )}
                      </>
                    )}
                        {role === 'admin' && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-gray-400 hover:text-red-500"
                                title="Delete"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>{isTrashView ? 'Permanently Delete?' : 'Delete Challan?'}</AlertDialogTitle>
                                <AlertDialogDescription>
                                  {isTrashView ? (
                                    <>This will <strong>permanently destroy</strong> challan <strong>{challan.dcNumber}</strong>. This action cannot be undone.</>
                                  ) : (
                                    <>This will move challan <strong>{challan.dcNumber}</strong> to the Trash view.</>
                                  )}
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  className="bg-red-500 hover:bg-red-600"
                                  onClick={() => challan.id && onDeleteChallan(challan.id)}
                                >
                                  {isTrashView ? 'Delete Permanently' : 'Move to Trash'}
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
