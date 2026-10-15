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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, Plus, Trash2, Edit2, ShieldAlert, Sparkles, Compass, CheckCircle2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { SiteId, COMPANY_SITES, resolveSiteId } from '@/types/site';
import {
  PermissionKey,
  PERMISSION_CATEGORIES,
  ROLE_PRESETS,
  DEFAULT_LANDING_PAGES,
  RolePreset,
} from '@/types/permissions';

interface DbUser {
  id: string;
  email: string;
  password?: string;
  role: UserRole;
  createdAt?: string;
  assignedSite?: SiteId;
  preferredLocations?: string[];
  assignedApps?: string[];
  defaultLandingPage?: string;
  allowedTabs?: PermissionKey[];
}

function deriveLegacyApps(tabs: PermissionKey[]): string[] {
  const apps = new Set<string>();
  if (
    tabs.includes('newrelic_dc') ||
    tabs.includes('tuckshop') ||
    tabs.includes('attendance') ||
    tabs.includes('stock_request')
  ) {
    apps.add('/newrelic');
  }
  if (tabs.includes('general_dc')) {
    apps.add('/delivery-challans');
  }
  if (tabs.includes('billing')) {
    apps.add('/invoices');
    apps.add('/quotations');
  }
  if (tabs.includes('masters')) {
    apps.add('/invoices');
  }
  if (tabs.includes('hr_docs')) {
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
      ? ['tuckshop', 'attendance', 'stock_request', 'newrelic_dc']
      : ['tuckshop', 'attendance', 'stock_request'];
  }
  const tabs = new Set<PermissionKey>();
  if (apps.includes('/newrelic')) {
    tabs.add('tuckshop');
    tabs.add('attendance');
    tabs.add('stock_request');
    if (site === 'newrelic') {
      tabs.add('newrelic_dc');
    }
  }
  if (apps.includes('/delivery-challans')) {
    tabs.add('general_dc');
  }
  if (apps.includes('/invoices')) {
    tabs.add('billing');
    tabs.add('masters');
  }
  if (apps.includes('/quotations')) {
    tabs.add('billing');
  }
  if (apps.includes('/payslip') || apps.includes('/offer-letter')) {
    tabs.add('hr_docs');
  }
  if (apps.includes('/settings')) {
    tabs.add('settings');
  }
  return Array.from(tabs);
}

export default function AdminUsersPage() {
  const { user, role, loading } = useAuth();
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
  const [assignedSite, setAssignedSite] = useState<SiteId>('newrelic');
  const [preferredLocations, setPreferredLocations] = useState<string[]>([]);
  const [defaultLandingPage, setDefaultLandingPage] = useState<string>('/newrelic/tuckshop');
  const [allowedTabs, setAllowedTabs] = useState<PermissionKey[]>([
    'tuckshop',
    'attendance',
    'stock_request',
  ]);
  const [isSubmitting, setIsSubmitting] = useState(false);

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
          assignedSite: resolveSiteId(data.assignedSite),
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

  const handleSiteChange = (newSite: SiteId) => {
    setAssignedSite(newSite);
    if (newSite === 'dsm' || newSite === 'ntt_data') {
      setPreferredLocations(['hyderabad']);
      setAllowedTabs((prev) => prev.filter((t) => t !== 'newrelic_dc'));
      if (defaultLandingPage === '/newrelic') {
        setDefaultLandingPage('/newrelic/tuckshop');
      }
    }
  };

  const handleApplyPreset = (preset: RolePreset) => {
    let tabs = [...preset.tabs];
    let landing = preset.defaultPage;

    if (assignedSite !== 'newrelic') {
      tabs = tabs.filter((t) => t !== 'newrelic_dc');
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

  const handleOpenModal = (userToEdit?: DbUser) => {
    if (userToEdit) {
      setEditingUser(userToEdit);
      setEmail(userToEdit.email);
      setPassword(''); // keep blank for editing
      setUserRole(userToEdit.role);
      const site = userToEdit.assignedSite || 'newrelic';
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
    } else {
      setEditingUser(null);
      setEmail('');
      setPassword('');
      setUserRole('manager');
      setAssignedSite('newrelic');
      setPreferredLocations(['hyderabad']);
      setDefaultLandingPage('/newrelic/tuckshop');
      setAllowedTabs(['tuckshop', 'attendance', 'stock_request']);
    }
    setIsModalOpen(true);
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const effectiveSite = userRole === 'admin' ? 'newrelic' : assignedSite;
      const effectiveLocations =
        effectiveSite !== 'newrelic' && userRole !== 'admin'
          ? ['hyderabad']
          : preferredLocations;

      // Filter out newrelic_dc if non-newrelic site
      const effectiveTabs =
        effectiveSite !== 'newrelic' && userRole !== 'admin'
          ? allowedTabs.filter((t) => t !== 'newrelic_dc')
          : allowedTabs;

      // Sync legacy assignedApps for full backwards-compatibility
      const legacyApps = deriveLegacyApps(effectiveTabs);

      if (editingUser) {
        // Edit existing
        const updateData: any = {
          role: userRole,
          assignedSite: effectiveSite,
          preferredLocations: effectiveLocations,
          defaultLandingPage: defaultLandingPage,
          allowedTabs: effectiveTabs,
          assignedApps: legacyApps,
        };
        if (password.trim() !== '') {
          updateData.password = hashPassword(password);
        }
        await updateDoc(doc(db, 'users', editingUser.id), updateData);
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
          assignedSite: effectiveSite,
          preferredLocations: effectiveLocations,
          defaultLandingPage: defaultLandingPage,
          allowedTabs: effectiveTabs,
          assignedApps: legacyApps,
          createdAt: new Date().toISOString(),
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

  const handleDelete = async (id: string, userEmail: string) => {
    if (user?.email === userEmail) {
      toast({ variant: 'destructive', title: 'Cannot delete yourself' });
      return;
    }
    if (confirm(`Are you sure you want to delete ${userEmail}?`)) {
      try {
        await deleteDoc(doc(db, 'users', id));
        toast({ title: 'User deleted' });
        loadUsers();
      } catch (err: any) {
        toast({ variant: 'destructive', title: 'Error deleting user', description: err.message });
      }
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
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-black text-gray-900 flex items-center gap-2 tracking-tight">
            <ShieldAlert className="h-6 w-6 text-[#3b2fc9]" />
            Access Control & Users
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Configure granular permissions, company site scoping, allowed tabs, and default landing page after login.
          </p>
        </div>
        <Button onClick={() => handleOpenModal()} className="bg-[#3b2fc9] hover:bg-[#2d23a0] shadow-md shadow-indigo-900/10">
          <Plus className="h-4 w-4 mr-2" /> Add User
        </Button>
      </div>

      {/* Mobile Card List View (md:hidden) */}
      <div className="md:hidden divide-y divide-gray-100 bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-gray-500">
            <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />
            <p className="text-xs">Loading users...</p>
          </div>
        ) : users.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-500">No users found</div>
        ) : (
          users.map((u) => {
            const tabsCount = u.allowedTabs?.length || u.assignedApps?.length || 0;
            const landingPageLabel =
              DEFAULT_LANDING_PAGES.find((p) => p.path === u.defaultLandingPage)?.label ||
              u.defaultLandingPage ||
              '/newrelic/tuckshop';

            return (
              <div key={u.id} className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-gray-900 text-sm truncate">{u.email}</p>
                    <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          u.role === 'admin'
                            ? 'bg-purple-100 text-purple-700'
                            : u.role === 'manager'
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-gray-100 text-gray-700'
                        }`}
                      >
                        {u.role.toUpperCase()}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          u.role === 'admin'
                            ? 'bg-gray-100 text-gray-700'
                            : u.assignedSite === 'dsm'
                            ? 'bg-cyan-100 text-cyan-800'
                            : u.assignedSite === 'ntt_data'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-indigo-100 text-[#3b2fc9]'
                        }`}
                      >
                        {u.role === 'admin'
                          ? 'All Sites'
                          : COMPANY_SITES[u.assignedSite || 'newrelic']?.name || 'NewRelic'}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleOpenModal(u)}>
                      <Edit2 className="h-4 w-4 text-gray-500 hover:text-[#3b2fc9]" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => handleDelete(u.id, u.email)}
                      disabled={u.email === user?.email}
                    >
                      <Trash2
                        className={`h-4 w-4 ${
                          u.email === user?.email ? 'text-gray-300' : 'text-gray-500 hover:text-red-600'
                        }`}
                      />
                    </Button>
                  </div>
                </div>

                {/* Details Badges */}
                <div className="space-y-1.5 text-xs bg-gray-50 p-2.5 rounded-xl border border-gray-150">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-gray-500 font-semibold flex items-center gap-1">
                      <Compass className="w-3 h-3 text-[#3b2fc9]" /> Default Landing
                    </span>
                    <span className="font-bold text-[#3b2fc9] truncate max-w-[190px]">
                      {landingPageLabel}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] pt-1 border-t border-gray-200/60">
                    <span className="text-gray-500 font-semibold">Active Tabs</span>
                    {u.role === 'admin' ? (
                      <span className="text-purple-700 font-bold">Unrestricted (All)</span>
                    ) : (
                      <span className="font-semibold text-gray-700">{tabsCount} Modules Active</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Desktop Table (hidden md:block) */}
      <div className="hidden md:block bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <Table className="min-w-[850px]">
            <TableHeader>
              <TableRow className="bg-gray-50/80">
                <TableHead className="font-bold">Email</TableHead>
                <TableHead className="font-bold">Role</TableHead>
                <TableHead className="font-bold">Assigned Site</TableHead>
                <TableHead className="font-bold">Default Landing Page</TableHead>
                <TableHead className="font-bold">Allowed Tabs</TableHead>
                <TableHead className="text-right font-bold">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center text-gray-500">
                    <Loader2 className="h-5 w-5 animate-spin mx-auto" />
                  </TableCell>
                </TableRow>
              ) : users.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center text-gray-500">
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

                  return (
                    <TableRow key={u.id} className="hover:bg-gray-50/50">
                      <TableCell className="font-bold text-gray-900">{u.email}</TableCell>
                      <TableCell>
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                            u.role === 'admin'
                              ? 'bg-purple-100 text-purple-700'
                              : u.role === 'manager'
                              ? 'bg-emerald-100 text-emerald-700'
                              : 'bg-gray-100 text-gray-700'
                          }`}
                        >
                          {u.role.toUpperCase()}
                        </span>
                      </TableCell>
                      <TableCell>
                        {u.role === 'admin' ? (
                          <span className="text-xs text-gray-500 font-semibold">Multi-Site (All)</span>
                        ) : (
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                              u.assignedSite === 'dsm'
                                ? 'bg-cyan-50 text-cyan-700 border border-cyan-200'
                                : u.assignedSite === 'ntt_data'
                                ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                : 'bg-indigo-50 text-[#3b2fc9] border border-indigo-100'
                            }`}
                          >
                            {COMPANY_SITES[u.assignedSite || 'newrelic']?.name || 'NewRelic'}
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5 text-xs text-gray-800 font-medium">
                          <Compass className="w-3.5 h-3.5 text-[#3b2fc9] shrink-0" />
                          <span className="truncate max-w-[200px]" title={u.defaultLandingPage}>
                            {landingLabel}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {u.role === 'admin' ? (
                          <span className="text-xs text-purple-700 font-bold">Unrestricted Access</span>
                        ) : u.allowedTabs && u.allowedTabs.length > 0 ? (
                          <div className="flex items-center gap-1 flex-wrap max-w-xs">
                            <span className="px-2 py-0.5 rounded-md bg-indigo-50 text-[#3b2fc9] border border-indigo-100 text-[11px] font-bold">
                              {u.allowedTabs.length} Modules Allowed
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs text-amber-600 font-medium">Standard Ops</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleOpenModal(u)}
                          title="Edit Permissions"
                        >
                          <Edit2 className="h-4 w-4 text-gray-500 hover:text-[#3b2fc9]" />
                        </Button>
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
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* ── MODAL: User Details, Scopes, Presets & Categorized Permissions ── */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg font-black tracking-tight text-gray-900">
              {editingUser ? 'Edit User & Permissions' : 'Add New User'}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSaveUser} className="space-y-5 pt-3">
            {/* Account Credentials */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-gray-700">Email Address</Label>
                <Input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={!!editingUser}
                  className={editingUser ? 'bg-gray-100' : ''}
                  placeholder="user@gutguru.com"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-gray-700">
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

            {/* Role & Site Assignment */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-gray-700">Role Level</Label>
                <Select value={userRole} onValueChange={(v) => setUserRole(v as UserRole)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="user">User (Operational Staff)</SelectItem>
                    <SelectItem value="manager">Manager (Operations + Reconcile)</SelectItem>
                    <SelectItem value="admin">Admin (Unrestricted Master Access)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {userRole !== 'admin' && (
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-gray-700">Assigned Company Site</Label>
                  <Select value={assignedSite} onValueChange={(v) => handleSiteChange(v as SiteId)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="newrelic">NewRelic (HYD & BLR · Challans Enabled)</SelectItem>
                      <SelectItem value="dsm">DSM (Hyderabad Only · Tuckshop & Attendance)</SelectItem>
                      <SelectItem value="ntt_data">NTT Data (Hyderabad Only · Tuckshop & Attendance)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            {assignedSite !== 'newrelic' && userRole !== 'admin' && (
              <div className="text-[11px] text-amber-800 bg-amber-50 p-2.5 rounded-xl border border-amber-200">
                📍 <strong>{COMPANY_SITES[assignedSite]?.name}</strong> is strictly restricted to{' '}
                <strong>Hyderabad</strong> stall operations. The dedicated NewRelic Delivery Challans system is
                hidden and forbidden.
              </div>
            )}

            {/* Role Presets (1-Click Configuration) */}
            <div className="space-y-2 p-3 bg-gradient-to-r from-indigo-50/70 to-purple-50/70 rounded-xl border border-indigo-100">
              <div className="flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-[#3b2fc9]" />
                <Label className="text-xs font-black text-indigo-950 uppercase tracking-wider">
                  Quick Role Presets (Auto-fills Landing Page & Tabs)
                </Label>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {ROLE_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => handleApplyPreset(preset)}
                    className="text-xs px-2.5 py-1 rounded-lg border bg-white hover:bg-indigo-600 hover:text-white border-indigo-200 font-semibold text-indigo-900 transition-all shadow-2xs active:scale-95"
                    title={preset.description}
                  >
                    {preset.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Default Landing Page after Login */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-bold text-gray-800 flex items-center gap-1.5">
                  <Compass className="w-3.5 h-3.5 text-[#3b2fc9]" />
                  Default Landing Page After Login
                </Label>
                <span className="text-[11px] text-gray-400">Users redirect here immediately upon signing in</span>
              </div>
              <Select value={defaultLandingPage} onValueChange={setDefaultLandingPage}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DEFAULT_LANDING_PAGES.map((page) => {
                    const isNewRelicDC = page.path === '/newrelic';
                    const disabled = isNewRelicDC && assignedSite !== 'newrelic' && userRole !== 'admin';
                    return (
                      <SelectItem key={page.path} value={page.path} disabled={disabled}>
                        <span className="font-semibold text-gray-900">{page.label}</span>{' '}
                        <span className="text-gray-400 text-xs font-mono ml-2">({page.path})</span>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            {/* Preferred Locations */}
            <div className="space-y-2 pt-1">
              <Label className="text-xs font-bold text-gray-700">Allowed / Preferred Locations</Label>
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
                  <label htmlFor="loc-hyd" className="text-xs font-semibold leading-none text-gray-700">
                    Hyderabad{' '}
                    {assignedSite !== 'newrelic' && userRole !== 'admin' && (
                      <span className="text-[10px] text-emerald-600 font-normal">(Locked)</span>
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
                    className={`text-xs font-semibold leading-none ${
                      assignedSite !== 'newrelic' && userRole !== 'admin' ? 'text-gray-400' : 'text-gray-700'
                    }`}
                  >
                    Bangalore{' '}
                    {assignedSite !== 'newrelic' && userRole !== 'admin' && (
                      <span className="text-[10px] text-gray-400 font-normal">(Unavailable for this site)</span>
                    )}
                  </label>
                </div>
              </div>
            </div>

            {/* Categorized Granular Tab Permissions */}
            {userRole !== 'admin' && (
              <div className="space-y-4 pt-2 border-t border-gray-100">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-black uppercase tracking-wider text-gray-900">
                    Tab & Endpoint Permissions
                  </Label>
                  <span className="text-[11px] text-gray-500">
                    {allowedTabs.length} tabs actively enabled
                  </span>
                </div>

                <div className="space-y-4">
                  {PERMISSION_CATEGORIES.map((category) => (
                    <div
                      key={category.id}
                      className="p-3.5 rounded-xl border border-gray-200 bg-gray-50/50 space-y-2.5"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="text-xs font-bold text-gray-900">{category.name}</h4>
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${category.badgeColor}`}
                            >
                              {category.items.length} Modules
                            </span>
                          </div>
                          <p className="text-[11px] text-gray-500 mt-0.5">{category.description}</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                        {category.items.map((item) => {
                          const isBlockedForSite =
                            item.newRelicOnly && assignedSite !== 'newrelic';
                          const isChecked = allowedTabs.includes(item.id) && !isBlockedForSite;

                          return (
                            <div
                              key={item.id}
                              className={`p-2.5 rounded-lg border transition-all ${
                                isBlockedForSite
                                  ? 'bg-gray-100/70 border-gray-200 opacity-60'
                                  : isChecked
                                  ? 'bg-white border-[#3b2fc9]/40 shadow-2xs'
                                  : 'bg-white border-gray-200 hover:border-gray-300'
                              }`}
                            >
                              <div className="flex items-start space-x-2">
                                <Checkbox
                                  id={`tab-${item.id}`}
                                  checked={isChecked}
                                  disabled={isBlockedForSite}
                                  onCheckedChange={(checked) =>
                                    handleToggleTab(item.id, Boolean(checked))
                                  }
                                  className="mt-0.5"
                                />
                                <div className="space-y-0.5 flex-1 min-w-0">
                                  <label
                                    htmlFor={`tab-${item.id}`}
                                    className={`text-xs font-bold block cursor-pointer ${
                                      isBlockedForSite ? 'text-gray-400' : 'text-gray-900'
                                    }`}
                                  >
                                    {item.label}
                                  </label>
                                  <p className="text-[10px] text-gray-500 leading-tight">
                                    {isBlockedForSite
                                      ? 'Forbidden: Dedicated to NewRelic site only.'
                                      : item.description}
                                  </p>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <DialogFooter className="mt-6 pt-3 border-t border-gray-100">
              <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                className="bg-[#3b2fc9] hover:bg-[#2d23a0] shadow-md shadow-indigo-900/10"
                disabled={isSubmitting}
              >
                {isSubmitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                {editingUser ? 'Save Changes' : 'Create User'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
