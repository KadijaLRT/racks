// Builds outfit variations around one fixed "anchor" item, entirely
// locally, zero AI, zero network call. Every non-anchor candidate is
// constrained to a formality band relative to the anchor's own
// formality (estimated the same way Looks does it), so remixing a
// sweatsuit can no longer surface heels or a blazer just because they
// were under-worn — "Dressed up" nudges the band up a notch instead of
// ignoring formality entirely.

import type { ClosetItem } from "./types";
import { weightedPick, estimateFormality } from "./localLookBuilder";

export interface LocalRemixOutfit {
  label: string;
  itemIds: string[];
  reasoning: string;
}

function pickExcluding(
  candidates: ClosetItem[],
  excludeIds: Set<string>,
  band: { min: number; max: number }
): ClosetItem | null {
  const pool = candidates.filter((c) => !excludeIds.has(c.id));
  const base = pool.length > 0 ? pool : candidates;
  const inBand = base.filter((c) => {
    const f = estimateFormality(c);
    return f >= band.min && f <= band.max;
  });
  if (inBand.length > 0) return weightedPick(inBand);
  // Graceful fallback: closest formality to the band rather than
  // nothing, so a very small closet still produces an outfit.
  const sorted = [...base].sort(
    (a, b) =>
      Math.abs(estimateFormality(a) - (band.min + band.max) / 2) -
      Math.abs(estimateFormality(b) - (band.min + band.max) / 2)
  );
  return weightedPick(sorted.slice(0, Math.max(1, Math.ceil(sorted.length / 2))));
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
  const anchorFormality = estimateFormality(anchorItem);

  const variations: LocalRemixOutfit[] = [];
  const usedNonAnchor = new Set<string>();

  const labels = ["Everyday", "Dressed up", "Another way to wear it"];

  for (let v = 0; v < 3; v++) {
    // "Dressed up" deliberately shifts the band up rather than
    // ignoring formality: the anchor's own level is a floor, not
    // something that can be styled down here.
    const band =
      v === 1
        ? { min: anchorFormality, max: Math.min(5, anchorFormality + 2) }
        : { min: Math.max(1, anchorFormality - 1), max: Math.min(5, anchorFormality + 1) };

    const picked: ClosetItem[] = [anchorItem];

    if (anchorItem.category === "top") {
      const bottom = pickExcluding(bottoms, v === 2 ? usedNonAnchor : new Set(), band);
      if (bottom) picked.push(bottom);
    } else if (anchorItem.category === "bottom") {
      const top = pickExcluding(tops, v === 2 ? usedNonAnchor : new Set(), band);
      if (top) picked.push(top);
    } else if (!anchorIsBase && !anchorIsShoes) {
      const base =
        dresses.length > 0 || sets.length > 0
          ? pickExcluding([...dresses, ...sets], v === 2 ? usedNonAnchor : new Set(), band)
          : null;
      if (base) {
        picked.push(base);
      } else {
        const top = pickExcluding(tops, v === 2 ? usedNonAnchor : new Set(), band);
        const bottom = pickExcluding(bottoms, v === 2 ? usedNonAnchor : new Set(), band);
        if (top) picked.push(top);
        if (bottom) picked.push(bottom);
      }
    } else if (anchorIsShoes) {
      const base =
        dresses.length > 0 || sets.length > 0
          ? pickExcluding([...dresses, ...sets], v === 2 ? usedNonAnchor : new Set(), band)
          : null;
      if (base) {
        picked.push(base);
      } else {
        const top = pickExcluding(tops, v === 2 ? usedNonAnchor : new Set(), band);
        const bottom = pickExcluding(bottoms, v === 2 ? usedNonAnchor : new Set(), band);
        if (top) picked.push(top);
        if (bottom) picked.push(bottom);
      }
    }

    if (!anchorIsShoes && shoes.length > 0) {
      const shoe = pickExcluding(shoes, v === 2 ? usedNonAnchor : new Set(), band);
      if (shoe) picked.push(shoe);
    }

    if (v === 1 && outerwear.length > 0) {
      const inBand = outerwear.filter((o) => {
        const f = estimateFormality(o);
        return f >= band.min && f <= band.max;
      });
      const jacket = weightedPick(inBand.length > 0 ? inBand : outerwear);
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
          ? `A different pairing for ${anchorItem.name}, kept to a similar formality.`
          : `A simple, everyday way to wear ${anchorItem.name}.`,
    });
  }

  const seen = new Set<string>();
  return variations.filter((v) => {
    const key = [...v.itemIds].sort().join(",");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
