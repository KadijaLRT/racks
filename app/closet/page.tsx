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
  const [search, setSearch] = useState("");
  const [pendingCategory, setPendingCategory] = useState<ItemCategory>("top");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [selected, setSelected] = useState<ClosetItem | null>(null);
  const [remixItem, setRemixItem] = useState<ClosetItem | null>(null);
  const [addPickerOpen, setAddPickerOpen] = useState(false);
  const [bulkScreenshot, setBulkScreenshot] = useState<string | null>(null);
  const [bulkProcessing, setBulkProcessing] = useState(false);
  const [addedToast, setAddedToast] = useState<{ message: string; key: number } | null>(null);
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

  function showAddedToast(message: string) {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setAddedToast({ message, key: Date.now() });
    toastTimeoutRef.current = setTimeout(() => setAddedToast(null), 2600);
  }

  useEffect(() => {
    closetStore.getAll().then((all) => {
      setItems(all || []);
      setLoaded(true);
    });
  }, []);

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

      let name = "Untitled item";
      let subcategory = "";
      let tags: Record<string, string> = {};
      let taggingFailed = false;

      try {
        const res = await fetch("/api/tag-item", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ image: dataUrl, category: pendingCategory }),
        });
        const tagged = await res.json().catch(() => ({}));
        if (!tagged?.error) {
          name = tagged?.name || name;
          subcategory = tagged?.subcategory || "";
          tags = tagged?.tags || {};
        } else {
          taggingFailed = true;
        }
      } catch {
        // AI tagging is a nice-to-have, not a blocker: the item still
        // saves untagged so the user can fill it in manually. Still
        // worth telling the person why, rather than a silent
        // "Untitled item" with no explanation (e.g. Groq's per-minute
        // rate limit hit after several uploads in a row).
        taggingFailed = true;
      }

      const saved = await closetStore.create({
        category: pendingCategory,
        subcategory: subcategory || undefined,
        image: dataUrl,
        name,
        tags,
        laundryStatus: "clean",
        timesWorn: 0,
      });
      setItems((prev) => [saved, ...(prev || [])]);
      if (taggingFailed) {
        showAddedToast("Saved, but auto-tagging failed, edit to add a name");
      } else {
        showAddedToast(`Added \u201c${saved?.name || name}\u201d`);
      }
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

        <div className="flex gap-2 overflow-x-auto pb-1 mb-4 -mx-4 px-4">
          <button
            onClick={() => setFilter("all")}
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
              onClick={() => setFilter(c.value)}
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

        {uploadError ? (
          <div className="mb-3 rounded-xl bg-clay-50 text-clay-700 text-xs px-3 py-2">
            {uploadError}
          </div>
        ) : null}

        {loaded && filteredItems.length === 0 ? (
          <div className="text-center py-16 px-6">
            <p className="text-sm text-stone-500">
              {(items || []).length === 0
                ? "Your closet is empty. Add your first item to get started."
                : "No items match that search or filter."}
            </p>
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
          className="fixed bottom-24 left-1/2 z-30 max-w-[85%] rounded-full bg-stone-800/95 text-cream text-xs font-medium px-4 py-2 shadow-lg animate-toast-fade pointer-events-none"
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
