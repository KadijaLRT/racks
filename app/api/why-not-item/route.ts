import { NextRequest, NextResponse } from "next/server";
import { groqChat, parseGroqJson, buildTextMessage, TEXT_MODEL } from "@/lib/groq";
import { sanitizeGroqPayload, sanitizeGroqText } from "@/lib/groqSanitizer";
import type { ClosetItem } from "@/lib/types";

interface CurrentLook {
  hairstyle?: string;
  makeup?: string;
  reasoning?: string;
}

interface WhyNotBody {
  candidateItem?: ClosetItem;
  currentLook?: CurrentLook;
  prompt?: string;
  chosenItems?: ClosetItem[];
}

const FALLBACK = { reason: "" };

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => null)) as WhyNotBody | null;
    const candidateItem = body?.candidateItem;
    const currentLook = body?.currentLook;

    if (!candidateItem || !currentLook) {
      return NextResponse.json({ error: "Missing data." }, { status: 400 });
    }

    const prompt = sanitizeGroqText(body?.prompt || "");
    const chosenItems = Array.isArray(body?.chosenItems) ? body!.chosenItems : [];

    const chosenList = chosenItems
      .map((i) => {
        const safe = sanitizeGroqPayload({
          category: i?.category || "",
          name: i?.name || "",
          tags: i?.tags || {},
        });
        return `- ${safe.category} | ${safe.name} | ${JSON.stringify(safe.tags)}`;
      })
      .join("\n");

    const safeCandidate = sanitizeGroqPayload({
      category: candidateItem.category || "",
      name: candidateItem.name || "",
      tags: candidateItem.tags || {},
    });

    const systemPrompt = `You are a stylist explaining a decision you already made. Be direct and specific, not defensive, if the honest answer is "it would actually work fine too, this was just one of several good options," say that. Return ONLY a JSON object:
{
  "reason": "1-2 sentences explaining specifically why this candidate item wasn't chosen for this look, reference the actual chosen items, the occasion, or the item's own attributes"
}`;

    const userPrompt = `Occasion: "${prompt}"

Chosen look:
${chosenList}
Hairstyle: ${sanitizeGroqText(currentLook.hairstyle || "")}
Makeup: ${sanitizeGroqText(currentLook.makeup || "")}
Original reasoning given: "${sanitizeGroqText(currentLook.reasoning || "")}"

Candidate item NOT chosen: ${safeCandidate.category} | ${safeCandidate.name} | ${JSON.stringify(
      safeCandidate.tags
    )}

Why wasn't this item chosen instead?`;

    const content = await groqChat(
      [buildTextMessage("system", systemPrompt), buildTextMessage("user", userPrompt)],
      { model: TEXT_MODEL, jsonMode: true, temperature: 0.5 }
    );

    const parsed = parseGroqJson<{ reason: string }>(content, FALLBACK);
    return NextResponse.json({ reason: parsed.reason || "" });
  } catch (err) {
    console.error("why-not-item failed:", err instanceof Error ? err.message : err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Couldn't explain that right now." },
      { status: 500 }
    );
  }
}
