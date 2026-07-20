"use client";

import { useState } from "react";
import { Loader2, Eye } from "lucide-react";

export default function HairstylePreview({
  hairstyle,
  hairContext,
  outfitContext,
}: {
  hairstyle: string;
  hairContext?: string;
  outfitContext?: string;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState("");
  const [steps, setSteps] = useState<string[]>([]);

  async function fetchPreview() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/describe-hairstyle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hairstyle, hairContext, outfitContext }),
      });
      const data = await res.json().catch(() => ({}));
      if (data?.error) throw new Error(data.error);
      setPreview(data?.preview || "");
      setSteps(data?.stylingSteps || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't preview that right now.");
    } finally {
      setLoading(false);
    }
  }

  if (!hairstyle) return null;

  return (
    <div>
      {!preview && !error ? (
        <button
          onClick={fetchPreview}
          disabled={loading}
          className="flex items-center gap-1.5 text-xs text-emerald-700 font-medium disabled:opacity-60"
        >
          {loading ? (
            <Loader2 size={12} className="animate-spin" />
          ) : (
            <Eye size={12} />
          )}
          {loading ? "Picturing it..." : "Preview this hairstyle"}
        </button>
      ) : null}

      {error ? <p className="text-xs text-clay-700 mt-1">{error}</p> : null}

      {preview ? (
        <div className="mt-2 bg-emerald-50 rounded-xl p-3 space-y-2">
          <p className="text-xs text-emerald-800">{preview}</p>
          {steps.length > 0 ? (
            <ul className="text-xs text-emerald-700 space-y-0.5">
              {steps.map((s, i) => (
                <li key={i}>{i + 1}. {s}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
