import { NextRequest, NextResponse } from "next/server";
import { groqChat, parseGroqJson, buildImageMessage, buildTextMessage, VISION_MODEL } from "@/lib/groq";
import { isSafeImageDataUrl } from "@/lib/groqSanitizer";

interface AnalyzeStyleBody {
  image?: string;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => null)) as AnalyzeStyleBody | null;
    const image = body?.image;

    if (!image || !isSafeImageDataUrl(image)) {
      return NextResponse.json(
        { error: "A valid photo is required." },
        { status: 400 }
      );
    }

    const content = await groqChat(
      [
        buildTextMessage(
          "system",
          `You are a fashion editor describing an aesthetic from a reference photo (could be an outfit, a mood board, a person's style, etc). Return ONLY a JSON object: { "keywords": [4-8 short aesthetic keywords/phrases, e.g. "quiet luxury", "oversized tailoring", "warm neutrals", "Y2K", "clean girl"] }`
        ),
        buildImageMessage(
          "What style/aesthetic keywords describe this reference image?",
          image
        ),
      ],
      { model: VISION_MODEL, jsonMode: true, temperature: 0.4, label: "Analyzing style profile", maxCompletionTokens: 800 }
    );

    const parsed = parseGroqJson(content, { keywords: [] as string[] });
    return NextResponse.json({ keywords: parsed.keywords || [] });
  } catch (err) {
    console.error("analyze-style failed:", err instanceof Error ? err.message : err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Style analysis failed" },
      { status: 500 }
    );
  }
}
