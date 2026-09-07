
'use client';

import React from 'react';
import { format } from 'date-fns';
import { Trash2, Download, Edit2, Copy } from 'lucide-react';
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
}

export function NewRelicChallanList({
  challans,
  onSelectChallan,
  onDownloadChallan,
  onDeleteChallan,
  onDuplicateChallan,
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
      <div className="px-4 sm:px-6 py-4 border-b border-gray-100 flex items-center justify-between">
        <h3 className="font-semibold text-gray-900 text-sm sm:text-base">Saved Challans</h3>
        <span className="text-xs sm:text-sm text-gray-500">{challans.length} document{challans.length !== 1 ? 's' : ''}</span>
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

            <div className="flex items-center gap-2 pt-1">
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
              <Button
                variant="outline"
                size="sm"
                className="flex-1 h-9 text-xs gap-1 border-gray-200 text-gray-700 hover:text-[#3b2fc9] hover:border-[#3b2fc9]"
                onClick={() => onDownloadChallan(challan)}
              >
                <Download className="h-3.5 w-3.5" /> PDF
              </Button>
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
                    <AlertDialogTitle>Delete Challan?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will permanently delete challan <strong>{challan.dcNumber}</strong>.
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
                <TableCell>
                  <div className="flex items-center justify-end gap-1">
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
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-gray-500 hover:text-[#3b2fc9]"
                      onClick={() => onDownloadChallan(challan)}
                      title="Download PDF"
                    >
                      <Download className="h-4 w-4" />
                    </Button>
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
                          <AlertDialogTitle>Delete Challan?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will permanently delete challan{' '}
                            <strong>{challan.dcNumber}</strong>. This action cannot be undone.
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
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
