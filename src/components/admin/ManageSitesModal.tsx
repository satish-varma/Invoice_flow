'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Building2,
  Plus,
  Trash2,
  MapPin,
  Check,
  Loader2,
  AlertTriangle,
  Sparkles,
  Store,
  ShieldCheck,
  Users,
  Package,
} from 'lucide-react';
import { CompanySite, SiteId } from '@/types/site';
import {
  saveCompanySite,
  deleteCompanySite,
  subscribeCompanySites,
} from '@/services/siteService';
import { useToast } from '@/hooks/use-toast';
import { triggerHaptic } from '@/lib/haptics';
import { cn } from '@/lib/utils';

interface ManageSitesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSiteCreated?: (newSite: CompanySite) => void;
  users?: Array<{ assignedSite?: string | null; assignedSites?: string[] }>;
  initialMode?: 'list' | 'add';
}

export function ManageSitesModal({
  isOpen,
  onClose,
  onSiteCreated,
  users = [],
  initialMode = 'list',
}: ManageSitesModalProps) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<'list' | 'add'>(initialMode);
  const [sites, setSites] = useState<CompanySite[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingSiteId, setDeletingSiteId] = useState<string | null>(null);

  // Form State
  const [siteName, setSiteName] = useState('');
  const [siteCode, setSiteCode] = useState('');
  const [isAutoCode, setIsAutoCode] = useState(true);
  const [allowedLocations, setAllowedLocations] = useState<('hyderabad' | 'bangalore')[]>(['hyderabad']);
  const [hasChallans, setHasChallans] = useState(false);
  const [tagline, setTagline] = useState('');
  const [description, setDescription] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  // Subscribe to real-time sites
  useEffect(() => {
    if (!isOpen) return;
    setActiveTab(initialMode);
    const unsubscribe = subscribeCompanySites((updatedSites) => {
      setSites(updatedSites);
    });
    return () => unsubscribe();
  }, [isOpen, initialMode]);

  // Compute users count per site
  const siteUserCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const u of users) {
      const assigned = u.assignedSites && u.assignedSites.length > 0
        ? u.assignedSites
        : [u.assignedSite || 'newrelic'];
      for (const s of assigned) {
        if (s) {
          counts[s] = (counts[s] || 0) + 1;
        }
      }
    }
    return counts;
  }, [users]);

  // Auto-slugify code when siteName changes
  const handleNameChange = (val: string) => {
    setSiteName(val);
    setFormError(null);
    if (isAutoCode) {
      const slug = val
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '');
      setSiteCode(slug);
    }
  };

  const handleLocationToggle = (loc: 'hyderabad' | 'bangalore') => {
    setAllowedLocations((prev) => {
      if (prev.includes(loc)) {
        if (prev.length === 1) return prev; // must keep at least 1
        return prev.filter((l) => l !== loc);
      } else {
        return [...prev, loc];
      }
    });
  };

  const handleResetForm = () => {
    setSiteName('');
    setSiteCode('');
    setIsAutoCode(true);
    setAllowedLocations(['hyderabad']);
    setHasChallans(false);
    setTagline('');
    setDescription('');
    setFormError(null);
  };

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!siteName.trim()) {
      setFormError('Please enter a stall/site name.');
      return;
    }

    const cleanCode = siteCode.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_');
    if (!cleanCode) {
      setFormError('Please enter a valid unique site code/identifier.');
      return;
    }

    // Check if site ID already exists
    const exists = sites.some((s) => s.id.toLowerCase() === cleanCode);
    if (exists) {
      setFormError(`Site code "${cleanCode}" is already in use. Please pick another.`);
      return;
    }

    setIsSaving(true);
    setFormError(null);

    try {
      triggerHaptic('medium');
      const newSite = await saveCompanySite({
        id: cleanCode,
        name: siteName.trim(),
        allowedLocations,
        hasChallans,
        tagline: tagline.trim() || `${siteName.trim()} Tuckshop`,
        description: description.trim() || `${siteName.trim()} counter sales and daily staff attendance.`,
      });

      toast({
        title: 'Site Created Successfully! 🎉',
        description: `"${newSite.name}" (${newSite.id}) has been added and is now ready for user assignment.`,
      });

      if (onSiteCreated) {
        onSiteCreated(newSite);
      }

      handleResetForm();
      setActiveTab('list');
    } catch (err: any) {
      console.error('Failed to create site:', err);
      setFormError(err.message || 'Failed to save site.');
      toast({
        title: 'Error Saving Site',
        description: err.message || 'An error occurred while saving the site.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (siteToDelete: CompanySite) => {
    if (!siteToDelete.isCustom) {
      toast({
        title: 'System Protected',
        description: 'Default built-in sites cannot be deleted.',
        variant: 'destructive',
      });
      return;
    }

    const assignedCount = siteUserCounts[siteToDelete.id] || 0;
    const confirmMsg = assignedCount > 0
      ? `Warning: ${assignedCount} user(s) are currently assigned to "${siteToDelete.name}". Deleting it will leave their stall configuration orphan. Are you sure you want to delete this site?`
      : `Are you sure you want to delete stall "${siteToDelete.name}"?`;

    if (!window.confirm(confirmMsg)) return;

    setDeletingSiteId(siteToDelete.id);
    try {
      triggerHaptic('medium');
      await deleteCompanySite(siteToDelete.id);
      toast({
        title: 'Stall Deleted',
        description: `"${siteToDelete.name}" has been removed.`,
      });
    } catch (err: any) {
      console.error('Failed to delete site:', err);
      toast({
        title: 'Deletion Failed',
        description: err.message || 'Failed to delete site.',
        variant: 'destructive',
      });
    } finally {
      setDeletingSiteId(null);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-0 overflow-hidden bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-2xl rounded-3xl">
        {/* Header */}
        <div className="p-5 sm:p-6 bg-gradient-to-r from-[#1e1b4b] via-[#3b2fc9] to-[#4f46e5] text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-white shadow-inner">
                <Building2 className="w-5 h-5 text-indigo-200" />
              </div>
              <div>
                <DialogTitle className="text-lg sm:text-xl font-black text-white tracking-tight">
                  Company Stalls &amp; Sites Registry
                </DialogTitle>
                <DialogDescription className="text-xs text-indigo-100 font-medium">
                  Add new client locations, configure allowed cities, and assign them directly to staff.
                </DialogDescription>
              </div>
            </div>
          </div>

          {/* Navigation Pill Switcher */}
          <div className="mt-4 flex items-center gap-1.5 p-1 bg-black/20 backdrop-blur-md rounded-2xl border border-white/15 w-fit">
            <button
              type="button"
              onClick={() => {
                triggerHaptic('light');
                setActiveTab('list');
              }}
              className={cn(
                "px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5",
                activeTab === 'list'
                  ? "bg-white text-[#1e1b4b] shadow-sm"
                  : "text-white/80 hover:text-white"
              )}
            >
              <Store className="w-3.5 h-3.5" />
              All Stalls ({sites.length})
            </button>
            <button
              type="button"
              onClick={() => {
                triggerHaptic('light');
                setActiveTab('add');
              }}
              className={cn(
                "px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5",
                activeTab === 'add'
                  ? "bg-white text-[#1e1b4b] shadow-sm"
                  : "text-white/80 hover:text-white"
              )}
            >
              <Plus className="w-3.5 h-3.5" />
              + Add New Stall
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-5 sm:p-6 overflow-y-auto flex-1 space-y-4">
          {activeTab === 'list' ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-slate-500 font-semibold px-1">
                <span>Active Company Stalls ({sites.length})</span>
                <Button
                  size="sm"
                  onClick={() => {
                    triggerHaptic('light');
                    setActiveTab('add');
                  }}
                  className="h-8 rounded-xl bg-[#3b2fc9] hover:bg-[#2d23a0] text-white text-xs font-bold flex items-center gap-1 shadow-xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Stall
                </Button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {sites.map((site) => {
                  const assignedCount = siteUserCounts[site.id] || 0;
                  const isDeleting = deletingSiteId === site.id;

                  return (
                    <div
                      key={site.id}
                      className={cn(
                        "p-4 rounded-2xl border transition-all relative flex flex-col justify-between group",
                        site.isCustom
                          ? "bg-gradient-to-br from-indigo-50/50 via-white to-purple-50/30 dark:from-slate-800 dark:to-slate-800/80 border-indigo-200/80 dark:border-indigo-900/60"
                          : "bg-white dark:bg-slate-800/90 border-slate-200 dark:border-slate-700"
                      )}
                    >
                      <div>
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="text-sm font-black text-slate-900 dark:text-white">
                                {site.name}
                              </h4>
                              {site.isCustom ? (
                                <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                                  Custom
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-600 flex items-center gap-0.5">
                                  <ShieldCheck className="w-2.5 h-2.5 text-emerald-600" />
                                  Built-in
                                </span>
                              )}
                            </div>
                            <span className="text-[10px] font-mono text-slate-400 dark:text-slate-500 block mt-0.5">
                              ID: {site.id}
                            </span>
                          </div>

                          {site.isCustom && (
                            <button
                              type="button"
                              disabled={isDeleting}
                              onClick={() => handleDelete(site)}
                              title="Delete custom stall"
                              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                            >
                              {isDeleting ? (
                                <Loader2 className="w-4 h-4 animate-spin text-rose-500" />
                              ) : (
                                <Trash2 className="w-4 h-4" />
                              )}
                            </button>
                          )}
                        </div>

                        <p className="text-xs text-slate-600 dark:text-slate-400 leading-snug line-clamp-2">
                          {site.tagline || site.description}
                        </p>
                      </div>

                      <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-700/60 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                        <span className="flex items-center gap-1 font-semibold text-emerald-700 dark:text-emerald-400">
                          <MapPin className="w-3 h-3" />
                          {site.allowedLocations.length === 2
                            ? 'HYD & BLR'
                            : site.allowedLocations[0]?.toUpperCase()}
                        </span>

                        <span className="flex items-center gap-1 font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/50 px-2 py-0.5 rounded-md border border-indigo-100 dark:border-indigo-900">
                          <Users className="w-3 h-3" />
                          {assignedCount} {assignedCount === 1 ? 'user' : 'users'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <form onSubmit={handleSave} className="space-y-4">
              {formError && (
                <div className="p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Site Name & Code */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1">
                    Stall / Site Name <span className="text-rose-500">*</span>
                  </Label>
                  <Input
                    placeholder="e.g. Google Cafeteria, Microsoft"
                    value={siteName}
                    onChange={(e) => handleNameChange(e.target.value)}
                    required
                    className="h-11 rounded-2xl border-slate-200 dark:border-slate-700 font-medium"
                  />
                  <span className="text-[10px] text-slate-400">
                    Friendly display name shown in menus and user cards.
                  </span>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1">
                      Site Code ID <span className="text-rose-500">*</span>
                    </Label>
                    <button
                      type="button"
                      onClick={() => setIsAutoCode(!isAutoCode)}
                      className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
                    >
                      {isAutoCode ? 'Manual edit' : 'Auto from name'}
                    </button>
                  </div>
                  <Input
                    placeholder="e.g. google_cafeteria"
                    value={siteCode}
                    onChange={(e) => {
                      setIsAutoCode(false);
                      setSiteCode(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''));
                    }}
                    required
                    className="h-11 rounded-2xl border-slate-200 dark:border-slate-700 font-mono text-xs"
                  />
                  <span className="text-[10px] text-slate-400">
                    Permanent system key (lowercase, alphanumeric, underscores).
                  </span>
                </div>
              </div>

              {/* Allowed Locations */}
              <div className="space-y-2 p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                <Label className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-emerald-600" />
                  Allowed Operational Locations
                </Label>
                <div className="grid grid-cols-2 gap-2.5 pt-1">
                  <button
                    type="button"
                    onClick={() => handleLocationToggle('hyderabad')}
                    className={cn(
                      "p-3 rounded-xl border text-left flex items-center justify-between transition-all cursor-pointer",
                      allowedLocations.includes('hyderabad')
                        ? "bg-white dark:bg-slate-800 border-emerald-500 text-emerald-900 dark:text-emerald-200 shadow-xs ring-1 ring-emerald-500/30"
                        : "bg-slate-100/60 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700 text-slate-500"
                    )}
                  >
                    <div>
                      <span className="text-xs font-black block">Hyderabad (HYD)</span>
                      <span className="text-[10px] text-slate-400">Primary Hub</span>
                    </div>
                    <div className={cn(
                      "w-4 h-4 rounded-md border flex items-center justify-center text-white",
                      allowedLocations.includes('hyderabad')
                        ? "bg-emerald-600 border-emerald-600"
                        : "border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700"
                    )}>
                      {allowedLocations.includes('hyderabad') && <Check className="w-3 h-3 stroke-[3]" />}
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleLocationToggle('bangalore')}
                    className={cn(
                      "p-3 rounded-xl border text-left flex items-center justify-between transition-all cursor-pointer",
                      allowedLocations.includes('bangalore')
                        ? "bg-white dark:bg-slate-800 border-emerald-500 text-emerald-900 dark:text-emerald-200 shadow-xs ring-1 ring-emerald-500/30"
                        : "bg-slate-100/60 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700 text-slate-500"
                    )}
                  >
                    <div>
                      <span className="text-xs font-black block">Bangalore (BLR)</span>
                      <span className="text-[10px] text-slate-400">Branch Operations</span>
                    </div>
                    <div className={cn(
                      "w-4 h-4 rounded-md border flex items-center justify-center text-white",
                      allowedLocations.includes('bangalore')
                        ? "bg-emerald-600 border-emerald-600"
                        : "border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700"
                    )}>
                      {allowedLocations.includes('bangalore') && <Check className="w-3 h-3 stroke-[3]" />}
                    </div>
                  </button>
                </div>
              </div>

              {/* Delivery Challans Hub Toggle */}
              <div className="p-3.5 rounded-2xl bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900 flex items-start gap-3">
                <Checkbox
                  id="hasChallans"
                  checked={hasChallans}
                  onCheckedChange={(checked) => setHasChallans(Boolean(checked))}
                  className="mt-1 data-[state=checked]:bg-[#3b2fc9] data-[state=checked]:border-[#3b2fc9]"
                />
                <div className="space-y-0.5">
                  <label
                    htmlFor="hasChallans"
                    className="text-xs font-bold text-slate-900 dark:text-white cursor-pointer flex items-center gap-1.5"
                  >
                    <Package className="w-3.5 h-3.5 text-[#3b2fc9]" />
                    Enable Dedicated Delivery Challans System
                  </label>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight">
                    Check if this client stall requires dedicated inventory dispatch and signed delivery challans tracking. Defaults to off for retail tuckshops.
                  </p>
                </div>
              </div>

              {/* Tagline & Description */}
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-900 dark:text-white">
                    Tagline (Optional)
                  </Label>
                  <Input
                    placeholder="e.g. Hyderabad Tuckshop, Tech Park Cafeteria"
                    value={tagline}
                    onChange={(e) => setTagline(e.target.value)}
                    className="h-10 rounded-2xl border-slate-200 dark:border-slate-700"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-900 dark:text-white">
                    Operational Note / Description (Optional)
                  </Label>
                  <Input
                    placeholder="e.g. Morning counter sales and daily staff attendance."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="h-10 rounded-2xl border-slate-200 dark:border-slate-700"
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex items-center justify-end gap-2.5">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    handleResetForm();
                    setActiveTab('list');
                  }}
                  className="h-10 px-4 rounded-xl text-xs font-bold"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isSaving}
                  className="h-10 px-5 rounded-xl bg-gradient-to-r from-[#3b2fc9] to-indigo-600 hover:from-[#2d23a0] hover:to-indigo-700 text-white text-xs font-bold shadow-md shadow-indigo-500/20 flex items-center gap-1.5"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Creating...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      <span>Save &amp; Register Stall</span>
                    </>
                  )}
                </Button>
              </div>
            </form>
          )}
        </div>

        {/* Footer */}
        <DialogFooter className="p-4 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between sm:justify-between">
          <span className="text-[11px] text-slate-500 font-medium">
            Changes sync in real-time across all devices.
          </span>
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            className="h-9 px-4 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300"
          >
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
