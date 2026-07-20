import { NextRequest, NextResponse } from "next/server";
import { groqChat, parseGroqJson, buildTextMessage, TEXT_MODEL } from "@/lib/groq";
import { sanitizeGroqText, sanitizeGroqPayload } from "@/lib/groqSanitizer";
import type { ClosetItem, WigItem, HairProfile, ColorProfile } from "@/lib/types";

interface GenerateLookRequestBody {
  prompt?: string;
  mood?: string;
  items?: ClosetItem[];
  wigs?: WigItem[];
  hairProfile?: HairProfile | null;
  weather?: string;
  colorProfile?: ColorProfile | null;
  styleDescription?: string;
  styleKeywords?: string[];
  previousLook?: {
    itemIds: string[];
    hairstyle: string;
    makeup: string;
  } | null;
  instruction?: string;
}

interface GeneratedLookResponse {
  itemIds: string[];
  hairstyle: string;
  makeup: string;
  reasoning: string;
  scores: Record<string, number>;
  overallLabel: string;
  overallStars: number;
  strengths: string[];
  weaknesses: string[];
}

const FALLBACK_LOOK: GeneratedLookResponse = {
  itemIds: [],
  hairstyle: "",
  makeup: "",
  reasoning: "",
  scores: {},
  overallLabel: "",
  overallStars: 0,
  strengths: [],
  weaknesses: [],
};

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => null)) as GenerateLookRequestBody | null;
    const prompt = sanitizeGroqText(body?.prompt || "");
    const items = Array.isArray(body?.items) ? body!.items : [];

    if (!prompt || items.length === 0) {
      return NextResponse.json(
        { error: "Need a prompt and at least one closet item." },
        { status: 400 }
      );
    }

    const mood = sanitizeGroqText(body?.mood || "");
    const weather = sanitizeGroqText(body?.weather || "");
    const styleDescription = sanitizeGroqText(body?.styleDescription || "");
    const instruction = sanitizeGroqText(body?.instruction || "");
    const styleKeywords = (Array.isArray(body?.styleKeywords) ? body!.styleKeywords : [])
      .map((k) => sanitizeGroqText(k))
      .filter(Boolean);
    const wigs = Array.isArray(body?.wigs) ? body!.wigs : [];
    const hairProfile = body?.hairProfile || null;
    const colorProfile = body?.colorProfile || null;
    const previousLook = body?.previousLook || null;

    const wearable = items.filter(
      (i) => i?.laundryStatus === "clean" && i?.category !== "makeup"
    );
    const ownedMakeup = items.filter((i) => i?.category === "makeup");

    // Every string field pulled from closet items is sanitized before
    // being interpolated into the prompt sent to Groq.
    const closetList = wearable
      .map((i) => {
        const safe = sanitizeGroqPayload({
          category: i?.category || "",
          name: i?.name || "",
          tags: i?.tags || {},
        });
        return `- id:${i.id} | ${safe.category} | ${safe.name} | ${JSON.stringify(
          safe.tags
        )} | worn ${i?.timesWorn ?? 0}×${i?.pinned ? " | PINNED FAVORITE" : ""}`;
      })
      .join("\n");

    const makeupList = ownedMakeup
      .map((i) => {
        const safe = sanitizeGroqPayload({ name: i?.name || "", tags: i?.tags || {} });
        return `- id:${i.id} | ${safe.name} | ${JSON.stringify(safe.tags)}`;
      })
      .join("\n");

    const wigList = (wigs || [])
      .map((w) => {
        const safe = sanitizeGroqPayload({ name: w?.name || "", tags: w?.tags || {} });
        return `- id:${w.id} | wig | ${safe.name} | ${JSON.stringify(safe.tags)}`;
      })
      .join("\n");

    let hairContext = "No hair info provided; suggest a hairstyle generically.";
    if (hairProfile?.mode === "description" && hairProfile?.description) {
      hairContext = `User describes their hair as: "${sanitizeGroqText(hairProfile.description)}"`;
    } else if (hairProfile?.tags) {
      hairContext = `User's current hair: ${JSON.stringify(sanitizeGroqPayload(hairProfile.tags))}`;
    }

    const weatherContext = weather
      ? `Weather context: ${weather}`
      : "No weather data provided.";

    const moodContext = mood
      ? `The user wants this look to make them feel: "${mood}". Let this emotional intent shape silhouette, color, and accessory choices as much as the occasion itself.`
      : "";

    const colorContext = colorProfile
      ? `User's seasonal color analysis: ${sanitizeGroqText(colorProfile.season)}, ${sanitizeGroqText(
          colorProfile.undertone
        )} undertone. Best colors: ${(colorProfile.bestColors || [])
          .map((c) => sanitizeGroqText(c))
          .join(", ")}. Use sparingly: ${(colorProfile.avoidColors || [])
          .map((c) => sanitizeGroqText(c))
          .join(", ")}. Prefer items leaning toward best colors when reasonable, never force a mismatch.`
      : "No color analysis on file.";

    const styleParts: string[] = [];
    if (styleDescription) {
      styleParts.push(`User describes their personal style as: "${styleDescription}"`);
    }
    if (styleKeywords.length > 0) {
      styleParts.push(`Aesthetic keywords from style inspiration: ${styleKeywords.join(", ")}`);
    }
    const styleContext =
      styleParts.length > 0
        ? `${styleParts.join(" ")} Lean toward this aesthetic among items that fit the occasion, but occasion and actual closet items always come first.`
        : "No personal style profile on file.";

    const refinementContext = previousLook
      ? `The user already has this look, built for the same occasion:
- Items: ${JSON.stringify(previousLook.itemIds || [])}
- Hairstyle: ${sanitizeGroqText(previousLook.hairstyle || "")}
- Makeup: ${sanitizeGroqText(previousLook.makeup || "")}

They now want ONE change: "${instruction}"

Apply ONLY what this change requires, keep everything else the same unless the change necessarily affects it. Still return the FULL current itemIds array.`
      : null;

    const systemPrompt = `You are an expert personal stylist${
      refinementContext
        ? ", currently refining a look you already built for the user"
        : ""
    }. You ONLY use items from the user's actual closet list below, never invent items. Each item shows how many times it's been worn ("worn N×"), where it fits naturally, favor reviving a neglected piece (worn 0-1×) over always reaching for the most-worn items, and mention it in your reasoning if you do. Don't force a neglected item if nothing neglected fits. Items marked "PINNED FAVORITE" get modest extra weight when they reasonably fit, never forced in otherwise. You may recommend a wig from the wig list as the hairstyle if it fits better than natural hair, otherwise suggest a hairstyle achievable with described natural hair. If the user owns specific makeup products, build the makeup look from those by name; only describe a generic look if they own none.

Return ONLY a JSON object with this exact shape:
{
  "itemIds": [closet item id strings you selected, ONLY from "Closet items available", NEVER from the makeup list. Pick a coherent set: top+bottom, a dress, or a "set" (standalone, never paired with an extra top or bottom), plus shoes, plus 0-2 accessories. Never two items of the same category unless layering makes sense],
  "hairstyle": "short description, name the wig if used",
  "makeup": "short description, name owned products if any, otherwise generic",
  "reasoning": "${
    refinementContext
      ? "1-2 sentences acknowledging the specific change and why it works"
      : "2-3 sentences in a warm, confident stylist voice on why this works for the occasion, weather, coloring, and together"
  }",
  "scores": { "colorHarmony": 1-5, "occasionFit": 1-5, "weatherSuitability": 1-5, "comfort": 1-5 },
  "overallLabel": "one word/short phrase, honest, not everything deserves Perfect",
  "overallStars": 1-5 integer,
  "strengths": [2-4 short concrete phrases on what works],
  "weaknesses": [0-3 short concrete phrases on real weak points, empty array if none]
}`;

    const userPrompt = `Occasion / request: "${prompt}"
${mood ? `Desired feeling: "${mood}"` : ""}

${weatherContext}

${moodContext}

${hairContext}

${colorContext}

${styleContext}

${refinementContext ? refinementContext + "\n\n" : ""}Closet items available:
${closetList}

Owned makeup products:
${makeupList || "(none catalogued)"}

Wigs available:
${wigList || "(none)"}

${refinementContext ? "Apply the requested change to the existing look." : "Build the best possible look using ONLY the items above."}`;

    const content = await groqChat(
      [buildTextMessage("system", systemPrompt), buildTextMessage("user", userPrompt)],
      { model: TEXT_MODEL, jsonMode: true, temperature: 0.6 }
    );

    const parsed = parseGroqJson<GeneratedLookResponse>(content, FALLBACK_LOOK);
    return NextResponse.json({
      itemIds: parsed.itemIds || [],
      hairstyle: parsed.hairstyle || "",
      makeup: parsed.makeup || "",
      reasoning: parsed.reasoning || "",
      scores: parsed.scores || {},
      overallLabel: parsed.overallLabel || "",
      overallStars: parsed.overallStars || 0,
      strengths: parsed.strengths || [],
      weaknesses: parsed.weaknesses || [],
    });
  } catch (err) {
    console.error("generate-look failed:", err instanceof Error ? err.message : err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Look generation failed" },
      { status: 500 }
    );
  }
}
