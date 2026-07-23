"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, Shirt } from "lucide-react";
import Link from "next/link";
import BottomNav from "@/components/BottomNav";
import { closetStore } from "@/lib/storage";
import type { ClosetItem } from "@/lib/types";
import { buildLocalInsights } from "@/lib/localInsights";

// Entirely local, zero AI, zero network: real statistics computed
// directly from the closet (wear counts, category balance, color
// concentration) rather than requiring a model, since what "insights"
// surfaces is genuine arithmetic, not language understanding that
// would benefit from AI phrasing enough to be worth the Groq usage.
export default function InsightsPage() {
  const [closetItems, setClosetItems] = useState<ClosetItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const [gaps, setGaps] = useState<string[]>([]);
  const [patterns, setPatterns] = useState<string[]>([]);
  const [hasRun, setHasRun] = useState(false);

  useEffect(() => {
    closetStore.getAll().then((items) => {
      setClosetItems(items || []);
      setLoaded(true);
    });
  }, []);

  function runInsights() {
    if (closetItems.length === 0) {
      setError("Add some closet items first.");
      return;
    }
    setError("");
    const local = buildLocalInsights(closetItems);
    setGaps(local.gaps);
    setPatterns(local.patterns);
    setHasRun(true);
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
            className="w-full rounded-xl bg-emerald-600 text-cream py-3 text-sm font-medium"
          >
            Run closet insights
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
              className="w-full rounded-xl border border-clay-200 text-stone-600 py-2.5 text-xs font-medium"
            >
              Refresh insights
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
