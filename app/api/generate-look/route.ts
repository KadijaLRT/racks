import { NextRequest, NextResponse } from "next/server";
import { groqChat, parseGroqJson, buildTextMessage } from "@/lib/groq";
import { sanitizeGroqText, sanitizeGroqPayload, formatTagsCompact } from "@/lib/groqSanitizer";
import { estimateFormality } from "@/lib/localLookBuilder";
import { analyzeOccasion, occasionConflict, scoreOutfitFit } from "@/lib/occasionProfile";
import type { ClosetItem, WigItem, HairProfile, ColorProfile, UserMeasurements } from "@/lib/types";

interface GenerateLookRequestBody {
  prompt?: string;
  mood?: string;
  items?: ClosetItem[];
  wigs?: WigItem[];
  hairProfile?: HairProfile | null;
  weather?: string;
  energy?: string;
  colorProfile?: ColorProfile | null;
  measurements?: UserMeasurements | null;
  styleDescription?: string;
  styleKeywords?: string[];
  previousLook?: {
    itemIds: string[];
    hairstyle: string;
    makeup: string;
  } | null;
  instruction?: string;
}

interface GeneratedLookResponse {
  eventRead?: string;
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

const FALLBACK_LOOK: GeneratedLookResponse = {
  eventRead: "",
  itemIds: [],
  hairstyle: "",
  makeup: "",
  reasoning: "",
  scores: {},
  overallLabel: "",
  overallStars: 0,
  strengths: [],
  weaknesses: [],
};

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => null)) as GenerateLookRequestBody | null;
    const prompt = sanitizeGroqText(body?.prompt || "");
    const items = Array.isArray(body?.items) ? body!.items : [];

    if (!prompt || items.length === 0) {
      return NextResponse.json(
        { error: "Need a prompt and at least one closet item." },
        { status: 400 }
      );
    }

    const mood = sanitizeGroqText(body?.mood || "");
    const weather = sanitizeGroqText(body?.weather || "");
    const energy = sanitizeGroqText(body?.energy || "");
    const styleDescription = sanitizeGroqText(body?.styleDescription || "");
    const instruction = sanitizeGroqText(body?.instruction || "");
    const styleKeywords = (Array.isArray(body?.styleKeywords) ? body!.styleKeywords : [])
      .map((k) => sanitizeGroqText(k))
      .filter(Boolean);
    const wigs = Array.isArray(body?.wigs) ? body!.wigs : [];
    const hairProfile = body?.hairProfile || null;
    const colorProfile = body?.colorProfile || null;
    const measurements = body?.measurements || null;
    const previousLook = body?.previousLook || null;

    const wearable = items.filter(
      (i) => i?.laundryStatus === "clean" && i?.category !== "makeup" && i?.closetStatus !== "store"
    );
    const ownedMakeup = items.filter((i) => i?.category === "makeup");

    if (wearable.length === 0) {
      return NextResponse.json(
        {
          error:
            "None of your catalogued items are marked clean right now, everything is dirty or at the dry cleaner. Mark something as clean in your closet to generate a look.",
        },
        { status: 400 }
      );
    }

    // The prompt requires the model to build top+bottom, a dress, or a
    // set, plus shoes. If the closet genuinely can't support any of
    // those combinations, Groq will legitimately come back with an
    // empty itemIds array and no way to explain why, since it has no
    // more context than we do. Checking category coverage up front lets
    // us tell the person exactly what's missing instead of a generic
    // "couldn't put together a look" that gives no next step.
    const hasCategory = (cat: string) => wearable.some((i) => i?.category === cat);
    const canFormOutfit =
      hasCategory("dress") ||
      hasCategory("set") ||
      (hasCategory("top") && hasCategory("bottom"));
    const hasShoes = hasCategory("shoes");

    if (!canFormOutfit || !hasShoes) {
      const missing: string[] = [];
      if (!canFormOutfit) {
        missing.push("a dress, a set, or a top and a bottom");
      }
      if (!hasShoes) {
        missing.push("shoes");
      }
      return NextResponse.json(
        {
          error: `Your closet doesn't have enough marked-clean items yet to build a full look. Add ${missing.join(
            " and "
          )} to get started.`,
        },
        { status: 400 }
      );
    }

    // The dress-code brief: what the event actually calls for, computed
    // locally so it does not depend on the model's guess about it.
    const profile = analyzeOccasion(prompt);
    const bandText = profile.band
      ? profile.band.min === profile.band.max
        ? `${profile.band.min}`
        : `${profile.band.min}-${profile.band.max}`
      : "";
    const dressCodeBrief = profile.band
      ? `DRESS CODE BRIEF (this is the most important input, it outranks mood, favorites and neglected pieces):
- Event type: ${profile.label}
- Every non-accessory piece must have a dress level of ${bandText} (scale: 1 loungewear/athletic, 2 casual, 3 smart casual, 4 business/elevated, 5 formal). Each closet item below lists its level.
- Never choose an item marked "WRONG FOR THIS EVENT".
${profile.guidance.map((g) => `- ${g}`).join("\n")}${
          profile.preferColors.length > 0
            ? `\n- Colors that suit this event: ${profile.preferColors.join(", ")}.`
            : ""
        }${
          profile.avoidColors.length > 0
            ? `\n- Colors to avoid for this event: ${profile.avoidColors.join(", ")}.`
            : ""
        }
- If the closet has nothing at the right level for a slot, choose the closest available and say so honestly in "weaknesses" instead of pretending it fits.`
      : "";

    // Every string field pulled from closet items is sanitized before
    // being interpolated into the prompt sent to Groq.
    const closetList = wearable
      .map((i) => {
        const safe = sanitizeGroqPayload({
          category: i?.category || "",
          name: i?.name || "",
          tags: i?.tags || {},
        });
        const level = estimateFormality(i);
        const conflict = profile.band || profile.avoidText || profile.avoidColors.length > 0
          ? occasionConflict(i, profile)
          : null;
        return `- id:${i.id} | ${safe.category} | ${safe.name} | dress level ${level}/5 | ${JSON.stringify(
          safe.tags
        )} | worn ${i?.timesWorn ?? 0}×${i?.pinned ? " | PINNED FAVORITE" : ""}${
          conflict ? " | WRONG FOR THIS EVENT" : ""
        }`;
      })
      .join("\n");

    const makeupList = ownedMakeup
      .map((i) => {
        const safe = sanitizeGroqPayload({ name: i?.name || "", tags: i?.tags || {} });
        return `- id:${i.id} | ${safe.name} | ${formatTagsCompact(safe.tags)}`;
      })
      .join("\n");

    const wigList = (wigs || [])
      .map((w) => {
        const safe = sanitizeGroqPayload({ name: w?.name || "", tags: w?.tags || {} });
        return `- id:${w.id} | wig | ${safe.name} | ${formatTagsCompact(safe.tags)}`;
      })
      .join("\n");

    let hairContext = "No hair info provided; suggest a hairstyle generically.";
    if (hairProfile?.mode === "description" && hairProfile?.description) {
      hairContext = `User describes their hair as: "${sanitizeGroqText(hairProfile.description)}"`;
    } else if (hairProfile?.tags) {
      hairContext = `User's current hair: ${formatTagsCompact(sanitizeGroqPayload(hairProfile.tags))}`;
    }

    const weatherContext = weather
      ? `Weather context: ${weather}`
      : "No weather data provided.";

    const energyContext = energy
      ? `Physical/mental capacity today: "${energy}". Treat this as a hard constraint, not flavor: if it mentions sensory sensitivity, exclude anything scratchy, stiff-collared, tight-waisted, or restrictive regardless of how well it otherwise fits the occasion; if it mentions low energy, strongly prefer a single one-and-done piece (a dress or matching set) over separates that need coordinating, and keep accessories minimal; if it mentions wanting confidence/armor, prefer structured, tailored, sharp-silhouette pieces and bolder colors over soft/relaxed ones.`
      : "";

    const moodContext = mood
      ? `The user wants this look to make them feel: "${mood}". Let this emotional intent shape silhouette, color, and accessory choices as much as the occasion itself.`
      : "";

    const colorContext = colorProfile
      ? `User's seasonal color analysis: ${sanitizeGroqText(colorProfile.season)}, ${sanitizeGroqText(
          colorProfile.undertone
        )} undertone. Best colors: ${(colorProfile.bestColors || [])
          .map((c) => sanitizeGroqText(c))
          .join(", ")}. Use sparingly: ${(colorProfile.avoidColors || [])
          .map((c) => sanitizeGroqText(c))
          .join(", ")}. Prefer items leaning toward best colors when reasonable, never force a mismatch.`
      : "No color analysis on file.";

    const measurementsParts: string[] = [];
    if (measurements?.height) measurementsParts.push(`height ${sanitizeGroqText(measurements.height)}`);
    if (measurements?.weight) measurementsParts.push(`weight ${sanitizeGroqText(measurements.weight)}`);
    if (measurements?.braSize) measurementsParts.push(`bra size ${sanitizeGroqText(measurements.braSize)}`);
    if (measurements?.topSize) measurementsParts.push(`top size ${sanitizeGroqText(measurements.topSize)}`);
    if (measurements?.bottomSize) measurementsParts.push(`bottom size ${sanitizeGroqText(measurements.bottomSize)}`);
    if (measurements?.dressSize) measurementsParts.push(`dress size ${sanitizeGroqText(measurements.dressSize)}`);
    if (measurements?.shoeSize) measurementsParts.push(`shoe size ${sanitizeGroqText(measurements.shoeSize)}`);
    const measurementsContext =
      measurementsParts.length > 0
        ? `User's measurements/sizes: ${measurementsParts.join(", ")}${
            measurements?.notes ? `. Fit notes: "${sanitizeGroqText(measurements.notes)}"` : ""
          }. Use this only as soft fit-awareness context (e.g. favor relaxed/stretch pieces if sizing suggests a snugger fit could be uncomfortable, or mention true-to-size confidence in reasoning), never as a hard filter, since you have no actual garment measurements to compare against.`
        : "No measurements on file.";

    const styleParts: string[] = [];
    if (styleDescription) {
      styleParts.push(`User describes their personal style as: "${styleDescription}"`);
    }
    if (styleKeywords.length > 0) {
      styleParts.push(`Aesthetic keywords from style inspiration: ${styleKeywords.join(", ")}`);
    }
    const styleContext =
      styleParts.length > 0
        ? `${styleParts.join(" ")} Lean toward this aesthetic among items that fit the occasion, but occasion and actual closet items always come first.`
        : "No personal style profile on file.";

    const refinementContext = previousLook
      ? `The user already has this look, built for the same occasion:
- Items: ${JSON.stringify(previousLook.itemIds || [])}
- Hairstyle: ${sanitizeGroqText(previousLook.hairstyle || "")}
- Makeup: ${sanitizeGroqText(previousLook.makeup || "")}

They now want ONE change: "${instruction}"

Apply ONLY what this change requires, keep everything else the same unless the change necessarily affects it. Still return the FULL current itemIds array.`
      : null;

    const systemPrompt = `You are an expert personal stylist${
      refinementContext
        ? ", currently refining a look you already built for the user"
        : ""
    }. You ONLY use items from the user's actual closet list below, never invent items. Each item shows how many times it's been worn ("worn N×"), where it fits naturally, favor reviving a neglected piece (worn 0-1×) over always reaching for the most-worn items, and mention it in your reasoning if you do. Don't force a neglected item if nothing neglected fits. Items marked "PINNED FAVORITE" get modest extra weight when they reasonably fit, never forced in otherwise. You may recommend a wig from the wig list as the hairstyle if it fits better than natural hair, otherwise suggest a hairstyle achievable with described natural hair. If the user owns specific makeup products, build the makeup look from those by name; only describe a generic look if they own none.

Before choosing anything, work out what the event really demands: who will be there, indoors or outdoors, time of day, how much standing or walking, and the expected dress code. Real events have real norms (nothing white at someone else's wedding, somber and modest for a funeral, conservative for an interview, comfortable shoes for a festival). Treat the occasion as the primary constraint; mood, favorites and neglected pieces are tiebreakers only.

Return ONLY a JSON object with this exact shape:
{
  "eventRead": "one sentence naming the event and its dress code, e.g. 'Funeral: somber, modest, dark muted colors'",
  "itemIds": [closet item id strings you selected, ONLY from "Closet items available", NEVER from the makeup list. Pick a coherent set: top+bottom, a dress, or a "set" (standalone, never paired with an extra top or bottom), plus shoes, plus 0-2 accessories. Never two items of the same category unless layering makes sense],
  "hairstyle": "short description, name the wig if used",
  "makeup": "short description, name owned products if any, otherwise generic",
  "reasoning": "${
    refinementContext
      ? "1-2 sentences acknowledging the specific change and why it works"
      : "2-3 sentences in a warm, confident stylist voice on why this works for the occasion, weather, coloring, and together"
  }",
  "scores": { "colorHarmony": 1-5, "occasionFit": 1-5, "weatherSuitability": 1-5, "comfort": 1-5 },
  "overallLabel": "one word/short phrase, honest, not everything deserves Perfect",
  "overallStars": 1-5 integer,
  "strengths": [2-4 short concrete phrases on what works],
  "weaknesses": [0-3 short concrete phrases on real weak points, empty array if none]
}`;

    const userPrompt = `Occasion / request: "${prompt}"
${mood ? `Desired feeling: "${mood}"` : ""}

${dressCodeBrief}

${weatherContext}
${energyContext}

${moodContext}

${hairContext}

${colorContext}

${measurementsContext}

${styleContext}

${refinementContext ? refinementContext + "\n\n" : ""}Closet items available:
${closetList}

Owned makeup products:
${makeupList || "(none catalogued)"}

Wigs available:
${wigList || "(none)"}

${refinementContext ? "Apply the requested change to the existing look." : "Build the best possible look using ONLY the items above."}`;

    const messages = [
      buildTextMessage("system", systemPrompt),
      buildTextMessage("user", userPrompt),
    ];
    const callOpts = {
      kind: "text" as const,
      jsonMode: true,
      temperature: 0.6,
      label: "Generating a look",
      maxCompletionTokens: 2200,
    };

    const validIds = new Set(wearable.map((i) => i.id));
    const byId = new Map(wearable.map((i) => [i.id, i]));

    // Drops ids the model invented or took from the makeup list, so a
    // hallucinated id can never reach the screen as a blank card.
    function clean(r: GeneratedLookResponse): GeneratedLookResponse {
      const ids = Array.isArray(r.itemIds) ? r.itemIds : [];
      return { ...r, itemIds: [...new Set(ids.filter((id) => validIds.has(id)))] };
    }

    async function ask(extra?: string, temperature?: number): Promise<GeneratedLookResponse> {
      const msgs = extra
        ? [...messages, buildTextMessage("user", extra)]
        : messages;
      const content = await groqChat(msgs, temperature ? { ...callOpts, temperature } : callOpts);
      return clean(parseGroqJson<GeneratedLookResponse>(content, FALLBACK_LOOK));
    }

    let parsed = await ask();

    // We've already confirmed above that the closet has enough clean,
    // categorized items to physically build an outfit, so an empty
    // itemIds here means the model failed to commit to a combination
    // (or its JSON was truncated short of the itemIds field on a large
    // closet list), not that it's impossible. One retry at a slightly
    // higher temperature resolves this most of the time; if it's still
    // empty after that, say so plainly instead of returning an empty
    // array that the frontend can only describe generically.
    if (parsed.itemIds.length === 0) {
      parsed = await ask(undefined, 0.75);
    }

    if (parsed.itemIds.length === 0) {
      return NextResponse.json(
        {
          error:
            "The AI had your closet items available but couldn't settle on a combination this time. Try rephrasing the occasion, or generate again.",
        },
        { status: 502 }
      );
    }

    // Check the model's answer against the event instead of trusting it.
    // Skipped for refinements: "Dressier" or "More casual" are explicit
    // requests to move away from the original event level.
    let fit = null as ReturnType<typeof scoreOutfitFit> | null;
    const fitOf = (r: GeneratedLookResponse) =>
      scoreOutfitFit(
        r.itemIds.map((id) => byId.get(id)).filter((i): i is ClosetItem => !!i),
        profile,
        estimateFormality
      );
    if (!previousLook && (profile.band || profile.avoidText || profile.avoidColors.length > 0)) {
      fit = fitOf(parsed);
      if (fit.problems.length > 0) {
        const retry = await ask(
          `That outfit does not suit this event. Problems: ${fit.problems.join("; ")}. Rebuild the look so every non-accessory piece sits at dress level ${bandText || "appropriate for the event"} and none is marked WRONG FOR THIS EVENT. Return the same JSON shape.`,
          0.4
        ).catch(() => null);
        if (retry && retry.itemIds.length > 0) {
          const retryFit = fitOf(retry);
          if (retryFit.score >= fit.score) {
            parsed = retry;
            fit = retryFit;
          }
        }
      }
      // Still clearly wrong after one correction: report a mismatch so the
      // app builds the look locally, where the dress code is enforced
      // piece by piece, rather than showing a look that misses the event.
      if (fit && fit.score <= 2) {
        return NextResponse.json(
          {
            error: `The AI's picks didn't fit a ${profile.label || "this"} dress code (${fit.problems[0]}).`,
            code: "occasion-mismatch",
          },
          { status: 422 }
        );
      }
    }

    // The model's own occasionFit score is capped by the measured fit so
    // a mismatched outfit can't claim 5/5 for the event.
    const scores = { ...(parsed.scores || {}) };
    if (fit) {
      scores.occasionFit = Math.min(Number(scores.occasionFit) || fit.score, fit.score);
    }
    const weaknesses = [...(parsed.weaknesses || [])];
    if (fit && fit.problems.length > 0) {
      weaknesses.push(`Event fit: ${fit.problems[0]}`);
    }

    return NextResponse.json({
      itemIds: parsed.itemIds || [],
      hairstyle: parsed.hairstyle || "",
      makeup: parsed.makeup || "",
      reasoning: parsed.reasoning || "",
      scores,
      overallLabel: parsed.overallLabel || "",
      overallStars: parsed.overallStars || 0,
      strengths: parsed.strengths || [],
      weaknesses,
      dressCode: parsed.eventRead || "",
    });
  } catch (err) {
    console.error("generate-look failed:", err instanceof Error ? err.message : err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Look generation failed" },
      { status: 500 }
    );
  }
}
