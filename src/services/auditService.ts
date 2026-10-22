import { collection, addDoc, getDocs, query, orderBy, limit, doc, updateDoc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { AuditLogEntry, DeviceSession } from '@/types/audit';

export function detectDeviceInfo(): {
  deviceType: 'mobile' | 'desktop' | 'tablet';
  browser: string;
  os: string;
} {
  if (typeof window === 'undefined') {
    return { deviceType: 'desktop', browser: 'Server', os: 'Unknown' };
  }

  const ua = navigator.userAgent;
  let deviceType: 'mobile' | 'desktop' | 'tablet' = 'desktop';

  if (/ipad|tablet|(android(?!.*mobile))/i.test(ua)) {
    deviceType = 'tablet';
  } else if (/mobile|iphone|ipod|android/i.test(ua) || window.innerWidth < 768) {
    deviceType = 'mobile';
  }

  // OS detection
  let os = 'Unknown OS';
  if (/macintosh|mac os x/i.test(ua)) os = 'macOS';
  else if (/windows/i.test(ua)) os = 'Windows';
  else if (/android/i.test(ua)) os = 'Android';
  else if (/iphone|ipad|ipod/i.test(ua)) os = 'iOS';
  else if (/linux/i.test(ua)) os = 'Linux';

  // Browser detection
  let browser = 'Unknown Browser';
  if (/capacitor/i.test(ua) || (window as any).Capacitor) {
    browser = 'Capacitor Android App';
  } else if (/edg/i.test(ua)) {
    browser = 'Microsoft Edge';
  } else if (/chrome|crios/i.test(ua) && !/opr|opera/i.test(ua)) {
    browser = 'Google Chrome';
  } else if (/firefox|fxios/i.test(ua)) {
    browser = 'Mozilla Firefox';
  } else if (/safari/i.test(ua) && !/chrome|crios/i.test(ua)) {
    browser = 'Apple Safari';
  } else if (/opera|opr/i.test(ua)) {
    browser = 'Opera';
  }

  return { deviceType, browser, os };
}

export function getOrCreateSessionId(): string {
  if (typeof window === 'undefined') return 'server_session';
  const STORAGE_KEY = 'invoice_flow_device_session_id';
  let sid = localStorage.getItem(STORAGE_KEY);
  if (!sid) {
    sid = 'sess_' + Math.random().toString(36).substring(2, 10) + '_' + Date.now().toString(36);
    localStorage.setItem(STORAGE_KEY, sid);
  }
  return sid;
}

export function getOrCreateDeviceId(): string {
  if (typeof window === 'undefined') return 'server_device';
  const STORAGE_KEY = 'invoice_flow_device_fingerprint_id';
  let did = localStorage.getItem(STORAGE_KEY);
  if (!did) {
    did = 'dev_' + Math.random().toString(36).substring(2, 10) + '_' + Date.now().toString(36);
    localStorage.setItem(STORAGE_KEY, did);
  }
  return did;
}

/**
 * Log an enterprise administrative or security event to Firestore
 */
export async function logAuditEvent(
  entry: Omit<AuditLogEntry, 'id' | 'timestamp'> & { timestamp?: string }
): Promise<void> {
  try {
    const auditColl = collection(db, 'audit_logs');
    const logData: Omit<AuditLogEntry, 'id'> = {
      ...entry,
      timestamp: entry.timestamp || new Date().toISOString(),
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'Server',
    };
    await addDoc(auditColl, logData);
  } catch (err) {
    console.warn('Failed to record audit log event:', err);
  }
}

/**
 * Fetch recent audit logs from Firestore
 */
export async function getAuditLogs(maxCount: number = 200): Promise<AuditLogEntry[]> {
  try {
    const auditColl = collection(db, 'audit_logs');
    const q = query(auditColl, orderBy('timestamp', 'desc'), limit(maxCount));
    const snap = await getDocs(q);

    return snap.docs.map((d) => ({
      id: d.id,
      ...(d.data() as Omit<AuditLogEntry, 'id'>),
    }));
  } catch (err) {
    console.warn('Failed to load audit logs:', err);
    return [];
  }
}

/**
 * Register or heartbeat current device session in Firestore user document
 */
export async function registerDeviceSession(
  userId: string,
  userEmail: string
): Promise<DeviceSession | null> {
  if (typeof window === 'undefined' || !userId) return null;

  try {
    const sessionId = getOrCreateSessionId();
    const deviceId = getOrCreateDeviceId();
    const { deviceType, browser, os } = detectDeviceInfo();
    const nowIso = new Date().toISOString();

    const userRef = doc(db, 'users', userId);
    const userSnap = await getDoc(userRef);
    if (!userSnap.exists()) return null;

    const userData = userSnap.data();
    const existingSessions: Record<string, DeviceSession> = userData.sessions || {};

    const currentSession: DeviceSession = {
      sessionId,
      deviceId,
      deviceType,
      browser,
      os,
      userAgent: navigator.userAgent,
      createdAt: existingSessions[sessionId]?.createdAt || nowIso,
      lastActive: nowIso,
      revoked: false,
    };

    existingSessions[sessionId] = currentSession;

    // Prune expired or excessive sessions (keep latest 15)
    const sorted = Object.entries(existingSessions).sort(
      ([, a], [, b]) => new Date(b.lastActive).getTime() - new Date(a.lastActive).getTime()
    );
    const prunedSessions = Object.fromEntries(sorted.slice(0, 15));

    await updateDoc(userRef, {
      sessions: prunedSessions,
      lastActiveAt: nowIso,
    });

    return currentSession;
  } catch (err) {
    console.warn('Failed to register device session:', err);
    return null;
  }
}

/**
 * Revoke a specific device session for a user
 */
export async function revokeDeviceSession(
  targetUserId: string,
  sessionIdToRevoke: string,
  revokedByEmail: string,
  targetEmail: string
): Promise<void> {
  const userRef = doc(db, 'users', targetUserId);
  const userSnap = await getDoc(userRef);
  if (!userSnap.exists()) return;

  const userData = userSnap.data();
  const sessions: Record<string, DeviceSession> = userData.sessions || {};

  if (sessions[sessionIdToRevoke]) {
    sessions[sessionIdToRevoke].revoked = true;
    sessions[sessionIdToRevoke].revokedAt = new Date().toISOString();
    sessions[sessionIdToRevoke].revokedBy = revokedByEmail;
  }

  await updateDoc(userRef, {
    sessions,
  });

  await logAuditEvent({
    actorEmail: revokedByEmail,
    actorRole: 'admin',
    action: 'device_session_revoked',
    actionLabel: 'Revoked Specific Device Session',
    targetType: 'user',
    targetId: targetUserId,
    targetLabel: targetEmail,
    details: {
      revokedSessionId: sessionIdToRevoke,
      device: sessions[sessionIdToRevoke]
        ? `${sessions[sessionIdToRevoke].os} - ${sessions[sessionIdToRevoke].browser}`
        : 'Unknown',
    },
  });
}
