"use client";

import { Pin } from "lucide-react";
import type { ClosetItem } from "@/lib/types";
import { categoryEmoji } from "@/lib/categories";

interface ItemCardProps {
  item: ClosetItem;
  onSelect: (item: ClosetItem) => void;
}

export default function ItemCard({ item, onSelect }: ItemCardProps) {
  const name = item?.name || "Untitled item";
  const image = item?.image || "";
  const dirty = item?.laundryStatus === "dirty";

  return (
    <button
      onClick={() => onSelect(item)}
      className="relative aspect-[3/4] w-full rounded-2xl overflow-hidden bg-cream-100 text-left group"
    >
      {image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={image}
          alt={name}
          className="w-full h-full object-cover"
          loading="lazy"
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center text-3xl bg-clay-50">
          {categoryEmoji(item?.category)}
        </div>
      )}

      {item?.pinned ? (
        <div className="absolute top-2 right-2 bg-cream/90 rounded-full p-1">
          <Pin size={12} className="text-clay-700" fill="currentColor" />
        </div>
      ) : null}

      {dirty ? (
        <div className="absolute bottom-0 left-0 right-0 bg-clay-500/90 text-cream text-[10px] text-center py-0.5">
          In the wash
        </div>
      ) : null}

      <div
        className={`absolute inset-x-0 bg-gradient-to-t from-black/55 via-black/10 to-transparent px-2 pt-4 pb-1.5 ${
          dirty ? "bottom-4" : "bottom-0"
        }`}
      >
        <p className="text-cream text-[11px] font-medium leading-tight line-clamp-2">
          {name}
        </p>
      </div>
    </button>
  );
}
