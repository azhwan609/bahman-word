import { admin, verifyState } from "../_shared/core.ts";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { "Content-Type": "application/json; charset=utf-8" },
});
const env = (key: string) => Deno.env.get(key) ?? "";

async function sendMessage(chatId: number | string, text: string) {
  const token = env("TELEGRAM_BOT_TOKEN");
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN is not configured");
  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text }),
  });
  if (!response.ok) throw new Error("Telegram sendMessage failed");
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "POST required" }, 405);
  const expected = env("TELEGRAM_WEBHOOK_SECRET");
  if (!expected || req.headers.get("x-telegram-bot-api-secret-token") !== expected) {
    return json({ error: "Unauthorized webhook" }, 401);
  }

  try {
    const update = await req.json();
    const message = update?.message;
    const chat = message?.chat;
    const from = message?.from;
    const text = String(message?.text ?? "");
    if (!chat?.id || !from || chat.type !== "private" || String(chat.id) !== String(from.id) || !text.startsWith("/start")) return json({ ok: true });

    const payload = text.trim().split(/\s+/)[1];
    if (!payload) {
      await sendMessage(chat.id, "To link Telegram with SHIWA Creator Hub, start the connection from the Telegram panel inside your signed-in SHIWA account.");
      return json({ ok: true });
    }

    const verified = await verifyState(payload);
    const [userId, timestamp] = verified.split(":");
    if (!userId || !timestamp || !Number.isFinite(Number(timestamp)) || Date.now() - Number(timestamp) > 10 * 60_000 || Number(timestamp) > Date.now() + 60_000) {
      await sendMessage(chat.id, "This connection link has expired. Return to SHIWA Creator Hub and generate a new link.");
      return json({ ok: true });
    }

    const db = admin();
    const username = typeof from.username === "string" ? from.username : null;
    const { error } = await db.from("integrations").upsert({
      user_id: userId,
      provider: "telegram",
      external_id: String(chat.id),
      external_username: username,
      encrypted_token: "",
      token_expires_at: null,
      scopes: ["telegram_bot_messages"],
      status: "active",
    }, { onConflict: "user_id,provider" });
    if (error) throw error;

    await sendMessage(chat.id, "SHIWA Creator Hub is now linked to this Telegram chat. You can return to the app.");
    return json({ ok: true });
  } catch (error) {
    console.error("Telegram webhook error:", error instanceof Error ? error.message : "unknown error");
    return json({ error: "Webhook processing failed" }, 500);
  }
});
