# Taste Passport 🌍

Taste Passport connects a traveler or immigrant's cultural favorites from home—filmmakers, musicians, authors, and media—to real dining venues in any destination city. While conventional travel guides and large language models rely on generic popularity lists or unverified place suggestions, Taste Passport derives cuisines from the tags on Qloo's place results (signal results vs a no-signal baseline) and dining venues that resonate with the user's cultural taste profile. The AI never guesses or picks venues; Qloo selects the places, and Google Gemini writes concise, strictly grounded descriptions based only on menu and venue properties from Qloo.

## Target Audience
Taste Passport is built for:
- **Relocating Professionals & Expats**: Discovering comforting, culturally resonant culinary communities in new cities.
- **Diaspora & Heritage Seekers**: Finding regional micro-cuisines (e.g. regional Kerala or Punjabi dining) rather than generic pan-national chains.
- **International Students**: Navigating unfamiliar grocery stops and regional eateries.
- **Curious Cultural Travelers**: Experiencing local cities through affinity graphs connected to the music, cinema, and literature they love.

---

## Live Demo Flow & Expected Outputs

1. **Step 1 — Input Cultural Favorites & Destination**:
   - The user inputs a destination city (e.g. Toronto, London, New York) and 3 to 8 cultural favorites (movies, musicians, authors, shows).
   - A one-click example button (⚡ *Kerala to Toronto*) pre-populates 5 Malayali cultural icons.
   - The user clicks **Find My Matches**.

2. **Step 2 — Disambiguate Cultural Entities**:
   - Taste Passport queries Qloo's `/search` endpoint to find exact candidate entities.
   - If an entity has multiple releases (e.g. *Drishyam* 2013 Malayalam original vs 2015 Hindi remake), the user selects the intended version to avoid silent cultural drift.

3. **Step 3 — Build Passport & Taste Intelligence Results**:
   - An event stream shows live pipeline progress: entity resolution, cuisine inference, venue querying, and commentary generation.
   - **Inferred Cuisines & Honest Badges**: Displays categories ordered by cultural specificity (e.g. *Kerala* before *South Indian* before *Indian*). Badges report exact counts against local baseline: `"11 of Qloo's top 50 places for your taste are tagged Kerala; 0 of the top 50 for a generic Toronto baseline."` Multipliers are shown only when the baseline count is $\ge 3$.
   - **Taste Lift Metric**: Shows the percentage of top recommendations that wouldn't appear without the user's taste signals.
   - **Place cards from Qloo**: Up to 6 non-duplicated venues per category with address from Qloo, rating, dishes, and website links. Blurbs are only displayed if menu or description data exists in Qloo.
   - **Signal Check**: Shows which specific cultural favorites actively drove regional cuisine enrichment, and clearly labels unaligned favorites as *"Pulled in a different direction (not used for the categories above)"*.
   - **First-Month Settling Guide**: A chronological 4-week exploration plan grounded entirely in the discovered venues.

---

## Architecture

```
User Favorites (Movies, Artists, Authors) + Destination City
                      │
                      ▼
            [ Qloo Entity Search ]  ──> Disambiguate entities (Original vs Remake)
                      │
                      ▼
         [ Qloo /v2/insights (50) ] ──> Parallel query with combined signals
         [ Baseline /v2/insights  ] ──> Parallel query without signals (city baseline)
         [ Single-signal queries  ] ──> Parallel attribution probe per favorite
                      │
                      ▼
         [ Taste Inference Engine ] ──> Extract cuisine tags, compute enrichment:
                                        Enrichment = (cSig + 1) / (cBase + 1)
                                        Apply cSig >= 3 threshold gate
                                        Sort by specificity (ascending cSig)
                                        Evaluate Grocery Coherence Gate
                      │
                      ▼
         [ Qloo Venue Resolution  ] ──> Retrieve top 50 places per inferred tag
                                        Filter closed & banquet venues
                                        Sequential claiming (shared claimed-set)
                                        Compute raw top-10 taste lift
                      │
                      ▼
           [ LLM Grounding Writer ] ──> Gemini 3.5 Flash Lite writes blurbs
           (Strict Boundary Check)       using ONLY dishes & descriptions from Qloo.
                      │                 (If elapsed > 40s or quota error, fallback
                      │                  gracefully to deterministic template).
                      ▼
            Taste Passport UI / SSE Stream
```

---

## Exact Qloo Endpoints & Features Used

1. **Entity Search (`GET /search`)**:
   - `query`: Favorite title or artist name.
   - `types`: Filtered entity URN (`urn:entity:movie`, `urn:entity:artist`, `urn:entity:person`, `urn:entity:tv_show`).
   - Retrieves canonical `entity_id`, title, release year, and description.

2. **Taste Insights (`GET /v2/insights`)**:
   - `filter.type`: `urn:entity:place`
   - `signal.interests.entities`: Comma-separated list of resolved entity IDs.
   - `filter.location.query`: Destination city / metropolitan area.
   - `filter.tags`: Target cuisine/genre tag URN (e.g. `urn:tag:genre:place:restaurant` or specific cuisine URNs).
   - `take`: 50 items for robust sample distribution.

3. **Place Tag Extraction & Metadata**:
   - Extracts cuisine tags (`urn:tag:cuisine:qloo:*`, `urn:tag:genre:place:restaurant:*`) directly from returned venue entities.
   - Reads `properties.specialty_dishes`, `properties.description`, `properties.short_descriptions`, `properties.business_rating`, `properties.website`, and `properties.address`.

---

## Cuisine Inference Algorithm

1. **Combined Signal Query**: Taste Passport queries Qloo's `/v2/insights` for the top 50 dining spots matching all resolved cultural favorites combined with the destination city.
2. **Generic City Baseline Query**: Simultaneously, an identical query is executed without taste signals to measure the destination city's natural, unweighted cuisine distribution.
3. **Tag Enrichment Ratio**: Every cuisine tag across both pools is extracted, and enrichment is computed via Laplace-smoothed frequency: $\text{Enrichment} = \frac{c_{sig} + 1}{c_{base} + 1}$.
4. **Statistical Relevance Gate**: Tags must have $c_{sig} \ge 3$ and exclude generic dining tags (`Restaurant`, `Food`, `Cuisine`, `Dining`) to eliminate single-place noise.
5. **Specificity Ordering**: Selected cuisines are ordered by ascending $c_{sig}$ (rarer, more specific tags like *Kerala* or *Punjabi* precede broad tags like *Indian*), ensuring regional spots are claimed by the most specific category first.
6. **Grocery Coherence Gate**: Cultural grocery categories are included only if they return $\ge 3$ venues and $\ge 2$ venues appear in the primary cuisine pool or carry its cuisine tag, preventing disconnected or generic supermarkets from cluttering results.

---

## Role of Gemini & Graceful Degradation

- **Role of the LLM**: Google Gemini (`gemini-3.5-flash-lite`) acts strictly as a narrative writer, not a discovery engine. Gemini is strictly prohibited from inventing places, fabricating attributes, using subjective filler words (*cozy*, *charming*, *legendary*), or naming user favorites in venue blurbs.
- **Provenance Rule**: If a place does not have specialty dishes or an official description in Qloo's response, its blurb is strictly `null` (no filler text generated).
- **Deadline Guard & Fail-Safe Fallback**: If total execution exceeds 40 seconds before writing or if Gemini API limits are reached, Taste Passport automatically falls back to a deterministic template (`meta.narration = "template"`), displaying all places and data from Qloo without interruption.

---

## Known Limitations

- **Metropolitan Coverage**: Qloo's place graph indexes major metropolitan areas (e.g. Greater Toronto, Greater London); suburban boundaries may extend beyond municipal city cores.
- **Operating Hours & Reservations**: Taste Passport discovers cultural dining resonance and drops venues flagged closed by Qloo; it does not check live opening hours or table reservations.
- **API Free-Tier Rate Limits**: Free-tier Gemini quota (15 RPM) is protected by in-memory caching and client-side IP rate limiting (6 runs/hour per IP).

---

## Evaluation Summary

All figures are aggregate metrics derived from `docs/NUMBERS.md` and benchmarked via `scripts/baseline.ts` ($n = 5$ places recommended per profile, $n = 15$ total):

| Profile | Destination | Cuisine Agreement with LLM | Matched in Metro Area ($n=5$) (Rough Indicator) |
| :--- | :---: | :---: | :---: |
| **Profile 1 (Kerala Favorites)** | Toronto | 2 / 3 (67%) | 2 / 5 (40%) |
| **Profile 2 (Punjabi Favorites)** | London | 2 / 3 (67%) | 5 / 5 (100%) |
| **Control (Indie/Western)** | Toronto | 0 / 3 (0%) | 4 / 5 (80%) |
| **Overall Aggregate** | — | 4 / 9 (44.4%) | 11 / 15 (73.3%) |

Results depend on which Qloo entity each favorite is resolved to; counts shown are examples.

---

## Local Development & Setup

### Prerequisites
- Node.js 18+ (tested on Node 20 / 24)
- Qloo API Key (`QLOO_API_KEY`)
- Google Gemini API Key (`GEMINI_API_KEY`)

### Installation & Environment
1. Clone the repository and install dependencies:
   ```bash
   npm install
   ```
2. Create `.env.local` with your API credentials:
   ```env
   QLOO_API_KEY=your_qloo_hackathon_key_here
   GEMINI_API_KEY=your_gemini_api_key_here
   ```

### Running Locally
```bash
# Start Next.js development server
npm run dev

# Run automated smoke test against local server
npm run smoke -- http://localhost:3000
```

### Verification & Audit Commands
```bash
# 1. Verify zero secrets committed or exposed
npm run check:secrets

# 2. Run TypeScript typecheck
npm run typecheck

# 3. Run Vitest unit tests (SYNTHETIC fixtures only)
npm test

# 4. Run end-to-end multi-profile verification
npm run e2e

# 5. Run blurb provenance audit (verifies 0 blurbs without source)
npm run audit:blurbs

# 6. Run offline LLM vs Qloo baseline comparison
npm run baseline
```

---

## Data Privacy & Storage Disclaimer
Taste Passport does not store user data, session history, or personal profiles. In strict accordance with Qloo API licensing terms, raw Qloo response payloads are never persisted to databases or committed to version control; test fixtures are entirely synthetic, and documentation contains aggregate metrics only.

## License
MIT License — Copyright (c) 2026 Taste Passport Contributors.
