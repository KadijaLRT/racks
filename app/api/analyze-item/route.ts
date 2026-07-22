import { NextRequest, NextResponse } from "next/server";
import { groqChat, parseGroqJson, buildTextMessage, TEXT_MODEL } from "@/lib/groq";
import { sanitizeGroqPayload, sanitizeGroqText } from "@/lib/groqSanitizer";
import type { ClosetItem, ItemCategory, UserMeasurements } from "@/lib/types";

interface NewItemInput {
  name?: string;
  category?: ItemCategory;
  tags?: Record<string, string>;
}

interface AnalyzeItemBody {
  newItem?: NewItemInput;
  closetItems?: ClosetItem[];
  measurements?: UserMeasurements | null;
}

interface AnalysisResult {
  verdict: string;
  matchCount: number;
  fillsGap: boolean;
  pairsWith: string[];
  completesOutfits: number;
  replacesItem: string | null;
  versatilityNote: string;
}

const FALLBACK: AnalysisResult = {
  verdict: "",
  matchCount: 0,
  fillsGap: false,
  pairsWith: [],
  completesOutfits: 0,
  replacesItem: null,
  versatilityNote: "",
};

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => null)) as AnalyzeItemBody | null;
    const newItem = body?.newItem;
    const closetItems = Array.isArray(body?.closetItems) ? body!.closetItems : [];
    const measurements = body?.measurements || null;

    if (!newItem) {
      return NextResponse.json({ error: "Missing item data." }, { status: 400 });
    }

    const safeNewItem = sanitizeGroqPayload({
      name: newItem.name || "",
      category: newItem.category || "",
      tags: newItem.tags || {},
    });

    const closetList = closetItems
      .map((i) => {
        const safe = sanitizeGroqPayload({
          category: i?.category || "",
          name: i?.name || "",
          tags: i?.tags || {},
        });
        return `- id:${i.id} | ${safe.category} | ${safe.name} | ${JSON.stringify(
          safe.tags
        )} | worn ${i?.timesWorn ?? 0}×`;
      })
      .join("\n");

    const categoryCounts: Record<string, number> = {};
    for (const i of closetItems) {
      const cat = i?.category || "unknown";
      categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
    }

    const sizeParts: string[] = [];
    if (measurements?.topSize) sizeParts.push(`top size ${measurements.topSize}`);
    if (measurements?.bottomSize) sizeParts.push(`bottom size ${measurements.bottomSize}`);
    if (measurements?.dressSize) sizeParts.push(`dress size ${measurements.dressSize}`);
    if (measurements?.braSize) sizeParts.push(`bra size ${measurements.braSize}`);
    if (measurements?.shoeSize) sizeParts.push(`shoe size ${measurements.shoeSize}`);
    if (measurements?.height) sizeParts.push(`height ${measurements.height}`);
    if (measurements?.weight) sizeParts.push(`weight ${measurements.weight}`);
    const sizeContext = sizeParts.length > 0 ? sizeParts.join(", ") : "";
    const fitNotes = sanitizeGroqText(measurements?.notes || "");

    const systemPrompt = `You are a shopping-sense assistant helping someone decide whether a new item is worth buying, based on what they already own. Be honest and specific, not a hype machine, the goal is to reduce regret purchases, not encourage every purchase. Use the "worn N×" figures to spot rarely-worn items that could be replaced, don't invent a replacement if nothing plausible fits.${
      sizeContext
        ? ` The person's sizes are provided below, if the item's tags mention a specific size that clearly conflicts with theirs, factor that into the verdict (e.g. flag a likely fit mismatch), but don't fabricate a sizing concern when the item's own size isn't stated.`
        : ""
    }

Return ONLY a JSON object:
{
  "verdict": "one direct sentence: worth it, or skip it, and why",
  "matchCount": integer estimate of how many existing closet items this would pair well with,
  "fillsGap": boolean, true only if this covers a real gap, false if similar to things already owned,
  "pairsWith": [closet item id strings this pairs especially well with, max 5],
  "completesOutfits": integer estimate of complete new outfits this unlocks,
  "replacesItem": "name of a specific closet item this could reasonably retire, or null if nothing fits, never force one",
  "versatilityNote": "one short phrase on practical versatility gain, or empty string if none"
}`;

    const userPrompt = `New item under consideration: ${safeNewItem.name} | category: ${safeNewItem.category} | tags: ${JSON.stringify(
      safeNewItem.tags
    )}

Closet category counts: ${JSON.stringify(categoryCounts)}
${sizeContext ? `\nPerson's sizes: ${sizeContext}` : ""}${
      fitNotes ? `\nFit notes from the person: ${fitNotes}` : ""
    }

Full closet (with wear counts):
${closetList || "(closet is empty)"}`;

    const content = await groqChat(
      [buildTextMessage("system", systemPrompt), buildTextMessage("user", userPrompt)],
      { model: TEXT_MODEL, jsonMode: true, temperature: 0.4, label: "Analyzing wishlist item", maxCompletionTokens: 700 }
    );

    const parsed = parseGroqJson<AnalysisResult>(content, FALLBACK);
    return NextResponse.json({
      verdict: parsed.verdict || "",
      matchCount: parsed.matchCount || 0,
      fillsGap: Boolean(parsed.fillsGap),
      pairsWith: parsed.pairsWith || [],
      completesOutfits: parsed.completesOutfits || 0,
      replacesItem: parsed.replacesItem || null,
      versatilityNote: parsed.versatilityNote || "",
    });
  } catch (err) {
    console.error("analyze-item failed:", err instanceof Error ? err.message : err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Analysis failed" },
      { status: 500 }
    );
  }
}
