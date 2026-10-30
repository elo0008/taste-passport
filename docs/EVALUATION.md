# Taste Passport: Phase 4 Evaluation & Aggregate Metrics

This document contains aggregate statistical measurements, probe results, and performance benchmarks for the Taste Passport system. In strict adherence to hackathon data policies and license terms, no individual entity names, entity IDs, venue addresses, or narrative blurbs are included.

---

## 1. Task A Cuisine-Inference Probe Results (Aggregate)

### Parameter Limits
- **Largest working `take` parameter on `/v2/insights`**: `50`
  - `take=10`: Success
  - `take=20`: Success
  - `take=50`: Success
  - `take=100`: Returned HTTP 400 (`take must be an integer value between 1 and 50`)

### Comparison: Unconstrained vs. Broad Restaurant Tag Filtering

| Dimension | Probe Run 1 (Without Filter Tag) | Probe Run 2 (With `urn:tag:genre:place:restaurant`) |
| :--- | :---: | :---: |
| **Profile 1 Cuisine Coverage** | 46.0% (23 / 50 places) | **100.0%** (50 / 50 places) |
| **Profile 2 Cuisine Coverage** | 54.0% (27 / 50 places) | **100.0%** (50 / 50 places) |
| **Control Profile Coverage** | 32.0% (16 / 50 places) | **96.0%** (48 / 50 places) |
| **Profile 1 Top 3 Cuisines** | Cafe, Indian, Coffee shop | **Indian, Kerala, South Indian** |
| **Profile 2 Top 3 Cuisines** | Indian, Indian, North Indian | **North Indian, Punjabi, Indian** |
| **Control Profile Top 3 Cuisines**| Coffee shop, Cafe, Italian | **Italian, Coffee shop, Cafe** |
| **Gate Status** | **FAIL** (Coverage < 60%) | **PASS** (All 4 criteria met) |

---

## 2. Gate Criteria Evaluation

| Criterion | Requirement | Observed Metrics | Result |
| :--- | :--- | :--- | :---: |
| **5a (Profile 1)** | Top 3 enriched tags contains regional cuisine; Pakistani tag not #1 | Indian (17.0x), Kerala (10.0x), South Indian (7.0x); Pakistani not #1 | **PASS** |
| **5b (Profile 2)** | Top 3 enriched tags contains Punjabi or North Indian | North Indian (25.0x), Punjabi (17.0x), Indian (12.5x) | **PASS** |
| **5c (Distinct Profiles)** | Top 3 tag sets of Profile 1 and Profile 2 differ | Profile 1: {Indian, Kerala, South Indian}<br>Profile 2: {North Indian, Punjabi, Indian} | **PASS** |
| **5d (Coverage)** | Cuisine coverage $\ge 60\%$ for both profiles | Profile 1: 100.0%<br>Profile 2: 100.0% | **PASS** |

---

## 3. Aggregate End-to-End Pipeline Performance

All measurements taken uncached with forced refresh.

| Metric | Profile 1 (Toronto) | Profile 2 (London) | Control (Toronto) | Degraded (Fallback) |
| :--- | :---: | :---: | :---: | :---: |
| **Total Places Returned** | 18 | 18 | 15 | 18 |
| **Category Count** | 3 | 3 | 3 | 3 |
| **Places with Blurb** | 18 | 18 | 15 | 18 |
| **Places with Null Blurb** | 0 | 0 | 0 | 0 |
| **Qloo API Calls** | 20 | 18 | 16 | 20 |
| **LLM Calls** | 1 | 1 | 1 | **0** |
| **Grounding Violations** | **0** | **0** | **0** | **0** |
| **Repair Attempts** | 0 | 0 | 0 | 0 |
| **Resolve Duration (ms)** | 1,767 | 1,698 | 1,580 | 1,750 |
| **Inference Duration (ms)** | 6,897 | 9,680 | 6,135 | 6,800 |
| **Discovery Duration (ms)** | 1,831 | 1,931 | 1,932 | 1,820 |
| **Writing Duration (ms)** | 3,829 | 3,993 | 4,934 | 5 |
| **Total Duration (ms)** | **14,324** | **17,301** | **14,580** | **10,375** |
| **Cached Re-Run Duration** | **0 ms** | **0 ms** | **0 ms** | **0 ms** |

---

## 4. Single-Signal Enrichment Ratios (Signal Check Summary)

A signal qualifies as shaping cuisines when enrichment $\ge 1.5$ and sample count $\ge 3$ within the top 50 places.

### Profile 1
- **Entity 1**: Indian (20.0x), Kerala (12.0x), South Indian (12.0x)
- **Entity 2**: Indian (22.0x), South Indian (13.0x), Kerala (12.0x)
- **Entity 3**: Indian (25.0x), Fast Food (16.0x), South Indian (12.0x)
- **Entity 4**: Indian (24.0x), South Indian (15.0x), Kerala (11.0x)
- **Entity 5**: European (4.0x), Bar Food (2.3x), Tex-Mex (2.0x)

### Profile 2
- **Entity 1**: North Indian (24.0x), Punjabi (19.0x), Indian (14.0x)
- **Entity 2**: North Indian (20.0x), Indian (14.0x), Indo-Chinese (10.0x)
- **Entity 3**: North Indian (21.0x), Punjabi (18.0x), Indian (12.0x)
- **Entity 4**: North Indian (19.0x), Indian (15.0x), Street Food (8.0x)

### Control Profile
- **Entity 1**: Coffee Shop (5.0x), Bakery (5.0x), Cafe Fare (5.0x)
- **Entity 2**: Coffee Shop (5.0x), Bakery (5.0x), Cafe Fare (4.0x)
- **Entity 3**: Fast Food (9.0x), Bakery (7.0x), Breakfast (6.5x)
- **Entity 4**: Bakery (8.0x), Coffee Shop (7.5x), Cafe (5.0x)

---

## 5. Architectural Integrity Findings

1. **Elimination of LLM Selection**:
   In Phase 4, the LLM planner was completely removed. Cuisines and places are 100% selected and ranked by Qloo's taste intelligence graph via broad restaurant tag querying (`urn:tag:genre:place:restaurant`) and baseline comparison.
2. **Deterministic Grounding Guarantee**:
   All 16 subjective marketing words (`cozy`, `charming`, `authentic`, `legendary`, etc.) and all user-supplied favorite names are deterministically banned. Across all test profiles and degradation runs, final grounding violations were verified at exactly `0`.
3. **Graceful Degradation Verified**:
   When external LLM APIs fail or are disabled via `LLM_DISABLED=true`, the system automatically serves template-derived narratives with 0 LLM calls, completing the user pipeline without errors.
