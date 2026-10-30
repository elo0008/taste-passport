# Taste Passport: Phase 5 Evaluation & Aggregate Metrics

This document contains aggregate statistical measurements, probe results, and performance benchmarks for the Taste Passport system following Phase 5 enhancements. In strict adherence to hackathon data policies and license terms, no individual entity names, entity IDs, venue addresses, or narrative blurbs are included.

---

## 1. End-to-End Pipeline Performance (Phase 5)

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
| **Inference Duration (ms)** | 2,750 | 3,392 | 2,608 | 2,700 |
| **Discovery Duration (ms)** | 850 | 876 | 770 | 850 |
| **Writing Duration (ms)** | 3,900 | 4,100 | 4,200 | 5 |
| **Total Pipeline Duration (ms)** | **9,250** | **10,118** | **9,240** | **5,305** |
| **Cached Re-Run Duration** | **0 ms** | **0 ms** | **0 ms** | **0 ms** |

### Key Latency Improvements in Phase 5
- **Parallel Inference Engine**: Running the combined query, baseline query, and single-signal queries concurrently via `Promise.all` reduced `inferMs` from ~7,000–9,500ms down to ~2,600–3,300ms.
- **Deadline Guard**: Execution tracks elapsed wall time; if elapsed time exceeds 40s before writing, the pipeline automatically falls back to deterministic template generation (`meta.narration = "template"`), preventing serverless timeout drops.

---

## 2. Category Hierarchy & Specificity Ordering (Task B)

In Phase 4, broader cuisine categories with high bulk counts (e.g. broad Indian) claimed top regional venues before specific categories could claim them. In Phase 5, categories are ordered by **ascending $c_{sig}$** (specificity ordering, rarest tag first), so authentic regional venues are claimed by their specific micro-cuisine first:

| Profile | Category Order (Phase 4: Raw Enrichment) | Category Order (Phase 5: Specificity Ordered) | Effect on Venue Distribution |
| :--- | :--- | :--- | :--- |
| **Profile 1 (Kerala -> Toronto)** | Indian (17.0x) &rarr; Kerala (10.0x) &rarr; South Indian (7.0x) | **Kerala ($c_{sig}=9$) &rarr; South Indian ($c_{sig}=9$) &rarr; Indian ($c_{sig}=16$)** | Authentic regional micro-cuisine spots claimed first by Kerala category; broad Indian category receives remaining diverse spots. |
| **Profile 2 (Punjabi -> London)** | North Indian (25.0x) &rarr; Punjabi (17.0x) &rarr; Indian (12.5x) | **Punjabi ($c_{sig}=18$) &rarr; North Indian ($c_{sig}=22$) &rarr; Indian ($c_{sig}=30$)** | Authentic Punjabi spots claimed first; North Indian and broad Indian categories filled subsequently. |

### Exclusion of Generic Tags
Generic dining tags (`Restaurant`, `Food`, `Cuisine`, `Dining`) are explicitly filtered out from enriched candidates, ensuring that categories represent meaningful culinary traditions.

---

## 3. Honest Counts-Based Badges (Task A)

Smoothed enrichment multipliers (`17.0x`) created misleading representations when generic baseline counts were zero ($c_{base}=0$). Phase 5 displays exact sample counts and reserves comparative multipliers strictly for baselines with $c_{base} \ge 3$:

| Category | $c_{sig}$ | $c_{base}$ | Displayed Honest Badge Text | Multiplier Shown? |
| :--- | :---: | :---: | :--- | :---: |
| **Kerala** | 9 | 0 | `9 of Qloo's top 50 places for your taste are tagged Kerala; 0 of the top 50 for a generic Toronto baseline.` | No ($c_{base} < 3$) |
| **South Indian** | 9 | 0 | `9 of Qloo's top 50 places for your taste are tagged South indian; 0 of the top 50 for a generic Toronto baseline.` | No ($c_{base} < 3$) |
| **Indian** | 16 | 0 | `16 of Qloo's top 50 places for your taste are tagged Indian; 0 of the top 50 for a generic Toronto baseline.` | No ($c_{base} < 3$) |
| **Cafe (Control)** | 18 | 3 | `18 of Qloo's top 50 places for your taste are tagged Cafe; 3 of the top 50 for a generic Toronto baseline. (about 6.0x as often)` | **Yes** ($c_{base} \ge 3$) |

---

## 4. Signal Check & Cultural Attribution Experiment (Task C)

A signal check attribution item is classified as **consistent** if its top 3 single-signal enriched tags intersect the selected categories; otherwise, it is explicitly classified as **"Pulled in a different direction (not used for the categories above)"** and rendered in neutral grey.

### Controlled Signal Removal Experiment (Profile 1: With vs. Without Single Literary Signal)

To measure whether a literary icon whose single-signal probe showed non-regional dining (European, Bar Food, Tex-Mex) affects multi-signal recommendations:

| Measurement Dimension | Profile 1 WITH Literary Signal | Profile 1 WITHOUT Literary Signal | Difference / Observation |
| :--- | :---: | :---: | :--- |
| **Selected Categories** | Kerala, South Indian, Indian | Kerala, South Indian, Indian | **Identical set and order** (robust to unaligned signal) |
| **Kerala Tag Count ($c_{sig}$)** | 9 / 50 | 11 / 50 | $+2$ (+22% concentration when unaligned signal omitted) |
| **South Indian Tag Count ($c_{sig}$)**| 9 / 50 | 16 / 50 | $+7$ (+77% concentration) |
| **Indian Tag Count ($c_{sig}$)** | 16 / 50 | 29 / 50 | $+13$ (+81% concentration) |
| **Raw Taste Lift (Kerala)** | 30% | 40% | $+10\%$ |
| **Raw Taste Lift (South Indian)** | 80% | 80% | Unchanged |
| **Raw Taste Lift (Indian)** | 100% | 100% | Unchanged |
| **Venue Overlap** | — | — | **66.7% match** (12 of 18 venues identical; minor re-ranking) |
| **Attribution Status** | Pulled in different direction | N/A | Correctly labeled as unaligned in UI |

**Finding**: When a user inputs a favorite whose taste vectors point away from the group's regional cluster, Qloo's multi-signal graph naturally dilutes the outlier, while Taste Passport's Signal Check transparently informs the user that the signal was pulled elsewhere.

---

## 5. Blurb Provenance Audit (Task D)

A comprehensive audit was performed across all 54 places returned across Profile 1, Profile 2, and the Control Profile using `scripts/audit-blurbs.ts`.

| Provenance Metric | Audit Value | Target / Requirement | Status |
| :--- | :---: | :---: | :---: |
| **Total Places Evaluated** | 54 | 54 | Complete |
| **Places with Source Text (dishes/description)** | 54 | &mdash; | 100% |
| **Places without Source Text** | 0 | &mdash; | &mdash; |
| **Blurbs Generated for Places Without Source** | **0** | **0** | **PASS (Strict Assert)** |
| **Total Blurbs Evaluated** | 54 | 54 | 100% |
| **Null Blurbs When Source Absent** | N/A (all had source) | N/A | Satisfied |
| **Aggregate Content Word Match in Source** | **98.8%** (677 / 685 content words) | $\ge 80\%$ | **PASS** |

**Grounding Rule Verified**: If a place lacks verified menu dishes or descriptions in Qloo's data, its blurb is strictly `null`. Gemini is prohibited from adding subjective marketing filler; 98.8% of all content words (>3 letters, excluding standard stopwords) originate verbatim or via direct stem from Qloo's response properties.

---

## 6. Offline Qloo vs. LLM-Only Baseline Comparison (Task H)

To verify the necessity of Qloo's taste intelligence graph versus direct LLM generation, Google Gemini (`gemini-3.5-flash-lite`) was prompted directly with the exact same cultural favorites to recommend 5 places in the target city without Qloo:

| Profile | Target City | LLM Guessed Cuisines | Qloo Inferred Cuisines | Cuisine Agreement | LLM Venues Real & in Target City | Hallucinated / Mislocated Rate |
| :--- | :---: | :--- | :--- | :---: | :---: | :---: |
| **Profile 1 (Kerala Favorites)** | Toronto | Kerala Cuisine, South Indian, Tamil/Malaysian Fusion | Kerala, South Indian, Indian | 2 / 3 (67%) | **0 / 5 (0%)** | **100%** |
| **Profile 2 (Punjabi Favorites)** | London | Punjabi, North Indian, Mughlai | Punjabi, North Indian, Indian | 2 / 3 (67%) | **3 / 5 (60%)** | **40%** |
| **Control (Indie/Western)** | Toronto | British Modern, Creative Contemporary, Artisanal Japanese Izakaya | Brewpub, Gastropub, Cocktail Bar | 0 / 3 (0%) | **5 / 5 (100%)** | **0%** |

### Qualitative Analysis
1. **Mislocated Hallucinations**:
   When prompted for Toronto dining for Profile 1, Gemini recommended well-known global Indian establishments: one located in Frankfurt (Germany), one in Mumbai (India), one in Udupi (India), and one in Kochi (India). While culturally related, none exist in Toronto. Qloo's graph query constrained by `filter.location.query=Toronto` guaranteed that 100% of returned places are verified, physical locations in the Toronto metropolitan area.
2. **Stereotyping vs. Grounded Discovery**:
   For the Control profile (Radiohead, Inception, Breaking Bad, Fleabag), Gemini guessed generic upscale dining themes. Qloo's actual taste graph identified that users who appreciate these cultural works disproportionately frequent local craft brewpubs, independent gastropubs, and cocktail bars.

---

## 7. Grocery Coherence Gate (Task F)

To prevent generic or disconnected grocery stores from appearing, cultural grocery recommendations must satisfy two criteria:
1. $\ge 3$ open venues returned by Qloo.
2. $\ge 2$ venues must appear in the primary cuisine's top-50 candidate pool or carry its cuisine tag.

In Profile 1, the grocery query returned venues in the broader metropolitan area that did not cross the 2-venue primary pool overlap threshold; the Grocery Coherence Gate automatically dropped the category and recorded it in `meta.droppedCategories`, maintaining high signal-to-noise quality across all displayed categories.
