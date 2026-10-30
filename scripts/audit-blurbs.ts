import fs from 'fs';
import path from 'path';
import { runPassportPipeline } from '../src/lib/pipeline';

// 1. Ensure .env.local is loaded
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

const STOPWORDS = new Set([
  'about', 'above', 'after', 'again', 'against', 'also', 'been', 'before', 'being', 'below',
  'between', 'both', 'from', 'further', 'have', 'having', 'here', 'into', 'more', 'most',
  'other', 'some', 'such', 'than', 'that', 'their', 'theirs', 'them', 'then', 'there',
  'these', 'they', 'this', 'those', 'through', 'under', 'until', 'very', 'were', 'what',
  'when', 'where', 'which', 'while', 'with', 'would', 'your', 'yours', 'serves', 'offers',
  'features', 'featuring', 'including', 'includes', 'known', 'located', 'fresh', 'traditional',
  'cuisine', 'restaurant', 'dining', 'place', 'spots', 'dishes', 'area', 'taste', 'local'
]);

function extractContentWords(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 3 && !STOPWORDS.has(w));
}

interface PlaceAuditRecord {
  profile: string;
  category: string;
  placeName: string;
  hasSourceText: boolean;
  sourceTextSnippet: string;
  blurb: string | null;
  blurbWithoutSource: boolean;
  contentWordCount: number;
  matchedContentWordCount: number;
  matchRatio: number;
}

async function auditBlurbs() {
  console.log('====================================================');
  console.log('TASK D: BLURB PROVENANCE AUDIT');
  console.log('====================================================\n');

  const profiles = [
    {
      name: 'Profile 1 (Kerala -> Toronto)',
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
      name: 'Profile 2 (Punjabi -> London)',
      destination: 'London',
      favorites: [
        { name: 'Diljit Dosanjh', type: 'artist' as const },
        { name: 'Sholay', type: 'movie' as const },
        { name: 'Sidhu Moose Wala', type: 'artist' as const },
        { name: 'Jab We Met', type: 'movie' as const },
      ],
    },
    {
      name: 'Control (Indie -> Toronto)',
      destination: 'Toronto',
      favorites: [
        { name: 'Radiohead', type: 'artist' as const },
        { name: 'Inception', type: 'movie' as const },
        { name: 'Breaking Bad', type: 'tv_show' as const },
        { name: 'Fleabag', type: 'tv_show' as const },
      ],
    },
  ];

  const auditRecords: PlaceAuditRecord[] = [];

  for (const prof of profiles) {
    console.log(`Auditing ${prof.name}...`);
    const res = await runPassportPipeline(prof, {
      ip: `audit-${prof.destination}`,
      bypassRateLimit: true,
      forceRefresh: true,
    });

    for (const cat of res.categories) {
      for (const p of cat.places) {
        const dishText = p.dishes.join(' ');
        const descText = p.description || '';
        const sourceText = [dishText, descText].filter(Boolean).join(' ').trim();
        const hasSourceText = (p.dishes && p.dishes.length > 0) || Boolean(p.description && p.description.trim());
        const blurb = p.blurb;
        const blurbWithoutSource = !hasSourceText && blurb !== null;

        let contentWordCount = 0;
        let matchedContentWordCount = 0;
        let matchRatio = 0;

        if (blurb !== null) {
          const blurbWords = extractContentWords(blurb);
          contentWordCount = blurbWords.length;
          const sourceWords = new Set(extractContentWords(sourceText));

          for (const bw of blurbWords) {
            // Check direct match or substring/stem match
            const matched = Array.from(sourceWords).some(
              (sw) => sw === bw || sw.includes(bw) || bw.includes(sw)
            );
            if (matched) {
              matchedContentWordCount++;
            }
          }

          matchRatio = contentWordCount > 0 ? matchedContentWordCount / contentWordCount : 1;
        }

        auditRecords.push({
          profile: prof.name,
          category: cat.title,
          placeName: p.name,
          hasSourceText,
          sourceTextSnippet: sourceText || '(none)',
          blurb,
          blurbWithoutSource,
          contentWordCount,
          matchedContentWordCount,
          matchRatio,
        });

        // Local print (place name, source texts available, blurb text)
        console.log(`  [${cat.title}] ${p.name}`);
        console.log(`    Source available: ${hasSourceText ? `Dishes/Desc: [${sourceText.slice(0, 80)}...]` : 'NONE'}`);
        console.log(`    Blurb: ${blurb ? `"${blurb}"` : 'null'}`);
        if (blurb !== null) {
          console.log(`    Word grounding: ${matchedContentWordCount}/${contentWordCount} (${(matchRatio * 100).toFixed(0)}%)`);
        }
      }
    }
  }

  // Aggregate computations
  const totalPlaces = auditRecords.length;
  const placesWithSource = auditRecords.filter((r) => r.hasSourceText).length;
  const placesWithoutSource = auditRecords.filter((r) => !r.hasSourceText).length;
  const blurbsProduced = auditRecords.filter((r) => r.blurb !== null).length;
  const nullBlurbs = auditRecords.filter((r) => r.blurb === null).length;
  const blurbsWithoutSourceCount = auditRecords.filter((r) => r.blurbWithoutSource).length;

  const recordsWithBlurb = auditRecords.filter((r) => r.blurb !== null);
  const totalContentWords = recordsWithBlurb.reduce((sum, r) => sum + r.contentWordCount, 0);
  const totalMatchedWords = recordsWithBlurb.reduce((sum, r) => sum + r.matchedContentWordCount, 0);
  const aggregateGroundedRatio = totalContentWords > 0 ? totalMatchedWords / totalContentWords : 0;

  console.log('\n====================================================');
  console.log('AGGREGATE BLURB PROVENANCE AUDIT METRICS');
  console.log('====================================================');
  console.log(`Total places evaluated:              ${totalPlaces}`);
  console.log(`Places with source text (dishes/desc): ${placesWithSource}`);
  console.log(`Places without source text:           ${placesWithoutSource}`);
  console.log(`Blurbs produced:                     ${blurbsProduced}`);
  console.log(`Null blurbs:                         ${nullBlurbs}`);
  console.log(`Blurbs without source text:          ${blurbsWithoutSourceCount}`);
  console.log(`Aggregate content word match:        ${(aggregateGroundedRatio * 100).toFixed(1)}% (${totalMatchedWords}/${totalContentWords} content words grounded in source)`);
  console.log('====================================================\n');

  // Hard assertion
  if (blurbsWithoutSourceCount !== 0) {
    console.error(`FAILED: ${blurbsWithoutSourceCount} blurbs were generated without source text!`);
    process.exit(1);
  }

  console.log('✓ Provenance audit assertion PASSED: blurbsWithoutSource === 0 strictly satisfied.\n');
}

auditBlurbs().catch((err) => {
  console.error('Audit failed with error:', err);
  process.exit(1);
});
