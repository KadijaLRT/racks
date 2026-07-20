"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, Loader2, Sparkles, Shirt } from "lucide-react";
import Link from "next/link";
import BottomNav from "@/components/BottomNav";
import { closetStore, lookStore } from "@/lib/storage";
import type { ClosetItem, GeneratedLook } from "@/lib/types";

export default function InsightsPage() {
  const [closetItems, setClosetItems] = useState<ClosetItem[]>([]);
  const [looks, setLooks] = useState<GeneratedLook[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [gaps, setGaps] = useState<string[]>([]);
  const [patterns, setPatterns] = useState<string[]>([]);
  const [hasRun, setHasRun] = useState(false);

  useEffect(() => {
    Promise.all([closetStore.getAll(), lookStore.getAll()]).then(
      ([items, lookList]) => {
        setClosetItems(items || []);
        setLooks(lookList || []);
        setLoaded(true);
      }
    );
  }, []);

  async function runInsights() {
    if (closetItems.length === 0) {
      setError("Add some closet items first.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/closet-insights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: closetItems, looks }),
      });
      const data = await res.json().catch(() => ({}));
      if (data?.error) throw new Error(data.error);
      setGaps(data.gaps || []);
      setPatterns(data.patterns || []);
      setHasRun(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't build insights right now.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen pb-28 pt-safe bg-cream">
      <div className="max-w-md mx-auto px-4 pt-6 space-y-4">
        <div className="flex items-center gap-2">
          <Link href="/discover" aria-label="Back">
            <ArrowLeft size={18} className="text-stone-400" />
          </Link>
          <h1 className="text-xl font-semibold text-stone-800">Insights</h1>
        </div>
        <p className="text-sm text-stone-500">
          A quick read on real patterns and gaps in your closet, based on
          what you actually own and how you&apos;ve been styling it.
        </p>

        {error ? (
          <div className="rounded-xl bg-clay-50 text-clay-700 text-xs px-3 py-2">
            {error}
          </div>
        ) : null}

        {loaded && !hasRun ? (
          <button
            onClick={runInsights}
            disabled={busy}
            className="w-full rounded-xl bg-emerald-600 text-cream py-3 text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {busy ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Sparkles size={16} />
            )}
            {busy ? "Looking through your closet..." : "Run closet insights"}
          </button>
        ) : null}

        {hasRun ? (
          <div className="space-y-3">
            {patterns.length > 0 ? (
              <div className="bg-white rounded-2xl p-4">
                <p className="text-xs font-medium text-stone-600 mb-2">
                  What we noticed
                </p>
                <ul className="text-sm text-stone-600 space-y-1">
                  {patterns.map((p, i) => (
                    <li key={i}>• {p}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            {gaps.length > 0 ? (
              <div className="bg-white rounded-2xl p-4">
                <p className="text-xs font-medium text-clay-700 mb-2">
                  Worth considering
                </p>
                <ul className="text-sm text-stone-600 space-y-1">
                  {gaps.map((g, i) => (
                    <li key={i}>• {g}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            <button
              onClick={runInsights}
              disabled={busy}
              className="w-full rounded-xl border border-clay-200 text-stone-600 py-2.5 text-xs font-medium disabled:opacity-60"
            >
              {busy ? "Refreshing..." : "Refresh insights"}
            </button>

            <Link
              href="/cleanup"
              className="w-full rounded-xl bg-white border border-clay-100 py-2.5 text-xs font-medium text-stone-600 flex items-center justify-center gap-2"
            >
              <Shirt size={14} />
              Review rarely-worn items
            </Link>
          </div>
        ) : null}
      </div>

      <BottomNav />
    </main>
  );
}
