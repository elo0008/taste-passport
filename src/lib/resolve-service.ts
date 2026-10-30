import { QlooClient } from './qloo';
import { MemoryCache } from './cache';
import { extractSafeImageUrl } from './images';

export type FavoriteType = 'artist' | 'movie' | 'tv_show' | 'person' | 'podcast' | 'brand';

export const TYPE_TO_URN: Record<FavoriteType, string> = {
  artist: 'urn:entity:artist',
  movie: 'urn:entity:movie',
  tv_show: 'urn:entity:tv_show',
  person: 'urn:entity:person',
  podcast: 'urn:entity:podcast',
  brand: 'urn:entity:brand',
};

export interface ResolveCandidate {
  entityId: string;
  name: string;
  type: string;
  disambiguation?: string;
  year?: number;
  description?: string;
  imageUrl?: string | null;
}

export interface FavoriteResolveResult {
  inputName: string;
  inputType: FavoriteType;
  candidates: ResolveCandidate[];
  selectedId?: string;
}

const resolveCache = new MemoryCache(500);

export function shapeCandidate(item: any, fallbackType: string): ResolveCandidate {
  const entityId = item.entity_id || item.id || '';
  const name = item.name || '';
  const type = item.subtype || (Array.isArray(item.types) ? item.types[0] : fallbackType);
  const disambiguation = typeof item.disambiguation === 'string' ? item.disambiguation : undefined;

  let year: number | undefined;
  if (typeof item.properties?.release_year === 'number') {
    year = item.properties.release_year;
  } else if (typeof item.release_year === 'number') {
    year = item.release_year;
  } else if (disambiguation && /^\d{4}$/.test(disambiguation.trim())) {
    year = parseInt(disambiguation.trim(), 10);
  }

  let description: string | undefined;
  if (typeof item.properties?.description === 'string' && item.properties.description.trim()) {
    description = item.properties.description.trim();
  } else if (Array.isArray(item.properties?.short_descriptions) && item.properties.short_descriptions[0]) {
    description = String(item.properties.short_descriptions[0]);
  } else if (typeof item.properties?.short_descriptions === 'string') {
    description = item.properties.short_descriptions;
  }

  return {
    entityId,
    name,
    type,
    disambiguation,
    year,
    description,
    imageUrl: extractSafeImageUrl(item),
  };
}

export async function resolveSingleFavorite(
  client: QlooClient,
  name: string,
  type: FavoriteType
): Promise<ResolveCandidate[]> {
  const cacheKey = `resolve:${type}:${name.trim().toLowerCase()}`;
  const cached = resolveCache.get<ResolveCandidate[]>(cacheKey);
  if (cached) {
    return cached;
  }

  const typeUrn = TYPE_TO_URN[type];
  const candidates: ResolveCandidate[] = [];
  const seenIds = new Set<string>();

  // 1. Typed search first
  try {
    const typedResults = await client.search({
      query: name,
      types: typeUrn,
      take: 5,
    });

    for (const item of typedResults || []) {
      const candidate = shapeCandidate(item, typeUrn);
      if (candidate.entityId && !seenIds.has(candidate.entityId)) {
        seenIds.add(candidate.entityId);
        candidates.push(candidate);
      }
    }
  } catch (err: any) {
    if (err?.status && err.status >= 500) {
      throw err;
    }
    // Continue to untyped fallback
  }

  // 2. Untyped search fallback if < 3 candidates
  if (candidates.length < 3) {
    try {
      const untypedResults = await client.search({
        query: name,
        take: 5,
      });

      for (const item of untypedResults || []) {
        const candidate = shapeCandidate(item, typeUrn);
        if (candidate.entityId && !seenIds.has(candidate.entityId)) {
          seenIds.add(candidate.entityId);
          candidates.push(candidate);
          if (candidates.length >= 3) break;
        }
      }
    } catch (err: any) {
      if (err?.status && err.status >= 500) {
        throw err;
      }
      // Ignore
    }
  }

  let finalCandidates = sortCandidates(candidates, name).slice(0, 3);
  if (finalCandidates.length > 0) {
    resolveCache.set(cacheKey, finalCandidates, 24 * 60 * 60 * 1000);
  }

  return finalCandidates;
}

export function isSequel(name: string, inputName: string): boolean {
  const normName = name.trim().toLowerCase();
  const normInput = inputName.trim().toLowerCase();
  const sequelPattern = /\b(2|3|4|ii|iii|iv|part\s*2|part\s*ii|chapter\s*2)\b/i;
  return sequelPattern.test(normName) && !sequelPattern.test(normInput);
}

export function sortCandidates(candidates: ResolveCandidate[], inputName: string): ResolveCandidate[] {
  const cleanInput = inputName.replace(/\(\d{4}\)/g, '').trim().toLowerCase();

  return [...candidates].sort((a, b) => {
    const aSequel = isSequel(a.name, inputName);
    const bSequel = isSequel(b.name, inputName);
    if (aSequel !== bSequel) {
      return aSequel ? 1 : -1; // non-sequel first
    }

    const aClean = a.name.replace(/\(\d{4}\)/g, '').trim().toLowerCase();
    const bClean = b.name.replace(/\(\d{4}\)/g, '').trim().toLowerCase();
    const aExact = aClean === cleanInput;
    const bExact = bClean === cleanInput;
    if (aExact !== bExact) {
      return aExact ? -1 : 1; // exact match first
    }

    const aYear = a.year ?? 9999;
    const bYear = b.year ?? 9999;
    if (aYear !== bYear) {
      return aYear - bYear;
    }

    return 0;
  });
}

export async function resolveFavoritesBatch(
  client: QlooClient,
  favorites: Array<{ name: string; type: FavoriteType }>
): Promise<FavoriteResolveResult[]> {
  const results = await Promise.all(
    favorites.map(async (fav) => {
      const candidates = await resolveSingleFavorite(client, fav.name, fav.type);
      return {
        inputName: fav.name,
        inputType: fav.type,
        candidates,
        selectedId: candidates[0]?.entityId,
      };
    })
  );

  return results;
}

