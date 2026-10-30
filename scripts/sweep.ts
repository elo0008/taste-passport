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
import { runPassportPipeline, FavoriteInput } from '../src/lib/pipeline';

interface SweepProfile {
  label: string;
  destination: string;
  favorites: FavoriteInput[];
}

const SWEEP_PROFILES: SweepProfile[] = [
  {
    label: '1. Korean favorites',
    destination: 'New York',
    favorites: [
      { name: 'BTS', type: 'artist' },
      { name: 'Parasite', type: 'movie' },
      { name: 'Crash Landing on You', type: 'tv_show' },
    ],
  },
  {
    label: '2. Nigerian favorites',
    destination: 'London',
    favorites: [
      { name: 'Burna Boy', type: 'artist' },
      { name: 'Wizkid', type: 'artist' },
      { name: 'Living in Bondage', type: 'movie' },
    ],
  },
  {
    label: '3. Japanese favorites',
    destination: 'Berlin',
    favorites: [
      { name: 'Spirited Away', type: 'movie' },
      { name: 'Joe Hisaishi', type: 'artist' },
      { name: 'Haruki Murakami', type: 'person' },
    ],
  },
  {
    label: '4. Mainstream',
    destination: 'Sydney',
    favorites: [
      { name: 'Taylor Swift', type: 'artist' },
      { name: 'The Office', type: 'tv_show' },
      { name: 'Avengers', type: 'movie' },
      { name: 'Friends', type: 'tv_show' },
    ],
  },
  {
    label: '5. Latin',
    destination: 'Toronto',
    favorites: [
      { name: 'Bad Bunny', type: 'artist' },
      { name: 'Narcos', type: 'tv_show' },
      { name: 'Shakira', type: 'artist' },
    ],
  },
  {
    label: '6. Small city (Kerala -> Thrissur)',
    destination: 'Thrissur',
    favorites: [
      { name: 'Premam', type: 'movie' },
      { name: 'Drishyam', type: 'movie' },
      { name: 'A. R. Rahman', type: 'artist' },
      { name: 'K. S. Chithra', type: 'artist' },
      { name: 'Vaikom Muhammad Basheer', type: 'person' },
    ],
  },
  {
    label: '7. Typo / unknown favorite',
    destination: 'Toronto',
    favorites: [
      { name: 'asdfgh', type: 'artist' },
      { name: 'Premam', type: 'movie' },
      { name: 'Drishyam', type: 'movie' },
    ],
  },
  {
    label: '8. 3 favorites (1 obscure)',
    destination: 'Toronto',
    favorites: [
      { name: 'Premam', type: 'movie' },
      { name: 'Drishyam', type: 'movie' },
      { name: 'zzxyqwerty999', type: 'artist' },
    ],
  },
  {
    label: '9. Destination typo (Torontoo)',
    destination: 'Torontoo',
    favorites: [
      { name: 'Premam', type: 'movie' },
      { name: 'Drishyam', type: 'movie' },
      { name: 'A. R. Rahman', type: 'artist' },
      { name: 'K. S. Chithra', type: 'artist' },
      { name: 'Vaikom Muhammad Basheer', type: 'person' },
    ],
  },
  {
    label: '10. Duplicate favorite',
    destination: 'Toronto',
    favorites: [
      { name: 'Premam', type: 'movie' },
      { name: 'Premam', type: 'movie' },
      { name: 'Drishyam', type: 'movie' },
    ],
  },
];

async function runSweep() {
  const apiKey = process.env.QLOO_API_KEY;
  if (!apiKey) {
    console.error('Missing QLOO_API_KEY in environment');
    process.exit(1);
  }

  const client = new QlooClient({ apiKey });

  console.log('================================================================================');
  console.log('TASK A: ROBUSTNESS SWEEP (10 DIVERSE PROFILES)');
  console.log('================================================================================\n');

  for (let i = 0; i < SWEEP_PROFILES.length; i++) {
    const prof = SWEEP_PROFILES[i];
    console.log(`--- [Profile ${i + 1}/10] ${prof.label} -> ${prof.destination} ---`);

    const start = performance.now();
    try {
      const res = await runPassportPipeline(
        {
          destination: prof.destination,
          favorites: prof.favorites,
        },
        {
          client,
          bypassRateLimit: true,
          forceRefresh: true,
        }
      );
      const elapsed = Math.round(performance.now() - start);

      const resolvedCount = res.resolved.length;
      const totalCount = res.resolved.length + res.unresolvedFavorites.length;
      const unresolvedNames =
        res.unresolvedFavorites.map((u) => u.name).join(', ') || 'none';
      const categoryTitles = res.categories.map((c) => c.title).join(', ') || 'none';
      const placesPerCat =
        res.categories.map((c) => `${c.title}: ${c.places.length}`).join('; ') || 'none';

      console.log(`Profile:             ${prof.label}`);
      console.log(`Destination:         ${prof.destination}`);
      console.log(`Resolved:            ${resolvedCount} / ${totalCount}`);
      console.log(`Unresolved:          ${unresolvedNames}`);
      console.log(`Categories:          ${categoryTitles}`);
      console.log(`Places per Category: ${placesPerCat}`);
      console.log(`Narration Mode:      ${res.meta.narration}`);
      console.log(`Notices:             ${res.meta.notice || 'none'}`);
      console.log(`Grounding Viol:      ${res.meta.groundingViolations}`);
      console.log(`Total Duration:      ${elapsed}ms`);
      console.log(`Thrown Error:        none\n`);
    } catch (err: any) {
      const elapsed = Math.round(performance.now() - start);
      console.log(`Profile:             ${prof.label}`);
      console.log(`Destination:         ${prof.destination}`);
      console.log(`Resolved:            N/A (pipeline error)`);
      console.log(`Unresolved:          N/A`);
      console.log(`Categories:          none`);
      console.log(`Places per Category: none`);
      console.log(`Narration Mode:      none`);
      console.log(`Notices:             none`);
      console.log(`Grounding Viol:      0`);
      console.log(`Total Duration:      ${elapsed}ms`);
      console.log(`Thrown Error:        ${err?.message || String(err)}\n`);
    }

    // Short pause between runs to protect quotas
    if (i < SWEEP_PROFILES.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }

  console.log('================================================================================');
  console.log('SWEEP COMPLETE');
  console.log('================================================================================');
}

runSweep().catch((err) => {
  console.error('Fatal error in sweep:', err?.message || err);
  process.exit(1);
});

