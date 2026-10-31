'use client';

import React, { useState, useMemo } from 'react';
import {
  MessageCircle,
  Copy,
  Check,
  Share2,
  X,
  Send,
  Building2,
  CheckCircle2,
  Loader2,
  ExternalLink,
  Sparkles,
  Smartphone,
} from 'lucide-react';
import { generateAlertMessage } from '@/services/alertGatewayService';
import { openWhatsAppChat, copyTextToClipboard, shareViaNative } from '@/lib/whatsapp';
import { triggerHaptic } from '@/lib/haptics';

interface WhatsAppDigestModalProps {
  isOpen: boolean;
  onClose: () => void;
  siteOptions: { value: string; label: string }[];
  currentSite: string;
  onSiteChange: (site: string) => void;
  metrics: {
    presentCount: number;
    totalRoster: number;
    onDutyCount: number;
    absentNames: string[];
    lateCount?: number;
    attendanceRate?: number;
  };
  managerPhone?: string;
  onBroadcastGateway?: () => Promise<void>;
  isBroadcasting?: boolean;
}

export default function WhatsAppDigestModal({
  isOpen,
  onClose,
  siteOptions,
  currentSite,
  onSiteChange,
  metrics,
  managerPhone = '917709632898',
  onBroadcastGateway,
  isBroadcasting = false,
}: WhatsAppDigestModalProps) {
  const [copied, setCopied] = useState(false);
  const [includeAbsent, setIncludeAbsent] = useState(true);
  const [customHeading, setCustomHeading] = useState('');

  const digestText = useMemo(() => {
    const today = new Date().toLocaleDateString('en-IN', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
    const siteLabel = currentSite === 'all' ? 'All Sites' : currentSite.toUpperCase();

    const absentList = includeAbsent && metrics.absentNames.length > 0
      ? metrics.absentNames.map((name, i) => `  ${i + 1}. ${name}`).join('\n')
      : metrics.absentNames.length === 0
      ? '  None (100% Turnout! 🎉)'
      : '  (Hidden)';

    return `📊 ${customHeading || 'Daily Shift Attendance Digest'} — ${today}\n📍 Hub: ${siteLabel}\n\n👥 Turnout: ${metrics.presentCount} / ${metrics.totalRoster} (${metrics.attendanceRate || 0}%)\n🟢 On Duty Now: ${metrics.onDutyCount}\n⏰ Late Arrivals: ${metrics.lateCount || 0}\n🔴 Absent / Pending (${metrics.absentNames.length}):\n${absentList}\n\n— Generated via InvoiceFlow Operations`;
  }, [currentSite, metrics, includeAbsent, customHeading]);

  if (!isOpen) return null;

  const handleSendToAdmin = () => {
    triggerHaptic('medium');
    openWhatsAppChat(managerPhone || '917709632898', digestText);
    onClose();
  };

  const handleOpenWhatsAppPicker = () => {
    triggerHaptic('light');
    openWhatsAppChat(undefined, digestText);
    onClose();
  };

  const handleCopy = async () => {
    triggerHaptic('light');
    const success = await copyTextToClipboard(digestText);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleShare = async () => {
    triggerHaptic('light');
    await shareViaNative({
      title: 'Shift Attendance Report',
      text: digestText,
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-lg w-full p-5 sm:p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 my-auto">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white flex items-center justify-center font-black shadow-md shadow-emerald-500/20 shrink-0">
              <MessageCircle className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base font-bold text-slate-900 leading-tight">Daily Shift Digest</h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                  Ready to Share
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Share morning shift turnout report with management or team group
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Site Filter & Options */}
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">Filter by Site:</label>
            <div className="flex items-center border border-slate-200 rounded-xl px-2.5 py-1.5 bg-slate-50">
              <Building2 className="w-3.5 h-3.5 text-slate-400 mr-2 shrink-0" />
              <select
                value={currentSite}
                onChange={(e) => onSiteChange(e.target.value)}
                className="w-full bg-transparent text-xs font-bold text-slate-800 focus:outline-none cursor-pointer"
              >
                <option value="all">All Sites</option>
                {siteOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">Report Options:</label>
            <label className="flex items-center gap-2 border border-slate-200 rounded-xl px-3 py-2 bg-slate-50 cursor-pointer">
              <input
                type="checkbox"
                checked={includeAbsent}
                onChange={(e) => setIncludeAbsent(e.target.checked)}
                className="h-3.5 w-3.5 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300"
              />
              <span className="text-xs font-semibold text-slate-700">Include Absent Staff Names</span>
            </label>
          </div>
        </div>

        {/* Target Recipient Banner */}
        <div className="mt-4 p-2.5 rounded-2xl bg-emerald-50/80 border border-emerald-200/80 text-emerald-950 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-700 flex items-center justify-center shrink-0">
              <Smartphone className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 block">
                Target Admin WhatsApp:
              </span>
              <span className="font-mono text-xs font-black text-emerald-950 block">
                {managerPhone.startsWith('+') ? managerPhone : `+${managerPhone}`}
              </span>
            </div>
          </div>
          <span className="px-2 py-0.5 rounded-full bg-emerald-200/70 text-emerald-900 text-[10px] font-black uppercase shrink-0">
            Active Receiver
          </span>
        </div>

        {/* WhatsApp Chat Preview Bubble */}
        <div className="mt-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-bold text-slate-700">WhatsApp Digest Preview:</span>
            <span className="text-[10px] text-slate-400 font-mono">{digestText.length} characters</span>
          </div>

          <div className="bg-[#efeae2] dark:bg-slate-900 rounded-2xl p-3 border border-slate-300 relative shadow-inner max-h-52 overflow-y-auto">
            <div className="bg-[#d9fdd3] dark:bg-emerald-950 text-slate-900 dark:text-emerald-50 rounded-2xl rounded-tr-xs p-3 text-xs shadow-xs border border-[#c1e9be] dark:border-emerald-800 relative space-y-1 font-mono text-[11px] leading-relaxed whitespace-pre-wrap">
              {digestText}
              <div className="flex items-center justify-end gap-1 text-[10px] text-slate-500 font-sans font-medium pt-1">
                <span>{new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}</span>
                <span className="text-[#53bdeb] font-bold">✓✓</span>
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="mt-5 space-y-2.5">
          {/* Direct & Cloud API Primary Actions */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <button
              type="button"
              onClick={handleSendToAdmin}
              className="w-full h-11 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white rounded-2xl font-bold text-xs flex items-center justify-center gap-2 shadow-md shadow-emerald-600/25 transition-all"
              title="Open WhatsApp chat directly with Admin (+91 7709632898)"
            >
              <MessageCircle className="w-4 h-4 text-white shrink-0" />
              <span className="truncate">Send to Admin ({managerPhone.slice(-10)})</span>
              <ExternalLink className="w-3.5 h-3.5 text-white/80 shrink-0 ml-auto" />
            </button>

            {onBroadcastGateway && (
              <button
                type="button"
                onClick={onBroadcastGateway}
                disabled={isBroadcasting}
                className="w-full h-11 bg-gradient-to-r from-emerald-600 via-teal-600 to-indigo-700 hover:from-emerald-700 hover:to-indigo-800 disabled:opacity-50 text-white rounded-2xl font-bold text-xs flex items-center justify-center gap-2 transition-all active:scale-95 shadow-md shadow-teal-700/20"
                title="Send via Official Meta WhatsApp Cloud API"
              >
                {isBroadcasting ? (
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                ) : (
                  <Send className="w-4 h-4 text-white shrink-0" />
                )}
                <span>Auto Broadcast (Cloud API)</span>
              </button>
            )}
          </div>

          {/* Utility Actions */}
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={handleOpenWhatsAppPicker}
              className="h-9 px-2.5 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
              title="Pick any contact or group on WhatsApp"
            >
              <MessageCircle className="w-3.5 h-3.5 text-slate-500" />
              <span className="truncate">Other Chat</span>
            </button>

            <button
              type="button"
              onClick={handleCopy}
              className="h-9 px-2.5 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-slate-500" />}
              <span className="truncate">{copied ? 'Copied!' : 'Copy'}</span>
            </button>

            <button
              type="button"
              onClick={handleShare}
              className="h-9 px-2.5 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
            >
              <Share2 className="w-3.5 h-3.5 text-slate-500" />
              <span className="truncate">Share</span>
            </button>
          </div>
        </div>

        <p className="text-[11px] text-slate-400 text-center mt-3 font-medium">
          Broadcasts directly to Admin WhatsApp (+91 7709632898) via Meta Cloud API or native WhatsApp.
        </p>
      </div>
    </div>
  );
}
