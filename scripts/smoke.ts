/**
 * Smoke test script for Taste Passport
 * Usage: npx tsx scripts/smoke.ts [baseUrl]
 * Example: npx tsx scripts/smoke.ts http://localhost:3000
 */

const rawUrl = process.argv[2];
if (!rawUrl || !rawUrl.trim()) {
  console.error('====================================================');
  console.error('ERROR: Missing required <baseUrl> argument.');
  console.error('Usage: npm run smoke -- <baseUrl>');
  console.error('Example: npm run smoke -- http://localhost:3000');
  console.error('====================================================');
  process.exit(1);
}

const baseUrl = rawUrl.trim().replace(/\/+$/, '');

const PROFILE_1_FAVORITES = [
  { name: 'Premam', type: 'movie' },
  { name: 'Drishyam', type: 'movie' },
  { name: 'A. R. Rahman', type: 'artist' },
  { name: 'K. S. Chithra', type: 'artist' },
  { name: 'Vaikom Muhammad Basheer', type: 'person' },
];

async function runSmokeTest() {
  console.log('====================================================');
  console.log(`TASTE PASSPORT SMOKE TEST`);
  console.log(`TARGET BASE URL: ${baseUrl}`);
  console.log('====================================================\n');

  const startTime = Date.now();

  // 1. GET /api/health
  console.log('1. Testing GET /api/health...');
  const healthRes = await fetch(`${baseUrl}/api/health`);
  if (!healthRes.ok) {
    throw new Error(`Health check failed with status ${healthRes.status}: ${await healthRes.text()}`);
  }
  const healthData = await healthRes.json();
  console.log(`   ✓ /api/health returned 200 OK:`, healthData);

  // 2. POST /api/resolve
  console.log('\n2. Testing POST /api/resolve (Profile 1)...');
  const resolveStart = Date.now();
  const resolveRes = await fetch(`${baseUrl}/api/resolve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ favorites: PROFILE_1_FAVORITES }),
  });
  if (!resolveRes.ok) {
    throw new Error(`Resolve failed with status ${resolveRes.status}: ${await resolveRes.text()}`);
  }
  const resolveData = await resolveRes.json();
  const resolvedCount = resolveData.results?.filter((r: any) => r.candidates?.length > 0).length || 0;
  console.log(`   ✓ /api/resolve returned 200 in ${Date.now() - resolveStart}ms (${resolvedCount}/${PROFILE_1_FAVORITES.length} favorites resolved)`);

  // Build resolved favorites payload
  const resolvedFavorites = PROFILE_1_FAVORITES.map((fav, idx) => {
    const r = resolveData.results[idx];
    const topCand = r?.candidates?.[0];
    return {
      name: fav.name,
      type: fav.type,
      entityId: topCand?.entityId,
    };
  });

  // 3. POST /api/passport (Streamed)
  console.log('\n3. Testing POST /api/passport (Streamed pipeline)...');
  const passportStart = Date.now();
  const passportRes = await fetch(`${baseUrl}/api/passport`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      destination: 'Toronto',
      favorites: resolvedFavorites,
    }),
  });

  if (!passportRes.ok) {
    throw new Error(`Passport stream failed with status ${passportRes.status}: ${await passportRes.text()}`);
  }
  if (!passportRes.body) {
    throw new Error('Passport response missing stream body');
  }

  const reader = passportRes.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let finalResult: any = null;
  let streamError: string | null = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const ev = JSON.parse(line);
        const elapsed = Date.now() - passportStart;
        if (ev.type === 'progress') {
          console.log(`   [+${(elapsed / 1000).toFixed(2)}s] ${ev.stage.toUpperCase()}: ${ev.message}`);
        } else if (ev.type === 'result') {
          finalResult = ev.data;
          console.log(`   [+${(elapsed / 1000).toFixed(2)}s] RESULT RECEIVED!`);
        } else if (ev.type === 'error') {
          streamError = ev.error;
          console.error(`   [+${(elapsed / 1000).toFixed(2)}s] STREAM ERROR: ${ev.error}`);
        }
      } catch (err: any) {
        console.warn(`   Could not parse stream line: "${line}"`);
      }
    }
  }

  if (streamError) {
    throw new Error(`Stream terminated with error: ${streamError}`);
  }
  if (!finalResult) {
    throw new Error('Stream finished without returning final result');
  }

  const totalTime = Date.now() - startTime;
  const totalPlaces = finalResult.categories.reduce((sum: number, c: any) => sum + c.places.length, 0);

  console.log('\n====================================================');
  console.log('SMOKE TEST VERIFICATION RESULTS');
  console.log('====================================================');
  console.log(`Destination:          ${finalResult.destination}`);
  console.log(`Total Smoke Duration: ${totalTime}ms (Passport Stream: ${Date.now() - passportStart}ms)`);
  console.log(`Server Reported Time: ${finalResult.meta.ms}ms`);
  console.log(`Categories count:     ${finalResult.categories.length}`);
  console.log(`Total Places count:   ${totalPlaces}`);
  console.log(`Narration Mode:       ${finalResult.meta.narration}`);
  console.log(`Notice:               ${finalResult.meta.notice || '(none)'}`);
  console.log(`Grounding Violations: ${finalResult.meta.groundingViolations}`);
  console.log(`Blurbs vs Nulls:      ${finalResult.meta.blurbCount} with blurb, ${finalResult.meta.nullBlurbCount} null`);
  console.log(`Dropped Categories:   ${finalResult.meta.droppedCategories?.join(', ') || 'none'}`);
  console.log(`Categories:`);
  finalResult.categories.forEach((cat: any, i: number) => {
    console.log(`  ${i + 1}. ${cat.title} [${cat.kindLabel}] - ${cat.places.length} places (Badge: "${cat.badge}")`);
  });
  console.log('====================================================');

  if (finalResult.categories.length === 0) {
    throw new Error('Smoke test failed: 0 categories returned');
  }
  if (totalPlaces === 0) {
    throw new Error('Smoke test failed: 0 places returned');
  }

  console.log('\n✓ SMOKE TEST SUCCEEDED: All endpoints and SSE stream verified end-to-end!\n');
}

runSmokeTest().catch((err) => {
  console.error('\n❌ Smoke Test Failed:', err.message);
  process.exit(1);
});

