// Which detail rows apply to an item (neckline, sleeve length, heel
// height, ...) and a local, zero-AI way to pre-select every one of
// them. This mirrors the rows the item editor shows, so "Retag" can
// fill them all in and the person only has to correct what's wrong.
//
// Each value comes from the best evidence available, in this order:
//   1. Words in the item's name / subcategory / tags ("long sleeve",
//      "v-neck", "zip-up hoodie").
//   2. The person's own closet: the most common value among their other
//      items of the same type.
//   3. A sensible default for that kind of item (a t-shirt is short
//      sleeve with a crew neck).
// Details that depend on seeing the garment and have no safe default
// (back style, sleeve style) are only set when the name or closet
// history supports it, never guessed.

import {
  NECKLINE_OPTIONS, TOP_SILHOUETTE_OPTIONS, DRESS_SILHOUETTE_OPTIONS,
  SLEEVE_LENGTH_OPTIONS, SLEEVE_OPTIONS, BACK_STYLE_OPTIONS, KNIT_TYPE_OPTIONS,
  HOOD_STYLE_OPTIONS, HOOD_POCKET_OPTIONS, GARMENT_FIT_OPTIONS, JEAN_CUT_OPTIONS,
  RISE_HEIGHT_OPTIONS, WASH_OPTIONS, SKIRT_LENGTH_OPTIONS, SHORTS_LENGTH_OPTIONS,
  OUTERWEAR_CLOSURE_OPTIONS, OUTERWEAR_LENGTH_OPTIONS, SHOE_HEEL_OPTIONS,
  SHOE_TOE_OPTIONS, SHOE_MATERIAL_OPTIONS, JEWELRY_TYPE_OPTIONS, HAT_TYPE_OPTIONS,
  BAG_SIZE_OPTIONS, SWIMSUIT_TYPE_OPTIONS, SWIMSUIT_TOP_STYLE_OPTIONS,
  SWIMSUIT_BOTTOM_STYLE_OPTIONS, FABRIC_OPTIONS, EXPOSURE_OPTIONS,
  AESTHETIC_OPTIONS, EARRING_TYPE_OPTIONS, BAG_STYLE_OPTIONS, BAG_HARDWARE_OPTIONS, accessoryMaterialOptionsForSubcategory,
} from "./types";
import type { ClosetItem, ItemCategory } from "./types";
import { getExposure, getVolume } from "./styleAlgorithm";

export interface AttributeField {
  key: string;
  options: string[];
}

const strs = (list: unknown): string[] =>
  Array.isArray(list) ? list.filter((v): v is string => typeof v === "string") : [];

/** The detail rows the item editor shows for this category + subcategory. */
export function attributeFieldsFor(category: ItemCategory, subcategoryRaw: string): AttributeField[] {
  const sub = (subcategoryRaw || "").toLowerCase();
  const f = (key: string, options: unknown): AttributeField => ({ key, options: strs(options) });
  const fields: AttributeField[] = [];

  if (category === "accessory") {
    if (sub === "jewelry set") fields.push(f("jewelryType", JEWELRY_TYPE_OPTIONS));
    if (sub.includes("hat")) fields.push(f("hatType", HAT_TYPE_OPTIONS));
    if (sub.includes("bag")) {
      fields.push(
        f("bagStyle", BAG_STYLE_OPTIONS),
        f("size", BAG_SIZE_OPTIONS),
        f("hardware", BAG_HARDWARE_OPTIONS)
      );
    }
    fields.push(f("material", accessoryMaterialOptionsForSubcategory(subcategoryRaw)));
  }
  if (category === "bottom") {
    if (!sub.includes("short") && !sub.includes("skort") && !sub.includes("skirt")) {
      fields.push(f("fit", JEAN_CUT_OPTIONS));
    }
    fields.push(f("rise", RISE_HEIGHT_OPTIONS));
    if (sub.includes("jean")) fields.push(f("wash", WASH_OPTIONS));
    if (sub.includes("skirt")) fields.push(f("length", SKIRT_LENGTH_OPTIONS));
    if (sub.includes("short")) fields.push(f("length", SHORTS_LENGTH_OPTIONS));
  }
  if (category === "swimwear") {
    fields.push(
      f("swimsuitType", SWIMSUIT_TYPE_OPTIONS),
      f("swimsuitTop", SWIMSUIT_TOP_STYLE_OPTIONS),
      f("swimsuitBottom", SWIMSUIT_BOTTOM_STYLE_OPTIONS),
      f("backStyle", BACK_STYLE_OPTIONS)
    );
  }
  if (category === "top" || category === "dress" || category === "set") {
    fields.push(f("neckline", NECKLINE_OPTIONS), f("silhouette", TOP_SILHOUETTE_OPTIONS));
    if (category === "dress") fields.push(f("dressSilhouette", DRESS_SILHOUETTE_OPTIONS));
    fields.push(
      f("sleeveLength", SLEEVE_LENGTH_OPTIONS),
      f("sleeve", SLEEVE_OPTIONS),
      f("backStyle", BACK_STYLE_OPTIONS)
    );
    if (sub.includes("sweater") || sub.includes("cardigan")) fields.push(f("knitType", KNIT_TYPE_OPTIONS));
    if (sub.includes("hoodie")) fields.push(f("hoodStyle", HOOD_STYLE_OPTIONS), f("pocket", HOOD_POCKET_OPTIONS));
    if (sub.includes("sweatsuit") || sub.includes("tracksuit") || sub.includes("loungewear")) {
      fields.push(f("sweatsuitFit", GARMENT_FIT_OPTIONS));
    }
  }
  if (category === "outerwear") {
    fields.push(
      f("closure", OUTERWEAR_CLOSURE_OPTIONS),
      f("length", OUTERWEAR_LENGTH_OPTIONS),
      f("fit", GARMENT_FIT_OPTIONS)
    );
  }
  if (category === "shoes") {
    if (sub.includes("heel") || sub.includes("boot") || sub.includes("sandal")) {
      fields.push(f("heelHeight", SHOE_HEEL_OPTIONS));
    }
    if (sub.includes("heel") || sub.includes("boot") || sub.includes("flat")) {
      fields.push(f("toeShape", SHOE_TOE_OPTIONS));
    }
    fields.push(f("material", SHOE_MATERIAL_OPTIONS));
  }
  if (category !== "makeup") {
    if (sub === "earrings") fields.push(f("earringType", EARRING_TYPE_OPTIONS));
    if (category !== "shoes" && category !== "accessory") fields.push(f("fabric", FABRIC_OPTIONS));
    if (["top", "bottom", "dress", "set", "outerwear"].includes(category)) {
      fields.push(f("volume", GARMENT_FIT_OPTIONS));
    }
    if (["top", "bottom", "dress", "set", "swimwear"].includes(category)) {
      fields.push(f("exposure", EXPOSURE_OPTIONS));
    }
    fields.push(f("aesthetic", AESTHETIC_OPTIONS));
  }
  return fields;
}

// --- evidence 1: words in the name / tags ------------------------------

function words(text: string): string {
  return ` ${text.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()} `;
}

// Alternate wording for an option, so "tee" or "v neck" still match.
const OPTION_SYNONYMS: Record<string, string[]> = {
  "Crew Neck": ["crewneck", "crew"],
  "V-Neck": ["v neck", "vneck", "deep v"],
  "Scoop Neck": ["scoop", "scoopneck"],
  "Square Neck": ["square"],
  Boatneck: ["boat neck", "bateau"],
  "Cowl Neck": ["cowl"],
  Halter: ["halter", "halterneck"],
  "Off-the-Shoulder": ["off shoulder", "off the shoulder", "bardot"],
  "One-Shoulder": ["one shoulder", "asymmetric shoulder"],
  "Mock Neck": ["mock"],
  Turtleneck: ["turtle neck", "roll neck"],
  Sweetheart: ["sweetheart"],
  "Button-Up": ["button up", "button down", "button front"],
  "Zip-Up": ["zip up", "zipper", "zip front", "full zip"],
  "Tie Neck": ["tie neck", "tie front"],
  Sleeveless: ["sleeveless", "tank", "strapless", "tube"],
  "Short Sleeve": ["short sleeve", "short sleeves", "tee", "t shirt"],
  "Long Sleeve": ["long sleeve", "long sleeves"],
  "Three-Quarter Sleeve": ["three quarter", "3 4 sleeve", "3 4"],
  "Spaghetti Strap": ["spaghetti", "cami"],
  Racerback: ["racer back"],
  "Backless / Open-Back": ["backless", "open back"],
  "Lace-Up Back": ["lace up back", "corset back"],
  "Zip Back": ["back zip", "zip back"],
  "Pointed Toe": ["pointy", "pointed"],
  "High Heel": ["high heel", "stiletto", "pump"],
  "Block Heel": ["block"],
  Stiletto: ["stiletto"],
  Platform: ["platform"],
  Wedge: ["wedge"],
  Flat: ["flat", "sneaker", "slide", "loafer"],
  "Skinny": ["skinny"],
  "Wide Leg": ["wide leg", "palazzo"],
  "High-Rise": ["high rise", "high waisted", "high waist"],
  "Low-Rise": ["low rise", "low waisted"],
  "Mid-Rise": ["mid rise"],
  "Light Wash": ["light wash", "light blue"],
  "Dark Wash": ["dark wash", "dark blue"],
  Oversized: ["oversized", "baggy", "slouchy"],
  Fitted: ["fitted", "bodycon", "slim", "bandage"],
  Cropped: ["cropped", "crop"],
  Relaxed: ["relaxed", "loose"],
  Zip: ["zip", "zipper"],
  Snap: ["snap"],
  Belted: ["belted", "belt"],
  "A-Line": ["a line"],
  "Wrap Dress": ["wrap dress"],
  "Slip Dress": ["slip dress", "slip"],
  "Shirt Dress": ["shirt dress"],
  Mermaid: ["mermaid", "trumpet"],
  "Ribbed Knit": ["ribbed", "rib"],
  "Cable Knit": ["cable"],
  "Chunky Knit": ["chunky"],
  "Kangaroo Pocket": ["kangaroo"],
  Pullover: ["pullover"],
  Tote: ["tote", "shopper"],
  Crossbody: ["cross body", "crossbody", "sling"],
  "Shoulder Bag": ["shoulder bag"],
  Satchel: ["satchel", "doctor bag"],
  Hobo: ["hobo", "slouchy bag"],
  Clutch: ["clutch", "envelope bag", "pouch"],
  "Bucket Bag": ["bucket bag", "bucket"],
  Backpack: ["backpack", "rucksack"],
  "Belt Bag": ["belt bag", "fanny pack", "waist bag"],
  "Top Handle": ["top handle", "handbag"],
  "Duffel / Weekender": ["duffel", "duffle", "weekender", "travel bag"],
  "Mini Bag": ["mini bag", "micro bag"],
  Mini: ["mini", "micro"],
  "Drawstring Hood": ["drawstring"],
};

function evidenceMatch(options: string[], text: string): string | null {
  const hay = words(text);
  let best: string | null = null;
  let bestLen = 0;
  for (const option of options) {
    const candidates = [option, ...(OPTION_SYNONYMS[option] || [])];
    for (const c of candidates) {
      const needle = words(c);
      if (hay.includes(needle) && needle.length > bestLen) {
        best = option;
        bestLen = needle.length;
      }
    }
  }
  return best;
}

// --- evidence 3: defaults by kind of item ----------------------------------

const TOP_DEFAULTS: Record<string, { sleeveLength?: string; neckline?: string }> = {
  "t-shirt": { sleeveLength: "Short Sleeve", neckline: "Crew Neck" },
  tank: { sleeveLength: "Sleeveless", neckline: "Scoop Neck" },
  camisole: { sleeveLength: "Spaghetti Strap", neckline: "V-Neck" },
  "tube top": { sleeveLength: "Sleeveless" },
  "crop top": { sleeveLength: "Short Sleeve", neckline: "Crew Neck" },
  bralette: { sleeveLength: "Spaghetti Strap", neckline: "Scoop Neck" },
  bodysuit: { sleeveLength: "Long Sleeve", neckline: "Scoop Neck" },
  "halter top": { sleeveLength: "Sleeveless", neckline: "Halter" },
  "off-shoulder top": { sleeveLength: "Short Sleeve", neckline: "Off-the-Shoulder" },
  "peplum top": { sleeveLength: "Short Sleeve", neckline: "Crew Neck" },
  "wrap top": { sleeveLength: "Long Sleeve", neckline: "Surplice" },
  "button-down": { sleeveLength: "Long Sleeve", neckline: "Button-Up" },
  henley: { sleeveLength: "Long Sleeve", neckline: "Button-Up" },
  polo: { sleeveLength: "Short Sleeve", neckline: "Button-Up" },
  blouse: { sleeveLength: "Long Sleeve", neckline: "Button-Up" },
  sweater: { sleeveLength: "Long Sleeve", neckline: "Crew Neck" },
  turtleneck: { sleeveLength: "Long Sleeve", neckline: "Turtleneck" },
  hoodie: { sleeveLength: "Long Sleeve", neckline: "Crew Neck" },
  sweatshirt: { sleeveLength: "Long Sleeve", neckline: "Crew Neck" },
  tunic: { sleeveLength: "Long Sleeve", neckline: "Crew Neck" },
};

const SHOE_DEFAULTS: Record<string, { heelHeight?: string; toeShape?: string }> = {
  heels: { heelHeight: "High Heel", toeShape: "Pointed Toe" },
  boots: { heelHeight: "Low Heel", toeShape: "Round Toe" },
  flats: { heelHeight: "Flat", toeShape: "Round Toe" },
  sandals: { heelHeight: "Flat" },
  sneakers: { heelHeight: "Flat" },
  slides: { heelHeight: "Flat" },
  "flip flops": { heelHeight: "Flat" },
};

const BAG_SIZE_BY_STYLE: Record<string, string> = {
  Tote: "Large",
  Crossbody: "Small",
  "Shoulder Bag": "Medium",
  Satchel: "Medium",
  Hobo: "Medium",
  Clutch: "Small",
  "Bucket Bag": "Medium",
  Backpack: "Large",
  "Belt Bag": "Mini",
  "Top Handle": "Medium",
  "Duffel / Weekender": "Oversized",
  "Mini Bag": "Mini",
  Wristlet: "Mini",
};

function categoryDefault(
  item: Pick<ClosetItem, "category" | "subcategory">,
  key: string,
  text: string,
  known: Record<string, string> = {}
): string | null {
  const sub = (item.subcategory || "").trim().toLowerCase();
  const hay = words(text);
  if (item.category === "set" && !TOP_DEFAULTS[sub]) {
    // Sets are named after their top piece ("ribbed hooded sweatshirt
    // and flared pants set"), so read the top from the name.
    if (key === "sleeveLength") {
      if (/ (sweatshirt|hoodie|sweater|pullover|jacket|long sleeve) /.test(hay)) return "Long Sleeve";
      if (/ (tee|t shirt|crop|polo) /.test(hay)) return "Short Sleeve";
      if (/ (tank|cami|camisole|bralette|tube) /.test(hay)) return "Sleeveless";
    }
    if (key === "neckline") {
      if (/ (sweatshirt|hoodie|sweater|tee|t shirt|crop) /.test(hay)) return "Crew Neck";
      if (/ (tank|cami|camisole) /.test(hay)) return "Scoop Neck";
    }
  }
  if (item.category === "top" || item.category === "set") {
    const hit = TOP_DEFAULTS[sub];
    if (key === "sleeveLength" && hit?.sleeveLength) return hit.sleeveLength;
    if (key === "neckline" && hit?.neckline) return hit.neckline;
  }
  if (item.category === "dress") {
    if (key === "sleeveLength") return "Sleeveless";
    if (key === "neckline") return "V-Neck";
    if (key === "dressSilhouette") return sub === "gown" ? "Ball Gown" : "Sheath";
  }
  if (item.category === "shoes") {
    const hit = SHOE_DEFAULTS[sub];
    if (key === "heelHeight" && hit?.heelHeight) return hit.heelHeight;
    if (key === "toeShape" && hit?.toeShape) return hit.toeShape;
  }
  if (item.category === "bottom") {
    if (key === "rise") return "Mid-Rise";
    if (key === "fit") {
      if (sub === "leggings") return "Skinny";
      if (sub === "jeans") return "Straight";
      if (sub === "pants") return "Wide Leg";
    }
    if (key === "wash" && sub.includes("jean")) return "Medium Wash";
    if (key === "length" && sub.includes("skirt")) return "Mini";
    if (key === "length" && sub.includes("short")) return null;
  }
  if (item.category === "accessory" && key === "size" && known.bagStyle) {
    // A tote is large and a clutch is small; the shape is the best
    // available stand-in for scale, which a photo alone can't show.
    return BAG_SIZE_BY_STYLE[known.bagStyle] || null;
  }
  if (item.category === "outerwear") {
    if (key === "closure") return "Zip";
    if (key === "length") return "Hip-Length";
    if (key === "fit") return "Relaxed";
  }
  return null;
}

// --- aesthetic -----------------------------------------------------------------

const AESTHETIC_KEYWORDS: Record<string, string[]> = {
  Streetwear: ["hoodie", "sneaker", "cargo", "graphic", "jogger", "sweatshirt", "oversized", "bomber", "slides"],
  Elegant: ["gown", "satin", "silk", "heels", "stiletto", "velvet", "midi", "maxi", "pearl", "chiffon"],
  "Business Casual": ["blazer", "button down", "button up", "blouse", "trouser", "loafer", "pencil", "polo", "cardigan"],
  "Boho Chic": ["fringe", "crochet", "peasant", "paisley", "boho", "tassel", "kimono"],
  Comfort: ["sweatsuit", "tracksuit", "loungewear", "legging", "sweatpants", "jogger", "fleece", "terry", "tee", "t shirt"],
  Sexy: ["bodycon", "bandage", "corset", "cutout", "cut out", "plunging", "backless", "bodysuit", "mini", "lace", "mesh", "sheer"],
  Girly: ["pink", "bow", "ruffle", "peplum", "floral", "blush", "lace", "babydoll"],
};

function inferAesthetic(text: string): string | null {
  const hay = words(text);
  const scored = Object.entries(AESTHETIC_KEYWORDS)
    .map(([name, kws]) => [name, kws.filter((k) => hay.includes(words(k))).length] as const)
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([name]) => name);
  return scored.length ? scored.join(", ") : null;
}

// --- main -----------------------------------------------------------------------

function pluralityFromCloset(
  item: Pick<ClosetItem, "id" | "category" | "subcategory">,
  key: string,
  options: string[],
  allItems: ClosetItem[]
): string | null {
  const sub = (item.subcategory || "").trim().toLowerCase();
  const tally = (pool: ClosetItem[]) => {
    const counts = new Map<string, number>();
    for (const other of pool) {
      const raw = other.tags?.[key];
      if (!raw) continue;
      const value = raw.split(",")[0].trim();
      if (options.length && !options.includes(value)) continue;
      counts.set(value, (counts.get(value) || 0) + 1);
    }
    const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1]);
    // Needs a clear winner; a tie means the closet doesn't agree.
    if (ranked.length === 0) return null;
    if (ranked.length > 1 && ranked[0][1] === ranked[1][1]) return null;
    return ranked[0][0];
  };
  const sameType = allItems.filter(
    (o) =>
      o.id !== item.id &&
      o.category === item.category &&
      sub !== "" &&
      (o.subcategory || "").trim().toLowerCase() === sub
  );
  return tally(sameType);
}

/**
 * Returns a value for every applicable detail the item doesn't have yet.
 * Never overwrites a value that's already set. Details with no evidence
 * and no safe default are left out of the result.
 */
export function inferMissingAttributes(
  item: Pick<ClosetItem, "id" | "name" | "category" | "subcategory" | "tags">,
  allItems: ClosetItem[]
): Record<string, string> {
  const result: Record<string, string> = {};
  const existing = item.tags || {};
  const fields = attributeFieldsFor(item.category, item.subcategory || "");
  const text = [item.name || "", item.subcategory || "", ...Object.values(existing)].join(" ");

  for (const field of fields) {
    if (existing[field.key]?.trim()) continue;
    if (result[field.key]) continue;

    if (field.key === "exposure") {
      result.exposure = getExposure({ ...item, tags: existing } as ClosetItem);
      continue;
    }
    if (field.key === "volume") {
      result.volume = getVolume({ ...item, tags: existing } as ClosetItem);
      continue;
    }
    if (field.key === "aesthetic") {
      const guess = inferAesthetic(text);
      if (guess) result.aesthetic = guess;
      continue;
    }

    // Hardware finish can't be read from words: "Gold" in the text is
    // usually the item's color, not its hardware.
    const fromWords =
      field.options.length && field.key !== "hardware" ? evidenceMatch(field.options, text) : null;
    const value =
      fromWords ||
      pluralityFromCloset(item, field.key, field.options, allItems) ||
      categoryDefault(item, field.key, text, { ...existing, ...result });
    if (value && (field.options.length === 0 || field.options.includes(value))) {
      result[field.key] = value;
    }
  }
  return result;
}
