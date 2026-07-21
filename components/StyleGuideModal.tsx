"use client";

import { useState } from "react";
import { X } from "lucide-react";
import {
  NECKLINE_OPTIONS,
  TOP_SILHOUETTE_OPTIONS,
  SLEEVE_LENGTH_OPTIONS,
  SLEEVE_OPTIONS,
  BACK_STYLE_OPTIONS,
} from "@/lib/types";
import {
  NecklineIcon,
  SilhouetteIcon,
  SleeveLengthIcon,
  SleeveStyleIcon,
  BackStyleIcon,
} from "@/components/StyleGuideIcons";

type TabKey = "neckline" | "silhouette" | "sleeve" | "back";

const TABS: { key: TabKey; label: string }[] = [
  { key: "neckline", label: "Neckline" },
  { key: "silhouette", label: "Silhouette" },
  { key: "sleeve", label: "Sleeve" },
  { key: "back", label: "Back" },
];

export default function StyleGuideModal({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<TabKey>("neckline");

  return (
    <div
      className="fixed inset-0 z-[60] flex flex-col md:items-center md:justify-center bg-black/40"
      onClick={onClose}
    >
      <div
        className="mt-auto md:mt-0 md:max-w-lg md:w-full bg-cream rounded-t-3xl md:rounded-3xl max-h-[88vh] md:max-h-[80vh] flex flex-col pb-safe"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-clay-100">
          <h2 className="text-base font-medium text-stone-800">Style guide</h2>
          <button onClick={onClose} aria-label="Close">
            <X size={20} className="text-stone-400" />
          </button>
        </div>

        <div className="flex gap-1.5 px-4 pt-3">
          {(TABS || []).map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium ${
                tab === t.key
                  ? "bg-emerald-600 text-cream"
                  : "bg-cream-100 text-stone-500"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="overflow-y-auto px-4 py-4 flex-1">
          <p className="text-[11px] text-stone-400 mb-3">
            Simplified reference diagrams, not exact renderings, just enough
            to place each term.
          </p>

          {tab === "neckline" ? (
            <div className="grid grid-cols-3 gap-3">
              {(NECKLINE_OPTIONS || []).map((label) => (
                <div key={label} className="flex flex-col items-center gap-1">
                  <div className="w-16 h-16 text-stone-600">
                    <NecklineIcon type={label} />
                  </div>
                  <p className="text-[10px] text-stone-500 text-center leading-tight">
                    {label}
                  </p>
                </div>
              ))}
            </div>
          ) : null}

          {tab === "silhouette" ? (
            <div className="grid grid-cols-3 gap-3">
              {(TOP_SILHOUETTE_OPTIONS || []).map((label) => (
                <div key={label} className="flex flex-col items-center gap-1">
                  <div className="w-16 h-16 text-stone-600">
                    <SilhouetteIcon type={label} />
                  </div>
                  <p className="text-[10px] text-stone-500 text-center leading-tight">
                    {label}
                  </p>
                </div>
              ))}
            </div>
          ) : null}

          {tab === "sleeve" ? (
            <div className="space-y-4">
              <div>
                <p className="text-xs font-medium text-stone-600 mb-2">
                  Length
                </p>
                <div className="grid grid-cols-3 gap-3">
                  {(SLEEVE_LENGTH_OPTIONS || []).map((label) => (
                    <div key={label} className="flex flex-col items-center gap-1">
                      <div className="w-16 h-16 text-stone-600">
                        <SleeveLengthIcon type={label} />
                      </div>
                      <p className="text-[10px] text-stone-500 text-center leading-tight">
                        {label}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs font-medium text-stone-600 mb-2">
                  Style
                </p>
                <div className="grid grid-cols-3 gap-3">
                  {(SLEEVE_OPTIONS || []).map((label) => (
                    <div key={label} className="flex flex-col items-center gap-1">
                      <div className="w-16 h-16 text-stone-600">
                        <SleeveStyleIcon type={label} />
                      </div>
                      <p className="text-[10px] text-stone-500 text-center leading-tight">
                        {label}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : null}

          {tab === "back" ? (
            <div className="grid grid-cols-3 gap-3">
              {(BACK_STYLE_OPTIONS || []).map((label) => (
                <div key={label} className="flex flex-col items-center gap-1">
                  <div className="w-16 h-16 text-stone-600">
                    <BackStyleIcon type={label} />
                  </div>
                  <p className="text-[10px] text-stone-500 text-center leading-tight">
                    {label}
                  </p>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
