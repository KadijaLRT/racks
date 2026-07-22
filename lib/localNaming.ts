// Builds a reasonable item name entirely from local data (category,
// subcategory, and quick-pick tags), with zero AI involvement. This is
// what powers manual/no-AI cataloging: with "Auto-tag new items" off in
// Settings, an item saves instantly with no Groq call at all, and this
// fills in a real name as soon as someone picks a color and/or
// subcategory, instead of leaving "Untitled item" as the only option
// until they type something themselves.

import { categoryLabel } from "./categories";
import type { ItemCategory } from "./types";

export function buildLocalItemName(
  category: ItemCategory,
  subcategory: string,
  tags: Record<string, string>
): string {
  const color = tags?.color?.split(",")[0]?.trim();
  const pattern = tags?.pattern?.split(",")[0]?.trim();
  const noun = subcategory.trim() || categoryLabel(category).replace(/s$/, "");

  const parts = [color, pattern && pattern !== "Solid" ? pattern : null, noun].filter(
    Boolean
  );

  if (parts.length === 0) return "";
  // Capitalize the noun/subcategory word(s) since subcategory
  // suggestions are stored lowercase (e.g. "button-down"), while color
  // and pattern tags already come capitalized from the quick-picks.
  return parts
    .map((p, i) => (i === parts.length - 1 ? capitalizeWords(p as string) : p))
    .join(" ");
}

function capitalizeWords(s: string): string {
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}
