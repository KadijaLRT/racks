"use client";

import type { ClosetItem } from "@/lib/types";

const PHASES: { label: string; categories: string[] }[] = [
  { label: "Base", categories: ["top", "bottom", "dress", "set"] },
  { label: "Outer", categories: ["outerwear"] },
  { label: "Shoes", categories: ["shoes"] },
  { label: "Accessories", categories: ["accessory"] },
];

export default function OutfitItemStrip({
  itemIds,
  items,
  onSwap,
}: {
  itemIds: string[] | undefined;
  items: ClosetItem[] | undefined;
  // When provided, each item becomes tappable to open a local (no AI)
  // swap picker for that one piece, instead of needing to regenerate
  // the whole outfit over a single disliked or dirty item.
  onSwap?: (item: ClosetItem) => void;
}) {
  const byId = new Map((items || []).map((i) => [i.id, i]));
  const resolved = (itemIds || [])
    .map((id) => byId.get(id))
    .filter(Boolean) as ClosetItem[];

  if (resolved.length === 0) {
    return <p className="text-xs text-stone-400">No items resolved for this look.</p>;
  }

  function renderItem(item: ClosetItem) {
    const content = (
      <div
        className="shrink-0 w-16 aspect-[3/4] rounded-xl overflow-hidden bg-cream-100 relative"
        title={item.name}
      >
        {item.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.image}
            alt={item.name || "Closet item"}
            className="w-full h-full object-cover"
          />
        ) : null}
        {onSwap ? (
          <span className="absolute bottom-0.5 right-0.5 bg-black/55 rounded-full px-1 py-0.5 text-[8px] text-cream">
            Swap
          </span>
        ) : null}
      </div>
    );
    return onSwap ? (
      <button key={item.id} onClick={() => onSwap(item)} aria-label={`Swap ${item.name}`}>
        {content}
      </button>
    ) : (
      <div key={item.id}>{content}</div>
    );
  }

  // Grouping into visible layer phases (base/outer/shoes/accessories)
  // so the outfit reads as an assembled whole rather than an
  // undifferentiated row of thumbnails, one glance shows what's the
  // foundation vs. what's layered on top.
  const phased = PHASES.map((phase) => ({
    label: phase.label,
    items: resolved.filter((i) => phase.categories.includes(i.category)),
  })).filter((p) => p.items.length > 0);

  return (
    <div className="space-y-2">
      {phased.map((phase) => (
        <div key={phase.label}>
          <p className="text-[10px] text-stone-400 mb-1">{phase.label}</p>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {phase.items.map(renderItem)}
          </div>
        </div>
      ))}
    </div>
  );
}
