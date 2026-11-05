/**
 * Utilities for scoping tracker data (invoices, downloads, analytics) based on
 * user permissions, starting dates, assigned locations, and assigned stalls.
 */

export const LOCATION_STALLS_MAP: Record<string, string[]> = {
  Broadridge: [
    'Juicytailes Juice Counter',
    'Munchbox Live Counter',
    'Slurpstore Bakery',
  ],
  'CGI Information Systems': [
    'SipnByte DLF',
    'SipnByte Skyview',
    'Snack On DLF',
    'Tuck Shop',
  ],
  Covance: [
    'Covance SoftSol',
    'Tuckshop Covance',
  ],
  'DSM Shared Services': [
    'Live Counter',
    'The Gut Guru',
  ],
  IBM: [
    'Gut Guru Tuckshop',
    'Juice Counter',
    'Live Counter',
    'Orion 14th Floor Cafeteria Tuckshop',
    'Tuck Shop',
  ],
  'NTT Data': [
    'Tuckshop NTT DATA',
  ],
  'New Relic': [
    'Relic Fresh',
  ],
  Qualcomm: [
    'The Gut Guru Event',
  ],
};

export const TRACKER_LOCATIONS = Object.keys(LOCATION_STALLS_MAP).sort();

export const TRACKER_STALLS = Array.from(
  new Set(Object.values(LOCATION_STALLS_MAP).flat())
).sort();

/**
 * Returns available stalls for a given array of selected locations.
 * If no locations are provided, returns all tracker stalls.
 */
export function getStallsForLocations(locations?: string[]): string[] {
  if (!locations || locations.length === 0) {
    return TRACKER_STALLS;
  }
  const stalls = new Set<string>();
  locations.forEach((loc) => {
    (LOCATION_STALLS_MAP[loc] || []).forEach((st) => stalls.add(st));
  });
  return Array.from(stalls).sort();
}

export interface TrackerScope {
  assignedStartDate?: string | null;
  assignedLocations?: string[];
  assignedStalls?: string[];
}

/**
 * Strips all whitespace, punctuation, and non-alphanumeric characters for fuzzy matching.
 */
export function cleanKey(str?: string | null): string {
  return (str || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Checks if an invoice's location matches the user's assigned locations.
 * Handles exact matches, case/space insensitivity, substring matching, and known aliases
 * (e.g., Covance <-> Soft Sol, New Relic <-> Bengaluru - NewRelic).
 */
export function matchesLocation(invLocation?: string | null, assignedLocations?: string[]): boolean {
  if (!assignedLocations || assignedLocations.length === 0) return true;
  if (!invLocation) return false;

  const cInv = cleanKey(invLocation);
  return assignedLocations.some((al) => {
    const cAl = cleanKey(al);
    if (!cAl) return false;
    if (cInv === cAl) return true;
    if (cAl.length >= 3 && (cInv.includes(cAl) || cAl.includes(cInv))) return true;

    // Known location aliases
    if (cAl.includes('covance') && (cInv.includes('softsol') || cInv.includes('madala'))) return true;
    if ((cAl.includes('softsol') || cAl.includes('madala')) && cInv.includes('covance')) return true;

    return false;
  });
}

/**
 * Checks if an invoice's stall matches the user's assigned stalls.
 * Handles exact matches, normalized spacing (e.g. "SipnByte DLF" vs "Sip n Byte (DLF)"),
 * and cafeteria suffixes (e.g. "Main Cafeteria Broadridge").
 */
export function matchesStall(invStall?: string | null, assignedStalls?: string[]): boolean {
  if (!assignedStalls || assignedStalls.length === 0) return true;
  if (!invStall) return false;

  const cInv = cleanKey(invStall);
  return assignedStalls.some((as) => {
    const cAs = cleanKey(as);
    if (!cAs) return false;
    if (cInv === cAs) return true;
    if (cAs.length >= 4 && (cInv.includes(cAs) || cAs.includes(cInv))) return true;

    // Known stall aliases / parent groups
    if (cAs.includes('juice') && cInv.includes('juice')) return true;
    if (cAs.includes('covance') && cInv.includes('covance')) return true;
    if (cAs.includes('gutguru') && cInv.includes('gutguru')) return true;

    return false;
  });
}

/**
 * Comprehensive check whether a given invoice is accessible within the given scope.
 */
export function isInvoiceInScope(
  invoice: {
    date?: string | null;
    serviceDateRange?: string | null;
    location?: string | null;
    stall?: string | null;
  },
  scope: TrackerScope
): boolean {
  if (scope.assignedStartDate) {
    if (!invoice.date) return false;
    if (invoice.date < scope.assignedStartDate) return false;
  }

  if (scope.assignedLocations && scope.assignedLocations.length > 0) {
    if (!matchesLocation(invoice.location, scope.assignedLocations)) return false;
  }

  if (scope.assignedStalls && scope.assignedStalls.length > 0) {
    if (!matchesStall(invoice.stall, scope.assignedStalls)) return false;
  }

  return true;
}
