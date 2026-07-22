import { NextRequest, NextResponse } from "next/server";
import { groqChat, parseGroqJson, buildTextMessage, TEXT_MODEL } from "@/lib/groq";
import { sanitizeGroqPayload, formatTagsCompact } from "@/lib/groqSanitizer";
import type { ClosetItem, GeneratedLook } from "@/lib/types";

interface InsightsBody {
  items?: ClosetItem[];
  looks?: GeneratedLook[];
}

interface InsightsResult {
  gaps: string[];
  patterns: string[];
}

const FALLBACK: InsightsResult = { gaps: [], patterns: [] };

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => null)) as InsightsBody | null;
    const items = Array.isArray(body?.items) ? body!.items : [];
    const looks = Array.isArray(body?.looks) ? body!.looks : [];

    if (items.length === 0) {
      return NextResponse.json(
        { error: "Add some closet items first." },
        { status: 400 }
      );
    }

    const closetList = items
      .map((i) => {
        const safe = sanitizeGroqPayload({
          category: i?.category || "",
          name: i?.name || "",
          tags: i?.tags || {},
        });
        return `- ${safe.category} | ${safe.name} | ${formatTagsCompact(safe.tags)}`;
      })
      .join("\n");

    const lookList = looks
      .map((l) => `- ${sanitizeGroqPayload(l?.prompt || "")}`)
      .join("\n");

    const systemPrompt = `You are a wardrobe analyst. Return ONLY a JSON object:
{
  "gaps": [short, specific strings naming foundational pieces the closet is missing, based on real imbalance in the categories/colors listed, not generic advice],
  "patterns": [short strings describing real patterns in what they own or have styled, only include patterns actually supported by the data given]
}
Keep each array to at most 5 items. If the closet is too small to say anything meaningful, return short arrays saying so.`;

    const userPrompt = `Closet:
${closetList}

Past styling requests (if any):
${lookList || "(none yet)"}`;

    const content = await groqChat(
      [buildTextMessage("system", systemPrompt), buildTextMessage("user", userPrompt)],
      { model: TEXT_MODEL, jsonMode: true, temperature: 0.4, label: "Generating closet insights", maxCompletionTokens: 1800 }
    );

    const parsed = parseGroqJson<InsightsResult>(content, FALLBACK);
    return NextResponse.json({
      gaps: parsed.gaps || [],
      patterns: parsed.patterns || [],
    });
  } catch (err) {
    console.error("closet-insights failed:", err instanceof Error ? err.message : err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Insights failed" },
      { status: 500 }
    );
  }
}
