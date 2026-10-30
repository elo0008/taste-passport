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

const PROFILES = [
  {
    name: 'Profile 1 (Kerala Favorites)',
    destination: 'Toronto',
    favorites: [
      { name: 'Premam', type: 'movie' as const },
      { name: 'Drishyam', type: 'movie' as const },
      { name: 'A. R. Rahman', type: 'artist' as const },
      { name: 'K. S. Chithra', type: 'artist' as const },
      { name: 'Vaikom Muhammad Basheer', type: 'person' as const },
    ],
  },
  {
    name: 'Profile 2 (Punjabi Favorites)',
    destination: 'London',
    favorites: [
      { name: 'Diljit Dosanjh', type: 'artist' as const },
      { name: 'Sholay', type: 'movie' as const },
      { name: 'Sidhu Moose Wala', type: 'artist' as const },
      { name: 'Jab We Met', type: 'movie' as const },
    ],
  },
  {
    name: 'Control (Indie/Western Favorites)',
    destination: 'Toronto',
    favorites: [
      { name: 'Radiohead', type: 'artist' as const },
      { name: 'Inception', type: 'movie' as const },
      { name: 'Breaking Bad', type: 'tv_show' as const },
      { name: 'Fleabag', type: 'tv_show' as const },
    ],
  },
];

async function main() {
  const apiKey = process.env.QLOO_API_KEY;
  if (!apiKey) {
    console.error('Missing QLOO_API_KEY in environment');
    process.exit(1);
  }

  const client = new QlooClient({ apiKey });

  console.log('===============================================================');
  console.log('VENUE CONTACT & METADATA COMPLETENESS AUDIT');
  console.log('Measuring phone/website availability across Profiles 1, 2, and Control');
  console.log('===============================================================\n');

  let totalVenuesAcrossAll = 0;
  let totalMissingPhone = 0;
  let totalMissingWebsite = 0;
  let totalMissingEither = 0;
  let totalMissingBoth = 0;
  let totalWithAddress = 0;

  const profileBreakdowns: any[] = [];

  for (const prof of PROFILES) {
    console.log(`Running pipeline for ${prof.name} -> ${prof.destination}...`);
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

    // Extract unique places across categories
    const placeMap = new Map<string, any>();
    for (const cat of res.categories) {
      for (const p of cat.places) {
        if (!placeMap.has(p.id)) {
          placeMap.set(p.id, p);
        }
      }
    }

    const uniquePlaces = Array.from(placeMap.values());
    const n = uniquePlaces.length;

    let missingPhone = 0;
    let missingWeb = 0;
    let missingEither = 0;
    let missingBoth = 0;
    let hasAddress = 0;

    for (const p of uniquePlaces) {
      const pPhone = Boolean(p.phone && p.phone.trim());
      const pWeb = Boolean(p.website && p.website.trim());
      const pAddr = Boolean(p.address && p.address.trim());

      if (!pPhone) missingPhone++;
      if (!pWeb) missingWeb++;
      if (!pPhone || !pWeb) missingEither++;
      if (!pPhone && !pWeb) missingBoth++;
      if (pAddr) hasAddress++;
    }

    totalVenuesAcrossAll += n;
    totalMissingPhone += missingPhone;
    totalMissingWebsite += missingWeb;
    totalMissingEither += missingEither;
    totalMissingBoth += missingBoth;
    totalWithAddress += hasAddress;

    profileBreakdowns.push({
      Profile: prof.name,
      City: prof.destination,
      'Unique Venues': n,
      'Missing Phone': `${missingPhone} (${((missingPhone / n) * 100).toFixed(1)}%)`,
      'Missing Website': `${missingWeb} (${((missingWeb / n) * 100).toFixed(1)}%)`,
      'Missing Either': `${missingEither} (${((missingEither / n) * 100).toFixed(1)}%)`,
      'Missing Both': `${missingBoth} (${((missingBoth / n) * 100).toFixed(1)}%)`,
      'Has Valid Address': `${hasAddress} (${((hasAddress / n) * 100).toFixed(1)}%)`,
    });
  }

  console.log('\n---------------------------------------------------------------');
  console.log('PER-PROFILE BREAKDOWN:');
  console.log('---------------------------------------------------------------');
  console.table(profileBreakdowns);

  const phoneMissPct = ((totalMissingPhone / totalVenuesAcrossAll) * 100).toFixed(1);
  const webMissPct = ((totalMissingWebsite / totalVenuesAcrossAll) * 100).toFixed(1);
  const eitherMissPct = ((totalMissingEither / totalVenuesAcrossAll) * 100).toFixed(1);
  const bothMissPct = ((totalMissingBoth / totalVenuesAcrossAll) * 100).toFixed(1);
  const addrPct = ((totalWithAddress / totalVenuesAcrossAll) * 100).toFixed(1);

  console.log('---------------------------------------------------------------');
  console.log('OVERALL AGGREGATE SUMMARY:');
  console.log('---------------------------------------------------------------');
  console.log(`Total Unique Places Audited: ${totalVenuesAcrossAll}`);
  console.log(`Places with Valid Address:   ${totalWithAddress}/${totalVenuesAcrossAll} (${addrPct}%)`);
  console.log(`Places Missing Phone:        ${totalMissingPhone}/${totalVenuesAcrossAll} (${phoneMissPct}%)`);
  console.log(`Places Missing Website:      ${totalMissingWebsite}/${totalVenuesAcrossAll} (${webMissPct}%)`);
  console.log(`Places Missing Either Phone or Website: ${totalMissingEither}/${totalVenuesAcrossAll} (${eitherMissPct}%)`);
  console.log(`Places Missing Both:         ${totalMissingBoth}/${totalVenuesAcrossAll} (${bothMissPct}%)`);
  console.log('---------------------------------------------------------------\n');
}

main().catch((err) => {
  console.error('Audit failed:', err);
  process.exit(1);
});
