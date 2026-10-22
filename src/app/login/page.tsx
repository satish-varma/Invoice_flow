'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { signIn } from 'next-auth/react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Lock, Sparkles, ShieldAlert, AlertTriangle, Clock } from 'lucide-react';
import { triggerHaptic } from '@/lib/haptics';

import { checkUserCheckedInToday } from '@/services/newrelicAttendanceService';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const errorParam = searchParams.get('error');
  const { toast } = useToast();
  const { user, loading: authLoading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  // If already logged in, check if today's check-in has happened
  useEffect(() => {
    if (user) {
      if (user.role === 'guest') {
        router.replace(user.defaultLandingPage || '/delivery-challan');
        return;
      }
      checkUserCheckedInToday(user.id, user.email).then((checkedIn) => {
        if (!checkedIn) {
          router.replace('/newrelic/attendance');
        } else {
          router.replace('/newrelic');
        }
      });
    }
  }, [user, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    triggerHaptic('medium');
    setLoading(true);
    try {
      const callbackUrl = typeof window !== 'undefined' ? `${window.location.origin}/delivery-challan` : undefined;
      const res = await signIn('credentials', {
        redirect: false,
        email,
        password,
        callbackUrl,
      });

      if (res?.error) {
        throw new Error(res.error);
      }

      triggerHaptic('success');
      toast({ title: 'Welcome back!' });
      
      // Guest users bypass attendance check-in
      if (email.toLowerCase().trim() === 'guest@tgg.in') {
        router.push('/delivery-challan');
        return;
      }

      // Check if user has checked in today: if not -> /newrelic/attendance, else -> /newrelic
      const checkedIn = await checkUserCheckedInToday(undefined, email);
      if (!checkedIn) {
        router.push('/newrelic/attendance');
      } else {
        router.push('/newrelic');
      }
    } catch (err: any) {
      triggerHaptic('warning');
      toast({
        variant: 'destructive',
        title: 'Login failed',
        description: err.message,
      });
    } finally {
      setLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <Loader2 className="h-8 w-8 text-indigo-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-transparent py-10 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
      <div className="w-full max-w-md space-y-6 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl p-6 sm:p-8 rounded-3xl shadow-[0_12px_40px_-10px_rgba(0,0,0,0.1)] border border-slate-200/80 dark:border-slate-800">
        <div className="text-center space-y-3">
          <div className="relative inline-block">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/gut_guru_logo.png"
              alt="The Gut Guru Tracker"
              width={72}
              height={72}
              className="h-18 w-18 mx-auto rounded-2xl object-contain shadow-lg ring-4 ring-indigo-500/10 dark:ring-indigo-400/20 bg-white"
            />
            <div className="absolute -bottom-1 -right-1 bg-indigo-600 text-white rounded-full p-1 shadow-md">
              <Sparkles className="h-3 w-3" />
            </div>
          </div>
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200/60 dark:border-indigo-800/60 text-indigo-700 dark:text-indigo-300 text-[10px] font-black tracking-widest uppercase mb-1">
              Operations Portal
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
              The Gut Guru
            </h2>
            <p className="text-xs sm:text-sm font-medium text-slate-500 dark:text-slate-400 mt-1">
              Hospitality Services · Multi-Site Operations
            </p>
          </div>
        </div>

        {errorParam === 'suspended' && (
          <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 flex items-start gap-3 text-rose-900 dark:text-rose-200 text-xs animate-in fade-in slide-in-from-top-2 duration-300">
            <ShieldAlert className="h-5 w-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-bold">Account Access Suspended</p>
              <p className="text-rose-700 dark:text-rose-300 text-[11px] leading-relaxed">
                Your account is currently suspended by an administrator. Active sessions have been locked. Please contact your administrator to restore access.
              </p>
            </div>
          </div>
        )}

        {errorParam === 'revoked' && (
          <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 flex items-start gap-3 text-amber-900 dark:text-amber-200 text-xs animate-in fade-in slide-in-from-top-2 duration-300">
            <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-bold">Session Revoked</p>
              <p className="text-amber-700 dark:text-amber-300 text-[11px] leading-relaxed">
                Your session was revoked or reset by an administrator. Please enter your credentials to authenticate and start a fresh session.
              </p>
            </div>
          </div>
        )}

        {errorParam === 'expired' && (
          <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 flex items-start gap-3 text-rose-900 dark:text-rose-200 text-xs animate-in fade-in slide-in-from-top-2 duration-300">
            <Clock className="h-5 w-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-bold">Guest Access Expired</p>
              <p className="text-rose-700 dark:text-rose-300 text-[11px] leading-relaxed">
                Your time-bound guest access period has expired. Active sessions have been locked. Please reach out to your administrator to request an access extension.
              </p>
            </div>
          </div>
        )}

        {errorParam === 'device_revoked' && (
          <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 flex items-start gap-3 text-amber-900 dark:text-amber-200 text-xs animate-in fade-in slide-in-from-top-2 duration-300">
            <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-bold">Device Session Terminated</p>
              <p className="text-amber-700 dark:text-amber-300 text-[11px] leading-relaxed">
                This device’s active session was remotely revoked by an administrator. Please sign in again to authorize this device.
              </p>
            </div>
          </div>
        )}

        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email-address" className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                Email address
              </Label>
              <Input
                id="email-address"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="h-12 rounded-2xl border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 text-sm font-medium focus-visible:ring-indigo-500"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                Password
              </Label>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="h-12 rounded-2xl border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 text-sm font-medium focus-visible:ring-indigo-500"
              />
            </div>
          </div>

          <div className="pt-2">
            <Button
              type="submit"
              className="w-full h-12 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-black tracking-wide text-sm shadow-lg shadow-indigo-600/25 active:scale-[0.98] transition-all"
              disabled={loading}
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Lock className="h-4 w-4 mr-2" />}
              Sign in to Portal
            </Button>
          </div>
        </form>

        <p className="text-[11px] text-center text-slate-400 dark:text-slate-500">
          Secure end-to-end multi-site operations access
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
          <Loader2 className="h-8 w-8 text-indigo-600 animate-spin" />
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
