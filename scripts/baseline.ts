import fs from 'fs';
import path from 'path';
import { z } from 'zod';
import { generateJson } from '../src/lib/gemini';
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

interface BaselineProfile {
  name: string;
  destination: string;
  favorites: string[];
  qlooInferredCuisines: string[];
}

const PROFILES: BaselineProfile[] = [
  {
    name: 'Profile 1 (Kerala Favorites)',
    destination: 'Toronto',
    favorites: ['Premam', 'Drishyam', 'A. R. Rahman', 'K. S. Chithra', 'Vaikom Muhammad Basheer'],
    qlooInferredCuisines: ['Kerala', 'South Indian', 'Indian'],
  },
  {
    name: 'Profile 2 (Punjabi Favorites)',
    destination: 'London',
    favorites: ['Diljit Dosanjh', 'Sholay', 'Sidhu Moose Wala', 'Jab We Met'],
    qlooInferredCuisines: ['Punjabi', 'North Indian', 'Indian'],
  },
  {
    name: 'Control (Indie/Western Favorites)',
    destination: 'Toronto',
    favorites: ['Radiohead', 'Inception', 'Breaking Bad', 'Fleabag'],
    qlooInferredCuisines: ['Brewpub', 'Gastropub', 'Cocktail Bar'],
  },
];

async function runBaselineComparison() {
  console.log('====================================================');
  console.log('TASK H: OFFLINE QLOO VS LLM-ONLY BASELINE COMPARISON');
  console.log('====================================================\n');

  const qloo = new QlooClient();
  const resultsTable: Array<{
    profile: string;
    destination: string;
    llmCuisines: string[];
    qlooCuisines: string[];
    cuisineOverlap: string;
    totalPlacesRecommended: number;
    placesFoundInQloo: number;
    placesInTargetCity: number;
    hallucinatedOrUnknownPct: string;
  }> = [];

  for (const prof of PROFILES) {
    console.log(`\nEvaluating ${prof.name} -> ${prof.destination}...`);
    const prompt = `You are a travel concierge.
Given these cultural favorites from a user:
${prof.favorites.map((f) => `- ${f}`).join('\n')}

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
    console.log(`  LLM Guessed Cuisines: ${llmRes.cuisines.join(', ')}`);
    console.log(`  Qloo Inferred Cuisines: ${prof.qlooInferredCuisines.join(', ')}`);

    let placesFound = 0;
    let placesInTargetCity = 0;

    for (const p of llmRes.places) {
      try {
        const searchRes = await qloo.search({
          query: p.name,
          types: 'urn:entity:place',
          take: 3,
        });

        const entities = Array.isArray(searchRes) ? searchRes : [];
        const bestMatch = entities[0];

        if (bestMatch) {
          placesFound++;
          const addr = String(bestMatch.properties?.address || '').toLowerCase();
          const target = prof.destination.toLowerCase();
          const inCity = addr.includes(target) || addr.length === 0;
          if (inCity) {
            placesInTargetCity++;
          }
          console.log(`    ✓ Found in Qloo: "${p.name}" -> Qloo entity: "${bestMatch.name}" (${bestMatch.properties?.address || 'Metro area'})`);
        } else {
          console.log(`    ❌ NOT FOUND in Qloo: "${p.name}" (LLM guessed/unverified place)`);
        }
      } catch (err: any) {
        console.log(`    ❌ Search failed for "${p.name}": ${err.message}`);
      }
    }

    // Cuisine overlap check
    const qNorm = prof.qlooInferredCuisines.map((c) => c.toLowerCase());
    const matchedCuisines = llmRes.cuisines.filter((c) =>
      qNorm.some((qn) => qn.includes(c.toLowerCase()) || c.toLowerCase().includes(qn))
    );

    const hallucinatedPct = (((llmRes.places.length - placesInTargetCity) / llmRes.places.length) * 100).toFixed(0);

    resultsTable.push({
      profile: prof.name,
      destination: prof.destination,
      llmCuisines: llmRes.cuisines,
      qlooCuisines: prof.qlooInferredCuisines,
      cuisineOverlap: `${matchedCuisines.length}/${llmRes.cuisines.length}`,
      totalPlacesRecommended: llmRes.places.length,
      placesFoundInQloo: placesFound,
      placesInTargetCity: placesInTargetCity,
      hallucinatedOrUnknownPct: `${hallucinatedPct}%`,
    });
  }

  console.log('\n====================================================');
  console.log('SUMMARY BASELINE TABLE (LLM-ONLY VS QLOO GROUNDED)');
  console.log('====================================================');
  console.table(
    resultsTable.map((r) => ({
      Profile: r.profile,
      City: r.destination,
      'LLM Cuisines': r.llmCuisines.join(', '),
      'Qloo Cuisines': r.qlooCuisines.join(', '),
      'Cuisine Overlap': r.cuisineOverlap,
      'LLM Places Verified': `${r.placesInTargetCity}/${r.totalPlacesRecommended}`,
      'Unverified / Hallucinated Rate': r.hallucinatedOrUnknownPct,
    }))
  );
  console.log('====================================================\n');
}

runBaselineComparison().catch((err) => {
  console.error('Baseline run failed:', err);
  process.exit(1);
});
