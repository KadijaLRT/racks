import { NextRequest, NextResponse } from "next/server";
import { groqChat, parseGroqJson, buildImageMessage, buildTextMessage, VISION_MODEL } from "@/lib/groq";
import { isSafeImageDataUrl } from "@/lib/groqSanitizer";

interface TagHairBody {
  image?: string;
  mode?: string;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => null)) as TagHairBody | null;
    const image = body?.image;
    const isWig = body?.mode === "wig";

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
          `You are a hairstylist's cataloguing assistant. Return ONLY a JSON object: { "name": string (short descriptive name, e.g. "30in Black Body Wave Wig" or "Shoulder-length 3C curls"), "tags": { "length": string, "color": string, "texture": string, "currentStyle": string } }.`
        ),
        buildImageMessage(
          isWig
            ? "This is a photo of a wig. Detect its length, color, texture, and styling."
            : "This is a selfie. Detect the person's hair length, color, texture (straight/wavy/curly/coily), and current style. Do not describe the person, only their hair.",
          image
        ),
      ],
      { model: VISION_MODEL, jsonMode: true, temperature: 0.2, label: "Analyzing hair photo", maxCompletionTokens: 400 }
    );

    const parsed = parseGroqJson(content, {
      name: "Untitled hair",
      tags: {} as Record<string, string>,
    });

    return NextResponse.json({
      name: parsed.name || "Untitled hair",
      tags: parsed.tags || {},
    });
  } catch (err) {
    console.error("tag-hair failed:", err instanceof Error ? err.message : err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Hair tagging failed" },
      { status: 500 }
    );
  }
}
