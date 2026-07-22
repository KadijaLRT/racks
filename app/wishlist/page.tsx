"use client";

import { useEffect, useRef, useState } from "react";
import { Plus, Loader2, Link2, Camera, Trash2, ShoppingBag, X } from "lucide-react";
import BottomNav from "@/components/BottomNav";
import { fileToResizedDataUrl } from "@/lib/image";
import { wishlistStore, closetStore, measurementsStore } from "@/lib/storage";
import type { WishlistItem, ClosetItem, UserMeasurements } from "@/lib/types";
import { categoryEmoji } from "@/lib/categories";

interface CartAnalysis {
  colorCohesion: string;
  newOutfitsEstimate: number;
  keep: string[];
  cut: { id: string; reason: string }[];
  verdict: string;
}

export default function WishlistPage() {
  const [items, setItems] = useState<WishlistItem[]>([]);
  const [closetItems, setClosetItems] = useState<ClosetItem[]>([]);
  const [measurements, setMeasurements] = useState<UserMeasurements | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [cartAnalysis, setCartAnalysis] = useState<CartAnalysis | null>(null);
  const [cartBusy, setCartBusy] = useState(false);
  const [failedAnalysisIds, setFailedAnalysisIds] = useState<Set<string>>(new Set());
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    Promise.all([
      wishlistStore.getAll(),
      closetStore.getAll(),
      measurementsStore.get(),
    ]).then(([wishlist, closet, userMeasurements]) => {
      setItems(wishlist || []);
      setClosetItems(closet || []);
      setMeasurements(userMeasurements || null);
      setLoaded(true);
    });
  }, []);

  async function tagAndAnalyze(image: string, sourceUrl?: string) {
    let name = "Untitled item";
    let category: WishlistItem["category"] = "top";
    let subcategory = "";
    let tags: Record<string, string> = {};

    try {
      const res = await fetch("/api/tag-wishlist-item", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image }),
      });
      const tagged = await res.json().catch(() => ({}));
      if (!tagged?.error) {
        name = tagged?.name || name;
        category = tagged?.category || category;
        subcategory = tagged?.subcategory || "";
        tags = tagged?.tags || {};
      }
    } catch {
      // Tagging is best-effort, still save the item so the user can fix
      // details manually rather than losing the upload entirely.
    }

    const saved = await wishlistStore.create({
      image,
      name,
      category,
      subcategory,
      tags,
      sourceUrl,
    });
    setItems((prev) => [saved, ...(prev || [])]);
    await runAnalysis(saved);
  }

  // Separated from tagAndAnalyze so a failed attempt (including being
  // blocked by the app-wide AI exclusive lock, or a rate limit) can be
  // retried on its own, without re-tagging the item. Also lets the UI
  // distinguish "still analyzing" from "failed" instead of both looking
  // identical (analysis === undefined) and showing "Analyzing..."
  // forever even after the attempt has already finished and failed.
  async function runAnalysis(item: WishlistItem) {
    setFailedAnalysisIds((prev) => {
      const next = new Set(prev);
      next.delete(item.id);
      return next;
    });
    try {
      const analysisRes = await fetch("/api/analyze-item", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          newItem: { name: item.name, category: item.category, tags: item.tags },
          closetItems,
          measurements,
        }),
      });
      const analysis = await analysisRes.json().catch(() => null);
      if (analysis && !analysis.error) {
        const updated = { ...item, analysis };
        await wishlistStore.update(updated);
        setItems((prev) => (prev || []).map((i) => (i.id === item.id ? updated : i)));
      } else {
        setFailedAnalysisIds((prev) => new Set(prev).add(item.id));
      }
    } catch {
      setFailedAnalysisIds((prev) => new Set(prev).add(item.id));
    }
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setAddOpen(false);
    setBusy(true);
    setError("");
    try {
      const dataUrl = await fileToResizedDataUrl(file);
      if (!dataUrl) throw new Error("Couldn't read that photo.");
      await tagAndAnalyze(dataUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't add that item.");
    } finally {
      setBusy(false);
    }
  }

  async function handleLinkImport() {
    const url = linkUrl.trim();
    if (!url) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/import-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = await res.json().catch(() => ({}));
      if (data?.error) throw new Error(data.error);
      await tagAndAnalyze(data.image, data.sourceUrl || url);
      setLinkUrl("");
      setAddOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't import that link.");
    } finally {
      setBusy(false);
    }
  }

  async function removeItem(id: string) {
    await wishlistStore.remove(id);
    setItems((prev) => (prev || []).filter((i) => i.id !== id));
    setCartAnalysis(null);
  }

  async function analyzeCart() {
    setCartBusy(true);
    setError("");
    try {
      const res = await fetch("/api/analyze-cart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wishlistItems: items, closetItems }),
      });
      const data = await res.json().catch(() => ({}));
      if (data?.error) throw new Error(data.error);
      setCartAnalysis(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't analyze your cart.");
    } finally {
      setCartBusy(false);
    }
  }

  return (
    <main className="min-h-screen pb-28 pt-safe bg-cream">
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFile}
      />

      <div className="max-w-md mx-auto px-4 pt-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-stone-800">Wishlist</h1>
            <p className="text-sm text-stone-500 mt-0.5">
              See if it&apos;s really worth it before you buy.
            </p>
          </div>
          <button
            onClick={() => setAddOpen(true)}
            disabled={busy}
            className="w-11 h-11 rounded-full bg-emerald-600 text-cream flex items-center justify-center disabled:opacity-60 shrink-0"
            aria-label="Add to wishlist"
          >
            {busy ? <Loader2 size={18} className="animate-spin" /> : <Plus size={20} />}
          </button>
        </div>

        {error ? (
          <div className="rounded-xl bg-clay-50 text-clay-700 text-xs px-3 py-2">
            {error}
          </div>
        ) : null}

        {items.length > 1 ? (
          <button
            onClick={analyzeCart}
            disabled={cartBusy}
            className="w-full rounded-xl border border-emerald-200 text-emerald-700 py-2.5 text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {cartBusy ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <ShoppingBag size={16} />
            )}
            Analyze whole cart
          </button>
        ) : null}

        {cartAnalysis ? (
          <div className="bg-white rounded-2xl p-4 space-y-2 text-sm">
            <p className="text-stone-700">{cartAnalysis.verdict}</p>
            {cartAnalysis.colorCohesion ? (
              <p className="text-xs text-stone-500">{cartAnalysis.colorCohesion}</p>
            ) : null}
            {cartAnalysis.newOutfitsEstimate ? (
              <p className="text-xs text-emerald-700">
                ~{cartAnalysis.newOutfitsEstimate} new outfits unlocked
              </p>
            ) : null}
            {(cartAnalysis.cut || []).length > 0 ? (
              <div className="pt-1">
                <p className="text-xs font-medium text-clay-700 mb-1">
                  Consider skipping:
                </p>
                <ul className="text-xs text-clay-700 space-y-0.5">
                  {cartAnalysis.cut.map((c) => {
                    const match = items.find((i) => i.id === c.id);
                    return (
                      <li key={c.id}>
                        {match?.name || "Item"}: {c.reason}
                      </li>
                    );
                  })}
                </ul>
              </div>
            ) : null}
          </div>
        ) : null}

        {loaded && items.length === 0 ? (
          <div className="text-center py-16 px-6">
            <p className="text-sm text-stone-500">
              Nothing on your wishlist yet. Add a product photo or link to
              get an honest read before you buy.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((item) => (
              <div key={item.id} className="bg-white rounded-2xl p-3 flex gap-3">
                <div className="w-16 h-20 rounded-xl overflow-hidden bg-cream-100 shrink-0">
                  {item.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={item.image}
                      alt={item.name || "Wishlist item"}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-lg">
                      {categoryEmoji(item.category)}
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm text-stone-700 truncate">{item.name}</p>
                    <button
                      onClick={() => removeItem(item.id)}
                      className="text-stone-300 hover:text-clay-700 shrink-0"
                      aria-label={`Remove ${item.name}`}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                  {item.analysis ? (
                    <>
                      <p className="text-xs text-stone-500 mt-0.5">
                        {item.analysis.verdict}
                      </p>
                      <div className="flex flex-wrap gap-1.5 mt-1.5">
                        {item.analysis.fillsGap ? (
                          <span className="text-[10px] bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full">
                            Fills a gap
                          </span>
                        ) : null}
                        {item.analysis.replacesItem ? (
                          <span className="text-[10px] bg-clay-50 text-clay-700 px-2 py-0.5 rounded-full">
                            Could retire: {item.analysis.replacesItem}
                          </span>
                        ) : null}
                      </div>
                    </>
                  ) : failedAnalysisIds.has(item.id) ? (
                    <button
                      onClick={() => runAnalysis(item)}
                      className="text-xs text-emerald-700 font-medium mt-0.5"
                    >
                      Couldn&rsquo;t analyze, tap to retry
                    </button>
                  ) : (
                    <p className="text-xs text-stone-400 mt-0.5">Analyzing...</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {addOpen ? (
        <div
          className="fixed inset-0 z-50 bg-black/40 flex items-end md:items-center md:justify-center"
          onClick={() => setAddOpen(false)}
        >
          <div
            className="bg-cream w-full md:max-w-sm rounded-t-3xl md:rounded-3xl max-h-[85vh] flex flex-col pb-safe"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="overflow-y-auto p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-stone-700">
                  Add to wishlist
                </h3>
                <button onClick={() => setAddOpen(false)} aria-label="Close">
                  <X size={18} className="text-stone-400" />
                </button>
              </div>

              <button
                onClick={() => fileRef.current?.click()}
                className="w-full rounded-xl bg-emerald-600 text-cream py-3 text-sm font-medium flex items-center justify-center gap-2"
              >
                <Camera size={18} />
                Photo or screenshot
              </button>

              <div className="flex items-center gap-2">
                <div className="flex-1 h-px bg-clay-100" />
                <span className="text-xs text-stone-400">or</span>
                <div className="flex-1 h-px bg-clay-100" />
              </div>

              <div className="flex gap-2">
                <input
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                  placeholder="Paste a product link"
                  className="flex-1 rounded-xl border border-clay-100 px-3 py-2 text-sm bg-white"
                />
                <button
                  onClick={handleLinkImport}
                  disabled={busy || !linkUrl.trim()}
                  className="rounded-xl bg-emerald-100 text-emerald-700 px-3 py-2 disabled:opacity-50"
                  aria-label="Import link"
                >
                  {busy ? <Loader2 size={16} className="animate-spin" /> : <Link2 size={16} />}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <BottomNav />
    </main>
  );
}
