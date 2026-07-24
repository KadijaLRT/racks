// Groups colors into families for compatibility scoring, so local
// outfit assembly can prefer pieces that actually go together instead
// of picking blind. A color can belong to more than one family (e.g.
// Mustard reads as both an earth tone and a warm color) — compatible
// if either color is neutral, they're the same color, or they share
// at least one family.

const NEUTRALS = new Set([
  "black", "white", "gray", "charcoal", "ivory", "cream", "beige",
  "tan", "camel", "brown", "chocolate", "denim", "denim blue", "navy",
  "khaki", "gold", "silver",
]);

const FAMILIES: Record<string, string[]> = {
  earth: ["rust", "terracotta", "caramel", "mustard", "olive", "forest", "chocolate", "brown", "camel", "khaki"],
  jewel: ["emerald", "burgundy", "plum", "ruby", "maroon", "teal", "navy"],
  warm: ["red", "orange", "coral", "peach", "yellow", "mustard", "terracotta", "rust"],
  coolPastel: ["blush", "pink", "rose", "lavender", "lilac", "mint", "sky blue"],
  boldCool: ["fuchsia", "magenta", "purple", "violet", "cerulean", "blue", "green", "emerald", "teal"],
};

function familiesOf(color: string): string[] {
  const c = color.toLowerCase().trim();
  return Object.entries(FAMILIES)
    .filter(([, colors]) => colors.includes(c))
    .map(([family]) => family);
}

function isNeutral(color: string): boolean {
  return NEUTRALS.has(color.toLowerCase().trim());
}

/** Extracts every color value from a possibly comma-joined tag string. */
export function colorsOf(colorTag: string | undefined | null): string[] {
  if (!colorTag) return [];
  return colorTag
    .split(",")
    .map((c) => c.trim())
    .filter(Boolean);
}

/**
 * True if two colors work together: either is neutral, multicolor,
 * identical, or they share a family. This is intentionally generous
 * (multicolor items and neutrals pair with anything) rather than a
 * strict rule engine, since the goal is "don't actively clash," not
 * "match a professional colorist's exact palette theory."
 */
export function colorsCompatible(a: string, b: string): boolean {
  const ca = a.toLowerCase().trim();
  const cb = b.toLowerCase().trim();
  if (ca === cb) return true;
  if (ca === "multicolor" || cb === "multicolor") return true;
  if (isNeutral(ca) || isNeutral(cb)) return true;
  const familiesA = familiesOf(ca);
  const familiesB = familiesOf(cb);
  return familiesA.some((f) => familiesB.includes(f));
}

/**
 * True if `candidateColors` is compatible with every color already
 * established in `referenceColors`. An item with no color tag at all
 * is treated as compatible by default (nothing to conflict with),
 * rather than excluded for lack of data.
 */
export function isColorCompatibleWithAll(
  candidateColors: string[],
  referenceColors: string[]
): boolean {
  if (candidateColors.length === 0 || referenceColors.length === 0) return true;
  return candidateColors.every((cc) =>
    referenceColors.every((rc) => colorsCompatible(cc, rc))
  );
}
