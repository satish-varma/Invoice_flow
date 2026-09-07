
'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Loader2, FileText, MapPin } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  NewRelicChallan,
  getNewRelicChallans,
  deleteNewRelicChallan,
  NEWRELIC_LOCATIONS,
} from '@/services/newrelicChallanService';
import { NewRelicChallanForm } from '@/components/newrelic/newrelic-challan-form';
import { NewRelicChallanList } from '@/components/newrelic/newrelic-challan-list';
import { NewRelicChallanPreview } from '@/components/newrelic/newrelic-challan-preview';
import { generateAndSavePdf } from '@/lib/pdf';

export default function NewRelicPage() {
  const { toast } = useToast();
  const [challans, setChallans] = useState<NewRelicChallan[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedChallan, setSelectedChallan] = useState<NewRelicChallan | null>(null);
  const [challanToDownload, setChallanToDownload] = useState<NewRelicChallan | null>(null);
  const [formKey, setFormKey] = useState<string>('new');
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

  /* ── Handlers ── */
  const handleSave = (saved?: NewRelicChallan) => {
    fetchData();
    setSelectedChallan(null);
    if (saved) handleDownload(saved);
  };

  const handleDownload = (challan: NewRelicChallan) => {
    setChallanToDownload(challan);
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteNewRelicChallan(id);
      toast({ title: 'Challan deleted' });
      fetchData();
    } catch {
      toast({ variant: 'destructive', title: 'Delete failed' });
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

  /* ── Stats ── */
  const hydCount = challans.filter((c) => c.location === 'hyderabad').length;
  const blrCount = challans.filter((c) => c.location === 'bangalore').length;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-3 sm:px-8 py-4 sm:py-8 space-y-6 sm:space-y-8">

        {/* Hero stats */}
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

        {/* Form */}
        <NewRelicChallanForm
          key={selectedChallan?.id ?? formKey}
          initialData={selectedChallan}
          onChallanSave={handleSave}
          onAddNew={() => setSelectedChallan(null)}
        />

        {/* List */}
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
          </div>
        ) : (
          <NewRelicChallanList
            challans={challans}
            onSelectChallan={setSelectedChallan}
            onDownloadChallan={handleDownload}
            onDeleteChallan={handleDelete}
            onDuplicateChallan={handleDuplicate}
          />
        )}
      </div>

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
