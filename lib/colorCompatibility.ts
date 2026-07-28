// Real color-wheel theory (complementary/analogous/monochromatic hue
// relationships computed from actual RGB→HSL conversion) instead of a
// hand-curated list of "these colors go together" buckets. Reuses the
// same canonical RGB reference table dominantColor.ts uses for pixel
// matching, so there's one source of truth for what "Rust" or
// "Emerald" actually means as a color, not two drifting definitions.

import { COLOR_REFERENCE } from "./dominantColor";

const NEUTRALS = new Set([
  "black", "white", "gray", "charcoal", "ivory", "cream", "beige",
  "tan", "camel", "brown", "chocolate", "denim", "denim blue", "navy",
  "khaki", "gold", "silver",
]);

function isNeutral(color: string): boolean {
  return NEUTRALS.has(color.toLowerCase().trim());
}

function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  switch (max) {
    case r:
      h = ((g - b) / d + (g < b ? 6 : 0)) * 60;
      break;
    case g:
      h = ((b - r) / d + 2) * 60;
      break;
    default:
      h = ((r - g) / d + 4) * 60;
  }
  return { h, s, l };
}

function hueOf(colorName: string): number | null {
  const ref = COLOR_REFERENCE[colorName.trim()];
  if (!ref) return null;
  const { h, s } = rgbToHsl(ref[0], ref[1], ref[2]);
  // Low-saturation colors (near-grays) don't have a meaningful hue for
  // this purpose even if they're not in the explicit NEUTRALS list.
  if (s < 0.12) return null;
  return h;
}

/** Circular distance between two hues on the 360° color wheel. */
function hueDistance(a: number, b: number): number {
  const diff = Math.abs(a - b) % 360;
  return diff > 180 ? 360 - diff : diff;
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
 * True if two colors work together, using actual color-wheel
 * relationships: monochromatic/analogous (hues within 45° of each
 * other) or complementary (roughly opposite, 150-210° apart) both
 * read as intentional pairings; anything in between (a 90-140° gap,
 * the "clashing" zone in traditional theory) does not. Neutrals,
 * multicolor, and exact matches are always compatible regardless,
 * same as before.
 */
export function colorsCompatible(a: string, b: string): boolean {
  const ca = a.toLowerCase().trim();
  const cb = b.toLowerCase().trim();
  if (ca === cb) return true;
  if (ca === "multicolor" || cb === "multicolor") return true;
  if (isNeutral(ca) || isNeutral(cb)) return true;

  const hueA = hueOf(ca);
  const hueB = hueOf(cb);
  // No reference hue for one or both (an unrecognized color name, e.g.
  // something freeform someone typed): assume compatible rather than
  // penalize for missing data.
  if (hueA === null || hueB === null) return true;

  const dist = hueDistance(hueA, hueB);
  return dist <= 45 || (dist >= 150 && dist <= 210);
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
