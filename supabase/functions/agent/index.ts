import { cors, json, admin, requireUser, HttpError, log, assertPermitted, complete, generateImage, decrypt, Mode } from "../_shared/core.ts";
import { SupabaseClient } from "npm:@supabase/supabase-js@2";

const IG = /instagram|اینستاگرام|اینستا/i;
const CONNECT = /connect|link|login|authorize|permission|access|popup|pop-up|oauth|اتصال|وصل|لینک|مجوز|دسترسی|اجازه|ورود|پاپ ?اپ|پنجره/i;
const PROFILE = /profile|account|پروفایل|اکانت/i;

// Intent detection: Persian + English. Order matters (Instagram connect is checked first).
export function detectIntent(t: string): string | null {
  if (IG.test(t) && CONNECT.test(t)) return "connect_instagram";
  if (IG.test(t) && PROFILE.test(t)) return "instagram_profile";
  if (/disconnect|unlink|قطع/i.test(t)) return "disconnect_integration";
  if (/image|picture|photo|logo|تصویر|عکس|طرح/i.test(t)) return "generate_image";
  if (/username|یوزرنیم|نام کاربری/i.test(t)) return "username_search";
  if (/business|startup|revenue|کسب|درآمد/i.test(t)) return "business_ideas";
  if (/caption|hashtag|content|brand|sticker|کپشن|هشتگ|محتوا|برند|استیکر/i.test(t)) return "generate_content";
  return null;
}

type Ctx = { db: SupabaseClient; userId: string; message: string; style: string; memory: Record<string, string> };
type Result = { reply: string; data?: Record<string, unknown>; action?: { type: string } };

const PLATFORMS = [
  (u: string) => `https://www.instagram.com/${u}/`,
  (u: string) => `https://www.tiktok.com/@${u}`,
  (u: string) => `https://x.com/${u}`,
  (u: string) => `https://www.youtube.com/@${u}`,
  (u: string) => `https://www.threads.net/@${u}`,
];

const textTool = (mode: Mode, module: string) =>
  async ({ db, userId, message, memory }: Ctx): Promise<Result> => {
    const r = await complete(mode, message, memory.brand ? `brand = ${memory.brand}` : "");
    await db.from("generated_assets").insert({ user_id: userId, kind: "text", module, prompt: message, output_text: r.text });
    return { reply: r.text, data: { provider: r.provider } };
  };

const handlers: Record<string, (c: Ctx) => Promise<Result>> = {
  connect_instagram: async () => ({
    reply: "Opening the secure Instagram connector. You authorize on instagram.com; SHIWA never sees your password.",
    action: { type: "instagram_connect" },
  }),

  disconnect_integration: async ({ db, userId }) => {
    await db.from("integrations").update({ status: "revoked", encrypted_token: "" }).eq("user_id", userId).eq("provider", "instagram");
    return { reply: "Instagram disconnected and the stored token was deleted." };
  },

  instagram_profile: async ({ db, userId }) => {
    const { data } = await db.from("integrations").select("encrypted_token").eq("user_id", userId).eq("provider", "instagram").single();
    const token = await decrypt(data!.encrypted_token);
    const r = await fetch(`https://graph.instagram.com/me?fields=user_id,username,account_type,media_count&access_token=${encodeURIComponent(token)}`);
    if (!r.ok) throw new HttpError(502, "Instagram API error");
    const p = await r.json();
    return { reply: `@${p.username} · ${p.account_type} · ${p.media_count} posts`, data: p };
  },

  generate_image: async ({ db, userId, message, style }) => {
    const img = await generateImage(message, style);
    const extension = img.mime.includes("png") ? "png" : img.mime.includes("webp") ? "webp" : "jpg";
    const path = `${userId}/${crypto.randomUUID()}.${extension}`;
    const up = await db.storage.from("creator-assets").upload(path, img.bytes, { contentType: img.mime });
    if (up.error) throw new HttpError(500, up.error.message);
    const { data: signed } = await db.storage.from("creator-assets").createSignedUrl(path, 3600);
    await db.from("generated_assets").insert({ user_id: userId, kind: "image", module: "image_generator", prompt: message, output_url: path });
    return { reply: "Image generated and saved to your history.", data: { url: signed?.signedUrl, style, provider: img.provider } };
  },

  generate_content: textTool("content", "content_studio"),
  business_ideas: textTool("business", "business_ideas"),

  username_search: async ({ message }) => {
    const base = (message.match(/[a-z0-9._]{3,30}/gi) ?? []).filter((w) => !/username|search|find/i.test(w)).pop()?.toLowerCase() ?? "creator";
    const variants = [base, `${base}_official`, `${base}.studio`, `the.${base}`, `${base}.co`, `real${base}`];
    return {
      reply: variants.map((v) => `• ${v}`).join("\n") + "\n\nVerify public profiles:\n" + PLATFORMS.map((f) => f(base)).join("\n"),
      data: { variants },
    };
  },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const user = await requireUser(req);
    const body = await req.json();
    const message = String(body.message ?? "").trim().slice(0, 4000);
    if (!message) throw new HttpError(400, "empty message");
    const db = admin();

    let convId: string = body.conversation_id;
    if (convId) {
      const { data } = await db.from("conversations").select("id").eq("id", convId).eq("user_id", user.id).maybeSingle();
      if (!data) throw new HttpError(404, "conversation not found");
    } else {
      const { data, error } = await db.from("conversations").insert({ user_id: user.id, title: message.slice(0, 60) }).select("id").single();
      if (error) throw new HttpError(500, error.message);
      convId = data.id;
    }
    await db.from("messages").insert({ conversation_id: convId, role: "user", content: message });

    // Agent memory: load, and capture "my brand is X" as durable memory
    const { data: mem } = await db.from("agent_memory").select("key,value").eq("user_id", user.id);
    const memory: Record<string, string> = Object.fromEntries((mem ?? []).map((m) => [m.key, m.value]));
    const brand = message.match(/(?:my brand is|brand name is)\s+(.{2,60})/i);
    if (brand) {
      memory.brand = brand[1].trim();
      await db.from("agent_memory").upsert({ user_id: user.id, key: "brand", value: memory.brand, updated_at: new Date().toISOString() }, { onConflict: "user_id,key" });
    }

    // Tool selection: explicit module tool wins, else intent detection, else plain chat
    const tool: string | null = body.tool && handlers[body.tool] ? body.tool : detectIntent(message);
    let result: Result;
    if (tool && handlers[tool]) {
      await assertPermitted(db, user.id, tool);
      result = await handlers[tool]({ db, userId: user.id, message, style: body.style ?? "cinematic", memory });
    } else {
      const note = Object.entries(memory).map(([k, v]) => `${k}=${v}`).join("; ");
      const r = await complete("chat", message, note);
      result = { reply: r.text, data: { provider: r.provider } };
    }

    await db.from("messages").insert({ conversation_id: convId, role: "assistant", content: result.reply, tool_name: tool });
    await log(db, user.id, "agent.request", { tool, conversation_id: convId });
    return json({ conversation_id: convId, tool, ...result });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "error" }, e instanceof HttpError ? e.status : 500);
  }
});

