import type { ItemCategory } from "@/lib/types";

export const CATEGORIES: { value: ItemCategory; label: string; emoji: string }[] = [
  { value: "top", label: "Tops", emoji: "\u{1F455}" },
  { value: "bottom", label: "Bottoms", emoji: "\u{1F456}" },
  { value: "dress", label: "Dresses", emoji: "\u{1F457}" },
  { value: "set", label: "Sets", emoji: "\u{1F9E5}" },
  { value: "outerwear", label: "Outerwear", emoji: "\u{1F9E3}" },
  { value: "shoes", label: "Shoes", emoji: "\u{1F45F}" },
  { value: "accessory", label: "Accessories", emoji: "\u{1F45C}" },
  { value: "makeup", label: "Makeup", emoji: "\u{1F484}" },
];

export function categoryLabel(value: ItemCategory): string {
  return CATEGORIES.find((c) => c.value === value)?.label || value;
}

export function categoryEmoji(value: ItemCategory): string {
  return CATEGORIES.find((c) => c.value === value)?.emoji || "\u{1F455}";
}
