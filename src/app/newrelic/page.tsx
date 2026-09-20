
'use client';

import React, { useEffect, useRef, useState, useMemo } from 'react';
import { Loader2, FileText, MapPin, Filter } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  NewRelicChallan,
  getNewRelicChallans,
  deleteNewRelicChallan,
  NewRelicLocation,
  NEWRELIC_LOCATIONS,
} from '@/services/newrelicChallanService';
import { NewRelicChallanForm } from '@/components/newrelic/newrelic-challan-form';
import { NewRelicChallanList } from '@/components/newrelic/newrelic-challan-list';
import { NewRelicInsights } from '@/components/newrelic/newrelic-insights';
import { NewRelicItemDashboard } from '@/components/newrelic/newrelic-item-dashboard';
import { NewRelicChallanPreview } from '@/components/newrelic/newrelic-challan-preview';
import { NewRelicChallanHistoryModal } from '@/components/newrelic/newrelic-challan-history-modal';
import { NewRelicChallanViewModal } from '@/components/newrelic/newrelic-challan-view-modal';
import { NewRelicAdminPreviewModal } from '@/components/newrelic/newrelic-admin-preview-modal';
import { NewRelicSignedCopyModal } from '@/components/newrelic/newrelic-signed-copy-modal';
import { NewRelicGlobalAuditLog } from '@/components/newrelic/newrelic-global-audit-log';
import { generateAndSavePdf } from '@/lib/pdf';
import { NewRelicDashboard } from '@/components/newrelic/newrelic-dashboard';
import { useAuth } from '@/contexts/AuthContext';

export default function NewRelicPage() {
  const { toast } = useToast();
  const [challans, setChallans] = useState<NewRelicChallan[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedChallan, setSelectedChallan] = useState<NewRelicChallan | null>(null);
  const [challanToDownload, setChallanToDownload] = useState<NewRelicChallan | null>(null);
  const [isCreatingNew, setIsCreatingNew] = useState<NewRelicLocation | null>(null);
  const [formKey, setFormKey] = useState<string>('new');
  const [activeTab, setActiveTab] = useState<'active' | 'trash' | 'insights' | 'items'>('active');
  const { role, user } = useAuth();
  
  // Filters
  const [filterLocation, setFilterLocation] = useState<string>('all');
  const [filterMonth, setFilterMonth] = useState<string>('all');
  const [filterYear, setFilterYear] = useState<string>('all');

  const [historyChallan, setHistoryChallan] = useState<NewRelicChallan | null>(null);
  const [previewChallan, setPreviewChallan] = useState<NewRelicChallan | null>(null);
  const [adminPreviewChallan, setAdminPreviewChallan] = useState<NewRelicChallan | null>(null);
  const previewRef = useRef<HTMLDivElement>(null);

  /* ── Data fetching ── */
  const fetchData = async () => {
    setIsLoading(true);
    try {
      const data = await getNewRelicChallans();
      setChallans(data);
    } catch (err) {
      console.error(err);
      toast({ variant: 'destructive', title: 'Failed to load challans' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Initialize filterLocation based on preferredLocations
  useEffect(() => {
    if (user?.preferredLocations && user.preferredLocations.length > 0) {
      setFilterLocation('preferred');
    }
  }, [user]);

  /* ── Handlers ── */
  const handleSave = (saved?: NewRelicChallan) => {
    fetchData();
    setSelectedChallan(null);
    setIsCreatingNew(null);
    if (saved) handleDownload(saved);
  };

  const handleDownload = (challan: NewRelicChallan) => {
    setChallanToDownload(challan);
  };

  const handleDelete = async (id: string) => {
    try {
      if (activeTab === 'trash') {
        const { permanentDeleteNewRelicChallan } = await import('@/services/newrelicChallanService');
        await permanentDeleteNewRelicChallan(id);
        toast({ title: 'Challan permanently deleted' });
      } else {
        await deleteNewRelicChallan(id, user?.email || null);
        toast({ title: 'Challan moved to trash' });
      }
      fetchData();
    } catch {
      toast({ variant: 'destructive', title: 'Delete failed' });
    }
  };

  const handleRestore = async (id: string) => {
    try {
      import('@/services/newrelicChallanService').then(async (m) => {
        await m.restoreNewRelicChallans([id], user?.email || null);
        toast({ title: 'Challan restored' });
        fetchData();
      });
    } catch {
      toast({ variant: 'destructive', title: 'Restore failed' });
    }
  };

  const handleDuplicate = (challan: NewRelicChallan) => {
    // Create a new challan with the same items/location but no id or dcNumber.
    // The form will auto-suggest the next DC number just like a new challan.
    const duplicated: NewRelicChallan = {
      location: challan.location,
      dcDate: new Date().toISOString(),
      dcNumber: '', // will be auto-suggested by the form
      lineItems: challan.lineItems,
      note: challan.note,
    };
    setSelectedChallan(duplicated);
    setFormKey(`dup-${Date.now()}`); // force form remount to populate copied items
    window.scrollTo({ top: 0, behavior: 'smooth' });
    toast({
      title: 'Items copied!',
      description: 'A new challan has been pre-filled with the same items. Save to confirm.',
    });
  };

  const handleRestoreVersion = async (version: NewRelicChallan) => {
    try {
      import('@/services/newrelicChallanService').then(async (m) => {
        // To restore a version, we just save it as the current active data
        await m.saveNewRelicChallan(version, user?.email || null);
        toast({ title: 'Invoice reverted to previous version' });
        fetchData();
      });
    } catch {
      toast({ variant: 'destructive', title: 'Revert failed' });
    }
  };

  /* ── PDF generation after preview mounts ── */
  useEffect(() => {
    if (!challanToDownload) return;

    const timer = setTimeout(async () => {
      if (previewRef.current) {
        const fileName = `DC-${challanToDownload.dcNumber}-${
          NEWRELIC_LOCATIONS[challanToDownload.location].label
        }.pdf`;
        try {
          await generateAndSavePdf(previewRef.current, fileName);
        } catch (err) {
          console.error(err);
          toast({ variant: 'destructive', title: 'PDF generation failed' });
        } finally {
          setChallanToDownload(null);
        }
      }
    }, 1000);

    return () => clearTimeout(timer);
  }, [challanToDownload, toast]);

  /* ── Stats & Filtering ── */
  const activeChallans = challans.filter((c) => !c.isDeleted);
  const trashChallans = challans.filter((c) => c.isDeleted);
  
  const displayChallans = useMemo(() => {
    let list = activeTab === 'trash' ? trashChallans : activeChallans;
    
    if (filterLocation !== 'all') {
      if (filterLocation === 'preferred' && user?.preferredLocations) {
        list = list.filter((c) => user.preferredLocations!.includes(c.location));
      } else {
        list = list.filter((c) => c.location === filterLocation);
      }
    }
    if (filterMonth !== 'all') {
      list = list.filter((c) => new Date(c.dcDate).getMonth().toString() === filterMonth);
    }
    if (filterYear !== 'all') {
      list = list.filter((c) => new Date(c.dcDate).getFullYear().toString() === filterYear);
    }
    return list;
  }, [activeTab, activeChallans, trashChallans, filterLocation, filterMonth, filterYear]);

  const availableYears = useMemo(() => {
    return Array.from(new Set(challans.map(c => new Date(c.dcDate).getFullYear()))).sort((a, b) => b - a);
  }, [challans]);

  const hydCount = activeChallans.filter((c) => c.location === 'hyderabad').length;
  const blrCount = activeChallans.filter((c) => c.location === 'bangalore').length;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-3 sm:px-8 py-4 sm:py-8 space-y-6 sm:space-y-8">

        {/* Hero stats & Dashboard */}
        {role === 'admin' || role === 'superadmin' ? (
          <NewRelicDashboard challans={displayedChallans} />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
            <StatCard
              icon={<FileText className="h-5 w-5 text-[#3b2fc9]" />}
              label="Total Challans"
              value={challans.length}
              bg="bg-[#3b2fc9]/5"
            />
            <StatCard
              icon={<MapPin className="h-5 w-5 text-blue-500" />}
              label="Hyderabad"
              value={hydCount}
              bg="bg-blue-50"
            />
            <StatCard
              icon={<MapPin className="h-5 w-5 text-emerald-500" />}
              label="Bangalore"
              value={blrCount}
              bg="bg-emerald-50"
            />
          </div>
        )}

        {/* Action Buttons */}
        {!selectedChallan && !isCreatingNew && (
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={() => setIsCreatingNew('hyderabad')}
              className="flex-1 bg-[#3b2fc9] text-white py-3 px-4 rounded-xl font-medium hover:bg-[#3b2fc9]/90 transition-colors shadow-sm flex items-center justify-center gap-2"
            >
              <FileText className="h-5 w-5" />
              New Challan (Hyderabad)
            </button>
            <button
              onClick={() => setIsCreatingNew('bangalore')}
              className="flex-1 bg-emerald-600 text-white py-3 px-4 rounded-xl font-medium hover:bg-emerald-700 transition-colors shadow-sm flex items-center justify-center gap-2"
            >
              <FileText className="h-5 w-5" />
              New Challan (Bangalore)
            </button>
          </div>
        )}

        {/* Form Container */}
        {(selectedChallan || isCreatingNew) && (
          <NewRelicChallanForm
            key={selectedChallan?.id ?? (isCreatingNew ? `new-${isCreatingNew}` : formKey)}
            initialData={selectedChallan}
            defaultLocation={isCreatingNew || undefined}
            onChallanSave={handleSave}
            onAddNew={() => {
              setSelectedChallan(null);
              setIsCreatingNew(null);
            }}
            onCancel={() => {
              setSelectedChallan(null);
              setIsCreatingNew(null);
            }}
          />
        )}

        {/* Tabs */}
        <div className="flex items-center gap-4 border-b border-gray-200">
          <button
            onClick={() => setActiveTab('active')}
            className={`pb-3 text-sm font-medium transition-colors border-b-2 ${
              activeTab === 'active'
                ? 'border-[#3b2fc9] text-[#3b2fc9]'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Active Invoices ({activeChallans.length})
          </button>

          {role === 'admin' && (
            <>
              <button
                onClick={() => setActiveTab('insights')}
                className={`pb-3 text-sm font-medium transition-colors border-b-2 ${
                  activeTab === 'insights'
                    ? 'border-[#3b2fc9] text-[#3b2fc9]'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                Insights
              </button>

              <button
                onClick={() => setActiveTab('items')}
                className={`pb-3 text-sm font-medium transition-colors border-b-2 ${
                  activeTab === 'items'
                    ? 'border-[#3b2fc9] text-[#3b2fc9]'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                Item Ledger
              </button>
            </>
          )}
          
          {role === 'admin' && (
            <button
              onClick={() => setActiveTab('trash')}
              className={`pb-3 text-sm font-medium transition-colors border-b-2 ${
                activeTab === 'trash'
                  ? 'border-[#3b2fc9] text-[#3b2fc9]'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Trash / Audit ({trashChallans.length})
            </button>
          )}
        </div>

        {/* Filters Row */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
          <div className="flex items-center gap-2 text-gray-500 mr-2">
            <Filter className="h-4 w-4" />
            <span className="text-sm font-medium">Filters:</span>
          </div>
          
          <select
            value={filterLocation}
            onChange={(e) => setFilterLocation(e.target.value)}
            className="h-9 w-full sm:w-auto px-3 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#3b2fc9]/20 focus:border-[#3b2fc9] bg-white capitalize"
          >
            {user?.preferredLocations && user.preferredLocations.length > 0 && (
              <option value="preferred">My Preferred Locations</option>
            )}
            <option value="all">All Locations</option>
            {Object.entries(NEWRELIC_LOCATIONS).map(([key, loc]) => (
              <option key={key} value={key}>{loc.label}</option>
            ))}
          </select>

          <select
            value={filterMonth}
            onChange={(e) => setFilterMonth(e.target.value)}
            className="h-9 w-full sm:w-auto px-3 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#3b2fc9]/20 focus:border-[#3b2fc9] bg-white"
          >
            <option value="all">All Months</option>
            {Array.from({ length: 12 }, (_, i) => {
              const date = new Date(2000, i, 1);
              return <option key={i} value={i}>{date.toLocaleString('default', { month: 'long' })}</option>;
            })}
          </select>

          <select
            value={filterYear}
            onChange={(e) => setFilterYear(e.target.value)}
            className="h-9 w-full sm:w-auto px-3 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#3b2fc9]/20 focus:border-[#3b2fc9] bg-white"
          >
            <option value="all">All Years</option>
            {availableYears.map(year => (
              <option key={year} value={year}>{year}</option>
            ))}
          </select>
        </div>

        {/* Main Content Area */}
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
          </div>
        ) : activeTab === 'insights' ? (
          <NewRelicInsights challans={displayChallans} />
        ) : activeTab === 'items' ? (
          <NewRelicItemDashboard challans={displayChallans} />
        ) : activeTab === 'trash' ? (
          <div className="space-y-8">
            <NewRelicChallanList
              challans={displayChallans}
              isTrashView={true}
              role={role}
              onSelectChallan={setSelectedChallan}
              onDownloadChallan={handleDownload}
              onDeleteChallan={handleDelete}
              onDuplicateChallan={handleDuplicate}
              onViewHistory={setHistoryChallan}
              onPreviewChallan={setPreviewChallan}
              onAdminPreviewChallan={setAdminPreviewChallan}
              onRestoreChallan={handleRestore}
            />
            {role === 'admin' && (
              <div className="mt-12">
                <NewRelicGlobalAuditLog />
              </div>
            )}
          </div>
        ) : (
          <NewRelicChallanList
            challans={displayChallans}
            isTrashView={false}
            role={role}
            onSelectChallan={setSelectedChallan}
            onDownloadChallan={handleDownload}
            onDeleteChallan={handleDelete}
            onDuplicateChallan={handleDuplicate}
            onViewHistory={setHistoryChallan}
            onPreviewChallan={setPreviewChallan}
            onAdminPreviewChallan={setAdminPreviewChallan}
            onRestoreChallan={handleRestore}
          />
        )}
      </div>

      {historyChallan && (
        <NewRelicChallanHistoryModal
          isOpen={!!historyChallan}
          onClose={() => setHistoryChallan(null)}
          challanId={historyChallan.id!}
          dcNumber={historyChallan.dcNumber}
          currentChallan={historyChallan}
          onRestoreVersion={handleRestoreVersion}
        />
      )}

      {/* Visual Preview Modal */}
      <NewRelicChallanViewModal
        isOpen={!!previewChallan}
        onClose={() => setPreviewChallan(null)}
        challan={previewChallan}
        onDownload={(c) => {
          setPreviewChallan(null);
          handleDownload(c);
        }}
      />

      <NewRelicAdminPreviewModal
        isOpen={!!adminPreviewChallan}
        onClose={() => setAdminPreviewChallan(null)}
        challan={adminPreviewChallan}
      />

      {/* Hidden PDF preview container for html2canvas */}
      {challanToDownload && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '794px',
            opacity: 0,
            pointerEvents: 'none',
            zIndex: -9999,
            overflow: 'visible',
          }}
        >
          <NewRelicChallanPreview ref={previewRef} challan={challanToDownload} />
        </div>
      )}
    </div>
  );
}

/* ── Stat card sub-component ── */
function StatCard({
  icon,
  label,
  value,
  bg,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  bg: string;
}) {
  return (
    <div className={`rounded-2xl border border-gray-200 bg-white shadow-sm p-4 sm:p-5 flex items-center gap-3.5 sm:gap-4`}>
      <div className={`${bg} p-2.5 sm:p-3 rounded-xl shrink-0`}>{icon}</div>
      <div>
        <p className="text-xl sm:text-2xl font-bold text-gray-900">{value}</p>
        <p className="text-xs sm:text-sm text-gray-500">{label}</p>
      </div>
    </div>
  );
}
