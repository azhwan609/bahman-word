import { cors, json, requireUser, signState, admin } from "../_shared/core.ts";

const botUsername = () => (Deno.env.get("TELEGRAM_BOT_USERNAME") ?? "").replace(/^@/, "").trim();

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const user = await requireUser(req);
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const action = body.action ?? "start";
    const db = admin();

    if (action === "status") {
      const { data, error } = await db.from("integrations")
        .select("external_username,status").eq("user_id", user.id)
        .eq("provider", "telegram").maybeSingle();
      if (error) throw error;
      return json({ connected: data?.status === "active", username: data?.external_username ?? null });
    }

    if (action === "disconnect") {
      const { error } = await db.from("integrations").update({ status: "revoked", encrypted_token: "" })
        .eq("user_id", user.id).eq("provider", "telegram");
      if (error) throw error;
      return json({ ok: true });
    }

    const username = botUsername();
    if (!username) return json({ error: "TELEGRAM_BOT_USERNAME is not configured in Supabase Edge Function secrets." }, 503);
    if (!/^[A-Za-z][A-Za-z0-9_]{2,29}bot$/i.test(username) || username.length < 5 || username.length > 32) {
      return json({ error: "TELEGRAM_BOT_USERNAME must be the valid bot username from BotFather, without @." }, 503);
    }
    if (!(Deno.env.get("STATE_SECRET") ?? "").trim()) {
      return json({ error: "STATE_SECRET is missing in Supabase Edge Function secrets." }, 503);
    }
    const payload = await signState(`${user.id}:${Date.now()}:${crypto.randomUUID()}`);
    return json({ url: `https://t.me/${encodeURIComponent(username)}?start=${encodeURIComponent(payload)}` });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Telegram link request failed";
    const status = /not configured|missing|must be configured/i.test(message) ? 503 : 400;
    return json({ error: message }, status);
  }
});
