"use client";

import { useEffect, useState } from "react";
import { X, Loader2 } from "lucide-react";
import OutfitItemStrip from "@/components/OutfitItemStrip";
import type { ClosetItem } from "@/lib/types";

interface RemixOutfit {
  label: string;
  itemIds: string[];
  reasoning: string;
}

export default function RemixSheet({
  anchorItem,
  closetItems,
  onClose,
}: {
  anchorItem: ClosetItem;
  closetItems: ClosetItem[];
  onClose: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [outfits, setOutfits] = useState<RemixOutfit[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/remix-item", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ anchorItem, items: closetItems }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        if (data?.error) {
          setError(data.error);
          return;
        }
        setOutfits(data?.outfits || []);
      })
      .catch(() => {
        if (!cancelled) setError("Couldn't build outfits around this item right now.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
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
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 size={22} className="animate-spin text-emerald-600" />
            </div>
          ) : error ? (
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
