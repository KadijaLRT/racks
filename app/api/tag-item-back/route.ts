import { NextRequest, NextResponse } from "next/server";
import { groqChat, parseGroqJson, buildImageMessage, buildTextMessage, VISION_MODEL } from "@/lib/groq";
import { isSafeImageDataUrl, sanitizeGroqText } from "@/lib/groqSanitizer";
import type { ItemCategory } from "@/lib/types";

interface TagBackRequestBody {
  image?: string;
  category?: ItemCategory;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => null)) as TagBackRequestBody | null;
    const image = body?.image;
    const category = (body?.category as string) || "";

    if (!image || !isSafeImageDataUrl(image)) {
      return NextResponse.json(
        { error: "A valid back-of-item photo is required." },
        { status: 400 }
      );
    }

    const safeCategory = sanitizeGroqText(category) || "item";

    const content = await groqChat(
      [
        buildTextMessage(
          "system",
          `You are a fashion cataloguing assistant looking at the BACK of a wardrobe item, only the back is shown here, a separate front photo already exists. Only report details that are visible from the back and that would matter when choosing what to pair with this item (a backless cut changes bra choice, a back print or color block changes what it looks like from behind in an outfit, a lace-up or cutout back is a style detail worth noting). Return ONLY a JSON object, no other text. Shape: { "tags": { key/value attributes as strings, only include keys for things actually visible, e.g. "back style": "cutout", "back print": "floral", "back color": "black" } }. If the back is plain and matches the front with nothing distinctive, return an empty tags object rather than inventing detail.`
        ),
        buildImageMessage(
          `This is the back of a ${safeCategory}. Return the JSON object only.`,
          image
        ),
      ],
      { model: VISION_MODEL, jsonMode: true, temperature: 0.2, label: "Tagging back photo", maxCompletionTokens: 400 }
    );

    const parsed = parseGroqJson(content, { tags: {} as Record<string, string> });

    return NextResponse.json({ tags: parsed.tags || {} });
  } catch (err) {
    console.error("tag-item-back failed:", err instanceof Error ? err.message : err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Back-photo tagging failed" },
      { status: 500 }
    );
  }
}
