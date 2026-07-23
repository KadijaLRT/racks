// Computes closet patterns and gaps entirely from local data, no AI,
// no network call. Genuinely a good fit for a local fallback since
// most of what "insights" surfaces is real arithmetic on the closet
// (category counts, wear distribution) rather than anything requiring
// actual language understanding.

import type { ClosetItem } from "./types";

export interface LocalInsightsResult {
  patterns: string[];
  gaps: string[];
}

export function buildLocalInsights(items: ClosetItem[]): LocalInsightsResult {
  const all = items || [];
  const patterns: string[] = [];
  const gaps: string[] = [];

  if (all.length === 0) {
    return { patterns: [], gaps: [] };
  }

  const byCategory: Record<string, ClosetItem[]> = {};
  for (const item of all) {
    const cat = item?.category || "unknown";
    byCategory[cat] = byCategory[cat] || [];
    byCategory[cat].push(item);
  }

  // Wear distribution.
  const neverWorn = all.filter((i) => (i?.timesWorn ?? 0) === 0);
  const wornOnce = all.filter((i) => (i?.timesWorn ?? 0) === 1);
  const heavilyWorn = all.filter((i) => (i?.timesWorn ?? 0) >= 10);
  const totalWears = all.reduce((sum, i) => sum + (i?.timesWorn ?? 0), 0);
  const avgWears = totalWears / all.length;

  patterns.push(
    `${all.length} items catalogued across ${Object.keys(byCategory).length} categories, averaging ${avgWears.toFixed(1)} wears each.`
  );

  if (neverWorn.length > 0) {
    const pct = Math.round((neverWorn.length / all.length) * 100);
    gaps.push(
      `${neverWorn.length} item${neverWorn.length === 1 ? "" : "s"} (${pct}%) ${
        neverWorn.length === 1 ? "hasn't" : "haven't"
      } been logged as worn yet.`
    );
  }

  if (heavilyWorn.length > 0) {
    const top = [...heavilyWorn].sort((a, b) => (b.timesWorn ?? 0) - (a.timesWorn ?? 0))[0];
    patterns.push(
      `"${top.name}" is your most-reached-for piece, worn ${top.timesWorn}× so far.`
    );
  }

  // Category balance: flag categories with very few clean, wearable
  // items relative to the rest of the closet, since that's a concrete,
  // checkable gap rather than a vague "you need more variety" guess.
  const CORE_CATEGORIES = ["top", "bottom", "dress", "shoes"];
  for (const cat of CORE_CATEGORIES) {
    const items = byCategory[cat] || [];
    const clean = items.filter((i) => i?.laundryStatus === "clean");
    if (items.length === 0) {
      gaps.push(`No ${categoryPlural(cat)} catalogued yet.`);
    } else if (clean.length <= 1 && items.length <= 2) {
      gaps.push(
        `Only ${items.length} ${categoryPlural(cat)} catalogued, worth adding more for outfit variety.`
      );
    }
  }

  // Color concentration, using whatever color tags exist.
  const colorCounts: Record<string, number> = {};
  for (const item of all) {
    const color = item?.tags?.color?.split(",")[0]?.trim();
    if (color) colorCounts[color] = (colorCounts[color] || 0) + 1;
  }
  const topColor = Object.entries(colorCounts).sort((a, b) => b[1] - a[1])[0];
  if (topColor && topColor[1] >= 3) {
    patterns.push(
      `${topColor[0]} shows up ${topColor[1]} times, it's your most common color.`
    );
  }

  // Dirty/dry-clean backlog, a genuinely actionable, concrete observation.
  const dirty = all.filter((i) => i?.laundryStatus === "dirty");
  if (dirty.length >= 3) {
    gaps.push(
      `${dirty.length} items are currently marked dirty, that's cutting into what's actually available to wear.`
    );
  }

  if (wornOnce.length >= 5) {
    patterns.push(
      `${wornOnce.length} items have only been worn once, could be worth another look before they become "never worn."`
    );
  }

  return { patterns, gaps };
}

function categoryPlural(cat: string): string {
  const map: Record<string, string> = {
    top: "tops",
    bottom: "bottoms",
    dress: "dresses",
    shoes: "pairs of shoes",
  };
  return map[cat] || `${cat}s`;
}
