'use client';

import React, { useId, useEffect, useState, useRef } from 'react';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format } from 'date-fns';
import { CalendarIcon, Plus, Trash2, FileDown, Save, Loader2, Sparkles, UploadCloud, FileText, Paperclip, AlertTriangle, MapPin, ChevronDown, ChevronUp, Calculator, FileCheck, Receipt } from 'lucide-react';
import { MrpCalculatorModal } from '@/components/newrelic/mrp-calculator-modal';
import { useAuth } from '@/contexts/AuthContext';
import { triggerHaptic } from '@/lib/haptics';
import { enqueueOfflineItem } from '@/services/offlineSyncService';
import { OfflineFormBanner } from '@/components/newrelic/OfflineFormBanner';

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
import { getPricingItems, buildPricingMap, findPricingForItem } from '@/services/newrelicPricingService';
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
import { hasPermission } from '@/types/permissions';
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

  useEffect(() => {
    setCurrentData(initialData || null);
  }, [initialData]);

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

  const { role, user, isReadOnly } = useAuth();
  const isAdmin = role === 'admin' || role === 'superadmin';
  const isManager = role === 'manager';
  const canSeeMrp = isAdmin || isManager;
  // P.Cost is visible to admins without financial password unlock, but strictly forbidden for user/manager
  const canSeePCost = isAdmin;
  const canViewSignedCopies = role !== 'guest' && hasPermission(user, 'signed_copies');
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
    const targetDateStr = watchedDcDate instanceof Date 
      ? watchedDcDate.toISOString().substring(0, 10) 
      : (typeof watchedDcDate === 'string' ? (watchedDcDate as string).substring(0, 10) : undefined);
    getPricingItems(watchedLocation).then((items) => {
      setPricingItems(items);
      setPricingMap(buildPricingMap(items, targetDateStr));
    });
  }, [watchedLocation, watchedDcDate]);

  /* ── In edit mode, backfill empty P.Cost & MRP cells once the pricing map is ready ── */
  useEffect(() => {
    if (pricingMap.size === 0) return;
    const items = watchedLineItems;
    if (!items || items.length === 0) return;

    items.forEach((item, index) => {
      const brand = (item.brandName || '').trim();
      const name = (item.itemName || '').trim();
      if (!name) return;

      const pricingMatch = findPricingForItem(pricingItems, pricingMap, name, brand);

      // Backfill procurementCost if missing or 0
      const currentCost = Number(item.procurementCost);
      if ((!currentCost || currentCost === 0) && pricingMatch.purchaseCost !== undefined && pricingMatch.purchaseCost > 0) {
        setValue(`lineItems.${index}.procurementCost`, pricingMatch.purchaseCost);
      }

      // Backfill MRP if missing or 0
      const currentMrp = Number(item.mrp);
      if ((!currentMrp || currentMrp === 0) && pricingMatch.mrp !== undefined && pricingMatch.mrp > 0) {
        setValue(`lineItems.${index}.mrp`, pricingMatch.mrp);
      }

      // Backfill Brand if missing
      if (!brand && pricingMatch.brandName) {
        setValue(`lineItems.${index}.brandName`, pricingMatch.brandName);
      }
    });
  }, [pricingMap, pricingItems, setValue, watchedLineItems]);

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
    if (!selectedItemName || !selectedItemName.trim()) return;

    // 1. Try finding in catalog for defaultQuantity & canonical brand name
    const catalogMatch = catalog.find(
      (c) => 
        c.itemName.toLowerCase() === selectedItemName.trim().toLowerCase() && 
        (!currentBrandName || c.brandName.toLowerCase() === currentBrandName.trim().toLowerCase())
    );
    if (catalogMatch) {
      if (catalogMatch.brandName && (!currentBrandName || !currentBrandName.trim())) {
        setValue(`lineItems.${index}.brandName`, catalogMatch.brandName);
      }
      if (catalogMatch.defaultQuantity) {
        const curQty = watchedLineItems?.[index]?.quantity;
        if (!curQty || Number(curQty) <= 1) {
          setValue(`lineItems.${index}.quantity`, catalogMatch.defaultQuantity);
        }
      }
    }

    // 2. Comprehensive pricing lookup using findPricingForItem
    const effectiveBrand = currentBrandName?.trim() || catalogMatch?.brandName || watchedLineItems?.[index]?.brandName || '';
    const pricingMatch = findPricingForItem(pricingItems, pricingMap, selectedItemName, effectiveBrand);

    // Auto-fill brand name if still empty and pricingMatch has one
    if (pricingMatch.brandName && (!watchedLineItems?.[index]?.brandName || !watchedLineItems?.[index]?.brandName.trim())) {
      setValue(`lineItems.${index}.brandName`, pricingMatch.brandName);
    }

    // Auto-fill MRP if empty or 0
    if (pricingMatch.mrp !== undefined && pricingMatch.mrp > 0) {
      const currentMrp = watchedLineItems?.[index]?.mrp;
      if (!currentMrp || Number(currentMrp) === 0) {
        setValue(`lineItems.${index}.mrp`, pricingMatch.mrp);
      }
    }

    // Auto-fill P.Cost if empty or 0 (store in form state for calculation and saving)
    if (pricingMatch.purchaseCost !== undefined && pricingMatch.purchaseCost > 0) {
      const currentCost = watchedLineItems?.[index]?.procurementCost;
      if (!currentCost || Number(currentCost) === 0) {
        setValue(`lineItems.${index}.procurementCost`, pricingMatch.purchaseCost);
      }
    }
  };

  const onSubmit = async (values: FormValues, shouldDownload = true) => {
    if (isReadOnly || role === 'guest') {
      toast({
        variant: 'destructive',
        title: 'Guest Account (Read-Only)',
        description: 'Modifications are disabled for guest users. Delivery Challans cannot be saved or updated.',
      });
      return;
    }

    setIsSaving(true);
    triggerHaptic('medium');
    let cleanPayloadToQueue: any = null;

    try {
      // Ignore any trailing or incomplete rows that only have brand name (no item name)
      const validItems = (values.lineItems || [])
        .filter((item) => item.itemName && item.itemName.trim() !== '')
        .map((item, idx) => {
          const originalItem = initialData?.lineItems?.[idx] || ({} as any);
          const mrp = (item.mrp !== undefined && item.mrp !== null && Number(item.mrp) > 0)
            ? Number(item.mrp)
            : (originalItem.mrp ? Number(originalItem.mrp) : undefined);

          let procurementCost = (item.procurementCost !== undefined && item.procurementCost !== null && Number(item.procurementCost) > 0)
            ? Number(item.procurementCost)
            : (Number(originalItem.procurementCost) || Number(originalItem.pCost) || 0);

          if (procurementCost === 0) {
            const pricingMatch = findPricingForItem(pricingItems, pricingMap, item.itemName || '', item.brandName);
            if (pricingMatch.purchaseCost !== undefined && pricingMatch.purchaseCost > 0) {
              procurementCost = pricingMatch.purchaseCost;
            }
          }

          const rawQty = Number(item.quantity);
          const finalQty = (!rawQty || isNaN(rawQty) || rawQty < 1) ? 1 : rawQty;

          return {
            ...item,
            brandName: item.brandName?.trim() || '',
            itemName: item.itemName!.trim(),
            quantity: finalQty,
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

      const targetId = initialData?.id || currentData?.id;
      const initialDcNum = (initialData?.dcNumber || currentData?.dcNumber)?.trim();

      // Only run network query for duplicate check if the DC number was modified
      if (values.dcNumber.trim() !== initialDcNum) {
        const isDup = await checkDuplicateDcNumber(values.dcNumber, targetId);
        if (isDup) {
          setDuplicateError('⚠️ This DC Number is already in use by another active invoice.');
          toast({
            variant: 'destructive',
            title: 'Duplicate DC Number',
            description: 'Please use a unique DC Number before saving.',
          });
          setIsSaving(false);
          return;
        } else {
          setDuplicateError(null);
        }
      }

      const calculatedProcurementCost = validItems.reduce((acc, item) => acc + ((item.procurementCost || 0) * item.quantity), 0);

      const parsedDcDate = values.dcDate instanceof Date ? values.dcDate : new Date(values.dcDate);
      const payload: any = {
        ...(targetId ? { id: targetId } : {}),
        dcNumber: values.dcNumber,
        location: values.location,
        dcDate: parsedDcDate.toISOString(),
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
      cleanPayloadToQueue = cleanPayload;
      const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;

      if (isOffline) {
        await enqueueOfflineItem(
          'challan',
          `Challan ${cleanPayload.dcNumber || 'Draft'} (${cleanPayload.location || 'Local'})`,
          `${cleanPayload.lineItems?.length || 0} items, Total: ₹${cleanPayload.totalAmount || 0}`,
          {
            challan: cleanPayload,
            userEmail: user?.email || null,
          }
        );
        triggerHaptic('success');
        toast({
          title: '📱 Saved to Offline Outbox!',
          description: `DC ${cleanPayload.dcNumber || ''} is stored safely on this device and will auto-sync once internet returns.`,
        });
        onChallanSave(shouldDownload ? cleanPayload : undefined);
        reset(defaultValues);
        return;
      }

      const saved = await saveNewRelicChallan(cleanPayload, user?.email || null);
      toast({
        title: isEditing ? 'Challan updated' : 'Challan saved',
        description: `DC No: ${saved.dcNumber}`,
      });
      onChallanSave(shouldDownload ? saved : undefined);
      reset(defaultValues);
    } catch (err: any) {
      console.error(err);
      const isNetworkIssue =
        (typeof navigator !== 'undefined' && !navigator.onLine) ||
        err?.message?.includes('timeout') ||
        err?.message?.includes('network') ||
        err?.message?.includes('Failed to fetch') ||
        err?.message?.includes('offline');

      if (isNetworkIssue && cleanPayloadToQueue) {
        try {
          await enqueueOfflineItem(
            'challan',
            `Challan ${cleanPayloadToQueue.dcNumber || 'Draft'} (${cleanPayloadToQueue.location || 'Local'})`,
            `${cleanPayloadToQueue.lineItems?.length || 0} items, Total: ₹${cleanPayloadToQueue.totalAmount || 0}`,
            {
              challan: cleanPayloadToQueue,
              userEmail: user?.email || null,
            }
          );
          triggerHaptic('success');
          toast({
            title: '📱 Saved to Offline Outbox!',
            description: `Network dropped during save. DC ${cleanPayloadToQueue.dcNumber || ''} has been safely queued offline and will auto-sync when online.`,
          });
          onChallanSave(shouldDownload ? cleanPayloadToQueue : undefined);
          reset(defaultValues);
          return;
        } catch (queueErr) {
          console.error('Failed to queue offline challan after network drop:', queueErr);
        }
      }

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

  // Derived unique brand names for datalist from both catalog and pricing
  const uniqueBrands = Array.from(
    new Set([
      ...catalog.map((c) => c.brandName),
      ...pricingItems.map((p) => p.brandName),
    ].map((b) => (b || '').trim()).filter(Boolean))
  ).sort((a, b) => a.localeCompare(b));

  return (
    <form
      id={`${formId}-form`}
      onSubmit={handleSubmit((v) => onSubmit(v, true), onValidationError)}
      className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-md rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-[0_8px_30px_rgb(0,0,0,0.04)] p-4 sm:p-6 space-y-5 sm:space-y-6 pb-32 sm:pb-6"
    >
      {/* Autocomplete Datalists */}
      <datalist id="newrelic-brand-list">
        {uniqueBrands.map((b) => (
          <option key={b} value={b} />
        ))}
      </datalist>

      {(isReadOnly || role === 'guest') && (
        <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-300 text-xs sm:text-sm font-medium">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
          <div>
            <span className="font-bold">Guest Mode (Read-Only):</span> You can explore, inspect items, and preview PDFs, but creating or updating Delivery Challans is disabled.
          </div>
        </div>
      )}

      <OfflineFormBanner moduleName="Delivery Challan" />

      {/* Header */}
      <div className="flex items-center justify-between gap-2 sm:gap-4">
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
        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          {isEditing && currentData?.id && (
            <>
              {canViewSignedCopies && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    triggerHaptic('light');
                    setShowSignedCopyModal(true);
                  }}
                  className={`h-8 sm:h-9 px-2.5 sm:px-3 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-2xs ${
                    (currentData.signedCopyUrls?.length ?? 0) > 0
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100'
                      : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                  }`}
                  title="Manage Signed Copies"
                >
                  <FileCheck className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="hidden sm:inline">Signed DC</span>
                  {(currentData.signedCopyUrls?.length ?? 0) > 0 ? (
                    <span className="px-1.5 py-0.2 rounded-full bg-emerald-600 text-white text-[9px] font-black">
                      {currentData.signedCopyUrls!.length}
                    </span>
                  ) : (
                    <span className="text-[10px] text-gray-400 font-normal">+Upload</span>
                  )}
                </Button>
              )}

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  triggerHaptic('light');
                  setShowGoodsReceivedModal(true);
                }}
                className={`h-8 sm:h-9 px-2.5 sm:px-3 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-2xs ${
                  (currentData.goodsReceivedInvoiceUrls?.length ?? 0) > 0
                    ? 'bg-blue-50 text-blue-800 border-blue-300 hover:bg-blue-100'
                    : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                }`}
                title="Manage Goods Received Invoice"
              >
                <Receipt className="w-3.5 h-3.5 text-blue-600" />
                <span className="hidden sm:inline">Invoice</span>
                {(currentData.goodsReceivedInvoiceUrls?.length ?? 0) > 0 ? (
                  <span className="px-1.5 py-0.2 rounded-full bg-blue-600 text-white text-[9px] font-black">
                    {currentData.goodsReceivedInvoiceUrls!.length}
                  </span>
                ) : (
                  <span className="text-[10px] text-gray-400 font-normal">+Upload</span>
                )}
              </Button>
            </>
          )}

          {isAdmin && (
            <button
              type="button"
              onClick={() => {
                triggerHaptic('light');
                setShowCalculator(true);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-purple-50 to-indigo-50 hover:from-purple-100 hover:to-indigo-100 border border-purple-200/80 text-[#3b2fc9] text-xs font-bold shadow-2xs transition-all active:scale-95 shrink-0"
              title="Open MRP % Calculator"
            >
              <Calculator className="w-3.5 h-3.5" />
              <span>% Calc</span>
            </button>
          )}
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
          {isAdmin && (
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
          )}
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
            pricingItems={pricingItems}
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

      {/* Signed Copies & Goods Received Management (Available when editing) */}
      {isEditing && currentData?.id && (
        <div className="pt-2 flex flex-col sm:flex-row gap-2">
          {canViewSignedCopies && (
            <Button
              type="button"
              variant="outline"
              className="w-full sm:flex-1 gap-2 border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
              onClick={() => {
                triggerHaptic('light');
                setShowSignedCopyModal(true);
              }}
            >
              <FileCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              Signed DC {(currentData?.signedCopyUrls || []).length > 0 ? `(${currentData.signedCopyUrls?.length})` : '(0)'}
            </Button>
          )}
          
          <Button
            type="button"
            variant="outline"
            className="w-full sm:flex-1 gap-2 border-blue-300 dark:border-blue-800 text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-950/30"
            onClick={() => {
              triggerHaptic('light');
              setShowGoodsReceivedModal(true);
            }}
          >
            <Receipt className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            Goods Received Invoice {(currentData?.goodsReceivedInvoiceUrls || []).length > 0 ? `(${currentData.goodsReceivedInvoiceUrls?.length})` : '(0)'}
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
          disabled={isSaving || isReadOnly || role === 'guest'}
          title={isReadOnly || role === 'guest' ? 'Saving is disabled in guest mode' : undefined}
        >
          {isSaving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <FileDown className="h-4 w-4" />
          )}
          {isReadOnly || role === 'guest'
            ? 'Read-Only Mode'
            : isEditing
            ? 'Update & Download'
            : isDuplicating
            ? 'Save Duplicate & Download'
            : 'Save & Download PDF'}
        </Button>
        <Button
          type="button"
          variant="outline"
          className="w-full sm:flex-1 h-11 sm:h-10 gap-2 font-bold"
          disabled={isSaving || isReadOnly || role === 'guest'}
          title={isReadOnly || role === 'guest' ? 'Saving is disabled in guest mode' : undefined}
          onClick={handleSubmit((v) => onSubmit(v, false), onValidationError)}
        >
          {isSaving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          {isReadOnly || role === 'guest'
            ? 'Read-Only'
            : isEditing
            ? 'Update Only'
            : isDuplicating
            ? 'Save Duplicate Only'
            : 'Save Only'}
        </Button>
      </div>

      {/* Signed Copies Modal */}
      {showSignedCopyModal && currentData && canViewSignedCopies && (
        <NewRelicAttachmentModal
          isOpen={showSignedCopyModal}
          onClose={() => setShowSignedCopyModal(false)}
          challan={currentData}
          title="Signed Copies"
          type="signed_copy"
          onUpdate={(updatedUrls) => {
            if (updatedUrls) {
              setCurrentData(prev => prev ? { ...prev, signedCopyUrls: updatedUrls } : prev);
            }
          }}
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
          onUpdate={(updatedUrls) => {
            if (updatedUrls) {
              setCurrentData(prev => prev ? { ...prev, goodsReceivedInvoiceUrls: updatedUrls } : prev);
            }
          }}
        />
      )}



      {/* ── Mobile Floating Quick Action Dock (2-Tier Non-Overlapping Layout) ── */}
      <div className="sm:hidden fixed bottom-[80px] left-3 right-3 z-30 max-w-lg mx-auto">
        {isDockMinimized ? (
          <div className="flex items-center justify-end gap-2">
            {isAdmin && (
              <button
                type="button"
                onClick={() => {
                  triggerHaptic('light');
                  setShowCalculator(true);
                }}
                className="w-11 h-11 rounded-full bg-gradient-to-tr from-[#181156] via-[#2a1d8f] to-[#3b2fc9] text-amber-300 border-2 border-indigo-400/40 shadow-lg flex items-center justify-center active:scale-95 transition-all"
                title="MRP % Calculator"
                aria-label="MRP % Calculator"
              >
                <Calculator className="w-5 h-5 stroke-[2.2]" />
              </button>
            )}
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
                {isAdmin && (
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
                )}
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
                disabled={isSaving || isReadOnly || role === 'guest'}
                onClick={handleSubmit((v) => onSubmit(v, false), onValidationError)}
                className="flex-1 h-11 rounded-xl bg-white/10 hover:bg-white/20 border-white/25 text-white hover:text-white font-bold text-xs gap-2 active:scale-95 transition-transform shadow-xs disabled:opacity-50 disabled:cursor-not-allowed"
                title={isReadOnly || role === 'guest' ? 'Saving is disabled in guest mode' : 'Save without downloading'}
              >
                {isSaving ? (
                  <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                ) : (
                  <Save className="h-4 w-4 text-amber-300 shrink-0" />
                )}
                <span>{isReadOnly || role === 'guest' ? 'Read-Only' : isEditing ? 'Update Only' : 'Save Draft'}</span>
              </Button>

              <Button
                type="submit"
                disabled={isSaving || isReadOnly || role === 'guest'}
                className="flex-1 h-11 rounded-xl bg-gradient-to-r from-emerald-500 via-emerald-600 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-black text-xs gap-2 shadow-lg shadow-emerald-500/35 border border-emerald-400/30 active:scale-95 transition-transform disabled:opacity-50 disabled:cursor-not-allowed"
                title={isReadOnly || role === 'guest' ? 'Saving is disabled in guest mode' : undefined}
              >
                {isSaving ? (
                  <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                ) : (
                  <FileDown className="h-4 w-4 shrink-0" />
                )}
                <span>{isReadOnly || role === 'guest' ? 'Read-Only Mode' : isEditing ? 'Update & DL' : 'Save & Download'}</span>
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
