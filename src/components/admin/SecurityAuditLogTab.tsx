'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { AuditLogEntry, AuditActionType } from '@/types/audit';
import { getAuditLogs } from '@/services/auditService';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Search,
  Filter,
  Download,
  RotateCcw,
  Shield,
  Clock,
  User,
  AlertTriangle,
  Trash2,
  Eye,
  Copy,
  FileSpreadsheet,
  CheckCircle2,
  Calendar,
  Layers,
  ChevronDown,
  Loader2,
  Info,
} from 'lucide-react';
import { format, formatDistanceToNow, isToday, subDays } from 'date-fns';
import * as XLSX from 'xlsx';
import { triggerHaptic } from '@/lib/haptics';

export function SecurityAuditLogTab() {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [actionCategory, setActionCategory] = useState<
    'all' | 'users' | 'sessions' | 'permissions' | 'simulation' | 'deletions'
  >('all');
  const [dateRange, setDateRange] = useState<'all' | 'today' | '7days' | '30days'>('all');

  const fetchLogs = async () => {
    setIsLoading(true);
    try {
      const data = await getAuditLogs(300);
      setLogs(data);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      // 1. Search filter
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const actorMatch = log.actorEmail?.toLowerCase().includes(q);
        const actionMatch = log.actionLabel?.toLowerCase().includes(q) || log.action?.toLowerCase().includes(q);
        const targetMatch = log.targetLabel?.toLowerCase().includes(q) || log.targetId?.toLowerCase().includes(q);
        const detailsMatch = log.details ? JSON.stringify(log.details).toLowerCase().includes(q) : false;
        if (!actorMatch && !actionMatch && !targetMatch && !detailsMatch) return false;
      }

      // 2. Action Category filter
      if (actionCategory !== 'all') {
        const act = log.action;
        if (actionCategory === 'users') {
          if (!['user_created', 'user_updated', 'user_status_changed', 'user_deleted'].includes(act)) return false;
        } else if (actionCategory === 'sessions') {
          if (!['sessions_revoked', 'device_session_revoked'].includes(act)) return false;
        } else if (actionCategory === 'permissions') {
          if (!['permissions_cloned', 'access_matrix_exported'].includes(act)) return false;
        } else if (actionCategory === 'simulation') {
          if (!['simulation_started', 'simulation_stopped'].includes(act)) return false;
        } else if (actionCategory === 'deletions') {
          if (!['dc_deleted', 'bulk_dc_deleted', 'invoice_deleted', 'bulk_invoices_deleted', 'tuckshop_deleted'].includes(act)) return false;
        }
      }

      // 3. Date range filter
      if (dateRange !== 'all') {
        const logDate = new Date(log.timestamp);
        if (dateRange === 'today') {
          if (!isToday(logDate)) return false;
        } else if (dateRange === '7days') {
          if (logDate < subDays(new Date(), 7)) return false;
        } else if (dateRange === '30days') {
          if (logDate < subDays(new Date(), 30)) return false;
        }
      }

      return true;
    });
  }, [logs, searchTerm, actionCategory, dateRange]);

  const handleExportExcel = () => {
    triggerHaptic('medium');
    const rows = filteredLogs.map((log) => ({
      Timestamp: format(new Date(log.timestamp), 'yyyy-MM-dd HH:mm:ss'),
      Action: log.actionLabel || log.action,
      'Actor Email': log.actorEmail,
      'Actor Role': log.actorRole?.toUpperCase(),
      'Target Entity': log.targetLabel || log.targetId || '—',
      'Target Type': log.targetType?.toUpperCase(),
      Details: log.details ? JSON.stringify(log.details) : '',
      'User Agent': log.userAgent || '',
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Audit Log');
    const dateStr = format(new Date(), 'yyyy-MM-dd_HHmm');
    XLSX.writeFile(wb, `Security_Audit_Trail_${dateStr}.xlsx`);
  };

  const getActionBadge = (action: AuditActionType) => {
    if (['user_deleted', 'dc_deleted', 'bulk_dc_deleted', 'invoice_deleted', 'bulk_invoices_deleted', 'tuckshop_deleted'].includes(action)) {
      return (
        <Badge className="bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-200 border border-rose-300 dark:border-rose-800 text-[11px] font-bold py-0.5 px-2.5">
          <Trash2 className="w-3 h-3 mr-1" />
          Deletion Event
        </Badge>
      );
    }
    if (['sessions_revoked', 'device_session_revoked', 'user_status_changed'].includes(action)) {
      return (
        <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-200 border border-amber-300 dark:border-amber-800 text-[11px] font-bold py-0.5 px-2.5">
          <AlertTriangle className="w-3 h-3 mr-1" />
          Access / Session
        </Badge>
      );
    }
    if (['simulation_started', 'simulation_stopped'].includes(action)) {
      return (
        <Badge className="bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-200 border border-purple-300 dark:border-purple-800 text-[11px] font-bold py-0.5 px-2.5">
          <Eye className="w-3 h-3 mr-1" />
          Simulation View
        </Badge>
      );
    }
    if (['permissions_cloned', 'access_matrix_exported'].includes(action)) {
      return (
        <Badge className="bg-sky-100 text-sky-800 dark:bg-sky-950/60 dark:text-sky-200 border border-sky-300 dark:border-sky-800 text-[11px] font-bold py-0.5 px-2.5">
          <Copy className="w-3 h-3 mr-1" />
          Permissions
        </Badge>
      );
    }
    return (
      <Badge className="bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-200 border border-indigo-300 dark:border-indigo-800 text-[11px] font-bold py-0.5 px-2.5">
        <Shield className="w-3 h-3 mr-1" />
        User Account
      </Badge>
    );
  };

  return (
    <div className="space-y-4">
      {/* Controls Header */}
      <div className="p-4 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by admin, target user, action, details..."
            className="pl-9 h-10 rounded-2xl border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/40 text-sm"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Action Category Filter */}
          <select
            value={actionCategory}
            onChange={(e) => setActionCategory(e.target.value as any)}
            className="h-10 text-xs font-bold rounded-2xl border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-slate-700 dark:text-slate-200 shadow-2xs cursor-pointer"
          >
            <option value="all">All Event Types</option>
            <option value="users">User Lifecycle</option>
            <option value="sessions">Session & Devices</option>
            <option value="permissions">Permissions & Clones</option>
            <option value="simulation">Admin Simulations</option>
            <option value="deletions">Critical Deletions</option>
          </select>

          {/* Date Filter */}
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value as any)}
            className="h-10 text-xs font-bold rounded-2xl border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-slate-700 dark:text-slate-200 shadow-2xs cursor-pointer"
          >
            <option value="all">All Dates</option>
            <option value="today">Today</option>
            <option value="7days">Last 7 Days</option>
            <option value="30days">Last 30 Days</option>
          </select>

          {/* Refresh Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={fetchLogs}
            disabled={isLoading}
            className="h-10 px-3 rounded-2xl border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
            title="Refresh Audit Trail"
          >
            <RotateCcw className={`w-4 h-4 ${isLoading ? 'animate-spin text-indigo-600' : 'text-slate-500'}`} />
          </Button>

          {/* Export to Excel */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportExcel}
            disabled={filteredLogs.length === 0}
            className="h-10 px-3.5 rounded-2xl border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 font-bold text-xs hover:bg-emerald-100 flex items-center gap-1.5 shadow-2xs"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span>Export Trail</span>
          </Button>
        </div>
      </div>

      {/* Log Feed */}
      <div className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs font-bold text-slate-500 dark:text-slate-400">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-indigo-600" />
            <span>Audit Trail Entries ({filteredLogs.length})</span>
          </div>
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="text-indigo-600 dark:text-indigo-400 hover:underline"
            >
              Clear Search
            </button>
          )}
        </div>

        {isLoading ? (
          <div className="p-12 text-center space-y-3">
            <Loader2 className="w-8 h-8 mx-auto animate-spin text-indigo-600" />
            <p className="text-xs font-bold text-slate-500">Loading audit events...</p>
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <Info className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-600" />
            <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
              No audit events found
            </p>
            <p className="text-xs text-slate-400">
              Administrative changes, security revocations, and simulation sessions will be recorded here automatically.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {filteredLogs.map((log) => {
              const logDate = new Date(log.timestamp);
              return (
                <div
                  key={log.id}
                  className="p-4 hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors flex flex-col sm:flex-row items-start justify-between gap-3"
                >
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    <div className="w-8 h-8 rounded-full bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                      {log.actorEmail ? log.actorEmail.charAt(0).toUpperCase() : 'S'}
                    </div>

                    <div className="space-y-1.5 min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-sm text-slate-900 dark:text-white">
                          {log.actionLabel || log.action}
                        </span>
                        {getActionBadge(log.action)}
                      </div>

                      <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300 flex-wrap">
                        <span className="font-semibold text-slate-900 dark:text-slate-100">
                          {log.actorEmail}
                        </span>
                        <span className="text-slate-400">·</span>
                        <span className="px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-[10px] font-bold text-slate-600 dark:text-slate-400">
                          {log.actorRole?.toUpperCase()}
                        </span>

                        {log.targetLabel && (
                          <>
                            <span className="text-slate-400">→</span>
                            <span className="font-mono font-bold text-slate-900 dark:text-slate-100 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-lg select-all">
                              {log.targetLabel}
                            </span>
                          </>
                        )}
                      </div>

                      {log.details && Object.keys(log.details).length > 0 && (
                        <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60 text-xs font-mono text-slate-600 dark:text-slate-400 flex flex-wrap gap-x-3 gap-y-1">
                          {Object.entries(log.details).map(([k, v]) => (
                            <span key={k}>
                              <span className="text-slate-400">{k}:</span>{' '}
                              <span className="font-bold text-slate-700 dark:text-slate-300">
                                {typeof v === 'object' ? JSON.stringify(v) : String(v)}
                              </span>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="text-left sm:text-right shrink-0 text-xs text-slate-400 dark:text-slate-500 space-y-0.5 sm:self-start">
                    <p className="font-bold text-slate-700 dark:text-slate-300">
                      {formatDistanceToNow(logDate, { addSuffix: true })}
                    </p>
                    <p className="text-[11px]">
                      {format(logDate, 'dd MMM yyyy, HH:mm:ss')}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
