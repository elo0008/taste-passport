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

async function runComparison() {
  const p1 = {
    destination: 'Toronto',
    favorites: [
      { name: 'Premam', type: 'movie' as const },
      { name: 'Drishyam', type: 'movie' as const },
      { name: 'A. R. Rahman', type: 'artist' as const },
      { name: 'K. S. Chithra', type: 'artist' as const },
      { name: 'Vaikom Muhammad Basheer', type: 'person' as const },
    ],
  };

  // We test with LLM disabled to isolate Qloo discovery & inference time!
  process.env.LLM_DISABLED = 'true';
  const t0 = performance.now();
  const res = await runPassportPipeline(p1, { ip: 'test-isolate', bypassRateLimit: true, forceRefresh: true });
  const total = Math.round(performance.now() - t0);

  console.log('Qloo pipeline alone (Task C active):');
  console.log(`Total duration: ${total}ms`);
  console.log(`Timings:`, res.meta.timings);
  console.log(`Qloo calls: ${res.meta.qlooCalls}`);
  console.log(`Notice: "${res.meta.notice}"`);
  console.log('Categories:');
  res.categories.forEach((c) => {
    console.log(`  • ${c.title}: cSig=${c.cSig}, cBase=${c.cBase}, lift=${(c.rawTasteLift * 100).toFixed(0)}%, places=${c.places.length}`);
  });
}

runComparison();

