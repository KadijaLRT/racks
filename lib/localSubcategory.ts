// Guesses a subcategory from words the person already wrote (the item
// name, plus existing tag values), entirely locally, zero AI. Pixels
// can't tell a boot from a sneaker, but a name like "Black suede boots"
// or "Ribbed hooded sweatshirt" usually can. Only matches the category's
// own known subcategories, and only when exactly one option matches, so
// an ambiguous name leaves the field alone instead of guessing.

import { SUBCATEGORY_SUGGESTIONS } from "./types";
import type { ItemCategory } from "./types";

// Extra words people commonly use for a known subcategory.
const SYNONYMS: Record<string, string[]> = {
  sneakers: ["sneaker", "trainer", "trainers", "kicks"],
  boots: ["boot", "bootie", "booties", "ankle boot", "combat boot"],
  heels: ["heel", "pump", "pumps", "stiletto", "stilettos", "platform", "wedge"],
  sandals: ["sandal"],
  slides: ["slide"],
  "flip flops": ["flip flop", "flip-flop", "flipflop", "thong sandal"],
  flats: ["flat", "loafer", "loafers", "ballet flat", "mule", "mules"],
  "t-shirt": ["tee", "t shirt", "tshirt", "t-shirt"],
  tank: ["tank top", "tank"],
  hoodie: ["hooded", "hoody"],
  sweatshirt: ["crewneck", "pullover"],
  sweater: ["knit", "jumper"],
  jeans: ["jean", "denim pants"],
  pants: ["trouser", "trousers", "slacks", "joggers", "sweatpants", "leggings pants"],
  shorts: ["short"],
  skirt: ["skirts"],
  jacket: ["bomber", "moto", "puffer", "windbreaker", "denim jacket"],
  coat: ["trench", "peacoat", "parka", "overcoat"],
  blazer: ["blazers"],
  "matching set": ["set", "two piece", "two-piece", "2 piece", "co-ord", "coord"],
  "button-down": ["button down", "button-up", "button up", "oxford"],
  "crop top": ["cropped"],
  bodysuit: ["body suit"],
  "one-piece": ["one piece", "swimsuit"],
  bikini: ["bikinis"],
  necklace: ["pendant"],
  earrings: ["earring", "hoops", "studs"],
  bag: ["purse", "handbag", "tote", "clutch", "crossbody", "backpack"],
};

function normalize(text: string): string {
  return ` ${text.toLowerCase().replace(/[^a-z0-9\s-]/g, " ").replace(/\s+/g, " ").trim()} `;
}

export function inferSubcategoryFromText(
  category: ItemCategory,
  text: string
): string | null {
  const haystack = normalize(text);
  if (haystack.trim().length === 0) return null;
  const options = SUBCATEGORY_SUGGESTIONS[category] || [];
  const matches: string[] = [];
  for (const option of options) {
    const words = [option, ...(SYNONYMS[option] || [])];
    const hit = words.some((w) => {
      const needle = normalize(w);
      return haystack.includes(needle) || haystack.includes(needle.trimEnd() + "s ");
    });
    if (hit) matches.push(option);
  }
  return matches.length === 1 ? matches[0] : null;
}
