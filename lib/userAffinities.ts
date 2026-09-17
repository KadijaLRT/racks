// Phase 2 of the hybrid generation workflow: after the Master Style
// Algorithm's guardrails (formality, season, exposure, volume,
// aesthetic budget, color cap) filter candidates down to what's
// actually valid, this layer ranks among what's left by what this
// specific person has actually chosen or rejected before. It never
// overrides a guardrail — it only breaks ties among already-valid
// options, so the app can't learn its way into suggesting something
// that clashes just because it was picked once.

import type { ClosetItem, UserAffinities } from "./types";
import { getAesthetics } from "./styleAlgorithm";
import { colorsOf } from "./colorCompatibility";

export function emptyAffinities(): UserAffinities {
  return {
    stylePairWeights: {},
    colorPairWeights: {},
    texturePairWeights: {},
    itemPairWeights: {},
  };
}

/** Stable, order-independent key for a pair, so A_B and B_A are one entry. */
function pairKey(a: string, b: string): string {
  return [a, b].sort().join("_");
}

function bumpAll(record: Record<string, number>, keys: string[], delta: number): void {
  for (const key of keys) {
    record[key] = Math.round(((record[key] || 0) + delta) * 100) / 100;
  }
}

/**
 * The three feedback channels, weighted as specified: a manually
 * built outfit is the strongest signal (these are hand-picked, the
 * "gold standard"), a generated-then-worn outfit is a real but softer
 * endorsement, and a rejection (deleting a saved look, or an explicit
 * "why not" dismissal) is a small negative nudge away from that
 * specific combination, not a hard ban.
 */
export const AFFINITY_DELTAS = {
  manual: 0.5,
  worn: 0.3,
  rejected: -0.2,
} as const;

/**
 * Boosts (or, with a negative delta, penalizes) every pairwise
 * relationship among the given items: item-to-item, aesthetic-to-
 * aesthetic, color-to-color (non-neutral only, same reasoning as the
 * color cap elsewhere — neutrals pair with everything by design, so
 * scoring them isn't meaningful signal), and fabric-to-fabric.
 * Returns a new object rather than mutating, consistent with how the
 * rest of this app's local storage updates work.
 */
export function boostAffinities(
  current: UserAffinities,
  items: ClosetItem[],
  delta: number
): UserAffinities {
  const next: UserAffinities = {
    stylePairWeights: { ...current.stylePairWeights },
    colorPairWeights: { ...current.colorPairWeights },
    texturePairWeights: { ...current.texturePairWeights },
    itemPairWeights: { ...current.itemPairWeights },
    updatedAt: Date.now(),
  };

  const NEUTRALS = new Set([
    "black", "white", "gray", "charcoal", "ivory", "cream", "beige",
    "tan", "camel", "brown", "chocolate", "denim", "denim blue", "navy",
    "khaki", "gold", "silver",
  ]);

  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      const a = items[i];
      const b = items[j];
      if (a.id === b.id) continue;

      bumpAll(next.itemPairWeights, [pairKey(a.id, b.id)], delta);

      const aestheticsA = getAesthetics(a);
      const aestheticsB = getAesthetics(b);
      const styleKeys: string[] = [];
      for (const sa of aestheticsA) {
        for (const sb of aestheticsB) {
          if (sa !== sb) styleKeys.push(pairKey(sa, sb));
        }
      }
      bumpAll(next.stylePairWeights, styleKeys, delta);

      const colorsA = colorsOf(a.tags?.color).filter((c) => !NEUTRALS.has(c.toLowerCase()));
      const colorsB = colorsOf(b.tags?.color).filter((c) => !NEUTRALS.has(c.toLowerCase()));
      const colorKeys: string[] = [];
      for (const ca of colorsA) {
        for (const cb of colorsB) {
          if (ca.toLowerCase() !== cb.toLowerCase()) colorKeys.push(pairKey(ca, cb));
        }
      }
      bumpAll(next.colorPairWeights, colorKeys, delta);

      const fabricA = a.tags?.fabric;
      const fabricB = b.tags?.fabric;
      if (fabricA && fabricB && fabricA.toLowerCase() !== fabricB.toLowerCase()) {
        bumpAll(next.texturePairWeights, [pairKey(fabricA, fabricB)], delta);
      }
    }
  }

  return next;
}

/**
 * How well `candidate` would score if added alongside `established`,
 * summed across item/style/color/texture pair weights. Used as a
 * selection-weight multiplier, not a filter — a candidate with no
 * affinity history at all scores neutral (1x), never excluded for
 * lack of data, since most items won't have accumulated any history
 * yet and shouldn't be penalized for that.
 */
export function affinityWeightMultiplier(
  affinities: UserAffinities | null | undefined,
  candidate: ClosetItem,
  established: ClosetItem[]
): number {
  if (!affinities || established.length === 0) return 1;

  let score = 0;
  const candidateAesthetics = getAesthetics(candidate);
  const candidateColors = colorsOf(candidate.tags?.color);
  const candidateFabric = candidate.tags?.fabric;

  for (const est of established) {
    score += affinities.itemPairWeights[pairKey(candidate.id, est.id)] || 0;

    for (const sa of candidateAesthetics) {
      for (const sb of getAesthetics(est)) {
        if (sa !== sb) score += affinities.stylePairWeights[pairKey(sa, sb)] || 0;
      }
    }

    const estColors = colorsOf(est.tags?.color);
    for (const ca of candidateColors) {
      for (const cb of estColors) {
        if (ca.toLowerCase() !== cb.toLowerCase()) {
          score += affinities.colorPairWeights[pairKey(ca, cb)] || 0;
        }
      }
    }

    if (candidateFabric && est.tags?.fabric && candidateFabric.toLowerCase() !== est.tags.fabric.toLowerCase()) {
      score += affinities.texturePairWeights[pairKey(candidateFabric, est.tags.fabric)] || 0;
    }
  }

  // Converts an additive score into a multiplier centered on 1: a
  // strongly favored pairing (score ~2) roughly doubles the selection
  // weight, a strongly disfavored one (score ~-2) roughly halves it,
  // without ever hitting zero (a rejection lowers the odds, it
  // doesn't ban the combination outright).
  return Math.max(0.2, 1 + score * 0.5);
}
