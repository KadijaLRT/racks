"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Heart, X, Sparkles } from "lucide-react";
import { styleProfileStore } from "@/lib/storage";

interface StyleCard {
  name: string;
  blurb: string;
  colors: string[];
}

const DECK: StyleCard[] = [
  { name: "Quiet Luxury", blurb: "Understated, expensive-looking basics", colors: ["#D8CFC0", "#3A362E", "#8C8172", "#EDE8DE"] },
  { name: "Old Money", blurb: "Tailored, heritage, no logos", colors: ["#1F3A2E", "#C9A66B", "#EDE8DE", "#3A362E"] },
  { name: "Clean Girl", blurb: "Minimal, fresh, effortless", colors: ["#F4EFE9", "#D9C8B4", "#FFFFFF", "#B8A88F"] },
  { name: "Y2K", blurb: "Playful, metallics, low-rise nostalgia", colors: ["#FF6EC7", "#C0C0C0", "#7DF9FF", "#F5F500"] },
  { name: "Dark Academia", blurb: "Moody, literary, tweed and plaid", colors: ["#3B2A20", "#5C4A3A", "#7A6A52", "#1A1512"] },
  { name: "Cottagecore", blurb: "Soft florals, romantic, handmade", colors: ["#EADFC8", "#9CAF88", "#E8C4B8", "#5C6E4F"] },
  { name: "Streetwear", blurb: "Bold graphics, oversized, sneaker-led", colors: ["#111111", "#E8E8E8", "#D1382E", "#3B4A9C"] },
  { name: "Coastal Grandmother", blurb: "Linen, breezy, effortless neutrals", colors: ["#F1ECE2", "#A8B8B0", "#E3D5C3", "#7C8A82"] },
  { name: "Maximalist", blurb: "Bold color, pattern mixing, more is more", colors: ["#C0392B", "#F1C40F", "#8E44AD", "#16A085"] },
  { name: "Scandinavian Minimal", blurb: "Clean lines, muted tones, function first", colors: ["#EDEDED", "#B0B0AC", "#2E2E2E", "#D8D2C4"] },
];

export default function StyleOnboarding() {
  const [index, setIndex] = useState(0);
  const [liked, setLiked] = useState<StyleCard[]>([]);
  const [exitDir, setExitDir] = useState<"left" | "right" | null>(null);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  const card = DECK[index];
  const finished = index >= DECK.length;

  function choose(direction: "left" | "right") {
    if (!card) return;
    setExitDir(direction);
    setTimeout(() => {
      if (direction === "right") setLiked((prev) => [...(prev || []), card]);
      setExitDir(null);
      setIndex((i) => i + 1);
    }, 180);
  }

  async function finish() {
    setSaving(true);
    try {
      const existing = await styleProfileStore.get();
      const likedNames = (liked || []).map((c) => c.name.toLowerCase());
      const addition = likedNames.length > 0 ? `Drawn to: ${likedNames.join(", ")}.` : "";
      const description = existing?.description
        ? `${existing.description} ${addition}`.trim()
        : addition;
      await styleProfileStore.save({
        description: description || undefined,
        userName: existing?.userName,
        updatedAt: Date.now(),
      });
      setDone(true);
    } catch {
      // Defensive: a failed save shouldn't trap the user on this screen.
      setDone(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="min-h-screen pb-28 pt-safe bg-cream">
      <div className="max-w-md mx-auto px-4 pt-6 space-y-4">
        <div className="flex items-center gap-2">
          <Link href="/style-profile" aria-label="Back to Style DNA">
            <ArrowLeft size={18} className="text-stone-400" />
          </Link>
          <h1 className="text-xl font-semibold text-stone-800">Swipe to style</h1>
        </div>
        <p className="text-xs text-stone-500 -mt-2">
          Love it or leave it, no forms, just taps.
        </p>

        {done ? (
          <div className="flex flex-col items-center py-10 text-center">
            <Sparkles size={28} className="text-emerald-600" />
            <p className="mt-3 text-lg font-medium text-stone-800">
              Added to your Style DNA
            </p>
            <p className="mt-1 max-w-[240px] text-sm text-stone-500">
              {(liked || []).length > 0
                ? `You gravitated toward ${(liked || []).map((c) => c.name).join(", ")}.`
                : "Noted, nothing stood out this round, that's fine too."}
            </p>
            <Link
              href="/style-profile"
              className="mt-4 rounded-full bg-white border border-clay-100 px-4 py-2 text-xs font-medium text-stone-600"
            >
              Back to Style DNA
            </Link>
          </div>
        ) : finished ? (
          <div className="flex flex-col items-center py-10 text-center">
            <p className="text-lg font-medium text-stone-800">
              You liked {(liked || []).length} of {DECK.length}
            </p>
            {(liked || []).length > 0 && (
              <div className="mt-3 flex flex-wrap justify-center gap-1.5">
                {(liked || []).map((c) => (
                  <span
                    key={c.name}
                    className="rounded-full bg-white border border-clay-100 px-2.5 py-1 text-[11px] text-stone-600"
                  >
                    {c.name}
                  </span>
                ))}
              </div>
            )}
            <button
              onClick={finish}
              disabled={saving}
              className="mt-5 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-medium text-white disabled:opacity-60"
            >
              {saving ? "Saving..." : "Save to my Style DNA"}
            </button>
          </div>
        ) : card ? (
          <>
            <p className="mb-2 text-center text-[11px] text-stone-400">
              {index + 1} / {DECK.length}
            </p>
            <div
              className="mx-auto max-w-xs overflow-hidden rounded-2xl border border-clay-100 bg-white transition-all duration-200"
              style={{
                transform:
                  exitDir === "right"
                    ? "translateX(120%) rotate(8deg)"
                    : exitDir === "left"
                    ? "translateX(-120%) rotate(-8deg)"
                    : "translateX(0) rotate(0deg)",
                opacity: exitDir ? 0 : 1,
              }}
            >
              <div className="grid grid-cols-2 grid-rows-2">
                {(card.colors || []).map((c, i) => (
                  <div key={i} style={{ backgroundColor: c }} className="aspect-square" />
                ))}
              </div>
              <div className="p-4">
                <p className="text-xl font-medium text-stone-800">{card.name}</p>
                <p className="mt-1 text-sm text-stone-500">{card.blurb}</p>
              </div>
            </div>

            <div className="mx-auto mt-5 flex max-w-xs justify-center gap-6">
              <button
                onClick={() => choose("left")}
                aria-label="Pass"
                className="flex h-14 w-14 items-center justify-center rounded-full border border-clay-100 bg-white"
              >
                <X size={22} className="text-stone-400" />
              </button>
              <button
                onClick={() => choose("right")}
                aria-label="Love it"
                className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-600"
              >
                <Heart size={22} className="text-white" />
              </button>
            </div>
          </>
        ) : null}
      </div>
    </main>
  );
}
