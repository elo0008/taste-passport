import fs from 'fs';
import path from 'path';
import { runPassportPipeline } from '../src/lib/pipeline';

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

async function testTaskC() {
  console.log('====================================================');
  console.log('TASK C: NOISY-SIGNAL SELF-CORRECTION BENCHMARK');
  console.log('====================================================\n');

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

  const profile2 = {
    destination: 'London',
    favorites: [
      { name: 'Diljit Dosanjh', type: 'artist' as const },
      { name: 'Sholay', type: 'movie' as const },
      { name: 'Sidhu Moose Wala', type: 'artist' as const },
      { name: 'Jab We Met', type: 'movie' as const },
    ],
  };

  // Run 3 iterations for Profile 1 to compute median latency
  const p1Runs = [];
  for (let i = 1; i <= 3; i++) {
    console.log(`Running Profile 1 iteration ${i}...`);
    const res = await runPassportPipeline(profile1, {
      ip: `task-c-p1-${i}`,
      bypassRateLimit: true,
      forceRefresh: true,
    });
    p1Runs.push(res);
  }

  console.log('\nRunning Profile 2 (all consistent, should NOT trigger rerun)...');
  const resP2 = await runPassportPipeline(profile2, {
    ip: `task-c-p2`,
    bypassRateLimit: true,
    forceRefresh: true,
  });

  console.log('\n====================================================');
  console.log('TASK C MEASUREMENT RESULTS');
  console.log('====================================================');

  const p1 = p1Runs[0];
  console.log(`Profile 1 Notice: "${p1.meta.notice || '(none)'}"`);
  console.log(`Profile 1 Total Qloo Calls: ${p1.meta.qlooCalls}`);
  console.log(`Profile 1 Categories count: ${p1.categories.length}`);
  p1.categories.forEach((c) => {
    console.log(`  • ${c.title}: cSig=${c.cSig}, cBase=${c.cBase}, lift=${(c.rawTasteLift * 100).toFixed(0)}%, places=${c.places.length}`);
  });

  const latencies = p1Runs.map((r) => r.meta.ms);
  latencies.sort((a, b) => a - b);
  const medianLatency = latencies[1];
  console.log(`Profile 1 Latencies: [${latencies.join(', ')}] ms -> Median: ${medianLatency} ms`);
  console.log(`Profile 1 Timings breakdown:`, p1.meta.timings);

  console.log(`\nProfile 1 Signal Check Items count: ${p1.signalCheck.length}`);
  p1.signalCheck.forEach((s) => {
    console.log(`  • ${s.favoriteName}: isConsistent=${s.isConsistent} | "${s.summary}"`);
  });

  console.log(`\nProfile 2 Notice (Should be none): "${resP2.meta.notice || '(none)'}"`);
  console.log(`Profile 2 Qloo Calls: ${resP2.meta.qlooCalls}`);

  return {
    p1Notice: p1.meta.notice,
    p1QlooCalls: p1.meta.qlooCalls,
    p1MedianLatency: medianLatency,
    p1Categories: p1.categories,
    p2Notice: resP2.meta.notice,
  };
}

testTaskC().catch((err) => {
  console.error('Task C test error:', err);
  process.exit(1);
});
