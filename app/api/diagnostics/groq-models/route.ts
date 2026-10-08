import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Read-only diagnostic: lists exactly which Groq model IDs this account's
 * API key can actually use right now, plus which of our own candidate
 * models match. Hitting this directly (GET /api/diagnostics/groq-models)
 * replaces guessing at the Groq console blind — it shows the live,
 * authoritative permission state for this exact key, which is what the
 * app itself will see on its next AI call.
 *
 * No request body, no user input, nothing persisted — this never touches
 * groqSanitizer or any payload the user controls, so it's exempt from
 * that pipeline by design.
 */
export async function GET() {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "GROQ_API_KEY is not set in this environment's variables (Vercel project settings, or .env.local for local dev).",
      },
      { status: 500 }
    );
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8_000);
    const res = await fetch("https://api.groq.com/openai/v1/models", {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: controller.signal,
    }).finally(() => clearTimeout(timeoutId));

    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json(
        {
          ok: false,
          status: res.status,
          error: `Groq rejected the models list request itself: ${text}`,
          hint:
            res.status === 401
              ? "This usually means the GROQ_API_KEY value is wrong, expired, or from a different Groq account/project than you're checking in the console."
              : undefined,
        },
        { status: 502 }
      );
    }

    const data = await res.json();
    const availableIds: string[] = Array.isArray(data?.data)
      ? data.data.map((m: { id?: string }) => m?.id).filter(Boolean)
      : [];

    const VISION_CANDIDATES = [
      "qwen/qwen3.8-27b",
      "qwen/qwen3.6-27b",
      "meta-llama/llama-4-scout-17b-16e-instruct",
      "meta-llama/llama-4-maverick-17b-128e-instruct",
    ];
    const TEXT_CANDIDATES = [
      "openai/gpt-oss-120b",
      "openai/gpt-oss-20b",
      "llama-3.3-70b-versatile",
    ];

    const availableSet = new Set(availableIds);

    return NextResponse.json({
      ok: true,
      accountHasAccessToModels: availableIds.sort(),
      visionCandidates: VISION_CANDIDATES.map((id) => ({
        id,
        availableToThisKey: availableSet.has(id),
      })),
      textCandidates: TEXT_CANDIDATES.map((id) => ({
        id,
        availableToThisKey: availableSet.has(id),
      })),
      wouldUseForVision:
        VISION_CANDIDATES.find((id) => availableSet.has(id)) ||
        `${VISION_CANDIDATES[0]} (none confirmed available, falling back to default and will self-correct on first 403/404)`,
      wouldUseForText:
        TEXT_CANDIDATES.find((id) => availableSet.has(id)) ||
        `${TEXT_CANDIDATES[0]} (none confirmed available, falling back to default and will self-correct on first 403/404)`,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { ok: false, error: `Could not reach Groq's models endpoint: ${message}` },
      { status: 502 }
    );
  }
}
