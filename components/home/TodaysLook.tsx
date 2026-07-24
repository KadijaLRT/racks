"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Shuffle, Sparkles } from "lucide-react";
import OutfitItemStrip from "@/components/OutfitItemStrip";
import { todaysLookStore } from "@/lib/storage";
import type { ClosetItem, DailyLook } from "@/lib/types";
import { buildLocalLook, estimateFormality, vibeLabelForFormality } from "@/lib/localLookBuilder";

function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

// The "zero-thought morning routine" piece: a curated hero look
// waiting at the top of Home, generated entirely locally (zero AI,
// zero Groq usage, never blocked by a rate limit) and cached for the
// day so it reads as "your stylist picked this for today," not a
// different random outfit every time you open the app. Regenerates
// automatically if the cached look's items are no longer valid (worn
// out, marked dirty, deleted) rather than showing a stale outfit.
export default function TodaysLook({ items }: { items: ClosetItem[] }) {
  const [look, setLook] = useState<DailyLook | null>(null);
  const [loaded, setLoaded] = useState(false);

  function buildAndCache() {
    const local = buildLocalLook(items);
    if (!local) {
      setLook(null);
      return;
    }
    const resolved = local.itemIds
      .map((id) => items.find((i) => i.id === id))
      .filter(Boolean) as ClosetItem[];
    const avgFormality =
      resolved.reduce((sum, i) => sum + estimateFormality(i), 0) / (resolved.length || 1);
    const daily: DailyLook = {
      date: todayKey(),
      itemIds: local.itemIds,
      reasoning: local.reasoning,
      vibeLabel: vibeLabelForFormality(avgFormality),
      updatedAt: Date.now(),
    };
    todaysLookStore.save(daily);
    setLook(daily);
  }

  useEffect(() => {
    todaysLookStore.get().then((cached) => {
      if (items.length === 0) {
        setLook(null);
        setLoaded(true);
        return;
      }
      const stillValid =
        cached &&
        cached.date === todayKey() &&
        cached.itemIds.every((id) => {
          const item = items.find((i) => i.id === id);
          return item && item.laundryStatus === "clean" && item.closetStatus !== "store";
        });
      if (stillValid) {
        setLook(cached);
      } else {
        buildAndCache();
      }
      setLoaded(true);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.length]);

  if (!loaded || items.length === 0) return null;

  if (!look) {
    return (
      <div className="rounded-[28px] bg-white p-5 shadow-sm">
        <p className="text-sm text-stone-500">
          Add a few more clean items (a top, a bottom or dress, and shoes) and
          your stylist will have a look ready here every day.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-[28px] bg-white p-5 shadow-sm space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-wide text-emerald-700 font-medium">
            Today&apos;s Look
          </p>
          <h2 className="text-2xl font-semibold text-stone-800 leading-tight">
            {look.vibeLabel}
          </h2>
        </div>
        <button
          onClick={buildAndCache}
          className="shrink-0 w-9 h-9 rounded-full bg-cream-100 flex items-center justify-center"
          aria-label="Shuffle today's look"
        >
          <Shuffle size={15} className="text-stone-500" />
        </button>
      </div>

      <OutfitItemStrip itemIds={look.itemIds} items={items} />

      <p className="text-xs text-stone-500">{look.reasoning}</p>

      <Link
        href="/looks"
        className="inline-flex items-center gap-1.5 text-xs text-emerald-700 font-medium"
      >
        <Sparkles size={12} />
        Refine this with AI
      </Link>
    </div>
  );
}
