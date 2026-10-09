// Cleans up tag keys and values so the same thing is always stored the
// same way. The AI is free to invent key names ("heel_height",
// "sleeve length", "back style") and value spellings ("grey",
// "burgandy", "black"), which then never match the app's own keys
// ("heelHeight", "sleeveLength") or option lists, so filters, the
// editor chips and outfit matching quietly miss them. Everything here
// is local and deterministic, no AI.

import {
  COLOR_OPTIONS, PATTERN_OPTIONS, FABRIC_OPTIONS, NECKLINE_OPTIONS,
  SLEEVE_LENGTH_OPTIONS, SLEEVE_OPTIONS, BACK_STYLE_OPTIONS, SHOE_HEEL_OPTIONS,
  SHOE_TOE_OPTIONS, SHOE_MATERIAL_OPTIONS, ACCESSORY_MATERIAL_OPTIONS,
  OUTERWEAR_CLOSURE_OPTIONS, WASH_OPTIONS, RISE_HEIGHT_OPTIONS, KNIT_TYPE_OPTIONS,
  HOOD_STYLE_OPTIONS, HOOD_POCKET_OPTIONS, DRESS_SILHOUETTE_OPTIONS,
  TOP_SILHOUETTE_OPTIONS, JEWELRY_TYPE_OPTIONS, EARRING_TYPE_OPTIONS,
  HAT_TYPE_OPTIONS, SWIMSUIT_TYPE_OPTIONS, SWIMSUIT_TOP_STYLE_OPTIONS,
  SWIMSUIT_BOTTOM_STYLE_OPTIONS, AESTHETIC_OPTIONS, EXPOSURE_OPTIONS,
  GARMENT_FIT_OPTIONS, JEAN_CUT_OPTIONS, BAG_STYLE_OPTIONS, BAG_HARDWARE_OPTIONS,
  BAG_SIZE_OPTIONS, BAG_BRAND_OPTIONS,
} from "./types";

// The keys the editor and filters actually read.
const CANONICAL_KEYS = [
  "color", "pattern", "fabric", "neckline", "sleeveLength", "sleeve",
  "backStyle", "heelHeight", "toeShape", "material", "closure", "length",
  "wash", "rise", "knitType", "hoodStyle", "pocket", "dressSilhouette",
  "silhouette", "jewelryType", "earringType", "hatType", "swimsuitType",
  "swimsuitTop", "swimsuitBottom", "aesthetic", "exposure", "volume", "fit",
  "sweatsuitFit", "finish", "shade", "size", "brand", "season", "formality",
  "occasion", "bagStyle", "hardware",
];

const squash = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

const KEY_LOOKUP = new Map<string, string>(CANONICAL_KEYS.map((k) => [squash(k), k]));
// Common alternate spellings the AI or a person might use.
const KEY_ALIASES: Record<string, string> = {
  colour: "color",
  colors: "color",
  colours: "color",
  patterns: "pattern",
  fabrictype: "fabric",
  materials: "material",
  sleevelen: "sleeveLength",
  sleevelength: "sleeveLength",
  sleevetype: "sleeve",
  sleevestyle: "sleeve",
  heel: "heelHeight",
  heelsize: "heelHeight",
  toe: "toeShape",
  toestyle: "toeShape",
  necklinestyle: "neckline",
  occasions: "occasion",
  seasons: "season",
  style: "aesthetic",
  vibe: "aesthetic",
  fitting: "fit",
  hem: "length",
};

// Spelling fixes for values. Keys are squashed (lowercase, no spaces or
// punctuation).
const VALUE_FIXES: Record<string, string> = {
  grey: "Gray", charcoalgrey: "Charcoal", charcoalgray: "Charcoal",
  fushia: "Fuchsia", fuschia: "Fuchsia", fuchia: "Fuchsia",
  burgandy: "Burgundy", burgundi: "Burgundy", burgendy: "Burgundy",
  lavendar: "Lavender", lavander: "Lavender",
  cerulian: "Cerulean", ceruleen: "Cerulean",
  maroone: "Maroon", marroon: "Maroon",
  khakhi: "Khaki", kaki: "Khaki", khakis: "Khaki",
  turqoise: "Teal", turquoise: "Teal", turqouise: "Teal",
  offwhite: "Ivory", eggshell: "Ivory",
  navyblue: "Navy", darkblue: "Navy", lightblue: "Sky Blue", babyblue: "Sky Blue",
  hotpink: "Fuchsia", salmon: "Coral", burntorange: "Rust", wine: "Burgundy",
  oxblood: "Burgundy", champagne: "Beige", nudecolor: "Beige", multicolour: "Multicolor",
  multicolored: "Multicolor", multicoloured: "Multicolor", multi: "Multicolor",
  tiedye: "Tie-Dye", tiedyed: "Tie-Dye", polkadots: "Polka Dot", polkadot: "Polka Dot",
  stripes: "Striped", stripe: "Striped", checked: "Checkered", check: "Checkered",
  checks: "Checkered", flowers: "Floral", flower: "Floral", camouflage: "Camo",
  leopard: "Animal Print", leopardprint: "Animal Print", zebra: "Animal Print",
  snakeskin: "Animal Print", cheetah: "Animal Print", solidcolor: "Solid", plain: "Solid",
  vneck: "V-Neck", crewneck: "Crew Neck", scoopneck: "Scoop Neck", squareneck: "Square Neck",
  turtle: "Turtleneck", halterneck: "Halter", offtheshoulder: "Off-the-Shoulder",
  offshoulder: "Off-the-Shoulder", longsleeves: "Long Sleeve", shortsleeves: "Short Sleeve",
  sleevless: "Sleeveless", slevless: "Sleeveless", suede: "Suede", sued: "Suede",
  leather: "Leather", fauxleather: "Faux Leather", pleather: "Faux Leather",
  patentleather: "Patent Leather", cotten: "Cotton", polyster: "Polyester",
  spandex: "Spandex / Elastane", elastane: "Spandex / Elastane", lycra: "Spandex / Elastane",
  zipper: "Zip", zipup: "Zip-Up", zippered: "Zip", highheel: "High Heel", highheels: "High Heel",
  lowheel: "Low Heel", midheel: "Mid Heel", pointedtoe: "Pointed Toe", roundtoe: "Round Toe",
  squaretoe: "Square Toe", almondtoe: "Almond Toe", opentoe: "Open Toe", peeptoe: "Peep Toe",
};

const LIST_VALUE_KEYS = new Set(["color", "pattern", "aesthetic", "season", "occasion"]);

function asStrings(list: unknown): string[] {
  return Array.isArray(list) ? list.filter((v): v is string => typeof v === "string") : [];
}

const OPTION_LISTS: Record<string, string[]> = {
  color: asStrings(COLOR_OPTIONS),
  pattern: asStrings(PATTERN_OPTIONS),
  fabric: asStrings(FABRIC_OPTIONS),
  neckline: asStrings(NECKLINE_OPTIONS),
  sleeveLength: asStrings(SLEEVE_LENGTH_OPTIONS),
  sleeve: asStrings(SLEEVE_OPTIONS),
  backStyle: asStrings(BACK_STYLE_OPTIONS),
  heelHeight: asStrings(SHOE_HEEL_OPTIONS),
  toeShape: asStrings(SHOE_TOE_OPTIONS),
  material: [...asStrings(SHOE_MATERIAL_OPTIONS), ...asStrings(ACCESSORY_MATERIAL_OPTIONS), ...asStrings(FABRIC_OPTIONS)],
  closure: asStrings(OUTERWEAR_CLOSURE_OPTIONS),
  wash: asStrings(WASH_OPTIONS),
  rise: asStrings(RISE_HEIGHT_OPTIONS),
  knitType: asStrings(KNIT_TYPE_OPTIONS),
  hoodStyle: asStrings(HOOD_STYLE_OPTIONS),
  pocket: asStrings(HOOD_POCKET_OPTIONS),
  dressSilhouette: asStrings(DRESS_SILHOUETTE_OPTIONS),
  silhouette: asStrings(TOP_SILHOUETTE_OPTIONS),
  jewelryType: asStrings(JEWELRY_TYPE_OPTIONS),
  earringType: asStrings(EARRING_TYPE_OPTIONS),
  hatType: asStrings(HAT_TYPE_OPTIONS),
  swimsuitType: asStrings(SWIMSUIT_TYPE_OPTIONS),
  swimsuitTop: asStrings(SWIMSUIT_TOP_STYLE_OPTIONS),
  swimsuitBottom: asStrings(SWIMSUIT_BOTTOM_STYLE_OPTIONS),
  aesthetic: asStrings(AESTHETIC_OPTIONS),
  exposure: asStrings(EXPOSURE_OPTIONS),
  volume: asStrings(GARMENT_FIT_OPTIONS),
  fit: [...asStrings(JEAN_CUT_OPTIONS), ...asStrings(GARMENT_FIT_OPTIONS)],
  bagStyle: asStrings(BAG_STYLE_OPTIONS),
  hardware: asStrings(BAG_HARDWARE_OPTIONS),
  size: asStrings(BAG_SIZE_OPTIONS),
  brand: asStrings(BAG_BRAND_OPTIONS),
};

// Brand shorthand and spellings seen on tags and labels.
const BRAND_ALIASES: Record<string, string> = {
  lv: "Louis Vuitton", louisvuitton: "Louis Vuitton", louisvuiton: "Louis Vuitton",
  mk: "Michael Kors", michaelkors: "Michael Kors", michealkors: "Michael Kors",
  ysl: "Saint Laurent", yvessaintlaurent: "Saint Laurent", saintlaurent: "Saint Laurent",
  katespade: "Kate Spade", katespadenewyork: "Kate Spade", toryburch: "Tory Burch",
  marcjacobs: "Marc Jacobs", stevemadden: "Steve Madden", hermes: "Hermes",
  bottegaveneta: "Bottega Veneta", bottega: "Bottega Veneta", guccii: "Gucci",
  chanell: "Chanel", cocochanel: "Chanel", christiandior: "Dior", dior: "Dior",
  burbery: "Burberry", coachny: "Coach", handm: "H&M", hm: "H&M",
};

export function canonicalTagKey(rawKey: string): string {
  const trimmed = (rawKey || "").trim();
  if (!trimmed) return "";
  const flat = squash(trimmed);
  const known = KEY_LOOKUP.get(flat) || KEY_ALIASES[flat];
  if (known) return known;
  // Unknown key: still make it consistent ("back color", "back_print"
  // become backColor, backPrint) so the same idea isn't stored twice.
  const words = trimmed.split(/[\s_\-]+|(?<=[a-z])(?=[A-Z])/).filter(Boolean);
  if (words.length === 0) return "";
  return words
    .map((w, i) => (i === 0 ? w.toLowerCase() : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()))
    .join("");
}

function titleCase(value: string): string {
  return value.replace(/\b([a-z])/g, (m) => m.toUpperCase());
}

function normalizeOne(key: string, part: string): string {
  const cleaned = part.replace(/\s+/g, " ").trim();
  if (!cleaned) return "";
  const flat = squash(cleaned);
  if (key === "brand" && BRAND_ALIASES[flat]) return BRAND_ALIASES[flat];
  const options = OPTION_LISTS[key];
  const exact = options?.find((o) => squash(o) === flat);
  if (exact) return exact;
  // A spelling fix only applies when its corrected form is a real
  // option for this key, so "grey" becomes Gray for color but a
  // pattern-style fix never lands on an unrelated key.
  const fix = VALUE_FIXES[flat];
  if (fix && options?.includes(fix)) return fix;
  // Unmatched: keep the person's/AI's words, just tidy the casing.
  return /^[a-z]/.test(cleaned) ? titleCase(cleaned) : cleaned;
}

export function normalizeTagValue(key: string, value: string): string {
  const raw = (value ?? "").toString().trim();
  if (!raw) return "";
  if (LIST_VALUE_KEYS.has(key) && /[,/&]|\band\b/i.test(raw) && !OPTION_LISTS[key]?.some((o) => squash(o) === squash(raw))) {
    const parts = raw.split(/\s*(?:,|\/|&|\band\b)\s*/i).map((p) => normalizeOne(key, p)).filter(Boolean);
    return Array.from(new Set(parts)).join(", ");
  }
  return normalizeOne(key, raw);
}

/**
 * Returns a cleaned copy of a tags object: canonical keys, snapped and
 * respelled values, no empties, no duplicate keys. When two raw keys
 * collapse to the same canonical key, the first non-empty value wins.
 */
export function normalizeTags(tags: Record<string, unknown> | null | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [rawKey, rawValue] of Object.entries(tags || {})) {
    if (typeof rawValue !== "string" && typeof rawValue !== "number") continue;
    const key = canonicalTagKey(rawKey);
    if (!key) continue;
    const value = normalizeTagValue(key, String(rawValue));
    if (!value || out[key]) continue;
    out[key] = value;
  }
  return out;
}

/** True when normalizing would change the tags (used to avoid pointless writes). */
export function tagsNeedNormalizing(tags: Record<string, string> | null | undefined): boolean {
  const next = normalizeTags(tags);
  const prev = tags || {};
  const nextKeys = Object.keys(next);
  if (nextKeys.length !== Object.keys(prev).length) return true;
  return nextKeys.some((k) => prev[k] !== next[k]);
}

/** Human label for a tag key: heelHeight / heel_height -> "Heel height". */
export function formatTagKey(key: string): string {
  const spaced = (key || "")
    .replace(/[_-]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .trim()
    .toLowerCase();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}
