export type AuditActionType =
  | 'user_created'
  | 'user_updated'
  | 'user_status_changed'
  | 'user_deleted'
  | 'sessions_revoked'
  | 'device_session_revoked'
  | 'permissions_cloned'
  | 'access_matrix_exported'
  | 'simulation_started'
  | 'simulation_stopped'
  | 'dc_deleted'
  | 'bulk_dc_deleted'
  | 'invoice_deleted'
  | 'bulk_invoices_deleted'
  | 'tuckshop_deleted';

export interface AuditLogEntry {
  id?: string;
  timestamp: string; // ISO 8601 string
  actorEmail: string;
  actorRole: string;
  action: AuditActionType;
  actionLabel: string;
  targetType: 'user' | 'challan' | 'invoice' | 'tuckshop' | 'system';
  targetId?: string;
  targetLabel?: string;
  details?: Record<string, any>;
  ip?: string;
  userAgent?: string;
}

export interface DeviceSession {
  sessionId: string;
  deviceId: string;
  deviceType: 'mobile' | 'desktop' | 'tablet';
  browser: string;
  os: string;
  userAgent: string;
  createdAt: string;
  lastActive: string;
  revoked?: boolean;
  revokedAt?: string;
  revokedBy?: string;
  ip?: string;
}
