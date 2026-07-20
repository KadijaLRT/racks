"use client";

import { useEffect, useState } from "react";
import { AlertCircle, Check, Loader2, X } from "lucide-react";
import { cropDataUrlByBox } from "@/lib/image";
import { closetStore } from "@/lib/storage";
import type { ClosetItem, ItemCategory } from "@/lib/types";
import { CATEGORIES, categoryEmoji } from "@/lib/categories";

interface DetectedItem {
  name: string;
  category: ItemCategory;
  tags: Record<string, string>;
  box: { x: number; y: number; width: number; height: number };
  croppedImage: string | null;
  selected: boolean;
}

export default function BulkImportSheet({
  screenshotDataUrl,
  onClose,
  onImported,
}: {
  screenshotDataUrl: string;
  onClose: () => void;
  onImported: (items: ClosetItem[]) => void;
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [detected, setDetected] = useState<DetectedItem[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/tag-multi-item", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ image: screenshotDataUrl }),
        });
        const data = await res.json().catch(() => ({}));
        if (data?.error) throw new Error(data.error);

        const rawItems = data?.items || [];
        if (rawItems.length === 0) {
          if (!cancelled) setError("Couldn't identify any distinct items in that screenshot.");
          return;
        }

        const withCrops = await Promise.all(
          rawItems.map(async (item: Omit<DetectedItem, "croppedImage" | "selected">) => {
            const croppedImage = await cropDataUrlByBox(screenshotDataUrl, item.box);
            return {
              ...item,
              croppedImage,
              // If we couldn't get a real thumbnail for this item, default
              // it to unselected rather than silently including it (with
              // no photo, or worse, the wrong photo).
              selected: croppedImage !== null,
            };
          })
        );
        if (!cancelled) setDetected(withCrops);
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Couldn't process that screenshot."
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [screenshotDataUrl]);

  function toggle(index: number) {
    setDetected((prev) =>
      prev.map((item, i) => (i === index ? { ...item, selected: !item.selected } : item))
    );
  }

  function updateCategory(index: number, category: ItemCategory) {
    setDetected((prev) =>
      prev.map((item, i) => (i === index ? { ...item, category } : item))
    );
  }

  async function saveSelected() {
    const toSave = detected.filter((i) => i.selected);
    if (toSave.length === 0) return;
    setSaving(true);
    try {
      const saved = await Promise.all(
        toSave.map((item) =>
          closetStore.create({
            category: item.category,
            image: item.croppedImage || "",
            name: item.name,
            tags: item.tags || {},
            laundryStatus: "clean",
            timesWorn: 0,
          })
        )
      );
      onImported(saved);
    } finally {
      setSaving(false);
    }
  }

  const selectedCount = detected.filter((i) => i.selected).length;

  return (
    <div className="fixed inset-0 z-50 flex flex-col md:items-center md:justify-center bg-black/40">
      <div className="mt-auto md:mt-0 md:max-w-lg md:w-full bg-cream rounded-t-3xl md:rounded-3xl max-h-[92vh] flex flex-col pb-safe">
        <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-clay-100">
          <div>
            <h2 className="text-base font-medium text-stone-800">Bulk import</h2>
            <p className="text-xs text-stone-400">Review what we found</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-clay-50" aria-label="Close">
            <X size={18} className="text-stone-500" />
          </button>
        </div>

        <div className="overflow-y-auto px-5 py-4 space-y-3 flex-1">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 size={22} className="animate-spin text-emerald-600" />
            </div>
          ) : error ? (
            <div className="rounded-xl bg-clay-50 text-clay-700 text-xs px-3 py-2">
              {error}
            </div>
          ) : (
            detected.map((item, i) => (
              <div
                key={i}
                className={`flex gap-3 rounded-2xl p-3 ${
                  item.selected ? "bg-white" : "bg-cream-100 opacity-60"
                }`}
              >
                <button
                  onClick={() => toggle(i)}
                  className="w-16 h-20 rounded-xl overflow-hidden bg-clay-50 shrink-0 relative"
                  aria-label={item.selected ? `Deselect ${item.name}` : `Select ${item.name}`}
                >
                  {item.croppedImage ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={item.croppedImage}
                      alt={item.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center gap-1 text-clay-500">
                      <span className="text-lg">{categoryEmoji(item.category)}</span>
                      <AlertCircle size={12} />
                    </div>
                  )}
                  {item.selected ? (
                    <div className="absolute top-1 right-1 bg-emerald-600 rounded-full p-0.5">
                      <Check size={10} className="text-cream" />
                    </div>
                  ) : null}
                </button>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-stone-700 truncate">{item.name}</p>
                  {!item.croppedImage ? (
                    <p className="text-[11px] text-clay-700 mt-0.5">
                      Couldn&apos;t crop a photo for this one, will save
                      without a picture unless you add one later.
                    </p>
                  ) : null}
                  <select
                    value={item.category}
                    onChange={(e) => updateCategory(i, e.target.value as ItemCategory)}
                    className="mt-1 text-xs rounded-lg border border-clay-100 px-2 py-1 bg-white"
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c.value} value={c.value}>
                        {c.emoji} {c.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            ))
          )}
        </div>

        {!loading && !error ? (
          <div className="px-5 py-4 border-t border-clay-100">
            <button
              onClick={saveSelected}
              disabled={saving || selectedCount === 0}
              className="w-full rounded-xl bg-emerald-600 text-cream py-3 text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {saving ? <Loader2 size={16} className="animate-spin" /> : null}
              {saving
                ? "Adding..."
                : `Add ${selectedCount} item${selectedCount === 1 ? "" : "s"} to closet`}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
