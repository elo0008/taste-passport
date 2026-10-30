import { QlooClient } from './qloo';
import { MemoryCache, passportResultCache } from './cache';
import { rateLimiter } from './rate-limit';
import { CallBudget, runWithConcurrency } from './concurrency';
import { filterValidPlaces } from './filters';
import { planCategories, CategoryIntent } from './planner';
import { probeTagsForIntentsParallel, AcceptedTag } from './tag-prober';
import { writeGroundedNarratives, GroundingInputCategory } from './grounding';
import { resolveSingleFavorite, FavoriteType, TYPE_TO_URN } from './resolve-service';

export type { FavoriteType };

export interface FavoriteInput {
  name: string;
  type: FavoriteType;
  entityId?: string;
}

export interface ResolvedFavorite {
  inputName: string;
  inputType: FavoriteType;
  resolvedId: string;
  resolvedName: string;
  resolvedType: string;
}

export interface UnresolvedFavorite {
  name: string;
  type: FavoriteType;
  reason: string;
}

export interface FinalPlace {
  id: string;
  name: string;
  address: string;
  website: string;
  phone: string;
  rating: number | null;
  priceLevel: string | null;
  dishes: string[];
  matchedBy: string[];
  affinity: number | null;
  blurb: string;
}

export interface FinalCategory {
  title: string;
  kind: 'home_cuisine' | 'stretch_cuisine' | 'grocery';
  kindLabel: string;
  tagId: string;
  tasteLift: number;
  tasteLiftPercent: number;
  badge: string;
  intro: string;
  places: FinalPlace[];
}

export interface SignalCheckItem {
  name: string;
  favoriteLift: number;
  favoriteLiftPercent: number;
  status: 'strong' | 'weak' | 'none';
  statusLabel: string;
  matchedCount: number;
}

export interface PipelineTimings {
  resolveMs: number;
  planMs: number;
  tagsMs: number;
  discoverMs: number;
  writeMs: number;
  totalMs: number;
}

export interface PassportResult {
  destination: string;
  resolved: ResolvedFavorite[];
  unresolvedFavorites: UnresolvedFavorite[];
  plan: CategoryIntent[];
  categories: FinalCategory[];
  signalCheck: SignalCheckItem[];
  firstMonth: string;
  meta: {
    qlooCalls: number;
    llmCalls: number;
    ms: number;
    groundingViolations: number;
    repairAttempts: number;
    cached: boolean;
    timings: PipelineTimings;
  };
}

export type PipelineStage = 'resolving' | 'planning' | 'finding_tags' | 'querying_qloo' | 'writing';

export interface PipelineProgressEvent {
  type: 'progress';
  stage: PipelineStage;
  message: string;
  current?: number;
  total?: number;
}

export class PipelineError extends Error {
  public readonly statusCode: number;
  constructor(message: string, statusCode = 400) {
    super(message);
    this.name = 'PipelineError';
    this.statusCode = statusCode;
  }
}

// In-memory cache for tag baseline queries in a destination
const baselineCache = new MemoryCache(100);

export async function runPassportPipeline(
  input: {
    destination: string;
    favorites: FavoriteInput[];
  },
  options?: {
    ip?: string;
    onProgress?: (event: PipelineProgressEvent) => void;
    bypassRateLimit?: boolean;
    forceRefresh?: boolean;
  }
): Promise<PassportResult> {
  const startTime = performance.now();
  const clientIp = options?.ip || 'anonymous';
  const emit = options?.onProgress || (() => {});

  const timings: PipelineTimings = {
    resolveMs: 0,
    planMs: 0,
    tagsMs: 0,
    discoverMs: 0,
    writeMs: 0,
    totalMs: 0,
  };

  // 1. Rate Limiting Check
  if (!options?.bypassRateLimit) {
    const rateCheck = rateLimiter.check(clientIp);
    if (!rateCheck.allowed) {
      throw new PipelineError(
        rateCheck.reason || 'Rate limit exceeded. Please try again later.',
        429
      );
    }
  }

  // 2. Cache Check
  const cacheKey = MemoryCache.hashKey({
    dest: input.destination.trim().toLowerCase(),
    favs: input.favorites
      .map((f) => `${f.type}:${(f.entityId || f.name).trim().toLowerCase()}`)
      .sort(),
    version: 'v3.0',
  });

  if (!options?.forceRefresh) {
    const cached = passportResultCache.get<PassportResult>(cacheKey);
    if (cached) {
      return {
        ...cached,
        meta: {
          ...cached.meta,
          cached: true,
          ms: Math.round(performance.now() - startTime),
        },
      };
    }
  }

  const client = new QlooClient();
  const budget = new CallBudget(32);
  let llmCallsCount = 0;

  // 3. Stage: CONCURRENT RESOLVE & PLAN (Performance Optimization)
  emit({
    type: 'progress',
    stage: 'resolving',
    message: `Resolving favorites and planning taste profile in parallel...`,
  });

  const resolvePlanStart = performance.now();

  const resolveFavoritesPromise = Promise.all(
    input.favorites.map(async (fav) => {
      // User-selected confirmation: if entityId was explicitly passed, skip search
      if (fav.entityId) {
        return {
          resolved: true as const,
          item: {
            inputName: fav.name,
            inputType: fav.type,
            resolvedId: fav.entityId,
            resolvedName: fav.name,
            resolvedType: TYPE_TO_URN[fav.type] || fav.type,
          },
        };
      }

      budget.track();
      try {
        const candidates = await resolveSingleFavorite(client, fav.name, fav.type);
        if (candidates.length > 0) {
          const match = candidates[0];
          return {
            resolved: true as const,
            item: {
              inputName: fav.name,
              inputType: fav.type,
              resolvedId: match.entityId,
              resolvedName: match.name,
              resolvedType: match.type,
            },
          };
        }
      } catch {
        // Fall through
      }

      return {
        resolved: false as const,
        item: {
          name: fav.name,
          type: fav.type,
          reason: 'Not found in Qloo taste graph',
        },
      };
    })
  );

  const planCategoriesPromise = (async () => {
    llmCallsCount++;
    return await planCategories(
      input.favorites.map((f) => ({ name: f.name, type: f.type })),
      input.destination
    );
  })();

  const [resolutionResults, planResult] = await Promise.all([
    resolveFavoritesPromise,
    planCategoriesPromise,
  ]);

  const resolvePlanDuration = Math.round(performance.now() - resolvePlanStart);
  timings.resolveMs = resolvePlanDuration;
  timings.planMs = resolvePlanDuration;

  const resolved: ResolvedFavorite[] = [];
  const unresolvedFavorites: UnresolvedFavorite[] = [];

  for (const r of resolutionResults) {
    if (r.resolved && 'resolvedId' in r.item && r.item.resolvedId) {
      resolved.push(r.item as ResolvedFavorite);
    } else {
      unresolvedFavorites.push(r.item as UnresolvedFavorite);
    }
  }

  if (resolved.length < 2) {
    throw new PipelineError(
      `Could not resolve enough favorites in Qloo's taste database. Resolved ${resolved.length} of ${input.favorites.length}; at least 2 are required to generate recommendations.`,
      422
    );
  }

  const resolvedSignalIds = resolved.map((r) => r.resolvedId);
  const intents = planResult.intents;
  const culture = planResult.culture;

  // 4. Stage: PARALLEL TAG PROBING WITH GROCERY GATE
  emit({
    type: 'progress',
    stage: 'finding_tags',
    message: `Validating category tags in ${input.destination} area across intents...`,
  });

  const tagsStart = performance.now();
  const probedIntents = await probeTagsForIntentsParallel(
    client,
    intents,
    culture,
    input.destination,
    resolvedSignalIds,
    budget
  );
  timings.tagsMs = Math.round(performance.now() - tagsStart);

  const acceptedCategories: Array<{
    intent: CategoryIntent;
    acceptedTag: AcceptedTag;
  }> = [];

  for (const probed of probedIntents) {
    if (probed.acceptedTag) {
      acceptedCategories.push({
        intent: probed.intent,
        acceptedTag: probed.acceptedTag,
      });
    }
  }

  // Fallback if no category tags were accepted
  if (acceptedCategories.length === 0) {
    acceptedCategories.push({
      intent: {
        kind: 'home_cuisine',
        keyword: 'indian',
        reason: `Reliable authentic dining in the ${input.destination} area.`,
      },
      acceptedTag: {
        tagId: 'urn:tag:genre:place:restaurant:indian',
        tagName: 'Indian',
        inCityCount: 10,
      },
    });
  }

  // 5. Stage: DISCOVER & TASTE LIFT COMPUTATION (Task A)
  emit({
    type: 'progress',
    stage: 'querying_qloo',
    message: `Querying Qloo taste intelligence and calculating taste lift...`,
  });

  const discoverStart = performance.now();

  // Find primary home cuisine category (first home_cuisine or first category)
  const primaryCategory =
    acceptedCategories.find((c) => c.intent.kind === 'home_cuisine') || acceptedCategories[0];
  const primaryTagId = primaryCategory.acceptedTag.tagId;

  // Setup storage for queries
  const tagBaselines = new Map<string, string[]>(); // tagId -> baselineIds
  const categoryCombinedPlaces = new Map<string, any[]>(); // tagId -> combined raw entities
  const singleSignalPlaces = new Map<string, any[]>(); // resolvedName -> top places for that favorite

  // Prepare batch of tasks
  const discoveryTasks: Array<() => Promise<void>> = [];

  // A) Category queries (Baseline + Combined for each accepted tag)
  for (const cat of acceptedCategories) {
    const tagId = cat.acceptedTag.tagId;

    // Combined query
    discoveryTasks.push(async () => {
      budget.track();
      try {
        const res = await client.insights({
          filterLocationQuery: input.destination,
          filterTags: tagId,
          signalEntities: resolvedSignalIds,
          take: 10,
        });
        const entities = res?.results?.entities || (Array.isArray(res?.results) ? res.results : []);
        categoryCombinedPlaces.set(tagId, entities);
      } catch {
        categoryCombinedPlaces.set(tagId, []);
      }
    });

    // Baseline query (tag + city, NO signals)
    discoveryTasks.push(async () => {
      const cacheBaselineKey = `baseline:${tagId}:${input.destination.trim().toLowerCase()}`;
      const cached = baselineCache.get<string[]>(cacheBaselineKey);
      if (cached) {
        tagBaselines.set(tagId, cached);
        return;
      }

      budget.track();
      try {
        const res = await client.insights({
          filterLocationQuery: input.destination,
          filterTags: tagId,
          take: 10,
        });
        const entities = res?.results?.entities || (Array.isArray(res?.results) ? res.results : []);
        const ids = entities.map((e: any) => e.entity_id || e.id).filter(Boolean);
        tagBaselines.set(tagId, ids);
        baselineCache.set(cacheBaselineKey, ids, 24 * 60 * 60 * 1000);
      } catch {
        tagBaselines.set(tagId, []);
      }
    });
  }

  // B) Single-signal queries on PRIMARY category only for attribution
  for (const fav of resolved) {
    discoveryTasks.push(async () => {
      budget.track();
      try {
        const res = await client.insights({
          filterLocationQuery: input.destination,
          filterTags: primaryTagId,
          signalEntities: [fav.resolvedId],
          take: 10,
        });
        const entities = res?.results?.entities || (Array.isArray(res?.results) ? res.results : []);
        singleSignalPlaces.set(fav.resolvedName, entities);
      } catch {
        singleSignalPlaces.set(fav.resolvedName, []);
      }
    });
  }

  await runWithConcurrency(discoveryTasks, 6);

  // Compute Favorite Lift & Status (Task A)
  const primaryBaselineIds = new Set<string>(tagBaselines.get(primaryTagId) || []);

  const signalCheck: SignalCheckItem[] = resolved.map((fav) => {
    const sPlaces = singleSignalPlaces.get(fav.resolvedName) || [];
    const sIds = sPlaces.map((p: any) => p.entity_id || p.id).filter(Boolean);

    let nonBaselineCount = 0;
    for (const id of sIds) {
      if (!primaryBaselineIds.has(id)) {
        nonBaselineCount++;
      }
    }

    const favoriteLift = sIds.length > 0 ? nonBaselineCount / sIds.length : 0;
    const favoriteLiftPercent = Math.round(favoriteLift * 100);

    let status: 'strong' | 'weak' | 'none' = 'none';
    if (favoriteLift >= 0.5) {
      status = 'strong';
    } else if (favoriteLift >= 0.2) {
      status = 'weak';
    }

    const statusLabel = status === 'none' ? 'did not visibly shape results' : status;

    return {
      name: fav.resolvedName,
      favoriteLift,
      favoriteLiftPercent,
      status,
      statusLabel,
      matchedCount: 0, // updated after place assignment
    };
  });

  // Helper map: for each favorite, its TOP 5 places that are NOT in primaryBaselineIds
  const favoriteTopNonBaseline = new Map<string, Set<string>>();
  for (const fav of resolved) {
    const sPlaces = singleSignalPlaces.get(fav.resolvedName) || [];
    const top5Ids = sPlaces.slice(0, 5).map((p: any) => p.entity_id || p.id).filter(Boolean);
    const nonBaselineTop5 = new Set<string>(top5Ids.filter((id) => !primaryBaselineIds.has(id)));
    favoriteTopNonBaseline.set(fav.resolvedName, nonBaselineTop5);
  }

  // 6. Stage: ASSEMBLE, CROSS-CATEGORY DEDUPLICATION & BACKFILL (Task C)
  // Priority order: home_cuisine (in plan order) > stretch_cuisine > grocery
  const priorityOrdered = [...acceptedCategories].sort((a, b) => {
    const score = (kind: string) => (kind === 'home_cuisine' ? 1 : kind === 'stretch_cuisine' ? 2 : 3);
    return score(a.intent.kind) - score(b.intent.kind);
  });

  const assignedPlaceIds = new Set<string>();
  const assembledCategories: FinalCategory[] = [];
  const groundingInputCategories: GroundingInputCategory[] = [];

  for (const cat of priorityOrdered) {
    const tagId = cat.acceptedTag.tagId;
    const rawPlaces = categoryCombinedPlaces.get(tagId) || [];
    const baselineIds = new Set<string>(tagBaselines.get(tagId) || []);

    // Filter valid places (drop closed, drop banquet/convention)
    const validPlaces = filterValidPlaces(rawPlaces);

    // Cross-category deduplication with backfill up to 6
    const availablePlaces = validPlaces.filter((p) => {
      const pId = p.entity_id || p.id || '';
      return pId && !assignedPlaceIds.has(pId);
    });

    const selectedPlaces = availablePlaces.slice(0, 6);

    // Drop category if it ends with < 3 places
    if (selectedPlaces.length < 3) {
      continue;
    }

    // Mark as assigned
    for (const p of selectedPlaces) {
      const pId = p.entity_id || p.id || '';
      if (pId) assignedPlaceIds.add(pId);
    }

    // Taste Lift Calculation for Category (Task A)
    const combinedIds = selectedPlaces.map((p) => p.entity_id || p.id || '');
    let intersectCount = 0;
    for (const id of combinedIds) {
      if (baselineIds.has(id)) intersectCount++;
    }

    const tasteLift = combinedIds.length > 0 ? 1 - intersectCount / combinedIds.length : 0;
    const tasteLiftPercent = Math.round(tasteLift * 100);
    const liftedCount = combinedIds.length - intersectCount;

    let badge = '';
    if (tasteLift < 0.3) {
      badge = 'mostly popularity-led';
    } else {
      badge = `Taste lift ${tasteLiftPercent}% (${liftedCount} of ${combinedIds.length} picks wouldn't appear without your taste)`;
    }

    const isPrimary = cat.acceptedTag.tagId === primaryTagId;

    const finalPlaces: FinalPlace[] = selectedPlaces.map((p: any) => {
      const pId = p.entity_id || p.id || '';

      // MatchedBy rule: for primary category only, attach favorites where place is in top 5 of S_f and NOT in baselineIds
      const matchedBy: string[] = [];
      if (isPrimary) {
        for (const fav of resolved) {
          const nonBaselineTop5 = favoriteTopNonBaseline.get(fav.resolvedName);
          if (nonBaselineTop5?.has(pId)) {
            matchedBy.push(fav.resolvedName);
          }
        }
      }

      // Dishes: clean string extraction from specialty_dishes
      let dishes: string[] = [];
      if (Array.isArray(p.properties?.specialty_dishes)) {
        dishes = p.properties.specialty_dishes
          .map((d: any) => (typeof d === 'string' ? d : d?.name || ''))
          .filter((d: any): d is string => typeof d === 'string' && d.trim().length > 0)
          .slice(0, 3);
      }

      return {
        id: pId,
        name: p.name || 'Unnamed Place',
        address: p.properties?.address || p.address || '',
        website: p.properties?.website || p.website || '',
        phone: p.properties?.phone || p.phone || '',
        rating: typeof p.properties?.business_rating === 'number' ? p.properties.business_rating : null,
        priceLevel: p.properties?.price_level || (p.properties?.price_range?.currency ? '$' : null),
        dishes,
        matchedBy,
        affinity: typeof p.popularity === 'number' ? p.popularity : null,
        blurb: '',
      };
    });

    const kindLabel =
      cat.intent.kind === 'home_cuisine'
        ? 'Home cuisine'
        : cat.intent.kind === 'stretch_cuisine'
        ? 'Nearby cuisine'
        : 'Grocery';

    assembledCategories.push({
      title: cat.acceptedTag.tagName,
      kind: cat.intent.kind,
      kindLabel,
      tagId: cat.acceptedTag.tagId,
      tasteLift,
      tasteLiftPercent,
      badge,
      intro: '',
      places: finalPlaces,
    });

    groundingInputCategories.push({
      title: cat.acceptedTag.tagName,
      kind: cat.intent.kind,
      tagId: cat.acceptedTag.tagId,
      places: finalPlaces.map((p) => ({
        id: p.id,
        name: p.name,
        address: p.address,
        dishes: p.dishes,
        matchedBy: p.matchedBy,
        description: '',
      })),
    });
  }

  // Update matchedCount on SignalCheck
  for (const sig of signalCheck) {
    let count = 0;
    for (const cat of assembledCategories) {
      for (const p of cat.places) {
        if (p.matchedBy.includes(sig.name)) {
          count++;
        }
      }
    }
    sig.matchedCount = count;
  }

  timings.discoverMs = Math.round(performance.now() - discoverStart);

  // 7. Stage: GROUNDED WRITING (Task B)
  emit({
    type: 'progress',
    stage: 'writing',
    message: 'Composing grounded commentary and first-month settling guide...',
  });

  const writeStart = performance.now();
  llmCallsCount++;

  const { output: writtenNarratives, groundingViolations, repairAttempts } = await writeGroundedNarratives(
    groundingInputCategories,
    resolved.map((r) => r.resolvedName),
    input.destination
  );

  timings.writeMs = Math.round(performance.now() - writeStart);

  // Merge blurbs and intros into assembled categories
  const writtenCategoryMap = new Map<string, (typeof writtenNarratives.categories)[0]>();
  for (const c of writtenNarratives.categories) {
    writtenCategoryMap.set(c.tagId, c);
  }

  for (const cat of assembledCategories) {
    const writtenCat = writtenCategoryMap.get(cat.tagId);
    if (writtenCat) {
      cat.intro = writtenCat.intro;
      const blurbMap = new Map(writtenCat.places.map((p) => [p.id, p.blurb]));
      for (const place of cat.places) {
        place.blurb = blurbMap.get(place.id) || `Authentic spot in the ${input.destination} area.`;
      }
    } else {
      cat.intro = `Top-rated authentic ${cat.title} selections in the ${input.destination} area.`;
      for (const place of cat.places) {
        place.blurb = `Authentic spot in the ${input.destination} area.`;
      }
    }
  }

  const totalDurationMs = Math.round(performance.now() - startTime);
  timings.totalMs = totalDurationMs;

  const finalResult: PassportResult = {
    destination: input.destination,
    resolved,
    unresolvedFavorites,
    plan: intents,
    categories: assembledCategories,
    signalCheck,
    firstMonth: writtenNarratives.firstMonth,
    meta: {
      qlooCalls: budget.getCalls(),
      llmCalls: llmCallsCount,
      ms: totalDurationMs,
      groundingViolations,
      repairAttempts,
      cached: false,
      timings,
    },
  };

  // Record rate limit run and cache result
  if (!options?.bypassRateLimit) {
    rateLimiter.record(clientIp);
  }
  passportResultCache.set(cacheKey, finalResult);

  return finalResult;
}
