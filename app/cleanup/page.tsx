"use client";

import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import BottomNav from "@/components/BottomNav";
import { closetStore } from "@/lib/storage";
import type { ClosetItem } from "@/lib/types";
import { buildLocalCleanupSuggestions } from "@/lib/localCleanup";

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
  const router = useRouter();
  const [items, setItems] = useState<ClosetItem[]>([]);
  const [loaded, setLoaded] = useState(false);
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

  function computeNeglectedItems() {
    return items.map((item) => ({
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
  }

  function getSuggestions() {
    if (items.length === 0) return;
    const neglectedItems = computeNeglectedItems();
    const results = buildLocalCleanupSuggestions(neglectedItems);
    const map: Record<string, Suggestion> = {};
    for (const s of results) {
      map[s.id] = { action: s.action, reason: s.reason };
    }
    setSuggestions(map);
  }

  return (
    <main className="min-h-screen pb-28 pt-safe bg-cream">
      <div className="max-w-md mx-auto px-4 pt-6 space-y-4">
        <div className="flex items-center gap-2">
          <button
            onClick={() => router.back()}
            aria-label="Back"
            className="p-0.5 -m-0.5"
          >
            <ArrowLeft size={18} className="text-stone-400" />
          </button>
          <h1 className="text-xl font-semibold text-stone-800">Cleanup</h1>
        </div>
        <p className="text-sm text-stone-500">
          Your least-worn pieces. No pressure, just an easy way to decide
          what to keep, pass on, or fix.
        </p>

        {loaded && items.length > 0 && Object.keys(suggestions).length === 0 ? (
          <button
            onClick={getSuggestions}
            className="w-full rounded-xl border border-emerald-200 text-emerald-700 py-2.5 text-sm font-medium"
          >
            Get suggestions for these
          </button>
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
                          className="text-xs bg-emerald-50 text-emerald-700 px-3 py-2 rounded-full font-medium min-h-[36px]"
                        >
                          Suggested: {suggestion.action}
                        </button>
                        <p className="text-xs text-stone-400 mt-1">{suggestion.reason}</p>
                      </div>
                    ) : null}

                    <div className="flex flex-wrap gap-2">
                      {STATUS_OPTIONS.map((opt) => (
                        <button
                          key={opt.value}
                          onClick={() => setStatus(item, opt.value)}
                          className="px-3 py-2 rounded-full bg-cream-100 text-xs text-stone-500 min-h-[36px]"
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
