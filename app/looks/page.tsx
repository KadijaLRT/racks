"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Heart, Check, Sparkles, HelpCircle, BookMarked, Trash2, X } from "lucide-react";
import BottomNav from "@/components/BottomNav";
import OutfitItemStrip, { groupByPhase } from "@/components/OutfitItemStrip";
import HairstylePreview from "@/components/HairstylePreview";
import StylingTipList from "@/components/StylingTipList";
import {
  braRecommendation,
  necklaceRecommendation,
  jewelryToneRecommendation,
} from "@/lib/stylingAdvice";
import {
  closetStore,
  wigStore,
  hairProfileStore,
  colorProfileStore,
  styleProfileStore,
  measurementsStore,
  inspirationStore,
  lookStore,
  incrementTimesWorn,
} from "@/lib/storage";
import type { ClosetItem, WigItem, HairProfile, ColorProfile, GeneratedLook, UserMeasurements } from "@/lib/types";
import { buildLocalLook } from "@/lib/localLookBuilder";
import { colorsOf, isColorCompatibleWithAll } from "@/lib/colorCompatibility";
import { stripImagesForPrompt } from "@/lib/stripImagesForPrompt";

const QUICK_PROMPTS = [
  "Work meeting",
  "First date",
  "Outdoor wedding guest",
  "Cold rainy coffee run",
  "Quiet luxury, errands",
  "Surprise me",
];

const MOOD_CHIPS = ["Powerful", "Comfortable", "Romantic", "Trendy", "Confident"];
// Practical, weather/day-shape context, distinct from the mood/vibe
// chips above. These feed into both paths: appended to the AI prompt
// verbatim when using Groq, and used as real filters in the local (no
// AI) builder, e.g. "Chilly" biases toward including outerwear and
// away from open-toe shoes, not just decorative wording either way.
const CONTEXT_CHIPS = ["Chilly, layering needed", "All-day walking", "Sitting at a desk", "Rainy"];
// Distinct from mood (how you want to feel) and weather (external
// conditions): this is about actual physical/mental bandwidth and
// sensory needs right now, which matters at least as much as the
// occasion itself. Feeds real filtering in the local builder (exclude
// scratchy/restrictive pieces, bias toward one-and-done bases, bias
// toward structured/tailored pieces) and gets passed to the AI prompt
// as an explicit constraint, not just flavor text.
const ENERGY_CHIPS = [
  "Sensory-friendly, nothing tight or scratchy",
  "Low energy, one-and-done",
  "High confidence, armor mode",
];

const QUICK_REFINEMENTS = [
  "Dressier",
  "More casual",
  "Warmer",
  "No heels",
  "Swap the shoes",
];

interface GeneratedResult {
  itemIds: string[];
  hairstyle: string;
  makeup: string;
  reasoning: string;
  scores: Record<string, number>;
  overallLabel: string;
  overallStars: number;
  strengths: string[];
  weaknesses: string[];
}

export default function LooksPage() {
  const [closetItems, setClosetItems] = useState<ClosetItem[]>([]);
  const [wigs, setWigs] = useState<WigItem[]>([]);
  const [hairProfile, setHairProfile] = useState<HairProfile | null>(null);
  const [colorProfile, setColorProfile] = useState<ColorProfile | null>(null);
  const [measurements, setMeasurements] = useState<UserMeasurements | null>(null);
  const [styleDescription, setStyleDescription] = useState("");
  const [styleKeywords, setStyleKeywords] = useState<string[]>([]);

  const [prompt, setPrompt] = useState("");
  const [mood, setMood] = useState("");
  const [context, setContext] = useState<string[]>([]);
  const [energy, setEnergy] = useState("");
  const [swappingItem, setSwappingItem] = useState<ClosetItem | null>(null);
  const [stepByStep, setStepByStep] = useState(false);
  const [shakeEnabled, setShakeEnabled] = useState(false);
  const [shakeSupported, setShakeSupported] = useState(false);
  useEffect(() => {
    // Legitimate one-time exception to the setState-in-effect rule:
    // this reads browser feature support (window is undefined during
    // SSR), it can't be computed during render without a hydration
    // mismatch, and it only ever runs once on mount, not a cascading
    // update loop.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setShakeSupported(typeof window !== "undefined" && "DeviceMotionEvent" in window);
  }, []);
  const [revealedPhaseCount, setRevealedPhaseCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<GeneratedResult | null>(null);
  const [refinement, setRefinement] = useState("");
  const [savedMessage, setSavedMessage] = useState("");
  const [whyNotOpen, setWhyNotOpen] = useState(false);
  const [whyNotBusyId, setWhyNotBusyId] = useState<string | null>(null);
  const [whyNotAnswers, setWhyNotAnswers] = useState<Record<string, string>>({});

  const [savedLooks, setSavedLooks] = useState<GeneratedLook[]>([]);
  const [lookbookOpen, setLookbookOpen] = useState(false);
  const [collectionFilter, setCollectionFilter] = useState("all");

  useEffect(() => {
    Promise.all([
      closetStore.getAll(),
      wigStore.getAll(),
      hairProfileStore.get(),
      colorProfileStore.get(),
      styleProfileStore.get(),
      measurementsStore.get(),
      inspirationStore.getAll(),
      lookStore.getAll(),
    ]).then(([items, wigList, hair, color, style, userMeasurements, inspirations, looks]) => {
      setClosetItems(items || []);
      setWigs(wigList || []);
      setHairProfile(hair || null);
      setColorProfile(color || null);
      setMeasurements(userMeasurements || null);
      setStyleDescription(style?.description || "");
      setStyleKeywords((inspirations || []).flatMap((i) => i.keywords || []));
      setSavedLooks(looks || []);
    });
  }, []);

  async function removeSavedLook(look: GeneratedLook) {
    await lookStore.remove(look.id);
    setSavedLooks((prev) => prev.filter((l) => l.id !== look.id));
  }

  const usedCollections = useMemo(
    () => Array.from(new Set(savedLooks.map((l) => l.collection).filter(Boolean) as string[])),
    [savedLooks]
  );

  const visibleSavedLooks = useMemo(
    () =>
      collectionFilter === "all"
        ? savedLooks
        : savedLooks.filter((l) => l.collection === collectionFilter),
    [savedLooks, collectionFilter]
  );

  async function generate(instruction?: string) {
    const activePrompt = prompt.trim();
    if (!activePrompt) {
      setError("Tell me the occasion first.");
      return;
    }
    if (closetItems.length === 0) {
      setError("Add some items to your closet first.");
      return;
    }

    setLoading(true);
    setError("");
    setSavedMessage("");
    try {
      const res = await fetch("/api/generate-look", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: activePrompt,
          mood,
          weather: context.join(", "),
          energy,
          items: stripImagesForPrompt(closetItems),
          wigs,
          hairProfile,
          colorProfile,
          measurements,
          styleDescription,
          styleKeywords,
          previousLook: instruction && result ? result : null,
          instruction: instruction || "",
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (data?.error) throw new Error(data.error);
      if (!Array.isArray(data?.itemIds) || data.itemIds.length === 0) {
        throw new Error("Couldn't put together a look from what's in your closet yet.");
      }
      setResult(data);
      setRevealedPhaseCount(null);
      setRefinement("");
      setWhyNotOpen(false);
      setWhyNotAnswers({});
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Something went wrong generating that look."
      );
    } finally {
      setLoading(false);
    }
  }

  // Entirely local, zero AI, zero network: for when Groq isn't
  // cooperating (rate limited, or just unreliable) but the person
  // still wants an outfit built from their closet right now. Applies
  // the same basic logic the AI prompt asks for (favor neglected
  // pieces, respect pinned favorites, require a coherent combo) as
  // pure local selection instead.
  function buildWithoutAI() {
    setError("");
    setSavedMessage("");
    const local = buildLocalLook(closetItems, prompt.trim(), context, energy);
    if (!local) {
      setError(
        "Your closet doesn't have enough marked-clean items yet to build a full look (need a dress, a set, or a top and bottom, plus shoes)."
      );
      return;
    }
    setResult({
      itemIds: local.itemIds,
      hairstyle: "",
      makeup: "",
      reasoning: local.reasoning,
      scores: {},
      overallLabel: "Locally built",
      overallStars: 0,
      strengths: [],
      weaknesses: [],
    });
    // Step-by-step reveals one layer (base, then outer, then shoes,
    // then accessories) at a time instead of the whole outfit at once,
    // since throwing a full 4-5 piece look at someone simultaneously
    // is exactly the visual overload this mode exists to avoid. Only
    // offered for the local build: it's instant, so pacing the reveal
    // doesn't cost anything, whereas staging an AI result would either
    // need multiple Groq calls or fake a delay for no real benefit.
    setRevealedPhaseCount(stepByStep ? 1 : null);
    setRefinement("");
    setWhyNotOpen(false);
    setWhyNotAnswers({});
  }

  // Shake-to-shuffle: an opt-in physical-feeling way to trigger the
  // local (zero AI, zero network) build, so getting unstuck doesn't
  // require typing anything or waiting on a request. iOS 13+ requires
  // an explicit permission prompt from a user gesture (handled in the
  // toggle's onClick below), and most desktop browsers simply don't
  // fire devicemotion at all, so this stays fully opt-in and invisible
  // wherever it isn't supported rather than showing a broken control.
  const buildWithoutAIRef = useRef(buildWithoutAI);
  useEffect(() => {
    buildWithoutAIRef.current = buildWithoutAI;
  });

  useEffect(() => {
    if (!shakeEnabled) return;
    let lastShakeAt = 0;
    let lastAcceleration = { x: 0, y: 0, z: 0 };
    const SHAKE_THRESHOLD = 15;
    const MIN_INTERVAL_MS = 1500;

    function handleMotion(e: DeviceMotionEvent) {
      const acc = e.accelerationIncludingGravity;
      if (!acc || acc.x === null || acc.y === null || acc.z === null) return;
      const delta =
        Math.abs(acc.x - lastAcceleration.x) +
        Math.abs(acc.y - lastAcceleration.y) +
        Math.abs(acc.z - lastAcceleration.z);
      lastAcceleration = { x: acc.x, y: acc.y, z: acc.z };
      const now = Date.now();
      if (delta > SHAKE_THRESHOLD && now - lastShakeAt > MIN_INTERVAL_MS) {
        lastShakeAt = now;
        buildWithoutAIRef.current();
      }
    }

    window.addEventListener("devicemotion", handleMotion);
    return () => window.removeEventListener("devicemotion", handleMotion);
  }, [shakeEnabled]);

  async function enableShake() {
    // iOS requires this to be requested from within a user gesture
    // (this onClick), a raw useEffect can't ask for it.
    const DeviceMotionEventWithPermission = DeviceMotionEvent as unknown as {
      requestPermission?: () => Promise<"granted" | "denied">;
    };
    if (typeof DeviceMotionEventWithPermission.requestPermission === "function") {
      try {
        const permission = await DeviceMotionEventWithPermission.requestPermission();
        if (permission !== "granted") return;
      } catch {
        return;
      }
    }
    setShakeEnabled(true);
  }

  // Local, no AI, no network call: swapping one disliked or dirty item
  // for another of the same category shouldn't require a full
  // regeneration (and the Groq call that comes with it) over a single
  // piece. Sorted with less-worn items first, same "give a neglected
  // piece a chance" spirit as the generators themselves.
  const swapCandidates = swappingItem
    ? (closetItems || [])
        .filter(
          (i) =>
            i?.category === swappingItem.category &&
            i?.id !== swappingItem.id &&
            i?.laundryStatus === "clean" &&
            i?.closetStatus !== "store" &&
            !(result?.itemIds || []).includes(i.id)
        )
        .map((i) => {
          // Prioritize the closest match to what's being replaced, not
          // wear history: same subcategory, same neckline/sleeve
          // profile, and color-compatible with everything else still
          // in the outfit, so a swap actually feels like a substitute
          // rather than a random same-category item.
          let score = 0;
          if (i.subcategory && i.subcategory === swappingItem.subcategory) score += 3;
          if (i.tags?.neckline && i.tags.neckline === swappingItem.tags?.neckline) score += 2;
          if (i.tags?.sleeveLength && i.tags.sleeveLength === swappingItem.tags?.sleeveLength) score += 2;
          if (i.tags?.sleeve && i.tags.sleeve === swappingItem.tags?.sleeve) score += 1;
          const restOfOutfit = (result?.itemIds || [])
            .filter((id) => id !== swappingItem.id)
            .map((id) => closetItems.find((c) => c.id === id))
            .filter(Boolean) as ClosetItem[];
          const restColors = restOfOutfit.flatMap((r) => colorsOf(r.tags?.color));
          if (isColorCompatibleWithAll(colorsOf(i.tags?.color), restColors)) score += 2;
          return { item: i, score };
        })
        .sort((a, b) => b.score - a.score)
        .map((s) => s.item)
    : [];

  function applySwap(newItem: ClosetItem) {
    if (!result || !swappingItem) return;
    setResult({
      ...result,
      itemIds: result.itemIds.map((id) => (id === swappingItem.id ? newItem.id : id)),
    });
    setSwappingItem(null);
  }

  async function saveLook(markWorn: boolean) {
    if (!result) return;
    const saved = await lookStore.create({
      prompt: prompt.trim(),
      itemIds: result.itemIds,
      hairstyle: result.hairstyle,
      makeup: result.makeup,
      reasoning: result.reasoning,
      scores: result.scores,
      favorite: !markWorn,
    });
    if (markWorn) {
      await incrementTimesWorn(result.itemIds);
    }
    setSavedLooks((prev) => [saved, ...prev]);
    setSavedMessage(markWorn ? "Marked as worn today." : "Saved to your favorites.");
  }

  async function askWhyNot(item: ClosetItem) {
    if (!result) return;
    setWhyNotBusyId(item.id);
    try {
      const chosenItems = result.itemIds
        .map((id) => closetItems.find((c) => c.id === id))
        .filter(Boolean) as ClosetItem[];
      const res = await fetch("/api/why-not-item", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          candidateItem: stripImagesForPrompt([item])[0],
          currentLook: {
            hairstyle: result.hairstyle,
            makeup: result.makeup,
            reasoning: result.reasoning,
          },
          prompt: prompt.trim(),
          chosenItems: stripImagesForPrompt(chosenItems),
        }),
      });
      const data = await res.json().catch(() => ({}));
      setWhyNotAnswers((prev) => ({
        ...prev,
        [item.id]: data?.error
          ? "Couldn't get an answer for that one, try again."
          : data?.reason || "No specific reason, it just wasn't the pick this time.",
      }));
    } finally {
      setWhyNotBusyId(null);
    }
  }

  return (
    <main className="min-h-screen pb-28 pt-safe bg-cream">
      <div className="max-w-md mx-auto px-4 pt-6 space-y-4">
        <div>
          <h1 className="text-xl font-semibold text-stone-800">Looks</h1>
          <p className="text-sm text-stone-500 mt-0.5">
            Tell me the occasion, I&apos;ll build the outfit from your closet.
          </p>
        </div>

        <div className="bg-white rounded-2xl p-4 space-y-3">
          <input
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="e.g. Dinner with friends downtown"
            className="w-full rounded-xl border border-clay-100 px-3 py-2.5 text-sm"
          />

          <div className="flex flex-wrap gap-1.5">
            {QUICK_PROMPTS.map((p) => (
              <button
                key={p}
                onClick={() => setPrompt(p)}
                className="px-3 py-1 rounded-full bg-cream-100 text-xs text-stone-500"
              >
                {p}
              </button>
            ))}
          </div>

          <div>
            <p className="text-xs text-stone-500 mb-1.5">
              Want to feel a certain way? (optional)
            </p>
            <div className="flex flex-wrap gap-1.5">
              {MOOD_CHIPS.map((m) => (
                <button
                  key={m}
                  onClick={() => setMood((prev) => (prev === m ? "" : m))}
                  className={`px-3 py-1 rounded-full text-xs ${
                    mood === m
                      ? "bg-emerald-600 text-cream"
                      : "bg-cream-100 text-stone-500"
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs text-stone-500 mb-1.5">
              Anything practical to plan around? (optional)
            </p>
            <div className="flex flex-wrap gap-1.5">
              {CONTEXT_CHIPS.map((c) => (
                <button
                  key={c}
                  onClick={() =>
                    setContext((prev) =>
                      prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]
                    )
                  }
                  className={`px-3 py-1 rounded-full text-xs ${
                    context.includes(c)
                      ? "bg-stone-700 text-cream"
                      : "bg-cream-100 text-stone-500"
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs text-stone-500 mb-1.5">
              How&apos;s your energy today? (optional)
            </p>
            <div className="flex flex-wrap gap-1.5">
              {ENERGY_CHIPS.map((e) => (
                <button
                  key={e}
                  onClick={() => setEnergy((prev) => (prev === e ? "" : e))}
                  className={`px-3 py-1 rounded-full text-xs ${
                    energy === e
                      ? "bg-emerald-700 text-cream"
                      : "bg-cream-100 text-stone-500"
                  }`}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={() => generate()}
            disabled={loading}
            className="w-full rounded-xl bg-emerald-600 text-cream py-3 text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {loading ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Sparkles size={16} />
            )}
            {loading ? "Styling your look..." : "Generate a look"}
          </button>

          <button
            onClick={buildWithoutAI}
            disabled={loading}
            className="w-full rounded-xl border border-clay-200 text-stone-600 py-2.5 text-xs font-medium disabled:opacity-60"
          >
            Build without AI
          </button>

          <label className="flex items-center gap-2 text-xs text-stone-500 px-1">
            <input
              type="checkbox"
              checked={stepByStep}
              onChange={(e) => setStepByStep(e.target.checked)}
              className="rounded"
            />
            Reveal one layer at a time
          </label>

          {shakeSupported ? (
            <label className="flex items-center gap-2 text-xs text-stone-500 px-1">
              <input
                type="checkbox"
                checked={shakeEnabled}
                onChange={(e) => (e.target.checked ? enableShake() : setShakeEnabled(false))}
                className="rounded"
              />
              Shake to shuffle (no AI)
            </label>
          ) : null}
        </div>

        {error ? (
          <div className="rounded-xl bg-clay-50 text-clay-700 text-xs px-3 py-2">
            {error}
          </div>
        ) : null}

        {result ? (
          <div className="bg-white rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-emerald-700">
                {result.overallLabel || "Your look"}
              </span>
              {result.overallStars ? (
                <span className="text-xs text-stone-400">
                  {"★".repeat(result.overallStars)}
                  {"☆".repeat(Math.max(0, 5 - result.overallStars))}
                </span>
              ) : null}
            </div>

            {revealedPhaseCount !== null ? (
              (() => {
                const byId = new Map(closetItems.map((i) => [i.id, i]));
                const resolved = result.itemIds
                  .map((id) => byId.get(id))
                  .filter(Boolean) as ClosetItem[];
                const phases = groupByPhase(resolved);
                const visible = phases.slice(0, revealedPhaseCount);
                const hasMore = revealedPhaseCount < phases.length;
                return (
                  <div className="space-y-3">
                    {visible.map((phase, i) => (
                      <div key={phase.label}>
                        <p className="text-[10px] text-stone-400 mb-1">{phase.label}</p>
                        <div className="flex gap-2 overflow-x-auto pb-1">
                          {phase.items.map((item) => (
                            <button
                              key={item.id}
                              onClick={() => setSwappingItem(item)}
                              className="shrink-0 w-16 aspect-[3/4] rounded-xl overflow-hidden bg-cream-100 relative"
                              aria-label={`Swap ${item.name}`}
                            >
                              {item.image ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={item.image}
                                  alt={item.name}
                                  className="w-full h-full object-cover"
                                />
                              ) : null}
                              <span className="absolute bottom-0.5 right-0.5 bg-black/55 rounded-full px-1 py-0.5 text-[8px] text-cream">
                                Swap
                              </span>
                            </button>
                          ))}
                        </div>
                        {i === visible.length - 1 && hasMore ? (
                          <button
                            onClick={() => setRevealedPhaseCount((c) => (c ?? 0) + 1)}
                            className="mt-2 w-full rounded-xl bg-stone-700 text-cream py-2 text-xs font-medium"
                          >
                            Looks good, next layer
                          </button>
                        ) : null}
                      </div>
                    ))}
                    {!hasMore ? (
                      <p className="text-[11px] text-emerald-700">
                        That&apos;s the full outfit. Save it below, or keep swapping any piece.
                      </p>
                    ) : null}
                  </div>
                );
              })()
            ) : (
              <OutfitItemStrip
                itemIds={result.itemIds}
                items={closetItems}
                onSwap={(item) => setSwappingItem(item)}
              />
            )}

            {(() => {
              const outfitTopItem = closetItems.find(
                (i) =>
                  result.itemIds.includes(i.id) &&
                  (i.category === "top" || i.category === "dress" || i.category === "set")
              );
              if (!outfitTopItem) return null;
              return (
                <StylingTipList
                  tips={[
                    braRecommendation(outfitTopItem),
                    necklaceRecommendation(outfitTopItem),
                    jewelryToneRecommendation(outfitTopItem),
                  ]}
                />
              );
            })()}

            <p className="text-sm text-stone-600">{result.reasoning}</p>

            {result.hairstyle ? (
              <div>
                <p className="text-xs text-stone-500">
                  <span className="font-medium">Hair:</span> {result.hairstyle}
                </p>
                <div className="mt-1">
                  <HairstylePreview key={result.hairstyle} hairstyle={result.hairstyle} outfitContext={prompt} />
                </div>
              </div>
            ) : null}
            {result.makeup ? (
              <p className="text-xs text-stone-500">
                <span className="font-medium">Makeup:</span> {result.makeup}
              </p>
            ) : null}

            {(result.strengths || []).length > 0 ? (
              <ul className="text-xs text-emerald-700 space-y-0.5">
                {result.strengths.map((s, i) => (
                  <li key={i}>+ {s}</li>
                ))}
              </ul>
            ) : null}
            {(result.weaknesses || []).length > 0 ? (
              <ul className="text-xs text-clay-700 space-y-0.5">
                {result.weaknesses.map((w, i) => (
                  <li key={i}>- {w}</li>
                ))}
              </ul>
            ) : null}

            <div className="flex gap-2 pt-1">
              <button
                onClick={() => saveLook(false)}
                className="flex-1 rounded-xl border border-clay-200 py-2 text-xs font-medium text-clay-700 flex items-center justify-center gap-1.5"
              >
                <Heart size={14} /> Save to favorites
              </button>
              <button
                onClick={() => saveLook(true)}
                className="flex-1 rounded-xl bg-emerald-600 text-cream py-2 text-xs font-medium flex items-center justify-center gap-1.5"
              >
                <Check size={14} /> Wearing this today
              </button>
            </div>

            {savedMessage ? (
              <p className="text-xs text-emerald-700 text-center">{savedMessage}</p>
            ) : null}

            <div className="pt-2 border-t border-clay-100">
              <p className="text-xs text-stone-500 mb-1.5">Want a change?</p>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {QUICK_REFINEMENTS.map((r) => (
                  <button
                    key={r}
                    onClick={() => generate(r)}
                    disabled={loading}
                    className="px-3 py-1 rounded-full bg-cream-100 text-xs text-stone-500 disabled:opacity-50"
                  >
                    {r}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  value={refinement}
                  onChange={(e) => setRefinement(e.target.value)}
                  placeholder="Describe a change"
                  className="flex-1 rounded-xl border border-clay-100 px-3 py-2 text-xs"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && refinement.trim()) generate(refinement.trim());
                  }}
                />
                <button
                  onClick={() => refinement.trim() && generate(refinement.trim())}
                  disabled={loading || !refinement.trim()}
                  className="rounded-xl bg-emerald-100 text-emerald-700 px-3 py-2 text-xs font-medium disabled:opacity-50"
                >
                  Apply
                </button>
              </div>
            </div>

            <div className="pt-2 border-t border-clay-100">
              <button
                onClick={() => setWhyNotOpen((v) => !v)}
                className="flex items-center gap-1.5 text-xs text-stone-500"
              >
                <HelpCircle size={13} />
                {whyNotOpen ? "Hide other closet items" : "Curious why something else wasn't picked?"}
              </button>

              {whyNotOpen ? (
                <div className="mt-2 space-y-2">
                  {closetItems
                    .filter(
                      (item) =>
                        item.category !== "makeup" &&
                        item.laundryStatus === "clean" &&
                        !result.itemIds.includes(item.id)
                    )
                    .slice(0, 8)
                    .map((item) => (
                      <div key={item.id}>
                        <button
                          onClick={() => askWhyNot(item)}
                          disabled={whyNotBusyId === item.id}
                          className="w-full flex items-center justify-between bg-cream-100 rounded-xl px-3 py-2 text-xs text-stone-600 disabled:opacity-60"
                        >
                          <span className="truncate">{item.name}</span>
                          {whyNotBusyId === item.id ? (
                            <Loader2 size={13} className="animate-spin shrink-0" />
                          ) : (
                            <span className="text-stone-400 shrink-0">Why not this?</span>
                          )}
                        </button>
                        {whyNotAnswers[item.id] ? (
                          <p className="text-xs text-stone-500 px-3 py-1.5">
                            {whyNotAnswers[item.id]}
                          </p>
                        ) : null}
                      </div>
                    ))}
                </div>
              ) : null}
            </div>
          </div>
        ) : null}

        <div className="pt-2">
          <button
            onClick={() => setLookbookOpen((v) => !v)}
            className="w-full flex items-center justify-between bg-white rounded-2xl px-4 py-3"
          >
            <span className="flex items-center gap-2 text-sm font-medium text-stone-700">
              <BookMarked size={16} className="text-emerald-600" />
              Lookbook
            </span>
            <span className="text-xs text-stone-400">
              {savedLooks.length} saved
            </span>
          </button>

          {lookbookOpen ? (
            <div className="mt-3 space-y-3">
              {savedLooks.length === 0 ? (
                <p className="text-sm text-stone-500 text-center py-8">
                  Save outfits you love and they&apos;ll show up here, ready
                  to wear again.
                </p>
              ) : (
                <>
                  {usedCollections.length > 0 ? (
                    <div className="flex gap-1.5 overflow-x-auto pb-1">
                      <button
                        onClick={() => setCollectionFilter("all")}
                        className={`shrink-0 px-3 py-1 rounded-full text-xs font-medium ${
                          collectionFilter === "all"
                            ? "bg-emerald-600 text-cream"
                            : "bg-cream-100 text-stone-500"
                        }`}
                      >
                        All
                      </button>
                      {usedCollections.map((c) => (
                        <button
                          key={c}
                          onClick={() => setCollectionFilter(c)}
                          className={`shrink-0 px-3 py-1 rounded-full text-xs font-medium ${
                            collectionFilter === c
                              ? "bg-emerald-600 text-cream"
                              : "bg-cream-100 text-stone-500"
                          }`}
                        >
                          {c}
                        </button>
                      ))}
                    </div>
                  ) : null}

                  {visibleSavedLooks.map((look) => {
                    const scoreValues = Object.values(look.scores || {});
                    const avgScore = scoreValues.length
                      ? Math.round(
                          scoreValues.reduce((a, b) => a + b, 0) / scoreValues.length
                        )
                      : 0;
                    const dateLabel = new Date(look.createdAt).toLocaleDateString(
                      undefined,
                      { month: "short", day: "numeric" }
                    );
                    return (
                      <div key={look.id} className="bg-white rounded-2xl p-3 space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-sm text-stone-700 truncate">
                              {look.prompt}
                            </p>
                            <div className="flex items-center gap-2 mt-0.5">
                              {look.collection ? (
                                <span className="text-[10px] bg-cream-100 text-stone-500 px-2 py-0.5 rounded-full">
                                  {look.collection}
                                </span>
                              ) : null}
                              {avgScore > 0 ? (
                                <span className="text-[10px] text-clay-500">
                                  {"★".repeat(avgScore)}
                                  {"☆".repeat(Math.max(0, 5 - avgScore))}
                                </span>
                              ) : null}
                              <span className="text-[10px] text-stone-400">{dateLabel}</span>
                            </div>
                          </div>
                          <button
                            onClick={() => removeSavedLook(look)}
                            className="text-stone-300 hover:text-clay-700 shrink-0"
                            aria-label={`Remove ${look.prompt}`}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                        <OutfitItemStrip itemIds={look.itemIds} items={closetItems} />
                      </div>
                    );
                  })}
                </>
              )}
            </div>
          ) : null}
        </div>
      </div>

      {swappingItem ? (
        <div
          className="fixed inset-0 z-50 flex flex-col md:items-center md:justify-center bg-black/40"
          onClick={() => setSwappingItem(null)}
        >
          <div
            className="mt-auto md:mt-0 md:max-w-sm md:w-full bg-cream rounded-t-3xl md:rounded-3xl max-h-[75vh] flex flex-col pb-safe"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-clay-100">
              <div className="min-w-0">
                <h2 className="text-base font-medium text-stone-800">Swap item</h2>
                <p className="text-xs text-stone-400 truncate">
                  Replacing &ldquo;{swappingItem.name}&rdquo;
                </p>
              </div>
              <button
                onClick={() => setSwappingItem(null)}
                className="p-2 rounded-full hover:bg-clay-50 shrink-0"
                aria-label="Close"
              >
                <X size={18} className="text-stone-500" />
              </button>
            </div>
            <div className="overflow-y-auto px-5 py-4">
              {swapCandidates.length === 0 ? (
                <p className="text-sm text-stone-500 text-center py-8">
                  No other clean {swappingItem.category} items to swap in.
                </p>
              ) : (
                <div className="grid grid-cols-3 gap-3">
                  {swapCandidates.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => applySwap(item)}
                      className="text-left"
                    >
                      <div className="aspect-[3/4] rounded-xl overflow-hidden bg-cream-100">
                        {item.image ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={item.image}
                            alt={item.name}
                            className="w-full h-full object-cover"
                          />
                        ) : null}
                      </div>
                      <p className="text-[11px] text-stone-600 mt-1 truncate">
                        {item.name}
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}

      <BottomNav />
    </main>
  );
}
