import { NextRequest, NextResponse } from "next/server";
import { normalizeTags } from "@/lib/tagNormalizer";
import { groqChat, parseGroqJson, buildImageMessage, buildTextMessage, getLastGroqUsage } from "@/lib/groq";
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

    // The long brand-spotting guidance only matters for bags and other
    // accessories, where logos and hardware plates are the main cue; every
    // other category gets a one-line rule, so those prompts stay short.
    const brandRule =
      safeCategory === "accessory"
        ? 'Include "brand" only when you can point to a visible cue: a readable logo or label, a hardware plate or engraving, or an unmistakable signature print or monogram (for example interlocking GG, LV monogram canvas, Coach signature C, MK logo print, Chanel quilting with a CC clasp, YSL cassandre, Dior Oblique, Fendi FF, Burberry check, Prada triangle plate). Never infer a brand from silhouette, color or style alone; if unsure, leave brand out.'
        : 'Include "brand" only if a logo or label is clearly readable; otherwise leave it out.';

    const content = await groqChat(
      [
        buildTextMessage(
          "system",
          `You are a fashion cataloguing assistant. Look at the photo of a single wardrobe item and return ONLY a JSON object, no other text. Shape: { "name": string (short, natural stylist-style name, e.g. "White oversized linen button-up"), "subcategory": string (one specific noun for the item's type, e.g. "blouse", "sneakers", "midi skirt"), "tags": { key/value attributes as strings } }. Base everything on exactly what is visible. ${brandRule}`
        ),
        buildImageMessage(
          `This is a ${safeCategory}. Fill in every one of these that applies, using these exact camelCase key names and your best judgment: ${fields}. JSON only.`,
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
      usage: getLastGroqUsage(),
    });
  } catch (err) {
    console.error("tag-item failed:", err instanceof Error ? err.message : err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Tagging failed" },
      { status: 500 }
    );
  }
}
