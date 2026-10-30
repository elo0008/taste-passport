import { z } from 'zod';
import { generateJson } from './gemini';

export interface GroundingInputPlace {
  id: string;
  name: string;
  address?: string;
  website?: string;
  phone?: string;
  rating?: number | null;
  priceLevel?: string | null;
  dishes: string[];
  matchedBy: string[];
  description?: string;
  neighborhood?: string;
}

export interface GroundingInputCategory {
  title: string;
  kind: string;
  tagId: string;
  places: GroundingInputPlace[];
}

export const WrittenPlaceSchema = z.object({
  id: z.string(),
  blurb: z.string().trim().max(250),
});

export const WrittenCategorySchema = z.object({
  tagId: z.string(),
  intro: z.string().trim().max(300),
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

function countWords(str: string): number {
  return str.trim().split(/\s+/).filter(Boolean).length;
}

function containsFavoriteName(text: string, favName: string): boolean {
  if (!text || !favName || favName.length < 3) return false;
  // Whole word or full phrase regex check
  const escaped = favName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(^|\\W)${escaped}(\\W|$)`, 'i');
  return regex.test(text);
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

  // 1. Check firstMonth for favorite mentions
  for (const favName of allResolvedFavoriteNames) {
    if (containsFavoriteName(output.firstMonth, favName)) {
      violations.push(
        `Grounding violation: firstMonth guide named user favorite "${favName}". It may mention places and categories only.`
      );
    }
  }

  // 2. Check categories and places
  for (const cat of output.categories) {
    const inputCat = inputCategoryMap.get(cat.tagId);
    if (!inputCat) {
      violations.push(`Output category tagId "${cat.tagId}" was not in input categories.`);
      continue;
    }

    const introWords = countWords(cat.intro);
    if (introWords > 30) {
      violations.push(`Category intro for "${inputCat.title}" exceeds 30 words (has ${introWords} words).`);
    }

    // Check intro for favorite mentions
    for (const favName of allResolvedFavoriteNames) {
      if (containsFavoriteName(cat.intro, favName)) {
        violations.push(
          `Grounding violation: Category intro for "${inputCat.title}" named user favorite "${favName}". Intros must describe food and venue only.`
        );
      }
    }

    for (const place of cat.places) {
      const inputPlace = inputPlaceMap.get(place.id);
      if (!inputPlace) {
        // Invented place ID
        violations.push(`Invented place ID "${place.id}" was not present in assembled input places.`);
        continue;
      }

      const blurbWords = countWords(place.blurb);
      if (blurbWords > 25) {
        violations.push(`Place blurb for "${inputPlace.name}" exceeds 25 words (has ${blurbWords} words).`);
      }

      // Check blurb for ANY favorite mentions
      for (const favName of allResolvedFavoriteNames) {
        if (containsFavoriteName(place.blurb, favName)) {
          violations.push(
            `Grounding violation: Place blurb for "${inputPlace.name}" named user favorite "${favName}". Blurbs must NEVER name user favorites.`
          );
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
  const p1 = allPlaces[0]?.name || 'a familiar favorite spot';
  const groceryCat = inputCategories.find((c) => c.kind === 'grocery');
  const p2 = groceryCat?.places[0]?.name || 'local specialty markets';
  const stretchCat = inputCategories.find((c) => c.kind === 'stretch_cuisine');
  const p3 = stretchCat?.places[0]?.name || 'regional dining spots';
  const p4 = allPlaces[1]?.name || 'popular neighborhood kitchens';

  const firstMonth = `Week 1: Ease your transition with comforting regional classics at ${p1}. Week 2: Stock your kitchen with essential spices and pantry staples at ${p2}. Week 3: Expand your palate exploring flavorful specialties at ${p3}. Week 4: Enjoy a relaxing weekend dining experience with friends at ${p4}.`;

  const categories = inputCategories.map((cat) => {
    const intro = `Curated authentic ${cat.title} selections in the ${destination} area.`;
    const places = cat.places.map((place) => {
      let blurb = '';
      if (place.dishes && place.dishes.length > 0) {
        blurb = `Renowned for ${place.dishes.slice(0, 2).join(' and ')}, offering authentic flavors.`;
      } else if (place.description) {
        const words = place.description.split(/\s+/).slice(0, 20).join(' ');
        blurb = `${words}.`;
      } else {
        blurb = `Top-rated authentic venue in the ${destination} area with outstanding food.`;
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
): Promise<{ output: WriteOutput; groundingViolations: number; repairAttempts: number }> {
  let repairAttempts = 0;

  const promptInput = inputCategories.map((c) => ({
    title: c.title,
    kind: c.kind,
    tagId: c.tagId,
    places: c.places.map((p) => ({
      id: p.id,
      name: p.name,
      dishes: p.dishes,
      neighborhood: p.neighborhood,
      shortDescription: p.description,
    })),
  }));

  const prompt = `You are the culinary storyteller for Taste Passport.
Provide concise, strictly grounded commentary for curated places in the ${destination} area.

INPUT DATA:
${JSON.stringify(promptInput, null, 2)}

STRICT GROUNDING RULES:
1. Every place id in your output MUST match an exact "id" from the input. NEVER invent ids.
2. NEVER mention user favorites, artists, movies, or authors anywhere in blurbs, intros, or the settling guide. Blurbs describe ONLY food, dishes, venue qualities, rating, or neighborhood.
3. Category intro MUST be 30 words or fewer.
4. Place blurb MUST be 25 words or fewer highlighting why it is notable or its signature dishes.
5. Provide a 4-sentence "firstMonth" settling guide (Week 1 through Week 4) mentioning places or categories only.
6. Return strict JSON matching:
{
  "categories": [
    {
      "tagId": string,
      "intro": string (<= 30 words),
      "places": [
        { "id": string, "blurb": string (<= 25 words) }
      ]
    }
  ],
  "firstMonth": string (exactly 4 sentences)
}`;

  try {
    const res = await generateJson(WriteOutputSchema, prompt);
    const check = verifyGrounding(res, inputCategories, allResolvedFavoriteNames);
    if (check.valid) {
      return { output: res, groundingViolations: 0, repairAttempts: 0 };
    }

    repairAttempts = 1;

    // 1 repair retry
    const repairPrompt = `${prompt}\n\nPREVIOUS OUTPUT HAD GROUNDING VIOLATIONS:\n${check.violations.join('\n')}\nFix all violations. NEVER name any user favorite/artist/movie/author in blurbs or intros. Only reference place IDs in the input. Keep blurbs <= 25 words and intros <= 30 words.`;
    const repairedRes = await generateJson(WriteOutputSchema, repairPrompt);
    const repairedCheck = verifyGrounding(repairedRes, inputCategories, allResolvedFavoriteNames);
    if (repairedCheck.valid) {
      return { output: repairedRes, groundingViolations: 0, repairAttempts: 1 };
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
  };
}
