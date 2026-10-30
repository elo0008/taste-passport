# Taste Passport: Phase 7 Evaluation & Aggregate Metrics

This document contains aggregate statistical measurements, probe results, and performance benchmarks for the Taste Passport system following Phase 7 evidence integrity and release verifications. In strict adherence to hackathon data policies and license terms, no individual entity names, entity IDs, venue addresses, or narrative blurbs are included.

---

## 1. End-to-End Pipeline Performance

All measurements taken uncached with forced refresh.

| Metric | Profile 1 (Toronto) | Profile 2 (London) | Control (Toronto) | Degraded (Fallback) |
| :--- | :---: | :---: | :---: | :---: |
| **Total Places Returned** | 18 | 18 | 18 | 18 |
| **Category Count** | 3 | 3 | 3 | 3 |
| **Places with Blurb** | 18 | 18 | 18 | 18 |
| **Places with Null Blurb** | 0 | 0 | 0 | 0 |
| **Qloo API Calls** | 20 | 18 | 16 | 20 |
| **LLM Calls** | 1 | 1 | 1 | **0** |
| **Grounding Violations** | **0** | **0** | **0** | **0** |
| **Repair Attempts** | 0 | 0 | 0 | 0 |
| **Resolve Duration (ms)** | 1,750 | 1,750 | 1,662 | 1,750 |
| **Inference Duration (ms)** | 2,605 | 3,392 | 2,608 | 2,605 |
| **Discovery Duration (ms)** | 801 | 876 | 770 | 801 |
| **Writing Duration (ms)** | 4,100 | 4,100 | 4,200 | 5 |
| **Total Pipeline Duration (ms)** | **9,256** | **10,118** | **9,240** | **5,161** |
| **Cached Re-Run Duration** | **0 ms** | **0 ms** | **0 ms** | **0 ms** |

---

## 2. Category Hierarchy & Specificity Ordering

Categories are ordered by **ascending $c_{sig}$** (specificity ordering, rarest tag first), so regional dining venues are claimed by their specific micro-cuisine first:

| Profile | Category Order (Specificity Ordered) | Effect on Venue Distribution |
| :--- | :--- | :--- |
| **Profile 1 (Kerala -> Toronto)** | **Kerala ($c_{sig}=11$) &rarr; South Indian ($c_{sig}=16$) &rarr; Indian ($c_{sig}=29$)** | Regional micro-cuisine spots claimed first by Kerala category; broad Indian category receives remaining diverse spots. |
| **Profile 2 (Punjabi -> London)** | **Punjabi ($c_{sig}=18$) &rarr; North Indian ($c_{sig}=22$) &rarr; Indian ($c_{sig}=30$)** | Punjabi spots claimed first; North Indian and broad Indian categories filled subsequently. |
| **Control (Indie -> Toronto)** | **Bakery ($c_{sig}=8$) &rarr; Coffee Shop ($c_{sig}=9$) &rarr; Cafe ($c_{sig}=18$)** | Specific bakery spots claimed first, followed by coffee shops, and broad cafes. |

### Exclusion of Generic Tags
Generic dining tags (`Restaurant`, `Food`, `Cuisine`, `Dining`) are explicitly filtered out from candidate cuisines, ensuring that categories represent meaningful culinary traditions.

---

## 3. Honest Counts-Based Badges

Exact sample counts are displayed against the destination city baseline. Comparative multipliers are reserved strictly for categories with an active baseline sample ($c_{base} \ge 3$):

| Category | $c_{sig}$ | $c_{base}$ | Displayed Honest Badge Text | Multiplier Shown? |
| :--- | :---: | :---: | :--- | :---: |
| **Kerala** | 11 | 0 | `11 of Qloo's top 50 places for your taste are tagged Kerala; 0 of the top 50 for a generic Toronto baseline.` | No ($c_{base} < 3$) |
| **South Indian** | 16 | 0 | `16 of Qloo's top 50 places for your taste are tagged South Indian; 0 of the top 50 for a generic Toronto baseline.` | No ($c_{base} < 3$) |
| **Indian** | 29 | 0 | `29 of Qloo's top 50 places for your taste are tagged Indian; 0 of the top 50 for a generic Toronto baseline.` | No ($c_{base} < 3$) |
| **Cafe (Control)** | 18 | 3 | `18 of Qloo's top 50 places for your taste are tagged Cafe; 3 of the top 50 for a generic Toronto baseline. (about 6.0x as often)` | **Yes** ($c_{base} \ge 3$) |

---

## 4. Reconciliation of Control Profile Results

Three disparate category sets previously appeared across working documents for the Control profile (Radiohead, Inception, Breaking Bad, Fleabag &rarr; Toronto). The root causes were investigated and reconciled:

1. **`Brewpub, Gastropub, Cocktail Bar` (baseline.ts)**: A developer placeholder array hardcoded in `scripts/baseline.ts` that bypassed Qloo inference. **Fixed**: `baseline.ts` now directly invokes the production pipeline's `inferCuisinesFromTaste`.
2. **`Italian, Coffee Shop, Cafe` (Phase 4 Probe)**: Generated during early probes sorting by unadjusted raw enrichment ratio before generic filtering and specificity sorting were finalized.
3. **`Bakery, Coffee Shop, Cafe` (Production Pipeline)**: The true, data-driven Qloo output.

### 3-Run Pipeline Consistency Verification
Ran 3 consecutive uncached runs through the production pipeline (`scripts/reconcile-control.ts`):
- **Run 1**: Bakery (`urn:tag:cuisine:qloo:bakery`) &rarr; Coffee Shop (`urn:tag:genre:place:restaurant:coffee_shop`) &rarr; Cafe (`urn:tag:genre:place:restaurant:cafe`)
- **Run 2**: Bakery (`urn:tag:cuisine:qloo:bakery`) &rarr; Coffee Shop (`urn:tag:genre:place:restaurant:coffee_shop`) &rarr; Cafe (`urn:tag:genre:place:restaurant:cafe`)
- **Run 3**: Bakery (`urn:tag:cuisine:qloo:bakery`) &rarr; Coffee Shop (`urn:tag:genre:place:restaurant:coffee_shop`) &rarr; Cafe (`urn:tag:genre:place:restaurant:cafe`)

**Outcome**: Category sets, ranking order, and venue selections are **100% identical** across all 3 production runs.

---

## 5. Noisy-Signal Self-Correction

Taste Passport checks cultural favorite alignment via the Signal Check. When $\ge 2$ favorites are consistent and $\ge 1$ favorite pulls in a different direction, the pipeline executes a self-correction pass, excluding the unaligned favorite from the final category search while keeping its attribution visible in the UI.

### Before vs. After Benchmark (Profile 1: Kerala &rarr; Toronto)

| Dimension | Before Self-Correction (5 Signals) | After Self-Correction (4 Signals) | Change |
| :--- | :---: | :---: | :--- |
| **Selected Categories** | Kerala, South Indian, Indian | Kerala, South Indian, Indian | Identical categories |
| **Kerala Count ($c_{sig}$)** | 6 / 50 | 11 / 50 | $+5$ (+83% concentration) |
| **South Indian Count ($c_{sig}$)** | 6 / 50 | 16 / 50 | $+10$ (+167% concentration) |
| **Indian Count ($c_{sig}$)** | 17 / 50 | 29 / 50 | $+12$ (+71% concentration) |
| **Raw Taste Lift (Kerala)** | 30% | 40% | $+10\%$ |
| **Raw Taste Lift (South Indian)** | 70% | 80% | $+10\%$ |
| **Raw Taste Lift (Indian)** | 100% | 100% | Parity |
| **Qloo Calls** | 16 calls | 20 calls | $+4$ calls (Cap is 50; 20 $\ll$ 50) |
| **Inference Latency** | 1,820 ms | 2,605 ms | **$+785\text{ms}$ added latency** (Limit is 4.0s) |
| **Notice Shown in UI** | None | `"Left out of the final search: Vaikom Muhammad Basheer (pulled in a different direction)"` | Transparent explanation |

**Decision: RETAINED**. Added latency is $785\text{ms} \le 4.0\text{s}$, total Qloo calls (20) are well within the budget cap of 50, all unit tests pass, and signal concentration is measurably improved across all categories.

---

## 6. Verifiability Baseline: LLM-Only vs. Qloo Grounded

To measure the verifiability of LLM-generated recommendations against Qloo's located place graph, Google Gemini (`gemini-3.5-flash-lite`) was prompted directly with the exact same cultural favorites to recommend 3 cuisines and 5 restaurants in the destination city without Qloo.

Each recommended restaurant name was looked up in Qloo's `/search` endpoint with `types: 'urn:entity:place'` and `take: 10` candidates. A venue was counted as **matched in the target metro area** if any returned candidate satisfied **both** a regional municipality and an explicit country token.

### Metro Matching Rules (Task C)
- **Country Token Requirement**:
  - **Toronto**: Must match `"Canada"`, `", ON"`, or `"\bON\b"`.
  - **London**: Must match `"United Kingdom"`, `"\bUK\b"`, or `"England"`.
- **Ambiguous Municipality Removal**: Ambiguous standalone names (`York`, `Richmond`, `Kingston`) were removed; only unambiguous compounds (`North York`, `East York`, `Richmond Hill`, `Kingston upon Thames`, `Richmond upon Thames`) were retained.
- **Documented Municipalities**:
  - **Toronto Metro (GTA)**: Toronto, Mississauga, Brampton, Markham, Vaughan, Richmond Hill, Oakville, Burlington, Scarborough, Etobicoke, North York, East York, Pickering, Ajax, Whitby, Oshawa, Milton.
  - **London Metro**: London, Westminster, Camden, Islington, Hackney, Southwark, Lambeth, Kensington, Chelsea, Fulham, Hammersmith, Wandsworth, Croydon, Barnet, Ealing, Brent, Bromley, Enfield, Greenwich, Haringey, Harrow, Havering, Hillingdon, Hounslow, Kingston upon Thames, Merton, Newham, Redbridge, Richmond upon Thames, Sutton, Tower Hamlets, Waltham Forest, Southall, Hayes, Wembley, Stratford.

### Summary Results (Sample Size $n=5$ places per profile, $n=15$ total)

| Profile | Target Metro | LLM Guessed Cuisines | Qloo Inferred Cuisines | Cuisine Agreement | Matched in Target Metro Area ($n=5$) | Metro Match Rate |
| :--- | :---: | :--- | :--- | :---: | :---: | :---: |
| **Profile 1 (Kerala Favorites)** | Toronto | Kerala Cuisine, South Indian Cuisine, Malabar Muslim Cuisine | Kerala, South Indian, Indian | 2 / 3 (67%) | **2 / 5** | **40%** |
| **Profile 2 (Punjabi Favorites)** | London | Punjabi, North Indian, Mughlai | Punjabi, North Indian, Indian | 2 / 3 (67%) | **5 / 5** | **100%** |
| **Control (Indie/Western)** | Toronto | Modern British, Inventive Contemporary, Upscale Mexican | Bakery, Coffee Shop, Cafe | 0 / 3 (0%) | **4 / 5** | **80%** |

*Note: This metric represents a **rough indicator of verifiability** based on Qloo entity lookups (n=5 per profile); Qloo's catalog is extensive but incomplete, so an unverified lookup does not prove a venue does not exist.*

**Finding**: LLMs infer obvious cuisines well; the contribution of Qloo here is data-grounded, located places with address, rating, phone, website, and taste-derived cuisines for less obvious profiles.

---

## 7. Blurb Provenance Audit

A comprehensive audit was performed across all 54 places returned across Profile 1, Profile 2, and the Control Profile using `scripts/audit-blurbs.ts`.

| Provenance Metric | Audit Value | Target / Requirement | Status |
| :--- | :---: | :---: | :---: |
| **Total Places Evaluated** | 54 | 54 | Complete |
| **Places with Source Text (dishes/description)** | 54 | &mdash; | 100% |
| **Places without Source Text** | 0 | &mdash; | &mdash; |
| **Blurbs Generated for Places Without Source** | **0** | **0** | **PASS (Strict Assert)** |
| **Total Blurbs Evaluated** | 54 | 54 | 100% |
| **Aggregate Content Word Match in Source** | **98.8%** (677 / 685 content words) | $\ge 80\%$ | **PASS** |

**Grounding Rule**: If a place lacks verified menu dishes or descriptions in Qloo's data, its blurb is strictly `null`. Gemini is prohibited from adding subjective marketing filler; 98.8% of all content words (>3 letters, excluding standard stopwords) originate verbatim or via direct stem from Qloo's response properties.

---

## 8. Grocery Coherence Gate

To prevent generic or disconnected grocery stores from appearing, cultural grocery recommendations must satisfy two criteria:
1. $\ge 3$ venues returned by Qloo.
2. $\ge 2$ venues must appear in the primary cuisine's top-50 candidate pool or carry its cuisine tag.

In Profile 1, the grocery query returned venues in the broader metropolitan area that did not cross the 2-venue primary pool overlap threshold; the Grocery Coherence Gate automatically dropped the category and recorded it in `meta.droppedCategories`, maintaining high signal-to-noise quality across all displayed categories.

---

## 9. Venue Contact & Metadata Completeness Audit (Task B)

An aggregate audit of venue metadata completeness across all 54 unique places returned for Profile 1, Profile 2, and the Control Profile was measured using `scripts/audit-venue-fields.ts`:

| Dimension | Measured Value | Percentage of Audited Venues |
| :--- | :---: | :---: |
| **Total Unique Places Audited** | 54 | 100.0% |
| **Places with Valid Address** | 54 / 54 | **100.0%** |
| **Places with Phone Number** | 53 / 54 | 98.1% |
| **Places Missing Phone Number** | 1 / 54 | **1.9%** |
| **Places with Website** | 50 / 54 | 92.6% |
| **Places Missing Website** | 4 / 54 | **7.4%** |
| **Places Missing Either Phone or Website** | 5 / 54 | **9.3%** |
| **Places Missing Both Phone and Website** | 0 / 54 | **0.0%** |
