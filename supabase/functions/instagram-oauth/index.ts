import { cors, json, admin, requireUser, HttpError, env, encrypt, signState, verifyState, log } from "../_shared/core.ts";

// verify_jwt is off (the popup callback has no JWT); JWT actions are checked manually.
const REDIRECT = () => `${env("SUPABASE_URL")}/functions/v1/instagram-oauth?action=callback`;

function popupHtml(payload: Record<string, unknown>, ok: boolean) {
  const origin = env("APP_ORIGIN");
  const message = ok
    ? "اتصال اینستاگرام انجام شد. به SHIWA برگرد و وضعیت اتصال را تازه‌سازی کن."
    : "اتصال اینستاگرام انجام نشد. به SHIWA برگرد و تنظیمات اتصال را بررسی کن.";
  const safeOrigin = JSON.stringify(origin);
  const safePayload = JSON.stringify(payload);
  return new Response(
    `<!doctype html><html lang="fa" dir="rtl"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>SHIWA · Instagram</title><body style="background:#050b12;color:#cdeef5;font:16px sans-serif;text-align:center;padding:12vh 24px"><h2>SHIWA · Instagram</h2><p>${message}</p><a href="${origin || "/"}" style="display:inline-block;padding:12px 18px;border-radius:12px;background:#9333ea;color:white;text-decoration:none">بازگشت به SHIWA</a><script>try{if(window.opener){window.opener.postMessage(${safePayload},${safeOrigin});setTimeout(()=>window.close(),900)}}catch(e){}</script></body></html>`,
    { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } },
  );
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const url = new URL(req.url);
  const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
  const action = url.searchParams.get("action") ?? body.action;
  try {
    if (action === "callback") {
      const code = (url.searchParams.get("code") ?? "").replace(/#_$/, "");
      if (!code) throw new HttpError(400, "missing code");
      const [userId, ts] = (await verifyState(url.searchParams.get("state") ?? "")).split(":");
      if (Date.now() - Number(ts) > 10 * 60_000) throw new HttpError(400, "state expired");

      // 1) short-lived token  2) long-lived token  3) profile
      const short = await (await fetch("https://api.instagram.com/oauth/access_token", {
        method: "POST",
        body: new URLSearchParams({ client_id: env("INSTAGRAM_APP_ID"), client_secret: env("INSTAGRAM_APP_SECRET"), grant_type: "authorization_code", redirect_uri: REDIRECT(), code }),
      })).json();
      if (!short.access_token) throw new HttpError(502, "token exchange failed");
      const long = await (await fetch(`https://graph.instagram.com/access_token?grant_type=ig_exchange_token&client_secret=${env("INSTAGRAM_APP_SECRET")}&access_token=${short.access_token}`)).json();
      const token: string = long.access_token ?? short.access_token;
      const me = await (await fetch(`https://graph.instagram.com/me?fields=user_id,username&access_token=${encodeURIComponent(token)}`)).json();

      const db = admin();
      const { error } = await db.from("integrations").upsert({
        user_id: userId,
        provider: "instagram",
        external_id: String(me.user_id ?? short.user_id),
        external_username: me.username,
        encrypted_token: await encrypt(token),
        token_expires_at: long.expires_in ? new Date(Date.now() + long.expires_in * 1000).toISOString() : null,
        scopes: ["instagram_business_basic"],
        status: "active",
      }, { onConflict: "user_id,provider" });
      if (error) throw new HttpError(500, error.message);
      await log(db, userId, "integration.connected", { provider: "instagram", username: me.username });
      return popupHtml({ type: "shiwa:instagram", ok: true, username: me.username }, true);
    }

    const user = await requireUser(req);
    const db = admin();

    if (action === "start") {
      const missing = ["INSTAGRAM_APP_ID", "INSTAGRAM_APP_SECRET", "APP_ORIGIN", "STATE_SECRET", "TOKEN_ENCRYPTION_KEY"].filter((name) => !env(name).trim());
      if (missing.length) throw new HttpError(503, `Instagram connection configuration is incomplete: ${missing.join(", ")}`);
      const encodedKey = env("TOKEN_ENCRYPTION_KEY").trim();
      let decodedKey: Uint8Array;
      try { decodedKey = Uint8Array.from(atob(encodedKey), (ch) => ch.charCodeAt(0)); }
      catch { throw new HttpError(503, "TOKEN_ENCRYPTION_KEY must be base64-encoded 32 random bytes"); }
      if (decodedKey.length !== 32) throw new HttpError(503, "TOKEN_ENCRYPTION_KEY must decode to exactly 32 bytes");
      const state = await signState(`${user.id}:${Date.now()}:${crypto.randomUUID()}`);
      const authUrl = "https://www.instagram.com/oauth/authorize?" + new URLSearchParams({
        client_id: env("INSTAGRAM_APP_ID"), redirect_uri: REDIRECT(), scope: "instagram_business_basic", response_type: "code", state,
      });
      return json({ url: authUrl });
    }

    if (action === "status") {
      const { data } = await db.from("integrations").select("external_username,status").eq("user_id", user.id).eq("provider", "instagram").maybeSingle();
      return json({ connected: data?.status === "active", username: data?.external_username ?? null });
    }

    if (action === "disconnect") {
      await db.from("integrations").update({ status: "revoked", encrypted_token: "" }).eq("user_id", user.id).eq("provider", "instagram");
      await log(db, user.id, "integration.disconnected", { provider: "instagram" });
      return json({ ok: true });
    }

    throw new HttpError(400, "unknown action");
  } catch (e) {
    if (action === "callback") return popupHtml({ type: "shiwa:instagram", ok: false }, false);
    return json({ error: e instanceof Error ? e.message : "error" }, e instanceof HttpError ? e.status : 500);
  }
});


