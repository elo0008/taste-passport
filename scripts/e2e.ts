import fs from 'fs';
import path from 'path';
import { runPassportPipeline, PipelineProgressEvent } from '../src/lib/pipeline';
import { BANNED_WORDS } from '../src/lib/grounding';

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

function assertNoBannedWordsOrFavoriteNames(res: any) {
  const favNames = res.resolved.map((r: any) => r.resolvedName);

  // Check firstMonth
  for (const fav of favNames) {
    const reg = new RegExp(`(^|\\W)${fav}(\\W|$)`, 'i');
    if (reg.test(res.firstMonth)) {
      throw new Error(`Assertion failed: firstMonth contains favorite name "${fav}"`);
    }
  }
  for (const bw of BANNED_WORDS) {
    const reg = new RegExp(`(^|\\W)${bw}(\\W|$)`, 'i');
    if (reg.test(res.firstMonth)) {
      throw new Error(`Assertion failed: firstMonth contains banned word "${bw}"`);
    }
  }

  // Check intros and blurbs
  for (const cat of res.categories) {
    for (const fav of favNames) {
      const reg = new RegExp(`(^|\\W)${fav}(\\W|$)`, 'i');
      if (reg.test(cat.intro)) {
        throw new Error(`Assertion failed: intro contains favorite name "${fav}" in category ${cat.title}`);
      }
      for (const p of cat.places) {
        if (p.blurb && reg.test(p.blurb)) {
          throw new Error(`Assertion failed: blurb contains favorite name "${fav}" in place ${p.name}`);
        }
      }
    }

    for (const bw of BANNED_WORDS) {
      const reg = new RegExp(`(^|\\W)${bw}(\\W|$)`, 'i');
      if (reg.test(cat.intro)) {
        throw new Error(`Assertion failed: intro contains banned word "${bw}" in category ${cat.title}`);
      }
      for (const p of cat.places) {
        if (p.blurb && reg.test(p.blurb)) {
          throw new Error(`Assertion failed: blurb contains banned word "${bw}" in place ${p.name}`);
        }
      }
    }
  }
}

function printProfileSummary(profileTitle: string, res: any) {
  console.log(`\n====================================================`);
  console.log(`${profileTitle.toUpperCase()} SUMMARY`);
  console.log(`====================================================`);
  console.log(`Destination: ${res.destination} area`);
  console.log(`Categories count: ${res.categories.length}`);
  console.log(`Blurbs vs Null count: ${res.meta.blurbCount} places with blurb, ${res.meta.nullBlurbCount} places with null`);
  console.log(`Narration mode: ${res.meta.narration}`);
  if (res.meta.notice) console.log(`Notice: "${res.meta.notice}"`);

  for (const cat of res.categories) {
    console.log(`\nCategory: "${cat.title}" [${cat.kindLabel}]`);
    console.log(`  Tag ID: ${cat.tagId}`);
    console.log(`  Enrichment: ${cat.enrichment.toFixed(1)}x (cSig=${cat.cSig}, cBase=${cat.cBase})`);
    console.log(`  Raw Taste Lift: ${(cat.rawTasteLift * 100).toFixed(0)}% (${cat.rawLiftCount} of top 10 wouldn't appear without taste)`);
    console.log(`  Primary Badge: "${cat.badge}"`);
    console.log(`  Secondary Badge: "${cat.tasteLiftBadge}"`);
    console.log(`  Place Count: ${cat.places.length}`);
    console.log(`  Intro: "${cat.intro}"`);
    console.log(`  First 3 Places:`);
    cat.places.slice(0, 3).forEach((p: any, idx: number) => {
      console.log(`    ${idx + 1}. ${p.name} (${p.address || 'Metro area'})`);
      console.log(`       Rating: ${p.rating ? '★ ' + p.rating : 'N/A'} | Dishes: ${p.dishes.length > 0 ? p.dishes.join(', ') : 'None'}`);
      console.log(`       Blurb: ${p.blurb ? `"${p.blurb}"` : 'null (no dishes/desc)'}`);
    });
  }

  console.log('\n--- Signal Check Table (Qloo Taste Attribution) ---');
  res.signalCheck.forEach((s: any) => {
    console.log(`  • ${s.summary}`);
  });

  if (res.tasteVsBaseline) {
    console.log('\n--- Taste vs Baseline Comparison (Task B) ---');
    console.log(`Destination: ${res.tasteVsBaseline.destination}`);
    console.log(
      'Baseline Top 5 Cuisines (No Signal):',
      res.tasteVsBaseline.baselineTop.map((t: any) => `${t.tagName} (${t.count})`).join(', ')
    );
    console.log(
      'Taste Top 5 Cuisines (Final Signal):',
      res.tasteVsBaseline.tasteTop.map((t: any) => `${t.tagName} (${t.count})`).join(', ')
    );
  }

  console.log('\n--- Settling Plan Preview ---');
  console.log(res.firstMonth);

  console.log('\n--- Metadata & Timings ---');
  console.log(`- Qloo calls: ${res.meta.qlooCalls}`);
  console.log(`- LLM calls: ${res.meta.llmCalls}`);
  console.log(`- Execution duration: ${res.meta.ms} ms`);
  console.log(`- Grounding violations: ${res.meta.groundingViolations}`);
  console.log(`- Repair attempts: ${res.meta.repairAttempts}`);
  console.log(`- Narration: ${res.meta.narration}`);
  console.log(`- Timings breakdown:`, res.meta.timings);
}

async function runE2E() {
  console.log('====================================================');
  console.log('TASTE PASSPORT: END-TO-END PIPELINE VERIFICATION (PHASE 6)');
  console.log('====================================================\n');

  // ----------------------------------------------------
  // PROFILE 1: Kerala Favorites -> Toronto
  // ----------------------------------------------------
  console.log('>>> 1. Running Profile 1: Kerala Favorites -> Toronto <<<');
  const streamEvents: PipelineProgressEvent[] = [];

  const profile1 = {
    destination: 'Toronto',
    favorites: [
      { name: 'Premam', type: 'movie' as const },
      { name: 'Drishyam', type: 'movie' as const },
      { name: 'A. R. Rahman', type: 'artist' as const },
      { name: 'K. S. Chithra', type: 'artist' as const },
      { name: 'Vaikom Muhammad Basheer', type: 'person' as const },
    ],
  };

  const res1 = await runPassportPipeline(profile1, {
    ip: 'e2e-p1-tester',
    bypassRateLimit: true,
    forceRefresh: true,
    onProgress: (ev) => {
      streamEvents.push(ev);
      console.log(`[STREAM EVENT] stage: "${ev.stage}" | ${ev.message}`);
    },
  });

  printProfileSummary('Profile 1 (Kerala -> Toronto)', res1);

  // Assertions for Profile 1
  if (res1.categories.length < 2) throw new Error(`Assertion failed: P1 categories < 2 (got ${res1.categories.length})`);
  for (const cat of res1.categories) {
    const minPlaces = cat.kind === 'grocery' ? 3 : 4;
    if (cat.places.length < minPlaces) {
      throw new Error(`Assertion failed: P1 category "${cat.title}" has < ${minPlaces} places (${cat.places.length})`);
    }
    if (cat.kind !== 'grocery' && !cat.badge.includes("of Qloo's top 50 places for your taste are tagged")) {
      throw new Error(`Assertion failed: P1 category "${cat.title}" badge does not match counts format: "${cat.badge}"`);
    }
  }
  const p1PlaceIds = new Set<string>();
  for (const cat of res1.categories) {
    for (const p of cat.places) {
      if (p1PlaceIds.has(p.id)) throw new Error(`Assertion failed: P1 place duplicate "${p.name}"`);
      p1PlaceIds.add(p.id);
    }
  }
  if (res1.meta.groundingViolations !== 0) throw new Error(`Assertion failed: P1 groundingViolations !== 0`);
  assertNoBannedWordsOrFavoriteNames(res1);
  console.log('\n✓ Profile 1 assertions PASSED (categories valid, places >= 4, counts badges, no duplicates, violations == 0)');

  // ----------------------------------------------------
  // PROFILE 2: Punjabi/Bollywood Favorites -> London
  // ----------------------------------------------------
  console.log('\n>>> 2. Running Profile 2: Punjabi/Bollywood Favorites -> London <<<');
  const profile2 = {
    destination: 'London',
    favorites: [
      { name: 'Diljit Dosanjh', type: 'artist' as const },
      { name: 'Sholay', type: 'movie' as const },
      { name: 'Sidhu Moose Wala', type: 'artist' as const },
      { name: 'Jab We Met', type: 'movie' as const },
    ],
  };

  const res2 = await runPassportPipeline(profile2, {
    ip: 'e2e-p2-tester',
    bypassRateLimit: true,
    forceRefresh: true,
  });

  printProfileSummary('Profile 2 (Punjabi -> London)', res2);

  // Assertions for Profile 2
  if (res2.categories.length < 2) throw new Error(`Assertion failed: P2 categories < 2 (got ${res2.categories.length})`);
  for (const cat of res2.categories) {
    const minPlaces = cat.kind === 'grocery' ? 3 : 4;
    if (cat.places.length < minPlaces) {
      throw new Error(`Assertion failed: P2 category "${cat.title}" has < ${minPlaces} places (${cat.places.length})`);
    }
    if (cat.kind !== 'grocery' && !cat.badge.includes("of Qloo's top 50 places for your taste are tagged")) {
      throw new Error(`Assertion failed: P2 category "${cat.title}" badge does not match counts format: "${cat.badge}"`);
    }
  }
  const p2PlaceIds = new Set<string>();
  for (const cat of res2.categories) {
    for (const p of cat.places) {
      if (p2PlaceIds.has(p.id)) throw new Error(`Assertion failed: P2 place duplicate "${p.name}"`);
      p2PlaceIds.add(p.id);
    }
  }
  if (res2.meta.groundingViolations !== 0) throw new Error(`Assertion failed: P2 groundingViolations !== 0`);
  assertNoBannedWordsOrFavoriteNames(res2);

  // Assertion: Profile 1 and Profile 2 category sets differ
  const p1Titles = res1.categories.map((c: any) => c.title.toLowerCase());
  const p2Titles = res2.categories.map((c: any) => c.title.toLowerCase());
  const setsAreIdentical = p1Titles.length === p2Titles.length && p1Titles.every((t: string) => p2Titles.includes(t));
  if (setsAreIdentical) {
    throw new Error(`Assertion failed: Profile 1 and Profile 2 category sets must differ!`);
  }
  console.log('\n✓ Profile 2 assertions PASSED (P1 & P2 category sets differ, no duplicates, no banned words/favorite names)');

  // ----------------------------------------------------
  // CONTROL PROFILE: Indie/Western -> Toronto
  // ----------------------------------------------------
  console.log('\n>>> 3. Running Control Profile: Indie/Western Favorites -> Toronto <<<');
  const controlProfile = {
    destination: 'Toronto',
    favorites: [
      { name: 'Radiohead', type: 'artist' as const },
      { name: 'Inception', type: 'movie' as const },
      { name: 'Breaking Bad', type: 'tv_show' as const },
      { name: 'Fleabag', type: 'tv_show' as const },
    ],
  };

  const resCtrl = await runPassportPipeline(controlProfile, {
    ip: 'e2e-ctrl-tester',
    bypassRateLimit: true,
    forceRefresh: true,
  });

  printProfileSummary('Control Profile (Indie -> Toronto)', resCtrl);
  assertNoBannedWordsOrFavoriteNames(resCtrl);
  console.log('\n✓ Control Profile assertions PASSED (sanity check complete, valid Qloo taste intelligence)');

  // ----------------------------------------------------
  // PROVE GRACEFUL DEGRADATION: Invalid Gemini API Key
  // ----------------------------------------------------
  console.log('\n>>> 4. Testing Graceful Degradation (Invalid GEMINI_API_KEY) <<<');
  const originalGeminiKey = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = 'INVALID_SYNTHETIC_GEMINI_KEY_OVERRIDE_TEST';

  try {
    const resDegraded = await runPassportPipeline(profile1, {
      ip: 'e2e-degrade-tester',
      bypassRateLimit: true,
      forceRefresh: true,
    });

    console.log('\n--- Graceful Degradation Results ---');
    console.log(`Narration: ${resDegraded.meta.narration}`);
    console.log(`UI Notice Text: "${resDegraded.meta.notice}"`);
    console.log(`LLM Calls: ${resDegraded.meta.llmCalls}`);
    console.log(`Categories count: ${resDegraded.categories.length}`);
    console.log(`Grounding violations: ${resDegraded.meta.groundingViolations}`);

    if (resDegraded.meta.narration !== 'template') {
      throw new Error(`Assertion failed: expected narration to be 'template', got '${resDegraded.meta.narration}'`);
    }
    if (!resDegraded.meta.notice?.includes('AI descriptions unavailable right now')) {
      throw new Error(`Assertion failed: expected degradation notice text`);
    }
    if (resDegraded.meta.groundingViolations !== 0) {
      throw new Error(`Assertion failed: expected 0 grounding violations in template fallback`);
    }
    console.log('✓ Graceful degradation verified successfully! Pipeline completes with template descriptions when Gemini fails.');
  } finally {
    process.env.GEMINI_API_KEY = originalGeminiKey;
  }

  console.log('\n====================================================');
  console.log('ALL PHASE 4 E2E VERIFICATION ASSERTIONS PASSED!');
  console.log('====================================================\n');
}

runE2E().catch((err) => {
  console.error('\nE2E Execution Error:', err);
  process.exit(1);
});
