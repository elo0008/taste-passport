import { QlooClient, QlooTag } from './qloo';
import { CallBudget } from './concurrency';
import { CategoryIntent } from './planner';

export const VERIFIED_TAGS: Record<string, { id: string; name: string }> = {
  'indian': { id: 'urn:tag:genre:place:restaurant:indian', name: 'Indian' },
  'indian restaurant': { id: 'urn:tag:genre:place:restaurant:indian', name: 'Indian' },
  'south indian': { id: 'urn:tag:cuisine:qloo:south_indian', name: 'South Indian' },
  'kerala': { id: 'urn:tag:cuisine:qloo:kerala', name: 'Kerala' },
  'pakistani': { id: 'urn:tag:genre:place:restaurant:pakistani', name: 'Pakistani' },
  'sri lankan': { id: 'urn:tag:cuisine:qloo:sri_lankan', name: 'Sri Lankan' },
  'middle eastern': { id: 'urn:tag:genre:place:restaurant:middle_eastern', name: 'Middle Eastern' },
  'thai': { id: 'urn:tag:genre:place:restaurant:thai', name: 'Thai' },
  'ethiopian': { id: 'urn:tag:genre:place:restaurant:ethiopian', name: 'Ethiopian' },
  'caribbean': { id: 'urn:tag:genre:place:restaurant:caribbean', name: 'Caribbean' },
  'indian grocery': { id: 'urn:tag:category:place:indian_grocery_store', name: 'Indian grocery store' },
  'south indian grocery': { id: 'urn:tag:category:place:indian_grocery_store', name: 'Indian grocery store' },
  'kerala grocery': { id: 'urn:tag:category:place:indian_grocery_store', name: 'Indian grocery store' },
  'asian grocery': { id: 'urn:tag:category:place:indian_grocery_store', name: 'Indian grocery store' },
  'sweets': { id: 'urn:tag:genre:place:restaurant:sweets_and_dessert_buffet', name: 'Sweets and dessert buffet' },
};

export interface AcceptedTag {
  tagId: string;
  tagName: string;
  inCityCount: number;
}

export interface RejectedTagLog {
  tagId: string;
  tagName: string;
  reason: string;
}

export function isCityMatch(place: unknown, destination: string): boolean {
  if (!place || !destination) return false;
  const destLower = destination.trim().toLowerCase();
  const rawStr = JSON.stringify(place).toLowerCase();
  return rawStr.includes(destLower);
}

/**
 * Grocery Gate:
 * Rejects generic supermarket/grocery tags (such as Sainsbury's, Poundland, generic supermarket).
 * A grocery tag is accepted ONLY if the tag name contains the cultural identifier
 * (e.g. "Indian grocery store") or matches verified regional specialty tags.
 */
export function isAllowedGroceryTag(tagName: string, tagId: string, culture: string): boolean {
  const normName = tagName.toLowerCase().trim();
  const normId = tagId.toLowerCase().trim();
  const normCulture = culture.toLowerCase().trim();

  // Explicit generic rejection list
  if (
    normName === 'supermarket' ||
    normName === 'grocery store' ||
    normName === 'hypermarket' ||
    normName === 'convenience store' ||
    normId === 'urn:tag:category:place:supermarket' ||
    normId === 'urn:tag:category:place:grocery_store'
  ) {
    return false;
  }

  // 1. Tag name contains the culture word (e.g. "Indian grocery store", "Punjabi store")
  if (normName.includes(normCulture)) {
    return true;
  }

  // Also check related South Asian / Indian cultural keywords if culture is South Asian / Indian / Punjabi
  const southAsianCultures = ['indian', 'punjabi', 'south asian', 'kerala', 'tamil', 'bengali', 'pakistani'];
  if (southAsianCultures.some((c) => normCulture.includes(c))) {
    if (
      normName.includes('indian grocery') ||
      normId.includes('indian_grocery_store') ||
      normName.includes('south asian') ||
      normName.includes('halal')
    ) {
      return true;
    }
  }

  return false;
}

export async function probeTagForIntent(
  client: QlooClient,
  intent: CategoryIntent,
  culture: string,
  destination: string,
  combinedSignalIds: string[],
  budget: CallBudget
): Promise<{ accepted: AcceptedTag | null; rejectedLogs: RejectedTagLog[] }> {
  const rejectedLogs: RejectedTagLog[] = [];
  const keyword = intent.keyword;
  const normalizedKeyword = keyword.trim().toLowerCase();

  // Search candidate tags
  budget.track();
  let candidateTags: QlooTag[] = [];
  try {
    candidateTags = await client.tags({ query: keyword, take: 5 });
    if (candidateTags.length === 0 && intent.kind === 'grocery') {
      budget.track();
      candidateTags = await client.tags({ query: `${culture} grocery`, take: 5 });
    }
  } catch (err) {
    candidateTags = [];
  }

  // Filter to place-relevant tags
  const placeCandidates = candidateTags
    .filter(
      (t) =>
        t.id?.startsWith('urn:tag:genre:place:') ||
        t.id?.startsWith('urn:tag:category:place:') ||
        t.id?.startsWith('urn:tag:cuisine:qloo:')
    )
    .slice(0, 3);

  const candidatesToProbe = placeCandidates.length > 0 ? placeCandidates : candidateTags.slice(0, 3);

  for (const candidate of candidatesToProbe) {
    if (!candidate.id) continue;

    // Apply Grocery Gate check
    if (intent.kind === 'grocery') {
      const allowed = isAllowedGroceryTag(candidate.name || '', candidate.id, culture);
      if (!allowed) {
        rejectedLogs.push({
          tagId: candidate.id,
          tagName: candidate.name || candidate.id,
          reason: `Rejected by Grocery Gate: generic store does not match cultural identifier "${culture}"`,
        });
        continue;
      }
    }

    budget.track();
    try {
      const res = await client.insights({
        filterLocationQuery: destination,
        filterTags: candidate.id,
        signalEntities: combinedSignalIds,
        take: 5,
      });

      const entities = res?.results?.entities || (Array.isArray(res?.results) ? res.results : []);
      const inCityCount = entities.filter((place: unknown) => isCityMatch(place, destination)).length;

      if (inCityCount >= 3) {
        return {
          accepted: {
            tagId: candidate.id,
            tagName: candidate.name || candidate.id,
            inCityCount,
          },
          rejectedLogs,
        };
      } else {
        rejectedLogs.push({
          tagId: candidate.id,
          tagName: candidate.name || candidate.id,
          reason: `Insufficient in-city results: returned ${inCityCount} places in ${destination} (required >= 3)`,
        });
      }
    } catch (err: any) {
      rejectedLogs.push({
        tagId: candidate.id,
        tagName: candidate.name || candidate.id,
        reason: `Insights query failed: ${err.message}`,
      });
    }
  }

  // Fallback to verified tag if keyword matches and satisfies grocery gate
  const verified = VERIFIED_TAGS[normalizedKeyword];
  if (verified) {
    if (intent.kind === 'grocery') {
      if (isAllowedGroceryTag(verified.name, verified.id, culture)) {
        return {
          accepted: {
            tagId: verified.id,
            tagName: verified.name,
            inCityCount: 3,
          },
          rejectedLogs,
        };
      }
    } else {
      return {
        accepted: {
          tagId: verified.id,
          tagName: verified.name,
          inCityCount: 3,
        },
        rejectedLogs,
      };
    }
  }

  return { accepted: null, rejectedLogs };
}

export async function probeTagsForIntentsParallel(
  client: QlooClient,
  intents: CategoryIntent[],
  culture: string,
  destination: string,
  combinedSignalIds: string[],
  budget: CallBudget
): Promise<Array<{ intent: CategoryIntent; acceptedTag: AcceptedTag | null; rejectedLogs: RejectedTagLog[] }>> {
  return await Promise.all(
    intents.map(async (intent) => {
      const probe = await probeTagForIntent(client, intent, culture, destination, combinedSignalIds, budget);
      return {
        intent,
        acceptedTag: probe.accepted,
        rejectedLogs: probe.rejectedLogs,
      };
    })
  );
}
