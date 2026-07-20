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

  let res = await callGroq(messages, opts, apiKey);

  // A transient generation hiccup (empty failed_generation / strict JSON
  // mode validation failure) usually self-heals with one retry at a
  // slightly higher temperature, so we don't surface an error to the
  // user for something that's not really a request problem.
  if (!res.ok && opts.jsonMode) {
    const text = await res.text();
    if (
      text.includes("json_validate_failed") ||
      text.includes("failed_generation")
    ) {
      res = await callGroq(
        messages,
        { ...opts, temperature: (opts.temperature ?? 0.4) + 0.15 },
        apiKey
      );
    } else {
      throw new Error(`Groq API error (${res.status}): ${text}`);
    }
  }

  if (!res.ok) {
    const text = await res.text();
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
