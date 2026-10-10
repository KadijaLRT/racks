// Turns a free-text event ("my cousin's baby shower", "funeral on
// Saturday", "first date at a rooftop bar") into a concrete dress-code
// profile: a target formality band, things that are wrong for that
// event, colors that are wrong for it, and plain-English guidance for
// the AI. The local builder and the AI route share this, so both are
// held to the same standard, and the AI's answer can be checked
// against it afterwards instead of being trusted blindly.
//
// Formality scale used everywhere: 1 = athleisure/loungewear,
// 2 = casual, 3 = smart casual, 4 = business/elevated, 5 = formal.

import type { ClosetItem } from "./types";
import { colorsOf } from "./colorCompatibility";

export interface FormalityBand {
  min: number;
  max: number;
}

export interface OccasionProfile {
  /** Short human label for the matched event(s), empty if nothing matched. */
  label: string;
  /** Target formality band, or null when the text named no known event. */
  band: FormalityBand | null;
  /** Item text (name, subcategory, tags) that is wrong for this event. */
  avoidText: RegExp | null;
  /** Item text that is a good sign for this event (soft preference). */
  preferText: RegExp | null;
  /** Lowercase color names that are wrong for this event. */
  avoidColors: string[];
  /** Lowercase color names that suit this event (soft preference). */
  preferColors: string[];
  /** 1 = warm weather, 3 = cold weather, null = no signal. */
  season: 1 | 3 | null;
  /** True when comfortable shoes matter (lots of standing/walking). */
  comfortShoes: boolean;
  /** Plain-English rules handed to the AI. */
  guidance: string[];
}

interface EventRule {
  label: string;
  /** Matched with word boundaries, case-insensitive. */
  words: string[];
  band?: FormalityBand;
  /** Higher wins when bands conflict. Specific events beat generic ones. */
  priority: number;
  avoidText?: string;
  preferText?: string;
  avoidColors?: string[];
  preferColors?: string[];
  season?: 1 | 3;
  comfortShoes?: boolean;
  guidance: string;
}

const REVEALING =
  "crop|mini|backless|cut-?out|halter|tube|bikini|bralette|plunging|strapless|corset|bodysuit|short shorts|micro";
const SPORTY = "athletic|activewear|sweat|hoodie|jogger|legging|tracksuit|loungewear|pajama|slides|flip.?flop";
const WHITES = ["white", "ivory", "cream", "off-white", "off white"];
const LOUD_COLORS = [
  "red", "hot pink", "fuchsia", "magenta", "orange", "yellow", "lime", "neon",
  "turquoise", "coral", "gold", "multicolor",
];

const RULES: EventRule[] = [
  // --- Explicit dress codes (these override the event's own band) -------
  {
    label: "black tie",
    words: ["black tie", "white tie", "gala", "ball gown", "red carpet"],
    band: { min: 5, max: 5 },
    priority: 100,
    avoidText: `${SPORTY}|denim|jean|sneaker|casual|graphic|cargo`,
    guidance: "Black tie: floor-length or very dressy pieces, polished heels or dress shoes, nothing casual.",
  },
  {
    label: "formal event",
    words: ["formal", "semi formal", "semi-formal", "cocktail attire", "cocktail party", "cocktail hour", "cocktail", "prom", "homecoming", "formal dinner"],
    band: { min: 4, max: 5 },
    priority: 90,
    avoidText: `${SPORTY}|denim|jean|sneaker|graphic|cargo`,
    guidance: "Formal or cocktail dress code: dressy and elevated, dress shoes or heels, no denim, sneakers or athletic pieces.",
  },
  {
    label: "business formal",
    words: ["business formal", "boardroom"],
    band: { min: 4, max: 5 },
    priority: 90,
    avoidText: `${REVEALING}|${SPORTY}|denim|jean|sneaker|graphic`,
    guidance: "Business formal: tailored, conservative, polished.",
  },
  {
    label: "business casual",
    words: ["business casual", "smart casual", "dressy casual", "casual friday"],
    band: { min: 3, max: 4 },
    priority: 80,
    avoidText: `${SPORTY}|crop|graphic|flip.?flop|distressed|ripped`,
    guidance: "Business or smart casual: put-together but relaxed; no athletic wear, no beachwear.",
  },
  // --- Solemn / ceremonial ---------------------------------------------
  {
    label: "funeral",
    words: ["funeral", "memorial", "wake", "viewing", "burial", "celebration of life", "repast"],
    band: { min: 4, max: 4 },
    priority: 95,
    avoidText: `${REVEALING}|${SPORTY}|sequin|glitter|metallic|neon|graphic|denim|jean|animal|leopard|zebra|sneaker`,
    avoidColors: [...LOUD_COLORS, "pink", "white"],
    preferColors: ["black", "charcoal", "navy", "gray", "burgundy", "maroon", "plum", "brown", "dark green"],
    comfortShoes: true,
    guidance: "Funeral: somber, modest and respectful. Dark or muted colors (black, charcoal, navy, deep neutrals), covered shoulders and a knee-length or longer hem, no sequins, bright colors, loud prints or revealing pieces.",
  },
  {
    label: "church or service",
    words: ["church", "worship", "sunday service", "mass", "mosque", "synagogue", "temple", "baptism", "christening", "communion", "confirmation"],
    band: { min: 3, max: 4 },
    priority: 85,
    avoidText: `${REVEALING}|${SPORTY}|sequin|neon|graphic|flip.?flop|short shorts`,
    comfortShoes: true,
    guidance: "Religious service: modest and tidy; covered shoulders, knee-length or longer, nothing revealing, sheer, or athletic.",
  },
  {
    label: "wedding guest",
    words: ["wedding", "reception", "rehearsal dinner", "engagement party", "bridal party"],
    band: { min: 4, max: 5 },
    priority: 88,
    avoidText: `${SPORTY}|denim|jean|sneaker|graphic|cargo|flip.?flop`,
    avoidColors: WHITES,
    guidance: "Wedding guest: dressy and celebratory but never white, ivory or cream (that is the bride's). No denim, sneakers or casual pieces.",
  },
  {
    label: "graduation",
    words: ["graduation", "commencement", "convocation", "recital"],
    band: { min: 3, max: 4 },
    priority: 80,
    avoidText: `${SPORTY}|graphic|flip.?flop`,
    comfortShoes: true,
    guidance: "Graduation or recital: smart and polished but practical; long ceremonies mean shoes must be walkable and comfortable.",
  },
  {
    label: "baby or bridal shower",
    words: ["baby shower", "bridal shower", "gender reveal", "tea party", "bachelorette brunch"],
    band: { min: 3, max: 4 },
    priority: 80,
    avoidText: `${SPORTY}|graphic|cargo|distressed`,
    avoidColors: ["black", "white", "ivory", "cream"],
    preferColors: ["pink", "blush", "lavender", "sky blue", "peach", "sage", "yellow"],
    guidance: "Shower: soft, pretty and daytime-appropriate. Light or pastel colors and feminine pieces; avoid all-black and avoid white.",
  },
  {
    label: "holiday party",
    words: ["holiday party", "christmas party", "christmas", "new year", "nye", "thanksgiving", "friendsgiving", "hanukkah", "festive"],
    band: { min: 3, max: 5 },
    priority: 70,
    preferColors: ["red", "green", "emerald", "burgundy", "gold", "black", "navy"],
    guidance: "Holiday gathering: festive and a little dressy; rich jewel tones, velvet or metallic touches work.",
  },
  // --- Work --------------------------------------------------------------
  {
    label: "interview",
    words: ["interview", "job fair", "court date", "hearing", "deposition"],
    band: { min: 4, max: 4 },
    priority: 92,
    avoidText: `${REVEALING}|${SPORTY}|graphic|sequin|denim|jean|flip.?flop|sneaker|distressed|ripped|neon`,
    avoidColors: ["neon", "hot pink", "fuchsia", "lime", "multicolor"],
    preferColors: ["black", "navy", "charcoal", "gray", "white", "ivory", "burgundy", "camel"],
    guidance: "Interview or formal appointment: conservative, tailored and polished. Closed-toe shoes, no revealing cuts, no loud prints or flashy accessories.",
  },
  {
    label: "work",
    words: ["work", "office", "meeting", "presentation", "conference", "client", "networking", "business", "professional", "corporate", "workshop", "seminar", "keynote"],
    band: { min: 3, max: 4 },
    priority: 60,
    avoidText: `${REVEALING}|${SPORTY}|graphic|sequin|flip.?flop|distressed|ripped|beach`,
    guidance: "Work: professional and put-together; no revealing, athletic, beach or club pieces.",
  },
  {
    label: "class or school",
    words: ["class", "school", "campus", "lecture", "study", "library", "exam", "university", "college"],
    band: { min: 2, max: 3 },
    priority: 40,
    comfortShoes: true,
    guidance: "Class or campus: comfortable and casual-neat, built for walking and sitting.",
  },
  // --- Social ------------------------------------------------------------
  {
    label: "date",
    words: ["date", "date night", "first date", "anniversary", "valentine", "valentines", "romantic", "proposal"],
    band: { min: 3, max: 5 },
    priority: 65,
    avoidText: `${SPORTY}|graphic|flip.?flop`,
    guidance: "Date: polished and flattering with a little intention; nothing athletic or lounge. Match the venue (rooftop or fine dining dresses up, casual cafe dresses down).",
  },
  {
    label: "dinner or drinks",
    words: ["dinner", "drinks", "cocktails", "happy hour", "restaurant", "wine bar", "tasting", "supper"],
    band: { min: 3, max: 4 },
    priority: 55,
    avoidText: `${SPORTY}|graphic|flip.?flop`,
    guidance: "Dinner or drinks: smart-casual to dressy, nothing athletic or lounge.",
  },
  {
    label: "night out",
    words: ["party", "night out", "club", "clubbing", "birthday", "bar", "lounge night", "girls night", "girls' night", "rooftop", "after party"],
    band: { min: 3, max: 5 },
    priority: 55,
    avoidText: `${SPORTY}|flip.?flop`,
    guidance: "Night out: fun, bold and dressed up; statement pieces welcome. Shoes you can stand in.",
  },
  {
    label: "concert or festival",
    words: ["concert", "festival", "show", "gig", "rave", "coachella", "tour", "sports game", "stadium", "game day", "tailgate"],
    band: { min: 1, max: 3 },
    priority: 50,
    avoidText: "stiletto|gown|formal|blazer",
    comfortShoes: true,
    guidance: "Concert, festival or game: expressive but practical; comfortable shoes for standing for hours, nothing precious or restrictive.",
  },
  {
    label: "brunch or daytime outing",
    words: ["brunch", "lunch", "shopping", "farmers market", "market", "picnic", "museum", "gallery", "brewery", "day out", "girls day", "friends", "park", "zoo", "amusement park", "theme park", "fair", "walk"],
    band: { min: 2, max: 3 },
    priority: 35,
    avoidText: "gown|formal|tuxedo|stiletto",
    comfortShoes: true,
    guidance: "Daytime outing: relaxed but cute; comfortable for walking.",
  },
  {
    label: "meeting family",
    words: ["meet the parents", "meeting the parents", "meet his parents", "meet her parents", "meet the family", "family dinner", "in-laws", "in laws", "family gathering", "cookout", "barbecue", "bbq"],
    band: { min: 2, max: 3 },
    priority: 62,
    avoidText: `${REVEALING}|${SPORTY}|graphic|sequin`,
    guidance: "Family setting: warm, neat and modest-leaning; nothing revealing or flashy.",
  },
  // --- Active / casual ------------------------------------------------------
  {
    label: "workout",
    words: ["gym", "workout", "work out", "yoga", "pilates", "morning run", "jog", "jogging", "running", "5k", "marathon", "training", "cardio", "lifting", "spin class", "sports practice", "dance class", "barre"],
    band: { min: 1, max: 1 },
    priority: 75,
    preferText: "athletic|activewear|legging|sport|sneaker|running|training|tank|sports bra|jogger|biker",
    avoidText: "dress|gown|heel|blazer|trouser|loafer|sandal|boot|denim|jean",
    guidance: "Workout: activewear only, supportive sneakers, nothing that restricts movement.",
  },
  {
    label: "hike or outdoors",
    words: ["hike", "hiking", "trail", "camping", "outdoor", "outdoors", "nature", "kayak", "ski", "snowboard", "fishing"],
    band: { min: 1, max: 2 },
    priority: 72,
    avoidText: "heel|stiletto|gown|formal|dress|sandal|flip.?flop|slides",
    comfortShoes: true,
    guidance: "Outdoors: sturdy closed shoes, layers, pieces you can move in and that can get dirty.",
  },
  {
    label: "travel",
    words: ["airport", "flight", "flying", "road trip", "travel", "travelling", "traveling", "layover", "train ride", "long drive"],
    band: { min: 1, max: 2 },
    priority: 68,
    preferText: "legging|jogger|sweat|jean|sneaker|cardigan|hoodie|tee|knit|stretch|comfort|slip.?on",
    avoidText: "heel|stiletto|gown|formal|corset|tight|bodycon|strapless|sequin|mini",
    comfortShoes: true,
    guidance: "Travel: comfortable, layerable and wrinkle-friendly; slip-on or easy shoes, nothing restrictive.",
  },
  {
    label: "beach or pool",
    words: ["beach", "pool", "resort", "cruise", "tropical", "poolside", "boat", "lake day", "swim", "island"],
    band: { min: 1, max: 3 },
    priority: 66,
    season: 1,
    preferText: "sandal|sundress|romper|short|tank|linen|swim|bikini|cover|espadrille|flip.?flop|slide",
    avoidText: "coat|boot|puffer|wool|sweater|parka|fleece|legging|sweat|jogger|athletic|running|heel|stiletto|blazer|trouser",
    guidance: "Beach or pool: light, breathable, warm-weather pieces; sandals or easy flats.",
  },
  {
    label: "casual day",
    words: ["casual", "comfy", "comfortable", "chill", "relax", "relaxing", "errand", "errands", "grocery", "chores", "weekend", "coffee", "movie", "movies", "cleaning", "laundry"],
    band: { min: 1, max: 2 },
    priority: 30,
    guidance: "Casual day: comfortable and easy, but still intentional.",
  },
  {
    label: "at home",
    words: ["netflix", "home", "at home", "staying in", "stay in", "lounging", "lounge", "cozy", "pajama day", "movie night", "couch"],
    band: { min: 1, max: 1 },
    priority: 45,
    preferText: "sweat|legging|jogger|hoodie|lounge|pajama|cozy|knit|oversized|tee|sneaker|slipper|slide",
    avoidText: "dress|gown|heel|stiletto|blazer|trouser|denim|jean|sandal|boot|skirt|sequin|corset|clutch",
    guidance: "At home: cozy loungewear and soft, easy pieces; nothing structured or dressy.",
  },
];

function wordRegex(word: string): RegExp {
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+");
  return new RegExp(`(^|[^a-z])${escaped}(s|es)?($|[^a-z])`, "i");
}

const COMPILED = RULES.map((rule) => ({
  rule,
  tests: rule.words.map(wordRegex),
}));

function intersect(a: FormalityBand, b: FormalityBand): FormalityBand | null {
  const min = Math.max(a.min, b.min);
  const max = Math.min(a.max, b.max);
  return min <= max ? { min, max } : null;
}

function clampBand(b: FormalityBand): FormalityBand {
  return { min: Math.max(1, Math.min(5, b.min)), max: Math.max(1, Math.min(5, b.max)) };
}

const EMPTY_PROFILE: OccasionProfile = {
  label: "",
  band: null,
  avoidText: null,
  preferText: null,
  avoidColors: [],
  preferColors: [],
  season: null,
  comfortShoes: false,
  guidance: [],
};

/**
 * Reads a free-text occasion into a dress-code profile. When several
 * events match ("baby shower dinner"), the most specific one sets the
 * band; the others only add their avoid-lists and guidance if their band
 * overlaps, so a "wedding reception dinner" stays formal instead of
 * dropping to the generic dinner band.
 */
export function analyzeOccasion(occasion: string | undefined | null): OccasionProfile {
  const text = (occasion || "").trim();
  if (!text) return EMPTY_PROFILE;

  const matched = COMPILED.filter(({ tests }) => tests.some((t) => t.test(text)))
    .map(({ rule }) => rule)
    .sort((a, b) => b.priority - a.priority);

  // "my wedding" / "I'm the bride" flips the wedding rule: white is allowed.
  const isBride = /\b(my wedding|i'?m (the )?bride|bride to be|my bridal|bridal portraits?|elope|elopement|courthouse wedding)\b/i.test(text);

  if (matched.length === 0) return { ...EMPTY_PROFILE };

  const lead = matched[0];
  let band: FormalityBand | null = lead.band ? { ...lead.band } : null;
  const used: EventRule[] = [lead];
  for (const rule of matched.slice(1)) {
    if (!rule.band) continue;
    if (!band) {
      band = { ...rule.band };
      used.push(rule);
      continue;
    }
    const merged = intersect(band, rule.band);
    if (merged) {
      band = merged;
      used.push(rule);
    }
  }

  // Explicit casualizers/formalizers nudge the band a notch.
  if (band) {
    if (/\b(super |very |extra )?(casual|laid.?back|low.?key)\b/i.test(text) && lead.priority < 80) {
      band = { min: Math.max(1, band.min - 1), max: Math.max(1, band.max - 1) };
    }
    if (/\b(dressy|dressed up|fancy|elegant|classy|upscale|fine dining|nice)\b/i.test(text) && lead.priority < 90) {
      band = { min: Math.min(5, band.min + 1), max: Math.min(5, band.max + 1) };
    }
    if (/\b(evening|night|tonight)\b/i.test(text) && lead.priority < 80 && band.max < 4 && !/\b(in|stay)\b/i.test(text)) {
      band = { min: Math.max(band.min, 3), max: Math.max(band.max, 4) };
    }
    band = clampBand(band);
  }

  const avoidParts = used.map((r) => r.avoidText).filter((s): s is string => !!s);
  const preferParts = used.map((r) => r.preferText).filter((s): s is string => !!s);

  let avoidColors = [...new Set(used.flatMap((r) => r.avoidColors || []))];
  if (isBride) avoidColors = avoidColors.filter((c) => !WHITES.includes(c));
  const preferColors = [...new Set(used.flatMap((r) => r.preferColors || []))];

  const guidance = used.map((r) => r.guidance);
  if (isBride) guidance.push("This is the bride's own event: white, ivory and cream are welcome.");

  const wantsSeason = used.map((r) => r.season).find((s) => s !== undefined) ?? null;

  return {
    label: used.map((r) => (isBride && r.label === "wedding guest" ? "wedding (bride)" : r.label)).join(" + "),
    band,
    avoidText: avoidParts.length ? new RegExp(avoidParts.join("|"), "i") : null,
    preferText: preferParts.length ? new RegExp(preferParts.join("|"), "i") : null,
    avoidColors,
    preferColors,
    season: wantsSeason,
    comfortShoes: used.some((r) => r.comfortShoes),
    guidance,
  };
}

// --- Checking items against a profile ------------------------------------

function itemText(item: ClosetItem): string {
  const tags = item?.tags || {};
  const parts: string[] = [item?.subcategory || "", item?.name || ""];
  for (const [key, value] of Object.entries(tags)) {
    if (key === "color" || key === "brand" || key === "size") continue;
    parts.push(String(value ?? ""));
  }
  return parts.join(" ").toLowerCase();
}

/** Why an item is wrong for the event, or null if it is fine. */
export function occasionConflict(item: ClosetItem, profile: OccasionProfile): string | null {
  if (profile.avoidText && profile.avoidText.test(itemText(item))) {
    return "style doesn't suit this event";
  }
  if (profile.avoidColors.length > 0) {
    const colors = colorsOf(item?.tags?.color).map((c) => c.toLowerCase().trim());
    const hit = colors.find((c) => profile.avoidColors.some((a) => c === a || c.includes(a)));
    if (hit) return `${hit} isn't right for this event`;
  }
  return null;
}

export function matchesOccasionPreference(item: ClosetItem, profile: OccasionProfile): boolean {
  if (profile.preferText && profile.preferText.test(itemText(item))) return true;
  if (profile.preferColors.length > 0) {
    const colors = colorsOf(item?.tags?.color).map((c) => c.toLowerCase().trim());
    if (colors.some((c) => profile.preferColors.includes(c))) return true;
  }
  return false;
}

export interface OutfitFit {
  /** 1-5, how well the whole outfit suits the event. */
  score: number;
  /** Concrete, human-readable problems; empty when the outfit fits. */
  problems: string[];
}

/**
 * Scores a finished outfit against the event. `formalityOf` is passed in
 * (rather than imported) to keep this module free of a circular import
 * with the local look builder.
 */
export function scoreOutfitFit(
  items: ClosetItem[],
  profile: OccasionProfile,
  formalityOf: (item: ClosetItem) => number
): OutfitFit {
  const problems: string[] = [];
  let penalty = 0;
  const core = items.filter((i) => i?.category !== "accessory");

  if (profile.band) {
    const { min, max } = profile.band;
    for (const item of core) {
      const f = formalityOf(item);
      const gap = f < min ? min - f : f > max ? f - max : 0;
      if (gap >= 1) {
        penalty += gap;
        problems.push(
          `${item?.name || item?.category} is too ${f < min ? "casual" : "dressy"} for this event (level ${f}, wants ${min === max ? min : `${min}-${max}`})`
        );
      }
    }
  }

  for (const item of items) {
    const why = occasionConflict(item, profile);
    if (why) {
      penalty += 1.5;
      problems.push(`${item?.name || item?.category}: ${why}`);
    }
  }

  // Outfit coherence: a spread of 3+ levels across the core pieces reads
  // as mismatched no matter what the event is.
  if (core.length >= 2) {
    const levels = core.map(formalityOf);
    const spread = Math.max(...levels) - Math.min(...levels);
    if (spread >= 3) {
      penalty += spread - 2;
      problems.push("the pieces are at very different dress levels");
    }
  }

  const score = Math.max(1, Math.min(5, Math.round(5 - penalty)));
  return { score, problems };
}
