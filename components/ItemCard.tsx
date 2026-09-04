"use client";

import { Pin } from "lucide-react";
import type { ClosetItem } from "@/lib/types";
import { categoryEmoji } from "@/lib/categories";

interface ItemCardProps {
  item: ClosetItem;
  onSelect: (item: ClosetItem) => void;
  selectMode?: boolean;
  isSelected?: boolean;
}

// Matches the wording used in ItemEditSheet's category-aware status
// field: "laundry" only makes literal sense for actual clothing, shoes
// and accessories get "condition" framing instead. Makeup has no
// status badge at all, same reasoning as the edit sheet: it isn't part
// of the wearable/laundry concept in this app.
function dirtyBadgeLabel(category: ClosetItem["category"]): string | null {
  if (category === "shoes") return "Needs cleaning";
  if (category === "accessory") return "Needs cleaning";
  if (category === "makeup") return null;
  return "In the wash";
}

export default function ItemCard({ item, onSelect, selectMode, isSelected }: ItemCardProps) {
  const name = item?.name || "Untitled item";
  const image = item?.image || "";
  const badgeLabel =
    item?.laundryStatus === "dirty" ? dirtyBadgeLabel(item?.category) : null;
  const dirty = Boolean(badgeLabel);

  return (
    <button
      onClick={() => onSelect(item)}
      aria-label={
        selectMode ? (isSelected ? `Deselect ${name}` : `Select ${name}`) : `View ${name}`
      }
      aria-pressed={selectMode ? isSelected : undefined}
      className={`relative aspect-[3/4] w-full rounded-2xl overflow-hidden bg-cream-100 text-left group ${
        selectMode && !isSelected ? "opacity-60" : ""
      }`}
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

      {selectMode ? (
        <div
          className={`absolute top-2 left-2 w-5 h-5 rounded-full border-2 flex items-center justify-center ${
            isSelected
              ? "bg-emerald-600 border-emerald-600"
              : "bg-black/20 border-white"
          }`}
        >
          {isSelected ? (
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
              <path
                d="M5 13l4 4L19 7"
                stroke="white"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          ) : null}
        </div>
      ) : null}

      {item?.pinned ? (
        <div className="absolute top-2 right-2 bg-cream/90 rounded-full p-1">
          <Pin size={12} className="text-clay-700" fill="currentColor" />
        </div>
      ) : null}

      {dirty ? (
        <div className="absolute bottom-0 left-0 right-0 bg-clay-500/90 text-cream text-[10px] text-center py-0.5">
          {badgeLabel}
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
