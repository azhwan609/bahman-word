# SHIWA Creator Hub

Supabase (Postgres, Auth, Storage, Edge Functions) + React/Vite frontend.

## Setup
1. Configure the existing Supabase project and frontend environment from `.env.example`.
2. Deploy the SHIWA frontend to Netlify or another static host.
3. Set the backend Render variables documented in the `shiwa-mcp-server` repository. The Composio API key belongs only in the Render server environment; never expose it in `VITE_*` variables.
4. Open **Instagram Lite** in SHIWA to connect Instagram and Telegram through Composio-hosted connection popups.

## Social connections
- Instagram connections support Business and Creator accounts through Composio.
- Telegram uses Composio's hosted API-key connection flow for a Telegram bot token. It is not a personal Telegram-account OAuth login.
- Connections are isolated by the signed-in SHIWA user's Supabase UUID.
- SHIWA does not store Instagram passwords or Telegram bot tokens.

No Meta app ID/secret or global Instagram session cookie is required for this Composio-based connection flow.
