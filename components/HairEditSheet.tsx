"use client";

import { useRef, useState } from "react";
import { X, Camera, Loader2, Plus, Trash2 } from "lucide-react";
import { fileToResizedDataUrl } from "@/lib/image";

interface HairEditSheetProps {
  title: string;
  image?: string;
  name: string;
  tags: Record<string, string>;
  // When provided, shows a "Retag with AI" button that re-analyzes the
  // current photo via /api/tag-hair and fills in name/tags from it.
  retagMode?: "wig" | "selfie";
  onSave: (data: { image?: string; name: string; tags: Record<string, string> }) => void;
  onDelete?: () => void;
  onClose: () => void;
}

// Shared edit sheet for both wigs and the "my natural hair" selfie
// profile entry, since they're the same shape in practice (a photo,
// a name, and a few descriptive tags). Lets someone fix an AI-given
// name, add/remove detail tags, swap the photo, or re-run AI tagging,
// without needing to delete and re-add from scratch, and without
// duplicating this editor once per entry type.
export default function HairEditSheet({
  title,
  image,
  name: initialName,
  tags: initialTags,
  retagMode,
  onSave,
  onDelete,
  onClose,
}: HairEditSheetProps) {
  const [currentImage, setCurrentImage] = useState(image);
  const [name, setName] = useState(initialName);
  const [tags, setTags] = useState<Record<string, string>>(initialTags || {});
  const [newTagKey, setNewTagKey] = useState("");
  const [newTagValue, setNewTagValue] = useState("");
  const [changingPhoto, setChangingPhoto] = useState(false);
  const [photoError, setPhotoError] = useState("");
  const [retagging, setRetagging] = useState(false);
  const [retagError, setRetagError] = useState("");
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setPhotoError("");
    setChangingPhoto(true);
    try {
      const dataUrl = await fileToResizedDataUrl(file);
      if (!dataUrl) throw new Error("Couldn't read that photo.");
      setCurrentImage(dataUrl);
    } catch (err) {
      setPhotoError(err instanceof Error ? err.message : "Couldn't add that photo.");
    } finally {
      setChangingPhoto(false);
    }
  }

  async function retagWithAI() {
    if (!currentImage || !retagMode) return;
    setRetagging(true);
    setRetagError("");
    try {
      const res = await fetch("/api/tag-hair", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: currentImage, mode: retagMode }),
      });
      const tagged = await res.json().catch(() => ({}));
      if (tagged?.error) throw new Error(tagged.error);
      if (tagged?.name) setName(tagged.name);
      if (tagged?.tags) setTags(tagged.tags);
    } catch (err) {
      setRetagError(err instanceof Error ? err.message : "Couldn't retag that photo.");
    } finally {
      setRetagging(false);
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
  }

  function handleSave() {
    onSave({
      image: currentImage,
      name: name.trim() || "Untitled",
      tags: tags || {},
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col md:items-center md:justify-center bg-black/40"
      onClick={onClose}
    >
      <div
        className="mt-auto md:mt-0 md:max-w-sm md:w-full bg-cream rounded-t-3xl md:rounded-3xl max-h-[85vh] flex flex-col pb-safe"
        onClick={(e) => e.stopPropagation()}
      >
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handlePhotoChange}
        />

        <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-clay-100">
          <h2 className="text-base font-medium text-stone-800">{title}</h2>
          <button onClick={onClose} aria-label="Close">
            <X size={20} className="text-stone-400" />
          </button>
        </div>

        <div className="overflow-y-auto px-5 py-4 space-y-4 flex-1">
          <div className="flex justify-center">
            <button
              onClick={() => fileRef.current?.click()}
              disabled={changingPhoto}
              aria-label="Change photo"
              className="relative w-28 aspect-square rounded-2xl overflow-hidden bg-cream-100 disabled:opacity-80"
            >
              {currentImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={currentImage}
                  alt={name || "Photo"}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Camera size={20} className="text-stone-300" />
                </div>
              )}
              <div className="absolute inset-0 bg-black/0 md:hover:bg-black/20 md:transition-colors" />
              {changingPhoto ? (
                <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                  <Loader2 size={18} className="text-white animate-spin" />
                </div>
              ) : (
                <span className="absolute bottom-1.5 right-1.5 flex items-center gap-1 bg-black/60 text-cream text-[10px] px-2 py-1 rounded-full">
                  <Camera size={11} />
                  Change
                </span>
              )}
            </button>
          </div>
          {photoError ? (
            <p className="text-xs text-clay-700 text-center -mt-2">{photoError}</p>
          ) : null}

          <div>
            <label className="text-xs text-stone-500">Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full mt-1 rounded-xl border border-clay-100 px-3 py-2 text-sm bg-white"
              placeholder="e.g. Honey blonde balayage"
            />
            {retagMode ? (
              <button
                onClick={retagWithAI}
                disabled={retagging || !currentImage}
                className="mt-1.5 flex items-center gap-1.5 text-xs text-emerald-700 font-medium disabled:opacity-60"
              >
                {retagging ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : (
                  <span aria-hidden>✨</span>
                )}
                {retagging ? "Retagging..." : "Retag with AI"}
              </button>
            ) : null}
            {retagError ? (
              <p className="mt-1 text-xs text-clay-700">{retagError}</p>
            ) : null}
          </div>

          <div>
            <label className="text-xs text-stone-500">Details</label>
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
                aria-label="Add detail"
              >
                <Plus size={16} />
              </button>
            </div>
          </div>
        </div>

        <div className="px-5 py-4 border-t border-clay-100 space-y-2">
          {onDelete ? (
            confirmingDelete ? (
              <div className="flex gap-2">
                <button
                  onClick={() => setConfirmingDelete(false)}
                  className="flex-1 rounded-xl border border-clay-200 py-2.5 text-sm text-stone-600"
                >
                  Cancel
                </button>
                <button
                  onClick={onDelete}
                  className="flex-1 rounded-xl bg-clay-700 text-cream py-2.5 text-sm font-medium"
                >
                  Confirm delete
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmingDelete(true)}
                className="w-full flex items-center justify-center gap-2 rounded-xl border border-clay-200 text-clay-700 py-2.5 text-sm font-medium"
              >
                <Trash2 size={16} />
                Delete
              </button>
            )
          ) : null}
          <button
            onClick={handleSave}
            className="w-full rounded-xl bg-emerald-600 text-cream py-2.5 text-sm font-medium"
          >
            Save changes
          </button>
        </div>
      </div>
    </div>
  );
}
