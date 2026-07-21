import { sanitizeGroqText, isSafeImageDataUrl } from "./groqSanitizer";

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

// Groq's model lineup changes often and they deprecate models with only
// email notice. If tagging/generation ever starts failing with a 404 or
// "model_decommissioned" error, check https://console.groq.com/docs/models
// and override via GROQ_VISION_MODEL / GROQ_TEXT_MODEL env vars rather
// than editing this file.
export const VISION_MODEL =
  process.env.GROQ_VISION_MODEL || "qwen/qwen3.6-27b";
export const TEXT_MODEL = process.env.GROQ_TEXT_MODEL || "openai/gpt-oss-120b";

type ChatContent =
  | string
  | Array<
      | { type: "text"; text: string }
      | { type: "image_url"; image_url: { url: string } }
    >;

interface ChatMessage {
  role: "system" | "user";
  content: ChatContent;
}

interface GroqCallOptions {
  model: string;
  jsonMode?: boolean;
  temperature?: number;
  maxCompletionTokens?: number;
}

/**
 * Builds a text message, sanitizing the text through groqSanitizer first.
 * All API routes should construct prompts through this helper (or
 * buildImageMessage below) rather than interpolating raw strings.
 */
export function buildTextMessage(
  role: "system" | "user",
  text: string
): ChatMessage {
  return { role, content: sanitizeGroqText(text) };
}

/**
 * Builds a user message combining sanitized prompt text with an image.
 * Rejects (returns text-only) if the image isn't a well-formed, size
 * bounded data URL, rather than forwarding a malformed payload to Groq.
 */
export function buildImageMessage(text: string, imageDataUrl: string): ChatMessage {
  const cleanText = sanitizeGroqText(text);
  if (!isSafeImageDataUrl(imageDataUrl)) {
    return { role: "user", content: cleanText };
  }
  return {
    role: "user",
    content: [
      { type: "text", text: cleanText },
      { type: "image_url", image_url: { url: imageDataUrl } },
    ],
  };
}

function formatRateLimitMessage(retryAfterSec: number): string {
  if (retryAfterSec <= 90) {
    const seconds = Math.ceil(retryAfterSec);
    return `Groq's rate limit was hit from too many recent AI requests. Wait about ${seconds}s and try again.`;
  }
  if (retryAfterSec <= 60 * 60) {
    const minutes = Math.ceil(retryAfterSec / 60);
    return `Groq's rate limit was hit. This looks like a longer cooldown (about ${minutes} minutes), likely a daily request or usage cap rather than a brief burst, so retrying immediately won't help.`;
  }
  const hours = Math.ceil(retryAfterSec / 3600);
  return `Groq's daily usage limit was hit. It won't reset for about ${hours} hour${
    hours === 1 ? "" : "s"
  }, this is a per-day cap on the free tier, not something that clears by spacing requests out. Check console.groq.com/settings/limits or consider a paid tier if this happens often.`;
}

async function callGroq(
  messages: ChatMessage[],
  opts: GroqCallOptions,
  apiKey: string
) {
  return fetch(GROQ_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: opts.model,
      messages,
      temperature: opts.temperature ?? 0.4,
      // Groq's default max_completion_tokens (1024 on many models) is
      // easily exceeded by a multi-item JSON array response, and
      // reasoning-style models spend part of that budget "thinking"
      // before writing the answer. A truncated response is syntactically
      // invalid JSON, which Groq reports as json_validate_failed, so we
      // always give jsonMode calls a generous ceiling.
      max_completion_tokens: opts.maxCompletionTokens ?? (opts.jsonMode ? 4096 : 1024),
      ...(opts.jsonMode ? { response_format: { type: "json_object" } } : {}),
    }),
  });
}

/**
 * Sends a chat completion request to Groq. Credentials are read only from
 * process.env server-side; never accept an API key from the client.
 */
export async function groqChat(
  messages: ChatMessage[],
  opts: GroqCallOptions
): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error(
      "GROQ_API_KEY is not set. Add it to .env.local for development, or your Vercel project's environment variables for production."
    );
  }

  const isJsonValidationFailure = (text: string) =>
    text.includes("json_validate_failed") || text.includes("failed_generation");

  let res = await callGroq(messages, opts, apiKey);

  // Groq's free tier caps requests per minute; a burst of uploads (bulk
  // import, or several quick single-item adds) can exceed that within a
  // rolling 60s window. Groq returns 429 with a retry-after header in
  // that case, distinct from a json_validate_failed content problem, so
  // it needs its own backoff-and-retry path rather than falling through
  // to the generic error below (which previously left every item after
  // the limit silently untagged with no explanation).
  // Groq enforces limits on multiple windows at once (requests/minute,
  // tokens/minute, and also requests/day and tokens/day on the free
  // tier). A 429 can mean either: a short per-minute window (worth a
  // quick inline retry) or a per-day cap (which won't clear for hours,
  // so retrying at all is pointless and misleading). Groq's own
  // retry-after header tells us which: seconds means the former, tens
  // of minutes or hours means the latter. We trust that value instead
  // of guessing "wait a minute" for every 429.
  let rateLimitAttempt = 0;
  while (res.status === 429 && rateLimitAttempt < 2) {
    const retryAfterHeader = res.headers.get("retry-after");
    const retryAfterSec = retryAfterHeader ? parseFloat(retryAfterHeader) : NaN;

    if (Number.isFinite(retryAfterSec) && retryAfterSec > 15) {
      // A long wait means a per-day cap, not a per-minute burst.
      // Retrying won't help within this request, so fail fast with the
      // real wait time rather than looping.
      throw new Error(formatRateLimitMessage(retryAfterSec));
    }

    const waitMs = Number.isFinite(retryAfterSec) && retryAfterSec > 0
      ? retryAfterSec * 1000
      : 4000;
    await new Promise((resolve) => setTimeout(resolve, waitMs));
    rateLimitAttempt += 1;
    res = await callGroq(messages, opts, apiKey);
  }

  if (res.status === 429) {
    const retryAfterHeader = res.headers.get("retry-after");
    const retryAfterSec = retryAfterHeader ? parseFloat(retryAfterHeader) : NaN;
    throw new Error(
      Number.isFinite(retryAfterSec)
        ? formatRateLimitMessage(retryAfterSec)
        : "Groq's rate limit was hit from too many recent AI requests. Wait a bit and try tagging this item again."
    );
  }

  // A transient generation hiccup (empty failed_generation / strict JSON
  // mode validation failure) usually self-heals with a retry at a
  // slightly higher temperature, so we don't surface an error to the
  // user for something that's not really a request problem. json_object
  // mode is documented by Groq as occasionally producing malformed JSON
  // on complex/open-ended schemas, so we give it two extra tries before
  // giving up.
  let attempt = 0;
  while (!res.ok && opts.jsonMode && attempt < 2) {
    const text = await res.text();
    if (!isJsonValidationFailure(text)) {
      throw new Error(`Groq API error (${res.status}): ${text}`);
    }
    attempt += 1;
    res = await callGroq(
      messages,
      { ...opts, temperature: (opts.temperature ?? 0.4) + 0.15 * attempt },
      apiKey
    );
  }

  if (!res.ok) {
    const text = await res.text();
    // If we exhausted retries on a JSON validation failure specifically,
    // give the caller a message worth showing a user rather than raw
    // Groq internals.
    if (opts.jsonMode && isJsonValidationFailure(text)) {
      throw new Error(
        "The AI had trouble reading that image clearly. Try a clearer or less cluttered screenshot."
      );
    }
    throw new Error(`Groq API error (${res.status}): ${text}`);
  }

  const data = await res.json();
  return data?.choices?.[0]?.message?.content || "";
}

/**
 * Parses a Groq JSON-mode response defensively. Never throws; returns
 * the fallback value if parsing fails so a malformed model response
 * can't crash the calling API route.
 */
export function parseGroqJson<T>(raw: string, fallback: T): T {
  try {
    const parsed = JSON.parse(raw);
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}
