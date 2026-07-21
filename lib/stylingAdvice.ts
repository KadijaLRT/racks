// Contextual styling advice, encoded from three references:
// 1. "Necklines & Necklaces" — which necklace style suits a given neckline
// 2. "What bra to wear with different tops" — bra type by top silhouette
// 3. "Gold vs Silver jewelry color pairings" — which metal suits a color
//
// All matching is keyword-based against an item's subcategory, name, and
// tag values (whatever text is actually available), never against a
// dedicated "neckline" field the data model doesn't have. Matches are
// deliberately conservative: if nothing matches confidently, we return
// null rather than guessing, so advice never appears for items it
// doesn't actually apply to.

export interface StylingTip {
  label: string;
  advice: string;
}

function itemText(parts: Array<string | undefined | null>): string {
  return (parts || [])
    .filter((p): p is string => Boolean(p))
    .join(" ")
    .toLowerCase();
}

// --- Bra recommendation by top style -----------------------------------

const BRA_RULES: Array<{ keywords: string[]; style: string; bra: string }> = [
  { keywords: ["spaghetti strap", "cami", "camisole"], style: "spaghetti strap top", bra: "a t-shirt bra or lightly lined bra, for delicate straps and light support" },
  { keywords: ["strapless", "tube top", "bandeau"], style: "strapless top", bra: "a strapless bra or bandeau bra, for a secure fit without visible straps" },
  { keywords: ["halter"], style: "halter top", bra: "a stick-on or adhesive bra, for support without showing straps" },
  { keywords: ["backless", "open back", "low back", "caged back", "low v-back", "cross-back", "lace-up back"], style: "backless, caged, or low-back top", bra: "a stick-on or backless bra, for a backless look with support and lift" },
  { keywords: ["off-shoulder", "off shoulder", "off-the-shoulder", "cold shoulder", "cold-shoulder"], style: "off-shoulder top", bra: "a strapless or multiway bra, for support without showing straps" },
  { keywords: ["plunge", "plunging", "deep v", "deep neck"], style: "plunge neckline top", bra: "a plunge bra or low-cut bra, for a low neckline with the right support" },
  { keywords: ["t-shirt", "tee", "crewneck", "crew neck"], style: "t-shirt", bra: "a t-shirt bra or seamless bra, for a smooth silhouette under fitted fabric" },
];

export function braRecommendation(item: {
  subcategory?: string;
  name?: string;
  tags?: Record<string, string>;
}): StylingTip | null {
  const text = itemText([item?.subcategory, item?.name, ...Object.values(item?.tags || {})]);
  for (const rule of BRA_RULES) {
    if (rule.keywords.some((k) => text.includes(k))) {
      return {
        label: `Pairs well with ${rule.style}`,
        advice: `Try ${rule.bra}.`,
      };
    }
  }
  return null;
}

// --- Necklace recommendation by neckline --------------------------------

const NECKLACE_RULES: Array<{ keywords: string[]; neckline: string; necklace: string }> = [
  { keywords: ["turtleneck", "mock neck", "high neck"], neckline: "a turtleneck or high neck", necklace: "layered long necklaces worn over the top" },
  { keywords: ["choker", "collar"], neckline: "a collared or crew neckline", necklace: "a structured choker or collar-style necklace" },
  { keywords: ["off-shoulder", "off shoulder", "off-the-shoulder"], neckline: "an off-shoulder neckline", necklace: "a layered necklace to fill the open neckline" },
  { keywords: ["v-neck", "v neck"], neckline: "a v-neckline", necklace: "a long pendant necklace that follows the V" },
  { keywords: ["sweetheart"], neckline: "a sweetheart neckline", necklace: "a delicate pendant centered at the neckline" },
  { keywords: ["halter", "racerback"], neckline: "a halter neckline", necklace: "a single long pendant necklace" },
  { keywords: ["one-shoulder", "one shoulder", "asymmetric"], neckline: "a one-shoulder neckline", necklace: "an asymmetric choker or a delicate draped chain" },
  { keywords: ["square neck", "square-neck"], neckline: "a square neckline", necklace: "a pendant necklace with a geometric shape" },
  { keywords: ["boatneck", "boat neck", "bateau"], neckline: "a boatneck", necklace: "a shorter, delicate necklace that won't compete with the wide neckline" },
  { keywords: ["cowl neck", "cowl-neck"], neckline: "a cowl neckline", necklace: "little to no necklace, the draped fabric is already the focal point" },
  { keywords: ["plunge", "plunging", "deep v"], neckline: "a plunging neckline", necklace: "a long pendant that follows the plunge without crowding it" },
  { keywords: ["keyhole"], neckline: "a keyhole neckline", necklace: "a subtle chain that doesn't overlap the opening" },
  { keywords: ["button-up", "button up", "button-down"], neckline: "a button-up neckline", necklace: "a simple pendant that peeks out where the collar opens" },
  { keywords: ["zip-up", "zip up", "full zip"], neckline: "a zip-up neckline", necklace: "little to no necklace when zipped high, a short pendant if worn partly unzipped" },
  { keywords: ["crewneck", "crew neck", "round neck"], neckline: "a round neckline", necklace: "a simple pendant necklace" },
];

export function necklaceRecommendation(item: {
  subcategory?: string;
  name?: string;
  tags?: Record<string, string>;
}): StylingTip | null {
  const text = itemText([item?.subcategory, item?.name, ...Object.values(item?.tags || {})]);
  for (const rule of NECKLACE_RULES) {
    if (rule.keywords.some((k) => text.includes(k))) {
      return {
        label: `With ${rule.neckline}`,
        advice: `${rule.necklace.charAt(0).toUpperCase()}${rule.necklace.slice(1)} tends to work best.`,
      };
    }
  }
  return null;
}

// --- Jewelry metal recommendation by color ------------------------------

const GOLD_COLORS = [
  "beige", "caramel", "chocolate", "brown", "cream", "mustard", "yellow",
  "peach", "coral", "orange", "terracotta", "rust", "ruby", "red",
  "burgundy", "maroon", "teal", "emerald", "green", "olive", "khaki", "forest",
];

const SILVER_COLORS = [
  "black", "gray", "grey", "white", "ivory", "blush", "pink", "rose",
  "fuchsia", "magenta", "plum", "purple", "lilac", "mint", "sky blue",
  "cerulean", "blue", "navy", "violet", "lavender",
];

export function jewelryToneRecommendation(item: {
  tags?: Record<string, string>;
  name?: string;
}): StylingTip | null {
  const text = itemText([item?.name, ...Object.values(item?.tags || {})]);
  const isGold = GOLD_COLORS.some((c) => text.includes(c));
  const isSilver = SILVER_COLORS.some((c) => text.includes(c));

  if (isGold && !isSilver) {
    return { label: "Jewelry tone", advice: "Gold pieces will complement this color best." };
  }
  if (isSilver && !isGold) {
    return { label: "Jewelry tone", advice: "Silver pieces will complement this color best." };
  }
  if (isGold && isSilver) {
    return { label: "Jewelry tone", advice: "Either gold or silver works well with this color." };
  }
  return null;
}
