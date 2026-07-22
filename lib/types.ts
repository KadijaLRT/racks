// Core domain types for Racks.
// Subcategories are intentionally free-form strings scoped per top-level
// category rather than a rigid enum, so new subcategories can be added
// without a data migration. SUBCATEGORY_SUGGESTIONS below is just UI
// guidance, not a validation constraint.

export type ItemCategory =
  | "top"
  | "bottom"
  | "dress"
  | "set"
  | "outerwear"
  | "shoes"
  | "accessory"
  | "makeup";

export const SUBCATEGORY_SUGGESTIONS: Record<ItemCategory, string[]> = {
  top: [
    // Basics
    "t-shirt", "tank", "camisole", "tube top", "crop top", "bralette", "bodysuit",
    // Button-front / collared
    "button-down", "henley", "polo", "blouse",
    // Knits / layering
    "sweater", "turtleneck", "hoodie", "sweatshirt",
    // Going-out styles
    "peplum top", "wrap top", "halter top", "off-shoulder top", "tunic",
  ],
  bottom: ["jeans", "trousers", "shorts", "skirt", "leggings", "skort"],
  dress: ["mini", "midi", "maxi", "gown"],
  set: ["matching set", "jumpsuit", "romper", "bathing suit", "sweatsuit", "tracksuit", "loungewear"],
  outerwear: ["jacket", "coat", "blazer", "cardigan", "vest"],
  shoes: ["sneakers", "heels", "boots", "flats", "sandals"],
  accessory: [
    "bag", "jewelry", "belt", "hat", "sunglasses", "scarf",
    "socks", "tights", "stockings",
  ],
  makeup: ["face", "eyes", "lips", "cheeks"],
};

// Quick-pick tag values for bottoms, shown as tap-to-fill chips in the
// item editor rather than requiring free-text entry for common,
// well-known categories like pant cut and rise height.
export const JEAN_CUT_OPTIONS = [
  "Skinny",
  "Slim Fit",
  "Straight",
  "Cigarette / Pencil",
  "Boyfriend",
  "Girlfriend",
  "Stovepipe",
  "Tapered / Pegged",
  "Mom Jeans",
  "Jogger",
  "Bootcut",
  "Flare",
  "Bell Bottoms",
  "Wide Leg",
  "Palazzo",
  "Elephant Leg",
  "Capri",
  "Culottes",
  "Gaucho",
  "Clam Diggers",
  "Barrel / Horseshoe",
  "Cargo",
  "Harem / Jodhpur",
  "Sailor Pants",
  "Extended / Extendo",
];

export const RISE_HEIGHT_OPTIONS = ["High-Rise", "Mid-Rise", "Low-Rise"];

// Shown only when the subcategory suggests a skirt.
export const SKIRT_LENGTH_OPTIONS = [
  "Micro Mini",
  "Mini",
  "Above-Knee",
  "Knee-Length",
  "Midi",
  "Tea-Length",
  "Maxi",
];

// Shown only when the subcategory suggests shorts.
export const SHORTS_LENGTH_OPTIONS = [
  "Micro Short",
  "Short",
  "Bermuda",
  "Knee-Length",
  "Long / Board Short",
];

// Wash only makes sense for denim, shown conditionally when a bottom's
// subcategory is jeans rather than for every pair of pants.
export const WASH_OPTIONS = [
  "Light Wash",
  "Medium Wash",
  "Dark Wash",
  "Black Wash",
  "Raw / Unwashed",
  "Acid Wash",
  "Stonewash",
  "Distressed",
  "Bleached",
  "Ombre",
];

// Quick-pick tag values for tops/dresses/sets, from a common neckline
// and construction reference guide. Selecting one of these writes a
// plain descriptive string into tags (e.g. tags.neckline = "V-Neck"),
// which the styling-tip matcher in lib/stylingAdvice.ts already scans
// for keywords, so picking "V-Neck" or "Backless / Open-Back" here
// automatically improves the bra/necklace suggestions for free.
export const NECKLINE_OPTIONS = [
  "Crew Neck",
  "V-Neck",
  "Scoop Neck",
  "Square Neck",
  "Sweetheart",
  "Boatneck",
  "Cowl Neck",
  "Halter",
  "Off-the-Shoulder",
  "One-Shoulder",
  "Mock Neck",
  "Turtleneck",
  "Queen Anne",
  "Keyhole",
  "Plunging",
  "Illusion",
  "Surplice",
  "Button-Up",
  "Zip-Up",
  "Tie Neck",
];

export const TOP_SILHOUETTE_OPTIONS = [
  "Crop Top",
  "Peplum",
  "Wrap",
  "Asymmetrical Hem",
  "Handkerchief Hem",
  "Lettuce Hem",
  "Hi-Low",
  "Boxy / Oversized",
  "Corset / Bustier",
  "Camisole",
  "Tube / Strapless",
  "Smocked / Shirred",
  "Ruched",
  "Bodysuit",
];

// Shown only when the subcategory suggests a sweater, since knit type
// doesn't apply to a t-shirt or blouse.
export const KNIT_TYPE_OPTIONS = [
  "Cable Knit",
  "Chunky Knit",
  "Fine Knit",
  "Ribbed Knit",
  "Fair Isle",
  "Cashmere",
  "Cardigan (Open-Front)",
];

// Shown only when the subcategory suggests a hoodie.
export const HOOD_STYLE_OPTIONS = [
  "Pullover",
  "Zip-Up",
  "Oversized Hood",
  "Fitted Hood",
  "Drawstring Hood",
];

export const HOOD_POCKET_OPTIONS = ["Kangaroo Pocket", "Zip Pockets", "No Pocket"];

// Shown only when the subcategory suggests a sweatsuit/tracksuit.
// Universal fabric/material quick-pick, shown alongside Color/Pattern
// for bottoms, tops/dresses/sets, and outerwear. Absorbs what used to
// be a separate sweatsuit-only "Fabric" list (Fleece, French Terry,
// Velour, Waffle Knit) so a sweatsuit doesn't show two same-labeled
// "Fabric" rows back to back.
export const FABRIC_OPTIONS = [
  "Cotton",
  "Linen",
  "Silk",
  "Satin",
  "Chiffon",
  "Denim",
  "Leather",
  "Faux Leather",
  "Suede",
  "Wool",
  "Cashmere",
  "Velvet",
  "Corduroy",
  "Jersey",
  "Knit",
  "Chambray",
  "Tweed",
  "Fleece",
  "French Terry",
  "Velour",
  "Waffle Knit",
  "Nylon",
  "Polyester",
  "Spandex / Elastane",
];

export const GARMENT_FIT_OPTIONS = ["Relaxed", "Fitted", "Oversized", "Cropped"];

// Shoe-specific material, distinct from ACCESSORY_MATERIAL_OPTIONS
// since shoe construction has its own common vocabulary (patent,
// rubber sole material, etc.) not shared with bags/jewelry.
export const SHOE_MATERIAL_OPTIONS = [
  "Leather",
  "Suede",
  "Canvas",
  "Mesh",
  "Patent Leather",
  "Faux Leather",
  "Rubber",
  "Knit",
];

// Length is its own quick-pick row, distinct from sleeve construction
// style, so a top can get both a length (e.g. "Short Sleeve") and a
// style (e.g. "Puff / Juliet") as separate selections rather than
// mixed into one long list.
export const SLEEVE_LENGTH_OPTIONS = [
  "Sleeveless",
  "Spaghetti Strap",
  "Cap Sleeve",
  "Short Sleeve",
  "Elbow-Length",
  "Three-Quarter Sleeve",
  "Long Sleeve",
];

export const SLEEVE_OPTIONS = [
  "Dolman",
  "Raglan",
  "Kimono Sleeve",
  "Puff / Juliet",
  "Balloon Sleeve",
  "Lantern Sleeve",
  "Bishop",
  "Bell Sleeve",
  "Trumpet Sleeve",
  "Flutter Sleeve",
  "Petal Sleeve",
  "Butterfly",
  "Leg-of-Mutton",
  "Peasant Sleeve",
  "Cape Sleeve",
  "Cold-Shoulder",
];

export const BACK_STYLE_OPTIONS = [
  "Racerback",
  "Backless / Open-Back",
  "Low V-Back",
  "Keyhole Back",
  "Side Cut-Out",
  "Caged Back",
  "Cross-Back",
  "Lace-Up Back",
  "Zip Back",
  "Button Back",
];

// Outerwear-specific quick-picks.
export const OUTERWEAR_CLOSURE_OPTIONS = [
  "Zip",
  "Button",
  "Snap",
  "Belted",
  "Open Front",
  "Toggle",
];

export const OUTERWEAR_LENGTH_OPTIONS = [
  "Cropped",
  "Hip-Length",
  "Knee-Length",
  "Longline",
];

// Shoe-specific quick-picks.
export const SHOE_HEEL_OPTIONS = [
  "Flat",
  "Low Heel",
  "Mid Heel",
  "High Heel",
  "Platform",
  "Wedge",
  "Block Heel",
  "Stiletto",
];

export const SHOE_TOE_OPTIONS = [
  "Round Toe",
  "Pointed Toe",
  "Square Toe",
  "Open Toe",
  "Peep Toe",
  "Almond Toe",
];

// Accessory-specific quick-picks (bags, jewelry, belts, scarves, hats,
// sunglasses all fall under one broad "material" vocabulary).
export const ACCESSORY_MATERIAL_OPTIONS = [
  "Leather",
  "Faux Leather",
  "Canvas",
  "Suede",
  "Metal",
  "Gold-Tone",
  "Silver-Tone",
  "Fabric",
  "Silk",
  "Wool",
  "Cashmere",
  "Straw",
  "Wood",
  "Beaded",
  "Pearl",
  "Acetate",
  "Plastic",
];

// Filters the material list down to what's actually relevant for the
// accessory's subcategory, same pattern as makeupTypeOptionsForSubcategory:
// nobody needs to see "Cashmere" as an option for a metal watch, or
// "Gold-Tone" for a canvas tote. Falls back to the full list if no
// subcategory is set yet, rather than hiding the row.
export function accessoryMaterialOptionsForSubcategory(subcategory: string): string[] {
  const normalized = subcategory.toLowerCase();
  if (normalized.includes("bag")) {
    return ["Leather", "Faux Leather", "Canvas", "Suede", "Fabric", "Straw", "Wood", "Metal"];
  }
  if (normalized.includes("jewelry")) {
    return ["Metal", "Gold-Tone", "Silver-Tone", "Beaded", "Pearl", "Wood"];
  }
  if (normalized.includes("belt")) {
    return ["Leather", "Faux Leather", "Fabric", "Metal"];
  }
  if (normalized.includes("scarf")) {
    return ["Silk", "Wool", "Cashmere", "Fabric"];
  }
  if (normalized.includes("hat")) {
    return ["Straw", "Fabric", "Wool", "Leather"];
  }
  if (normalized.includes("sunglasses")) {
    return ["Metal", "Acetate", "Plastic", "Wood"];
  }
  return ACCESSORY_MATERIAL_OPTIONS;
}

// Shown only when the accessory subcategory is jewelry, since these
// don't apply to bags, belts, scarves, hats, or sunglasses.
export const JEWELRY_TYPE_OPTIONS = [
  "Earrings",
  "Necklace",
  "Choker",
  "Bracelet",
  "Bangle",
  "Ring",
  "Anklet",
  "Brooch",
  "Body Chain",
  "Hair Jewelry",
];

// Shown only when the accessory subcategory is a hat, since these
// don't apply to bags, jewelry, belts, scarves, or sunglasses.
export const HAT_TYPE_OPTIONS = [
  "Baseball Cap",
  "Beanie",
  "Bucket Hat",
  "Fedora",
  "Wide Brim",
  "Sun Hat",
  "Beret",
  "Newsboy Cap",
  "Visor",
  "Cowboy Hat",
  "Panama Hat",
];

// Makeup-specific quick-picks. Unlike clothing, makeup shades aren't
// meaningfully described by the universal COLOR_OPTIONS vocabulary
// (nobody shops for a lipstick in "Emerald" or a foundation in "Navy"),
// so makeup gets its own Type + Shade system instead of the generic
// Color row. Shade options depend on which type is picked: complexion
// products use undertone/depth language, lip and cheek products use
// color-family language, eye products use their own palette, and some
// types (like Setting Spray) have no meaningful shade at all.
export const MAKEUP_TYPE_OPTIONS = [
  "Foundation",
  "Concealer",
  "Powder",
  "Blush",
  "Bronzer",
  "Highlighter",
  "Eyeshadow",
  "Eyeliner",
  "Mascara",
  "Brow",
  "Lipstick",
  "Lip Gloss",
  "Lip Liner",
  "Setting Spray",
];

const MAKEUP_COMPLEXION_SHADES = [
  "Fair",
  "Light",
  "Light-Medium",
  "Medium",
  "Tan",
  "Deep",
  "Cool Undertone",
  "Warm Undertone",
  "Neutral Undertone",
  "Olive Undertone",
];

const MAKEUP_LIP_CHEEK_SHADES = [
  "Nude",
  "Pink",
  "Rose",
  "Mauve",
  "Coral",
  "Red",
  "Berry",
  "Brown",
  "Plum",
];

const MAKEUP_EYE_SHADES = [
  "Black",
  "Brown",
  "Taupe",
  "Bronze",
  "Gold",
  "Copper",
  "Navy",
  "Plum",
  "Green",
];

// Maps the makeup subcategory (face/eyes/lips/cheeks) to the relevant
// subset of MAKEUP_TYPE_OPTIONS, same pattern as jewelry/hat type only
// showing once that subcategory is picked. If no subcategory is set
// yet, returns the full list rather than hiding the row entirely, so
// someone can still pick a type before bothering with subcategory.
export function makeupTypeOptionsForSubcategory(subcategory: string): string[] {
  const normalized = subcategory.toLowerCase();
  if (normalized.includes("face")) {
    return ["Foundation", "Concealer", "Powder", "Setting Spray"];
  }
  if (normalized.includes("eye")) {
    return ["Eyeshadow", "Eyeliner", "Mascara", "Brow"];
  }
  if (normalized.includes("lip")) {
    return ["Lipstick", "Lip Gloss", "Lip Liner"];
  }
  if (normalized.includes("cheek")) {
    return ["Blush", "Bronzer", "Highlighter"];
  }
  return MAKEUP_TYPE_OPTIONS;
}

// Maps a selected makeup type to its relevant shade list. Types with no
// meaningful shade concept (Setting Spray) map to an empty array, which
// the UI reads as "don't show a Shade row at all" rather than showing
// an empty/irrelevant one.
export function makeupShadeOptionsForType(type: string): string[] {
  const complexionTypes = ["Foundation", "Concealer", "Powder", "Bronzer", "Highlighter"];
  const lipCheekTypes = ["Blush", "Lipstick", "Lip Gloss", "Lip Liner"];
  const eyeTypes = ["Eyeshadow", "Eyeliner", "Mascara", "Brow"];

  if (complexionTypes.includes(type)) return MAKEUP_COMPLEXION_SHADES;
  if (lipCheekTypes.includes(type)) return MAKEUP_LIP_CHEEK_SHADES;
  if (eyeTypes.includes(type)) return MAKEUP_EYE_SHADES;
  return [];
}

// "Finish" (Matte/Dewy/Sheer/Full Coverage) doesn't apply to every
// makeup type, e.g. mascara or brow product don't have a meaningful
// finish in this sense, so this gates the row the same way shade is
// gated, instead of the component hardcoding the applicable list.
const MAKEUP_FINISH_TYPES = [
  "Foundation", "Concealer", "Powder", "Blush", "Bronzer",
  "Highlighter", "Eyeshadow", "Lipstick", "Lip Gloss",
];

export function makeupFinishAppliesToTypes(types: string[]): boolean {
  return types.some((t) => MAKEUP_FINISH_TYPES.includes(t));
}

export const MAKEUP_FINISH_OPTIONS = [
  "Matte",
  "Satin",
  "Dewy",
  "Shimmer",
  "Sheer",
  "Full Coverage",
];

// Universal pattern quick-picks, shown alongside Color across the same
// categories (bottoms, tops/dresses/sets, outerwear, shoes,
// accessories). "Solid" is listed first since it's the most common
// case and worth a one-tap answer rather than implying every item
// must have a pattern.
export const PATTERN_OPTIONS = [
  "Solid",
  "Striped",
  "Plaid",
  "Gingham",
  "Houndstooth",
  "Herringbone",
  "Argyle",
  "Polka Dot",
  "Floral",
  "Paisley",
  "Animal Print",
  "Camo",
  "Tie-Dye",
  "Geometric",
  "Color Block",
  "Checkered",
];

// Curated color quick-picks, universal across categories. Deliberately
// the same vocabulary as the gold/silver jewelry-pairing lists in
// lib/stylingAdvice.ts (not a coincidence): picking "Emerald" or "Blush"
// here writes it into tags.color, which jewelryToneRecommendation
// already scans for keywords, so the jewelry-tone tip improves for free.
export const COLOR_OPTIONS = [
  "Black",
  "White",
  "Gray",
  "Charcoal",
  "Ivory",
  "Cream",
  "Beige",
  "Tan",
  "Camel",
  "Caramel",
  "Chocolate",
  "Brown",
  "Rust",
  "Mustard",
  "Yellow",
  "Peach",
  "Coral",
  "Orange",
  "Terracotta",
  "Ruby",
  "Red",
  "Maroon",
  "Burgundy",
  "Blush",
  "Pink",
  "Rose",
  "Fuchsia",
  "Magenta",
  "Plum",
  "Purple",
  "Lavender",
  "Lilac",
  "Violet",
  "Sky Blue",
  "Cerulean",
  "Blue",
  "Denim",
  "Denim Blue",
  "Navy",
  "Teal",
  "Emerald",
  "Green",
  "Olive",
  "Khaki",
  "Forest",
  "Mint",
  "Gold",
  "Silver",
  "Multicolor",
];

export interface ClosetItem {
  id: string;
  category: ItemCategory;
  subcategory?: string; // free-form, see SUBCATEGORY_SUGGESTIONS for hints
  image: string; // base64 data URL, front of the item
  backImage?: string; // base64 data URL, optional back-of-item photo
  name: string; // AI-generated descriptive name
  tags: Record<string, string>; // e.g. { color: "cream", material: "linen" }
  laundryStatus: "clean" | "dirty" | "dry-clean";
  timesWorn: number;
  wearHistory?: string[]; // ISO date strings (YYYY-MM-DD), logged going forward; timesWorn is the source of truth for the count shown in the UI, this is a supplementary date log
  pinned?: boolean;
  closetStatus?: "keep" | "donate" | "sell" | "repair" | "store";
  notes?: string;
  createdAt: number;
}

export type HairMode = "selfie" | "wig" | "description";

export interface HairProfile {
  mode: HairMode;
  image?: string;
  description?: string;
  tags?: Record<string, string>;
  name?: string;
  updatedAt: number;
}

export interface WigItem {
  id: string;
  image: string;
  name: string;
  tags: Record<string, string>;
  createdAt: number;
}

export interface WishlistItem {
  id: string;
  image: string;
  name: string;
  tags: Record<string, string>;
  category: ItemCategory;
  subcategory?: string;
  sourceUrl?: string;
  analysis?: {
    verdict: string;
    matchCount: number;
    fillsGap: boolean;
    pairsWith: string[];
    completesOutfits?: number;
    replacesItem?: string | null;
    versatilityNote?: string;
  };
  addedAt: number;
}

export interface Trip {
  id: string;
  description: string;
  packingList: string[];
  outfits: { label: string; itemIds: string[] }[];
  gaps: string[];
  capsuleSize?: number;
  totalOutfitsPossible?: number;
  createdAt: number;
}

export interface StyleInspiration {
  id: string;
  image: string;
  keywords: string[];
  createdAt: number;
}

export interface StyleProfile {
  description?: string;
  userName?: string;
  updatedAt: number;
}

export interface ColorProfile {
  undertone: string;
  contrast: string;
  season: string;
  bestColors: string[];
  avoidColors: string[];
  updatedAt: number;
}

// All fields are free-form strings rather than rigid numeric fields with
// enforced units, since people express these differently (e.g. "5'6"
// vs "168 cm", "34D" vs "36C") and this is a stylist app, not a fitness
// tracker; forcing a unit system would just add friction for no benefit
// to how this data is actually used (AI reasoning context, not math).
export interface UserMeasurements {
  height?: string;
  weight?: string;
  braSize?: string;
  topSize?: string;
  bottomSize?: string;
  dressSize?: string;
  setSize?: string;
  shoeSize?: string;
  notes?: string;
  updatedAt: number;
}

export interface AppSettings {
  // When false, adding a single item to the closet skips the automatic
  // AI tagging call entirely and saves it instantly as "Untitled item".
  // AI only runs when explicitly requested afterward (the individual
  // "Retag with AI" button, or the closet's bulk "Retag now" banner),
  // so importing many items in a row doesn't burn through Groq's rate
  // limit just from the act of adding them. Defaults to true (existing
  // behavior) so nothing changes unless someone turns it off.
  autoTagOnUpload?: boolean;
}

export interface UpcomingPlan {
  id: string;
  title: string;
  date?: string;
  prompt: string;
  createdAt: number;
}

export interface GeneratedLook {
  id: string;
  prompt: string;
  itemIds: string[];
  hairstyle: string;
  makeup: string;
  reasoning: string;
  scores: Record<string, number>;
  favorite: boolean;
  collection?: string;
  createdAt: number;
}
