import { NewRelicChallanItem } from '@/types/challan';
import React from 'react';


interface ChallanSummaryProps {
  lineItems?: Partial<NewRelicChallanItem>[];
  canSeeMrp: boolean;
  canSeePCost: boolean;
}

export function ChallanSummary({ lineItems, canSeeMrp, canSeePCost }: ChallanSummaryProps) {
  if (!canSeeMrp) return null;

  const items = lineItems || [];
  const itemCount = items.length;
  const totalQty = items.reduce((acc, item) => acc + (Number(item?.quantity) || 0), 0);
  const totalMrp = items.reduce((acc, item) => acc + ((Number(item?.mrp) || 0) * (Number(item?.quantity) || 0)), 0);
  const totalPCost = items.reduce((acc, item) => acc + ((Number(item?.procurementCost) || 0) * (Number(item?.quantity) || 0)), 0);

  return (
    <div className="flex flex-wrap items-center justify-between gap-4 py-2 px-3 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-600">
      <div className="flex gap-4">
        <span>Items: <strong className="text-gray-900">{itemCount}</strong></span>
        <span>Total Qty: <strong className="text-gray-900">{totalQty}</strong></span>
      </div>
      <div className="flex gap-4">
        <span>
          Total MRP:{' '}
          <strong className="text-gray-900">
            ₹{totalMrp.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </strong>
        </span>
        {canSeePCost && (
          <span>
            Total P.Cost:{' '}
            <strong className="text-gray-900">
              ₹{totalPCost.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </strong>
          </span>
        )}
      </div>
    </div>
  );
}
