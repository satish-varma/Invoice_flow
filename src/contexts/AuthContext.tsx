'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { SessionProvider, useSession, signOut as nextAuthSignOut } from 'next-auth/react';

import { SiteId } from '@/types/site';

export type UserRole = 'admin' | 'superadmin' | 'manager' | 'user' | 'guest';

export interface AppUser {
  id: string; // The firestore doc ID
  email: string;
  role: UserRole;
  preferredLocations?: string[];
  assignedApps?: string[];
  assignedSite?: SiteId;
  defaultLandingPage?: string;
  allowedTabs?: string[];
}

interface AuthContextType {
  user: AppUser | null;
  role: UserRole | null;
  isReadOnly: boolean;
  loading: boolean;
  signOut: () => Promise<void> | void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  role: null,
  isReadOnly: false,
  loading: true,
  signOut: () => {},
});

function AuthProviderInner({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  
  const loading = status === 'loading';
  const user = session?.user ? (session.user as unknown as AppUser) : null;
  const role = user?.role || null;
  const isReadOnly = role === 'guest';

  const signOut = async () => {
    try {
      await nextAuthSignOut({ redirect: false });
    } catch (err) {
      console.error('Sign out error:', err);
    }
    if (typeof window !== 'undefined') {
      window.location.href = '/login';
    }
  };

  return (
    <AuthContext.Provider value={{ user, role, isReadOnly, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <AuthProviderInner>
        {children}
      </AuthProviderInner>
    </SessionProvider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
