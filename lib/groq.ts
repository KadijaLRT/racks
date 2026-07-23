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
  // Human-readable description of what this call is doing (e.g.
  // "Retagging items", "Analyzing wishlist item"), used in the busy-lock
  // error message below so a blocked action names what's blocking it.
  label?: string;
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
  // Without a timeout, a hung/slow Groq response holds the connection
  // (and the exclusive lock below) indefinitely until the hosting
  // platform kills the function externally — at which point our own
  // `finally` block never runs, permanently wedging the lock for that
  // warm instance. An explicit abort guarantees this call always
  // resolves or rejects within a bounded time.
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 25_000);
  try {
    return await fetch(GROQ_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      signal: controller.signal,
      body: JSON.stringify({
      model: opts.model,
      messages,
      temperature: opts.temperature ?? 0.4,
      // Groq's default max_completion_tokens (1024 on many models) is
      // easily exceeded by a multi-item JSON array response, and
      // reasoning-style models spend part of that budget "thinking"
      // before writing the answer. A truncated response is syntactically
      // invalid JSON, which Groq reports as json_validate_failed. Each
      // route below sets its own realistic ceiling based on what it
      // actually returns (a single-item tag call needs far less than a
      // 12-item screenshot batch); this 1536 is only a safety-net
      // default for any jsonMode call that doesn't set one explicitly,
      // deliberately smaller than the old blanket 4096 so an oversized
      // ceiling never sits unused burning potential "thinking" budget
      // on a reasoning model for a small task.
      max_completion_tokens: opts.maxCompletionTokens ?? (opts.jsonMode ? 1536 : 1024),
      ...(opts.jsonMode ? { response_format: { type: "json_object" } } : {}),
      // gpt-oss-120b/20b and qwen3.6-27b are reasoning models: left
      // unset, they can spend a real chunk of max_completion_tokens on
      // internal reasoning before ever writing the actual JSON answer,
      // which is exactly how a structured-output task (pick items from
      // a list, return a fixed shape) can come back empty under token
      // pressure even though the task itself is simple. Forcing low
      // effort for jsonMode calls keeps that budget going to the
      // answer instead, since none of these tasks need deep reasoning,
      // they need a constrained selection.
      //
      // Critical: the accepted values differ by model family. GPT-OSS
      // models take "low"/"medium"/"high"; Qwen models only take
      // "none"/"default", anything else is a 400 Bad Request from Groq.
      // Every vision-based tagging call uses Qwen (VISION_MODEL), so
      // passing "low" there broke retagging specifically while
      // text-only routes on GPT-OSS kept working.
      ...(opts.jsonMode
        ? {
            reasoning_effort: opts.model.includes("qwen") ? "none" : "low",
          }
        : {}),
      }),
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

// Module-level pacer: every call to Groq (across every route in the
// app, since they all funnel through groqChat) waits its turn in this
// chain before firing, spaced at least MIN_GAP_MS apart. Groq's free
// tier caps requests at 30/minute (one every 2s); several quick
// single-item actions in a row, or a page that fires 2 calls back to
// back (e.g. wishlist tag-then-analyze), can otherwise land within the
// same rolling window and trip a 429 that a small delay would have
// avoided entirely. This only helps within one warm server instance,
// not across cold starts or multiple concurrent users, but for the
// common single-person-using-the-app case it meaningfully cuts down
// how often the per-minute cap gets hit.
const MIN_GAP_MS = 2300;
let nextAvailableAt = 0;

async function waitForTurn(): Promise<void> {
  const now = Date.now();
  const runAt = Math.max(now, nextAvailableAt);
  nextAvailableAt = runAt + MIN_GAP_MS;
  const wait = runAt - now;
  if (wait > 0) {
    await new Promise((resolve) => setTimeout(resolve, wait));
  }
}

// Exclusive lock: only one AI action runs at a time, app-wide. This is
// stricter than the pacer above (which just spaces calls out) — if
// something is already using Groq (e.g. a batch retag in progress),
// any other action that tries to start a Groq call is rejected
// immediately with a clear message, rather than silently queuing
// behind it or racing it. Each individual call within a sequential
// batch (like the retag loop, which awaits one item before starting
// the next) releases the lock as soon as it finishes, so it doesn't
// block its own next iteration, only a genuinely different, concurrent
// action trying to start at the same time.
//
// Same caveat as the pacer: this is in-memory and only enforced within
// one warm server instance, not guaranteed across cold starts or truly
// concurrent serverless invocations. For the realistic single-person
// usage this app is built for, that's good enough in practice.
let activeLabel: string | null = null;
let activeLabelSetAt = 0;
// If the hosting platform kills a function externally (its own request
// timeout, not a JS exception), our `finally` block that clears the
// lock never runs. Without a TTL, that permanently wedges every AI
// feature on that warm instance until it's eventually recycled. This
// bounds the damage to, at most, this many milliseconds.
const LOCK_STALE_MS = 30_000;

function throwFormattedRateLimitError(res: Response): never {
  const retryAfterHeader = res.headers.get("retry-after");
  const retryAfterSec = retryAfterHeader ? parseFloat(retryAfterHeader) : NaN;
  throw new Error(
    Number.isFinite(retryAfterSec)
      ? formatRateLimitMessage(retryAfterSec)
      : "Groq's rate limit was hit from too many recent AI requests. Wait a bit and try tagging this item again."
  );
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

  if (activeLabel && Date.now() - activeLabelSetAt < LOCK_STALE_MS) {
    throw new Error(
      `Another AI action ("${activeLabel}") is already running. Wait for it to finish, then try again.`
    );
  }
  activeLabel = opts.label || "an AI request";
  activeLabelSetAt = Date.now();

  try {
    const isJsonValidationFailure = (text: string) => {
      try {
        const parsed = JSON.parse(text);
        if (parsed?.error?.code) {
          return parsed.error.code === "json_validate_failed";
        }
      } catch {
        // Body wasn't JSON at all, fall through to substring matching.
      }
      // Fallback for the rare case Groq returns a non-JSON error body,
      // or as a safety net if the error shape changes unexpectedly.
      return text.includes("json_validate_failed") || text.includes("failed_generation");
    };

    await waitForTurn();
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
        throwFormattedRateLimitError(res);
      }

      const waitMs = Number.isFinite(retryAfterSec) && retryAfterSec > 0
        ? retryAfterSec * 1000
        : 4000;
      await new Promise((resolve) => setTimeout(resolve, waitMs));
      rateLimitAttempt += 1;
      await waitForTurn();
      res = await callGroq(messages, opts, apiKey);
    }

    if (res.status === 429) {
      throwFormattedRateLimitError(res);
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
      // A retry within this loop can itself come back rate-limited (e.g.
      // the first call succeeded but returned malformed JSON, and by the
      // time the retry goes out the daily token cap has been crossed).
      // That's not a JSON-validation problem, so it needs to be checked
      // for and handled with the same friendly message before falling
      // through to the raw-text throw below, rather than being treated
      // as "not a validation failure" and leaking Groq's internal error
      // JSON straight to the user.
      if (res.status === 429) {
        throwFormattedRateLimitError(res);
      }
      const text = await res.text();
      if (!isJsonValidationFailure(text)) {
        throw new Error(`Groq API error (${res.status}): ${text}`);
      }
      attempt += 1;
      await waitForTurn();
      res = await callGroq(
        messages,
        { ...opts, temperature: (opts.temperature ?? 0.4) + 0.15 * attempt },
        apiKey
      );
    }

    if (res.status === 429) {
      throwFormattedRateLimitError(res);
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
  } finally {
    activeLabel = null;
    activeLabelSetAt = 0;
  }
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
