'use client';

import { CatalogItem } from '@/types/challan';
import { useEffect, useState, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import {
  getCatalogItems,
  saveCatalogItem,
  deleteCatalogItem,
  bulkSaveCatalogItems,
  bulkDeleteCatalogItems,
  bulkUpdateCatalogSites,
} from '@/services/newrelicCatalogService';
import { getAllPricingItems } from '@/services/newrelicPricingService';
import {
  Trash2,
  Plus,
  Pencil,
  Check,
  X,
  Search,
  Database,
  Download,
  Upload,
  RefreshCw,
  AlertTriangle,
  ArrowLeft,
  Sparkles,
  Package,
  Layers,
  ArrowUpDown,
  CheckSquare,
  Square,
  Loader2,
  Building2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { triggerHaptic } from '@/lib/haptics';
import { hasPermission } from '@/types/permissions';
import { CatalogCsvImportModal } from '@/components/newrelic/catalog/CatalogCsvImportModal';

const SITES_OPTIONS = [
  { id: 'all', label: 'All Sites' },
  { id: 'newrelic', label: 'NewRelic' },
  { id: 'dsm', label: 'DSM' },
  { id: 'ntt_data', label: 'NTT Data' },
] as const;

function renderItemSiteBadges(applicableSites?: ('newrelic' | 'dsm' | 'ntt_data' | 'all')[]) {
  const sites = applicableSites && applicableSites.length > 0 ? applicableSites : ['newrelic'];
  if (sites.includes('all')) {
    return (
      <span className="inline-block px-1.5 py-0.5 rounded text-[9px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/60">
        All Sites
      </span>
    );
  }
  return (
    <div className="flex items-center gap-1 flex-wrap">
      {sites.map((s) => {
        if (s === 'newrelic') {
          return (
            <span key={s} className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-blue-50 text-blue-700 border border-blue-200/60">
              NewRelic
            </span>
          );
        }
        if (s === 'dsm') {
          return (
            <span key={s} className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-purple-50 text-purple-700 border border-purple-200/60">
              DSM
            </span>
          );
        }
        if (s === 'ntt_data') {
          return (
            <span key={s} className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-amber-50 text-amber-700 border border-amber-200/60">
              NTT Data
            </span>
          );
        }
        return null;
      })}
    </div>
  );
}

export default function CatalogPage() {
  const { user, role, isReadOnly } = useAuth();
  const router = useRouter();

  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Filters & Sorting
  const [filterMode, setFilterMode] = useState<'all' | 'missing-mrp' | 'missing-case'>('all');
  const [siteFilter, setSiteFilter] = useState<string>('all');
  const [brandFilter, setBrandFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<
    'brand_asc' | 'brand_desc' | 'item_asc' | 'item_desc' | 'case_asc' | 'case_desc' | 'mrp_asc' | 'mrp_desc'
  >('brand_asc');

  // Multi-selection for bulk operations
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showBatchSitesModal, setShowBatchSitesModal] = useState(false);
  const [batchSitesSelection, setBatchSitesSelection] = useState<('newrelic' | 'dsm' | 'ntt_data' | 'all')[]>(['all']);

  // Modals & Progress
  const [showImportModal, setShowImportModal] = useState(false);
  const [syncProgress, setSyncProgress] = useState<{
    current: number;
    total: number;
    percent: number;
    statusText: string;
  } | null>(null);

  // Inline editing
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editBrand, setEditBrand] = useState('');
  const [editItem, setEditItem] = useState('');
  const [editCaseSize, setEditCaseSize] = useState<string>('');
  const [editMrp, setEditMrp] = useState<string>('');
  const [editSites, setEditSites] = useState<('newrelic' | 'dsm' | 'ntt_data' | 'all')[]>(['newrelic']);

  // Single field quick-edit state (Case Size or Ref MRP)
  const [quickEdit, setQuickEdit] = useState<{ id: string; field: 'caseSize' | 'mrp'; value: string } | null>(null);

  // Add-new form state
  const [showAdd, setShowAdd] = useState(false);
  const [newBrand, setNewBrand] = useState('');
  const [newItem, setNewItem] = useState('');
  const [newCaseSize, setNewCaseSize] = useState<string>('');
  const [newMrp, setNewMrp] = useState<string>('');
  const [newSites, setNewSites] = useState<('newrelic' | 'dsm' | 'ntt_data' | 'all')[]>(['all']);

  useEffect(() => {
    if (user && role && role !== 'admin' && !hasPermission(user, 'catalog')) {
      router.push('/newrelic');
    }
  }, [user, role, router]);

  async function loadData() {
    setLoading(true);
    const catalogData = await getCatalogItems();
    setCatalog(catalogData);
    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, []);

  const missingMrpCount = useMemo(() =>
    catalog.filter(c => !c.mrp || c.mrp <= 0).length,
    [catalog]
  );

  const missingCaseCount = useMemo(() =>
    catalog.filter(c => !c.caseSize || c.caseSize <= 0).length,
    [catalog]
  );

  const uniqueBrands = useMemo(() => {
    const map = new Map<string, number>();
    catalog.forEach((item) => {
      const b = item.brandName.trim();
      if (b) map.set(b, (map.get(b) || 0) + 1);
    });
    return Array.from(map.entries())
      .map(([brand, count]) => ({ brand, count }))
      .sort((a, b) => a.brand.localeCompare(b.brand));
  }, [catalog]);

  const filteredItems = useMemo(() => {
    let list = catalog;
    if (filterMode === 'missing-mrp') {
      list = list.filter(c => !c.mrp || c.mrp <= 0);
    } else if (filterMode === 'missing-case') {
      list = list.filter(c => !c.caseSize || c.caseSize <= 0);
    }

    if (siteFilter !== 'all') {
      list = list.filter((item) => {
        const sites = item.applicableSites && item.applicableSites.length > 0 ? item.applicableSites : ['newrelic'];
        return sites.includes('all') || sites.includes(siteFilter as any);
      });
    }

    if (brandFilter !== 'all') {
      const target = brandFilter.toLowerCase();
      list = list.filter((item) => item.brandName.trim().toLowerCase() === target);
    }

    if (search.trim()) {
      const s = search.toLowerCase();
      list = list.filter(
        (c) =>
          c.brandName.toLowerCase().includes(s) ||
          c.itemName.toLowerCase().includes(s)
      );
    }

    // Sort list
    return [...list].sort((a, b) => {
      if (sortBy === 'brand_asc') {
        const cmp = a.brandName.localeCompare(b.brandName);
        return cmp !== 0 ? cmp : a.itemName.localeCompare(b.itemName);
      }
      if (sortBy === 'brand_desc') {
        const cmp = b.brandName.localeCompare(a.brandName);
        return cmp !== 0 ? cmp : a.itemName.localeCompare(b.itemName);
      }
      if (sortBy === 'item_asc') {
        return a.itemName.localeCompare(b.itemName);
      }
      if (sortBy === 'item_desc') {
        return b.itemName.localeCompare(a.itemName);
      }
      if (sortBy === 'case_asc') {
        return (a.caseSize || 0) - (b.caseSize || 0);
      }
      if (sortBy === 'case_desc') {
        return (b.caseSize || 0) - (a.caseSize || 0);
      }
      if (sortBy === 'mrp_asc') {
        return (a.mrp || 0) - (b.mrp || 0);
      }
      if (sortBy === 'mrp_desc') {
        return (b.mrp || 0) - (a.mrp || 0);
      }
      return 0;
    });
  }, [catalog, search, filterMode, siteFilter, brandFilter, sortBy]);

  // Selection toggle handlers
  const isAllSelected =
    filteredItems.length > 0 &&
    filteredItems.every((item) => item.id && selectedIds.has(item.id));

  function toggleSelectAll() {
    triggerHaptic('light');
    if (isAllSelected) {
      setSelectedIds(new Set());
    } else {
      const allIds = new Set<string>();
      filteredItems.forEach((item) => {
        if (item.id) allIds.add(item.id);
      });
      setSelectedIds(allIds);
    }
  }

  function toggleSelectItem(id: string) {
    triggerHaptic('light');
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleSaveNew() {
    if (isReadOnly || role === 'guest') {
      alert('Read-Only Mode: Guest account cannot add catalog items.');
      return;
    }
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
        applicableSites: newSites.length > 0 ? newSites : ['all'],
      });
      const refreshed = await getCatalogItems();
      setCatalog(refreshed);
      setNewBrand('');
      setNewItem('');
      setNewCaseSize('');
      setNewMrp('');
      setNewSites(['all']);
      setShowAdd(false);
    } catch (e) {
      setError('Failed to add. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveEdit(id: string) {
    if (isReadOnly || role === 'guest') {
      alert('Read-Only Mode: Guest account cannot edit catalog items.');
      return;
    }
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
        applicableSites: editSites.length > 0 ? editSites : ['newrelic'],
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

  async function handleQuickSaveField(item: CatalogItem, field: 'caseSize' | 'mrp', valueStr: string) {
    if (isReadOnly || role === 'guest') {
      alert('Read-Only Mode: Guest account cannot edit catalog items.');
      return;
    }
    const numVal = valueStr.trim() === '' ? undefined : Number(valueStr);
    if (valueStr.trim() !== '' && (isNaN(Number(valueStr)) || Number(valueStr) < 0)) {
      setError('Please enter a valid positive number.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await saveCatalogItem(
        {
          brandName: item.brandName,
          itemName: item.itemName,
          defaultQuantity: item.defaultQuantity || 1,
          caseSize: field === 'caseSize' ? numVal : item.caseSize,
          mrp: field === 'mrp' ? numVal : item.mrp,
          applicableSites: item.applicableSites,
        },
        item.id!
      );
      const refreshed = await getCatalogItems();
      setCatalog(refreshed);
      setQuickEdit(null);
      triggerHaptic('success');
    } catch (e) {
      setError('Failed to update value.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (isReadOnly || role === 'guest') {
      alert('Read-Only Mode: Guest account cannot delete catalog items.');
      return;
    }
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
    triggerHaptic('light');
    const headers = ['Brand Name', 'Item Name', 'Case Size', 'Reference MRP', 'Sites'];
    const rows = filteredItems.map((i) => {
      const sitesStr = (i.applicableSites && i.applicableSites.length > 0 ? i.applicableSites : ['newrelic']).join('|');
      return [
        `"${i.brandName.replace(/"/g, '""')}"`,
        `"${i.itemName.replace(/"/g, '""')}"`,
        i.caseSize || '',
        i.mrp || '',
        `"${sitesStr}"`,
      ];
    });
    const csvContent = [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `catalog_export_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  async function handleSyncMrp() {
    if (isReadOnly || role === 'guest') {
      alert('Read-Only Mode: Guest account cannot sync MRP.');
      return;
    }
    if (!confirm('This will pull MRPs from the Procurement Pricing table to populate the Catalog Reference MRPs. Continue?')) return;
    setSaving(true);
    setSyncProgress({ current: 0, total: 0, percent: 0, statusText: 'Fetching pricing records...' });
    setError('');
    try {
      const pricingItems = await getAllPricingItems();

      const mrpMap = new Map<string, number>();
      pricingItems.forEach((p) => {
        const key = `${(p.brandName || '').trim().toLowerCase()}__${(p.itemName || '').trim().toLowerCase()}`;
        const mrpNum = Number(p.mrp);
        if (mrpNum > 0) mrpMap.set(key, mrpNum);
      });

      const itemsToUpdate: Array<{
        id?: string;
        brandName: string;
        itemName: string;
        defaultQuantity?: number;
        caseSize?: number;
        mrp?: number;
        applicableSites?: ('newrelic' | 'dsm' | 'ntt_data' | 'all')[];
      }> = [];

      for (const cat of catalog) {
        const key = `${(cat.brandName || '').trim().toLowerCase()}__${(cat.itemName || '').trim().toLowerCase()}`;
        const pricingMrp = mrpMap.get(key);
        if (pricingMrp !== undefined && Number(cat.mrp) !== pricingMrp) {
          itemsToUpdate.push({
            id: cat.id,
            brandName: cat.brandName,
            itemName: cat.itemName,
            defaultQuantity: cat.defaultQuantity,
            caseSize: cat.caseSize,
            mrp: pricingMrp,
            applicableSites: cat.applicableSites,
          });
        }
      }

      if (itemsToUpdate.length > 0) {
        setSyncProgress({
          current: 0,
          total: itemsToUpdate.length,
          percent: 5,
          statusText: `Syncing ${itemsToUpdate.length} items with Pricing...`,
        });
        const res = await bulkSaveCatalogItems(itemsToUpdate, (p) => {
          setSyncProgress(p);
        });
        const refreshed = await getCatalogItems();
        setCatalog(refreshed);
        setSyncProgress(null);
        alert(`✓ Successfully synced ${res.savedCount} items with MRP from the Pricing table!`);
      } else {
        setSyncProgress(null);
        alert(`All ${catalog.length} catalog items already have matching MRPs with the Pricing table.`);
      }
    } catch (e: any) {
      console.error(e);
      setError(e.message || 'Failed to sync MRPs. Please try again.');
    } finally {
      setSaving(false);
      setSyncProgress(null);
    }
  }

  async function handleBatchDelete() {
    if (isReadOnly || role === 'guest') {
      alert('Read-Only Mode: Guest account cannot delete catalog items.');
      return;
    }
    const ids = Array.from(selectedIds);
    if (!confirm(`Are you sure you want to delete ${ids.length} selected catalog item(s)?`)) return;
    setSaving(true);
    try {
      await bulkDeleteCatalogItems(ids);
      setCatalog((prev) => prev.filter((i) => !selectedIds.has(i.id!)));
      setSelectedIds(new Set());
      triggerHaptic('success');
    } catch (e: any) {
      alert('Failed to delete selected items.');
    } finally {
      setSaving(false);
    }
  }

  async function handleBatchAssignSites() {
    if (isReadOnly || role === 'guest') {
      alert('Read-Only Mode: Guest account cannot edit catalog items.');
      return;
    }
    const ids = Array.from(selectedIds);
    setSaving(true);
    try {
      await bulkUpdateCatalogSites(ids, batchSitesSelection);
      const refreshed = await getCatalogItems();
      setCatalog(refreshed);
      setSelectedIds(new Set());
      setShowBatchSitesModal(false);
      triggerHaptic('success');
    } catch (e: any) {
      alert('Failed to update sites for selected items.');
    } finally {
      setSaving(false);
    }
  }

  if (!role || (role !== 'admin' && !hasPermission(user, 'catalog'))) return null;

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-8 py-4 sm:py-8 space-y-6">
      {/* Read-Only Guest Notice */}
      {(isReadOnly || role === 'guest') && (
        <div className="mb-6 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between gap-3 text-amber-700 dark:text-amber-400">
          <div className="flex items-center gap-2.5">
            <span className="text-xl">👁️</span>
            <div>
              <p className="text-xs sm:text-sm font-bold">Guest Mode (Read-Only)</p>
              <p className="text-[11px] sm:text-xs text-amber-600 dark:text-amber-500">
                You can browse and explore the catalog, but editing and additions are disabled.
              </p>
            </div>
          </div>
          <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-500/20 text-amber-800 dark:text-amber-300">
            Read-Only
          </span>
        </div>
      )}

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
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/10 dark:bg-indigo-400/10 border border-indigo-500/20 text-[#3b2fc9] dark:text-indigo-400 text-[10px] sm:text-xs font-black tracking-widest uppercase">
              <Sparkles className="h-3 w-3" />
              <span>Catalog Master</span>
            </div>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
            Catalog Management
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            Add, edit, or clean Brand & Item catalog, reference MRPs, and case sizes across sites
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => {
              triggerHaptic('light');
              handleSyncMrp();
            }}
            disabled={saving}
            className="flex-1 sm:flex-initial h-11 sm:h-10 px-3.5 rounded-2xl sm:rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 text-slate-700 dark:text-slate-200 text-xs sm:text-sm font-bold hover:bg-slate-50 dark:hover:bg-slate-800/60 disabled:opacity-50 transition-all flex items-center justify-center gap-2 shadow-xs active:scale-95 cursor-pointer"
          >
            <RefreshCw className={`h-4 w-4 ${saving ? 'animate-spin' : ''}`} />
            <span>Sync from Pricing</span>
          </button>
          <button
            onClick={() => {
              triggerHaptic('light');
              setShowImportModal(true);
            }}
            className="flex-1 sm:flex-initial h-11 sm:h-10 px-3.5 rounded-2xl sm:rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 text-slate-700 dark:text-slate-200 text-xs sm:text-sm font-bold hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-all flex items-center justify-center gap-2 shadow-xs active:scale-95 cursor-pointer"
          >
            <Upload className="h-4 w-4 text-emerald-600" />
            <span>Import CSV</span>
          </button>
          <button
            onClick={() => {
              triggerHaptic('light');
              handleExportCsv();
            }}
            className="flex-1 sm:flex-initial h-11 sm:h-10 px-3.5 rounded-2xl sm:rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 text-slate-700 dark:text-slate-200 text-xs sm:text-sm font-bold hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-all flex items-center justify-center gap-2 shadow-xs active:scale-95 cursor-pointer"
          >
            <Download className="h-4 w-4" />
            <span>Export CSV</span>
          </button>
          <button
            onClick={() => {
              triggerHaptic('medium');
              setShowAdd(true);
              setNewBrand('');
              setNewItem('');
              setNewCaseSize('');
              setNewMrp('');
              setError('');
            }}
            className="w-full sm:w-auto h-11 sm:h-10 px-4 rounded-2xl sm:rounded-xl bg-gradient-to-r from-[#3b2fc9] to-indigo-600 hover:from-[#2f25a8] hover:to-indigo-700 text-white text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-2 shadow-md shadow-indigo-500/20 active:scale-95 cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            <span>Add Item</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 text-xs sm:text-sm text-red-600 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 p-3 rounded-2xl">
          {error}
        </div>
      )}

      {/* Summary Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="p-4 sm:p-5 rounded-2xl sm:rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
              Total Catalog Items
            </span>
            <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-[#3b2fc9] dark:text-indigo-400">
              <Package className="h-4 w-4" />
            </div>
          </div>
          <p className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">
            {catalog.length}
          </p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
            Active cross-site item definitions
          </p>
        </div>

        <div className="p-4 sm:p-5 rounded-2xl sm:rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
              Configured Brands
            </span>
            <div className="p-2 rounded-xl bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300">
              <Layers className="h-4 w-4" />
            </div>
          </div>
          <p className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">
            {uniqueBrands.length}
          </p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
            {brandFilter === 'all' ? 'All brands shown' : `Filtered: ${brandFilter}`}
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            triggerHaptic('light');
            setFilterMode(filterMode === 'missing-mrp' ? 'all' : 'missing-mrp');
          }}
          className={cn(
            "p-4 sm:p-5 rounded-2xl sm:rounded-3xl border text-left transition-all active:scale-95 space-y-1 shadow-xs cursor-pointer",
            filterMode === 'missing-mrp'
              ? 'bg-amber-500 text-white border-amber-600 shadow-sm'
              : missingMrpCount > 0
              ? 'bg-amber-50/70 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900/60 hover:bg-amber-100/60'
              : 'bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800'
          )}
        >
          <div className="flex items-center justify-between">
            <span className={cn(
              "text-[11px] font-bold uppercase tracking-wider",
              filterMode === 'missing-mrp' ? 'text-amber-100' : 'text-slate-400 dark:text-slate-500'
            )}>
              Missing Ref MRP
            </span>
            <div className={cn(
              "p-2 rounded-xl",
              filterMode === 'missing-mrp' ? 'bg-white/20 text-white' : 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300'
            )}>
              <AlertTriangle className="h-4 w-4" />
            </div>
          </div>
          <p className={cn(
            "text-2xl sm:text-3xl font-black",
            filterMode === 'missing-mrp' ? 'text-white' : missingMrpCount > 0 ? 'text-amber-700 dark:text-amber-400' : 'text-slate-900 dark:text-white'
          )}>
            {missingMrpCount}
          </p>
          <p className={cn(
            "text-[11px] truncate",
            filterMode === 'missing-mrp' ? 'text-amber-100' : 'text-slate-500 dark:text-slate-400'
          )}>
            {missingMrpCount > 0 ? 'Click to filter missing MRPs' : 'All items have MRP'}
          </p>
        </button>

        <button
          type="button"
          onClick={() => {
            triggerHaptic('light');
            setFilterMode(filterMode === 'missing-case' ? 'all' : 'missing-case');
          }}
          className={cn(
            "p-4 sm:p-5 rounded-2xl sm:rounded-3xl border text-left transition-all active:scale-95 space-y-1 shadow-xs cursor-pointer",
            filterMode === 'missing-case'
              ? 'bg-blue-600 text-white border-blue-700 shadow-sm'
              : missingCaseCount > 0
              ? 'bg-blue-50/70 dark:bg-blue-950/30 border-blue-200 dark:border-blue-900/60 hover:bg-blue-100/60'
              : 'bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800'
          )}
        >
          <div className="flex items-center justify-between">
            <span className={cn(
              "text-[11px] font-bold uppercase tracking-wider",
              filterMode === 'missing-case' ? 'text-blue-100' : 'text-slate-400 dark:text-slate-500'
            )}>
              Missing Case Size
            </span>
            <div className={cn(
              "p-2 rounded-xl",
              filterMode === 'missing-case' ? 'bg-white/20 text-white' : 'bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300'
            )}>
              <AlertTriangle className="h-4 w-4" />
            </div>
          </div>
          <p className={cn(
            "text-2xl sm:text-3xl font-black",
            filterMode === 'missing-case' ? 'text-white' : missingCaseCount > 0 ? 'text-blue-700 dark:text-blue-400' : 'text-slate-900 dark:text-white'
          )}>
            {missingCaseCount}
          </p>
          <p className={cn(
            "text-[11px] truncate",
            filterMode === 'missing-case' ? 'text-blue-100' : 'text-slate-500 dark:text-slate-400'
          )}>
            {missingCaseCount > 0 ? 'Click to filter missing cases' : 'All items have case size'}
          </p>
        </button>
      </div>

      {/* Live Sync Progress Banner */}
      {syncProgress && (
        <div className="p-4 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 rounded-3xl space-y-2 animate-in fade-in duration-150">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-indigo-950 dark:text-indigo-200 flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin text-[#3b2fc9] dark:text-indigo-400" />
              Syncing Reference MRPs with Pricing Table...
            </span>
            <span className="font-bold text-[#3b2fc9] dark:text-indigo-300">
              {syncProgress.percent}%
            </span>
          </div>
          <div className="w-full bg-indigo-200/60 dark:bg-indigo-900/60 rounded-full h-2 overflow-hidden">
            <div
              className="bg-gradient-to-r from-[#3b2fc9] to-indigo-500 h-2 rounded-full transition-all duration-200 ease-out"
              style={{ width: `${syncProgress.percent}%` }}
            />
          </div>
          <div className="flex justify-between items-center text-[11px] text-indigo-700 dark:text-indigo-300">
            <span>{syncProgress.statusText}</span>
            {syncProgress.total > 0 && (
              <span className="font-mono font-medium">
                {syncProgress.current} / {syncProgress.total} items
              </span>
            )}
          </div>
        </div>
      )}

      {/* Search, Brand Filter, Site Select & Sort */}
      <div className="mb-4 flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
          {/* Search Box */}
          <div className="relative flex-1">
            <Search className="h-4 w-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Search by brand or item name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-11 pl-10 pr-10 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#3b2fc9]/20 focus:border-[#3b2fc9] transition-all shadow-xs text-slate-900 dark:text-white"
            />
            {search && (
              <button
                onClick={() => {
                  triggerHaptic('light');
                  setSearch('');
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                title="Clear search"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Brand Filter Dropdown */}
          <select
            value={brandFilter}
            onChange={(e) => {
              triggerHaptic('light');
              setBrandFilter(e.target.value);
            }}
            className="h-11 px-3 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl text-xs font-bold text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-[#3b2fc9]/30 shadow-xs cursor-pointer"
          >
            <option value="all">🏷️ All Brands ({uniqueBrands.length})</option>
            {uniqueBrands.map(({ brand, count }) => (
              <option key={brand} value={brand}>
                {brand} ({count})
              </option>
            ))}
          </select>

          {/* Site Filter Dropdown */}
          <select
            value={siteFilter}
            onChange={(e) => {
              triggerHaptic('light');
              setSiteFilter(e.target.value);
            }}
            className="h-11 px-3 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl text-xs font-bold text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-[#3b2fc9]/30 shadow-xs cursor-pointer"
          >
            <option value="all">🏢 All Sites</option>
            <option value="newrelic">NewRelic</option>
            <option value="dsm">DSM</option>
            <option value="ntt_data">NTT Data</option>
          </select>

          {/* Sort By Dropdown */}
          <select
            value={sortBy}
            onChange={(e) => {
              triggerHaptic('light');
              setSortBy(e.target.value as any);
            }}
            className="h-11 px-3 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl text-xs font-bold text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-[#3b2fc9]/30 shadow-xs cursor-pointer"
          >
            <option value="brand_asc">Sort: Brand (A to Z)</option>
            <option value="brand_desc">Sort: Brand (Z to A)</option>
            <option value="item_asc">Sort: Item Name (A to Z)</option>
            <option value="item_desc">Sort: Item Name (Z to A)</option>
            <option value="case_desc">Sort: Case Size (High to Low)</option>
            <option value="case_asc">Sort: Case Size (Low to High)</option>
            <option value="mrp_desc">Sort: Ref MRP (High to Low)</option>
            <option value="mrp_asc">Sort: Ref MRP (Low to High)</option>
          </select>
        </div>

        {/* Quick Filter Pills & Selection Counter */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
            <button
              onClick={() => {
                triggerHaptic('light');
                setFilterMode('all');
              }}
              className={cn(
                "h-9 px-3.5 rounded-2xl text-xs font-black whitespace-nowrap transition-all shrink-0 active:scale-95 shadow-xs cursor-pointer",
                filterMode === 'all'
                  ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm'
                  : 'bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
              )}
            >
              All Items ({catalog.length})
            </button>

            <button
              onClick={() => {
                triggerHaptic('light');
                setFilterMode('missing-mrp');
              }}
              className={cn(
                "h-9 px-3.5 rounded-2xl text-xs font-black whitespace-nowrap flex items-center gap-1.5 transition-all shrink-0 active:scale-95 shadow-xs cursor-pointer",
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

            <button
              onClick={() => {
                triggerHaptic('light');
                setFilterMode('missing-case');
              }}
              className={cn(
                "h-9 px-3.5 rounded-2xl text-xs font-black whitespace-nowrap flex items-center gap-1.5 transition-all shrink-0 active:scale-95 shadow-xs cursor-pointer",
                filterMode === 'missing-case'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : missingCaseCount > 0
                  ? 'bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/60 text-blue-700 dark:text-blue-300 hover:bg-blue-100'
                  : 'bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 text-slate-400 opacity-60'
              )}
            >
              <AlertTriangle className="h-3.5 w-3.5" />
              <span>Missing Case ({missingCaseCount})</span>
            </button>

            {(brandFilter !== 'all' || siteFilter !== 'all' || search) && (
              <button
                type="button"
                onClick={() => {
                  triggerHaptic('light');
                  setBrandFilter('all');
                  setSiteFilter('all');
                  setSearch('');
                  setFilterMode('all');
                }}
                className="text-xs font-bold text-red-600 hover:underline px-2 shrink-0 cursor-pointer"
              >
                Reset Filters
              </button>
            )}
          </div>

          <div className="text-xs text-slate-500 font-medium">
            Showing <span className="font-bold text-slate-900 dark:text-white">{filteredItems.length}</span> of {catalog.length} items
          </div>
        </div>
      </div>

      {/* Mobile Add Form (Shown when showAdd is true on mobile) */}
      {showAdd && (
        <div className="md:hidden fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex flex-col justify-end p-0">
          <div className="bg-white dark:bg-slate-900 rounded-t-3xl max-h-[90vh] overflow-y-auto p-5 shadow-2xl space-y-4 border-t border-slate-200 dark:border-slate-800 animate-in slide-in-from-bottom duration-200">
            <div className="w-12 h-1.5 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto -mt-1 mb-2 shrink-0" />
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-indigo-50 dark:bg-indigo-950/50 rounded-xl text-[#3b2fc9]">
                  <Database className="h-4 w-4" />
                </div>
                <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">Add New Catalog Item</h3>
              </div>
              <button
                onClick={() => {
                  triggerHaptic('light');
                  setShowAdd(false);
                }}
                className="p-1.5 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <X className="h-5 w-5" />
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
          <div>
            <label className="text-[11px] font-semibold text-gray-500 uppercase block mb-1">Applicable Sites</label>
            <div className="flex flex-wrap gap-1.5">
              {SITES_OPTIONS.map((opt) => {
                const isSelected = newSites.includes(opt.id as any);
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => {
                      if (opt.id === 'all') {
                        setNewSites(['all']);
                      } else {
                        const withoutAll = newSites.filter((s) => s !== 'all');
                        if (isSelected) {
                          const next = withoutAll.filter((s) => s !== opt.id);
                          setNewSites(next.length === 0 ? ['all'] : next);
                        } else {
                          setNewSites([...withoutAll, opt.id as any]);
                        }
                      }
                    }}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${
                      isSelected
                        ? 'bg-[#3b2fc9] text-white border-[#3b2fc9]'
                        : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
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
          <div className="flex gap-2 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            <button
              onClick={() => {
                triggerHaptic('light');
                setShowAdd(false);
              }}
              disabled={saving}
              className="flex-1 h-12 text-sm font-bold border border-slate-200 dark:border-slate-700 rounded-2xl text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all active:scale-95"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                triggerHaptic('medium');
                handleSaveNew();
              }}
              disabled={saving}
              className="flex-1 h-12 text-sm font-bold bg-gradient-to-r from-[#3b2fc9] to-indigo-600 text-white rounded-2xl hover:from-[#2f25a8] hover:to-indigo-700 flex items-center justify-center gap-2 shadow-md shadow-indigo-500/20 active:scale-95 transition-all"
            >
              <Check className="h-4 w-4" /> Save Item
            </button>
          </div>
        </div>
      </div>
      )}

      {/* Mobile Card View (md:hidden) */}
      <div className="md:hidden space-y-3">
        {loading ? (
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-8 text-center text-slate-500 text-sm shadow-xs">
            Loading catalog...
          </div>
        ) : filteredItems.length === 0 && !showAdd ? (
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-8 text-center text-slate-500 text-sm shadow-xs">
            No catalog items found.
          </div>
        ) : (
          filteredItems.map((item) => {
            const isEditing = editingId === item.id;

            if (isEditing) {
              return (
                <div key={item.id} className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex flex-col justify-end p-0">
                  <div className="bg-white dark:bg-slate-900 rounded-t-3xl max-h-[90vh] overflow-y-auto p-5 shadow-2xl space-y-4 border-t border-slate-200 dark:border-slate-800 animate-in slide-in-from-bottom duration-200">
                    <div className="w-12 h-1.5 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto -mt-1 mb-2 shrink-0" />
                    <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 bg-indigo-50 dark:bg-indigo-950/50 rounded-xl text-[#3b2fc9]">
                          <Pencil className="h-4 w-4" />
                        </div>
                        <span className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">Edit Catalog Item</span>
                      </div>
                      <button
                        onClick={() => {
                          triggerHaptic('light');
                          setEditingId(null);
                        }}
                        className="p-1.5 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                      >
                        <X className="h-5 w-5" />
                      </button>
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Brand Name</label>
                      <input
                        className="mt-1 w-full h-12 border border-slate-200 dark:border-slate-700 rounded-2xl px-3.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#3b2fc9]/20 focus:border-[#3b2fc9] bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                        value={editBrand}
                        onChange={(e) => setEditBrand(e.target.value)}
                        autoFocus
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Item Name</label>
                      <input
                        className="mt-1 w-full h-12 border border-slate-200 dark:border-slate-700 rounded-2xl px-3.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#3b2fc9]/20 focus:border-[#3b2fc9] bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                        value={editItem}
                        onChange={(e) => setEditItem(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1">Applicable Sites</label>
                      <div className="flex flex-wrap gap-1.5">
                        {SITES_OPTIONS.map((opt) => {
                          const isSelected = editSites.includes(opt.id as any);
                          return (
                            <button
                              key={opt.id}
                              type="button"
                              onClick={() => {
                                triggerHaptic('light');
                                if (opt.id === 'all') {
                                  setEditSites(['all']);
                                } else {
                                  const withoutAll = editSites.filter((s) => s !== 'all');
                                  if (isSelected) {
                                    const next = withoutAll.filter((s) => s !== opt.id);
                                    setEditSites(next.length === 0 ? ['all'] : next);
                                  } else {
                                    setEditSites([...withoutAll, opt.id as any]);
                                  }
                                }
                              }}
                              className={cn(
                                "h-9 px-3 rounded-xl text-xs font-bold border transition-all active:scale-95",
                                isSelected
                                  ? 'bg-[#3b2fc9] text-white border-[#3b2fc9] shadow-xs'
                                  : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50'
                              )}
                            >
                              {opt.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Case Size</label>
                        <input
                          type="number"
                          className="mt-1 w-full h-12 border border-slate-200 dark:border-slate-700 rounded-2xl px-3.5 text-sm font-mono font-bold focus:outline-none focus:ring-2 focus:ring-[#3b2fc9]/20 focus:border-[#3b2fc9] bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                          value={editCaseSize}
                          onChange={(e) => setEditCaseSize(e.target.value)}
                          placeholder="-"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Ref MRP (₹)</label>
                        <input
                          type="number"
                          className="mt-1 w-full h-12 border border-slate-200 dark:border-slate-700 rounded-2xl px-3.5 text-sm font-mono font-bold focus:outline-none focus:ring-2 focus:ring-[#3b2fc9]/20 focus:border-[#3b2fc9] bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                          value={editMrp}
                          onChange={(e) => setEditMrp(e.target.value)}
                          placeholder="-"
                        />
                      </div>
                    </div>
                    <div className="flex gap-2 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
                      <button
                        onClick={() => {
                          triggerHaptic('light');
                          setEditingId(null);
                        }}
                        disabled={saving}
                        className="flex-1 h-12 text-sm font-bold border border-slate-200 dark:border-slate-700 rounded-2xl text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all active:scale-95"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => {
                          triggerHaptic('medium');
                          handleSaveEdit(item.id!);
                        }}
                        disabled={saving}
                        className="flex-1 h-12 text-sm font-bold bg-gradient-to-r from-[#3b2fc9] to-indigo-600 text-white rounded-2xl hover:from-[#2f25a8] hover:to-indigo-700 flex items-center justify-center gap-2 shadow-md shadow-indigo-500/20 active:scale-95 transition-all"
                      >
                        <Check className="h-4 w-4" /> Save Changes
                      </button>
                    </div>
                  </div>
                </div>
              );
            }

            const isMissingCase = !item.caseSize || item.caseSize <= 0;
            const isMissingMrp = !item.mrp || item.mrp <= 0;
            const isEditingCase = quickEdit?.id === item.id && quickEdit?.field === 'caseSize';
            const isEditingMrp = quickEdit?.id === item.id && quickEdit?.field === 'mrp';

            const startFullEdit = () => {
              triggerHaptic('light');
              setQuickEdit(null);
              setEditingId(item.id!);
              setEditBrand(item.brandName);
              setEditItem(item.itemName);
              setEditCaseSize(item.caseSize?.toString() || '');
              setEditMrp(item.mrp?.toString() || '');
              setEditSites(item.applicableSites && item.applicableSites.length > 0 ? item.applicableSites : ['newrelic']);
              setError('');
            };

            return (
              <div
                key={item.id}
                className={cn(
                  "bg-white dark:bg-slate-900 border rounded-2xl sm:rounded-3xl p-4 shadow-xs transition-all space-y-3",
                  item.id && selectedIds.has(item.id)
                    ? 'border-[#3b2fc9] bg-indigo-50/20 dark:bg-indigo-950/20 ring-1 ring-[#3b2fc9]'
                    : 'border-slate-200/80 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap mb-1">
                      <button
                        type="button"
                        onClick={() => item.id && toggleSelectItem(item.id)}
                        className="p-0.5 text-slate-400 hover:text-[#3b2fc9] transition-colors cursor-pointer"
                        title={item.id && selectedIds.has(item.id) ? 'Deselect' : 'Select'}
                      >
                        {item.id && selectedIds.has(item.id) ? (
                          <CheckSquare className="h-4 w-4 text-[#3b2fc9]" />
                        ) : (
                          <Square className="h-4 w-4 text-slate-300 dark:text-slate-600" />
                        )}
                      </button>
                      <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-indigo-50 dark:bg-indigo-950/60 text-[#3b2fc9] dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900/60">
                        {item.brandName}
                      </span>
                      {renderItemSiteBadges(item.applicableSites)}
                      {isMissingCase && (
                        <button
                          type="button"
                          onClick={() => {
                            triggerHaptic('light');
                            setQuickEdit({ id: item.id!, field: 'caseSize', value: '' });
                          }}
                          className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[9px] font-bold bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-900/60 active:scale-95"
                          title="Click to set case size"
                        >
                          + Set Case Size
                        </button>
                      )}
                      {isMissingMrp && (
                        <button
                          type="button"
                          onClick={() => {
                            triggerHaptic('light');
                            setQuickEdit({ id: item.id!, field: 'mrp', value: '' });
                          }}
                          className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[9px] font-bold bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-900/60 active:scale-95"
                          title="Click to set MRP"
                        >
                          + Set MRP
                        </button>
                      )}
                    </div>
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white leading-snug break-words">
                      {item.itemName}
                    </h4>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={startFullEdit}
                      className="p-2 text-slate-500 hover:text-[#3b2fc9] hover:bg-indigo-50 dark:hover:bg-slate-800 rounded-xl transition-colors active:scale-95"
                      title="Edit Item Details"
                      aria-label="Edit Item Details"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => {
                        triggerHaptic('medium');
                        handleDelete(item.id!);
                      }}
                      disabled={saving}
                      className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-xl transition-colors active:scale-95"
                      title="Delete Item"
                      aria-label="Delete Item"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {/* Individual field quick-edit bar */}
                {/* Individual field quick-edit bar */}
                <div className="grid grid-cols-2 gap-2 pt-2.5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 -mx-4 -mb-4 px-3 py-2.5 rounded-b-2xl sm:rounded-b-3xl">
                  {/* Case Size column */}
                  <div className="p-1 rounded-xl transition-colors">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">
                      Case Size
                    </span>
                    {isEditingCase ? (
                      <div className="flex items-center gap-1 mt-1 bg-white dark:bg-slate-800 p-1 rounded-xl border border-[#3b2fc9] shadow-xs">
                        <input
                          type="number"
                          autoFocus
                          placeholder="pcs"
                          value={quickEdit.value}
                          onChange={(e) => setQuickEdit({ ...quickEdit, value: e.target.value })}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleQuickSaveField(item, 'caseSize', quickEdit.value);
                            if (e.key === 'Escape') setQuickEdit(null);
                          }}
                          className="w-full px-2 py-0.5 text-xs font-mono font-bold text-slate-900 dark:text-white bg-transparent focus:outline-none min-w-0"
                        />
                        <button
                          type="button"
                          onClick={() => handleQuickSaveField(item, 'caseSize', quickEdit.value)}
                          disabled={saving}
                          className="p-1.5 bg-[#3b2fc9] text-white rounded-lg hover:bg-[#2f25a8] active:scale-90 shrink-0"
                        >
                          <Check className="h-3 w-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setQuickEdit(null)}
                          className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg active:scale-90 shrink-0"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          triggerHaptic('light');
                          setQuickEdit({ id: item.id!, field: 'caseSize', value: item.caseSize?.toString() || '' });
                        }}
                        className="text-left w-full group py-0.5"
                      >
                        {item.caseSize ? (
                          <span className="text-sm font-mono font-bold text-slate-800 dark:text-slate-200 group-hover:text-[#3b2fc9] flex items-center gap-1">
                            {item.caseSize} pcs
                            <Pencil className="h-2.5 w-2.5 opacity-0 group-hover:opacity-100 text-[#3b2fc9]" />
                          </span>
                        ) : (
                          <span className="text-xs font-bold text-blue-600 bg-blue-50 dark:bg-blue-950/50 px-2 py-0.5 rounded-md inline-block">
                            Tap to set
                          </span>
                        )}
                      </button>
                    )}
                  </div>

                  {/* Ref MRP column */}
                  <div className="p-1 rounded-xl transition-colors text-right">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">
                      Ref MRP
                    </span>
                    {isEditingMrp ? (
                      <div className="flex items-center gap-1 mt-1 bg-white dark:bg-slate-800 p-1 rounded-xl border border-[#3b2fc9] shadow-xs justify-end">
                        <span className="text-[11px] text-slate-400 font-bold pl-0.5">₹</span>
                        <input
                          type="number"
                          autoFocus
                          placeholder="0"
                          value={quickEdit.value}
                          onChange={(e) => setQuickEdit({ ...quickEdit, value: e.target.value })}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleQuickSaveField(item, 'mrp', quickEdit.value);
                            if (e.key === 'Escape') setQuickEdit(null);
                          }}
                          className="w-full px-2 py-0.5 text-xs font-mono font-bold text-slate-900 dark:text-white bg-transparent focus:outline-none text-right min-w-0"
                        />
                        <button
                          type="button"
                          onClick={() => handleQuickSaveField(item, 'mrp', quickEdit.value)}
                          disabled={saving}
                          className="p-1.5 bg-[#3b2fc9] text-white rounded-lg hover:bg-[#2f25a8] active:scale-90 shrink-0"
                        >
                          <Check className="h-3 w-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setQuickEdit(null)}
                          className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg active:scale-90 shrink-0"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          triggerHaptic('light');
                          setQuickEdit({ id: item.id!, field: 'mrp', value: item.mrp?.toString() || '' });
                        }}
                        className="text-right w-full group py-0.5 flex flex-col items-end"
                      >
                        {item.mrp ? (
                          <span className="text-sm font-mono font-black text-slate-900 dark:text-white group-hover:text-[#3b2fc9] flex items-center gap-1">
                            ₹{item.mrp}
                            <Pencil className="h-2.5 w-2.5 opacity-0 group-hover:opacity-100 text-[#3b2fc9]" />
                          </span>
                        ) : (
                          <span className="text-xs font-bold text-amber-600 bg-amber-50 dark:bg-amber-950/50 px-2 py-0.5 rounded-md inline-block">
                            Tap to set
                          </span>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Desktop Table (hidden md:block) */}
      <div className="hidden md:block bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left min-w-[700px]">
            <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-bold text-xs uppercase tracking-wider">
              <tr>
                <th className="px-3 py-3 w-10 text-center">
                  <input
                    type="checkbox"
                    checked={isAllSelected}
                    onChange={toggleSelectAll}
                    className="rounded border-slate-300 text-[#3b2fc9] focus:ring-[#3b2fc9]/20 cursor-pointer"
                    title="Select all visible items"
                  />
                </th>
                <th
                  onClick={() => setSortBy(sortBy === 'brand_asc' ? 'brand_desc' : 'brand_asc')}
                  className="px-4 py-3 min-w-[150px] cursor-pointer hover:bg-slate-100/60 dark:hover:bg-slate-800 transition-colors select-none"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Brand Name</span>
                    <ArrowUpDown className="h-3 w-3 opacity-60" />
                  </div>
                </th>
                <th
                  onClick={() => setSortBy(sortBy === 'item_asc' ? 'item_desc' : 'item_asc')}
                  className="px-4 py-3 min-w-[180px] cursor-pointer hover:bg-slate-100/60 dark:hover:bg-slate-800 transition-colors select-none"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Item Name</span>
                    <ArrowUpDown className="h-3 w-3 opacity-60" />
                  </div>
                </th>
                <th className="px-4 py-3 w-[150px]">Sites</th>
                <th
                  onClick={() => setSortBy(sortBy === 'case_desc' ? 'case_asc' : 'case_desc')}
                  className="px-4 py-3 w-[110px] cursor-pointer hover:bg-slate-100/60 dark:hover:bg-slate-800 transition-colors select-none"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Case Size</span>
                    <ArrowUpDown className="h-3 w-3 opacity-60" />
                  </div>
                </th>
                <th
                  onClick={() => setSortBy(sortBy === 'mrp_desc' ? 'mrp_asc' : 'mrp_desc')}
                  className="px-4 py-3 w-[110px] cursor-pointer hover:bg-slate-100/60 dark:hover:bg-slate-800 transition-colors select-none"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Ref MRP</span>
                    <ArrowUpDown className="h-3 w-3 opacity-60" />
                  </div>
                </th>
                <th className="px-4 py-3 w-[110px] text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {showAdd && (
                <tr className="bg-blue-50/50 dark:bg-blue-950/30">
                  <td className="px-3 py-2 text-center" />
                  <td className="px-4 py-2">
                    <input
                      className="w-full border border-gray-300 dark:border-slate-700 rounded-xl px-2.5 py-1.5 text-sm focus:outline-none focus:border-[#3b2fc9] bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                      placeholder="e.g. Haldiram"
                      value={newBrand}
                      onChange={(e) => setNewBrand(e.target.value)}
                      autoFocus
                    />
                  </td>
                  <td className="px-4 py-2">
                    <input
                      className="w-full border border-gray-300 dark:border-slate-700 rounded-xl px-2.5 py-1.5 text-sm focus:outline-none focus:border-[#3b2fc9] bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                      placeholder="e.g. Soya Sticks"
                      value={newItem}
                      onChange={(e) => setNewItem(e.target.value)}
                    />
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex flex-wrap gap-1">
                      {SITES_OPTIONS.map((opt) => {
                        const isSelected = newSites.includes(opt.id as any);
                        return (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => {
                              if (opt.id === 'all') {
                                setNewSites(['all']);
                              } else {
                                const withoutAll = newSites.filter((s) => s !== 'all');
                                if (isSelected) {
                                  const next = withoutAll.filter((s) => s !== opt.id);
                                  setNewSites(next.length === 0 ? ['all'] : next);
                                } else {
                                  setNewSites([...withoutAll, opt.id as any]);
                                }
                              }
                            }}
                            className={`px-1.5 py-0.5 rounded text-[10px] font-medium border transition-colors ${
                              isSelected
                                ? 'bg-[#3b2fc9] text-white border-[#3b2fc9]'
                                : 'bg-white dark:bg-slate-800 text-gray-500 border-gray-200 dark:border-slate-700 hover:bg-gray-50'
                            }`}
                          >
                            {opt.label}
                          </button>
                        );
                      })}
                    </div>
                  </td>
                  <td className="px-4 py-2">
                    <input
                      type="number"
                      className="w-full border border-gray-300 dark:border-slate-700 rounded-xl px-2.5 py-1.5 text-sm focus:outline-none focus:border-[#3b2fc9] bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                      placeholder="e.g. 144"
                      value={newCaseSize}
                      onChange={(e) => setNewCaseSize(e.target.value)}
                    />
                  </td>
                  <td className="px-4 py-2">
                    <input
                      type="number"
                      className="w-full border border-gray-300 dark:border-slate-700 rounded-xl px-2.5 py-1.5 text-sm focus:outline-none focus:border-[#3b2fc9] bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
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
                        className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg cursor-pointer"
                        title="Save"
                      >
                        <Check className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => setShowAdd(false)}
                        disabled={saving}
                        className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-lg cursor-pointer"
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
                  <td colSpan={7} className="px-4 py-12 text-center text-slate-400 text-sm">
                    <div className="flex items-center justify-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin text-[#3b2fc9]" />
                      <span>Loading catalog items...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredItems.length === 0 && !showAdd ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-slate-400 text-sm">
                    No catalog items found matching your filters.
                  </td>
                </tr>
              ) : (
                filteredItems.map((item) => {
                  const isEditing = editingId === item.id;
                  const isSelected = item.id ? selectedIds.has(item.id) : false;
                  return (
                    <tr
                      key={item.id}
                      className={cn(
                        "hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors",
                        isEditing && "bg-blue-50/30",
                        isSelected && "bg-indigo-50/40 dark:bg-indigo-950/20"
                      )}
                    >
                      <td className="px-3 py-2 text-center" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => item.id && toggleSelectItem(item.id)}
                          className="rounded border-slate-300 text-[#3b2fc9] focus:ring-[#3b2fc9]/20 cursor-pointer"
                        />
                      </td>
                      <td className="px-4 py-2">
                        {isEditing ? (
                          <input
                            className="w-full border border-gray-300 dark:border-slate-700 rounded-xl px-2 py-1 text-sm focus:outline-none focus:border-[#3b2fc9] bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                            value={editBrand}
                            onChange={(e) => setEditBrand(e.target.value)}
                            autoFocus
                          />
                        ) : (
                          <span className="font-bold text-slate-900 dark:text-white">
                            {item.brandName}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2 text-slate-600 dark:text-slate-300 font-medium">
                        {isEditing ? (
                          <input
                            className="w-full border border-gray-300 dark:border-slate-700 rounded-xl px-2 py-1 text-sm focus:outline-none focus:border-[#3b2fc9] bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                            value={editItem}
                            onChange={(e) => setEditItem(e.target.value)}
                          />
                        ) : (
                          item.itemName
                        )}
                      </td>
                      <td className="px-4 py-2">
                        {isEditing ? (
                          <div className="flex flex-wrap gap-1">
                            {SITES_OPTIONS.map((opt) => {
                              const isSelectedSite = editSites.includes(opt.id as any);
                              return (
                                <button
                                  key={opt.id}
                                  type="button"
                                  onClick={() => {
                                    if (opt.id === 'all') {
                                      setEditSites(['all']);
                                    } else {
                                      const withoutAll = editSites.filter((s) => s !== 'all');
                                      if (isSelectedSite) {
                                        const next = withoutAll.filter((s) => s !== opt.id);
                                        setEditSites(next.length === 0 ? ['all'] : next);
                                      } else {
                                        setEditSites([...withoutAll, opt.id as any]);
                                      }
                                    }
                                  }}
                                  className={`px-1.5 py-0.5 rounded text-[10px] font-medium border transition-colors ${
                                    isSelectedSite
                                      ? 'bg-[#3b2fc9] text-white border-[#3b2fc9]'
                                      : 'bg-white dark:bg-slate-800 text-gray-500 border-gray-200 dark:border-slate-700 hover:bg-gray-50'
                                  }`}
                                >
                                  {opt.label}
                                </button>
                              );
                            })}
                          </div>
                        ) : (
                          renderItemSiteBadges(item.applicableSites)
                        )}
                      </td>
                      <td className="px-4 py-2 text-slate-700 dark:text-slate-300 font-mono">
                        {isEditing ? (
                          <input
                            type="number"
                            className="w-full border border-gray-300 dark:border-slate-700 rounded-xl px-2 py-1 text-sm focus:outline-none focus:border-[#3b2fc9] bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                            value={editCaseSize}
                            onChange={(e) => setEditCaseSize(e.target.value)}
                            placeholder="-"
                          />
                        ) : (
                          item.caseSize ? `${item.caseSize} pcs` : <span className="text-blue-600 dark:text-blue-400 font-sans text-xs">Missing</span>
                        )}
                      </td>
                      <td className="px-4 py-2 text-slate-900 dark:text-white font-mono font-bold">
                        {isEditing ? (
                          <input
                            type="number"
                            className="w-full border border-gray-300 dark:border-slate-700 rounded-xl px-2 py-1 text-sm focus:outline-none focus:border-[#3b2fc9] bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                            value={editMrp}
                            onChange={(e) => setEditMrp(e.target.value)}
                            placeholder="-"
                          />
                        ) : (
                          item.mrp ? `₹${item.mrp}` : <span className="text-amber-600 dark:text-amber-400 font-sans text-xs">Missing</span>
                        )}
                      </td>
                      <td className="px-4 py-2 text-right">
                        <div className="flex justify-end gap-1">
                          {isEditing ? (
                            <>
                              <button
                                onClick={() => handleSaveEdit(item.id!)}
                                disabled={saving}
                                className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg cursor-pointer"
                                title="Save"
                              >
                                <Check className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => setEditingId(null)}
                                disabled={saving}
                                className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-lg cursor-pointer"
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
                                  setEditSites(item.applicableSites && item.applicableSites.length > 0 ? item.applicableSites : ['newrelic']);
                                  setError('');
                                }}
                                className="p-1.5 text-gray-400 hover:text-[#3b2fc9] hover:bg-blue-50 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                                title="Edit Item"
                              >
                                <Pencil className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => handleDelete(item.id!)}
                                disabled={saving}
                                className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg transition-colors cursor-pointer"
                                title="Delete Item"
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

      {/* Floating Batch Operations Bar */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-slate-900/95 dark:bg-white/95 text-white dark:text-slate-900 px-4 py-3 rounded-2xl shadow-2xl backdrop-blur-md flex items-center gap-3 border border-slate-700 dark:border-slate-200 animate-in slide-in-from-bottom duration-200 max-w-[95vw]">
          <span className="text-xs font-black whitespace-nowrap bg-indigo-600 text-white px-2.5 py-1 rounded-xl">
            {selectedIds.size} selected
          </span>

          <button
            type="button"
            onClick={() => {
              triggerHaptic('light');
              setShowBatchSitesModal(true);
            }}
            className="text-xs font-bold px-3 py-1.5 rounded-xl bg-slate-800 dark:bg-slate-100 hover:bg-slate-700 dark:hover:bg-slate-200 transition-colors whitespace-nowrap flex items-center gap-1.5 cursor-pointer"
          >
            <Building2 className="h-3.5 w-3.5" />
            <span>Assign Sites</span>
          </button>

          <button
            type="button"
            onClick={() => {
              triggerHaptic('medium');
              handleBatchDelete();
            }}
            className="text-xs font-bold px-3 py-1.5 rounded-xl bg-red-600 hover:bg-red-700 text-white transition-colors whitespace-nowrap flex items-center gap-1.5 cursor-pointer"
          >
            <Trash2 className="h-3.5 w-3.5" />
            <span>Delete</span>
          </button>

          <button
            type="button"
            onClick={() => {
              triggerHaptic('light');
              setSelectedIds(new Set());
            }}
            className="text-xs text-slate-400 hover:text-white dark:hover:text-slate-900 p-1 rounded-lg cursor-pointer"
            title="Clear selection"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Batch Assign Sites Modal */}
      {showBatchSitesModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl max-w-sm w-full p-5 space-y-4 border border-slate-200 dark:border-slate-800 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-indigo-50 dark:bg-indigo-950/60 rounded-xl text-[#3b2fc9]">
                  <Building2 className="h-4 w-4" />
                </div>
                <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                  Assign Sites to {selectedIds.size} Items
                </h3>
              </div>
              <button
                onClick={() => setShowBatchSitesModal(false)}
                className="p-1 rounded-full text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="text-xs text-slate-500">
              Select which sites will be allowed to order or indent the selected {selectedIds.size} item(s):
            </p>

            <div className="flex flex-wrap gap-2">
              {SITES_OPTIONS.map((opt) => {
                const isSelected = batchSitesSelection.includes(opt.id as any);
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => {
                      triggerHaptic('light');
                      if (opt.id === 'all') {
                        setBatchSitesSelection(['all']);
                      } else {
                        const withoutAll = batchSitesSelection.filter((s) => s !== 'all');
                        if (isSelected) {
                          const next = withoutAll.filter((s) => s !== opt.id);
                          setBatchSitesSelection(next.length === 0 ? ['all'] : next);
                        } else {
                          setBatchSitesSelection([...withoutAll, opt.id as any]);
                        }
                      }
                    }}
                    className={cn(
                      "px-3 py-2 rounded-xl text-xs font-bold border transition-all active:scale-95 cursor-pointer",
                      isSelected
                        ? 'bg-[#3b2fc9] text-white border-[#3b2fc9] shadow-xs'
                        : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50'
                    )}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>

            <div className="flex gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setShowBatchSitesModal(false)}
                className="flex-1 h-10 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleBatchAssignSites}
                disabled={saving}
                className="flex-1 h-10 rounded-xl bg-[#3b2fc9] hover:bg-[#2f25a8] text-white text-xs font-bold shadow-sm cursor-pointer"
              >
                {saving ? 'Updating...' : 'Save Sites'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CSV Import Modal */}
      <CatalogCsvImportModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        onSuccess={() => {
          loadData();
          triggerHaptic('success');
        }}
        existingCatalog={catalog}
      />
    </div>
  );
}
