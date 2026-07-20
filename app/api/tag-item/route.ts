import { NextRequest, NextResponse } from "next/server";
import { groqChat, parseGroqJson, buildImageMessage, buildTextMessage, VISION_MODEL } from "@/lib/groq";
import { isSafeImageDataUrl, sanitizeGroqText } from "@/lib/groqSanitizer";
import type { ItemCategory } from "@/lib/types";

const CATEGORY_FIELDS: Record<string, string> = {
  top: "type (shirt/blouse/sweater/tee/etc), color, pattern, material, sleeve length, fit, formality, season",
  bottom: "type (jeans/trousers/skirt/shorts/etc), color, pattern, material, fit, formality, season",
  dress: "silhouette, color, pattern, material, sleeve length, formality, season",
  set: "matching set type (co-ord/two-piece/tracksuit/pajama set etc), color, pattern, material, formality, season",
  outerwear: "type (blazer/coat/jacket/cardigan), color, material, formality, season",
  shoes: "type (sneakers/boots/heels/flats/sandals), color, heel height, occasion",
  accessory: "type (jewelry/bag/hat/belt/scarf/sunglasses), color, material, occasion",
  makeup: "product type (foundation/lipstick/blush/etc), shade, finish, undertone",
};

interface TagItemRequestBody {
  image?: string;
  category?: ItemCategory;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => null)) as TagItemRequestBody | null;
    const image = body?.image;
    const category = (body?.category as string) || "";

    if (!image || !isSafeImageDataUrl(image)) {
      return NextResponse.json(
        { error: "A valid photo is required to tag this item." },
        { status: 400 }
      );
    }

    const safeCategory = sanitizeGroqText(category) || "item";
    const fields =
      CATEGORY_FIELDS[safeCategory] || "type, color, material, formality, season";

    const content = await groqChat(
      [
        buildTextMessage(
          "system",
          `You are a fashion cataloguing assistant. Look at the photo of a single wardrobe item and return ONLY a JSON object, no other text. Shape: { "name": string (a short, natural descriptive name like a stylist would write it, e.g. "White oversized linen button-up"), "subcategory": string (one specific noun for the item's type, e.g. "blouse", "sneakers", "midi skirt"), "tags": { key/value attributes as strings } }. Base everything on exactly what's visible; don't guess a brand unless a logo is clearly visible.`
        ),
        buildImageMessage(
          `This is a ${safeCategory}. Detect these attributes if visible: ${fields}. Return the JSON object only.`,
          image
        ),
      ],
      { model: VISION_MODEL, jsonMode: true, temperature: 0.2 }
    );

    const parsed = parseGroqJson(content, {
      name: "Untitled item",
      subcategory: "",
      tags: {} as Record<string, string>,
    });

    return NextResponse.json({
      name: parsed.name || "Untitled item",
      subcategory: parsed.subcategory || "",
      tags: parsed.tags || {},
    });
  } catch (err) {
    console.error("tag-item failed:", err instanceof Error ? err.message : err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Tagging failed" },
      { status: 500 }
    );
  }
}
