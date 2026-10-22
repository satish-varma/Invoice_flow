'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { collection, query, getDocs, doc, setDoc, deleteDoc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { hashPassword } from '@/lib/hash';
import { useAuth, UserRole } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Loader2,
  Plus,
  Trash2,
  Edit2,
  ShieldAlert,
  Sparkles,
  Compass,
  CheckCircle2,
  ArrowLeft,
  Check,
  Building2,
  Shield,
  Eye,
  UserCheck,
  User,
  Layers,
  MapPin,
  CheckSquare,
  Square,
  Power,
  Ban,
  KeyRound,
  AlertTriangle,
  RotateCcw,
  Copy,
  FileSpreadsheet,
  Download,
  Clock,
  Calendar,
  ShieldCheck,
  ShieldX,
  Hourglass,
  Monitor,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { SiteId, COMPANY_SITES, resolveSiteId } from '@/types/site';
import { triggerHaptic } from '@/lib/haptics';
import { cn } from '@/lib/utils';
import { DeviceSession } from '@/types/audit';
import { logAuditEvent, revokeDeviceSession } from '@/services/auditService';
import { UserDeviceSessionsModal } from '@/components/admin/UserDeviceSessionsModal';
import { SecurityAuditLogTab } from '@/components/admin/SecurityAuditLogTab';
import {
  PermissionKey,
  PermissionDefinition,
  PERMISSION_CATEGORIES,
  ROLE_PRESETS,
  DEFAULT_LANDING_PAGES,
  RolePreset,
  hasPermission,
} from '@/types/permissions';

interface DbUser {
  id: string;
  email: string;
  password?: string;
  role: UserRole;
  status?: 'active' | 'suspended';
  tokenVersion?: number;
  createdAt?: string;
  suspendedAt?: string | null;
  expiresAt?: string | null;
  canDelete?: boolean;
  assignedSite?: SiteId;
  assignedSites?: SiteId[];
  preferredLocations?: string[];
  assignedApps?: string[];
  defaultLandingPage?: string;
  allowedTabs?: PermissionKey[];
  sessions?: Record<string, DeviceSession>;
  lastActiveAt?: string;
}

const ROLE_OPTIONS: Array<{
  value: UserRole;
  label: string;
  badge: string;
  badgeClass: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  {
    value: 'user',
    label: 'Standard Staff',
    badge: 'USER',
    badgeClass: 'bg-slate-100 text-slate-700 border-slate-200',
    description: 'Operational stall counter sales, stock requests, and selfie attendance check-in.',
    icon: User,
  },
  {
    value: 'manager',
    label: 'Manager / Lead',
    badge: 'MANAGER',
    badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    description: 'Stall operations, cash & UPI reconciliation, stock approvals, and dispatch oversight.',
    icon: UserCheck,
  },
  {
    value: 'admin',
    label: 'Super Admin',
    badge: 'ADMIN',
    badgeClass: 'bg-purple-100 text-purple-800 border-purple-200',
    description: 'Unrestricted master access across all sites, financial controls, and user management.',
    icon: Shield,
  },
  {
    value: 'guest',
    label: 'Guest / Auditor',
    badge: 'READ-ONLY',
    badgeClass: 'bg-amber-100 text-amber-800 border-amber-300',
    description: 'Strict view-only mode across operations & catalogs. Invoices & signed copies are blocked.',
    icon: Eye,
  },
];

const SITE_OPTIONS: Array<{
  value: SiteId;
  label: string;
  locations: string;
  description: string;
}> = [
  {
    value: 'newrelic',
    label: 'NewRelic Stall',
    locations: 'Hyderabad & Bangalore',
    description: 'Dedicated NewRelic Delivery Challans Hub enabled. Multi-city location support.',
  },
  {
    value: 'dsm',
    label: 'DSM Stall',
    locations: 'Hyderabad Stall Only',
    description: 'Tuckshop counter sales and daily staff attendance. Dedicated NewRelic DC is forbidden.',
  },
  {
    value: 'ntt_data',
    label: 'NTT Data Stall',
    locations: 'Hyderabad Stall Only',
    description: 'Tuckshop counter sales and daily staff attendance. Dedicated NewRelic DC is forbidden.',
  },
];

function deriveLegacyApps(tabs: PermissionKey[]): string[] {
  const apps = new Set<string>();
  if (
    tabs.includes('newrelic_dc') ||
    tabs.includes('newrelic_dc_create') ||
    tabs.includes('tuckshop') ||
    tabs.includes('tuckshop_pos') ||
    tabs.includes('attendance') ||
    tabs.includes('stock_request')
  ) {
    apps.add('/newrelic');
  }
  if (tabs.includes('general_dc') || tabs.includes('general_dc_create')) {
    apps.add('/delivery-challans');
  }
  if (tabs.includes('invoices') || tabs.includes('invoices_create') || tabs.includes('billing')) {
    apps.add('/invoices');
  }
  if (tabs.includes('quotations') || tabs.includes('quotations_create') || tabs.includes('billing')) {
    apps.add('/quotations');
  }
  if (tabs.includes('masters')) {
    apps.add('/invoices');
  }
  if (tabs.includes('hr_docs') || tabs.includes('hr_docs_create')) {
    apps.add('/payslip');
    apps.add('/offer-letter');
  }
  if (tabs.includes('settings')) {
    apps.add('/settings');
  }
  return Array.from(apps);
}

function deriveTabsFromApps(apps: string[] | undefined, site: SiteId | undefined): PermissionKey[] {
  if (!apps || apps.length === 0) {
    return site === 'newrelic'
      ? ['tuckshop', 'tuckshop_pos', 'attendance', 'stock_request', 'newrelic_dc', 'newrelic_dc_create', 'signed_copies']
      : ['tuckshop', 'tuckshop_pos', 'attendance', 'stock_request'];
  }
  const tabs = new Set<PermissionKey>();
  if (apps.includes('/newrelic')) {
    tabs.add('tuckshop');
    tabs.add('tuckshop_pos');
    tabs.add('attendance');
    tabs.add('stock_request');
    if (site === 'newrelic') {
      tabs.add('newrelic_dc');
      tabs.add('newrelic_dc_create');
      tabs.add('signed_copies');
    }
  }
  if (apps.includes('/delivery-challans')) {
    tabs.add('general_dc');
    tabs.add('general_dc_create');
    tabs.add('signed_copies');
  }
  if (apps.includes('/invoices')) {
    tabs.add('invoices');
    tabs.add('invoices_create');
    tabs.add('billing');
    tabs.add('masters');
  }
  if (apps.includes('/quotations')) {
    tabs.add('quotations');
    tabs.add('quotations_create');
    tabs.add('billing');
  }
  if (apps.includes('/payslip') || apps.includes('/offer-letter')) {
    tabs.add('hr_docs');
    tabs.add('hr_docs_create');
  }
  if (apps.includes('/settings')) {
    tabs.add('settings');
  }
  return Array.from(tabs);
}

function toDatetimeLocalValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const y = date.getFullYear();
  const m = pad(date.getMonth() + 1);
  const d = pad(date.getDate());
  const hh = pad(date.getHours());
  const mm = pad(date.getMinutes());
  return `${y}-${m}-${d}T${hh}:${mm}`;
}

export default function AdminUsersPage() {
  const { user, role, loading, startSimulation, isSimulating } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [users, setUsers] = useState<DbUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<DbUser | null>(null);

  // Form states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [userRole, setUserRole] = useState<UserRole>('user');
  const [accountStatus, setAccountStatus] = useState<'active' | 'suspended'>('active');
  const [assignedSite, setAssignedSite] = useState<SiteId>('newrelic');
  const [assignedSites, setAssignedSites] = useState<SiteId[]>(['newrelic']);
  const [preferredLocations, setPreferredLocations] = useState<string[]>([]);
  const [defaultLandingPage, setDefaultLandingPage] = useState<string>('/newrelic/tuckshop');
  const [allowedTabs, setAllowedTabs] = useState<PermissionKey[]>([
    'tuckshop',
    'tuckshop_pos',
    'attendance',
    'stock_request',
  ]);
  const [expiresAt, setExpiresAt] = useState<string>('');
  const [expirationPreset, setExpirationPreset] = useState<'permanent' | '24h' | '7d' | '30d' | 'custom'>('permanent');
  const [canDeleteRecord, setCanDeleteRecord] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isExportingMatrix, setIsExportingMatrix] = useState(false);
  const [selectedCloneSourceId, setSelectedCloneSourceId] = useState<string>('');

  // Quick Action confirmation modal state
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    type: 'suspend' | 'activate' | 'revoke';
    targetUser: DbUser | null;
  }>({
    isOpen: false,
    type: 'suspend',
    targetUser: null,
  });
  const [isActionLoading, setIsActionLoading] = useState(false);

  // View Mode: 'accounts' | 'audit_log'
  const [activeAdminTab, setActiveAdminTab] = useState<'accounts' | 'audit_log'>('accounts');

  // Device Sessions Modal state
  const [selectedUserForDevices, setSelectedUserForDevices] = useState<DbUser | null>(null);

  const handleRevokeDeviceSession = async (
    targetUserId: string,
    sessionId: string,
    targetEmail: string
  ) => {
    try {
      await revokeDeviceSession(targetUserId, sessionId, user?.email || 'admin', targetEmail);
      toast({
        title: 'Device Session Terminated',
        description: `Successfully revoked device login for ${targetEmail}.`,
      });
      await loadUsers();
      setSelectedUserForDevices((prev) => {
        if (!prev || prev.id !== targetUserId) return prev;
        const currentSessions = { ...(prev.sessions || {}) };
        if (currentSessions[sessionId]) {
          currentSessions[sessionId] = {
            ...currentSessions[sessionId],
            revoked: true,
            revokedAt: new Date().toISOString(),
            revokedBy: user?.email || 'admin',
          };
        }
        return { ...prev, sessions: currentSessions };
      });
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Failed to revoke device session',
        description: err.message,
      });
    }
  };

  const handleRevokeAllSessionsFromModal = async (targetUserId: string, targetEmail: string) => {
    try {
      const userRef = doc(db, 'users', targetUserId);
      const target = users.find((u) => u.id === targetUserId);
      const nextVersion = (target?.tokenVersion || 1) + 1;
      const updatedSessions: Record<string, DeviceSession> = {};
      if (target?.sessions) {
        Object.entries(target.sessions).forEach(([sid, sess]) => {
          updatedSessions[sid] = {
            ...sess,
            revoked: true,
            revokedAt: new Date().toISOString(),
            revokedBy: user?.email || 'admin',
          };
        });
      }

      await updateDoc(userRef, {
        tokenVersion: nextVersion,
        sessions: updatedSessions,
      });

      await logAuditEvent({
        actorEmail: user?.email || 'admin',
        actorRole: role || 'admin',
        action: 'sessions_revoked',
        actionLabel: 'Revoked All Active Devices & Sessions',
        targetType: 'user',
        targetId: targetUserId,
        targetLabel: targetEmail,
        details: { newVersion: nextVersion, revokedDevicesCount: Object.keys(updatedSessions).length },
      });

      toast({
        title: 'All Active Devices Revoked',
        description: `Terminated all active logins for ${targetEmail}.`,
      });
      await loadUsers();
      setSelectedUserForDevices(null);
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Failed to revoke sessions',
        description: err.message,
      });
    }
  };

  useEffect(() => {
    if (!loading && role !== 'admin') {
      router.push('/newrelic');
    }
  }, [loading, role, router]);

  const loadUsers = async () => {
    setIsLoading(true);
    try {
      const q = query(collection(db, 'users'));
      const snapshot = await getDocs(q);
      const fetchedUsers: DbUser[] = snapshot.docs.map((docSnap) => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          ...data,
          status: data.status || 'active',
          tokenVersion: data.tokenVersion || 1,
          suspendedAt: data.suspendedAt || null,
          expiresAt: data.expiresAt || null,
          canDelete: data.canDelete === true || data.allowedTabs?.includes('can_delete') || false,
          assignedSite: resolveSiteId(data.assignedSite),
          assignedSites: Array.isArray(data.assignedSites) && data.assignedSites.length > 0
            ? data.assignedSites
            : [resolveSiteId(data.assignedSite)],
          sessions: data.sessions || {},
          lastActiveAt: data.lastActiveAt || null,
        };
      }) as DbUser[];
      setUsers(fetchedUsers);
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Failed to load users', description: err.message });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (role === 'admin') {
      loadUsers();
    }
  }, [role]);

  const handleSiteToggle = (newSite: SiteId) => {
    setAssignedSites((prev) => {
      let next: SiteId[];
      if (prev.includes(newSite)) {
        if (prev.length === 1) return prev; // Keep at least one site selected
        next = prev.filter((s) => s !== newSite);
      } else {
        next = [...prev, newSite];
      }
      const primary = next[0] || 'newrelic';
      setAssignedSite(primary);
      const hasNewRelic = next.includes('newrelic');
      if (!hasNewRelic) {
        setPreferredLocations(['hyderabad']);
        setAllowedTabs((curr) => curr.filter((t) => t !== 'newrelic_dc' && t !== 'newrelic_dc_create'));
        if (defaultLandingPage === '/newrelic') {
          setDefaultLandingPage('/newrelic/tuckshop');
        }
      }
      return next;
    });
  };

  const handleApplyPreset = (preset: RolePreset) => {
    let tabs = [...preset.tabs];
    let landing = preset.defaultPage;

    if (assignedSite !== 'newrelic') {
      tabs = tabs.filter((t) => t !== 'newrelic_dc' && t !== 'newrelic_dc_create');
      if (landing === '/newrelic') {
        landing = '/newrelic/tuckshop';
      }
    }

    setAllowedTabs(tabs);
    setDefaultLandingPage(landing);

    if (preset.id === 'full_admin') {
      setUserRole('admin');
    } else if (preset.id === 'store_manager') {
      setUserRole('manager');
    } else if (preset.id === 'guest_auditor') {
      setUserRole('guest');
    }

    toast({
      title: `Preset Applied: ${preset.name}`,
      description: `Default landing page set to ${landing}`,
    });
  };

  const handleToggleTab = (tabId: PermissionKey, checked: boolean) => {
    if (checked) {
      setAllowedTabs((prev) => (prev.includes(tabId) ? prev : [...prev, tabId]));
    } else {
      setAllowedTabs((prev) => prev.filter((t) => t !== tabId));
    }
  };

  const handleToggleCategory = (categoryItems: PermissionDefinition[], checked: boolean) => {
    triggerHaptic('light');
    const validItemIds = categoryItems
      .filter((item) => !(item.newRelicOnly && assignedSite !== 'newrelic'))
      .map((item) => item.id);

    if (checked) {
      setAllowedTabs((prev) => Array.from(new Set([...prev, ...validItemIds])));
    } else {
      setAllowedTabs((prev) => prev.filter((id) => !validItemIds.includes(id)));
    }
  };

  const handleExtendAccess = async (targetUser: DbUser, days: number = 7) => {
    triggerHaptic('medium');
    try {
      const baseTime =
        targetUser.expiresAt && new Date(targetUser.expiresAt).getTime() > Date.now()
          ? new Date(targetUser.expiresAt).getTime()
          : Date.now();
      const newExpiry = new Date(baseTime + days * 86400000).toISOString();
      await updateDoc(doc(db, 'users', targetUser.id), {
        expiresAt: newExpiry,
      });
      toast({
        title: `Access Extended (+${days} Days)`,
        description: `Extended ${targetUser.email} until ${new Date(newExpiry).toLocaleDateString('en-IN', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })}.`,
      });
      await loadUsers();
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Failed to extend access',
        description: err.message,
      });
    }
  };

  const handleSelectExpirationPreset = (preset: 'permanent' | '24h' | '7d' | '30d' | 'custom') => {
    setExpirationPreset(preset);
    if (preset === 'permanent') {
      setExpiresAt('');
    } else if (preset === '24h') {
      const d = new Date(Date.now() + 24 * 3600 * 1000);
      setExpiresAt(toDatetimeLocalValue(d));
    } else if (preset === '7d') {
      const d = new Date(Date.now() + 7 * 24 * 3600 * 1000);
      setExpiresAt(toDatetimeLocalValue(d));
    } else if (preset === '30d') {
      const d = new Date(Date.now() + 30 * 24 * 3600 * 1000);
      setExpiresAt(toDatetimeLocalValue(d));
    }
  };

  const handleOpenModal = (userToEdit?: DbUser) => {
    if (userToEdit) {
      setEditingUser(userToEdit);
      setEmail(userToEdit.email);
      setPassword(''); // keep blank for editing
      setUserRole(userToEdit.role);
      setAccountStatus(userToEdit.status || 'active');
      const sites: SiteId[] = Array.isArray(userToEdit.assignedSites) && userToEdit.assignedSites.length > 0
        ? userToEdit.assignedSites
        : [userToEdit.assignedSite || 'newrelic'];
      setAssignedSites(sites);
      const site = sites[0] || 'newrelic';
      setAssignedSite(site);
      setPreferredLocations(
        userToEdit.preferredLocations || (site !== 'newrelic' ? ['hyderabad'] : [])
      );

      const userTabs =
        userToEdit.allowedTabs && userToEdit.allowedTabs.length > 0
          ? userToEdit.allowedTabs
          : deriveTabsFromApps(userToEdit.assignedApps, site);

      setAllowedTabs(userTabs);
      setDefaultLandingPage(
        userToEdit.defaultLandingPage ||
          (site === 'newrelic' ? '/newrelic' : '/newrelic/tuckshop')
      );
      if (userToEdit.expiresAt) {
        setExpiresAt(toDatetimeLocalValue(new Date(userToEdit.expiresAt)));
        setExpirationPreset('custom');
      } else {
        setExpiresAt('');
        setExpirationPreset('permanent');
      }
      setCanDeleteRecord(
        userToEdit.role === 'admin'
          ? true
          : userToEdit.role === 'guest'
          ? false
          : userToEdit.canDelete === true || userTabs.includes('can_delete') || false
      );
    } else {
      setEditingUser(null);
      setEmail('');
      setPassword('');
      setUserRole('manager');
      setAccountStatus('active');
      setAssignedSite('newrelic');
      setAssignedSites(['newrelic']);
      setPreferredLocations(['hyderabad']);
      setDefaultLandingPage('/newrelic/tuckshop');
      setAllowedTabs(['tuckshop', 'tuckshop_pos', 'attendance', 'stock_request']);
      setExpiresAt('');
      setExpirationPreset('permanent');
      setCanDeleteRecord(false);
    }
    setIsModalOpen(true);
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const effectiveSites = userRole === 'admin' ? ['newrelic', 'dsm', 'ntt_data'] : assignedSites.length > 0 ? assignedSites : [assignedSite];
      const effectiveSite = effectiveSites[0] || 'newrelic';
      const hasNewRelic = effectiveSites.includes('newrelic') || userRole === 'admin';
      const effectiveLocations = !hasNewRelic ? ['hyderabad'] : preferredLocations;

      // Filter out newrelic_dc if no newrelic site assigned
      let effectiveTabs = !hasNewRelic
        ? allowedTabs.filter((t) => t !== 'newrelic_dc' && t !== 'newrelic_dc_create')
        : allowedTabs;

      // Strict enforcement: guest account cannot have invoice or signed copies permissions, or can_delete
      if (userRole === 'guest') {
        effectiveTabs = effectiveTabs.filter(
          (t) =>
            t !== 'invoices' &&
            t !== 'invoices_create' &&
            t !== 'billing' &&
            t !== 'signed_copies' &&
            t !== 'users_admin' &&
            t !== 'can_delete'
        );
      } else if (userRole === 'admin') {
        if (!effectiveTabs.includes('can_delete')) {
          effectiveTabs.push('can_delete');
        }
      } else {
        if (canDeleteRecord && !effectiveTabs.includes('can_delete')) {
          effectiveTabs.push('can_delete');
        } else if (!canDeleteRecord && effectiveTabs.includes('can_delete')) {
          effectiveTabs = effectiveTabs.filter((t) => t !== 'can_delete');
        }
      }

      const effectiveCanDelete = userRole === 'admin' ? true : userRole === 'guest' ? false : canDeleteRecord;
      const effectiveExpiresAt = expiresAt ? new Date(expiresAt).toISOString() : null;

      // Sync legacy assignedApps for full backwards-compatibility
      const legacyApps = deriveLegacyApps(effectiveTabs);

      if (editingUser) {
        // Prevent admin from accidentally suspending their own account
        const finalStatus = editingUser.email === user?.email ? 'active' : accountStatus;
        const statusChanged = (editingUser.status || 'active') !== finalStatus;
        const isNowSuspended = finalStatus === 'suspended';

        // Edit existing
        const updateData: any = {
          role: userRole,
          status: finalStatus,
          assignedSite: effectiveSite,
          assignedSites: effectiveSites,
          preferredLocations: effectiveLocations,
          defaultLandingPage: defaultLandingPage,
          allowedTabs: effectiveTabs,
          assignedApps: legacyApps,
          expiresAt: effectiveExpiresAt,
          canDelete: effectiveCanDelete,
        };

        // If status changed or account is suspended, bump tokenVersion to immediately kill all active client sessions!
        if (isNowSuspended || statusChanged) {
          updateData.tokenVersion = (editingUser.tokenVersion || 1) + 1;
        }

        if (isNowSuspended && editingUser.status !== 'suspended') {
          updateData.suspendedAt = new Date().toISOString();
        } else if (!isNowSuspended) {
          updateData.suspendedAt = null;
        }

        if (password.trim() !== '') {
          updateData.password = hashPassword(password);
        }
        await updateDoc(doc(db, 'users', editingUser.id), updateData);
        await logAuditEvent({
          actorEmail: user?.email || 'admin',
          actorRole: role || 'admin',
          action: 'user_updated',
          actionLabel: 'Updated User Account & Permissions',
          targetType: 'user',
          targetId: editingUser.id,
          targetLabel: editingUser.email,
          details: {
            role: userRole,
            site: effectiveSite,
            status: accountStatus,
            canDelete: effectiveCanDelete,
            endpointsCount: effectiveTabs.length,
          },
        });
        toast({ title: 'User updated successfully' });
      } else {
        // Create new
        const newEmail = email.toLowerCase().trim();
        const q = query(collection(db, 'users'));
        const allUsers = await getDocs(q);
        if (allUsers.docs.some((d) => d.data().email === newEmail)) {
          throw new Error('Email already exists');
        }

        const newDocRef = doc(collection(db, 'users'));
        await setDoc(newDocRef, {
          email: newEmail,
          password: hashPassword(password),
          role: userRole,
          status: accountStatus,
          tokenVersion: 1,
          suspendedAt: accountStatus === 'suspended' ? new Date().toISOString() : null,
          expiresAt: effectiveExpiresAt,
          canDelete: effectiveCanDelete,
          assignedSite: effectiveSite,
          assignedSites: effectiveSites,
          preferredLocations: effectiveLocations,
          defaultLandingPage: defaultLandingPage,
          allowedTabs: effectiveTabs,
          assignedApps: legacyApps,
          createdAt: new Date().toISOString(),
        });
        await logAuditEvent({
          actorEmail: user?.email || 'admin',
          actorRole: role || 'admin',
          action: 'user_created',
          actionLabel: 'Created User Account',
          targetType: 'user',
          targetId: newDocRef.id,
          targetLabel: newEmail,
          details: {
            role: userRole,
            site: effectiveSite,
            status: accountStatus,
            canDelete: effectiveCanDelete,
            endpointsCount: effectiveTabs.length,
            accessExpiry: effectiveExpiresAt || 'Permanent',
          },
        });
        toast({ title: 'User created successfully' });
      }
      setIsModalOpen(false);
      loadUsers();
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Error saving user', description: err.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePromptToggleStatus = (targetUser: DbUser) => {
    if (targetUser.email === user?.email) {
      toast({
        variant: 'destructive',
        title: 'Action Prohibited',
        description: 'You cannot change your own account status.',
      });
      return;
    }
    const isCurrentlySuspended = targetUser.status === 'suspended';
    setConfirmModal({
      isOpen: true,
      type: isCurrentlySuspended ? 'activate' : 'suspend',
      targetUser,
    });
  };

  const handlePromptRevokeSessions = (targetUser: DbUser) => {
    if (targetUser.email === user?.email) {
      toast({
        variant: 'destructive',
        title: 'Action Prohibited',
        description: 'You cannot revoke your own active session from this panel.',
      });
      return;
    }
    setConfirmModal({
      isOpen: true,
      type: 'revoke',
      targetUser,
    });
  };

  const handleExecuteConfirmAction = async () => {
    if (!confirmModal.targetUser) return;
    setIsActionLoading(true);
    triggerHaptic('medium');

    try {
      const target = confirmModal.targetUser;
      const userRef = doc(db, 'users', target.id);

      if (confirmModal.type === 'suspend') {
        const nextVersion = (target.tokenVersion || 1) + 1;
        await updateDoc(userRef, {
          status: 'suspended',
          tokenVersion: nextVersion,
          suspendedAt: new Date().toISOString(),
        });
        await logAuditEvent({
          actorEmail: user?.email || 'admin',
          actorRole: role || 'admin',
          action: 'user_status_changed',
          actionLabel: 'Suspended Account (All Sessions Killed)',
          targetType: 'user',
          targetId: target.id,
          targetLabel: target.email,
          details: { status: 'suspended', tokenVersion: nextVersion },
        });
        toast({
          title: 'Account Suspended',
          description: `All active sessions for ${target.email} have been terminated immediately.`,
        });
      } else if (confirmModal.type === 'activate') {
        await updateDoc(userRef, {
          status: 'active',
          suspendedAt: null,
        });
        await logAuditEvent({
          actorEmail: user?.email || 'admin',
          actorRole: role || 'admin',
          action: 'user_status_changed',
          actionLabel: 'Activated User Account',
          targetType: 'user',
          targetId: target.id,
          targetLabel: target.email,
          details: { status: 'active' },
        });
        toast({
          title: 'Account Activated',
          description: `${target.email} is now active and can sign in.`,
        });
      } else if (confirmModal.type === 'revoke') {
        const nextVersion = (target.tokenVersion || 1) + 1;
        await updateDoc(userRef, {
          tokenVersion: nextVersion,
        });
        await logAuditEvent({
          actorEmail: user?.email || 'admin',
          actorRole: role || 'admin',
          action: 'sessions_revoked',
          actionLabel: 'Revoked Active Sessions (Forced Logout)',
          targetType: 'user',
          targetId: target.id,
          targetLabel: target.email,
          details: { tokenVersion: nextVersion },
        });
        toast({
          title: 'Active Sessions Revoked',
          description: `Terminated all active desktop and mobile sessions for ${target.email}.`,
        });
      }

      setConfirmModal({ isOpen: false, type: 'suspend', targetUser: null });
      await loadUsers();
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Action Failed',
        description: err.message,
      });
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleDelete = async (id: string, userEmail: string) => {
    if (user?.email === userEmail) {
      toast({ variant: 'destructive', title: 'Cannot delete yourself' });
      return;
    }
    if (confirm(`Are you sure you want to delete ${userEmail}?`)) {
      try {
        await deleteDoc(doc(db, 'users', id));
        await logAuditEvent({
          actorEmail: user?.email || 'admin',
          actorRole: role || 'admin',
          action: 'user_deleted',
          actionLabel: 'Permanently Deleted User Account',
          targetType: 'user',
          targetId: id,
          targetLabel: userEmail,
        });
        toast({ title: 'User deleted' });
        loadUsers();
      } catch (err: any) {
        toast({ variant: 'destructive', title: 'Error deleting user', description: err.message });
      }
    }
  };

  const handleCloneUser = (sourceUser: DbUser) => {
    triggerHaptic('medium');
    setEditingUser(null);
    setEmail('');
    setPassword('');
    setUserRole(sourceUser.role);
    setAccountStatus('active');
    const sites: SiteId[] = Array.isArray(sourceUser.assignedSites) && sourceUser.assignedSites.length > 0
      ? sourceUser.assignedSites
      : [sourceUser.assignedSite || 'newrelic'];
    setAssignedSites(sites);
    const site = sites[0] || 'newrelic';
    setAssignedSite(site);
    setPreferredLocations(
      sourceUser.preferredLocations || (site !== 'newrelic' ? ['hyderabad'] : [])
    );

    const userTabs =
      sourceUser.allowedTabs && sourceUser.allowedTabs.length > 0
        ? [...sourceUser.allowedTabs]
        : deriveTabsFromApps(sourceUser.assignedApps, site);

    setAllowedTabs(userTabs);
    setDefaultLandingPage(
      sourceUser.defaultLandingPage ||
        (site === 'newrelic' ? '/newrelic' : '/newrelic/tuckshop')
    );
    setSelectedCloneSourceId(sourceUser.id);
    setCanDeleteRecord(
      sourceUser.role === 'admin'
        ? true
        : sourceUser.role === 'guest'
        ? false
        : sourceUser.canDelete === true || userTabs.includes('can_delete') || false
    );
    setIsModalOpen(true);

    logAuditEvent({
      actorEmail: user?.email || 'admin',
      actorRole: role || 'admin',
      action: 'permissions_cloned',
      actionLabel: 'Cloned Permissions From User',
      targetType: 'user',
      targetId: sourceUser.id,
      targetLabel: sourceUser.email,
      details: {
        sourceRole: sourceUser.role,
        clonedEndpointsCount: userTabs.length,
      },
    });

    toast({
      title: 'Permissions Cloned!',
      description: `Pre-filled role (${sourceUser.role.toUpperCase()}), stall scope, and ${userTabs.length} permissions from ${sourceUser.email}. Enter email and password to create the new account.`,
    });
  };

  const handleApplyCloneFromUser = (sourceUserId: string) => {
    if (!sourceUserId) return;
    const sourceUser = users.find((u) => u.id === sourceUserId);
    if (!sourceUser) return;

    triggerHaptic('medium');
    setUserRole(sourceUser.role);
    const sites: SiteId[] = Array.isArray(sourceUser.assignedSites) && sourceUser.assignedSites.length > 0
      ? sourceUser.assignedSites
      : [sourceUser.assignedSite || 'newrelic'];
    setAssignedSites(sites);
    const site = sites[0] || 'newrelic';
    setAssignedSite(site);
    setPreferredLocations(
      sourceUser.preferredLocations || (site !== 'newrelic' ? ['hyderabad'] : [])
    );

    const userTabs =
      sourceUser.allowedTabs && sourceUser.allowedTabs.length > 0
        ? [...sourceUser.allowedTabs]
        : deriveTabsFromApps(sourceUser.assignedApps, site);

    setAllowedTabs(userTabs);
    setDefaultLandingPage(
      sourceUser.defaultLandingPage ||
        (site === 'newrelic' ? '/newrelic' : '/newrelic/tuckshop')
    );
    setSelectedCloneSourceId(sourceUserId);
    setCanDeleteRecord(
      sourceUser.role === 'admin'
        ? true
        : sourceUser.role === 'guest'
        ? false
        : sourceUser.canDelete === true || userTabs.includes('can_delete') || false
    );

    toast({
      title: 'Permissions Copied!',
      description: `Copied role (${sourceUser.role.toUpperCase()}), stall (${COMPANY_SITES[site]?.name || site}), and ${userTabs.length} endpoints from ${sourceUser.email}.`,
    });
  };

  const handleStartSimulation = (targetUser: DbUser) => {
    triggerHaptic('medium');
    startSimulation(targetUser as any);
    toast({
      title: 'Simulation Mode Active',
      description: `Now viewing the application as ${targetUser.email} (${targetUser.role.toUpperCase()}).`,
    });
    const destination = targetUser.defaultLandingPage || '/newrelic/tuckshop';
    router.push(destination);
  };

  const handleExportAccessMatrix = () => {
    try {
      setIsExportingMatrix(true);
      triggerHaptic('medium');

      // 1. Gather all granular permissions from PERMISSION_CATEGORIES
      const flatPermissions: Array<{
        category: string;
        id: PermissionKey;
        label: string;
        route: string;
        newRelicOnly?: boolean;
      }> = [];

      PERMISSION_CATEGORIES.forEach((cat) => {
        cat.items.forEach((item) => {
          flatPermissions.push({
            category: cat.name,
            id: item.id,
            label: item.label,
            route: item.route,
            newRelicOnly: item.newRelicOnly,
          });
        });
      });

      // 2. Sheet 1: Comprehensive User Access Matrix
      const matrixRows = users.map((u, idx) => {
        const landingPageObj = DEFAULT_LANDING_PAGES.find(
          (p) => p.path === u.defaultLandingPage
        );
        const landingLabel = landingPageObj
          ? landingPageObj.label.split('(')[0].trim()
          : u.defaultLandingPage || '/newrelic/tuckshop';

        const row: Record<string, string | number> = {
          'S.No': idx + 1,
          'User Email': u.email,
          'Account Status': (u.status || 'active').toUpperCase(),
          'Access Expiry': u.expiresAt
            ? new Date(u.expiresAt).getTime() <= Date.now()
              ? `EXPIRED (${new Date(u.expiresAt).toLocaleString('en-IN')})`
              : `Active until ${new Date(u.expiresAt).toLocaleString('en-IN')}`
            : 'Permanent Access',
          'Delete Clearance':
            u.role === 'admin'
              ? 'ALLOWED (Admin)'
              : u.role === 'guest'
              ? 'BLOCKED (Guest)'
              : (u.canDelete || u.allowedTabs?.includes('can_delete'))
              ? 'GRANTED (can_delete)'
              : 'PROTECTED (No Delete)',
          'Role Tier':
            u.role === 'admin'
              ? 'SUPER ADMIN'
              : u.role === 'manager'
              ? 'MANAGER'
              : u.role === 'guest'
              ? 'GUEST (READ-ONLY)'
              : 'STAFF USER',
          'Assigned Stall Site':
            u.role === 'admin'
              ? 'All Sites (Multi-Site)'
              : COMPANY_SITES[u.assignedSite || 'newrelic']?.name || 'NewRelic',
          'Preferred Locations': (u.preferredLocations || []).join(', ') || 'Default',
          'Default Landing Page': landingLabel,
        };

        let permittedCount = 0;

        flatPermissions.forEach((perm) => {
          const colHeader = `[${perm.category.split('(')[0].trim()}] ${perm.label}`;
          const allowed = hasPermission(u as any, perm.id);

          if (u.role === 'admin') {
            row[colHeader] = 'YES (Admin)';
            permittedCount++;
          } else if (
            u.role === 'guest' &&
            (perm.id === 'invoices' ||
              perm.id === 'invoices_create' ||
              perm.id === 'billing' ||
              perm.id === 'signed_copies' ||
              perm.id === 'users_admin' ||
              perm.id === 'can_delete')
          ) {
            row[colHeader] = 'RESTRICTED (Guest)';
          } else if (
            perm.newRelicOnly &&
            (u.assignedSite === 'dsm' || u.assignedSite === 'ntt_data')
          ) {
            row[colHeader] = 'BLOCKED (Site Scoped)';
          } else if (allowed) {
            row[colHeader] = 'YES';
            permittedCount++;
          } else {
            row[colHeader] = 'NO';
          }
        });

        row['Total Permitted Endpoints'] =
          u.role === 'admin'
            ? 'All (Unrestricted)'
            : `${permittedCount} / ${flatPermissions.length}`;

        return row;
      });

      // 3. Sheet 2: User Accounts Audit Summary
      const auditRows = users.map((u, idx) => ({
        'S.No': idx + 1,
        'Email Address': u.email,
        'Role': u.role.toUpperCase(),
        'Account Status': (u.status || 'active').toUpperCase(),
        'Access Expiration': u.expiresAt ? new Date(u.expiresAt).toLocaleString('en-IN') : 'Permanent',
        'Delete Clearance':
          u.role === 'admin' || ((u.canDelete || u.allowedTabs?.includes('can_delete')) && u.role !== 'guest')
            ? 'YES'
            : 'NO',
        'Assigned Site':
          u.role === 'admin'
            ? 'All Sites'
            : COMPANY_SITES[u.assignedSite || 'newrelic']?.name || 'NewRelic',
        'Preferred Locations': (u.preferredLocations || []).join(', ') || 'All / Auto',
        'Landing Page': u.defaultLandingPage || '/newrelic/tuckshop',
        'Allowed Tabs Count':
          u.role === 'admin'
            ? 'Full Access'
            : u.allowedTabs?.length || u.assignedApps?.length || 0,
        'Session Token Version': u.tokenVersion || 1,
        'Suspended At': u.suspendedAt || 'N/A',
        'Account Created At': u.createdAt || 'N/A',
      }));

      // 4. Sheet 3: Permission Catalog Guide
      const catalogRows = flatPermissions.map((perm, idx) => ({
        'S.No': idx + 1,
        'Category': perm.category,
        'Permission Key': perm.id,
        'Feature Name': perm.label,
        'Route': perm.route,
        'Site Scoped (NewRelic Only)': perm.newRelicOnly
          ? 'YES (Forbidden for DSM & NTT Data)'
          : 'NO (Universal)',
      }));

      // Create Workbook and Sheets
      const wb = XLSX.utils.book_new();

      const wsMatrix = XLSX.utils.json_to_sheet(matrixRows);
      const wsAudit = XLSX.utils.json_to_sheet(auditRows);
      const wsCatalog = XLSX.utils.json_to_sheet(catalogRows);

      // Auto-size columns for readability in Excel
      const setColWidths = (ws: any, rows: any[]) => {
        if (!rows || rows.length === 0) return;
        const colKeys = Object.keys(rows[0]);
        ws['!cols'] = colKeys.map((key) => {
          let maxLen = key.length;
          rows.forEach((r) => {
            const val = r[key] ? String(r[key]) : '';
            if (val.length > maxLen) maxLen = Math.min(val.length, 50);
          });
          return { wch: Math.max(maxLen + 3, 12) };
        });
      };

      setColWidths(wsMatrix, matrixRows);
      setColWidths(wsAudit, auditRows);
      setColWidths(wsCatalog, catalogRows);

      XLSX.utils.book_append_sheet(wb, wsMatrix, 'Access Matrix');
      XLSX.utils.book_append_sheet(wb, wsAudit, 'User Security Audit');
      XLSX.utils.book_append_sheet(wb, wsCatalog, 'Permission Catalog');

      const dateStr = new Date().toISOString().split('T')[0];
      const filename = `TheGutGuru_Access_Matrix_${dateStr}.xlsx`;
      XLSX.writeFile(wb, filename);

      logAuditEvent({
        actorEmail: user?.email || 'admin',
        actorRole: role || 'admin',
        action: 'access_matrix_exported',
        actionLabel: 'Exported Access Matrix Spreadsheet',
        targetType: 'system',
        details: { usersCount: users.length, filename },
      });

      toast({
        title: 'Access Matrix Exported!',
        description: `Exported complete 3-sheet audit report: ${filename}`,
      });
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Export Failed',
        description: err.message,
      });
    } finally {
      setIsExportingMatrix(false);
    }
  };

  if (loading || role !== 'admin') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="animate-spin h-8 w-8 text-[#3b2fc9]" />
      </div>
    );
  }

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-8 py-4 sm:py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                triggerHaptic('light');
                router.back();
              }}
              className="sm:hidden p-2 -ml-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors active:scale-95"
              aria-label="Go back"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-500/10 dark:bg-purple-400/10 border border-purple-500/20 text-purple-600 dark:text-purple-400 text-[10px] sm:text-xs font-black tracking-widest uppercase">
              <Sparkles className="h-3 w-3" />
              <span>Access & Security</span>
            </div>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
            User Management & Permissions
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            Configure granular endpoint permissions, stall scoping, allowed tabs, and default landing page after login.
          </p>
        </div>
        <div className="flex items-center gap-2.5 w-full sm:w-auto">
          <Button
            type="button"
            onClick={handleExportAccessMatrix}
            disabled={isExportingMatrix || isLoading || users.length === 0}
            className="flex-1 sm:flex-initial h-11 sm:h-10 px-4 rounded-2xl sm:rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-bold shadow-md shadow-emerald-600/20 flex items-center justify-center gap-2 active:scale-95 transition-all"
            title="Download multi-sheet Excel spreadsheet of all user permissions"
          >
            {isExportingMatrix ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <FileSpreadsheet className="h-4 w-4" />
            )}
            <span>Export Access Matrix</span>
          </Button>

          <Button
            type="button"
            onClick={() => {
              triggerHaptic('medium');
              handleOpenModal();
            }}
            className="flex-1 sm:flex-initial h-11 sm:h-10 px-5 rounded-2xl sm:rounded-xl bg-gradient-to-r from-[#3b2fc9] to-indigo-600 hover:from-[#2d23a0] hover:to-indigo-700 text-white text-xs sm:text-sm font-bold shadow-md shadow-indigo-500/20 flex items-center justify-center gap-2 active:scale-95 transition-all"
          >
            <Plus className="h-4 w-4" />
            <span>Add User</span>
          </Button>
        </div>
      </div>

      {/* Primary Navigation Switcher: User Accounts vs Security & Audit Log */}
      <div className="flex items-center p-1.5 bg-slate-100 dark:bg-slate-800/80 rounded-2xl w-fit border border-slate-200/80 dark:border-slate-700/80 shadow-2xs">
        <button
          type="button"
          onClick={() => {
            triggerHaptic('light');
            setActiveAdminTab('accounts');
          }}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all",
            activeAdminTab === 'accounts'
              ? "bg-white dark:bg-slate-900 text-indigo-700 dark:text-indigo-300 shadow-sm"
              : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
          )}
        >
          <User className="w-4 h-4" />
          <span>User Accounts ({users.length})</span>
        </button>

        <button
          type="button"
          onClick={() => {
            triggerHaptic('light');
            setActiveAdminTab('audit_log');
          }}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all",
            activeAdminTab === 'audit_log'
              ? "bg-white dark:bg-slate-900 text-indigo-700 dark:text-indigo-300 shadow-sm"
              : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
          )}
        >
          <Shield className="w-4 h-4" />
          <span>Security & Audit Log</span>
        </button>
      </div>

      {activeAdminTab === 'audit_log' ? (
        <SecurityAuditLogTab />
      ) : (
        <>
          {/* Mobile Card List View (md:hidden) */}
          <div className="md:hidden space-y-3">
        {isLoading ? (
          <div className="p-8 text-center text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
            <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2 text-[#3b2fc9]" />
            <p className="text-xs font-medium">Loading user access accounts...</p>
          </div>
        ) : users.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-400 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
            No users found
          </div>
        ) : (
          users.map((u) => {
            const tabsCount = u.allowedTabs?.length || u.assignedApps?.length || 0;
            const landingPageLabel =
              DEFAULT_LANDING_PAGES.find((p) => p.path === u.defaultLandingPage)?.label ||
              u.defaultLandingPage ||
              '/newrelic/tuckshop';
            const isSuspended = u.status === 'suspended';

            return (
              <div
                key={u.id}
                className={cn(
                  "p-4 sm:p-5 space-y-3 bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl border shadow-xs transition-all",
                  isSuspended
                    ? "border-rose-200/80 dark:border-rose-900/40 bg-rose-500/[0.02]"
                    : "border-slate-200/80 dark:border-slate-800"
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-slate-900 dark:text-white text-sm truncate">{u.email}</p>
                    <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                      {/* Status Badge */}
                      <span
                        className={cn(
                          "px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider flex items-center gap-1 border",
                          isSuspended
                            ? "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800"
                            : "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800"
                        )}
                      >
                        <span
                          className={cn(
                            "w-1.5 h-1.5 rounded-full",
                            isSuspended ? "bg-rose-500" : "bg-emerald-500 animate-pulse"
                          )}
                        />
                        {isSuspended ? 'SUSPENDED' : 'ACTIVE'}
                      </span>

                      {/* Role Badge */}
                      <span
                        className={cn(
                          "px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider",
                          u.role === 'admin'
                            ? 'bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300'
                            : u.role === 'manager'
                            ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                            : u.role === 'guest'
                            ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-700/60'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                        )}
                      >
                        {u.role === 'guest' ? 'GUEST (READ-ONLY)' : u.role.toUpperCase()}
                      </span>

                      {/* Site Badge */}
                      {u.role === 'admin' ? (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold border bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200">
                          All Sites
                        </span>
                      ) : u.assignedSites && u.assignedSites.length > 1 ? (
                        <div className="flex flex-wrap gap-1">
                          {u.assignedSites.map((s) => (
                            <span
                              key={s}
                              className={cn(
                                "px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider border",
                                s === 'dsm'
                                  ? 'bg-cyan-50 dark:bg-cyan-950/50 text-cyan-800 dark:text-cyan-300 border-cyan-200'
                                  : s === 'ntt_data'
                                  ? 'bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 border-amber-200'
                                  : 'bg-indigo-50 dark:bg-indigo-950/50 text-[#3b2fc9] dark:text-indigo-400 border-indigo-100'
                              )}
                            >
                              {COMPANY_SITES[s]?.name || s}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span
                          className={cn(
                            "px-2.5 py-0.5 rounded-full text-[10px] font-bold border",
                            u.assignedSite === 'dsm'
                              ? 'bg-cyan-50 dark:bg-cyan-950/50 text-cyan-800 dark:text-cyan-300 border-cyan-200'
                              : u.assignedSite === 'ntt_data'
                              ? 'bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 border-amber-200'
                              : 'bg-indigo-50 dark:bg-indigo-950/50 text-[#3b2fc9] dark:text-indigo-400 border-indigo-100'
                          )}
                        >
                          {COMPANY_SITES[u.assignedSite || 'newrelic']?.name || 'NewRelic'}
                        </span>
                      )}

                      {/* Active Devices Badge */}
                      {(() => {
                        const activeDevCount = Object.values(u.sessions || {}).filter((s) => !s.revoked).length;
                        return (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              triggerHaptic('light');
                              setSelectedUserForDevices(u);
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200 transition-colors cursor-pointer"
                            title="Manage logged-in devices & sessions"
                          >
                            <Monitor className="w-3 h-3 text-slate-500" />
                            <span>{activeDevCount} Device{activeDevCount !== 1 ? 's' : ''}</span>
                          </button>
                        );
                      })()}
                    </div>
                  </div>
                  <div className="flex items-center gap-0.5 shrink-0">
                    {/* Status quick toggle */}
                    <button
                      onClick={() => {
                        triggerHaptic('medium');
                        handlePromptToggleStatus(u);
                      }}
                      disabled={u.email === user?.email}
                      className={cn(
                        "p-2 rounded-xl disabled:opacity-30 transition-all active:scale-95",
                        isSuspended
                          ? "text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
                          : "text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                      )}
                      title={
                        u.email === user?.email
                          ? 'Cannot modify your own account status'
                          : isSuspended
                          ? 'Activate Account'
                          : 'Suspend Account'
                      }
                    >
                      {isSuspended ? <Power className="h-4 w-4" /> : <Ban className="h-4 w-4" />}
                    </button>

                    {/* Manage Devices button */}
                    <button
                      onClick={() => {
                        triggerHaptic('light');
                        setSelectedUserForDevices(u);
                      }}
                      className="p-2 rounded-xl text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 transition-all active:scale-95"
                      title="Manage Active Devices & Remote Logout"
                    >
                      <Monitor className="h-4 w-4" />
                    </button>

                    {/* Revoke Sessions button */}
                    <button
                      onClick={() => {
                        triggerHaptic('medium');
                        handlePromptRevokeSessions(u);
                      }}
                      disabled={u.email === user?.email}
                      className="p-2 rounded-xl text-slate-500 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/40 disabled:opacity-30 transition-all active:scale-95"
                      title={
                        u.email === user?.email
                          ? 'Cannot revoke your own active session from here'
                          : 'Revoke Active Sessions (Forced Logout)'
                      }
                    >
                      <RotateCcw className="h-4 w-4" />
                    </button>

                    {/* Clone User Permissions button */}
                    <button
                      onClick={() => handleCloneUser(u)}
                      className="p-2 rounded-xl text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-slate-800 transition-all active:scale-95"
                      title="Clone Permissions to New User"
                    >
                      <Copy className="h-4 w-4" />
                    </button>

                    {/* Simulate / View As button */}
                    <button
                      onClick={() => handleStartSimulation(u)}
                      disabled={u.email === user?.email}
                      className="p-2 rounded-xl text-slate-500 hover:text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-950/40 disabled:opacity-30 transition-all active:scale-95"
                      title={
                        u.email === user?.email
                          ? 'You are currently logged in as this user'
                          : 'Simulate / View App As This User'
                      }
                    >
                      <Eye className="h-4 w-4" />
                    </button>

                    {/* Edit button */}
                    <button
                      onClick={() => {
                        triggerHaptic('light');
                        handleOpenModal(u);
                      }}
                      className="p-2 rounded-xl text-slate-500 hover:text-[#3b2fc9] hover:bg-indigo-50 dark:hover:bg-slate-800 transition-all active:scale-95"
                      title="Edit"
                    >
                      <Edit2 className="h-4 w-4" />
                    </button>

                    {/* Delete button */}
                    <button
                      onClick={() => {
                        triggerHaptic('medium');
                        handleDelete(u.id, u.email);
                      }}
                      disabled={u.email === user?.email}
                      className="p-2 rounded-xl text-slate-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 disabled:opacity-30 transition-all active:scale-95"
                      title="Delete"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {/* Suspended Alert banner inside card */}
                {isSuspended && (
                  <div className="p-2.5 rounded-xl bg-rose-100/70 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 flex items-center gap-2 text-rose-800 dark:text-rose-200 text-xs">
                    <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
                    <span className="font-semibold text-[11px]">
                      Account suspended — all active login sessions terminated.
                    </span>
                  </div>
                )}

                {/* Expired Alert banner inside card */}
                {!isSuspended && u.expiresAt && new Date(u.expiresAt).getTime() <= Date.now() && (
                  <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between gap-2 text-amber-900 dark:text-amber-200 text-xs">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <Clock className="w-4 h-4 text-amber-600 shrink-0" />
                      <span className="font-semibold text-[11px] truncate">
                        Access expired ({new Date(u.expiresAt).toLocaleDateString('en-IN')})
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleExtendAccess(u, 7)}
                      className="px-2 py-0.5 rounded-lg text-[10px] font-black bg-amber-600 hover:bg-amber-700 text-white shrink-0 shadow-2xs active:scale-95 cursor-pointer"
                    >
                      +7d Renew
                    </button>
                  </div>
                )}

                {/* Details Badges */}
                <div className="space-y-1.5 text-xs bg-slate-50/80 dark:bg-slate-800/50 p-3 rounded-2xl border border-slate-100 dark:border-slate-800">
                  {/* Expiration row */}
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-500 dark:text-slate-400 font-semibold flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-amber-600" /> Access Expiry
                    </span>
                    {u.expiresAt ? (
                      <div className="flex items-center gap-1.5">
                        <span
                          className={cn(
                            "font-bold",
                            new Date(u.expiresAt).getTime() <= Date.now()
                              ? "text-rose-600 dark:text-rose-400"
                              : "text-amber-700 dark:text-amber-300"
                          )}
                        >
                          {new Date(u.expiresAt).getTime() <= Date.now()
                            ? 'Expired'
                            : new Date(u.expiresAt).toLocaleDateString('en-IN', {
                                day: '2-digit',
                                month: 'short',
                                year: 'numeric',
                              })}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleExtendAccess(u, 7)}
                          className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 dark:bg-amber-900 dark:text-amber-200 shadow-2xs cursor-pointer active:scale-95"
                          title="Extend +7 Days"
                        >
                          +7d
                        </button>
                      </div>
                    ) : (
                      <span className="text-slate-600 dark:text-slate-400 font-semibold">Permanent</span>
                    )}
                  </div>

                  {/* Delete Protection row */}
                  <div className="flex items-center justify-between text-[11px] pt-1.5 border-t border-slate-200/60 dark:border-slate-700/60">
                    <span className="text-slate-500 dark:text-slate-400 font-semibold flex items-center gap-1">
                      <ShieldCheck className="w-3.5 h-3.5 text-rose-600" /> Delete Clearance
                    </span>
                    {u.role === 'admin' ? (
                      <span className="text-purple-700 dark:text-purple-400 font-bold">Admin Clearance</span>
                    ) : u.role === 'guest' ? (
                      <span className="text-rose-600 dark:text-rose-400 font-bold">Forbidden (Guest)</span>
                    ) : u.canDelete || u.allowedTabs?.includes('can_delete') ? (
                      <span className="text-emerald-700 dark:text-emerald-400 font-bold">Can Delete</span>
                    ) : (
                      <span className="text-slate-600 dark:text-slate-400 font-semibold">Protected (No Delete)</span>
                    )}
                  </div>

                  <div className="flex items-center justify-between text-[11px] pt-1.5 border-t border-slate-200/60 dark:border-slate-700/60">
                    <span className="text-slate-500 dark:text-slate-400 font-semibold flex items-center gap-1">
                      <Compass className="w-3.5 h-3.5 text-[#3b2fc9] dark:text-indigo-400" /> Default Landing
                    </span>
                    <span className="font-bold text-[#3b2fc9] dark:text-indigo-400 truncate max-w-[190px]">
                      {landingPageLabel}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] pt-1.5 border-t border-slate-200/60 dark:border-slate-700/60">
                    <span className="text-slate-500 dark:text-slate-400 font-semibold">Active Endpoints</span>
                    {u.role === 'admin' ? (
                      <span className="text-purple-700 dark:text-purple-400 font-bold">Unrestricted (All)</span>
                    ) : u.role === 'guest' ? (
                      <span className="text-amber-700 dark:text-amber-400 font-bold">Viewer (No Invoices/Signed)</span>
                    ) : (
                      <span className="font-semibold text-slate-700 dark:text-slate-300">{tabsCount} Active</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Desktop Table (hidden md:block) */}
      <div className="hidden md:block bg-white dark:bg-slate-900 rounded-3xl shadow-xs border border-slate-200/80 dark:border-slate-800 overflow-hidden">
        <div className="overflow-x-auto">
          <Table className="min-w-[1100px]">
            <TableHeader>
              <TableRow className="bg-gray-50/80 dark:bg-slate-800/60">
                <TableHead className="font-bold">Email</TableHead>
                <TableHead className="font-bold">Account Status</TableHead>
                <TableHead className="font-bold">Access Expiry</TableHead>
                <TableHead className="font-bold">Role Level</TableHead>
                <TableHead className="font-bold">Assigned Company Site</TableHead>
                <TableHead className="font-bold">Delete Clearance</TableHead>
                <TableHead className="font-bold">Default Landing Page</TableHead>
                <TableHead className="font-bold">Allowed Permissions &amp; Endpoints</TableHead>
                <TableHead className="text-right font-bold">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={9} className="h-24 text-center text-gray-500">
                    <Loader2 className="h-5 w-5 animate-spin mx-auto text-[#3b2fc9]" />
                  </TableCell>
                </TableRow>
              ) : users.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="h-24 text-center text-gray-500">
                    No users found
                  </TableCell>
                </TableRow>
              ) : (
                users.map((u) => {
                  const landingPageObj = DEFAULT_LANDING_PAGES.find(
                    (p) => p.path === u.defaultLandingPage
                  );
                  const landingLabel = landingPageObj
                    ? landingPageObj.label.split('(')[0].trim()
                    : u.defaultLandingPage || '/newrelic/tuckshop';
                  const isSuspended = u.status === 'suspended';

                  return (
                    <TableRow
                      key={u.id}
                      className={cn(
                        "hover:bg-gray-50/50 dark:hover:bg-slate-800/40 transition-colors",
                        isSuspended && "bg-rose-500/[0.02]"
                      )}
                    >
                      <TableCell className="font-bold text-gray-900 dark:text-white">
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span>{u.email}</span>
                            {u.email === user?.email && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                                You
                              </span>
                            )}
                          </div>
                          {(() => {
                            const activeDevCount = Object.values(u.sessions || {}).filter((s) => !s.revoked).length;
                            return (
                              <button
                                type="button"
                                onClick={() => setSelectedUserForDevices(u)}
                                className="mt-1 flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 hover:text-indigo-600 transition-colors cursor-pointer"
                                title="Click to view & revoke active devices"
                              >
                                <Monitor className="w-3.5 h-3.5 text-slate-400" />
                                <span>{activeDevCount} active device{activeDevCount !== 1 ? 's' : ''}</span>
                              </button>
                            );
                          })()}
                        </div>
                      </TableCell>
                      {/* Account Status Column */}
                      <TableCell>
                        <button
                          type="button"
                          onClick={() => handlePromptToggleStatus(u)}
                          disabled={u.email === user?.email}
                          title={
                            u.email === user?.email
                              ? 'Cannot modify your own account status'
                              : isSuspended
                              ? 'Click to activate account'
                              : 'Click to suspend account'
                          }
                          className={cn(
                            "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold transition-all border",
                            u.email === user?.email
                              ? "cursor-default opacity-80"
                              : "cursor-pointer hover:shadow-xs active:scale-95",
                            isSuspended
                              ? "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-800 hover:bg-rose-100"
                              : "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800 hover:bg-emerald-100"
                          )}
                        >
                          <span
                            className={cn(
                              "w-1.5 h-1.5 rounded-full",
                              isSuspended ? "bg-rose-500" : "bg-emerald-500 animate-pulse"
                            )}
                          />
                          <span>{isSuspended ? 'Suspended' : 'Active'}</span>
                          {u.email !== user?.email && (
                            isSuspended ? (
                              <Power className="w-3 h-3 ml-0.5 text-rose-600 dark:text-rose-400 opacity-60 hover:opacity-100" />
                            ) : (
                              <Ban className="w-3 h-3 ml-0.5 text-emerald-600 dark:text-emerald-400 opacity-60 hover:opacity-100" />
                            )
                          )}
                        </button>
                      </TableCell>

                      {/* Access Expiry Column */}
                      <TableCell>
                        {u.expiresAt ? (
                          (() => {
                            const isPast = new Date(u.expiresAt).getTime() <= Date.now();
                            return (
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span
                                  className={cn(
                                    "inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold border",
                                    isPast
                                      ? "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-800"
                                      : "bg-amber-50 text-amber-800 border-amber-300 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-700"
                                  )}
                                  title={new Date(u.expiresAt).toLocaleString()}
                                >
                                  {isPast ? (
                                    <Clock className="w-3 h-3 text-rose-600" />
                                  ) : (
                                    <Hourglass className="w-3 h-3 text-amber-600 animate-pulse" />
                                  )}
                                  <span>
                                    {isPast
                                      ? 'Expired'
                                      : new Date(u.expiresAt).toLocaleDateString('en-IN', {
                                          day: '2-digit',
                                          month: 'short',
                                          year: 'numeric',
                                        })}
                                  </span>
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleExtendAccess(u, 7)}
                                  className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 dark:bg-amber-900 dark:text-amber-200 dark:hover:bg-amber-800 transition-colors shadow-2xs cursor-pointer active:scale-95"
                                  title="Extend access by +7 Days"
                                >
                                  +7d
                                </button>
                              </div>
                            );
                          })()
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs text-slate-500 font-medium">
                            <Clock className="w-3.5 h-3.5 text-slate-400" />
                            <span>Permanent</span>
                          </span>
                        )}
                      </TableCell>

                      <TableCell>
                        <span
                          className={cn(
                            "px-2.5 py-0.5 rounded-full text-xs font-bold",
                            u.role === 'admin'
                              ? 'bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300'
                              : u.role === 'manager'
                              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                              : u.role === 'guest'
                              ? 'bg-amber-100 text-amber-700 border border-amber-300 dark:bg-amber-950/60 dark:text-amber-300'
                              : 'bg-gray-100 text-gray-700 dark:bg-slate-800 dark:text-slate-300'
                          )}
                        >
                          {u.role === 'guest' ? 'GUEST (READ-ONLY)' : u.role.toUpperCase()}
                        </span>
                      </TableCell>
                      <TableCell>
                        {u.role === 'admin' ? (
                          <span className="text-xs text-gray-500 font-semibold">Multi-Site (All)</span>
                        ) : u.role === 'guest' ? (
                          <span className="text-xs text-amber-700 font-semibold">Multi-Site (View Stalls)</span>
                        ) : u.assignedSites && u.assignedSites.length > 1 ? (
                          <div className="flex flex-wrap gap-1">
                            {u.assignedSites.map((s) => (
                              <span
                                key={s}
                                className={cn(
                                  "px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border",
                                  s === 'dsm'
                                    ? 'bg-cyan-50 text-cyan-700 border border-cyan-200 dark:bg-cyan-950/40 dark:text-cyan-300'
                                    : s === 'ntt_data'
                                    ? 'bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300'
                                    : 'bg-indigo-50 text-[#3b2fc9] border border-indigo-100 dark:bg-indigo-950/40 dark:text-indigo-300'
                                )}
                              >
                                {COMPANY_SITES[s]?.name || s}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span
                            className={cn(
                              "px-2.5 py-0.5 rounded-full text-xs font-bold",
                              u.assignedSite === 'dsm'
                                ? 'bg-cyan-50 text-cyan-700 border border-cyan-200 dark:bg-cyan-950/40 dark:text-cyan-300'
                                : u.assignedSite === 'ntt_data'
                                ? 'bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300'
                                : 'bg-indigo-50 text-[#3b2fc9] border border-indigo-100 dark:bg-indigo-950/40 dark:text-indigo-300'
                            )}
                          >
                            {COMPANY_SITES[u.assignedSite || 'newrelic']?.name || 'NewRelic'}
                          </span>
                        )}
                      </TableCell>

                      {/* Delete Clearance Column */}
                      <TableCell>
                        {u.role === 'admin' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-50 text-purple-700 border border-purple-200 dark:bg-purple-950/50 dark:text-purple-300 dark:border-purple-800">
                            <ShieldCheck className="w-3 h-3 text-purple-600" />
                            <span>Master Admin</span>
                          </span>
                        ) : u.role === 'guest' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-900">
                            <ShieldX className="w-3 h-3 text-rose-500" />
                            <span>Guest Blocked</span>
                          </span>
                        ) : u.canDelete || u.allowedTabs?.includes('can_delete') ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800">
                            <ShieldCheck className="w-3 h-3 text-emerald-600" />
                            <span>Can Delete</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700">
                            <Shield className="w-3 h-3 text-slate-400" />
                            <span>Protected</span>
                          </span>
                        )}
                      </TableCell>

                      <TableCell>
                        <div className="flex items-center gap-1.5 text-xs text-gray-800 dark:text-gray-200 font-medium">
                          <Compass className="w-3.5 h-3.5 text-[#3b2fc9] shrink-0" />
                          <span className="truncate max-w-[200px]" title={u.defaultLandingPage}>
                            {landingLabel}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {u.role === 'admin' ? (
                          <span className="text-xs text-purple-700 dark:text-purple-300 font-bold">Unrestricted Access</span>
                        ) : u.role === 'guest' ? (
                          <span className="text-xs text-amber-700 dark:text-amber-400 font-bold">Read-Only (Invoices &amp; Signed Hidden)</span>
                        ) : u.allowedTabs && u.allowedTabs.length > 0 ? (
                          <div className="flex items-center gap-1 flex-wrap max-w-xs">
                            <span className="px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/50 text-[#3b2fc9] dark:text-indigo-300 border border-indigo-100 dark:border-indigo-900 text-[11px] font-bold">
                              {u.allowedTabs.length} Endpoints Allowed
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs text-amber-600 font-medium">Standard Ops</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          {/* Manage Devices button */}
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setSelectedUserForDevices(u)}
                            title="Manage Active Devices & Remote Logout"
                            className="hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/40"
                          >
                            <Monitor className="h-4 w-4 text-gray-500 hover:text-indigo-600" />
                          </Button>

                          {/* Revoke Sessions button */}
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handlePromptRevokeSessions(u)}
                            disabled={u.email === user?.email}
                            title={
                              u.email === user?.email
                                ? 'Cannot revoke your own active session from here'
                                : 'Revoke All Active Sessions (Forced Logout)'
                            }
                            className="hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/40"
                          >
                            <RotateCcw
                              className={cn(
                                "h-4 w-4",
                                u.email === user?.email ? "text-gray-300" : "text-gray-500 hover:text-amber-600"
                              )}
                            />
                          </Button>

                          {/* Clone User Permissions button */}
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleCloneUser(u)}
                            title="Clone Permissions into New User"
                            className="hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/40"
                          >
                            <Copy className="h-4 w-4 text-gray-500 hover:text-indigo-600" />
                          </Button>

                          {/* Simulate / View As button */}
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleStartSimulation(u)}
                            disabled={u.email === user?.email}
                            title={
                              u.email === user?.email
                                ? 'You are currently logged in as this user'
                                : 'Simulate / View App As This User'
                            }
                            className="hover:text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-950/40"
                          >
                            <Eye
                              className={cn(
                                "h-4 w-4",
                                u.email === user?.email ? "text-gray-300" : "text-gray-500 hover:text-purple-600"
                              )}
                            />
                          </Button>

                          {/* Edit button */}
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleOpenModal(u)}
                            title="Edit Permissions"
                          >
                            <Edit2 className="h-4 w-4 text-gray-500 hover:text-[#3b2fc9]" />
                          </Button>

                          {/* Delete button */}
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(u.id, u.email)}
                            disabled={u.email === user?.email}
                            title="Delete User"
                          >
                            <Trash2
                              className={`h-4 w-4 ${
                                u.email === user?.email ? 'text-gray-300' : 'text-gray-500 hover:text-red-600'
                              }`}
                            />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>
      </>
      )}

      {/* ── MODAL: User Details, Scopes, Checkbox Groups & Categorized Endpoints ── */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-3xl h-[92vh] max-h-[92vh] bottom-0 top-auto sm:top-[50%] sm:bottom-auto translate-y-0 sm:translate-y-[-50%] rounded-t-3xl sm:rounded-3xl p-0 border-0 overflow-hidden bg-white dark:bg-slate-900 shadow-2xl flex flex-col">
          <div className="sm:hidden w-12 h-1.5 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto mt-2.5 mb-1 shrink-0" />
          <DialogHeader className="p-5 sm:p-6 pb-3 border-b border-slate-100 dark:border-slate-800 shrink-0">
            <DialogTitle className="text-lg font-black tracking-tight text-slate-900 dark:text-white">
              {editingUser ? 'Edit User & Granular Permissions' : 'Add New User & Assign Permissions'}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSaveUser} className="flex flex-col flex-1 min-h-0 overflow-hidden">
            <div className="flex-1 min-h-0 overflow-y-auto p-5 sm:p-6 pt-4 space-y-6 overscroll-contain">
            {/* Clone Permissions From User Banner */}
            {users.filter((u) => u.id !== editingUser?.id).length > 0 && (
              <div className="p-3.5 rounded-2xl bg-gradient-to-r from-indigo-50/90 to-purple-50/90 dark:from-indigo-950/40 dark:to-purple-950/40 border border-indigo-200/80 dark:border-indigo-800/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-sm">
                    <Copy className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-black text-slate-900 dark:text-white flex items-center gap-1.5">
                      Clone Permissions From Existing User
                      <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-indigo-100 dark:bg-indigo-900 text-indigo-800 dark:text-indigo-200">
                        Quick Copy
                      </span>
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                      Copy role, stall site, locations, allowed tabs &amp; default landing page
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <select
                    value={selectedCloneSourceId}
                    onChange={(e) => {
                      const val = e.target.value;
                      setSelectedCloneSourceId(val);
                      if (val) handleApplyCloneFromUser(val);
                    }}
                    className="w-full sm:w-auto h-9 px-3 rounded-xl border border-indigo-200 dark:border-indigo-800 bg-white dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 cursor-pointer shadow-2xs"
                  >
                    <option value="">-- Select user to clone from --</option>
                    {users
                      .filter((u) => u.id !== editingUser?.id)
                      .map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.email} ({u.role.toUpperCase()} · {COMPANY_SITES[u.assignedSite || 'newrelic']?.name || 'NewRelic'})
                        </option>
                      ))}
                  </select>
                </div>
              </div>
            )}

            {/* Account Credentials */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-gray-700 dark:text-gray-300">Email Address</Label>
                <Input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={!!editingUser}
                  className={editingUser ? 'bg-gray-100 dark:bg-slate-800' : ''}
                  placeholder="user@gutguru.com"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-gray-700 dark:text-gray-300">
                  Password{' '}
                  {editingUser && (
                    <span className="text-[11px] text-gray-400 font-normal">
                      (Leave blank to keep unchanged)
                    </span>
                  )}
                </Label>
                <Input
                  type="password"
                  required={!editingUser}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={editingUser ? '••••••••' : 'Enter password'}
                />
              </div>
            </div>

            {/* Account Status: Active vs Suspended */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-bold uppercase tracking-wider text-gray-900 dark:text-white flex items-center gap-1.5">
                  <Power className="w-3.5 h-3.5 text-[#3b2fc9]" />
                  Account Status
                </Label>
                {editingUser?.email === user?.email ? (
                  <span className="text-[11px] text-amber-600 dark:text-amber-400 font-medium">
                    (Cannot suspend your active admin account)
                  </span>
                ) : (
                  <span className="text-[11px] text-gray-500 dark:text-gray-400">
                    Controls login access &amp; session validity
                  </span>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {/* Active Card */}
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic('light');
                    setAccountStatus('active');
                  }}
                  className={cn(
                    "p-3 rounded-2xl border text-left transition-all relative flex items-start gap-3 cursor-pointer",
                    accountStatus === 'active'
                      ? "bg-emerald-50/80 dark:bg-emerald-950/40 border-emerald-500 ring-2 ring-emerald-500/20"
                      : "bg-white dark:bg-slate-800/90 border-slate-200 dark:border-slate-700 hover:border-slate-300"
                  )}
                >
                  <div
                    className={cn(
                      "w-8 h-8 rounded-xl flex items-center justify-center shrink-0 transition-colors",
                      accountStatus === 'active'
                        ? "bg-emerald-600 text-white"
                        : "bg-slate-100 dark:bg-slate-700 text-slate-500"
                    )}
                  >
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-slate-900 dark:text-white">Active Account</span>
                      {accountStatus === 'active' && (
                        <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-200">
                          Active
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      User can sign in and operate assigned stall modules.
                    </p>
                  </div>
                </button>

                {/* Suspended Card */}
                <button
                  type="button"
                  disabled={editingUser?.email === user?.email}
                  onClick={() => {
                    if (editingUser?.email === user?.email) return;
                    triggerHaptic('warning');
                    setAccountStatus('suspended');
                  }}
                  className={cn(
                    "p-3 rounded-2xl border text-left transition-all relative flex items-start gap-3",
                    editingUser?.email === user?.email ? "opacity-50 cursor-not-allowed" : "cursor-pointer",
                    accountStatus === 'suspended'
                      ? "bg-rose-50/80 dark:bg-rose-950/40 border-rose-500 ring-2 ring-rose-500/20"
                      : "bg-white dark:bg-slate-800/90 border-slate-200 dark:border-slate-700 hover:border-slate-300"
                  )}
                >
                  <div
                    className={cn(
                      "w-8 h-8 rounded-xl flex items-center justify-center shrink-0 transition-colors",
                      accountStatus === 'suspended'
                        ? "bg-rose-600 text-white"
                        : "bg-slate-100 dark:bg-slate-700 text-slate-500"
                    )}
                  >
                    <Ban className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-rose-900 dark:text-rose-200">Suspended Account</span>
                      {accountStatus === 'suspended' && (
                        <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-rose-100 dark:bg-rose-900 text-rose-800 dark:text-rose-200">
                          Suspended
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      Blocks login and immediately terminates all active sessions.
                    </p>
                  </div>
                </button>
              </div>
            </div>

            {/* Time-Bound / Expiring Access Controls */}
            <div className="space-y-2.5 p-4 rounded-2xl border border-amber-200/80 dark:border-amber-900/60 bg-amber-50/40 dark:bg-amber-950/20">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                <Label className="text-xs font-black uppercase tracking-wider text-amber-950 dark:text-amber-200 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                  Time-Bound / Expiring Access
                </Label>
                <span className="text-[11px] text-amber-800/80 dark:text-amber-300/80">
                  Auto-terminates active sessions down to the minute
                </span>
              </div>

              {/* Quick Expiration Presets */}
              <div className="flex flex-wrap gap-1.5 pt-1">
                {[
                  { id: 'permanent', label: 'Permanent (No Expiry)' },
                  { id: '24h', label: '24 Hours' },
                  { id: '7d', label: '7 Days' },
                  { id: '30d', label: '30 Days' },
                  { id: 'custom', label: 'Custom Date & Time' },
                ].map((preset) => {
                  const isSelected = expirationPreset === preset.id;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => {
                        triggerHaptic('light');
                        handleSelectExpirationPreset(preset.id as any);
                      }}
                      className={cn(
                        "text-xs px-3 py-1.5 rounded-xl border font-bold transition-all shadow-2xs active:scale-95 cursor-pointer flex items-center gap-1.5",
                        isSelected
                          ? "bg-amber-600 text-white border-amber-600 shadow-amber-600/20"
                          : "bg-white dark:bg-slate-800 text-amber-900 dark:text-amber-200 border-amber-200 dark:border-amber-800/80 hover:bg-amber-100/60 dark:hover:bg-slate-700"
                      )}
                    >
                      {preset.id === 'permanent' ? (
                        <CheckCircle2 className="w-3 h-3" />
                      ) : (
                        <Hourglass className="w-3 h-3" />
                      )}
                      <span>{preset.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Custom Date & Time Picker */}
              <div className="pt-1">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
                  <div className="space-y-1">
                    <Label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-amber-600" />
                      Expiration Date &amp; Time
                    </Label>
                    <Input
                      type="datetime-local"
                      value={expiresAt}
                      onChange={(e) => {
                        setExpiresAt(e.target.value);
                        setExpirationPreset('custom');
                      }}
                      className="bg-white dark:bg-slate-800 text-xs font-mono font-semibold"
                    />
                  </div>

                  <div className="text-[11px] text-slate-500 dark:text-slate-400 p-2.5 rounded-xl bg-white/70 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60">
                    {expiresAt ? (
                      (() => {
                        const expMs = new Date(expiresAt).getTime();
                        const isPast = expMs <= Date.now();
                        const formatted = new Date(expiresAt).toLocaleString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        });
                        return isPast ? (
                          <span className="text-rose-600 dark:text-rose-400 font-bold flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5 shrink-0" />
                            Already Expired: {formatted}
                          </span>
                        ) : (
                          <span className="text-amber-800 dark:text-amber-300 font-semibold flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                            Expires on {formatted}
                          </span>
                        );
                      })()
                    ) : (
                      <span className="text-slate-600 dark:text-slate-300 font-medium">
                        Permanent access — user account will never expire automatically.
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Role Level: Checkbox / Radio Selection Cards (NO DROPDOWNS) */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-bold uppercase tracking-wider text-gray-900 dark:text-white flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5 text-[#3b2fc9]" />
                  Select User Role Tier
                </Label>
                <span className="text-[11px] text-gray-500 dark:text-gray-400">
                  Select 1 role tier below
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                {ROLE_OPTIONS.map((r) => {
                  const isSelected = userRole === r.value;
                  const Icon = r.icon;
                  return (
                    <button
                      key={r.value}
                      type="button"
                      onClick={() => {
                        triggerHaptic('light');
                        setUserRole(r.value);
                      }}
                      className={cn(
                        "p-3 rounded-2xl border text-left transition-all relative flex flex-col justify-between group cursor-pointer",
                        isSelected
                          ? "bg-indigo-50/90 dark:bg-indigo-950/50 border-[#3b2fc9] dark:border-indigo-400 shadow-sm ring-2 ring-[#3b2fc9]/20"
                          : "bg-white dark:bg-slate-800/90 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600"
                      )}
                    >
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <div className={cn(
                            "w-7 h-7 rounded-xl flex items-center justify-center transition-colors",
                            isSelected
                              ? "bg-[#3b2fc9] text-white"
                              : "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300"
                          )}>
                            <Icon className="w-4 h-4" />
                          </div>
                          {/* Checkbox indicator */}
                          <div className={cn(
                            "w-5 h-5 rounded-md border flex items-center justify-center transition-colors shadow-2xs",
                            isSelected
                              ? "bg-[#3b2fc9] border-[#3b2fc9] text-white"
                              : "border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800"
                          )}>
                            {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                          </div>
                        </div>
                        <p className={cn("text-xs font-black tracking-tight", isSelected ? "text-[#3b2fc9] dark:text-indigo-300" : "text-slate-900 dark:text-white")}>
                          {r.label}
                        </p>
                        <span className={cn("inline-block mt-0.5 text-[9px] font-black uppercase px-2 py-0.2 rounded-full border", r.badgeClass)}>
                          {r.badge}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-tight mt-2">
                        {r.description}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Assigned Company Site: Checkbox / Multi-Select Cards */}
            {userRole !== 'admin' && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-bold uppercase tracking-wider text-gray-900 dark:text-white flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-[#3b2fc9]" />
                    Assigned Company Stalls / Sites
                  </Label>
                  <span className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400">
                    {assignedSites.length > 1 ? `Multi-Site (${assignedSites.length} stalls selected)` : 'Click to select / multi-assign'}
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {SITE_OPTIONS.map((s) => {
                    const isSelected = assignedSites.includes(s.value);
                    return (
                      <button
                        key={s.value}
                        type="button"
                        onClick={() => {
                          triggerHaptic('light');
                          handleSiteToggle(s.value);
                        }}
                        className={cn(
                          "p-3 rounded-2xl border text-left transition-all relative flex flex-col justify-between group cursor-pointer",
                          isSelected
                            ? "bg-indigo-50/90 dark:bg-indigo-950/50 border-[#3b2fc9] dark:border-indigo-400 shadow-sm ring-2 ring-[#3b2fc9]/20"
                            : "bg-white dark:bg-slate-800/90 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600"
                        )}
                      >
                        <div>
                          <div className="flex items-center justify-between mb-1.5">
                            <span className={cn("text-xs font-black", isSelected ? "text-[#3b2fc9] dark:text-indigo-300" : "text-slate-900 dark:text-white")}>
                              {s.label}
                            </span>
                            {/* Checkbox indicator */}
                            <div className={cn(
                              "w-5 h-5 rounded-md border flex items-center justify-center transition-colors shadow-2xs",
                              isSelected
                                ? "bg-[#3b2fc9] border-[#3b2fc9] text-white"
                                : "border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800"
                            )}>
                              {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                            </div>
                          </div>
                          <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1">
                            <MapPin className="w-3 h-3 text-emerald-600" />
                            {s.locations}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-tight mt-2">
                          {s.description}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {assignedSites.length > 1 && userRole !== 'admin' && (
              <div className="text-[11px] text-indigo-900 dark:text-indigo-200 bg-indigo-50/80 dark:bg-indigo-950/40 p-3 rounded-2xl border border-indigo-200 dark:border-indigo-800/60 flex items-start gap-2">
                <Building2 className="w-4 h-4 text-[#3b2fc9] shrink-0 mt-0.5" />
                <div>
                  <strong>Multi-Site Manager Clearance:</strong> This user can manage and roam across{' '}
                  <strong>{assignedSites.map((s) => COMPANY_SITES[s]?.name || s).join(', ')}</strong> company stalls.
                </div>
              </div>
            )}

            {!assignedSites.includes('newrelic') && userRole !== 'admin' && (
              <div className="text-[11px] text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 p-3 rounded-2xl border border-amber-200 dark:border-amber-800/60 flex items-start gap-2">
                <span className="text-sm">📍</span>
                <div>
                  Selected stalls (<strong>{assignedSites.map((s) => COMPANY_SITES[s]?.name || s).join(' & ')}</strong>) are strictly restricted to{' '}
                  <strong>Hyderabad</strong> stall operations. Dedicated NewRelic Delivery Challans system is automatically hidden and forbidden.
                </div>
              </div>
            )}

            {userRole === 'guest' && (
              <div className="text-[11px] text-amber-900 dark:text-amber-200 bg-amber-500/10 border border-amber-500/30 p-3 rounded-2xl flex items-start gap-2">
                <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <strong>Guest Mode Active:</strong> Tax Invoices and physical Signed Delivery Challan copies are{' '}
                  <strong>strictly forbidden</strong> for this account. Guest users have view access across operations, quotations, and catalogs only.
                </div>
              </div>
            )}

            {/* Role Presets (1-Click Configuration) */}
            <div className="space-y-2 p-3.5 bg-gradient-to-r from-indigo-50/80 to-purple-50/80 dark:from-indigo-950/40 dark:to-purple-950/40 rounded-2xl border border-indigo-100 dark:border-indigo-900">
              <div className="flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-[#3b2fc9] dark:text-indigo-400" />
                <Label className="text-xs font-black text-indigo-950 dark:text-indigo-200 uppercase tracking-wider">
                  Quick Role Presets (Auto-fills Landing Page &amp; Permissions)
                </Label>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {ROLE_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => handleApplyPreset(preset)}
                    className="text-xs px-2.5 py-1 rounded-xl border bg-white dark:bg-slate-800 hover:bg-[#3b2fc9] hover:text-white border-indigo-200 dark:border-indigo-800 font-semibold text-indigo-900 dark:text-indigo-300 transition-all shadow-2xs active:scale-95 cursor-pointer"
                    title={preset.description}
                  >
                    {preset.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Default Landing Page after Login: Checkbox / Radio Selection Cards (NO DROPDOWNS) */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-bold uppercase tracking-wider text-gray-900 dark:text-white flex items-center gap-1.5">
                  <Compass className="w-3.5 h-3.5 text-[#3b2fc9]" />
                  Default Landing Page After Login
                </Label>
                <span className="text-[11px] text-gray-500 dark:text-gray-400">
                  Select destination page upon sign-in
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 max-h-56 overflow-y-auto p-1.5 border border-slate-200 dark:border-slate-800 rounded-2xl bg-slate-50/50 dark:bg-slate-900/50">
                {DEFAULT_LANDING_PAGES.map((page) => {
                  const isNewRelicDC = page.path === '/newrelic';
                  const isBlockedForSite = isNewRelicDC && assignedSite !== 'newrelic' && userRole !== 'admin';
                  const isInvoiceForGuest = page.path === '/invoices' && userRole === 'guest';
                  const disabled = isBlockedForSite || isInvoiceForGuest;
                  const isSelected = defaultLandingPage === page.path;

                  return (
                    <button
                      key={page.path}
                      type="button"
                      disabled={disabled}
                      onClick={() => {
                        triggerHaptic('light');
                        setDefaultLandingPage(page.path);
                      }}
                      className={cn(
                        "p-2.5 rounded-xl border text-left transition-all flex items-start gap-2 relative cursor-pointer",
                        disabled && "opacity-40 cursor-not-allowed bg-slate-100 dark:bg-slate-800/40",
                        isSelected && !disabled
                          ? "bg-white dark:bg-slate-800 border-[#3b2fc9] dark:border-indigo-400 shadow-2xs ring-1 ring-[#3b2fc9]"
                          : !disabled && "bg-white dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 hover:border-slate-300"
                      )}
                    >
                      <div className={cn(
                        "w-4 h-4 rounded-md border mt-0.5 flex items-center justify-center shrink-0 transition-colors",
                        isSelected && !disabled
                          ? "bg-[#3b2fc9] border-[#3b2fc9] text-white"
                          : "border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800"
                      )}>
                        {isSelected && !disabled && <Check className="w-3 h-3 stroke-[3]" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className={cn("text-xs font-bold truncate", isSelected ? "text-[#3b2fc9] dark:text-indigo-300" : "text-slate-800 dark:text-slate-200")}>
                          {page.label}
                        </p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-[9px] px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-semibold uppercase">
                            {page.category}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono truncate">
                            {page.path}
                          </span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Preferred Locations */}
            <div className="space-y-2 pt-1">
              <Label className="text-xs font-bold text-gray-700 dark:text-gray-300">Allowed / Preferred Locations</Label>
              <div className="flex items-center gap-6">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="loc-hyd"
                    checked={preferredLocations.includes('hyderabad')}
                    disabled={assignedSite !== 'newrelic' && userRole !== 'admin'}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setPreferredLocations((prev) => [...prev, 'hyderabad']);
                      } else {
                        if (assignedSite === 'newrelic' || userRole === 'admin') {
                          setPreferredLocations((prev) => prev.filter((l) => l !== 'hyderabad'));
                        }
                      }
                    }}
                  />
                  <label htmlFor="loc-hyd" className="text-xs font-semibold leading-none text-gray-700 dark:text-gray-300 cursor-pointer">
                    Hyderabad{' '}
                    {assignedSite !== 'newrelic' && userRole !== 'admin' && (
                      <span className="text-[10px] text-emerald-600 font-normal">(Locked for site)</span>
                    )}
                  </label>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="loc-blr"
                    checked={preferredLocations.includes('bangalore')}
                    disabled={assignedSite !== 'newrelic' && userRole !== 'admin'}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setPreferredLocations((prev) => [...prev, 'bangalore']);
                      } else {
                        setPreferredLocations((prev) => prev.filter((l) => l !== 'bangalore'));
                      }
                    }}
                  />
                  <label
                    htmlFor="loc-blr"
                    className={`text-xs font-semibold leading-none cursor-pointer ${
                      assignedSite !== 'newrelic' && userRole !== 'admin' ? 'text-gray-400' : 'text-gray-700 dark:text-gray-300'
                    }`}
                  >
                    Bangalore{' '}
                    {assignedSite !== 'newrelic' && userRole !== 'admin' && (
                      <span className="text-[10px] text-gray-400 font-normal">(Unavailable for DSM/NTT Data)</span>
                    )}
                  </label>
                </div>
              </div>
            </div>

            {/* Delete Protection (can_delete) Clearance Card */}
            <div className="space-y-2 p-4 rounded-2xl border border-rose-200/80 dark:border-rose-900/60 bg-rose-50/40 dark:bg-rose-950/20">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-black uppercase tracking-wider text-rose-950 dark:text-rose-200 flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                  Data Safety &amp; Record Deletion Clearance
                </Label>
                {userRole === 'admin' ? (
                  <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300">
                    Always Granted (Admin)
                  </span>
                ) : userRole === 'guest' ? (
                  <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300">
                    Strictly Forbidden (Guest)
                  </span>
                ) : (
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">
                    Restricts permanent deletion
                  </span>
                )}
              </div>

              <div
                onClick={() => {
                  if (userRole === 'admin' || userRole === 'guest') return;
                  triggerHaptic('light');
                  setCanDeleteRecord((prev) => !prev);
                }}
                className={cn(
                  "p-3.5 rounded-2xl border transition-all flex items-start gap-3",
                  userRole === 'admin' || userRole === 'guest'
                    ? "cursor-default"
                    : "cursor-pointer hover:border-slate-300 dark:hover:border-slate-700 active:scale-[0.99]",
                  userRole === 'admin'
                    ? "bg-purple-50/60 dark:bg-purple-950/30 border-purple-200 dark:border-purple-800"
                    : userRole === 'guest'
                    ? "bg-rose-50/60 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800 opacity-80"
                    : canDeleteRecord
                    ? "bg-emerald-50/80 dark:bg-emerald-950/40 border-emerald-500 ring-2 ring-emerald-500/20"
                    : "bg-white dark:bg-slate-800/90 border-slate-200 dark:border-slate-700"
                )}
              >
                <div
                  className={cn(
                    "w-8 h-8 rounded-xl flex items-center justify-center shrink-0 transition-colors",
                    userRole === 'admin'
                      ? "bg-purple-600 text-white"
                      : userRole === 'guest'
                      ? "bg-rose-600 text-white"
                      : canDeleteRecord
                      ? "bg-emerald-600 text-white"
                      : "bg-slate-100 dark:bg-slate-700 text-slate-500"
                  )}
                >
                  {userRole === 'admin' || canDeleteRecord ? (
                    <ShieldCheck className="w-4 h-4" />
                  ) : (
                    <ShieldX className="w-4 h-4" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-slate-900 dark:text-white">
                      {userRole === 'admin'
                        ? 'Full Delete Clearance (Admin Master)'
                        : userRole === 'guest'
                        ? 'Delete Restricted (Guest Auditor)'
                        : canDeleteRecord
                        ? 'Delete Clearance Granted (can_delete)'
                        : 'Delete Protection Active (Safe Mode)'}
                    </span>
                    {userRole !== 'admin' && userRole !== 'guest' && (
                      <span
                        className={cn(
                          "text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full",
                          canDeleteRecord
                            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                            : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                        )}
                      >
                        {canDeleteRecord ? 'Can Delete' : 'Protected'}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    {userRole === 'admin'
                      ? 'Admins inherently hold master clearance to delete Delivery Challans, Invoices, Quotations, and Tuckshop records.'
                      : userRole === 'guest'
                      ? 'Guest auditors are strictly view-only and are permanently forbidden from deleting any business records.'
                      : canDeleteRecord
                      ? 'This user is cleared to permanently delete delivery challans, invoices, and tuckshop ledger records.'
                      : 'Recommended: This user cannot permanently delete records. Prevents accidental or unauthorized deletion of business records.'}
                  </p>
                </div>
              </div>
            </div>

            {/* Categorized Granular Tab & Endpoint Permissions (ALL CHECKBOXES + SELECT ALL) */}
            {userRole !== 'admin' && (
              <div className="space-y-4 pt-2 border-t border-gray-100 dark:border-slate-800">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-black uppercase tracking-wider text-gray-900 dark:text-white flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-[#3b2fc9]" />
                    Granular Tab &amp; Endpoint Permissions
                  </Label>
                  <span className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 px-2 py-0.5 rounded-full border border-indigo-200 dark:border-indigo-800">
                    {allowedTabs.length} active permissions
                  </span>
                </div>

                <div className="space-y-4">
                  {PERMISSION_CATEGORIES.map((category) => {
                    // Check if items are allowed or blocked
                    const validItems = category.items.filter(
                      (item) => !(item.newRelicOnly && assignedSite !== 'newrelic')
                    );
                    const allChecked =
                      validItems.length > 0 &&
                      validItems.every((item) => allowedTabs.includes(item.id));
                    const someChecked =
                      validItems.some((item) => allowedTabs.includes(item.id)) && !allChecked;

                    return (
                      <div
                        key={category.id}
                        className="p-4 rounded-2xl border border-gray-200 dark:border-slate-800 bg-gray-50/60 dark:bg-slate-800/40 space-y-3"
                      >
                        {/* Category Header with Select All / Deselect All Checkbox */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-200/60 dark:border-slate-700/60 pb-2.5">
                          <div className="flex items-center gap-2.5">
                            <Checkbox
                              id={`cat-${category.id}`}
                              checked={allChecked}
                              onCheckedChange={(checked) =>
                                handleToggleCategory(category.items, Boolean(checked))
                              }
                            />
                            <div>
                              <div className="flex items-center gap-2">
                                <label
                                  htmlFor={`cat-${category.id}`}
                                  className="text-xs font-black text-gray-900 dark:text-white cursor-pointer"
                                >
                                  {category.name}
                                </label>
                                <span
                                  className={`px-2 py-0.2 rounded-full text-[10px] font-bold border ${category.badgeColor}`}
                                >
                                  {validItems.filter((i) => allowedTabs.includes(i.id)).length} /{' '}
                                  {category.items.length} Enabled
                                </span>
                              </div>
                              <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">
                                {category.description}
                              </p>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleToggleCategory(category.items, !allChecked)}
                            className="text-[11px] font-bold text-[#3b2fc9] dark:text-indigo-400 hover:underline shrink-0 text-left sm:text-right"
                          >
                            {allChecked ? 'Deselect All' : 'Select All'}
                          </button>
                        </div>

                        {/* Granular Permission Checkbox Cards */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-0.5">
                          {category.items.map((item) => {
                            const isBlockedForSite =
                              item.newRelicOnly && assignedSite !== 'newrelic';
                            const isGuestRestricted =
                              userRole === 'guest' &&
                              (item.id === 'invoices' ||
                                item.id === 'invoices_create' ||
                                item.id === 'billing' ||
                                item.id === 'signed_copies' ||
                                item.id === 'users_admin');
                            const isBlocked = isBlockedForSite || isGuestRestricted;
                            const isChecked =
                              allowedTabs.includes(item.id) && !isBlocked;

                            return (
                              <div
                                key={item.id}
                                className={cn(
                                  "p-3 rounded-xl border transition-all",
                                  isBlocked
                                    ? "bg-gray-100/80 dark:bg-slate-800/30 border-gray-200 dark:border-slate-800 opacity-60"
                                    : isChecked
                                    ? "bg-white dark:bg-slate-800 border-[#3b2fc9]/40 dark:border-indigo-500/50 shadow-2xs"
                                    : "bg-white dark:bg-slate-800/80 border-gray-200 dark:border-slate-700 hover:border-gray-300"
                                )}
                              >
                                <div className="flex items-start space-x-2.5">
                                  <Checkbox
                                    id={`tab-${item.id}`}
                                    checked={isChecked}
                                    disabled={isBlocked}
                                    onCheckedChange={(checked) =>
                                      handleToggleTab(item.id, Boolean(checked))
                                    }
                                    className="mt-0.5"
                                  />
                                  <div className="space-y-1 flex-1 min-w-0">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <label
                                        htmlFor={`tab-${item.id}`}
                                        className={cn(
                                          "text-xs font-bold block cursor-pointer",
                                          isBlocked
                                            ? "text-gray-400"
                                            : "text-gray-900 dark:text-white"
                                        )}
                                      >
                                        {item.label}
                                      </label>
                                      <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 border border-slate-200/80 dark:border-slate-600">
                                        {item.route}
                                      </span>
                                    </div>
                                    <p className="text-[10px] text-gray-500 dark:text-gray-400 leading-tight">
                                      {isBlockedForSite
                                        ? 'Forbidden: Dedicated to NewRelic site only.'
                                        : isGuestRestricted
                                        ? 'Restricted: Invoices & signed copies are hidden from guests.'
                                        : item.description}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            </div>

            <DialogFooter className="p-4 sm:p-5 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0 gap-2 flex-row pb-[max(1rem,env(safe-area-inset-bottom))]">
              <Button
                type="button"
                variant="outline"
                className="flex-1 h-11 rounded-2xl"
                onClick={() => {
                  triggerHaptic('light');
                  setIsModalOpen(false);
                }}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                onClick={() => triggerHaptic('medium')}
                className="flex-1 h-11 rounded-2xl bg-gradient-to-r from-[#3b2fc9] to-indigo-600 hover:from-[#2d23a0] hover:to-indigo-700 shadow-md shadow-indigo-900/10 text-white font-bold"
                disabled={isSubmitting}
              >
                {isSubmitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                {editingUser ? 'Save Changes' : 'Create User'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── CONFIRMATION MODAL: Suspend, Activate, Revoke Sessions ── */}
      <Dialog
        open={confirmModal.isOpen}
        onOpenChange={(open) => {
          if (!open) {
            setConfirmModal((prev) => ({ ...prev, isOpen: false, targetUser: null }));
          }
        }}
      >
        <DialogContent className="max-w-md rounded-3xl p-6 bg-white dark:bg-slate-900 shadow-2xl border border-slate-200 dark:border-slate-800">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  "w-12 h-12 rounded-2xl flex items-center justify-center shrink-0",
                  confirmModal.type === 'suspend'
                    ? "bg-rose-100 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400"
                    : confirmModal.type === 'activate'
                    ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400"
                    : "bg-amber-100 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400"
                )}
              >
                {confirmModal.type === 'suspend' ? (
                  <Ban className="w-6 h-6" />
                ) : confirmModal.type === 'activate' ? (
                  <CheckCircle2 className="w-6 h-6" />
                ) : (
                  <RotateCcw className="w-6 h-6" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-base font-black text-slate-900 dark:text-white">
                  {confirmModal.type === 'suspend'
                    ? 'Suspend User Account'
                    : confirmModal.type === 'activate'
                    ? 'Activate User Account'
                    : 'Revoke Active Sessions'}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-mono mt-0.5 truncate">
                  {confirmModal.targetUser?.email}
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60 text-xs text-slate-600 dark:text-slate-300 space-y-1.5">
              {confirmModal.type === 'suspend' ? (
                <>
                  <p className="font-semibold text-rose-600 dark:text-rose-400">
                    Warning: Immediate real-time lockout
                  </p>
                  <p>
                    Suspending this account terminates all active mobile and desktop sessions instantly in real time. The user will be unable to log in until reactivated by an admin.
                  </p>
                </>
              ) : confirmModal.type === 'activate' ? (
                <>
                  <p className="font-semibold text-emerald-600 dark:text-emerald-400">
                    Restoring system access
                  </p>
                  <p>
                    This will reactivate the account. The user will be able to log in and access their permitted operational modules.
                  </p>
                </>
              ) : (
                <>
                  <p className="font-semibold text-amber-600 dark:text-amber-400">
                    Forced logout across all devices
                  </p>
                  <p>
                    This invalidates all active session tokens immediately without modifying the user's password or permissions. The user will be logged out and prompted to sign in again.
                  </p>
                </>
              )}
            </div>

            <div className="flex items-center gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                className="flex-1 h-11 rounded-xl font-bold"
                disabled={isActionLoading}
                onClick={() => {
                  triggerHaptic('light');
                  setConfirmModal((prev) => ({ ...prev, isOpen: false, targetUser: null }));
                }}
              >
                Cancel
              </Button>
              <Button
                type="button"
                disabled={isActionLoading}
                onClick={handleExecuteConfirmAction}
                className={cn(
                  "flex-1 h-11 rounded-xl text-white font-bold shadow-md",
                  confirmModal.type === 'suspend'
                    ? "bg-rose-600 hover:bg-rose-700 shadow-rose-600/20"
                    : confirmModal.type === 'activate'
                    ? "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20"
                    : "bg-amber-600 hover:bg-amber-700 shadow-amber-600/20"
                )}
              >
                {isActionLoading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                {confirmModal.type === 'suspend'
                  ? 'Yes, Suspend Account'
                  : confirmModal.type === 'activate'
                  ? 'Yes, Activate Account'
                  : 'Revoke Sessions'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Active Device Sessions Modal */}
      <UserDeviceSessionsModal
        isOpen={!!selectedUserForDevices}
        onClose={() => setSelectedUserForDevices(null)}
        targetUser={selectedUserForDevices}
        onRevokeDevice={handleRevokeDeviceSession}
        onRevokeAllSessions={handleRevokeAllSessionsFromModal}
      />
    </div>
  );
}
