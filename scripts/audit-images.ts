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
import { resolveSingleFavorite, FavoriteType } from '../src/lib/resolve-service';
import { ALLOWED_IMAGE_HOSTS } from '../src/lib/images';

interface HttpAuditResult {
  statusCode: number;
  contentType: string;
  redirected: boolean;
}

async function probeUrl(url: string): Promise<HttpAuditResult> {
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        Range: 'bytes=0-0',
        'User-Agent': 'TastePassport-Audit/1.0',
      },
    });

    // Drain body without saving
    await res.arrayBuffer();

    const contentType = (res.headers.get('content-type') || 'unknown').split(';')[0].trim();
    return {
      statusCode: res.status,
      contentType,
      redirected: res.redirected,
    };
  } catch (err: any) {
    return {
      statusCode: 0,
      contentType: 'network_error',
      redirected: false,
    };
  }
}

async function runImageAudit() {
  const apiKey = process.env.QLOO_API_KEY;
  if (!apiKey) {
    console.error('Missing QLOO_API_KEY in environment');
    process.exit(1);
  }

  const client = new QlooClient({ apiKey });

  console.log('================================================================================');
  console.log('IMAGE AUDIT: CANDIDATES & PLACES (AGGREGATE METRICS ONLY)');
  console.log('================================================================================\n');

  // Define favorites across the 3 profiles
  const profilesFavorites: Array<{ name: string; type: FavoriteType }> = [
    // Profile 1: Kerala
    { name: 'Premam', type: 'movie' },
    { name: 'Drishyam', type: 'movie' },
    { name: 'A. R. Rahman', type: 'artist' },
    { name: 'K. S. Chithra', type: 'artist' },
    { name: 'Vaikom Muhammad Basheer', type: 'person' },
    // Profile 2: Punjabi
    { name: 'Diljit Dosanjh', type: 'artist' },
    { name: 'Sholay', type: 'movie' },
    { name: 'Sidhu Moose Wala', type: 'artist' },
    { name: 'Jab We Met', type: 'movie' },
    // Control Profile: Indie/Western
    { name: 'Radiohead', type: 'artist' },
    { name: 'Inception', type: 'movie' },
    { name: 'Breaking Bad', type: 'tv_show' },
    { name: 'Fleabag', type: 'tv_show' },
  ];

  console.log('--- 1. Auditing Search Candidates Across 3 Profiles ---');
  let totalCandidates = 0;
  let candidatesWithImage = 0;
  const candidateHostnames = new Set<string>();
  const candidateImageUrls: string[] = [];

  for (const fav of profilesFavorites) {
    const candidates = await resolveSingleFavorite(client, fav.name, fav.type);
    for (const cand of candidates) {
      totalCandidates++;
      if (cand.imageUrl) {
        candidatesWithImage++;
        candidateImageUrls.push(cand.imageUrl);
        try {
          const parsed = new URL(cand.imageUrl);
          candidateHostnames.add(parsed.hostname);
        } catch {}
      }
    }
  }

  console.log(`Total Candidates Evaluated: ${totalCandidates}`);
  console.log(`Candidates with imageUrl:   ${candidatesWithImage} (${((candidatesWithImage / totalCandidates) * 100).toFixed(1)}%)`);
  console.log(`Candidates with null:       ${totalCandidates - candidatesWithImage} (${(((totalCandidates - candidatesWithImage) / totalCandidates) * 100).toFixed(1)}%)`);
  console.log(`Candidate Image Hostnames:  ${Array.from(candidateHostnames).sort().join(', ') || 'none'}\n`);

  console.log('--- 2. Auditing Result Places Across 3 Profiles ---');
  const profiles = [
    {
      label: 'Profile 1 (Kerala -> Toronto)',
      destination: 'Toronto',
      favorites: profilesFavorites.slice(0, 5),
    },
    {
      label: 'Profile 2 (Punjabi -> London)',
      destination: 'London',
      favorites: profilesFavorites.slice(5, 9),
    },
    {
      label: 'Control Profile (Indie -> Toronto)',
      destination: 'Toronto',
      favorites: profilesFavorites.slice(9, 13),
    },
  ];

  let totalPlaces = 0;
  let placesWithImage = 0;
  const placeHostnames = new Set<string>();
  const placeImageUrls: string[] = [];

  for (const prof of profiles) {
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

    for (const cat of res.categories) {
      for (const p of cat.places) {
        totalPlaces++;
        if (p.imageUrl) {
          placesWithImage++;
          placeImageUrls.push(p.imageUrl);
          try {
            const parsed = new URL(p.imageUrl);
            placeHostnames.add(parsed.hostname);
          } catch {}
        }
      }
    }
  }

  console.log(`Total Places Evaluated:     ${totalPlaces}`);
  console.log(`Places with imageUrl:       ${placesWithImage} (${((placesWithImage / totalPlaces) * 100).toFixed(1)}%)`);
  console.log(`Places with null:           ${totalPlaces - placesWithImage} (${(((totalPlaces - placesWithImage) / totalPlaces) * 100).toFixed(1)}%)`);
  console.log(`Place Image Hostnames:      ${Array.from(placeHostnames).sort().join(', ') || 'none'}\n`);

  // Sample check: 20 places + 10 candidates
  console.log('--- 3. HTTP Server-Side Verification (Range: bytes=0-0) ---');
  const samplePlaces = placeImageUrls.slice(0, 20);
  const sampleCandidates = candidateImageUrls.slice(0, 10);

  console.log(`Probing sample of ${samplePlaces.length} place image URLs...`);
  const placeStatusCounts: Record<string, number> = {};
  const placeContentTypeCounts: Record<string, number> = {};
  let placeRedirects = 0;

  for (const url of samplePlaces) {
    const probe = await probeUrl(url);
    placeStatusCounts[probe.statusCode] = (placeStatusCounts[probe.statusCode] || 0) + 1;
    placeContentTypeCounts[probe.contentType] = (placeContentTypeCounts[probe.contentType] || 0) + 1;
    if (probe.redirected) placeRedirects++;
  }

  console.log(`Probing sample of ${sampleCandidates.length} candidate image URLs...`);
  const candStatusCounts: Record<string, number> = {};
  const candContentTypeCounts: Record<string, number> = {};
  let candRedirects = 0;

  for (const url of sampleCandidates) {
    const probe = await probeUrl(url);
    candStatusCounts[probe.statusCode] = (candStatusCounts[probe.statusCode] || 0) + 1;
    candContentTypeCounts[probe.contentType] = (candContentTypeCounts[probe.contentType] || 0) + 1;
    if (probe.redirected) candRedirects++;
  }

  console.log('\n--- Sample Probe Results ---');
  console.log('Place Images Sample (n=' + samplePlaces.length + '):');
  console.log('  Status Code Distribution:', placeStatusCounts);
  console.log('  Content-Type Distribution:', placeContentTypeCounts);
  console.log('  Redirects Count:', placeRedirects);

  console.log('Candidate Images Sample (n=' + sampleCandidates.length + '):');
  console.log('  Status Code Distribution:', candStatusCounts);
  console.log('  Content-Type Distribution:', candContentTypeCounts);
  console.log('  Redirects Count:', candRedirects);

  console.log('\n--- Configured Hostnames Allowlist ---');
  console.log('ALLOWED_IMAGE_HOSTS:', ALLOWED_IMAGE_HOSTS);

  console.log('\n================================================================================');
  console.log('IMPORTANT NOTE:');
  console.log('Server-side HTTP success does NOT prove that a user browser will load the image');
  console.log('(due to potential browser Referer headers, CORS, or CDN hotlink protection policies).');
  console.log('A manual browser check on the deployed site is required.');
  console.log('================================================================================');
}

runImageAudit().catch((err) => {
  console.error('Fatal error in audit:', err?.message || err);
  process.exit(1);
});

