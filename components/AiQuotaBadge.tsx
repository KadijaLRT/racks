"use client";

import { useState, useSyncExternalStore } from "react";
import { Gauge } from "lucide-react";
import { estimateQuota, quotaSnapshot, subscribeQuota } from "@/lib/groqQuota";

/**
 * Compact "AI retags left today" indicator. Tap for the breakdown
 * (progressive disclosure: one short line by default).
 */
export default function AiQuotaBadge({ className = "" }: { className?: string }) {
  // The snapshot string changes only when usage is recorded, which keeps
  // useSyncExternalStore stable; the estimate itself is derived from it.
  const snap = useSyncExternalStore(subscribeQuota, quotaSnapshot, () => "");
  const [open, setOpen] = useState(false);
  void snap;
  const q = estimateQuota();

  const tone = q.limitReached || q.retagsLeft === 0
    ? "bg-clay-50 text-clay-700"
    : q.retagsLeft <= 10
    ? "bg-amber-50 text-amber-800"
    : "bg-emerald-50 text-emerald-800";

  const headline = q.limitReached
    ? "AI limit reached for today"
    : `~${q.retagsLeft} AI retag${q.retagsLeft === 1 ? "" : "s"} left today`;

  return (
    <div className={className}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-medium ${tone}`}
      >
        <Gauge size={12} />
        {headline}
      </button>
      {open ? (
        <div className="mt-2 rounded-xl border border-clay-100 bg-white px-3 py-2 text-[11px] text-stone-600 space-y-1">
          <p>
            Used today in this app: {q.tokensToday.toLocaleString()} of{" "}
            {q.dailyTokenLimit.toLocaleString()} tokens ({q.callsToday} AI call
            {q.callsToday === 1 ? "" : "s"}).
          </p>
          <p>
            Average per retag: ~{q.avgTokensPerRetag.toLocaleString()} tokens
            {q.measured ? "" : " (a guess until your first retag)"}.
          </p>
          {q.requestsLeft != null ? (
            <p>Groq says {q.requestsLeft.toLocaleString()} requests remain today.</p>
          ) : null}
          <p className="text-stone-400">
            Estimate only: Groq doesn&apos;t report the daily token balance, so this counts
            what this app has used on this device. Retagging without AI is always free.
          </p>
        </div>
      ) : null}
    </div>
  );
}
