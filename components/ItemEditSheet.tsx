"use client";

import { useRef, useState } from "react";
import { X, Pin, PinOff, Trash2, Plus, Shuffle, Camera, Loader2, Sparkles, ChevronDown, Search } from "lucide-react";
import type { ClosetItem, ItemCategory } from "@/lib/types";
import { buildLocalItemName } from "@/lib/localNaming";
import { JEAN_CUT_OPTIONS, RISE_HEIGHT_OPTIONS, SKIRT_LENGTH_OPTIONS, SHORTS_LENGTH_OPTIONS, NECKLINE_OPTIONS, TOP_SILHOUETTE_OPTIONS, DRESS_SILHOUETTE_OPTIONS, SLEEVE_LENGTH_OPTIONS, SLEEVE_OPTIONS, BACK_STYLE_OPTIONS, SUBCATEGORY_SUGGESTIONS, SUBCATEGORY_GROUPS, COLLECTION_OPTIONS, COLOR_OPTIONS, PATTERN_OPTIONS, FABRIC_OPTIONS, WASH_OPTIONS, OUTERWEAR_CLOSURE_OPTIONS, OUTERWEAR_LENGTH_OPTIONS, SHOE_HEEL_OPTIONS, SHOE_TOE_OPTIONS, SHOE_MATERIAL_OPTIONS, accessoryMaterialOptionsForSubcategory, JEWELRY_TYPE_OPTIONS, EARRING_TYPE_OPTIONS, BAG_SIZE_OPTIONS, HAT_TYPE_OPTIONS, MAKEUP_FINISH_OPTIONS, makeupTypeOptionsForSubcategory, makeupShadeOptionsForType, makeupFinishAppliesToTypes, KNIT_TYPE_OPTIONS, HOOD_STYLE_OPTIONS, HOOD_POCKET_OPTIONS, GARMENT_FIT_OPTIONS, SWIMSUIT_TYPE_OPTIONS, SWIMSUIT_TOP_STYLE_OPTIONS, SWIMSUIT_BOTTOM_STYLE_OPTIONS } from "@/lib/types";
import { CATEGORIES, categoryLabel } from "@/lib/categories";
import { fileToResizedDataUrl, resizeDataUrlForAI } from "@/lib/image";
import StylingTipList from "@/components/StylingTipList";
import {
  braRecommendation,
  necklaceRecommendation,
  jewelryToneRecommendation,
} from "@/lib/stylingAdvice";

interface ItemEditSheetProps {
  item: ClosetItem;
  onClose: () => void;
  onSave: (item: ClosetItem) => void | Promise<void>;
  onDelete: (id: string) => void;
  onRemix?: (item: ClosetItem) => void;
  // Rest of the closet, used only to surface "Most used" subcategory
  // chips (the person's own actual usage, not a generic list).
  // Optional and safely omitted wherever the caller doesn't have it.
  allItems?: ClosetItem[];
}

const LAUNDRY_OPTIONS: ClosetItem["laundryStatus"][] = ["clean", "dirty", "dry-clean"];

// The underlying field stays laundryStatus/clean-dirty-dry-clean for
// every category (generate-look's outfit-building filter depends on
// laundryStatus === "clean" to decide what's available to wear,
// including shoes), but the label and option wording only make literal
// sense for actual clothing. Shoes and accessories get a relabeled
// "Condition" framing with wording that fits them; makeup doesn't have
// a meaningful readiness concept at all (it's already excluded from
// the wearable filter regardless of this field), so it's hidden there.
function getStatusFieldConfig(
  category: ItemCategory
): { label: string; optionLabels: Record<ClosetItem["laundryStatus"], string> } | null {
  if (category === "shoes") {
    return {
      label: "Condition",
      optionLabels: { clean: "Clean", dirty: "Needs cleaning", "dry-clean": "At the cobbler" },
    };
  }
  if (category === "accessory") {
    return {
      label: "Condition",
      optionLabels: { clean: "Good", dirty: "Needs cleaning", "dry-clean": "Needs repair" },
    };
  }
  if (category === "makeup") {
    return null;
  }
  return {
    label: "Laundry status",
    optionLabels: { clean: "Clean", dirty: "Dirty", "dry-clean": "Dry-clean" },
  };
}

const CLOSET_STATUS_OPTIONS: NonNullable<ClosetItem["closetStatus"]>[] = [
  "keep",
  "donate",
  "sell",
  "repair",
  "store",
];

function todayIso(): string {
  const now = new Date();
  const tzOffsetMs = now.getTimezoneOffset() * 60000;
  return new Date(now.getTime() - tzOffsetMs).toISOString().slice(0, 10);
}

export default function ItemEditSheet({
  item,
  onClose,
  onSave,
  onDelete,
  onRemix,
  allItems,
}: ItemEditSheetProps) {
  const [name, setName] = useState(item?.name || "");
  const [nameAutoFillable, setNameAutoFillable] = useState(
    !item?.name || item.name === "Untitled item"
  );
  const [image, setImage] = useState(item?.image || "");
  const [wornCount, setWornCount] = useState(item?.timesWorn || 0);
  const [wearHistory, setWearHistory] = useState<string[]>(item?.wearHistory || []);
  const [wearDatePickerOpen, setWearDatePickerOpen] = useState(false);
  const [wearDate, setWearDate] = useState(todayIso);
  const [category, setCategory] = useState<ItemCategory>(item?.category || "top");
  const [collections, setCollections] = useState<string[]>(item?.collections || []);
  const [subcategory, setSubcategory] = useState(item?.subcategory || "");
  const [tags, setTags] = useState<Record<string, string>>(item?.tags || {});

  // No-AI naming path: as soon as someone picks a subcategory and/or a
  // color quick-pick, this derives a real name locally (e.g. "Rust
  // Matching Set") instead of leaving "Untitled item" as the only
  // option until they type something themselves. This is what makes
  // manual cataloging (Settings > Auto-tag off) a genuinely workable
  // path, not just a degraded fallback when AI tagging isn't available.
  // Computed at render time rather than synced via effect+setState,
  // since it's purely derived from other state. Stops once the person
  // types their own name (nameAutoFillable turns false) or once AI has
  // already given a real name.
  const effectiveName = nameAutoFillable
    ? buildLocalItemName(category, subcategory, tags) || name
    : name;
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
  const [editingTagKey, setEditingTagKey] = useState<string | null>(null);
  const [editingTagValue, setEditingTagValue] = useState("");
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  // Anatomy Lens: the whole "Details" panel stays collapsed by
  // default (progressive disclosure at the top level, not just within
  // it), subcategory search filters the picker, and openGroups tracks
  // which accordion sections (Everyday/Going Out/etc.) are expanded —
  // only for categories with enough volume to need grouping at all.
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [subcategorySearch, setSubcategorySearch] = useState("");
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set());
  const [historySuggestionDismissed, setHistorySuggestionDismissed] = useState(false);
  const [backImage, setBackImage] = useState<string | undefined>(item?.backImage);
  const [analyzingBack, setAnalyzingBack] = useState(false);
  const [backError, setBackError] = useState("");
  const backFileRef = useRef<HTMLInputElement>(null);
  const [changingFront, setChangingFront] = useState(false);
  const [frontError, setFrontError] = useState("");
  const [frontRetagged, setFrontRetagged] = useState(false);
  const frontFileRef = useRef<HTMLInputElement>(null);
  const [retaggingItem, setRetaggingItem] = useState(false);
  const [retagItemError, setRetagItemError] = useState("");
  const [retagItemSuccess, setRetagItemSuccess] = useState(false);

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
        const aiImage = await resizeDataUrlForAI(dataUrl);
        const res = await fetch("/api/tag-item", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ image: aiImage, category }),
        });
        const result = await res.json().catch(() => ({}));
        if (!result?.error) {
          if (result?.name) {
            setName(result.name);
            setNameAutoFillable(false);
          }
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

  // Re-tags this single item on demand using its already-stored photo,
  // no new upload needed. Complements the bulk "Retag now" banner on
  // the closet page (which only targets items still named "Untitled
  // item"): this lets someone retag any individual item any time, e.g.
  // to refresh AI tags after adding manual details, or to retry a
  // single item that failed without waiting for/running a full batch.
  async function handleRetagWithAI() {
    if (!image) return;
    setRetaggingItem(true);
    setRetagItemError("");
    setRetagItemSuccess(false);
    try {
      const aiImage = await resizeDataUrlForAI(image);
      const res = await fetch("/api/tag-item", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: aiImage, category }),
      });
      const result = await res.json().catch(() => ({}));
      if (result?.error) {
        setRetagItemError(
          typeof result.error === "string" ? result.error : "Retagging failed."
        );
        return;
      }
      if (result?.name) {
        setName(result.name);
        setNameAutoFillable(false);
      }
      if (result?.subcategory) setSubcategory(result.subcategory);
      if (result?.tags && typeof result.tags === "object") {
        setTags(result.tags);
      }
      setRetagItemSuccess(true);
    } catch {
      setRetagItemError("Couldn't reach the tagging service.");
    } finally {
      setRetaggingItem(false);
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
        const aiImage = await resizeDataUrlForAI(dataUrl);
        const res = await fetch("/api/tag-item-back", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ image: aiImage, category }),
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

  async function handleSave() {
    setSaving(true);
    setSaveError("");
    try {
      await onSave({
        ...item,
        name: effectiveName.trim() || "Untitled item",
        category,
        subcategory: subcategory.trim() || undefined,
        tags: tags || {},
        notes: notes.trim() || undefined,
        laundryStatus,
        closetStatus,
        pinned,
        collections: collections.length > 0 ? collections : undefined,
        image: image || item.image,
        backImage: backImage || undefined,
        timesWorn: wornCount,
      });
    } catch (err) {
      // Previously unhandled: a failed save here (e.g. IndexedDB
      // storage quota exceeded) would silently do nothing, since this
      // sheet is a full-screen overlay, an error banner on the page
      // underneath would be completely invisible. Show it right here
      // instead, next to the button the person just tapped.
      setSaveError(
        err instanceof Error ? err.message : "Couldn't save that item."
      );
    } finally {
      setSaving(false);
    }
  }

  // Logs a wear immediately, independent of the AI Looks/Manifest flows
  // (which only bump timesWorn when their own "mark as worn" button is
  // used). This is the only way to log wearing something that wasn't
  // styled by the AI, e.g. an everyday grab that didn't go through
  // Looks at all. Saves right away rather than waiting for "Save
  // changes", since logging a wear is its own action, not a pending
  // edit the person might discard.
  // Logs a wear for the selected date (defaults to today), independent
  // of the AI Looks/Manifest flows (which only bump timesWorn when
  // their own "mark as worn" button is used). This is the only way to
  // log wearing something that wasn't styled by the AI, or to backfill
  // a wear from an earlier day. Saves right away rather than waiting
  // for "Save changes", since logging a wear is its own action, not a
  // pending edit the person might discard.
  async function handleMarkWorn(date: string) {
    const next = wornCount + 1;
    const nextHistory = [...wearHistory, date].sort();
    setSaveError("");
    try {
      await onSave({
        ...item,
        name: effectiveName.trim() || "Untitled item",
        category,
        subcategory: subcategory.trim() || undefined,
        tags: tags || {},
        notes: notes.trim() || undefined,
        laundryStatus,
        closetStatus,
        pinned,
        collections: collections.length > 0 ? collections : undefined,
        image: image || item.image,
        backImage: backImage || undefined,
        timesWorn: next,
        wearHistory: nextHistory,
      });
      setWornCount(next);
      setWearHistory(nextHistory);
      setWearDatePickerOpen(false);
    } catch (err) {
      setSaveError(
        err instanceof Error ? err.message : "Couldn't log that wear."
      );
    }
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
    if (editingTagKey === key) {
      setEditingTagKey(null);
      setEditingTagValue("");
    }
  }

  function startEditingTag(key: string, value: string) {
    setEditingTagKey(key);
    setEditingTagValue(value);
  }

  function commitEditingTag() {
    if (!editingTagKey) return;
    const value = editingTagValue.trim();
    setTags((prev) => {
      const next = { ...(prev || {}) };
      if (value) {
        next[editingTagKey] = value;
      } else {
        delete next[editingTagKey];
      }
      return next;
    });
    setEditingTagKey(null);
    setEditingTagValue("");
  }

  // Attribute chips support multi-select: a garment can be, say, both
  // "Emerald" and "Gold" colored, or have both "Racerback" and a
  // "Keyhole Back" detail. Since tags is a flat Record<string,string>,
  // multiple picks under the same key are stored as one comma-joined
  // string (e.g. tags.color = "Black, Emerald") rather than changing
  // the data model. This stays compatible with the styling-tip matcher,
  // which already scans all tag values as joined text for keywords, so
  // a comma-joined value still matches each individual color/style word.
  function parseAttributeValues(raw: string | undefined): string[] {
    return raw
      ? raw
          .split(",")
          .map((v) => v.trim())
          .filter(Boolean)
      : [];
  }

  function toggleAttribute(key: string, value: string) {
    setTags((prev) => {
      const current = parseAttributeValues(prev?.[key]);
      const next = current.includes(value)
        ? current.filter((v) => v !== value)
        : [...current, value];
      const updated = { ...(prev || {}) };
      if (next.length > 0) {
        updated[key] = next.join(", ");
      } else {
        delete updated[key];
      }
      return updated;
    });
  }

  // Secondary attribute rows: soft, text-forward segmented pills
  // (thin outline, no heavy fill unless selected) instead of the
  // uniformly-boxy button grid this used to be, per the "light text
  // rows and subtle chips" spec, kept visually quiet since these
  // appear a dozen times over on a single item.
  function renderAttributeRow(label: string, tagKey: string, options: string[]) {
    const selectedValues = parseAttributeValues(tags?.[tagKey]);
    return (
      <div>
        <p className="text-[11px] text-stone-400 mb-1.5">{label}</p>
        <div className="flex flex-wrap gap-1.5">
          {options.map((opt) => {
            const active = selectedValues.includes(opt);
            return (
              <button
                key={opt}
                type="button"
                onClick={() => toggleAttribute(tagKey, opt)}
                className={`px-2.5 py-1.5 rounded-full text-xs border transition-colors min-h-[32px] ${
                  active
                    ? "border-emerald-600 text-emerald-700 bg-emerald-50 font-medium"
                    : "border-clay-100 text-stone-500 bg-transparent"
                }`}
              >
                {opt}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // Anatomy Lens subcategory picker: search bar + a "Most used" row
  // drawn from the person's own closet (not a generic list), then
  // either collapsible accordion groups (only for categories with
  // enough volume that a flat list would be a wall of choices) or a
  // plain filtered list for smaller categories, where an accordion
  // would just be one more tap for no real benefit.
  function renderSubcategoryPicker() {
    const options = SUBCATEGORY_SUGGESTIONS[category] || [];
    if (options.length === 0) return null;
    const groups = SUBCATEGORY_GROUPS[category];

    const mostUsed = (() => {
      if (!allItems || subcategorySearch.trim()) return [];
      const counts = new Map<string, number>();
      for (const i of allItems) {
        if (i.category !== category || !i.subcategory || i.id === item.id) continue;
        const key = i.subcategory.trim().toLowerCase();
        counts.set(key, (counts.get(key) || 0) + 1);
      }
      return [...counts.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 4)
        .map(([key]) => key);
    })();

    function chip(opt: string, keyPrefix = "") {
      const active = subcategory === opt;
      return (
        <button
          key={keyPrefix + opt}
          type="button"
          onClick={() => {
            setSubcategory((prev) => (prev === opt ? "" : opt));
            setHistorySuggestionDismissed(false);
          }}
          className={`px-3 py-2 rounded-full text-xs min-h-[36px] capitalize border transition-colors ${
            active
              ? "border-emerald-600 bg-emerald-600 text-cream font-medium"
              : "border-clay-100 text-stone-500 bg-transparent"
          }`}
        >
          {opt}
        </button>
      );
    }

    const search = subcategorySearch.trim().toLowerCase();

    return (
      <div>
        <p className="text-[11px] text-stone-400 mb-1.5">
          Subcategory{" "}
          <span className="text-stone-300">
            (or type anything in the field above, e.g. what AI named it)
          </span>
        </p>
        {options.length > 6 ? (
          <div className="relative mb-2">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-stone-300" />
            <input
              value={subcategorySearch}
              onChange={(e) => setSubcategorySearch(e.target.value)}
              placeholder="Type to find..."
              className="w-full rounded-xl border border-clay-100 pl-8 pr-3 py-1.5 text-xs bg-white"
            />
          </div>
        ) : null}

        {mostUsed.length > 0 ? (
          <div className="mb-2">
            <p className="text-[10px] text-stone-300 mb-1">⭐ Most used</p>
            <div className="flex flex-wrap gap-2">
              {mostUsed.map((opt) => chip(opt, "recent-"))}
            </div>
          </div>
        ) : null}

        {groups ? (
          <div className="space-y-1.5">
            {Object.entries(groups).map(([groupLabel, groupOptions]) => {
              const filtered = search
                ? groupOptions.filter((o) => o.toLowerCase().includes(search))
                : groupOptions;
              if (filtered.length === 0) return null;
              const isOpen = openGroups.has(groupLabel) || Boolean(search);
              return (
                <div key={groupLabel} className="border border-clay-50 rounded-xl overflow-hidden">
                  <button
                    type="button"
                    onClick={() =>
                      setOpenGroups((prev) => {
                        const next = new Set(prev);
                        if (next.has(groupLabel)) next.delete(groupLabel);
                        else next.add(groupLabel);
                        return next;
                      })
                    }
                    className="w-full flex items-center justify-between px-3 py-2 bg-cream-50"
                  >
                    <span className="text-xs text-stone-600">{groupLabel}</span>
                    <ChevronDown
                      size={13}
                      className={`text-stone-400 transition-transform ${isOpen ? "rotate-180" : ""}`}
                    />
                  </button>
                  {isOpen ? (
                    <div className="flex flex-wrap gap-2 p-2.5 bg-white">
                      {filtered.map((opt) => chip(opt))}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {(search
              ? options.filter((o) => o.toLowerCase().includes(search))
              : options
            ).map((opt) => chip(opt))}
          </div>
        )}
      </div>
    );
  }

  // Smart History: looks at other items sharing this exact category +
  // subcategory, and finds attribute values that show up consistently
  // across them (a real majority, not just "someone picked this
  // once"), entirely from local tagging history, zero AI. Only
  // suggests values for attributes the current item doesn't already
  // have set, and never auto-applies anything without a tap, since a
  // silent auto-fill would be indistinguishable from a bug if it ever
  // suggested wrong.
  function computeHistorySuggestions(): Record<string, string> {
    if (!allItems || !subcategory.trim()) return {};
    const matches = allItems.filter(
      (i) =>
        i.id !== item.id &&
        i.category === category &&
        (i.subcategory || "").trim().toLowerCase() === subcategory.trim().toLowerCase()
    );
    if (matches.length < 2) return {};

    const valueCounts = new Map<string, Map<string, number>>();
    for (const match of matches) {
      for (const [key, rawValue] of Object.entries(match.tags || {})) {
        // Only consider the first value of a multi-select tag, same
        // simplification used elsewhere (grouping, naming), so one
        // unusual combo doesn't fragment the count.
        const value = rawValue.split(",")[0]?.trim();
        if (!value) continue;
        if (!valueCounts.has(key)) valueCounts.set(key, new Map());
        const counts = valueCounts.get(key)!;
        counts.set(value, (counts.get(value) || 0) + 1);
      }
    }

    const suggestions: Record<string, string> = {};
    for (const [key, counts] of valueCounts.entries()) {
      if (tags?.[key]) continue; // never override something already set
      const [topValue, topCount] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
      // Require a real majority (>50% of matching items agree), not
      // just the most common of several scattered one-off values.
      if (topCount / matches.length > 0.5) {
        suggestions[key] = topValue;
      }
    }
    return suggestions;
  }

  function renderHistorySuggestionBanner() {
    if (historySuggestionDismissed) return null;
    const suggestions = computeHistorySuggestions();
    const entries = Object.entries(suggestions);
    if (entries.length === 0) return null;
    return (
      <div className="rounded-xl bg-emerald-50 border border-emerald-100 p-2.5 flex items-start justify-between gap-2">
        <div>
          <p className="text-xs text-emerald-700 font-medium">
            You usually tag {subcategory} as:
          </p>
          <p className="text-xs text-emerald-600 mt-0.5">
            {entries.map(([k, v]) => `${k}: ${v}`).join(" · ")}
          </p>
        </div>
        <div className="flex flex-col gap-1 shrink-0">
          <button
            type="button"
            onClick={() => {
              setTags((prev) => ({ ...(prev || {}), ...suggestions }));
              setHistorySuggestionDismissed(true);
            }}
            className="text-[11px] bg-emerald-600 text-cream px-2.5 py-1 rounded-full font-medium"
          >
            Apply
          </button>
          <button
            type="button"
            onClick={() => setHistorySuggestionDismissed(true)}
            className="text-[11px] text-emerald-600"
          >
            Dismiss
          </button>
        </div>
      </div>
    );
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
                className="relative w-32 md:w-40 aspect-[3/4] rounded-2xl overflow-hidden bg-cream-100 shrink-0 group disabled:opacity-80"
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
                  value={effectiveName}
                  onChange={(e) => {
                    setName(e.target.value);
                    setNameAutoFillable(false);
                  }}
                  className="w-full mt-1 rounded-xl border border-clay-100 px-3 py-2 text-sm bg-white"
                  placeholder="Item name"
                />
                <button
                  type="button"
                  onClick={handleRetagWithAI}
                  disabled={retaggingItem || !image}
                  className="mt-1.5 flex items-center gap-1.5 text-[11px] text-emerald-700 font-medium disabled:opacity-60"
                >
                  {retaggingItem ? (
                    <Loader2 size={11} className="animate-spin" />
                  ) : (
                    <Sparkles size={11} />
                  )}
                  {retaggingItem ? "Retagging..." : "Retag with AI"}
                </button>
                {retagItemError ? (
                  <p className="mt-1 text-[11px] text-clay-700">{retagItemError}</p>
                ) : null}
                {retagItemSuccess && !retagItemError ? (
                  <p className="mt-1 text-[11px] text-emerald-700">
                    Retagged, details below were updated.
                  </p>
                ) : null}
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
                    onChange={(e) => {
                      setSubcategory(e.target.value);
                      setHistorySuggestionDismissed(false);
                    }}
                    className="w-full mt-1 rounded-xl border border-clay-100 px-3 py-2 text-sm bg-white"
                    placeholder="e.g. blouse, sneakers"
                  />
                </div>
              </div>
            </div>
          </div>

          <div>
            <label className="text-xs text-stone-500">
              Collections{" "}
              <span className="text-stone-300">(optional, pick any that fit)</span>
            </label>
            <div className="flex flex-wrap gap-2 mt-1.5">
              {COLLECTION_OPTIONS.map((c) => {
                const active = collections.includes(c);
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() =>
                      setCollections((prev) =>
                        prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]
                      )
                    }
                    className={`px-3 py-1.5 rounded-full text-xs border transition-colors ${
                      active
                        ? "border-emerald-600 bg-emerald-600 text-cream font-medium"
                        : "border-clay-100 text-stone-500 bg-transparent"
                    }`}
                  >
                    {c}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="text-xs text-stone-500">Tags</label>
            <div className="flex flex-wrap gap-2 mt-1.5">
              {Object.entries(tags || {}).map(([key, value]) =>
                editingTagKey === key ? (
                  <span
                    key={key}
                    className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 text-xs px-2 py-1 rounded-full"
                  >
                    <span className="whitespace-nowrap">{key}:</span>
                    <input
                      autoFocus
                      value={editingTagValue}
                      onChange={(e) => setEditingTagValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") commitEditingTag();
                        if (e.key === "Escape") {
                          setEditingTagKey(null);
                          setEditingTagValue("");
                        }
                      }}
                      onBlur={commitEditingTag}
                      className="w-20 bg-white rounded-full px-2 py-0.5 text-xs border border-emerald-200 focus:outline-none"
                    />
                  </span>
                ) : (
                  <button
                    key={key}
                    type="button"
                    onClick={() => startEditingTag(key, value)}
                    className="inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-700 text-xs px-2.5 py-1 rounded-full"
                  >
                    {key}: {value}
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={(e) => {
                        e.stopPropagation();
                        removeTag(key);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.stopPropagation();
                          removeTag(key);
                        }
                      }}
                      aria-label={`Remove ${key} tag`}
                      className="text-emerald-700/60 hover:text-emerald-700"
                    >
                      <X size={12} />
                    </span>
                  </button>
                )
              )}
            </div>

            <div className="mt-3 rounded-xl border border-clay-100 overflow-hidden">
              <button
                type="button"
                onClick={() => setDetailsOpen((o) => !o)}
                className="w-full flex items-center justify-between px-3 py-2 bg-cream-50"
              >
                <span className="text-xs font-medium text-stone-600">Details</span>
                <ChevronDown
                  size={14}
                  className={`text-stone-400 transition-transform ${
                    detailsOpen ? "rotate-180" : ""
                  }`}
                />
              </button>
              {detailsOpen ? (
                <div className="p-3 space-y-3 bg-white">
                  {renderSubcategoryPicker()}
                  {renderHistorySuggestionBanner()}

                  {category === "accessory" ? (
                    <>
                      {subcategory.toLowerCase().includes("jewelry")
                        ? renderAttributeRow("Jewelry Type", "jewelryType", JEWELRY_TYPE_OPTIONS)
                        : null}
                      {subcategory.toLowerCase().includes("hat")
                        ? renderAttributeRow("Hat Type", "hatType", HAT_TYPE_OPTIONS)
                        : null}
                      {subcategory.toLowerCase().includes("bag")
                        ? renderAttributeRow("Size", "size", BAG_SIZE_OPTIONS)
                        : null}
                      {renderAttributeRow(
                        "Material",
                        "material",
                        accessoryMaterialOptionsForSubcategory(subcategory)
                      )}
                    </>
                  ) : null}

                  {category === "bottom" ? (
                    <>
                      {!subcategory.toLowerCase().includes("short") &&
                      !subcategory.toLowerCase().includes("skort") &&
                      !subcategory.toLowerCase().includes("skirt")
                        ? renderAttributeRow("Fit", "fit", JEAN_CUT_OPTIONS)
                        : null}
                      {renderAttributeRow("Rise", "rise", RISE_HEIGHT_OPTIONS)}
                      {subcategory.toLowerCase().includes("jean") ||
                      parseAttributeValues(tags?.color).some((c) => c.toLowerCase().includes("denim"))
                        ? renderAttributeRow("Wash", "wash", WASH_OPTIONS)
                        : null}
                      {subcategory.toLowerCase().includes("skirt")
                        ? renderAttributeRow("Length", "length", SKIRT_LENGTH_OPTIONS)
                        : null}
                      {subcategory.toLowerCase().includes("short")
                        ? renderAttributeRow("Length", "length", SHORTS_LENGTH_OPTIONS)
                        : null}
                    </>
                  ) : null}

                  {category === "swimwear" ? (
                    <>
                      {renderAttributeRow("Swimsuit Type", "swimsuitType", SWIMSUIT_TYPE_OPTIONS)}
                      {renderAttributeRow("Top Style", "swimsuitTop", SWIMSUIT_TOP_STYLE_OPTIONS)}
                      {renderAttributeRow("Bottom Style", "swimsuitBottom", SWIMSUIT_BOTTOM_STYLE_OPTIONS)}
                      {renderAttributeRow("Back Style", "backStyle", BACK_STYLE_OPTIONS)}
                    </>
                  ) : null}

                  {category === "top" || category === "dress" || category === "set" ? (
                    <>
                      {renderAttributeRow("Neckline", "neckline", NECKLINE_OPTIONS)}
                      {renderAttributeRow("Silhouette", "silhouette", TOP_SILHOUETTE_OPTIONS)}
                      {category === "dress"
                        ? renderAttributeRow("Dress Silhouette", "dressSilhouette", DRESS_SILHOUETTE_OPTIONS)
                        : null}
                      {renderAttributeRow("Sleeve Length", "sleeveLength", SLEEVE_LENGTH_OPTIONS)}
                      {renderAttributeRow("Sleeve Style", "sleeve", SLEEVE_OPTIONS)}
                      {renderAttributeRow("Back Style", "backStyle", BACK_STYLE_OPTIONS)}
                      {subcategory.toLowerCase().includes("sweater") ||
                      subcategory.toLowerCase().includes("cardigan")
                        ? renderAttributeRow("Knit Type", "knitType", KNIT_TYPE_OPTIONS)
                        : null}
                      {subcategory.toLowerCase().includes("hoodie") ? (
                        <>
                          {renderAttributeRow("Hood Style", "hoodStyle", HOOD_STYLE_OPTIONS)}
                          {renderAttributeRow("Pocket", "pocket", HOOD_POCKET_OPTIONS)}
                        </>
                      ) : null}
                      {subcategory.toLowerCase().includes("sweatsuit") ||
                      subcategory.toLowerCase().includes("tracksuit") ||
                      subcategory.toLowerCase().includes("loungewear")
                        ? renderAttributeRow("Fit", "sweatsuitFit", GARMENT_FIT_OPTIONS)
                        : null}
                    </>
                  ) : null}

                  {category === "outerwear" ? (
                    <>
                      {renderAttributeRow("Closure", "closure", OUTERWEAR_CLOSURE_OPTIONS)}
                      {renderAttributeRow("Length", "length", OUTERWEAR_LENGTH_OPTIONS)}
                      {renderAttributeRow("Fit", "fit", GARMENT_FIT_OPTIONS)}
                    </>
                  ) : null}

                  {category === "shoes" ? (
                    <>
                      {subcategory.toLowerCase().includes("heel") ||
                      subcategory.toLowerCase().includes("boot") ||
                      subcategory.toLowerCase().includes("sandal")
                        ? renderAttributeRow("Heel Height", "heelHeight", SHOE_HEEL_OPTIONS)
                        : null}
                      {subcategory.toLowerCase().includes("heel") ||
                      subcategory.toLowerCase().includes("boot") ||
                      subcategory.toLowerCase().includes("flat")
                        ? renderAttributeRow("Toe Shape", "toeShape", SHOE_TOE_OPTIONS)
                        : null}
                      {renderAttributeRow("Material", "material", SHOE_MATERIAL_OPTIONS)}
                    </>
                  ) : null}

                  {category === "makeup" ? (
                    <>
                      {renderAttributeRow(
                        "Makeup Type",
                        "makeupType",
                        makeupTypeOptionsForSubcategory(subcategory)
                      )}
                      {(() => {
                        const selectedTypes = parseAttributeValues(tags?.makeupType);
                        const shadeOptions = Array.from(
                          new Set(selectedTypes.flatMap((t) => makeupShadeOptionsForType(t)))
                        );
                        if (shadeOptions.length === 0) return null;
                        return renderAttributeRow("Shade", "shade", shadeOptions);
                      })()}
                      {(() => {
                        const selectedTypes = parseAttributeValues(tags?.makeupType);
                        if (!makeupFinishAppliesToTypes(selectedTypes)) return null;
                        return renderAttributeRow("Finish", "finish", MAKEUP_FINISH_OPTIONS);
                      })()}
                    </>
                  ) : null}

                  {category !== "makeup" ? (
                    <>
                      <div className="border-t border-clay-50 -mx-3" />
                      {renderAttributeRow("Color", "color", COLOR_OPTIONS)}
                      {parseAttributeValues(tags?.jewelryType).includes("Earrings")
                        ? renderAttributeRow("Earring Type", "earringType", EARRING_TYPE_OPTIONS)
                        : renderAttributeRow("Pattern", "pattern", PATTERN_OPTIONS)}
                      {category !== "shoes" && category !== "accessory"
                        ? renderAttributeRow("Fabric", "fabric", FABRIC_OPTIONS)
                        : null}
                    </>
                  ) : null}
                </div>
              ) : null}
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
            {(() => {
              const statusConfig = getStatusFieldConfig(category);
              if (!statusConfig) return null;
              return (
                <div className="flex-1">
                  <label className="text-xs text-stone-500">
                    {statusConfig.label}
                  </label>
                  <div className="flex gap-1.5 mt-1.5">
                    {LAUNDRY_OPTIONS.map((opt) => (
                      <button
                        key={opt}
                        onClick={() => setLaundryStatus(opt)}
                        className={`px-3 py-1.5 rounded-full text-xs ${
                          laundryStatus === opt
                            ? "bg-emerald-600 text-cream"
                            : "bg-cream-100 text-stone-500"
                        }`}
                      >
                        {statusConfig.optionLabels[opt]}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })()}

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

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs text-stone-400">
                Worn {wornCount} {wornCount === 1 ? "time" : "times"}
              </p>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => handleMarkWorn(todayIso())}
                  className="flex items-center gap-1.5 text-xs text-emerald-700 font-medium"
                >
                  <Plus size={13} />
                  Mark as worn today
                </button>
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

            <button
              type="button"
              onClick={() => setWearDatePickerOpen((o) => !o)}
              className="text-[11px] text-stone-400 underline underline-offset-2"
            >
              {wearDatePickerOpen ? "Cancel" : "Log a different date"}
            </button>

            {wearDatePickerOpen ? (
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={wearDate}
                  max={todayIso()}
                  onChange={(e) => setWearDate(e.target.value)}
                  className="rounded-xl border border-clay-100 px-2.5 py-1.5 text-xs bg-white"
                />
                <button
                  onClick={() => handleMarkWorn(wearDate)}
                  className="rounded-full bg-emerald-600 text-cream text-xs font-medium px-3 py-1.5"
                >
                  Log wear
                </button>
              </div>
            ) : null}
          </div>
        </div>

        <div className="px-5 py-4 border-t border-clay-100 space-y-2">
          {saveError ? (
            <p className="text-xs text-clay-700">{saveError}</p>
          ) : null}
          <div className="flex gap-3">
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
                  disabled={saving}
                  className="flex-1 rounded-xl bg-emerald-600 text-cream py-2.5 text-sm font-medium active:scale-[0.98] transition-transform disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {saving ? <Loader2 size={16} className="animate-spin" /> : null}
                  {saving ? "Saving..." : "Save changes"}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
