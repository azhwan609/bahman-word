import { cors, json, admin, requireUser, HttpError, env, encrypt, signState, verifyState, log } from "../_shared/core.ts";

// The callback is public because Meta redirects the browser without a Supabase JWT.
// All non-callback actions require a verified Supabase user session.
const REDIRECT = () => `${env("SUPABASE_URL")}/functions/v1/instagram-oauth?action=callback`;

async function readJson(response: Response, label: string): Promise<any> {
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    console.error(`Instagram ${label} failed`, response.status, payload);
    throw new HttpError(502, `Instagram ${label} failed`);
  }
  if (!payload || typeof payload !== "object") {
    throw new HttpError(502, `Invalid Instagram ${label} response`);
  }
  return payload;
}

function popupHtml(payload: Record<string, unknown>, ok: boolean) {
  const origin = env("APP_ORIGIN");
  return new Response(
    `<!doctype html><meta charset="utf-8"><body style="background:#050b12;color:#cdeef5;font-family:sans-serif;text-align:center;padding-top:30vh">
<p>${ok ? "Instagram connected. This window will close." : "Connection failed. Close this window and try again."}</p>
<script>window.opener&&window.opener.postMessage(${JSON.stringify(payload)},${JSON.stringify(origin)});setTimeout(()=>window.close(),900);</script></body>`,
    { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } },
  );
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "GET" && req.method !== "POST") {
    return json({ error: "method not allowed" }, 405);
  }

  const url = new URL(req.url);
  const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
  const action = url.searchParams.get("action") ?? body.action;

  try {
    if (action === "callback") {
      const oauthError = url.searchParams.get("error");
      if (oauthError) throw new HttpError(400, "Instagram authorization was denied");

      const code = (url.searchParams.get("code") ?? "").replace(/#_$/, "");
      if (!code) throw new HttpError(400, "missing code");

      const payload = await verifyState(url.searchParams.get("state") ?? "");
      const [userId, ts, nonce] = payload.split(":");
      const timestamp = Number(ts);
      if (!userId || !nonce || !Number.isFinite(timestamp) || timestamp > Date.now() + 60_000 || Date.now() - timestamp > 10 * 60_000) {
        throw new HttpError(400, "state expired or invalid");
      }

      const shortResp = await fetch("https://api.instagram.com/oauth/access_token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: env("INSTAGRAM_APP_ID"),
          client_secret: env("INSTAGRAM_APP_SECRET"),
          grant_type: "authorization_code",
          redirect_uri: REDIRECT(),
          code,
        }),
      });
      const short = await readJson(shortResp, "short-lived token exchange");
      if (typeof short.access_token !== "string" || !short.access_token) {
        console.error("Instagram short-lived token response omitted access_token");
        throw new HttpError(502, "token exchange failed");
      }

      let long: any = null;
      try {
        const longUrl = new URL("https://graph.instagram.com/access_token");
        longUrl.search = new URLSearchParams({
          grant_type: "ig_exchange_token",
          client_secret: env("INSTAGRAM_APP_SECRET"),
          access_token: short.access_token,
        }).toString();
        const longResp = await fetch(longUrl);
        long = await readJson(longResp, "long-lived token exchange");
      } catch (error) {
        // Keep a valid short-lived token if Meta's long-lived exchange is temporarily unavailable.
        console.error("Instagram long-lived token exchange failed", error);
      }

      const token = typeof long?.access_token === "string" && long.access_token
        ? long.access_token
        : short.access_token;
      const meUrl = new URL("https://graph.instagram.com/me");
      meUrl.search = new URLSearchParams({
        fields: "user_id,username",
        access_token: token,
      }).toString();
      const me = await readJson(await fetch(meUrl), "profile lookup");
      const externalId = me.user_id ?? short.user_id;
      if (!externalId || typeof me.username !== "string" || !me.username) {
        throw new HttpError(502, "Instagram profile response was incomplete");
      }

      const db = admin();
      const { error } = await db.from("integrations").upsert({
        user_id: userId,
        provider: "instagram",
        external_id: String(externalId),
        external_username: me.username,
        encrypted_token: await encrypt(token),
        token_expires_at: long?.expires_in
          ? new Date(Date.now() + Number(long.expires_in) * 1000).toISOString()
          : null,
        scopes: ["instagram_business_basic"],
        status: "active",
      }, { onConflict: "user_id,provider" });
      if (error) {
        console.error("DB upsert integrations error", error);
        throw new HttpError(500, "failed to save Instagram integration");
      }
      await log(db, userId, "integration.connected", { provider: "instagram", username: me.username });
      return popupHtml({ type: "shiwa:instagram", ok: true, username: me.username }, true);
    }

    const user = await requireUser(req);
    const db = admin();

    if (action === "start") {
      const state = await signState(`${user.id}:${Date.now()}:${crypto.randomUUID()}`);
      const authUrl = "https://www.instagram.com/oauth/authorize?" + new URLSearchParams({
        client_id: env("INSTAGRAM_APP_ID"),
        redirect_uri: REDIRECT(),
        scope: "instagram_business_basic",
        response_type: "code",
        state,
      });
      return json({ url: authUrl });
    }

    if (action === "status") {
      const { data, error } = await db.from("integrations")
        .select("external_username,status")
        .eq("user_id", user.id)
        .eq("provider", "instagram")
        .maybeSingle();
      if (error) throw new HttpError(500, "failed to read Instagram integration");
      return json({ connected: data?.status === "active", username: data?.external_username ?? null });
    }

    if (action === "disconnect") {
      const { error } = await db.from("integrations")
        .update({ status: "revoked", encrypted_token: "" })
        .eq("user_id", user.id)
        .eq("provider", "instagram");
      if (error) throw new HttpError(500, "failed to disconnect Instagram");
      await log(db, user.id, "integration.disconnected", { provider: "instagram" });
      return json({ ok: true });
    }

    throw new HttpError(400, "unknown action");
  } catch (error) {
    if (action === "callback") return popupHtml({ type: "shiwa:instagram", ok: false }, false);
    const status = error instanceof HttpError ? error.status : 500;
    return json({ error: error instanceof Error ? error.message : "error" }, status);
  }
});
