'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  Bell,
  Send,
  CheckCircle,
  AlertCircle,
  Loader2,
  Key,
  Smartphone,
  Globe,
  Settings2,
  RefreshCw,
  MessageSquare,
  ShieldCheck,
  Radio,
  ExternalLink,
} from 'lucide-react';
import { AlertGatewayConfig, AlertProviderType, AlertDispatchRecord } from '@/types/alertGateway';
import { DEFAULT_ALERT_CONFIG } from '@/services/alertGatewayService';
import { triggerHaptic } from '@/lib/haptics';
import { useToast } from '@/hooks/use-toast';

interface AlertGatewayModalProps {
  isOpen: boolean;
  onClose: () => void;
  userEmail?: string | null;
}

export function AlertGatewayModal({ isOpen, onClose, userEmail }: AlertGatewayModalProps) {
  const { toast } = useToast();
  const [config, setConfig] = useState<AlertGatewayConfig>(DEFAULT_ALERT_CONFIG);
  const [recentLogs, setRecentLogs] = useState<AlertDispatchRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'provider' | 'automation' | 'logs'>('provider');

  // Test Ping State
  const [testPhone, setTestPhone] = useState('');
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadGatewaySettings();
    }
  }, [isOpen]);

  const loadGatewaySettings = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/attendance/alerts');
      const data = await res.json();
      if (data.success && data.config) {
        setConfig(data.config);
        setRecentLogs(data.recentLogs || []);
        if (data.config.managerPhone) {
          setTestPhone(data.config.managerPhone);
        }
      }
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Failed to load gateway settings', description: err.message });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    triggerHaptic('light');
    try {
      const res = await fetch('/api/attendance/alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'save_config',
          config,
          userEmail,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to save configuration');
      }
      triggerHaptic('success');
      toast({ title: 'Alert Gateway Saved', description: `Active provider: ${config.activeProvider.toUpperCase()}` });
      loadGatewaySettings();
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Error saving gateway', description: err.message });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSendTestPing = async () => {
    if (!testPhone.trim()) {
      toast({ variant: 'destructive', title: 'Please enter a test mobile number' });
      return;
    }
    setIsTesting(true);
    setTestResult(null);
    triggerHaptic('light');
    try {
      const res = await fetch('/api/attendance/alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'test_ping',
          testPhone: testPhone.trim(),
          userEmail,
        }),
      });
      const data = await res.json();
      if (data.success) {
        triggerHaptic('success');
        setTestResult({
          success: true,
          message: `Test ping dispatched via [${data.provider}] to ${testPhone}!`,
        });
        loadGatewaySettings();
      } else {
        setTestResult({
          success: false,
          message: data.error || 'Failed to send test ping. Check credentials.',
        });
      }
    } catch (err: any) {
      setTestResult({ success: false, message: err.message });
    } finally {
      setIsTesting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-amber-300">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-sm sm:text-base tracking-tight">
                WhatsApp &amp; SMS Gateway Settings
              </h3>
              <p className="text-[11px] text-slate-300">
                Configure automated attendance alerts &amp; shift broadcast routing
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Tabs */}
        <div className="flex items-center gap-1.5 p-2 bg-slate-100 border-b border-slate-200">
          <button
            type="button"
            onClick={() => setActiveTab('provider')}
            className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'provider'
                ? 'bg-white text-indigo-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Radio className="w-3.5 h-3.5" />
            <span>Gateway Providers</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('automation')}
            className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'automation'
                ? 'bg-white text-indigo-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Settings2 className="w-3.5 h-3.5" />
            <span>Automation Rules</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('logs')}
            className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'logs'
                ? 'bg-white text-indigo-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>Dispatch Logs ({recentLogs.length})</span>
          </button>
        </div>

        {/* Body Content */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-6">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-400 space-y-2">
              <Loader2 className="w-7 h-7 animate-spin text-[#3b2fc9]" />
              <p className="text-xs font-medium">Loading gateway configurations...</p>
            </div>
          ) : activeTab === 'provider' ? (
            <form onSubmit={handleSave} className="space-y-5">
              {/* Provider Selection */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Active Dispatch Provider
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {[
                    { id: 'ultramsg', name: 'UltraMsg (QR Scan)', desc: 'Instant WhatsApp', badge: 'No Meta Req' },
                    { id: 'meta_whatsapp', name: 'Meta WhatsApp', desc: 'Cloud API', badge: 'Official' },
                    { id: 'twilio', name: 'Twilio', desc: 'WhatsApp / SMS', badge: 'Global' },
                    { id: 'fast2sms', name: 'Fast2SMS', desc: 'India SMS Gateway', badge: 'Direct SMS' },
                    { id: 'msg91', name: 'MSG91', desc: 'India Flow API', badge: 'SMS' },
                    { id: 'webhook', name: 'Webhook', desc: 'Zapier / n8n', badge: 'Custom' },
                    { id: 'mock', name: 'Simulator Mode', desc: 'Zero Cost Test', badge: 'Sandbox' },
                  ].map((p) => {
                    const isSelected = config.activeProvider === p.id;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setConfig((prev) => ({ ...prev, activeProvider: p.id as AlertProviderType }))}
                        className={`p-3 rounded-2xl border text-left transition-all active:scale-95 flex flex-col justify-between gap-1.5 ${
                          isSelected
                            ? 'bg-indigo-50/80 border-[#3b2fc9] ring-2 ring-[#3b2fc9]/20 shadow-xs'
                            : 'bg-white border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
                            isSelected ? 'bg-[#3b2fc9] text-white' : 'bg-slate-100 text-slate-600'
                          }`}>
                            {p.badge}
                          </span>
                          {isSelected && <CheckCircle className="w-3.5 h-3.5 text-[#3b2fc9]" />}
                        </div>
                        <div>
                          <p className="text-xs font-bold text-slate-900 leading-tight">{p.name}</p>
                          <p className="text-[10px] text-slate-500">{p.desc}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Provider Specific Credentials Box */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-4">
                {config.activeProvider === 'ultramsg' && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                        <Key className="w-3.5 h-3.5 text-emerald-600" />
                        UltraMsg Credentials (QR Scan WhatsApp)
                      </span>
                      <a
                        href="https://ultramsg.com"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[11px] text-[#3b2fc9] hover:underline flex items-center gap-1 font-semibold"
                      >
                        UltraMsg Dashboard <ExternalLink className="w-2.5 h-2.5" />
                      </a>
                    </div>
                    <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-2.5 text-emerald-950 text-xs space-y-1">
                      <p className="font-bold flex items-center gap-1">
                        <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                        Zero Meta Business verification required!
                      </p>
                      <p className="text-[11px] text-emerald-800">
                        1. Sign up at <a href="https://ultramsg.com" target="_blank" rel="noopener noreferrer" className="underline font-bold">ultramsg.com</a>.
                        <br />
                        2. Scan the QR code with your phone&apos;s WhatsApp (Linked Devices).
                        <br />
                        3. Copy &amp; paste your <strong>Instance ID</strong> and <strong>Token</strong> below.
                      </p>
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">Instance ID</label>
                      <input
                        type="text"
                        value={config.ultramsg?.instanceId || ''}
                        onChange={(e) => setConfig((prev) => ({
                          ...prev,
                          ultramsg: {
                            instanceId: e.target.value,
                            token: prev.ultramsg?.token || '',
                          },
                        }))}
                        placeholder="e.g. instance104829"
                        className="w-full h-10 px-3 text-xs bg-white border border-slate-200 rounded-xl font-mono focus:ring-2 focus:ring-[#3b2fc9]/20"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">Token</label>
                      <input
                        type="password"
                        value={config.ultramsg?.token || ''}
                        onChange={(e) => setConfig((prev) => ({
                          ...prev,
                          ultramsg: {
                            instanceId: prev.ultramsg?.instanceId || '',
                            token: e.target.value,
                          },
                        }))}
                        placeholder="UltraMsg Token"
                        className="w-full h-10 px-3 text-xs bg-white border border-slate-200 rounded-xl font-mono focus:ring-2 focus:ring-[#3b2fc9]/20"
                      />
                    </div>
                  </div>
                )}

                {config.activeProvider === 'meta_whatsapp' && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                        <Key className="w-3.5 h-3.5 text-emerald-600" />
                        Meta WhatsApp Cloud API Credentials
                      </span>
                      <a
                        href="https://developers.facebook.com/docs/whatsapp/cloud-api"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[11px] text-[#3b2fc9] hover:underline flex items-center gap-1 font-semibold"
                      >
                        API Docs <ExternalLink className="w-2.5 h-2.5" />
                      </a>
                    </div>

                    <div className="p-2.5 rounded-xl bg-emerald-50/80 border border-emerald-200/80 text-emerald-900 text-xs flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        <span className="font-bold text-[11px]">Active Sender Number:</span>
                        <span className="font-mono text-[11px] font-bold text-emerald-700">+1 (555) 210-3921 (Meta Test Line)</span>
                      </div>
                      <span className="text-[10px] uppercase font-black px-2 py-0.5 rounded-full bg-emerald-200/60 text-emerald-800">Connected</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 mb-1">Phone Number ID</label>
                        <input
                          type="text"
                          value={config.meta?.phoneNumberId || ''}
                          onChange={(e) => setConfig((prev) => ({
                            ...prev,
                            meta: { ...prev.meta!, phoneNumberId: e.target.value },
                          }))}
                          placeholder="e.g. 1478203265366413"
                          className="w-full h-10 px-3 text-xs bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#3b2fc9]/20 font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 mb-1">Messaging Account ID (WABA ID)</label>
                        <input
                          type="text"
                          value={config.meta?.wabaId || ''}
                          onChange={(e) => setConfig((prev) => ({
                            ...prev,
                            meta: { ...prev.meta!, wabaId: e.target.value },
                          }))}
                          placeholder="e.g. 1138494142069945"
                          className="w-full h-10 px-3 text-xs bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#3b2fc9]/20 font-mono"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">System User Access Token</label>
                      <input
                        type="password"
                        value={config.meta?.accessToken || ''}
                        onChange={(e) => setConfig((prev) => ({
                          ...prev,
                          meta: { ...prev.meta!, accessToken: e.target.value },
                        }))}
                        placeholder="EAAU2sq..."
                        className="w-full h-10 px-3 text-xs bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#3b2fc9]/20 font-mono"
                      />
                    </div>

                    <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-[11px] leading-relaxed flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold">Meta Test Number Requirement:</span> In Meta Developer Console (<em>WhatsApp &gt; API Setup &gt; Step 2 &gt; &ldquo;To&rdquo; dropdown &gt; Manage phone number list</em>), add <strong>+91 7709632898</strong> and verify with OTP. Test numbers can only message verified recipient numbers.
                      </div>
                    </div>
                  </div>
                )}

                {config.activeProvider === 'twilio' && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                        <Key className="w-3.5 h-3.5 text-rose-600" />
                        Twilio API Credentials
                      </span>
                      <a
                        href="https://www.twilio.com/console"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[11px] text-[#3b2fc9] hover:underline flex items-center gap-1 font-semibold"
                      >
                        Twilio Console <ExternalLink className="w-2.5 h-2.5" />
                      </a>
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">Account SID</label>
                      <input
                        type="text"
                        value={config.twilio?.accountSid || ''}
                        onChange={(e) => setConfig((prev) => ({
                          ...prev,
                          twilio: { ...prev.twilio!, accountSid: e.target.value },
                        }))}
                        placeholder="AC..."
                        className="w-full h-10 px-3 text-xs bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#3b2fc9]/20 font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">Auth Token</label>
                      <input
                        type="password"
                        value={config.twilio?.authToken || ''}
                        onChange={(e) => setConfig((prev) => ({
                          ...prev,
                          twilio: { ...prev.twilio!, authToken: e.target.value },
                        }))}
                        placeholder="••••••••"
                        className="w-full h-10 px-3 text-xs bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#3b2fc9]/20 font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">From Number / Sender</label>
                      <input
                        type="text"
                        value={config.twilio?.fromNumber || ''}
                        onChange={(e) => setConfig((prev) => ({
                          ...prev,
                          twilio: { ...prev.twilio!, fromNumber: e.target.value },
                        }))}
                        placeholder="e.g. whatsapp:+14155238886 or +1234567890"
                        className="w-full h-10 px-3 text-xs bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#3b2fc9]/20 font-mono"
                      />
                    </div>
                  </div>
                )}

                {config.activeProvider === 'fast2sms' && (
                  <div className="space-y-3">
                    <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <Key className="w-3.5 h-3.5 text-amber-600" />
                      Fast2SMS Credentials (India)
                    </span>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">API Key</label>
                      <input
                        type="password"
                        value={config.fast2sms?.apiKey || ''}
                        onChange={(e) => setConfig((prev) => ({
                          ...prev,
                          fast2sms: { ...prev.fast2sms!, apiKey: e.target.value },
                        }))}
                        placeholder="Fast2SMS Authorization Token"
                        className="w-full h-10 px-3 text-xs bg-white border border-slate-200 rounded-xl font-mono"
                      />
                    </div>
                  </div>
                )}

                {config.activeProvider === 'msg91' && (
                  <div className="space-y-3">
                    <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <Key className="w-3.5 h-3.5 text-cyan-600" />
                      MSG91 Flow Credentials
                    </span>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">Auth Key</label>
                      <input
                        type="password"
                        value={config.msg91?.authKey || ''}
                        onChange={(e) => setConfig((prev) => ({
                          ...prev,
                          msg91: { ...prev.msg91!, authKey: e.target.value },
                        }))}
                        placeholder="MSG91 AuthKey"
                        className="w-full h-10 px-3 text-xs bg-white border border-slate-200 rounded-xl font-mono"
                      />
                    </div>
                  </div>
                )}

                {config.activeProvider === 'webhook' && (
                  <div className="space-y-3">
                    <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <Globe className="w-3.5 h-3.5 text-indigo-600" />
                      Webhook Dispatch Endpoint
                    </span>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">Webhook URL</label>
                      <input
                        type="url"
                        value={config.webhook?.webhookUrl || ''}
                        onChange={(e) => setConfig((prev) => ({
                          ...prev,
                          webhook: { ...prev.webhook!, webhookUrl: e.target.value },
                        }))}
                        placeholder="https://hooks.zapier.com/hooks/catch/..."
                        className="w-full h-10 px-3 text-xs bg-white border border-slate-200 rounded-xl"
                      />
                    </div>
                  </div>
                )}

                {config.activeProvider === 'mock' && (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-amber-900 text-xs space-y-1">
                    <p className="font-bold flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4 text-amber-600" />
                      Simulator / Sandbox Active
                    </p>
                    <p className="text-[11px] text-amber-800">
                      Alerts will be simulated and recorded in Firestore audit logs without debiting real SMS or WhatsApp credits. Use this mode to test UI flows safely before connecting live provider API keys.
                    </p>
                  </div>
                )}
              </div>

              {/* Save Button */}
              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2.5 rounded-2xl bg-[#3b2fc9] hover:bg-[#3228a8] text-white font-bold text-xs shadow-md transition-all active:scale-95 flex items-center gap-1.5 disabled:opacity-50"
                >
                  {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <SaveIcon className="w-4 h-4" />}
                  <span>Save Gateway Settings</span>
                </button>
              </div>
            </form>
          ) : activeTab === 'automation' ? (
            <div className="space-y-5">
              {/* Manager Phone for Shift Digest Broadcast */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                  <Smartphone className="w-4 h-4 text-indigo-600" />
                  Store In-Charge / Ops Manager Routing
                </h4>
                <p className="text-xs text-slate-500">
                  Target mobile number to receive daily morning shift summaries (present, absent list, and late arrivals).
                </p>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Manager WhatsApp / Mobile Phone (10 digits or with +91)
                  </label>
                  <input
                    type="tel"
                    value={config.managerPhone || ''}
                    onChange={(e) => setConfig((prev) => ({ ...prev, managerPhone: e.target.value }))}
                    placeholder="e.g. 9876543210 or +91 98765 43210"
                    className="w-full h-10 px-3 text-xs bg-white border border-slate-200 rounded-xl font-mono focus:ring-2 focus:ring-[#3b2fc9]/20"
                  />
                </div>
              </div>

              {/* Automation Toggles */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Automated Triggers
                </h4>
                <label className="flex items-start gap-3 cursor-pointer p-2 rounded-xl hover:bg-white transition-colors">
                  <input
                    type="checkbox"
                    checked={config.enableAutoLateAlert}
                    onChange={(e) => setConfig((prev) => ({ ...prev, enableAutoLateAlert: e.target.checked }))}
                    className="mt-1 h-4 w-4 rounded border-slate-300 text-[#3b2fc9] focus:ring-[#3b2fc9]"
                  />
                  <div>
                    <span className="text-xs font-bold text-slate-800 block">Automatic Late Arrival Notice</span>
                    <span className="text-[11px] text-slate-500 block">
                      Dispatches an automated WhatsApp / SMS notice directly to the employee immediately when they check in past their cutoff deadline.
                    </span>
                  </div>
                </label>

                <label className="flex items-start gap-3 cursor-pointer p-2 rounded-xl hover:bg-white transition-colors border-t border-slate-100 pt-3">
                  <input
                    type="checkbox"
                    checked={config.enableAutoCheckoutReminder}
                    onChange={(e) => setConfig((prev) => ({ ...prev, enableAutoCheckoutReminder: e.target.checked }))}
                    className="mt-1 h-4 w-4 rounded border-slate-300 text-[#3b2fc9] focus:ring-[#3b2fc9]"
                  />
                  <div>
                    <span className="text-xs font-bold text-slate-800 block">Checkout Reminder for Long Shifts</span>
                    <span className="text-[11px] text-slate-500 block">
                      Pings staff active for &gt;11.5 hours to capture check-out selfie before leaving.
                    </span>
                  </div>
                </label>
              </div>

              {/* Test Ping Section */}
              <div className="bg-indigo-50/50 border border-indigo-200 rounded-2xl p-4 space-y-3">
                <h4 className="text-xs font-bold text-indigo-950 uppercase tracking-wider flex items-center gap-1.5">
                  <Send className="w-3.5 h-3.5 text-indigo-600" />
                  Test Gateway Connection
                </h4>
                <div className="flex gap-2">
                  <input
                    type="tel"
                    value={testPhone}
                    onChange={(e) => setTestPhone(e.target.value)}
                    placeholder="Recipient phone (e.g. 9876543210)"
                    className="flex-1 h-10 px-3 text-xs bg-white border border-indigo-200 rounded-xl font-mono focus:ring-2 focus:ring-[#3b2fc9]/20"
                  />
                  <button
                    type="button"
                    onClick={handleSendTestPing}
                    disabled={isTesting}
                    className="h-10 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs transition-all active:scale-95 disabled:opacity-50"
                  >
                    {isTesting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                    <span>Send Ping</span>
                  </button>
                </div>

                {testResult && (
                  <div className={`p-3 rounded-xl text-xs font-medium flex items-center gap-2 ${
                    testResult.success
                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                      : 'bg-rose-50 text-rose-800 border border-rose-200'
                  }`}>
                    {testResult.success ? <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" /> : <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />}
                    <span>{testResult.message}</span>
                  </div>
                )}
              </div>

              {/* Save Button */}
              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={isSaving}
                  className="px-5 py-2.5 rounded-2xl bg-[#3b2fc9] hover:bg-[#3228a8] text-white font-bold text-xs shadow-md transition-all active:scale-95 flex items-center gap-1.5 disabled:opacity-50"
                >
                  {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <SaveIcon className="w-4 h-4" />}
                  <span>Save Automation Settings</span>
                </button>
              </div>
            </div>
          ) : (
            /* Logs Tab */
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
                <span>Recent notification dispatches from this system</span>
                <button
                  type="button"
                  onClick={loadGatewaySettings}
                  className="text-xs text-[#3b2fc9] font-bold hover:underline flex items-center gap-1"
                >
                  <RefreshCw className="w-3 h-3" /> Refresh
                </button>
              </div>

              {recentLogs.length === 0 ? (
                <div className="bg-slate-50 border border-dashed border-slate-200 rounded-2xl p-8 text-center text-slate-400 text-xs">
                  No alerts dispatched yet. Send a test ping or an absent alert to see audit logs here.
                </div>
              ) : (
                <div className="divide-y divide-slate-100 border border-slate-200 rounded-2xl overflow-hidden bg-white">
                  {recentLogs.map((log) => (
                    <div key={log.id || log.timestamp} className="p-3 text-xs hover:bg-slate-50/80 transition-colors space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded uppercase ${
                            log.status === 'sent' || log.status === 'delivered'
                              ? 'bg-emerald-100 text-emerald-800'
                              : log.status === 'simulated'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}>
                            {log.status}
                          </span>
                          <span className="font-bold text-slate-900">{log.recipientName || log.recipientPhone}</span>
                          <span className="text-[10px] text-slate-400 font-mono">({log.recipientPhone})</span>
                        </div>
                        <span className="text-[10px] text-slate-400">
                          {new Date(log.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-600 line-clamp-2 bg-slate-50 p-1.5 rounded-lg border border-slate-100 font-mono">
                        {log.messageBody}
                      </p>
                      <div className="flex items-center justify-between text-[10px] text-slate-400 pt-0.5">
                        <span>Provider: <strong className="text-slate-600 uppercase">{log.provider}</strong> ({log.channel})</span>
                        {log.error && <span className="text-rose-600 font-semibold">{log.error}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SaveIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
      <polyline points="17 21 17 13 7 13 7 21" />
      <polyline points="7 3 7 8 15 8" />
    </svg>
  );
}
