export type PermissionKey =
  // Company Operations (Site-Scoped)
  | 'tuckshop'
  | 'attendance'
  | 'stock_request'
  // Delivery Challans (Independent Mechanisms)
  | 'newrelic_dc'
  | 'general_dc'
  // Billing & Documents
  | 'billing'
  | 'masters'
  | 'hr_docs'
  // Admin Category
  | 'stock_admin'
  | 'tuckshop_reconcile'
  | 'pricing'
  | 'catalog'
  | 'payroll'
  | 'employees'
  | 'analytics'
  | 'users_admin'
  | 'settings';

export interface PermissionDefinition {
  id: PermissionKey;
  label: string;
  description: string;
  route: string;
  adminOnly?: boolean;
  newRelicOnly?: boolean; // Strictly blocked for DSM & NTT Data
}

export interface PermissionCategory {
  id: string;
  name: string;
  description: string;
  badgeColor?: string;
  items: PermissionDefinition[];
}

export const PERMISSION_CATEGORIES: PermissionCategory[] = [
  {
    id: 'operations',
    name: 'Company Operations (Site-Scoped)',
    description: 'Daily stall activities scoped strictly to the assigned company site (DSM, NTT Data, NewRelic)',
    badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    items: [
      {
        id: 'tuckshop',
        label: 'Tuckshop Sales & Ledger',
        description: 'Counter sales, expenses, and ledger for the assigned company stall',
        route: '/newrelic/tuckshop',
      },
      {
        id: 'attendance',
        label: 'Daily Attendance',
        description: 'Staff check-in/out with selfie verification for the assigned site',
        route: '/newrelic/attendance',
      },
      {
        id: 'stock_request',
        label: 'Request Stock',
        description: 'Submit material and snack stock requests for the assigned stall',
        route: '/newrelic/stock-request',
      },
    ],
  },
  {
    id: 'delivery_challans',
    name: 'Delivery Challans (Independent Mechanisms)',
    description: 'Two separate DC systems - NewRelic cafeteria vs general client dispatches',
    badgeColor: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    items: [
      {
        id: 'newrelic_dc',
        label: 'NewRelic DC Hub',
        description: 'Dedicated delivery challan system strictly for NewRelic cafeteria. Forbidden for DSM/NTT Data.',
        route: '/newrelic',
        newRelicOnly: true,
      },
      {
        id: 'general_dc',
        label: 'General DC (Other Companies)',
        description: 'Universal delivery challans for HungerBox, The Gut Guru & other consignees',
        route: '/delivery-challan',
      },
    ],
  },
  {
    id: 'billing_docs',
    name: 'Invoicing & HR Documents',
    description: 'Corporate customer billing, estimates, and employment records',
    badgeColor: 'bg-blue-50 text-blue-700 border-blue-200',
    items: [
      {
        id: 'billing',
        label: 'Invoices & Quotations',
        description: 'Create & manage tax invoices and customer quotations with Excel import',
        route: '/invoices',
      },
      {
        id: 'masters',
        label: 'Products & Clients Master',
        description: 'Manage standard product catalog and customer billing contacts',
        route: '/products',
      },
      {
        id: 'hr_docs',
        label: 'Payslips & Offer Letters',
        description: 'Generate employment offer letters, monthly payslips, and GST declarations',
        route: '/payslip',
      },
    ],
  },
  {
    id: 'admin_tools',
    name: 'Admin Category',
    description: 'Privileged operations, approvals, financial matrices, reconciliation, and system settings',
    badgeColor: 'bg-rose-50 text-rose-700 border-rose-200',
    items: [
      {
        id: 'stock_admin',
        label: 'Stock Requests Approvals',
        description: 'Review, approve, budget, and fulfill tuckshop inventory requests across all sites',
        route: '/newrelic/stock-requests-admin',
        adminOnly: true,
      },
      {
        id: 'tuckshop_reconcile',
        label: 'Tuckshop Daily Reconciliation',
        description: 'Verify cash, POS, and UPI settlement vs counter sales records',
        route: '/newrelic/reconcile',
        adminOnly: true,
      },
      {
        id: 'pricing',
        label: 'Pricing Matrix',
        description: 'Define MRP, selling price, and procurement costs for all products',
        route: '/newrelic/pricing',
        adminOnly: true,
      },
      {
        id: 'catalog',
        label: 'Catalog & Brands Management',
        description: 'Define catalog items, multi-site applicability, and brands',
        route: '/newrelic/catalog',
        adminOnly: true,
      },
      {
        id: 'payroll',
        label: 'Salaries & Advances (Payroll)',
        description: 'Calculate monthly attendance salaries, advance deductions, and payout sheets',
        route: '/newrelic/attendance?tab=payroll',
        adminOnly: true,
      },
      {
        id: 'employees',
        label: 'Employee Directory',
        description: 'Staff profiles, KYC, bank accounts, and employment records',
        route: '/newrelic/employees',
        adminOnly: true,
      },
      {
        id: 'analytics',
        label: 'Executive Analytics',
        description: 'High-level multi-site profitability, revenue breakdown, and trends',
        route: '/newrelic/analytics',
        adminOnly: true,
      },
      {
        id: 'users_admin',
        label: 'User Management & Permissions',
        description: 'Create user credentials, assign roles, sites, default landing pages, and tabs',
        route: '/admin/users',
        adminOnly: true,
      },
      {
        id: 'settings',
        label: 'Company Settings',
        description: 'Company profiles, GSTINs, bank accounts, and system configuration',
        route: '/settings',
        adminOnly: true,
      },
    ],
  },
];

export interface RolePreset {
  id: string;
  name: string;
  description: string;
  defaultPage: string;
  tabs: PermissionKey[];
}

export const ROLE_PRESETS: RolePreset[] = [
  {
    id: 'tuckshop_operator',
    name: 'Tuckshop Operator (DSM / NTT / NewRelic)',
    description: 'Counter sales, inventory requests, and daily attendance for assigned site',
    defaultPage: '/newrelic/tuckshop',
    tabs: ['tuckshop', 'attendance', 'stock_request'],
  },
  {
    id: 'store_manager',
    name: 'Tuckshop Store Manager',
    description: 'Counter operations plus daily cash reconciliation and stock request approvals',
    defaultPage: '/newrelic/tuckshop',
    tabs: ['tuckshop', 'attendance', 'stock_request', 'tuckshop_reconcile', 'stock_admin'],
  },
  {
    id: 'general_dispatcher',
    name: 'General Dispatcher (Other Companies)',
    description: 'Create and track delivery challans for HungerBox & corporate clients',
    defaultPage: '/delivery-challan',
    tabs: ['general_dc'],
  },
  {
    id: 'newrelic_dispatcher',
    name: 'NewRelic Dispatcher',
    description: 'Manage NewRelic cafeteria delivery challans (NewRelic site only)',
    defaultPage: '/newrelic',
    tabs: ['newrelic_dc'],
  },
  {
    id: 'accountant',
    name: 'Accountant & Billing',
    description: 'Invoicing, quotations, master catalogs, and general delivery challans',
    defaultPage: '/invoices',
    tabs: ['billing', 'masters', 'general_dc', 'hr_docs'],
  },
  {
    id: 'full_admin',
    name: 'Full Admin / Superadmin',
    description: 'Unrestricted access to all operational, dispatch, billing, and admin systems',
    defaultPage: '/delivery-challan',
    tabs: [
      'tuckshop',
      'attendance',
      'stock_request',
      'newrelic_dc',
      'general_dc',
      'billing',
      'masters',
      'hr_docs',
      'stock_admin',
      'tuckshop_reconcile',
      'pricing',
      'catalog',
      'payroll',
      'employees',
      'analytics',
      'users_admin',
      'settings',
    ],
  },
];

export const DEFAULT_LANDING_PAGES = [
  { label: 'Tuckshop Sales & Ledger (Assigned Site)', path: '/newrelic/tuckshop', category: 'Operations' },
  { label: 'Daily Attendance (Assigned Site)', path: '/newrelic/attendance', category: 'Operations' },
  { label: 'Request Stock (Assigned Site)', path: '/newrelic/stock-request', category: 'Operations' },
  { label: 'General Delivery Challan (Other Companies)', path: '/delivery-challan', category: 'Dispatch' },
  { label: 'NewRelic Delivery Challan Hub (NewRelic only)', path: '/newrelic', category: 'Dispatch' },
  { label: 'Invoices & Billing Dashboard', path: '/invoices', category: 'Invoicing' },
  { label: 'Stock Approvals (Admin)', path: '/newrelic/stock-requests-admin', category: 'Admin' },
  { label: 'Tuckshop Reconciliation (Admin)', path: '/newrelic/reconcile', category: 'Admin' },
  { label: 'Salaries & Advances (Admin)', path: '/newrelic/attendance?tab=payroll', category: 'Admin' },
  { label: 'Executive Analytics (Admin)', path: '/newrelic/analytics', category: 'Admin' },
  { label: 'User Management (Admin)', path: '/admin/users', category: 'Admin' },
  { label: 'Company Settings (Admin)', path: '/settings', category: 'Admin' },
];

/**
 * Checks whether a user has permission to access a given permission key.
 * Admins and Superadmins have access to everything by default.
 */
export function hasPermission(
  user: { role?: string; allowedTabs?: string[]; assignedApps?: string[]; assignedSite?: string } | null | undefined,
  key: PermissionKey
): boolean {
  if (!user) return false;
  if (user.role === 'admin' || user.role === 'superadmin') return true;

  // NewRelic DC is strictly blocked for non-NewRelic sites
  if (key === 'newrelic_dc' && user.assignedSite && user.assignedSite !== 'newrelic') {
    return false;
  }

  // Check explicit allowedTabs
  if (user.allowedTabs && user.allowedTabs.length > 0) {
    return user.allowedTabs.includes(key);
  }

  // Backwards compatibility with legacy assignedApps
  if (user.assignedApps && user.assignedApps.length > 0) {
    if (key === 'general_dc' && user.assignedApps.includes('/delivery-challans')) return true;
    if (key === 'newrelic_dc' && user.assignedApps.includes('/newrelic')) return true;
    if (key === 'tuckshop' && (user.assignedApps.includes('/newrelic') || user.assignedApps.includes('/tuckshop'))) return true;
    if (key === 'attendance' && user.assignedApps.includes('/newrelic')) return true;
    if (key === 'stock_request' && user.assignedApps.includes('/newrelic')) return true;
    if (key === 'billing' && user.assignedApps.includes('/invoices')) return true;
    if (key === 'masters' && user.assignedApps.includes('/invoices')) return true;
    if (key === 'hr_docs' && (user.assignedApps.includes('/payslip') || user.assignedApps.includes('/offer-letter'))) return true;
    if (key === 'settings' && user.assignedApps.includes('/settings')) return true;
  }

  return false;
}
