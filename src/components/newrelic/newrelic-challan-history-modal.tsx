'use client';

import React, { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { Loader2, History, RotateCcw, Download } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import {
  NewRelicChallanHistory,
  getNewRelicChallanHistory,
  NewRelicChallan,
} from '@/services/newrelicChallanService';
import { Badge } from '@/components/ui/badge';

interface NewRelicChallanHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  challanId: string;
  dcNumber: string;
  currentChallan: NewRelicChallan | null;
  onRestoreVersion: (version: NewRelicChallan) => void;
}

export function NewRelicChallanHistoryModal({
  isOpen,
  onClose,
  challanId,
  dcNumber,
  currentChallan,
  onRestoreVersion,
}: NewRelicChallanHistoryModalProps) {
  const { toast } = useToast();
  const [history, setHistory] = useState<NewRelicChallanHistory[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const formatAuthorName = (email?: string | null) => {
    if (!email) return 'System';
    return email.split('@')[0];
  };

  const getDiffs = (oldState: NewRelicChallan, newState: NewRelicChallan | null) => {
    if (!newState) return null;
    const diffs: string[] = [];
    
    if (oldState.location !== newState.location) {
      diffs.push(`Location: ${oldState.location} → ${newState.location}`);
    }
    if ((oldState.transportCost || 0) !== (newState.transportCost || 0)) {
      diffs.push(`Transport: ₹${oldState.transportCost || 0} → ₹${newState.transportCost || 0}`);
    }
    if ((oldState.otherCharges || 0) !== (newState.otherCharges || 0)) {
      diffs.push(`Other: ₹${oldState.otherCharges || 0} → ₹${newState.otherCharges || 0}`);
    }
    if ((oldState.procurementCost || 0) !== (newState.procurementCost || 0)) {
      diffs.push(`Procurement: ₹${oldState.procurementCost || 0} → ₹${newState.procurementCost || 0}`);
    }
    if ((oldState.lineItems?.length || 0) !== (newState.lineItems?.length || 0)) {
      diffs.push(`Items count: ${oldState.lineItems?.length || 0} → ${newState.lineItems?.length || 0}`);
    }
    const oldItemsVal = (oldState.lineItems || []).reduce((acc, item) => acc + ((item.mrp || 0) * (item.quantity || 1)), 0);
    const newItemsVal = (newState.lineItems || []).reduce((acc, item) => acc + ((item.mrp || 0) * (item.quantity || 1)), 0);
    if (oldItemsVal !== newItemsVal) {
      diffs.push(`Items Value: ₹${oldItemsVal} → ₹${newItemsVal}`);
    }
    if (oldState.note !== newState.note) {
      diffs.push(`Note updated`);
    }

    return diffs.length > 0 ? diffs : ['No major changes detected'];
  };

  useEffect(() => {
    if (isOpen && challanId) {
      loadHistory();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, challanId]);

  const loadHistory = async () => {
    setIsLoading(true);
    try {
      const data = await getNewRelicChallanHistory(challanId);
      setHistory(data);
    } catch (err) {
      console.error(err);
      toast({ variant: 'destructive', title: 'Failed to load history' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRestore = (version: NewRelicChallan) => {
    onRestoreVersion(version);
    onClose();
  };

  const handleDownloadCSV = () => {
    if (!history.length) return;

    // Headers
    const rows = [
      ['Date', 'Action', 'Author', 'DC Number', 'Location', 'Items Count', 'Total Items Value', 'Transport Cost', 'Other Charges', 'Procurement Cost']
    ];

    history.forEach(log => {
      const pd = log.previousData;
      const itemsVal = (pd.lineItems || []).reduce((acc, item) => acc + ((item.mrp || 0) * (item.quantity || 1)), 0);
      
      rows.push([
        log.editedAt ? format(new Date(log.editedAt), "yyyy-MM-dd HH:mm:ss") : 'Unknown Date',
        log.action || 'UPDATED',
        formatAuthorName(log.editedBy),
        pd.dcNumber || '',
        pd.location || '',
        (pd.lineItems?.length || 0).toString(),
        itemsVal.toString(),
        (pd.transportCost || 0).toString(),
        (pd.otherCharges || 0).toString(),
        (pd.procurementCost || 0).toString()
      ]);
    });

    const csvContent = "data:text/csv;charset=utf-8," 
      + rows.map(e => e.join(",")).join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `audit_trail_${dcNumber}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col p-0 overflow-hidden rounded-2xl">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-[#3b2fc9]">
              <History className="h-5 w-5" />
              <DialogTitle className="text-xl">Edit History: {dcNumber}</DialogTitle>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="text-gray-600 hover:text-[#3b2fc9]"
              onClick={handleDownloadCSV}
              disabled={isLoading || history.length === 0}
            >
              <Download className="h-4 w-4 mr-1.5" /> Export CSV
            </Button>
          </div>
          <DialogDescription>
            View past versions of this invoice. You can restore older data if a mistake was made.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-6 bg-gray-50">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
            </div>
          ) : history.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
              <p className="text-gray-500">No previous versions found for this invoice.</p>
              <p className="text-xs text-gray-400 mt-1">This document has not been edited yet.</p>
            </div>
          ) : (
            <div className="space-y-6 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-gray-200 before:to-transparent">
              {history.map((version, idx) => {
                const nextState = idx === 0 ? currentChallan : history[idx - 1].previousData;
                const diffs = version.action === 'UPDATED' ? getDiffs(version.previousData, nextState) : null;
                
                return (
                <div key={version.id} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                  <div className="flex items-center justify-center w-10 h-10 rounded-full border border-white bg-blue-100 text-[#3b2fc9] shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2">
                    <History className="h-4 w-4" />
                  </div>
                  <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-4 rounded-xl border border-gray-200 bg-white shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Badge 
                          variant="outline" 
                          className={
                            version.action === 'CREATED' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                            version.action === 'DELETED' ? 'bg-red-50 text-red-700 border-red-200' :
                            version.action === 'RESTORED' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                            'bg-blue-50 text-[#3b2fc9] border-blue-200'
                          }
                        >
                          {version.action || 'UPDATED'}
                        </Badge>
                        <time className="text-xs font-semibold text-gray-500 uppercase">
                          {version.editedAt ? format(new Date(version.editedAt), "MMM d, yyyy h:mm a") : 'Unknown Date'}
                        </time>
                      </div>
                      {idx === 0 && <Badge variant="secondary" className="bg-gray-100 text-gray-700">Latest Backup</Badge>}
                    </div>
                    <div className="text-sm text-gray-700 mb-3 space-y-1">
                      <p><span className="font-medium text-gray-900">User:</span> {formatAuthorName(version.editedBy)}</p>
                      
                      {diffs ? (
                        <div className="mt-2 bg-blue-50 border border-blue-100 p-2 rounded text-xs space-y-1">
                          <p className="font-medium text-blue-800 mb-1">Changes made in this version:</p>
                          {diffs.map((d, i) => (
                            <p key={i} className="text-blue-700 flex items-center gap-1">
                              <span className="w-1 h-1 rounded-full bg-blue-400"></span> {d}
                            </p>
                          ))}
                        </div>
                      ) : (
                        <>
                          <p><span className="font-medium text-gray-900">Total Items:</span> {version.previousData.lineItems?.length || 0}</p>
                          <p><span className="font-medium text-gray-900">Location:</span> <span className="capitalize">{version.previousData.location}</span></p>
                        </>
                      )}
                    </div>
                    {version.previousData && (
                      <Button
                        onClick={() => handleRestore(version.previousData)}
                        variant="outline"
                        size="sm"
                        className="w-full h-8 text-xs gap-1 border-emerald-200 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800"
                      >
                        <RotateCcw className="h-3 w-3" /> Revert to this state
                      </Button>
                    )}
                  </div>
                </div>
                );
              })}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
