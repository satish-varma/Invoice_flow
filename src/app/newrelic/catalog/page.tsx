'use client';

import { CatalogItem } from '@/types/challan';
import { useEffect, useState, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { getCatalogItems, saveCatalogItem, deleteCatalogItem } from '@/services/newrelicCatalogService';
import { getAllPricingItems } from '@/services/newrelicPricingService';
import { Trash2, Plus, Pencil, Check, X, Search, Database, Download, RefreshCw, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function CatalogPage() {
  const { role } = useAuth();
  const router = useRouter();

  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Missing alerts filter tab: 'all' | 'missing-mrp' | 'missing-case'
  const [filterMode, setFilterMode] = useState<'all' | 'missing-mrp' | 'missing-case'>('all');

  // Inline editing
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editBrand, setEditBrand] = useState('');
  const [editItem, setEditItem] = useState('');
  const [editCaseSize, setEditCaseSize] = useState<string>('');
  const [editMrp, setEditMrp] = useState<string>('');

  // Add-new form state
  const [showAdd, setShowAdd] = useState(false);
  const [newBrand, setNewBrand] = useState('');
  const [newItem, setNewItem] = useState('');
  const [newCaseSize, setNewCaseSize] = useState<string>('');
  const [newMrp, setNewMrp] = useState<string>('');

  useEffect(() => {
    if (role && role !== 'admin') {
      router.push('/newrelic');
    }
  }, [role, router]);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const catalogData = await getCatalogItems();
      setCatalog(catalogData);
      setLoading(false);
    }
    load();
  }, []);

  const missingMrpCount = useMemo(() =>
    catalog.filter(c => !c.mrp || c.mrp <= 0).length,
    [catalog]
  );

  const missingCaseCount = useMemo(() =>
    catalog.filter(c => !c.caseSize || c.caseSize <= 0).length,
    [catalog]
  );

  const filteredItems = useMemo(() => {
    let list = catalog;
    if (filterMode === 'missing-mrp') {
      list = list.filter(c => !c.mrp || c.mrp <= 0);
    } else if (filterMode === 'missing-case') {
      list = list.filter(c => !c.caseSize || c.caseSize <= 0);
    }

    if (!search.trim()) return list;
    const s = search.toLowerCase();
    return list.filter(
      (c) =>
        c.brandName.toLowerCase().includes(s) ||
        c.itemName.toLowerCase().includes(s)
    );
  }, [catalog, search, filterMode]);

  async function handleSaveNew() {
    if (!newBrand.trim() || !newItem.trim()) {
      setError('Please fill in both brand and item name.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await saveCatalogItem({
        brandName: newBrand.trim(),
        itemName: newItem.trim(),
        defaultQuantity: 1,
        caseSize: newCaseSize ? Number(newCaseSize) : undefined,
        mrp: newMrp ? Number(newMrp) : undefined,
      });
      const refreshed = await getCatalogItems();
      setCatalog(refreshed);
      setNewBrand('');
      setNewItem('');
      setNewCaseSize('');
      setNewMrp('');
      setShowAdd(false);
    } catch (e) {
      setError('Failed to add. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveEdit(id: string) {
    if (!editBrand.trim() || !editItem.trim()) {
      setError('Please fill in both brand and item name.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await saveCatalogItem({
        brandName: editBrand.trim(),
        itemName: editItem.trim(),
        defaultQuantity: 1,
        caseSize: editCaseSize ? Number(editCaseSize) : undefined,
        mrp: editMrp ? Number(editMrp) : undefined,
      }, id);
      const refreshed = await getCatalogItems();
      setCatalog(refreshed);
      setEditingId(null);
    } catch (e) {
      setError('Failed to update. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Are you sure you want to delete this catalog item? This will remove it from autocomplete suggestions.')) return;
    setSaving(true);
    try {
      await deleteCatalogItem(id);
      setCatalog((prev) => prev.filter((i) => i.id !== id));
    } catch (e) {
      console.error(e);
      alert('Failed to delete item.');
    } finally {
      setSaving(false);
    }
  }

  function handleExportCsv() {
    const headers = ['Brand Name', 'Item Name', 'Case Size', 'Reference MRP'];
    const rows = filteredItems.map(i => [
      `"${i.brandName.replace(/"/g, '""')}"`,
      `"${i.itemName.replace(/"/g, '""')}"`,
      i.caseSize || '',
      i.mrp || ''
    ]);
    const csvContent = [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `catalog_export_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  async function handleSyncMrp() {
    if (!confirm('This will pull MRPs from the Procurement Pricing table to populate the Catalog Reference MRPs. Continue?')) return;
    setSaving(true);
    setError('');
    try {
      const pricingItems = await getAllPricingItems();
      
      const mrpMap = new Map<string, number>();
      pricingItems.forEach(p => {
         const key = `${(p.brandName || '').trim().toLowerCase()}__${(p.itemName || '').trim().toLowerCase()}`;
         const mrpNum = Number(p.mrp);
         if (mrpNum > 0) mrpMap.set(key, mrpNum);
      });

      let updatedCount = 0;
      for (const cat of catalog) {
         const key = `${(cat.brandName || '').trim().toLowerCase()}__${(cat.itemName || '').trim().toLowerCase()}`;
         const pricingMrp = mrpMap.get(key);
         if (pricingMrp !== undefined && Number(cat.mrp) !== pricingMrp) {
            await saveCatalogItem({ 
              brandName: cat.brandName,
              itemName: cat.itemName,
              defaultQuantity: cat.defaultQuantity,
              caseSize: cat.caseSize,
              mrp: pricingMrp 
            }, cat.id);
            updatedCount++;
         }
      }
      
      if (updatedCount > 0) {
        const refreshed = await getCatalogItems();
        setCatalog(refreshed);
        alert(`Successfully synced ${updatedCount} items with MRP from the Pricing table!`);
      } else {
        alert(`0 items synced.\n\nDebug Info:\n- Pricing Items found: ${pricingItems.length}\n- Valid MRPs found: ${mrpMap.size}\n- Catalog Items found: ${catalog.length}\n\n(This means either your Pricing table is empty, or all matching items already have the exact same MRP in the Catalog).`);
      }
    } catch(e) {
      console.error(e);
      setError('Failed to sync MRPs. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  if (!role || role !== 'admin') return null;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-8 py-6">
      {/* Header */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Database className="h-5 w-5 text-[#3b2fc9]" />
            <h1 className="text-xl font-bold text-gray-900">Catalog Management</h1>
          </div>
          <p className="text-sm text-gray-500">
            Add, edit, or remove Brand and Item names to clean up duplicate or misspelled dropdown suggestions.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handleSyncMrp}
            disabled={saving}
            className="flex items-center gap-1.5 bg-white border border-gray-300 text-gray-600 px-3 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 disabled:opacity-50 transition-colors"
          >
            <RefreshCw className={`h-4 w-4 ${saving ? 'animate-spin' : ''}`} />
            Sync from Pricing
          </button>
          <button
            onClick={handleExportCsv}
            className="flex items-center gap-1.5 bg-white border border-gray-300 text-gray-600 px-3 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
          >
            <Download className="h-4 w-4" /> Export CSV
          </button>
          <button
            onClick={() => {
              setShowAdd(true);
              setNewBrand('');
              setNewItem('');
              setNewCaseSize('');
              setNewMrp('');
              setError('');
            }}
            className="flex items-center gap-1.5 bg-[#3b2fc9] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#2f25a8] transition-colors"
          >
            <Plus className="h-4 w-4" /> Add Item
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 text-sm text-red-600 bg-red-50 border border-red-200 p-3 rounded-lg">
          {error}
        </div>
      )}

      {/* Search & Audit Filters */}
      <div className="mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="h-4 w-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search catalog by brand or item name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#3b2fc9]/20 focus:border-[#3b2fc9] transition-all"
          />
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setFilterMode('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              filterMode === 'all'
                ? 'bg-gray-800 text-white'
                : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            All Items ({catalog.length})
          </button>

          <button
            onClick={() => setFilterMode('missing-mrp')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ${
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

          <button
            onClick={() => setFilterMode('missing-case')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ${
              filterMode === 'missing-case'
                ? 'bg-blue-600 text-white shadow-xs'
                : missingCaseCount > 0
                ? 'bg-blue-50 border border-blue-200 text-blue-700 hover:bg-blue-100'
                : 'bg-white border border-gray-200 text-gray-400 opacity-60'
            }`}
          >
            <AlertTriangle className="h-3.5 w-3.5" />
            Missing Case Size ({missingCaseCount})
          </button>
        </div>
      </div>

      {/* Mobile Add Form (Shown when showAdd is true on mobile) */}
      {showAdd && (
        <div className="md:hidden mb-4 bg-white border-2 border-[#3b2fc9]/20 rounded-xl p-4 shadow-sm space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-gray-100">
            <h3 className="text-xs font-bold text-[#3b2fc9] uppercase tracking-wider">Add New Catalog Item</h3>
            <button onClick={() => setShowAdd(false)} className="text-gray-400 hover:text-gray-600 p-1">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div>
            <label className="text-[11px] font-semibold text-gray-500 uppercase">Brand Name *</label>
            <input
              className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#3b2fc9]"
              placeholder="e.g. Haldiram"
              value={newBrand}
              onChange={(e) => setNewBrand(e.target.value)}
              autoFocus
            />
          </div>
          <div>
            <label className="text-[11px] font-semibold text-gray-500 uppercase">Item Name *</label>
            <input
              className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#3b2fc9]"
              placeholder="e.g. Soya Sticks"
              value={newItem}
              onChange={(e) => setNewItem(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-semibold text-gray-500 uppercase">Case Size</label>
              <input
                type="number"
                className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#3b2fc9]"
                placeholder="e.g. 144"
                value={newCaseSize}
                onChange={(e) => setNewCaseSize(e.target.value)}
              />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-gray-500 uppercase">Ref MRP (₹)</label>
              <input
                type="number"
                className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#3b2fc9]"
                placeholder="e.g. 50"
                value={newMrp}
                onChange={(e) => setNewMrp(e.target.value)}
              />
            </div>
          </div>
          <div className="flex gap-2 pt-2">
            <button
              onClick={() => setShowAdd(false)}
              disabled={saving}
              className="flex-1 py-2 text-sm font-medium border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveNew}
              disabled={saving}
              className="flex-1 py-2 text-sm font-medium bg-[#3b2fc9] text-white rounded-lg hover:bg-[#2f25a8] flex items-center justify-center gap-1.5 shadow-sm"
            >
              <Check className="h-4 w-4" /> Save Item
            </button>
          </div>
        </div>
      )}

      {/* Mobile Card View (md:hidden) */}
      <div className="md:hidden space-y-3">
        {loading ? (
          <div className="bg-white border border-gray-200 rounded-xl p-8 text-center text-gray-500 text-sm">
            Loading catalog...
          </div>
        ) : filteredItems.length === 0 && !showAdd ? (
          <div className="bg-white border border-gray-200 rounded-xl p-8 text-center text-gray-500 text-sm">
            No catalog items found.
          </div>
        ) : (
          filteredItems.map((item) => {
            const isEditing = editingId === item.id;

            if (isEditing) {
              return (
                <div key={item.id} className="bg-blue-50/40 border-2 border-[#3b2fc9]/30 rounded-xl p-4 shadow-sm space-y-3">
                  <div className="flex items-center justify-between pb-1 border-b border-blue-100">
                    <span className="text-xs font-bold text-[#3b2fc9] uppercase tracking-wider">Edit Catalog Item</span>
                    <button onClick={() => setEditingId(null)} className="text-gray-400 hover:text-gray-600 p-1">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-gray-500 uppercase">Brand Name</label>
                    <input
                      className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#3b2fc9] bg-white"
                      value={editBrand}
                      onChange={(e) => setEditBrand(e.target.value)}
                      autoFocus
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-gray-500 uppercase">Item Name</label>
                    <input
                      className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#3b2fc9] bg-white"
                      value={editItem}
                      onChange={(e) => setEditItem(e.target.value)}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] font-semibold text-gray-500 uppercase">Case Size</label>
                      <input
                        type="number"
                        className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#3b2fc9] bg-white"
                        value={editCaseSize}
                        onChange={(e) => setEditCaseSize(e.target.value)}
                        placeholder="-"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-gray-500 uppercase">Ref MRP (₹)</label>
                      <input
                        type="number"
                        className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#3b2fc9] bg-white"
                        value={editMrp}
                        onChange={(e) => setEditMrp(e.target.value)}
                        placeholder="-"
                      />
                    </div>
                  </div>
                  <div className="flex gap-2 pt-2">
                    <button
                      onClick={() => setEditingId(null)}
                      disabled={saving}
                      className="flex-1 py-2 text-sm font-medium border border-gray-200 rounded-lg text-gray-600 bg-white hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => handleSaveEdit(item.id!)}
                      disabled={saving}
                      className="flex-1 py-2 text-sm font-medium bg-[#3b2fc9] text-white rounded-lg hover:bg-[#2f25a8] flex items-center justify-center gap-1.5 shadow-sm"
                    >
                      <Check className="h-4 w-4" /> Save Changes
                    </button>
                  </div>
                </div>
              );
            }

            return (
              <div key={item.id} className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm hover:border-gray-300 transition-colors">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="min-w-0 flex-1">
                    <span className="inline-block px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider bg-indigo-50 text-[#3b2fc9] border border-indigo-100 mb-1">
                      {item.brandName}
                    </span>
                    <h4 className="text-sm font-semibold text-gray-900 leading-snug break-words">
                      {item.itemName}
                    </h4>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => {
                        setEditingId(item.id!);
                        setEditBrand(item.brandName);
                        setEditItem(item.itemName);
                        setEditCaseSize(item.caseSize?.toString() || '');
                        setEditMrp(item.mrp?.toString() || '');
                        setError('');
                      }}
                      className="p-1.5 text-gray-400 hover:text-[#3b2fc9] hover:bg-blue-50 rounded-lg transition-colors"
                      title="Edit"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(item.id!)}
                      disabled={saving}
                      className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-gray-100 bg-gray-50/50 -mx-4 -mb-4 p-3 rounded-b-xl">
                  <div>
                    <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider block">Case Size</span>
                    <span className="text-sm font-medium text-gray-800">
                      {item.caseSize ? `${item.caseSize} pcs` : <span className="text-amber-500 text-xs italic font-normal">Missing</span>}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider block">Ref MRP</span>
                    <span className="text-sm font-bold text-gray-900">
                      {item.mrp ? `₹${item.mrp}` : <span className="text-amber-500 text-xs italic font-normal">Missing</span>}
                    </span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Desktop Table (hidden md:block) */}
      <div className="hidden md:block bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left min-w-[650px]">
            <thead className="bg-gray-50 border-b border-gray-200 text-gray-600 font-medium">
              <tr>
                <th className="px-4 py-3 min-w-[180px]">Brand Name</th>
                <th className="px-4 py-3 min-w-[200px]">Item Name</th>
                <th className="px-4 py-3 w-[110px]">Case Size</th>
                <th className="px-4 py-3 w-[110px]">Ref MRP</th>
                <th className="px-4 py-3 w-[120px] text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {showAdd && (
                <tr className="bg-blue-50/50">
                  <td className="px-4 py-2">
                    <input
                      className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:border-[#3b2fc9]"
                      placeholder="e.g. Haldiram"
                      value={newBrand}
                      onChange={(e) => setNewBrand(e.target.value)}
                      autoFocus
                    />
                  </td>
                  <td className="px-4 py-2">
                    <input
                      className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:border-[#3b2fc9]"
                      placeholder="e.g. Soya Sticks"
                      value={newItem}
                      onChange={(e) => setNewItem(e.target.value)}
                    />
                  </td>
                  <td className="px-4 py-2">
                    <input
                      type="number"
                      className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:border-[#3b2fc9]"
                      placeholder="e.g. 144"
                      value={newCaseSize}
                      onChange={(e) => setNewCaseSize(e.target.value)}
                    />
                  </td>
                  <td className="px-4 py-2">
                    <input
                      type="number"
                      className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:border-[#3b2fc9]"
                      placeholder="e.g. 50"
                      value={newMrp}
                      onChange={(e) => setNewMrp(e.target.value)}
                    />
                  </td>
                  <td className="px-4 py-2 text-right">
                    <div className="flex justify-end gap-1">
                      <button
                        onClick={handleSaveNew}
                        disabled={saving}
                        className="p-1.5 text-green-600 hover:bg-green-50 rounded"
                        title="Save"
                      >
                        <Check className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => setShowAdd(false)}
                        disabled={saving}
                        className="p-1.5 text-gray-400 hover:bg-gray-100 rounded"
                        title="Cancel"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              )}

              {loading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                    Loading catalog...
                  </td>
                </tr>
              ) : filteredItems.length === 0 && !showAdd ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                    No catalog items found.
                  </td>
                </tr>
              ) : (
                filteredItems.map((item) => {
                  const isEditing = editingId === item.id;
                  return (
                    <tr
                      key={item.id}
                      className={cn(
                        "hover:bg-gray-50 transition-colors",
                        isEditing && "bg-blue-50/30"
                      )}
                    >
                      <td className="px-4 py-2">
                        {isEditing ? (
                          <input
                            className="w-full border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:border-[#3b2fc9]"
                            value={editBrand}
                            onChange={(e) => setEditBrand(e.target.value)}
                            autoFocus
                          />
                        ) : (
                          <span className="font-medium text-gray-900">
                            {item.brandName}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2 text-gray-600">
                        {isEditing ? (
                          <input
                            className="w-full border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:border-[#3b2fc9]"
                            value={editItem}
                            onChange={(e) => setEditItem(e.target.value)}
                          />
                        ) : (
                          item.itemName
                        )}
                      </td>
                      <td className="px-4 py-2 text-gray-600">
                        {isEditing ? (
                          <input
                            type="number"
                            className="w-full border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:border-[#3b2fc9]"
                            value={editCaseSize}
                            onChange={(e) => setEditCaseSize(e.target.value)}
                            placeholder="-"
                          />
                        ) : (
                          item.caseSize || '-'
                        )}
                      </td>
                      <td className="px-4 py-2 text-gray-600">
                        {isEditing ? (
                          <input
                            type="number"
                            className="w-full border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:border-[#3b2fc9]"
                            value={editMrp}
                            onChange={(e) => setEditMrp(e.target.value)}
                            placeholder="-"
                          />
                        ) : (
                          item.mrp ? `₹${item.mrp}` : '-'
                        )}
                      </td>
                      <td className="px-4 py-2 text-right">
                        <div className="flex justify-end gap-1">
                          {isEditing ? (
                            <>
                              <button
                                onClick={() => handleSaveEdit(item.id!)}
                                disabled={saving}
                                className="p-1.5 text-green-600 hover:bg-green-50 rounded"
                                title="Save"
                              >
                                <Check className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => setEditingId(null)}
                                disabled={saving}
                                className="p-1.5 text-gray-400 hover:bg-gray-100 rounded"
                                title="Cancel"
                              >
                                <X className="h-4 w-4" />
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                onClick={() => {
                                  setEditingId(item.id!);
                                  setEditBrand(item.brandName);
                                  setEditItem(item.itemName);
                                  setEditCaseSize(item.caseSize?.toString() || '');
                                  setEditMrp(item.mrp?.toString() || '');
                                  setError('');
                                }}
                                className="p-1.5 text-gray-400 hover:text-[#3b2fc9] hover:bg-blue-50 rounded transition-colors"
                                title="Edit"
                              >
                                <Pencil className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => handleDelete(item.id!)}
                                disabled={saving}
                                className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                                title="Delete"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
