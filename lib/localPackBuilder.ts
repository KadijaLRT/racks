// Builds a packing plan (outfits per day + packing list + rough gap
// notes) entirely locally, zero AI, zero network call. Unlike Looks,
// this doesn't try to interpret a free-text trip description (that
// genuinely needs language understanding to extract trip length and
// context) — it takes an explicit day count instead, then reuses the
// same weighted local-selection approach as the Looks/Remix local
// builders to assemble a day-by-day outfit plan.

import type { ClosetItem } from "./types";
import { weightedPick, estimateFormality } from "./localLookBuilder";
import { colorsOf, isColorCompatibleWithAll } from "./colorCompatibility";

export interface LocalPackingPlan {
  packingList: string[];
  outfits: { label: string; itemIds: string[] }[];
  gaps: string[];
  capsuleSize: number;
  totalOutfitsPossible: number;
}

export function buildLocalPackingPlan(
  items: ClosetItem[],
  days: number
): LocalPackingPlan | null {
  const wearable = (items || []).filter(
    (i) => i?.laundryStatus === "clean" && i?.closetStatus !== "store"
  );
  const byCategory = (cat: string) => wearable.filter((i) => i?.category === cat);

  const dresses = byCategory("dress");
  const sets = byCategory("set");
  const tops = byCategory("top");
  const bottoms = byCategory("bottom");
  const shoes = byCategory("shoes");
  const outerwear = byCategory("outerwear");
  const accessories = byCategory("accessory");

  if (shoes.length === 0) return null;
  if (dresses.length === 0 && sets.length === 0 && (tops.length === 0 || bottoms.length === 0)) {
    return null;
  }

  const usedIds = new Set<string>();
  const outfits: { label: string; itemIds: string[] }[] = [];
  const dayCount = Math.max(1, Math.min(days || 1, 14));

  for (let d = 0; d < dayCount; d++) {
    const picked: ClosetItem[] = [];
    let establishedColors: string[] = [];
    const addPick = (item: ClosetItem | null) => {
      if (!item) return;
      picked.push(item);
      establishedColors = [...establishedColors, ...colorsOf(item.tags?.color)];
    };

    const pickBase = () => {
      const baseOptions: { type: "dress" | "set" | "top+bottom"; count: number }[] = [
        { type: "dress" as const, count: dresses.length },
        { type: "set" as const, count: sets.length },
        {
          type: "top+bottom" as const,
          count: tops.length > 0 && bottoms.length > 0 ? Math.min(tops.length, bottoms.length) : 0,
        },
      ].filter((o) => o.count > 0);
      if (baseOptions.length === 0) return;
      const chosen = baseOptions[Math.floor(Math.random() * baseOptions.length)].type;
      if (chosen === "dress") {
        addPick(weightedPick(dresses));
      } else if (chosen === "set") {
        addPick(weightedPick(sets));
      } else {
        const bottom = weightedPick(bottoms);
        addPick(bottom);
        const compatibleTops = tops.filter((t) =>
          isColorCompatibleWithAll(colorsOf(t.tags?.color), establishedColors)
        );
        addPick(weightedPick(compatibleTops.length > 0 ? compatibleTops : tops));
      }
    };
    pickBase();

    // Whatever the base's formality turns out to be, keep shoes and
    // any add-ons within one level of it rather than picking them
    // independently at random, otherwise a loungewear base can end up
    // paired with dressy heels for no reason connected to the outfit.
    const baseFormality =
      picked.length > 0
        ? Math.round(picked.reduce((sum, p) => sum + estimateFormality(p), 0) / picked.length)
        : 2;
    const band = { min: Math.max(1, baseFormality - 1), max: Math.min(5, baseFormality + 1) };
    const inBand = (pool: ClosetItem[]) => {
      const filtered = pool.filter((i) => {
        const f = estimateFormality(i);
        return f >= band.min && f <= band.max;
      });
      return filtered.length > 0 ? filtered : pool;
    };
    const colorMatch = (pool: ClosetItem[]) => {
      const filtered = pool.filter((i) =>
        isColorCompatibleWithAll(colorsOf(i.tags?.color), establishedColors)
      );
      return filtered.length > 0 ? filtered : pool;
    };

    addPick(weightedPick(colorMatch(inBand(shoes))));

    if (band.max > 1 && outerwear.length > 0 && Math.random() < 0.4) {
      addPick(weightedPick(colorMatch(inBand(outerwear))));
    }
    if (accessories.length > 0 && Math.random() < 0.6) {
      addPick(weightedPick(colorMatch(accessories)));
    }

    if (picked.length === 0) continue;
    for (const p of picked) usedIds.add(p.id);
    outfits.push({
      label: dayCount === 1 ? "Your outfit" : `Day ${d + 1}`,
      itemIds: picked.map((p) => p.id),
    });
  }

  if (outfits.length === 0) return null;

  const usedItems = wearable.filter((i) => usedIds.has(i.id));
  const countsByCategory: Record<string, number> = {};
  for (const item of usedItems) {
    const cat = item?.category || "unknown";
    countsByCategory[cat] = (countsByCategory[cat] || 0) + 1;
  }
  const CATEGORY_LABELS: Record<string, string> = {
    top: "top",
    bottom: "bottom",
    dress: "dress",
    set: "set",
    outerwear: "outerwear piece",
    shoes: "pair of shoes",
    accessory: "accessory",
  };
  const packingList = Object.entries(countsByCategory).map(
    ([cat, count]) =>
      `${count} ${CATEGORY_LABELS[cat] || cat}${count === 1 ? "" : "s"}`
  );

  const gaps: string[] = [];
  if (outerwear.length === 0) {
    gaps.push("No outerwear catalogued, worth checking the weather before you go.");
  }
  if (shoes.length === 1) {
    gaps.push("Only one pair of shoes catalogued as clean, consider a backup pair.");
  }

  // Rough combinatorial estimate for the capsule actually packed, not
  // the whole closet: (bases available) × (shoe options), capped to
  // something sane for small numbers.
  const baseCount =
    usedItems.filter((i) => i.category === "dress" || i.category === "set").length +
    Math.min(
      usedItems.filter((i) => i.category === "top").length,
      usedItems.filter((i) => i.category === "bottom").length
    );
  const shoeCount = usedItems.filter((i) => i.category === "shoes").length;
  const totalOutfitsPossible = Math.max(outfits.length, baseCount * Math.max(shoeCount, 1));

  return {
    packingList,
    outfits,
    gaps,
    capsuleSize: usedItems.length,
    totalOutfitsPossible,
  };
}
