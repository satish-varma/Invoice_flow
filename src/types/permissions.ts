export type PermissionKey =
  // Company Operations (Site-Scoped)
  | 'tuckshop'
  | 'tuckshop_pos'
  | 'attendance'
  | 'leaves'
  | 'stock_request'
  // Delivery Challans (Independent Mechanisms)
  | 'newrelic_dc'
  | 'newrelic_dc_create'
  | 'general_dc'
  | 'general_dc_create'
  | 'signed_copies'
  // Billing & Documents
  | 'invoices'
  | 'invoices_create'
  | 'quotations'
  | 'quotations_create'
  | 'billing' // Alias / parent for invoices & quotations
  | 'masters'
  | 'hr_docs'
  | 'hr_docs_create'
  // Admin & Financial Controls
  | 'stock_admin'
  | 'tuckshop_reconcile'
  | 'pricing'
  | 'catalog'
  | 'payroll'
  | 'employees'
  | 'analytics'
  | 'exports_download'
  | 'users_admin'
  | 'settings'
  // HungerBox Remittance & Sales Portal
  | 'hungerbox_tracker'
  | 'hungerbox_tracker_sync'
  | 'hungerbox_tracker_settings'
  // Data Safety & Delete Protection
  | 'can_delete';

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
        id: 'tuckshop_pos',
        label: 'Tuckshop POS Counter',
        description: 'Fast barcode / touch counter checkout interface for stall sales',
        route: '/newrelic/tuckshop?view=pos',
      },
      {
        id: 'attendance',
        label: 'Daily Attendance',
        description: 'Staff check-in/out with selfie verification for the assigned site',
        route: '/newrelic/attendance',
      },
      {
        id: 'leaves',
        label: 'Leaves & Holiday Calendar',
        description: 'Record planned staff leaves (Casual, Sick, Paid), review approvals, and view public holidays',
        route: '/newrelic/leaves',
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
    description: 'Two separate DC systems - NewRelic cafeteria vs general client dispatches, plus proof-of-delivery',
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
        id: 'newrelic_dc_create',
        label: 'Create & Edit NewRelic DC',
        description: 'Draft and edit NewRelic delivery challans with line items and MRP calculations',
        route: '/newrelic',
        newRelicOnly: true,
      },
      {
        id: 'general_dc',
        label: 'General DC (Other Companies)',
        description: 'Universal delivery challans for HungerBox, The Gut Guru & other consignees',
        route: '/delivery-challan',
      },
      {
        id: 'general_dc_create',
        label: 'Create & Edit General DC',
        description: 'Draft, save, and modify general delivery challans and consignee line items',
        route: '/delivery-challan',
      },
      {
        id: 'signed_copies',
        label: 'Signed Copies (Proof of Delivery)',
        description: 'View, upload, and inspect physical signed delivery challan receipts & invoices. Restricted from guests.',
        route: '/delivery-challan/attachments',
      },
    ],
  },
  {
    id: 'billing_docs',
    name: 'Invoicing & HR Documents',
    description: 'Corporate customer billing, estimates, catalogs, and employment records',
    badgeColor: 'bg-blue-50 text-blue-700 border-blue-200',
    items: [
      {
        id: 'invoices',
        label: 'Tax Invoices List & View',
        description: 'View corporate tax invoices, invoice history, and financial tax breakdowns. Strictly restricted from guests.',
        route: '/invoices',
      },
      {
        id: 'invoices_create',
        label: 'Create & Edit Invoices',
        description: 'Generate, edit, and print corporate GST tax invoices with Excel item import',
        route: '/',
      },
      {
        id: 'quotations',
        label: 'Quotations & Proposals List',
        description: 'View customer quotations, cost estimates, and commercial proposals',
        route: '/quotations',
      },
      {
        id: 'quotations_create',
        label: 'Create & Edit Quotations',
        description: 'Draft, modify, and export commercial quotation documents for prospective clients',
        route: '/quotation',
      },
      {
        id: 'masters',
        label: 'Products & Clients Master',
        description: 'Manage standard product catalog and customer billing contacts',
        route: '/products',
      },
      {
        id: 'hr_docs',
        label: 'Payslips & Offer Letters View',
        description: 'Inspect employment offer letters, monthly payslips, and GST declarations',
        route: '/payslip',
      },
      {
        id: 'hr_docs_create',
        label: 'Generate Payslips & Offer Letters',
        description: 'Issue new employee offer letters, compute monthly salary slips, and generate PDF copies',
        route: '/offer-letter',
      },
    ],
  },
  {
    id: 'hungerbox_portal',
    name: 'Cash & Carry Portal',
    description: 'Bi-weekly employee-paid remittances from HungerBox to GutGuru, payment advice auditing, sales tracking, and trends',
    badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    items: [
      {
        id: 'hungerbox_tracker',
        label: 'Cash & Carry Hub',
        description: 'View employee-paid payment invoices from HungerBox to GutGuru (received in 2 cycles per week)',
        route: '/tracker',
      },
      {
        id: 'hungerbox_tracker_sync',
        label: 'Sync Invoices & Sales',
        description: 'Trigger automated IMAP Gmail invoice sync and worker sales scrapes',
        route: '/tracker/settings',
      },
      {
        id: 'hungerbox_tracker_settings',
        label: 'Cash & Carry Settings & Credentials',
        description: 'Configure Gmail IMAP app passwords, search terms, and scraping worker keys',
        route: '/tracker/settings',
        adminOnly: true,
      },
    ],
  },
  {
    id: 'admin_tools',
    name: 'Admin & Financial Controls',
    description: 'Privileged operations, approvals, financial matrices, reconciliation, exports, and system settings',
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
        id: 'exports_download',
        label: 'Export Data (CSV / Excel)',
        description: 'Download bulk delivery challans, tuckshop ledgers, and inventory reports in CSV/Excel format',
        route: '/api/export',
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
  {
    id: 'security_protection',
    name: 'Data Safety & Delete Protection',
    description: 'Security clearance for permanently deleting Delivery Challans, Invoices, Quotations, and Tuckshop records',
    badgeColor: 'bg-rose-50 text-rose-700 border-rose-200',
    items: [
      {
        id: 'can_delete',
        label: 'Record Deletion Clearance',
        description: 'Permit deleting delivery challans, invoices, quotations, and tuckshop ledger records. When unchecked, delete buttons are locked and disabled.',
        route: '*',
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
    tabs: ['tuckshop', 'tuckshop_pos', 'attendance', 'leaves', 'stock_request'],
  },
  {
    id: 'store_manager',
    name: 'Tuckshop Store Manager',
    description: 'Counter operations plus daily cash reconciliation and stock request approvals',
    defaultPage: '/newrelic/tuckshop',
    tabs: ['tuckshop', 'tuckshop_pos', 'attendance', 'leaves', 'stock_request', 'tuckshop_reconcile', 'stock_admin'],
  },
  {
    id: 'general_dispatcher',
    name: 'General Dispatcher (Other Companies)',
    description: 'Create and track delivery challans for HungerBox & corporate clients',
    defaultPage: '/delivery-challan',
    tabs: ['general_dc', 'general_dc_create', 'signed_copies'],
  },
  {
    id: 'newrelic_dispatcher',
    name: 'NewRelic Dispatcher',
    description: 'Manage NewRelic cafeteria delivery challans (NewRelic site only)',
    defaultPage: '/newrelic',
    tabs: ['newrelic_dc', 'newrelic_dc_create', 'signed_copies'],
  },
  {
    id: 'accountant',
    name: 'Accountant & Billing',
    description: 'Invoicing, quotations, master catalogs, and general delivery challans',
    defaultPage: '/invoices',
    tabs: [
      'invoices',
      'invoices_create',
      'quotations',
      'quotations_create',
      'billing',
      'masters',
      'general_dc',
      'hr_docs',
    ],
  },
  {
    id: 'full_admin',
    name: 'Full Admin / Superadmin',
    description: 'Unrestricted access to all operational, dispatch, billing, and admin systems',
    defaultPage: '/delivery-challan',
    tabs: [
      'tuckshop',
      'tuckshop_pos',
      'attendance',
      'leaves',
      'stock_request',
      'newrelic_dc',
      'newrelic_dc_create',
      'general_dc',
      'general_dc_create',
      'signed_copies',
      'invoices',
      'invoices_create',
      'quotations',
      'quotations_create',
      'billing',
      'masters',
      'hr_docs',
      'hr_docs_create',
      'stock_admin',
      'tuckshop_reconcile',
      'pricing',
      'catalog',
      'payroll',
      'employees',
      'analytics',
      'exports_download',
      'users_admin',
      'settings',
      'hungerbox_tracker',
      'hungerbox_tracker_sync',
      'hungerbox_tracker_settings',
      'can_delete',
    ],
  },
  {
    id: 'guest_auditor',
    name: 'Guest / Auditor (Read-Only)',
    description:
      'View-only access across stall operations, delivery challans, quotations, and catalogs. Invoices & signed copies strictly restricted.',
    defaultPage: '/delivery-challan',
    tabs: [
      'tuckshop',
      'tuckshop_pos',
      'attendance',
      'leaves',
      'stock_request',
      'newrelic_dc',
      'general_dc',
      'quotations',
      'masters',
      'hr_docs',
      'stock_admin',
      'tuckshop_reconcile',
      'pricing',
      'catalog',
      'payroll',
      'employees',
      'analytics',
      'settings',
    ],
  },
];

export const DEFAULT_LANDING_PAGES = [
  { label: 'Tuckshop Sales & Ledger (Assigned Site)', path: '/newrelic/tuckshop', category: 'Operations' },
  { label: 'Daily Attendance (Assigned Site)', path: '/newrelic/attendance', category: 'Operations' },
  { label: 'Leaves & Holiday Calendar (Assigned Site)', path: '/newrelic/leaves', category: 'Operations' },
  { label: 'Request Stock (Assigned Site)', path: '/newrelic/stock-request', category: 'Operations' },
  { label: 'General Delivery Challan (Other Companies)', path: '/delivery-challan', category: 'Dispatch' },
  { label: 'NewRelic Delivery Challan Hub (NewRelic only)', path: '/newrelic', category: 'Dispatch' },
  { label: 'Customer Quotations & Proposals', path: '/quotations', category: 'Invoicing' },
  { label: 'Invoices & Billing Dashboard', path: '/invoices', category: 'Invoicing' },
  { label: 'Stock Approvals (Admin)', path: '/newrelic/stock-requests-admin', category: 'Admin' },
  { label: 'Tuckshop Daily Reconciliation (Admin)', path: '/newrelic/reconcile', category: 'Admin' },
  { label: 'Salaries & Advances Payroll (Admin)', path: '/newrelic/attendance?tab=payroll', category: 'Admin' },
  { label: 'Executive Analytics (Admin)', path: '/newrelic/analytics', category: 'Admin' },
  { label: 'Cash & Carry Portal', path: '/tracker', category: 'Operations' },
  { label: 'User Management & Security (Admin)', path: '/admin/users', category: 'Admin' },
  { label: 'Company Settings (Admin)', path: '/settings', category: 'Admin' },
];

/**
 * Checks whether a user has permission to access a given permission key.
 * Admins and Superadmins have access to everything by default.
 * Guests have view access to operational and catalog modules, but NEVER invoices, signed copies, or deletion.
 */
export function hasPermission(
  user: { role?: string; allowedTabs?: string[]; assignedApps?: string[]; assignedSite?: string; canDelete?: boolean } | null | undefined,
  key: PermissionKey
): boolean {
  if (!user) return false;
  if (user.role === 'admin' || user.role === 'superadmin') return true;

  // Strict Delete Protection clearance
  if (key === 'can_delete') {
    if (user.role === 'guest') return false; // Guests CAN NEVER delete
    if ((user as any).canDelete === true) return true;
    if (user.allowedTabs && user.allowedTabs.includes('can_delete')) return true;
    return false;
  }

  // Guest security enforcement & module scoping
  if (user.role === 'guest') {
    // Guest MUST NOT have access to user management, invoices, signed copies, or record deletion!
    if (
      key === 'users_admin' ||
      key === 'invoices' ||
      key === 'invoices_create' ||
      key === 'billing' ||
      key === 'signed_copies'
    ) {
      return false;
    }

    // Site isolation: NewRelic DC is strictly blocked for non-NewRelic sites (DSM & NTT Data)
    if (
      (key === 'newrelic_dc' || key === 'newrelic_dc_create') &&
      (user.assignedSite === 'dsm' || user.assignedSite === 'ntt_data')
    ) {
      return false;
    }

    // If admin explicitly configured allowedTabs for this guest, strictly respect allowedTabs!
    if (user.allowedTabs && user.allowedTabs.length > 0) {
      if (user.allowedTabs.includes(key)) return true;

      // Granular parent/child checks
      if (key === 'tuckshop_pos' && user.allowedTabs.includes('tuckshop')) return true;
      if (key === 'newrelic_dc_create' && user.allowedTabs.includes('newrelic_dc')) return true;
      if (key === 'general_dc_create' && user.allowedTabs.includes('general_dc')) return true;
      if (key === 'quotations' && user.allowedTabs.includes('billing')) return true;
      if (key === 'quotations_create' && (user.allowedTabs.includes('quotations') || user.allowedTabs.includes('billing'))) return true;
      if (key === 'hr_docs_create' && user.allowedTabs.includes('hr_docs')) return true;
      if (key === 'exports_download' && (user.allowedTabs.includes('analytics') || user.allowedTabs.includes('stock_admin'))) return true;

      return false;
    }

    // Backwards-compatible legacy assignedApps check for guest
    if (user.assignedApps && user.assignedApps.length > 0) {
      if (key === 'general_dc' && user.assignedApps.includes('/delivery-challans')) return true;
      if (key === 'newrelic_dc' && user.assignedApps.includes('/newrelic')) return true;
      if ((key === 'tuckshop' || key === 'tuckshop_pos') && (user.assignedApps.includes('/newrelic') || user.assignedApps.includes('/tuckshop'))) return true;
      if (key === 'attendance' && user.assignedApps.includes('/newrelic')) return true;
      if (key === 'stock_request' && user.assignedApps.includes('/newrelic')) return true;
      if (key === 'quotations' && user.assignedApps.includes('/quotations')) return true;
      if (key === 'masters' && user.assignedApps.includes('/invoices')) return true;
      if (key === 'hr_docs' && (user.assignedApps.includes('/payslip') || user.assignedApps.includes('/offer-letter'))) return true;
      return false;
    }

    // Default guest fallback when allowedTabs has not been configured yet
    return true;
  }

  // NewRelic DC is strictly blocked for non-NewRelic sites (DSM & NTT Data)
  if (
    (key === 'newrelic_dc' || key === 'newrelic_dc_create') &&
    (user.assignedSite === 'dsm' || user.assignedSite === 'ntt_data')
  ) {
    return false;
  }

  // Check explicit allowedTabs
  if (user.allowedTabs && user.allowedTabs.length > 0) {
    if (user.allowedTabs.includes(key)) return true;

    // Granular fallbacks & hierarchy
    if (key === 'billing' && (user.allowedTabs.includes('invoices') || user.allowedTabs.includes('quotations'))) return true;
    if (key === 'invoices' && user.allowedTabs.includes('billing')) return true;
    if (key === 'quotations' && user.allowedTabs.includes('billing')) return true;
    if (key === 'newrelic_dc_create' && user.allowedTabs.includes('newrelic_dc')) return true;
    if (key === 'general_dc_create' && user.allowedTabs.includes('general_dc')) return true;
    if (key === 'signed_copies' && (user.allowedTabs.includes('general_dc') || user.allowedTabs.includes('newrelic_dc'))) return true;
    if (key === 'tuckshop_pos' && user.allowedTabs.includes('tuckshop')) return true;
    if (key === 'invoices_create' && (user.allowedTabs.includes('invoices') || user.allowedTabs.includes('billing'))) return true;
    if (key === 'quotations_create' && (user.allowedTabs.includes('quotations') || user.allowedTabs.includes('billing'))) return true;
    if (key === 'hr_docs_create' && user.allowedTabs.includes('hr_docs')) return true;
    if (key === 'exports_download' && (user.allowedTabs.includes('analytics') || user.allowedTabs.includes('stock_admin'))) return true;
    if (key === 'leaves' && (user.allowedTabs.includes('attendance') || user.allowedTabs.includes('payroll') || user.allowedTabs.includes('leaves'))) return true;
  }

  // Backwards compatibility with legacy assignedApps
  if (user.assignedApps && user.assignedApps.length > 0) {
    if ((key === 'general_dc' || key === 'general_dc_create') && user.assignedApps.includes('/delivery-challans')) return true;
    if ((key === 'newrelic_dc' || key === 'newrelic_dc_create') && user.assignedApps.includes('/newrelic')) return true;
    if ((key === 'tuckshop' || key === 'tuckshop_pos') && (user.assignedApps.includes('/newrelic') || user.assignedApps.includes('/tuckshop'))) return true;
    if ((key === 'attendance' || key === 'leaves') && user.assignedApps.includes('/newrelic')) return true;
    if (key === 'stock_request' && user.assignedApps.includes('/newrelic')) return true;
    if ((key === 'invoices' || key === 'invoices_create' || key === 'billing') && user.assignedApps.includes('/invoices')) return true;
    if ((key === 'quotations' || key === 'quotations_create') && (user.assignedApps.includes('/quotations') || user.assignedApps.includes('/invoices'))) return true;
    if (key === 'masters' && user.assignedApps.includes('/invoices')) return true;
    if ((key === 'hr_docs' || key === 'hr_docs_create') && (user.assignedApps.includes('/payslip') || user.assignedApps.includes('/offer-letter'))) return true;
    if (key === 'settings' && user.assignedApps.includes('/settings')) return true;
    if (key === 'signed_copies') return true;
  }

  return false;
}
