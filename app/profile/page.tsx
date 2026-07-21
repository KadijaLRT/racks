"use client";

import Link from "next/link";
import { ArrowLeft, Settings, Ruler, ChevronRight } from "lucide-react";
import BottomNav from "@/components/BottomNav";

const CARDS = [
  {
    href: "/profile/measurements",
    icon: Ruler,
    title: "Measurements & sizes",
    blurb: "Height, weight, bra size, and clothing sizes, used to inform look and wishlist suggestions.",
  },
  {
    href: "/settings",
    icon: Settings,
    title: "Settings",
    blurb: "Backup, restore, or clear your data.",
  },
];

export default function ProfilePage() {
  return (
    <main className="min-h-screen pb-28 pt-safe bg-cream">
      <div className="max-w-md mx-auto px-4 pt-6 space-y-4">
        <div className="flex items-center gap-2">
          <Link href="/" aria-label="Back">
            <ArrowLeft size={18} className="text-stone-400" />
          </Link>
          <h1 className="text-xl font-semibold text-stone-800">Profile</h1>
        </div>
        <p className="text-xs text-stone-500 -mt-2">
          Your sizing info and data settings.
        </p>

        <div className="space-y-3">
          {(CARDS || []).map(({ href, icon: Icon, title, blurb }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-3 rounded-2xl border border-clay-100 bg-white p-4"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-50">
                <Icon size={18} className="text-emerald-700" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-medium text-stone-800">{title}</p>
                <p className="mt-0.5 text-xs text-stone-500">{blurb}</p>
              </div>
              <ChevronRight size={16} className="shrink-0 text-stone-300" />
            </Link>
          ))}
        </div>
      </div>

      <BottomNav />
    </main>
  );
}
