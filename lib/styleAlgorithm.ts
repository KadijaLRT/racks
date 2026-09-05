// The Master Style Algorithm: exposure balance, volume balance, a
// non-neutral color cap, a minimum texture count, and a max-2-
// aesthetics rule, layered on top of (not replacing) the existing
// formality/season/color-wheel system already driving local outfit
// generation. Every rule here has an explicit tag as the primary
// source of truth, with a keyword-based inference fallback, so this
// works immediately on the hundreds of items someone already has
// tagged without exposure/volume/aesthetic set, rather than requiring
// a full re-tag pass before any of this takes effect.

import type { ClosetItem } from "./types";

function textOf(item: ClosetItem): string {
  return [item?.subcategory || "", item?.name || "", ...Object.values(item?.tags || {})]
    .join(" ")
    .toLowerCase();
}

// --- Exposure Level ---------------------------------------------------

const HIGH_SKIN_KEYWORDS = [
  "crop top", "crop", "mini", "backless", "cutout", "cut-out", "halter",
  "tube top", "bralette", "bikini", "off-shoulder", "plunging", "corset",
  "bodysuit", "short shorts",
];
const LOW_SKIN_KEYWORDS = [
  "turtleneck", "long sleeve", "maxi", "trouser", "pant", "coat",
  "sweater", "jean", "wide-leg", "wide leg", "full coverage",
];

export function getExposure(item: ClosetItem): "High Skin" | "Medium Skin" | "Low Skin" {
  const explicit = item?.tags?.exposure;
  if (explicit === "High Skin" || explicit === "Medium Skin" || explicit === "Low Skin") {
    return explicit;
  }
  const text = textOf(item);
  if (HIGH_SKIN_KEYWORDS.some((k) => text.includes(k))) return "High Skin";
  if (LOW_SKIN_KEYWORDS.some((k) => text.includes(k))) return "Low Skin";
  return "Medium Skin";
}

// --- Fit / Volume -------------------------------------------------------

const OVERSIZED_KEYWORDS = ["oversized", "wide-leg", "wide leg", "baggy", "relaxed fit", "boyfriend"];
const FITTED_KEYWORDS = ["fitted", "bodycon", "skinny", "slim", "cropped", "corset", "bandage"];

export function getVolume(item: ClosetItem): "Fitted" | "Relaxed" | "Oversized" | "Cropped" {
  const explicit = item?.tags?.volume;
  if (explicit === "Fitted" || explicit === "Relaxed" || explicit === "Oversized" || explicit === "Cropped") {
    return explicit;
  }
  const text = textOf(item);
  if (OVERSIZED_KEYWORDS.some((k) => text.includes(k))) return "Oversized";
  if (FITTED_KEYWORDS.some((k) => text.includes(k))) return "Fitted";
  return "Relaxed";
}

// --- Aesthetic ------------------------------------------------------------

export function getAesthetics(item: ClosetItem): string[] {
  const raw = item?.tags?.aesthetic;
  if (!raw) return [];
  return raw.split(",").map((a) => a.trim()).filter(Boolean);
}

/**
 * True if adding `candidate` to a look that's already established
 * `establishedAesthetics` would keep the outfit within 2 total
 * distinct aesthetics. An item with no aesthetic tag at all is always
 * allowed (nothing to conflict with, rather than excluding untagged
 * items outright), and the very first pick always passes since there's
 * nothing established yet to exceed.
 */
export function fitsAestheticBudget(
  candidateAesthetics: string[],
  establishedAesthetics: string[]
): boolean {
  if (candidateAesthetics.length === 0 || establishedAesthetics.length === 0) return true;
  const combined = new Set([...establishedAesthetics, ...candidateAesthetics]);
  return combined.size <= 2;
}

// --- Color count (reuses the neutral list already used for color-wheel matching) ---

const NEUTRALS = new Set([
  "black", "white", "gray", "charcoal", "ivory", "cream", "beige",
  "tan", "camel", "brown", "chocolate", "denim", "denim blue", "navy",
  "khaki", "gold", "silver",
]);

export function isNeutralColor(color: string): boolean {
  return NEUTRALS.has(color.toLowerCase().trim());
}

export function countNonNeutralColors(colors: string[]): number {
  const distinct = new Set(
    colors.map((c) => c.toLowerCase().trim()).filter((c) => c && !NEUTRALS.has(c))
  );
  return distinct.size;
}

// --- Texture / fabric count -----------------------------------------------

export function countDistinctFabrics(items: ClosetItem[]): number {
  const distinct = new Set(
    items
      .map((i) => (i?.tags?.fabric || "").toLowerCase().trim())
      .filter(Boolean)
  );
  return distinct.size;
}
