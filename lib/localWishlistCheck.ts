// Checks whether a wishlist item duplicates something already owned,
// entirely locally, zero AI, zero network call. Flags "you already
// own N similar items" using real, checkable signals (same category,
// same or close subcategory, compatible color) rather than a model's
// judgment call — a defensible rule, not a nuanced style opinion, but
// exactly the kind of thing that doesn't need a vision-language model
// to answer correctly.

import type { ClosetItem, WishlistItem } from "./types";
import { colorsOf, colorsCompatible } from "./colorCompatibility";

export interface LocalWishlistAnalysis {
  verdict: string;
  matchCount: number;
  fillsGap: boolean;
  pairsWith: string[];
  versatilityNote?: string;
}

export function checkWishlistItemLocally(
  newItem: Pick<WishlistItem, "name" | "category" | "subcategory" | "tags">,
  closetItems: ClosetItem[]
): LocalWishlistAnalysis {
  const newColors = colorsOf(newItem.tags?.color);
  const newSubcategory = (newItem.subcategory || "").trim().toLowerCase();

  const similar = (closetItems || []).filter((i) => {
    if (i.category !== newItem.category) return false;
    const sameSubcategory =
      newSubcategory && (i.subcategory || "").trim().toLowerCase() === newSubcategory;
    const itemColors = colorsOf(i.tags?.color);
    const colorOverlap =
      newColors.length === 0 ||
      itemColors.length === 0 ||
      newColors.some((nc) => itemColors.some((ic) => colorsCompatible(nc, ic)));
    // Require category to always match, plus at least one of
    // subcategory or color to line up, so "black sweater" doesn't
    // get flagged against every black item regardless of type, or
    // every sweater regardless of color.
    return sameSubcategory || colorOverlap;
  });

  const matchCount = similar.length;
  const fillsGap = matchCount === 0;

  // What it could pair with: same-category items are the ones it
  // would compete with, not complement, so "pairs with" pulls from
  // adjacent categories that are color-compatible instead.
  const complementaryCategories: Record<string, string[]> = {
    top: ["bottom", "outerwear"],
    bottom: ["top", "outerwear"],
    dress: ["outerwear", "shoes", "accessory"],
    set: ["outerwear", "shoes", "accessory"],
    outerwear: ["top", "bottom", "dress"],
    shoes: ["top", "bottom", "dress"],
    accessory: ["top", "bottom", "dress"],
    swimwear: ["accessory", "outerwear"],
  };
  const pairCategories = complementaryCategories[newItem.category] || [];
  const pairsWith = (closetItems || [])
    .filter((i) => {
      if (!pairCategories.includes(i.category)) return false;
      const itemColors = colorsOf(i.tags?.color);
      return (
        newColors.length === 0 ||
        itemColors.length === 0 ||
        newColors.some((nc) => itemColors.some((ic) => colorsCompatible(nc, ic)))
      );
    })
    .slice(0, 4)
    .map((i) => i.name);

  let verdict: string;
  if (matchCount >= 3) {
    verdict = `You already own ${matchCount} similar items in this category and color. This might be a close duplicate rather than a genuine addition.`;
  } else if (matchCount > 0) {
    verdict = `You own ${matchCount} similar item${matchCount === 1 ? "" : "s"} already, but this could still round things out depending on the details.`;
  } else {
    verdict = "Nothing quite like this in your closet yet, looks like a genuine addition.";
  }

  return {
    verdict,
    matchCount,
    fillsGap,
    pairsWith,
    versatilityNote:
      pairsWith.length > 0
        ? `Could pair with ${pairsWith.length} item${pairsWith.length === 1 ? "" : "s"} you already own.`
        : undefined,
  };
}
