export interface RawPlace {
  entity_id?: string;
  id?: string;
  name?: string;
  is_closed?: boolean;
  properties?: {
    is_closed?: boolean;
    primary_genre?: { id?: string; name?: string };
    short_description?: string;
    description?: string;
    [key: string]: unknown;
  };
  tags?: Array<{ id?: string; name?: string }>;
  [key: string]: unknown;
}

/**
 * Filter Rule:
 * Rejects banquet halls, convention centers, and conference facilities that are not
 * primarily dining restaurants or grocery shops. Matches keywords across place name,
 * primary genre ID/name, and tag categories.
 */
const BANQUET_CONVENTION_REGEX = /\b(banquet|convention|conference|event space|event center|reception hall)\b/i;

export function isBanquetOrConventionVenue(place: RawPlace): boolean {
  const name = place.name || '';
  if (BANQUET_CONVENTION_REGEX.test(name)) {
    return true;
  }

  const primaryGenreId = place.properties?.primary_genre?.id || '';
  const primaryGenreName = place.properties?.primary_genre?.name || '';
  if (
    BANQUET_CONVENTION_REGEX.test(primaryGenreId) ||
    BANQUET_CONVENTION_REGEX.test(primaryGenreName)
  ) {
    return true;
  }

  if (Array.isArray(place.tags)) {
    for (const tag of place.tags) {
      if (
        (tag.id && BANQUET_CONVENTION_REGEX.test(tag.id)) ||
        (tag.name && BANQUET_CONVENTION_REGEX.test(tag.name))
      ) {
        return true;
      }
    }
  }

  return false;
}

export function isClosedPlace(place: RawPlace): boolean {
  return Boolean(place.is_closed || place.properties?.is_closed);
}

export function dedupePlacesById<T extends RawPlace>(places: T[]): T[] {
  const seen = new Set<string>();
  const deduped: T[] = [];

  for (const place of places) {
    const id = place.entity_id || place.id;
    if (!id || seen.has(id)) continue;
    seen.add(id);
    deduped.push(place);
  }

  return deduped;
}

export function filterValidPlaces<T extends RawPlace>(places: T[]): T[] {
  const deduped = dedupePlacesById(places);
  return deduped.filter((place) => !isClosedPlace(place) && !isBanquetOrConventionVenue(place));
}

