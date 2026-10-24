'use client';

import React, { useState, useMemo } from 'react';
import {
  MessageCircle,
  Copy,
  Check,
  Share2,
  X,
  Phone,
  UserX,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Users,
  Edit2,
  Loader2,
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

export interface AbsentStaffItem {
  id: string;
  name: string;
  employeeId?: string;
  phone?: string;
  siteName?: string;
  cutoffTime?: string;
  designation?: string;
}

interface WhatsAppBatchAbsentModalProps {
  isOpen: boolean;
  onClose: () => void;
  absentList: AbsentStaffItem[];
  siteName: string;
  contactedMap: Record<string, ContactedRecord>;
  onSavePhone?: (empId: string, phone: string) => Promise<void>;
}

export default function WhatsAppBatchAbsentModal({
  isOpen,
  onClose,
  absentList,
  siteName,
  contactedMap,
  onSavePhone,
}: WhatsAppBatchAbsentModalProps) {
  const [activeTab, setActiveTab] = useState<'group' | 'individual'>('group');
  const [copiedGroup, setCopiedGroup] = useState(false);
  const [editingEmpId, setEditingEmpId] = useState<string | null>(null);
  const [phoneInput, setPhoneInput] = useState('');
  const [isSavingPhone, setIsSavingPhone] = useState(false);

  // Group notice announcement
  const groupNoticeText = useMemo(() => {
    const today = new Date().toLocaleDateString('en-IN', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
    const siteLabel = siteName === 'all' ? 'All Sites' : siteName.toUpperCase();
    const absentNames = absentList.map((e) => e.name);

    return generateAlertMessage('group_absent_alert', {
      siteName: siteLabel,
      date: today,
      cutoff: absentList[0]?.cutoffTime || '06:30 AM',
      absentNames,
    });
  }, [absentList, siteName]);

  if (!isOpen) return null;

  const handleCopyGroup = async () => {
    triggerHaptic('light');
    const success = await copyTextToClipboard(groupNoticeText);
    if (success) {
      setCopiedGroup(true);
      setTimeout(() => setCopiedGroup(false), 2000);
    }
  };

  const handleOpenGroupWhatsApp = () => {
    triggerHaptic('medium');
    openWhatsAppChat(undefined, groupNoticeText);
  };

  const handleShareGroup = async () => {
    triggerHaptic('light');
    await shareViaNative({
      title: 'Shift Absent Notice',
      text: groupNoticeText,
    });
  };

  const handleIndividualSend = (emp: AbsentStaffItem) => {
    triggerHaptic('light');
    const msg = generateAlertMessage('absent_notice', {
      employeeName: emp.name,
      siteName: emp.siteName || siteName,
      cutoff: emp.cutoffTime || '06:30 AM',
    });
    openWhatsAppChat(emp.phone, msg);
    markEmployeeContacted(emp.id, {
      template: 'absent_notice',
      recipientName: emp.name,
      phone: emp.phone,
    });
  };

  const handleSavePhoneInline = async (empId: string) => {
    const clean = phoneInput.trim().replace(/\D/g, '');
    if (clean.length !== 10) return;
    setIsSavingPhone(true);
    try {
      if (onSavePhone) {
        await onSavePhone(empId, clean);
      }
      const item = absentList.find((e) => e.id === empId);
      if (item) item.phone = clean;
      setEditingEmpId(null);
      triggerHaptic('success');
    } finally {
      setIsSavingPhone(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-lg w-full p-5 sm:p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 my-auto">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-rose-500 to-amber-600 text-white flex items-center justify-center font-black shadow-md shadow-rose-500/20 shrink-0">
              <UserX className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base font-bold text-slate-900 leading-tight">Batch Absent Alerts</h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 border border-rose-200">
                  {absentList.length} Staff Pending
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Send a combined group notice or message individual staff sequentially
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

        {/* Tab selection */}
        <div className="mt-4 flex items-center gap-2 bg-slate-100 p-1 rounded-2xl">
          <button
            type="button"
            onClick={() => {
              triggerHaptic('light');
              setActiveTab('group');
            }}
            className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'group'
                ? 'bg-white text-slate-900 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Group Chat Notice</span>
          </button>
          <button
            type="button"
            onClick={() => {
              triggerHaptic('light');
              setActiveTab('individual');
            }}
            className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'individual'
                ? 'bg-white text-slate-900 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <MessageCircle className="w-3.5 h-3.5" />
            <span>Individual Queue ({absentList.length})</span>
          </button>
        </div>

        {activeTab === 'group' ? (
          /* Option A: Group Announcement Mode */
          <div className="mt-4 space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-slate-700">Cafeteria Group Announcement:</span>
              <span className="text-[10px] text-slate-400 font-mono">{groupNoticeText.length} chars</span>
            </div>

            <div className="bg-[#efeae2] dark:bg-slate-900 rounded-2xl p-3 border border-slate-300 relative shadow-inner max-h-48 overflow-y-auto">
              <div className="bg-[#d9fdd3] dark:bg-emerald-950 text-slate-900 dark:text-emerald-50 rounded-2xl rounded-tr-xs p-3 text-xs shadow-xs border border-[#c1e9be] dark:border-emerald-800 font-mono text-[11px] leading-relaxed whitespace-pre-wrap">
                {groupNoticeText}
              </div>
            </div>

            <p className="text-[11px] text-slate-500">
              Paste this announcement into your Store / Kitchen Operations WhatsApp group so all supervisors and leads see the unpunched roster immediately.
            </p>

            <div className="pt-2 space-y-2">
              <button
                type="button"
                onClick={handleOpenGroupWhatsApp}
                className="w-full h-11 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white rounded-2xl font-bold text-sm flex items-center justify-center gap-2 shadow-md shadow-emerald-600/25 transition-all"
              >
                <MessageCircle className="w-4 h-4 text-white" />
                <span>Open in WhatsApp (Pick Group)</span>
                <ExternalLink className="w-3.5 h-3.5 text-white/80 ml-auto" />
              </button>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={handleCopyGroup}
                  className="h-9 px-3 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
                >
                  {copiedGroup ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-slate-500" />}
                  <span>{copiedGroup ? 'Copied Announcement!' : 'Copy Announcement'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleShareGroup}
                  className="h-9 px-3 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Share2 className="w-3.5 h-3.5 text-slate-500" />
                  <span>Share via OS...</span>
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* Option B: Individual Sequential Queue Mode */
          <div className="mt-4 space-y-2.5 max-h-72 overflow-y-auto pr-1">
            <p className="text-xs text-slate-500 font-medium mb-1">
              Tap the WhatsApp button next to each employee to send a pre-filled 1-to-1 notice:
            </p>

            {absentList.map((emp) => {
              const phoneInfo = cleanPhoneNumber(emp.phone);
              const contacted = contactedMap[emp.id];
              const isEditing = editingEmpId === emp.id;

              return (
                <div
                  key={emp.id}
                  className="bg-slate-50 border border-slate-200 rounded-2xl p-3 flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-rose-100 text-rose-800 font-bold text-xs flex items-center justify-center shrink-0">
                      {emp.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <p className="text-xs font-bold text-slate-900 truncate">{emp.name}</p>
                        {contacted && (
                          <span className="text-[9px] font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.2 rounded-full flex items-center gap-0.5">
                            <Check className="w-2.5 h-2.5" />
                            {contacted.formattedTime}
                          </span>
                        )}
                      </div>

                      {isEditing ? (
                        <div className="flex items-center gap-1.5 mt-1">
                          <input
                            type="tel"
                            maxLength={10}
                            placeholder="10-digit phone"
                            value={phoneInput}
                            onChange={(e) => setPhoneInput(e.target.value.replace(/\D/g, ''))}
                            className="w-28 px-2 py-0.5 text-[11px] border border-slate-300 rounded font-mono"
                            autoFocus
                          />
                          <button
                            type="button"
                            onClick={() => handleSavePhoneInline(emp.id)}
                            disabled={isSavingPhone || phoneInput.length !== 10}
                            className="px-2 py-0.5 bg-emerald-600 text-white rounded text-[10px] font-bold"
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingEmpId(null)}
                            className="text-[10px] text-slate-500"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <p className="text-[10px] text-slate-500 font-mono flex items-center gap-1">
                          {phoneInfo.isValid ? (
                            `+91 ${phoneInfo.tenDigits}`
                          ) : (
                            <span className="text-amber-700 italic">No phone</span>
                          )}
                          <button
                            type="button"
                            onClick={() => {
                              setEditingEmpId(emp.id);
                              setPhoneInput(phoneInfo.tenDigits || '');
                            }}
                            className="text-[#3b2fc9] hover:underline ml-1"
                          >
                            <Edit2 className="w-2.5 h-2.5 inline" />
                          </button>
                        </p>
                      )}
                    </div>
                  </div>

                  {/* 1-Tap WhatsApp Action */}
                  <button
                    type="button"
                    onClick={() => handleIndividualSend(emp)}
                    className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-bold flex items-center gap-1.5 shadow-2xs transition-all shrink-0"
                    title={phoneInfo.isValid ? `Send WhatsApp alert to ${emp.name}` : 'Open WhatsApp to share alert'}
                  >
                    <MessageCircle className="w-3.5 h-3.5 text-white" />
                    <span>WhatsApp</span>
                  </button>
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
          <p className="text-[11px] text-slate-400 font-medium">100% Free · Opens direct WhatsApp</p>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
