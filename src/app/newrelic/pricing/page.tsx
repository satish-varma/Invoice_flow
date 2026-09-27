'use client';

import { useEffect, useState, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { getCatalogItems, CatalogItem } from '@/services/newrelicCatalogService';
import {
  PricingItem,
  getPricingItems,
  savePricingItem,
  deletePricingItem,
  calcPurchaseCost,
  getAllPricingItems,
  seedPricingFromChallans,
} from '@/services/newrelicPricingService';
import { NewRelicLocation, NEWRELIC_LOCATIONS } from '@/services/newrelicChallanService';
import { Trash2, Plus, Pencil, Check, X, Search, TrendingUp, RefreshCw } from 'lucide-react';

type EditRow = {
  brandName: string;
  itemName: string;
  location: NewRelicLocation;
  mrp: string;
  discountPercent: string;
  purchaseCost: string;
};

const emptyEdit = (location: NewRelicLocation): EditRow => ({
  brandName: '',
  itemName: '',
  location,
  mrp: '',
  discountPercent: '',
  purchaseCost: '',
});

export default function PricingPage() {
  const { role } = useAuth();
  const router = useRouter();

  const [activeLocation, setActiveLocation] = useState<NewRelicLocation>('hyderabad');
  const [pricingItems, setPricingItems] = useState<PricingItem[]>([]);
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [isSeeding, setIsSeeding] = useState(false);
  const [seedResult, setSeedResult] = useState<string | null>(null);

  // Inline editing
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editRow, setEditRow] = useState<EditRow>(emptyEdit('hyderabad'));

  // Add-new form state
  const [showAdd, setShowAdd] = useState(false);
  const [newRow, setNewRow] = useState<EditRow>(emptyEdit('hyderabad'));

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

  const filteredItems = useMemo(() => {
    if (!search.trim()) return locationItems;
    const s = search.toLowerCase();
    return locationItems.filter(i =>
      i.brandName.toLowerCase().includes(s) || i.itemName.toLowerCase().includes(s)
    );
  }, [locationItems, search]);

  // Unique brands from catalog for typeahead
  const catalogBrands = useMemo(() =>
    [...new Set(catalog.map(c => c.brandName))].sort(),
    [catalog]
  );

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
      };
      await savePricingItem(item);
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
      };
      await savePricingItem(item);
      const refreshed = await getAllPricingItems();
      setPricingItems(refreshed);
      setEditingId(null);
    } catch (e) {
      setError('Failed to update. Please try again.');
    } finally {
      setSaving(false);
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
            disabled={isSeeding || saving}
            className="flex items-center gap-1.5 bg-white border border-gray-300 text-gray-600 px-3 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 disabled:opacity-50 transition-colors"
          >
            <RefreshCw className={`h-4 w-4 ${isSeeding ? 'animate-spin' : ''}`} />
            {isSeeding ? 'Seeding…' : 'Seed from DC History'}
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

      {/* Location Tabs */}
      <div className="flex gap-1 mb-4 bg-gray-100 p-1 rounded-lg w-fit">
        {locations.map(loc => (
          <button
            key={loc}
            onClick={() => { setActiveLocation(loc); setEditingId(null); setShowAdd(false); }}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
              activeLocation === loc
                ? 'bg-white text-[#3b2fc9] shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {NEWRELIC_LOCATIONS[loc].label}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative mb-4 max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <input
          type="text"
          placeholder="Search brand or item..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#3b2fc9]/30"
        />
      </div>

      {error && (
        <div className="mb-3 px-3 py-2 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{error}</div>
      )}

      {/* Add New Row Form */}
      {showAdd && (
        <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-xl">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">New Pricing Entry — {NEWRELIC_LOCATIONS[activeLocation].label}</h3>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            <div className="col-span-2 sm:col-span-1">
              <label className="text-xs text-gray-500 mb-0.5 block">Brand</label>
              <input
                list="pricing-brands-new"
                value={newRow.brandName}
                onChange={e => setNewRow(r => ({ ...r, brandName: e.target.value }))}
                placeholder="Brand"
                className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-[#3b2fc9]/30"
              />
              <datalist id="pricing-brands-new">
                {catalogBrands.map(b => <option key={b} value={b} />)}
              </datalist>
            </div>
            <div className="col-span-2 sm:col-span-1">
              <label className="text-xs text-gray-500 mb-0.5 block">Item Name</label>
              <input
                list="pricing-items-new"
                value={newRow.itemName}
                onChange={e => setNewRow(r => ({ ...r, itemName: e.target.value }))}
                placeholder="Item Name"
                className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-[#3b2fc9]/30"
              />
              <datalist id="pricing-items-new">
                {getCatalogItemsForBrand(newRow.brandName).map(it => <option key={it} value={it} />)}
              </datalist>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-0.5 block">MRP (₹)</label>
              <input
                type="number"
                value={newRow.mrp}
                onChange={e => setNewRow(r => {
                  const updated = { ...r, mrp: e.target.value };
                  return { ...updated, purchaseCost: autoCalcCost(e.target.value, r.discountPercent) };
                })}
                placeholder="0.00"
                min="0"
                className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-[#3b2fc9]/30 text-right"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-0.5 block">Disc (%)</label>
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
                className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-[#3b2fc9]/30 text-right"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-0.5 block">P.Cost (₹)</label>
              <input
                type="number"
                value={newRow.purchaseCost}
                onChange={e => setNewRow(r => ({ ...r, purchaseCost: e.target.value }))}
                placeholder="0.00"
                min="0"
                className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-[#3b2fc9]/30 text-right"
              />
            </div>
          </div>
          <div className="flex gap-2 mt-3">
            <button
              onClick={handleSaveNew}
              disabled={saving}
              className="flex items-center gap-1.5 bg-[#3b2fc9] text-white px-3 py-1.5 rounded-md text-sm font-medium hover:bg-[#2f25a8] disabled:opacity-50 transition-colors"
            >
              <Check className="h-3.5 w-3.5" /> Save
            </button>
            <button
              onClick={() => { setShowAdd(false); setError(''); }}
              className="flex items-center gap-1.5 bg-white border border-gray-200 text-gray-600 px-3 py-1.5 rounded-md text-sm font-medium hover:bg-gray-50 transition-colors"
            >
              <X className="h-3.5 w-3.5" /> Cancel
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="py-16 text-center text-gray-400 text-sm">Loading pricing data…</div>
      ) : filteredItems.length === 0 ? (
        <div className="py-16 text-center text-gray-400 text-sm">
          No pricing entries for {NEWRELIC_LOCATIONS[activeLocation].label} yet.
          <br />
          <span className="text-xs text-gray-400">Click "Add Pricing Row" to get started.</span>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Brand</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Item Name</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">MRP (₹)</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Disc (%)</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">P.Cost (₹)</th>
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
                          {catalogBrands.map(b => <option key={b} value={b} />)}
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
                      <td className="px-4 py-3 text-gray-600">{item.itemName}</td>
                      <td className="px-4 py-3 text-right text-gray-700">₹{item.mrp.toFixed(2)}</td>
                      <td className="px-4 py-3 text-right">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-700">
                          {item.discountPercent}%
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-[#3b2fc9]">₹{item.purchaseCost.toFixed(2)}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
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
          <div className="px-4 py-2 bg-gray-50 border-t border-gray-200 text-xs text-gray-400">
            {filteredItems.length} item{filteredItems.length !== 1 ? 's' : ''} · {NEWRELIC_LOCATIONS[activeLocation].label}
          </div>
        </div>
      )}
    </div>
  );
}
