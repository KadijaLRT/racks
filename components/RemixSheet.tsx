"use client";

import { useMemo } from "react";
import { X } from "lucide-react";
import OutfitItemStrip from "@/components/OutfitItemStrip";
import type { ClosetItem } from "@/lib/types";
import { buildLocalRemix } from "@/lib/localRemix";

interface RemixOutfit {
  label: string;
  itemIds: string[];
  reasoning: string;
}

// Entirely local, zero AI, zero network call: unlike Looks (which
// needs to interpret an occasion/mood in free text), Remix has no
// language input at all, it's purely combinatorial (a fixed anchor
// item plus the rest of the closet), which local weighted selection
// handles just as well as a model would, without the Groq usage this
// used to cost on every single open (it previously fired automatically
// on mount, not even behind a button tap).
export default function RemixSheet({
  anchorItem,
  closetItems,
  onClose,
}: {
  anchorItem: ClosetItem;
  closetItems: ClosetItem[];
  onClose: () => void;
}) {
  const { error, outfits } = useMemo(() => {
    const rest = (closetItems || []).filter(
      (i) => i?.id !== anchorItem.id && i?.laundryStatus === "clean"
    );
    if (rest.length === 0) {
      return {
        error:
          "Not enough other clean items in your closet to build outfits around this one yet.",
        outfits: [] as RemixOutfit[],
      };
    }
    return { error: "", outfits: buildLocalRemix(anchorItem, closetItems) };
  }, [anchorItem, closetItems]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col md:items-center md:justify-center bg-black/40">
      <div className="mt-auto md:mt-0 md:max-w-lg md:w-full bg-cream rounded-t-3xl md:rounded-3xl max-h-[90vh] flex flex-col pb-safe">
        <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-clay-100">
          <div className="min-w-0">
            <h2 className="text-base font-medium text-stone-800 truncate">
              Remix: {anchorItem.name}
            </h2>
            <p className="text-xs text-stone-400">3 ways to wear it</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-clay-50 shrink-0" aria-label="Close">
            <X size={18} className="text-stone-500" />
          </button>
        </div>

        <div className="overflow-y-auto px-5 py-4 space-y-4 flex-1">
          {error ? (
            <div className="rounded-xl bg-clay-50 text-clay-700 text-xs px-3 py-2">
              {error}
            </div>
          ) : outfits.length === 0 ? (
            <p className="text-sm text-stone-500 text-center py-8">
              Couldn&apos;t put together outfits around this item yet.
            </p>
          ) : (
            outfits.map((outfit, i) => (
              <div key={i} className="bg-white rounded-2xl p-3 space-y-2">
                <p className="text-xs font-medium text-emerald-700">{outfit.label}</p>
                <OutfitItemStrip itemIds={outfit.itemIds} items={closetItems} />
                <p className="text-xs text-stone-500">{outfit.reasoning}</p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
