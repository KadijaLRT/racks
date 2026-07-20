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
  bottom: ["jeans", "trousers", "shorts", "skirt", "leggings"],
  dress: ["mini", "midi", "maxi", "gown"],
  set: ["matching set", "jumpsuit", "romper"],
  outerwear: ["jacket", "coat", "blazer", "cardigan", "vest"],
  shoes: ["sneakers", "heels", "boots", "flats", "sandals"],
  accessory: ["bag", "jewelry", "belt", "scarf", "hat", "sunglasses"],
  makeup: ["face", "eyes", "lips", "cheeks"],
};

export interface ClosetItem {
  id: string;
  category: ItemCategory;
  subcategory?: string; // free-form, see SUBCATEGORY_SUGGESTIONS for hints
  image: string; // base64 data URL
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
