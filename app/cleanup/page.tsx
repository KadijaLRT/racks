"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, Sparkles, Loader2 } from "lucide-react";
import Link from "next/link";
import BottomNav from "@/components/BottomNav";
import { closetStore } from "@/lib/storage";
import type { ClosetItem } from "@/lib/types";

const STATUS_OPTIONS: { value: NonNullable<ClosetItem["closetStatus"]>; label: string }[] = [
  { value: "keep", label: "Keep" },
  { value: "donate", label: "Donate" },
  { value: "sell", label: "Sell" },
  { value: "repair", label: "Repair" },
  { value: "store", label: "Store" },
];

interface Suggestion {
  action: NonNullable<ClosetItem["closetStatus"]>;
  reason: string;
}

export default function CleanupPage() {
  const [items, setItems] = useState<ClosetItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [suggestionError, setSuggestionError] = useState("");
  const [suggestions, setSuggestions] = useState<Record<string, Suggestion>>({});

  useEffect(() => {
    closetStore.getAll().then((all) => {
      const rarelyWorn = (all || [])
        .filter((i) => !i.closetStatus || i.closetStatus === "keep")
        .filter((i) => i.category !== "makeup")
        .sort((a, b) => (a.timesWorn || 0) - (b.timesWorn || 0))
        .slice(0, 30);
      setItems(rarelyWorn);
      setLoaded(true);
    });
  }, []);

  async function setStatus(item: ClosetItem, status: ClosetItem["closetStatus"]) {
    const updated = { ...item, closetStatus: status };
    await closetStore.update(updated);
    setItems((prev) => prev.filter((i) => i.id !== item.id));
    setSuggestions((prev) => {
      const next = { ...prev };
      delete next[item.id];
      return next;
    });
  }

  async function getSuggestions() {
    if (items.length === 0) return;
    setSuggesting(true);
    setSuggestionError("");
    try {
      const neglectedItems = items.map((item) => ({
        id: item.id,
        category: item.category,
        name: item.name,
        tags: item.tags,
        timesWorn: item.timesWorn || 0,
        ageDays: Math.max(
          0,
          Math.round((Date.now() - (item.createdAt || Date.now())) / (24 * 60 * 60 * 1000))
        ),
      }));

      const res = await fetch("/api/closet-cleanup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ neglectedItems }),
      });
      const data = await res.json().catch(() => ({}));
      if (data?.error) throw new Error(data.error);

      const map: Record<string, Suggestion> = {};
      for (const s of data?.suggestions || []) {
        if (s?.id) map[s.id] = { action: s.action, reason: s.reason };
      }
      setSuggestions(map);
    } catch (err) {
      setSuggestionError(
        err instanceof Error ? err.message : "Couldn't get suggestions right now."
      );
    } finally {
      setSuggesting(false);
    }
  }

  return (
    <main className="min-h-screen pb-28 pt-safe bg-cream">
      <div className="max-w-md mx-auto px-4 pt-6 space-y-4">
        <div className="flex items-center gap-2">
          <Link href="/insights" aria-label="Back">
            <ArrowLeft size={18} className="text-stone-400" />
          </Link>
          <h1 className="text-xl font-semibold text-stone-800">Cleanup</h1>
        </div>
        <p className="text-sm text-stone-500">
          Your least-worn pieces. No pressure, just an easy way to decide
          what to keep, pass on, or fix.
        </p>

        {loaded && items.length > 0 && Object.keys(suggestions).length === 0 ? (
          <button
            onClick={getSuggestions}
            disabled={suggesting}
            className="w-full rounded-xl border border-emerald-200 text-emerald-700 py-2.5 text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {suggesting ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Sparkles size={16} />
            )}
            {suggesting ? "Thinking it through..." : "Get suggestions for these"}
          </button>
        ) : null}

        {suggestionError ? (
          <div className="rounded-xl bg-clay-50 text-clay-700 text-xs px-3 py-2">
            {suggestionError}
          </div>
        ) : null}

        {loaded && items.length === 0 ? (
          <div className="text-center py-16 px-6">
            <p className="text-sm text-stone-500">
              Nothing to review right now, everything looks accounted for.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((item) => {
              const suggestion = suggestions[item.id];
              return (
                <div key={item.id} className="bg-white rounded-2xl p-3 flex gap-3">
                  <div className="w-16 h-20 rounded-xl overflow-hidden bg-cream-100 shrink-0">
                    {item.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={item.image}
                        alt={item.name}
                        className="w-full h-full object-cover"
                      />
                    ) : null}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-stone-700 truncate">{item.name}</p>
                    <p className="text-xs text-stone-400 mb-2">
                      Worn {item.timesWorn || 0} {item.timesWorn === 1 ? "time" : "times"}
                    </p>

                    {suggestion ? (
                      <div className="mb-2">
                        <button
                          onClick={() => setStatus(item, suggestion.action)}
                          className="text-xs bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-full font-medium"
                        >
                          Suggested: {suggestion.action}
                        </button>
                        <p className="text-xs text-stone-400 mt-1">{suggestion.reason}</p>
                      </div>
                    ) : null}

                    <div className="flex flex-wrap gap-1.5">
                      {STATUS_OPTIONS.map((opt) => (
                        <button
                          key={opt.value}
                          onClick={() => setStatus(item, opt.value)}
                          className="px-2.5 py-1 rounded-full bg-cream-100 text-xs text-stone-500"
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <BottomNav />
    </main>
  );
}
