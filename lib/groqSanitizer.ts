/**
 * groqSanitizer.ts
 *
 * Every string that reaches the Groq API (prompts, user notes, extracted
 * tags, imported link text, etc.) must pass through here first. This is
 * the single choke point for stripping formatting fragments and invalid
 * line breaks that can otherwise break Groq's JSON-mode parsing or leak
 * control characters into a prompt.
 */

const MAX_FIELD_LENGTH = 4000;

/** Strips control characters, zero-width characters, and normalizes whitespace. */
function stripControlCharacters(input: string): string {
  return input
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/[\u200B-\u200F\uFEFF]/g, ""); // zero-width / bidi marks
}

/** Collapses CRLF/CR/LF variants and repeated blank lines into single spaces. */
function normalizeLineBreaks(input: string): string {
  return input
    .replace(/\r\n|\r|\n/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Strips markdown/code-fence fragments that can confuse strict JSON mode. */
function stripFormattingFragments(input: string): string {
  return input
    .replace(/```[\s\S]*?```/g, " ") // fenced code blocks
    .replace(/`/g, "") // stray backticks
    .replace(/[{}[\]]{2,}/g, " "); // runs of brace/bracket noise
}

/**
 * Sanitizes a single string field bound for a Groq prompt. Always returns
 * a string (never throws, never returns null/undefined) so callers can
 * safely interpolate the result directly into a prompt.
 */
export function sanitizeGroqText(input: unknown): string {
  if (typeof input !== "string" || input.length === 0) return "";

  let clean = input;
  clean = stripControlCharacters(clean);
  clean = normalizeLineBreaks(clean);
  clean = stripFormattingFragments(clean);

  if (clean.length > MAX_FIELD_LENGTH) {
    clean = clean.slice(0, MAX_FIELD_LENGTH);
  }

  return clean;
}

/**
 * Recursively sanitizes every string value in a plain object/array payload
 * before it's dropped into a Groq prompt or JSON body. Non-string values
 * pass through unchanged; unsupported/circular shapes fall back to `{}`
 * rather than throwing.
 */
export function sanitizeGroqPayload<T>(payload: T): T {
  try {
    if (typeof payload === "string") {
      return sanitizeGroqText(payload) as unknown as T;
    }
    if (Array.isArray(payload)) {
      return payload.map((item) => sanitizeGroqPayload(item)) as unknown as T;
    }
    if (payload && typeof payload === "object") {
      const out: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(payload)) {
        out[key] = sanitizeGroqPayload(value);
      }
      return out as unknown as T;
    }
    return payload;
  } catch {
    return (Array.isArray(payload) ? [] : {}) as unknown as T;
  }
}

/**
 * Formats a tags object as "key: value, key: value" instead of
 * JSON.stringify's {"key":"value","key":"value"}. Same information,
 * roughly 25-35% fewer characters (no braces, no quote marks around
 * every key and value), which matters because several routes rebuild
 * and resend the entire closet/wishlist list as prompt text on every
 * single call — that serialization overhead repeats on every request,
 * so trimming it here cuts real input-token cost app-wide rather than
 * just once.
 */
export function formatTagsCompact(tags: Record<string, string> | undefined | null): string {
  if (!tags) return "";
  return Object.entries(tags)
    .map(([k, v]) => `${k}: ${v}`)
    .join(", ");
}

/** Validates a data URL image before it's sent to a vision model. */
export function isSafeImageDataUrl(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^data:image\/(png|jpe?g|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(value) &&
    value.length < 8_000_000 // ~6MB decoded ceiling, avoids oversized payloads
  );
}
