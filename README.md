# SHIWA Creator Hub

Supabase (Postgres, Auth, Storage, Edge Functions) + React/Vite frontend.

## Setup
1. `supabase link --project-ref <ref>` then `supabase db push` (applies `supabase/migrations/0001_init.sql`).
2. Set secrets (never in the frontend):
   `supabase secrets set TOKEN_ENCRYPTION_KEY=$(openssl rand -base64 32) STATE_SECRET=$(openssl rand -hex 32) INSTAGRAM_APP_ID=... INSTAGRAM_APP_SECRET=... APP_ORIGIN=https://your-app.example`
   Optional AI: `GEMINI_API_KEY`, `GEMINI_MODEL`, or `OPENAI_COMPAT_BASE_URL`, `OPENAI_COMPAT_API_KEY`, `OPENAI_COMPAT_MODEL`.
3. Deploy: `supabase functions deploy agent` and `supabase functions deploy instagram-oauth`.
4. In the Meta developer app, add redirect URI `https://<project>.supabase.co/functions/v1/instagram-oauth?action=callback`.
5. Frontend: copy `.env.example` to `.env`, then `npm install && npm run dev` (or `npm run build` and host `dist/`).

Without any AI key the app runs in built-in mode. Without Instagram credentials the connect flow reports a clear error.

