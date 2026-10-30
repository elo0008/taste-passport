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

async function runBasheerExperiment() {
  console.log('====================================================');
  console.log('TASK C EXPERIMENT: PROFILE 1 WITH VS WITHOUT BASHEER');
  console.log('====================================================\n');

  const p1WithBasheer = {
    destination: 'Toronto',
    favorites: [
      { name: 'Premam', type: 'movie' as const },
      { name: 'Drishyam', type: 'movie' as const },
      { name: 'A. R. Rahman', type: 'artist' as const },
      { name: 'K. S. Chithra', type: 'artist' as const },
      { name: 'Vaikom Muhammad Basheer', type: 'person' as const },
    ],
  };

  const p1WithoutBasheer = {
    destination: 'Toronto',
    favorites: [
      { name: 'Premam', type: 'movie' as const },
      { name: 'Drishyam', type: 'movie' as const },
      { name: 'A. R. Rahman', type: 'artist' as const },
      { name: 'K. S. Chithra', type: 'artist' as const },
    ],
  };

  console.log('Running Profile 1 WITH Basheer...');
  const resWith = await runPassportPipeline(p1WithBasheer, {
    ip: 'exp-with-basheer',
    bypassRateLimit: true,
    forceRefresh: true,
  });

  console.log('Running Profile 1 WITHOUT Basheer...');
  const resWithout = await runPassportPipeline(p1WithoutBasheer, {
    ip: 'exp-without-basheer',
    bypassRateLimit: true,
    forceRefresh: true,
  });

  console.log('\n====================================================');
  console.log('COMPARISON: WITH BASHEER vs WITHOUT BASHEER');
  console.log('====================================================');

  const catsWith = resWith.categories.map((c) => ({
    title: c.title,
    cSig: c.cSig,
    cBase: c.cBase,
    rawTasteLift: c.rawTasteLift,
    placeCount: c.places.length,
    places: c.places.map((p) => p.name),
  }));

  const catsWithout = resWithout.categories.map((c) => ({
    title: c.title,
    cSig: c.cSig,
    cBase: c.cBase,
    rawTasteLift: c.rawTasteLift,
    placeCount: c.places.length,
    places: c.places.map((p) => p.name),
  }));

  console.log('\nWITH Basheer Categories:');
  catsWith.forEach((c) => {
    console.log(`  • ${c.title}: cSig=${c.cSig}, cBase=${c.cBase}, lift=${(c.rawTasteLift * 100).toFixed(0)}%, places=${c.placeCount}`);
  });

  console.log('\nWITHOUT Basheer Categories:');
  catsWithout.forEach((c) => {
    console.log(`  • ${c.title}: cSig=${c.cSig}, cBase=${c.cBase}, lift=${(c.rawTasteLift * 100).toFixed(0)}%, places=${c.placeCount}`);
  });

  // Check category differences
  const titlesWith = catsWith.map((c) => c.title);
  const titlesWithout = catsWithout.map((c) => c.title);
  const sameCategories = titlesWith.length === titlesWithout.length && titlesWith.every((t, i) => t === titlesWithout[i]);
  console.log(`\nDid selected categories change? ${sameCategories ? 'NO (Identical set & order)' : 'YES'}`);

  // Check places differences
  let totalPlacesWith = 0;
  let overlappingPlaces = 0;
  for (const cw of catsWith) {
    totalPlacesWith += cw.places.length;
    const matchingCatWithout = catsWithout.find((c) => c.title === cw.title);
    if (matchingCatWithout) {
      for (const p of cw.places) {
        if (matchingCatWithout.places.includes(p)) {
          overlappingPlaces++;
        }
      }
    }
  }

  console.log(`Places overlap: ${overlappingPlaces}/${totalPlacesWith} (${((overlappingPlaces / totalPlacesWith) * 100).toFixed(1)}% match)`);
  console.log(`Did places change? ${overlappingPlaces === totalPlacesWith ? 'NO (Identical places)' : 'Minor place re-ranking / variations'}`);

  // Check lift differences
  const liftDiffs = catsWith.map((cw) => {
    const cwo = catsWithout.find((c) => c.title === cw.title);
    return {
      category: cw.title,
      liftWith: cw.rawTasteLift,
      liftWithout: cwo ? cwo.rawTasteLift : null,
    };
  });
  console.log('\nTaste Lift Comparison:');
  liftDiffs.forEach((ld) => {
    console.log(`  ${ld.category}: With=${((ld.liftWith) * 100).toFixed(0)}% | Without=${ld.liftWithout !== null ? ((ld.liftWithout) * 100).toFixed(0) + '%' : 'N/A'}`);
  });

  console.log('\nSignal check entry for Basheer:');
  const basheerSig = resWith.signalCheck.find((s) => s.favoriteName.includes('Basheer'));
  console.log(basheerSig);
  console.log('====================================================\n');
}

runBasheerExperiment().catch((err) => {
  console.error('Experiment error:', err);
  process.exit(1);
});

