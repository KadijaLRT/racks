"use client";

import { useRef, useState } from "react";
import { X, Pin, PinOff, Trash2, Plus, Shuffle, Camera, Loader2 } from "lucide-react";
import type { ClosetItem, ItemCategory } from "@/lib/types";
import { CATEGORIES, categoryLabel } from "@/lib/categories";
import { fileToResizedDataUrl } from "@/lib/image";
import StylingTipList from "@/components/StylingTipList";
import {
  braRecommendation,
  necklaceRecommendation,
  jewelryToneRecommendation,
} from "@/lib/stylingAdvice";

interface ItemEditSheetProps {
  item: ClosetItem;
  onClose: () => void;
  onSave: (item: ClosetItem) => void;
  onDelete: (id: string) => void;
  onRemix?: (item: ClosetItem) => void;
}

const LAUNDRY_OPTIONS: ClosetItem["laundryStatus"][] = ["clean", "dirty", "dry-clean"];
const CLOSET_STATUS_OPTIONS: NonNullable<ClosetItem["closetStatus"]>[] = [
  "keep",
  "donate",
  "sell",
  "repair",
  "store",
];

export default function ItemEditSheet({
  item,
  onClose,
  onSave,
  onDelete,
  onRemix,
}: ItemEditSheetProps) {
  const [name, setName] = useState(item?.name || "");
  const [image, setImage] = useState(item?.image || "");
  const [category, setCategory] = useState<ItemCategory>(item?.category || "top");
  const [subcategory, setSubcategory] = useState(item?.subcategory || "");
  const [tags, setTags] = useState<Record<string, string>>(item?.tags || {});
  const [notes, setNotes] = useState(item?.notes || "");
  const [laundryStatus, setLaundryStatus] = useState<ClosetItem["laundryStatus"]>(
    item?.laundryStatus || "clean"
  );
  const [closetStatus, setClosetStatus] = useState<ClosetItem["closetStatus"]>(
    item?.closetStatus
  );
  const [pinned, setPinned] = useState(Boolean(item?.pinned));
  const [newTagKey, setNewTagKey] = useState("");
  const [newTagValue, setNewTagValue] = useState("");
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [backImage, setBackImage] = useState<string | undefined>(item?.backImage);
  const [analyzingBack, setAnalyzingBack] = useState(false);
  const [backError, setBackError] = useState("");
  const backFileRef = useRef<HTMLInputElement>(null);
  const [changingFront, setChangingFront] = useState(false);
  const [frontError, setFrontError] = useState("");
  const [frontRetagged, setFrontRetagged] = useState(false);
  const frontFileRef = useRef<HTMLInputElement>(null);

  async function handleFrontPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setFrontError("");
    setFrontRetagged(false);
    setChangingFront(true);
    try {
      const dataUrl = await fileToResizedDataUrl(file);
      if (!dataUrl) throw new Error("Couldn't read that photo.");
      setImage(dataUrl);

      // Re-run AI tagging on the new photo, the same way the initial add
      // flow does, since a changed photo means the old name/tags may no
      // longer describe what's actually in the picture. Non-blocking:
      // the new photo still saves even if this call fails.
      try {
        const res = await fetch("/api/tag-item", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ image: dataUrl, category }),
        });
        const result = await res.json().catch(() => ({}));
        if (!result?.error) {
          if (result?.name) setName(result.name);
          if (result?.subcategory) setSubcategory(result.subcategory);
          if (result?.tags && typeof result.tags === "object") {
            setTags(result.tags);
          }
          setFrontRetagged(true);
        }
      } catch {
        // Non-blocking, see comment above.
      }
    } catch (err) {
      setFrontError(
        err instanceof Error ? err.message : "That photo couldn't be added."
      );
    } finally {
      setChangingFront(false);
    }
  }

  async function handleBackPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setBackError("");
    setAnalyzingBack(true);
    try {
      const dataUrl = await fileToResizedDataUrl(file);
      if (!dataUrl) throw new Error("Couldn't read that photo.");
      setBackImage(dataUrl);

      // AI tagging here is a nice-to-have: the back photo still saves
      // even if this call fails, so a person can note details manually.
      try {
        const res = await fetch("/api/tag-item-back", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ image: dataUrl, category }),
        });
        const result = await res.json().catch(() => ({}));
        if (!result?.error && result?.tags && typeof result.tags === "object") {
          setTags((prev) => ({ ...(prev || {}), ...result.tags }));
        }
      } catch {
        // Non-blocking, see comment above.
      }
    } catch (err) {
      setBackError(
        err instanceof Error ? err.message : "That photo couldn't be added."
      );
    } finally {
      setAnalyzingBack(false);
    }
  }

  function removeBackPhoto() {
    setBackImage(undefined);
    setBackError("");
  }

  function handleSave() {
    onSave({
      ...item,
      name: name.trim() || "Untitled item",
      category,
      subcategory: subcategory.trim() || undefined,
      tags: tags || {},
      notes: notes.trim() || undefined,
      laundryStatus,
      closetStatus,
      pinned,
      image: image || item.image,
      backImage: backImage || undefined,
    });
  }

  function addTag() {
    const key = newTagKey.trim();
    const value = newTagValue.trim();
    if (!key || !value) return;
    setTags((prev) => ({ ...(prev || {}), [key]: value }));
    setNewTagKey("");
    setNewTagValue("");
  }

  function removeTag(key: string) {
    setTags((prev) => {
      const next = { ...(prev || {}) };
      delete next[key];
      return next;
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col md:items-center md:justify-center bg-black/40">
      <div className="mt-auto md:mt-0 md:max-w-lg md:w-full bg-cream rounded-t-3xl md:rounded-3xl max-h-[92vh] md:max-h-[85vh] flex flex-col pb-safe">
        <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-clay-100">
          <h2 className="text-base font-medium text-stone-800">
            {categoryLabel(category)}
          </h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPinned((p) => !p)}
              className="p-2 rounded-full hover:bg-clay-50"
              aria-label={pinned ? "Unpin item" : "Pin item"}
            >
              {pinned ? (
                <Pin size={18} className="text-clay-700" fill="currentColor" />
              ) : (
                <PinOff size={18} className="text-stone-400" />
              )}
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-full hover:bg-clay-50"
              aria-label="Close"
            >
              <X size={18} className="text-stone-500" />
            </button>
          </div>
        </div>

        <div className="overflow-y-auto px-5 py-4 space-y-5 flex-1">
          <input
            ref={frontFileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFrontPhoto}
          />
          <input
            ref={backFileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleBackPhoto}
          />

          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex gap-2 shrink-0">
              <button
                onClick={() => frontFileRef.current?.click()}
                disabled={changingFront}
                aria-label="Change photo"
                className="relative w-full md:w-40 aspect-[3/4] rounded-2xl overflow-hidden bg-cream-100 shrink-0 group disabled:opacity-80"
              >
                {image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={image}
                    alt={name || "Closet item"}
                    className="w-full h-full object-cover"
                  />
                ) : null}
                <div className="absolute inset-0 bg-black/0 md:group-hover:bg-black/20 md:transition-colors" />
                {changingFront ? (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                    <Loader2 size={20} className="text-white animate-spin" />
                  </div>
                ) : (
                  <span className="absolute bottom-1.5 right-1.5 flex items-center gap-1 bg-black/60 text-cream text-[10px] px-2 py-1 rounded-full">
                    <Camera size={11} />
                    Change
                  </span>
                )}
              </button>

              <div className="w-20 md:w-24 aspect-[3/4] rounded-2xl overflow-hidden bg-cream-100 shrink-0 relative">
                {backImage ? (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={backImage}
                      alt="Back of item"
                      className="w-full h-full object-cover"
                    />
                    <button
                      onClick={removeBackPhoto}
                      aria-label="Remove back photo"
                      className="absolute top-1 right-1 bg-black/50 rounded-full p-1"
                    >
                      <X size={11} className="text-white" />
                    </button>
                    <span className="absolute bottom-1 left-1 bg-black/50 text-cream text-[9px] px-1.5 py-0.5 rounded-full">
                      Back
                    </span>
                  </>
                ) : (
                  <button
                    onClick={() => backFileRef.current?.click()}
                    disabled={analyzingBack}
                    className="w-full h-full flex flex-col items-center justify-center gap-1 text-stone-400 disabled:opacity-60"
                  >
                    {analyzingBack ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <Camera size={16} />
                    )}
                    <span className="text-[9px] text-center px-1 leading-tight">
                      {analyzingBack ? "Reading..." : "Add back photo"}
                    </span>
                  </button>
                )}
              </div>
            </div>

            <div className="flex-1 space-y-3">
              <div>
                <label className="text-xs text-stone-500">Name</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full mt-1 rounded-xl border border-clay-100 px-3 py-2 text-sm bg-white"
                  placeholder="Item name"
                />
              </div>

              <div className="flex flex-col md:flex-row gap-3">
                <div className="flex-1">
                  <label className="text-xs text-stone-500">Category</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as ItemCategory)}
                    className="w-full mt-1 rounded-xl border border-clay-100 px-3 py-2 text-sm bg-white"
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c.value} value={c.value}>
                        {c.emoji} {c.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex-1">
                  <label className="text-xs text-stone-500">Subcategory</label>
                  <input
                    value={subcategory}
                    onChange={(e) => setSubcategory(e.target.value)}
                    className="w-full mt-1 rounded-xl border border-clay-100 px-3 py-2 text-sm bg-white"
                    placeholder="e.g. blouse, sneakers"
                  />
                </div>
              </div>
            </div>
          </div>

          <div>
            <label className="text-xs text-stone-500">Tags</label>
            <div className="flex flex-wrap gap-2 mt-1.5">
              {Object.entries(tags || {}).map(([key, value]) => (
                <span
                  key={key}
                  className="inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-700 text-xs px-2.5 py-1 rounded-full"
                >
                  {key}: {value}
                  <button
                    onClick={() => removeTag(key)}
                    aria-label={`Remove ${key} tag`}
                    className="text-emerald-700/60 hover:text-emerald-700"
                  >
                    <X size={12} />
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-2 mt-2">
              <input
                value={newTagKey}
                onChange={(e) => setNewTagKey(e.target.value)}
                placeholder="attribute"
                className="w-1/3 rounded-xl border border-clay-100 px-3 py-1.5 text-xs bg-white"
              />
              <input
                value={newTagValue}
                onChange={(e) => setNewTagValue(e.target.value)}
                placeholder="value"
                className="flex-1 rounded-xl border border-clay-100 px-3 py-1.5 text-xs bg-white"
                onKeyDown={(e) => {
                  if (e.key === "Enter") addTag();
                }}
              />
              <button
                onClick={addTag}
                className="p-1.5 rounded-xl bg-emerald-100 text-emerald-700"
                aria-label="Add tag"
              >
                <Plus size={16} />
              </button>
            </div>
          </div>

          {frontError ? (
            <p className="text-xs text-clay-700 -mt-3">{frontError}</p>
          ) : null}
          {frontRetagged && !frontError ? (
            <p className="text-xs text-emerald-700 -mt-3">
              Re-analyzed the new photo, details below were updated.
            </p>
          ) : null}

          {backError ? (
            <p className="text-xs text-clay-700 -mt-3">{backError}</p>
          ) : null}

          {category === "top" || category === "dress" || category === "set" ? (
            <StylingTipList
              tips={[
                braRecommendation({ subcategory, name, tags }),
                necklaceRecommendation({ subcategory, name, tags }),
                jewelryToneRecommendation({ name, tags }),
              ]}
            />
          ) : null}

          <div className="flex flex-col md:flex-row gap-3">
            <div className="flex-1">
              <label className="text-xs text-stone-500">Laundry status</label>
              <div className="flex gap-1.5 mt-1.5">
                {LAUNDRY_OPTIONS.map((opt) => (
                  <button
                    key={opt}
                    onClick={() => setLaundryStatus(opt)}
                    className={`px-3 py-1.5 rounded-full text-xs capitalize ${
                      laundryStatus === opt
                        ? "bg-emerald-600 text-cream"
                        : "bg-cream-100 text-stone-500"
                    }`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1">
              <label className="text-xs text-stone-500">Closet status</label>
              <select
                value={closetStatus || ""}
                onChange={(e) =>
                  setClosetStatus(
                    (e.target.value || undefined) as ClosetItem["closetStatus"]
                  )
                }
                className="w-full mt-1.5 rounded-xl border border-clay-100 px-3 py-1.5 text-xs bg-white capitalize"
              >
                <option value="">Active</option>
                {CLOSET_STATUS_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs text-stone-500">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full mt-1 rounded-xl border border-clay-100 px-3 py-2 text-sm bg-white resize-none"
              placeholder="Optional notes"
            />
          </div>

          <div className="flex items-center justify-between">
            <p className="text-xs text-stone-400">
              Worn {item?.timesWorn || 0} {item?.timesWorn === 1 ? "time" : "times"}
            </p>
            {onRemix ? (
              <button
                onClick={() => onRemix(item)}
                className="flex items-center gap-1.5 text-xs text-emerald-700 font-medium"
              >
                <Shuffle size={13} />
                Remix this item
              </button>
            ) : null}
          </div>
        </div>

        <div className="px-5 py-4 border-t border-clay-100 flex gap-3">
          {confirmingDelete ? (
            <>
              <button
                onClick={() => setConfirmingDelete(false)}
                className="flex-1 rounded-xl border border-clay-200 py-2.5 text-sm text-stone-600"
              >
                Cancel
              </button>
              <button
                onClick={() => onDelete(item.id)}
                className="flex-1 rounded-xl bg-clay-700 text-cream py-2.5 text-sm font-medium"
              >
                Confirm delete
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setConfirmingDelete(true)}
                className="rounded-xl border border-clay-200 px-4 py-2.5 text-sm text-clay-700"
                aria-label="Delete item"
              >
                <Trash2 size={16} />
              </button>
              <button
                onClick={handleSave}
                className="flex-1 rounded-xl bg-emerald-600 text-cream py-2.5 text-sm font-medium active:scale-[0.98] transition-transform"
              >
                Save changes
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
