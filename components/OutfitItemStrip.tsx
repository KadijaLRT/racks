"use client";

import type { ClosetItem } from "@/lib/types";

export default function OutfitItemStrip({
  itemIds,
  items,
}: {
  itemIds: string[] | undefined;
  items: ClosetItem[] | undefined;
}) {
  const byId = new Map((items || []).map((i) => [i.id, i]));
  const resolved = (itemIds || [])
    .map((id) => byId.get(id))
    .filter(Boolean) as ClosetItem[];

  if (resolved.length === 0) {
    return <p className="text-xs text-stone-400">No items resolved for this look.</p>;
  }

  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      {resolved.map((item) => (
        <div
          key={item.id}
          className="shrink-0 w-16 aspect-[3/4] rounded-xl overflow-hidden bg-cream-100"
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
        </div>
      ))}
    </div>
  );
}
