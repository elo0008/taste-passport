# Taste Passport: Provenance of All Numeric Claims (Task B)

This document maps every numerical value, metric, ratio, threshold, and sample count appearing in `README.md`, `docs/EVALUATION.md`, and the user-facing UI strings to its exact generating script, reproduction command, execution timestamp, and git commit hash.

In accordance with competition rules and Qloo API licensing, all underlying evaluations operate on synthetic fixtures or aggregate statistical summaries with zero individual entity names, entity IDs, or venue street addresses committed.

---

## 1. Table of Numeric Claims & Provenance

| # | Numeric Claim | Source File & Location | Generating Script / Source File | Reproduction Command | Date & Time (UTC) | Commit Hash |
| :---: | :--- | :--- | :--- | :--- | :---: | :---: |
| 1 | **3 to 8 favorites** (User input limit) | `README.md` (L17), `src/app/page.tsx` (L158) | `src/app/page.tsx` (validation logic) | UI client validation | 2026-10-30 | `2a31d93` |
| 2 | **5 Malayali cultural icons** (Quick example) | `README.md` (L18), `src/app/page.tsx` (L146) | `src/app/page.tsx` (preset profile) | Click ⚡ Kerala to Toronto | 2026-10-30 | `2a31d93` |
| 3 | **11 of Qloo's top 50 places** (Kerala honest badge) | `README.md` (L27), `docs/EVALUATION.md` (L51), UI | `scripts/verify-task-c-prod.ts` | `npx tsx scripts/verify-task-c-prod.ts` | 2026-10-30 10:34 | `2a31d93` |
| 4 | **16 of Qloo's top 50 places** (South Indian honest badge) | `docs/EVALUATION.md` (L52), UI | `scripts/verify-task-c-prod.ts` | `npx tsx scripts/verify-task-c-prod.ts` | 2026-10-30 10:34 | `2a31d93` |
| 5 | **29 of Qloo's top 50 places** (Indian honest badge) | `docs/EVALUATION.md` (L53), UI | `scripts/verify-task-c-prod.ts` | `npx tsx scripts/verify-task-c-prod.ts` | 2026-10-30 10:34 | `2a31d93` |
| 6 | **18 of Qloo's top 50 places; 3 of 50 baseline (about 6.0x as often)** | `docs/EVALUATION.md` (L54), UI | `scripts/reconcile-control.ts` | `npx tsx scripts/reconcile-control.ts` | 2026-10-30 10:04 | `2a31d93` |
| 7 | **$c_{base} \ge 3$** (Honest multiplier display threshold) | `README.md` (L27), `src/lib/cuisine-inference.ts` (L58) | `src/lib/cuisine-inference.ts` | `npm test` | 2026-10-30 | `2a31d93` |
| 8 | **Up to 6 non-duplicated venues** per category | `README.md` (L29), `src/lib/pipeline.ts` (L493) | `src/lib/pipeline.ts` | `npm test` | 2026-10-30 | `2a31d93` |
| 9 | **take = 50** places per category query | `README.md` (L56, L84), `src/lib/pipeline.ts` (L415) | `src/lib/pipeline.ts` | `npm test` | 2026-10-30 | `2a31d93` |
| 10 | **$c_{sig} \ge 3$** (Cuisine statistical relevance threshold) | `README.md` (L51, L97), `src/lib/cuisine-inference.ts` (L189) | `src/lib/cuisine-inference.ts` | `npm test` | 2026-10-30 | `2a31d93` |
| 11 | **Enrichment = $(c_{sig}+1)/(c_{base}+1)$** | `README.md` (L50, L96), `src/lib/cuisine-inference.ts` (L191) | `src/lib/cuisine-inference.ts` | `npm test` | 2026-10-30 | `2a31d93` |
| 12 | **Grocery Coherence Gate**: $\ge 3$ venues & $\ge 2$ in primary pool | `README.md` (L53, L99), `docs/EVALUATION.md` (L142) | `src/lib/pipeline.ts` (L514) | `npm test` | 2026-10-30 | `2a31d93` |
| 13 | **40 seconds** (Execution deadline guard) | `README.md` (L64, L107), `src/lib/pipeline.ts` (L403) | `src/lib/pipeline.ts` | `npm test` | 2026-10-30 | `2a31d93` |
| 14 | **6 runs / hour per IP** (Rate limit) | `README.md` (L115), `src/lib/rate-limit.ts` | `src/lib/rate-limit.ts` | `npm test` | 2026-10-30 | `2a31d93` |
| 15 | **15 RPM free-tier quota** (Gemini) | `README.md` (L115) | Google AI Studio Documentation | N/A | 2026-10-30 | `2a31d93` |
| 16 | **18 total places returned** per profile | `docs/EVALUATION.md` (L13) | `scripts/e2e.ts` | `npm run e2e` | 2026-10-30 10:04 | `2a31d93` |
| 17 | **3 categories** per profile | `docs/EVALUATION.md` (L14) | `scripts/e2e.ts` | `npm run e2e` | 2026-10-30 10:04 | `2a31d93` |
| 18 | **0 Grounding Violations** across all profiles | `docs/EVALUATION.md` (L19), UI counter | `scripts/e2e.ts` | `npm run e2e` | 2026-10-30 10:04 | `2a31d93` |
| 19 | **0 Repair Attempts** needed | `docs/EVALUATION.md` (L20) | `scripts/e2e.ts` | `npm run e2e` | 2026-10-30 10:04 | `2a31d93` |
| 20 | **20 Qloo Calls** (Profile 1 with self-correction rerun) | `docs/EVALUATION.md` (L17, L91), UI | `scripts/verify-task-c-prod.ts` | `npx tsx scripts/verify-task-c-prod.ts` | 2026-10-30 10:34 | `2a31d93` |
| 21 | **18 Qloo Calls** (Profile 2 without self-correction) | `docs/EVALUATION.md` (L17) | `scripts/e2e.ts` | `npm run e2e` | 2026-10-30 10:04 | `2a31d93` |
| 22 | **16 Qloo Calls** (Control without self-correction) | `docs/EVALUATION.md` (L17) | `scripts/e2e.ts` | `npm run e2e` | 2026-10-30 10:04 | `2a31d93` |
| 23 | **0 ms** cached re-run latency | `docs/EVALUATION.md` (L26) | `scripts/e2e.ts` | `npm run e2e` | 2026-10-30 10:04 | `2a31d93` |
| 24 | **100% Pipeline Consistency** across 3 consecutive runs | `docs/EVALUATION.md` (L72) | `scripts/reconcile-control.ts` | `npx tsx scripts/reconcile-control.ts` | 2026-10-30 10:04 | `2a31d93` |
| 25 | **Raw Taste Lift**: Kerala 40%, South Indian 80%, Indian 100% | `docs/EVALUATION.md` (L88-L90), UI | `scripts/verify-task-c-prod.ts` | `npx tsx scripts/verify-task-c-prod.ts` | 2026-10-30 10:34 | `2a31d93` |
| 26 | **+785ms added latency** for self-correction rerun | `docs/EVALUATION.md` (L92) | `scripts/verify-task-c-prod.ts` | `npx tsx scripts/verify-task-c-prod.ts` | 2026-10-30 10:34 | `2a31d93` |
| 27 | **take = 10** candidates for verifiability /search lookup | `docs/EVALUATION.md` (L103) | `scripts/baseline.ts` (L162) | `npm run baseline` | 2026-10-30 10:36 | `2a31d93` |
| 28 | **2 / 5 (40%) Metro Match Rate** (Profile 1: Kerala -> Toronto) | `docs/EVALUATION.md` (L113) | `scripts/baseline.ts` | `npm run baseline` | 2026-10-30 10:36 | `2a31d93` |
| 29 | **5 / 5 (100%) Metro Match Rate** (Profile 2: Punjabi -> London) | `docs/EVALUATION.md` (L114) | `scripts/baseline.ts` | `npm run baseline` | 2026-10-30 10:36 | `2a31d93` |
| 30 | **4 / 5 (80%) Metro Match Rate** (Control: Indie -> Toronto) | `docs/EVALUATION.md` (L115) | `scripts/baseline.ts` | `npm run baseline` | 2026-10-30 10:36 | `2a31d93` |
| 31 | **11 / 15 (73.3%) Overall Metro Match Rate** | `docs/EVALUATION.md` (Section 6) | `scripts/baseline.ts` | `npm run baseline` | 2026-10-30 10:36 | `2a31d93` |
| 32 | **0 Blurbs without source text from Qloo** | `docs/EVALUATION.md` (L132) | `scripts/audit-blurbs.ts` | `npm run audit:blurbs` | 2026-10-30 10:04 | `2a31d93` |
| 33 | **98.8% Content Word Match** (677 / 685 content words) | `docs/EVALUATION.md` (L134) | `scripts/audit-blurbs.ts` | `npm run audit:blurbs` | 2026-10-30 10:04 | `2a31d93` |
| 34 | **54 Total Unique Places Audited** | `docs/EVALUATION.md` (L158) | `scripts/audit-venue-fields.ts` | `npx tsx scripts/audit-venue-fields.ts` | 2026-10-30 10:36 | `2a31d93` |
| 35 | **100.0% Valid Street Address** (54 / 54) | `docs/EVALUATION.md` (L159) | `scripts/audit-venue-fields.ts` | `npx tsx scripts/audit-venue-fields.ts` | 2026-10-30 10:36 | `2a31d93` |
| 36 | **1.9% Missing Phone Number** (1 / 54 places) | `docs/EVALUATION.md` (L161) | `scripts/audit-venue-fields.ts` | `npx tsx scripts/audit-venue-fields.ts` | 2026-10-30 10:36 | `2a31d93` |
| 37 | **7.4% Missing Website Link** (4 / 54 places) | `docs/EVALUATION.md` (L163) | `scripts/audit-venue-fields.ts` | `npx tsx scripts/audit-venue-fields.ts` | 2026-10-30 10:36 | `2a31d93` |
| 38 | **9.3% Missing Either Phone or Website** (5 / 54 places) | `docs/EVALUATION.md` (L164) | `scripts/audit-venue-fields.ts` | `npx tsx scripts/audit-venue-fields.ts` | 2026-10-30 10:36 | `2a31d93` |
| 39 | **0.0% Missing Both Phone and Website** (0 / 54 places) | `docs/EVALUATION.md` (L165) | `scripts/audit-venue-fields.ts` | `npx tsx scripts/audit-venue-fields.ts` | 2026-10-30 10:36 | `2a31d93` |
| 40 | **94.9% Candidate Image Availability** (37 / 39 candidates) | `docs/NUMBERS.md` | `scripts/audit-images.ts` | `npm run audit:images` | 2026-10-30 13:26 | `HEAD` |
| 41 | **100.0% Place Image Availability** (54 / 54 places) | `docs/NUMBERS.md` | `scripts/audit-images.ts` | `npm run audit:images` | 2026-10-30 13:26 | `HEAD` |
| 42 | **100.0% Qloo-Hosted Images** (`images.qloo.com`) | `docs/NUMBERS.md` | `scripts/audit-images.ts` | `npm run audit:images` | 2026-10-30 13:26 | `HEAD` |
| 43 | **85.0% Place Image Probe Success** (17 / 20 status 206, 3 / 20 status 504) | `docs/NUMBERS.md` | `scripts/audit-images.ts` | `npm run audit:images` | 2026-10-30 13:26 | `HEAD` |

---

## 2. Hardcoded Output Audit Verification

A full codebase search was conducted across `src/`, `scripts/`, `tests/`, and documentation to ensure no hardcoded Qloo data arrays or simulated mock responses remain outside labelled SYNTHETIC unit test fixtures:

1. **`src/` Directory**:
   - Zero hardcoded entity names, place IDs, cuisine lists, or simulated payloads.
   - All models, categories, and venue cards originate dynamically from live Qloo API responses (`/search`, `/v2/insights`).

2. **`scripts/baseline.ts`**:
   - In earlier development phases, a placeholder array `["Brewpub", "Gastropub", "Cocktail Bar"]` existed.
   - **Audit Status**: Confirmed replaced. `baseline.ts` now directly invokes the production pipeline's `inferCuisinesFromTaste` engine for all evaluated profiles.

3. **`tests/` Directory**:
   - All unit tests use strictly labelled `SYNTHETIC` mock data (e.g. `SYNTHETIC_TEST_KEY_NEVER_LOG`, synthetic entity IDs `id-fav1`, `id-fav2`). No licensed Qloo response payloads are persisted or committed.



---

## 3. Place & Candidate Image Availability & HTTP Verification (Task D)

Audited across Profile 1 (Kerala -> Toronto), Profile 2 (Punjabi -> London), and Control Profile (Indie -> Toronto) plus all candidate entities for their 13 input favorites via `npm run audit:images` (`scripts/audit-images.ts`):

- **Search Candidates ($n=39$)**: 37 with `imageUrl` (94.9%), 2 with null (5.1%).
- **Result Places ($n=54$)**: 54 with `imageUrl` (100.0%), 0 with null (0.0%).
- **Distinct Hostnames**: `images.qloo.com` (100% Qloo-hosted, `https:` only).
- **HTTP Server-Side Sample Probe (`Range: bytes=0-0`)**:
  - Place sample ($n=20$): 17 status 206 (`image/jpeg`), 3 status 504 (`application/json` upstream timeout), 0 redirects.
  - Candidate sample ($n=10$): 10 status 206 (`image/jpeg`), 0 redirects.
- **Hotlink Security & Allowlist**: URLs sanitized via `src/lib/images.ts` with strict `ALLOWED_IMAGE_HOSTS = ["images.qloo.com"]`. Non-HTTPS, data:, javascript:, protocol-relative, and unlisted hostnames normalize to `null`.
- **Grounded Writer Isolation**: Image URLs are strictly excluded from `GroundingInputPlace` and the Gemini prompt input.
- **Browser Policy Note**: Server-side HTTP success does NOT prove that a user browser will load the image (due to potential browser Referer headers, CORS, or CDN hotlink protection policies). A manual browser check on the deployed site is required.
