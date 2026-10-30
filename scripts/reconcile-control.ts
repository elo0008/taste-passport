import fs from 'fs';
import path from 'path';
import { runPassportPipeline } from '../src/lib/pipeline';
import { inferCuisinesFromTaste } from '../src/lib/cuisine-inference';
import { resolveSingleFavorite } from '../src/lib/resolve-service';
import { QlooClient } from '../src/lib/qloo';

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

async function runControlReconcile() {
  console.log('====================================================');
  console.log('TASK B: RECONCILING THE CONTROL DISCREPANCY');
  console.log('====================================================\n');

  const client = new QlooClient();

  const controlFavs = [
    { name: 'Radiohead', type: 'artist' as const },
    { name: 'Inception', type: 'movie' as const },
    { name: 'Breaking Bad', type: 'tv_show' as const },
    { name: 'Fleabag', type: 'tv_show' as const },
  ];

  console.log('1. Resolving Control entities via resolveSingleFavorite:');
  const resolved = [];
  for (const f of controlFavs) {
    const candidates = await resolveSingleFavorite(client, f.name, f.type);
    console.log(`  • ${f.name} (${f.type}): candidates=${candidates.length}`);
    if (candidates.length > 0) {
      const c = candidates[0];
      console.log(`    Selected ID: ${c.entityId} | Name: "${c.name}" | Year: ${c.year || 'N/A'}`);
      resolved.push({ resolvedName: c.name, resolvedId: c.entityId, type: f.type });
    }
  }

  console.log('\n2. Testing direct inferCuisinesFromTaste for Control in Toronto:');
  const inferenceRes = await inferCuisinesFromTaste(client, 'Toronto', resolved);
  console.log('  Top inferred cuisines:');
  inferenceRes.topCuisines.forEach((c, i) => {
    console.log(`    ${i + 1}. "${c.name}" (${c.id}) | cSig=${c.cSig}, cBase=${c.cBase}, enrichment=${c.enrichment.toFixed(2)}x`);
  });

  console.log('\n3. Running Control Profile 3 times through runPassportPipeline (uncached, cache bypass):');
  const runs = [];
  for (let i = 1; i <= 3; i++) {
    console.log(`\n--- RUN ${i} ---`);
    const t0 = performance.now();
    const res = await runPassportPipeline(
      { destination: 'Toronto', favorites: controlFavs },
      { ip: `reconcile-run-${i}`, bypassRateLimit: true, forceRefresh: true }
    );
    const dur = Math.round(performance.now() - t0);

    const catSummary = res.categories.map((c) => ({
      title: c.title,
      tagId: c.tagId,
      cSig: c.cSig,
      cBase: c.cBase,
      enrichment: c.enrichment,
      placeCount: c.places.length,
      first3Places: c.places.slice(0, 3).map((p) => p.name),
    }));

    console.log(`  Duration: ${dur}ms | Categories count: ${res.categories.length}`);
    catSummary.forEach((c) => {
      console.log(`    Category "${c.title}" (${c.tagId}) - cSig=${c.cSig}, cBase=${c.cBase}, places=${c.placeCount}`);
      console.log(`      First 3: ${c.first3Places.join(', ')}`);
    });

    runs.push(catSummary);
  }

  console.log('\n====================================================');
  console.log('RECONCILIATION COMPARISON');
  console.log('====================================================');
  const run1Tags = runs[0].map((c) => c.tagId).join('|');
  const run2Tags = runs[1].map((c) => c.tagId).join('|');
  const run3Tags = runs[2].map((c) => c.tagId).join('|');

  console.log(`Run 1 tags: ${run1Tags}`);
  console.log(`Run 2 tags: ${run2Tags}`);
  console.log(`Run 3 tags: ${run3Tags}`);

  const identical = run1Tags === run2Tags && run2Tags === run3Tags;
  console.log(`Are category sets identical across 3 runs? ${identical ? 'YES' : 'NO'}`);
}

runControlReconcile().catch((err) => {
  console.error('Reconciliation error:', err);
  process.exit(1);
});
