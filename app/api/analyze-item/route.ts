import { NextRequest, NextResponse } from "next/server";
import { groqChat, parseGroqJson, buildTextMessage, TEXT_MODEL } from "@/lib/groq";
import { sanitizeGroqPayload } from "@/lib/groqSanitizer";
import type { ClosetItem, ItemCategory } from "@/lib/types";

interface NewItemInput {
  name?: string;
  category?: ItemCategory;
  tags?: Record<string, string>;
}

interface AnalyzeItemBody {
  newItem?: NewItemInput;
  closetItems?: ClosetItem[];
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

    const systemPrompt = `You are a shopping-sense assistant. 
    OUTPUT INSTRUCTIONS: You must output ONLY a valid JSON object. Do not include any markdown, 
    no "json" prefix, no conversational text, no explanations. 
    If you cannot fulfill the request as JSON, output empty strings for all fields.

    Return this exact JSON structure:
    {
      "verdict": "string",
      "matchCount": number,
      "fillsGap": boolean,
      "pairsWith": ["string"],
      "completesOutfits": number,
      "replacesItem": "string" | null,
      "versatilityNote": "string"
    }`;
    const userPrompt = `New item under consideration: ${safeNewItem.name} | category: ${safeNewItem.category} | tags: ${JSON.stringify(
      safeNewItem.tags
    )}

Closet category counts: ${JSON.stringify(categoryCounts)}

Full closet (with wear counts):
${closetList || "(closet is empty)"}`;

    const content = await groqChat(
      [buildTextMessage("system", systemPrompt), buildTextMessage("user", userPrompt)],
      { model: TEXT_MODEL, jsonMode: true, temperature: 0.4 }
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
