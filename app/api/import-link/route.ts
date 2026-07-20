import { NextRequest, NextResponse } from "next/server";
import { isSafeExternalUrl } from "@/lib/urlSafety";
import { sanitizeGroqText } from "@/lib/groqSanitizer";

const MAX_HTML_BYTES = 3_000_000;

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
      pageRes = await fetch(url, {
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

    const rawHtml = await pageRes.text();
    const html = rawHtml.slice(0, MAX_HTML_BYTES);
    const imageUrl = extractMeta(html, "og:image") || extractMeta(html, "twitter:image");
    const title =
      extractMeta(html, "og:title") ||
      extractMeta(html, "twitter:title") ||
      html.match(/<title>([^<]+)<\/title>/i)?.[1] ||
      "Imported item";

    if (!imageUrl || !isSafeExternalUrl(imageUrl)) {
      return NextResponse.json(
        {
          error:
            "Couldn't find a product photo on that page. Try screenshotting the product instead and uploading it from the Wishlist tab.",
        },
        { status: 422 }
      );
    }

    const imgRes = await fetch(imageUrl);
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

    const buffer = Buffer.from(await imgRes.arrayBuffer());
    if (buffer.length > 8_000_000) {
      return NextResponse.json(
        { error: "That product photo is too large to import." },
        { status: 422 }
      );
    }

    const dataUrl = `data:${contentType};base64,${buffer.toString("base64")}`;

    return NextResponse.json({
      image: dataUrl,
      title: sanitizeGroqText(title.slice(0, 200)),
      sourceUrl: url,
    });
  } catch (err) {
    console.error("import-link failed:", err instanceof Error ? err.message : err);
    return NextResponse.json(
      { error: "Couldn't import that link. Try screenshotting the product instead." },
      { status: 500 }
    );
  }
}
