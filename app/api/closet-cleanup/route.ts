import { NextRequest, NextResponse } from "next/server";
import { groqChat, parseGroqJson, buildTextMessage, TEXT_MODEL } from "@/lib/groq";
import { sanitizeGroqPayload } from "@/lib/groqSanitizer";

interface NeglectedItem {
  id: string;
  category: string;
  name: string;
  tags?: Record<string, string>;
  timesWorn: number;
  ageDays: number;
}

interface CleanupBody {
  neglectedItems?: NeglectedItem[];
}

interface CleanupSuggestion {
  id: string;
  action: "keep" | "donate" | "sell" | "repair" | "store";
  reason: string;
}

const FALLBACK: { suggestions: CleanupSuggestion[] } = { suggestions: [] };

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => null)) as CleanupBody | null;
    const neglectedItems = Array.isArray(body?.neglectedItems) ? body!.neglectedItems : [];

    if (neglectedItems.length === 0) {
      return NextResponse.json({ error: "Nothing to review." }, { status: 400 });
    }

    const list = neglectedItems
      .map((i) => {
        const safe = sanitizeGroqPayload({
          category: i?.category || "",
          name: i?.name || "",
          tags: i?.tags || {},
        });
        return `- id:${i.id} | ${safe.category} | ${safe.name} | ${JSON.stringify(safe.tags)} | worn ${
          i.timesWorn
        }× | owned ${i.ageDays} days`;
      })
      .join("\n");

    const systemPrompt = `You are helping someone do a closet cleanup pass on items they rarely wear. For each item, suggest ONE action: "keep" (still worth having even if rarely worn, e.g. a formal piece for occasions that don't come up often), "donate", "sell" (worth real money, nice brand/condition implied by the description), "repair" (only if the name/tags suggest wear), or "store" (seasonal, fine to keep but out of daily rotation). Be honest and varied, don't default everything to the same action. Return ONLY a JSON object:
{
  "suggestions": [ { "id": "closet item id string", "action": "keep" | "donate" | "sell" | "repair" | "store", "reason": "1 short phrase" } ]
}`;

    const userPrompt = `Rarely-worn items:\n${list}`;

    const content = await groqChat(
      [buildTextMessage("system", systemPrompt), buildTextMessage("user", userPrompt)],
      { model: TEXT_MODEL, jsonMode: true, temperature: 0.5 }
    );

    const parsed = parseGroqJson<{ suggestions: CleanupSuggestion[] }>(content, FALLBACK);
    return NextResponse.json({ suggestions: parsed.suggestions || [] });
  } catch (err) {
    console.error("closet-cleanup failed:", err instanceof Error ? err.message : err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Cleanup analysis failed" },
      { status: 500 }
    );
  }
}
