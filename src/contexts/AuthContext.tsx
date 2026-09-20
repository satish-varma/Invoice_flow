'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { SessionProvider, useSession, signOut as nextAuthSignOut } from 'next-auth/react';

export type UserRole = 'admin' | 'manager' | 'user';

export interface AppUser {
  id: string; // The firestore doc ID
  email: string;
  role: UserRole;
  preferredLocations?: string[];
  assignedApps?: string[];
}

interface AuthContextType {
  user: AppUser | null;
  role: UserRole | null;
  loading: boolean;
  signOut: () => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  role: null,
  loading: true,
  signOut: () => {},
});

function AuthProviderInner({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  
  const loading = status === 'loading';
  const user = session?.user ? (session.user as unknown as AppUser) : null;
  const role = user?.role || null;

  const signOut = () => {
    nextAuthSignOut({ callbackUrl: '/login' });
  };

  return (
    <AuthContext.Provider value={{ user, role, loading, signOut }}>
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
