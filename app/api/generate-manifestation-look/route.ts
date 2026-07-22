import { NextRequest, NextResponse } from "next/server";
import { groqChat, parseGroqJson, buildTextMessage, TEXT_MODEL } from "@/lib/groq";
import { sanitizeGroqPayload, sanitizeGroqText, formatTagsCompact } from "@/lib/groqSanitizer";
import type { ClosetItem, WigItem, HairProfile, ColorProfile } from "@/lib/types";

const INTENTION_GUIDANCE: Record<string, string> = {
  Love: "Ruled by Venus, the planet of attraction, romance, and beauty. Lean into soft, tactile fabrics (silk, satin, velvet, cashmere), a palette of soft pink, rose, cream, pastel blue, or emerald, and symmetrical, flattering silhouettes with delicate jewelry.",
  Confidence: "Ruled by the Sun and Mars, inner radiance plus drive and boundaries. Lean into structured, commanding pieces: sharp tailoring, monochrome power looks, statement shoulders, bold jewelry, and a palette of crimson, fiery orange, gold, or rich yellow.",
  Prosperity: "Ruled by Jupiter and Saturn, expansion and opportunity balanced with discipline and staying power. Lean into high-quality, well-maintained pieces: tailored blazers, structured bags, minimalist capsule staples, in deep royal purple, emerald, rich navy, charcoal, or gold.",
  Protection: "Ruled by Saturn, structure, boundaries, and grounded authority. Lean into layered, armor-like pieces: structured coats or blazers, closed necklines, solid dark or earthy tones (charcoal, black, deep brown, forest green), sturdy footwear.",
  Clarity: "Ruled by the Moon and Mercury, intuition and clear communication. Lean into calm, uncluttered pieces: soft neutrals or cool blues/greys, flowing but simple silhouettes, minimal pattern, comfortable and unrestrictive fit.",
  Opportunity: "Ruled by Mercury, communication, quick thinking, and new connections. Lean into polished-but-approachable pieces: crisp shirting, smart-casual layering, a palette of light blue, silver, or soft yellow, something that reads competent and easy to talk to.",
};

interface ManifestBody {
  intention?: string;
  zodiacSign?: string;
  items?: ClosetItem[];
  wigs?: WigItem[];
  hairProfile?: HairProfile | null;
  colorProfile?: ColorProfile | null;
  styleDescription?: string;
  styleKeywords?: string[];
}

interface ManifestResult {
  itemIds: string[];
  hairstyle: string;
  makeup: string;
  planetFocus: string;
  reasoning: string;
  ritualTip: string;
  scores: Record<string, number>;
}

const FALLBACK: ManifestResult = {
  itemIds: [],
  hairstyle: "",
  makeup: "",
  planetFocus: "",
  reasoning: "",
  ritualTip: "",
  scores: {},
};

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => null)) as ManifestBody | null;
    const intention = sanitizeGroqText(body?.intention || "");
    const items = Array.isArray(body?.items) ? body!.items : [];

    if (!intention || items.length === 0) {
      return NextResponse.json(
        { error: "Need an intention and at least one closet item." },
        { status: 400 }
      );
    }

    const zodiacSign = sanitizeGroqText(body?.zodiacSign || "");
    const styleDescription = sanitizeGroqText(body?.styleDescription || "");
    const styleKeywords = (Array.isArray(body?.styleKeywords) ? body!.styleKeywords : [])
      .map((k) => sanitizeGroqText(k))
      .filter(Boolean);
    const wigs = Array.isArray(body?.wigs) ? body!.wigs : [];
    const hairProfile = body?.hairProfile || null;
    const colorProfile = body?.colorProfile || null;

    const wearable = items.filter(
      (i) => i?.laundryStatus === "clean" && i?.category !== "makeup"
    );
    const ownedMakeup = items.filter((i) => i?.category === "makeup");

    if (wearable.length === 0) {
      return NextResponse.json(
        {
          error:
            "None of your catalogued items are marked clean right now, everything is dirty or at the dry cleaner. Mark something as clean in your closet to manifest a look.",
        },
        { status: 400 }
      );
    }

    // Same reasoning as generate-look: if the closet genuinely can't
    // support a full outfit (a dress, a set, or a top+bottom, plus
    // shoes), the model will legitimately come back empty with no way
    // to explain why. Check up front and say exactly what's missing.
    const hasCategory = (cat: string) => wearable.some((i) => i?.category === cat);
    const canFormOutfit =
      hasCategory("dress") ||
      hasCategory("set") ||
      (hasCategory("top") && hasCategory("bottom"));
    const hasShoes = hasCategory("shoes");

    if (!canFormOutfit || !hasShoes) {
      const missing: string[] = [];
      if (!canFormOutfit) missing.push("a dress, a set, or a top and a bottom");
      if (!hasShoes) missing.push("shoes");
      return NextResponse.json(
        {
          error: `Your closet doesn't have enough marked-clean items yet to manifest a full look. Add ${missing.join(
            " and "
          )} to get started.`,
        },
        { status: 400 }
      );
    }

    const closetList = wearable
      .map((i) => {
        const safe = sanitizeGroqPayload({
          category: i?.category || "",
          name: i?.name || "",
          tags: i?.tags || {},
        });
        return `- id:${i.id} | ${safe.category} | ${safe.name} | ${formatTagsCompact(safe.tags)}`;
      })
      .join("\n");

    const makeupList = ownedMakeup
      .map((i) => {
        const safe = sanitizeGroqPayload({ name: i?.name || "", tags: i?.tags || {} });
        return `- id:${i.id} | ${safe.name} | ${formatTagsCompact(safe.tags)}`;
      })
      .join("\n");

    const wigList = wigs
      .map((w) => {
        const safe = sanitizeGroqPayload({ name: w?.name || "", tags: w?.tags || {} });
        return `- id:${w.id} | wig | ${safe.name} | ${formatTagsCompact(safe.tags)}`;
      })
      .join("\n");

    let hairContext = "No hair info provided; suggest a hairstyle generically.";
    if (hairProfile?.mode === "description" && hairProfile?.description) {
      hairContext = `User describes their hair as: "${sanitizeGroqText(hairProfile.description)}"`;
    } else if (hairProfile?.tags) {
      hairContext = `User's current hair: ${formatTagsCompact(sanitizeGroqPayload(hairProfile.tags))}`;
    }

    const colorContext = colorProfile
      ? `User's seasonal color analysis: ${sanitizeGroqText(colorProfile.season)}, ${sanitizeGroqText(
          colorProfile.undertone
        )} undertone. Best colors: ${(colorProfile.bestColors || [])
          .map((c) => sanitizeGroqText(c))
          .join(", ")}.`
      : "No color analysis on file.";

    const styleContext =
      styleDescription || styleKeywords.length > 0
        ? `Personal style: ${styleDescription} ${styleKeywords.join(", ")}`.trim()
        : "No personal style profile on file.";

    const guidance = INTENTION_GUIDANCE[intention] || "";

    const systemPrompt = `You are a playful but genuinely stylish "manifestation stylist", part astrology, part real fashion sense. You ONLY use items from the user's actual closet list below, never invent items. This is meant to feel fun and a little mystical, while still producing an outfit that actually looks good and works with their coloring/style.

Return ONLY a JSON object:
{
  "itemIds": [array of closet item id strings ONLY from the closet list, forming one coherent outfit],
  "hairstyle": "short hairstyle description",
  "makeup": "short makeup description, name owned products if listed",
  "planetFocus": "the ruling planet(s) for this intention, e.g. 'Venus' or 'Jupiter & Saturn'",
  "reasoning": "2-3 sentences, warm and a little playful, connecting the outfit choices to the planetary energy and the user's actual closet, not generic astrology copy",
  "ritualTip": "one short, fun, low-effort action tied to the intention (a scent, a color to add as an accent, a small gesture), optional flavor, not required styling advice",
  "scores": { "colorHarmony": 1-5, "occasionFit": 1-5, "weatherSuitability": 1-5, "comfort": 1-5 }
}`;

    const userPrompt = `Intention: ${intention}
Planetary guidance to draw from: ${guidance}
${zodiacSign ? `User's zodiac sign: ${zodiacSign} (use this for light flavor/personality in the reasoning, not as a hard styling rule)` : ""}

${hairContext}

${colorContext}

${styleContext}

Closet items available:
${closetList}

Owned makeup products:
${makeupList || "(none catalogued)"}

Wigs available:
${wigList || "(none)"}

Build a look to manifest ${intention.toLowerCase()}, using ONLY the items above.`;

    const content = await groqChat(
      [buildTextMessage("system", systemPrompt), buildTextMessage("user", userPrompt)],
      { model: TEXT_MODEL, jsonMode: true, temperature: 0.75, label: "Generating manifestation look", maxCompletionTokens: 1400 }
    );

    const parsed = parseGroqJson<ManifestResult>(content, FALLBACK);
    return NextResponse.json({
      itemIds: parsed.itemIds || [],
      hairstyle: parsed.hairstyle || "",
      makeup: parsed.makeup || "",
      planetFocus: parsed.planetFocus || "",
      reasoning: parsed.reasoning || "",
      ritualTip: parsed.ritualTip || "",
      scores: parsed.scores || {},
    });
  } catch (err) {
    console.error(
      "generate-manifestation-look failed:",
      err instanceof Error ? err.message : err
    );
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Manifestation look failed" },
      { status: 500 }
    );
  }
}
