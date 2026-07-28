// Suggests attribute values based on the person's own tagging history
// for the same category + subcategory, entirely locally, zero AI.
// Requires a real majority (>50% of matching items), not just "someone
// picked this once," and never overrides a value that's already set.

import type { ClosetItem } from "./types";

export function computeHistoryTagSuggestions(
  item: Pick<ClosetItem, "id" | "category" | "subcategory" | "tags">,
  allItems: ClosetItem[]
): Record<string, string> {
  if (!item.subcategory?.trim()) return {};
  const matches = allItems.filter(
    (i) =>
      i.id !== item.id &&
      i.category === item.category &&
      (i.subcategory || "").trim().toLowerCase() === item.subcategory!.trim().toLowerCase()
  );
  if (matches.length < 2) return {};

  const valueCounts = new Map<string, Map<string, number>>();
  for (const match of matches) {
    for (const [key, rawValue] of Object.entries(match.tags || {})) {
      const value = rawValue.split(",")[0]?.trim();
      if (!value) continue;
      if (!valueCounts.has(key)) valueCounts.set(key, new Map());
      const counts = valueCounts.get(key)!;
      counts.set(value, (counts.get(value) || 0) + 1);
    }
  }

  const suggestions: Record<string, string> = {};
  for (const [key, counts] of valueCounts.entries()) {
    if (item.tags?.[key]) continue;
    const [topValue, topCount] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
    if (topCount / matches.length > 0.5) {
      suggestions[key] = topValue;
    }
  }
  return suggestions;
}
