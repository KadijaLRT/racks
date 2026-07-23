// Builds outfit variations around one fixed "anchor" item, entirely
// locally, zero AI, zero network call. This is a clean fit for a local
// fallback: unlike Looks (which needs to interpret an occasion/mood in
// free text), Remix has no language input at all, it's purely
// combinatorial (anchor item + rest of closet), which local weighted
// selection handles just as well as asking a model to.

import type { ClosetItem } from "./types";
import { weightedPick } from "./localLookBuilder";

export interface LocalRemixOutfit {
  label: string;
  itemIds: string[];
  reasoning: string;
}

function pickExcluding(
  candidates: ClosetItem[],
  excludeIds: Set<string>
): ClosetItem | null {
  const pool = candidates.filter((c) => !excludeIds.has(c.id));
  return weightedPick(pool.length > 0 ? pool : candidates);
}

export function buildLocalRemix(
  anchorItem: ClosetItem,
  items: ClosetItem[]
): LocalRemixOutfit[] {
  const rest = (items || []).filter(
    (i) => i?.id !== anchorItem.id && i?.laundryStatus === "clean" && i?.category !== "makeup"
  );

  const byCategory = (cat: string) => rest.filter((i) => i?.category === cat);
  const tops = byCategory("top");
  const bottoms = byCategory("bottom");
  const dresses = byCategory("dress");
  const sets = byCategory("set");
  const shoes = byCategory("shoes");
  const outerwear = byCategory("outerwear");
  const accessories = byCategory("accessory");

  const anchorIsBase = ["top", "bottom", "dress", "set"].includes(anchorItem.category);
  const anchorIsShoes = anchorItem.category === "shoes";

  const variations: LocalRemixOutfit[] = [];
  const usedNonAnchor = new Set<string>();

  const labels = ["Everyday", "Dressed up", "Another way to wear it"];

  for (let v = 0; v < 3; v++) {
    const picked: ClosetItem[] = [anchorItem];

    // Fill in whatever base pieces the anchor doesn't already cover.
    if (anchorItem.category === "top") {
      const bottom = pickExcluding(bottoms, v === 2 ? usedNonAnchor : new Set());
      if (bottom) picked.push(bottom);
    } else if (anchorItem.category === "bottom") {
      const top = pickExcluding(tops, v === 2 ? usedNonAnchor : new Set());
      if (top) picked.push(top);
    } else if (!anchorIsBase && !anchorIsShoes) {
      // Anchor is outerwear/accessory: needs a full base underneath.
      const base =
        dresses.length > 0 || sets.length > 0
          ? pickExcluding([...dresses, ...sets], v === 2 ? usedNonAnchor : new Set())
          : null;
      if (base) {
        picked.push(base);
      } else {
        const top = pickExcluding(tops, v === 2 ? usedNonAnchor : new Set());
        const bottom = pickExcluding(bottoms, v === 2 ? usedNonAnchor : new Set());
        if (top) picked.push(top);
        if (bottom) picked.push(bottom);
      }
    } else if (anchorIsShoes) {
      const base =
        dresses.length > 0 || sets.length > 0
          ? pickExcluding([...dresses, ...sets], v === 2 ? usedNonAnchor : new Set())
          : null;
      if (base) {
        picked.push(base);
      } else {
        const top = pickExcluding(tops, v === 2 ? usedNonAnchor : new Set());
        const bottom = pickExcluding(bottoms, v === 2 ? usedNonAnchor : new Set());
        if (top) picked.push(top);
        if (bottom) picked.push(bottom);
      }
    }

    // Shoes, unless the anchor already is shoes.
    if (!anchorIsShoes && shoes.length > 0) {
      const shoe = pickExcluding(shoes, v === 2 ? usedNonAnchor : new Set());
      if (shoe) picked.push(shoe);
    }

    // Variation 2 ("Dressed up") gets outerwear if available; variation
    // 3 gets an accessory instead, for a bit of visible difference
    // between the three rather than three near-identical outfits.
    if (v === 1 && outerwear.length > 0) {
      const jacket = weightedPick(outerwear);
      if (jacket) picked.push(jacket);
    }
    if (v === 2 && accessories.length > 0) {
      const accessory = weightedPick(accessories);
      if (accessory) picked.push(accessory);
    }

    for (const p of picked) {
      if (p.id !== anchorItem.id) usedNonAnchor.add(p.id);
    }

    variations.push({
      label: labels[v],
      itemIds: picked.map((p) => p.id),
      reasoning:
        v === 1
          ? `${anchorItem.name}, styled up a notch.`
          : v === 2
          ? `A different pairing for ${anchorItem.name}.`
          : `A simple, everyday way to wear ${anchorItem.name}.`,
    });
  }

  // De-duplicate outfits that ended up identical (small closets may not
  // have enough alternates to make all 3 genuinely different).
  const seen = new Set<string>();
  return variations.filter((v) => {
    const key = [...v.itemIds].sort().join(",");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
