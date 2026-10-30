import fs from 'fs';
import path from 'path';

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

import { QlooClient } from '../src/lib/qloo';
import { runPassportPipeline } from '../src/lib/pipeline';
import { resolveSingleFavorite } from '../src/lib/resolve-service';
import { inferCuisinesFromTaste } from '../src/lib/cuisine-inference';

async function main() {
  const apiKey = process.env.QLOO_API_KEY;
  if (!apiKey) {
    console.error('Missing QLOO_API_KEY in environment');
    process.exit(1);
  }

  const client = new QlooClient({ apiKey });

  console.log('===============================================================');
  console.log('TASK A: VERIFY TASK C ON PRODUCTION PATH (PROFILE 1)');
  console.log('===============================================================\n');

  const profile1 = {
    destination: 'Toronto',
    favorites: [
      { name: 'Premam', type: 'movie' as const },
      { name: 'Drishyam', type: 'movie' as const },
      { name: 'A. R. Rahman', type: 'artist' as const },
      { name: 'K. S. Chithra', type: 'artist' as const },
      { name: 'Vaikom Muhammad Basheer', type: 'author' as const },
    ],
  };

  // 1. Resolve favorites via default resolve service
  console.log('1. Resolving Profile 1 favorites (/api/resolve defaults):');
  const resolvedFavs = [];
  for (const fav of profile1.favorites) {
    const candidates = await resolveSingleFavorite(client, fav.name, fav.type);
    if (candidates.length === 0) {
      console.log(`   - ${fav.name} (${fav.type}): UNRESOLVED`);
    } else {
      const top = candidates[0];
      resolvedFavs.push({
        inputName: fav.name,
        inputType: fav.type,
        resolvedName: top.name,
        resolvedId: top.entityId,
        resolvedType: top.type,
      });
      console.log(`   - ${fav.name} (${fav.type}) -> "${top.name}" [ID: ${top.entityId.slice(0, 10)}...]`);
    }
  }

  // 2. Measure BEFORE state (initial inference across all 5 resolved favorites)
  console.log('\n2. Initial Inference (BEFORE self-correction):');
  const initialInfer = await inferCuisinesFromTaste(
    client,
    profile1.destination,
    resolvedFavs.map((r) => ({ resolvedId: r.resolvedId, resolvedName: r.resolvedName }))
  );

  console.log('   Initial Inferred Categories:');
  for (const cat of initialInfer.topCuisines) {
    console.log(`     * ${cat.name}: cSig=${cat.cSig}/50, cBase=${cat.cBase}/50, lift/enrichment=${cat.enrichment.toFixed(2)}x`);
  }

  console.log('\n   Signal Check Attribution:');
  for (const sig of initialInfer.signalCheck) {
    console.log(`     * ${sig.favoriteName}: [${sig.isConsistent ? 'CONSISTENT' : 'UNALIGNED'}] - ${sig.statusLabel}`);
    console.log(`       Details: ${sig.summary}`);
  }

  // 3. Run full production pipeline with forceRefresh: true (cache bypass)
  console.log('\n3. Executing Full Production Pipeline (cache bypass):');
  const startTime = performance.now();
  const pipelineResult = await runPassportPipeline(
    {
      destination: profile1.destination,
      favorites: profile1.favorites,
    },
    {
      client,
      bypassRateLimit: true,
      forceRefresh: true,
    }
  );
  const totalElapsed = (performance.now() - startTime).toFixed(0);

  // 4. Print Pipeline Execution Details
  console.log('\n4. Production Pipeline Results:');
  console.log(`   Total Elapsed Time: ${totalElapsed}ms`);
  console.log(`   Pipeline Timings: resolve=${pipelineResult.meta.timings.resolveMs}ms, infer=${pipelineResult.meta.timings.inferMs}ms, discover=${pipelineResult.meta.timings.discoverMs}ms, write=${pipelineResult.meta.timings.writeMs}ms`);
  console.log(`   Total Qloo Calls: ${pipelineResult.meta.qlooCalls}`);
  console.log(`   Total LLM Calls: ${pipelineResult.meta.llmCalls}`);
  console.log(`   Grounding Violations: ${pipelineResult.meta.groundingViolations}`);
  console.log(`   Self-Correction Notice: ${pipelineResult.meta.notice || '(none)'}`);

  console.log('\n5. Comparison BEFORE vs AFTER Self-Correction:');
  console.log('---------------------------------------------------------------------------------------------------------');
  console.log('| Cuisine Category | BEFORE (5 signals)           | AFTER (4 signals post-rerun) | Status / Badge          |');
  console.log('|                  | cSig/50 | cBase/50 | Lift    | cSig/50 | cBase/50 | Lift    |                         |');
  console.log('---------------------------------------------------------------------------------------------------------');

  for (const cat of pipelineResult.categories) {
    const beforeMatch = initialInfer.topCuisines.find(
      (b) => b.id === cat.tagId || b.name.toLowerCase() === cat.title.toLowerCase()
    );
    const beforeCSig = beforeMatch ? `${beforeMatch.cSig}/50` : 'N/A';
    const beforeCBase = beforeMatch ? `${beforeMatch.cBase}/50` : 'N/A';
    const beforeLift = beforeMatch ? `${beforeMatch.enrichment.toFixed(1)}x` : 'N/A';

    const afterCSig = `${cat.cSig}/50`;
    const afterCBase = `${cat.cBase}/50`;
    const afterLift = `${cat.enrichment.toFixed(1)}x`;

    console.log(
      `| ${cat.title.padEnd(16)} | ${beforeCSig.padEnd(7)} | ${beforeCBase.padEnd(8)} | ${beforeLift.padEnd(7)} | ${afterCSig.padEnd(7)} | ${afterCBase.padEnd(8)} | ${afterLift.padEnd(7)} | ${cat.badge.slice(0, 23)}... |`
    );
  }
  console.log('---------------------------------------------------------------------------------------------------------');

  console.log('\n6. Final Assembled Categories & Raw Taste Lift:');
  for (const cat of pipelineResult.categories) {
    console.log(`   Category: "${cat.title}" (${cat.kindLabel})`);
    console.log(`     - Badge: "${cat.badge}"`);
    console.log(`     - Raw Taste Lift: ${(cat.rawTasteLift * 100).toFixed(0)}% (${cat.tasteLiftBadge})`);
    console.log(`     - Places Assigned: ${cat.places.length}`);
  }
}

main().catch((err) => {
  console.error('Fatal error during Task A verification:', err);
  process.exit(1);
});
