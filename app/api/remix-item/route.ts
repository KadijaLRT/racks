import { NextRequest, NextResponse } from "next/server";
import { groqChat, parseGroqJson, buildTextMessage, TEXT_MODEL } from "@/lib/groq";
import { sanitizeGroqPayload } from "@/lib/groqSanitizer";
import type { ClosetItem } from "@/lib/types";

interface RemixBody {
  anchorItem?: ClosetItem;
  items?: ClosetItem[];
}

interface RemixOutfit {
  label: string;
  itemIds: string[];
  reasoning: string;
}

interface RemixResult {
  outfits: RemixOutfit[];
}

const FALLBACK: RemixResult = { outfits: [] };

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => null)) as RemixBody | null;
    const anchorItem = body?.anchorItem;
    const items = Array.isArray(body?.items) ? body!.items : [];

    if (!anchorItem || items.length === 0) {
      return NextResponse.json({ error: "Missing data." }, { status: 400 });
    }

    const rest = items.filter(
      (i) => i?.id !== anchorItem.id && i?.laundryStatus === "clean"
    );

    if (rest.length === 0) {
      return NextResponse.json(
        { error: "Not enough other clean items in your closet to build outfits around this one yet." },
        { status: 400 }
      );
    }

    const restList = rest
      .map((i) => {
        const safe = sanitizeGroqPayload({
          category: i?.category || "",
          name: i?.name || "",
          tags: i?.tags || {},
        });
        return `- id:${i.id} | ${safe.category} | ${safe.name} | ${JSON.stringify(safe.tags)}`;
      })
      .join("\n");

    const safeAnchor = sanitizeGroqPayload({
      category: anchorItem.category || "",
      name: anchorItem.name || "",
      tags: anchorItem.tags || {},
    });

    const systemPrompt = `You are a stylist. Every outfit you build MUST include the anchor item. Build 3 distinct, complete outfits around it using only the other closet items listed, never invent items. Vary the occasion/mood across the 3 (e.g. one casual, one elevated, one for a specific occasion).

Return ONLY a JSON object:
{
  "outfits": [
    { "label": "short mood/occasion label", "itemIds": [array of closet item id strings, MUST include the anchor item's id, plus others to complete the look], "reasoning": "1 sentence on why it works" }
  ]
}`;

    const userPrompt = `Anchor item (must appear in every outfit): id:${anchorItem.id} | ${safeAnchor.category} | ${safeAnchor.name} | ${JSON.stringify(
      safeAnchor.tags
    )}

Rest of closet to build around it:
${restList}

Build 3 distinct outfits, each including the anchor item's id: "${anchorItem.id}".`;

    const content = await groqChat(
      [buildTextMessage("system", systemPrompt), buildTextMessage("user", userPrompt)],
      { model: TEXT_MODEL, jsonMode: true, temperature: 0.6 }
    );

    const parsed = parseGroqJson<RemixResult>(content, FALLBACK);

    // Defensive: make sure the anchor item is actually present in every
    // returned outfit, in case the model drops it despite instructions.
    const outfits = (parsed.outfits || []).map((o) => ({
      label: o.label || "Outfit",
      itemIds: o.itemIds?.includes(anchorItem.id)
        ? o.itemIds
        : [anchorItem.id, ...(o.itemIds || [])],
      reasoning: o.reasoning || "",
    }));

    return NextResponse.json({ outfits });
  } catch (err) {
    console.error("remix-item failed:", err instanceof Error ? err.message : err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Remix failed" },
      { status: 500 }
    );
  }
}
