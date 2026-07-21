"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Camera, Loader2, Trash2 } from "lucide-react";
import Link from "next/link";
import BottomNav from "@/components/BottomNav";
import { fileToResizedDataUrl } from "@/lib/image";
import { styleProfileStore, inspirationStore } from "@/lib/storage";
import type { StyleInspiration } from "@/lib/types";

export default function StyleProfilePage() {
  const [description, setDescription] = useState("");
  const [userName, setUserName] = useState("");
  const [inspirations, setInspirations] = useState<StyleInspiration[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    Promise.all([styleProfileStore.get(), inspirationStore.getAll()]).then(
      ([profile, list]) => {
        setDescription(profile?.description || "");
        setUserName(profile?.userName || "");
        setInspirations(list || []);
        setLoaded(true);
      }
    );
  }, []);

  async function persistProfile(nextDescription: string, nextName: string) {
    await styleProfileStore.save({
      description: nextDescription.trim() || undefined,
      userName: nextName.trim() || undefined,
      updatedAt: Date.now(),
    });
  }

  async function handlePhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true);
    setError("");
    try {
      const dataUrl = await fileToResizedDataUrl(file);
      if (!dataUrl) throw new Error("Couldn't read that photo.");

      let keywords: string[] = [];
      try {
        const res = await fetch("/api/analyze-style", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ image: dataUrl }),
        });
        const data = await res.json().catch(() => ({}));
        if (!data?.error) keywords = data?.keywords || [];
      } catch {
        // Fine to save untagged.
      }

      const saved = await inspirationStore.create({ image: dataUrl, keywords });
      setInspirations((prev) => [saved, ...(prev || [])]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save that photo.");
    } finally {
      setBusy(false);
    }
  }

  async function removeInspiration(id: string) {
    await inspirationStore.remove(id);
    setInspirations((prev) => (prev || []).filter((i) => i.id !== id));
  }

  return (
    <main className="min-h-screen pb-28 pt-safe bg-cream">
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handlePhoto}
      />

      <div className="max-w-md mx-auto px-4 pt-6 space-y-4">
        <div className="flex items-center gap-2">
          <Link href="/profile" aria-label="Back">
            <ArrowLeft size={18} className="text-stone-400" />
          </Link>
          <h1 className="text-xl font-semibold text-stone-800">Style DNA</h1>
        </div>

        <Link
          href="/style-profile/onboarding"
          className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-[11px] font-medium text-emerald-700"
        >
          ✨ Swipe to style instead
        </Link>

        <div className="bg-white rounded-2xl p-4 space-y-3">
          <div>
            <label className="text-xs text-stone-500">What should I call you?</label>
            <input
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              onBlur={() => persistProfile(description, userName)}
              placeholder="Your name"
              className="w-full mt-1 rounded-xl border border-clay-100 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-xs text-stone-500">
              Describe your style in your own words
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              onBlur={() => persistProfile(description, userName)}
              rows={3}
              placeholder="e.g. Quiet luxury with a soft, romantic edge"
              className="w-full mt-1 rounded-xl border border-clay-100 px-3 py-2 text-sm resize-none"
            />
          </div>
        </div>

        {error ? (
          <div className="rounded-xl bg-clay-50 text-clay-700 text-xs px-3 py-2">
            {error}
          </div>
        ) : null}

        <div>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-medium text-stone-700">
              Inspiration photos
            </h2>
            <button
              onClick={() => fileRef.current?.click()}
              disabled={busy}
              className="p-1.5 rounded-full bg-emerald-100 text-emerald-700 disabled:opacity-60"
              aria-label="Add inspiration photo"
            >
              {busy ? <Loader2 size={16} className="animate-spin" /> : <Camera size={16} />}
            </button>
          </div>

          {loaded && inspirations.length === 0 ? (
            <p className="text-xs text-stone-400">
              Add a photo of an outfit or mood board you love, I&apos;ll
              pull out the aesthetic keywords and lean toward them in Looks.
            </p>
          ) : (
            <div className="grid grid-cols-3 gap-3">
              {inspirations.map((insp) => (
                <div key={insp.id} className="relative">
                  <div className="aspect-square rounded-xl overflow-hidden bg-cream-100">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={insp.image}
                      alt={(insp.keywords || []).join(", ") || "Style inspiration"}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <p className="text-[10px] text-stone-500 mt-1 truncate">
                    {(insp.keywords || []).slice(0, 2).join(", ")}
                  </p>
                  <button
                    onClick={() => removeInspiration(insp.id)}
                    className="absolute top-1 right-1 bg-cream/90 rounded-full p-1"
                    aria-label="Remove inspiration photo"
                  >
                    <Trash2 size={12} className="text-clay-700" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <BottomNav />
    </main>
  );
}
