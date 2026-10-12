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
} from 'lucide-react';

type EditRow = {
  brandName: string;
  itemName: string;
  location: NewRelicLocation;
  mrp: string;
  discountPercent: string;
  purchaseCost: string;
  effectiveDate?: string;
};

const emptyEdit = (location: NewRelicLocation): EditRow => ({
  brandName: '',
  itemName: '',
  location,
  mrp: '',
  discountPercent: '',
  purchaseCost: '',
  effectiveDate: new Date().toISOString().substring(0, 10),
});

export default function PricingPage() {
  const { user, role } = useAuth();
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
  const [isBulkUpdating, setIsBulkUpdating] = useState(false);

  // Price history modal state
  const [historyItem, setHistoryItem] = useState<PricingItem | null>(null);

  useEffect(() => {
    if (role && role !== 'admin') {
      router.push('/newrelic');
    }
  }, [role, router]);

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
      await savePricingItem(item, user?.email);
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
      await savePricingItem(item, user?.email);
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

  if (!role || role !== 'admin') return null;

  const locations: NewRelicLocation[] = ['hyderabad', 'bangalore'];

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-8 py-6">
      {/* Header */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="h-5 w-5 text-[#3b2fc9]" />
            <h1 className="text-xl font-bold text-gray-900">Procurement Pricing</h1>
          </div>
          <p className="text-sm text-gray-500">
            Set MRP and discount per item per location. These prices auto-fill P.Cost when creating new DCs.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => {
              setShowBulkModal(true);
              setBulkBrand(availableBrands[0] || '');
              setError('');
            }}
            className="flex items-center gap-1.5 bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-3.5 py-2 rounded-lg text-sm font-semibold hover:from-purple-700 hover:to-indigo-700 shadow-xs transition-all"
          >
            <Sliders className="h-4 w-4" />
            Batch Price Update
          </button>

          <button
            onClick={async () => {
              if (!confirm('This will populate the Pricing table from your existing DC history (latest data wins). Continue?')) return;
              setIsSeeding(true);
              setSeedResult(null);
              setError('');
              try {
                const result = await seedPricingFromChallans();
                const refreshed = await getAllPricingItems();
                setPricingItems(refreshed);
                setSeedResult(`✓ Seeded ${result.seeded} item(s) from DC history (${result.skipped} already covered by newer DCs).`);
              } catch {
                setError('Seeding failed. Please try again.');
              } finally {
                setIsSeeding(false);
              }
            }}
            disabled={isSeeding || isCleaning || saving}
            className="flex items-center gap-1.5 bg-white border border-gray-300 text-gray-600 px-3 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 disabled:opacity-50 transition-colors"
          >
            <RefreshCw className={`h-4 w-4 ${isSeeding ? 'animate-spin' : ''}`} />
            {isSeeding ? 'Seeding…' : 'Seed from DC History'}
          </button>
          
          <button
            onClick={handleCleanPricing}
            disabled={isSeeding || isCleaning || saving}
            className="flex items-center gap-1.5 bg-white border border-red-200 text-red-600 px-3 py-2 rounded-lg text-sm font-medium hover:bg-red-50 disabled:opacity-50 transition-colors"
          >
            <Trash2 className={`h-4 w-4 ${isCleaning ? 'animate-spin' : ''}`} />
            {isCleaning ? 'Cleaning…' : 'Clean Orphaned Data'}
          </button>
          <button
            onClick={() => { setShowAdd(true); setNewRow(emptyEdit(activeLocation)); setError(''); setSeedResult(null); }}
            className="flex items-center gap-1.5 bg-[#3b2fc9] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#2f25a8] transition-colors"
          >
            <Plus className="h-4 w-4" /> Add Pricing Row
          </button>
        </div>
      </div>

      {/* Seed result banner */}
      {seedResult && (
        <div className="mb-3 px-3 py-2 bg-green-50 border border-green-200 text-green-700 rounded-lg text-sm flex items-center justify-between">
          <span>{seedResult}</span>
          <button onClick={() => setSeedResult(null)} className="ml-2 text-green-500 hover:text-green-700"><X className="h-3.5 w-3.5" /></button>
        </div>
      )}

      {/* Location Tabs + Filter Pills Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        {/* Location switcher */}
        <div className="w-full sm:w-auto flex p-1 bg-gray-100 rounded-xl border border-gray-200/80 shadow-2xs">
          {locations.map(loc => {
            const isSelected = activeLocation === loc;
            const count = pricingItems.filter(i => i.location === loc).length;
            return (
              <button
                key={loc}
                onClick={() => { setActiveLocation(loc); setEditingId(null); setShowAdd(false); }}
                className={`flex-1 sm:flex-initial px-4 py-2 sm:py-1.5 rounded-lg text-xs sm:text-sm font-bold sm:font-medium transition-all flex items-center justify-center gap-1.5 active:scale-98 ${
                  isSelected
                    ? 'bg-white text-[#3b2fc9] shadow-xs'
                    : 'text-gray-500 hover:text-gray-800'
                }`}
              >
                <span>{NEWRELIC_LOCATIONS[loc].label}</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono font-medium ${
                  isSelected ? 'bg-indigo-50 text-[#3b2fc9]' : 'bg-gray-200/70 text-gray-500'
                }`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Missing Rate Audit Filter Pills */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1 -mx-4 px-4 sm:mx-0 sm:px-0">
          <button
            onClick={() => setFilterMode('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors shrink-0 ${
              filterMode === 'all'
                ? 'bg-gray-800 text-white'
                : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            All Items ({locationItems.length})
          </button>

          <button
            onClick={() => setFilterMode('missing-cost')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap flex items-center gap-1.5 transition-colors shrink-0 ${
              filterMode === 'missing-cost'
                ? 'bg-red-600 text-white shadow-xs'
                : missingCostCount > 0
                ? 'bg-red-50 border border-red-200 text-red-700 hover:bg-red-100'
                : 'bg-white border border-gray-200 text-gray-400 opacity-60'
            }`}
          >
            <AlertTriangle className="h-3.5 w-3.5" />
            Missing P.Cost ({missingCostCount})
          </button>

          <button
            onClick={() => setFilterMode('missing-mrp')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap flex items-center gap-1.5 transition-colors shrink-0 ${
              filterMode === 'missing-mrp'
                ? 'bg-amber-600 text-white shadow-xs'
                : missingMrpCount > 0
                ? 'bg-amber-50 border border-amber-200 text-amber-700 hover:bg-amber-100'
                : 'bg-white border border-gray-200 text-gray-400 opacity-60'
            }`}
          >
            <AlertTriangle className="h-3.5 w-3.5" />
            Missing MRP ({missingMrpCount})
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="relative mb-4 max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <input
          type="text"
          placeholder="Search brand or item..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full pl-9 pr-8 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#3b2fc9]/30 bg-white"
        />
        {search && (
          <button
            onClick={() => setSearch('')}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-0.5 rounded-full hover:bg-gray-100"
            title="Clear search"
          >
            <X className="h-3.5 w-3.5" />
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
              <div key={item.id} className="bg-white rounded-2xl border border-gray-200 p-4 shadow-2xs space-y-3">
                {editingId === item.id ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between pb-2 border-b border-gray-100">
                      <span className="text-xs font-bold text-[#3b2fc9]">Edit Pricing</span>
                      <span className="text-xs font-medium text-gray-500">{item.brandName}</span>
                    </div>
                    <div className="space-y-2.5">
                      <div>
                        <label className="text-[11px] font-semibold text-gray-500 mb-0.5 block">Brand Name</label>
                        <input
                          list="pricing-brands-edit-mob"
                          value={editRow.brandName}
                          onChange={e => setEditRow(r => ({ ...r, brandName: e.target.value }))}
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-xl bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#3b2fc9]/20"
                        />
                        <datalist id="pricing-brands-edit-mob">
                          {availableBrands.map(b => <option key={b} value={b} />)}
                        </datalist>
                      </div>
                      <div>
                        <label className="text-[11px] font-semibold text-gray-500 mb-0.5 block">Item Name</label>
                        <input
                          list="pricing-items-edit-mob"
                          value={editRow.itemName}
                          onChange={e => setEditRow(r => ({ ...r, itemName: e.target.value }))}
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-xl bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#3b2fc9]/20"
                        />
                        <datalist id="pricing-items-edit-mob">
                          {getCatalogItemsForBrand(editRow.brandName).map(it => <option key={it} value={it} />)}
                        </datalist>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[11px] font-semibold text-gray-500 mb-0.5 block">MRP (₹)</label>
                          <input
                            type="number"
                            value={editRow.mrp}
                            onChange={e => setEditRow(r => {
                              const updated = { ...r, mrp: e.target.value };
                              return { ...updated, purchaseCost: autoCalcCost(e.target.value, r.discountPercent) };
                            })}
                            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-xl bg-white text-right font-medium"
                          />
                        </div>
                        <div>
                          <label className="text-[11px] font-semibold text-gray-500 mb-0.5 block">Disc (%)</label>
                          <input
                            type="number"
                            value={editRow.discountPercent}
                            onChange={e => setEditRow(r => {
                              const updated = { ...r, discountPercent: e.target.value };
                              return { ...updated, purchaseCost: autoCalcCost(r.mrp, e.target.value) };
                            })}
                            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-xl bg-white text-right font-medium"
                          />
                        </div>
                        <div>
                          <label className="text-[11px] font-semibold text-gray-500 mb-0.5 block">P.Cost (₹)</label>
                          <input
                            type="number"
                            value={editRow.purchaseCost}
                            onChange={e => setEditRow(r => ({ ...r, purchaseCost: e.target.value }))}
                            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-xl bg-white text-right font-bold text-[#3b2fc9]"
                          />
                        </div>
                        <div>
                          <label className="text-[11px] font-semibold text-gray-500 mb-0.5 block">Effective Date</label>
                          <input
                            type="date"
                            value={editRow.effectiveDate}
                            onChange={e => setEditRow(r => ({ ...r, effectiveDate: e.target.value }))}
                            className="w-full px-2 py-2 text-xs border border-gray-300 rounded-xl bg-white"
                          />
                        </div>
                      </div>
                      <div className="flex gap-2 pt-1">
                        <button
                          onClick={handleSaveEdit}
                          disabled={saving}
                          className="flex-1 py-2.5 rounded-xl bg-[#3b2fc9] text-white text-xs font-semibold hover:bg-[#2d23a0] flex items-center justify-center gap-1.5 shadow-xs active:scale-95"
                        >
                          <Check className="h-4 w-4" /> Save
                        </button>
                        <button
                          onClick={() => { setEditingId(null); setError(''); }}
                          className="py-2.5 px-4 rounded-xl border border-gray-200 bg-white text-gray-600 text-xs font-medium hover:bg-gray-50"
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
                          <span className="font-bold text-[11px] bg-indigo-50 text-[#3b2fc9] px-2 py-0.5 rounded-md border border-indigo-100">
                            {item.brandName}
                          </span>
                          {(!item.purchaseCost || item.purchaseCost <= 0) && (
                            <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-red-100 text-red-700">
                              Zero Cost
                            </span>
                          )}
                          {(!item.mrp || item.mrp <= 0) && (
                            <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-amber-100 text-amber-700">
                              No MRP
                            </span>
                          )}
                        </div>
                        <p className="font-semibold text-gray-900 text-sm mt-1 leading-snug">
                          {item.itemName}
                        </p>
                      </div>
                    </div>

                    {/* Metrics 3-box Grid */}
                    <div className="grid grid-cols-3 gap-2 bg-gray-50/80 rounded-xl p-2.5 border border-gray-100">
                      <div>
                        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">MRP</p>
                        <p className="text-xs font-bold text-gray-800 mt-0.5">
                          {item.mrp > 0 ? `₹${item.mrp.toFixed(2)}` : <span className="text-red-400">₹0.00</span>}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Discount</p>
                        <p className="text-xs font-bold text-emerald-600 mt-0.5">
                          {item.discountPercent}%
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">P.Cost</p>
                        <p className="text-sm font-extrabold text-[#3b2fc9] mt-0.5">
                          {item.purchaseCost > 0 ? `₹${item.purchaseCost.toFixed(2)}` : <span className="text-red-500">₹0.00</span>}
                        </p>
                      </div>
                    </div>

                    {/* Card Footer: Effective date & actions */}
                    <div className="flex items-center justify-between pt-1 border-t border-gray-100 text-xs">
                      <div className="flex items-center gap-1.5 text-gray-400 text-[11px]">
                        <Calendar className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                        <span>{item.effectiveDate || 'Initial'}</span>
                        {item.history && item.history.length > 0 && (
                          <span className="text-[#3b2fc9] font-semibold">
                            ({item.history.length} rev)
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1">
                        {item.history && item.history.length > 0 && (
                          <button
                            onClick={() => setHistoryItem(item)}
                            className="p-1.5 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors border border-gray-100 active:scale-95"
                            title="View Price History"
                          >
                            <History className="h-4 w-4" />
                          </button>
                        )}
                        <button
                          onClick={() => startEdit(item)}
                          className="p-1.5 text-gray-600 hover:text-[#3b2fc9] hover:bg-blue-50 rounded-lg transition-colors border border-gray-100 active:scale-95"
                          title="Edit"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(item.id!)}
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors border border-gray-100 active:scale-95"
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
                              {item.history && item.history.length > 0 && (
                                <button
                                  onClick={() => setHistoryItem(item)}
                                  className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors"
                                  title="View Price History"
                                >
                                  <History className="h-3.5 w-3.5" />
                                </button>
                              )}
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
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-purple-100 text-purple-700 rounded-xl">
                  <Sliders className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 text-base">Batch Price Update</h3>
                  <p className="text-xs text-gray-500">Update rates across an entire brand in {NEWRELIC_LOCATIONS[activeLocation].label}</p>
                </div>
              </div>
              <button onClick={() => setShowBulkModal(false)} className="text-gray-400 hover:text-gray-600 p-1">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3.5 text-xs">
              {/* Select Brand */}
              <div>
                <label className="block font-semibold text-gray-700 mb-1">Target Brand</label>
                <select
                  value={bulkBrand}
                  onChange={(e) => setBulkBrand(e.target.value)}
                  className="w-full h-9 px-3 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600"
                >
                  <option value="">-- Choose Brand --</option>
                  {availableBrands.map((b) => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                </select>
                <p className="text-[11px] text-gray-400 mt-1">
                  Affects all {locationItems.filter(i => i.brandName.toLowerCase() === bulkBrand.toLowerCase()).length} items currently configured under this brand.
                </p>
              </div>

              {/* Update Strategy Mode */}
              <div>
                <label className="block font-semibold text-gray-700 mb-1">Update Strategy</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => { setBulkMode('percentage_increase'); setBulkValue(5); }}
                    className={`p-2 rounded-lg border text-center transition-all ${
                      bulkMode === 'percentage_increase'
                        ? 'border-purple-600 bg-purple-50 text-purple-800 font-bold'
                        : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    <ArrowUpRight className="h-4 w-4 mx-auto mb-0.5 text-purple-600" />
                    +X% Inflation
                  </button>
                  <button
                    type="button"
                    onClick={() => { setBulkMode('set_discount'); setBulkValue(20); }}
                    className={`p-2 rounded-lg border text-center transition-all ${
                      bulkMode === 'set_discount'
                        ? 'border-purple-600 bg-purple-50 text-purple-800 font-bold'
                        : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    <Percent className="h-4 w-4 mx-auto mb-0.5 text-purple-600" />
                    Set Disc %
                  </button>
                  <button
                    type="button"
                    onClick={() => { setBulkMode('fixed_increase'); setBulkValue(2); }}
                    className={`p-2 rounded-lg border text-center transition-all ${
                      bulkMode === 'fixed_increase'
                        ? 'border-purple-600 bg-purple-50 text-purple-800 font-bold'
                        : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    <Layers className="h-4 w-4 mx-auto mb-0.5 text-purple-600" />
                    Flat ₹ Shift
                  </button>
                </div>
              </div>

              {/* Field to apply to */}
              {bulkMode !== 'set_discount' && (
                <div>
                  <label className="block font-semibold text-gray-700 mb-1">Apply Multiplier To</label>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="radio"
                        checked={bulkApplyTo === 'purchaseCost'}
                        onChange={() => setBulkApplyTo('purchaseCost')}
                        className="text-purple-600"
                      />
                      <span>Purchase Cost (P.Cost)</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer">
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
                <label className="block font-semibold text-gray-700 mb-1">
                  {bulkMode === 'percentage_increase' ? 'Percentage Adjustment (+ / - %)' : bulkMode === 'set_discount' ? 'Uniform Discount (%)' : 'Flat Amount (₹)'}
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={bulkValue}
                  onChange={(e) => setBulkValue(parseFloat(e.target.value) || 0)}
                  className="w-full h-9 px-3 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600"
                  placeholder="e.g. 5"
                />
              </div>

              {/* Effective Date */}
              <div>
                <label className="block font-semibold text-gray-700 mb-1">Effective Date for New Prices</label>
                <input
                  type="date"
                  value={bulkEffectiveDate}
                  onChange={(e) => setBulkEffectiveDate(e.target.value)}
                  className="w-full h-9 px-3 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600"
                />
                <p className="text-[11px] text-gray-400 mt-1">
                  Historical DCs dated prior to this date will preserve their original pricing.
                </p>
              </div>
            </div>

            <div className="flex gap-2 pt-2 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setShowBulkModal(false)}
                className="flex-1 py-2 rounded-xl border border-gray-200 text-xs font-semibold text-gray-600 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleBulkUpdate}
                disabled={isBulkUpdating || !bulkBrand}
                className="flex-1 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white text-xs font-bold shadow-sm"
              >
                {isBulkUpdating ? 'Updating…' : 'Apply Batch Update'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Price History Audit Modal ─── */}
      {historyItem && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-indigo-100 text-indigo-700 rounded-xl">
                  <History className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 text-base">{historyItem.itemName}</h3>
                  <p className="text-xs text-gray-500">{historyItem.brandName} · {NEWRELIC_LOCATIONS[historyItem.location].label}</p>
                </div>
              </div>
              <button onClick={() => setHistoryItem(null)} className="text-gray-400 hover:text-gray-600 p-1">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3">
              {/* Current active rate */}
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-xs">
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 block">Current Active Rate</span>
                <div className="flex items-center justify-between mt-1">
                  <div>
                    <span className="font-bold text-emerald-950 text-sm">₹{historyItem.purchaseCost.toFixed(2)}</span>
                    <span className="text-emerald-700 ml-2">MRP: ₹{historyItem.mrp.toFixed(2)} ({historyItem.discountPercent}% off)</span>
                  </div>
                  <span className="text-[11px] font-semibold text-emerald-800">Effective Since: {historyItem.effectiveDate || 'Initial'}</span>
                </div>
              </div>

              {/* Historical logs */}
              <div>
                <h4 className="text-xs font-bold text-gray-700 mb-2">Previous Rate Timeline</h4>
                {(!historyItem.history || historyItem.history.length === 0) ? (
                  <p className="text-xs text-gray-400 py-4 text-center">No previous revisions recorded.</p>
                ) : (
                  <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                    {historyItem.history.slice().reverse().map((h, idx) => (
                      <div key={idx} className="border border-gray-100 rounded-lg p-2.5 bg-gray-50/70 text-xs flex items-center justify-between">
                        <div>
                          <p className="font-semibold text-gray-800">P.Cost: ₹{h.purchaseCost.toFixed(2)}</p>
                          <p className="text-[11px] text-gray-500">MRP: ₹{h.mrp.toFixed(2)} · {h.discountPercent}% Disc</p>
                        </div>
                        <div className="text-right">
                          <span className="text-[11px] font-medium text-gray-600 block">Valid around {h.effectiveDate}</span>
                          {h.updatedBy && <span className="text-[10px] text-gray-400 block">{h.updatedBy}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="pt-2 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setHistoryItem(null)}
                className="w-full py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold rounded-xl"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
