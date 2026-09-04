"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check } from "lucide-react";
import BottomNav from "@/components/BottomNav";
import { measurementsStore } from "@/lib/storage";
import type { UserMeasurements } from "@/lib/types";

const FIELDS: Array<{
  key: keyof Omit<UserMeasurements, "updatedAt">;
  label: string;
  placeholder: string;
}> = [
  { key: "height", label: "Height", placeholder: `e.g. 5'6" or 168 cm` },
  { key: "weight", label: "Weight", placeholder: "e.g. 140 lbs or 63 kg" },
  { key: "braSize", label: "Bra size", placeholder: "e.g. 34D" },
  { key: "topSize", label: "Top size", placeholder: "e.g. M, or 8" },
  { key: "bottomSize", label: "Bottom size", placeholder: "e.g. 29, or M" },
  { key: "dressSize", label: "Dress size", placeholder: "e.g. 6, or S" },
  { key: "setSize", label: "Set size", placeholder: "e.g. M, or 8" },
  { key: "shoeSize", label: "Shoe size", placeholder: "e.g. 8.5 US" },
];

export default function MeasurementsPage() {
  const [loaded, setLoaded] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState("");
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState("");

  useEffect(() => {
    measurementsStore.get().then((m) => {
      const next: Record<string, string> = {};
      for (const f of FIELDS) {
        next[f.key] = m?.[f.key] || "";
      }
      setValues(next);
      setNotes(m?.notes || "");
      setLoaded(true);
    });
  }, []);

  async function handleSave() {
    const cleaned: Record<string, string> = {};
    for (const f of FIELDS) {
      const v = (values[f.key] || "").trim();
      if (v) cleaned[f.key] = v;
    }
    setSaveError("");
    try {
      await measurementsStore.save({
        ...cleaned,
        notes: notes.trim() || undefined,
        updatedAt: Date.now(),
      } as UserMeasurements);
      setSaved(true);
      setTimeout(() => setSaved(false), 2200);
    } catch {
      setSaveError("Couldn't save that, try again.");
    }
  }

  return (
    <main className="min-h-screen pb-28 pt-safe bg-cream">
      <div className="max-w-md mx-auto px-4 pt-6 space-y-4">
        <div className="flex items-center gap-2">
          <Link href="/profile" aria-label="Back">
            <ArrowLeft size={18} className="text-stone-400" />
          </Link>
          <h1 className="text-xl font-semibold text-stone-800">Measurements & sizes</h1>
        </div>
        <p className="text-xs text-stone-500 -mt-2">
          Used as context for look and wishlist suggestions, everything here is
          optional and stays on this device.
        </p>

        {loaded ? (
          <div className="space-y-3">
            {FIELDS.map((f) => (
              <div key={f.key}>
                <label className="text-xs text-stone-500">{f.label}</label>
                <input
                  value={values[f.key] || ""}
                  onChange={(e) =>
                    setValues((prev) => ({ ...(prev || {}), [f.key]: e.target.value }))
                  }
                  placeholder={f.placeholder}
                  className="w-full mt-1 rounded-xl border border-clay-100 px-3 py-2 text-sm bg-white"
                />
              </div>
            ))}

            <div>
              <label className="text-xs text-stone-500">Notes</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder="Anything else worth knowing, e.g. fit preferences, brands that run small"
                className="w-full mt-1 rounded-xl border border-clay-100 px-3 py-2 text-sm bg-white resize-none"
              />
            </div>

            {saveError ? (
              <p className="text-xs text-clay-700">{saveError}</p>
            ) : null}

            <button
              onClick={handleSave}
              className="w-full rounded-xl bg-emerald-600 text-cream py-3 text-sm font-medium flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
            >
              {saved ? (
                <>
                  <Check size={16} /> Saved
                </>
              ) : (
                "Save"
              )}
            </button>
          </div>
        ) : (
          <div className="space-y-3 animate-pulse">
            {FIELDS.map((f) => (
              <div key={f.key}>
                <div className="h-3 w-20 bg-cream-100 rounded mb-1.5" />
                <div className="h-10 w-full bg-cream-100 rounded-xl" />
              </div>
            ))}
          </div>
        )}
      </div>

      <BottomNav />
    </main>
  );
}
