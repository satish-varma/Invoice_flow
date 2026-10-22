import { createClient, Client, InStatement, InArgs, ResultSet } from '@libsql/client';
import { Invoice, HungerBoxSale, TrackerSettings, AuditLog, LoginHistory } from './types';
import { extractStallAndLocation, isGarbageText } from './parser';

let client: Client | null = null;

export function getTursoClient(): Client {
  if (!client) {
    const url = process.env.TURSO_DATABASE_URL || 'file:local-tracker.db';
    const authToken = process.env.TURSO_AUTH_TOKEN;
    client = createClient({
      url,
      authToken,
    });
  }
  return client;
}

export const turso = {
  execute: (stmt: InStatement | string, args?: InArgs): Promise<ResultSet> => {
    const c = getTursoClient();
    if (typeof stmt === 'string' && args !== undefined) {
      return c.execute(stmt, args);
    }
    return c.execute(stmt as InStatement);
  },
  batch: (...args: Parameters<Client['batch']>) => getTursoClient().batch(...args),
};

// Initialize database schema
export async function initializeDatabase() {
  try {
    // Invoices table
    await turso.execute(`
      CREATE TABLE IF NOT EXISTS invoices (
        id TEXT PRIMARY KEY,
        date TEXT NOT NULL,
        service_date_range TEXT,
        location TEXT NOT NULL,
        stall TEXT NOT NULL,
        amount REAL NOT NULL,
        status TEXT DEFAULT 'Pending',
        pdf_path TEXT,
        synced_at TEXT NOT NULL,
        org_id TEXT NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Settings table
    await turso.execute(`
      CREATE TABLE IF NOT EXISTS settings (
        org_id TEXT PRIMARY KEY,
        email_search_term TEXT DEFAULT 'TheGutGuru',
        sync_lookback_days INTEGER DEFAULT 30,
        email_user TEXT,
        email_password TEXT,
        sync_interval_hours INTEGER DEFAULT 6,
        hungerbox_worker_url TEXT,
        hungerbox_worker_api_key TEXT,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Audit logs table
    await turso.execute(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        user_email TEXT,
        action TEXT NOT NULL,
        details TEXT,
        org_id TEXT NOT NULL,
        ip_address TEXT,
        timestamp TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Login history table
    await turso.execute(`
      CREATE TABLE IF NOT EXISTS login_history (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        user_email TEXT,
        status TEXT NOT NULL,
        ip_address TEXT,
        user_agent TEXT,
        location TEXT,
        org_id TEXT NOT NULL,
        timestamp TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // HungerBox sales table
    await turso.execute(`
      CREATE TABLE IF NOT EXISTS hungerbox_sales (
        id TEXT PRIMARY KEY,
        order_id TEXT UNIQUE NOT NULL,
        order_date TEXT NOT NULL,
        vendor_name TEXT,
        cafeteria_name TEXT,
        amount REAL,
        item_name TEXT,
        status TEXT,
        org_id TEXT NOT NULL,
        synced_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Indexes
    await turso.execute(`CREATE INDEX IF NOT EXISTS idx_invoices_org_id ON invoices(org_id)`);
    await turso.execute(`CREATE INDEX IF NOT EXISTS idx_invoices_date ON invoices(date)`);
    await turso.execute(`CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status)`);
    await turso.execute(`CREATE INDEX IF NOT EXISTS idx_audit_logs_org_id ON audit_logs(org_id)`);
    await turso.execute(`CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp)`);
    await turso.execute(`CREATE INDEX IF NOT EXISTS idx_hungerbox_sales_org_id ON hungerbox_sales(org_id)`);
    await turso.execute(`CREATE INDEX IF NOT EXISTS idx_hungerbox_sales_order_date ON hungerbox_sales(order_date)`);

    console.log('[Turso] Tracker database initialized successfully');
  } catch (error) {
    console.error('[Turso] Failed to initialize database:', error);
    throw error;
  }
}

// Invoices CRUD
function mapInvoiceRow(row: any): Invoice {
  let stall = row.stall as string;
  let location = row.location as string;
  let serviceDateRange = (row.service_date_range as string) || undefined;

  if (isGarbageText(stall) || isGarbageText(location) || !serviceDateRange) {
    const fixed = extractStallAndLocation(row.id as string, undefined, stall, location);
    if (isGarbageText(stall)) stall = fixed.stall;
    if (isGarbageText(location)) location = fixed.location;
    if (!serviceDateRange && fixed.serviceDateRange) serviceDateRange = fixed.serviceDateRange;
  }

  return {
    id: row.id as string,
    date: row.date as string,
    serviceDateRange,
    location,
    stall,
    amount: Number(row.amount || 0),
    status: (row.status as 'Processed' | 'Pending' | 'Paid') || 'Pending',
    pdfPath: (row.pdf_path as string) || undefined,
    syncedAt: (row.synced_at as string) || undefined,
    orgId: (row.org_id as string) || undefined,
  };
}

export async function getInvoices(orgId?: string): Promise<Invoice[]> {
  try {
    let sql = 'SELECT * FROM invoices ORDER BY date DESC';
    let args: any[] = [];
    if (orgId && orgId !== 'all' && orgId !== 'default' && orgId !== 'default-org') {
      sql = 'SELECT * FROM invoices WHERE org_id = ? ORDER BY date DESC';
      args = [orgId];
      const scopedResult = await turso.execute({ sql, args });
      if (scopedResult.rows.length > 0) {
        return scopedResult.rows.map(mapInvoiceRow);
      }
    }
    const result = await turso.execute('SELECT * FROM invoices ORDER BY date DESC');
    return result.rows.map(mapInvoiceRow);
  } catch (error) {
    console.warn('[Turso] getInvoices query failed (will try table init):', error);
    try {
      await initializeDatabase();
      const retryResult = await turso.execute('SELECT * FROM invoices ORDER BY date DESC');
      return retryResult.rows.map(mapInvoiceRow);
    } catch {
      return [];
    }
  }
}

export async function getInvoiceById(id: string, orgId?: string): Promise<Invoice | null> {
  const result = await turso.execute({
    sql: 'SELECT * FROM invoices WHERE id = ?',
    args: [id],
  });
  if (result.rows.length === 0) return null;
  return mapInvoiceRow(result.rows[0]);
}

export async function createInvoice(invoice: {
  id: string;
  date: string;
  serviceDateRange?: string;
  location: string;
  stall: string;
  amount: number;
  status?: string;
  pdfPath?: string;
  syncedAt: string;
  orgId: string;
}) {
  await turso.execute({
    sql: `INSERT OR IGNORE INTO invoices 
          (id, date, service_date_range, location, stall, amount, status, pdf_path, synced_at, org_id)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      invoice.id,
      invoice.date,
      invoice.serviceDateRange || null,
      invoice.location,
      invoice.stall,
      invoice.amount,
      invoice.status || 'Pending',
      invoice.pdfPath || null,
      invoice.syncedAt,
      invoice.orgId,
    ],
  });
}

export async function updateInvoiceStatus(id: string, status: string, orgId?: string) {
  let sql = 'UPDATE invoices SET status = ? WHERE id = ?';
  let args: any[] = [status, id];
  if (orgId && orgId !== 'all' && orgId !== 'default-org') {
    sql = 'UPDATE invoices SET status = ? WHERE id = ? AND org_id = ?';
    args = [status, id, orgId];
  }
  await turso.execute({ sql, args });
}

export async function deleteAllInvoices(orgId: string) {
  await turso.execute({
    sql: 'DELETE FROM invoices WHERE org_id = ?',
    args: [orgId],
  });
}

// Settings operations
export async function getSettings(orgId: string): Promise<TrackerSettings> {
  const defaults: TrackerSettings = {
    emailSearchTerm: 'TheGutGuru',
    syncLookbackDays: 30,
    emailUser: '',
    emailPassword: '',
    syncIntervalHours: 6,
    hungerboxWorkerUrl: '',
    hungerboxWorkerApiKey: '',
  };

  try {
    const result = await turso.execute({
      sql: 'SELECT * FROM settings WHERE org_id = ?',
      args: [orgId],
    });

    if (result.rows.length === 0) return defaults;

    const row = result.rows[0];
    return {
      emailSearchTerm: (row.email_search_term as string) || defaults.emailSearchTerm,
      syncLookbackDays: (row.sync_lookback_days as number) || defaults.syncLookbackDays,
      emailUser: (row.email_user as string) || defaults.emailUser,
      emailPassword: (row.email_password as string) || defaults.emailPassword,
      syncIntervalHours: (row.sync_interval_hours as number) || defaults.syncIntervalHours,
      hungerboxWorkerUrl: (row.hungerbox_worker_url as string) || defaults.hungerboxWorkerUrl,
      hungerboxWorkerApiKey: (row.hungerbox_worker_api_key as string) || defaults.hungerboxWorkerApiKey,
    };
  } catch (error) {
    console.warn('[Turso] getSettings fallback to defaults:', error);
    return defaults;
  }
}

export async function saveSettings(
  orgId: string,
  settings: Partial<TrackerSettings>
) {
  await turso.execute({
    sql: `INSERT OR REPLACE INTO settings 
          (org_id, email_search_term, sync_lookback_days, email_user, email_password, sync_interval_hours, hungerbox_worker_url, hungerbox_worker_api_key, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
    args: [
      orgId,
      settings.emailSearchTerm || 'TheGutGuru',
      settings.syncLookbackDays || 30,
      settings.emailUser || '',
      settings.emailPassword || '',
      settings.syncIntervalHours || 6,
      settings.hungerboxWorkerUrl || '',
      settings.hungerboxWorkerApiKey || '',
    ],
  });
}

// Audit Logs
export async function createAuditLog(log: {
  userId?: string | null;
  userEmail?: string | null;
  action: string;
  details?: string | null;
  orgId: string;
  ipAddress?: string | null;
}) {
  const id = `LOG-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  try {
    await turso.execute({
      sql: `INSERT INTO audit_logs (id, user_id, user_email, action, details, org_id, ip_address)
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
      args: [
        id,
        log.userId || null,
        log.userEmail || null,
        log.action,
        log.details || null,
        log.orgId,
        log.ipAddress || null,
      ],
    });
  } catch (err) {
    console.warn('[Turso] Failed to write audit log:', err);
  }
}

export async function getAuditLogs(orgId: string, limit = 100): Promise<AuditLog[]> {
  try {
    const result = await turso.execute({
      sql: 'SELECT * FROM audit_logs WHERE org_id = ? ORDER BY timestamp DESC LIMIT ?',
      args: [orgId, limit],
    });
    return result.rows.map((row) => ({
      id: row.id as string,
      userId: (row.user_id as string) || null,
      userEmail: (row.user_email as string) || null,
      action: row.action as string,
      details: (row.details as string) || null,
      orgId: row.org_id as string,
      ipAddress: (row.ip_address as string) || null,
      timestamp: row.timestamp as string,
    }));
  } catch {
    return [];
  }
}

// HungerBox Sales
export async function getHungerBoxSales(orgId: string, limit = 100): Promise<HungerBoxSale[]> {
  try {
    const result = await turso.execute({
      sql: 'SELECT * FROM hungerbox_sales WHERE org_id = ? ORDER BY order_date DESC LIMIT ?',
      args: [orgId, limit],
    });
    return result.rows.map((row) => ({
      id: row.id as string,
      orderId: row.order_id as string,
      orderDate: row.order_date as string,
      vendorName: (row.vendor_name as string) || undefined,
      cafeteriaName: (row.cafeteria_name as string) || undefined,
      amount: Number(row.amount || 0),
      itemName: (row.item_name as string) || undefined,
      status: (row.status as string) || undefined,
      orgId: row.org_id as string,
      syncedAt: (row.synced_at as string) || undefined,
    }));
  } catch {
    return [];
  }
}

export async function createHungerBoxSale(sale: {
  orderId: string;
  orderDate: string;
  vendorName?: string;
  cafeteriaName?: string;
  amount: number;
  itemName?: string;
  status?: string;
  orgId: string;
}) {
  const id = `SALE-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  await turso.execute({
    sql: `INSERT OR REPLACE INTO hungerbox_sales 
          (id, order_id, order_date, vendor_name, cafeteria_name, amount, item_name, status, org_id)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      id,
      sale.orderId,
      sale.orderDate,
      sale.vendorName || null,
      sale.cafeteriaName || null,
      sale.amount,
      sale.itemName || null,
      sale.status || null,
      sale.orgId,
    ],
  });
}
