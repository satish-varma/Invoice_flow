export interface Invoice {
  id: string;
  date: string;
  location: string;
  stall: string;
  amount: number;
  status: 'Processed' | 'Pending' | 'Paid';
  serviceDateRange?: string;
  pdfUrl?: string;
  pdfPath?: string;
  syncedAt?: string;
  orgId?: string;
}

export interface HungerBoxSale {
  id: string;
  orderId: string;
  orderDate: string;
  vendorName?: string;
  cafeteriaName?: string;
  amount: number;
  itemName?: string;
  status?: string;
  orgId: string;
  syncedAt?: string;
}

export interface TrackerSettings {
  emailSearchTerm: string;
  syncLookbackDays: number;
  emailUser: string;
  emailPassword?: string;
  syncIntervalHours: number;
  hungerboxWorkerUrl?: string;
  hungerboxWorkerApiKey?: string;
}

export interface AuditLog {
  id: string;
  userId?: string | null;
  userEmail?: string | null;
  action: string;
  details?: string | null;
  orgId: string;
  ipAddress?: string | null;
  timestamp: string;
}

export interface LoginHistory {
  id: string;
  userId?: string | null;
  userEmail?: string | null;
  status: 'success' | 'failed';
  ipAddress?: string | null;
  userAgent?: string | null;
  location?: string | null;
  orgId: string;
  timestamp: string;
}
