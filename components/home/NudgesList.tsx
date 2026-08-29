"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import Link from "next/link";
import { planStore, appSettingsStore } from "@/lib/storage";
import type { ClosetItem, UpcomingPlan } from "@/lib/types";

interface Nudge {
  id: string;
  text: string;
  tapLabel?: string;
  href?: string;
}

// Nudges are informational only, never a streak, count-down, or penalty.
// Dismissing one is a one-time, session-local action (never persisted as
// a "missed" mark against the user), consistent with the forgiving-
// systems rule: no punitive mechanics anywhere in this app.
export default function NudgesList({ items }: { items: ClosetItem[] | undefined }) {
  const [plans, setPlans] = useState<UpcomingPlan[]>([]);
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [now] = useState(() => Date.now());
  const [lastBackupAt, setLastBackupAt] = useState<number | null | undefined>(undefined);

  useEffect(() => {
    planStore.getAll().then((all) => setPlans(all || []));
    appSettingsStore.get().then((settings) => setLastBackupAt(settings?.lastBackupAt ?? null));
  }, []);

  const safeItems = items || [];
  const nudges: Nudge[] = [];

  // Highest priority of any nudge here: everything in this app lives
  // only on this device (or, on iOS, tied to the specific Home Screen
  // icon instance), with no server copy. A stale or missing backup is
  // a real risk of permanent data loss, not a styling suggestion, so
  // it goes first regardless of what else would otherwise show.
  const BACKUP_NUDGE_DAYS = 7;
  const daysSinceBackup =
    lastBackupAt != null ? Math.floor((now - lastBackupAt) / (24 * 60 * 60 * 1000)) : null;
  if (
    safeItems.length > 0 &&
    lastBackupAt !== undefined && // still loading, don't flash a false nudge
    (lastBackupAt === null || (daysSinceBackup ?? 0) >= BACKUP_NUDGE_DAYS)
  ) {
    nudges.push({
      id: `backup-${lastBackupAt === null ? "never" : Math.floor(now / (24 * 60 * 60 * 1000))}`,
      text:
        lastBackupAt === null
          ? "Your closet has never been backed up. This data lives only on this device."
          : `It's been ${daysSinceBackup} days since your last backup.`,
      tapLabel: "Back up now",
      href: "/settings",
    });
  }

  const neverWorn = safeItems.find(
    (i) => i?.timesWorn === 0 && i?.category !== "makeup"
  );
  if (neverWorn) {
    nudges.push({
      id: `never-worn-${neverWorn.id}`,
      text: `You haven't styled your ${neverWorn.name || "new item"} yet.`,
      tapLabel: "Go style it",
      href: "/closet",
    });
  }

  const soonPlan = (plans || []).find((p) => {
    if (!p?.date) return false;
    const days = (new Date(p.date).getTime() - now) / (24 * 60 * 60 * 1000);
    return days >= 0 && days <= 3;
  });
  if (soonPlan) {
    nudges.push({
      id: `plan-${soonPlan.id}`,
      text: `${soonPlan.title} is coming up${
        soonPlan.date ? ` on ${soonPlan.date}` : ""
      }.`,
      tapLabel: "Plan the outfit",
      href: "/looks",
    });
  }

  const visible = nudges.filter((n) => !dismissed.includes(n.id)).slice(0, 1);
  if (visible.length === 0) return null;

  return (
    <section className="px-4">
      {visible.map((n) => (
        <div
          key={n.id}
          className="flex items-center gap-2 bg-emerald-50 rounded-xl px-3 py-2 text-xs"
        >
          <p className="flex-1 text-emerald-800">{n.text}</p>
          {n.tapLabel && n.href ? (
            <Link
              href={n.href}
              className="shrink-0 font-medium text-emerald-700 underline underline-offset-2"
            >
              {n.tapLabel}
            </Link>
          ) : null}
          <button
            onClick={() => setDismissed((prev) => [...prev, n.id])}
            className="shrink-0 text-emerald-700/50"
            aria-label="Dismiss"
          >
            <X size={12} />
          </button>
        </div>
      ))}
    </section>
  );
}
