// Builds an outfit entirely from local closet data, with zero AI
// involvement and zero network calls. Unlike a pure random pick, this
// actually respects formality/occasion: every candidate item is scored
// on a 1 (loungewear) to 5 (formal) scale from its category,
// subcategory, and tags, an occasion phrase (if given) is mapped to a
// target formality range via keyword matching, and every piece in the
// final outfit is constrained to a narrow formality band around that
// target — so a sweatsuit (level 1) can no longer end up paired with
// heels (level 4-5) just because both happened to be under-worn.

import type { ClosetItem } from "./types";

export interface LocalLookResult {
  itemIds: string[];
  reasoning: string;
}

export function weightedPick<T extends { timesWorn?: number; pinned?: boolean }>(
  candidates: T[]
): T | null {
  if (candidates.length === 0) return null;
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

// --- Formality scoring ---------------------------------------------

// 1 = athleisure/loungewear, 2 = casual, 3 = smart casual,
// 4 = business/elevated, 5 = formal/dressy.
const FORMALITY_KEYWORDS: { level: number; keywords: string[] }[] = [
  {
    level: 1,
    keywords: [
      "sweatsuit", "tracksuit", "loungewear", "hoodie", "sweatshirt",
      "sweatpants", "pajama", "robe", "slides", "house slipper",
    ],
  },
  {
    level: 2,
    keywords: [
      "t-shirt", "tee", "tank", "jeans", "denim", "shorts", "sneaker",
      "flip-flop", "graphic", "cargo", "bralette", "camisole",
    ],
  },
  {
    level: 3,
    keywords: [
      "blouse", "sweater", "cardigan", "midi", "flats", "loafer",
      "chino", "polo", "henley", "sandal", "espadrille", "sundress",
    ],
  },
  {
    level: 4,
    keywords: [
      "blazer", "trouser", "button-down", "button down", "heel",
      "pencil skirt", "dress pant", "wrap dress", "oxford", "structured",
      "bootie", "coat",
    ],
  },
  {
    level: 5,
    keywords: [
      "gown", "cocktail", "evening", "tuxedo", "stiletto", "sequin",
      "silk", "satin", "ball gown", "formal", "tulle",
    ],
  },
];

function textOf(item: ClosetItem): string {
  return [
    item?.subcategory || "",
    item?.name || "",
    ...Object.values(item?.tags || {}),
  ]
    .join(" ")
    .toLowerCase();
}

export function estimateFormality(item: ClosetItem): number {
  const text = textOf(item);
  let best = 2; // default assumption: casual, the most common everyday case
  for (const { level, keywords } of FORMALITY_KEYWORDS) {
    if (keywords.some((k) => text.includes(k))) {
      best = level;
    }
  }
  // Category-level nudges for items with no matching keyword at all,
  // so a plain unlabeled dress doesn't default all the way down to 2.
  if (item?.category === "dress" && best === 2) best = 3;
  if (item?.category === "outerwear" && best === 2) best = 3;
  return best;
}

// --- Occasion → target formality ------------------------------------

const OCCASION_BANDS: { keywords: string[]; min: number; max: number }[] = [
  { keywords: ["gym", "workout", "run", "yoga", "hike"], min: 1, max: 1 },
  {
    keywords: [
      "coffee", "errand", "casual", "comfy", "comfortable", "lounge",
      "weekend", "grocery", "chores", "relax",
    ],
    min: 1,
    max: 2,
  },
  {
    keywords: ["brunch", "lunch", "shopping", "walk", "park", "museum"],
    min: 2,
    max: 3,
  },
  { keywords: ["work", "office", "meeting", "interview", "presentation"], min: 3, max: 4 },
  { keywords: ["date", "dinner", "drinks"], min: 3, max: 4 },
  { keywords: ["party", "night out", "club", "birthday"], min: 3, max: 5 },
  {
    keywords: ["wedding", "gala", "formal", "black tie", "cocktail party", "prom"],
    min: 4,
    max: 5,
  },
];

/**
 * Maps a free-text occasion phrase to a [min, max] formality band via
 * simple keyword matching, no NLP. If nothing matches (or no occasion
 * was given), returns null, meaning "pick any coherent band" rather
 * than a specific target.
 */
export function occasionToFormalityBand(
  occasion: string | undefined | null
): { min: number; max: number } | null {
  if (!occasion) return null;
  const text = occasion.toLowerCase();
  for (const band of OCCASION_BANDS) {
    if (band.keywords.some((k) => text.includes(k))) {
      return { min: band.min, max: band.max };
    }
  }
  return null;
}

// --- Metal-tone coordination -----------------------------------------

const GOLD_WORDS = ["gold"];
const SILVER_WORDS = ["silver", "platinum", "white gold"];

function metalToneOf(item: ClosetItem): "gold" | "silver" | null {
  const text = textOf(item);
  if (GOLD_WORDS.some((w) => text.includes(w))) return "gold";
  if (SILVER_WORDS.some((w) => text.includes(w))) return "silver";
  return null;
}

// --- Main builder -----------------------------------------------------

export function buildLocalLook(
  items: ClosetItem[],
  occasion?: string
): LocalLookResult | null {
  const wearable = (items || []).filter(
    (i) => i?.laundryStatus === "clean" && i?.category !== "makeup"
  );
  if (wearable.length === 0) return null;

  const targetBand = occasionToFormalityBand(occasion);

  // If the occasion didn't map to a known band, pick a random target
  // level weighted toward whatever's actually well-represented in the
  // closet, then build a narrow band around it. Either way, every
  // candidate pool below gets filtered to the same band, so the final
  // outfit can't mix a level-1 sweatsuit with level-4 heels just
  // because both happened to be under-worn.
  const band =
    targetBand ||
    (() => {
      const center = estimateFormality(
        wearable[Math.floor(Math.random() * wearable.length)]
      );
      return { min: Math.max(1, center - 1), max: Math.min(5, center + 1) };
    })();

  const inBand = (item: ClosetItem) => {
    const f = estimateFormality(item);
    return f >= band.min && f <= band.max;
  };

  // Falls back to the closest-formality items outside the band rather
  // than failing outright, if the strict band leaves a required
  // category empty (e.g. only one pair of shoes and it doesn't match).
  function candidatesFor(category: string): ClosetItem[] {
    const all = wearable.filter((i) => i?.category === category);
    const strict = all.filter(inBand);
    if (strict.length > 0) return strict;
    return [...all].sort(
      (a, b) =>
        Math.abs(estimateFormality(a) - (band.min + band.max) / 2) -
        Math.abs(estimateFormality(b) - (band.min + band.max) / 2)
    );
  }

  const dresses = candidatesFor("dress");
  const sets = candidatesFor("set");
  const tops = candidatesFor("top");
  const bottoms = candidatesFor("bottom");
  const shoes = candidatesFor("shoes");
  const outerwear = candidatesFor("outerwear");
  const accessories = candidatesFor("accessory");

  if (shoes.length === 0) return null;
  if (dresses.length === 0 && sets.length === 0 && (tops.length === 0 || bottoms.length === 0)) {
    return null;
  }

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

  // Outerwear: skip entirely for the most casual band (level 1), a
  // blazer over a sweatsuit is its own kind of mismatch.
  if (band.max > 1 && outerwear.length > 0 && Math.random() < 0.35) {
    const jacket = weightedPick(outerwear);
    if (jacket) {
      picked.push(jacket);
      descriptionParts.push(jacket.name);
    }
  }

  // Accessories: coordinate metal tone with whatever's already been
  // picked (e.g. gold shoe hardware) rather than picking blind.
  if (accessories.length > 0) {
    const establishedTone = picked
      .map(metalToneOf)
      .find((t): t is "gold" | "silver" => t !== null);
    const toneFiltered = establishedTone
      ? accessories.filter((a) => {
          const tone = metalToneOf(a);
          return tone === null || tone === establishedTone;
        })
      : accessories;
    const pool = [...(toneFiltered.length > 0 ? toneFiltered : accessories)];

    const accessoryCount = Math.random() < 0.15 ? 0 : Math.random() < 0.75 ? 1 : 2;
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
  const base = neglectedPiece
    ? `A pairing of ${descriptionParts.join(", ")}, put together to give your "${neglectedPiece.name}" some wear since it hasn't been out much.`
    : `A pairing of ${descriptionParts.join(", ")}, picked from your closet.`;
  const reasoning = targetBand
    ? `${base} Kept everything at a similar, ${occasion ? "occasion-appropriate" : "matching"} formality level.`
    : base;

  return {
    itemIds: picked.map((p) => p.id),
    reasoning,
  };
}
