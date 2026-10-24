import { CatalogItem } from '@/types/challan';
import {
  saveCatalogItem,
  deleteCatalogItem,
  getCatalogDocId,
} from './newrelicCatalogService';

export interface DuplicateGroup {
  id: string;
  primaryReason: string;
  similarityScore: number; // 0 to 100
  matchType: 'exact_normalized' | 'noise_word_difference' | 'high_fuzzy' | 'brand_variant' | 'subset_variation';
  items: CatalogItem[];
  suggestedKeeperId: string;
}

export interface MergeResult {
  mergedItem: CatalogItem;
  deletedIds: string[];
}

/**
 * Standardize brand names for variation comparisons (e.g. plurals, aliases).
 */
export function normalizeBrand(brand: string): string {
  if (!brand) return '';
  let clean = brand
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');

  // Strip container/size in brand like 'bisleri (500ml)' -> 'bisleri'
  clean = clean.replace(/\d+(ml|l|gm|g|kg)$/, '');

  // Brand aliases
  if (clean.startsWith('happilomakhana') || clean === 'happilo') return 'happilo';
  if (clean.startsWith('beyondsnacks') || clean === 'beyond') return 'beyond';
  if (clean === 'lays' || clean === 'lay') return 'lays';
  if (clean === 'haldirams' || clean === 'haldiram') return 'haldiram';
  if (clean === 'britannias' || clean === 'britannia') return 'britannia';
  if (clean === 'cadburys' || clean === 'cadbury') return 'cadbury';
  if (clean === 'storia' || clean === 'storias') return 'storia';

  // Generic plural handling (e.g. Mcvities)
  if (clean.endsWith('s') && clean.length > 4) {
    clean = clean.slice(0, -1);
  }

  return clean;
}

/**
 * Remove noise words and standardize item names.
 */
export function normalizeItemName(name: string): string {
  if (!name) return '';
  let clean = name
    .trim()
    .toLowerCase()
    // normalize '&' to 'and'
    .replace(/&/g, ' and ')
    // normalize volume/weight e.g. 500 ml -> 500ml
    .replace(/(\d+)\s+(ml|l|gm|g|kg)\b/g, '$1$2')
    // normalize common beverage/snack compound phrases
    .replace(/\bmilk\s*shakes?\b/g, ' ')
    .replace(/\bshakes?\b/g, ' ')
    .replace(/\bjuices?\b/g, ' ')
    // remove parentheses
    .replace(/[()[\]{}]/g, ' ')
    // replace non-alphanumeric with space
    .replace(/[^a-z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // Strip standalone noise tokens: juice/juices, shake/shakes, chips, water, bottles, pack, etc.
  const noiseTokens = new Set([
    'chips',
    'water',
    'bottles',
    'bottle',
    'pack',
    'packet',
    'can',
    'tin',
    'bar',
    'milk',
  ]);

  const words = clean.split(' ').filter(w => Boolean(w));
  // If stripping noise leaves at least 1 word, strip them
  const filteredWords = words.filter(w => !noiseTokens.has(w));
  if (filteredWords.length > 0) {
    clean = filteredWords.join(' ');
  }

  return clean.replace(/\s+/g, ' ').trim();
}

/**
 * Levenshtein distance between two strings.
 */
export function levenshteinDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;

  const row = new Array(n + 1);
  for (let j = 0; j <= n; j++) row[j] = j;

  for (let i = 1; i <= m; i++) {
    let prev = i - 1;
    row[0] = i;
    for (let j = 1; j <= n; j++) {
      const cur = row[j];
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + cost);
      prev = cur;
    }
  }

  return row[n];
}

/**
 * Levenshtein ratio: 0 (completely different) to 1 (identical).
 */
export function levenshteinRatio(a: string, b: string): number {
  if (a === b) return 1;
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  const dist = levenshteinDistance(a, b);
  return Math.max(0, 1 - dist / maxLen);
}

/**
 * Token Dice coefficient: overlap between word sets.
 */
export function tokenSimilarity(a: string, b: string): number {
  const setA = new Set(a.split(/\s+/).filter(Boolean));
  const setB = new Set(b.split(/\s+/).filter(Boolean));
  if (setA.size === 0 && setB.size === 0) return 1;
  if (setA.size === 0 || setB.size === 0) return 0;

  let intersection = 0;
  for (const word of setA) {
    if (setB.has(word)) intersection++;
  }

  return (2 * intersection) / (setA.size + setB.size);
}

/**
 * Check if two items are near-duplicates and return reason & score.
 */
export function checkPairSimilarity(
  itemA: CatalogItem,
  itemB: CatalogItem
): { isDuplicate: boolean; reason: string; score: number; matchType: DuplicateGroup['matchType'] } | null {
  const brandA = itemA.brandName?.trim() || '';
  const brandB = itemB.brandName?.trim() || '';
  const nameA = itemA.itemName?.trim() || '';
  const nameB = itemB.itemName?.trim() || '';

  if (!nameA || !nameB) return null;

  const normBrandA = normalizeBrand(brandA);
  const normBrandB = normalizeBrand(brandB);

  // If brands are completely different, they cannot be duplicate catalog items
  if (normBrandA !== normBrandB) {
    return null;
  }

  const rawLowerNameA = nameA.toLowerCase();
  const rawLowerNameB = nameB.toLowerCase();

  // 1. Literal exact name match with brand singular/plural difference
  if (rawLowerNameA === rawLowerNameB) {
    if (brandA.toLowerCase() !== brandB.toLowerCase()) {
      return {
        isDuplicate: true,
        reason: `Brand spelling variation ("${brandA}" vs "${brandB}")`,
        score: 98,
        matchType: 'brand_variant',
      };
    }
    // Literal exact duplicate
    return {
      isDuplicate: true,
      reason: 'Exact duplicate item in catalog',
      score: 100,
      matchType: 'exact_normalized',
    };
  }

  // 2. Exact match after alphanumeric normalization (e.g. "Marie Gold" vs "Mariegold" or "Hot & Sweet" vs "Hot and Sweet")
  const alphaA = rawLowerNameA.replace(/&/g, 'and').replace(/[^a-z0-9]/g, '');
  const alphaB = rawLowerNameB.replace(/&/g, 'and').replace(/[^a-z0-9]/g, '');
  if (alphaA === alphaB && alphaA.length > 2) {
    return {
      isDuplicate: true,
      reason: `Spacing or punctuation variation ("${nameA}" vs "${nameB}")`,
      score: 96,
      matchType: 'exact_normalized',
    };
  }

  // 3. Noise word stripping (e.g. "Pomegranate" vs "Pomegranate Juice", "Strawberry Shake" vs "Strawberry Milk Shake")
  const normNameA = normalizeItemName(nameA);
  const normNameB = normalizeItemName(nameB);
  if (normNameA === normNameB && normNameA.length > 2) {
    return {
      isDuplicate: true,
      reason: `Descriptor or suffix difference ("${nameA}" vs "${nameB}")`,
      score: 92,
      matchType: 'noise_word_difference',
    };
  }

  // 4. Token overlap & Levenshtein on normalized names
  const tokenSim = tokenSimilarity(normNameA, normNameB);
  const levRatio = levenshteinRatio(normNameA, normNameB);

  // Both token and lev ratio very high (e.g. "Salt & Pepper" vs "Salt & Black Pepper", "Hot & Sweet Chilli" vs "Hot & Sweet Chili")
  if (tokenSim >= 0.70 && levRatio >= 0.70) {
    const avgScore = Math.round(((tokenSim + levRatio) / 2) * 100);
    return {
      isDuplicate: true,
      reason: `High phonetic / spelling similarity ("${nameA}" vs "${nameB}")`,
      score: Math.min(avgScore, 90),
      matchType: 'high_fuzzy',
    };
  }

  // Subset check: if one item's words are a strict subset of the other's (e.g. 'strawberry' in 'strawberry milk')
  const setA = new Set(normNameA.split(/\s+/).filter(Boolean));
  const setB = new Set(normNameB.split(/\s+/).filter(Boolean));
  if (setA.size > 0 && setB.size > 0) {
    const isASubsetOfB = Array.from(setA).every(w => setB.has(w));
    const isBSubsetOfA = Array.from(setB).every(w => setA.has(w));
    if ((isASubsetOfB || isBSubsetOfA) && Math.abs(setA.size - setB.size) <= 1) {
      return {
        isDuplicate: true,
        reason: `Flavor descriptor variation ("${nameA}" vs "${nameB}")`,
        score: 88,
        matchType: 'subset_variation',
      };
    }
  }

  // Single word with 1 typo (Levenshtein distance <= 1 for words > 4 chars)
  if (levenshteinDistance(alphaA, alphaB) === 1 && Math.min(alphaA.length, alphaB.length) >= 5) {
    return {
      isDuplicate: true,
      reason: `Minor typo / 1-character difference ("${nameA}" vs "${nameB}")`,
      score: 88,
      matchType: 'high_fuzzy',
    };
  }

  return null;
}

/**
 * Score a catalog item to pick the highest quality keeper.
 */
function scoreItemQuality(item: CatalogItem): number {
  let score = 0;
  // Has MRP defined
  if (item.mrp && item.mrp > 0) score += 40;
  // Has Case Size defined
  if (item.caseSize && item.caseSize > 0) score += 30;
  // Number of applicable sites
  const sitesCount = (item.applicableSites || []).length;
  if (sitesCount > 0) {
    score += item.applicableSites?.includes('all') ? 25 : Math.min(sitesCount * 8, 20);
  }
  // Standard title casing preference
  if (item.itemName && /[A-Z]/.test(item.itemName) && /[a-z]/.test(item.itemName)) {
    score += 10;
  }
  // Shorter cleaner title
  if (!/(\bjuices?\b|\bshakes?\b|\bchips\b)/i.test(item.itemName)) {
    score += 5;
  }
  return score;
}

/**
 * Scan the catalog and cluster duplicate candidates into groups.
 */
export function detectDuplicateCatalogGroups(items: CatalogItem[]): DuplicateGroup[] {
  if (!items || items.length < 2) return [];

  // Disjoint set / Union-Find for transitive clustering
  const parent = new Map<string, string>();
  const getItemId = (item: CatalogItem) =>
    item.id || getCatalogDocId(item.brandName, item.itemName);

  const find = (id: string): string => {
    if (!parent.has(id)) parent.set(id, id);
    if (parent.get(id) !== id) {
      parent.set(id, find(parent.get(id)!));
    }
    return parent.get(id)!;
  };

  const union = (id1: string, id2: string) => {
    const root1 = find(id1);
    const root2 = find(id2);
    if (root1 !== root2) {
      parent.set(root2, root1);
    }
  };

  type PairMatch = {
    itemA: CatalogItem;
    itemB: CatalogItem;
    reason: string;
    score: number;
    matchType: DuplicateGroup['matchType'];
  };

  const matches: PairMatch[] = [];

  // Compare each pair
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      const itemA = items[i];
      const itemB = items[j];
      const idA = getItemId(itemA);
      const idB = getItemId(itemB);

      // Same docId
      if (idA === idB) {
        matches.push({
          itemA,
          itemB,
          reason: 'Identical key collision in catalog',
          score: 100,
          matchType: 'exact_normalized',
        });
        union(idA, idB);
        continue;
      }

      const sim = checkPairSimilarity(itemA, itemB);
      if (sim && sim.isDuplicate) {
        matches.push({
          itemA,
          itemB,
          reason: sim.reason,
          score: sim.score,
          matchType: sim.matchType,
        });
        union(idA, idB);
      }
    }
  }

  if (matches.length === 0) return [];

  // Cluster items by root parent
  const clusters = new Map<string, Set<CatalogItem>>();
  for (const match of matches) {
    const root = find(getItemId(match.itemA));
    if (!clusters.has(root)) {
      clusters.set(root, new Set());
    }
    clusters.get(root)!.add(match.itemA);
    clusters.get(root)!.add(match.itemB);
  }

  // Convert clusters into DuplicateGroup objects
  const groups: DuplicateGroup[] = [];
  let groupIndex = 1;

  for (const [, memberSet] of clusters) {
    const memberItems = Array.from(memberSet);
    if (memberItems.length < 2) continue;

    // Determine highest score & representative match reason
    let topScore = 0;
    let representativeReason = 'Near-duplicate catalog entries';
    let topMatchType: DuplicateGroup['matchType'] = 'high_fuzzy';

    for (const match of matches) {
      const idA = getItemId(match.itemA);
      const inCluster = memberItems.some(m => getItemId(m) === idA);
      if (inCluster && match.score > topScore) {
        topScore = match.score;
        representativeReason = match.reason;
        topMatchType = match.matchType;
      }
    }

    // Pick suggested keeper: highest quality score
    let bestKeeper = memberItems[0];
    let bestKeeperScore = -Infinity;

    for (const item of memberItems) {
      const score = scoreItemQuality(item);
      if (score > bestKeeperScore) {
        bestKeeperScore = score;
        bestKeeper = item;
      }
    }

    groups.push({
      id: `dup_group_${groupIndex++}`,
      primaryReason: representativeReason,
      similarityScore: topScore || 85,
      matchType: topMatchType,
      items: memberItems,
      suggestedKeeperId: getItemId(bestKeeper),
    });
  }

  // Sort groups: highest confidence first
  return groups.sort((a, b) => b.similarityScore - a.similarityScore);
}

/**
 * Merge a duplicate group into a single keeper item.
 * Preserves the keeper, updates missing MRP/CaseSize, unifies sites, and deletes duplicate records.
 */
export async function mergeDuplicateGroup(
  group: DuplicateGroup,
  keeperId: string,
  overrides?: Partial<CatalogItem>
): Promise<MergeResult> {
  const getItemId = (item: CatalogItem) =>
    item.id || getCatalogDocId(item.brandName, item.itemName);

  const keeper = group.items.find(i => getItemId(i) === keeperId) || group.items[0];
  const duplicates = group.items.filter(i => getItemId(i) !== getItemId(keeper));

  // Merge sites: Union of applicable sites across all items
  const sitesSet = new Set<'newrelic' | 'dsm' | 'ntt_data' | 'all'>();
  for (const item of group.items) {
    const sites = item.applicableSites || ['newrelic'];
    for (const s of sites) {
      sitesSet.add(s);
    }
  }

  let mergedSites: ('newrelic' | 'dsm' | 'ntt_data' | 'all')[];
  if (sitesSet.has('all') || (sitesSet.has('newrelic') && sitesSet.has('dsm') && sitesSet.has('ntt_data'))) {
    mergedSites = ['all'];
  } else {
    mergedSites = Array.from(sitesSet);
  }

  // Find best MRP and Case Size
  const bestMrp = overrides?.mrp !== undefined
    ? overrides.mrp
    : keeper.mrp || duplicates.find(d => d.mrp !== undefined)?.mrp;

  const bestCaseSize = overrides?.caseSize !== undefined
    ? overrides.caseSize
    : keeper.caseSize || duplicates.find(d => d.caseSize !== undefined)?.caseSize;

  const mergedItem: CatalogItem = {
    ...keeper,
    brandName: overrides?.brandName?.trim() || keeper.brandName.trim(),
    itemName: overrides?.itemName?.trim() || keeper.itemName.trim(),
    defaultQuantity: overrides?.defaultQuantity || keeper.defaultQuantity || 1,
    caseSize: bestCaseSize,
    mrp: bestMrp,
    applicableSites: mergedSites,
  };

  const finalDocId = getItemId(keeper);

  // 1. Save the updated keeper item
  await saveCatalogItem(mergedItem, finalDocId);

  // 2. Delete all other duplicate items
  const deletedIds: string[] = [];
  for (const dup of duplicates) {
    const dupId = getItemId(dup);
    if (dupId !== finalDocId) {
      await deleteCatalogItem(dupId);
      deletedIds.push(dupId);
    }
  }

  return {
    mergedItem: { ...mergedItem, id: finalDocId },
    deletedIds,
  };
}
