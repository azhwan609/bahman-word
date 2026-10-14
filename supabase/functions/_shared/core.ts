import { createClient, SupabaseClient } from "npm:@supabase/supabase-js@2";

export const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

export class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

export const env = (k: string): string => Deno.env.get(k) ?? "";

export const admin = (): SupabaseClient =>
  createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false } });

export async function requireUser(req: Request): Promise<{ id: string; email: string }> {
  const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token) throw new HttpError(401, "missing session");
  const { data, error } = await admin().auth.getUser(token);
  if (error || !data.user) throw new HttpError(401, "invalid session");
  return { id: data.user.id, email: data.user.email ?? "" };
}

// ---------- AES-GCM token encryption (TOKEN_ENCRYPTION_KEY = base64 of 32 random bytes)
async function aesKey(): Promise<CryptoKey> {
  const raw = Uint8Array.from(atob(env("TOKEN_ENCRYPTION_KEY")), (c) => c.charCodeAt(0));
  return crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt", "decrypt"]);
}
export async function encrypt(plain: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await aesKey(), new TextEncoder().encode(plain)));
  const out = new Uint8Array(iv.length + ct.length);
  out.set(iv); out.set(ct, iv.length);
  return btoa(String.fromCharCode(...out));
}
export async function decrypt(b64: string): Promise<string> {
  const data = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: data.slice(0, 12) }, await aesKey(), data.slice(12));
  return new TextDecoder().decode(pt);
}

// ---------- HMAC-signed OAuth state (CSRF protection)
async function hmacKey(): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", new TextEncoder().encode(env("STATE_SECRET")), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
}
export async function signState(payload: string): Promise<string> {
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", await hmacKey(), new TextEncoder().encode(payload)));
  return `${payload}.${Array.from(sig, (b) => b.toString(16).padStart(2, "0")).join("")}`;
}
export async function verifyState(state: string): Promise<string> {
  const i = state.lastIndexOf(".");
  const payload = state.slice(0, i);
  if (i < 0 || (await signState(payload)) !== state) throw new HttpError(400, "invalid state");
  return payload;
}

// ---------- Permissions: tool must exist, be enabled for user, and its integration must be active
export async function assertPermitted(db: SupabaseClient, userId: string, tool: string) {
  const { data: t } = await db.from("tools").select("*").eq("name", tool).maybeSingle();
  if (!t) throw new HttpError(400, `unknown tool ${tool}`);
  const { data: p } = await db.from("permissions").select("allowed").eq("user_id", userId).eq("tool_name", tool).maybeSingle();
  if (p && !p.allowed) throw new HttpError(403, `tool ${tool} is disabled for this account`);
  if (t.requires_integration) {
    const { data: i } = await db.from("integrations").select("status").eq("user_id", userId).eq("provider", t.requires_integration).maybeSingle();
    if (!i || i.status !== "active") throw new HttpError(409, `connect ${t.requires_integration} first`);
  }
}

export async function log(db: SupabaseClient, userId: string, action: string, detail: Record<string, unknown> = {}) {
  await db.from("activity_logs").insert({ user_id: userId, action, detail });
}

// ---------- Text provider abstraction: Gemini -> OpenAI-compatible open-source host -> built-in fallback
export type Mode = "chat" | "content" | "business";
const SYSTEM: Record<Mode, string> = {
  chat: "You are SHIWA Creator AI, an autonomous assistant for creators. Be concise. Reply in the user's language (Persian or English).",
  content: "You are a social media strategist. Produce captions, viral ideas, trending hashtags, brand names, sticker concepts and a posting plan. Reply in the user's language.",
  business: "You are a startup strategist. Produce business ideas with revenue strategies, market opportunities, monetization methods and an execution roadmap. Reply in the user's language.",
};

export async function complete(mode: Mode, user: string, memoryNote = ""): Promise<{ provider: string; text: string }> {
  const system = SYSTEM[mode] + (memoryNote ? `\nKnown about the user: ${memoryNote}` : "");
  try {
    if (env("GEMINI_API_KEY")) return { provider: "gemini", text: await gemini(system, user) };
    if (env("OPENAI_COMPAT_BASE_URL")) return { provider: "open-source", text: await openAICompat(system, user) };
  } catch (e) {
    console.error("text provider failed, using built-in fallback:", e);
  }
  return { provider: "builtin", text: `Built-in mode: set GEMINI_API_KEY or OPENAI_COMPAT_BASE_URL for full AI output.\n\nRequest: ${user}` };
}

async function gemini(system: string, user: string): Promise<string> {
  const model = env("GEMINI_MODEL") || "gemini-2.0-flash";
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": env("GEMINI_API_KEY") },
    body: JSON.stringify({ systemInstruction: { parts: [{ text: system }] }, contents: [{ role: "user", parts: [{ text: user }] }] }),
  });
  if (!r.ok) throw new Error(`gemini ${r.status}`);
  const j = await r.json();
  return j.candidates[0].content.parts.map((p: { text: string }) => p.text).join("");
}

async function openAICompat(system: string, user: string): Promise<string> {
  const r = await fetch(`${env("OPENAI_COMPAT_BASE_URL")}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${env("OPENAI_COMPAT_API_KEY")}` },
    body: JSON.stringify({ model: env("OPENAI_COMPAT_MODEL"), messages: [{ role: "system", content: system }, { role: "user", content: user }] }),
  });
  if (!r.ok) throw new Error(`openai-compat ${r.status}`);
  return (await r.json()).choices[0].message.content;
}

// ---------- Image provider: free, keyless default (Pollinations); swap per provider here
export async function generateImage(prompt: string, style: string) {
  const full = `${prompt}, ${style} style, high quality`;
  const seed = crypto.getRandomValues(new Uint32Array(1))[0];
  const r = await fetch(`https://image.pollinations.ai/prompt/${encodeURIComponent(full)}?width=1024&height=1024&nologo=true&seed=${seed}`);
  if (!r.ok) throw new HttpError(502, `image provider returned ${r.status}`);
  return { provider: "pollinations", bytes: new Uint8Array(await r.arrayBuffer()), mime: r.headers.get("content-type") ?? "image/jpeg" };
}

