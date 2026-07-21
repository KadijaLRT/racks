"use client";

import { useState } from "react";
import { Sparkles, ChevronDown } from "lucide-react";
import type { StylingTip } from "@/lib/stylingAdvice";

// Collapsed by default so styling tips never crowd a screen that's
// mainly about editing an item or reviewing a generated look. Tapping
// expands it; there's no dismiss/hide-forever state since these are
// cheap to re-collapse and don't repeat annoyingly like a nag would.
export default function StylingTipList({ tips }: { tips: (StylingTip | null)[] }) {
  const [open, setOpen] = useState(false);
  const validTips = (tips || []).filter((t): t is StylingTip => Boolean(t));

  if (validTips.length === 0) return null;

  return (
    <div className="rounded-xl border border-clay-100 bg-emerald-50/50 overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-3 py-2 text-left"
      >
        <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-700">
          <Sparkles size={13} />
          Styling tip{validTips.length > 1 ? "s" : ""}
        </span>
        <ChevronDown
          size={14}
          className={`text-emerald-700 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open ? (
        <div className="px-3 pb-3 space-y-2">
          {validTips.map((tip, i) => (
            <div key={i} className="text-xs text-stone-600">
              <span className="font-medium text-stone-700">{tip.label}:</span>{" "}
              {tip.advice}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
