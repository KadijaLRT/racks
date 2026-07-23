// Rule-based keep/donate/sell/repair/store suggestions, computed
// entirely locally from wear count and how long an item has been
// owned. No AI, no network call. This is a reasonable fit for a local
// fallback: it can't read a torn seam or judge sentimental value the
// way a photo-aware model might, but "worn 0 times in 8 months" is a
// concrete, checkable signal that doesn't need a model to act on.

export interface NeglectedItemInput {
  id: string;
  timesWorn: number;
  ageDays: number;
}

export interface LocalCleanupSuggestion {
  id: string;
  action: "keep" | "donate" | "sell" | "repair" | "store";
  reason: string;
}

export function buildLocalCleanupSuggestions(
  items: NeglectedItemInput[]
): LocalCleanupSuggestion[] {
  return (items || []).map((item) => {
    const worn = item.timesWorn ?? 0;
    const age = item.ageDays ?? 0;

    // Genuinely never worn and owned a long while: the clearest,
    // least speculative signal available without actually seeing the
    // item's condition or knowing why it hasn't been worn.
    if (worn === 0 && age >= 180) {
      return {
        id: item.id,
        action: "donate",
        reason: `Never worn in ${Math.round(age / 30)} months, might suit someone else better.`,
      };
    }
    if (worn === 0 && age >= 90) {
      return {
        id: item.id,
        action: "sell",
        reason: `Unworn for ${Math.round(age / 30)} months but still fairly new, could be worth reselling.`,
      };
    }
    if (worn === 0) {
      return {
        id: item.id,
        action: "keep",
        reason: `Recently added and not worn yet, give it more time before deciding.`,
      };
    }
    if (worn <= 2 && age >= 270) {
      return {
        id: item.id,
        action: "store",
        reason: `Worn only ${worn}× over ${Math.round(age / 30)} months, maybe seasonal, worth storing rather than donating outright.`,
      };
    }
    return {
      id: item.id,
      action: "keep",
      reason: `Worn ${worn}× so far, still getting some use.`,
    };
  });
}
