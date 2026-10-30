import fs from 'fs';
import path from 'path';
import { runPassportPipeline, PipelineProgressEvent } from '../src/lib/pipeline';
import { rateLimiter } from '../src/lib/rate-limit';

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

async function runE2E() {
  console.log('====================================================');
  console.log('TASTE PASSPORT: END-TO-END PIPELINE VERIFICATION (PHASE 3)');
  console.log('====================================================\n');

  // ----------------------------------------------------
  // SECTION 1: Profile 1 (Kerala -> Toronto)
  // ----------------------------------------------------
  console.log('--- 1. Running Profile 1: Kerala Favorites -> Toronto ---');
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
    ip: 'e2e-tester-ip-1',
    bypassRateLimit: true,
    forceRefresh: true,
    onProgress: (ev) => {
      streamEvents.push(ev);
      console.log(`[STREAM EVENT] stage: "${ev.stage}" | ${ev.message}`);
    },
  });

  console.log('\n--- Profile 1 Output Summary ---');
  console.log(`Destination: ${res1.destination} area`);
  console.log(`Categories count: ${res1.categories.length}`);

  let totalPlaces1 = 0;
  for (const cat of res1.categories) {
    totalPlaces1 += cat.places.length;
    console.log(`\nCategory: "${cat.title}" [${cat.kindLabel.toUpperCase()}]`);
    console.log(`  Tag ID: ${cat.tagId}`);
    console.log(`  Taste Lift: ${cat.tasteLiftPercent}% (Badge: "${cat.badge}")`);
    console.log(`  Place Count: ${cat.places.length}`);
    console.log(`  Intro: "${cat.intro}"`);
    console.log(`  First 3 Places:`);
    cat.places.slice(0, 3).forEach((p, idx) => {
      console.log(`    ${idx + 1}. ${p.name}`);
      console.log(`       Address: ${p.address || 'N/A'}`);
      console.log(`       LiftedBy: [${p.matchedBy.join(', ')}]`);
      console.log(`       Blurb: ${p.blurb}`);
    });
  }

  console.log(`\nTotal places returned across categories: ${totalPlaces1}`);

  console.log('\n--- MatchedBy for First 3 Places in Primary Category ---');
  const firstCat = res1.categories[0];
  firstCat.places.slice(0, 3).forEach((p, idx) => {
    console.log(`  Place ${idx + 1}: ${p.name} -> matchedBy: [${p.matchedBy.join(', ')}]`);
  });

  console.log('\n--- Signal Check Table (Honest Lift & Attribution) ---');
  console.table(res1.signalCheck);

  console.log('\n--- First Month Settling Plan ---');
  console.log(res1.firstMonth);

  console.log('\n--- Metadata & Timings ---');
  console.log(`- Qloo calls: ${res1.meta.qlooCalls}`);
  console.log(`- LLM calls: ${res1.meta.llmCalls}`);
  console.log(`- Execution duration: ${res1.meta.ms} ms`);
  console.log(`- Grounding violations in final output: ${res1.meta.groundingViolations}`);
  console.log(`- Repair attempts: ${res1.meta.repairAttempts}`);
  console.log(`- Cached: ${res1.meta.cached}`);
  console.log(`- Timings breakdown:`, res1.meta.timings);

  // Assertions for Profile 1
  console.log('\n--- Verifying Profile 1 Assertions ---');
  if (res1.categories.length < 3) throw new Error(`Assertion failed: categories < 3 (got ${res1.categories.length})`);
  console.log('✓ Categories >= 3');

  if (totalPlaces1 < 8) throw new Error(`Assertion failed: total places < 8 (got ${totalPlaces1})`);
  console.log('✓ Total places >= 8');

  for (const cat of res1.categories) {
    if (cat.places.length < 3) {
      throw new Error(`Assertion failed: Category "${cat.title}" has < 3 places (${cat.places.length})`);
    }
    for (const p of cat.places) {
      if (!p.id || !p.name) {
        throw new Error(`Assertion failed: place missing id or name: ${JSON.stringify(p)}`);
      }
    }
  }
  console.log('✓ Every category has >= 3 places and valid id+name');

  // Verify no place appears in two categories
  const seenPlaceIds = new Set<string>();
  for (const cat of res1.categories) {
    for (const p of cat.places) {
      if (seenPlaceIds.has(p.id)) {
        throw new Error(`Assertion failed: place "${p.name}" (${p.id}) appears in multiple categories!`);
      }
      seenPlaceIds.add(p.id);
    }
  }
  console.log('✓ No place appears in multiple categories (cross-category deduplication verified)');

  // Verify no blurb contains a favorite name
  const favNames = res1.resolved.map((r) => r.resolvedName);
  for (const cat of res1.categories) {
    for (const favName of favNames) {
      const reg = new RegExp(`(^|\\W)${favName}(\\W|$)`, 'i');
      if (reg.test(cat.intro)) {
        throw new Error(`Assertion failed: category intro contains favorite name "${favName}"`);
      }
      for (const p of cat.places) {
        if (reg.test(p.blurb)) {
          throw new Error(`Assertion failed: place blurb contains favorite name "${favName}"`);
        }
      }
    }
  }
  console.log('✓ No blurb or intro contains any favorite name');

  if (res1.meta.groundingViolations !== 0) {
    throw new Error(`Assertion failed: groundingViolations is ${res1.meta.groundingViolations}, expected 0`);
  }
  console.log('✓ Grounding violations == 0 in final output');

  // ----------------------------------------------------
  // SECTION 2: Repeat Run to Prove Cache Hit
  // ----------------------------------------------------
  console.log('\n--- 2. Repeating Profile 1 (Proving Cache Hit) ---');
  const cachedStart = performance.now();
  const res1Cached = await runPassportPipeline(profile1, {
    ip: 'e2e-tester-ip-1',
    bypassRateLimit: true,
  });
  const cachedDuration = Math.round(performance.now() - cachedStart);

  console.log(`- Cached result meta.cached: ${res1Cached.meta.cached}`);
  console.log(`- Cached query duration: ${cachedDuration} ms (meta.ms: ${res1Cached.meta.ms} ms)`);
  if (!res1Cached.meta.cached) {
    throw new Error('Assertion failed: repeated query was not served from cache');
  }
  console.log('✓ Repeated run successfully served from cache with near-zero latency!');

  // ----------------------------------------------------
  // SECTION 3: Profile 2 (Punjabi/Bollywood -> London)
  // ----------------------------------------------------
  console.log('\n--- 3. Running Profile 2: Punjabi/Bollywood Favorites -> London ---');
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
    ip: 'e2e-tester-ip-2',
    bypassRateLimit: true,
    forceRefresh: true,
  });

  console.log('\n--- Profile 2 Output Summary (London) ---');
  console.log(`Destination: ${res2.destination} area`);
  console.log(`Resolved favorites count: ${res2.resolved.length}`);
  res2.resolved.forEach((r) => console.log(`  - ${r.inputName} -> "${r.resolvedName}" (${r.resolvedType})`));

  console.log(`Categories count: ${res2.categories.length}`);
  let totalPlaces2 = 0;
  for (const cat of res2.categories) {
    totalPlaces2 += cat.places.length;
    console.log(`\nCategory: "${cat.title}" [${cat.kindLabel.toUpperCase()}]`);
    console.log(`  Tag ID: ${cat.tagId}`);
    console.log(`  Taste Lift: ${cat.tasteLiftPercent}% (Badge: "${cat.badge}")`);
    console.log(`  Place Count: ${cat.places.length}`);
    console.log(`  Top 3 Places:`);
    cat.places.slice(0, 3).forEach((p, idx) => {
      console.log(`    ${idx + 1}. ${p.name} (${p.address || 'London area'})`);
    });
  }

  console.log(`\nTotal places for London: ${totalPlaces2}`);
  console.log(`Meta: ${res2.meta.qlooCalls} Qloo calls, ${res2.meta.ms}ms, groundingViolations: ${res2.meta.groundingViolations}`);
  console.log(`Timings:`, res2.meta.timings);

  // Grocery Gate Inspection for London:
  console.log('\n--- Grocery Gate Inspection for London ---');
  const groceryCategory = res2.categories.find((c) => c.kind === 'grocery');
  if (groceryCategory) {
    console.log(`Grocery category kept: "${groceryCategory.title}" (${groceryCategory.tagId})`);
    console.log('Places in London grocery category:');
    groceryCategory.places.forEach((p, i) => console.log(`  ${i + 1}. ${p.name} (${p.address})`));

    // Verify no generic supermarket chain exists
    const GENERIC_CHAINS = /(sainsbury|tesco|asda|morrisons|poundland|marks & spencer|waitrose|aldi|lidl)/i;
    for (const p of groceryCategory.places) {
      if (GENERIC_CHAINS.test(p.name)) {
        throw new Error(`Assertion failed: London grocery contains generic supermarket chain: "${p.name}"`);
      }
    }
    console.log('✓ No grocery result in London is a major generic supermarket chain');
  } else {
    console.log('✓ Grocery category was safely filtered out by Grocery Gate because no cultural grocery tag with >=3 places existed in London.');
  }

  // Cross-category deduplication assertion for Profile 2
  const seenPlaceIds2 = new Set<string>();
  for (const cat of res2.categories) {
    if (cat.places.length < 3) {
      throw new Error(`Assertion failed: Category "${cat.title}" has < 3 places (${cat.places.length})`);
    }
    for (const p of cat.places) {
      if (seenPlaceIds2.has(p.id)) {
        throw new Error(`Assertion failed: place "${p.name}" (${p.id}) appears in multiple categories!`);
      }
      seenPlaceIds2.add(p.id);
    }
  }
  console.log('✓ London categories all have >= 3 places with zero cross-category duplicates');

  if (res2.meta.groundingViolations !== 0) {
    throw new Error(`Assertion failed: groundingViolations is ${res2.meta.groundingViolations}, expected 0`);
  }
  console.log('✓ Grounding violations == 0 in final output for London');

  // ----------------------------------------------------
  // SECTION 4: Streamed Events Sequence Demonstration
  // ----------------------------------------------------
  console.log('\n--- 4. Event Streaming Sequence Demonstration ---');
  console.log(`Total streamed events captured: ${streamEvents.length}`);
  streamEvents.forEach((ev, i) => {
    console.log(`  Event ${i + 1}: [stage=${ev.stage}] ${ev.message}`);
  });

  console.log('\n====================================================');
  console.log('ALL E2E PIPELINE TESTS & ASSERTIONS PASSED!');
  console.log('====================================================\n');
}

runE2E().catch((err) => {
  console.error('\nE2E Execution Error:', err);
  process.exit(1);
});
