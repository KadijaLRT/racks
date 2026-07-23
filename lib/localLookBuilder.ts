// Builds an outfit entirely from local closet data, with zero AI
// involvement and zero network calls. This exists as a fallback for
// when Groq is rate-limited, unreliable, or just not something someone
// wants to depend on for a core feature: it applies the same basic
// stylist logic (favor neglected pieces, respect pinned favorites,
// require a coherent category combo) as pure local selection instead
// of asking a model to do it.

import type { ClosetItem } from "./types";

export interface LocalLookResult {
  itemIds: string[];
  reasoning: string;
}

export function weightedPick<T extends { timesWorn?: number; pinned?: boolean }>(
  candidates: T[]
): T | null {
  if (candidates.length === 0) return null;
  // Inverse-weight by wear count so neglected pieces (worn 0-1x) come
  // up more often than the same five most-worn favorites every time,
  // with a modest boost for pinned items, same spirit as the AI prompt
  // ("favor reviving a neglected piece... pinned favorites get modest
  // extra weight"), just computed directly instead of asked for.
  const weights = candidates.map((c) => {
    const worn = c.timesWorn ?? 0;
    const base = 1 / (worn + 1);
    return c.pinned ? base * 1.5 : base;
  });
  const total = weights.reduce((sum, w) => sum + w, 0);
  let roll = Math.random() * total;
  for (let i = 0; i < candidates.length; i++) {
    roll -= weights[i];
    if (roll <= 0) return candidates[i];
  }
  return candidates[candidates.length - 1];
}

export function buildLocalLook(items: ClosetItem[]): LocalLookResult | null {
  const wearable = (items || []).filter(
    (i) => i?.laundryStatus === "clean" && i?.category !== "makeup"
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

  // Prefer whichever base type has the most options, so a closet with
  // 20 tops and 1 dress doesn't always default to the same single
  // dress just because dresses are checked first.
  const baseOptions: { type: "dress" | "set" | "top+bottom"; count: number }[] = [
    { type: "dress" as const, count: dresses.length },
    { type: "set" as const, count: sets.length },
    {
      type: "top+bottom" as const,
      count: tops.length > 0 && bottoms.length > 0 ? Math.min(tops.length, bottoms.length) : 0,
    },
  ].filter((o) => o.count > 0);

  if (baseOptions.length === 0) return null;
  const chosenBase = baseOptions[Math.floor(Math.random() * baseOptions.length)].type;

  const picked: ClosetItem[] = [];
  const descriptionParts: string[] = [];

  if (chosenBase === "dress") {
    const dress = weightedPick(dresses);
    if (dress) {
      picked.push(dress);
      descriptionParts.push(dress.name);
    }
  } else if (chosenBase === "set") {
    const set = weightedPick(sets);
    if (set) {
      picked.push(set);
      descriptionParts.push(set.name);
    }
  } else {
    const top = weightedPick(tops);
    const bottom = weightedPick(bottoms);
    if (top) {
      picked.push(top);
      descriptionParts.push(top.name);
    }
    if (bottom) {
      picked.push(bottom);
      descriptionParts.push(bottom.name);
    }
  }

  const shoe = weightedPick(shoes);
  if (shoe) {
    picked.push(shoe);
    descriptionParts.push(shoe.name);
  }

  // Outerwear: include about a third of the time when available, a
  // coin flip would make it feel too random/present every other look.
  if (outerwear.length > 0 && Math.random() < 0.35) {
    const jacket = weightedPick(outerwear);
    if (jacket) {
      picked.push(jacket);
      descriptionParts.push(jacket.name);
    }
  }

  // 0-2 accessories, weighted toward 1.
  if (accessories.length > 0) {
    const accessoryCount = Math.random() < 0.15 ? 0 : Math.random() < 0.75 ? 1 : 2;
    const pool = [...accessories];
    for (let i = 0; i < accessoryCount && pool.length > 0; i++) {
      const chosen = weightedPick(pool);
      if (!chosen) break;
      picked.push(chosen);
      descriptionParts.push(chosen.name);
      const idx = pool.findIndex((p) => p.id === chosen.id);
      if (idx >= 0) pool.splice(idx, 1);
    }
  }

  if (picked.length === 0) return null;

  const neglectedPiece = picked.find((p) => (p.timesWorn ?? 0) <= 1);
  const reasoning = neglectedPiece
    ? `A pairing of ${descriptionParts.join(", ")}, put together to give your "${neglectedPiece.name}" some wear since it hasn't been out much.`
    : `A pairing of ${descriptionParts.join(", ")}, picked from your closet.`;

  return {
    itemIds: picked.map((p) => p.id),
    reasoning,
  };
}
