'use client';

import React, { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  User,
  Mail,
  Phone,
  MapPin,
  Building2,
  Shield,
  Calendar,
  Clock,
  CheckCircle2,
  AlertCircle,
  LogOut,
  ArrowLeft,
  RefreshCw,
  Briefcase,
  Camera,
  ExternalLink,
  ChevronRight,
  Sparkles,
  Palette,
  Check,
  Globe,
  RotateCcw,
  Building,
  Flame,
  Zap,
  Sliders,
  Play,
  Waves,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useThemeBackdrop, useMotionFx, ThemeOption } from '@/contexts/ThemeBackdropContext';
import { db } from '@/lib/firebase';
import { collection, getDocs, doc, getDoc } from 'firebase/firestore';
import { COMPANY_SITES, SiteId } from '@/types/site';
import { NewRelicEmployee, NewRelicAttendance } from '@/types/employee';
import { getTodayAttendance } from '@/services/newrelicAttendanceService';
import { triggerHaptic } from '@/lib/haptics';
import { useToast } from '@/hooks/use-toast';

export default function ProfilePage() {
  const router = useRouter();
  const { user, role, signOut, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const {
    theme,
    companyDefaultTheme,
    isPersonalOverride,
    setPersonalTheme,
    resetToCompanyDefault,
    setCompanyDefaultTheme,
    themes,
    isSyncing,
  } = useThemeBackdrop();

  const {
    motionFx,
    updateMotionFx,
    resetMotionFx,
    triggerActionBurst,
    triggerCosmicRipple,
  } = useMotionFx();

  const [themeCategory, setThemeCategory] = useState<'all' | 'pro' | 'crazy'>('all');

  const isAdmin = role === 'admin' || role === 'superadmin';
  const companyDefaultThemeName = themes.find((t) => t.id === companyDefaultTheme)?.name || 'Ambient Orbs & Aurora';
  const currentThemeName = themes.find((t) => t.id === theme)?.name || 'Theme';

  const filteredThemes = useMemo(() => {
    if (themeCategory === 'all') return themes;
    return themes.filter((t) => t.category === themeCategory);
  }, [themes, themeCategory]);

  const [employee, setEmployee] = useState<NewRelicEmployee | null>(null);
  const [todayAttendance, setTodayAttendance] = useState<NewRelicAttendance | null>(null);
  const [accountDetails, setAccountDetails] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSigningOut, setIsSigningOut] = useState(false);

  const site = user?.assignedSite || 'newrelic';
  const siteConfig = COMPANY_SITES[site] || COMPANY_SITES.newrelic;

  const initials = user?.email
    ? user.email.substring(0, 2).toUpperCase()
    : 'GG';

  const loadProfileData = async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      // 1. Fetch detailed user doc from 'users' collection
      if (user.id) {
        try {
          const userDocSnap = await getDoc(doc(db, 'users', user.id));
          if (userDocSnap.exists()) {
            setAccountDetails(userDocSnap.data());
          }
        } catch (e) {
          console.warn('Could not fetch user document:', e);
        }
      }

      // 2. Search newrelic_employees roster for matching employee
      const employeesSnap = await getDocs(collection(db, 'newrelic_employees'));
      const userEmailLower = (user.email || '').toLowerCase().trim();

      const matchedDoc = employeesSnap.docs.find((d) => {
        const data = d.data();
        const empEmail = (data.email || '').toLowerCase().trim();
        return (
          (user.id && data.userId === user.id) ||
          (userEmailLower && empEmail && empEmail === userEmailLower)
        );
      });

      if (matchedDoc) {
        const empData = { id: matchedDoc.id, ...matchedDoc.data() } as NewRelicEmployee;
        setEmployee(empData);

        // 3. Fetch today's attendance record
        const todayStr = new Date().toISOString().substring(0, 10);
        const att = await getTodayAttendance(matchedDoc.id, todayStr);
        setTodayAttendance(att);
      }
    } catch (err) {
      console.error('Error loading profile data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/login');
    } else if (user) {
      loadProfileData();
    }
  }, [user, authLoading, router]);

  const handleSignOut = async () => {
    triggerHaptic('medium');
    setIsSigningOut(true);
    toast({
      title: 'Signing out...',
      description: 'Clearing your session securely.',
    });
    try {
      await signOut();
    } catch (e) {
      console.error(e);
      window.location.href = '/login';
    }
  };

  const isCheckedIn = Boolean(todayAttendance?.checkIn?.time);
  const isCheckedOut = Boolean(todayAttendance?.checkOut?.time);

  return (
    <div className="min-h-screen bg-transparent p-3 sm:p-8 pb-[max(6rem,env(safe-area-inset-bottom))]">
      <div className="max-w-3xl mx-auto space-y-5">
        {/* Top Navigation / Back Bar with Category Badge */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                triggerHaptic('light');
                if (window.history.length > 1) {
                  router.back();
                } else {
                  router.push('/newrelic');
                }
              }}
              className="flex items-center gap-1.5 text-xs font-bold theme-text-primary theme-card px-3 py-2 rounded-2xl shadow-2xs active:scale-95 transition-all cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back</span>
            </button>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full theme-card-subtle theme-text-primary text-[10px] sm:text-xs font-black tracking-widest uppercase shadow-xs">
              <Sparkles className="h-3 w-3 animate-pulse text-[var(--theme-accent)]" />
              STAFF PROFILE
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              triggerHaptic('light');
              loadProfileData();
              toast({ title: 'Profile refreshed' });
            }}
            disabled={isLoading}
            className="flex items-center gap-1.5 text-xs font-bold theme-text-primary theme-card-subtle px-3.5 py-2 rounded-2xl active:scale-95 transition-all cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-[var(--theme-accent)] ${isLoading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>

        {/* Main Profile Identity Card */}
        <div className="relative rounded-3xl bg-gradient-to-br from-[#181156] via-[#241775] to-[#3b2fc9] p-6 text-white shadow-xl overflow-hidden">
          <div className="absolute -right-8 -top-8 w-40 h-40 bg-indigo-400/20 rounded-full blur-2xl pointer-events-none" />
          <div className="absolute right-20 -bottom-8 w-32 h-32 bg-amber-400/15 rounded-full blur-2xl pointer-events-none" />

          <div className="relative z-10 flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-5">
          {/* Avatar / Selfie Photo */}
          <div className="relative">
            {employee?.profilePhotoUrl || todayAttendance?.checkIn?.selfieUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={employee?.profilePhotoUrl || todayAttendance?.checkIn?.selfieUrl}
                alt="Profile photo"
                className="w-20 h-20 rounded-2xl object-cover border-2 border-white/40 shadow-lg bg-black/20"
              />
            ) : (
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-tr from-amber-400 to-orange-500 text-white flex items-center justify-center font-black text-2xl shadow-lg border-2 border-white/30">
                {initials}
              </div>
            )}
            <span className="absolute -bottom-1.5 -right-1.5 w-6 h-6 rounded-full bg-emerald-500 border-2 border-[#181156] flex items-center justify-center shadow-xs">
              <span className="w-2 h-2 rounded-full bg-white" />
            </span>
          </div>

          <div className="flex-1 min-w-0 space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white truncate">
                {employee?.name || user?.email?.split('@')[0] || 'User Profile'}
              </h1>
              <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-amber-400/20 text-amber-300 border border-amber-300/30">
                {role || 'User'}
              </span>
            </div>

            <p className="text-xs text-indigo-100/90 font-medium truncate flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5 text-indigo-300" />
              {user?.email}
            </p>

            <div className="flex items-center gap-2 pt-1 flex-wrap text-xs text-indigo-200">
              <span className="flex items-center gap-1 bg-white/10 px-2 py-0.5 rounded-lg border border-white/10">
                <Building2 className="w-3 h-3 text-amber-300" />
                {siteConfig.name} Stall
              </span>
              {employee?.location && (
                <span className="flex items-center gap-1 bg-white/10 px-2 py-0.5 rounded-lg border border-white/10 capitalize">
                  <MapPin className="w-3 h-3 text-emerald-300" />
                  {employee.location}
                </span>
              )}
              {employee?.employeeId && (
                <span className="bg-white/10 px-2 py-0.5 rounded-lg border border-white/10 font-mono text-[11px]">
                  ID: {employee.employeeId}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Today's Attendance Quick Status Card */}
      <div className="theme-card rounded-2xl p-4 sm:p-5 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-[var(--theme-accent)]" />
            <h2 className="text-sm font-bold theme-text-primary">Today&apos;s Attendance Status</h2>
          </div>
          <Link
            href="/newrelic/attendance"
            className="text-xs font-bold text-[var(--theme-accent)] hover:underline flex items-center gap-1"
          >
            <span>Attendance Hub</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          {/* Check-In Status */}
          <div
            className={`p-3.5 rounded-xl border flex items-center justify-between gap-3 ${
              isCheckedIn
                ? 'bg-emerald-50/70 border-emerald-200 text-emerald-900'
                : 'bg-amber-50/70 border-amber-200 text-amber-900'
            }`}
          >
            <div className="flex items-center gap-3 min-w-0">
              <div
                className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                  isCheckedIn ? 'bg-emerald-500 text-white' : 'bg-amber-500 text-white'
                }`}
              >
                {isCheckedIn ? <CheckCircle2 className="w-5 h-5" /> : <Clock className="w-5 h-5" />}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold truncate">
                  {isCheckedIn ? 'Checked In' : 'Check-In Pending'}
                </p>
                <p className="text-[11px] opacity-80 truncate">
                  {todayAttendance?.checkIn?.time
                    ? new Date(todayAttendance.checkIn.time).toLocaleTimeString('en-IN', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })
                    : 'Not marked yet today'}
                </p>
              </div>
            </div>

            {!isCheckedIn && (
              <Link
                href="/newrelic/attendance"
                className="px-2.5 py-1 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shrink-0 shadow-2xs active:scale-95"
              >
                Clock In
              </Link>
            )}
          </div>

          {/* Check-Out Status */}
          <div
            className={`p-3.5 rounded-xl border flex items-center justify-between gap-3 ${
              isCheckedOut
                ? 'bg-blue-50/70 border-blue-200 text-blue-900'
                : 'bg-gray-50 border-gray-200 text-gray-700'
            }`}
          >
            <div className="flex items-center gap-3 min-w-0">
              <div
                className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                  isCheckedOut ? 'bg-blue-500 text-white' : 'bg-gray-300 text-gray-600'
                }`}
              >
                <Clock className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold truncate">
                  {isCheckedOut ? 'Checked Out' : 'Check-Out'}
                </p>
                <p className="text-[11px] opacity-80 truncate">
                  {todayAttendance?.checkOut?.time
                    ? new Date(todayAttendance.checkOut.time).toLocaleTimeString('en-IN', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })
                    : isCheckedIn
                    ? 'Shift currently active'
                    : 'Awaiting check-in'}
                </p>
              </div>
            </div>

            {isCheckedIn && !isCheckedOut && (
              <Link
                href="/newrelic/attendance"
                className="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shrink-0 shadow-2xs active:scale-95"
              >
                Clock Out
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Staff Roster Details (If linked) */}
      {employee && (
        <div className="theme-card rounded-2xl p-4 sm:p-5 shadow-xs space-y-3">
          <div className="flex items-center gap-2">
            <Briefcase className="w-4 h-4 text-[var(--theme-accent)]" />
            <h2 className="text-sm font-bold theme-text-primary">Employment Details</h2>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-1">
            <div className="theme-card-subtle p-3 rounded-xl">
              <span className="text-[10px] font-bold theme-text-muted uppercase tracking-wider block">
                Designation
              </span>
              <p className="text-xs font-bold theme-text-primary mt-0.5">{employee.designation || 'Staff'}</p>
            </div>

            <div className="theme-card-subtle p-3 rounded-xl">
              <span className="text-[10px] font-bold theme-text-muted uppercase tracking-wider block">
                Phone Number
              </span>
              <p className="text-xs font-bold theme-text-primary mt-0.5">{employee.phone || '—'}</p>
            </div>

            <div className="theme-card-subtle p-3 rounded-xl">
              <span className="text-[10px] font-bold theme-text-muted uppercase tracking-wider block">
                Date Joined
              </span>
              <p className="text-xs font-bold theme-text-primary mt-0.5">
                {employee.joinDate
                  ? new Date(employee.joinDate).toLocaleDateString('en-IN')
                  : '—'}
              </p>
            </div>

            <div className="theme-card-subtle p-3 rounded-xl">
              <span className="text-[10px] font-bold theme-text-muted uppercase tracking-wider block">
                Roster Status
              </span>
              <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-500 mt-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                {employee.isActive !== false ? 'Active Employee' : 'Inactive'}
              </span>
            </div>

            <div className="theme-card-subtle p-3 rounded-xl">
              <span className="text-[10px] font-bold theme-text-muted uppercase tracking-wider block">
                Cafeteria Site
              </span>
              <p className="text-xs font-bold theme-text-primary mt-0.5">{siteConfig.name}</p>
            </div>

            <div className="theme-card-subtle p-3 rounded-xl">
              <span className="text-[10px] font-bold theme-text-muted uppercase tracking-wider block">
                Location
              </span>
              <p className="text-xs font-bold theme-text-primary mt-0.5 capitalize">{employee.location}</p>
            </div>
          </div>
        </div>
      )}

      {/* ── App Theme & Backdrops Picker (Mode B: Company Default + Personal Choice) ── */}
      <div className="theme-card rounded-2xl p-4 sm:p-5 shadow-xs space-y-4">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl theme-btn-primary flex items-center justify-center shadow-xs">
              <Palette className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold theme-text-primary">App Backdrop & Theme</h2>
              <p className="text-[11px] theme-text-muted">
                {isPersonalOverride
                  ? 'Personal choice active on this device'
                  : `Syncing with Company Default (${companyDefaultThemeName})`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {isPersonalOverride ? (
              <button
                type="button"
                onClick={() => {
                  triggerHaptic('light');
                  resetToCompanyDefault();
                  toast({
                    title: 'Switched to Company Default',
                    description: `Now following official company theme (${companyDefaultThemeName}).`,
                  });
                }}
                className="flex items-center gap-1.5 text-[11px] font-bold theme-badge px-2.5 py-1 rounded-xl transition-all active:scale-95 cursor-pointer shadow-2xs"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset to Company Default</span>
              </button>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 shadow-2xs">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Following Company Default
              </span>
            )}
          </div>
        </div>

        {/* Admin Organization Sync Action Banner */}
        {isAdmin && (
          <div className="p-3 sm:p-3.5 rounded-xl bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-indigo-500/10 border border-amber-300/40 dark:border-amber-600/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-2.5">
              <Building className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-xs font-bold text-gray-900 dark:text-white">
                  Admin Control: Company-Wide Default
                </p>
                <p className="text-[11px] text-gray-600 dark:text-gray-300 mt-0.5">
                  Official Default is <strong className="text-amber-700 dark:text-amber-300 font-bold">{companyDefaultThemeName}</strong>. You can publish your active theme to all employee apps.
                </p>
              </div>
            </div>

            <button
              type="button"
              disabled={isSyncing || theme === companyDefaultTheme}
              onClick={async () => {
                triggerHaptic('medium');
                try {
                  await setCompanyDefaultTheme(theme, user?.email);
                  toast({
                    title: 'Company Default Published!',
                    description: `"${currentThemeName}" is now the default theme for all team members.`,
                  });
                } catch {
                  toast({
                    variant: 'destructive',
                    title: 'Failed to update',
                    description: 'Could not update company default theme.',
                  });
                }
              }}
              className={`shrink-0 flex items-center justify-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-xl transition-all shadow-xs active:scale-95 cursor-pointer ${
                theme === companyDefaultTheme
                  ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700 cursor-default'
                  : 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white'
              }`}
            >
              <Globe className="w-3.5 h-3.5" />
              <span>
                {theme === companyDefaultTheme
                  ? 'Active Is Company Default'
                  : isSyncing
                  ? 'Publishing...'
                  : `Publish "${currentThemeName}" to All Users`}
              </span>
            </button>
          </div>
        )}

        {/* Category Tabs Filter */}
        <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100/90 dark:bg-slate-800/80 border border-slate-200/70 dark:border-slate-700/60">
          <button
            type="button"
            onClick={() => {
              triggerHaptic('light');
              setThemeCategory('all');
            }}
            className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-bold transition-all text-center cursor-pointer ${
              themeCategory === 'all'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs'
                : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
            }`}
          >
            All (10)
          </button>
          <button
            type="button"
            onClick={() => {
              triggerHaptic('light');
              setThemeCategory('pro');
            }}
            className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 cursor-pointer ${
              themeCategory === 'pro'
                ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-2xs'
                : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
            }`}
          >
            <span>🏢 Pro (5)</span>
          </button>
          <button
            type="button"
            onClick={() => {
              triggerHaptic('light');
              setThemeCategory('crazy');
            }}
            className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 cursor-pointer ${
              themeCategory === 'crazy'
                ? 'bg-gradient-to-r from-pink-500 to-rose-600 text-white shadow-xs'
                : 'text-rose-500 hover:text-rose-600 dark:text-rose-400'
            }`}
          >
            <Flame className="w-3.5 h-3.5 fill-current" />
            <span>🔥 Crazy (5)</span>
          </button>
        </div>

        {/* Theme Option Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
          {filteredThemes.map((opt: ThemeOption) => {
            const isSelected = theme === opt.id;
            const isCompanyDefault = companyDefaultTheme === opt.id;

            return (
              <button
                key={opt.id}
                type="button"
                onClick={(e) => {
                  triggerHaptic('medium');
                  triggerCosmicRipple(e.clientX, e.clientY);
                  setPersonalTheme(opt.id);
                  toast({
                    title: `Theme: ${opt.name}`,
                    description: 'Backdrop updated for your device.',
                  });
                }}
                className={`relative flex items-start gap-3 p-3.5 rounded-xl border text-left transition-all active:scale-[0.98] cursor-pointer ${
                  isSelected
                    ? 'theme-card ring-2 ring-[var(--theme-accent)] shadow-lg'
                    : 'theme-card-subtle hover:opacity-95'
                }`}
              >
                {/* Visual Color Swatch */}
                <div className="relative shrink-0 mt-0.5">
                  <div className="w-10 h-10 rounded-xl overflow-hidden border border-black/10 dark:border-white/10 grid grid-cols-2 shadow-2xs">
                    {opt.previewColors.map((color: string, idx: number) => (
                      <div
                        key={idx}
                        className="w-full h-full"
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                  {isSelected && (
                    <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full theme-btn-primary flex items-center justify-center shadow-xs border-2 border-white dark:border-slate-900">
                      <Check className="w-3 h-3 stroke-[3]" />
                    </span>
                  )}
                </div>

                {/* Theme Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1 flex-wrap">
                    <span className={`text-xs font-bold truncate theme-text-primary ${isSelected ? 'font-black' : ''}`}>
                      {opt.name}
                    </span>
                    <div className="flex items-center gap-1 shrink-0">
                      {isCompanyDefault && (
                        <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
                          Company Default
                        </span>
                      )}
                      <span className="text-[9px] font-black uppercase px-1.5 py-0.2 rounded theme-badge">
                        {opt.badge}
                      </span>
                    </div>
                  </div>
                  <p className="text-[11px] font-medium theme-text-muted mt-0.5 line-clamp-1">
                    {opt.subtitle}
                  </p>
                  <p className="text-[10px] theme-text-muted opacity-80 mt-0.5 line-clamp-2">
                    {opt.description}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Animation & Visual FX Studio ── */}
      <div className="theme-card rounded-2xl p-4 sm:p-5 shadow-xs space-y-4">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[var(--theme-accent)]" />
            <div>
              <h2 className="text-sm font-bold theme-text-primary">Motion & Visual FX Studio</h2>
              <p className="text-[11px] theme-text-muted">
                GPU-accelerated interactive animation layers with zero idle battery drain.
              </p>
            </div>
          </div>

          {/* Master FX Toggle Button */}
          <button
            type="button"
            onClick={() => {
              triggerHaptic('medium');
              updateMotionFx({ masterEnabled: !motionFx.masterEnabled });
              toast({
                title: motionFx.masterEnabled ? 'Motion FX Paused' : 'Motion FX Activated',
                description: motionFx.masterEnabled
                  ? 'All animations disabled for maximum battery saving.'
                  : 'Interactive animations and shaders enabled.',
              });
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer shrink-0 ${
              motionFx.masterEnabled
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 shadow-xs'
                : 'bg-slate-200/80 dark:bg-slate-800 text-slate-500 border border-slate-300 dark:border-slate-700'
            }`}
          >
            <Zap className={`w-3.5 h-3.5 ${motionFx.masterEnabled ? 'fill-current' : ''}`} />
            <span>{motionFx.masterEnabled ? 'FX Enabled' : 'Battery Saver (Off)'}</span>
          </button>
        </div>

        {/* Quick Presets Row */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[11px] font-bold theme-text-muted mr-1">Presets:</span>
          <button
            type="button"
            onClick={() => {
              triggerHaptic('light');
              updateMotionFx({
                masterEnabled: true,
                stardustTrail: true,
                shimmerBorders: true,
                actionBursts: true,
                rollingCounters: true,
                cosmicRipple: true,
              });
              toast({ title: 'Full Spectacle Preset Applied' });
            }}
            className="px-2.5 py-1 rounded-lg text-xs font-bold theme-card-subtle theme-text-primary hover:opacity-90 active:scale-95 transition-all cursor-pointer"
          >
            🚀 Full Spectacle
          </button>
          <button
            type="button"
            onClick={() => {
              triggerHaptic('light');
              updateMotionFx({
                masterEnabled: true,
                stardustTrail: false,
                shimmerBorders: true,
                actionBursts: true,
                rollingCounters: true,
                cosmicRipple: true,
              });
              toast({ title: 'Balanced Preset Applied' });
            }}
            className="px-2.5 py-1 rounded-lg text-xs font-bold theme-card-subtle theme-text-primary hover:opacity-90 active:scale-95 transition-all cursor-pointer"
          >
            ⚖️ Balanced
          </button>
          <button
            type="button"
            onClick={() => {
              triggerHaptic('light');
              updateMotionFx({ masterEnabled: false });
              toast({ title: 'Battery Saver Preset Applied' });
            }}
            className="px-2.5 py-1 rounded-lg text-xs font-bold theme-card-subtle theme-text-primary hover:opacity-90 active:scale-95 transition-all cursor-pointer"
          >
            🔋 Battery Saver
          </button>
        </div>

        {/* Individual Toggles Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
          {/* 1. Stardust Trail */}
          <div className="flex items-center justify-between p-3 rounded-xl theme-card-subtle">
            <div className="space-y-0.5 pr-2">
              <span className="text-xs font-bold theme-text-primary flex items-center gap-1.5">
                <span>✨</span> Stardust Touch Trail
              </span>
              <p className="text-[10px] theme-text-muted">
                Glowing theme particles trail behind your finger/cursor (auto-sleeps).
              </p>
            </div>
            <input
              type="checkbox"
              checked={motionFx.masterEnabled && motionFx.stardustTrail}
              disabled={!motionFx.masterEnabled}
              onChange={(e) => updateMotionFx({ stardustTrail: e.target.checked })}
              className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer shrink-0 disabled:opacity-40"
            />
          </div>

          {/* 2. Running Shimmer Borders */}
          <div className="flex items-center justify-between p-3 rounded-xl theme-card-subtle">
            <div className="space-y-0.5 pr-2">
              <span className="text-xs font-bold theme-text-primary flex items-center gap-1.5">
                <span>💫</span> Running Shimmer Borders
              </span>
              <p className="text-[10px] theme-text-muted">
                Rotating gradient neon beams traveling along cards & badges.
              </p>
            </div>
            <input
              type="checkbox"
              checked={motionFx.masterEnabled && motionFx.shimmerBorders}
              disabled={!motionFx.masterEnabled}
              onChange={(e) => updateMotionFx({ shimmerBorders: e.target.checked })}
              className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer shrink-0 disabled:opacity-40"
            />
          </div>

          {/* 3. Action Button Bursts */}
          <div className="flex items-center justify-between p-3 rounded-xl theme-card-subtle">
            <div className="space-y-0.5 pr-2">
              <span className="text-xs font-bold theme-text-primary flex items-center gap-1.5">
                <span>💥</span> Action Tap Bursts
              </span>
              <p className="text-[10px] theme-text-muted">
                Micro-burst sparks when saving challans, check-in, or punches.
              </p>
            </div>
            <input
              type="checkbox"
              checked={motionFx.masterEnabled && motionFx.actionBursts}
              disabled={!motionFx.masterEnabled}
              onChange={(e) => updateMotionFx({ actionBursts: e.target.checked })}
              className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer shrink-0 disabled:opacity-40"
            />
          </div>

          {/* 4. Rolling Number Counters */}
          <div className="flex items-center justify-between p-3 rounded-xl theme-card-subtle">
            <div className="space-y-0.5 pr-2">
              <span className="text-xs font-bold theme-text-primary flex items-center gap-1.5">
                <span>🎰</span> Rolling Number Counters
              </span>
              <p className="text-[10px] theme-text-muted">
                Smooth mechanical odometry ticker rolls for totals and stats.
              </p>
            </div>
            <input
              type="checkbox"
              checked={motionFx.masterEnabled && motionFx.rollingCounters}
              disabled={!motionFx.masterEnabled}
              onChange={(e) => updateMotionFx({ rollingCounters: e.target.checked })}
              className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer shrink-0 disabled:opacity-40"
            />
          </div>

          {/* 5. Cosmic Theme Ripple */}
          <div className="flex items-center justify-between p-3 rounded-xl theme-card-subtle sm:col-span-2">
            <div className="space-y-0.5 pr-2">
              <span className="text-xs font-bold theme-text-primary flex items-center gap-1.5">
                <span>🌊</span> Cosmic Theme Ripple
              </span>
              <p className="text-[10px] theme-text-muted">
                Smooth radial shockwave wave expanding outward across the screen on theme changes.
              </p>
            </div>
            <input
              type="checkbox"
              checked={motionFx.masterEnabled && motionFx.cosmicRipple}
              disabled={!motionFx.masterEnabled}
              onChange={(e) => updateMotionFx({ cosmicRipple: e.target.checked })}
              className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer shrink-0 disabled:opacity-40"
            />
          </div>
        </div>

        {/* Live Test FX Button */}
        <div className="pt-1 flex items-center justify-between gap-3 border-t border-white/10">
          <p className="text-[11px] theme-text-muted">
            Tap to test active animation effects right here:
          </p>
          <button
            type="button"
            onClick={(e) => {
              triggerHaptic('heavy');
              triggerActionBurst(e.clientX, e.clientY);
              triggerCosmicRipple(e.clientX, e.clientY);
              toast({ title: '✨ Spark & Ripple Triggered!' });
            }}
            className="px-3.5 py-1.5 rounded-xl theme-btn-primary text-xs font-bold flex items-center gap-1.5 active:scale-95 transition-all cursor-pointer shrink-0 shadow-md"
          >
            <Play className="w-3 h-3 fill-current" />
            <span>Test FX Now</span>
          </button>
        </div>
      </div>

      {/* Account & Security Information */}
      <div className="theme-card rounded-2xl p-4 sm:p-5 shadow-xs space-y-3">
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-[var(--theme-accent)]" />
          <h2 className="text-sm font-bold theme-text-primary">Account & Security</h2>
        </div>

        <div className="space-y-2.5 text-xs divide-y divide-white/10 dark:divide-white/10">
          <div className="flex items-center justify-between py-1">
            <span className="font-medium theme-text-muted">Account Email</span>
            <span className="font-bold theme-text-primary">{user?.email}</span>
          </div>

          <div className="flex items-center justify-between py-1 pt-2">
            <span className="font-medium theme-text-muted">Access Level</span>
            <span className="font-bold uppercase theme-badge px-2.5 py-0.5 rounded-full">
              {role || 'User'}
            </span>
          </div>

          <div className="flex items-center justify-between py-1 pt-2">
            <span className="font-medium theme-text-muted">Assigned Branch Locations</span>
            <span className="font-bold theme-text-primary">
              {role === 'admin' || role === 'superadmin'
                ? 'All Locations (HYD & BLR)'
                : siteConfig.allowedLocations.map((l) => l.toUpperCase()).join(' & ')}
            </span>
          </div>

          <div className="flex items-center justify-between py-1 pt-2">
            <span className="font-medium theme-text-muted">User ID</span>
            <span className="font-mono text-[11px] theme-text-muted opacity-75">{user?.id || '—'}</span>
          </div>
        </div>
      </div>

      {/* Sign Out Action Card */}
      <div className="pt-2">
        <button
          type="button"
          onClick={handleSignOut}
          disabled={isSigningOut}
          className="w-full flex items-center justify-center gap-2.5 p-4 rounded-2xl bg-red-50 hover:bg-red-100 text-red-600 font-bold text-sm border border-red-200 transition-all active:scale-[0.99] shadow-xs cursor-pointer"
        >
          <LogOut className="w-4 h-4 stroke-[2.2]" />
          <span>{isSigningOut ? 'Signing out...' : 'Sign Out from This Device'}</span>
        </button>
        <p className="text-center text-[11px] text-gray-400 mt-2">
          The Gut Guru Tracker • Session is securely managed on this device
        </p>
      </div>
    </div>
  </div>
  );
}
