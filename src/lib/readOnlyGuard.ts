import { getSession } from 'next-auth/react';

let _cachedRole: string | null = null;

export function setGlobalUserRole(role: string | null) {
  _cachedRole = role;
}

export function getGlobalUserRole(): string | null {
  return _cachedRole;
}

export async function isGuestSession(): Promise<boolean> {
  if (_cachedRole === 'guest') return true;
  if (typeof window !== 'undefined') {
    try {
      const session = await getSession();
      const role = (session?.user as any)?.role;
      if (role) {
        _cachedRole = role;
        return role === 'guest';
      }
    } catch {
      // Ignore network errors
    }
  }
  return false;
}

/**
 * Throws an informative error if the current authenticated session is a Guest user.
 * Use at the top of all create, update, and delete service operations.
 */
export async function assertWritePermission(actionDescription = 'This action'): Promise<void> {
  const isGuest = await isGuestSession();
  if (isGuest) {
    const errorMsg = `Guest Account (Read-Only): ${actionDescription} is disabled. Live data modifications are restricted.`;
    console.warn(`[ReadOnlyGuard] ${errorMsg}`);
    throw new Error(errorMsg);
  }
}
