import { QlooClient } from './qloo';

export interface EnrichedCuisineTag {
  id: string;
  name: string;
  cSig: number;
  cBase: number;
  enrichment: number;
}

export interface FavoriteSignalCheck {
  favoriteName: string;
  resolvedId: string;
  enrichedTags: Array<{
    id: string;
    name: string;
    enrichment: number;
    count: number;
  }>;
  summary: string;
}

export interface CuisineInferenceResult {
  topCuisines: EnrichedCuisineTag[];
  signalCheck: FavoriteSignalCheck[];
  baselinePlaces: any[];
  combinedPlaces: any[];
  coverage: number;
  qlooCalls: number;
}

export const BROAD_RESTAURANT_TAG = 'urn:tag:genre:place:restaurant';

export const GROCERY_MAPPING_KEYWORDS = [
  'kerala',
  'south_indian',
  'south indian',
  'indian',
  'punjabi',
  'north_indian',
  'north indian',
];

export const INDIAN_GROCERY_TAG = 'urn:tag:category:place:indian_grocery_store';

export function extractCuisineTagsFromPlace(place: any): Array<{ id: string; name: string }> {
  const tags = place?.tags || [];
  const results: Array<{ id: string; name: string }> = [];

  for (const t of tags) {
    const id = t.id || '';
    if (
      (id.startsWith('urn:tag:cuisine:') || id.startsWith('urn:tag:genre:place:restaurant:')) &&
      id !== BROAD_RESTAURANT_TAG
    ) {
      results.push({
        id: t.id,
        name: t.name || id.split(':').pop() || id,
      });
    }
  }

  return results;
}

export function shouldAddGroceryCategory(topEnrichedTag: EnrichedCuisineTag | undefined): boolean {
  if (!topEnrichedTag) return false;
  const tagIdNorm = topEnrichedTag.id.toLowerCase();
  const tagNameNorm = topEnrichedTag.name.toLowerCase();

  return GROCERY_MAPPING_KEYWORDS.some(
    (kw) => tagIdNorm.includes(kw) || tagNameNorm.includes(kw)
  );
}

export async function inferCuisinesFromTaste(
  client: QlooClient,
  city: string,
  favorites: Array<{ resolvedId: string; resolvedName: string }>
): Promise<CuisineInferenceResult> {
  let qlooCalls = 0;
  const entityIds = favorites.map((f) => f.resolvedId);

  // 1. Combined restaurant query (signals all favorites, broad tag, take 50)
  qlooCalls++;
  const combinedRes = await client.insights({
    filterType: 'urn:entity:place',
    signalEntities: entityIds,
    filterLocationQuery: city,
    filterTags: BROAD_RESTAURANT_TAG,
    take: 50,
  });
  const combinedPlaces: any[] =
    combinedRes?.results?.entities ||
    combinedRes?.entities ||
    (Array.isArray(combinedRes) ? combinedRes : []);

  // 2. Baseline restaurant query (no signals, broad tag, take 50)
  qlooCalls++;
  const baseRes = await client.insights({
    filterType: 'urn:entity:place',
    filterLocationQuery: city,
    filterTags: BROAD_RESTAURANT_TAG,
    take: 50,
  });
  const baselinePlaces: any[] =
    baseRes?.results?.entities ||
    baseRes?.entities ||
    (Array.isArray(baseRes) ? baseRes : []);

  // 3. Count cBase(t)
  const cBaseMap: Record<string, number> = {};
  for (const p of baselinePlaces) {
    const seenInPlace = new Set<string>();
    for (const t of extractCuisineTagsFromPlace(p)) {
      if (!seenInPlace.has(t.id)) {
        seenInPlace.add(t.id);
        cBaseMap[t.id] = (cBaseMap[t.id] || 0) + 1;
      }
    }
  }

  // 4. Count cSig(t)
  const cSigMap: Record<string, number> = {};
  const tagNames: Record<string, string> = {};
  let placesWithCuisineTag = 0;

  for (const p of combinedPlaces) {
    const cTags = extractCuisineTagsFromPlace(p);
    if (cTags.length > 0) placesWithCuisineTag++;
    const seenInPlace = new Set<string>();
    for (const t of cTags) {
      if (!seenInPlace.has(t.id)) {
        seenInPlace.add(t.id);
        tagNames[t.id] = t.name;
        cSigMap[t.id] = (cSigMap[t.id] || 0) + 1;
      }
    }
  }

  const coverage = combinedPlaces.length > 0 ? placesWithCuisineTag / combinedPlaces.length : 0;

  // 5. Enrichment = (cSig + 1) / (cBase + 1) with cSig >= 3
  const enrichedTags: EnrichedCuisineTag[] = [];
  for (const [id, cSig] of Object.entries(cSigMap)) {
    if (cSig >= 3) {
      const cBase = cBaseMap[id] || 0;
      const enrichment = (cSig + 1) / (cBase + 1);
      enrichedTags.push({
        id,
        name: tagNames[id] || id,
        cSig,
        cBase,
        enrichment,
      });
    }
  }

  // Sort descending by enrichment, then cSig
  enrichedTags.sort((a, b) => b.enrichment - a.enrichment || b.cSig - a.cSig);

  // Deduplicate by normalized name so we don't have multiple categories for "Indian"
  const distinctTopCuisines: EnrichedCuisineTag[] = [];
  const seenNormNames = new Set<string>();

  for (const tag of enrichedTags) {
    const norm = tag.name.trim().toLowerCase();
    if (!seenNormNames.has(norm)) {
      seenNormNames.add(norm);
      distinctTopCuisines.push(tag);
      if (distinctTopCuisines.length >= 3) break;
    }
  }

  // 6. Single-signal queries for Signal Check
  const signalCheckResults: FavoriteSignalCheck[] = [];

  for (const fav of favorites) {
    qlooCalls++;
    const singleRes = await client.insights({
      filterType: 'urn:entity:place',
      signalEntities: [fav.resolvedId],
      filterLocationQuery: city,
      filterTags: BROAD_RESTAURANT_TAG,
      take: 50,
    });
    const sPlaces: any[] =
      singleRes?.results?.entities ||
      singleRes?.entities ||
      (Array.isArray(singleRes) ? singleRes : []);

    const sCounts: Record<string, number> = {};
    const sNames: Record<string, string> = {};

    for (const p of sPlaces) {
      const seen = new Set<string>();
      for (const t of extractCuisineTagsFromPlace(p)) {
        if (!seen.has(t.id)) {
          seen.add(t.id);
          sNames[t.id] = t.name;
          sCounts[t.id] = (sCounts[t.id] || 0) + 1;
        }
      }
    }

    const enrichedForFav: Array<{
      id: string;
      name: string;
      enrichment: number;
      count: number;
    }> = [];

    for (const [id, count] of Object.entries(sCounts)) {
      if (count >= 3) {
        const cBase = cBaseMap[id] || 0;
        const enrichment = (count + 1) / (cBase + 1);
        if (enrichment >= 1.5) {
          enrichedForFav.push({
            id,
            name: sNames[id] || id,
            enrichment,
            count,
          });
        }
      }
    }

    enrichedForFav.sort((a, b) => b.enrichment - a.enrichment || b.count - a.count);

    let summary = '';
    if (enrichedForFav.length > 0) {
      // Pick top distinct cuisine names
      const seenFavNorm = new Set<string>();
      const topDistinct = enrichedForFav.filter((e) => {
        const n = e.name.toLowerCase();
        if (seenFavNorm.has(n)) return false;
        seenFavNorm.add(n);
        return true;
      }).slice(0, 3);

      const items = topDistinct.map((e) => `${e.name} (${e.enrichment.toFixed(1)}x)`);
      summary = `${fav.resolvedName} -> ${items.join(', ')}`;
    } else {
      summary = `${fav.resolvedName}: did not visibly shape cuisines`;
    }

    signalCheckResults.push({
      favoriteName: fav.resolvedName,
      resolvedId: fav.resolvedId,
      enrichedTags: enrichedForFav,
      summary,
    });
  }

  return {
    topCuisines: distinctTopCuisines,
    signalCheck: signalCheckResults,
    baselinePlaces,
    combinedPlaces,
    coverage,
    qlooCalls,
  };
}
