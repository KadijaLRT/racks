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

interface DetectedItem {
  name: string;
  category: ItemCategory;
  tags: string[];
  box: { x: number; y: number; width: number; height: number };
}

interface TagMultiBody {
  image?: string;
}

function isValidBox(box: unknown): box is DetectedItem["box"] {
  if (!box || typeof box !== "object") return false;
  const b = box as Record<string, unknown>;
  return (
    typeof b.x === "number" &&
    typeof b.y === "number" &&
    typeof b.width === "number" &&
    typeof b.height === "number" &&
    b.x >= 0 &&
    b.x <= 1 &&
    b.y >= 0 &&
    b.y <= 1 &&
    b.width > 0 &&
    b.width <= 1 &&
    b.height > 0 &&
    b.height <= 1
  );
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => null)) as TagMultiBody | null;
    const image = body?.image;

    if (!image || !isSafeImageDataUrl(image)) {
      return NextResponse.json(
        { error: "A valid screenshot is required." },
        { status: 400 }
      );
    }

    const content = await groqChat(
      [
        buildTextMessage(
          "system",
          `You are a fashion cataloguing assistant looking at a screenshot that may show MULTIPLE product thumbnails at once (e.g. an order history page, a cart, or a grid of products). Identify every distinct clothing/shoe/accessory item you can see, up to a maximum of 12, AND the location of that item's product thumbnail image within the screenshot. Return ONLY a JSON object, no markdown formatting, no code fences, no commentary:
{
  "items": [
    {
      "name": "short descriptive name, e.g. 'Black ribbed knit top'",
      "category": "one of: ${VALID_CATEGORIES.join("/")}",
      "tags": ["attribute: value strings, e.g. 'color: black', 'material: ribbed knit'"],
      "box": { "x": 0-1, "y": 0-1, "width": 0-1, "height": 0-1 }
    }
  ]
}
"box" is the bounding box of ONLY that item's thumbnail photo (not surrounding text/price/buttons), given as fractions of the full screenshot's width/height, top-left origin. Be as precise as you can, this is used to crop the individual photo out of the screenshot. If you can't confidently distinguish individual items, return your best guess list rather than an empty array, approximate is fine, but always include a box. Keep the JSON short and valid: never truncate mid-object, and stop as soon as the object is complete.`
        ),
        buildImageMessage(
          "List every distinct item you can identify in this screenshot, with a bounding box for each item's own thumbnail image.",
          image
        ),
      ],
      { model: VISION_MODEL, jsonMode: true, temperature: 0.3, label: "Tagging screenshot items", maxCompletionTokens: 4096 }
    );

    const parsed = parseGroqJson(content, { items: [] as DetectedItem[] });
    const rawItems = Array.isArray(parsed.items) ? parsed.items : [];

    // Defensive: drop any item with a malformed box or category rather
    // than passing bad crop coordinates to the client.
    const items = rawItems
      .filter((item) => isValidBox(item?.box))
      .map((item) => ({
        name: item?.name || "Untitled item",
        category: VALID_CATEGORIES.includes(item?.category) ? item.category : "top",
        tags: Array.isArray(item?.tags)
          ? item.tags.filter((t): t is string => typeof t === "string")
          : [],
        box: item.box,
      }))
      .slice(0, 20); // sane upper bound on one screenshot's worth of items

    return NextResponse.json({ items });
  } catch (err) {
    console.error("tag-multi-item failed:", err instanceof Error ? err.message : err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Multi-item tagging failed" },
      { status: 500 }
    );
  }
}
