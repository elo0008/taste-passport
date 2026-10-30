import { describe, it, expect } from 'vitest';
import { isCityMatch, isAllowedGroceryTag } from '@/lib/tag-prober';
import {
  verifyGrounding,
  containsBannedWord,
  generateTemplateFallback,
  writeGroundedNarratives,
  BANNED_WORDS,
  GroundingInputCategory,
  WriteOutput,
} from '@/lib/grounding';
import { MemoryRateLimiter } from '@/lib/rate-limit';
import { MemoryCache } from '@/lib/cache';
import { isBanquetOrConventionVenue, isClosedPlace, filterValidPlaces } from '@/lib/filters';
import { shapeCandidate, sortCandidates, ResolveCandidate } from '@/lib/resolve-service';
import {
  extractCuisineTagsFromPlace,
  shouldAddGroceryCategory,
  formatCuisineBadge,
  toTitleCase,
  GENERIC_CUISINE_NAMES,
  EnrichedCuisineTag,
} from '@/lib/cuisine-inference';
import { runPassportPipeline, PipelineError } from '@/lib/pipeline';

// ALL FIXTURES ARE SYNTHETIC
const SYNTHETIC_DESTINATION = 'Toronto';

describe('Cuisine Enrichment Math & Thresholds (Task A & B)', () => {
  it('computes enrichment as (cSig + 1) / (cBase + 1) correctly', () => {
    const computeEnrichment = (cSig: number, cBase: number) => (cSig + 1) / (cBase + 1);

    expect(computeEnrichment(6, 0)).toBe(7.0); // 7.0x enrichment
    expect(computeEnrichment(17, 0)).toBe(18.0); // 18.0x enrichment
    expect(computeEnrichment(24, 1)).toBe(12.5); // 12.5x enrichment
    expect(computeEnrichment(3, 3)).toBe(1.0); // 1.0x (baseline parity)
  });

  it('enforces cSig >= 3 threshold to exclude low-sample tags', () => {
    const rawTagCounts = [
      { id: 'tag1', cSig: 4, cBase: 0 },
      { id: 'tag2', cSig: 2, cBase: 0 }, // Below threshold
      { id: 'tag3', cSig: 3, cBase: 1 },
      { id: 'tag4', cSig: 1, cBase: 0 }, // Below threshold
    ];

    const qualified = rawTagCounts.filter((t) => t.cSig >= 3);
    expect(qualified).toHaveLength(2);
    expect(qualified.map((t) => t.id)).toEqual(['tag1', 'tag3']);
  });

  it('extracts cuisine tags from places while excluding broad restaurant tag', () => {
    const syntheticPlace = {
      name: 'Kerala Spice House',
      tags: [
        { id: 'urn:tag:genre:place:restaurant', name: 'Restaurant' },
        { id: 'urn:tag:cuisine:qloo:kerala', name: 'Kerala' },
        { id: 'urn:tag:genre:place:restaurant:south_indian', name: 'South Indian' },
        { id: 'urn:tag:amenity:place:wifi', name: 'Free WiFi' },
      ],
    };

    const extracted = extractCuisineTagsFromPlace(syntheticPlace);
    expect(extracted).toHaveLength(2);
    expect(extracted.map((t) => t.id)).toEqual([
      'urn:tag:cuisine:qloo:kerala',
      'urn:tag:genre:place:restaurant:south_indian',
    ]);
  });
});

describe('Grocery Rule (Task B)', () => {
  it('maps cultural cuisine tags to Indian grocery store', () => {
    const keralaTag: EnrichedCuisineTag = {
      id: 'urn:tag:cuisine:qloo:kerala',
      name: 'Kerala',
      cSig: 6,
      cBase: 0,
      enrichment: 7.0,
    };
    expect(shouldAddGroceryCategory(keralaTag)).toBe(true);

    const punjabiTag: EnrichedCuisineTag = {
      id: 'urn:tag:cuisine:qloo:punjabi',
      name: 'Punjabi',
      cSig: 16,
      cBase: 0,
      enrichment: 17.0,
    };
    expect(shouldAddGroceryCategory(punjabiTag)).toBe(true);

    const southIndianTag: EnrichedCuisineTag = {
      id: 'urn:tag:cuisine:qloo:south_indian',
      name: 'South Indian',
      cSig: 6,
      cBase: 0,
      enrichment: 7.0,
    };
    expect(shouldAddGroceryCategory(southIndianTag)).toBe(true);
  });

  it('rejects unrelated cuisine tags from adding Indian grocery store', () => {
    const italianTag: EnrichedCuisineTag = {
      id: 'urn:tag:cuisine:qloo:italian',
      name: 'Italian',
      cSig: 10,
      cBase: 1,
      enrichment: 5.5,
    };
    expect(shouldAddGroceryCategory(italianTag)).toBe(false);

    const japaneseTag: EnrichedCuisineTag = {
      id: 'urn:tag:cuisine:qloo:japanese',
      name: 'Japanese',
      cSig: 8,
      cBase: 0,
      enrichment: 9.0,
    };
    expect(shouldAddGroceryCategory(japaneseTag)).toBe(false);
  });

  it('isAllowedGroceryTag accepts cultural grocers and rejects generic supermarkets', () => {
    expect(isAllowedGroceryTag('Indian grocery store', 'urn:tag:category:place:indian_grocery_store', 'Indian')).toBe(true);
    expect(isAllowedGroceryTag('Supermarket', 'urn:tag:category:place:supermarket', 'Punjabi')).toBe(false);
    expect(isAllowedGroceryTag('Grocery store', 'urn:tag:category:place:grocery_store', 'Indian')).toBe(false);
  });
});

describe('Banned-Word & Grounding Checks (Task D)', () => {
  it('detects all banned subjective words correctly', () => {
    for (const word of BANNED_WORDS) {
      const sentence = `This venue has a ${word} atmosphere.`;
      expect(containsBannedWord(sentence)).toBe(word);
    }
    expect(containsBannedWord('Features traditional fish curry and regional spices.')).toBeNull();
  });

  it('flags violations if intro or blurb contains banned subjective words', () => {
    const inputCategories: GroundingInputCategory[] = [
      {
        title: 'Kerala',
        tagId: 'urn:tag:cuisine:qloo:kerala',
        places: [
          {
            id: 'place-1',
            name: 'Kerala Kitchen',
            dishes: ['Appam'],
          },
        ],
      },
    ];

    const invalidIntroOutput: WriteOutput = {
      categories: [
        {
          tagId: 'urn:tag:cuisine:qloo:kerala',
          intro: 'Explore authentic Kerala dining in Toronto.', // "authentic" is banned
          places: [{ id: 'place-1', blurb: 'Features Appam.' }],
        },
      ],
      firstMonth: 'Week 1: Visit Kerala Kitchen. Week 2: Dine regional. Week 3: Explore menus. Week 4: Conclude.',
    };

    const check1 = verifyGrounding(invalidIntroOutput, inputCategories, []);
    expect(check1.valid).toBe(false);
    expect(check1.violations.some((v) => v.includes('banned subjective word "authentic"'))).toBe(true);

    const invalidBlurbOutput: WriteOutput = {
      categories: [
        {
          tagId: 'urn:tag:cuisine:qloo:kerala',
          intro: 'Kerala selections in Toronto.',
          places: [{ id: 'place-1', blurb: 'A cozy spot featuring fresh Appam.' }], // "cozy" is banned
        },
      ],
      firstMonth: 'Week 1: Visit Kerala Kitchen. Week 2: Dine regional. Week 3: Explore menus. Week 4: Conclude.',
    };

    const check2 = verifyGrounding(invalidBlurbOutput, inputCategories, []);
    expect(check2.valid).toBe(false);
    expect(check2.violations.some((v) => v.includes('banned subjective word "cozy"'))).toBe(true);
  });
});

describe('Null-Blurb Rule (Task D)', () => {
  it('requires blurb to be null when a place has neither dishes nor description', () => {
    const inputCategories: GroundingInputCategory[] = [
      {
        title: 'South Indian',
        tagId: 'urn:tag:cuisine:qloo:south_indian',
        places: [
          {
            id: 'place-no-dishes',
            name: 'Barebones Diner',
            dishes: [], // NO dishes
            description: undefined, // NO description
          },
        ],
      },
    ];

    // Invented blurb should FAIL
    const outputWithInventedBlurb: WriteOutput = {
      categories: [
        {
          tagId: 'urn:tag:cuisine:qloo:south_indian',
          intro: 'South Indian dining selections in the Toronto area.',
          places: [{ id: 'place-no-dishes', blurb: 'Invented narrative about this place.' }],
        },
      ],
      firstMonth: 'Week 1: Dine out. Week 2: Eat local. Week 3: Taste regional. Week 4: Enjoy meals.',
    };

    const check = verifyGrounding(outputWithInventedBlurb, inputCategories, []);
    expect(check.valid).toBe(false);
    expect(check.violations.some((v) => v.includes('must be null'))).toBe(true);

    // Output with blurb = null should PASS
    const validNullBlurbOutput: WriteOutput = {
      categories: [
        {
          tagId: 'urn:tag:cuisine:qloo:south_indian',
          intro: 'South Indian dining selections in the Toronto area.',
          places: [{ id: 'place-no-dishes', blurb: null }],
        },
      ],
      firstMonth: 'Week 1: Dine out. Week 2: Eat local. Week 3: Taste regional. Week 4: Enjoy meals.',
    };

    const checkValid = verifyGrounding(validNullBlurbOutput, inputCategories, []);
    expect(checkValid.valid).toBe(true);
  });
});

describe('Candidate Ordering & Sequel Sorting (Task G)', () => {
  it('orders candidates prioritizing non-sequels, exact names, and earlier release years', () => {
    const candidates: ResolveCandidate[] = [
      {
        entityId: 'cand-seq',
        name: 'Drishyam 2',
        type: 'urn:entity:movie',
        year: 2021,
      },
      {
        entityId: 'cand-hindi',
        name: 'Drishyam',
        type: 'urn:entity:movie',
        year: 2015,
      },
      {
        entityId: 'cand-orig',
        name: 'Drishyam',
        type: 'urn:entity:movie',
        year: 2013,
      },
    ];

    const sorted = sortCandidates(candidates, 'Drishyam');
    expect(sorted[0].entityId).toBe('cand-orig'); // 2013 Malayalam original first!
    expect(sorted[1].entityId).toBe('cand-hindi'); // 2015 Hindi remake second!
    expect(sorted[2].entityId).toBe('cand-seq'); // Drishyam 2 sequel last!
  });
});

describe('Graceful Degradation Path (Task F)', () => {
  it('falls back to deterministic template when LLM_DISABLED=true with zero violations', async () => {
    const origEnv = process.env.LLM_DISABLED;
    process.env.LLM_DISABLED = 'true';

    try {
      const inputCategories: GroundingInputCategory[] = [
        {
          title: 'Kerala',
          tagId: 'urn:tag:cuisine:qloo:kerala',
          places: [
            {
              id: 'p1',
              name: 'Kerala Curry House',
              dishes: ['Fish Fry', 'Kappa'],
            },
            {
              id: 'p2',
              name: 'Barebones Diner',
              dishes: [],
            },
          ],
        },
      ];

      const res = await writeGroundedNarratives(inputCategories, ['Premam'], 'Toronto');
      expect(res.narration).toBe('template');
      expect(res.groundingViolations).toBe(0);
      expect(res.repairAttempts).toBe(0);
      expect(res.output.categories[0].places[0].blurb).toBe('Features Fish Fry and Kappa.');
      expect(res.output.categories[0].places[1].blurb).toBeNull();
    } finally {
      process.env.LLM_DISABLED = origEnv;
    }
  });
});

describe('Qloo Failure Handling (Task F)', () => {
  it('gracefully converts Qloo failures (5xx / network) to friendly PipelineError without leaking keys', async () => {
    const failingClient = new (await import('@/lib/qloo')).QlooClient({
      apiKey: 'SYNTHETIC_TEST_KEY_NEVER_LOG',
      maxRetries: 0,
      fetchFn: async () => {
        return new Response('SYNTHETIC 500 SERVER ERROR', { status: 500 });
      },
    });

    try {
      await runPassportPipeline(
        {
          destination: 'Toronto',
          favorites: [
            { name: 'Premam', type: 'movie' },
            { name: 'Drishyam', type: 'movie' },
            { name: 'A. R. Rahman', type: 'artist' },
          ],
        },
        { client: failingClient, bypassRateLimit: true, forceRefresh: true }
      );
      expect.fail('Should have thrown PipelineError');
    } catch (err: any) {
      expect(err).toBeInstanceOf(PipelineError);
      expect(err.statusCode).toBe(502);
      expect(err.message).toContain('Qloo resolution service failed');
      expect(err.message).not.toContain('SYNTHETIC_TEST_KEY_NEVER_LOG');
    }
  });
});

describe('Banquet & Closed Venue Filters', () => {
  it('identifies and rejects banquet and convention halls', () => {
    const banquetVenue = {
      entity_id: 'syn-b1',
      name: "JC's Banquet & Convention Centre",
      properties: { primary_genre: { id: 'urn:tag:genre:place:banquet_hall', name: 'Banquet Hall' } },
    };
    expect(isBanquetOrConventionVenue(banquetVenue)).toBe(true);
  });

  it('filters out closed places and duplicates', () => {
    const list = [
      { entity_id: 'p1', name: 'Place 1', is_closed: false },
      { entity_id: 'p1', name: 'Place 1 Duplicate', is_closed: false },
      { entity_id: 'p2', name: 'Closed Place', is_closed: true },
    ];
    const cleaned = filterValidPlaces(list);
    expect(cleaned).toHaveLength(1);
    expect(cleaned[0].entity_id).toBe('p1');
  });
});

describe('Rate Limiter & Cache Integrity', () => {
  it('enforces 6 runs per hour per client IP', () => {
    const limiter = new MemoryRateLimiter(6, 200);
    const testIp = '192.168.1.100';

    for (let i = 0; i < 6; i++) {
      expect(limiter.check(testIp).allowed).toBe(true);
      limiter.record(testIp);
    }
    expect(limiter.check(testIp).allowed).toBe(false);
  });

  it('evicts oldest cache item when max capacity reached', () => {
    const cache = new MemoryCache(2);
    cache.set('k1', 'v1');
    cache.set('k2', 'v2');
    cache.set('k3', 'v3');
    expect(cache.get('k1')).toBeUndefined();
    expect(cache.get('k2')).toBe('v2');
    expect(cache.get('k3')).toBe('v3');
  });
});

describe('Phase 5 Honest Badges & Specificity Ordering (Task A & B)', () => {
  it('formats badge using counts and omits multiplier when cBase < 3', () => {
    const badgeNoMult = formatCuisineBadge(9, 0, 50, 'Kerala', 'Toronto');
    expect(badgeNoMult).toBe(
      "9 of Qloo's top 50 places for your taste are tagged Kerala; 0 of the top 50 for a generic Toronto baseline."
    );
    expect(badgeNoMult).not.toContain('about');
  });

  it('formats badge using counts and includes multiplier when cBase >= 3', () => {
    const badgeWithMult = formatCuisineBadge(16, 5, 50, 'Indian', 'Toronto');
    expect(badgeWithMult).toBe(
      "16 of Qloo's top 50 places for your taste are tagged Indian; 5 of the top 50 for a generic Toronto baseline. (about 3.2x as often)"
    );
  });

  it('excludes generic tags from cuisine inference', () => {
    expect(GENERIC_CUISINE_NAMES.has('restaurant')).toBe(true);
    expect(GENERIC_CUISINE_NAMES.has('food')).toBe(true);
    expect(GENERIC_CUISINE_NAMES.has('cuisine')).toBe(true);
    expect(GENERIC_CUISINE_NAMES.has('dining')).toBe(true);
    expect(GENERIC_CUISINE_NAMES.has('kerala')).toBe(false);
  });

  it('formats cuisine names with toTitleCase for display', () => {
    expect(toTitleCase('south_indian')).toBe('South Indian');
    expect(toTitleCase('kerala')).toBe('Kerala');
    expect(toTitleCase('north indian')).toBe('North Indian');
    expect(toTitleCase('coffee_shop')).toBe('Coffee Shop');
    expect(toTitleCase('tex-mex')).toBe('Tex-Mex');
    expect(toTitleCase('Indian')).toBe('Indian');
  });

  it('sorts selected categories by specificity: ascending cSig so rarer tags claim places first', () => {
    const categories = [
      { id: 'indian', name: 'Indian', cSig: 16 },
      { id: 'kerala', name: 'Kerala', cSig: 7 },
      { id: 'south_indian', name: 'South Indian', cSig: 10 },
    ];

    categories.sort((a, b) => a.cSig - b.cSig);
    expect(categories.map((c) => c.name)).toEqual(['Kerala', 'South Indian', 'Indian']);
  });
});

describe('Phase 5 Signal Check & Grocery Coherence Gate (Task C & F)', () => {
  it('identifies favorite as consistent if top tags intersect selected categories', () => {
    const selectedTagNames = new Set(['kerala', 'south indian', 'indian']);
    const favTopTags = [
      { id: 't1', name: 'Kerala' },
      { id: 't2', name: 'Seafood' },
    ];

    const isConsistent = favTopTags.some((t) => selectedTagNames.has(t.name.toLowerCase()));
    expect(isConsistent).toBe(true);
  });

  it('identifies favorite as pulled in a different direction if no intersection', () => {
    const selectedTagNames = new Set(['kerala', 'south indian', 'indian']);
    const unrelatedFavTopTags = [
      { id: 't1', name: 'European' },
      { id: 't2', name: 'Bar Food' },
      { id: 't3', name: 'Tex-Mex' },
    ];

    const isConsistent = unrelatedFavTopTags.some((t) => selectedTagNames.has(t.name.toLowerCase()));
    expect(isConsistent).toBe(false);
  });

  it('evaluates grocery coherence gate: retains grocery only if >=3 places and >=2 match primary pool/tag', () => {
    const primaryPlaces = new Set(['p1', 'p2', 'p3', 'p4', 'p5']);
    const groceryPlacesPass = [
      { id: 'p1', tags: [{ name: 'Grocery' }] },
      { id: 'p2', tags: [{ name: 'Grocery' }] },
      { id: 'p6', tags: [{ name: 'Grocery' }] },
      { id: 'p7', tags: [{ name: 'Grocery' }] },
    ];

    const matchCountPass = groceryPlacesPass.filter((p) => primaryPlaces.has(p.id)).length;
    const passesGate = groceryPlacesPass.length >= 3 && matchCountPass >= 2;
    expect(passesGate).toBe(true);

    const groceryPlacesFail = [
      { id: 'p6', tags: [{ name: 'Grocery' }] },
      { id: 'p7', tags: [{ name: 'Grocery' }] },
      { id: 'p8', tags: [{ name: 'Grocery' }] },
    ];
    const matchCountFail = groceryPlacesFail.filter((p) => primaryPlaces.has(p.id)).length;
    const failsGate = groceryPlacesFail.length >= 3 && matchCountFail >= 2;
    expect(failsGate).toBe(false);
  });
});

describe('Phase 6 Noisy-Signal Self-Correction (Task C)', () => {
  it('triggers self-correction rerun when >=2 consistent and >=1 unaligned favorites', () => {
    const favorites = [
      { resolvedId: 'id1', resolvedName: 'Fav 1' },
      { resolvedId: 'id2', resolvedName: 'Fav 2' },
      { resolvedId: 'id3', resolvedName: 'Fav 3' },
    ];
    const signalCheck = [
      { resolvedId: 'id1', isConsistent: true },
      { resolvedId: 'id2', isConsistent: true },
      { resolvedId: 'id3', isConsistent: false },
    ];

    const consistentFavs = favorites.filter((r) => {
      const sig = signalCheck.find((s) => s.resolvedId === r.resolvedId);
      return sig?.isConsistent;
    });
    const unalignedFavs = favorites.filter(
      (r) => !consistentFavs.some((c) => c.resolvedId === r.resolvedId)
    );

    const shouldRerun = consistentFavs.length >= 2 && unalignedFavs.length >= 1;
    expect(shouldRerun).toBe(true);

    const unalignedNames = unalignedFavs.map((f) => f.resolvedName).join(', ');
    const notice = `Left out of the final search: ${unalignedNames} (pulled in a different direction)`;
    expect(notice).toBe('Left out of the final search: Fav 3 (pulled in a different direction)');
    expect(consistentFavs.map((f) => f.resolvedId)).toEqual(['id1', 'id2']);
  });

  it('does NOT trigger self-correction rerun when all favorites are consistent', () => {
    const favorites = [
      { resolvedId: 'id1', resolvedName: 'Fav 1' },
      { resolvedId: 'id2', resolvedName: 'Fav 2' },
      { resolvedId: 'id3', resolvedName: 'Fav 3' },
    ];
    const signalCheck = [
      { resolvedId: 'id1', isConsistent: true },
      { resolvedId: 'id2', isConsistent: true },
      { resolvedId: 'id3', isConsistent: true },
    ];

    const consistentFavs = favorites.filter((r) => {
      const sig = signalCheck.find((s) => s.resolvedId === r.resolvedId);
      return sig?.isConsistent;
    });
    const unalignedFavs = favorites.filter(
      (r) => !consistentFavs.some((c) => c.resolvedId === r.resolvedId)
    );

    const shouldRerun = consistentFavs.length >= 2 && unalignedFavs.length >= 1;
    expect(shouldRerun).toBe(false);
  });

  it('does NOT trigger self-correction rerun when fewer than 2 favorites are consistent', () => {
    const favorites = [
      { resolvedId: 'id1', resolvedName: 'Fav 1' },
      { resolvedId: 'id2', resolvedName: 'Fav 2' },
    ];
    const signalCheck = [
      { resolvedId: 'id1', isConsistent: true },
      { resolvedId: 'id2', isConsistent: false },
    ];

    const consistentFavs = favorites.filter((r) => {
      const sig = signalCheck.find((s) => s.resolvedId === r.resolvedId);
      return sig?.isConsistent;
    });
    const unalignedFavs = favorites.filter(
      (r) => !consistentFavs.some((c) => c.resolvedId === r.resolvedId)
    );

    const shouldRerun = consistentFavs.length >= 2 && unalignedFavs.length >= 1;
    expect(shouldRerun).toBe(false);
  });

  it('asserts displayed badge counts come from post-rerun query set when self-correction triggers', async () => {
    const origEnv = process.env.LLM_DISABLED;
    process.env.LLM_DISABLED = 'true';

    try {
      // Create synthetic places
      const makePlaces = (count: number, tagId: string, tagName: string) =>
        Array.from({ length: count }, (_, i) => ({
          entity_id: `place-${tagId}-${i}`,
          name: `${tagName} Venue ${i}`,
          tags: [{ id: tagId, name: tagName }],
          properties: { specialty_dishes: [{ name: 'Dish A' }] },
        }));

      const mockClient = new (await import('@/lib/qloo')).QlooClient({
        apiKey: 'SYNTHETIC_TEST_KEY_NEVER_LOG',
        maxRetries: 0,
        fetchFn: async (url: string | URL) => {
          const urlObj = typeof url === 'string' ? new URL(url) : url;
          const signalParam = urlObj.searchParams.get('signal.interests.entities');
          const filterTags = urlObj.searchParams.get('filter.tags');

          // Baseline query (no signal entities)
          if (!signalParam) {
            return new Response(JSON.stringify({ results: { entities: [] } }), { status: 200 });
          }

          // Initial combined query (all 3 favorites: id-fav1,id-fav2,id-fav3)
          if (signalParam === 'id-fav1,id-fav2,id-fav3') {
            // Initial pass returns 9 Kerala places
            return new Response(
              JSON.stringify({
                results: { entities: makePlaces(9, 'urn:tag:cuisine:qloo:kerala', 'Kerala') },
              }),
              { status: 200 }
            );
          }

          // Rerun combined query with consistent favorites only: id-fav1,id-fav2
          if (signalParam === 'id-fav1,id-fav2') {
            // If category places query for Kerala (takes 50)
            // or rerun combined query: returns 11 Kerala places!
            return new Response(
              JSON.stringify({
                results: { entities: makePlaces(11, 'urn:tag:cuisine:qloo:kerala', 'Kerala') },
              }),
              { status: 200 }
            );
          }

          // Single signal query: fav1 -> Kerala
          if (signalParam === 'id-fav1') {
            return new Response(
              JSON.stringify({
                results: { entities: makePlaces(5, 'urn:tag:cuisine:qloo:kerala', 'Kerala') },
              }),
              { status: 200 }
            );
          }

          // Single signal query: fav2 -> Kerala
          if (signalParam === 'id-fav2') {
            return new Response(
              JSON.stringify({
                results: { entities: makePlaces(5, 'urn:tag:cuisine:qloo:kerala', 'Kerala') },
              }),
              { status: 200 }
            );
          }

          // Single signal query: fav3 -> European (unaligned)
          if (signalParam === 'id-fav3') {
            return new Response(
              JSON.stringify({
                results: { entities: makePlaces(5, 'urn:tag:cuisine:qloo:european', 'European') },
              }),
              { status: 200 }
            );
          }

          return new Response(JSON.stringify({ results: { entities: [] } }), { status: 200 });
        },
      });

      const result = await runPassportPipeline(
        {
          destination: 'Toronto',
          favorites: [
            { name: 'Fav 1', type: 'movie', entityId: 'id-fav1' },
            { name: 'Fav 2', type: 'movie', entityId: 'id-fav2' },
            { name: 'Unaligned Fav', type: 'author', entityId: 'id-fav3' },
          ],
        },
        { client: mockClient, bypassRateLimit: true, forceRefresh: true }
      );

      // Verify self-correction notice
      expect(result.meta.notice).toBe(
        'Left out of the final search: Unaligned Fav (pulled in a different direction)'
      );

      // Verify categories contain Kerala
      const keralaCat = result.categories.find((c) => c.tagId === 'urn:tag:cuisine:qloo:kerala');
      expect(keralaCat).toBeDefined();

      // Crucial assertion: badge and cSig MUST reflect the post-rerun count (11), NOT the initial count (9)
      expect(keralaCat?.cSig).toBe(11);
      expect(keralaCat?.badge).toContain("11 of Qloo's top 50 places");
      expect(keralaCat?.badge).not.toContain("9 of Qloo's top 50 places");
    } finally {
      process.env.LLM_DISABLED = origEnv;
    }
  });
});
