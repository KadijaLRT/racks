"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Shirt } from "lucide-react";
import BottomNav from "@/components/BottomNav";
import NudgesList from "@/components/home/NudgesList";
import UpcomingPlans from "@/components/home/UpcomingPlans";
import { closetStore } from "@/lib/storage";
import type { ClosetItem } from "@/lib/types";

function greetingForHour(hour: number): string {
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export default function HomePage() {
  const [items, setItems] = useState<ClosetItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  // Computed client-side only, after mount, rather than calling
  // new Date() directly during render: this component's initial HTML
  // is still server-rendered, and the server's clock/timezone won't
  // generally match the person's actual local time, so evaluating the
  // greeting inline risks a real mismatch between what the server sent
  // and what the client immediately recomputes on hydration. A neutral
  // greeting for that first paint avoids it entirely.
  const [greeting, setGreeting] = useState("Hello");

  useEffect(() => {
    // Legitimate one-time exception to the setState-in-effect rule,
    // same reasoning as the shake-gesture feature detection elsewhere
    // in this app: this reads the client's actual clock, which can't
    // be computed during render without risking a mismatch against
    // whatever the server's clock said, and it only ever runs once on
    // mount, not a cascading update loop.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setGreeting(greetingForHour(new Date().getHours()));
    closetStore.getAll().then((all) => {
      setItems(all || []);
      setLoaded(true);
    });
  }, []);

  const closetCount = (items || []).length;

  return (
    <main className="min-h-screen pb-28 pt-safe bg-cream">
      <div className="max-w-md mx-auto px-4 pt-6 space-y-5">
        <div>
          <h1 className="text-xl font-semibold text-stone-800">
            {greeting}
          </h1>
          <p className="text-sm text-stone-500 mt-0.5">
            Here&apos;s what&apos;s happening with your closet.
          </p>
        </div>

        <NudgesList items={items} />

        <UpcomingPlans />

        <section>
          {!loaded ? (
            <div className="bg-white rounded-2xl px-4 py-4 animate-pulse">
              <div className="h-4 w-32 bg-cream-100 rounded" />
              <div className="h-3 w-40 bg-cream-100 rounded mt-2" />
            </div>
          ) : closetCount === 0 ? (
            <Link
              href="/closet"
              className="flex items-center gap-3 bg-white rounded-2xl px-4 py-4"
            >
              <div className="w-11 h-11 rounded-xl bg-emerald-100 flex items-center justify-center shrink-0">
                <Shirt size={20} className="text-emerald-700" />
              </div>
              <div>
                <p className="text-sm font-medium text-stone-700">
                  Add your first item
                </p>
                <p className="text-xs text-stone-400">
                  Snap a photo and we&apos;ll tag it for you.
                </p>
              </div>
            </Link>
          ) : (
            <div className="flex items-center justify-between bg-white rounded-2xl px-4 py-4">
              <div>
                <p className="text-sm font-medium text-stone-700">
                  {closetCount} {closetCount === 1 ? "item" : "items"} in your
                  closet
                </p>
                <p className="text-xs text-stone-400">
                  Browse, tag, or add something new.
                </p>
              </div>
              <Link
                href="/closet"
                className="rounded-xl bg-emerald-600 text-cream px-3.5 py-2 text-xs font-medium shrink-0"
              >
                Open closet
              </Link>
            </div>
          )}
        </section>
      </div>

      <BottomNav />
    </main>
  );
}
