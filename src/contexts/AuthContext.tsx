'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { SessionProvider, useSession, signOut as nextAuthSignOut } from 'next-auth/react';

import { SiteId } from '@/types/site';
import { setGlobalUserRole } from '@/lib/readOnlyGuard';
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { getOrCreateSessionId, registerDeviceSession, logAuditEvent } from '@/services/auditService';
import { DeviceSession } from '@/types/audit';

export type UserRole = 'admin' | 'superadmin' | 'manager' | 'user' | 'guest';
export type UserStatus = 'active' | 'suspended';

export interface AppUser {
  id: string; // The firestore doc ID
  email: string;
  role: UserRole;
  status?: UserStatus;
  tokenVersion?: number;
  expiresAt?: string | null;
  canDelete?: boolean;
  preferredLocations?: string[];
  assignedApps?: string[];
  assignedSite?: SiteId;
  assignedSites?: SiteId[];
  defaultLandingPage?: string;
  allowedTabs?: string[];
  sessions?: Record<string, DeviceSession>;
}

interface AuthContextType {
  user: AppUser | null;
  role: UserRole | null;
  isReadOnly: boolean;
  canDelete: boolean;
  loading: boolean;
  signOut: () => Promise<void> | void;
  // Simulation / View As Mode
  realUser: AppUser | null;
  isSimulating: boolean;
  simulatedUser: AppUser | null;
  startSimulation: (targetUser: AppUser) => void;
  stopSimulation: () => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  role: null,
  isReadOnly: false,
  canDelete: false,
  loading: true,
  signOut: () => {},
  realUser: null,
  isSimulating: false,
  simulatedUser: null,
  startSimulation: () => {},
  stopSimulation: () => {},
});

function AuthProviderInner({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const [liveUser, setLiveUser] = useState<AppUser | null>(null);

  const sessionUser = session?.user ? (session.user as unknown as AppUser) : null;
  const userEmail = sessionUser?.email;

  useEffect(() => {
    if (!userEmail) {
      setLiveUser(null);
      return;
    }

    // Subscribe to Firestore for real-time permissions & role sync
    try {
      const usersRef = collection(db, 'users');
      const q = query(usersRef, where('email', '==', userEmail.toLowerCase().trim()));
      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          if (!snapshot.empty) {
            const docSnap = snapshot.docs[0];
            const data = docSnap.data();

            // Real-time security enforcement: Immediate termination on suspension
            if (data.status === 'suspended') {
              setLiveUser(null);
              setGlobalUserRole(null);
              nextAuthSignOut({ redirect: false });
              if (typeof window !== 'undefined') {
                window.location.href = '/login?error=suspended';
              }
              return;
            }

            // Real-time security enforcement: Immediate termination on expired access
            if (data.expiresAt && new Date(data.expiresAt).getTime() <= Date.now()) {
              setLiveUser(null);
              setGlobalUserRole(null);
              nextAuthSignOut({ redirect: false });
              if (typeof window !== 'undefined') {
                window.location.href = '/login?error=expired';
              }
              return;
            }

            // Real-time security enforcement: Immediate termination on session revocation
            const currentTokenVersion = typeof data.tokenVersion === 'number' ? data.tokenVersion : 1;
            const sessionTokenVersion = typeof sessionUser?.tokenVersion === 'number' ? sessionUser.tokenVersion : 1;
            if (currentTokenVersion > sessionTokenVersion) {
              setLiveUser(null);
              setGlobalUserRole(null);
              nextAuthSignOut({ redirect: false });
              if (typeof window !== 'undefined') {
                window.location.href = '/login?error=revoked';
              }
              return;
            }

            // Real-time security enforcement: Immediate termination if this device session was revoked
            if (typeof window !== 'undefined' && data.sessions) {
              const currentSid = getOrCreateSessionId();
              if (data.sessions[currentSid]?.revoked === true) {
                setLiveUser(null);
                setGlobalUserRole(null);
                nextAuthSignOut({ redirect: false });
                window.location.href = '/login?error=device_revoked';
                return;
              }
            }

            setLiveUser({
              id: docSnap.id,
              email: data.email,
              role: data.role || 'user',
              status: data.status || 'active',
              tokenVersion: currentTokenVersion,
              expiresAt: data.expiresAt || null,
              canDelete: data.canDelete ?? (data.allowedTabs?.includes('can_delete') || false),
              preferredLocations: data.preferredLocations || [],
              assignedApps: data.assignedApps || [],
              assignedSite: data.assignedSite,
              defaultLandingPage: data.defaultLandingPage || '',
              allowedTabs: data.allowedTabs || [],
              sessions: data.sessions || {},
            });

            // Register / update device heartbeat (non-blocking)
            registerDeviceSession(docSnap.id, data.email);
          }
        },
        (err) => {
          console.warn('Real-time auth user sync error:', err);
        }
      );

      return () => unsubscribe();
    } catch (e) {
      console.warn('Failed to attach Firestore auth listener:', e);
    }
  }, [userEmail, sessionUser?.tokenVersion]);

  const [simulatedUser, setSimulatedUser] = useState<AppUser | null>(null);

  // Restore simulated user from sessionStorage on mount
  useEffect(() => {
    try {
      if (typeof window !== 'undefined') {
        const stored = sessionStorage.getItem('invoice_flow_simulated_user');
        if (stored) {
          setSimulatedUser(JSON.parse(stored));
        }
      }
    } catch (e) {
      console.warn('Failed to parse simulated user:', e);
    }
  }, []);

  const loading = status === 'loading';
  const realUser = liveUser || sessionUser;
  const isRealAdmin = realUser?.role === 'admin' || realUser?.role === 'superadmin';
  const isSimulating = Boolean(simulatedUser && isRealAdmin);
  const user = isSimulating && simulatedUser ? simulatedUser : realUser;
  const role = user?.role || null;
  const isReadOnly = role === 'guest';
  const canDelete =
    role === 'admin' ||
    role === 'superadmin' ||
    user?.canDelete === true ||
    (user?.allowedTabs?.includes('can_delete') ?? false);

  const startSimulation = (targetUser: AppUser) => {
    if (!isRealAdmin) return;
    setSimulatedUser(targetUser);
    try {
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('invoice_flow_simulated_user', JSON.stringify(targetUser));
      }
      logAuditEvent({
        actorEmail: realUser?.email || 'admin',
        actorRole: realUser?.role || 'admin',
        action: 'simulation_started',
        actionLabel: 'Started Admin Simulation View',
        targetType: 'user',
        targetId: targetUser.id,
        targetLabel: targetUser.email,
        details: {
          simulatedRole: targetUser.role,
          simulatedSite: targetUser.assignedSite,
          allowedTabsCount: targetUser.allowedTabs?.length || 0,
        },
      });
    } catch (e) {
      console.warn('Failed to save simulated user:', e);
    }
  };

  const stopSimulation = () => {
    if (simulatedUser) {
      logAuditEvent({
        actorEmail: realUser?.email || 'admin',
        actorRole: realUser?.role || 'admin',
        action: 'simulation_stopped',
        actionLabel: 'Exited Admin Simulation View',
        targetType: 'user',
        targetId: simulatedUser.id,
        targetLabel: simulatedUser.email,
      });
    }
    setSimulatedUser(null);
    try {
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem('invoice_flow_simulated_user');
      }
    } catch (e) {
      console.warn('Failed to clear simulated user:', e);
    }
  };

  // Monitor active session expiration in real-time
  useEffect(() => {
    if (!realUser?.expiresAt) return;
    const checkExpiry = () => {
      if (new Date(realUser.expiresAt!).getTime() <= Date.now()) {
        setLiveUser(null);
        setGlobalUserRole(null);
        nextAuthSignOut({ redirect: false });
        if (typeof window !== 'undefined') {
          window.location.href = '/login?error=expired';
        }
      }
    };
    checkExpiry();
    const interval = setInterval(checkExpiry, 15000); // Check every 15 seconds
    return () => clearInterval(interval);
  }, [realUser?.expiresAt]);

  useEffect(() => {
    setGlobalUserRole(role);
  }, [role]);

  const signOut = async () => {
    try {
      stopSimulation();
      setLiveUser(null);
      await nextAuthSignOut({ redirect: false });
    } catch (err) {
      console.error('Sign out error:', err);
    }
    if (typeof window !== 'undefined') {
      window.location.href = '/login';
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        role,
        isReadOnly,
        canDelete,
        loading,
        signOut,
        realUser,
        isSimulating,
        simulatedUser,
        startSimulation,
        stopSimulation,
      }}
    >
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
