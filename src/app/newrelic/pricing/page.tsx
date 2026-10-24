'use client';

import { CatalogItem, PricingItem, NewRelicLocation } from '@/types/challan';

import { useEffect, useState, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { getCatalogItems } from '@/services/newrelicCatalogService';
import {
  getPricingItems,
  savePricingItem,
  deletePricingItem,
  calcPurchaseCost,
  getAllPricingItems,
  seedPricingFromChallans,
  bulkUpdateBrandPricing,
} from '@/services/newrelicPricingService';
import { NEWRELIC_LOCATIONS } from '@/services/newrelicChallanService';
import { hasPermission } from '@/types/permissions';
import {
  Trash2,
  Plus,
  Pencil,
  Check,
  X,
  Search,
  TrendingUp,
  RefreshCw,
  AlertTriangle,
  Sliders,
  History,
  Calendar,
  Layers,
  ArrowUpRight,
  Percent,
  ArrowLeft,
  Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { triggerHaptic } from '@/lib/haptics';
import SeedHistoryModal from '@/components/newrelic/pricing/SeedHistoryModal';

type EditRow = {
  brandName: string;
  itemName: string;
  location: NewRelicLocation;
  mrp: string;
  discountPercent: string;
  purchaseCost: string;
  effectiveDate?: string;
  reason?: string;
};

const emptyEdit = (location: NewRelicLocation): EditRow => ({
  brandName: '',
  itemName: '',
  location,
  mrp: '',
  discountPercent: '',
  purchaseCost: '',
  effectiveDate: new Date().toISOString().substring(0, 10),
  reason: '',
});

export default function PricingPage() {
  const { user, role, isReadOnly } = useAuth();
  const router = useRouter();

  const [activeLocation, setActiveLocation] = useState<NewRelicLocation>('hyderabad');
  const [pricingItems, setPricingItems] = useState<PricingItem[]>([]);
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [isSeeding, setIsSeeding] = useState(false);
  const [isCleaning, setIsCleaning] = useState(false);
  const [seedResult, setSeedResult] = useState<string | null>(null);
  const [showSeedModal, setShowSeedModal] = useState(false);

  // Filter tabs: 'all' | 'missing-cost' | 'missing-mrp'
  const [filterMode, setFilterMode] = useState<'all' | 'missing-cost' | 'missing-mrp'>('all');

  // Inline editing
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editRow, setEditRow] = useState<EditRow>(emptyEdit('hyderabad'));

  // Add-new form state
  const [showAdd, setShowAdd] = useState(false);
  const [newRow, setNewRow] = useState<EditRow>(emptyEdit('hyderabad'));

  // Bulk update modal state
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkBrand, setBulkBrand] = useState('');
  const [bulkMode, setBulkMode] = useState<'percentage_increase' | 'set_discount' | 'fixed_increase'>('percentage_increase');
  const [bulkApplyTo, setBulkApplyTo] = useState<'purchaseCost' | 'mrp'>('purchaseCost');
  const [bulkValue, setBulkValue] = useState<number>(5);
  const [bulkEffectiveDate, setBulkEffectiveDate] = useState<string>(() => new Date().toISOString().substring(0, 10));
  const [bulkReason, setBulkReason] = useState<string>('Vendor Annual Price Adjustment');
  const [isBulkUpdating, setIsBulkUpdating] = useState(false);

  // Price history modal state
  const [historyItem, setHistoryItem] = useState<PricingItem | null>(null);

  useEffect(() => {
    if (user && role && role !== 'admin' && !hasPermission(user, 'pricing')) {
      router.push('/newrelic');
    }
  }, [user, role, router]);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const [items, catalogData] = await Promise.all([
        getAllPricingItems(),
        getCatalogItems(),
      ]);
      setPricingItems(items);
      setCatalog(catalogData);
      setLoading(false);
    }
    load();
  }, []);

  const locationItems = useMemo(() =>
    pricingItems.filter(i => i.location === activeLocation),
    [pricingItems, activeLocation]
  );

  // Count items with alerts
  const missingCostCount = useMemo(() =>
    locationItems.filter(i => !i.purchaseCost || i.purchaseCost <= 0).length,
    [locationItems]
  );

  const missingMrpCount = useMemo(() =>
    locationItems.filter(i => !i.mrp || i.mrp <= 0).length,
    [locationItems]
  );

  const filteredItems = useMemo(() => {
    let list = locationItems;
    if (filterMode === 'missing-cost') {
      list = list.filter(i => !i.purchaseCost || i.purchaseCost <= 0);
    } else if (filterMode === 'missing-mrp') {
      list = list.filter(i => !i.mrp || i.mrp <= 0);
    }

    if (!search.trim()) return list;
    const s = search.toLowerCase();
    return list.filter(i =>
      i.brandName.toLowerCase().includes(s) || i.itemName.toLowerCase().includes(s)
    );
  }, [locationItems, search, filterMode]);

  // Unique brands from catalog for typeahead and bulk update
  const availableBrands = useMemo(() => {
    const fromPricing = locationItems.map(i => i.brandName);
    const fromCat = catalog.map(c => c.brandName);
    return [...new Set([...fromPricing, ...fromCat].map(b => b.trim()).filter(Boolean))].sort();
  }, [locationItems, catalog]);

  const getCatalogItemsForBrand = (brand: string) =>
    catalog.filter(c => c.brandName === brand).map(c => c.itemName).sort();

  function autoCalcCost(mrp: string, disc: string): string {
    const m = parseFloat(mrp);
    const d = parseFloat(disc);
    if (!isNaN(m) && !isNaN(d)) {
      return calcPurchaseCost(m, d).toFixed(2);
    }
    return '';
  }

  // --- Save new row ---
  async function handleSaveNew() {
    if (isReadOnly || role === 'guest') {
      setError('Guest Mode (Read-Only): Adding pricing items is disabled.');
      return;
    }
    const mrp = parseFloat(newRow.mrp);
    const disc = parseFloat(newRow.discountPercent);
    const cost = parseFloat(newRow.purchaseCost);
    if (!newRow.brandName.trim() || !newRow.itemName.trim() || isNaN(mrp) || isNaN(disc) || isNaN(cost)) {
      setError('Please fill all fields correctly.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const item: Omit<PricingItem, 'id' | 'updatedAt'> = {
        brandName: newRow.brandName.trim(),
        itemName: newRow.itemName.trim(),
        location: newRow.location,
        mrp,
        discountPercent: disc,
        purchaseCost: cost,
        effectiveDate: newRow.effectiveDate || new Date().toISOString().substring(0, 10),
      };
      await savePricingItem(item, user?.email, newRow.reason || 'Initial pricing entry');
      const refreshed = await getAllPricingItems();
      setPricingItems(refreshed);
      setNewRow(emptyEdit(activeLocation));
      setShowAdd(false);
    } catch (e) {
      setError('Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  // --- Start editing a row ---
  function startEdit(item: PricingItem) {
    if (isReadOnly || role === 'guest') {
      alert('Guest Mode (Read-Only): Editing pricing items is disabled.');
      return;
    }
    setEditingId(item.id!);
    setEditRow({
      brandName: item.brandName,
      itemName: item.itemName,
      location: item.location,
      mrp: String(item.mrp),
      discountPercent: String(item.discountPercent),
      purchaseCost: String(item.purchaseCost),
      effectiveDate: item.effectiveDate || new Date().toISOString().substring(0, 10),
    });
  }

  async function handleSaveEdit() {
    if (isReadOnly || role === 'guest') {
      setError('Guest Mode (Read-Only): Editing pricing items is disabled.');
      return;
    }
    const mrp = parseFloat(editRow.mrp);
    const disc = parseFloat(editRow.discountPercent);
    const cost = parseFloat(editRow.purchaseCost);
    if (!editRow.brandName.trim() || !editRow.itemName.trim() || isNaN(mrp) || isNaN(disc) || isNaN(cost)) {
      setError('Please fill all fields correctly.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const item: Omit<PricingItem, 'id' | 'updatedAt'> = {
        brandName: editRow.brandName.trim(),
        itemName: editRow.itemName.trim(),
        location: editRow.location,
        mrp,
        discountPercent: disc,
        purchaseCost: cost,
        effectiveDate: editRow.effectiveDate || new Date().toISOString().substring(0, 10),
      };
      await savePricingItem(item, user?.email, editRow.reason || 'Manual rate adjustment');
      const refreshed = await getAllPricingItems();
      setPricingItems(refreshed);
      setEditingId(null);
    } catch (e) {
      setError('Failed to update. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  // --- Bulk Update Brand Pricing ---
  async function handleBulkUpdate() {
    if (isReadOnly || role === 'guest') {
      setError('Guest Mode (Read-Only): Bulk price updates are disabled.');
      return;
    }
    if (!bulkBrand.trim()) {
      setError('Please select a brand to update.');
      return;
    }
    setIsBulkUpdating(true);
    setError('');
    try {
      const res = await bulkUpdateBrandPricing({
        brandName: bulkBrand,
        location: activeLocation,
        mode: bulkMode,
        value: Number(bulkValue),
        applyTo: bulkApplyTo,
        effectiveDate: bulkEffectiveDate,
        userEmail: user?.email,
        reason: bulkReason,
      });
      const refreshed = await getAllPricingItems();
      setPricingItems(refreshed);
      setShowBulkModal(false);
      setSeedResult(`✓ Successfully updated ${res.updatedCount} item(s) for ${bulkBrand} in ${NEWRELIC_LOCATIONS[activeLocation].label}!`);
    } catch (e: any) {
      setError(e.message || 'Failed to perform bulk update.');
    } finally {
      setIsBulkUpdating(false);
    }
  }

  async function handleDelete(id: string) {
    if (isReadOnly || role === 'guest') {
      alert('Guest Mode (Read-Only): Deleting pricing items is disabled.');
      return;
    }
    if (!confirm('Delete this pricing entry?')) return;
    setSaving(true);
    try {
      await deletePricingItem(id);
      setPricingItems(prev => prev.filter(i => i.id !== id));
    } finally {
      setSaving(false);
    }
  }

  async function handleCleanPricing() {
    if (isReadOnly || role === 'guest') {
      alert('Guest Mode (Read-Only): Cleaning pricing items is disabled.');
      return;
    }
    if (!confirm('This will delete all Pricing items that no longer exist in your Catalog. Continue?')) return;
    setIsCleaning(true);
    setError('');
    setSeedResult(null);
    try {
      const validCatalogKeys = new Set(
        catalog.map(c => `${c.brandName.trim().toLowerCase()}__${c.itemName.trim().toLowerCase()}`)
      );

      let deletedCount = 0;
      for (const item of pricingItems) {
        const key = `${item.brandName.trim().toLowerCase()}__${item.itemName.trim().toLowerCase()}`;
        if (!validCatalogKeys.has(key)) {
          await deletePricingItem(item.id!);
          deletedCount++;
        }
      }

      if (deletedCount > 0) {
        const refreshed = await getAllPricingItems();
        setPricingItems(refreshed);
      }
      setSeedResult(`✓ Cleanup complete! Deleted ${deletedCount} orphaned/duplicate pricing items.`);
    } catch (e) {
      setError('Failed to clean up pricing. Please try again.');
    } finally {
      setIsCleaning(false);
    }
  }

  if (!role || (role !== 'admin' && !hasPermission(user, 'pricing'))) return null;

  const locations: NewRelicLocation[] = ['hyderabad', 'bangalore'];

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-8 py-4 sm:py-8 space-y-6">
      {/* Header */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                triggerHaptic('light');
                router.back();
              }}
              className="sm:hidden p-2 -ml-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors active:scale-95"
              aria-label="Go back"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-500/10 dark:bg-purple-400/10 border border-purple-500/20 text-purple-600 dark:text-purple-400 text-[10px] sm:text-xs font-black tracking-widest uppercase">
              <Sparkles className="h-3 w-3" />
              <span>Procurement Rates</span>
            </div>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
            Procurement Pricing
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            Set MRP and discount per item per location. These prices auto-fill P.Cost when creating new DCs.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => {
              triggerHaptic('medium');
              setShowBulkModal(true);
              setBulkBrand(availableBrands[0] || '');
              setError('');
            }}
            className="flex-1 sm:flex-initial h-11 sm:h-10 px-3.5 rounded-2xl sm:rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-xs sm:text-sm font-bold hover:from-purple-700 hover:to-indigo-700 shadow-md shadow-purple-500/20 transition-all flex items-center justify-center gap-2 active:scale-95"
          >
            <Sliders className="h-4 w-4" />
            <span>Batch Update</span>
          </button>

          <button
            type="button"
            onClick={() => {
              triggerHaptic('medium');
              if (isReadOnly || role === 'guest') {
                alert('Guest Mode (Read-Only): Seeding pricing items is disabled.');
                return;
              }
              setShowSeedModal(true);
            }}
            disabled={isSeeding || isCleaning || saving}
            className="flex-1 sm:flex-initial h-11 sm:h-10 px-3 rounded-2xl sm:rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 text-slate-700 dark:text-slate-200 text-xs sm:text-sm font-bold hover:bg-slate-50 dark:hover:bg-slate-800/60 disabled:opacity-50 transition-all flex items-center justify-center gap-1.5 shadow-xs active:scale-95"
            title="Scan challan history to seed prices with preview, safe filters, and instant batch writes"
          >
            <Sparkles className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
            <span>Seed History</span>
          </button>
          
          <button
            onClick={() => {
              triggerHaptic('medium');
              handleCleanPricing();
            }}
            disabled={isSeeding || isCleaning || saving}
            className="h-11 sm:h-10 px-3 rounded-2xl sm:rounded-xl bg-white dark:bg-slate-900 border border-red-200 dark:border-red-900/60 text-red-600 dark:text-red-400 text-xs sm:text-sm font-bold hover:bg-red-50 dark:hover:bg-red-950/40 disabled:opacity-50 transition-all flex items-center justify-center gap-1.5 shadow-xs active:scale-95"
          >
            <Trash2 className={`h-4 w-4 ${isCleaning ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">{isCleaning ? 'Cleaning…' : 'Clean Orphaned'}</span>
          </button>
          <button
            onClick={() => {
              triggerHaptic('medium');
              setShowAdd(true);
              setNewRow(emptyEdit(activeLocation));
              setError('');
              setSeedResult(null);
            }}
            className="w-full sm:w-auto h-11 sm:h-10 px-4 rounded-2xl sm:rounded-xl bg-[#3b2fc9] hover:bg-[#2f25a8] text-white text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-2 shadow-md shadow-indigo-500/20 active:scale-95"
          >
            <Plus className="h-4 w-4" />
            <span>Add Pricing Row</span>
          </button>
        </div>
      </div>

      {/* Seed result banner */}
      {seedResult && (
        <div className="mb-3 px-3.5 py-2.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 text-emerald-800 dark:text-emerald-300 rounded-2xl text-xs sm:text-sm font-medium flex items-center justify-between shadow-xs">
          <span>{seedResult}</span>
          <button onClick={() => setSeedResult(null)} className="ml-2 text-emerald-600 hover:text-emerald-800 p-1"><X className="h-3.5 w-3.5" /></button>
        </div>
      )}

      {/* Location Tabs + Filter Pills Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        {/* Location switcher */}
        <div className="w-full sm:w-auto flex p-1 bg-slate-100 dark:bg-slate-800/80 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
          {locations.map(loc => {
            const isSelected = activeLocation === loc;
            const count = pricingItems.filter(i => i.location === loc).length;
            return (
              <button
                key={loc}
                onClick={() => {
                  triggerHaptic('light');
                  setActiveLocation(loc);
                  setEditingId(null);
                  setShowAdd(false);
                }}
                className={cn(
                  "flex-1 sm:flex-initial h-10 px-4 rounded-xl text-xs sm:text-sm font-black transition-all flex items-center justify-center gap-2 active:scale-95",
                  isSelected
                    ? 'bg-white dark:bg-slate-900 text-[#3b2fc9] dark:text-white shadow-xs'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-800'
                )}
              >
                <span>{NEWRELIC_LOCATIONS[loc].label}</span>
                <span className={cn(
                  "text-[10px] px-2 py-0.5 rounded-full font-mono font-bold",
                  isSelected
                    ? 'bg-indigo-50 dark:bg-indigo-950 text-[#3b2fc9] dark:text-indigo-400'
                    : 'bg-slate-200/70 dark:bg-slate-700 text-slate-500'
                )}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Missing Rate Audit Filter Pills */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1 -mx-4 px-4 sm:mx-0 sm:px-0">
          <button
            onClick={() => {
              triggerHaptic('light');
              setFilterMode('all');
            }}
            className={cn(
              "h-10 sm:h-9 px-3.5 rounded-2xl text-xs font-black whitespace-nowrap transition-all shrink-0 active:scale-95 shadow-xs",
              filterMode === 'all'
                ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm'
                : 'bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50'
            )}
          >
            All Items ({locationItems.length})
          </button>

          <button
            onClick={() => {
              triggerHaptic('light');
              setFilterMode('missing-cost');
            }}
            className={cn(
              "h-10 sm:h-9 px-3.5 rounded-2xl text-xs font-black whitespace-nowrap flex items-center gap-1.5 transition-all shrink-0 active:scale-95 shadow-xs",
              filterMode === 'missing-cost'
                ? 'bg-red-600 text-white shadow-sm'
                : missingCostCount > 0
                ? 'bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 text-red-700 dark:text-red-300 hover:bg-red-100'
                : 'bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 text-slate-400 opacity-60'
            )}
          >
            <AlertTriangle className="h-3.5 w-3.5" />
            <span>Missing P.Cost ({missingCostCount})</span>
          </button>

          <button
            onClick={() => {
              triggerHaptic('light');
              setFilterMode('missing-mrp');
            }}
            className={cn(
              "h-10 sm:h-9 px-3.5 rounded-2xl text-xs font-black whitespace-nowrap flex items-center gap-1.5 transition-all shrink-0 active:scale-95 shadow-xs",
              filterMode === 'missing-mrp'
                ? 'bg-amber-600 text-white shadow-sm'
                : missingMrpCount > 0
                ? 'bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 text-amber-700 dark:text-amber-300 hover:bg-amber-100'
                : 'bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 text-slate-400 opacity-60'
            )}
          >
            <AlertTriangle className="h-3.5 w-3.5" />
            <span>Missing MRP ({missingMrpCount})</span>
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="relative mb-4 max-w-md">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
        <input
          type="text"
          placeholder="Search brand or item..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full h-12 sm:h-10 pl-10 pr-10 text-sm font-medium border border-slate-200/80 dark:border-slate-800 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#3b2fc9]/20 focus:border-[#3b2fc9] bg-white dark:bg-slate-900 shadow-xs text-slate-900 dark:text-white"
        />
        {search && (
          <button
            onClick={() => {
              triggerHaptic('light');
              setSearch('');
            }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title="Clear search"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {error && (
        <div className="mb-3 px-3 py-2 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{error}</div>
      )}

      {/* Add New Row Form */}
      {showAdd && (
        <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-2xl shadow-xs">
          <h3 className="text-sm font-bold text-gray-800 mb-3">New Pricing Entry — {NEWRELIC_LOCATIONS[activeLocation].label}</h3>
          <div className="grid grid-cols-1 sm:grid-cols-6 gap-2.5 sm:gap-2">
            <div className="sm:col-span-1">
              <label className="text-xs font-semibold text-gray-600 mb-1 block">Brand</label>
              <input
                list="pricing-brands-new"
                value={newRow.brandName}
                onChange={e => setNewRow(r => ({ ...r, brandName: e.target.value }))}
                placeholder="Brand"
                className="w-full px-3 py-2 sm:py-1.5 text-sm border border-gray-300 rounded-xl sm:rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#3b2fc9]/30"
              />
              <datalist id="pricing-brands-new">
                {availableBrands.map(b => <option key={b} value={b} />)}
              </datalist>
            </div>
            <div className="sm:col-span-2">
              <label className="text-xs font-semibold text-gray-600 mb-1 block">Item Name</label>
              <input
                list="pricing-items-new"
                value={newRow.itemName}
                onChange={e => setNewRow(r => ({ ...r, itemName: e.target.value }))}
                placeholder="Item Name"
                className="w-full px-3 py-2 sm:py-1.5 text-sm border border-gray-300 rounded-xl sm:rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#3b2fc9]/30"
              />
              <datalist id="pricing-items-new">
                {getCatalogItemsForBrand(newRow.brandName).map(it => <option key={it} value={it} />)}
              </datalist>
            </div>
            <div className="grid grid-cols-2 sm:contents gap-2">
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1 block">MRP (₹)</label>
                <input
                  type="number"
                  value={newRow.mrp}
                  onChange={e => setNewRow(r => {
                    const updated = { ...r, mrp: e.target.value };
                    return { ...updated, purchaseCost: autoCalcCost(e.target.value, r.discountPercent) };
                  })}
                  placeholder="0.00"
                  min="0"
                  className="w-full px-3 py-2 sm:py-1.5 text-sm border border-gray-300 rounded-xl sm:rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#3b2fc9]/30 text-right font-medium"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1 block">Disc (%)</label>
                <input
                  type="number"
                  value={newRow.discountPercent}
                  onChange={e => setNewRow(r => {
                    const updated = { ...r, discountPercent: e.target.value };
                    return { ...updated, purchaseCost: autoCalcCost(r.mrp, e.target.value) };
                  })}
                  placeholder="0"
                  min="0"
                  max="100"
                  className="w-full px-3 py-2 sm:py-1.5 text-sm border border-gray-300 rounded-xl sm:rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#3b2fc9]/30 text-right font-medium"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 sm:contents gap-2">
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1 block">P.Cost (₹)</label>
                <input
                  type="number"
                  value={newRow.purchaseCost}
                  onChange={e => setNewRow(r => ({ ...r, purchaseCost: e.target.value }))}
                  placeholder="0.00"
                  min="0"
                  className="w-full px-3 py-2 sm:py-1.5 text-sm border border-gray-300 rounded-xl sm:rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#3b2fc9]/30 text-right font-bold text-[#3b2fc9]"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1 block">Effective Date</label>
                <input
                  type="date"
                  value={newRow.effectiveDate}
                  onChange={e => setNewRow(r => ({ ...r, effectiveDate: e.target.value }))}
                  className="w-full px-2 py-2 sm:py-1.5 text-xs border border-gray-300 rounded-xl sm:rounded-md bg-white focus:outline-none"
                />
              </div>
            </div>
          </div>
          <div className="flex gap-2 mt-3">
            <button
              onClick={handleSaveNew}
              disabled={saving}
              className="flex items-center gap-1.5 bg-[#3b2fc9] text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-[#2f25a8] disabled:opacity-50 transition-colors shadow-xs active:scale-95"
            >
              <Check className="h-4 w-4" /> Save Entry
            </button>
            <button
              onClick={() => { setShowAdd(false); setError(''); }}
              className="flex items-center gap-1.5 bg-white border border-gray-300 text-gray-600 px-4 py-2 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors"
            >
              <X className="h-4 w-4" /> Cancel
            </button>
          </div>
        </div>
      )}

      {/* Table & Cards */}
      {loading ? (
        <div className="py-16 text-center text-gray-400 text-sm">Loading pricing data…</div>
      ) : filteredItems.length === 0 ? (
        <div className="py-16 text-center text-gray-400 text-sm bg-white rounded-2xl border border-gray-200 border-dashed">
          No pricing entries for {NEWRELIC_LOCATIONS[activeLocation].label} yet.
          <br />
          <span className="text-xs text-gray-400">Click &ldquo;Add Pricing Row&rdquo; to get started.</span>
        </div>
      ) : (
        <>
          {/* ── Mobile Card List View (< md) ── */}
          <div className="md:hidden space-y-3">
            {filteredItems.map(item => (
              <div key={item.id} className="bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl border border-slate-200/80 dark:border-slate-800 p-4 shadow-xs space-y-3">
                {editingId === item.id ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 bg-indigo-50 dark:bg-indigo-950/50 rounded-xl text-[#3b2fc9]">
                          <Pencil className="h-4 w-4" />
                        </div>
                        <span className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">Edit Rate</span>
                      </div>
                      <span className="text-xs font-bold text-slate-500 dark:text-slate-400">{item.brandName}</span>
                    </div>
                    <div className="space-y-2.5">
                      <div>
                        <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-0.5 block">Brand Name</label>
                        <input
                          list="pricing-brands-edit-mob"
                          value={editRow.brandName}
                          onChange={e => setEditRow(r => ({ ...r, brandName: e.target.value }))}
                          className="w-full h-11 px-3 text-sm font-medium border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#3b2fc9]/20"
                        />
                        <datalist id="pricing-brands-edit-mob">
                          {availableBrands.map(b => <option key={b} value={b} />)}
                        </datalist>
                      </div>
                      <div>
                        <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-0.5 block">Item Name</label>
                        <input
                          list="pricing-items-edit-mob"
                          value={editRow.itemName}
                          onChange={e => setEditRow(r => ({ ...r, itemName: e.target.value }))}
                          className="w-full h-11 px-3 text-sm font-medium border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#3b2fc9]/20"
                        />
                        <datalist id="pricing-items-edit-mob">
                          {getCatalogItemsForBrand(editRow.brandName).map(it => <option key={it} value={it} />)}
                        </datalist>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-0.5 block">MRP (₹)</label>
                          <input
                            type="number"
                            value={editRow.mrp}
                            onChange={e => setEditRow(r => {
                              const updated = { ...r, mrp: e.target.value };
                              return { ...updated, purchaseCost: autoCalcCost(e.target.value, r.discountPercent) };
                            })}
                            className="w-full h-11 px-3 text-sm font-mono font-bold border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-right"
                          />
                        </div>
                        <div>
                          <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-0.5 block">Disc (%)</label>
                          <input
                            type="number"
                            value={editRow.discountPercent}
                            onChange={e => setEditRow(r => {
                              const updated = { ...r, discountPercent: e.target.value };
                              return { ...updated, purchaseCost: autoCalcCost(r.mrp, e.target.value) };
                            })}
                            className="w-full h-11 px-3 text-sm font-mono font-bold border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-right"
                          />
                        </div>
                        <div>
                          <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-0.5 block">P.Cost (₹)</label>
                          <input
                            type="number"
                            value={editRow.purchaseCost}
                            onChange={e => setEditRow(r => ({ ...r, purchaseCost: e.target.value }))}
                            className="w-full h-11 px-3 text-sm font-mono font-black border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-[#3b2fc9] dark:text-indigo-400 text-right"
                          />
                        </div>
                        <div>
                          <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-0.5 block">Effective Date</label>
                          <input
                            type="date"
                            value={editRow.effectiveDate}
                            onChange={e => setEditRow(r => ({ ...r, effectiveDate: e.target.value }))}
                            className="w-full h-11 px-2.5 text-xs font-semibold border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                          />
                        </div>
                      </div>
                      <div className="flex gap-2 pt-1">
                        <button
                          onClick={() => {
                            triggerHaptic('medium');
                            handleSaveEdit();
                          }}
                          disabled={saving}
                          className="flex-1 h-11 rounded-xl bg-gradient-to-r from-[#3b2fc9] to-indigo-600 text-white text-xs font-bold hover:from-[#2d23a0] hover:to-indigo-700 flex items-center justify-center gap-1.5 shadow-md shadow-indigo-500/20 active:scale-95 transition-all"
                        >
                          <Check className="h-4 w-4" /> Save
                        </button>
                        <button
                          onClick={() => {
                            triggerHaptic('light');
                            setEditingId(null);
                            setError('');
                          }}
                          className="h-11 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-bold hover:bg-slate-50 transition-all active:scale-95"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Card Header */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-black text-[10px] uppercase tracking-wider bg-indigo-50 dark:bg-indigo-950/60 text-[#3b2fc9] dark:text-indigo-400 px-2.5 py-0.5 rounded-full border border-indigo-100 dark:border-indigo-900/60">
                            {item.brandName}
                          </span>
                          {(!item.purchaseCost || item.purchaseCost <= 0) && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-900/60">
                              Zero Cost
                            </span>
                          )}
                          {(!item.mrp || item.mrp <= 0) && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-900/60">
                              No MRP
                            </span>
                          )}
                        </div>
                        <p className="font-bold text-slate-900 dark:text-white text-sm mt-1 leading-snug">
                          {item.itemName}
                        </p>
                      </div>
                    </div>

                    {/* Metrics 4-box Grid */}
                    <div className="grid grid-cols-4 gap-1.5 bg-slate-50/80 dark:bg-slate-800/50 rounded-2xl p-2.5 border border-slate-100 dark:border-slate-800">
                      <div>
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">MRP</p>
                        <p className="text-xs font-mono font-bold text-slate-800 dark:text-slate-200 mt-0.5 truncate">
                          {item.mrp > 0 ? `₹${item.mrp.toFixed(2)}` : <span className="text-red-400">₹0.00</span>}
                        </p>
                      </div>
                      <div>
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Disc</p>
                        <p className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400 mt-0.5 truncate">
                          {item.discountPercent}%
                        </p>
                      </div>
                      <div>
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">P.Cost</p>
                        <p className="text-xs font-mono font-black text-[#3b2fc9] dark:text-indigo-400 mt-0.5 truncate">
                          {item.purchaseCost > 0 ? `₹${item.purchaseCost.toFixed(2)}` : <span className="text-red-500">₹0.00</span>}
                        </p>
                      </div>
                      <div>
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Margin</p>
                        <p className="text-xs font-mono font-black text-emerald-700 dark:text-emerald-400 mt-0.5 truncate">
                          {item.mrp > 0 && item.purchaseCost > 0 ? `₹${(item.mrp - item.purchaseCost).toFixed(1)}` : '₹0'}
                        </p>
                      </div>
                    </div>

                    {/* Card Footer: Effective date & actions */}
                    <div className="flex items-center justify-between pt-1 border-t border-slate-100 dark:border-slate-800 text-xs">
                      <div className="flex items-center gap-1.5 text-slate-400 text-[11px] font-medium">
                        <Calendar className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                        <span>{item.effectiveDate || 'Initial'}</span>
                        {item.history && item.history.length > 0 && (
                          <span className="text-[#3b2fc9] dark:text-indigo-400 font-bold">
                            ({item.history.length} rev)
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1">
                        {item.history && item.history.length > 0 && (
                          <button
                            onClick={() => {
                              triggerHaptic('light');
                              setHistoryItem(item);
                            }}
                            className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-slate-800 rounded-xl transition-colors active:scale-95"
                            title="View Price History"
                          >
                            <History className="h-4 w-4" />
                          </button>
                        )}
                        <button
                          onClick={() => {
                            triggerHaptic('light');
                            startEdit(item);
                          }}
                          className="p-2 text-slate-600 hover:text-[#3b2fc9] hover:bg-blue-50 dark:hover:bg-slate-800 rounded-xl transition-colors active:scale-95"
                          title="Edit"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => {
                            triggerHaptic('medium');
                            handleDelete(item.id!);
                          }}
                          className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-xl transition-colors active:scale-95"
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>

          {/* ── Desktop Table View (>= md) with full horizontal scroll protection ── */}
          <div className="hidden md:block bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[760px]">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Brand</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Item Name</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">MRP (₹)</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Disc (%)</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">P.Cost (₹)</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Margin (₹ / %)</th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Effective Since</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredItems.map(item => (
                    <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                      {editingId === item.id ? (
                        <>
                          <td className="px-3 py-2">
                            <input
                              list="pricing-brands-edit"
                              value={editRow.brandName}
                              onChange={e => setEditRow(r => ({ ...r, brandName: e.target.value }))}
                              className="w-full px-2 py-1 text-sm border border-blue-300 rounded focus:outline-none"
                            />
                            <datalist id="pricing-brands-edit">
                              {availableBrands.map(b => <option key={b} value={b} />)}
                            </datalist>
                          </td>
                          <td className="px-3 py-2">
                            <input
                              list="pricing-items-edit"
                              value={editRow.itemName}
                              onChange={e => setEditRow(r => ({ ...r, itemName: e.target.value }))}
                              className="w-full px-2 py-1 text-sm border border-blue-300 rounded focus:outline-none"
                            />
                            <datalist id="pricing-items-edit">
                              {getCatalogItemsForBrand(editRow.brandName).map(it => <option key={it} value={it} />)}
                            </datalist>
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="number"
                              value={editRow.mrp}
                              onChange={e => setEditRow(r => {
                                const updated = { ...r, mrp: e.target.value };
                                return { ...updated, purchaseCost: autoCalcCost(e.target.value, r.discountPercent) };
                              })}
                              className="w-24 px-2 py-1 text-sm border border-blue-300 rounded text-right focus:outline-none"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="number"
                              value={editRow.discountPercent}
                              onChange={e => setEditRow(r => {
                                const updated = { ...r, discountPercent: e.target.value };
                                return { ...updated, purchaseCost: autoCalcCost(r.mrp, e.target.value) };
                              })}
                              className="w-20 px-2 py-1 text-sm border border-blue-300 rounded text-right focus:outline-none"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="number"
                              value={editRow.purchaseCost}
                              onChange={e => setEditRow(r => ({ ...r, purchaseCost: e.target.value }))}
                              className="w-24 px-2 py-1 text-sm border border-blue-300 rounded text-right focus:outline-none font-semibold"
                            />
                          </td>
                          <td className="px-3 py-2 text-right">
                            {(() => {
                              const m = parseFloat(editRow.mrp) - parseFloat(editRow.purchaseCost);
                              const pct = parseFloat(editRow.mrp) > 0 ? (m / parseFloat(editRow.mrp)) * 100 : 0;
                              return !isNaN(m) && !isNaN(pct) ? (
                                <span className="font-mono text-xs font-bold text-emerald-600">
                                  ₹{m.toFixed(2)} ({pct.toFixed(0)}%)
                                </span>
                              ) : '-';
                            })()}
                          </td>
                          <td className="px-3 py-2 text-center">
                            <input
                              type="date"
                              value={editRow.effectiveDate}
                              onChange={e => setEditRow(r => ({ ...r, effectiveDate: e.target.value }))}
                              className="px-2 py-1 text-xs border border-blue-300 rounded focus:outline-none"
                            />
                          </td>
                          <td className="px-3 py-2 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <button onClick={handleSaveEdit} disabled={saving} className="p-1.5 text-green-600 hover:bg-green-50 rounded-md transition-colors" title="Save">
                                <Check className="h-4 w-4" />
                              </button>
                              <button onClick={() => { setEditingId(null); setError(''); }} className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-md transition-colors" title="Cancel">
                                <X className="h-4 w-4" />
                              </button>
                            </div>
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="px-4 py-3 font-medium text-gray-800">{item.brandName}</td>
                          <td className="px-4 py-3 text-gray-600">
                            {item.itemName}
                            {(!item.purchaseCost || item.purchaseCost <= 0) && (
                              <span className="ml-2 inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-bold bg-red-100 text-red-700">
                                Zero Cost
                              </span>
                            )}
                            {(!item.mrp || item.mrp <= 0) && (
                              <span className="ml-2 inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-bold bg-amber-100 text-amber-700">
                                No MRP
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right text-gray-700">
                            {item.mrp > 0 ? `₹${item.mrp.toFixed(2)}` : <span className="text-red-400 font-medium">₹0.00</span>}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-700">
                              {item.discountPercent}%
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right font-semibold text-[#3b2fc9]">
                            {item.purchaseCost > 0 ? `₹${item.purchaseCost.toFixed(2)}` : <span className="text-red-500 font-bold">₹0.00</span>}
                          </td>
                          <td className="px-4 py-3 text-right">
                            {item.mrp > 0 && item.purchaseCost > 0 ? (() => {
                              const margin = item.mrp - item.purchaseCost;
                              const marginPct = (margin / item.mrp) * 100;
                              const isHealthy = marginPct >= 25;
                              const isModerate = marginPct >= 15 && marginPct < 25;
                              return (
                                <div className="inline-flex flex-col items-end">
                                  <span className="font-mono text-xs font-bold text-slate-800">
                                    ₹{margin.toFixed(2)}
                                  </span>
                                  <span
                                    className={cn(
                                      "text-[10px] font-black px-1.5 py-0.2 rounded-full border",
                                      isHealthy
                                        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                        : isModerate
                                        ? "bg-amber-50 text-amber-700 border-amber-200"
                                        : "bg-rose-50 text-rose-700 border-rose-200"
                                    )}
                                  >
                                    {marginPct.toFixed(1)}%
                                  </span>
                                </div>
                              );
                            })() : (
                              <span className="text-xs text-slate-400 font-mono">-</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-center text-xs text-gray-500">
                            <span className="inline-flex items-center gap-1">
                              <Calendar className="h-3 w-3 text-gray-400" />
                              {item.effectiveDate || 'Initial'}
                            </span>
                            {item.history && item.history.length > 0 && (
                              <span className="block text-[10px] text-blue-600 font-medium">
                                {item.history.length} revision{item.history.length > 1 ? 's' : ''}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={() => setHistoryItem(item)}
                                className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors"
                                title="View Price History & Margin Audit"
                              >
                                <History className="h-3.5 w-3.5" />
                              </button>
                              <button onClick={() => startEdit(item)} className="p-1.5 text-gray-400 hover:text-[#3b2fc9] hover:bg-blue-50 rounded-md transition-colors" title="Edit">
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                              <button onClick={() => handleDelete(item.id!)} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors" title="Delete">
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-4 py-2 bg-gray-50 border-t border-gray-200 text-xs text-gray-400">
              {filteredItems.length} item{filteredItems.length !== 1 ? 's' : ''} · {NEWRELIC_LOCATIONS[activeLocation].label}
            </div>
          </div>
        </>
      )}

      {/* ─── Batch Price Update Modal ─── */}
      {showBulkModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center p-0 sm:p-4 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl shadow-2xl max-w-md w-full p-5 sm:p-6 space-y-4 max-h-[92vh] overflow-y-auto pb-[max(1.25rem,env(safe-area-inset-bottom))] animate-in slide-in-from-bottom duration-200 border-t sm:border border-slate-200 dark:border-slate-800">
            <div className="sm:hidden w-12 h-1.5 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto -mt-1 mb-2 shrink-0" />
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 rounded-2xl">
                  <Sliders className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-black text-slate-900 dark:text-white text-base">Batch Price Update</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Update rates across an entire brand in {NEWRELIC_LOCATIONS[activeLocation].label}</p>
                </div>
              </div>
              <button
                onClick={() => {
                  triggerHaptic('light');
                  setShowBulkModal(false);
                }}
                className="p-1.5 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3.5 text-xs">
              {/* Select Brand */}
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Target Brand</label>
                <select
                  value={bulkBrand}
                  onChange={(e) => setBulkBrand(e.target.value)}
                  className="w-full h-11 px-3 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm font-medium bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600"
                >
                  <option value="">-- Choose Brand --</option>
                  {availableBrands.map((b) => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-400 mt-1">
                  Affects all {locationItems.filter(i => i.brandName.toLowerCase() === bulkBrand.toLowerCase()).length} items currently configured under this brand.
                </p>
              </div>

              {/* Update Strategy Mode */}
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Update Strategy</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic('light');
                      setBulkMode('percentage_increase');
                      setBulkValue(5);
                    }}
                    className={cn(
                      "p-2.5 rounded-2xl border text-center transition-all active:scale-95",
                      bulkMode === 'percentage_increase'
                        ? 'border-purple-600 bg-purple-50 dark:bg-purple-950/40 text-purple-800 dark:text-purple-300 font-bold shadow-xs'
                        : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50'
                    )}
                  >
                    <ArrowUpRight className="h-4 w-4 mx-auto mb-0.5 text-purple-600 dark:text-purple-400" />
                    +X% Inflation
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic('light');
                      setBulkMode('set_discount');
                      setBulkValue(20);
                    }}
                    className={cn(
                      "p-2.5 rounded-2xl border text-center transition-all active:scale-95",
                      bulkMode === 'set_discount'
                        ? 'border-purple-600 bg-purple-50 dark:bg-purple-950/40 text-purple-800 dark:text-purple-300 font-bold shadow-xs'
                        : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50'
                    )}
                  >
                    <Percent className="h-4 w-4 mx-auto mb-0.5 text-purple-600 dark:text-purple-400" />
                    Set Disc %
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic('light');
                      setBulkMode('fixed_increase');
                      setBulkValue(2);
                    }}
                    className={cn(
                      "p-2.5 rounded-2xl border text-center transition-all active:scale-95",
                      bulkMode === 'fixed_increase'
                        ? 'border-purple-600 bg-purple-50 dark:bg-purple-950/40 text-purple-800 dark:text-purple-300 font-bold shadow-xs'
                        : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50'
                    )}
                  >
                    <Layers className="h-4 w-4 mx-auto mb-0.5 text-purple-600 dark:text-purple-400" />
                    Flat ₹ Shift
                  </button>
                </div>
              </div>

              {/* Field to apply to */}
              {bulkMode !== 'set_discount' && (
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Apply Multiplier To</label>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-1.5 cursor-pointer text-slate-800 dark:text-slate-200 font-medium">
                      <input
                        type="radio"
                        checked={bulkApplyTo === 'purchaseCost'}
                        onChange={() => setBulkApplyTo('purchaseCost')}
                        className="text-purple-600"
                      />
                      <span>Purchase Cost (P.Cost)</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer text-slate-800 dark:text-slate-200 font-medium">
                      <input
                        type="radio"
                        checked={bulkApplyTo === 'mrp'}
                        onChange={() => setBulkApplyTo('mrp')}
                        className="text-purple-600"
                      />
                      <span>MRP (Retail Price)</span>
                    </label>
                  </div>
                </div>
              )}

              {/* Multiplier Value */}
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  {bulkMode === 'percentage_increase' ? 'Percentage Adjustment (+ / - %)' : bulkMode === 'set_discount' ? 'Uniform Discount (%)' : 'Flat Amount (₹)'}
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={bulkValue}
                  onChange={(e) => setBulkValue(parseFloat(e.target.value) || 0)}
                  className="w-full h-11 px-3 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  placeholder="e.g. 5"
                />
              </div>

              {/* Effective Date */}
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Effective Date for New Prices</label>
                <input
                  type="date"
                  value={bulkEffectiveDate}
                  onChange={(e) => setBulkEffectiveDate(e.target.value)}
                  className="w-full h-11 px-3 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Historical DCs dated prior to this date will preserve their original pricing.
                </p>
              </div>

              {/* Revision Reason / Audit Note */}
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Reason for Price Revision (Audit Trail)
                </label>
                <input
                  type="text"
                  value={bulkReason}
                  onChange={(e) => setBulkReason(e.target.value)}
                  placeholder="e.g. Vendor annual hike, brand promotional discount..."
                  className="w-full h-11 px-3 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {['Vendor Annual Hike', 'Brand Promo Discount', 'Distributor Inflation', 'GST Tax Revision'].map((chip) => (
                    <button
                      key={chip}
                      type="button"
                      onClick={() => setBulkReason(chip)}
                      className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-purple-100 text-slate-600 dark:text-slate-300 hover:text-purple-700 transition-colors cursor-pointer"
                    >
                      + {chip}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => {
                  triggerHaptic('light');
                  setShowBulkModal(false);
                }}
                className="flex-1 h-11 rounded-2xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 transition-all active:scale-95"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  triggerHaptic('medium');
                  handleBulkUpdate();
                }}
                disabled={isBulkUpdating || !bulkBrand}
                className="flex-1 h-11 rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 disabled:opacity-50 text-white text-xs font-bold shadow-md shadow-purple-500/20 transition-all active:scale-95"
              >
                {isBulkUpdating ? 'Updating…' : 'Apply Batch Update'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Price History Audit Modal ─── */}
      {historyItem && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center p-0 sm:p-4 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl shadow-2xl max-w-lg w-full p-5 sm:p-6 space-y-4 max-h-[92vh] overflow-y-auto pb-[max(1.25rem,env(safe-area-inset-bottom))] animate-in slide-in-from-bottom duration-200 border-t sm:border border-slate-200 dark:border-slate-800">
            <div className="sm:hidden w-12 h-1.5 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto -mt-1 mb-2 shrink-0" />
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 rounded-2xl">
                  <History className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-black text-slate-900 dark:text-white text-base">{historyItem.itemName}</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{historyItem.brandName} · {NEWRELIC_LOCATIONS[historyItem.location].label}</p>
                </div>
              </div>
              <button
                onClick={() => {
                  triggerHaptic('light');
                  setHistoryItem(null);
                }}
                className="p-1.5 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {(() => {
              const currentMargin = historyItem.mrp - historyItem.purchaseCost;
              const currentMarginPct = historyItem.mrp > 0 ? (currentMargin / historyItem.mrp) * 100 : 0;
              const isHealthy = currentMarginPct >= 25;
              const isModerate = currentMarginPct >= 15 && currentMarginPct < 25;

              return (
                <div className="space-y-4">
                  {/* Current Active Rate Card with Margin Breakdown */}
                  <div className="bg-gradient-to-br from-indigo-50/90 to-purple-50/90 dark:from-indigo-950/40 dark:to-purple-950/40 border border-indigo-200/80 dark:border-indigo-900/60 rounded-2xl p-4 text-xs space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black uppercase tracking-wider text-indigo-700 dark:text-indigo-300">
                        Current Active Pricing &amp; Margin
                      </span>
                      <span
                        className={cn(
                          "px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border",
                          isHealthy
                            ? "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300"
                            : isModerate
                            ? "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300"
                            : "bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950/60 dark:text-rose-300"
                        )}
                      >
                        {isHealthy ? 'Healthy Margin' : isModerate ? 'Moderate Margin' : 'Low Margin Alert'}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 border-t border-indigo-100 dark:border-indigo-900/60">
                      <div>
                        <span className="text-[10px] text-slate-500 uppercase tracking-wider block">Procurement Cost</span>
                        <span className="font-mono font-black text-slate-900 dark:text-white text-sm">
                          ₹{historyItem.purchaseCost.toFixed(2)}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-500 uppercase tracking-wider block">Retail MRP</span>
                        <span className="font-mono font-bold text-slate-800 dark:text-slate-200 text-sm">
                          ₹{historyItem.mrp.toFixed(2)}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-500 uppercase tracking-wider block">Profit Margin</span>
                        <span className="font-mono font-black text-emerald-600 dark:text-emerald-400 text-sm">
                          ₹{currentMargin.toFixed(2)}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-500 uppercase tracking-wider block">Margin Rate</span>
                        <span className="font-mono font-black text-indigo-600 dark:text-indigo-400 text-sm">
                          {currentMarginPct.toFixed(1)}%
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 pt-1 border-t border-indigo-100 dark:border-indigo-900/40">
                      <span>Effective Date: <strong>{historyItem.effectiveDate || 'Initial'}</strong></span>
                      <span>Discount: <strong>{historyItem.discountPercent}%</strong></span>
                    </div>
                  </div>

                  {/* Historical Rate & Margin Progression Timeline */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
                        Price Revision &amp; Margin History
                      </h4>
                      <span className="text-[10px] text-slate-400 font-medium">
                        {(historyItem.history || []).length} Recorded Revisions
                      </span>
                    </div>

                    {(!historyItem.history || historyItem.history.length === 0) ? (
                      <div className="p-6 text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">
                        <History className="w-6 h-6 text-slate-300 dark:text-slate-600 mx-auto mb-1" />
                        <p className="text-xs text-slate-400">No previous rate revisions recorded. This is the initial baseline rate.</p>
                      </div>
                    ) : (
                      <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
                        {historyItem.history.slice().reverse().map((h, idx) => {
                          const hMargin = h.marginAmount !== undefined ? h.marginAmount : (h.mrp - h.purchaseCost);
                          const hMarginPct = h.marginPercent !== undefined ? h.marginPercent : (h.mrp > 0 ? (hMargin / h.mrp) * 100 : 0);
                          const isCostHike = h.deltaCost !== undefined && h.deltaCost > 0;
                          const isCostCut = h.deltaCost !== undefined && h.deltaCost < 0;

                          return (
                            <div key={idx} className="border border-slate-200/80 dark:border-slate-800 rounded-2xl p-3 bg-slate-50/70 dark:bg-slate-800/40 text-xs space-y-2">
                              <div className="flex items-start justify-between gap-2">
                                <div>
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="font-mono font-black text-slate-900 dark:text-white">
                                      P.Cost: ₹{h.purchaseCost.toFixed(2)}
                                    </span>
                                    <span className="text-slate-400">·</span>
                                    <span className="font-mono text-slate-600 dark:text-slate-400">
                                      MRP: ₹{h.mrp.toFixed(2)} ({h.discountPercent}%)
                                    </span>
                                    {h.deltaCost !== undefined && (
                                      <span
                                        className={cn(
                                          "px-2 py-0.2 rounded-full text-[9px] font-black uppercase tracking-wider border",
                                          isCostHike
                                            ? "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300"
                                            : isCostCut
                                            ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300"
                                            : "bg-slate-100 text-slate-600 border-slate-200"
                                        )}
                                      >
                                        {isCostHike ? `+₹${h.deltaCost.toFixed(2)} Hike` : isCostCut ? `-₹${Math.abs(h.deltaCost).toFixed(2)} Cut` : 'No Change'}
                                      </span>
                                    )}
                                  </div>
                                  <div className="mt-1 flex items-center gap-2 flex-wrap">
                                    <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400">
                                      Margin: ₹{hMargin.toFixed(2)} ({hMarginPct.toFixed(1)}%)
                                    </span>
                                    {h.reason && (
                                      <span className="px-2 py-0.5 rounded-md bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 text-[10px] font-medium">
                                        🏷️ {h.reason}
                                      </span>
                                    )}
                                  </div>
                                </div>
                                <div className="text-right shrink-0">
                                  <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300 block">
                                    Valid around {h.effectiveDate}
                                  </span>
                                  {h.updatedBy && (
                                    <span className="text-[10px] text-slate-400 block font-mono">
                                      {h.updatedBy.split('@')[0]}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}

            <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => {
                  triggerHaptic('light');
                  setHistoryItem(null);
                }}
                className="w-full h-11 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-2xl active:scale-95 transition-all"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Enhanced Seed Pricing from Challan History Modal */}
      <SeedHistoryModal
        isOpen={showSeedModal}
        onClose={() => setShowSeedModal(false)}
        activeLocation={activeLocation}
        onSeedSuccess={async (res) => {
          setSeedResult(
            `✓ Seeded ${res.seeded} new item(s) and updated ${res.updated} item(s) in ${(res.durationMs / 1000).toFixed(1)}s (${res.skipped} skipped).`
          );
          try {
            const refreshed = await getPricingItems(activeLocation);
            setPricingItems(refreshed);
          } catch (e) {
            console.error('Failed to reload pricing after seed:', e);
          }
        }}
      />
    </div>
  );
}
