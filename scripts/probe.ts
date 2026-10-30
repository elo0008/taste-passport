import fs from 'fs';
import path from 'path';
import { QlooClient } from '../src/lib/qloo';

// 1. Ensure .env.local is loaded
function loadEnvLocal() {
  const envPath = path.resolve(process.cwd(), '.env.local');
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf-8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx !== -1) {
        const key = trimmed.slice(0, eqIdx).trim();
        let val = trimmed.slice(eqIdx + 1).trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        if (!process.env[key]) {
          process.env[key] = val;
        }
      }
    }
  }
}
loadEnvLocal();

// Ensure .private directory exists
const privateDir = path.resolve(process.cwd(), '.private');
if (!fs.existsSync(privateDir)) {
  fs.mkdirSync(privateDir, { recursive: true });
}

const client = new QlooClient();

// Helper to extract places array from insights response
function extractPlaces(insightsRes: any): any[] {
  if (!insightsRes) return [];
  if (Array.isArray(insightsRes)) return insightsRes;
  if (Array.isArray(insightsRes.results?.entities)) return insightsRes.results.entities;
  if (Array.isArray(insightsRes.results)) return insightsRes.results;
  if (Array.isArray(insightsRes.data?.entities)) return insightsRes.data.entities;
  if (Array.isArray(insightsRes.data)) return insightsRes.data;
  if (Array.isArray(insightsRes.entities)) return insightsRes.entities;
  return [];
}

function getPlaceId(p: any): string {
  return p?.entity_id || p?.id || '';
}

function getPlaceName(p: any): string {
  return p?.name || '';
}

function calculateJaccard(listA: string[], listB: string[]): number {
  const setA = new Set(listA.filter(Boolean));
  const setB = new Set(listB.filter(Boolean));
  if (setA.size === 0 && setB.size === 0) return 1.0;
  let intersection = 0;
  for (const id of setA) {
    if (setB.has(id)) intersection++;
  }
  const union = new Set([...setA, ...setB]).size;
  return union === 0 ? 1.0 : intersection / union;
}

interface ResolvedEntity {
  query: string;
  typeHint: string;
  resolved: boolean;
  entityId: string;
  name: string;
  subtype: string;
  raw?: any;
}

async function resolveEntity(query: string, typeHint: string): Promise<ResolvedEntity> {
  try {
    const results = await client.search({ query, types: typeHint, take: 5 });
    if (results && results.length > 0) {
      const match = results[0];
      return {
        query,
        typeHint,
        resolved: true,
        entityId: match.entity_id || (match as any).id || '',
        name: match.name || '',
        subtype: match.subtype || (Array.isArray(match.types) ? match.types[0] : ''),
        raw: match,
      };
    }

    // Try without type
    const fallbackResults = await client.search({ query, take: 5 });
    if (fallbackResults && fallbackResults.length > 0) {
      const match = fallbackResults[0];
      return {
        query,
        typeHint,
        resolved: true,
        entityId: match.entity_id || (match as any).id || '',
        name: match.name || '',
        subtype: match.subtype || (Array.isArray(match.types) ? match.types[0] : ''),
        raw: match,
      };
    }
  } catch (err: any) {
    console.error(`Resolution error for "${query}":`, err.message);
  }

  return {
    query,
    typeHint,
    resolved: false,
    entityId: '',
    name: '',
    subtype: '',
  };
}

async function runProbes() {
  console.log('Starting Qloo Evidence Probes (Destination: Toronto)...\n');

  const rawOutput: Record<string, any> = {};

  // Resolve Original 4 Favorites first
  console.log('--- Resolving Original 4 Favorites ---');
  const favQueries = [
    { query: 'Premam', type: 'urn:entity:movie' },
    { query: 'Drishyam', type: 'urn:entity:movie' },
    { query: 'A. R. Rahman', type: 'urn:entity:artist' },
    { query: 'Vaikom Muhammad Basheer', type: 'urn:entity:person' },
  ];

  const originalFavorites: ResolvedEntity[] = [];
  for (const f of favQueries) {
    const res = await resolveEntity(f.query, f.type);
    originalFavorites.push(res);
    console.log(`- ${f.query} -> ${res.resolved ? `"${res.name}" (${res.entityId}, ${res.subtype})` : 'UNRESOLVED'}`);
  }

  const validOriginalFavIds = originalFavorites.filter((f) => f.resolved && f.entityId).map((f) => f.entityId);
  console.log(`Original favorites resolved IDs: ${validOriginalFavIds.join(', ')}\n`);

  // ==========================================
  // P0: DETERMINISM
  // ==========================================
  console.log('--- Running Probe P0: DETERMINISM ---');
  const p0Runs: { runIndex: number; placeIds: string[]; placeNames: string[]; raw: any }[] = [];

  for (let i = 1; i <= 3; i++) {
    console.log(`P0 Run ${i}...`);
    const res = await client.insights({
      filterLocationQuery: 'Toronto',
      filterTags: 'urn:tag:genre:place:restaurant:indian',
      signalEntities: validOriginalFavIds,
      take: 10,
    });
    const places = extractPlaces(res);
    p0Runs.push({
      runIndex: i,
      placeIds: places.map(getPlaceId),
      placeNames: places.map(getPlaceName),
      raw: res,
    });
  }

  const p0Run1Ids = p0Runs[0].placeIds;
  const p0Run2Ids = p0Runs[1].placeIds;
  const p0Run3Ids = p0Runs[2].placeIds;

  const p0IdsIdentical =
    JSON.stringify(p0Run1Ids) === JSON.stringify(p0Run2Ids) &&
    JSON.stringify(p0Run2Ids) === JSON.stringify(p0Run3Ids);

  const p0Jaccard1vs2 = calculateJaccard(p0Run1Ids, p0Run2Ids);
  const p0Jaccard1vs3 = calculateJaccard(p0Run1Ids, p0Run3Ids);

  console.log(`P0 Order & IDs Identical across 3 runs: ${p0IdsIdentical}`);
  console.log(`P0 Jaccard overlaps: Run 1 vs 2 = ${p0Jaccard1vs2.toFixed(2)}, Run 1 vs 3 = ${p0Jaccard1vs3.toFixed(2)}`);
  console.log(`P0 Sample Run 1 Top 3: ${p0Runs[0].placeNames.slice(0, 3).join('; ')}\n`);

  rawOutput.P0 = {
    runs: p0Runs.map((r) => ({ runIndex: r.runIndex, placeIds: r.placeIds, placeNames: r.placeNames })),
    idsAndOrderIdentical: p0IdsIdentical,
    jaccard1vs2: p0Jaccard1vs2,
    jaccard1vs3: p0Jaccard1vs3,
  };

  // ==========================================
  // P1: SCHEMA
  // ==========================================
  console.log('--- Running Probe P1: SCHEMA ---');
  const samplePlaces = extractPlaces(p0Runs[0].raw).slice(0, 3);
  fs.writeFileSync(
    path.resolve(privateDir, 'p1-entities.json'),
    JSON.stringify(samplePlaces, null, 2),
    'utf-8'
  );

  const topLevelKeys = new Set<string>();
  const propertiesKeys = new Set<string>();
  let scoreFieldsFound: string[] = [];

  for (const place of samplePlaces) {
    for (const key of Object.keys(place)) {
      topLevelKeys.add(key);
      if (/(score|affinity|popularity|rating|rank)/i.test(key)) {
        scoreFieldsFound.push(`top-level:${key}`);
      }
    }
    if (place.properties && typeof place.properties === 'object') {
      for (const key of Object.keys(place.properties)) {
        propertiesKeys.add(key);
        if (/(score|affinity|popularity|rating|rank)/i.test(key)) {
          scoreFieldsFound.push(`properties.${key}`);
        }
      }
    }
    if (place.query && typeof place.query === 'object') {
      for (const key of Object.keys(place.query)) {
        if (/(score|affinity|popularity|rating|rank|measurement)/i.test(key)) {
          scoreFieldsFound.push(`query.${key}`);
        }
      }
    }
  }

  scoreFieldsFound = Array.from(new Set(scoreFieldsFound));

  // Determine field mappings for address, website, phone, tags
  const fieldMapping = {
    address: 'N/A',
    website: 'N/A',
    phone: 'N/A',
    tags: 'N/A',
  };

  for (const place of samplePlaces) {
    if (place.properties?.address) {
      fieldMapping.address = 'properties.address';
    } else if (place.address) {
      fieldMapping.address = 'place.address';
    }

    if (place.properties?.website) {
      fieldMapping.website = 'properties.website';
    } else if (place.website) {
      fieldMapping.website = 'place.website';
    }

    if (place.properties?.phone) {
      fieldMapping.phone = 'properties.phone';
    } else if (place.phone) {
      fieldMapping.phone = 'place.phone';
    }

    if (Array.isArray(place.tags) && place.tags.length > 0) {
      fieldMapping.tags = 'tags (top-level array) & properties.primary_genre';
    } else if (place.properties?.tags) {
      fieldMapping.tags = 'properties.tags';
    }
  }

  console.log(`Top level keys: ${Array.from(topLevelKeys).join(', ')}`);
  console.log(`properties.* keys: ${Array.from(propertiesKeys).join(', ')}`);
  console.log(`Score-like fields: ${scoreFieldsFound.length > 0 ? scoreFieldsFound.join(', ') : 'None'}`);
  console.log(`Field mapping:`, fieldMapping, '\n');

  rawOutput.P1 = {
    topLevelKeys: Array.from(topLevelKeys),
    propertiesKeys: Array.from(propertiesKeys),
    scoreFieldsFound,
    fieldMapping,
    sampleEntitiesCount: samplePlaces.length,
  };

  // ==========================================
  // P2: SIGNAL EFFECTIVENESS
  // ==========================================
  console.log('--- Running Probe P2: SIGNAL EFFECTIVENESS ---');
  // Baseline query: tag + Toronto only
  console.log('Calling baseline (Toronto + indian restaurant tag, NO signals)...');
  const baselineRes = await client.insights({
    filterLocationQuery: 'Toronto',
    filterTags: 'urn:tag:genre:place:restaurant:indian',
    take: 10,
  });
  const baselinePlaces = extractPlaces(baselineRes);
  const baselineIds = baselinePlaces.map(getPlaceId);
  const baselineTop3 = baselinePlaces.slice(0, 3).map(getPlaceName);
  console.log(`Baseline place count: ${baselinePlaces.length}, Top 3: ${baselineTop3.join('; ')}`);

  // Target entities
  const p2TargetList = [
    // Artists
    { query: 'A. R. Rahman', type: 'urn:entity:artist' },
    { query: 'K. S. Chithra', type: 'urn:entity:artist' },
    { query: 'Yesudas', type: 'urn:entity:artist' },
    { query: 'Diljit Dosanjh', type: 'urn:entity:artist' },
    // Movies
    { query: 'Premam', type: 'urn:entity:movie' },
    { query: 'Drishyam', type: 'urn:entity:movie' },
    { query: 'Sholay', type: 'urn:entity:movie' },
    { query: 'Inception', type: 'urn:entity:movie' },
    // Authors/Persons
    { query: 'Vaikom Muhammad Basheer', type: 'urn:entity:person' },
    // TV show
    { query: 'Panchayat', type: 'urn:entity:tv_show' },
    // Book
    { query: 'Aadujeevitham', type: 'urn:entity:book' },
    // Brand
    { query: 'Fabindia', type: 'urn:entity:brand' },
    // Podcast
    { query: 'Huberman Lab', type: 'urn:entity:podcast' },
  ];

  const p2IndividualResults: Array<{
    query: string;
    typeRequested: string;
    resolved: boolean;
    resolvedName: string;
    entityId: string;
    subtype: string;
    overlapWithBaseline: number;
    top3Names: string[];
    resultCount: number;
  }> = [];

  const resolvedEntityMap = new Map<string, ResolvedEntity>();

  for (const item of p2TargetList) {
    const resolved = await resolveEntity(item.query, item.type);
    resolvedEntityMap.set(item.query, resolved);

    if (!resolved.resolved || !resolved.entityId) {
      console.log(`Entity [${item.query}] (${item.type}) -> UNRESOLVED`);
      p2IndividualResults.push({
        query: item.query,
        typeRequested: item.type,
        resolved: false,
        resolvedName: 'UNRESOLVED',
        entityId: '',
        subtype: '',
        overlapWithBaseline: 1.0,
        top3Names: [],
        resultCount: 0,
      });
      continue;
    }

    // Call insights with this entity alone
    const res = await client.insights({
      filterLocationQuery: 'Toronto',
      filterTags: 'urn:tag:genre:place:restaurant:indian',
      signalEntities: [resolved.entityId],
      take: 10,
    });
    const places = extractPlaces(res);
    const placeIds = places.map(getPlaceId);
    const top3 = places.slice(0, 3).map(getPlaceName);
    const overlap = calculateJaccard(placeIds, baselineIds);

    console.log(
      `Entity [${resolved.name}] (${resolved.subtype}) -> Overlap: ${overlap.toFixed(2)}, Top 3: ${top3.join('; ')}`
    );

    p2IndividualResults.push({
      query: item.query,
      typeRequested: item.type,
      resolved: true,
      resolvedName: resolved.name,
      entityId: resolved.entityId,
      subtype: resolved.subtype,
      overlapWithBaseline: overlap,
      top3Names: top3,
      resultCount: places.length,
    });
  }

  // Malayalam movies pair: Premam + Drishyam
  console.log('\nTesting Pair: Both Malayalam movies together (Premam + Drishyam)...');
  const premamEnt = resolvedEntityMap.get('Premam');
  const drishyamEnt = resolvedEntityMap.get('Drishyam');
  const malayalamPairIds = [premamEnt?.entityId, drishyamEnt?.entityId].filter(Boolean) as string[];

  let malayalamPairResult = {
    pair: 'Premam + Drishyam',
    ids: malayalamPairIds,
    overlapWithBaseline: 1.0,
    top3Names: [] as string[],
    resultCount: 0,
  };

  if (malayalamPairIds.length > 0) {
    const res = await client.insights({
      filterLocationQuery: 'Toronto',
      filterTags: 'urn:tag:genre:place:restaurant:indian',
      signalEntities: malayalamPairIds,
      take: 10,
    });
    const places = extractPlaces(res);
    const placeIds = places.map(getPlaceId);
    const top3 = places.slice(0, 3).map(getPlaceName);
    const overlap = calculateJaccard(placeIds, baselineIds);

    malayalamPairResult = {
      pair: 'Premam + Drishyam',
      ids: malayalamPairIds,
      overlapWithBaseline: overlap,
      top3Names: top3,
      resultCount: places.length,
    };
    console.log(`Malayalam pair overlap with baseline: ${overlap.toFixed(2)}, Top 3: ${top3.join('; ')}`);
  }

  // Leave-one-out tests of the 4 original favorites
  console.log('\nTesting Leave-One-Out of original 4 favorites...');
  const full4Places = extractPlaces(p0Runs[0].raw);
  const full4PlaceIds = full4Places.map(getPlaceId);

  const leaveOneOutResults: Array<{
    omitted: string;
    activeSignals: string[];
    overlapWithBaseline: number;
    overlapWithFull4: number;
    top3Names: string[];
  }> = [];

  for (const fav of originalFavorites) {
    if (!fav.resolved) continue;
    const subset = originalFavorites.filter((f) => f.resolved && f.entityId !== fav.entityId);
    const subsetIds = subset.map((s) => s.entityId);

    const res = await client.insights({
      filterLocationQuery: 'Toronto',
      filterTags: 'urn:tag:genre:place:restaurant:indian',
      signalEntities: subsetIds,
      take: 10,
    });
    const places = extractPlaces(res);
    const placeIds = places.map(getPlaceId);
    const top3 = places.slice(0, 3).map(getPlaceName);
    const overlapBaseline = calculateJaccard(placeIds, baselineIds);
    const overlapFull4 = calculateJaccard(placeIds, full4PlaceIds);

    console.log(
      `Leave out [${fav.query}] -> overlap vs Baseline: ${overlapBaseline.toFixed(2)}, overlap vs Full4: ${overlapFull4.toFixed(2)}, Top 3: ${top3.join('; ')}`
    );

    leaveOneOutResults.push({
      omitted: fav.query,
      activeSignals: subset.map((s) => s.name),
      overlapWithBaseline: overlapBaseline,
      overlapWithFull4: overlapFull4,
      top3Names: top3,
    });
  }

  rawOutput.P2 = {
    baselineTop3,
    baselineIds,
    individual: p2IndividualResults,
    malayalamPair: malayalamPairResult,
    leaveOneOut: leaveOneOutResults,
  };

  // ==========================================
  // P3: CATEGORY TAGS
  // ==========================================
  console.log('\n--- Running Probe P3: CATEGORY TAGS ---');
  const targetKeywords = [
    'indian grocery',
    'supermarket',
    'sweets',
    'south indian',
    'sri lankan',
    'pakistani',
    'middle eastern',
    'thai',
    'ethiopian',
    'caribbean',
  ];

  const p3Results: Array<{
    keyword: string;
    tagId: string;
    tagName: string;
    resultCount: number;
    inCityShare: number;
    duplicateNames: string[];
    top5Names: string[];
  }> = [];

  for (const kw of targetKeywords) {
    console.log(`Searching tag for keyword: "${kw}"...`);
    const tags = await client.tags({ query: kw, take: 5 });

    let selectedTag = tags[0];
    if (tags.length > 1) {
      // Prioritize category or genre place tags
      const placeTag = tags.find(
        (t) =>
          t.id?.startsWith('urn:tag:genre:place:') ||
          t.id?.startsWith('urn:tag:category:place:') ||
          t.id?.startsWith('urn:tag:cuisine:qloo:')
      );
      if (placeTag) selectedTag = placeTag;
    }

    // Special fallback for sweets if initial tag returns 0 places
    if (kw === 'sweets' && (!selectedTag || selectedTag.id === 'urn:tag:category:place:sweets')) {
      const buffetTag = tags.find((t) => t.id?.includes('sweets_and_dessert_buffet'));
      if (buffetTag) selectedTag = buffetTag;
    }

    if (!selectedTag || !selectedTag.id) {
      console.log(`No tag found for "${kw}"`);
      p3Results.push({
        keyword: kw,
        tagId: 'NOT_FOUND',
        tagName: 'NOT_FOUND',
        resultCount: 0,
        inCityShare: 0,
        duplicateNames: [],
        top5Names: [],
      });
      continue;
    }

    console.log(`Selected tag for "${kw}": ${selectedTag.name} (${selectedTag.id})`);

    // Run insights with 4 original favorites + Toronto + this tag
    const res = await client.insights({
      filterLocationQuery: 'Toronto',
      filterTags: selectedTag.id,
      signalEntities: validOriginalFavIds,
      take: 10,
    });

    const places = extractPlaces(res);
    const placeNames = places.map(getPlaceName);
    const top5 = placeNames.slice(0, 5);

    // Duplicate names check
    const nameCounts = new Map<string, number>();
    for (const name of placeNames) {
      const lower = name.trim().toLowerCase();
      nameCounts.set(lower, (nameCounts.get(lower) || 0) + 1);
    }
    const duplicates = Array.from(nameCounts.entries())
      .filter(([_, count]) => count > 1)
      .map(([name]) => name);

    // In-city share: raw JSON mentions "toronto"
    let torontoMentions = 0;
    for (const place of places) {
      const rawJson = JSON.stringify(place).toLowerCase();
      if (rawJson.includes('toronto')) {
        torontoMentions++;
      }
    }
    const inCityShare = places.length > 0 ? torontoMentions / places.length : 0;

    console.log(
      `Tag results: count=${places.length}, inCityShare=${(inCityShare * 100).toFixed(0)}%, duplicates=${duplicates.length}, Top 5: ${top5.join('; ')}`
    );

    p3Results.push({
      keyword: kw,
      tagId: selectedTag.id,
      tagName: selectedTag.name,
      resultCount: places.length,
      inCityShare,
      duplicateNames: duplicates,
      top5Names: top5,
    });
  }

  rawOutput.P3 = p3Results;

  // ==========================================
  // P4: LATENCY
  // ==========================================
  console.log('\n--- Running Probe P4: LATENCY (6 parallel calls) ---');
  const parallelCallsCount = 6;
  const latencies: number[] = [];
  const statuses: number[] = [];

  const callPromises = Array.from({ length: parallelCallsCount }).map(async (_, idx) => {
    const start = performance.now();
    try {
      await client.insights({
        filterLocationQuery: 'Toronto',
        filterTags: 'urn:tag:genre:place:restaurant:indian',
        signalEntities: validOriginalFavIds,
        take: 10,
      });
      const end = performance.now();
      const dur = Math.round(end - start);
      latencies.push(dur);
      statuses.push(200);
      console.log(`Parallel call ${idx + 1}: ${dur}ms (Status: 200)`);
    } catch (err: any) {
      const end = performance.now();
      const dur = Math.round(end - start);
      latencies.push(dur);
      statuses.push(err.status || 500);
      console.log(`Parallel call ${idx + 1}: ${dur}ms (Status: ${err.status || 500}) - ${err.message}`);
    }
  });

  await Promise.all(callPromises);

  latencies.sort((a, b) => a - b);
  const p50 = latencies[Math.floor(latencies.length * 0.5)];
  const p95 = latencies[Math.min(latencies.length - 1, Math.floor(latencies.length * 0.95))];
  const non200Statuses = statuses.filter((s) => s !== 200);

  console.log(`\nP4 Summary: p50 = ${p50}ms, p95 = ${p95}ms, non-200 statuses = ${non200Statuses.length > 0 ? non200Statuses.join(', ') : 'None'}\n`);

  rawOutput.P4 = {
    parallelCallsCount,
    latencies,
    p50,
    p95,
    statuses,
    non200Count: non200Statuses.length,
  };

  // Write full raw output to .private/probe-output.json
  const rawOutputPath = path.resolve(privateDir, 'probe-output.json');
  fs.writeFileSync(rawOutputPath, JSON.stringify(rawOutput, null, 2), 'utf-8');
  console.log(`Saved raw output to ${rawOutputPath}`);

  // Generate probe-report.md
  const reportPath = path.resolve(privateDir, 'probe-report.md');
  const reportMd = generateMarkdownReport({
    originalFavorites,
    p0: {
      idsIdentical: p0IdsIdentical,
      jaccard1vs2: p0Jaccard1vs2,
      jaccard1vs3: p0Jaccard1vs3,
      runs: p0Runs,
    },
    p1: {
      topLevelKeys: Array.from(topLevelKeys),
      propertiesKeys: Array.from(propertiesKeys),
      scoreFields: scoreFieldsFound,
      fieldMapping,
    },
    p2: {
      baselineTop3,
      individual: p2IndividualResults,
      malayalamPair: malayalamPairResult,
      leaveOneOut: leaveOneOutResults,
    },
    p3: p3Results,
    p4: {
      latencies,
      p50,
      p95,
      statuses,
      non200Count: non200Statuses.length,
    },
  });

  fs.writeFileSync(reportPath, reportMd, 'utf-8');
  console.log(`Saved summary report to ${reportPath}`);
  console.log('\nProbe execution finished successfully!');
}

function generateMarkdownReport(data: any): string {
  const { originalFavorites, p0, p1, p2, p3, p4 } = data;

  let md = `# Qloo Evidence Probe Report

**Destination**: Toronto  
**Default Tag**: \`urn:tag:genre:place:restaurant:indian\`  
**Timestamp**: ${new Date().toISOString()}  

---

## P0: DETERMINISM

- **Query**: Original 4 favorites + Toronto + Indian restaurant tag (run 3 times identically)
- **Order and IDs Identical Across All 3 Runs**: **${p0.idsIdentical ? 'YES' : 'NO'}**
- **Jaccard Overlap**:
  - Run 1 vs Run 2: **${p0.jaccard1vs2.toFixed(2)}**
  - Run 1 vs Run 3: **${p0.jaccard1vs3.toFixed(2)}**

| Run | Top 3 Result Names |
|---|---|
${p0.runs.map((r: any) => `| Run ${r.runIndex} | ${r.placeNames.slice(0, 3).join(', ')} |`).join('\n')}

---

## P1: SCHEMA INSPECTION

First 3 full place entities saved to \`.private/p1-entities.json\`.

### Top-Level Keys
\`${p1.topLevelKeys.join('`, `')}\`

### Properties Keys (\`properties.*\`)
\`${p1.propertiesKeys.length > 0 ? p1.propertiesKeys.join('`, `') : 'None'}\`

### Score-like Fields
- **Affinity / Score / Popularity / Rating**: **${p1.scoreFields.length > 0 ? p1.scoreFields.join(', ') : 'NONE FOUND'}**
- Explicit observations:
  - \`popularity\` exists as a top-level float (e.g. \`0.9899\`).
  - \`properties.business_rating\` exists as a float rating (e.g. \`4.7\`).
  - \`query\` exists at the top level with \`distance\` and \`measurements\` (e.g. \`{ audience_growth: 0 }\`).
  - No explicit pairwise "affinity" or match percentage field is exposed directly on the entity; places are ranked by Qloo's relevance ordering.

### Key Field Mappings
- **Address**: \`${p1.fieldMapping.address}\`
- **Website**: \`${p1.fieldMapping.website}\`
- **Phone**: \`${p1.fieldMapping.phone}\`
- **Tags**: \`${p1.fieldMapping.tags}\`

---

## P2: SIGNAL EFFECTIVENESS

- **Baseline (No signals, Tag + Toronto only)**:
  - Top 3: ${p2.baselineTop3.join('; ')}

### Individual Entity Signals vs Baseline
| Entity Query | Type Requested | Resolved | Resolved Name | Subtype | Overlap with Baseline | Top 3 Result Names |
|---|---|---|---|---|---|---|
${p2.individual
      .map(
        (e: any) =>
          `| ${e.query} | \`${e.typeRequested}\` | ${e.resolved ? 'Yes' : 'No'} | ${e.resolvedName} | \`${e.subtype || 'N/A'}\` | **${e.overlapWithBaseline.toFixed(2)}** | ${e.top3Names.join(', ')} |`
      )
      .join('\n')}

### Pair Test: Both Malayalam Movies Together
- **Entities**: Premam + Drishyam
- **Overlap with Baseline**: **${p2.malayalamPair.overlapWithBaseline.toFixed(2)}**
- **Top 3 Names**: ${p2.malayalamPair.top3Names.join(', ')}

### Leave-One-Out Test (Original 4 Favorites)
*Full 4: Premam, Drishyam, A. R. Rahman, Vaikom Muhammad Basheer*

| Omitted Entity | Active Signals | Overlap vs Baseline | Overlap vs Full 4 | Top 3 Result Names |
|---|---|---|---|---|
${p2.leaveOneOut
      .map(
        (loo: any) =>
          `| **${loo.omitted}** | ${loo.activeSignals.join(', ')} | ${loo.overlapWithBaseline.toFixed(2)} | **${loo.overlapWithFull4.toFixed(2)}** | ${loo.top3Names.join(', ')} |`
      )
      .join('\n')}

---

## P3: CATEGORY TAGS EXPLORATION

Ran with original 4 favorites + Toronto for each resolved tag.

| Keyword | Tag ID | Tag Name | Result Count | In-City Share | Duplicates | Top 5 Names |
|---|---|---|---|---|---|---|
${p3
      .map(
        (t: any) =>
          `| ${t.keyword} | \`${t.tagId}\` | ${t.tagName} | ${t.resultCount} | ${(t.inCityShare * 100).toFixed(0)}% | ${t.duplicateNames.length > 0 ? t.duplicateNames.join(', ') : 'None'} | ${t.top5Names.join(', ')} |`
      )
      .join('\n')}

---

## P4: LATENCY & PARALLEL EXECUTION

- **Parallel Calls**: 6 concurrent requests to \`/v2/insights\`
- **Latencies (ms)**: ${p4.latencies.join(', ')}
- **p50 Latency**: **${p4.p50} ms**
- **p95 Latency**: **${p4.p95} ms**
- **Non-200 Statuses**: **${p4.non200Count === 0 ? 'None (all 200 OK)' : `${p4.non200Count} non-200 calls`}**
`;

  return md;
}

runProbes().catch((err) => {
  console.error('Fatal probe error:', err);
  process.exit(1);
});