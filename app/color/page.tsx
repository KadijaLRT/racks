"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, Loader2, ArrowLeft } from "lucide-react";
import Link from "next/link";
import BottomNav from "@/components/BottomNav";
import { fileToResizedDataUrl } from "@/lib/image";
import { colorProfileStore } from "@/lib/storage";
import type { ColorProfile } from "@/lib/types";

export default function ColorPage() {
  const [profile, setProfile] = useState<ColorProfile | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    colorProfileStore.get().then((p) => {
      setProfile(p || null);
      setLoaded(true);
    });
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

      const res = await fetch("/api/analyze-color", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: dataUrl }),
      });
      const data = await res.json().catch(() => ({}));
      if (data?.error) throw new Error(data.error);

      const saved: ColorProfile = {
        undertone: data.undertone || "",
        contrast: data.contrast || "",
        season: data.season || "",
        bestColors: data.bestColors || [],
        avoidColors: data.avoidColors || [],
        updatedAt: Date.now(),
      };
      await colorProfileStore.save(saved);
      setProfile(saved);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Couldn't analyze that photo, try another one."
      );
    } finally {
      setBusy(false);
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

      <div className="max-w-md mx-auto px-4 pt-6 space-y-4">
        <div className="flex items-center gap-2">
          <Link href="/discover" aria-label="Back">
            <ArrowLeft size={18} className="text-stone-400" />
          </Link>
          <h1 className="text-xl font-semibold text-stone-800">Color</h1>
        </div>
        <p className="text-sm text-stone-500">
          A quick, approximate seasonal color read from a well-lit selfie.
          Looks will lean toward these colors when styling you.
        </p>

        {error ? (
          <div className="rounded-xl bg-clay-50 text-clay-700 text-xs px-3 py-2">
            {error}
          </div>
        ) : null}

        {loaded && profile ? (
          <div className="bg-white rounded-2xl p-4 space-y-3">
            <div>
              <p className="text-sm font-medium text-emerald-700">
                {profile.season || "Analyzed"}
              </p>
              <p className="text-xs text-stone-500 mt-0.5">
                {profile.undertone} undertone · {profile.contrast} contrast
              </p>
            </div>

            {(profile.bestColors || []).length > 0 ? (
              <div>
                <p className="text-xs font-medium text-stone-600 mb-1.5">Best colors</p>
                <div className="flex flex-wrap gap-1.5">
                  {profile.bestColors.map((c) => (
                    <span
                      key={c}
                      className="text-xs bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-full"
                    >
                      {c}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}

            {(profile.avoidColors || []).length > 0 ? (
              <div>
                <p className="text-xs font-medium text-stone-600 mb-1.5">Use sparingly</p>
                <div className="flex flex-wrap gap-1.5">
                  {profile.avoidColors.map((c) => (
                    <span
                      key={c}
                      className="text-xs bg-clay-50 text-clay-700 px-2.5 py-1 rounded-full"
                    >
                      {c}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        ) : null}

        <button
          onClick={() => fileRef.current?.click()}
          disabled={busy}
          className="w-full rounded-xl bg-emerald-600 text-cream py-3 text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-60"
        >
          {busy ? <Loader2 size={16} className="animate-spin" /> : <Camera size={16} />}
          {profile ? "Re-analyze with a new photo" : "Analyze a selfie"}
        </button>
      </div>

      <BottomNav />
    </main>
  );
}
