// Extracts a Color tag directly from image pixels, entirely locally,
// zero AI, zero network call. Downsamples to a small canvas, averages
// the sampled pixels, and maps the resulting RGB to whichever
// COLOR_OPTIONS entry is closest by Euclidean distance. This is a
// genuine, if imperfect, alternative to asking a vision model "what
// color is this" — solid-colored garments (the common case) come out
// quite reliably; heavily patterned/multi-color items get flagged as
// "Multicolor" instead of a misleading single hue, based on how much
// the sampled pixels vary from each other.

// Reasonable reference RGB for each COLOR_OPTIONS entry. Not trying to
// be a precise colorimetry reference, just close enough that nearest-
// neighbor matching lands on something sensible for real garment photos.
export const COLOR_REFERENCE: Record<string, [number, number, number]> = {
  Black: [20, 20, 20],
  White: [245, 245, 245],
  Gray: [140, 140, 140],
  Charcoal: [60, 60, 62],
  Ivory: [240, 234, 214],
  Cream: [245, 237, 208],
  Beige: [222, 202, 168],
  Tan: [210, 180, 140],
  Camel: [193, 154, 107],
  Caramel: [175, 111, 47],
  Chocolate: [90, 55, 33],
  Brown: [101, 67, 33],
  Rust: [183, 65, 14],
  Mustard: [212, 164, 23],
  Yellow: [240, 210, 40],
  Peach: [255, 190, 150],
  Coral: [255, 111, 97],
  Orange: [237, 125, 31],
  Terracotta: [204, 78, 47],
  Ruby: [155, 17, 30],
  Red: [200, 30, 30],
  Maroon: [110, 20, 25],
  Burgundy: [90, 15, 35],
  Blush: [235, 190, 190],
  Pink: [240, 150, 180],
  Rose: [200, 110, 130],
  Fuchsia: [220, 30, 150],
  Magenta: [200, 20, 140],
  Plum: [110, 55, 90],
  Purple: [110, 60, 150],
  Lavender: [190, 170, 220],
  Lilac: [200, 175, 215],
  Violet: [140, 80, 200],
  "Sky Blue": [140, 195, 230],
  Cerulean: [40, 130, 180],
  Blue: [40, 80, 190],
  Denim: [70, 100, 140],
  "Denim Blue": [65, 95, 135],
  Navy: [20, 30, 70],
  Teal: [20, 120, 120],
  Emerald: [20, 130, 85],
  Green: [50, 130, 60],
  Olive: [100, 105, 45],
  Khaki: [170, 160, 110],
  Forest: [30, 70, 40],
  Mint: [170, 225, 195],
  Gold: [205, 165, 55],
  Silver: [190, 190, 195],
};

function distanceSq(a: [number, number, number], b: [number, number, number]): number {
  return (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;
}

/**
 * Samples a downscaled version of the image and returns the closest
 * matching color name from COLOR_OPTIONS, or "Multicolor" if the
 * sampled pixels vary too much to represent as one solid color, or
 * null if extraction fails for any reason (unreadable image, etc.),
 * in which case callers should just leave Color unset rather than
 * guess.
 */
export function extractDominantColorTag(dataUrl: string): Promise<string | null> {
  return new Promise((resolve) => {
    try {
      const img = new Image();
      img.onerror = () => resolve(null);
      img.onload = () => {
        try {
          const SAMPLE = 40;
          const canvas = document.createElement("canvas");
          canvas.width = SAMPLE;
          canvas.height = SAMPLE;
          const ctx = canvas.getContext("2d");
          if (!ctx) {
            resolve(null);
            return;
          }
          ctx.drawImage(img, 0, 0, SAMPLE, SAMPLE);
          const { data } = ctx.getImageData(0, 0, SAMPLE, SAMPLE);

          let sumR = 0, sumG = 0, sumB = 0, count = 0;
          const samples: [number, number, number][] = [];
          for (let i = 0; i < data.length; i += 4) {
            const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
            if (a < 200) continue; // skip transparent background pixels
            // Skip near-pure-white pixels: these are overwhelmingly
            // likely to be a plain product-photo background, not the
            // garment itself, and would otherwise bias everything
            // toward "White" regardless of the actual item color.
            if (r > 240 && g > 240 && b > 240) continue;
            sumR += r;
            sumG += g;
            sumB += b;
            count++;
            samples.push([r, g, b]);
          }
          if (count < 10) {
            resolve(null);
            return;
          }
          const avg: [number, number, number] = [sumR / count, sumG / count, sumB / count];

          // High variance among sampled pixels suggests a pattern or
          // multiple colors rather than one solid garment color, in
          // which case a single averaged hue would be misleading.
          const variance =
            samples.reduce((sum, s) => sum + distanceSq(s, avg), 0) / samples.length;
          if (variance > 5500) {
            resolve("Multicolor");
            return;
          }

          let best: string | null = null;
          let bestDist = Infinity;
          for (const [name, ref] of Object.entries(COLOR_REFERENCE)) {
            const d = distanceSq(avg, ref);
            if (d < bestDist) {
              bestDist = d;
              best = name;
            }
          }
          resolve(best);
        } catch {
          resolve(null);
        }
      };
      img.src = dataUrl;
    } catch {
      resolve(null);
    }
  });
}
