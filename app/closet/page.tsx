"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Plus, Loader2, Search, Camera, Images } from "lucide-react";
import BottomNav from "@/components/BottomNav";
import ItemCard from "@/components/ItemCard";
import ItemEditSheet from "@/components/ItemEditSheet";
import RemixSheet from "@/components/RemixSheet";
import BulkImportSheet from "@/components/BulkImportSheet";
import { fileToResizedDataUrl } from "@/lib/image";
import { closetStore } from "@/lib/storage";
import type { ClosetItem, ItemCategory } from "@/lib/types";
import { CATEGORIES } from "@/lib/categories";

export default function ClosetPage() {
  const [items, setItems] = useState<ClosetItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [filter, setFilter] = useState<ItemCategory | "all">("all");
  const [groupBy, setGroupBy] = useState("subcategory");
  const [search, setSearch] = useState("");
  const [pendingCategory, setPendingCategory] = useState<ItemCategory>("top");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [selected, setSelected] = useState<ClosetItem | null>(null);
  const [remixItem, setRemixItem] = useState<ClosetItem | null>(null);
  const [addPickerOpen, setAddPickerOpen] = useState(false);
  const [bulkScreenshot, setBulkScreenshot] = useState<string | null>(null);
  const [bulkProcessing, setBulkProcessing] = useState(false);
  const [addedToast, setAddedToast] = useState<{
    message: string;
    key: number;
    isError?: boolean;
  } | null>(null);
  const [retagging, setRetagging] = useState(false);
  const [retagProgress, setRetagProgress] = useState({ done: 0, total: 0 });
  const [retagSummary, setRetagSummary] = useState<{
    retagged: number;
    stillFailed: number;
    stoppedEarly: boolean;
    reason?: string;
  } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const bulkFileRef = useRef<HTMLInputElement>(null);
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Clear any pending fade-out timer on unmount so it doesn't fire
    // after the page has gone away.
    return () => {
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    };
  }, []);

  function showAddedToast(message: string, isError = false) {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setAddedToast({ message, key: Date.now(), isError });
    toastTimeoutRef.current = setTimeout(
      () => setAddedToast(null),
      isError ? 5000 : 2600
    );
  }

  useEffect(() => {
    closetStore.getAll().then((all) => {
      setItems(all || []);
      setLoaded(true);
    });
  }, []);

  // Which dimensions make sense to browse by, per category. "subcategory"
  // is a real field on the item; everything else is a tag key. Always
  // offering "Type" first since that's the most universally useful
  // grouping, plus whatever's actually distinctive for that category
  // (sleeve length for tops, silhouette for dresses, heel height for
  // shoes), so browsing reflects how someone actually thinks about
  // that category rather than one fixed grouping for everything.
  const GROUPING_OPTIONS: Record<string, { label: string; key: string }[]> = {
    top: [
      { label: "Type", key: "subcategory" },
      { label: "Sleeve Length", key: "sleeveLength" },
      { label: "Neckline", key: "neckline" },
      { label: "Color", key: "color" },
    ],
    bottom: [
      { label: "Type", key: "subcategory" },
      { label: "Fit", key: "fit" },
      { label: "Color", key: "color" },
    ],
    dress: [
      { label: "Length", key: "subcategory" },
      { label: "Silhouette", key: "dressSilhouette" },
      { label: "Neckline", key: "neckline" },
      { label: "Color", key: "color" },
    ],
    set: [
      { label: "Type", key: "subcategory" },
      { label: "Color", key: "color" },
    ],
    outerwear: [
      { label: "Type", key: "subcategory" },
      { label: "Color", key: "color" },
    ],
    shoes: [
      { label: "Type", key: "subcategory" },
      { label: "Heel Height", key: "heelHeight" },
      { label: "Color", key: "color" },
    ],
    accessory: [
      { label: "Type", key: "subcategory" },
      { label: "Jewelry Type", key: "jewelryType" },
      { label: "Material", key: "material" },
      { label: "Color", key: "color" },
    ],
    swimwear: [
      { label: "Type", key: "subcategory" },
      { label: "Top Style", key: "swimsuitTop" },
      { label: "Bottom Style", key: "swimsuitBottom" },
      { label: "Color", key: "color" },
    ],
    makeup: [
      { label: "Type", key: "subcategory" },
      { label: "Makeup Type", key: "makeupType" },
    ],
  };

  // Reset to that category's first grouping option whenever the
  // category filter changes, rather than carrying over a dimension
  // (like "Sleeve Length") that doesn't exist for the new category.
  function selectFilter(next: ItemCategory | "all") {
    setFilter(next);
    setGroupBy("subcategory");
  }

  const filteredItems = useMemo(() => {
    const query = search.trim().toLowerCase();
    return (items || []).filter((item) => {
      if (filter !== "all" && item?.category !== filter) return false;
      if (!query) return true;
      const haystack = [
        item?.name || "",
        item?.subcategory || "",
        ...Object.values(item?.tags || {}),
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [items, filter, search]);

  // Once a specific category is selected (not "All"), group the grid
  // into labeled sections by whichever dimension is currently chosen
  // (type/subcategory by default, or sleeve length, silhouette, color,
  // etc. via the Group by row) instead of one flat list, so browsing a
  // category is organized by what actually distinguishes those items,
  // not just chronological order. Left flat for "All", since mixing
  // subcategory vocabularies across categories (a bag next to a
  // sweater) wouldn't read as a coherent grouping.
  const groupedSections = useMemo(() => {
    if (filter === "all") return null;
    const groups = new Map<string, ClosetItem[]>();
    for (const item of filteredItems) {
      const raw =
        groupBy === "subcategory"
          ? item?.subcategory || ""
          : (item?.tags || {})[groupBy] || "";
      // Quick-pick tags can hold multiple comma-joined values (e.g.
      // "Short Sleeve, Long Sleeve" isn't realistic, but "Puff / Juliet,
      // Bell Sleeve" style multi-selects are); group by the first value
      // rather than creating a combinatorial explosion of section labels.
      const key = raw.split(",")[0]?.trim().toLowerCase() || "other";
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(item);
    }
    return [...groups.entries()]
      .sort((a, b) => {
        if (a[0] === "other") return 1;
        if (b[0] === "other") return -1;
        return b[1].length - a[1].length; // largest groups first
      })
      .map(([key, groupItems]) => ({
        label: key === "other" ? "Other" : key.replace(/\b\w/g, (c) => c.toUpperCase()),
        items: groupItems,
      }));
  }, [filteredItems, filter, groupBy]);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setAddPickerOpen(false);
    setUploading(true);
    setUploadError("");
    try {
      const dataUrl = await fileToResizedDataUrl(file);
      if (!dataUrl) throw new Error("Couldn't read that photo, try another one.");

      // Auto-tagging on upload was removed: every item now saves
      // instantly with zero Groq calls, cutting AI usage at the single
      // highest-volume point in the app (every photo added). Tagging
      // happens only when explicitly requested afterward, either the
      // "Retag with AI" button on an individual item, or manually via
      // the quick-pick chips (which auto-suggest a name locally as soon
      // as a subcategory/color is picked, no AI needed for that either).
      const saved = await closetStore.create({
        category: pendingCategory,
        subcategory: undefined,
        image: dataUrl,
        name: "Untitled item",
        tags: {},
        laundryStatus: "clean",
        timesWorn: 0,
      });
      setItems((prev) => [saved, ...(prev || [])]);
      showAddedToast(`Added \u201c${saved?.name || "Untitled item"}\u201d`);
    } catch (err) {
      setUploadError(
        err instanceof Error ? err.message : "That photo couldn't be added."
      );
    } finally {
      setUploading(false);
    }
  }

  async function handleSave(updated: ClosetItem) {
    await closetStore.update(updated);
    setItems((prev) =>
      (prev || []).map((i) => (i.id === updated.id ? updated : i))
    );
    setSelected(null);
  }

  async function handleDelete(id: string) {
    await closetStore.remove(id);
    setItems((prev) => (prev || []).filter((i) => i.id !== id));
    setSelected(null);
  }

  // Re-runs AI tagging for every item still named "Untitled item" (the
  // fallback used when tagging failed at add-time, most commonly from
  // hitting Groq's rate limit). Sequential with a short pause between
  // calls, since firing them all at once is exactly what caused the
  // rate limit in the first place. If a rate-limit-style error comes
  // back mid-batch, this stops immediately rather than burning through
  // the rest of the list on calls that would just fail the same way,
  // and reports how far it got.
  async function retagUntitledItems() {
    const targets = (items || []).filter((i) => i?.name === "Untitled item");
    if (targets.length === 0) return;

    setRetagging(true);
    setRetagSummary(null);
    setRetagProgress({ done: 0, total: targets.length });

    let retagged = 0;
    let stillFailed = 0;
    let stoppedEarly = false;
    let stopReason = "";

    for (let i = 0; i < targets.length; i++) {
      const target = targets[i];
      try {
        const res = await fetch("/api/tag-item", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ image: target.image, category: target.category }),
        });
        const tagged = await res.json().catch(() => ({}));

        if (tagged?.error) {
          stillFailed += 1;
          const reason = String(tagged.error);
          // A rate-limit message means every remaining call would fail
          // the same way right now; stop instead of wasting the rest
          // of the batch (and the daily quota) on guaranteed failures.
          if (/rate limit|usage limit/i.test(reason)) {
            stoppedEarly = true;
            stopReason = reason;
            break;
          }
        } else if (tagged?.name) {
          const updated: ClosetItem = {
            ...target,
            name: tagged.name,
            subcategory: tagged.subcategory || target.subcategory,
            tags: { ...(target.tags || {}), ...(tagged.tags || {}) },
          };
          await closetStore.update(updated);
          setItems((prev) =>
            (prev || []).map((it) => (it.id === updated.id ? updated : it))
          );
          retagged += 1;
        } else {
          stillFailed += 1;
        }
      } catch {
        stillFailed += 1;
      }

      setRetagProgress({ done: i + 1, total: targets.length });

      // Small gap between requests so this batch itself doesn't trip
      // the per-minute limit on a closet with many untitled items.
      if (i < targets.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 1500));
      }
    }

    setRetagging(false);
    setRetagSummary({ retagged, stillFailed, stoppedEarly, reason: stopReason });
  }

  async function handleBulkFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setAddPickerOpen(false);
    setBulkProcessing(true);
    setUploadError("");
    try {
      const dataUrl = await fileToResizedDataUrl(file, 1400, 0.9);
      if (!dataUrl) throw new Error("Couldn't read that screenshot.");
      setBulkScreenshot(dataUrl);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Couldn't read that screenshot.");
    } finally {
      setBulkProcessing(false);
    }
  }

  return (
    <main className="min-h-screen pb-28 pt-safe bg-cream">
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFile}
      />
      <input
        ref={bulkFileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleBulkFile}
      />

      <div className="max-w-md mx-auto px-4 pt-4">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-semibold text-stone-800">Closet</h1>
          <span className="text-xs text-stone-400">
            {(items || []).length} {(items || []).length === 1 ? "item" : "items"}
          </span>
        </div>

        <div className="relative mb-3">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400"
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search your closet"
            className="w-full rounded-xl border border-clay-100 bg-white pl-9 pr-3 py-2.5 text-sm"
          />
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1 mb-2 -mx-4 px-4">
          <button
            onClick={() => selectFilter("all")}
            className={`shrink-0 px-3.5 py-1.5 rounded-full text-xs font-medium ${
              filter === "all"
                ? "bg-emerald-600 text-cream"
                : "bg-cream-100 text-stone-500"
            }`}
          >
            All
          </button>
          {CATEGORIES.map((c) => (
            <button
              key={c.value}
              onClick={() => selectFilter(c.value)}
              className={`shrink-0 px-3.5 py-1.5 rounded-full text-xs font-medium ${
                filter === c.value
                  ? "bg-emerald-600 text-cream"
                  : "bg-cream-100 text-stone-500"
              }`}
            >
              {c.emoji} {c.label}
            </button>
          ))}
        </div>

        {filter !== "all" && GROUPING_OPTIONS[filter] ? (
          <div className="flex items-center gap-2 overflow-x-auto pb-1 mb-4 -mx-4 px-4">
            <span className="shrink-0 text-[11px] text-stone-400">Group by</span>
            {GROUPING_OPTIONS[filter].map((opt) => (
              <button
                key={opt.key}
                onClick={() => setGroupBy(opt.key)}
                className={`shrink-0 px-2.5 py-1 rounded-full text-[11px] ${
                  groupBy === opt.key
                    ? "bg-stone-700 text-cream"
                    : "bg-cream-100 text-stone-500"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        ) : null}

        {uploadError ? (
          <div className="mb-3 rounded-xl bg-clay-50 text-clay-700 text-xs px-3 py-2">
            {uploadError}
          </div>
        ) : null}

        {(() => {
          const untitledCount = (items || []).filter(
            (i) => i?.name === "Untitled item"
          ).length;
          if (untitledCount === 0 && !retagging && !retagSummary) return null;

          return (
            <div className="mb-3 rounded-xl border border-clay-100 bg-white px-3 py-2.5">
              {retagging ? (
                <div className="flex items-center gap-2 text-xs text-stone-600">
                  <Loader2 size={14} className="animate-spin shrink-0" />
                  Retagging {retagProgress.done} of {retagProgress.total}...
                </div>
              ) : retagSummary ? (
                <div className="text-xs text-stone-600">
                  {retagSummary.retagged > 0
                    ? `Retagged ${retagSummary.retagged} item${retagSummary.retagged === 1 ? "" : "s"}.`
                    : null}
                  {retagSummary.stoppedEarly ? (
                    <span className="block mt-0.5 text-clay-700">
                      Stopped early: {retagSummary.reason}
                    </span>
                  ) : retagSummary.stillFailed > 0 ? (
                    <span className="block mt-0.5 text-stone-500">
                      {retagSummary.stillFailed} still couldn&rsquo;t be tagged.
                    </span>
                  ) : null}
                  <button
                    onClick={() => setRetagSummary(null)}
                    className="mt-1.5 text-emerald-700 font-medium"
                  >
                    Dismiss
                  </button>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs text-stone-600">
                    {untitledCount} item{untitledCount === 1 ? "" : "s"} still need
                    {untitledCount === 1 ? "s" : ""} tagging.
                  </p>
                  <button
                    onClick={retagUntitledItems}
                    className="shrink-0 text-xs font-medium text-emerald-700 whitespace-nowrap"
                  >
                    Retag now
                  </button>
                </div>
              )}
            </div>
          );
        })()}

        {loaded && filteredItems.length === 0 ? (
          <div className="text-center py-16 px-6">
            <p className="text-sm text-stone-500">
              {(items || []).length === 0
                ? "Your closet is empty. Add your first item to get started."
                : "No items match that search or filter."}
            </p>
          </div>
        ) : groupedSections && groupedSections.length > 1 ? (
          <div className="space-y-5">
            {groupedSections.map((section) => (
              <div key={section.label}>
                <p className="text-xs font-medium text-stone-500 mb-2">
                  {section.label}{" "}
                  <span className="text-stone-400">({section.items.length})</span>
                </p>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {section.items.map((item) => (
                    <ItemCard key={item.id} item={item} onSelect={setSelected} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {filteredItems.map((item) => (
              <ItemCard key={item.id} item={item} onSelect={setSelected} />
            ))}
          </div>
        )}
      </div>

      <button
        onClick={() => setAddPickerOpen(true)}
        disabled={uploading}
        className="fixed bottom-24 right-5 z-30 w-14 h-14 rounded-full bg-emerald-600 text-cream flex items-center justify-center shadow-lg active:scale-95 transition-transform disabled:opacity-60"
        aria-label="Add item"
      >
        {uploading ? (
          <Loader2 size={22} className="animate-spin" />
        ) : (
          <Plus size={24} />
        )}
      </button>

      {addedToast ? (
        <div
          key={addedToast.key}
          className={`fixed bottom-24 left-1/2 z-30 bg-stone-800/95 text-cream shadow-lg animate-toast-fade pointer-events-none ${
            addedToast.isError
              ? "max-w-[90%] w-80 rounded-2xl text-left text-xs px-4 py-3 leading-snug"
              : "max-w-[85%] rounded-full text-xs font-medium px-4 py-2"
          }`}
        >
          {addedToast.message}
        </div>
      ) : null}

      {addPickerOpen ? (
        <div
          className="fixed inset-0 z-50 bg-black/40 flex items-end md:items-center md:justify-center"
          onClick={() => setAddPickerOpen(false)}
        >
          <div
            className="bg-cream w-full md:max-w-sm rounded-t-3xl md:rounded-3xl max-h-[85vh] flex flex-col pb-safe"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="overflow-y-auto p-5">
              <p className="text-xs text-stone-500 mb-1.5">
                Adding one item? Pick its category first:
              </p>
              <div className="grid grid-cols-4 gap-2 mb-3">
                {CATEGORIES.map((c) => (
                  <button
                    key={c.value}
                    onClick={() => setPendingCategory(c.value)}
                    className={`flex flex-col items-center gap-1 py-2.5 rounded-xl text-xs ${
                      pendingCategory === c.value
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-cream-100 text-stone-500"
                    }`}
                  >
                    <span className="text-lg">{c.emoji}</span>
                    {c.label}
                  </button>
                ))}
              </div>
              <button
                onClick={() => fileRef.current?.click()}
                className="w-full rounded-xl bg-emerald-600 text-cream py-3 text-sm font-medium flex items-center justify-center gap-2"
              >
                <Camera size={18} />
                Take or choose a photo
              </button>

              <div className="flex items-center gap-2 my-3">
                <div className="flex-1 h-px bg-clay-100" />
                <span className="text-xs text-stone-400">or, for multiple items</span>
                <div className="flex-1 h-px bg-clay-100" />
              </div>

              <button
                onClick={() => bulkFileRef.current?.click()}
                disabled={bulkProcessing}
                className="w-full rounded-xl border border-clay-200 text-stone-600 py-3 text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {bulkProcessing ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  <Images size={18} />
                )}
                Bulk import from a screenshot
              </button>
              <p className="text-[11px] text-stone-400 text-center mt-1.5">
                A cart, order history, or grid of products (SHEIN, Amazon,
                anywhere), we&apos;ll detect each item and its category
                automatically.
              </p>
            </div>
          </div>
        </div>
      ) : null}

      {selected ? (
        <ItemEditSheet
          key={selected.id}
          item={selected}
          allItems={items}
          onClose={() => setSelected(null)}
          onSave={handleSave}
          onDelete={handleDelete}
          onRemix={(item) => {
            setSelected(null);
            setRemixItem(item);
          }}
        />
      ) : null}

      {remixItem ? (
        <RemixSheet
          key={remixItem.id}
          anchorItem={remixItem}
          closetItems={items}
          onClose={() => setRemixItem(null)}
        />
      ) : null}

      {bulkScreenshot ? (
        <BulkImportSheet
          key={bulkScreenshot}
          screenshotDataUrl={bulkScreenshot}
          onClose={() => setBulkScreenshot(null)}
          onImported={(newItems) => {
            setItems((prev) => [...newItems, ...(prev || [])]);
            setBulkScreenshot(null);
          }}
        />
      ) : null}

      <BottomNav />
    </main>
  );
}
