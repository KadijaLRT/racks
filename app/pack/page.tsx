"use client";

import { useEffect, useState } from "react";
import { Luggage, Trash2, ChevronDown, ChevronUp } from "lucide-react";
import BottomNav from "@/components/BottomNav";
import OutfitItemStrip from "@/components/OutfitItemStrip";
import { closetStore, tripStore } from "@/lib/storage";
import type { ClosetItem, Trip } from "@/lib/types";
import { buildLocalPackingPlan } from "@/lib/localPackBuilder";

// Entirely local, zero AI, zero network call. The one thing AI added
// here was parsing a free-text trip description into weather/occasion
// context, that's a nice-to-have, not something the core function
// (build a packing list and a day-by-day outfit plan from your
// closet) actually needs. An explicit day count does the same job
// for the local builder without needing a model to interpret anything.
export default function PackPage() {
  const [closetItems, setClosetItems] = useState<ClosetItem[]>([]);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [description, setDescription] = useState("");
  const [days, setDays] = useState(3);
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
    if (closetItems.length === 0) {
      setError("Add some items to your closet first.");
      return;
    }
    setError("");
    const plan = buildLocalPackingPlan(closetItems, days);
    if (!plan) {
      setError(
        "Your closet doesn't have enough marked-clean items yet (need a dress, a set, or a top and a bottom, plus shoes)."
      );
      return;
    }

    const label = description.trim() || `${days}-day trip`;
    const saved = await tripStore.create({
      description: label,
      packingList: plan.packingList,
      outfits: plan.outfits,
      gaps: plan.gaps,
      capsuleSize: plan.capsuleSize,
      totalOutfitsPossible: plan.totalOutfitsPossible,
    });
    setTrips((prev) => [saved, ...(prev || [])]);
    setExpandedTripId(saved.id);
    setDescription("");
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
            How many days, and what should we call this trip? Get a packing
            list and outfits from what you already own.
          </p>
        </div>

        <div className="bg-white rounded-2xl p-4 space-y-3">
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Trip name (optional), e.g. Lisbon in June"
            className="w-full rounded-xl border border-clay-100 px-3 py-2.5 text-sm"
          />
          <div>
            <label className="text-xs text-stone-500">Number of days</label>
            <div className="flex items-center gap-3 mt-1.5">
              <button
                onClick={() => setDays((d) => Math.max(1, d - 1))}
                className="w-9 h-9 rounded-full bg-cream-100 text-stone-600 text-lg font-medium"
                aria-label="Fewer days"
              >
                −
              </button>
              <span className="text-sm font-medium text-stone-700 w-16 text-center">
                {days} {days === 1 ? "day" : "days"}
              </span>
              <button
                onClick={() => setDays((d) => Math.min(14, d + 1))}
                className="w-9 h-9 rounded-full bg-cream-100 text-stone-600 text-lg font-medium"
                aria-label="More days"
              >
                +
              </button>
            </div>
          </div>
          <button
            onClick={generatePlan}
            className="w-full rounded-xl bg-emerald-600 text-cream py-3 text-sm font-medium flex items-center justify-center gap-2"
          >
            <Luggage size={16} />
            Build packing plan
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
              No trips planned yet. Set a day count above to start.
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
