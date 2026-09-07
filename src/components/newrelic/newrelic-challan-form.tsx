'use client';

import React, { useId, useEffect, useState } from 'react';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format } from 'date-fns';
import { CalendarIcon, Plus, Trash2, FileDown, Save, Loader2, Sparkles, UploadCloud, FileText } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import {
  NewRelicChallan,
  NewRelicChallanItem,
  NewRelicLocation,
  NEWRELIC_LOCATIONS,
  saveNewRelicChallan,
  getSuggestedDcNumber,
} from '@/services/newrelicChallanService';
import { getCatalogItems, CatalogItem } from '@/services/newrelicCatalogService';
import {
  parseUploadedInvoiceFile,
  parseSampleInvoice,
  SAMPLE_INVOICES_LIST,
} from '@/services/newrelicInvoiceParser';
import { useToast } from '@/hooks/use-toast';

/* ─── Module-level regex constants ───────────────────────────────────────────
 * Kept outside the component to prevent Turbopack's CSS scanner from
 * misinterpreting bracket regex patterns as Tailwind utility classes.
 */
const DC_PREFIX_STRIP_RE = new RegExp('^(?:HMB|INV|SO|DOC|BILL|DC)[\\s:-]*', 'i');
const ALPHANUMERIC_RE = /[^A-Za-z0-9]/g;
const DIGITS_ONLY_RE = /^\d+$/;

/* ─── Zod schema ─────────────────────────────────────────────────── */
const lineItemSchema = z.object({
  id: z.number(),
  brandName: z.string().optional().default(''),
  itemName: z.string().optional().default(''),
  quantity: z.coerce.number().min(1, 'Quantity must be ≥ 1'),
  expiry: z.string().optional(),
});

const challanSchema = z
  .object({
    dcNumber: z.string().min(1, 'DC Number is required'),
    location: z.enum(['hyderabad', 'bangalore']),
    dcDate: z.date(),
    lineItems: z.array(lineItemSchema),
    note: z.string().optional(),
  })
  .refine(
    (data) =>
      data.lineItems.some(
        (item) => item.itemName && item.itemName.trim() !== ''
      ),
    {
      message: 'Add at least one item with an item name',
      path: ['lineItems'],
    }
  );

type FormValues = z.infer<typeof challanSchema>;

/* ─── Props ──────────────────────────────────────────────────────── */
interface NewRelicChallanFormProps {
  initialData?: NewRelicChallan | null;
  onChallanSave: (saved?: NewRelicChallan) => void;
  onAddNew: () => void;
}

/* ─── Component ──────────────────────────────────────────────────── */
export function NewRelicChallanForm({
  initialData,
  onChallanSave,
  onAddNew,
}: NewRelicChallanFormProps) {
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);
  const [isParsingInvoice, setIsParsingInvoice] = useState(false);
  const [selectedSample, setSelectedSample] = useState<string>('');
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const formId = useId();

  const defaultValues: FormValues = {
    dcNumber: initialData?.dcNumber ?? '',
    location: (initialData?.location as NewRelicLocation) ?? 'hyderabad',
    dcDate: initialData?.dcDate ? new Date(initialData.dcDate) : new Date(),
    lineItems: initialData?.lineItems?.length
      ? initialData.lineItems
      : [{ id: 1, brandName: '', itemName: '', quantity: 1, expiry: '' }],
    note: initialData?.note ?? '',
  };

  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
    watch,
    setValue,
    reset,
  } = useForm<FormValues>({
    resolver: zodResolver(challanSchema),
    defaultValues,
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'lineItems',
  });

  const watchedLocation = watch('location') as NewRelicLocation;
  const watchedDcNumber = watch('dcNumber');
  const watchedLineItems = watch('lineItems');

  /* ── Load Catalog for Autocomplete ── */
  useEffect(() => {
    getCatalogItems().then((items) => setCatalog(items));
  }, []);

  /* ── Auto-suggest DC Number when location changes and DC field is empty ── */
  useEffect(() => {
    // Fires for new challans AND duplicates (both have no id).
    // Does NOT fire when editing an existing challan (which has an id).
    if (!initialData?.id) {
      getSuggestedDcNumber(watchedLocation).then((suggested) => {
        setValue('dcNumber', suggested);
      });
    }
  }, [watchedLocation, initialData, setValue]);

  const addItems = (count: number) => {
    let lastBrand = '';
    if (watchedLineItems && watchedLineItems.length > 0) {
      for (let i = watchedLineItems.length - 1; i >= 0; i--) {
        if (watchedLineItems[i]?.brandName?.trim()) {
          lastBrand = watchedLineItems[i].brandName.trim();
          break;
        }
      }
    }
    const newRows = [];
    const baseTime = Date.now();
    for (let i = 0; i < count; i++) {
      newRows.push({
        id: baseTime + i,
        brandName: lastBrand,
        itemName: '',
        quantity: 1,
        expiry: '',
      });
    }
    append(newRows);
  };

  const handleParseInvoice = async (file?: File, sampleName?: string) => {
    setIsParsingInvoice(true);
    try {
      let data;
      if (file) {
        data = await parseUploadedInvoiceFile(file);
      } else if (sampleName) {
        data = await parseSampleInvoice(sampleName);
      } else {
        return;
      }

      if (data.lineItems && data.lineItems.length > 0) {
        const baseTime = Date.now();
        const primaryBrand = data.brandName?.trim() || '';

        const newRows = data.lineItems.map((item, idx) => ({
          id: baseTime + idx,
          brandName: item.brandName?.trim() || primaryBrand,
          itemName: item.itemName,
          quantity: Number(item.quantity) || 1,
          expiry: item.expiry || '',
        }));

        // Replace form items completely with newly extracted invoice items
        setValue('lineItems', newRows);

        if (data.dcNumber && data.dcNumber.trim()) {
          const rawClean = data.dcNumber.replace(DC_PREFIX_STRIP_RE, '').replace(ALPHANUMERIC_RE, '').trim();
          const currentLoc = watchedLocation || 'hyderabad';
          const prefix = NEWRELIC_LOCATIONS[currentLoc]?.dcPrefix || 'HYD';
          const formattedDc = DIGITS_ONLY_RE.test(rawClean) ? `${prefix}${rawClean}` : (rawClean.toUpperCase() || data.dcNumber.trim());
          setValue('dcNumber', formattedDc);
        }

        if (data.date) {
          const parsedDate = new Date(data.date);
          if (!isNaN(parsedDate.getTime())) {
            setValue('dcDate', parsedDate);
          }
        }

        toast({
          title: 'Invoice Parsed Successfully! ✨',
          description: `Extracted ${data.lineItems.length} items${data.brandName ? ` (${data.brandName})` : ''}.`,
        });
      } else {
        toast({
          variant: 'destructive',
          title: 'No items found',
          description: 'Could not extract line items from this invoice.',
        });
      }
    } catch (err) {
      console.error('Invoice parsing error:', err);
      toast({
        variant: 'destructive',
        title: 'Parsing Failed',
        description: err instanceof Error ? err.message : 'Failed to parse invoice file.',
      });
    } finally {
      setIsParsingInvoice(false);
    }
  };

  const handleItemNameChange = (index: number, selectedItemName: string) => {
    // If selected item exists in catalog, auto-fill default quantity & brand name
    const match = catalog.find(
      (c) => c.itemName.toLowerCase() === selectedItemName.trim().toLowerCase()
    );
    if (match) {
      if (match.brandName) {
        setValue(`lineItems.${index}.brandName`, match.brandName);
      }
      if (match.defaultQuantity) {
        setValue(`lineItems.${index}.quantity`, match.defaultQuantity);
      }
    }
  };

  const onSubmit = async (values: FormValues, shouldDownload = true) => {
    setIsSaving(true);
    try {
      // Ignore any trailing or incomplete rows that only have brand name (no item name)
      const validItems = (values.lineItems || [])
        .filter((item) => item.itemName && item.itemName.trim() !== '')
        .map((item) => ({
          ...item,
          brandName: item.brandName?.trim() || '',
          itemName: item.itemName!.trim(),
          quantity: Number(item.quantity) || 1,
          expiry: item.expiry?.trim() || '',
        }));

      if (validItems.length === 0) {
        toast({
          variant: 'destructive',
          title: 'Validation Error',
          description: 'Please fill in at least one item name.',
        });
        setIsSaving(false);
        return;
      }

      const payload = {
        id: initialData?.id,
        dcNumber: values.dcNumber,
        location: values.location,
        dcDate: values.dcDate.toISOString(),
        lineItems: validItems as NewRelicChallanItem[],
        note: values.note,
      };
      const saved = await saveNewRelicChallan(payload);
      toast({
        title: 'Challan saved',
        description: `DC No: ${saved.dcNumber}`,
      });
      onChallanSave(shouldDownload ? saved : undefined);
      reset(defaultValues);
    } catch (err) {
      console.error(err);
      toast({
        variant: 'destructive',
        title: 'Save failed',
        description: err instanceof Error ? err.message : 'Unknown error',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const isEditing = !!initialData?.id;
  const isDuplicating = !!initialData && !initialData.id;
  const locationConfig = NEWRELIC_LOCATIONS[watchedLocation];

  // Derived unique brand names for datalist
  const uniqueBrands = Array.from(
    new Set(catalog.map((c) => c.brandName).filter(Boolean))
  );

  return (
    <form
      id={`${formId}-form`}
      onSubmit={handleSubmit((v) => onSubmit(v, true))}
      className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 sm:p-6 space-y-5 sm:space-y-6"
    >
      {/* Autocomplete Datalists */}
      <datalist id="newrelic-brand-list">
        {uniqueBrands.map((b) => (
          <option key={b} value={b} />
        ))}
      </datalist>
      <datalist id="newrelic-item-list">
        {catalog.map((item, idx) => (
          <option key={`${item.itemName}-${idx}`} value={item.itemName}>
            {item.brandName ? `${item.brandName} · Default Qty: ${item.defaultQuantity}` : ''}
          </option>
        ))}
      </datalist>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-4">
        <div>
          <h2 className="text-lg sm:text-xl font-bold text-gray-900">
            {isEditing
              ? `Edit Challan — ${initialData?.dcNumber}`
              : isDuplicating
              ? `Duplicate Challan — new DC: ${watchedDcNumber}`
              : 'New Delivery Challan'}
          </h2>
          <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
            NewRelic · Returnable Items DC
          </p>
        </div>
        {(isEditing || isDuplicating) && (
          <Button type="button" variant="outline" size="sm" onClick={onAddNew} className="self-start sm:self-auto">
            + New Challan
          </Button>
        )}
      </div>

      {/* DC Number + Location + Date row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 sm:gap-4">
        {/* DC Number */}
        <div className="space-y-1.5">
          <Label htmlFor={`${formId}-dcNumber`}>DC Number</Label>
          <Input
            id={`${formId}-dcNumber`}
            {...register('dcNumber')}
            placeholder="e.g. HYD001 or BLR001"
            className={cn('font-semibold text-[#3b2fc9]', errors.dcNumber && 'border-red-500')}
          />
          {errors.dcNumber ? (
            <p className="text-xs text-red-500">{errors.dcNumber.message}</p>
          ) : (
            <p className="text-[11px] text-gray-400">Editable delivery challan reference</p>
          )}
        </div>

        {/* Location */}
        <div className="space-y-1.5">
          <Label htmlFor={`${formId}-location`}>Location</Label>
          <Controller
            name="location"
            control={control}
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id={`${formId}-location`}>
                  <SelectValue placeholder="Select location" />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(NEWRELIC_LOCATIONS) as NewRelicLocation[]).map((loc) => (
                    <SelectItem key={loc} value={loc}>
                      {NEWRELIC_LOCATIONS[loc].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
          {errors.location && (
            <p className="text-xs text-red-500">{errors.location.message}</p>
          )}
        </div>

        {/* Date */}
        <div className="space-y-1.5">
          <Label>DC Date</Label>
          <Controller
            name="dcDate"
            control={control}
            render={({ field }) => (
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      'w-full justify-start text-left font-normal',
                      !field.value && 'text-muted-foreground'
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {field.value ? format(field.value, 'dd-MM-yyyy') : 'Pick a date'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={field.value}
                    onSelect={field.onChange}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            )}
          />
          {errors.dcDate && (
            <p className="text-xs text-red-500">{errors.dcDate.message}</p>
          )}
        </div>
      </div>

      {/* Location Address Preview */}
      <div className="bg-gray-50 border border-gray-100 rounded-xl p-3 text-xs text-gray-500 space-y-1">
        <span className="font-semibold text-gray-700">Recipient Address ({locationConfig.label}):</span>
        <p className="whitespace-pre-wrap leading-relaxed text-[11px] sm:text-xs">{locationConfig.address}</p>
      </div>

      {/* ── Local Invoice Auto-Parser Banner ── */}
      <div className="bg-gradient-to-r from-indigo-50 via-purple-50 to-blue-50 border border-indigo-100 rounded-2xl p-4 sm:p-5 space-y-3 shadow-xs">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-[#3b2fc9]/10 rounded-xl text-[#3b2fc9]">
              <Sparkles className="h-4 w-4 sm:h-5 sm:w-5" />
            </div>
            <div>
              <h3 className="font-bold text-gray-900 text-xs sm:text-sm flex items-center gap-1.5">
                Local Invoice / Challan Parser
                <span className="bg-[#3b2fc9] text-white text-[10px] px-2 py-0.5 rounded-full font-medium">
                  Fast & Local
                </span>
              </h3>
              <p className="text-[11px] sm:text-xs text-gray-500">
                Upload any vendor invoice (PDF or Image) to automatically populate item rows using local parser
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 pt-1">
          {/* File Upload Button */}
          <div className="relative flex-1">
            <input
              type="file"
              accept=".pdf,.png,.jpg,.jpeg"
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
              disabled={isParsingInvoice}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  handleParseInvoice(file);
                  e.target.value = '';
                }
              }}
            />
            <Button
              type="button"
              variant="outline"
              disabled={isParsingInvoice}
              className="w-full h-10 border-indigo-200 bg-white text-indigo-700 hover:bg-indigo-50 hover:border-indigo-300 text-xs gap-2 shadow-xs"
            >
              {isParsingInvoice ? (
                <Loader2 className="h-4 w-4 animate-spin text-[#3b2fc9]" />
              ) : (
                <UploadCloud className="h-4 w-4 text-[#3b2fc9]" />
              )}
              {isParsingInvoice ? 'Extracting Items Locally...' : 'Upload & Extract Invoice (PDF/Image)'}
            </Button>
          </div>

          <span className="text-xs text-gray-400 text-center font-medium">or</span>

          {/* Sample Invoice Dropdown */}
          <div className="flex-1 flex gap-1.5">
            <Select
              value={selectedSample}
              onValueChange={setSelectedSample}
              disabled={isParsingInvoice}
            >
              <SelectTrigger className="h-10 text-xs bg-white border-indigo-200 text-gray-700">
                <SelectValue placeholder="Select sample invoice..." />
              </SelectTrigger>
              <SelectContent className="max-h-60 text-xs">
                {SAMPLE_INVOICES_LIST.map((item) => (
                  <SelectItem key={item.name} value={item.name} className="text-xs">
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button
              type="button"
              variant="secondary"
              disabled={isParsingInvoice || !selectedSample}
              onClick={() => handleParseInvoice(undefined, selectedSample)}
              className="h-10 px-3 text-xs bg-indigo-100 text-indigo-800 hover:bg-indigo-200 whitespace-nowrap gap-1"
            >
              {isParsingInvoice ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <FileText className="h-3.5 w-3.5" />
              )}
              Parse Sample
            </Button>
          </div>
        </div>
      </div>

      {/* Line items */}
      <div className="space-y-3">
        <div>
          <Label className="text-sm sm:text-base font-semibold">Items</Label>
          <p className="text-[11px] sm:text-xs text-gray-400">Type to search saved brands &amp; catalog</p>
        </div>

        {/* Table header for desktop */}
        <div className="hidden sm:grid grid-cols-[2fr_3fr_1fr_1.5fr_auto] gap-2 text-xs font-semibold text-gray-500 uppercase tracking-wide px-1">
          <span>Brand Name</span>
          <span>Item Name</span>
          <span>Qty</span>
          <span>Expiry (opt)</span>
          <span />
        </div>

        {fields.map((field, index) => (
          <div
            key={field.id}
            className="p-3 sm:p-0 bg-gray-50/80 sm:bg-transparent rounded-xl border border-gray-200/80 sm:border-0 grid grid-cols-1 sm:grid-cols-[2fr_3fr_1fr_1.5fr_auto] gap-2.5 sm:gap-2 items-start"
          >
            {/* Brand Name */}
            <div className="space-y-1 sm:space-y-0">
              <Label className="text-xs text-gray-500 sm:hidden">Brand Name</Label>
              <Input
                {...register(`lineItems.${index}.brandName`)}
                list="newrelic-brand-list"
                placeholder="e.g. Happilo"
                className={cn(errors.lineItems?.[index]?.brandName && 'border-red-400')}
              />
              {errors.lineItems?.[index]?.brandName && (
                <p className="text-xs text-red-500 mt-0.5">
                  {errors.lineItems[index]?.brandName?.message}
                </p>
              )}
            </div>

            {/* Item Name */}
            <div className="space-y-1 sm:space-y-0">
              <Label className="text-xs text-gray-500 sm:hidden">Item Name</Label>
              <Input
                {...register(`lineItems.${index}.itemName`, {
                  onChange: (e) => handleItemNameChange(index, e.target.value),
                })}
                list="newrelic-item-list"
                placeholder="e.g. Chilli garlic maKhana"
                className={cn(errors.lineItems?.[index]?.itemName && 'border-red-400')}
              />
              {errors.lineItems?.[index]?.itemName && (
                <p className="text-xs text-red-500 mt-0.5">
                  {errors.lineItems[index]?.itemName?.message}
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
                <Label className="text-xs text-gray-500 sm:hidden">Expiry (optional)</Label>
                <Input
                  {...register(`lineItems.${index}.expiry`)}
                  placeholder="Expiry (optional)"
                  className={cn(errors.lineItems?.[index]?.expiry && 'border-red-400')}
                />
              </div>
            </div>

            {/* Remove */}
            <div className="flex justify-end sm:block pt-1 sm:pt-0">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-red-500 sm:text-red-400 hover:text-red-600 hover:bg-red-50 sm:h-9 sm:w-9 px-3 sm:px-0 text-xs sm:text-sm"
                onClick={() => remove(index)}
                disabled={fields.length === 1}
              >
                <Trash2 className="h-4 w-4 mr-1 sm:mr-0" />
                <span className="sm:hidden">Remove Item</span>
              </Button>
            </div>
          </div>
        ))}

        {/* Quick Add Batch Buttons directly below rows */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-gray-100">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => addItems(1)}
            className="h-9 px-3 text-xs gap-1.5 border-gray-200 text-gray-700 hover:border-[#3b2fc9] hover:text-[#3b2fc9] hover:bg-blue-50/50"
          >
            <Plus className="h-3.5 w-3.5" /> Add 1 Item
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => addItems(2)}
            className="h-9 px-3 text-xs gap-1.5 border-gray-200 text-gray-700 hover:border-[#3b2fc9] hover:text-[#3b2fc9] hover:bg-blue-50/50"
          >
            <Plus className="h-3.5 w-3.5" /> + 2 Items
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => addItems(3)}
            className="h-9 px-3 text-xs gap-1.5 border-gray-200 text-gray-700 hover:border-[#3b2fc9] hover:text-[#3b2fc9] hover:bg-blue-50/50"
          >
            <Plus className="h-3.5 w-3.5" /> + 3 Items
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => addItems(5)}
            className="h-9 px-3 text-xs gap-1.5 border-gray-200 text-gray-700 hover:border-[#3b2fc9] hover:text-[#3b2fc9] hover:bg-blue-50/50"
          >
            <Plus className="h-3.5 w-3.5" /> + 5 Items
          </Button>
        </div>

        {errors.lineItems?.root && (
          <p className="text-xs text-red-500">{errors.lineItems.root.message}</p>
        )}
        {typeof errors.lineItems?.message === 'string' && (
          <p className="text-xs text-red-500">{errors.lineItems.message}</p>
        )}
      </div>

      {/* Note */}
      <div className="space-y-1.5">
        <Label htmlFor={`${formId}-note`}>Note (optional)</Label>
        <Textarea
          id={`${formId}-note`}
          {...register('note')}
          placeholder="Any additional notes..."
          rows={2}
        />
      </div>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-2.5 sm:gap-3 pt-2">
        <Button
          type="submit"
          className="w-full sm:flex-1 h-11 sm:h-10 bg-[#3b2fc9] hover:bg-[#2d23a0] text-white gap-2"
          disabled={isSaving}
        >
          {isSaving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <FileDown className="h-4 w-4" />
          )}
          {isEditing ? 'Update & Download' : isDuplicating ? 'Save Duplicate & Download' : 'Save & Download PDF'}
        </Button>
        <Button
          type="button"
          variant="outline"
          className="w-full sm:flex-1 h-11 sm:h-10 gap-2"
          disabled={isSaving}
          onClick={handleSubmit((v) => onSubmit(v, false))}
        >
          <Save className="h-4 w-4" />
          {isEditing ? 'Update Only' : isDuplicating ? 'Save Duplicate Only' : 'Save Only'}
        </Button>
      </div>
    </form>
  );
}
