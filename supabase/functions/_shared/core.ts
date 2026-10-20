
import { createClient, SupabaseClient } from "npm:@supabase/supabase-js@2";

export const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json; charset=utf-8" },
  });

export const env = (k: string): string => Deno.env.get(k) ?? "";

export const admin = (): SupabaseClient =>
  createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false },
  });

export async function requireUser(
  req: Request,
): Promise<{ id: string; email: string }> {
  const token = (req.headers.get("authorization") ?? "")
    .replace(/^Bearer\s+/i, "");

  if (!token) throw new HttpError(401, "missing session");

  const { data, error } = await admin().auth.getUser(token);

  if (error || !data.user) {
    throw new HttpError(401, "invalid session");
  }

  return { id: data.user.id, email: data.user.email ?? "" };
}

// AES-GCM token encryption.
// TOKEN_ENCRYPTION_KEY must be base64-encoded 32 random bytes.
async function aesKey(): Promise<CryptoKey> {
  const encoded = env("TOKEN_ENCRYPTION_KEY");
  if (!encoded) throw new Error("TOKEN_ENCRYPTION_KEY is not configured");

  const raw = Uint8Array.from(atob(encoded), (c) => c.charCodeAt(0));

  if (raw.length !== 32) {
    throw new Error("TOKEN_ENCRYPTION_KEY must decode to 32 bytes");
  }

  return crypto.subtle.importKey(
    "raw",
    raw,
    "AES-GCM",
    false,
    ["encrypt", "decrypt"],
  );
}

export async function encrypt(plain: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      await aesKey(),
      new TextEncoder().encode(plain),
    ),
  );

  const out = new Uint8Array(iv.length + ct.length);
  out.set(iv);
  out.set(ct, iv.length);

  return btoa(String.fromCharCode(...out));
}

export async function decrypt(b64: string): Promise<string> {
  const data = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));

  if (data.length < 13) {
    throw new Error("Invalid encrypted data");
  }

  const pt = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: data.slice(0, 12) },
    await aesKey(),
    data.slice(12),
  );

  return new TextDecoder().decode(pt);
}

// HMAC-signed OAuth state.
async function hmacKey(): Promise<CryptoKey> {
  const secret = env("STATE_SECRET");
  if (!secret) throw new Error("STATE_SECRET is not configured");

  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
}

export async function signState(payload: string): Promise<string> {
  const sig = new Uint8Array(
    await crypto.subtle.sign(
      "HMAC",
      await hmacKey(),
      new TextEncoder().encode(payload),
    ),
  );

  return `${payload}.${Array.from(sig, (b) =>
    b.toString(16).padStart(2, "0")
  ).join("")}`;
}

export async function verifyState(state: string): Promise<string> {
  const i = state.lastIndexOf(".");
  if (i < 0) throw new HttpError(400, "invalid state");

  const payload = state.slice(0, i);
  const expected = await signState(payload);

  if (expected !== state) {
    throw new HttpError(400, "invalid state");
  }

  return payload;
}

// Permissions: tool must exist, be enabled, and its integration active.
export async function assertPermitted(
  db: SupabaseClient,
  userId: string,
  tool: string,
) {
  const { data: t } = await db
    .from("tools")
    .select("*")
    .eq("name", tool)
    .maybeSingle();

  if (!t) throw new HttpError(400, `unknown tool ${tool}`);

  const { data: p } = await db
    .from("permissions")
    .select("allowed")
    .eq("user_id", userId)
    .eq("tool_name", tool)
    .maybeSingle();

  if (p && !p.allowed) {
    throw new HttpError(403, `tool ${tool} is disabled for this account`);
  }

  if (t.requires_integration) {
    const { data: i } = await db
      .from("integrations")
      .select("status")
      .eq("user_id", userId)
      .eq("provider", t.requires_integration)
      .maybeSingle();

    if (!i || i.status !== "active") {
      throw new HttpError(409, `connect ${t.requires_integration} first`);
    }
  }
}

export async function log(
  db: SupabaseClient,
  userId: string,
  action: string,
  detail: Record<string, unknown> = {},
) {
  await db.from("activity_logs").insert({
    user_id: userId,
    action,
    detail,
  });
}

// Text provider abstraction.
// Priority: Gemini -> OpenAI-compatible provider -> existing keyless fallback.
export type Mode = "chat" | "content" | "business";

const SYSTEM: Record<Mode, string> = {
  chat:
    "You are SHIWA Creator AI, a capable assistant for creators. Detect the language of the latest user message and answer entirely in that same language. If the user writes Persian, respond in natural, fluent Persian (فارسی), using correct Persian script and grammar. Never mix Persian and English randomly. Use English only for proper names, technical identifiers, and terms that are clearer in English; explain technical terms in Persian. For greetings, give a brief natural greeting and ask how you can help. Do not invent facts or claim tools/actions were run unless they actually were. Be clear, coherent, and helpful.",
  content:
    "You are SHIWA Creator AI, a professional social media strategist. Detect the user's language and answer entirely in that language. For Persian, write fluent, natural Persian in Persian script; do not mix random English fragments. Produce captions, content ideas, hashtags, brand names, sticker concepts and posting plans as requested. Do not claim hashtags are trending unless verified.",
  business:
    "You are SHIWA Creator AI, a startup strategist. Detect the user's language and answer entirely in that language. For Persian, write fluent, natural Persian in Persian script and do not mix random English fragments. Produce business ideas with revenue strategies, market opportunities, monetization methods and a practical execution roadmap.",
};

export async function complete(
  mode: Mode,
  user: string,
  memoryNote = "",
): Promise<{ provider: string; text: string }> {
  const system = SYSTEM[mode] +
    (memoryNote ? `\nKnown about the user: ${memoryNote}` : "");

  // Gemini is the preferred text provider when GEMINI_API_KEY is configured.
  if (env("GEMINI_API_KEY")) {
    try {
      const text = await gemini(system, user);
      return { provider: "gemini", text };
    } catch (e) {
      console.error(
        "Gemini request failed; attempting OpenAI-compatible provider:",
        e instanceof Error ? e.message : "unknown error",
      );
    }
  }

  // OpenAI-compatible fallback (for example, OpenRouter).
  if (
    env("OPENAI_COMPAT_BASE_URL") &&
    env("OPENAI_COMPAT_API_KEY") &&
    env("OPENAI_COMPAT_MODEL")
  ) {
    try {
      const text = await openAICompat(system, user);
      return { provider: "openrouter", text };
    } catch (e) {
      console.error(
        "OpenAI-compatible request failed; attempting free fallback:",
        e instanceof Error ? e.message : "unknown error",
      );
    }
  }

  // Existing keyless fallback.
  try {
    const text = await pollinationsText(system, user);
    return { provider: "pollinations-free", text };
  } catch (e) {
    console.error(
      "Free text fallback failed:",
      e instanceof Error ? e.message : "unknown error",
    );
  }

  return {
    provider: "builtin",
    text:
      "در حال حاضر سرویس هوش مصنوعی پاسخ‌گو نیست. تنظیمات اتصال را بررسی کن و کمی بعد دوباره تلاش کن.",
  };
}

async function pollinationsText(
  system: string,
  user: string,
): Promise<string> {
  const prompt =
    `${system}\n\nUser request (respond in the same language):\n${user}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25000);

  try {
    const r = await fetch(
      `https://text.pollinations.ai/${encodeURIComponent(prompt)}?model=openai`,
      {
        method: "GET",
        headers: { Accept: "text/plain" },
        signal: controller.signal,
      },
    );

    if (!r.ok) {
      throw new Error(`free text provider returned ${r.status}`);
    }

    const text = (await r.text()).trim();

    if (!text || text.length < 2) {
      throw new Error("free text provider returned an empty response");
    }

    return text.slice(0, 16000);
  } finally {
    clearTimeout(timeout);
  }
}

async function gemini(system: string, user: string): Promise<string> {
  const apiKey = env("GEMINI_API_KEY");
  const model = env("GEMINI_MODEL") || "gemini-2.5-flash";

  if (!apiKey) throw new Error("GEMINI_API_KEY is not configured");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);

  try {
    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents: [{ role: "user", parts: [{ text: user }] }],
        }),
        signal: controller.signal,
      },
    );

    if (!r.ok) {
      const detail = (await r.text()).slice(0, 400);
      console.error("Gemini HTTP error:", r.status, detail);
      throw new Error(`Gemini returned HTTP ${r.status}`);
    }

    const data = await r.json();
    const parts = data?.candidates?.[0]?.content?.parts;

    const text = Array.isArray(parts)
      ? parts.map((p: { text?: string }) =>
        typeof p.text === "string" ? p.text : ""
      ).join("").trim()
      : "";

    if (!text) {
      throw new Error("Gemini returned no text content");
    }

    return text.slice(0, 16000);
  } finally {
    clearTimeout(timeout);
  }
}

async function openAICompat(
  system: string,
  user: string,
): Promise<string> {
  const baseUrl = env("OPENAI_COMPAT_BASE_URL").replace(/\/+$/, "");
  const apiKey = env("OPENAI_COMPAT_API_KEY");
  const model = env("OPENAI_COMPAT_MODEL");

  if (!baseUrl || !apiKey || !model) {
    throw new Error("OpenAI-compatible provider configuration is incomplete");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);

  try {
    const r = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
      signal: controller.signal,
    });

    if (!r.ok) {
      const detail = (await r.text()).slice(0, 400);
      console.error("OpenRouter HTTP error:", r.status, detail);
      throw new Error(`OpenRouter returned HTTP ${r.status}`);
    }

    const data = await r.json();
    const content = data?.choices?.[0]?.message?.content;

    if (typeof content !== "string" || !content.trim()) {
      throw new Error("OpenRouter returned empty or invalid content");
    }

    return content.trim().slice(0, 16000);
  } finally {
    clearTimeout(timeout);
  }
}

// Image generation: Gemini first, then existing Pollinations fallback.
export async function generateImage(prompt: string, style: string) {
  const full =
    `${prompt}, ${style} style, professional composition, high detail`;

  if (env("GEMINI_API_KEY")) {
    try {
      const model = env("GEMINI_IMAGE_MODEL") || "gemini-2.5-flash-image";

      const r = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": env("GEMINI_API_KEY"),
          },
          body: JSON.stringify({
            contents: [{
              role: "user",
              parts: [{
                text:
                  `Generate one polished, photorealistic image based on this prompt: ${full}. Return an image, not just a description.`,
              }],
            }],
            generationConfig: {
              responseModalities: ["IMAGE", "TEXT"],
            },
          }),
        },
      );

      if (r.ok) {
        const data = await r.json();
        const parts = data?.candidates?.[0]?.content?.parts ?? [];
        const part = parts.find((p: any) => p.inlineData?.data);

        if (part?.inlineData?.data) {
          const binary = atob(part.inlineData.data);
          const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));

          return {
            provider: "gemini",
            bytes,
            mime: part.inlineData.mimeType ?? "image/png",
          };
        }

        console.error("Gemini image response contained no image data");
      } else {
        console.error("Gemini image provider returned", r.status);
      }
    } catch (e) {
      console.error(
        "Gemini image generation failed; using fallback:",
        e instanceof Error ? e.message : "unknown error",
      );
    }
  }

  const seed = crypto.getRandomValues(new Uint32Array(1))[0];
  const r = await fetch(
    `https://image.pollinations.ai/prompt/${encodeURIComponent(full)}?width=1024&height=1024&nologo=true&seed=${seed}`,
  );

  if (!r.ok) {
    throw new HttpError(502, `image provider returned ${r.status}`);
  }

  return {
    provider: "pollinations-fallback",
    bytes: new Uint8Array(await r.arrayBuffer()),
    mime: r.headers.get("content-type") ?? "image/jpeg",
  };
}
