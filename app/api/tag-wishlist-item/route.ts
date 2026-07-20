import { NextRequest, NextResponse } from "next/server";
import { groqChat, parseGroqJson, buildImageMessage, buildTextMessage, VISION_MODEL } from "@/lib/groq";
import { isSafeImageDataUrl } from "@/lib/groqSanitizer";
import type { ItemCategory } from "@/lib/types";

const VALID_CATEGORIES: ItemCategory[] = [
  "top",
  "bottom",
  "dress",
  "set",
  "outerwear",
  "shoes",
  "accessory",
  "makeup",
];

interface TagWishlistBody {
  image?: string;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => null)) as TagWishlistBody | null;
    const image = body?.image;

    if (!image || !isSafeImageDataUrl(image)) {
      return NextResponse.json(
        { error: "A valid photo is required to tag this item." },
        { status: 400 }
      );
    }

    const content = await groqChat(
      [
        buildTextMessage(
          "system",
          `You are a fashion cataloguing assistant looking at a single product photo (from a screenshot or shopping link). Return ONLY a JSON object: { "name": string (short natural descriptive name), "category": one of ${VALID_CATEGORIES.join(
            "/"
          )}, "subcategory": string (one specific noun, e.g. "blouse", "sneakers"), "tags": { key/value attributes as strings } }. Base everything on exactly what's visible.`
        ),
        buildImageMessage(
          "Identify this product and return the JSON object only.",
          image
        ),
      ],
      { model: VISION_MODEL, jsonMode: true, temperature: 0.2 }
    );

    const parsed = parseGroqJson(content, {
      name: "Untitled item",
      category: "top" as ItemCategory,
      subcategory: "",
      tags: {} as Record<string, string>,
    });

    const category = VALID_CATEGORIES.includes(parsed.category as ItemCategory)
      ? (parsed.category as ItemCategory)
      : "top";

    return NextResponse.json({
      name: parsed.name || "Untitled item",
      category,
      subcategory: parsed.subcategory || "",
      tags: parsed.tags || {},
    });
  } catch (err) {
    console.error("tag-wishlist-item failed:", err instanceof Error ? err.message : err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Tagging failed" },
      { status: 500 }
    );
  }
}
