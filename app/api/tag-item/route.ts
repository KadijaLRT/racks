import { NextRequest, NextResponse } from "next/server";
import { normalizeTags } from "@/lib/tagNormalizer";
import { groqChat, parseGroqJson, buildImageMessage, buildTextMessage } from "@/lib/groq";
import { isSafeImageDataUrl, sanitizeGroqText } from "@/lib/groqSanitizer";
import type { ItemCategory } from "@/lib/types";

// Use the app's own tag key names (camelCase) so what the AI returns
// lines up with the detail rows in the item editor. Values are snapped to
// the editor's option lists afterward by normalizeTags.
const COMMON_TAIL = "formality, season, volume (Fitted/Relaxed/Oversized/Cropped), exposure (High Skin/Medium Skin/Low Skin), aesthetic (Streetwear/Elegant/Business Casual/Boho Chic/Comfort/Sexy/Girly)";
const CATEGORY_FIELDS: Record<string, string> = {
  top: `type (shirt/blouse/sweater/tee/etc), color, pattern, fabric, neckline, sleeveLength, sleeve (sleeve style), silhouette, backStyle, ${COMMON_TAIL}`,
  bottom: `type (jeans/pants/skirt/shorts/etc), color, pattern, fabric, fit (cut), rise, wash (jeans only), length (skirts/shorts), ${COMMON_TAIL}`,
  dress: `silhouette, dressSilhouette, color, pattern, fabric, neckline, sleeveLength, backStyle, length, ${COMMON_TAIL}`,
  set: `matching set type (co-ord/two-piece/tracksuit/pajama set etc), color, pattern, fabric, neckline, sleeveLength, ${COMMON_TAIL}`,
  swimwear: "type (bikini/monokini/one-piece/tankini/cover-up/rash guard), color, pattern, swimsuitTop, swimsuitBottom, backStyle, exposure, aesthetic",
  outerwear: `type (blazer/coat/jacket/cardigan), color, fabric, closure, length, fit, ${COMMON_TAIL}`,
  shoes: "type (sneakers/boots/heels/flats/sandals), color, material, heelHeight, toeShape, occasion, aesthetic",
  accessory: "type (earrings/necklace/bracelet/ring/bag/hat/belt/scarf/sunglasses etc), color, material, occasion, aesthetic. IF IT IS A BAG also give: bagStyle (Tote/Crossbody/Shoulder Bag/Satchel/Hobo/Clutch/Bucket Bag/Backpack/Belt Bag/Top Handle/Duffel / Weekender/Mini Bag/Wristlet), size (Mini/Small/Medium/Large/Oversized; judge from handle length, hardware scale, and anything in frame for comparison, then from the bag shape), pattern (the design: Solid/Monogram/Quilted/Woven/Logo Print/Studded/Embellished/Croc Embossed/Animal Print/Floral/Color Block/Fringe/Chain Strap/Plaid / Check/Metallic), hardware (Gold/Silver/Gunmetal/Rose Gold/Brass/None), brand",
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
          `You are a fashion cataloguing assistant. Look at the photo of a single wardrobe item and return ONLY a JSON object, no other text. Shape: { "name": string (a short, natural descriptive name like a stylist would write it, e.g. "White oversized linen button-up"), "subcategory": string (one specific noun for the item's type, e.g. "blouse", "sneakers", "midi skirt"), "tags": { key/value attributes as strings, include "brand" only if branding is visible: a readable logo or label, a hardware plate or engraving, or an unmistakable signature print or monogram (for example interlocking GG, LV monogram canvas, Coach signature C, MK logo print, Chanel quilting with an interlocking CC clasp, YSL cassandre, Dior Oblique, Fendi FF, Burberry check, Prada triangle plate) } }. Base everything on exactly what's visible; never infer a brand from silhouette, color or general style alone. If you can point to a specific visible cue, report the brand; if you are unsure, leave brand out rather than guess.`
        ),
        buildImageMessage(
          `This is a ${safeCategory}. Detect these attributes (use these exact key names, camelCase, and fill in every one that applies, giving your best judgment): ${fields}. Return the JSON object only.`,
          image
        ),
      ],
      { kind: "vision", jsonMode: true, temperature: 0.2, label: "Tagging new item", maxCompletionTokens: 800 }
    );

    const parsed = parseGroqJson(content, {
      name: "Untitled item",
      subcategory: "",
      tags: {} as Record<string, string>,
    });

    return NextResponse.json({
      name: parsed.name || "Untitled item",
      subcategory: parsed.subcategory || "",
      tags: normalizeTags(parsed.tags),
    });
  } catch (err) {
    console.error("tag-item failed:", err instanceof Error ? err.message : err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Tagging failed" },
      { status: 500 }
    );
  }
}
