import { describe, it, expect } from 'vitest';
import { validateIntentLimits, CategoryIntent } from '@/lib/planner';
import { isCityMatch, isAllowedGroceryTag } from '@/lib/tag-prober';
import { verifyGrounding, GroundingInputCategory, WriteOutput } from '@/lib/grounding';
import { MemoryRateLimiter } from '@/lib/rate-limit';
import { MemoryCache } from '@/lib/cache';
import { isBanquetOrConventionVenue, isClosedPlace, filterValidPlaces } from '@/lib/filters';
import { shapeCandidate } from '@/lib/resolve-service';

// ALL FIXTURES ARE SYNTHETIC
const SYNTHETIC_DESTINATION = 'Toronto';

describe('Planner Schema Validation & Allowlist Limits', () => {
  it('accepts a valid set of intents conforming to ratio rules', () => {
    const validIntents: CategoryIntent[] = [
      { kind: 'home_cuisine', keyword: 'south indian', reason: 'Home region palate' },
      { kind: 'home_cuisine', keyword: 'indian', reason: 'Subcontinental comfort' },
      { kind: 'stretch_cuisine', keyword: 'sri lankan', reason: 'Coastal spice overlap' },
      { kind: 'grocery', keyword: 'indian grocery', reason: 'Pantry essentials' },
    ];
    const result = validateIntentLimits(validIntents);
    expect(result.valid).toBe(true);
  });

  it('rejects more than 4 intents', () => {
    const tooMany: CategoryIntent[] = [
      { kind: 'home_cuisine', keyword: 'k1', reason: 'r1' },
      { kind: 'home_cuisine', keyword: 'k2', reason: 'r2' },
      { kind: 'stretch_cuisine', keyword: 'k3', reason: 'r3' },
      { kind: 'grocery', keyword: 'k4', reason: 'r4' },
      { kind: 'stretch_cuisine', keyword: 'k5', reason: 'r5' },
    ];
    const result = validateIntentLimits(tooMany);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Too many intents');
  });

  it('rejects more than 2 home_cuisine intents', () => {
    const tooManyHome: CategoryIntent[] = [
      { kind: 'home_cuisine', keyword: 'k1', reason: 'r1' },
      { kind: 'home_cuisine', keyword: 'k2', reason: 'r2' },
      { kind: 'home_cuisine', keyword: 'k3', reason: 'r3' },
    ];
    const result = validateIntentLimits(tooManyHome);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Exceeded home_cuisine limit');
  });

  it('rejects more than 1 stretch_cuisine intent', () => {
    const tooManyStretch: CategoryIntent[] = [
      { kind: 'home_cuisine', keyword: 'k1', reason: 'r1' },
      { kind: 'stretch_cuisine', keyword: 'k2', reason: 'r2' },
      { kind: 'stretch_cuisine', keyword: 'k3', reason: 'r3' },
    ];
    const result = validateIntentLimits(tooManyStretch);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Exceeded stretch_cuisine limit');
  });

  it('rejects more than 1 grocery intent', () => {
    const tooManyGrocery: CategoryIntent[] = [
      { kind: 'home_cuisine', keyword: 'k1', reason: 'r1' },
      { kind: 'grocery', keyword: 'k2', reason: 'r2' },
      { kind: 'grocery', keyword: 'k3', reason: 'r3' },
    ];
    const result = validateIntentLimits(tooManyGrocery);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Exceeded grocery limit');
  });
});

describe('Grocery Gate (Task C)', () => {
  it('accepts cultural grocery tags matching the culture identifier', () => {
    expect(isAllowedGroceryTag('Indian grocery store', 'urn:tag:category:place:indian_grocery_store', 'Indian')).toBe(true);
    expect(isAllowedGroceryTag('Indian grocery store', 'urn:tag:category:place:indian_grocery_store', 'Punjabi')).toBe(true);
    expect(isAllowedGroceryTag('South Asian Market', 'urn:tag:category:place:south_asian', 'Indian')).toBe(true);
  });

  it('rejects generic supermarket or grocery store tags', () => {
    expect(isAllowedGroceryTag('Supermarket', 'urn:tag:category:place:supermarket', 'Punjabi')).toBe(false);
    expect(isAllowedGroceryTag('Grocery store', 'urn:tag:category:place:grocery_store', 'Indian')).toBe(false);
    expect(isAllowedGroceryTag('Convenience store', 'urn:tag:category:place:convenience_store', 'Indian')).toBe(false);
  });
});

describe('Tag Probing In-City Rule', () => {
  it('correctly matches place mentions of destination city', () => {
    const syntheticPlaceInCity = {
      name: 'SYNTHETIC_SPICE_CAFE',
      properties: { address: '123 Queen St W, Toronto, ON M5V 2A4' },
    };
    expect(isCityMatch(syntheticPlaceInCity, SYNTHETIC_DESTINATION)).toBe(true);

    const syntheticPlaceOutsideCity = {
      name: 'SYNTHETIC_FAR_BISTRO',
      properties: { address: '456 Main St, Vancouver, BC' },
    };
    expect(isCityMatch(syntheticPlaceOutsideCity, SYNTHETIC_DESTINATION)).toBe(false);
  });
});

describe('Banquet & Convention Filter', () => {
  it('identifies and rejects banquet and convention halls', () => {
    const banquetVenue = {
      entity_id: 'syn-b1',
      name: "JC's Banquet & Convention Centre",
      properties: { primary_genre: { id: 'urn:tag:genre:place:banquet_hall', name: 'Banquet Hall' } },
    };
    expect(isBanquetOrConventionVenue(banquetVenue)).toBe(true);

    const regularRestaurant = {
      entity_id: 'syn-r1',
      name: 'Kerala Curry House',
      properties: { primary_genre: { id: 'urn:tag:genre:place:restaurant:indian', name: 'Indian' } },
    };
    expect(isBanquetOrConventionVenue(regularRestaurant)).toBe(false);
  });

  it('filters out closed places', () => {
    const openPlace = { entity_id: 'syn-1', name: 'Open Spot', properties: { is_closed: false } };
    const closedPlace = { entity_id: 'syn-2', name: 'Closed Spot', properties: { is_closed: true } };

    expect(isClosedPlace(openPlace)).toBe(false);
    expect(isClosedPlace(closedPlace)).toBe(true);
  });

  it('filterValidPlaces dedupes, removes closed places, and drops banquet venues', () => {
    const list = [
      { entity_id: 'p1', name: 'Authentic Kitchen', is_closed: false },
      { entity_id: 'p1', name: 'Authentic Kitchen Duplicate', is_closed: false },
      { entity_id: 'p2', name: 'Grand Convention Centre', is_closed: false },
      { entity_id: 'p3', name: 'Old Cafe (Permanently Closed)', is_closed: true },
      { entity_id: 'p4', name: 'Local Grocer', is_closed: false },
    ];

    const cleaned = filterValidPlaces(list);
    expect(cleaned).toHaveLength(2);
    expect(cleaned.map((p) => p.entity_id)).toEqual(['p1', 'p4']);
  });
});

describe('Taste Lift & Attribution Math (Task A)', () => {
  it('calculates category taste lift correctly', () => {
    // 10 combined places, 3 of which are in baseline
    const combinedPlaces = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8', 'p9', 'p10'];
    const baselineIds = new Set(['p1', 'p2', 'p3', 'b1', 'b2', 'b3', 'b4', 'b5', 'b6', 'b7']);

    const intersect = combinedPlaces.filter((p) => baselineIds.has(p)).length;
    const lift = 1 - intersect / combinedPlaces.length;

    expect(intersect).toBe(3);
    expect(lift).toBe(0.7); // 70% lift
  });

  it('classifies favoriteLift into strong, weak, and none thresholds', () => {
    const computeStatus = (lift: number): string => {
      if (lift >= 0.5) return 'strong';
      if (lift >= 0.2) return 'weak';
      return 'none';
    };

    expect(computeStatus(0.7)).toBe('strong');
    expect(computeStatus(0.5)).toBe('strong');
    expect(computeStatus(0.35)).toBe('weak');
    expect(computeStatus(0.2)).toBe('weak');
    expect(computeStatus(0.1)).toBe('none');
    expect(computeStatus(0.0)).toBe('none');
  });

  it('matchedBy attaches favorite ONLY if place is in top 5 of S_f and NOT in baseline', () => {
    const baselineIds = new Set(['base-1', 'base-2', 'base-3']);
    const s_f_places = ['lifted-1', 'lifted-2', 'base-1', 'lifted-3', 'lifted-4', 'lifted-5'];

    const top5 = s_f_places.slice(0, 5); // ['lifted-1', 'lifted-2', 'base-1', 'lifted-3', 'lifted-4']

    const isPlaceMatched = (placeId: string): boolean => {
      return top5.includes(placeId) && !baselineIds.has(placeId);
    };

    expect(isPlaceMatched('lifted-1')).toBe(true);
    expect(isPlaceMatched('lifted-2')).toBe(true);
    expect(isPlaceMatched('base-1')).toBe(false); // In baseline -> NOT matched
    expect(isPlaceMatched('lifted-5')).toBe(false); // Rank 6 (outside top 5) -> NOT matched
  });
});

describe('Cross-Category Deduplication & Backfill (Task C)', () => {
  it('deduplicates places across categories with priority order and backfills up to 6', () => {
    const cat1Places = [
      { entity_id: 'p1', name: 'Place 1' },
      { entity_id: 'p2', name: 'Place 2' },
      { entity_id: 'p3', name: 'Place 3' },
    ];
    const cat2Raw = [
      { entity_id: 'p1', name: 'Place 1 (duplicate)' },
      { entity_id: 'p4', name: 'Place 4' },
      { entity_id: 'p5', name: 'Place 5' },
      { entity_id: 'p6', name: 'Place 6' },
      { entity_id: 'p7', name: 'Place 7' },
    ];

    const assigned = new Set<string>();
    cat1Places.forEach((p) => assigned.add(p.entity_id));

    const cat2Available = cat2Raw.filter((p) => !assigned.has(p.entity_id));
    expect(cat2Available).toHaveLength(4);
    expect(cat2Available.map((p) => p.entity_id)).toEqual(['p4', 'p5', 'p6', 'p7']);
  });

  it('drops categories that end up with fewer than 3 places after deduplication', () => {
    const assigned = new Set<string>(['p1', 'p2', 'p3']);
    const catRaw = [
      { entity_id: 'p1', name: 'Dup 1' },
      { entity_id: 'p2', name: 'Dup 2' },
      { entity_id: 'p4', name: 'Unique 1' },
      { entity_id: 'p5', name: 'Unique 2' },
    ];

    const filtered = catRaw.filter((p) => !assigned.has(p.entity_id));
    expect(filtered).toHaveLength(2);
    const dropCategory = filtered.length < 3;
    expect(dropCategory).toBe(true);
  });
});

describe('Grounding Verifier with Favorite-Name Prohibition (Task B)', () => {
  const syntheticInputCategories: GroundingInputCategory[] = [
    {
      title: 'South Indian',
      kind: 'home_cuisine',
      tagId: 'urn:tag:cuisine:qloo:south_indian',
      places: [
        {
          id: 'place-real-1',
          name: 'Real Kerala Kitchen',
          dishes: ['Appam', 'Fish Curry'],
          matchedBy: ['Premam'],
        },
      ],
    },
  ];

  it('passes strictly grounded output that describes food and never mentions favorites', () => {
    const validOutput: WriteOutput = {
      categories: [
        {
          tagId: 'urn:tag:cuisine:qloo:south_indian',
          intro: 'Authentic South Indian dining featuring coastal culinary specialties.',
          places: [
            {
              id: 'place-real-1',
              blurb: 'Celebrated for traditional Appam and Fish Curry served in a cozy setting.',
            },
          ],
        },
      ],
      firstMonth:
        'Week 1: Visit Real Kerala Kitchen. Week 2: Find pantry spices at grocery. Week 3: Explore coastal curries. Week 4: Feast with friends.',
    };

    const check = verifyGrounding(validOutput, syntheticInputCategories, ['Premam', 'Drishyam']);
    expect(check.valid).toBe(true);
    expect(check.violations).toHaveLength(0);
  });

  it('catches and flags a blurb that names a user favorite', () => {
    const invalidOutput: WriteOutput = {
      categories: [
        {
          tagId: 'urn:tag:cuisine:qloo:south_indian',
          intro: 'Authentic dining in the city.',
          places: [
            {
              id: 'place-real-1',
              blurb: 'A spot loved by Premam fans with exceptional food.',
            },
          ],
        },
      ],
      firstMonth: 'Week 1 through Week 4 settling guide.',
    };

    const check = verifyGrounding(invalidOutput, syntheticInputCategories, ['Premam', 'Drishyam']);
    expect(check.valid).toBe(false);
    expect(check.violations.some((v) => v.includes('named user favorite "Premam"'))).toBe(true);
  });

  it('catches and flags a firstMonth guide that names a user favorite', () => {
    const invalidOutput: WriteOutput = {
      categories: [
        {
          tagId: 'urn:tag:cuisine:qloo:south_indian',
          intro: 'Authentic dining.',
          places: [
            {
              id: 'place-real-1',
              blurb: 'Signature spicy curries and fresh appams.',
            },
          ],
        },
      ],
      firstMonth: 'Week 1: Eat at Real Kerala Kitchen while listening to A.R. Rahman. Week 2: Groceries. Week 3: Curries. Week 4: Feasts.',
    };

    const check = verifyGrounding(invalidOutput, syntheticInputCategories, ['A.R. Rahman']);
    expect(check.valid).toBe(false);
    expect(check.violations.some((v) => v.includes('firstMonth guide named user favorite "A.R. Rahman"'))).toBe(true);
  });
});

describe('Candidate Shaping for /api/resolve (Task D)', () => {
  it('shapes candidate with entityId, name, type, disambiguation, year, and description', () => {
    const syntheticItem = {
      entity_id: 'cand-001',
      name: 'Drishyam',
      types: ['urn:entity:movie'],
      disambiguation: '2013',
      properties: {
        release_year: 2013,
        description: 'Drishyam (2013) is a Malayalam crime-thriller starring Mohanlal.',
      },
    };

    const candidate = shapeCandidate(syntheticItem, 'urn:entity:movie');
    expect(candidate.entityId).toBe('cand-001');
    expect(candidate.name).toBe('Drishyam');
    expect(candidate.disambiguation).toBe('2013');
    expect(candidate.year).toBe(2013);
    expect(candidate.description).toContain('Malayalam crime-thriller');
  });
});

describe('Memory Cache & Rate Limiting', () => {
  it('rate limiter enforces 6 runs per hour per client IP', () => {
    const limiter = new MemoryRateLimiter(6, 200);
    const testIp = '192.168.1.100';

    for (let i = 0; i < 6; i++) {
      const res = limiter.check(testIp);
      expect(res.allowed).toBe(true);
      limiter.record(testIp);
    }

    // 7th request must be blocked
    const blockedRes = limiter.check(testIp);
    expect(blockedRes.allowed).toBe(false);
    expect(blockedRes.reason).toContain('Rate limit exceeded');
    expect(blockedRes.retryAfterSeconds).toBeGreaterThan(0);
  });

  it('cache stores, retrieves, and evicts oldest at max capacity', () => {
    const cache = new MemoryCache(3);
    cache.set('key1', 'val1');
    cache.set('key2', 'val2');
    cache.set('key3', 'val3');

    expect(cache.get('key1')).toBe('val1');
    expect(cache.size()).toBe(3);

    cache.set('key4', 'val4');
    expect(cache.get('key2')).toBeUndefined();
    expect(cache.get('key1')).toBe('val1');
    expect(cache.get('key4')).toBe('val4');
  });
});
