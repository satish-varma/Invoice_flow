'use client';

import React, { useState, useEffect } from 'react';
import { TrackerHeader } from '@/components/tracker/TrackerHeader';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Settings,
  Mail,
  Key,
  Globe,
  RefreshCw,
  Save,
  Trash2,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

export default function TrackerSettingsPage() {
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState('TheGutGuru');
  const [lookbackDays, setLookbackDays] = useState(30);
  const [emailUser, setEmailUser] = useState('');
  const [emailPassword, setEmailPassword] = useState('');
  const [syncInterval, setSyncInterval] = useState(6);
  const [workerUrl, setWorkerUrl] = useState('');
  const [workerApiKey, setWorkerApiKey] = useState('');

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    async function fetchSettings() {
      try {
        const res = await fetch('/api/tracker/settings');
        if (res.ok) {
          const data = await res.json();
          if (data) {
            setSearchTerm(data.emailSearchTerm || 'TheGutGuru');
            setLookbackDays(data.syncLookbackDays || 30);
            setEmailUser(data.emailUser || '');
            setEmailPassword(data.emailPassword || '');
            setSyncInterval(data.syncIntervalHours || 6);
            setWorkerUrl(data.hungerboxWorkerUrl || '');
            setWorkerApiKey(data.hungerboxWorkerApiKey || '');
          }
        }
      } catch (e) {
        console.error('Failed to load settings:', e);
      } finally {
        setIsLoading(false);
      }
    }
    fetchSettings();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setStatusMsg(null);

    try {
      const res = await fetch('/api/tracker/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          emailSearchTerm: searchTerm,
          syncLookbackDays: Number(lookbackDays),
          emailUser,
          emailPassword,
          syncIntervalHours: Number(syncInterval),
          hungerboxWorkerUrl: workerUrl,
          hungerboxWorkerApiKey: workerApiKey,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setStatusMsg({ text: 'Tracker settings saved successfully!', type: 'success' });
      } else {
        setStatusMsg({ text: data.error || 'Failed to save settings', type: 'error' });
      }
    } catch (err: any) {
      setStatusMsg({ text: err.message, type: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleFullSync = async () => {
    setIsSyncing(true);
    setStatusMsg(null);
    try {
      const res = await fetch('/api/tracker/sync?full=true', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setStatusMsg({
          text: `Full sync finished: ${data.message || `${data.count} invoices processed`}`,
          type: 'success',
        });
      } else {
        setStatusMsg({ text: data.error || 'Full sync failed', type: 'error' });
      }
    } catch (err: any) {
      setStatusMsg({ text: err.message, type: 'error' });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleResetDatabase = async () => {
    if (!confirm('CAUTION: Are you sure you want to delete all parsed invoices from Turso? This cannot be undone.')) {
      return;
    }

    setIsResetting(true);
    setStatusMsg(null);
    try {
      const res = await fetch('/api/tracker/invoices', { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        setStatusMsg({ text: 'All invoices reset successfully.', type: 'success' });
      } else {
        setStatusMsg({ text: data.error || 'Failed to reset', type: 'error' });
      }
    } catch (err: any) {
      setStatusMsg({ text: err.message, type: 'error' });
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div className="space-y-6">
      <TrackerHeader
        title="Cash & Carry Settings"
        subtitle="Configure automated IMAP remittance fetching and worker scrapers."
        badge="Configuration"
      />

      <div className="max-w-4xl space-y-6">
        {statusMsg && (
          <div
            className={`p-4 rounded-2xl border text-xs font-bold flex items-center gap-2.5 shadow-2xs ${
              statusMsg.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : 'bg-rose-50 text-rose-800 border-rose-200'
            }`}
          >
            {statusMsg.type === 'success' ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            ) : (
              <AlertTriangle className="h-4 w-4 text-rose-600" />
            )}
            {statusMsg.text}
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-6">
          {/* Email IMAP Settings */}
          <div className="p-5 sm:p-6 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-4">
            <div className="flex items-center gap-2.5 border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="p-2 bg-indigo-50 dark:bg-indigo-950/50 text-[#3b2fc9] rounded-xl">
                <Mail className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-sm sm:text-base font-black text-slate-900 dark:text-white">
                  Gmail IMAP Remittance Connection
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Connect to Gmail using a Google App Password to automatically fetch Cash &amp; Carry remittance advice PDFs.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">Gmail Address</Label>
                <Input
                  type="email"
                  placeholder="account@gmail.com"
                  value={emailUser}
                  onChange={(e) => setEmailUser(e.target.value)}
                  className="h-10 text-xs rounded-xl border-slate-200/80 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/40"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">Google App Password</Label>
                <Input
                  type="password"
                  placeholder="xxxx xxxx xxxx xxxx"
                  value={emailPassword}
                  onChange={(e) => setEmailPassword(e.target.value)}
                  className="h-10 text-xs rounded-xl border-slate-200/80 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/40 font-mono"
                />
                <p className="text-[10px] text-slate-400">
                  Generate in your Google Account &gt; Security &gt; App Passwords.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">Email Search Keyword</Label>
                <Input
                  placeholder="TheGutGuru"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="h-10 text-xs rounded-xl border-slate-200/80 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/40"
                />
                <p className="text-[10px] text-slate-400">
                  Matches subject/body text of remittance advice emails.
                </p>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">Lookback Window (Days)</Label>
                <Input
                  type="number"
                  value={lookbackDays}
                  onChange={(e) => setLookbackDays(Number(e.target.value))}
                  className="h-10 text-xs rounded-xl border-slate-200/80 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/40"
                />
                <p className="text-[10px] text-slate-400">
                  Days into the past to check for new remittance attachments.
                </p>
              </div>
            </div>
          </div>

          {/* Scraper Worker Settings */}
          <div className="p-5 sm:p-6 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-4">
            <div className="flex items-center gap-2.5 border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="p-2 bg-indigo-50 dark:bg-indigo-950/50 text-[#3b2fc9] rounded-xl">
                <Globe className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-sm sm:text-base font-black text-slate-900 dark:text-white">
                  HungerBox Scraper Worker Telemetry
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Connect an external worker microservice to scrape live cafeteria sales orders.
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">Worker Webhook URL</Label>
                <Input
                  placeholder="https://your-worker-service.com/api/sync"
                  value={workerUrl}
                  onChange={(e) => setWorkerUrl(e.target.value)}
                  className="h-10 text-xs rounded-xl border-slate-200/80 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/40"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">Worker Secret API Key</Label>
                <Input
                  type="password"
                  placeholder="whsec_..."
                  value={workerApiKey}
                  onChange={(e) => setWorkerApiKey(e.target.value)}
                  className="h-10 text-xs rounded-xl border-slate-200/80 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/40 font-mono"
                />
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-between gap-3 pt-2 flex-wrap">
            <Button
              type="submit"
              disabled={isSaving}
              className="h-11 px-5 rounded-2xl font-bold text-xs bg-[#3b2fc9] hover:bg-[#2f24a8] text-white shadow-md active:scale-95 transition-all"
            >
              <Save className="h-3.5 w-3.5 mr-1.5" />
              {isSaving ? 'Saving...' : 'Save Configuration'}
            </Button>

            <Button
              type="button"
              variant="outline"
              onClick={handleFullSync}
              disabled={isSyncing}
              className="h-11 px-4 rounded-2xl font-bold text-xs border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 active:scale-95 transition-all shadow-2xs"
            >
              <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${isSyncing ? 'animate-spin' : ''}`} />
              {isSyncing ? 'Full Sync Running...' : 'Force Full Historical Sync'}
            </Button>
          </div>
        </form>

        {/* Database Danger Zone */}
        {user?.role === 'admin' && (
          <div className="p-5 sm:p-6 bg-rose-50/30 dark:bg-rose-950/20 rounded-3xl border border-rose-200/80 dark:border-rose-900 shadow-sm space-y-3">
            <div className="flex items-center gap-2 text-rose-700 dark:text-rose-400">
              <AlertTriangle className="h-4 w-4" />
              <h4 className="text-sm font-black">Turso Database Maintenance</h4>
            </div>
            <p className="text-xs text-rose-600 dark:text-rose-400">
              Danger Zone: Reset or purge invoice records if testing or re-syncing from scratch.
            </p>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleResetDatabase}
              disabled={isResetting}
              className="h-9 rounded-xl font-bold text-xs bg-rose-600 hover:bg-rose-700 shadow-2xs active:scale-95 transition-all"
            >
              <Trash2 className="h-3.5 w-3.5 mr-1.5" />
              {isResetting ? 'Resetting...' : 'Purge All Invoices in Turso'}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
