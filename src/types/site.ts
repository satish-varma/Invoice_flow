export type SiteId = 'newrelic' | 'dsm' | 'ntt_data';

export interface CompanySite {
  id: SiteId;
  name: string;
  allowedLocations: ('hyderabad' | 'bangalore')[];
  hasChallans: boolean; // Only NewRelic has delivery challans
  tagline?: string;
}

export const COMPANY_SITES: Record<SiteId, CompanySite> = {
  newrelic: {
    id: 'newrelic',
    name: 'NewRelic',
    allowedLocations: ['hyderabad', 'bangalore'],
    hasChallans: true,
    tagline: 'Tech Cafeteria & Tuckshop',
  },
  dsm: {
    id: 'dsm',
    name: 'DSM',
    allowedLocations: ['hyderabad'],
    hasChallans: false,
    tagline: 'Hyderabad Tuckshop',
  },
  ntt_data: {
    id: 'ntt_data',
    name: 'NTT Data',
    allowedLocations: ['hyderabad'],
    hasChallans: false,
    tagline: 'Hyderabad Tuckshop',
  },
};

export const SITE_OPTIONS: { value: SiteId; label: string }[] = [
  { value: 'newrelic', label: 'NewRelic' },
  { value: 'dsm', label: 'DSM' },
  { value: 'ntt_data', label: 'NTT Data' },
];

/**
 * Resolves safe siteId with fallback to 'newrelic'.
 * Guarantees 100% backwards compatibility and zero data loss for existing records.
 */
export function resolveSiteId(siteId?: string | null): SiteId {
  if (siteId === 'dsm' || siteId === 'ntt_data') return siteId;
  return 'newrelic';
}

/**
 * Resolves all sites allowed for a user.
 * - Admin/superadmin: all sites ['newrelic', 'dsm', 'ntt_data']
 * - Roaming manager with assignedSites: returns assignedSites
 * - Single assignedSite: returns [assignedSite]
 * - Fallback: ['newrelic']
 */
export function getUserAllowedSites(user?: {
  role?: string | null;
  assignedSites?: SiteId[];
  assignedSite?: SiteId;
} | null): SiteId[] {
  if (!user) return ['newrelic'];
  if (user.role === 'admin' || user.role === 'superadmin') {
    return ['newrelic', 'dsm', 'ntt_data'];
  }
  if (user.assignedSites && Array.isArray(user.assignedSites) && user.assignedSites.length > 0) {
    return user.assignedSites;
  }
  if (user.assignedSite) {
    return [user.assignedSite];
  }
  return ['newrelic'];
}
