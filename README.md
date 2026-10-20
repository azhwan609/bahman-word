# SHIWA Creator Hub

Supabase (Postgres, Auth, Storage, Edge Functions) + React/Vite frontend.

## Setup
1. `supabase link --project-ref <ref>` then `supabase db push` (applies `supabase/migrations/0001_init.sql`).
2. Set secrets (never in the frontend):
   `supabase secrets set TOKEN_ENCRYPTION_KEY=$(openssl rand -base64 32) STATE_SECRET=$(openssl rand -hex 32) INSTAGRAM_APP_ID=... INSTAGRAM_APP_SECRET=... APP_ORIGIN=https://your-app.example TELEGRAM_BOT_TOKEN=... TELEGRAM_BOT_USERNAME=your_bot_username TELEGRAM_WEBHOOK_SECRET=$(openssl rand -hex 32)`
   Optional AI: `GEMINI_API_KEY`, `GEMINI_MODEL`, or `OPENAI_COMPAT_BASE_URL`, `OPENAI_COMPAT_API_KEY`, `OPENAI_COMPAT_MODEL`.
3. Deploy: `supabase functions deploy agent`, `supabase functions deploy instagram-oauth`, `supabase functions deploy telegram-link`, and `supabase functions deploy telegram-webhook`.
4. In the Meta developer app, add redirect URI `https://<project>.supabase.co/functions/v1/instagram-oauth?action=callback`.
5. Frontend: copy `.env.example` to `.env`, then `npm install && npm run dev` (or `npm run build` and host `dist/`).

Without any AI key the app falls back to the built-in/free text provider; configure `GEMINI_API_KEY` in **Supabase Edge Function secrets** to use Gemini for text and image generation. Optionally set `GEMINI_MODEL` and `GEMINI_IMAGE_MODEL` to supported model IDs. Never place provider secrets in `VITE_*` frontend variables.

For Google sign-in, enable the Google provider in Supabase Authentication and configure its OAuth client credentials and redirect URLs in the Supabase dashboard. The app includes email/password sign-in, Google OAuth, and password-reset email flows.

Without Instagram credentials the connect flow reports a clear error. Instagram OAuth requires a Meta/Instagram app configured for the requested Instagram API product, the exact callback URL above, and the server-side secrets. Telegram linking uses a bot-to-chat connection (not personal-account login). Create a bot with BotFather, set `TELEGRAM_BOT_TOKEN`, `TELEGRAM_BOT_USERNAME`, and a random `TELEGRAM_WEBHOOK_SECRET` as Supabase Edge Function secrets, then register the webhook URL `https://<project>.supabase.co/functions/v1/telegram-webhook` with Telegram's `setWebhook` API and pass the same value as `secret_token`. The app creates a short-lived signed link; the user must press **Start** in the bot within 10 minutes. Never put the bot token in frontend variables.

