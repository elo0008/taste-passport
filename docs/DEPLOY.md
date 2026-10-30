# Taste Passport: Deployment & Operations Guide

This guide details the deployment procedure for Taste Passport on Vercel and documents platform-specific operational characteristics.

---

## 1. Vercel Deployment Procedure

### Step 1: Import Repository
1. Navigate to your [Vercel Dashboard](https://vercel.com/dashboard).
2. Click **Add New...** &rarr; **Project**.
3. Select your Git provider (e.g. GitHub) and import the `taste-passport` repository.
4. Leave the Framework Preset as **Next.js** (App Router). Root directory remains `./`.

### Step 2: Configure Environment Variables
Before deploying, set the following environment variables in the Vercel project settings:

| Variable | Required? | Description |
| :--- | :---: | :--- |
| `QLOO_API_KEY` | **Yes** | Your API key for the Qloo API endpoint (`https://hackathon.api.qloo.com`). |
| `GEMINI_API_KEY` | **Yes** | Your Google Gemini API key for `gemini-3.5-flash-lite`. |
| `LLM_DISABLED` | Optional | Set to `'true'` to disable Gemini and force deterministic template narration. |
| `HEALTH_TOKEN` | Optional | Shared token for authenticated health checks if required by synthetic monitoring. |

> [!SECURITY]
> Never set API keys with a `NEXT_PUBLIC_` prefix. All Qloo and Gemini calls are strictly server-side.

### Step 3: Deploy & Verify
1. Click **Deploy**. Vercel will build the Next.js application using `npm run build`.
2. Once deployed, verify endpoints using the automated smoke test:
   ```bash
   npm run smoke -- https://<your-vercel-deployment-url>.vercel.app
   ```

---

## 2. Serverless Runtime & Operational Limits

### Function Execution Duration (`maxDuration`)
- Serverless route handlers (`/api/passport`) declare `export const maxDuration = 60;`.
- **Plan Dependence**: Note that the actual maximum execution timeout depends on your Vercel account plan and configuration (e.g. Hobby plans traditionally cap at 10–60 seconds, whereas Pro/Enterprise plans support longer runtimes).
- **Deadline Guard**: To prevent unexpected function termination, Taste Passport implements an internal wall-clock deadline guard:
  - If discovery exceeds 40 seconds before text writing begins, external LLM calls are skipped and deterministic templates are rendered immediately (`meta.narration = "template"`).
  - If Qloo queries exceed 50 seconds total, results collected up to that point are finalized and returned.

### Per-Instance In-Memory State
- **Rate Limiting & LRU Caching**: Taste Passport uses in-memory token bucket rate limiting (6 runs/hour per IP) and in-memory LRU caching.
- In a serverless architecture (Vercel Functions), memory state is local to each serverless container instance and is not shared across concurrently spawned instances or regional cold starts.
- For multi-tenant production scale, these can be backed by a distributed key-value store (e.g. Upstash Redis / Vercel KV).

---

## 3. Post-Deployment Smoke Verification

To verify that your live Vercel deployment is healthy and responding to Server-Sent Events (SSE) streaming:

```bash
npm run smoke -- https://<your-project>.vercel.app
```

The smoke test verifies:
1. `GET /api/health` &rarr; 200 OK
2. `POST /api/resolve` &rarr; 200 OK with entity candidate disambiguation
3. `POST /api/passport` &rarr; Full SSE stream verification, category assembly, and zero grounding violations.
