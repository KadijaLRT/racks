import { NextRequest, NextResponse } from "next/server";
import { isSafeExternalUrl } from "@/lib/urlSafety";
import { sanitizeGroqText } from "@/lib/groqSanitizer";

const MAX_HTML_BYTES = 3_000_000;
const MAX_IMAGE_BYTES = 8_000_000;
const FETCH_TIMEOUT_MS = 15_000;

function extractMeta(html: string, prop: string): string | null {
  const patterns = [
    new RegExp(`<meta[^>]+property=["']${prop}["'][^>]+content=["']([^"']+)["']`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${prop}["']`, "i"),
    new RegExp(`<meta[^>]+name=["']${prop}["'][^>]+content=["']([^"']+)["']`, "i"),
  ];
  for (const re of patterns) {
    const m = html.match(re);
    if (m) return m[1];
  }
  return null;
}

export interface StructuredProductData {
  name?: string;
  color?: string;
  material?: string;
  brand?: string;
  productCategory?: string;
}

// Conservative on purpose: only maps when a retailer's category string
// contains an unambiguous keyword. Returns null for anything vague
// ("Women's" alone, "New Arrivals," etc.) rather than guess, since a
// wrong category here would silently skip AI verification and save
// the wrong thing.
const CATEGORY_KEYWORDS: [string, string][] = [
  ["dress", "dress"],
  ["jean", "bottom"],
  ["pant", "bottom"],
  ["trouser", "bottom"],
  ["short", "bottom"],
  ["skirt", "bottom"],
  ["legging", "bottom"],
  ["jacket", "outerwear"],
  ["coat", "outerwear"],
  ["blazer", "outerwear"],
  ["cardigan", "outerwear"],
  ["shoe", "shoes"],
  ["sneaker", "shoes"],
  ["boot", "shoes"],
  ["heel", "shoes"],
  ["sandal", "shoes"],
  ["bag", "accessory"],
  ["jewelry", "accessory"],
  ["necklace", "accessory"],
  ["earring", "accessory"],
  ["belt", "accessory"],
  ["scarf", "accessory"],
  ["hat", "accessory"],
  ["bikini", "swimwear"],
  ["swimwear", "swimwear"],
  ["swimsuit", "swimwear"],
  ["top", "top"],
  ["shirt", "top"],
  ["blouse", "top"],
  ["sweater", "top"],
];

export function mapToItemCategory(rawCategory: string): string | null {
  const text = rawCategory.toLowerCase();
  for (const [keyword, category] of CATEGORY_KEYWORDS) {
    if (text.includes(keyword)) return category;
  }
  return null;
}

/**
 * Many shopping sites embed a JSON-LD <script type="application/ld+json">
 * block with schema.org Product data (name/color/material/brand),
 * filled in by the retailer's own system, not guessed from a photo.
 * When present and usable, this lets a wishlist import skip the AI
 * vision tagging call entirely for that item, since the retailer
 * already told us what it is more reliably than image classification
 * would. Best-effort: retailers structure this data inconsistently
 * (sometimes a single object, sometimes wrapped in @graph, sometimes
 * an array of blocks), so this tries the common shapes and returns
 * whatever it can find rather than requiring one exact format.
 */
export function extractStructuredProductData(html: string): StructuredProductData | null {
  const blocks = html.match(
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
  );
  if (!blocks) return null;

  for (const block of blocks) {
    const jsonText = block.replace(/<script[^>]*>/i, "").replace(/<\/script>/i, "");
    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonText);
    } catch {
      continue; // malformed block, try the next one rather than failing outright
    }

    const candidates: Record<string, unknown>[] = [];
    const flatten = (node: unknown) => {
      if (!node || typeof node !== "object") return;
      if (Array.isArray(node)) {
        node.forEach(flatten);
        return;
      }
      const obj = node as Record<string, unknown>;
      if (obj["@graph"]) flatten(obj["@graph"]);
      candidates.push(obj);
    };
    flatten(parsed);

    const product = candidates.find((c) => {
      const type = c["@type"];
      return type === "Product" || (Array.isArray(type) && type.includes("Product"));
    });
    if (!product) continue;

    const name = typeof product.name === "string" ? product.name : undefined;
    const color = typeof product.color === "string" ? product.color : undefined;
    const material = typeof product.material === "string" ? product.material : undefined;
    const brand =
      typeof product.brand === "string"
        ? product.brand
        : typeof (product.brand as Record<string, unknown>)?.name === "string"
        ? ((product.brand as Record<string, unknown>).name as string)
        : undefined;
    const productCategory =
      typeof product.category === "string" ? product.category : undefined;

    if (name || color || material || brand || productCategory) {
      return { name, color, material, brand, productCategory };
    }
  }
  return null;
}

async function fetchWithTimeout(url: string, init?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Reads a response body as a stream, aborting as soon as maxBytes is
 * exceeded instead of buffering the entire body first. A naive
 * `await res.text()` / `await res.arrayBuffer()` followed by a
 * post-hoc length check still downloads and buffers the FULL body
 * first, an attacker-controlled or just very large endpoint can force
 * unbounded memory use before the size check ever runs.
 */
async function readCapped(res: Response, maxBytes: number): Promise<Uint8Array> {
  const reader = res.body?.getReader();
  if (!reader) {
    // Environment without streaming body support, fall back but still
    // enforce the cap after the fact rather than trusting the source.
    const buf = new Uint8Array(await res.arrayBuffer());
    if (buf.length > maxBytes) throw new Error("Response exceeded the allowed size.");
    return buf;
  }
  const chunks: Uint8Array[] = [];
  let received = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    received += value.length;
    if (received > maxBytes) {
      await reader.cancel();
      throw new Error("Response exceeded the allowed size.");
    }
    chunks.push(value);
  }
  const out = new Uint8Array(received);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}

interface ImportLinkRequestBody {
  url?: string;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => null)) as ImportLinkRequestBody | null;
    const url = body?.url;

    if (!url || typeof url !== "string" || !isSafeExternalUrl(url)) {
      return NextResponse.json(
        { error: "That link isn't something I can safely open. Try a direct product page URL." },
        { status: 400 }
      );
    }

    let pageRes: Response;
    try {
      pageRes = await fetchWithTimeout(url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
        },
        redirect: "follow",
      });
    } catch {
      return NextResponse.json(
        {
          error:
            "Couldn't reach that link. Some shopping sites block automated visits, try screenshotting the product instead and uploading it from the Wishlist tab.",
        },
        { status: 502 }
      );
    }

    if (!pageRes.ok) {
      return NextResponse.json(
        { error: `That link returned an error (${pageRes.status}). Try screenshotting the product instead.` },
        { status: 502 }
      );
    }

    // Re-check the final URL after redirects, a redirect chain could
    // otherwise be used to land on an internal address.
    if (!isSafeExternalUrl(pageRes.url)) {
      return NextResponse.json(
        { error: "That link redirected somewhere I can't safely open." },
        { status: 400 }
      );
    }

    let htmlBytes: Uint8Array;
    try {
      htmlBytes = await readCapped(pageRes, MAX_HTML_BYTES);
    } catch {
      return NextResponse.json(
        { error: "That page was too large to read. Try screenshotting the product instead." },
        { status: 422 }
      );
    }
    const html = Buffer.from(htmlBytes).toString("utf-8");
    const imageUrl = extractMeta(html, "og:image") || extractMeta(html, "twitter:image");
    const title =
      extractMeta(html, "og:title") ||
      extractMeta(html, "twitter:title") ||
      html.match(/<title>([^<]+)<\/title>/i)?.[1] ||
      "Imported item";
    const structured = extractStructuredProductData(html);
    const mappedCategory = structured?.productCategory
      ? mapToItemCategory(structured.productCategory)
      : null;

    if (!imageUrl || !isSafeExternalUrl(imageUrl)) {
      return NextResponse.json(
        {
          error:
            "Couldn't find a product photo on that page. Try screenshotting the product instead and uploading it from the Wishlist tab.",
        },
        { status: 422 }
      );
    }

    let imgRes: Response;
    try {
      imgRes = await fetchWithTimeout(imageUrl);
    } catch {
      return NextResponse.json(
        { error: "Found the page but couldn't load its product photo." },
        { status: 502 }
      );
    }
    if (!imgRes.ok) {
      return NextResponse.json(
        { error: "Found the page but couldn't load its product photo." },
        { status: 502 }
      );
    }

    const contentType = imgRes.headers.get("content-type") || "";
    if (!contentType.startsWith("image/")) {
      return NextResponse.json(
        { error: "That link's photo isn't a readable image format." },
        { status: 422 }
      );
    }

    let imageBytes: Uint8Array;
    try {
      imageBytes = await readCapped(imgRes, MAX_IMAGE_BYTES);
    } catch {
      return NextResponse.json(
        { error: "That product photo is too large to import." },
        { status: 422 }
      );
    }

    const dataUrl = `data:${contentType};base64,${Buffer.from(imageBytes).toString("base64")}`;

    return NextResponse.json({
      image: dataUrl,
      title: sanitizeGroqText(title.slice(0, 200)),
      sourceUrl: url,
      structuredColor: structured?.color ? sanitizeGroqText(structured.color.slice(0, 60)) : undefined,
      structuredMaterial: structured?.material
        ? sanitizeGroqText(structured.material.slice(0, 60))
        : undefined,
      structuredCategory: mappedCategory || undefined,
    });
  } catch (err) {
    console.error("import-link failed:", err instanceof Error ? err.message : err);
    return NextResponse.json(
      { error: "Couldn't import that link. Try screenshotting the product instead." },
      { status: 500 }
    );
  }
}
