'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { signIn } from 'next-auth/react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Lock } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { user, loading: authLoading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  // If already logged in, redirect to site-specific portal
  useEffect(() => {
    if (user) {
      const site = user.assignedSite;
      if (site === 'dsm' || site === 'ntt_data') {
        router.replace('/newrelic/tuckshop');
      } else {
        router.replace('/newrelic');
      }
    }
  }, [user, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await signIn('credentials', {
        redirect: false,
        email,
        password,
      });

      if (res?.error) {
        throw new Error(res.error);
      }

      toast({ title: 'Welcome back!' });
      const searchParams = new URLSearchParams(window.location.search);
      const callback = searchParams.get('callbackUrl');
      if (callback && callback !== '/' && !callback.includes('/login')) {
        router.push(callback);
      } else {
        router.push('/newrelic');
      }
    } catch (err: any) {
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
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="h-8 w-8 text-[#3b2fc9] animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8 bg-white p-8 rounded-2xl shadow-sm border border-gray-200">
        <div className="text-center space-y-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/hungerbox_logo.png"
            alt="HungerBox"
            className="h-10 mx-auto object-contain mb-3"
          />
          <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900">
            Operations Portal
          </h2>
          <p className="text-xs sm:text-sm text-gray-500">
            HungerBox Cafeteria Stalls · NewRelic, DSM & NTT Data
          </p>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="rounded-md shadow-sm space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email-address">Email address</Label>
              <Input
                id="email-address"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>
          </div>

          <div>
            <Button
              type="submit"
              className="w-full bg-[#3b2fc9] hover:bg-[#2d23a0] text-white"
              disabled={loading}
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Sign in
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
