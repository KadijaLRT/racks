"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, Loader2, Plus, Trash2, ArrowLeft } from "lucide-react";
import Link from "next/link";
import BottomNav from "@/components/BottomNav";
import { fileToResizedDataUrl } from "@/lib/image";
import { hairProfileStore, wigStore } from "@/lib/storage";
import type { HairMode, HairProfile, WigItem } from "@/lib/types";

const MODES: { value: HairMode; label: string }[] = [
  { value: "selfie", label: "My natural hair" },
  { value: "wig", label: "I wear wigs" },
  { value: "description", label: "I'll describe it" },
];

export default function HairPage() {
  const [profile, setProfile] = useState<HairProfile | null>(null);
  const [wigs, setWigs] = useState<WigItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [mode, setMode] = useState<HairMode>("selfie");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const wigFileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    Promise.all([hairProfileStore.get(), wigStore.getAll()]).then(
      ([hair, wigList]) => {
        setProfile(hair || null);
        setWigs(wigList || []);
        if (hair?.mode) setMode(hair.mode);
        if (hair?.description) setDescription(hair.description);
        setLoaded(true);
      }
    );
  }, []);

  async function handleSelfie(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true);
    setError("");
    try {
      const dataUrl = await fileToResizedDataUrl(file);
      if (!dataUrl) throw new Error("Couldn't read that photo.");

      let name = "";
      let tags: Record<string, string> = {};
      try {
        const res = await fetch("/api/tag-hair", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ image: dataUrl, mode: "selfie" }),
        });
        const tagged = await res.json().catch(() => ({}));
        if (!tagged?.error) {
          name = tagged?.name || "";
          tags = tagged?.tags || {};
        }
      } catch {
        // Fine to save untagged; user can still use it.
      }

      const saved: HairProfile = {
        mode: "selfie",
        image: dataUrl,
        name,
        tags,
        updatedAt: Date.now(),
      };
      await hairProfileStore.save(saved);
      setProfile(saved);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save that photo.");
    } finally {
      setBusy(false);
    }
  }

  async function handleWigFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true);
    setError("");
    try {
      const dataUrl = await fileToResizedDataUrl(file);
      if (!dataUrl) throw new Error("Couldn't read that photo.");

      let name = "Untitled wig";
      let tags: Record<string, string> = {};
      try {
        const res = await fetch("/api/tag-hair", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ image: dataUrl, mode: "wig" }),
        });
        const tagged = await res.json().catch(() => ({}));
        if (!tagged?.error) {
          name = tagged?.name || name;
          tags = tagged?.tags || {};
        }
      } catch {
        // Fine to save untagged.
      }

      const saved = await wigStore.create({ image: dataUrl, name, tags });
      setWigs((prev) => [saved, ...(prev || [])]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save that wig.");
    } finally {
      setBusy(false);
    }
  }

  async function removeWig(id: string) {
    await wigStore.remove(id);
    setWigs((prev) => (prev || []).filter((w) => w.id !== id));
  }

  async function saveDescriptionMode() {
    const saved: HairProfile = {
      mode: "description",
      description: description.trim(),
      // eslint-disable-next-line react-hooks/purity -- event handler only, not render
      updatedAt: Date.now(),
    };
    await hairProfileStore.save(saved);
    setProfile(saved);
  }

  async function selectMode(next: HairMode) {
    setMode(next);
    if (next === "description") {
      await saveDescriptionMode();
    } else {
      // Only invoked from the mode-picker's onClick handler, never
      // during render.
      const updatedAt =
        // eslint-disable-next-line react-hooks/purity
        Date.now();
      const saved: HairProfile = { ...(profile || {}), mode: next, updatedAt };
      await hairProfileStore.save(saved);
      setProfile(saved);
    }
  }

  return (
    <main className="min-h-screen pb-28 pt-safe bg-cream">
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleSelfie}
      />
      <input
        ref={wigFileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleWigFile}
      />

      <div className="max-w-md mx-auto px-4 pt-6 space-y-4">
        <div className="flex items-center gap-2">
          <Link href="/discover" aria-label="Back">
            <ArrowLeft size={18} className="text-stone-400" />
          </Link>
          <h1 className="text-xl font-semibold text-stone-800">Hair</h1>
        </div>

        <div className="flex gap-1.5">
          {MODES.map((m) => (
            <button
              key={m.value}
              onClick={() => selectMode(m.value)}
              className={`flex-1 px-2 py-2 rounded-xl text-xs font-medium ${
                mode === m.value
                  ? "bg-emerald-600 text-cream"
                  : "bg-cream-100 text-stone-500"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>

        {error ? (
          <div className="rounded-xl bg-clay-50 text-clay-700 text-xs px-3 py-2">
            {error}
          </div>
        ) : null}

        {mode === "selfie" ? (
          <div className="bg-white rounded-2xl p-4 space-y-3">
            {profile?.mode === "selfie" && profile?.image ? (
              <div className="flex gap-3 items-center">
                <div className="w-16 h-16 rounded-xl overflow-hidden bg-cream-100 shrink-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={profile.image}
                    alt="Your hair"
                    className="w-full h-full object-cover"
                  />
                </div>
                <div>
                  <p className="text-sm text-stone-700">{profile.name || "Your hair"}</p>
                  <p className="text-xs text-stone-400">
                    {Object.values(profile.tags || {}).join(" · ")}
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-xs text-stone-500">
                Add a selfie so outfit suggestions can factor in a realistic hairstyle.
              </p>
            )}
            <button
              onClick={() => fileRef.current?.click()}
              disabled={busy}
              className="w-full rounded-xl bg-emerald-600 text-cream py-2.5 text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {busy ? <Loader2 size={16} className="animate-spin" /> : <Camera size={16} />}
              {profile?.image ? "Update photo" : "Add a photo"}
            </button>
          </div>
        ) : null}

        {mode === "description" ? (
          <div className="bg-white rounded-2xl p-4 space-y-3">
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              onBlur={saveDescriptionMode}
              rows={3}
              placeholder="e.g. Shoulder-length, dark brown, loose waves"
              className="w-full rounded-xl border border-clay-100 px-3 py-2.5 text-sm resize-none"
            />
          </div>
        ) : null}

        {mode === "wig" ? (
          <div className="space-y-3">
            <button
              onClick={() => wigFileRef.current?.click()}
              disabled={busy}
              className="w-full rounded-xl bg-emerald-600 text-cream py-2.5 text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {busy ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
              Add a wig
            </button>

            {loaded && wigs.length === 0 ? (
              <p className="text-xs text-stone-400 text-center py-6">
                No wigs catalogued yet.
              </p>
            ) : (
              <div className="grid grid-cols-3 gap-3">
                {wigs.map((wig) => (
                  <div key={wig.id} className="relative">
                    <div className="aspect-square rounded-xl overflow-hidden bg-cream-100">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={wig.image}
                        alt={wig.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <p className="text-[11px] text-stone-600 mt-1 truncate">{wig.name}</p>
                    <button
                      onClick={() => removeWig(wig.id)}
                      className="absolute top-1 right-1 bg-cream/90 rounded-full p-1"
                      aria-label={`Remove ${wig.name}`}
                    >
                      <Trash2 size={12} className="text-clay-700" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : null}
      </div>

      <BottomNav />
    </main>
  );
}
