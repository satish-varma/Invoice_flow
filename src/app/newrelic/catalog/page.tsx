'use client';

import { CatalogItem } from '@/types/challan';
import { useEffect, useState, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { getCatalogItems, saveCatalogItem, deleteCatalogItem } from '@/services/newrelicCatalogService';
import { Trash2, Plus, Pencil, Check, X, Search, Database } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function CatalogPage() {
  const { role } = useAuth();
  const router = useRouter();

  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

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

  const filteredItems = useMemo(() => {
    if (!search.trim()) return catalog;
    const s = search.toLowerCase();
    return catalog.filter(
      (c) =>
        c.brandName.toLowerCase().includes(s) ||
        c.itemName.toLowerCase().includes(s)
    );
  }, [catalog, search]);

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
        <div className="flex items-center gap-2">
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

      {/* Search */}
      <div className="mb-4 relative">
        <Search className="h-4 w-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          placeholder="Search catalog by brand or item name..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#3b2fc9]/20 focus:border-[#3b2fc9] transition-all"
        />
      </div>

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-50 border-b border-gray-200 text-gray-600 font-medium">
              <tr>
                <th className="px-4 py-3 min-w-[180px]">Brand Name</th>
                <th className="px-4 py-3 min-w-[200px]">Item Name</th>
                <th className="px-4 py-3 w-[100px]">Case Size</th>
                <th className="px-4 py-3 w-[100px]">Ref MRP</th>
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
                  <td colSpan={3} className="px-4 py-8 text-center text-gray-500">
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
