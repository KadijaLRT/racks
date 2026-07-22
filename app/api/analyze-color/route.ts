import { NextRequest, NextResponse } from "next/server";
import { groqChat, parseGroqJson, buildImageMessage, buildTextMessage, VISION_MODEL } from "@/lib/groq";
import { isSafeImageDataUrl } from "@/lib/groqSanitizer";

interface AnalyzeColorBody {
  image?: string;
}

interface ColorAnalysis {
  undertone: string;
  contrast: string;
  season: string;
  bestColors: string[];
  avoidColors: string[];
}

const FALLBACK: ColorAnalysis = {
  undertone: "",
  contrast: "",
  season: "",
  bestColors: [],
  avoidColors: [],
};

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => null)) as AnalyzeColorBody | null;
    const image = body?.image;

    if (!image || !isSafeImageDataUrl(image)) {
      return NextResponse.json(
        { error: "A valid selfie is required for color analysis." },
        { status: 400 }
      );
    }

    const content = await groqChat(
      [
        buildTextMessage(
          "system",
          `You are a color analyst (the "seasonal color analysis" method used by stylists). Look at the selfie and assess skin undertone, value contrast between skin/hair/eyes, and a seasonal palette. Return ONLY a JSON object:
{
  "undertone": "warm | cool | neutral, with one short clarifying word",
  "contrast": "low | medium | high, with one short clarifying phrase",
  "season": "one of: Bright Spring, Light Spring, True Spring, Light Summer, True Summer, Soft Summer, Soft Autumn, True Autumn, Dark Autumn, Dark Winter, True Winter, Bright Winter, pick the single best fit",
  "bestColors": [5-8 specific color names that suit this palette],
  "avoidColors": [3-5 specific color names that would clash]
}
This is a lighting-dependent, approximate read, do your best from the single photo given.`
        ),
        buildImageMessage("Analyze this selfie for seasonal color palette.", image),
      ],
      { model: VISION_MODEL, jsonMode: true, temperature: 0.3, label: "Analyzing color palette", maxCompletionTokens: 600 }
    );

    const parsed = parseGroqJson<ColorAnalysis>(content, FALLBACK);
    return NextResponse.json({
      undertone: parsed.undertone || "",
      contrast: parsed.contrast || "",
      season: parsed.season || "",
      bestColors: parsed.bestColors || [],
      avoidColors: parsed.avoidColors || [],
    });
  } catch (err) {
    console.error("analyze-color failed:", err instanceof Error ? err.message : err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Color analysis failed" },
      { status: 500 }
    );
  }
}
