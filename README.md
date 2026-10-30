# Taste Passport

Taste Passport connects your cultural favorites from home (artists, films, authors) with destinations around the world. Powered by Qloo's taste intelligence API and Gemini, it discovers authentic spots matching your taste graph.

## Getting Started

1. Copy `.env.example` to `.env.local` and add your API keys:
   - `QLOO_API_KEY`: API key for Qloo Hackathon endpoint
   - `GEMINI_API_KEY`: API key for Google Gemini

2. Install dependencies:
   ```bash
   npm install
   ```

3. Run verification and tests:
   ```bash
   npm run check:secrets
   npm run typecheck
   npm test
   npm run build
   ```

4. Run the development server:
   ```bash
   npm run dev
   ```

## License
MIT

