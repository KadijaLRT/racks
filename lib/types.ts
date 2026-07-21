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
  top: ["t-shirt", "blouse", "tank", "sweater", "button-down", "crop top"],
  bottom: ["jeans", "trousers", "shorts", "skirt", "leggings", "skort"],
  dress: ["mini", "midi", "maxi", "gown"],
  set: ["matching set", "jumpsuit", "romper", "bathing suit"],
  outerwear: ["jacket", "coat", "blazer", "cardigan", "vest"],
  shoes: ["sneakers", "heels", "boots", "flats", "sandals"],
  accessory: ["bag", "jewelry", "belt", "scarf", "hat", "sunglasses"],
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
];

export const TOP_SILHOUETTE_OPTIONS = [
  "Crop Top",
  "Peplum",
  "Wrap",
  "Asymmetrical Hem",
  "Handkerchief Hem",
  "Hi-Low",
  "Boxy / Oversized",
  "Corset / Bustier",
  "Camisole",
  "Tube / Strapless",
  "Smocked / Shirred",
  "Bodysuit",
];

export const SLEEVE_OPTIONS = [
  "Cap Sleeve",
  "Dolman",
  "Raglan",
  "Kimono Sleeve",
  "Puff / Juliet",
  "Bishop",
  "Bell Sleeve",
  "Butterfly",
  "Cold-Shoulder",
];

export const BACK_STYLE_OPTIONS = [
  "Racerback",
  "Backless / Open-Back",
  "Keyhole Back",
  "Side Cut-Out",
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
  shoeSize?: string;
  notes?: string;
  updatedAt: number;
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
