'use client';

import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Smartphone,
  Laptop,
  Tablet,
  ShieldAlert,
  RotateCcw,
  CheckCircle2,
  Clock,
  Trash2,
  Loader2,
  AlertTriangle,
  Monitor,
} from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { DeviceSession } from '@/types/audit';
import { triggerHaptic } from '@/lib/haptics';
import { getOrCreateSessionId } from '@/services/auditService';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  targetUser: {
    id: string;
    email: string;
    role: string;
    sessions?: Record<string, DeviceSession>;
  } | null;
  onRevokeDevice: (userId: string, sessionId: string, email: string) => Promise<void>;
  onRevokeAllSessions: (userId: string, email: string) => Promise<void>;
}

export function UserDeviceSessionsModal({
  isOpen,
  onClose,
  targetUser,
  onRevokeDevice,
  onRevokeAllSessions,
}: Props) {
  const [revokingSessionId, setRevokingSessionId] = useState<string | null>(null);
  const [isRevokingAll, setIsRevokingAll] = useState(false);
  const currentSessionId = typeof window !== 'undefined' ? getOrCreateSessionId() : '';

  if (!targetUser) return null;

  const rawSessions = targetUser.sessions ? Object.values(targetUser.sessions) : [];

  // Sort sessions: current active session first, then by lastActive descending
  const sessions = [...rawSessions].sort((a, b) => {
    if (a.sessionId === currentSessionId) return -1;
    if (b.sessionId === currentSessionId) return 1;
    return new Date(b.lastActive).getTime() - new Date(a.lastActive).getTime();
  });

  const activeCount = sessions.filter((s) => !s.revoked).length;

  const handleRevokeSingle = async (session: DeviceSession) => {
    triggerHaptic('medium');
    setRevokingSessionId(session.sessionId);
    try {
      await onRevokeDevice(targetUser.id, session.sessionId, targetUser.email);
    } finally {
      setRevokingSessionId(null);
    }
  };

  const handleRevokeAll = async () => {
    triggerHaptic('heavy');
    setIsRevokingAll(true);
    try {
      await onRevokeAllSessions(targetUser.id, targetUser.email);
    } finally {
      setIsRevokingAll(false);
    }
  };

  const getDeviceIcon = (deviceType: string) => {
    switch (deviceType) {
      case 'mobile':
        return <Smartphone className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />;
      case 'tablet':
        return <Tablet className="w-5 h-5 text-purple-600 dark:text-purple-400" />;
      default:
        return <Laptop className="w-5 h-5 text-blue-600 dark:text-blue-400" />;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-xl rounded-3xl p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl">
        <DialogHeader className="space-y-1 text-left">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2.5 rounded-2xl bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-100 dark:border-indigo-900 text-indigo-600 dark:text-indigo-400">
                <Monitor className="w-5 h-5" />
              </div>
              <div>
                <DialogTitle className="text-base sm:text-lg font-black tracking-tight text-slate-900 dark:text-white">
                  Active Devices & Sessions
                </DialogTitle>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {targetUser.email} ·{' '}
                  <span className="font-bold text-slate-700 dark:text-slate-300">
                    {activeCount} Active Device{activeCount !== 1 ? 's' : ''}
                  </span>
                </p>
              </div>
            </div>
          </div>
        </DialogHeader>

        <div className="mt-4 space-y-3 max-h-[420px] overflow-y-auto pr-1">
          {sessions.length === 0 ? (
            <div className="p-8 text-center rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-dashed border-slate-200 dark:border-slate-700 space-y-2">
              <Laptop className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-600" />
              <p className="text-sm font-semibold text-slate-600 dark:text-slate-400">
                No active device sessions registered yet
              </p>
              <p className="text-xs text-slate-400">
                Device fingerprints are automatically recorded whenever this user logs in.
              </p>
            </div>
          ) : (
            sessions.map((session) => {
              const isCurrent = session.sessionId === currentSessionId;
              const isRevoked = !!session.revoked;
              const isWorking = revokingSessionId === session.sessionId;

              return (
                <div
                  key={session.sessionId}
                  className={`p-3.5 rounded-2xl border transition-all ${
                    isRevoked
                      ? 'bg-slate-50/70 dark:bg-slate-900/40 border-slate-200/60 dark:border-slate-800 opacity-60'
                      : isCurrent
                      ? 'bg-indigo-50/40 dark:bg-indigo-950/20 border-indigo-200 dark:border-indigo-800 ring-1 ring-indigo-500/30'
                      : 'bg-white dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      <div className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 shrink-0 mt-0.5">
                        {getDeviceIcon(session.deviceType)}
                      </div>

                      <div className="space-y-1 min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-sm text-slate-900 dark:text-white truncate">
                            {session.os} · {session.browser}
                          </span>

                          {isCurrent && (
                            <Badge className="bg-indigo-600 text-white text-[10px] font-bold py-0.5 px-2 rounded-full">
                              This Device
                            </Badge>
                          )}

                          {isRevoked ? (
                            <Badge
                              variant="outline"
                              className="border-rose-200 bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 text-[10px] font-bold py-0.5 px-2 rounded-full"
                            >
                              Revoked
                            </Badge>
                          ) : (
                            <Badge
                              variant="outline"
                              className="border-emerald-200 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 text-[10px] font-bold py-0.5 px-2 rounded-full"
                            >
                              Active
                            </Badge>
                          )}
                        </div>

                        <div className="text-[11px] text-slate-500 dark:text-slate-400 space-y-0.5">
                          <p className="flex items-center gap-1.5 truncate">
                            <Clock className="w-3 h-3 shrink-0" />
                            <span>
                              Last active:{' '}
                              {session.lastActive
                                ? formatDistanceToNow(new Date(session.lastActive), {
                                    addSuffix: true,
                                  })
                                : 'Unknown'}
                            </span>
                            {session.lastActive && (
                              <span className="text-slate-400 dark:text-slate-500">
                                ({format(new Date(session.lastActive), 'dd MMM yyyy, HH:mm')})
                              </span>
                            )}
                          </p>
                          <p className="font-mono text-[10px] text-slate-400 truncate">
                            ID: {session.sessionId}
                          </p>
                        </div>
                      </div>
                    </div>

                    {!isRevoked && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRevokeSingle(session)}
                        disabled={isWorking}
                        className="h-8 px-2.5 text-xs font-bold text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl shrink-0 transition-colors"
                        title="Revoke this device session"
                      >
                        {isWorking ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
                        ) : (
                          <RotateCcw className="w-3.5 h-3.5 mr-1" />
                        )}
                        Revoke
                      </Button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        <DialogFooter className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-2">
          {activeCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleRevokeAll}
              disabled={isRevokingAll}
              className="w-full sm:w-auto h-9 text-xs font-bold text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800 hover:bg-amber-50 dark:hover:bg-amber-950/40 rounded-xl"
            >
              {isRevokingAll ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
              ) : (
                <AlertTriangle className="w-3.5 h-3.5 mr-1.5 text-amber-600" />
              )}
              Revoke All Active Devices
            </Button>
          )}

          <Button
            onClick={onClose}
            className="w-full sm:w-auto h-9 px-5 rounded-xl font-bold text-xs"
          >
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
