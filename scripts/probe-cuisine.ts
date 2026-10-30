import fs from 'fs';
import path from 'path';
import { QlooClient } from '../src/lib/qloo';

// Ensure .private directory exists
const privateDir = path.resolve(process.cwd(), '.private');
if (!fs.existsSync(privateDir)) {
  fs.mkdirSync(privateDir, { recursive: true });
}

// Ensure env vars
if (!process.env.QLOO_API_KEY) {
  // Try loading .env.local
  const envLocalPath = path.resolve(process.cwd(), '.env.local');
  if (fs.existsSync(envLocalPath)) {
    const lines = fs.readFileSync(envLocalPath, 'utf-8').split('\n');
    for (const line of lines) {
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
      if (match) {
        const key = match[1];
        let val = match[2] || '';
        val = val.trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        process.env[key] = val;
      }
    }
  }
}

const qloo = new QlooClient();

function extractPlaces(insightsResponse: any): any[] {
  if (!insightsResponse) return [];
  if (Array.isArray(insightsResponse)) return insightsResponse;
  if (Array.isArray(insightsResponse.results?.entities)) return insightsResponse.results.entities;
  if (Array.isArray(insightsResponse.results)) return insightsResponse.results;
  if (Array.isArray(insightsResponse.entities)) return insightsResponse.entities;
  return [];
}

async function run() {
  console.log('========================================================');
  console.log('TASK A (GATE): CUISINE-INFERENCE PROBE');
  console.log('========================================================\n');

  // STEP 1: Find largest working `take` (try 10, 20, 50, 100)
  console.log('--- Step 1: Testing take parameter limits on /v2/insights ---');
  const takesToTest = [10, 20, 50, 100];
  let largestWorkingTake = 10;
  const takeResults: Record<number, { success: boolean; returnedCount: number; error?: string }> = {};

  for (const take of takesToTest) {
    try {
      const res = await qloo.insights({
        filterType: 'urn:entity:place',
        filterLocationQuery: 'Toronto',
        take,
      });
      const places = extractPlaces(res);
      takeResults[take] = { success: true, returnedCount: places.length };
      console.log(`take=${take} -> SUCCESS, returned ${places.length} places`);
      if (places.length > 0) {
        largestWorkingTake = take;
      }
    } catch (err: any) {
      takeResults[take] = { success: false, returnedCount: 0, error: err.message };
      console.log(`take=${take} -> FAILED: ${err.message}`);
    }
  }
  console.log(`Largest working take: ${largestWorkingTake}\n`);

  // Test offset if max <= 20
  let offsetWorking = false;
  if (largestWorkingTake <= 20) {
    console.log('Testing offset pagination...');
    try {
      const p1 = await qloo.insights({
        filterType: 'urn:entity:place',
        filterLocationQuery: 'Toronto',
        take: largestWorkingTake,
        offset: 0,
      });
      const p2 = await qloo.insights({
        filterType: 'urn:entity:place',
        filterLocationQuery: 'Toronto',
        take: largestWorkingTake,
        offset: largestWorkingTake,
      });
      const places1 = extractPlaces(p1);
      const places2 = extractPlaces(p2);
      const ids1 = new Set(places1.map((p) => p.entity_id || p.id));
      const ids2 = new Set(places2.map((p) => p.entity_id || p.id));
      const overlap = [...ids1].filter((id) => ids2.has(id));
      if (places2.length > 0 && overlap.length === 0) {
        offsetWorking = true;
        console.log(`offset=${largestWorkingTake} works! (0 overlap with offset=0, page 2 count=${places2.length})`);
      } else {
        console.log(`offset does not reliably paginate (overlap: ${overlap.length}, p2 count: ${places2.length})`);
      }
    } catch (err: any) {
      console.log(`offset test failed: ${err.message}`);
    }
  }

  // STEP 2: Find a generic restaurant/dining tag via /v2/tags
  console.log('\n--- Step 2: Probing generic restaurant/dining tags ---');
  const tagKeywords = ['restaurant', 'dining', 'food'];
  const genericTagCandidates: any[] = [];
  for (const kw of tagKeywords) {
    try {
      const tags = await qloo.tags({ query: kw, take: 10 });
      for (const t of tags) {
        genericTagCandidates.push({ keyword: kw, id: t.id, name: t.name });
      }
    } catch (err: any) {
      console.log(`Failed querying tags for "${kw}": ${err.message}`);
    }
  }
  console.log('Candidate generic tags found:');
  for (const c of genericTagCandidates.slice(0, 10)) {
    console.log(`  - [${c.keyword}] id: ${c.id} | name: ${c.name}`);
  }

  // Check if any generic tag actually filters places in Toronto
  // Let's test candidates like urn:tag:category:place:restaurant or urn:tag:amenity:place:restaurant if any
  let broadTag: string | undefined = undefined;
  for (const cand of genericTagCandidates) {
    if (cand.id.includes('restaurant') || cand.id.includes('dining')) {
      try {
        const testRes = await qloo.insights({
          filterType: 'urn:entity:place',
          filterLocationQuery: 'Toronto',
          filterTags: cand.id,
          take: 5,
        });
        const pl = extractPlaces(testRes);
        if (pl.length > 0) {
          broadTag = cand.id;
          console.log(`Selected working broad tag: ${cand.id} (${cand.name}), returns ${pl.length} places`);
          break;
        }
      } catch {}
    }
  }

  // STEP 3: Resolve confirmed entities
  console.log('\n--- Step 3: Resolving confirmed entities ---');
  async function resolveEntity(name: string, typeHint?: string, yearHint?: number): Promise<string> {
    const results = await qloo.search({ query: name, types: typeHint, take: 5 });
    if (!results || results.length === 0) {
      throw new Error(`Failed to resolve entity: ${name}`);
    }
    // Filter by year if given
    let best = results[0];
    if (yearHint) {
      const matchYear = results.find((r) => {
        const y = (r.properties as any)?.release_year || (r.properties as any)?.year;
        return y === yearHint;
      });
      if (matchYear) best = matchYear;
    }
    console.log(`Resolved "${name}" -> "${best.name}" (${best.entity_id}) [subtype: ${best.subtype || 'none'}]`);
    return best.entity_id;
  }

  const p1Entities = {
    premam: await resolveEntity('Premam', 'urn:entity:movie', 2015),
    drishyam: await resolveEntity('Drishyam', 'urn:entity:movie', 2013),
    rahman: await resolveEntity('A. R. Rahman', 'urn:entity:artist'),
    chithra: await resolveEntity('K. S. Chithra', 'urn:entity:artist'),
    basheer: await resolveEntity('Vaikom Muhammad Basheer'),
  };

  const p2Entities = {
    diljit: await resolveEntity('Diljit Dosanjh', 'urn:entity:artist'),
    sholay: await resolveEntity('Sholay', 'urn:entity:movie'),
    sidhu: await resolveEntity('Sidhu Moose Wala', 'urn:entity:artist'),
    jabWeMet: await resolveEntity('Jab We Met', 'urn:entity:movie'),
  };

  const controlEntities = {
    radiohead: await resolveEntity('Radiohead', 'urn:entity:artist'),
    inception: await resolveEntity('Inception', 'urn:entity:movie'),
    breakingBad: await resolveEntity('Breaking Bad', 'urn:entity:tv_show'),
    fleabag: await resolveEntity('Fleabag', 'urn:entity:tv_show'),
  };

  // STEP 4: Run queries and cuisine enrichment
  // We will run queries both WITHOUT any tag, and WITH broadTag (if found), to compare.
  async function analyzeProfile(
    profileName: string,
    city: string,
    entityIds: Record<string, string>,
    tagToFilter?: string
  ) {
    console.log(`\n========================================================`);
    console.log(`Analyzing ${profileName} in ${city} (filter.tags=${tagToFilter || 'NONE'})...`);
    console.log(`========================================================`);

    const allEntityIds = Object.values(entityIds);

    // Combined query
    const combinedRes = await qloo.insights({
      filterType: 'urn:entity:place',
      signalEntities: allEntityIds,
      filterLocationQuery: city,
      filterTags: tagToFilter,
      take: largestWorkingTake,
    });
    const combinedPlaces = extractPlaces(combinedRes);

    // Baseline query (NO signals)
    const baseRes = await qloo.insights({
      filterType: 'urn:entity:place',
      filterLocationQuery: city,
      filterTags: tagToFilter,
      take: largestWorkingTake,
    });
    const basePlaces = extractPlaces(baseRes);

    // Single-signal queries
    const singleSignalResults: Record<string, any[]> = {};
    for (const [key, id] of Object.entries(entityIds)) {
      const sRes = await qloo.insights({
        filterType: 'urn:entity:place',
        signalEntities: [id],
        filterLocationQuery: city,
        filterTags: tagToFilter,
        take: largestWorkingTake,
      });
      singleSignalResults[key] = extractPlaces(sRes);
    }

    // Save raw responses to .private/
    const safeTagStr = tagToFilter ? tagToFilter.replace(/[^a-zA-Z0-9]/g, '_') : 'notag';
    const rawOutPath = path.join(privateDir, `probe_cuisine_${profileName}_${city}_${safeTagStr}.json`);
    fs.writeFileSync(
      rawOutPath,
      JSON.stringify(
        {
          profileName,
          city,
          tagToFilter,
          combinedCount: combinedPlaces.length,
          baseCount: basePlaces.length,
          combinedPlaces,
          basePlaces,
          singleSignalPlaces: singleSignalResults,
        },
        null,
        2
      )
    );
    console.log(`Wrote raw data to .private/${path.basename(rawOutPath)}`);

    // Helper to extract cuisine tags from a place
    function getCuisineTags(place: any): { id: string; name: string }[] {
      const tags = place.tags || [];
      const cuisineTags: { id: string; name: string }[] = [];
      for (const t of tags) {
        const id = t.id || '';
        if (id.startsWith('urn:tag:cuisine:') || id.startsWith('urn:tag:genre:place:restaurant:')) {
          cuisineTags.push({ id: t.id, name: t.name || t.id.split(':').pop() || t.id });
        }
      }
      return cuisineTags;
    }

    // Coverage: share of returned places carrying at least one cuisine tag
    let combinedCuisinePlaceCount = 0;
    for (const p of combinedPlaces) {
      if (getCuisineTags(p).length > 0) combinedCuisinePlaceCount++;
    }
    const coverage = combinedPlaces.length > 0 ? combinedCuisinePlaceCount / combinedPlaces.length : 0;

    // Count cSig(t) and cBase(t)
    const tagNames: Record<string, string> = {};
    const cSigMap: Record<string, number> = {};
    const cBaseMap: Record<string, number> = {};

    for (const p of combinedPlaces) {
      const seenInPlace = new Set<string>();
      for (const t of getCuisineTags(p)) {
        if (!seenInPlace.has(t.id)) {
          seenInPlace.add(t.id);
          tagNames[t.id] = t.name;
          cSigMap[t.id] = (cSigMap[t.id] || 0) + 1;
        }
      }
    }

    for (const p of basePlaces) {
      const seenInPlace = new Set<string>();
      for (const t of getCuisineTags(p)) {
        if (!seenInPlace.has(t.id)) {
          seenInPlace.add(t.id);
          tagNames[t.id] = t.name;
          cBaseMap[t.id] = (cBaseMap[t.id] || 0) + 1;
        }
      }
    }

    // Compute enrichment(t) = (cSig + 1) / (cBase + 1)
    const allTags = new Set([...Object.keys(cSigMap), ...Object.keys(cBaseMap)]);
    const enrichmentList: {
      id: string;
      name: string;
      cSig: number;
      cBase: number;
      enrichment: number;
    }[] = [];

    for (const id of allTags) {
      const cSig = cSigMap[id] || 0;
      const cBase = cBaseMap[id] || 0;
      const enrichment = (cSig + 1) / (cBase + 1);
      // "require cSig >= 3"
      if (cSig >= 3) {
        enrichmentList.push({
          id,
          name: tagNames[id] || id,
          cSig,
          cBase,
          enrichment,
        });
      }
    }

    // Sort by enrichment DESC, then cSig DESC
    enrichmentList.sort((a, b) => b.enrichment - a.enrichment || b.cSig - a.cSig);

    console.log(`Places returned: combined=${combinedPlaces.length}, baseline=${basePlaces.length}`);
    console.log(`Coverage (places with >=1 cuisine tag): ${(coverage * 100).toFixed(1)}% (${combinedCuisinePlaceCount}/${combinedPlaces.length})`);
    console.log(`Enriched cuisine tags with cSig >= 3: ${enrichmentList.length}`);
    console.log(`Top 5 enriched tags:`);
    enrichmentList.slice(0, 5).forEach((t, i) => {
      console.log(
        `  ${i + 1}. ${t.name} (${t.id}) | cSig=${t.cSig}, cBase=${t.cBase}, enrichment=${t.enrichment.toFixed(2)}x`
      );
    });

    return {
      profileName,
      coverage,
      combinedCount: combinedPlaces.length,
      baseCount: basePlaces.length,
      top5: enrichmentList.slice(0, 5),
      allEnriched: enrichmentList,
    };
  }

  // Run for WITHOUT TAG
  console.log('\n========================================================');
  console.log('RUNNING PROBE RUN 1: WITHOUT ANY FILTER TAG');
  console.log('========================================================');
  const resP1NoTag = await analyzeProfile('Profile_1_Kerala', 'Toronto', p1Entities, undefined);
  const resP2NoTag = await analyzeProfile('Profile_2_Punjabi', 'London', p2Entities, undefined);
  const resCtrlNoTag = await analyzeProfile('Control_Indie', 'Toronto', controlEntities, undefined);

  // If broadTag is present, run WITH broadTag
  let resP1Broad: any = null;
  let resP2Broad: any = null;
  if (broadTag) {
    console.log('\n========================================================');
    console.log(`RUNNING PROBE RUN 2: WITH BROAD FILTER TAG (${broadTag})`);
    console.log('========================================================');
    resP1Broad = await analyzeProfile('Profile_1_Kerala', 'Toronto', p1Entities, broadTag);
    resP2Broad = await analyzeProfile('Profile_2_Punjabi', 'London', p2Entities, broadTag);
  }

  // STEP 5: Evaluate PASS criteria
  function evaluateCriteria(p1: any, p2: any, runDesc: string) {
    console.log(`\n========================================================`);
    console.log(`PASS CRITERIA EVALUATION FOR: ${runDesc}`);
    console.log(`========================================================`);

    const top3P1 = p1.top5.slice(0, 3);
    const top3P2 = p2.top5.slice(0, 3);

    // a. Profile 1: at least one of the top 3 enriched tags is Kerala or South Indian, and a Pakistani tag is NOT ranked first.
    const p1HasKeralaOrSouth = top3P1.some(
      (t: any) =>
        t.id.toLowerCase().includes('kerala') ||
        t.name.toLowerCase().includes('kerala') ||
        t.id.toLowerCase().includes('south_indian') ||
        t.name.toLowerCase().includes('south indian')
    );
    const p1FirstIsPakistani =
      top3P1.length > 0 &&
      (top3P1[0].id.toLowerCase().includes('pakistani') || top3P1[0].name.toLowerCase().includes('pakistani'));
    const critA = p1HasKeralaOrSouth && !p1FirstIsPakistani;

    console.log(
      `Criterion 5a (Profile 1: top 3 has Kerala/South Indian, Pakistani not 1st): ${critA ? 'PASS' : 'FAIL'}`
    );
    console.log(`  Top 3 tags for P1: ${top3P1.map((t: any) => t.name).join(', ') || 'NONE'}`);
    console.log(`  Has Kerala or South Indian: ${p1HasKeralaOrSouth}, First is Pakistani: ${p1FirstIsPakistani}`);

    // b. Profile 2: at least one of the top 3 enriched tags is Punjabi or North Indian.
    const p2HasPunjabiOrNorth = top3P2.some(
      (t: any) =>
        t.id.toLowerCase().includes('punjabi') ||
        t.name.toLowerCase().includes('punjabi') ||
        t.id.toLowerCase().includes('north_indian') ||
        t.name.toLowerCase().includes('north indian')
    );
    const critB = p2HasPunjabiOrNorth;
    console.log(
      `Criterion 5b (Profile 2: top 3 has Punjabi or North Indian): ${critB ? 'PASS' : 'FAIL'}`
    );
    console.log(`  Top 3 tags for P2: ${top3P2.map((t: any) => t.name).join(', ') || 'NONE'}`);
    console.log(`  Has Punjabi or North Indian: ${p2HasPunjabiOrNorth}`);

    // c. The top-3 tag sets of Profile 1 and Profile 2 differ.
    const p1TagIds = new Set(top3P1.map((t: any) => t.id));
    const p2TagIds = new Set(top3P2.map((t: any) => t.id));
    const identical = p1TagIds.size === p2TagIds.size && [...p1TagIds].every((id) => p2TagIds.has(id));
    const critC = !identical && top3P1.length > 0 && top3P2.length > 0;
    console.log(
      `Criterion 5c (Top-3 tag sets differ): ${critC ? 'PASS' : 'FAIL'}`
    );

    // d. Coverage >= 60% for both profiles.
    const critD = p1.coverage >= 0.6 && p2.coverage >= 0.6;
    console.log(
      `Criterion 5d (Coverage >= 60% for both): ${critD ? 'PASS' : 'FAIL'}`
    );
    console.log(`  P1 Coverage: ${(p1.coverage * 100).toFixed(1)}%, P2 Coverage: ${(p2.coverage * 100).toFixed(1)}%`);

    const overallPass = critA && critB && critC && critD;
    console.log(`\nOVERALL RESULT FOR ${runDesc}: ${overallPass ? '>>> PASS <<<' : '>>> FAIL <<<'}`);
    return overallPass;
  }

  evaluateCriteria(resP1NoTag, resP2NoTag, 'WITHOUT ANY TAG');
  if (resP1Broad && resP2Broad) {
    evaluateCriteria(resP1Broad, resP2Broad, `WITH BROAD TAG (${broadTag})`);
  }
}

run().catch((err) => {
  console.error('Fatal probe error:', err);
  process.exit(1);
});
