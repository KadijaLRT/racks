import { NextRequest, NextResponse } from "next/server";
import { groqChat, parseGroqJson, buildTextMessage, TEXT_MODEL } from "@/lib/groq";
import { sanitizeGroqPayload, sanitizeGroqText } from "@/lib/groqSanitizer";
import type { ClosetItem } from "@/lib/types";

interface PackTripBody {
  description?: string;
  items?: ClosetItem[];
}

interface PackingPlan {
  packingList: string[];
  outfits: { label: string; itemIds: string[] }[];
  gaps: string[];
  capsuleSize: number;
  totalOutfitsPossible: number;
}

const FALLBACK: PackingPlan = {
  packingList: [],
  outfits: [],
  gaps: [],
  capsuleSize: 0,
  totalOutfitsPossible: 0,
};

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => null)) as PackTripBody | null;
    const description = sanitizeGroqText(body?.description || "");
    const items = Array.isArray(body?.items) ? body!.items : [];

    if (!description || items.length === 0) {
      return NextResponse.json(
        { error: "Need a trip description and closet items." },
        { status: 400 }
      );
    }

    const wearable = items.filter((i) => i?.laundryStatus === "clean");

    const closetList = wearable
      .map((i) => {
        const safe = sanitizeGroqPayload({
          category: i?.category || "",
          name: i?.name || "",
          tags: i?.tags || {},
        });
        return `- id:${i.id} | ${safe.category} | ${safe.name} | ${JSON.stringify(safe.tags)}`;
      })
      .join("\n");

    if (!closetList) {
      return NextResponse.json(
        { error: "None of your closet items are currently marked clean." },
        { status: 400 }
      );
    }

    const systemPrompt = `You are a packing assistant. Build a packing plan using ONLY the closet items listed, never invent items. Return ONLY a JSON object:
{
  "packingList": [short strings, one per item to pack, referencing the item names],
  "outfits": [ { "label": "Day 1 / travel day, etc", "itemIds": [closet item id strings forming one full outfit] }, one entry per day or occasion implied by the trip ],
  "gaps": [short strings naming anything the closet is clearly missing for this trip, empty array if nothing notable is missing],
  "capsuleSize": integer, total distinct pieces in the packing list,
  "totalOutfitsPossible": integer, realistic estimate of complete outfit combinations the packed capsule could create through mixing and matching
}`;

    const userPrompt = `Trip: "${description}"

Closet items available:
${closetList}

Build a packing list and a full outfit for each day/occasion implied, reusing items across days where sensible.`;

    const content = await groqChat(
      [buildTextMessage("system", systemPrompt), buildTextMessage("user", userPrompt)],
      { model: TEXT_MODEL, jsonMode: true, temperature: 0.5 }
    );

    const parsed = parseGroqJson<PackingPlan>(content, FALLBACK);
    return NextResponse.json({
      packingList: parsed.packingList || [],
      outfits: parsed.outfits || [],
      gaps: parsed.gaps || [],
      capsuleSize: parsed.capsuleSize || 0,
      totalOutfitsPossible: parsed.totalOutfitsPossible || 0,
    });
  } catch (err) {
    console.error("pack-trip failed:", err instanceof Error ? err.message : err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Packing plan failed" },
      { status: 500 }
    );
  }
}
