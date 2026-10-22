import { CatalogItem, PricingItem } from '@/types/challan';
import React from 'react';
import { UseFormRegister, FieldErrors, UseFieldArrayRemove, UseFormSetValue } from 'react-hook-form';
import { Trash2 } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';


interface ChallanLineItemProps {
  index: number;
  fieldId: string;
  register: UseFormRegister<any>;
  errors: any;
  setValue: UseFormSetValue<any>;
  remove: UseFieldArrayRemove;
  fieldsLength: number;
  canSeeMrp: boolean;
  canSeePCost: boolean;
  catalog: CatalogItem[];
  pricingItems?: PricingItem[];
  watchedLineItems: any[];
  handleItemNameChange: (index: number, selectedItemName: string, currentBrandName?: string) => void;
}

export function ChallanLineItem({
  index,
  fieldId,
  register,
  errors,
  setValue,
  remove,
  fieldsLength,
  canSeeMrp,
  canSeePCost,
  catalog,
  pricingItems = [],
  watchedLineItems,
  handleItemNameChange,
}: ChallanLineItemProps) {
  const rowBrand = (watchedLineItems?.[index]?.brandName || '').trim().toLowerCase();
  
  // Combine items from catalog and pricing items for comprehensive autocomplete
  const allItems = [
    ...catalog.map((c) => ({ brandName: c.brandName, itemName: c.itemName })),
    ...pricingItems.map((p) => ({ brandName: p.brandName, itemName: p.itemName })),
  ];

  const rawFilteredItems = rowBrand
    ? allItems.filter((c) => (c.brandName || '').trim().toLowerCase() === rowBrand)
    : allItems;
    
  // Deduplicate item names for the datalist
  const uniqueItemNames = Array.from(new Set(rawFilteredItems.map((c) => (c.itemName || '').trim()).filter(Boolean)));
  const datalistId = `newrelic-item-list-${index}`;

  return (
    <div
      key={fieldId}
      className={cn(
        "p-3 sm:p-0 bg-gray-50/80 sm:bg-transparent rounded-xl border border-gray-200/80 sm:border-0 grid grid-cols-1 gap-2.5 sm:gap-2 items-start",
        canSeeMrp && canSeePCost ? "sm:grid-cols-[2fr_3fr_1fr_1.5fr_1fr_1fr_auto]" : 
        canSeeMrp ? "sm:grid-cols-[2fr_3fr_1fr_1.5fr_1fr_auto]" : "sm:grid-cols-[2fr_3fr_1fr_1.5fr_auto]"
      )}
    >
      {/* Mobile Card Header: Item index badge and quick remove button */}
      <div className="flex sm:hidden items-center justify-between pb-1.5 border-b border-gray-200/60">
        <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wide flex items-center gap-1.5">
          <span className="h-4.5 w-4.5 rounded-full bg-[#3b2fc9]/10 text-[#3b2fc9] flex items-center justify-center text-[10px] font-bold">
            {index + 1}
          </span>
          Item #{index + 1}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-6 px-2 text-red-500 hover:text-red-700 hover:bg-red-50 text-[11px] gap-1 -mr-1"
          onClick={() => remove(index)}
          disabled={fieldsLength === 1}
        >
          <Trash2 className="h-3.5 w-3.5" />
          <span>Remove</span>
        </Button>
      </div>

      {/* Brand Name */}
      <div className="space-y-1 sm:space-y-0">
        <Label className="text-xs text-gray-500 sm:hidden">Brand Name</Label>
        <Input
          {...register(`lineItems.${index}.brandName`, {
            onChange: (e) => {
              const newBrand = e.target.value;
              const currentItem = watchedLineItems?.[index]?.itemName;
              if (currentItem && currentItem.trim()) {
                handleItemNameChange(index, currentItem, newBrand);
              }
            },
          })}
          list="newrelic-brand-list"
          placeholder="e.g. Happilo"
          autoComplete="off"
          onFocus={(e) => e.target.select()}
          className={cn(errors.lineItems?.[index]?.brandName && 'border-red-400')}
        />

        {errors.lineItems?.[index]?.brandName && (
          <p className="text-xs text-red-500 mt-0.5">
            {errors.lineItems[index]?.brandName?.message as string}
          </p>
        )}
      </div>

      {/* Item Name */}
      <div className="space-y-1 sm:space-y-0">
        <Label className="text-xs text-gray-500 sm:hidden">Item Name</Label>
        <datalist id={datalistId}>
          {uniqueItemNames.map((itemName, idx) => (
            <option key={`${itemName}-${idx}`} value={itemName} />
          ))}
        </datalist>
        <Input
          {...register(`lineItems.${index}.itemName`, {
            onChange: (e) => handleItemNameChange(index, e.target.value, watchedLineItems?.[index]?.brandName),
          })}
          list={datalistId}
          placeholder="e.g. Chilli garlic makhana"
          autoComplete="off"
          onFocus={(e) => e.target.select()}
          className={cn(errors.lineItems?.[index]?.itemName && 'border-red-400')}
        />
        {errors.lineItems?.[index]?.itemName && (
          <p className="text-xs text-red-500 mt-0.5">
            {errors.lineItems[index]?.itemName?.message as string}
          </p>
        )}
      </div>

      {/* Qty & Expiry on mobile grid */}
      <div className="grid grid-cols-2 sm:contents gap-2">
        <div className="space-y-1 sm:space-y-0">
          <Label className="text-xs text-gray-500 sm:hidden">Qty</Label>
          <Input
            {...register(`lineItems.${index}.quantity`)}
            type="number"
            min={1}
            placeholder="Qty"
            className={cn(errors.lineItems?.[index]?.quantity && 'border-red-400')}
          />
        </div>

        <div className="space-y-1 sm:space-y-0">
          <Label className="text-xs text-gray-500 sm:hidden">Expiry</Label>
          <Input
            {...register(`lineItems.${index}.expiry`)}
            placeholder="Expiry (e.g. 15-05-2026)"
            className={cn(errors.lineItems?.[index]?.expiry && 'border-red-400')}
          />
          {errors.lineItems?.[index]?.expiry && (
            <p className="text-xs text-red-500 mt-0.5 sm:hidden">
              {errors.lineItems[index]?.expiry?.message as string}
            </p>
          )}
        </div>
      </div>

      {/* MRP & P.Cost side-by-side on mobile, direct columns on desktop */}
      {(canSeeMrp || canSeePCost) && (
        <div className={cn(
          "grid gap-2 sm:contents",
          canSeeMrp && canSeePCost ? "grid-cols-2" : "grid-cols-1"
        )}>
          {canSeeMrp && (
            <div className="space-y-1 sm:space-y-0">
              <Label className="text-xs text-gray-500 sm:hidden">MRP</Label>
              <Input
                {...register(`lineItems.${index}.mrp`)}
                type="number"
                step="0.01"
                min={0}
                placeholder="MRP"
                className={cn(errors.lineItems?.[index]?.mrp && 'border-red-400')}
              />
            </div>
          )}
          {canSeePCost && (
            <div className="space-y-1 sm:space-y-0">
              <Label className="text-xs text-gray-500 sm:hidden">P.Cost</Label>
              <Input
                {...register(`lineItems.${index}.procurementCost`)}
                type="number"
                step="0.01"
                min={0}
                placeholder="Cost"
                className={cn(errors.lineItems?.[index]?.procurementCost && 'border-red-400')}
              />
            </div>
          )}
        </div>
      )}

      {/* Desktop Remove Button (in table column) */}
      <div className="hidden sm:block">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-red-400 hover:text-red-600 hover:bg-red-50 h-9 w-9 p-0"
          onClick={() => remove(index)}
          disabled={fieldsLength === 1}
          title="Remove Item"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
