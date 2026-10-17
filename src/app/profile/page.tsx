'use client';

import React, { useEffect, useState } from 'react';
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
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
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
    <div className="min-h-screen bg-slate-50/60 dark:bg-slate-950 p-3 sm:p-8 pb-[max(6rem,env(safe-area-inset-bottom))]">
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
              className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-3 py-2 rounded-2xl shadow-2xs active:scale-95 transition-all"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back</span>
            </button>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-gradient-to-r from-indigo-500/10 via-purple-500/10 to-indigo-500/10 border border-indigo-500/20 text-indigo-600 dark:text-indigo-400 text-[10px] sm:text-xs font-black tracking-widest uppercase shadow-xs">
              <Sparkles className="h-3 w-3 animate-pulse" />
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
            className="flex items-center gap-1.5 text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/50 px-3.5 py-2 rounded-2xl active:scale-95 transition-all"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
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
      <div className="bg-white rounded-2xl border border-gray-150 p-4 sm:p-5 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-[#3b2fc9]" />
            <h2 className="text-sm font-bold text-gray-900">Today&apos;s Attendance Status</h2>
          </div>
          <Link
            href="/newrelic/attendance"
            className="text-xs font-bold text-[#3b2fc9] hover:underline flex items-center gap-1"
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
        <div className="bg-white rounded-2xl border border-gray-150 p-4 sm:p-5 shadow-xs space-y-3">
          <div className="flex items-center gap-2">
            <Briefcase className="w-4 h-4 text-[#3b2fc9]" />
            <h2 className="text-sm font-bold text-gray-900">Employment Details</h2>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-1">
            <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
                Designation
              </span>
              <p className="text-xs font-bold text-gray-800 mt-0.5">{employee.designation || 'Staff'}</p>
            </div>

            <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
                Phone Number
              </span>
              <p className="text-xs font-bold text-gray-800 mt-0.5">{employee.phone || '—'}</p>
            </div>

            <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
                Date Joined
              </span>
              <p className="text-xs font-bold text-gray-800 mt-0.5">
                {employee.joinDate
                  ? new Date(employee.joinDate).toLocaleDateString('en-IN')
                  : '—'}
              </p>
            </div>

            <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
                Roster Status
              </span>
              <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 mt-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                {employee.isActive !== false ? 'Active Employee' : 'Inactive'}
              </span>
            </div>

            <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
                Cafeteria Site
              </span>
              <p className="text-xs font-bold text-gray-800 mt-0.5">{siteConfig.name}</p>
            </div>

            <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
                Location
              </span>
              <p className="text-xs font-bold text-gray-800 mt-0.5 capitalize">{employee.location}</p>
            </div>
          </div>
        </div>
      )}

      {/* Account & Security Information */}
      <div className="bg-white rounded-2xl border border-gray-150 p-4 sm:p-5 shadow-xs space-y-3">
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-[#3b2fc9]" />
          <h2 className="text-sm font-bold text-gray-900">Account & Security</h2>
        </div>

        <div className="space-y-2.5 text-xs text-gray-600 divide-y divide-gray-100">
          <div className="flex items-center justify-between py-1">
            <span className="font-medium text-gray-500">Account Email</span>
            <span className="font-bold text-gray-900">{user?.email}</span>
          </div>

          <div className="flex items-center justify-between py-1 pt-2">
            <span className="font-medium text-gray-500">Access Level</span>
            <span className="font-bold uppercase text-[#3b2fc9] bg-indigo-50 px-2.5 py-0.5 rounded-full border border-indigo-200">
              {role || 'User'}
            </span>
          </div>

          <div className="flex items-center justify-between py-1 pt-2">
            <span className="font-medium text-gray-500">Assigned Branch Locations</span>
            <span className="font-bold text-gray-900">
              {role === 'admin' || role === 'superadmin'
                ? 'All Locations (HYD & BLR)'
                : siteConfig.allowedLocations.map((l) => l.toUpperCase()).join(' & ')}
            </span>
          </div>

          <div className="flex items-center justify-between py-1 pt-2">
            <span className="font-medium text-gray-500">User ID</span>
            <span className="font-mono text-[11px] text-gray-400">{user?.id || '—'}</span>
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
