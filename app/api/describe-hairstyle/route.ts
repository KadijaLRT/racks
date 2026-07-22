import { NextRequest, NextResponse } from "next/server";
import { groqChat, parseGroqJson, buildTextMessage, TEXT_MODEL } from "@/lib/groq";
import { sanitizeGroqText } from "@/lib/groqSanitizer";

interface DescribeHairstyleBody {
  hairstyle?: string;
  hairContext?: string;
  outfitContext?: string;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => null)) as DescribeHairstyleBody | null;
    const hairstyle = sanitizeGroqText(body?.hairstyle || "");

    if (!hairstyle) {
      return NextResponse.json(
        { error: "Missing hairstyle description." },
        { status: 400 }
      );
    }

    const hairContext = sanitizeGroqText(body?.hairContext || "");
    const outfitContext = sanitizeGroqText(body?.outfitContext || "");

    // Groq doesn't offer an image-generation model, so this gives a vivid,
    // specific text preview instead of a generated photo: styling steps,
    // how it will actually look and move, not a generic product blurb.
    const systemPrompt = `You are a hairstylist describing exactly how a specific hairstyle will look and feel on this person, so vividly the reader can picture it without a photo. Return ONLY a JSON object:
{
  "preview": "3-4 sentences, sensory and specific: how it frames the face, how it catches light or moves, the finish (glossy/matte/tousled), and one concrete detail (a part, a wave pattern, a length marker) that makes it feel real rather than generic",
  "stylingSteps": [2-4 short, concrete steps to actually achieve this look at home]
}`;

    const userPrompt = `Hairstyle to describe: "${hairstyle}"
${hairContext ? `Their hair characteristics: ${hairContext}` : ""}
${outfitContext ? `They're dressed for: ${outfitContext}` : ""}`;

    const content = await groqChat(
      [buildTextMessage("system", systemPrompt), buildTextMessage("user", userPrompt)],
      { model: TEXT_MODEL, jsonMode: true, temperature: 0.6, label: "Describing hairstyle", maxCompletionTokens: 600 }
    );

    const parsed = parseGroqJson<{ preview: string; stylingSteps: string[] }>(content, {
      preview: "",
      stylingSteps: [],
    });

    return NextResponse.json({
      preview: parsed.preview || "",
      stylingSteps: parsed.stylingSteps || [],
    });
  } catch (err) {
    console.error("describe-hairstyle failed:", err instanceof Error ? err.message : err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Hairstyle preview failed" },
      { status: 500 }
    );
  }
}
