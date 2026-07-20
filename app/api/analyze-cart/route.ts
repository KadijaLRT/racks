import { NextRequest, NextResponse } from "next/server";
import { groqChat, parseGroqJson, buildTextMessage, TEXT_MODEL } from "@/lib/groq";
import { sanitizeGroqPayload } from "@/lib/groqSanitizer";
import type { ClosetItem, WishlistItem } from "@/lib/types";

interface AnalyzeCartBody {
  wishlistItems?: WishlistItem[];
  closetItems?: ClosetItem[];
}

interface CartAnalysisResult {
  colorCohesion: string;
  newOutfitsEstimate: number;
  keep: string[];
  cut: { id: string; reason: string }[];
  verdict: string;
}

const FALLBACK: CartAnalysisResult = {
  colorCohesion: "",
  newOutfitsEstimate: 0,
  keep: [],
  cut: [],
  verdict: "",
};

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => null)) as AnalyzeCartBody | null;
    const wishlistItems = Array.isArray(body?.wishlistItems) ? body!.wishlistItems : [];
    const closetItems = Array.isArray(body?.closetItems) ? body!.closetItems : [];

    if (wishlistItems.length === 0) {
      return NextResponse.json(
        { error: "Add a few things to your wishlist first." },
        { status: 400 }
      );
    }

    const cartList = wishlistItems
      .map((i) => {
        const safe = sanitizeGroqPayload({
          category: i?.category || "",
          name: i?.name || "",
          tags: i?.tags || {},
        });
        return `- id:${i.id} | ${safe.category} | ${safe.name} | ${JSON.stringify(safe.tags)}`;
      })
      .join("\n");

    const closetList = closetItems
      .map((i) => {
        const safe = sanitizeGroqPayload({
          category: i?.category || "",
          name: i?.name || "",
          tags: i?.tags || {},
        });
        return `- ${safe.category} | ${safe.name} | ${JSON.stringify(safe.tags)}`;
      })
      .join("\n");

    const systemPrompt = `You are a shopping-sense assistant reviewing an entire wishlist/cart at once, comparing it against the existing closet. Be honest and specific, the goal is fewer regret purchases, not encouraging every item.

Return ONLY a JSON object:
{
  "colorCohesion": "1-2 sentences on whether the cart items work together and with the closet as a palette",
  "newOutfitsEstimate": integer, rough estimate of NEW complete outfits this cart unlocks combined with the closet,
  "keep": [wishlist item id strings worth buying],
  "cut": [ { "id": "wishlist item id string", "reason": "short reason this one is skippable" } ],
  "verdict": "1-2 sentence overall recommendation for the cart as a whole"
}`;

    const userPrompt = `Cart / wishlist items:
${cartList}

Existing closet:
${closetList || "(empty)"}`;

    const content = await groqChat(
      [buildTextMessage("system", systemPrompt), buildTextMessage("user", userPrompt)],
      { model: TEXT_MODEL, jsonMode: true, temperature: 0.5 }
    );

    const parsed = parseGroqJson<CartAnalysisResult>(content, FALLBACK);
    return NextResponse.json({
      colorCohesion: parsed.colorCohesion || "",
      newOutfitsEstimate: parsed.newOutfitsEstimate || 0,
      keep: parsed.keep || [],
      cut: parsed.cut || [],
      verdict: parsed.verdict || "",
    });
  } catch (err) {
    console.error("analyze-cart failed:", err instanceof Error ? err.message : err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Cart analysis failed" },
      { status: 500 }
    );
  }
}
