import { QlooClient, QlooApiError } from './qloo';
import { MemoryCache, passportResultCache } from './cache';
import { rateLimiter } from './rate-limit';
import { CallBudget, runWithConcurrency } from './concurrency';
import { filterValidPlaces } from './filters';
import {
  inferCuisinesFromTaste,
  shouldAddGroceryCategory,
  formatCuisineBadge,
  EnrichedCuisineTag,
  FavoriteSignalCheck,
  INDIAN_GROCERY_TAG,
} from './cuisine-inference';
import {
  writeGroundedNarratives,
  generateTemplateFallback,
  GroundingInputCategory,
} from './grounding';
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
  description?: string;
  affinity: number | null;
  blurb: string | null;
}

export interface FinalCategory {
  title: string;
  kind: 'inferred_cuisine' | 'grocery';
  kindLabel: string;
  tagId: string;
  enrichment: number;
  cSig: number;
  cBase: number;
  badge: string;
  rawTasteLift: number;
  rawLiftCount: number;
  tasteLiftBadge: string;
  intro: string;
  places: FinalPlace[];
}

export interface PipelineTimings {
  resolveMs: number;
  inferMs: number;
  discoverMs: number;
  writeMs: number;
  totalMs: number;
}

export interface PassportResult {
  destination: string;
  resolved: ResolvedFavorite[];
  unresolvedFavorites: UnresolvedFavorite[];
  categories: FinalCategory[];
  signalCheck: FavoriteSignalCheck[];
  firstMonth: string;
  meta: {
    qlooCalls: number;
    llmCalls: number;
    ms: number;
    groundingViolations: number;
    repairAttempts: number;
    cached: boolean;
    narration: 'ai' | 'template';
    notice?: string;
    blurbCount: number;
    nullBlurbCount: number;
    droppedCategories: string[];
    timings: PipelineTimings;
  };
}

export type PipelineStage = 'resolving' | 'inferring_cuisines' | 'querying_places' | 'writing';

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
    client?: QlooClient;
  }
): Promise<PassportResult> {
  const startTime = performance.now();
  const clientIp = options?.ip || 'anonymous';
  const emit = options?.onProgress || (() => {});

  const timings: PipelineTimings = {
    resolveMs: 0,
    inferMs: 0,
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
    version: 'v5.0',
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

  let client: QlooClient;
  try {
    client = options?.client || new QlooClient();
  } catch (err: any) {
    throw new PipelineError(
      `Qloo client initialization failed: ${QlooApiError.sanitize(err?.message || 'Missing credentials')}`,
      500
    );
  }

  const budget = new CallBudget(50);
  let totalQlooCalls = 0;
  let llmCallsCount = 0;
  let deadlineNotice: string | undefined = undefined;
  const droppedCategories: string[] = [];

  // 3. Stage: RESOLVE FAVORITES
  emit({
    type: 'progress',
    stage: 'resolving',
    message: `Resolving favorites in Qloo taste graph...`,
  });

  const resolveStart = performance.now();

  let resolutionResults;
  try {
    resolutionResults = await Promise.all(
      input.favorites.map(async (fav) => {
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
        totalQlooCalls++;
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
        } catch (err: any) {
          if (err instanceof QlooApiError && err.status && err.status >= 500) {
            throw err;
          }
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
  } catch (err: any) {
    throw new PipelineError(
      `Qloo resolution service failed: ${QlooApiError.sanitize(err?.message || 'Unknown network error')}`,
      502
    );
  }

  timings.resolveMs = Math.round(performance.now() - resolveStart);

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
      `Could not resolve enough favorites in Qloo's taste database. Resolved ${resolved.length} of ${input.favorites.length}; at least 2 are required.`,
      422
    );
  }

  // 4. Stage: CUISINE INFERENCE VIA QLOO (Task A & B)
  emit({
    type: 'progress',
    stage: 'inferring_cuisines',
    message: `Inferring cuisines from Qloo taste graph in ${input.destination} area...`,
  });

  const inferStart = performance.now();
  let inferenceRes;
  try {
    inferenceRes = await inferCuisinesFromTaste(
      client,
      input.destination,
      resolved.map((r) => ({ resolvedId: r.resolvedId, resolvedName: r.resolvedName }))
    );
    totalQlooCalls += inferenceRes.qlooCalls;
  } catch (err: any) {
    throw new PipelineError(
      `Qloo cuisine inference failed: ${QlooApiError.sanitize(err?.message || 'Network error')}`,
      502
    );
  }

  timings.inferMs = Math.round(performance.now() - inferStart);

  let activeTopCuisines = inferenceRes.topCuisines;
  const activeSignalCheck = inferenceRes.signalCheck;
  let activeResolved = resolved;
  let selfCorrectionNotice: string | undefined = undefined;

  // Task C: Noisy-signal self-correction
  // If at least 2 favorites are "consistent" and at least 1 is "pulled in a different direction",
  // rerun the combined enrichment and category assembly using ONLY the consistent favorites.
  const consistentFavs = resolved.filter((r) => {
    const sig = activeSignalCheck.find((s) => s.resolvedId === r.resolvedId);
    return sig?.isConsistent;
  });
  const unalignedFavs = resolved.filter(
    (r) => !consistentFavs.some((c) => c.resolvedId === r.resolvedId)
  );

  if (consistentFavs.length >= 2 && unalignedFavs.length >= 1) {
    const unalignedNames = unalignedFavs.map((f) => f.resolvedName).join(', ');
    selfCorrectionNotice = `Left out of the final search: ${unalignedNames} (pulled in a different direction)`;

    emit({
      type: 'progress',
      stage: 'inferring_cuisines',
      message: `Self-correcting: refining recommendations using consistent signals only (${consistentFavs.map((c) => c.resolvedName).join(', ')})...`,
    });

    const rerunStart = performance.now();
    budget.track();
    // Re-run inference with consistent favorites only
    const rerunRes = await inferCuisinesFromTaste(client, input.destination, consistentFavs);
    timings.inferMs += Math.round(performance.now() - rerunStart);

    activeTopCuisines = rerunRes.topCuisines;
    activeResolved = consistentFavs;
  }

  // 5. Stage: QUERY PLACES PER INFERRED CUISINE + GROCERY RULE (Task B, C, F)
  emit({
    type: 'progress',
    stage: 'querying_places',
    message: `Retrieving top places and calculating raw taste lift...`,
  });

  const discoverStart = performance.now();

  interface CandidateCategoryConfig {
    tagId: string;
    title: string;
    kind: 'inferred_cuisine' | 'grocery';
    kindLabel: string;
    enrichment: number;
    cSig: number;
    cBase: number;
    isRuleBasedGrocery?: boolean;
  }

  const categoryConfigs: CandidateCategoryConfig[] = activeTopCuisines.map((t) => ({
    tagId: t.id,
    title: t.name,
    kind: 'inferred_cuisine',
    kindLabel: 'Qloo Taste Inferred',
    enrichment: t.enrichment,
    cSig: t.cSig,
    cBase: t.cBase,
  }));

  // Check Grocery Rule (Task B)
  const shouldAddGrocery = shouldAddGroceryCategory(activeTopCuisines[0]);
  if (shouldAddGrocery) {
    categoryConfigs.push({
      tagId: INDIAN_GROCERY_TAG,
      title: 'Indian Grocery',
      kind: 'grocery',
      kindLabel: 'Rule-based: grocery stop (not Qloo-inferred)',
      enrichment: 1.0,
      cSig: 0,
      cBase: 0,
      isRuleBasedGrocery: true,
    });
  }

  const resolvedSignalIds = activeResolved.map((r) => r.resolvedId);
  const tagBaselines = new Map<string, string[]>();
  const categoryCombinedRaw = new Map<string, any[]>();

  const placeQueryTasks: Array<() => Promise<void>> = [];

  for (const cfg of categoryConfigs) {
    // Task B: Category query with take=50
    placeQueryTasks.push(async () => {
      // Deadline guard check: 50s total discovery budget
      if (performance.now() - startTime > 50000) {
        deadlineNotice = 'Discovery deadline reached (50s); returning verified categories.';
        return;
      }

      budget.track();
      totalQlooCalls++;
      try {
        const res = await client.insights({
          filterLocationQuery: input.destination,
          filterTags: cfg.tagId,
          signalEntities: cfg.isRuleBasedGrocery ? undefined : resolvedSignalIds,
          take: 50,
        });
        const entities = res?.results?.entities || (Array.isArray(res?.results) ? res.results : []);
        categoryCombinedRaw.set(cfg.tagId, entities);
      } catch {
        categoryCombinedRaw.set(cfg.tagId, []);
      }
    });

    // Baseline query (NO signals, take=10 for raw top-10 taste lift computation)
    placeQueryTasks.push(async () => {
      const cacheBaselineKey = `baseline:${cfg.tagId}:${input.destination.trim().toLowerCase()}`;
      const cached = baselineCache.get<string[]>(cacheBaselineKey);
      if (cached) {
        tagBaselines.set(cfg.tagId, cached);
        return;
      }

      budget.track();
      totalQlooCalls++;
      try {
        const res = await client.insights({
          filterLocationQuery: input.destination,
          filterTags: cfg.tagId,
          take: 10,
        });
        const entities = res?.results?.entities || (Array.isArray(res?.results) ? res.results : []);
        const ids = entities.map((e: any) => e.entity_id || e.id).filter(Boolean);
        tagBaselines.set(cfg.tagId, ids);
        baselineCache.set(cacheBaselineKey, ids, 24 * 60 * 60 * 1000);
      } catch {
        tagBaselines.set(cfg.tagId, []);
      }
    });
  }

  await runWithConcurrency(placeQueryTasks, 6);

  // 6. Sequential assembly with shared claimed-id set (Task B & Task F)
  const assignedPlaceIds = new Set<string>();
  const assembledCategories: FinalCategory[] = [];
  const groundingInputCategories: GroundingInputCategory[] = [];

  for (const cfg of categoryConfigs) {
    // Check deadline guard
    if (performance.now() - startTime > 50000) {
      deadlineNotice = 'Discovery deadline reached (50s); returning verified categories.';
      break;
    }

    const rawPlaces = categoryCombinedRaw.get(cfg.tagId) || [];
    const baselineIds = new Set<string>(tagBaselines.get(cfg.tagId) || []);

    // Task C: Compute tasteLift on the RAW top-10 BEFORE cross-category dedupe/backfill
    const rawCombined10Ids = rawPlaces.slice(0, 10).map((p: any) => p.entity_id || p.id || '').filter(Boolean);
    let intersectCount = 0;
    for (const id of rawCombined10Ids) {
      if (baselineIds.has(id)) intersectCount++;
    }

    const rawTasteLift =
      rawCombined10Ids.length > 0 ? 1 - intersectCount / rawCombined10Ids.length : 0;
    const rawLiftCount = rawCombined10Ids.length - intersectCount;

    const tasteLiftBadge =
      rawTasteLift < 0.3
        ? 'mostly popularity-led'
        : `${rawLiftCount} of the top 10 wouldn't appear without your taste`;

    // Filter valid places (drop closed, drop banquet halls)
    const validPlaces = filterValidPlaces(rawPlaces);

    // Sequential claiming: skip ids already claimed by earlier (more specific) categories
    const availablePlaces = validPlaces.filter((p) => {
      const pId = p.entity_id || p.id || '';
      return pId && !assignedPlaceIds.has(pId);
    });

    const selectedPlaces = availablePlaces.slice(0, 6);

    // Task F: Grocery Coherence Gate
    if (cfg.isRuleBasedGrocery) {
      // Primary category is the first assembled category
      const primaryCat = assembledCategories[0];
      const primaryTagId = primaryCat?.tagId;
      const primaryRawPlaces = primaryTagId ? categoryCombinedRaw.get(primaryTagId) || [] : [];
      const primaryPool50Ids = new Set<string>(primaryRawPlaces.map((p: any) => p.entity_id || p.id || '').filter(Boolean));

      let coherentCount = 0;
      for (const p of selectedPlaces) {
        const pId = p.entity_id || p.id || '';
        const inPool = primaryPool50Ids.has(pId);
        const hasPrimaryTag = Array.isArray(p.tags) && p.tags.some((t: any) => t.id === primaryTagId);
        if (inPool || hasPrimaryTag) {
          coherentCount++;
        }
      }

      // "Keep the grocery category only if it holds >= 3 places AND >= 2 of its places also appear in the primary category's top-50 pool OR carry the primary cuisine tag"
      if (selectedPlaces.length < 3 || coherentCount < 2) {
        droppedCategories.push('Indian Grocery');
        continue;
      }
    } else {
      // Task B: Drop non-grocery category if it ends with < 4 places
      if (selectedPlaces.length < 4) {
        droppedCategories.push(cfg.title);
        continue;
      }
    }

    // Mark as claimed in shared set
    for (const p of selectedPlaces) {
      const pId = p.entity_id || p.id || '';
      if (pId) assignedPlaceIds.add(pId);
    }

    // Task A: Honest counts-based badge text
    const badge = cfg.isRuleBasedGrocery
      ? 'Rule-based: cultural grocery stop'
      : formatCuisineBadge(cfg.cSig, cfg.cBase, 50, cfg.title, input.destination);

    const finalPlaces: FinalPlace[] = selectedPlaces.map((p: any) => {
      const pId = p.entity_id || p.id || '';

      let dishes: string[] = [];
      if (Array.isArray(p.properties?.specialty_dishes)) {
        dishes = p.properties.specialty_dishes
          .map((d: any) => (typeof d === 'string' ? d : d?.name || ''))
          .filter((d: any): d is string => typeof d === 'string' && d.trim().length > 0)
          .slice(0, 3);
      }

      let desc: string | undefined = undefined;
      if (typeof p.properties?.description === 'string' && p.properties.description.trim()) {
        desc = p.properties.description.trim();
      } else if (Array.isArray(p.properties?.short_descriptions) && p.properties.short_descriptions[0]) {
        desc = String(p.properties.short_descriptions[0]).trim();
      } else if (typeof p.properties?.cuisine_description === 'string' && p.properties.cuisine_description.trim()) {
        desc = p.properties.cuisine_description.trim();
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
        description: desc,
        affinity: typeof p.popularity === 'number' ? p.popularity : null,
        blurb: null, // assigned in writing stage
      };
    });

    assembledCategories.push({
      title: cfg.title,
      kind: cfg.kind,
      kindLabel: cfg.kindLabel,
      tagId: cfg.tagId,
      enrichment: cfg.enrichment,
      cSig: cfg.cSig,
      cBase: cfg.cBase,
      badge,
      rawTasteLift,
      rawLiftCount,
      tasteLiftBadge,
      intro: '',
      places: finalPlaces,
    });

    groundingInputCategories.push({
      title: cfg.title,
      kind: cfg.kind,
      tagId: cfg.tagId,
      places: finalPlaces.map((p) => {
        const rawPlace = selectedPlaces.find((sp: any) => (sp.entity_id || sp.id) === p.id);
        let desc: string | undefined = undefined;
        if (typeof rawPlace?.properties?.description === 'string' && rawPlace.properties.description.trim()) {
          desc = rawPlace.properties.description.trim();
        } else if (Array.isArray(rawPlace?.properties?.short_descriptions) && rawPlace.properties.short_descriptions[0]) {
          desc = String(rawPlace.properties.short_descriptions[0]);
        } else if (typeof rawPlace?.properties?.cuisine_description === 'string' && rawPlace.properties.cuisine_description.trim()) {
          desc = rawPlace.properties.cuisine_description.trim();
        }

        return {
          id: p.id,
          name: p.name,
          address: p.address,
          dishes: p.dishes,
          description: desc,
        };
      }),
    });
  }

  timings.discoverMs = Math.round(performance.now() - discoverStart);

  // 7. Stage: GROUNDED COMMENTARY & DEADLINE GUARD (Task D & Task E)
  emit({
    type: 'progress',
    stage: 'writing',
    message: 'Composing grounded commentary and settling guide...',
  });

  const elapsedBeforeWrite = performance.now() - startTime;
  let writtenNarratives;
  let narration: 'ai' | 'template' = 'ai';
  let groundingViolations = 0;
  let repairAttempts = 0;

  // Task E: Deadline guard - if elapsed > 40s before writing, skip LLM and use template
  if (elapsedBeforeWrite > 40000 || process.env.LLM_DISABLED === 'true') {
    writtenNarratives = generateTemplateFallback(groundingInputCategories, input.destination);
    narration = 'template';
    if (elapsedBeforeWrite > 40000 && !deadlineNotice) {
      deadlineNotice = 'AI descriptions skipped to ensure response deadline; showing verified data only.';
    }
  } else {
    const writeStart = performance.now();
    const writeRes = await writeGroundedNarratives(
      groundingInputCategories,
      resolved.map((r) => r.resolvedName),
      input.destination
    );
    timings.writeMs = Math.round(performance.now() - writeStart);
    writtenNarratives = writeRes.output;
    groundingViolations = writeRes.groundingViolations;
    repairAttempts = writeRes.repairAttempts;
    narration = writeRes.narration;
  }

  if (narration === 'ai') {
    llmCallsCount = 1;
  } else {
    llmCallsCount = 0;
  }

  // Merge blurbs and intros into assembled categories
  const writtenCategoryMap = new Map<string, (typeof writtenNarratives.categories)[0]>();
  for (const c of writtenNarratives.categories) {
    writtenCategoryMap.set(c.tagId, c);
  }

  let blurbCount = 0;
  let nullBlurbCount = 0;

  for (const cat of assembledCategories) {
    const writtenCat = writtenCategoryMap.get(cat.tagId);
    const blurbMap = writtenCat ? new Map(writtenCat.places.map((p) => [p.id, p.blurb])) : new Map();
    if (writtenCat) {
      cat.intro = writtenCat.intro;
    } else {
      cat.intro = `${cat.title} dining selections in the ${input.destination} area.`;
    }

    const catInput = groundingInputCategories.find((c) => c.tagId === cat.tagId);

    for (const place of cat.places) {
      const placeInput = catInput?.places.find((p) => p.id === place.id);
      const hasSourceText =
        (place.dishes && place.dishes.length > 0) ||
        Boolean(placeInput?.description && placeInput.description.trim());

      // Task D: Strict rule - blurb MUST be null if no source text
      const b = hasSourceText ? (blurbMap.get(place.id) ?? null) : null;
      place.blurb = b;
      if (b !== null) {
        blurbCount++;
      } else {
        nullBlurbCount++;
      }
    }
  }

  const totalDurationMs = Math.round(performance.now() - startTime);
  timings.totalMs = totalDurationMs;

  const finalResult: PassportResult = {
    destination: input.destination,
    resolved,
    unresolvedFavorites,
    categories: assembledCategories,
    signalCheck: activeSignalCheck,
    firstMonth: writtenNarratives.firstMonth,
    meta: {
      qlooCalls: totalQlooCalls,
      llmCalls: llmCallsCount,
      ms: totalDurationMs,
      groundingViolations,
      repairAttempts,
      cached: false,
      narration,
      notice:
        deadlineNotice ||
        selfCorrectionNotice ||
        (narration === 'template'
          ? 'AI descriptions unavailable right now; showing data only'
          : undefined),
      blurbCount,
      nullBlurbCount,
      droppedCategories,
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
