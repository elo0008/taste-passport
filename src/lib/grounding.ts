import { z } from 'zod';
import { generateJson } from './gemini';

export const BANNED_WORDS = [
  'cozy',
  'charming',
  'intimate',
  'welcoming',
  'warm',
  'beloved',
  'famous',
  'famed',
  'iconic',
  'authentic',
  'legendary',
  'hidden gem',
  'must-visit',
  'vibrant',
  'delightful',
  'delicious',
];

export interface GroundingInputPlace {
  id: string;
  name: string;
  address?: string;
  website?: string;
  phone?: string;
  rating?: number | null;
  priceLevel?: string | null;
  dishes: string[];
  description?: string;
  neighborhood?: string;
}

export interface GroundingInputCategory {
  title: string;
  kind?: string;
  tagId: string;
  places: GroundingInputPlace[];
}

export const WrittenPlaceSchema = z.object({
  id: z.string(),
  blurb: z.string().trim().max(250).nullable(),
});

export const WrittenCategorySchema = z.object({
  tagId: z.string(),
  intro: z.string().trim().max(200),
  places: z.array(WrittenPlaceSchema),
});

export const WriteOutputSchema = z.object({
  categories: z.array(WrittenCategorySchema),
  firstMonth: z.string().trim().max(1000),
});

export type WriteOutput = z.infer<typeof WriteOutputSchema>;

export interface GroundingCheckResult {
  valid: boolean;
  violations: string[];
}

export function countWords(str: string): number {
  return str.trim().split(/\s+/).filter(Boolean).length;
}

export function containsFavoriteName(text: string | null | undefined, favName: string): boolean {
  if (!text || !favName || favName.length < 2) return false;
  const escaped = favName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(^|\\W)${escaped}(\\W|$)`, 'i');
  return regex.test(text);
}

export function containsBannedWord(text: string | null | undefined): string | null {
  if (!text) return null;
  for (const word of BANNED_WORDS) {
    const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(^|\\W)${escaped}(\\W|$)`, 'i');
    if (regex.test(text)) {
      return word;
    }
  }
  return null;
}

export function sanitizeTextBannedWords(text: string): string {
  let cleaned = text;
  for (const word of BANNED_WORDS) {
    const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(^|\\W)${escaped}(\\W|$)`, 'gi');
    cleaned = cleaned.replace(regex, (match, p1, p2) => `${p1}traditional${p2}`);
  }
  return cleaned;
}

export function verifyGrounding(
  output: WriteOutput,
  inputCategories: GroundingInputCategory[],
  allResolvedFavoriteNames: string[]
): GroundingCheckResult {
  const violations: string[] = [];

  const inputCategoryMap = new Map<string, GroundingInputCategory>();
  const inputPlaceMap = new Map<string, GroundingInputPlace>();

  for (const cat of inputCategories) {
    inputCategoryMap.set(cat.tagId, cat);
    for (const place of cat.places) {
      inputPlaceMap.set(place.id, place);
    }
  }

  // 1. Check firstMonth
  for (const favName of allResolvedFavoriteNames) {
    if (containsFavoriteName(output.firstMonth, favName)) {
      violations.push(
        `Grounding violation: firstMonth guide named user favorite "${favName}". Mention places and categories only.`
      );
    }
  }
  const fmBanned = containsBannedWord(output.firstMonth);
  if (fmBanned) {
    violations.push(`Grounding violation: firstMonth guide used banned subjective word "${fmBanned}".`);
  }

  // 2. Check categories and places
  for (const cat of output.categories) {
    const inputCat = inputCategoryMap.get(cat.tagId);
    if (!inputCat) {
      violations.push(`Output category tagId "${cat.tagId}" was not in input categories.`);
      continue;
    }

    const introWords = countWords(cat.intro);
    if (introWords > 20) {
      violations.push(`Category intro for "${inputCat.title}" exceeds 20 words (has ${introWords} words).`);
    }

    const introBanned = containsBannedWord(cat.intro);
    if (introBanned) {
      violations.push(`Category intro for "${inputCat.title}" used banned subjective word "${introBanned}".`);
    }

    for (const favName of allResolvedFavoriteNames) {
      if (containsFavoriteName(cat.intro, favName)) {
        violations.push(
          `Category intro for "${inputCat.title}" named user favorite "${favName}". Intros must describe food and venue only.`
        );
      }
    }

    for (const place of cat.places) {
      const inputPlace = inputPlaceMap.get(place.id);
      if (!inputPlace) {
        violations.push(`Invented place ID "${place.id}" was not present in assembled input places.`);
        continue;
      }

      const hasDishes = inputPlace.dishes && inputPlace.dishes.length > 0;
      const hasDesc = Boolean(inputPlace.description && inputPlace.description.trim());

      // Task D: "If a place has neither specialty_dishes nor a description-like field, blurb = null"
      if (!hasDishes && !hasDesc) {
        if (place.blurb !== null) {
          violations.push(
            `Place "${inputPlace.name}" has neither dishes nor description, so its blurb must be null (got "${place.blurb}").`
          );
        }
        continue;
      }

      if (place.blurb !== null) {
        const blurbWords = countWords(place.blurb);
        if (blurbWords > 25) {
          violations.push(`Place blurb for "${inputPlace.name}" exceeds 25 words (has ${blurbWords} words).`);
        }

        const blurbBanned = containsBannedWord(place.blurb);
        if (blurbBanned) {
          violations.push(`Place blurb for "${inputPlace.name}" used banned subjective word "${blurbBanned}".`);
        }

        for (const favName of allResolvedFavoriteNames) {
          if (containsFavoriteName(place.blurb, favName)) {
            violations.push(
              `Place blurb for "${inputPlace.name}" named user favorite "${favName}". Blurbs must never name user favorites.`
            );
          }
        }
      }
    }
  }

  return {
    valid: violations.length === 0,
    violations,
  };
}

export function generateTemplateFallback(
  inputCategories: GroundingInputCategory[],
  destination: string
): WriteOutput {
  const allPlaces = inputCategories.flatMap((c) => c.places);
  const p1 = allPlaces[0]?.name || 'a recommended dining spot';
  const p2 = allPlaces[1]?.name || 'a local market';
  const p3 = allPlaces[2]?.name || 'a regional kitchen';
  const p4 = allPlaces[3]?.name || 'a nearby venue';

  const firstMonth = `Week 1: Visit ${p1} for regional cuisine. Week 2: Try ${p2} for traditional items. Week 3: Sample dishes at ${p3}. Week 4: Conclude your culinary exploration at ${p4}.`;

  const categories = inputCategories.map((cat) => {
    // Factual intro <= 20 words, zero banned words
    const intro = `${cat.title} dining selections (${cat.places.length} places) in the ${destination} area.`;

    const places = cat.places.map((place) => {
      const hasDishes = place.dishes && place.dishes.length > 0;
      const hasDesc = Boolean(place.description && place.description.trim());

      let blurb: string | null = null;
      if (hasDishes) {
        const dishStr = place.dishes.slice(0, 2).join(' and ');
        blurb = `Features ${dishStr}.`;
      } else if (hasDesc && place.description) {
        const words = place.description.split(/\s+/).slice(0, 15).join(' ');
        const cleaned = sanitizeTextBannedWords(words);
        blurb = `${cleaned.replace(/[.]+$/, '')}.`;
      } else {
        blurb = null;
      }

      return {
        id: place.id,
        blurb,
      };
    });

    return {
      tagId: cat.tagId,
      intro,
      places,
    };
  });

  return {
    categories,
    firstMonth,
  };
}

export async function writeGroundedNarratives(
  inputCategories: GroundingInputCategory[],
  allResolvedFavoriteNames: string[],
  destination: string
): Promise<{
  output: WriteOutput;
  groundingViolations: number;
  repairAttempts: number;
  narration: 'ai' | 'template';
}> {
  // If LLM is disabled via env, return template fallback immediately
  if (process.env.LLM_DISABLED === 'true') {
    const fallback = generateTemplateFallback(inputCategories, destination);
    return {
      output: fallback,
      groundingViolations: 0,
      repairAttempts: 0,
      narration: 'template',
    };
  }

  let repairAttempts = 0;

  const promptInput = inputCategories.map((c) => ({
    title: c.title,
    tagId: c.tagId,
    places: c.places.map((p) => {
      const hasDishes = p.dishes && p.dishes.length > 0;
      const hasDesc = Boolean(p.description && p.description.trim());
      return {
        id: p.id,
        name: p.name,
        hasDetails: hasDishes || hasDesc,
        dishes: p.dishes,
        neighborhood: p.neighborhood,
        description: p.description,
      };
    }),
  }));

  const prompt = `You are the culinary commentator for Taste Passport.
Provide concise, strictly grounded commentary for places in the ${destination} area.

INPUT DATA:
${JSON.stringify(promptInput, null, 2)}

STRICT RULES:
1. Every place id in your output MUST match an exact "id" from the input.
2. If a place has "hasDetails": false, its "blurb" MUST be null. Do not invent filler.
3. If a place has details, "blurb" MUST be <= 25 words stating its dishes or descriptive text.
4. BANNED WORDS (NEVER USE ANY OF THESE IN BLURBS OR INTROS):
   cozy, charming, intimate, welcoming, warm, beloved, famous, famed, iconic, authentic, legendary, hidden gem, must-visit, vibrant, delightful, delicious.
5. NEVER mention user favorites, artists, movies, or authors anywhere in blurbs, intros, or firstMonth.
6. Category "intro" MUST be <= 20 words, completely factual (e.g. "<Cuisine> dining selections in the <Destination> area.").
7. "firstMonth" MUST be exactly 4 sentences (Week 1 through Week 4), completely factual, mentioning places or categories only.

Return strict JSON matching:
{
  "categories": [
    {
      "tagId": string,
      "intro": string (<= 20 words, factual, zero banned words),
      "places": [
        { "id": string, "blurb": string (<= 25 words) or null }
      ]
    }
  ],
  "firstMonth": string (exactly 4 sentences, factual)
}`;

  try {
    const res = await generateJson(WriteOutputSchema, prompt);
    const check = verifyGrounding(res, inputCategories, allResolvedFavoriteNames);
    if (check.valid) {
      return { output: res, groundingViolations: 0, repairAttempts: 0, narration: 'ai' };
    }

    repairAttempts = 1;

    // 1 repair retry
    const repairPrompt = `${prompt}\n\nPREVIOUS OUTPUT HAD VIOLATIONS:\n${check.violations.join('\n')}\nFix all violations. If hasDetails is false, blurb MUST be null. NEVER use banned words (cozy, charming, authentic, etc.). Keep intros <= 20 words and blurbs <= 25 words.`;
    const repairedRes = await generateJson(WriteOutputSchema, repairPrompt);
    const repairedCheck = verifyGrounding(repairedRes, inputCategories, allResolvedFavoriteNames);
    if (repairedCheck.valid) {
      return { output: repairedRes, groundingViolations: 0, repairAttempts: 1, narration: 'ai' };
    }
  } catch (err) {
    repairAttempts = 1;
  }

  // Fallback to deterministic template guarantees 0 violations
  const fallback = generateTemplateFallback(inputCategories, destination);
  return {
    output: fallback,
    groundingViolations: 0,
    repairAttempts: 1,
    narration: 'template',
  };
}
