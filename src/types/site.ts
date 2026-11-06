export type SiteId = 'newrelic' | 'dsm' | 'ntt_data' | (string & {});

export interface CompanySite {
  id: SiteId;
  name: string;
  allowedLocations: ('hyderabad' | 'bangalore')[];
  hasChallans: boolean; // Only NewRelic has delivery challans
  tagline?: string;
  description?: string;
  isCustom?: boolean;
  createdAt?: string;
}

export const DEFAULT_COMPANY_SITES: Record<string, CompanySite> = {
  newrelic: {
    id: 'newrelic',
    name: 'NewRelic',
    allowedLocations: ['hyderabad', 'bangalore'],
    hasChallans: true,
    tagline: 'Tech Cafeteria & Tuckshop',
    description: 'Dedicated NewRelic Delivery Challans Hub enabled. Multi-city location support.',
  },
  dsm: {
    id: 'dsm',
    name: 'DSM',
    allowedLocations: ['hyderabad'],
    hasChallans: false,
    tagline: 'Hyderabad Tuckshop',
    description: 'Tuckshop counter sales and daily staff attendance. Dedicated NewRelic DC is forbidden.',
  },
  ntt_data: {
    id: 'ntt_data',
    name: 'NTT Data',
    allowedLocations: ['hyderabad'],
    hasChallans: false,
    tagline: 'Hyderabad Tuckshop',
    description: 'Tuckshop counter sales and daily staff attendance. Dedicated NewRelic DC is forbidden.',
  },
};

export const COMPANY_SITES: Record<string, CompanySite> = {
  ...DEFAULT_COMPANY_SITES,
};

export interface SiteOption {
  value: SiteId;
  label: string;
  locations?: string;
  description?: string;
  isCustom?: boolean;
  hasChallans?: boolean;
}

export const SITE_OPTIONS: SiteOption[] = [
  {
    value: 'newrelic',
    label: 'NewRelic Stall',
    locations: 'Hyderabad & Bangalore',
    description: 'Dedicated NewRelic Delivery Challans Hub enabled. Multi-city location support.',
    hasChallans: true,
  },
  {
    value: 'dsm',
    label: 'DSM Stall',
    locations: 'Hyderabad Stall Only',
    description: 'Tuckshop counter sales and daily staff attendance. Dedicated NewRelic DC is forbidden.',
    hasChallans: false,
  },
  {
    value: 'ntt_data',
    label: 'NTT Data Stall',
    locations: 'Hyderabad Stall Only',
    description: 'Tuckshop counter sales and daily staff attendance. Dedicated NewRelic DC is forbidden.',
    hasChallans: false,
  },
];

/**
 * Register runtime dynamic sites into COMPANY_SITES and SITE_OPTIONS in memory.
 * Ensures all existing and future components accessing COMPANY_SITES get the latest sites without breaking.
 */
export function registerCompanySites(sites: CompanySite[]) {
  if (!Array.isArray(sites)) return;
  for (const s of sites) {
    if (!s || !s.id) continue;
    COMPANY_SITES[s.id] = {
      ...s,
      allowedLocations: s.allowedLocations || ['hyderabad'],
      hasChallans: Boolean(s.hasChallans),
    };
    const existingIdx = SITE_OPTIONS.findIndex((o) => o.value === s.id);
    const locText =
      s.allowedLocations?.length === 2
        ? 'Hyderabad & Bangalore'
        : s.allowedLocations?.[0] === 'bangalore'
        ? 'Bangalore Stall Only'
        : 'Hyderabad Stall Only';

    const opt: SiteOption = {
      value: s.id,
      label: s.name.endsWith('Stall') || s.name.endsWith('Cafeteria') ? s.name : `${s.name} Stall`,
      locations: locText,
      description: s.description || s.tagline || `${s.name} counter sales and staff attendance.`,
      isCustom: Boolean(s.isCustom),
      hasChallans: Boolean(s.hasChallans),
    };

    if (existingIdx >= 0) {
      SITE_OPTIONS[existingIdx] = opt;
    } else {
      SITE_OPTIONS.push(opt);
    }
  }
}

/**
 * Resolves safe siteId with fallback to 'newrelic'.
 * Guarantees 100% backwards compatibility and zero data loss for existing and custom records.
 */
export function resolveSiteId(siteId?: string | null): SiteId {
  if (siteId && typeof siteId === 'string' && siteId.trim()) {
    return siteId.trim() as SiteId;
  }
  return 'newrelic';
}

/**
 * Resolves all sites allowed for a user.
 * - Admin/superadmin: all sites ['newrelic', 'dsm', 'ntt_data', ...]
 * - Roaming manager with assignedSites: returns assignedSites
 * - Single assignedSite: returns [assignedSite]
 * - Fallback: ['newrelic']
 */
export function getUserAllowedSites(
  user?: {
    role?: string | null;
    assignedSites?: SiteId[];
    assignedSite?: SiteId | null;
  } | null,
  allKnownSites?: SiteId[]
): SiteId[] {
  if (!user) return ['newrelic'];
  if (user.role === 'admin' || user.role === 'superadmin') {
    if (allKnownSites && allKnownSites.length > 0) return allKnownSites;
    return Object.keys(COMPANY_SITES) as SiteId[];
  }
  if (user.assignedSites && Array.isArray(user.assignedSites) && user.assignedSites.length > 0) {
    return user.assignedSites;
  }
  if (user.assignedSite) {
    return [user.assignedSite];
  }
  return ['newrelic'];
}
