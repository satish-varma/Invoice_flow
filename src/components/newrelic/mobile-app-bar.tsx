'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { LogOut, User, Shield, MapPin, X } from 'lucide-react';

import { COMPANY_SITES } from '@/types/site';

interface MobileAppBarProps {
  children?: React.ReactNode;
}

export function MobileAppBar({ children }: MobileAppBarProps) {
  const { user, role, signOut } = useAuth();
  const [showProfileDrawer, setShowProfileDrawer] = useState(false);

  const site = user?.assignedSite || 'newrelic';
  const siteConfig = COMPANY_SITES[site] || COMPANY_SITES.newrelic;
  const hasChallanAccess = role === 'admin' || role === 'superadmin' || site === 'newrelic';

  const initials = user?.email
    ? user.email.substring(0, 2).toUpperCase()
    : 'HB';

  return (
    <>
      {/* ── Native Top App Bar ── */}
      <header className="border-b border-slate-200/70 dark:border-slate-800/80 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl sticky top-0 z-30 shadow-xs safe-top">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between gap-3">
          {/* Brand Logo & Name */}
          <Link
            href={hasChallanAccess ? '/newrelic' : '/newrelic/tuckshop'}
            className="flex items-center gap-2.5 active:opacity-80 transition-opacity"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/gut_guru_logo.png"
              alt="The Gut Guru Tracker"
              className="h-8 w-8 rounded-full object-contain shadow-xs border border-amber-900/10"
            />
            <div className="flex flex-col">
              <span className="text-xs font-black tracking-tight text-gray-900 leading-none">
                The Gut Guru Tracker
              </span>
              <span className="text-[10px] text-gray-400 font-medium truncate max-w-[150px]">
                {role === 'admin' ? 'Multi-Site DC Portal' : `${siteConfig.name} Portal`}
              </span>
            </div>
          </Link>

          {/* Right Action Icons & Profile Avatar */}
          <div className="flex items-center gap-2">
            {children}

            {/* Profile Avatar Button -> Navigates to Profile Page */}
            <Link
              href="/profile"
              className="w-8 h-8 rounded-full bg-gradient-to-tr from-[#3b2fc9] to-[#6366f1] text-white flex items-center justify-center font-bold text-xs shadow-xs border border-white active:scale-95 transition-transform"
              aria-label="User Profile"
              title="View your profile details"
            >
              {initials}
            </Link>
          </div>
        </div>
      </header>

      {/* ── Native Profile Bottom Sheet / Drawer ── */}
      {showProfileDrawer && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-xs transition-opacity animate-in fade-in"
            onClick={() => setShowProfileDrawer(false)}
          />

          <div className="relative bg-white rounded-t-3xl p-6 pb-10 shadow-2xl space-y-5 animate-in slide-in-from-bottom duration-200">
            {/* Handle */}
            <div className="w-12 h-1.5 bg-gray-300 rounded-full mx-auto" />

            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-gray-900">Account Details</h3>
              <button
                onClick={() => setShowProfileDrawer(false)}
                className="p-1.5 rounded-full hover:bg-gray-100 text-gray-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* User Profile Card */}
            <div className="bg-gradient-to-br from-indigo-50/60 to-purple-50/60 border border-indigo-100/80 p-4 rounded-2xl flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-[#3b2fc9] text-white flex items-center justify-center font-bold text-base shadow-sm">
                {initials}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-gray-900 truncate">{user?.email}</p>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  <span className="text-[10px] bg-white border border-indigo-200 text-[#3b2fc9] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1">
                    <Shield className="w-2.5 h-2.5" />
                    {role || 'User'}
                  </span>
                  <span className="text-[11px] text-gray-600 font-medium flex items-center gap-1 capitalize">
                    <MapPin className="w-3 h-3 text-indigo-500" />
                    {role === 'admin' ? 'All Locations' : `${siteConfig.name} · ${siteConfig.allowedLocations.join(' & ')}`}
                  </span>
                </div>
              </div>
            </div>

            {/* Sign Out Button */}
            <button
              onClick={() => {
                setShowProfileDrawer(false);
                signOut();
              }}
              className="w-full flex items-center justify-center gap-2 p-3.5 rounded-2xl bg-red-50 hover:bg-red-100 text-red-600 font-bold text-sm border border-red-100 transition-colors active:scale-[0.99]"
            >
              <LogOut className="w-4 h-4" />
              Sign Out from Device
            </button>
          </div>
        </div>
      )}
    </>
  );
}
