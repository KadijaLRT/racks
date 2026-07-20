"use client";

import { useEffect, useState } from "react";
import { Loader2, Luggage, Trash2, ChevronDown, ChevronUp } from "lucide-react";
import BottomNav from "@/components/BottomNav";
import OutfitItemStrip from "@/components/OutfitItemStrip";
import { closetStore, tripStore } from "@/lib/storage";
import type { ClosetItem, Trip } from "@/lib/types";

export default function PackPage() {
  const [closetItems, setClosetItems] = useState<ClosetItem[]>([]);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [expandedTripId, setExpandedTripId] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([closetStore.getAll(), tripStore.getAll()]).then(
      ([items, tripList]) => {
        setClosetItems(items || []);
        setTrips(tripList || []);
        setLoaded(true);
      }
    );
  }, []);

  async function generatePlan() {
    const trimmed = description.trim();
    if (!trimmed) {
      setError("Describe the trip first, e.g. dates, destination, activities.");
      return;
    }
    if (closetItems.length === 0) {
      setError("Add some items to your closet first.");
      return;
    }

    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/pack-trip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: trimmed, items: closetItems }),
      });
      const data = await res.json().catch(() => ({}));
      if (data?.error) throw new Error(data.error);

      const saved = await tripStore.create({
        description: trimmed,
        packingList: data.packingList || [],
        outfits: data.outfits || [],
        gaps: data.gaps || [],
        capsuleSize: data.capsuleSize,
        totalOutfitsPossible: data.totalOutfitsPossible,
      });
      setTrips((prev) => [saved, ...(prev || [])]);
      setExpandedTripId(saved.id);
      setDescription("");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Couldn't build a packing plan for that trip."
      );
    } finally {
      setLoading(false);
    }
  }

  async function removeTrip(id: string) {
    await tripStore.remove(id);
    setTrips((prev) => (prev || []).filter((t) => t.id !== id));
  }

  return (
    <main className="min-h-screen pb-28 pt-safe bg-cream">
      <div className="max-w-md mx-auto px-4 pt-6 space-y-4">
        <div>
          <h1 className="text-xl font-semibold text-stone-800">Pack</h1>
          <p className="text-sm text-stone-500 mt-0.5">
            Describe the trip, get a packing list from what you already own.
          </p>
        </div>

        <div className="bg-white rounded-2xl p-4 space-y-3">
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            placeholder="e.g. 4 days in Lisbon, warm days, one nice dinner, lots of walking"
            className="w-full rounded-xl border border-clay-100 px-3 py-2.5 text-sm resize-none"
          />
          <button
            onClick={generatePlan}
            disabled={loading}
            className="w-full rounded-xl bg-emerald-600 text-cream py-3 text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {loading ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Luggage size={16} />
            )}
            {loading ? "Building your packing list..." : "Build packing plan"}
          </button>
        </div>

        {error ? (
          <div className="rounded-xl bg-clay-50 text-clay-700 text-xs px-3 py-2">
            {error}
          </div>
        ) : null}

        {loaded && trips.length === 0 ? (
          <div className="text-center py-16 px-6">
            <p className="text-sm text-stone-500">
              No trips planned yet. Describe your next one above.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {trips.map((trip) => {
              const expanded = expandedTripId === trip.id;
              return (
                <div key={trip.id} className="bg-white rounded-2xl p-4">
                  <button
                    onClick={() => setExpandedTripId(expanded ? null : trip.id)}
                    className="w-full flex items-start justify-between gap-2 text-left"
                  >
                    <div className="min-w-0">
                      <p className="text-sm text-stone-700 truncate">
                        {trip.description}
                      </p>
                      <p className="text-xs text-stone-400 mt-0.5">
                        {(trip.packingList || []).length} items
                        {trip.totalOutfitsPossible
                          ? ` · ~${trip.totalOutfitsPossible} outfit combos`
                          : ""}
                      </p>
                    </div>
                    {expanded ? (
                      <ChevronUp size={16} className="text-stone-400 shrink-0 mt-1" />
                    ) : (
                      <ChevronDown size={16} className="text-stone-400 shrink-0 mt-1" />
                    )}
                  </button>

                  {expanded ? (
                    <div className="mt-3 space-y-3 border-t border-clay-100 pt-3">
                      <div>
                        <p className="text-xs font-medium text-stone-600 mb-1.5">
                          Pack this
                        </p>
                        <ul className="text-xs text-stone-500 space-y-0.5">
                          {(trip.packingList || []).map((line, i) => (
                            <li key={i}>• {line}</li>
                          ))}
                        </ul>
                      </div>

                      {(trip.outfits || []).length > 0 ? (
                        <div className="space-y-2">
                          <p className="text-xs font-medium text-stone-600">
                            Outfits
                          </p>
                          {trip.outfits.map((outfit, i) => (
                            <div key={i}>
                              <p className="text-xs text-stone-500 mb-1">
                                {outfit.label}
                              </p>
                              <OutfitItemStrip
                                itemIds={outfit.itemIds}
                                items={closetItems}
                              />
                            </div>
                          ))}
                        </div>
                      ) : null}

                      {(trip.gaps || []).length > 0 ? (
                        <div>
                          <p className="text-xs font-medium text-clay-700 mb-1">
                            Your closet is missing
                          </p>
                          <ul className="text-xs text-clay-700 space-y-0.5">
                            {trip.gaps.map((gap, i) => (
                              <li key={i}>• {gap}</li>
                            ))}
                          </ul>
                        </div>
                      ) : null}

                      <button
                        onClick={() => removeTrip(trip.id)}
                        className="flex items-center gap-1.5 text-xs text-stone-400 hover:text-clay-700"
                      >
                        <Trash2 size={12} /> Delete this trip
                      </button>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <BottomNav />
    </main>
  );
}
