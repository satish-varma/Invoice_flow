'use client';

import React, { useState, useEffect } from 'react';
import {
  MessageCircle,
  Copy,
  Check,
  Share2,
  X,
  Phone,
  Sparkles,
  Send,
  AlertTriangle,
  Clock,
  CheckCircle2,
  Loader2,
  Edit2,
  ExternalLink,
} from 'lucide-react';
import { generateAlertMessage } from '@/services/alertGatewayService';
import {
  cleanPhoneNumber,
  openWhatsAppChat,
  copyTextToClipboard,
  shareViaNative,
  markEmployeeContacted,
  ContactedRecord,
} from '@/lib/whatsapp';
import { triggerHaptic } from '@/lib/haptics';

export interface WhatsAppRecipient {
  id: string;
  name: string;
  employeeId?: string;
  phone?: string;
  siteName?: string;
  designation?: string;
  isAbsent?: boolean;
  isLate?: boolean;
  lateMinutes?: number;
  checkInTime?: string;
  cutoffTime?: string;
}

interface WhatsAppQuickSendModalProps {
  isOpen: boolean;
  onClose: () => void;
  recipient: WhatsAppRecipient | null;
  onSavePhone?: (empId: string, newPhone: string) => Promise<void>;
  onSendGatewayAlert?: (emp: WhatsAppRecipient, message: string) => Promise<void>;
  isSendingGateway?: boolean;
  lastContacted?: ContactedRecord;
}

type TemplateKey = 'gentle_reminder' | 'absent_notice' | 'late_alert' | 'checkout_reminder' | 'custom';

export default function WhatsAppQuickSendModal({
  isOpen,
  onClose,
  recipient,
  onSavePhone,
  onSendGatewayAlert,
  isSendingGateway = false,
  lastContacted,
}: WhatsAppQuickSendModalProps) {
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateKey>('absent_notice');
  const [customMessage, setCustomMessage] = useState('');
  const [copied, setCopied] = useState(false);
  const [isEditingPhone, setIsEditingPhone] = useState(false);
  const [phoneInput, setPhoneInput] = useState('');
  const [isSavingPhone, setIsSavingPhone] = useState(false);
  const [phoneError, setPhoneError] = useState('');

  // Auto-select template based on recipient status when opening
  useEffect(() => {
    if (!recipient) return;
    const initialTemplate: TemplateKey = recipient.isLate
      ? 'late_alert'
      : recipient.isAbsent
      ? 'absent_notice'
      : 'gentle_reminder';

    setSelectedTemplate(initialTemplate);
    setPhoneInput(recipient.phone ? recipient.phone.replace(/\D/g, '').slice(-10) : '');
    setIsEditingPhone(false);
    setPhoneError('');

    // Generate initial message
    const initialText = generateAlertMessage(initialTemplate, {
      employeeName: recipient.name,
      siteName: recipient.siteName || 'Hub',
      cutoff: recipient.cutoffTime || '06:30 AM',
      checkInTime: recipient.checkInTime,
      lateMinutes: recipient.lateMinutes,
    });
    setCustomMessage(initialText);
  }, [recipient, isOpen]);

  if (!isOpen || !recipient) return null;

  const phoneInfo = cleanPhoneNumber(recipient.phone);

  const handleTemplateChange = (tpl: TemplateKey) => {
    setSelectedTemplate(tpl);
    triggerHaptic('light');
    if (tpl === 'custom') return;

    const text = generateAlertMessage(tpl, {
      employeeName: recipient.name,
      siteName: recipient.siteName || 'Hub',
      cutoff: recipient.cutoffTime || '06:30 AM',
      checkInTime: recipient.checkInTime,
      lateMinutes: recipient.lateMinutes,
    });
    setCustomMessage(text);
  };

  const handleOpenWhatsApp = () => {
    triggerHaptic('medium');
    openWhatsAppChat(recipient.phone, customMessage);
    markEmployeeContacted(recipient.id, {
      template: selectedTemplate,
      recipientName: recipient.name,
      phone: recipient.phone,
    });
    onClose();
  };

  const handleCopy = async () => {
    triggerHaptic('light');
    const success = await copyTextToClipboard(customMessage);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleShare = async () => {
    triggerHaptic('light');
    await shareViaNative({
      title: `Attendance Notice — ${recipient.name}`,
      text: customMessage,
    });
    markEmployeeContacted(recipient.id, {
      template: selectedTemplate,
      recipientName: recipient.name,
      phone: recipient.phone,
    });
  };

  const handleSavePhoneInline = async () => {
    const clean = phoneInput.trim().replace(/\D/g, '');
    if (clean.length !== 10) {
      setPhoneError('Please enter a valid 10-digit mobile number');
      return;
    }
    setPhoneError('');
    setIsSavingPhone(true);
    try {
      if (onSavePhone) {
        await onSavePhone(recipient.id, clean);
      }
      recipient.phone = clean;
      setIsEditingPhone(false);
      triggerHaptic('success');
    } catch (err: any) {
      setPhoneError(err.message || 'Failed to save phone');
    } finally {
      setIsSavingPhone(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-lg w-full p-5 sm:p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 my-auto">
        {/* Modal Header */}
        <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white flex items-center justify-center font-black shadow-md shadow-emerald-500/20 shrink-0">
              <MessageCircle className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base font-bold text-slate-900 leading-tight">Send WhatsApp Message</h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                  100% Free
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Preview, customize, or send direct 1-to-1 WhatsApp alert
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

        {/* Recipient Overview Card */}
        <div className="mt-4 bg-slate-50/80 rounded-2xl p-3.5 border border-slate-200/80">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-full bg-emerald-100 text-emerald-800 font-bold text-xs flex items-center justify-center shrink-0">
                {recipient.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-bold text-slate-900">{recipient.name}</h4>
                  {recipient.employeeId && (
                    <span className="text-[10px] font-mono text-slate-500 bg-white px-1.5 py-0.2 rounded border border-slate-200">
                      {recipient.employeeId}
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-500 font-medium">
                  {recipient.designation || 'Staff'} · {recipient.siteName || 'Hub'}
                </p>
              </div>
            </div>

            {/* Contacted Badge */}
            {lastContacted ? (
              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-1 rounded-full border border-emerald-200 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                Alerted at {lastContacted.formattedTime}
              </span>
            ) : (
              <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-1 rounded-full border border-amber-200">
                Not contacted today
              </span>
            )}
          </div>

          {/* Phone row with quick inline edit */}
          <div className="mt-3 pt-2.5 border-t border-slate-200/60 flex items-center justify-between gap-2 text-xs">
            {isEditingPhone ? (
              <div className="w-full flex items-center gap-2">
                <div className="flex-1 flex items-center border border-emerald-400 rounded-xl overflow-hidden bg-white shadow-2xs">
                  <span className="px-2.5 py-1.5 bg-slate-100 text-slate-600 font-bold text-xs border-r border-slate-200">
                    +91
                  </span>
                  <input
                    type="tel"
                    maxLength={10}
                    placeholder="9876543210"
                    value={phoneInput}
                    onChange={(e) => setPhoneInput(e.target.value.replace(/\D/g, '').slice(0, 10))}
                    className="flex-1 px-2.5 py-1 text-xs font-semibold text-slate-900 focus:outline-none"
                    autoFocus
                  />
                </div>
                <button
                  type="button"
                  onClick={handleSavePhoneInline}
                  disabled={isSavingPhone || phoneInput.length !== 10}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl font-bold text-xs shadow-2xs transition-all"
                >
                  {isSavingPhone ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Save'}
                </button>
                <button
                  type="button"
                  onClick={() => setIsEditingPhone(false)}
                  className="px-2 py-1.5 text-slate-500 hover:text-slate-800 text-xs font-semibold"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-1.5 text-slate-700">
                  <Phone className="w-3.5 h-3.5 text-slate-400" />
                  {phoneInfo.isValid ? (
                    <span className="font-mono font-bold text-slate-800">
                      +91 {phoneInfo.tenDigits}
                    </span>
                  ) : (
                    <span className="text-amber-700 italic font-medium">No mobile number on file</span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setIsEditingPhone(true)}
                  className="text-[11px] font-bold text-[#3b2fc9] hover:text-[#3228a8] flex items-center gap-1"
                >
                  <Edit2 className="w-3 h-3" />
                  <span>{phoneInfo.isValid ? 'Change' : '+ Add Number'}</span>
                </button>
              </>
            )}
          </div>
          {phoneError && <p className="text-[11px] text-rose-600 mt-1 font-medium">{phoneError}</p>}
        </div>

        {/* Template Selector Chips */}
        <div className="mt-4">
          <label className="text-xs font-bold text-slate-700 block mb-1.5">Choose Message Template:</label>
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
            <button
              type="button"
              onClick={() => handleTemplateChange('absent_notice')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                selectedTemplate === 'absent_notice'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              ⚠️ Cutoff Notice
            </button>
            <button
              type="button"
              onClick={() => handleTemplateChange('gentle_reminder')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                selectedTemplate === 'gentle_reminder'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              ☀️ Gentle Reminder
            </button>
            <button
              type="button"
              onClick={() => handleTemplateChange('late_alert')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                selectedTemplate === 'late_alert'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              ⏰ Late Notice
            </button>
            <button
              type="button"
              onClick={() => handleTemplateChange('checkout_reminder')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                selectedTemplate === 'checkout_reminder'
                  ? 'bg-teal-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              🏁 Check-Out
            </button>
            <button
              type="button"
              onClick={() => handleTemplateChange('custom')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                selectedTemplate === 'custom'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              ✍️ Custom
            </button>
          </div>
        </div>

        {/* WhatsApp Chat Preview Bubble */}
        <div className="mt-3.5">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-bold text-slate-700">Message Preview:</span>
            <span className="text-[10px] text-slate-400 font-mono">{customMessage.length} characters</span>
          </div>

          <div className="bg-[#efeae2] dark:bg-slate-900 rounded-2xl p-3 border border-slate-300 relative shadow-inner">
            <div className="bg-[#d9fdd3] dark:bg-emerald-950 text-slate-900 dark:text-emerald-50 rounded-2xl rounded-tr-xs p-3 text-xs shadow-xs border border-[#c1e9be] dark:border-emerald-800 relative space-y-1">
              <textarea
                value={customMessage}
                onChange={(e) => {
                  setCustomMessage(e.target.value);
                  setSelectedTemplate('custom');
                }}
                rows={4}
                className="w-full bg-transparent border-0 p-0 text-xs font-sans text-slate-900 dark:text-emerald-100 focus:outline-none resize-none leading-relaxed"
                placeholder="Type your WhatsApp message..."
              />
              <div className="flex items-center justify-end gap-1 text-[10px] text-slate-500 font-medium pt-1">
                <span>{new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}</span>
                <span className="text-[#53bdeb] font-bold">✓✓</span>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Action Buttons */}
        <div className="mt-5 space-y-2.5">
          {/* Primary Action: Open WhatsApp */}
          <button
            type="button"
            onClick={handleOpenWhatsApp}
            className="w-full h-11 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white rounded-2xl font-bold text-sm flex items-center justify-center gap-2 shadow-md shadow-emerald-600/25 transition-all"
          >
            <MessageCircle className="w-4 h-4 text-white" />
            <span>Open in WhatsApp</span>
            <ExternalLink className="w-3.5 h-3.5 text-white/80 ml-auto" />
          </button>

          {/* Secondary Actions: Copy, Share, Gateway */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            <button
              type="button"
              onClick={handleCopy}
              className="h-9 px-3 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-slate-500" />}
              <span>{copied ? 'Copied!' : 'Copy Text'}</span>
            </button>

            <button
              type="button"
              onClick={handleShare}
              className="h-9 px-3 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
            >
              <Share2 className="w-3.5 h-3.5 text-slate-500" />
              <span>Share...</span>
            </button>

            {onSendGatewayAlert && phoneInfo.isValid && (
              <button
                type="button"
                onClick={() => onSendGatewayAlert(recipient, customMessage)}
                disabled={isSendingGateway}
                className="col-span-2 sm:col-span-1 h-9 px-3 rounded-xl bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-900 text-xs font-bold flex items-center justify-center gap-1.5 transition-all active:scale-95 disabled:opacity-50"
                title="Send background alert via configured SMS/WhatsApp gateway"
              >
                {isSendingGateway ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-700" />
                ) : (
                  <Send className="w-3.5 h-3.5 text-amber-700" />
                )}
                <span>Auto Gateway</span>
              </button>
            )}
          </div>
        </div>

        {/* Footer info note */}
        <p className="text-[11px] text-slate-400 text-center mt-3 font-medium">
          Uses 1-Click WhatsApp direct link. No Meta API fees or credit cards required.
        </p>
      </div>
    </div>
  );
}
