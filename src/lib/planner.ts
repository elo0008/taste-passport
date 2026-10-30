import { z } from 'zod';
import { generateJson } from './gemini';

export type IntentKind = 'home_cuisine' | 'stretch_cuisine' | 'grocery';

export const CategoryIntentSchema = z.object({
  kind: z.enum(['home_cuisine', 'stretch_cuisine', 'grocery']),
  keyword: z.string().trim().min(2).max(40),
  reason: z.string().trim().max(160),
});

export type CategoryIntent = z.infer<typeof CategoryIntentSchema>;

export const PlannerOutputSchema = z.object({
  culture: z.string().trim().min(2).max(50),
  intents: z.array(CategoryIntentSchema).min(1).max(4),
});

export type PlannerOutput = z.infer<typeof PlannerOutputSchema>;

export function validateIntentLimits(intents: CategoryIntent[]): { valid: boolean; error?: string } {
  if (intents.length > 4) {
    return { valid: false, error: `Too many intents: proposed ${intents.length}, maximum allowed is 4.` };
  }

  const homeCount = intents.filter((i) => i.kind === 'home_cuisine').length;
  const stretchCount = intents.filter((i) => i.kind === 'stretch_cuisine').length;
  const groceryCount = intents.filter((i) => i.kind === 'grocery').length;

  if (homeCount > 2) {
    return { valid: false, error: `Exceeded home_cuisine limit: proposed ${homeCount}, maximum allowed is 2.` };
  }
  if (stretchCount > 1) {
    return { valid: false, error: `Exceeded stretch_cuisine limit: proposed ${stretchCount}, maximum allowed is 1.` };
  }
  if (groceryCount > 1) {
    return { valid: false, error: `Exceeded grocery limit: proposed ${groceryCount}, maximum allowed is 1.` };
  }

  return { valid: true };
}

export function generateFallbackPlan(
  resolvedFavorites: Array<{ name: string; type: string }>,
  destination: string
): { culture: string; intents: CategoryIntent[] } {
  const combinedText = resolvedFavorites.map((f) => f.name.toLowerCase()).join(' ');

  const isKeralaOrSouthIndian =
    combinedText.includes('premam') ||
    combinedText.includes('drishyam') ||
    combinedText.includes('chithra') ||
    combinedText.includes('basheer') ||
    combinedText.includes('yesudas') ||
    combinedText.includes('kerala') ||
    combinedText.includes('rahman');

  const isPunjabi =
    combinedText.includes('diljit') ||
    combinedText.includes('dosanjh') ||
    combinedText.includes('punjab') ||
    combinedText.includes('sidhu') ||
    combinedText.includes('moose');

  if (isKeralaOrSouthIndian) {
    return {
      culture: 'Indian',
      intents: [
        {
          kind: 'home_cuisine',
          keyword: 'south indian',
          reason: `Connects with South Indian and Kerala cultural flavors in ${destination}.`,
        },
        {
          kind: 'home_cuisine',
          keyword: 'indian',
          reason: `Broader comfort dining reflecting Indian cinema and music favorites.`,
        },
        {
          kind: 'stretch_cuisine',
          keyword: 'sri lankan',
          reason: `Shares deep coastal spice traditions and regional curries.`,
        },
        {
          kind: 'grocery',
          keyword: 'indian grocery',
          reason: `Authentic regional spices and pantry staples for home cooking.`,
        },
      ],
    };
  }

  if (isPunjabi) {
    return {
      culture: 'Indian',
      intents: [
        {
          kind: 'home_cuisine',
          keyword: 'pakistani',
          reason: `Shared northern and Punjabi tandoor culinary heritage.`,
        },
        {
          kind: 'home_cuisine',
          keyword: 'indian',
          reason: `Iconic North Indian comfort food matching Punjabi cultural favorites.`,
        },
        {
          kind: 'stretch_cuisine',
          keyword: 'middle eastern',
          reason: `Shared grilled kabab traditions and flatbread dining culture.`,
        },
        {
          kind: 'grocery',
          keyword: 'indian grocery',
          reason: `Authentic regional spices, lentils, and flatbreads.`,
        },
      ],
    };
  }

  // General fallback
  return {
    culture: 'Indian',
    intents: [
      {
        kind: 'home_cuisine',
        keyword: 'indian',
        reason: `Primary cuisine aligned with cultural favorites in ${destination}.`,
      },
      {
        kind: 'stretch_cuisine',
        keyword: 'middle eastern',
        reason: `Aromatic spice-forward crossover flavors in ${destination}.`,
      },
      {
        kind: 'grocery',
        keyword: 'indian grocery',
        reason: `Specialty spices and imported regional pantry staples.`,
      },
    ],
  };
}

export async function planCategories(
  resolvedFavorites: Array<{ name: string; type: string }>,
  destination: string
): Promise<{ culture: string; intents: CategoryIntent[]; source: 'llm' | 'fallback' }> {
  const prompt = `You are a cultural taste planner for Taste Passport.
Users provide cultural favorites (artists, movies, tv shows, books, authors, brands, podcasts) and a destination city.
Your task is to identify their primary cultural heritage ("culture", e.g. "Indian", "Punjabi", "Korean", "Mexican", "Italian") and plan up to 4 category search intents for authentic food and grocery in the ${destination} area.

Cultural favorites:
${resolvedFavorites.map((f) => `- ${f.name} (${f.type})`).join('\n')}

Rules:
1. Output strict JSON matching:
{
  "culture": string (1-2 words identifying the cultural group, e.g. "Indian", "Punjabi", "Japanese"),
  "intents": [
    {
      "kind": "home_cuisine"|"stretch_cuisine"|"grocery",
      "keyword": string,
      "reason": string
    }
  ]
}
2. Intent count: Propose 4 distinct intents whenever possible (exactly 2 "home_cuisine", 1 "stretch_cuisine", and 1 "grocery") to cover daily dining, regional variety, adjacent crossover flavors, and home pantry cooking.
3. Ratio limits:
   - Exactly 2 "home_cuisine" (e.g., regional specific like "south indian" or "kerala" plus broader like "indian", or "pakistani" and "indian")
   - Exactly 1 "stretch_cuisine" (culturally adjacent cuisine sharing spice/flavor techniques, e.g. "sri lankan", "middle eastern", "caribbean", "thai")
   - Exactly 1 "grocery" (must use verified terms like "indian grocery" or "asian grocery")
4. "keyword" must be a concise 1-3 word search term for food venues (e.g., "south indian", "kerala", "indian", "pakistani", "sri lankan", "indian grocery", "thai", "ethiopian", "middle eastern").
5. "reason" must be 20 words or fewer explaining the culinary connection.
6. NEVER output tag IDs, specific restaurant names, or place IDs. Only high-level search keywords.`;

  try {
    const res = await generateJson(PlannerOutputSchema, prompt);
    const limitCheck = validateIntentLimits(res.intents);
    if (limitCheck.valid) {
      return { culture: res.culture, intents: res.intents, source: 'llm' };
    }

    // Attempt 1 repair retry
    const repairPrompt = `${prompt}\n\nPREVIOUS OUTPUT VIOLATED RULES: ${limitCheck.error}\nPlease correct and ensure: <=2 home_cuisine, <=1 stretch_cuisine, <=1 grocery, <=4 total intents.`;
    const repairedRes = await generateJson(PlannerOutputSchema, repairPrompt);
    const repairedCheck = validateIntentLimits(repairedRes.intents);
    if (repairedCheck.valid) {
      return { culture: repairedRes.culture, intents: repairedRes.intents, source: 'llm' };
    }
  } catch (err) {
    // Falls through to deterministic fallback
  }

  const fallback = generateFallbackPlan(resolvedFavorites, destination);
  return { culture: fallback.culture, intents: fallback.intents, source: 'fallback' };
}

