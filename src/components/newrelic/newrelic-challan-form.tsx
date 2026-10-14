'use client';

import React, { useId, useEffect, useState, useRef } from 'react';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format } from 'date-fns';
import { CalendarIcon, Plus, Trash2, FileDown, Save, Loader2, Sparkles, UploadCloud, FileText, Paperclip, AlertTriangle, MapPin, ChevronDown, ChevronUp, Calculator } from 'lucide-react';
import { MrpCalculatorModal } from '@/components/newrelic/mrp-calculator-modal';

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
  NEWRELIC_LOCATIONS,
  saveNewRelicChallan,
  getSuggestedDcNumber,
  checkDuplicateDcNumber,
} from '@/services/newrelicChallanService';
import { getCatalogItems } from '@/services/newrelicCatalogService';
import { getPricingItems, buildPricingMap } from '@/services/newrelicPricingService';
import {
  NewRelicChallan,
  NewRelicChallanItem,
  NewRelicLocation,
  CatalogItem,
  PricingItem,
  challanSchema,
  ChallanFormValues as FormValues
} from '@/types/challan';
import {
  parseUploadedInvoiceFile,
  parseSampleInvoice,
  SAMPLE_INVOICES_LIST,
} from '@/services/newrelicInvoiceParser';
import { useToast } from '@/hooks/use-toast';
import { NewRelicAttachmentModal } from '@/components/newrelic/newrelic-attachment-modal';
import { PdfAutoParser } from './challan-form/pdf-auto-parser';
import { ChallanSummary } from './challan-form/challan-summary';
import { ChallanLineItem } from './challan-form/challan-line-item';

/* ─── Module-level regex constants ───────────────────────────────────────────
 * Kept outside the component to prevent Turbopack's CSS scanner from
 * misinterpreting bracket regex patterns as Tailwind utility classes.
 */
const DC_PREFIX_STRIP_RE = new RegExp('^(?:HMB|INV|SO|DOC|BILL|DC)[\\s:-]*', 'i');
const ALPHANUMERIC_RE = /[^A-Za-z0-9]/g;
const DIGITS_ONLY_RE = /^\d+$/;



/* ─── Props ──────────────────────────────────────────────────────── */
interface NewRelicChallanFormProps {
  initialData?: NewRelicChallan | null;
  defaultLocation?: NewRelicLocation;
  onChallanSave: (saved?: NewRelicChallan) => void;
  onAddNew: () => void;
  onCancel?: () => void;
}

/* ─── Component ──────────────────────────────────────────────────── */
export function NewRelicChallanForm({
  initialData,
  defaultLocation,
  onChallanSave,
  onAddNew,
  onCancel,
}: NewRelicChallanFormProps) {
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);
  const [isParsingInvoice, setIsParsingInvoice] = useState(false);
  const [selectedSample, setSelectedSample] = useState<string>('');
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [pricingMap, setPricingMap] = useState<Map<string, number>>(new Map());
  const [pricingItems, setPricingItems] = useState<PricingItem[]>([]);
  const [duplicateError, setDuplicateError] = useState<string | null>(null);
  const hasBackfilledPCost = useRef(false); // ensure backfill only fires once
  const [showSignedCopyModal, setShowSignedCopyModal] = useState(false);
  const [showGoodsReceivedModal, setShowGoodsReceivedModal] = useState(false);
  const [currentData, setCurrentData] = useState<NewRelicChallan | null>(initialData || null);
  const formId = useId();

  const defaultValues: FormValues = {
    dcNumber: initialData?.dcNumber ?? '',
    location: (initialData?.location as NewRelicLocation) ?? defaultLocation ?? 'hyderabad',
    dcDate: initialData?.dcDate ? new Date(initialData.dcDate) : new Date(),
    lineItems: initialData?.lineItems?.length
      ? (initialData.lineItems.map(item => ({ ...item, expiry: item.expiry || '' })) as any)
      : [{ id: 1, brandName: '', itemName: '', quantity: 1, expiry: '', mrp: undefined }],
    note: initialData?.note ?? '',
    transportCost: initialData?.transportCost ?? undefined,
    otherCharges: initialData?.otherCharges ?? undefined,
    procurementCost: initialData?.procurementCost ?? undefined,
  };

  const { role, user } = useAuth();
  const isAdmin = role === 'admin' || role === 'superadmin';
  const isManager = role === 'manager';
  const canSeeMrp = isAdmin || isManager;
  // P.Cost is visible to admins without financial password unlock, but strictly forbidden for user/manager
  const canSeePCost = isAdmin;
  const [isDockMinimized, setIsDockMinimized] = useState(false);
  const [showCalculator, setShowCalculator] = useState(false);

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
  const watchedDcDate = watch('dcDate');
  const watchedLineItems = watch('lineItems');
  const calculatedTotalPCost = watchedLineItems?.reduce((acc: number, item: any) => acc + ((Number(item.procurementCost) || 0) * (Number(item.quantity) || 0)), 0) || 0;
  const calculatedTotalMrp = watchedLineItems?.reduce((acc: number, item: any) => acc + ((Number(item.mrp) || 0) * (Number(item.quantity) || 0)), 0) || 0;
  const calculatedTotalQty = watchedLineItems?.reduce((acc: number, item: any) => acc + (Number(item.quantity) || 0), 0) || 0;

  /* ── Load Catalog for Autocomplete ── */
  useEffect(() => {
    getCatalogItems().then((items) => setCatalog(items));
  }, []);

  /* ── Auto-scroll to form top / items when opened for edit ── */
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    const timer = setTimeout(() => {
      const itemsEl = document.getElementById('challan-line-items-section');
      if (itemsEl && initialData?.id && window.innerWidth < 640) {
        itemsEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } else {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    }, 100);
    return () => clearTimeout(timer);
  }, [initialData?.id]);

  /* ── Load Pricing Map for P.Cost + MRP auto-fill (respects DC date) ── */
  useEffect(() => {
    if (canSeeMrp) {
      const targetDateStr = watchedDcDate instanceof Date ? watchedDcDate.toISOString().substring(0, 10) : undefined;
      getPricingItems(watchedLocation).then((items) => {
        setPricingItems(items);
        setPricingMap(buildPricingMap(items, targetDateStr));
      });
    }
  }, [watchedLocation, canSeeMrp, watchedDcDate]);

  /* ── In edit mode, backfill empty P.Cost & MRP cells once the pricing map is ready ── */
  useEffect(() => {
    // Guard: only run once per form instance — never overwrite values the user has set
    if (!canSeeMrp || pricingMap.size === 0 || hasBackfilledPCost.current) return;
    const items = watchedLineItems;
    if (!items || items.length === 0) return;
    hasBackfilledPCost.current = true;
    items.forEach((item, index) => {
      if (isAdmin) {
        const cost = Number(item.procurementCost);
        if (!cost || cost === 0) {
          const brand = (item.brandName || '').trim().toLowerCase();
          const name = (item.itemName || '').trim().toLowerCase();
          if (brand && name) {
            const key = `${brand}__${name}`;
            const priceFromMap = pricingMap.get(key);
            if (priceFromMap !== undefined) {
              setValue(`lineItems.${index}.procurementCost`, priceFromMap);
            }
          }
        }
      }
      
      // Also backfill MRP if empty
      const mrp = Number(item.mrp);
      if (!mrp || mrp === 0) {
        const brand = (item.brandName || '').trim().toLowerCase();
        const name = (item.itemName || '').trim().toLowerCase();
        if (!brand || !name) return;
        const entry = pricingItems.find(p =>
          p.brandName.toLowerCase() === brand && p.itemName.toLowerCase() === name
        );
        if (entry?.mrp) {
          setValue(`lineItems.${index}.mrp`, entry.mrp);
        }
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pricingMap, isAdmin]);

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

  /* ── Check for duplicate DC Number ── */
  useEffect(() => {
    if (!watchedDcNumber || watchedDcNumber.trim() === '') {
      setDuplicateError(null);
      return;
    }
    const timer = setTimeout(() => {
      checkDuplicateDcNumber(watchedDcNumber, initialData?.id).then((isDup) => {
        if (isDup) {
          setDuplicateError('⚠️ This DC Number is already in use by another active invoice.');
        } else {
          setDuplicateError(null);
        }
      });
    }, 500);
    return () => clearTimeout(timer);
  }, [watchedDcNumber, initialData?.id]);

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
        mrp: undefined,
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

  const handleItemNameChange = (index: number, selectedItemName: string, currentBrandName?: string) => {
    // If selected item exists in catalog, auto-fill default quantity & brand name
    const match = catalog.find(
      (c) => 
        c.itemName.toLowerCase() === selectedItemName.trim().toLowerCase() && 
        (!currentBrandName || c.brandName.toLowerCase() === currentBrandName.trim().toLowerCase())
    );
    if (match) {
      if (match.brandName) {
        setValue(`lineItems.${index}.brandName`, match.brandName);
      }
      if (match.defaultQuantity) {
        setValue(`lineItems.${index}.quantity`, match.defaultQuantity);
      }
      // Auto-fill MRP from pricing map — only when field is empty
      const mrpKey = `${match.brandName.trim().toLowerCase()}__${selectedItemName.trim().toLowerCase()}`;
      const pricingEntry = pricingItems.find(p =>
        p.brandName.toLowerCase() === match.brandName.toLowerCase() &&
        p.itemName.toLowerCase() === selectedItemName.trim().toLowerCase()
      );
      if (pricingEntry) {
        const currentMrp = watchedLineItems?.[index]?.mrp;
        if (!currentMrp || Number(currentMrp) === 0) {
          setValue(`lineItems.${index}.mrp`, pricingEntry.mrp);
        }
      }
      // Auto-fill P.Cost from pricing map — only when field is empty (never overwrite saved values)
      if (isAdmin) {
        const currentCost = watchedLineItems?.[index]?.procurementCost;
        if (!currentCost || Number(currentCost) === 0) {
          const key = `${match.brandName.trim().toLowerCase()}__${selectedItemName.trim().toLowerCase()}`;
          const cost = pricingMap.get(key);
          if (cost !== undefined) {
            setValue(`lineItems.${index}.procurementCost`, cost);
          }
        }
      }

    } else if (isAdmin) {
      // Also try matching just by item name across all brands in the pricing map
      const currentCost = watchedLineItems?.[index]?.procurementCost;
      if (!currentCost || Number(currentCost) === 0) {
        const currentBrand = watchedLineItems?.[index]?.brandName?.trim().toLowerCase() || '';
        const key = `${currentBrand}__${selectedItemName.trim().toLowerCase()}`;
        const cost = pricingMap.get(key);
        if (cost !== undefined) {
          setValue(`lineItems.${index}.procurementCost`, cost);
        }
      }
    }

  };

  const onSubmit = async (values: FormValues, shouldDownload = true) => {
    setIsSaving(true);
    try {
      // Ignore any trailing or incomplete rows that only have brand name (no item name)
      const validItems = (values.lineItems || [])
        .filter((item) => item.itemName && item.itemName.trim() !== '')
        .map((item, idx) => {
          const originalItem = initialData?.lineItems?.[idx] || ({} as any);
          // z.coerce.number() already coerced strings to numbers. "" becomes 0.
          const mrp = item.mrp ?? originalItem.mrp;
          const procurementCost = item.procurementCost ?? originalItem.procurementCost ?? originalItem.pCost ?? 0;

          return {
            ...item,
            brandName: item.brandName?.trim() || '',
            itemName: item.itemName!.trim(),
            quantity: Number(item.quantity) || 1,
            expiry: item.expiry?.trim() || '',
            mrp,
            procurementCost,
          };
        });

      if (validItems.length === 0) {
        toast({
          variant: 'destructive',
          title: 'Validation Error',
          description: 'Please fill in at least one item name.',
        });
        setIsSaving(false);
        return;
      }

      if (duplicateError) {
        toast({
          variant: 'destructive',
          title: 'Duplicate DC Number',
          description: 'Please use a unique DC Number before saving.',
        });
        setIsSaving(false);
        return;
      }

      const calculatedProcurementCost = validItems.reduce((acc, item) => acc + ((item.procurementCost || 0) * item.quantity), 0);

      const payload: any = {
        id: initialData?.id,
        dcNumber: values.dcNumber,
        location: values.location,
        dcDate: values.dcDate.toISOString(),
        lineItems: validItems as NewRelicChallanItem[],
        note: values.note,
        transportCost: values.transportCost,
        otherCharges: values.otherCharges,
        procurementCost: calculatedProcurementCost,
      };

      // Firebase throws an error if any field is strictly `undefined`. 
      // Deep clean the payload to remove undefined fields recursively.
      const cleanUndefined = (obj: any): any => {
        if (Array.isArray(obj)) {
          return obj.map(cleanUndefined);
        }
        if (obj !== null && typeof obj === 'object') {
          const newObj: any = {};
          Object.keys(obj).forEach((key) => {
            if (obj[key] !== undefined) {
              newObj[key] = cleanUndefined(obj[key]);
            }
          });
          return newObj;
        }
        return obj;
      };
      
      const cleanPayload = cleanUndefined(payload);
      const saved = await saveNewRelicChallan(cleanPayload, user?.email || null);
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

  // Show a toast when Zod / RHF validation fails so the buttons never appear "dead"
  const onValidationError = (formErrors: any) => {
    // Detailed logging for debugging
    if (Array.isArray(formErrors.lineItems)) {
      formErrors.lineItems.forEach((item: any, idx: number) => {
        if (item) {
          console.error(`  Item ${idx} errors:`, JSON.stringify(item));
        }
      });
    }
    console.error('Full form validation errors:', JSON.stringify(formErrors, null, 2));

    // Find first error message for the toast
    let firstMsg = 'Please check the form for errors.';
    if (formErrors.lineItems?.message) {
      firstMsg = formErrors.lineItems.message;
    } else if (formErrors.lineItems?.root?.message) {
      firstMsg = formErrors.lineItems.root.message;
    } else if (Array.isArray(formErrors.lineItems)) {
      for (const item of formErrors.lineItems) {
        if (item) {
          const field = Object.keys(item)[0];
          if (field && item[field]?.message) {
            firstMsg = `Line item ${field}: ${item[field].message}`;
            break;
          }
        }
      }
    } else {
      const field = Object.keys(formErrors)[0];
      if (field && formErrors[field]?.message) {
        firstMsg = formErrors[field].message;
      }
    }
    toast({
      variant: 'destructive',
      title: 'Validation Error',
      description: firstMsg,
    });
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
      onSubmit={handleSubmit((v) => onSubmit(v, true), onValidationError)}
      className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 sm:p-6 space-y-5 sm:space-y-6 pb-32 sm:pb-6"
    >
      {/* Autocomplete Datalists */}
      <datalist id="newrelic-brand-list">
        {uniqueBrands.map((b) => (
          <option key={b} value={b} />
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
            className={cn('font-semibold text-[#3b2fc9]', (errors.dcNumber || duplicateError) && 'border-red-500')}
          />
          {errors.dcNumber ? (
            <p className="text-xs text-red-500">{errors.dcNumber.message}</p>
          ) : duplicateError ? (
            <p className="text-xs text-red-500 font-medium">{duplicateError}</p>
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
              <Input
                type="date"
                value={field.value ? format(field.value, 'yyyy-MM-dd') : ''}
                onChange={(e) => {
                  const date = e.target.value ? new Date(e.target.value) : null;
                  field.onChange(date);
                }}
                className={cn(
                  'w-full bg-white',
                  errors.dcDate && 'border-red-400'
                )}
              />
            )}
          />
          {errors.dcDate && (
            <p className="text-xs text-red-500">{errors.dcDate.message}</p>
          )}
        </div>
      </div>

      {/* Location Address Preview - Desktop Full View */}
      <div className="hidden sm:block bg-gray-50 border border-gray-100 rounded-xl p-3 text-xs text-gray-500 space-y-1">
        <span className="font-semibold text-gray-700">Recipient Address ({locationConfig.label}):</span>
        <p className="whitespace-pre-wrap leading-relaxed text-xs">{locationConfig.address}</p>
      </div>

      {/* Location Address Preview - Mobile Compact Collapsible */}
      <details className="sm:hidden group bg-gray-50/90 border border-gray-200/80 rounded-xl p-2.5 text-xs text-gray-500 transition-colors">
        <summary className="font-medium text-gray-700 cursor-pointer list-none flex items-center justify-between select-none">
          <span className="flex items-center gap-1.5 truncate">
            <MapPin className="w-3.5 h-3.5 text-[#3b2fc9] shrink-0" />
            <span className="font-semibold text-gray-800">Recipient:</span>
            <span className="truncate">{locationConfig.label}</span>
          </span>
          <span className="text-[10px] text-[#3b2fc9] font-medium bg-[#3b2fc9]/10 px-2 py-0.5 rounded-full group-open:hidden shrink-0 ml-1">
            View Address ▾
          </span>
          <span className="text-[10px] text-gray-500 font-medium bg-gray-200/80 px-2 py-0.5 rounded-full hidden group-open:inline shrink-0 ml-1">
            Hide ▴
          </span>
        </summary>
        <p className="mt-2 pt-2 border-t border-gray-200/60 whitespace-pre-wrap leading-relaxed text-[11px] text-gray-600">
          {locationConfig.address}
        </p>
      </details>

      {/* ── Local Invoice Auto-Parser Banner (Hidden on Mobile) ── */}
      <div className="hidden sm:block">
        <PdfAutoParser 
          isParsingInvoice={isParsingInvoice}
          selectedSample={selectedSample}
          setSelectedSample={setSelectedSample}
          handleParseInvoice={handleParseInvoice}
        />
      </div>

      {/* Line items */}
      <div id="challan-line-items-section" className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <Label className="text-sm sm:text-base font-semibold">Items</Label>
            <p className="text-[11px] sm:text-xs text-gray-400">Type to search saved brands &amp; catalog</p>
          </div>
          <button
            type="button"
            onClick={() => {
              triggerHaptic('light');
              setShowCalculator(true);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-purple-50 to-indigo-50 hover:from-purple-100 hover:to-indigo-100 border border-purple-200/80 text-[#3b2fc9] text-xs font-bold shadow-2xs transition-all active:scale-95 cursor-pointer"
            title="Open MRP % Calculator"
          >
            <Calculator className="w-3.5 h-3.5" />
            <span>MRP % Calculator</span>
          </button>
        </div>

        {isEditing && isAdmin && (initialData?.procurementCost || 0) > 0 && calculatedTotalPCost === 0 && (
          <div className="bg-orange-50 border border-orange-200 text-orange-800 px-4 py-3 rounded-xl flex items-start gap-3 shadow-xs">
            <AlertTriangle className="h-5 w-5 text-orange-500 shrink-0 mt-0.5" />
            <div className="text-sm">
              <strong className="font-semibold block mb-1">Legacy Cost Detected</strong>
              This document has a legacy global Procurement Cost of <strong>₹{(initialData?.procurementCost || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>. Please distribute this into the new P.Cost columns below before saving.
            </div>
          </div>
        )}

        {/* Table header for desktop */}
        <div className={cn(
          "hidden sm:grid gap-2 text-xs font-semibold text-gray-500 uppercase tracking-wide px-1",
          canSeeMrp && canSeePCost ? "grid-cols-[2fr_3fr_1fr_1.5fr_1fr_1fr_auto]" : 
          canSeeMrp ? "grid-cols-[2fr_3fr_1fr_1.5fr_1fr_auto]" : "grid-cols-[2fr_3fr_1fr_1.5fr_auto]"
        )}>
          <span>Brand Name</span>
          <span>Item Name</span>
          <span>Qty</span>
          <span>Expiry</span>
          {canSeeMrp && <span>MRP</span>}
          {canSeePCost && <span>P.Cost (Vendor)</span>}
          <span />
        </div>

        {fields.map((field, index) => (
          <ChallanLineItem
            key={field.id}
            fieldId={field.id}
            index={index}
            register={register}
            errors={errors}
            setValue={setValue}
            remove={remove}
            fieldsLength={fields.length}
            canSeeMrp={canSeeMrp}
            canSeePCost={canSeePCost}
            catalog={catalog}
            watchedLineItems={watchedLineItems}
            handleItemNameChange={handleItemNameChange}
          />
        ))}

        <ChallanSummary 
          lineItems={watchedLineItems} 
          canSeeMrp={canSeeMrp} 
          canSeePCost={canSeePCost} 
        />

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

      {/* Admin Financial Charges (Transport Cost & Other Charges) */}
      {isAdmin && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 pt-2">
          <div className="space-y-1.5">
            <Label htmlFor={`${formId}-transportCost`}>Transport Cost</Label>
            <Input
              id={`${formId}-transportCost`}
              type="number"
              step="0.01"
              min="0"
              {...register('transportCost')}
              placeholder="0.00"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`${formId}-otherCharges`}>Other Charges</Label>
            <Input
              id={`${formId}-otherCharges`}
              type="number"
              step="0.01"
              min="0"
              {...register('otherCharges')}
              placeholder="0.00"
            />
          </div>
        </div>
      )}

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

      {/* Signed Copies Management (Admin/Manager only, and only when editing) */}
      {isEditing && currentData?.id && (role === 'admin' || role === 'superadmin' || role === 'manager') && (
        <div className="pt-2 flex flex-col sm:flex-row gap-2">
          <Button
            type="button"
            variant="outline"
            className="w-full sm:flex-1 gap-2 border-gray-300 text-gray-700"
            onClick={() => setShowSignedCopyModal(true)}
          >
            <Paperclip className="h-4 w-4" />
            Manage Signed Copies {(currentData?.signedCopyUrls || []).length > 0 && `(${currentData?.signedCopyUrls?.length})`}
          </Button>
          
          <Button
            type="button"
            variant="outline"
            className="w-full sm:flex-1 gap-2 border-gray-300 text-gray-700"
            onClick={() => setShowGoodsReceivedModal(true)}
          >
            <FileText className="h-4 w-4" />
            Goods Received Invoice {(currentData?.goodsReceivedInvoiceUrls || []).length > 0 && `(${currentData?.goodsReceivedInvoiceUrls?.length})`}
          </Button>
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-2.5 sm:gap-3 pt-2">
        {onCancel && (
          <Button
            type="button"
            variant="outline"
            className="w-full sm:flex-1 h-11 sm:h-10 text-gray-500"
            disabled={isSaving}
            onClick={onCancel}
          >
            Cancel
          </Button>
        )}
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
          onClick={handleSubmit((v) => onSubmit(v, false), onValidationError)}
        >
          <Save className="h-4 w-4" />
          {isEditing ? 'Update Only' : isDuplicating ? 'Save Duplicate Only' : 'Save Only'}
        </Button>
      </div>

      {/* Signed Copies Modal */}
      {showSignedCopyModal && currentData && (
        <NewRelicAttachmentModal
          isOpen={showSignedCopyModal}
          onClose={() => setShowSignedCopyModal(false)}
          challan={currentData}
          title="Signed Copies"
          type="signed_copy"
          onUpdate={() => {}}
        />
      )}

      {/* Goods Received Modal */}
      {showGoodsReceivedModal && currentData && (
        <NewRelicAttachmentModal
          isOpen={showGoodsReceivedModal}
          onClose={() => setShowGoodsReceivedModal(false)}
          challan={currentData}
          title="Goods Received Invoice"
          type="goods_received"
          onUpdate={() => {}}
        />
      )}



      {/* ── Mobile Floating Quick Action Dock (2-Tier Non-Overlapping Layout) ── */}
      <div className="sm:hidden fixed bottom-4 left-3 right-3 z-50 max-w-lg mx-auto">
        {isDockMinimized ? (
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => setIsDockMinimized(false)}
              className="bg-gradient-to-r from-[#181156] via-[#281e8c] to-[#3b2fc9] text-white shadow-[0_12px_36px_rgba(24,17,86,0.55)] backdrop-blur-xl px-5 py-3 rounded-full flex items-center gap-3 text-sm font-bold active:scale-95 transition-all border-2 border-indigo-400/40"
            >
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
              </span>
              <span>{fields.length} {fields.length === 1 ? 'Item' : 'Items'}</span>
              {canSeeMrp && calculatedTotalMrp > 0 && (
                <span className="text-emerald-300 font-extrabold pl-2 border-l border-white/20">
                  ₹{calculatedTotalMrp.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                </span>
              )}
              <ChevronUp className="w-4 h-4 text-indigo-200 ml-1" />
            </button>
          </div>
        ) : (
          <div className="bg-gradient-to-r from-slate-950 via-[#181156] to-[#251b85] text-white backdrop-blur-2xl border-2 border-indigo-400/40 rounded-2xl p-3 shadow-[0_16px_45px_rgba(15,23,42,0.65)] space-y-2.5 transition-all">
            {/* Top Tier: Clean Stats & Dismiss Controls (Full Width, No Overlap) */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-[#3b2fc9] to-[#6366f1] text-white flex items-center justify-center font-black text-sm shrink-0 shadow-md shadow-indigo-900/50 border border-white/20">
                  {fields.length}
                </div>

                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-base font-black text-emerald-400 truncate leading-tight tracking-tight">
                      {canSeeMrp && calculatedTotalMrp > 0
                        ? `₹${calculatedTotalMrp.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
                        : `${fields.length} ${fields.length === 1 ? 'Item' : 'Items'}`}
                    </p>
                    <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.2 rounded bg-white/10 text-indigo-200 border border-white/10">
                      {fields.length} {fields.length === 1 ? 'Item' : 'Items'}
                    </span>
                  </div>
                  <p className="text-[11px] text-indigo-200 truncate font-medium pt-0.5">
                    {locationConfig.label} • {isEditing ? 'Editing Challan' : 'New Challan'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic('light');
                    setShowCalculator(true);
                  }}
                  className="h-8 px-2.5 rounded-lg bg-amber-400/20 hover:bg-amber-400/30 text-amber-300 flex items-center gap-1 shrink-0 transition-colors border border-amber-300/30 text-xs font-bold"
                  title="MRP % Calculator"
                >
                  <Calculator className="w-3.5 h-3.5" />
                  <span>Calc</span>
                </button>
                {onCancel && (
                  <button
                    type="button"
                    onClick={onCancel}
                    disabled={isSaving}
                    className="h-8 px-2.5 rounded-lg text-xs font-semibold text-rose-300 hover:text-white hover:bg-white/10 transition-colors"
                  >
                    Cancel
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setIsDockMinimized(true)}
                  className="h-8 w-8 rounded-lg bg-white/10 hover:bg-white/20 text-indigo-200 hover:text-white flex items-center justify-center shrink-0 transition-colors border border-white/10"
                  title="Minimize toolbar"
                >
                  <ChevronDown className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Bottom Tier: Full-Width Prominent Touch Action Buttons */}
            <div className="flex items-center gap-2 pt-0.5">
              <Button
                type="button"
                variant="outline"
                disabled={isSaving}
                onClick={handleSubmit((v) => onSubmit(v, false), onValidationError)}
                className="flex-1 h-11 rounded-xl bg-white/10 hover:bg-white/20 border-white/25 text-white hover:text-white font-bold text-xs gap-2 active:scale-95 transition-transform shadow-xs"
                title="Save without downloading"
              >
                <Save className="h-4 w-4 text-amber-300 shrink-0" />
                <span>Save Draft</span>
              </Button>

              <Button
                type="submit"
                disabled={isSaving}
                className="flex-1 h-11 rounded-xl bg-gradient-to-r from-emerald-500 via-emerald-600 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-black text-xs gap-2 shadow-lg shadow-emerald-500/35 border border-emerald-400/30 active:scale-95 transition-transform"
              >
                {isSaving ? (
                  <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                ) : (
                  <FileDown className="h-4 w-4 shrink-0" />
                )}
                <span>{isEditing ? 'Update & DL' : 'Save & Download'}</span>
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* MRP Percentage & Value Calculator Modal */}
      <MrpCalculatorModal
        isOpen={showCalculator}
        onClose={() => setShowCalculator(false)}
      />
    </form>
  );
}
