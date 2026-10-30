import fs from 'fs';
import path from 'path';
import { z } from 'zod';
import { generateJson } from '../src/lib/gemini';
import { QlooClient } from '../src/lib/qloo';
import { inferCuisinesFromTaste } from '../src/lib/cuisine-inference';
import { resolveSingleFavorite, FavoriteType } from '../src/lib/resolve-service';

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

const LLMGuessSchema = z.object({
  cuisines: z.array(z.string()),
  places: z.array(
    z.object({
      name: z.string(),
      cuisine: z.string(),
      neighborhoodOrCity: z.string(),
      description: z.string(),
    })
  ),
});

export const METRO_AREAS: Record<string, string[]> = {
  toronto: [
    'toronto',
    'mississauga',
    'brampton',
    'markham',
    'vaughan',
    'richmond hill',
    'oakville',
    'burlington',
    'scarborough',
    'etobicoke',
    'north york',
    'york',
    'east york',
    'pickering',
    'ajax',
    'whitby',
    'oshawa',
    'milton',
  ],
  london: [
    'london',
    'westminster',
    'camden',
    'islington',
    'hackney',
    'southwark',
    'lambeth',
    'kensington',
    'chelsea',
    'fulham',
    'hammersmith',
    'wandsworth',
    'croydon',
    'barnet',
    'ealing',
    'brent',
    'bromley',
    'enfield',
    'greenwich',
    'haringey',
    'harrow',
    'havering',
    'hillingdon',
    'hounslow',
    'kingston',
    'merton',
    'newham',
    'redbridge',
    'richmond',
    'sutton',
    'tower hamlets',
    'waltham forest',
    'southall',
    'hayes',
    'wembley',
    'stratford',
  ],
};

function isAddressInMetro(address: string, destination: string): boolean {
  const normAddr = address.toLowerCase();
  const destKey = destination.trim().toLowerCase();
  const metroList = METRO_AREAS[destKey] || [destKey];

  return metroList.some((mun) => {
    const reg = new RegExp(`\\b${mun}\\b`, 'i');
    return reg.test(normAddr);
  });
}

interface ProfileConfig {
  name: string;
  destination: string;
  favorites: Array<{ name: string; type: FavoriteType }>;
}

const PROFILES: ProfileConfig[] = [
  {
    name: 'Profile 1 (Kerala Favorites)',
    destination: 'Toronto',
    favorites: [
      { name: 'Premam', type: 'movie' },
      { name: 'Drishyam', type: 'movie' },
      { name: 'A. R. Rahman', type: 'artist' },
      { name: 'K. S. Chithra', type: 'artist' },
      { name: 'Vaikom Muhammad Basheer', type: 'person' },
    ],
  },
  {
    name: 'Profile 2 (Punjabi Favorites)',
    destination: 'London',
    favorites: [
      { name: 'Diljit Dosanjh', type: 'artist' },
      { name: 'Sholay', type: 'movie' },
      { name: 'Sidhu Moose Wala', type: 'artist' },
      { name: 'Jab We Met', type: 'movie' },
    ],
  },
  {
    name: 'Control (Indie/Western Favorites)',
    destination: 'Toronto',
    favorites: [
      { name: 'Radiohead', type: 'artist' },
      { name: 'Inception', type: 'movie' },
      { name: 'Breaking Bad', type: 'tv_show' },
      { name: 'Fleabag', type: 'tv_show' },
    ],
  },
];

async function runBaselineComparison() {
  console.log('====================================================');
  console.log('TASK A: VERIFIABILITY BASELINE (LLM-ONLY VS QLOO GROUNDED)');
  console.log('====================================================\n');

  const client = new QlooClient();
  const SEARCH_TAKE = 10;
  console.log(`Probe Configuration:`);
  console.log(`- Qloo /search take used: ${SEARCH_TAKE} candidates per restaurant lookup`);
  console.log(`- Sample size n: 5 places per profile (total n=15)`);
  console.log(`- Documented Metro Lists:`);
  for (const [city, muns] of Object.entries(METRO_AREAS)) {
    console.log(`  • ${city.toUpperCase()}: ${muns.slice(0, 10).join(', ')}... (+${muns.length - 10} more)`);
  }
  console.log(`- Catalog note: Qloo's catalogue is extensive but incomplete; lookup failure reflects unverified status in Qloo, not proof of non-existence.\n`);

  const resultsTable: Array<{
    profile: string;
    city: string;
    llmCuisines: string;
    qlooCuisines: string;
    cuisineAgreement: string;
    matchedInMetroArea: string;
    matchFraction: string;
  }> = [];

  for (const prof of PROFILES) {
    console.log(`----------------------------------------------------`);
    console.log(`Evaluating ${prof.name} -> ${prof.destination}`);
    console.log(`----------------------------------------------------`);

    // 1. Resolve favorites using pipeline's shared resolution logic
    const resolvedFavs = [];
    for (const f of prof.favorites) {
      const candidates = await resolveSingleFavorite(client, f.name, f.type);
      if (candidates.length > 0) {
        resolvedFavs.push({ resolvedName: candidates[0].name, resolvedId: candidates[0].entityId });
      }
    }

    // 2. Reuse the EXACT same inference function as the pipeline
    const qlooInference = await inferCuisinesFromTaste(client, prof.destination, resolvedFavs);
    const qlooCuisineNames = qlooInference.topCuisines.map((c) => c.name);

    // 3. Prompt Gemini for direct baseline guess (n=5 places)
    const prompt = `You are a travel concierge.
Given these cultural favorites from a user:
${prof.favorites.map((f) => `- ${f.name} (${f.type})`).join('\n')}

1. What top 3 regional dining cuisines would appeal to this user?
2. Recommend exactly 5 specific, real restaurants/places located in or around ${prof.destination} that fit these tastes.

Respond in JSON matching:
{
  "cuisines": ["Cuisine 1", "Cuisine 2", "Cuisine 3"],
  "places": [
    {
      "name": "Exact restaurant name",
      "cuisine": "Cuisine type",
      "neighborhoodOrCity": "Neighborhood or suburb name",
      "description": "Short explanation why"
    }
  ]
}`;

    const llmRes = await generateJson(LLMGuessSchema, prompt, { temperature: 0.1 });
    console.log(`  LLM Guessed Cuisines:   ${llmRes.cuisines.join(', ')}`);
    console.log(`  Qloo Inferred Cuisines: ${qlooCuisineNames.join(', ')}`);

    // Calculate cuisine agreement
    const qNorm = qlooCuisineNames.map((c) => c.toLowerCase());
    const agreedCuisines = llmRes.cuisines.filter((c) =>
      qNorm.some((qn) => qn.includes(c.toLowerCase()) || c.toLowerCase().includes(qn))
    );
    const cuisineAgreementStr = `${agreedCuisines.length}/${llmRes.cuisines.length} (${((agreedCuisines.length / llmRes.cuisines.length) * 100).toFixed(0)}%)`;

    // 4. Verifiability check in Qloo /search
    let matchedInMetroCount = 0;
    const totalPlaces = llmRes.places.length;

    console.log(`\n  Checking verifiability of LLM-named places (up to ${SEARCH_TAKE} candidates per lookup):`);
    for (const p of llmRes.places) {
      try {
        const searchResults = await client.search({
          query: p.name,
          types: 'urn:entity:place',
          take: SEARCH_TAKE,
        });

        const candidates = Array.isArray(searchResults) ? searchResults : [];
        let matchedCandidate: any = null;

        for (const cand of candidates) {
          const addr = String(cand.properties?.address || cand.address || '');
          if (isAddressInMetro(addr, prof.destination)) {
            matchedCandidate = cand;
            break;
          }
        }

        if (matchedCandidate) {
          matchedInMetroCount++;
          const candAddr = String(matchedCandidate.properties?.address || matchedCandidate.address || 'Metro area');
          console.log(`    ✓ "${p.name}" -> Matched in target metro area: "${matchedCandidate.name}" (${candAddr})`);
        } else {
          console.log(`    • "${p.name}" -> No candidate matched within ${prof.destination} metro area (got ${candidates.length} candidates elsewhere or unlisted)`);
        }
      } catch (err: any) {
        console.log(`    ! "${p.name}" -> Search lookup error: ${err.message}`);
      }
    }

    const matchedStr = `${matchedInMetroCount}/${totalPlaces}`;
    const matchedPct = `${((matchedInMetroCount / totalPlaces) * 100).toFixed(0)}%`;

    resultsTable.push({
      profile: prof.name,
      city: prof.destination,
      llmCuisines: llmRes.cuisines.join(', '),
      qlooCuisines: qlooCuisineNames.join(', '),
      cuisineAgreement: cuisineAgreementStr,
      matchedInMetroArea: matchedStr,
      matchFraction: matchedPct,
    });

    console.log(`  Result: ${matchedStr} places matched in target metro area (${matchedPct})\n`);
  }

  console.log('====================================================');
  console.log('SUMMARY TABLE: LLM-NAMED RESTAURANTS MATCHED TO QLOO PLACE IN TARGET METRO');
  console.log('(A rough lower bound on verifiability, not a hallucination rate; n=5 per profile)');
  console.log('====================================================');
  console.table(
    resultsTable.map((r) => ({
      Profile: r.profile,
      City: r.city,
      'LLM Cuisines': r.llmCuisines,
      'Qloo Cuisines': r.qlooCuisines,
      'Cuisine Agreement': r.cuisineAgreement,
      'Matched in Target Metro': r.matchedInMetroArea,
      'Match %': r.matchFraction,
    }))
  );

  console.log('Finding: LLMs infer obvious cuisines well; the contribution of Qloo here is data-grounded, located places with address, rating, phone, website, and taste-derived cuisines for less obvious profiles.\n');
}

runBaselineComparison().catch((err) => {
  console.error('Baseline run failed:', err);
  process.exit(1);
});
