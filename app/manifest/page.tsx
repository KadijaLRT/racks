"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, Loader2, Sparkles, Heart } from "lucide-react";
import Link from "next/link";
import BottomNav from "@/components/BottomNav";
import OutfitItemStrip from "@/components/OutfitItemStrip";
import HairstylePreview from "@/components/HairstylePreview";
import {
  closetStore,
  wigStore,
  hairProfileStore,
  colorProfileStore,
  styleProfileStore,
  inspirationStore,
  lookStore,
  incrementTimesWorn,
} from "@/lib/storage";
import type { ClosetItem, WigItem, HairProfile, ColorProfile } from "@/lib/types";
import { stripImagesForPrompt } from "@/lib/stripImagesForPrompt";

const INTENTIONS = ["Love", "Confidence", "Prosperity", "Protection", "Clarity", "Opportunity"];

const ZODIAC_SIGNS = [
  "Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo",
  "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces",
];

const MANIFEST_STEPS = [
  "Reading the charts...",
  "Aligning with your planet...",
  "Pulling matching pieces...",
  "Checking the energy...",
];

interface ManifestResult {
  itemIds: string[];
  hairstyle: string;
  makeup: string;
  planetFocus: string;
  reasoning: string;
  ritualTip: string;
  scores: Record<string, number>;
}

export default function ManifestPage() {
  const [closetItems, setClosetItems] = useState<ClosetItem[]>([]);
  const [wigs, setWigs] = useState<WigItem[]>([]);
  const [hairProfile, setHairProfile] = useState<HairProfile | null>(null);
  const [colorProfile, setColorProfile] = useState<ColorProfile | null>(null);
  const [styleDescription, setStyleDescription] = useState("");
  const [styleKeywords, setStyleKeywords] = useState<string[]>([]);

  const [intention, setIntention] = useState<string | null>(null);
  const [zodiacSign, setZodiacSign] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [error, setError] = useState("");
  const [result, setResult] = useState<ManifestResult | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    Promise.all([
      closetStore.getAll(),
      wigStore.getAll(),
      hairProfileStore.get(),
      colorProfileStore.get(),
      styleProfileStore.get(),
      inspirationStore.getAll(),
    ]).then(([items, wigList, hair, color, style, inspirations]) => {
      setClosetItems(items || []);
      setWigs(wigList || []);
      setHairProfile(hair || null);
      setColorProfile(color || null);
      setStyleDescription(style?.description || "");
      setStyleKeywords((inspirations || []).flatMap((i) => i.keywords || []));
    });
  }, []);

  useEffect(() => {
    if (!loading) return;
    const interval = setInterval(() => {
      setLoadingStep((s) => (s + 1) % MANIFEST_STEPS.length);
    }, 750);
    return () => clearInterval(interval);
  }, [loading]);

  async function manifest() {
    if (!intention) return;
    if (closetItems.length === 0) {
      setError("Add a few closet items first, even the stars need something to work with.");
      return;
    }

    setLoading(true);
    setLoadingStep(0);
    setError("");
    setResult(null);
    setSaved(false);
    try {
      const res = await fetch("/api/generate-manifestation-look", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          intention,
          zodiacSign,
          items: stripImagesForPrompt(closetItems),
          wigs,
          hairProfile,
          colorProfile,
          styleDescription,
          styleKeywords,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (data?.error) throw new Error(data.error);
      if (!Array.isArray(data?.itemIds) || data.itemIds.length === 0) {
        throw new Error("Couldn't put together a look from what's in your closet yet.");
      }
      setResult(data);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Couldn't manifest a look right now."
      );
    } finally {
      setLoading(false);
    }
  }

  async function save() {
    if (!result || !intention) return;
    await lookStore.create({
      prompt: `Manifesting ${intention.toLowerCase()}${zodiacSign ? ` (${zodiacSign})` : ""}`,
      itemIds: result.itemIds,
      hairstyle: result.hairstyle,
      makeup: result.makeup,
      reasoning: result.reasoning,
      scores: result.scores,
      favorite: true,
      collection: "Manifestation",
    });
    await incrementTimesWorn(result.itemIds);
    setSaved(true);
  }

  return (
    <main className="min-h-screen pb-28 pt-safe bg-cream">
      <div className="max-w-md mx-auto px-4 pt-6 space-y-4">
        <div className="flex items-center gap-2">
          <Link href="/discover" aria-label="Back">
            <ArrowLeft size={18} className="text-stone-400" />
          </Link>
          <h1 className="text-xl font-semibold text-stone-800">Manifest a look</h1>
        </div>
        <p className="text-sm text-stone-500">
          Dress for what you want to call in, a little astrology, a little
          real styling.
        </p>

        <div className="bg-white rounded-2xl p-4 space-y-4">
          <div>
            <p className="text-xs text-stone-500 mb-1.5">What are you calling in?</p>
            <div className="flex flex-wrap gap-2">
              {INTENTIONS.map((i) => (
                <button
                  key={i}
                  onClick={() => setIntention(i)}
                  className={`px-3 py-2 rounded-full text-xs font-medium min-h-[36px] ${
                    intention === i
                      ? "bg-emerald-600 text-cream"
                      : "bg-cream-100 text-stone-500"
                  }`}
                >
                  {i}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs text-stone-500 mb-1.5">Your sign (optional)</p>
            <div className="flex flex-wrap gap-2">
              {ZODIAC_SIGNS.map((z) => (
                <button
                  key={z}
                  onClick={() => setZodiacSign(zodiacSign === z ? null : z)}
                  className={`px-3 py-2 rounded-full text-xs min-h-[36px] ${
                    zodiacSign === z
                      ? "bg-clay-500 text-cream"
                      : "bg-cream-100 text-stone-500"
                  }`}
                >
                  {z}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={manifest}
            disabled={loading || !intention}
            className="w-full rounded-xl bg-emerald-600 text-cream py-3 text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Sparkles size={16} />
            )}
            {loading ? MANIFEST_STEPS[loadingStep] : "Manifest my look"}
          </button>
        </div>

        {error ? (
          <div className="rounded-xl bg-clay-50 text-clay-700 text-xs px-3 py-2">
            {error}
          </div>
        ) : null}

        {result ? (
          <div className="bg-white rounded-2xl p-4 space-y-3">
            {result.planetFocus ? (
              <p className="text-xs font-medium text-clay-700 uppercase tracking-wide">
                Ruled by {result.planetFocus}
              </p>
            ) : null}

            <OutfitItemStrip itemIds={result.itemIds} items={closetItems} />

            <p className="text-sm text-stone-600">{result.reasoning}</p>

            {result.hairstyle ? (
              <div>
                <p className="text-xs text-stone-500">
                  <span className="font-medium">Hair:</span> {result.hairstyle}
                </p>
                <div className="mt-1">
                  <HairstylePreview
                    key={result.hairstyle}
                    hairstyle={result.hairstyle}
                    outfitContext={`manifesting ${intention?.toLowerCase() || ""}`}
                  />
                </div>
              </div>
            ) : null}
            {result.makeup ? (
              <p className="text-xs text-stone-500">
                <span className="font-medium">Makeup:</span> {result.makeup}
              </p>
            ) : null}

            {result.ritualTip ? (
              <p className="text-xs italic text-stone-500 border-t border-clay-100 pt-3">
                ✨ {result.ritualTip}
              </p>
            ) : null}

            <button
              onClick={save}
              disabled={saved}
              className="w-full rounded-xl bg-emerald-600 text-cream py-2.5 text-xs font-medium flex items-center justify-center gap-1.5 disabled:opacity-60"
            >
              <Heart size={14} />
              {saved ? "Saved to Manifestation" : "Save this look"}
            </button>
          </div>
        ) : null}
      </div>

      <BottomNav />
    </main>
  );
}
