"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Plus, Loader2, Search, Camera, Images } from "lucide-react";
import BottomNav from "@/components/BottomNav";
import ItemCard from "@/components/ItemCard";
import ItemEditSheet from "@/components/ItemEditSheet";
import RemixSheet from "@/components/RemixSheet";
import BulkImportSheet from "@/components/BulkImportSheet";
import { fileToResizedDataUrl, resizeDataUrlForAI } from "@/lib/image";
import { extractDominantColorTag } from "@/lib/dominantColor";
import { computeHistoryTagSuggestions } from "@/lib/localTagHistory";
import { closetStore, appSettingsStore } from "@/lib/storage";
import type { ClosetItem, ItemCategory } from "@/lib/types";
import { COLLECTION_OPTIONS, SMART_COLLECTIONS, COLOR_OPTIONS, PATTERN_OPTIONS, FABRIC_OPTIONS } from "@/lib/types";
import { CATEGORIES } from "@/lib/categories";

export default function ClosetPage() {
  const [items, setItems] = useState<ClosetItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [filter, setFilter] = useState<ItemCategory | "all">("all");
  const [browseMode, setBrowseMode] = useState<"category" | "collection">("category");
  const [collectionFilter, setCollectionFilter] = useState<string>("all");
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
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [batchSheetOpen, setBatchSheetOpen] = useState(false);
  const [batchApplying, setBatchApplying] = useState(false);
  const [batchCollections, setBatchCollections] = useState<string[]>([]);
  const [batchColor, setBatchColor] = useState("");
  const [batchPattern, setBatchPattern] = useState("");
  const [batchFabric, setBatchFabric] = useState("");
  const [batchLaundryStatus, setBatchLaundryStatus] = useState<ClosetItem["laundryStatus"] | "">("");
  const [dirtyOnly, setDirtyOnly] = useState(false);
  const [defaultUploadTags, setDefaultUploadTags] = useState<{
    collections?: string[];
    color?: string;
    pattern?: string;
    fabric?: string;
  }>({});
  const [defaultsSheetOpen, setDefaultsSheetOpen] = useState(false);
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
    appSettingsStore.get().then((settings) => {
      if (settings?.defaultUploadTags) setDefaultUploadTags(settings.defaultUploadTags);
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
    // Most Worn is computed live (top third by wear count, min 1 wear)
    // rather than a fixed threshold, so it scales sensibly whether
    // someone owns 20 items or 200.
    const mostWornIds = (() => {
      if (browseMode !== "collection" || collectionFilter !== "Most Worn") return null;
      const worn = (items || []).filter((i) => (i.timesWorn || 0) > 0);
      const sorted = [...worn].sort((a, b) => (b.timesWorn || 0) - (a.timesWorn || 0));
      const cutoff = Math.max(1, Math.ceil(sorted.length / 3));
      return new Set(sorted.slice(0, cutoff).map((i) => i.id));
    })();

    return (items || []).filter((item) => {
      if (dirtyOnly && item?.laundryStatus !== "dirty") return false;
      if (browseMode === "category") {
        if (filter !== "all" && item?.category !== filter) return false;
      } else if (collectionFilter !== "all") {
        if (collectionFilter === "Most Worn") {
          if (!mostWornIds?.has(item.id)) return false;
        } else if (collectionFilter === "Favorites") {
          if (!item.pinned) return false;
        } else if (!(item.collections || []).includes(collectionFilter)) {
          return false;
        }
      }
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
  }, [items, filter, browseMode, collectionFilter, search, dirtyOnly]);

  // Once a specific category is selected (not "All"), group the grid
  // into labeled sections by whichever dimension is currently chosen
  // (type/subcategory by default, or sleeve length, silhouette, color,
  // etc. via the Group by row) instead of one flat list, so browsing a
  // category is organized by what actually distinguishes those items,
  // not just chronological order. Left flat for "All", since mixing
  // subcategory vocabularies across categories (a bag next to a
  // sweater) wouldn't read as a coherent grouping.
  const groupedSections = useMemo(() => {
    if (browseMode !== "category" || filter === "all") return null;
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
  }, [filteredItems, filter, groupBy, browseMode]);

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
      // highest-volume point in the app (every photo added). What can
      // be determined without AI still gets filled in automatically:
      // Color is extracted directly from the photo's actual pixels
      // (dominant sampled color, mapped to the nearest known color
      // name), no vision model needed for something this mechanical.
      // Falls back to no color tag at all if extraction fails, rather
      // than guessing.
      const detectedColor = await extractDominantColorTag(dataUrl);

      // Quick-Tap Preset Inheritance applied at the moment of upload,
      // not just after the fact: whatever default template is set
      // gets merged in automatically, entirely locally. The actual
      // photo-based color detection wins over a generic default color
      // when both would apply, since it's the more accurate signal.
      const mergedTags: Record<string, string> = { ...(defaultUploadTags.pattern ? { pattern: defaultUploadTags.pattern } : {}), ...(defaultUploadTags.fabric ? { fabric: defaultUploadTags.fabric } : {}) };
      if (detectedColor) {
        mergedTags.color = detectedColor;
      } else if (defaultUploadTags.color) {
        mergedTags.color = defaultUploadTags.color;
      }

      const saved = await closetStore.create({
        category: pendingCategory,
        subcategory: undefined,
        image: dataUrl,
        name: "Untitled item",
        tags: mergedTags,
        collections:
          defaultUploadTags.collections && defaultUploadTags.collections.length > 0
            ? [...defaultUploadTags.collections]
            : undefined,
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

  // "Which items are actually clean again" is a real, common question
  // once laundry's done, and marking each item clean one at a time is
  // exactly the kind of busywork this should remove, not add. This
  // marks every currently-dirty item clean in one action.
  async function markAllDirtyClean() {
    const dirty = items.filter((i) => i?.laundryStatus === "dirty");
    if (dirty.length === 0) return;
    const updated = await Promise.all(
      dirty.map(async (item) => {
        const next: ClosetItem = { ...item, laundryStatus: "clean" };
        await closetStore.update(next);
        return next;
      })
    );
    const updatedById = new Map(updated.map((i) => [i.id, i]));
    setItems((prev) => (prev || []).map((i) => updatedById.get(i.id) || i));
    setDirtyOnly(false);
    showAddedToast(`Marked ${updated.length} item${updated.length === 1 ? "" : "s"} clean`);
  }

  async function handleDelete(id: string) {
    await closetStore.remove(id);
    setItems((prev) => (prev || []).filter((i) => i.id !== id));
    setSelected(null);
  }

  function toggleSelectItem(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function exitSelectMode() {
    setSelectMode(false);
    setSelectedIds(new Set());
  }

  // Quick-Tap Preset Inheritance: apply a batch of tags/collections to
  // every selected item in one action, entirely local, zero AI. Only
  // the fields actually filled in the batch sheet get applied; a color
  // pick doesn't wipe out each item's existing pattern tag, etc.
  async function applyBatchTags(patch: {
    collections?: string[];
    color?: string;
    pattern?: string;
    fabric?: string;
    laundryStatus?: ClosetItem["laundryStatus"];
  }) {
    setBatchApplying(true);
    try {
      const targets = items.filter((i) => selectedIds.has(i.id));
      const updated = await Promise.all(
        targets.map(async (item) => {
          const next: ClosetItem = {
            ...item,
            tags: { ...(item.tags || {}) },
          };
          if (patch.color) next.tags.color = patch.color;
          if (patch.pattern) next.tags.pattern = patch.pattern;
          if (patch.fabric) next.tags.fabric = patch.fabric;
          if (patch.laundryStatus) next.laundryStatus = patch.laundryStatus;
          if (patch.collections && patch.collections.length > 0) {
            const existing = new Set(next.collections || []);
            for (const c of patch.collections) existing.add(c);
            next.collections = [...existing];
          }
          await closetStore.update(next);
          return next;
        })
      );
      const updatedById = new Map(updated.map((i) => [i.id, i]));
      setItems((prev) => (prev || []).map((i) => updatedById.get(i.id) || i));
      setBatchSheetOpen(false);
      exitSelectMode();
      showAddedToast(`Updated ${updated.length} item${updated.length === 1 ? "" : "s"}`);
    } finally {
      setBatchApplying(false);
    }
  }

  // A "scan" is just three concrete, checkable gaps: still named
  // "Untitled item" (auto-tagging never ran or failed), no subcategory
  // set (so it can't be grouped/browsed properly), or no color tag
  // (used everywhere from grouping to outfit color-matching). Makeup
  // is excluded from the color check since shade, not a garment
  // color, is what actually matters there.
  const scanResults = useMemo(() => {
    const untitled = items.filter((i) => i?.name === "Untitled item");
    const noSubcategory = items.filter((i) => !i?.subcategory?.trim());
    const noColor = items.filter(
      (i) => i?.category !== "makeup" && !i?.tags?.color
    );
    const flaggedIds = new Set([
      ...untitled.map((i) => i.id),
      ...noSubcategory.map((i) => i.id),
      ...noColor.map((i) => i.id),
    ]);
    return {
      untitledCount: untitled.length,
      noSubcategoryCount: noSubcategory.length,
      noColorCount: noColor.length,
      flagged: items.filter((i) => flaggedIds.has(i.id)),
    };
  }, [items]);

  // Re-runs AI tagging for every item the scan flagged (untitled, no
  // subcategory, or no color) rather than only ones still literally
  // named "Untitled item" — a full retag call fills in everything at
  // once regardless of which specific field was missing. Sequential
  // with a short pause between calls, since firing them all at once is
  // exactly what caused the rate limit in the first place. If a
  // rate-limit-style error comes back mid-batch, this stops
  // immediately rather than burning through the rest of the list on
  // calls that would just fail the same way, and reports how far it got.
  async function retagUntitledItems() {
    const targets = scanResults.flagged;
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
        const aiImage = await resizeDataUrlForAI(target.image);
        const res = await fetch("/api/tag-item", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ image: aiImage, category: target.category }),
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

  // Entirely local, zero AI, zero network call: re-samples each
  // flagged item's actual pixels for color, and applies your own
  // tagging history for its subcategory where a real majority pattern
  // exists. Can't fix a missing subcategory or name the way AI can
  // (there's no way to guess those from pixels alone), so those items
  // still show up in the next scan needing a manual pass or an actual
  // AI retag, but this closes real gaps instantly and for free.
  async function retagWithoutAI() {
    const targets = scanResults.flagged;
    if (targets.length === 0) return;
    setRetagging(true);
    setRetagSummary(null);
    setRetagProgress({ done: 0, total: targets.length });

    let updatedCount = 0;
    const updates: ClosetItem[] = [];
    for (let i = 0; i < targets.length; i++) {
      const target = targets[i];
      const detectedColor = !target.tags?.color
        ? await extractDominantColorTag(target.image)
        : null;
      const historySuggestions = computeHistoryTagSuggestions(target, items);
      const newTags = { ...(target.tags || {}) };
      if (detectedColor) newTags.color = detectedColor;
      for (const [k, v] of Object.entries(historySuggestions)) newTags[k] = v;

      if (Object.keys(newTags).length !== Object.keys(target.tags || {}).length) {
        const updated = { ...target, tags: newTags };
        await closetStore.update(updated);
        updates.push(updated);
        updatedCount += 1;
      }
      setRetagProgress({ done: i + 1, total: targets.length });
    }

    if (updates.length > 0) {
      const updatedById = new Map(updates.map((i) => [i.id, i]));
      setItems((prev) => (prev || []).map((it) => updatedById.get(it.id) || it));
    }

    setRetagging(false);
    setRetagSummary({
      retagged: updatedCount,
      stillFailed: targets.length - updatedCount,
      stoppedEarly: false,
    });
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
          <div className="flex items-center gap-3">
            <span className="text-xs text-stone-400">
              {(items || []).length} {(items || []).length === 1 ? "item" : "items"}
            </span>
            <button
              onClick={() => (selectMode ? exitSelectMode() : setSelectMode(true))}
              className="text-xs text-emerald-700 font-medium"
            >
              {selectMode ? "Cancel" : "Select"}
            </button>
            <button
              onClick={() => setDefaultsSheetOpen(true)}
              className="text-xs text-stone-500 font-medium"
            >
              Defaults
            </button>
          </div>
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

        <div className="flex gap-1 mb-2 -mx-4 px-4">
          <button
            onClick={() => setBrowseMode("category")}
            className={`flex-1 py-1.5 rounded-full text-xs font-medium ${
              browseMode === "category"
                ? "bg-stone-700 text-cream"
                : "bg-cream-100 text-stone-500"
            }`}
          >
            By Category
          </button>
          <button
            onClick={() => setBrowseMode("collection")}
            className={`flex-1 py-1.5 rounded-full text-xs font-medium ${
              browseMode === "collection"
                ? "bg-stone-700 text-cream"
                : "bg-cream-100 text-stone-500"
            }`}
          >
            By Collection
          </button>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1 mb-2 -mx-4 px-4">
          {browseMode === "category" ? (
            <>
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
            </>
          ) : (
            <>
              <button
                onClick={() => setCollectionFilter("all")}
                className={`shrink-0 px-3.5 py-1.5 rounded-full text-xs font-medium ${
                  collectionFilter === "all"
                    ? "bg-emerald-600 text-cream"
                    : "bg-cream-100 text-stone-500"
                }`}
              >
                All
              </button>
              {SMART_COLLECTIONS.map((c) => (
                <button
                  key={c}
                  onClick={() => setCollectionFilter(c)}
                  className={`shrink-0 px-3.5 py-1.5 rounded-full text-xs font-medium ${
                    collectionFilter === c
                      ? "bg-emerald-600 text-cream"
                      : "bg-emerald-50 text-emerald-700"
                  }`}
                >
                  {c === "Favorites" ? "\u2b50 Favorites" : "\ud83d\udd25 Most Worn"}
                </button>
              ))}
              {COLLECTION_OPTIONS.map((c) => (
                <button
                  key={c}
                  onClick={() => setCollectionFilter(c)}
                  className={`shrink-0 px-3.5 py-1.5 rounded-full text-xs font-medium ${
                    collectionFilter === c
                      ? "bg-emerald-600 text-cream"
                      : "bg-cream-100 text-stone-500"
                  }`}
                >
                  {c}
                </button>
              ))}
            </>
          )}
        </div>

        {browseMode === "category" && filter !== "all" && GROUPING_OPTIONS[filter] ? (
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
          const flaggedCount = scanResults.flagged.length;
          if (flaggedCount === 0 && !retagging && !retagSummary) return null;

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
                  <div className="text-xs text-stone-600">
                    <p>
                      {flaggedCount} item{flaggedCount === 1 ? "" : "s"} need
                      {flaggedCount === 1 ? "s" : ""} attention.
                    </p>
                    <p className="text-stone-400 mt-0.5">
                      {[
                        scanResults.untitledCount > 0
                          ? `${scanResults.untitledCount} untitled`
                          : null,
                        scanResults.noSubcategoryCount > 0
                          ? `${scanResults.noSubcategoryCount} no subcategory`
                          : null,
                        scanResults.noColorCount > 0
                          ? `${scanResults.noColorCount} no color`
                          : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <button
                      onClick={retagUntitledItems}
                      className="text-xs font-medium text-emerald-700 whitespace-nowrap"
                    >
                      Retag now
                    </button>
                    <button
                      onClick={retagWithoutAI}
                      className="text-[11px] text-stone-500 whitespace-nowrap"
                    >
                      Retag without AI
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })()}

        {(() => {
          const dirtyCount = items.filter((i) => i?.laundryStatus === "dirty").length;
          if (dirtyCount === 0 && !dirtyOnly) return null;
          return (
            <div className="mb-3 rounded-xl border border-clay-100 bg-white px-3 py-2.5 flex items-center justify-between gap-2">
              <p className="text-xs text-stone-600">
                {dirtyOnly
                  ? `Showing ${dirtyCount} item${dirtyCount === 1 ? "" : "s"} marked dirty`
                  : `${dirtyCount} item${dirtyCount === 1 ? "" : "s"} marked dirty`}
              </p>
              <div className="flex items-center gap-3 shrink-0">
                <button
                  onClick={() => setDirtyOnly((v) => !v)}
                  className="text-xs font-medium text-stone-500"
                >
                  {dirtyOnly ? "Show all" : "View"}
                </button>
                {dirtyCount > 0 ? (
                  <button
                    onClick={markAllDirtyClean}
                    className="text-xs font-medium text-emerald-700 whitespace-nowrap"
                  >
                    Mark all clean
                  </button>
                ) : null}
              </div>
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
                    <ItemCard
                      key={item.id}
                      item={item}
                      onSelect={
                        selectMode ? () => toggleSelectItem(item.id) : setSelected
                      }
                      selectMode={selectMode}
                      isSelected={selectedIds.has(item.id)}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {filteredItems.map((item) => (
              <ItemCard
                key={item.id}
                item={item}
                onSelect={selectMode ? () => toggleSelectItem(item.id) : setSelected}
                selectMode={selectMode}
                isSelected={selectedIds.has(item.id)}
              />
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

      {selectMode && selectedIds.size > 0 ? (
        <div className="fixed bottom-20 left-0 right-0 flex justify-center px-4 z-40">
          <div className="bg-stone-800 text-cream rounded-full px-4 py-2.5 flex items-center gap-3 shadow-lg">
            <span className="text-xs">{selectedIds.size} selected</span>
            <button
              onClick={() => setBatchSheetOpen(true)}
              className="text-xs font-medium bg-emerald-600 px-3 py-1.5 rounded-full"
            >
              Apply tags
            </button>
          </div>
        </div>
      ) : null}

      {batchSheetOpen ? (
        <div
          className="fixed inset-0 z-50 flex flex-col md:items-center md:justify-center bg-black/40"
          onClick={() => setBatchSheetOpen(false)}
        >
          <div
            className="mt-auto md:mt-0 md:max-w-sm md:w-full bg-cream rounded-t-3xl md:rounded-3xl max-h-[80vh] flex flex-col pb-safe"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-clay-100">
              <div>
                <h2 className="text-base font-medium text-stone-800">Apply to {selectedIds.size} items</h2>
                <p className="text-xs text-stone-400">Only the fields you set here get applied</p>
              </div>
              <button onClick={() => setBatchSheetOpen(false)} aria-label="Close">
                <span className="text-stone-400 text-lg">&times;</span>
              </button>
            </div>
            <div className="overflow-y-auto px-5 py-4 space-y-4">
              <div>
                <p className="text-xs text-stone-500 mb-1.5">Collections</p>
                <div className="flex flex-wrap gap-2">
                  {COLLECTION_OPTIONS.map((c) => (
                    <button
                      key={c}
                      onClick={() =>
                        setBatchCollections((prev) =>
                          prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]
                        )
                      }
                      className={`px-3 py-1.5 rounded-full text-xs border ${
                        batchCollections.includes(c)
                          ? "border-emerald-600 bg-emerald-600 text-cream font-medium"
                          : "border-clay-100 text-stone-500 bg-transparent"
                      }`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs text-stone-500 mb-1.5">Color</p>
                <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto">
                  {COLOR_OPTIONS.map((c) => (
                    <button
                      key={c}
                      onClick={() => setBatchColor((prev) => (prev === c ? "" : c))}
                      className={`px-2.5 py-1.5 rounded-full text-xs border ${
                        batchColor === c
                          ? "border-emerald-600 bg-emerald-50 text-emerald-700 font-medium"
                          : "border-clay-100 text-stone-500 bg-transparent"
                      }`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs text-stone-500 mb-1.5">Pattern</p>
                <div className="flex flex-wrap gap-1.5">
                  {PATTERN_OPTIONS.map((p) => (
                    <button
                      key={p}
                      onClick={() => setBatchPattern((prev) => (prev === p ? "" : p))}
                      className={`px-2.5 py-1.5 rounded-full text-xs border ${
                        batchPattern === p
                          ? "border-emerald-600 bg-emerald-50 text-emerald-700 font-medium"
                          : "border-clay-100 text-stone-500 bg-transparent"
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs text-stone-500 mb-1.5">Fabric</p>
                <div className="flex flex-wrap gap-1.5">
                  {FABRIC_OPTIONS.map((f) => (
                    <button
                      key={f}
                      onClick={() => setBatchFabric((prev) => (prev === f ? "" : f))}
                      className={`px-2.5 py-1.5 rounded-full text-xs border ${
                        batchFabric === f
                          ? "border-emerald-600 bg-emerald-50 text-emerald-700 font-medium"
                          : "border-clay-100 text-stone-500 bg-transparent"
                      }`}
                    >
                      {f}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs text-stone-500 mb-1.5">Laundry status</p>
                <div className="flex flex-wrap gap-1.5">
                  {(["clean", "dirty", "dry-clean"] as const).map((s) => (
                    <button
                      key={s}
                      onClick={() => setBatchLaundryStatus((prev) => (prev === s ? "" : s))}
                      className={`px-2.5 py-1.5 rounded-full text-xs border capitalize ${
                        batchLaundryStatus === s
                          ? "border-emerald-600 bg-emerald-50 text-emerald-700 font-medium"
                          : "border-clay-100 text-stone-500 bg-transparent"
                      }`}
                    >
                      {s === "dry-clean" ? "Dry-clean" : s}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="px-5 py-4 border-t border-clay-100">
              <button
                onClick={() =>
                  applyBatchTags({
                    collections: batchCollections.length > 0 ? batchCollections : undefined,
                    color: batchColor || undefined,
                    pattern: batchPattern || undefined,
                    fabric: batchFabric || undefined,
                    laundryStatus: batchLaundryStatus || undefined,
                  })
                }
                disabled={batchApplying}
                className="w-full rounded-xl bg-emerald-600 text-cream py-3 text-sm font-medium disabled:opacity-60"
              >
                {batchApplying ? "Applying..." : `Apply to ${selectedIds.size} items`}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {defaultsSheetOpen ? (
        <div
          className="fixed inset-0 z-50 flex flex-col md:items-center md:justify-center bg-black/40"
          onClick={() => setDefaultsSheetOpen(false)}
        >
          <div
            className="mt-auto md:mt-0 md:max-w-sm md:w-full bg-cream rounded-t-3xl md:rounded-3xl max-h-[80vh] flex flex-col pb-safe"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-clay-100">
              <div>
                <h2 className="text-base font-medium text-stone-800">Defaults for new items</h2>
                <p className="text-xs text-stone-400">
                  Applied automatically to every new upload, entirely locally
                </p>
              </div>
              <button onClick={() => setDefaultsSheetOpen(false)} aria-label="Close">
                <span className="text-stone-400 text-lg">&times;</span>
              </button>
            </div>
            <div className="overflow-y-auto px-5 py-4 space-y-4">
              <div>
                <p className="text-xs text-stone-500 mb-1.5">Collections</p>
                <div className="flex flex-wrap gap-2">
                  {COLLECTION_OPTIONS.map((c) => (
                    <button
                      key={c}
                      onClick={() =>
                        setDefaultUploadTags((prev) => {
                          const current = prev.collections || [];
                          return {
                            ...prev,
                            collections: current.includes(c)
                              ? current.filter((x) => x !== c)
                              : [...current, c],
                          };
                        })
                      }
                      className={`px-3 py-1.5 rounded-full text-xs border ${
                        (defaultUploadTags.collections || []).includes(c)
                          ? "border-emerald-600 bg-emerald-600 text-cream font-medium"
                          : "border-clay-100 text-stone-500 bg-transparent"
                      }`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs text-stone-500 mb-1.5">
                  Color <span className="text-stone-300">(only used if a photo&rsquo;s own color can&rsquo;t be detected)</span>
                </p>
                <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto">
                  {COLOR_OPTIONS.map((c) => (
                    <button
                      key={c}
                      onClick={() =>
                        setDefaultUploadTags((prev) => ({
                          ...prev,
                          color: prev.color === c ? undefined : c,
                        }))
                      }
                      className={`px-2.5 py-1.5 rounded-full text-xs border ${
                        defaultUploadTags.color === c
                          ? "border-emerald-600 bg-emerald-50 text-emerald-700 font-medium"
                          : "border-clay-100 text-stone-500 bg-transparent"
                      }`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs text-stone-500 mb-1.5">Pattern</p>
                <div className="flex flex-wrap gap-1.5">
                  {PATTERN_OPTIONS.map((p) => (
                    <button
                      key={p}
                      onClick={() =>
                        setDefaultUploadTags((prev) => ({
                          ...prev,
                          pattern: prev.pattern === p ? undefined : p,
                        }))
                      }
                      className={`px-2.5 py-1.5 rounded-full text-xs border ${
                        defaultUploadTags.pattern === p
                          ? "border-emerald-600 bg-emerald-50 text-emerald-700 font-medium"
                          : "border-clay-100 text-stone-500 bg-transparent"
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs text-stone-500 mb-1.5">Fabric</p>
                <div className="flex flex-wrap gap-1.5">
                  {FABRIC_OPTIONS.map((f) => (
                    <button
                      key={f}
                      onClick={() =>
                        setDefaultUploadTags((prev) => ({
                          ...prev,
                          fabric: prev.fabric === f ? undefined : f,
                        }))
                      }
                      className={`px-2.5 py-1.5 rounded-full text-xs border ${
                        defaultUploadTags.fabric === f
                          ? "border-emerald-600 bg-emerald-50 text-emerald-700 font-medium"
                          : "border-clay-100 text-stone-500 bg-transparent"
                      }`}
                    >
                      {f}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="px-5 py-4 border-t border-clay-100 flex gap-2">
              <button
                onClick={async () => {
                  const current = (await appSettingsStore.get()) || {};
                  setDefaultUploadTags({});
                  await appSettingsStore.save({ ...current, defaultUploadTags: {} });
                }}
                className="rounded-xl border border-clay-200 text-stone-500 px-4 py-3 text-sm font-medium"
              >
                Clear
              </button>
              <button
                onClick={async () => {
                  const current = (await appSettingsStore.get()) || {};
                  await appSettingsStore.save({ ...current, defaultUploadTags });
                  setDefaultsSheetOpen(false);
                }}
                className="flex-1 rounded-xl bg-emerald-600 text-cream py-3 text-sm font-medium"
              >
                Save defaults
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <BottomNav />
    </main>
  );
}
