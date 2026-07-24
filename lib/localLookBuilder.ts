// Builds an outfit entirely from local closet data, with zero AI
// involvement and zero network calls. Selection is driven by what
// actually matters when putting together an outfit: formality/occasion
// fit (every candidate is scored 1-5 and constrained to a band around
// the target), and color compatibility (each piece, once picked,
// narrows what colors the next piece can be). Recency of wear plays no
// role in selection at all — how often something's been worn says
// nothing about whether it goes with what's already been picked.

import type { ClosetItem } from "./types";
import { colorsOf, isColorCompatibleWithAll } from "./colorCompatibility";

export interface LocalLookResult {
  itemIds: string[];
  reasoning: string;
}

// Uniform random pick, with a light preference for pinned favorites
// (an explicit "I like this" signal from the person, not an
// algorithmic assumption). Wear count plays no role here at all.
export function weightedPick<T extends { pinned?: boolean }>(
  candidates: T[]
): T | null {
  if (candidates.length === 0) return null;
  const weights = candidates.map((c) => (c.pinned ? 2 : 1));
  const total = weights.reduce((sum, w) => sum + w, 0);
  let roll = Math.random() * total;
  for (let i = 0; i < candidates.length; i++) {
    roll -= weights[i];
    if (roll <= 0) return candidates[i];
  }
  return candidates[candidates.length - 1];
}

/**
 * Picks from `candidates`, preferring whichever ones are color-
 * compatible with everything already established in `referenceColors`
 * (falls back to the full candidate list if none are compatible,
 * rather than failing to pick anything at all).
 */
export function pickColorCompatible<T extends { pinned?: boolean; tags?: Record<string, string> }>(
  candidates: T[],
  referenceColors: string[]
): T | null {
  if (candidates.length === 0) return null;
  const compatible = candidates.filter((c) =>
    isColorCompatibleWithAll(colorsOf(c.tags?.color), referenceColors)
  );
  return weightedPick(compatible.length > 0 ? compatible : candidates);
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

// Short, editorial-feeling label for a formality level, used to give
// a generated outfit a name worth reading ("Off-Duty," "Sharp Edge")
// instead of just listing items with no framing.
export function vibeLabelForFormality(avgFormality: number): string {
  const rounded = Math.round(avgFormality);
  if (rounded <= 1) return "Off-Duty";
  if (rounded === 2) return "Easy Day";
  if (rounded === 3) return "Put Together";
  if (rounded === 4) return "Sharp Edge";
  return "Elevated";
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
  occasion?: string,
  context?: string[],
  energy?: string
): LocalLookResult | null {
  let wearable = (items || []).filter(
    (i) => i?.laundryStatus === "clean" && i?.category !== "makeup" && i?.closetStatus !== "store"
  );
  if (wearable.length === 0) return null;

  const energyText = (energy || "").toLowerCase();
  const sensoryFriendly = /sensory/.test(energyText);
  const lowEnergy = /low energy|one-and-done/.test(energyText);
  const armorMode = /confidence|armor/.test(energyText);

  // Sensory-friendly excludes anything commonly stiff, tight, or
  // scratchy, applied before anything else so it's a hard constraint
  // on the whole pool, not a tiebreak. Falls back to the unfiltered
  // pool only if it would otherwise leave nothing to choose from at
  // all, rather than silently ignoring the request.
  if (sensoryFriendly) {
    const gentle = wearable.filter((i) => {
      const text = [i.subcategory, ...Object.values(i.tags || {})].join(" ").toLowerCase();
      return !/corset|bustier|underwire|structured|stiff|scratchy|turtleneck|skinny|bodycon/.test(text);
    });
    if (gentle.length > 0) wearable = gentle;
  }

  const contextText = (context || []).join(" ").toLowerCase();
  const avoidOpenToe = /chilly|rain/.test(contextText);
  const preferComfortShoes = /walking|chilly|rain/.test(contextText);
  const forceOuterwear = /chilly|rain/.test(contextText);

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

  // Armor mode: shift the whole band up a notch (capped at 5), since
  // structured/tailored/sharper pieces are what this state is asking
  // for, not just "whatever was already going to be picked."
  if (armorMode) {
    band.min = Math.min(5, band.min + 1);
    band.max = Math.min(5, band.max + 1);
  }

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
  // Low energy: weight heavily toward dress/set (one-and-done, no
  // separates to coordinate) instead of a plain uniform pick across
  // whatever base types happen to be available.
  const chosenBase = (() => {
    if (!lowEnergy) {
      return baseOptions[Math.floor(Math.random() * baseOptions.length)].type;
    }
    const weighted = baseOptions.map((o) => ({
      ...o,
      weight: o.type === "top+bottom" ? o.count : o.count * 4,
    }));
    const total = weighted.reduce((sum, o) => sum + o.weight, 0);
    let roll = Math.random() * total;
    for (const o of weighted) {
      roll -= o.weight;
      if (roll <= 0) return o.type;
    }
    return weighted[weighted.length - 1].type;
  })();

  const picked: ClosetItem[] = [];
  const descriptionParts: string[] = [];
  // Tracks every color established so far, so each subsequent pick is
  // filtered toward what actually goes with what's already chosen,
  // rather than each category being picked in isolation.
  let establishedColors: string[] = [];

  function addPick(item: ClosetItem | null) {
    if (!item) return;
    picked.push(item);
    descriptionParts.push(item.name);
    establishedColors = [...establishedColors, ...colorsOf(item.tags?.color)];
  }

  if (chosenBase === "dress") {
    addPick(weightedPick(dresses));
  } else if (chosenBase === "set") {
    addPick(weightedPick(sets));
  } else {
    // Bottom picked first (usually the more color-neutral piece in
    // practice, e.g. denim/black trousers), then the top picked to be
    // color-compatible with it, rather than picking both blind.
    const bottom = weightedPick(bottoms);
    addPick(bottom);
    const top = pickColorCompatible(tops, establishedColors);
    addPick(top);
  }

  // Weather context can rule out open-toe shoes (chilly/rainy) and
  // prefer flat/low-heel options (all-day walking, chilly, rainy),
  // with a graceful fallback to the unfiltered pool if that would
  // leave nothing to choose from.
  let shoeCandidates = shoes;
  if (avoidOpenToe) {
    const closedToe = shoeCandidates.filter((s) => {
      const text = [s.subcategory, ...Object.values(s.tags || {})].join(" ").toLowerCase();
      return !/sandal|flip flop|slide|open toe|peep toe/.test(text);
    });
    if (closedToe.length > 0) shoeCandidates = closedToe;
  }
  if (preferComfortShoes) {
    const comfortable = shoeCandidates.filter((s) => {
      const text = [s.subcategory, ...Object.values(s.tags || {})].join(" ").toLowerCase();
      return !/heel|stiletto/.test(text) || /flat|low heel|block heel/.test(text);
    });
    if (comfortable.length > 0) shoeCandidates = comfortable;
  }
  addPick(pickColorCompatible(shoeCandidates.length > 0 ? shoeCandidates : shoes, establishedColors));

  // Outerwear: skip entirely for the most casual band (level 1) unless
  // weather calls for it, a blazer over a sweatsuit is its own kind of
  // mismatch, but a coat over a sweatsuit for a chilly/rainy day isn't.
  const outerwearChance = forceOuterwear ? 0.9 : 0.35;
  if ((band.max > 1 || forceOuterwear) && outerwear.length > 0 && Math.random() < outerwearChance) {
    addPick(pickColorCompatible(outerwear, establishedColors));
  }

  // Accessories: coordinate both metal tone (gold shoe hardware, e.g.)
  // and color with whatever's already been picked, rather than blind.
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
    let pool = [...(toneFiltered.length > 0 ? toneFiltered : accessories)];

    const accessoryCount = lowEnergy
      ? Math.random() < 0.5
        ? 0
        : 1
      : Math.random() < 0.15
      ? 0
      : Math.random() < 0.75
      ? 1
      : 2;
    for (let i = 0; i < accessoryCount && pool.length > 0; i++) {
      const chosen = pickColorCompatible(pool, establishedColors);
      if (!chosen) break;
      addPick(chosen);
      pool = pool.filter((p) => p.id !== chosen.id);
    }
  }

  if (picked.length === 0) return null;

  const base = `A pairing of ${descriptionParts.join(", ")}, matched on color and kept to a consistent style.`;
  const energyNote = sensoryFriendly
    ? " Kept to soft, non-restrictive pieces."
    : lowEnergy
    ? " One-and-done, nothing to coordinate."
    : armorMode
    ? " Leaned structured and sharp for extra presence."
    : "";
  const reasoning = targetBand
    ? `${base} Kept everything at a similar, ${occasion ? "occasion-appropriate" : "matching"} formality level.${energyNote}`
    : `${base}${energyNote}`;

  return {
    itemIds: picked.map((p) => p.id),
    reasoning,
  };
}
