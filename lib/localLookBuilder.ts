// Builds an outfit entirely from local closet data, with zero AI
// involvement and zero network calls. Selection is driven by what
// actually matters when putting together an outfit: formality/occasion
// fit (every candidate is scored 1-5 and constrained to a band around
// the target), and color compatibility (each piece, once picked,
// narrows what colors the next piece can be). Recency of wear plays no
// role in selection at all — how often something's been worn says
// nothing about whether it goes with what's already been picked.

import type { ClosetItem, UserAffinities } from "./types";
import { colorsOf, isColorCompatibleWithAll } from "./colorCompatibility";
import { affinityWeightMultiplier } from "./userAffinities";
import {
  analyzeOccasion,
  occasionConflict,
  matchesOccasionPreference,
  scoreOutfitFit,
  type OccasionProfile,
} from "./occasionProfile";
import {
  getExposure,
  getVolume,
  getAesthetics,
  fitsAestheticBudget,
  countNonNeutralColors,
  isNeutralColor,
} from "./styleAlgorithm";

export interface LocalLookResult {
  itemIds: string[];
  reasoning: string;
}

// Uniform random pick, with a light preference for pinned favorites
// (an explicit "I like this" signal from the person, not an
// algorithmic assumption), and an optional further boost for colors
// that show up often in the person's own favorited looks (learned
// preference, not a hard rule — it nudges the odds, it doesn't
// exclude anything). Wear count plays no role here at all.
export function weightedPick<T extends { id: string; pinned?: boolean; tags?: Record<string, string> }>(
  candidates: T[],
  preferredColors: string[] = [],
  affinityContext?: { affinities: UserAffinities | null | undefined; established: T[] }
): T | null {
  if (candidates.length === 0) return null;
  const weights = candidates.map((c) => {
    let w = c.pinned ? 2 : 1;
    if (preferredColors.length > 0) {
      const itemColors = colorsOf(c.tags?.color);
      if (itemColors.some((ic) => preferredColors.includes(ic.toLowerCase()))) {
        w *= 1.6;
      }
    }
    if (affinityContext) {
      w *= affinityWeightMultiplier(
        affinityContext.affinities,
        c as unknown as ClosetItem,
        affinityContext.established as unknown as ClosetItem[]
      );
    }
    return w;
  });
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
export function pickColorCompatible<T extends { id: string; pinned?: boolean; tags?: Record<string, string> }>(
  candidates: T[],
  referenceColors: string[],
  preferredColors: string[] = [],
  affinityContext?: { affinities: UserAffinities | null | undefined; established: T[] }
): T | null {
  if (candidates.length === 0) return null;
  const compatible = candidates.filter((c) =>
    isColorCompatibleWithAll(colorsOf(c.tags?.color), referenceColors)
  );
  return weightedPick(compatible.length > 0 ? compatible : candidates, preferredColors, affinityContext);
}

// --- Formality scoring ---------------------------------------------

// 1 = athleisure/loungewear, 2 = casual, 3 = smart casual,
// 4 = business/elevated, 5 = formal/dressy.
const FORMALITY_KEYWORDS: { level: number; keywords: string[] }[] = [
  {
    level: 1,
    keywords: [
      "sweatsuit", "tracksuit", "loungewear", "hoodie", "sweatshirt",
      "sweatpants", "sweat pants", "pajama", "robe", "slides", "house slipper",
      "slipper", "legging", "jogger", "biker short", "sports bra", "track pant",
      "athletic", "activewear", "running shoe", "training shoe", "gym",
    ],
  },
  {
    level: 2,
    keywords: [
      "t-shirt", "tee", "tank", "jeans", "denim", "shorts", "sneaker",
      "flip-flop", "flip flop", "graphic", "cargo", "bralette", "camisole",
      "cami", "crop top", "tube top", "bomber", "denim jacket", "puffer",
      "parka", "backpack", "belt bag", "fanny pack", "combat boot", "skort",
      "romper", "jumpsuit", "sundress", "mini skirt", "baseball cap",
    ],
  },
  {
    level: 3,
    keywords: [
      "blouse", "sweater", "cardigan", "midi", "flats", "flat", "loafer",
      "chino", "polo", "henley", "sandal", "espadrille", "bodysuit", "wedge",
      "mule", "ballet flat", "turtleneck", "tunic", "maxi", "shirt dress",
      "leather jacket", "crossbody", "tote", "ankle boot", "halter top",
      "wrap top",
    ],
  },
  {
    level: 4,
    keywords: [
      "blazer", "trouser", "button-down", "button down", "button-up", "heel",
      "pump", "pencil skirt", "dress pant", "dress pants", "slacks",
      "wrap dress", "oxford", "structured", "bootie", "coat", "trench",
      "peacoat", "slip dress", "corset", "pleated", "clutch", "kitten heel",
      "block heel", "pearl", "tailored", "sheath", "bodycon",
    ],
  },
  {
    level: 5,
    keywords: [
      "gown", "cocktail", "evening", "tuxedo", "stiletto", "sequin",
      "ball gown", "formal", "tulle", "evening bag", "maxi gown",
      "black tie", "strappy heel", "rhinestone", "beaded",
    ],
  },
];

// Tag keys that say nothing about how dressy a piece is (and whose values
// can collide with keywords, e.g. a "Silver" color or a "Coach" brand).
const FORMALITY_IGNORED_TAG_KEYS = new Set([
  "color", "brand", "size", "pattern", "season", "shade", "finish",
  "exposure", "volume", "fit", "hardware", "neckline", "sleeveLength",
]);

// Whole-word match (with simple plural tolerance) so "informal" never
// reads as "formal", "steel" never reads as "tee", and "tankini" never
// reads as "tank".
const keywordRegexCache = new Map<string, RegExp>();
function hasWord(text: string, keyword: string): boolean {
  let re = keywordRegexCache.get(keyword);
  if (!re) {
    const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "[\\s-]+");
    re = new RegExp(`(^|[^a-z])${escaped}(s|es)?($|[^a-z])`, "i");
    keywordRegexCache.set(keyword, re);
  }
  return re.test(text);
}

function levelFromText(text: string): number | null {
  let best: number | null = null;
  for (const { level, keywords } of FORMALITY_KEYWORDS) {
    if (keywords.some((k) => hasWord(text, k))) best = level;
  }
  return best;
}

// Reads an explicit formality / occasion tag if the person (or the tagger)
// set one. Highest-trust signal: it overrides keyword guessing entirely.
function explicitFormality(item: ClosetItem): number | null {
  const raw = String(item?.tags?.formality || "").toLowerCase().trim();
  if (!raw) return null;
  const n = Number(raw);
  if (Number.isFinite(n) && n >= 1 && n <= 5) return Math.round(n);
  if (/athleisure|lounge|activewear|sporty/.test(raw)) return 1;
  if (/smart casual|business casual|dressy casual/.test(raw)) return 3;
  if (/black tie|formal|dressy|evening|gala/.test(raw)) return 5;
  if (/business|professional|elevated|work/.test(raw)) return 4;
  if (/casual|everyday|relaxed/.test(raw)) return 2;
  return null;
}

// Fabrics that read dressier on a garment (not on, say, a tote bag).
const DRESSY_FABRIC = /(^|[^a-z])(silk|satin|velvet|chiffon|lace|sequin|sequined|beaded|metallic|brocade|taffeta)($|[^a-z])/i;
// Markers that cap a piece at casual no matter what else it says.
const CASUAL_CAP = /(^|[^a-z])(distressed|ripped|oversized tee|graphic|washed|raw hem|athletic|sporty)($|[^a-z])/i;

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
  const explicit = explicitFormality(item);
  if (explicit !== null) return explicit;

  // What the piece IS (its subcategory and name) outranks incidental
  // tag values like a fabric or an aesthetic, so a "satin tank" is still
  // a tank and a "silk" tag can't turn a hoodie into a gown.
  const primary = `${item?.subcategory || ""} ${item?.name || ""}`.toLowerCase();
  const secondary = Object.entries(item?.tags || {})
    .filter(([key]) => !FORMALITY_IGNORED_TAG_KEYS.has(key))
    .map(([, value]) => String(value ?? ""))
    .join(" ")
    .toLowerCase();

  let level = levelFromText(primary);
  if (level === null) level = levelFromText(secondary);
  let best = level ?? 2; // default assumption: casual, the most common everyday case

  // Category-level nudges for items with no matching keyword at all,
  // so a plain unlabeled dress doesn't default all the way down to 2.
  if (level === null) {
    if (item?.category === "dress") best = 3;
    if (item?.category === "outerwear") best = 3;
    if (item?.category === "set") best = 2;
  }

  // Dressy fabric lifts garments one level (never shoes/accessories,
  // which carry their own formality), casual markers cap at 2.
  const wearsFabric = ["dress", "top", "bottom", "set", "outerwear"].includes(item?.category);
  if (wearsFabric && best < 5 && DRESSY_FABRIC.test(`${primary} ${secondary}`)) best += 1;
  if (best > 2 && CASUAL_CAP.test(primary)) best = 2;

  // An occasion tag (e.g. "Work, Formal") is a trustworthy hint of the
  // top of the range when no explicit formality was set.
  const occasionTag = String(item?.tags?.occasion || "").toLowerCase();
  if (occasionTag) {
    if (/formal|wedding|gala|cocktail|evening/.test(occasionTag)) best = Math.max(best, 4);
    else if (/work|office|business/.test(occasionTag)) best = Math.max(best, 3);
  }

  return Math.max(1, Math.min(5, best));
}

// 1 = warm-weather/lightweight (linen, tank, shorts, sandals),
// 2 = transitional (most everyday pieces, no strong seasonal signal),
// 3 = cold-weather/heavy (wool, coats, boots). This exists because
// color and formality compatibility alone don't stop a linen tank
// from getting paired with a wool coat — they're a plausible color
// match and similar formality, but seasonally nonsensical together.
const SEASON_KEYWORDS: { weight: number; keywords: string[] }[] = [
  {
    weight: 1,
    keywords: [
      "linen", "tank", "shorts", "sandal", "flip flop", "slide",
      "sundress", "swim", "bikini", "tube top", "camisole", "romper",
      "espadrille", "seersucker", "eyelet",
    ],
  },
  {
    weight: 3,
    keywords: [
      "wool", "cashmere", "fleece", "coat", "puffer", "boot", "sweater",
      "turtleneck", "flannel", "corduroy", "thermal", "parka", "shearling",
      "heavy", "cable knit", "sweatsuit", "tracksuit",
    ],
  },
];

export function estimateSeasonWeight(item: ClosetItem): number {
  const text = textOf(item);
  let best = 2;
  for (const { weight, keywords } of SEASON_KEYWORDS) {
    if (keywords.some((k) => text.includes(k))) best = weight;
  }
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

/**
 * Maps a free-text occasion phrase to a [min, max] formality band. The
 * vocabulary and rules live in occasionProfile.ts so the AI route and
 * this builder agree on what an event calls for. Returns null when no
 * known event is named, meaning "pick any coherent band".
 */
export function occasionToFormalityBand(
  occasion: string | undefined | null
): { min: number; max: number } | null {
  return analyzeOccasion(occasion).band;
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

export interface LearnedPreferences {
  // Colors that show up often in the person's own favorited/saved
  // looks, lowercased. Used as a soft weighting boost during
  // selection, never a hard filter — someone's favorites skewing
  // toward jewel tones shouldn't make every other color impossible to
  // get picked, just less likely relative to the ones they keep going
  // back to.
  colors: string[];
  // Average formality level across favorited looks' items, used to
  // bias the random band-center when no occasion is specified (rather
  // than a fully uncorrelated random pick every time "surprise me" is
  // used with no other input).
  formalityCenter: number | null;
}

/**
 * Builds several candidate outfits and keeps the one that best fits the
 * event. A single random draw can land on a mismatched piece even when
 * the pools are filtered, so we draw a handful and score each against
 * the same dress-code profile the AI route uses.
 */
export function buildLocalLook(
  items: ClosetItem[],
  occasion?: string,
  context?: string[],
  energy?: string,
  preferences?: LearnedPreferences,
  affinities?: UserAffinities | null
): LocalLookResult | null {
  const profile = analyzeOccasion(occasion);
  const attempts = profile.band || profile.avoidText || profile.avoidColors.length > 0 ? 12 : 1;
  const byId = new Map((items || []).map((i) => [i.id, i]));

  let best: { result: LocalLookResult; score: number; lean: number; problems: string[] } | null = null;
  // Among equally valid outfits, formal events lean toward the dressy end
  // of the band (a cocktail dress over trousers and a button-down for a
  // wedding), while other events aim for the middle of it.
  const leanTarget = profile.band
    ? profile.band.min >= 4
      ? profile.band.max
      : (profile.band.min + profile.band.max) / 2
    : 0;
  for (let n = 0; n < attempts; n++) {
    const candidate = buildOnce(items, occasion, context, energy, preferences, affinities, profile);
    if (!candidate) continue;
    const picked = candidate.itemIds.map((id) => byId.get(id)).filter((i): i is ClosetItem => !!i);
    const fit = scoreOutfitFit(picked, profile, estimateFormality);
    const core = picked.filter((i) => i.category !== "accessory");
    const avg = core.length
      ? core.reduce((sum, i) => sum + estimateFormality(i), 0) / core.length
      : leanTarget;
    const lean = profile.band ? Math.abs(avg - leanTarget) : 0;
    if (!best || fit.score > best.score || (fit.score === best.score && lean < best.lean)) {
      best = { result: candidate, score: fit.score, lean, problems: fit.problems };
    }
  }
  if (!best) return null;

  // Be honest when the closet can't fully meet the dress code, instead of
  // presenting a stretch as a perfect match.
  if (profile.band && best.problems.length > 0) {
    best.result.reasoning += ` Closest fit to a ${profile.label || "this"} dress code from what's clean in your closet; ${best.problems[0]}.`;
  }
  return best.result;
}

function buildOnce(
  items: ClosetItem[],
  occasion: string | undefined,
  context: string[] | undefined,
  energy: string | undefined,
  preferences: LearnedPreferences | undefined,
  affinities: UserAffinities | null | undefined,
  profile: OccasionProfile
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
  const preferComfortShoes = /walking|chilly|rain/.test(contextText) || profile.comfortShoes;
  const forceOuterwear = /chilly|rain/.test(contextText);

  const targetBand = profile.band ? { ...profile.band } : null;

  // If the occasion didn't map to a known band, pick a random target
  // level weighted toward whatever's actually well-represented in the
  // closet, then build a narrow band around it. Either way, every
  // candidate pool below gets filtered to the same band, so the final
  // outfit can't mix a level-1 sweatsuit with level-4 heels just
  // because both happened to be under-worn.
  const band =
    targetBand ||
    (() => {
      // With a learned formality preference and no explicit occasion,
      // lean toward what the person actually favorites most often
      // (70% of the time) rather than a fully random pick every time
      // "surprise me" gets used with no other input, while still
      // leaving room for variety the other 30%.
      if (preferences?.formalityCenter != null && Math.random() < 0.7) {
        const center = Math.round(preferences.formalityCenter);
        return { min: Math.max(1, center - 1), max: Math.min(5, center + 1) };
      }
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

  // Season is a separate axis from formality entirely: color and
  // formality compatibility alone don't stop a linen tank from being
  // paired with a wool coat. If the occasion or weather context names
  // a season, that sets a hard target; otherwise a random per-outfit
  // center still keeps the outfit internally consistent (no mixing
  // sandals with a puffer) even with nothing explicit stated.
  const occasionAndContextText = `${occasion || ""} ${(context || []).join(" ")}`.toLowerCase();
  const seasonTarget = profile.season === 1 || /summer|beach|hot|vacation|tropical/.test(occasionAndContextText)
    ? 1
    : /winter|cold|holiday|snow/.test(occasionAndContextText)
    ? 3
    : forceOuterwear
    ? 3
    : null;
  const seasonBand =
    seasonTarget !== null
      ? { min: Math.max(1, seasonTarget - 1), max: Math.min(3, seasonTarget + 1) }
      : (() => {
          const center = estimateSeasonWeight(
            wearable[Math.floor(Math.random() * wearable.length)]
          );
          return { min: Math.max(1, center - 1), max: Math.min(3, center + 1) };
        })();

  const inBand = (item: ClosetItem) => {
    const f = estimateFormality(item);
    const s = estimateSeasonWeight(item);
    return f >= band.min && f <= band.max && s >= seasonBand.min && s <= seasonBand.max;
  };

  // Tiered fallback so the event always wins over randomness: (1) inside
  // the band AND free of anything wrong for this event, (2) inside the
  // band, (3) free of event conflicts and closest to the band, (4)
  // closest to the band. Never fails outright just because a closet is
  // small, it just degrades one tier at a time.
  const bandCenter = (band.min + band.max) / 2;
  const byDistance = (list: ClosetItem[]) =>
    [...list].sort(
      (a, b) =>
        Math.abs(estimateFormality(a) - bandCenter) - Math.abs(estimateFormality(b) - bandCenter)
    );
  const noConflict = (i: ClosetItem) => !occasionConflict(i, profile);
  function candidatesFor(category: string): ClosetItem[] {
    const all = wearable.filter((i) => i?.category === category);
    const strict = all.filter(inBand);
    const strictClean = strict.filter(noConflict);
    let pool: ClosetItem[];
    if (strictClean.length > 0) pool = strictClean;
    else if (strict.length > 0) pool = strict;
    else {
      const clean = all.filter(noConflict);
      const nearest = byDistance(clean.length > 0 ? clean : all);
      // Keep only the closest tier of formality, not the whole list.
      const bestGap = nearest.length
        ? Math.abs(estimateFormality(nearest[0]) - bandCenter)
        : 0;
      pool = nearest.filter((i) => Math.abs(estimateFormality(i) - bandCenter) <= bestGap + 0.5);
    }
    // Soft preference: when anything suits the event especially well
    // (pastels for a shower, activewear for a workout), narrow to those.
    const liked = pool.filter((i) => matchesOccasionPreference(i, profile));
    return liked.length > 0 ? liked : pool;
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
  // The Master Style Algorithm's running state: which aesthetics are
  // in play (capped at 2 total) and how many distinct non-neutral
  // colors are already committed to (capped at 3).
  let establishedAesthetics: string[] = [];

  function addPick(item: ClosetItem | null) {
    if (!item) return;
    picked.push(item);
    descriptionParts.push(item.name);
    establishedColors = [...establishedColors, ...colorsOf(item.tags?.color)];
    establishedAesthetics = [...new Set([...establishedAesthetics, ...getAesthetics(item)])];
  }

  // Combines the aesthetic budget (max 2 distinct aesthetics across
  // the whole outfit) and the non-neutral color cap (max 3 distinct)
  // into one filter, applied everywhere a pick happens. Both fall back
  // gracefully to the unfiltered pool rather than ever returning zero
  // candidates, same principle as every other constraint in this file.
  function applyStyleBudget(candidates: ClosetItem[]): ClosetItem[] {
    const nonNeutralCount = countNonNeutralColors(establishedColors);
    const filtered = candidates.filter((c) => {
      const aestheticsOk = fitsAestheticBudget(getAesthetics(c), establishedAesthetics);
      if (!aestheticsOk) return false;
      if (nonNeutralCount < 3) return true;
      // Already at the cap: only neutrals or colors already in play
      // don't push the count higher.
      const itemColors = colorsOf(c.tags?.color);
      return itemColors.every(
        (ic) =>
          isNeutralColor(ic) ||
          establishedColors.some((ec) => ec.toLowerCase().trim() === ic.toLowerCase().trim())
      );
    });
    return filtered.length > 0 ? filtered : candidates;
  }

  const preferredColors = preferences?.colors || [];

  if (chosenBase === "dress") {
    addPick(weightedPick(applyStyleBudget(dresses), preferredColors, { affinities, established: picked }));
  } else if (chosenBase === "set") {
    addPick(weightedPick(applyStyleBudget(sets), preferredColors, { affinities, established: picked }));
  } else {
    // Bottom picked first (usually the more color-neutral piece in
    // practice, e.g. denim/black trousers), then the top picked to be
    // color-compatible with it, rather than picking both blind.
    let bottom = weightedPick(applyStyleBudget(bottoms), preferredColors, { affinities, established: picked });
    addPick(bottom);
    const top = pickColorCompatible(applyStyleBudget(tops), establishedColors, preferredColors, { affinities, established: picked });

    // Exposure balance: if both pieces landed on High Skin (a crop top
    // with a mini, say), that's the one combination the algorithm
    // explicitly calls out as needing a fix, mirroring its own
    // pick-then-correct approach rather than trying to predict this
    // before either piece is chosen.
    if (top && bottom && getExposure(top) === "High Skin" && getExposure(bottom) === "High Skin") {
      const lowerExposureBottoms = bottoms.filter((b) => getExposure(b) !== "High Skin");
      if (lowerExposureBottoms.length > 0) {
        const replacement = weightedPick(applyStyleBudget(lowerExposureBottoms), preferredColors, { affinities, established: picked });
        if (replacement) {
          picked.splice(picked.indexOf(bottom), 1);
          bottom = replacement;
          addPick(bottom);
        }
      }
    }
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
  addPick(
    pickColorCompatible(
      applyStyleBudget(shoeCandidates.length > 0 ? shoeCandidates : shoes),
      establishedColors,
      preferredColors,
      { affinities, established: picked }
    )
  );

  // Volume balance: two pieces at the same volume extreme (both
  // Fitted, or both Oversized) reads as either too tight or too
  // shapeless without a third piece to break it up, so outerwear gets
  // both a higher chance of appearing and a push toward the
  // complementary volume when the base already landed at one extreme.
  const baseVolumes = picked
    .filter((p) => p.category !== "shoes" && p.category !== "accessory")
    .map((p) => getVolume(p));
  const needsVolumeBreak =
    baseVolumes.length >= 2 &&
    (baseVolumes.every((v) => v === "Fitted") || baseVolumes.every((v) => v === "Oversized"));
  const complementaryVolume = baseVolumes[0] === "Oversized" ? "Fitted" : "Oversized";

  // Outerwear: skip entirely for the most casual band (level 1) unless
  // weather calls for it, a blazer over a sweatsuit is its own kind of
  // mismatch, but a coat over a sweatsuit for a chilly/rainy day isn't.
  const outerwearChance = forceOuterwear ? 0.9 : needsVolumeBreak ? 0.75 : 0.35;
  if ((band.max > 1 || forceOuterwear) && outerwear.length > 0 && Math.random() < outerwearChance) {
    let outerwearCandidates = applyStyleBudget(outerwear);
    if (needsVolumeBreak) {
      const balancing = outerwearCandidates.filter((o) => getVolume(o) === complementaryVolume);
      if (balancing.length > 0) outerwearCandidates = balancing;
    }
    addPick(pickColorCompatible(outerwearCandidates, establishedColors, preferredColors, { affinities, established: picked }));
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
    let pool = applyStyleBudget([...(toneFiltered.length > 0 ? toneFiltered : accessories)]);

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
      const chosen = pickColorCompatible(pool, establishedColors, preferredColors, { affinities, established: picked });
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
    ? `${base} Dressed for ${profile.label || "the occasion"}: every piece sits at the right dress level for it.${energyNote}`
    : `${base}${energyNote}`;

  return {
    itemIds: picked.map((p) => p.id),
    reasoning,
  };
}
