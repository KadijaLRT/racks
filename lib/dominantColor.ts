// Extracts a Color tag directly from image pixels, entirely locally,
// zero AI, zero network call. Downsamples to a small canvas, averages
// the garment's pixels, and maps the resulting RGB to whichever
// COLOR_OPTIONS entry is closest by Euclidean distance. Real closet
// photos are taken on floors, rugs and beds, so the background is
// estimated from the image border and removed first; otherwise a black
// boot on a beige tile floor reads as "two colors" and everything came
// out Multicolor. Pixels left over are grouped into color clusters, and
// only a garment with two or more large, clearly different clusters is
// called Multicolor.

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

interface GarmentAnalysis {
  color: string | null;
  multicolor: boolean;
  // Share (0-1) of garment pixels belonging to the dominant color.
  dominantShare: number;
}

type RGB = [number, number, number];

function nearestColorName(rgb: RGB): string | null {
  let best: string | null = null;
  let bestDist = Infinity;
  for (const [name, ref] of Object.entries(COLOR_REFERENCE)) {
    const d = distanceSq(rgb, ref);
    if (d < bestDist) {
      bestDist = d;
      best = name;
    }
  }
  return best;
}

// Greedy clustering: each pixel joins the first cluster whose running
// centroid is within `threshold`, otherwise starts a new one. Cheap and
// good enough for a 56x56 sample.
function clusterPixels(pixels: RGB[], threshold: number) {
  const limitSq = threshold * threshold;
  const clusters: { sum: RGB; count: number; centroid: RGB }[] = [];
  for (const px of pixels) {
    let target = clusters.find((c) => distanceSq(px, c.centroid) <= limitSq);
    if (!target) {
      target = { sum: [0, 0, 0], count: 0, centroid: px };
      clusters.push(target);
    }
    target.sum[0] += px[0];
    target.sum[1] += px[1];
    target.sum[2] += px[2];
    target.count += 1;
    target.centroid = [
      target.sum[0] / target.count,
      target.sum[1] / target.count,
      target.sum[2] / target.count,
    ];
  }
  return clusters.sort((a, b) => b.count - a.count);
}

function analyzePixelData(data: Uint8ClampedArray, size: number): GarmentAnalysis | null {
  const border = Math.max(2, Math.round(size * 0.1));
  const borderPixels: RGB[] = [];
  const innerPixels: RGB[] = [];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      if (data[i + 3] < 200) continue;
      const px: RGB = [data[i], data[i + 1], data[i + 2]];
      const isBorder = x < border || y < border || x >= size - border || y >= size - border;
      (isBorder ? borderPixels : innerPixels).push(px);
    }
  }
  if (innerPixels.length < 30) return null;

  // Background = the dominant colors along the border (a tile floor or
  // rug gives a couple of them). Anything in the interior that is close
  // to one of those is treated as background, not garment.
  const bgClusters = clusterPixels(borderPixels, 45)
    .filter((c) => c.count >= Math.max(3, borderPixels.length * 0.08))
    .slice(0, 4);
  const bgLimitSq = 55 * 55;
  let foreground = innerPixels.filter(
    (px) => !bgClusters.some((c) => distanceSq(px, c.centroid) <= bgLimitSq)
  );
  // Near-white pixels are only treated as background when the border
  // itself is white (a product photo). On a dark rug, white is the
  // garment, and stripping it turned a white dress gray.
  const whiteBackdrop = bgClusters.some(
    (c) => c.centroid[0] > 225 && c.centroid[1] > 225 && c.centroid[2] > 225
  );
  if (whiteBackdrop) {
    foreground = foreground.filter((px) => !(px[0] > 240 && px[1] > 240 && px[2] > 240));
  }

  // If subtracting the background left almost nothing (garment is the
  // same color as its surroundings), fall back to the whole interior
  // rather than guessing from a handful of pixels.
  if (foreground.length < innerPixels.length * 0.06 || foreground.length < 25) {
    foreground = innerPixels;
  }

  const clusters = clusterPixels(foreground, 60);
  const total = foreground.length;
  const top = clusters[0];
  if (!top) return null;
  const dominantShare = top.count / total;

  // Multicolor needs two large clusters that are genuinely far apart
  // (not just a lit and shaded side of the same fabric).
  const second = clusters.find(
    (c) => c !== top && c.count / total >= 0.28 && distanceSq(c.centroid, top.centroid) > 120 * 120
  );
  const multicolor = Boolean(second) && dominantShare < 0.7;

  return {
    color: multicolor ? "Multicolor" : nearestColorName(top.centroid),
    multicolor,
    dominantShare,
  };
}

function analyzeGarmentImage(dataUrl: string): Promise<GarmentAnalysis | null> {
  return new Promise((resolve) => {
    try {
      const img = new Image();
      img.onerror = () => resolve(null);
      img.onload = () => {
        try {
          const SIZE = 56;
          const canvas = document.createElement("canvas");
          canvas.width = SIZE;
          canvas.height = SIZE;
          const ctx = canvas.getContext("2d");
          if (!ctx) {
            resolve(null);
            return;
          }
          ctx.drawImage(img, 0, 0, SIZE, SIZE);
          const { data } = ctx.getImageData(0, 0, SIZE, SIZE);
          resolve(analyzePixelData(data, SIZE));
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

/**
 * Returns the closest matching color name from COLOR_OPTIONS for the
 * garment (background removed), "Multicolor" only when the garment
 * itself has two or more large, clearly different colors, or null if
 * extraction fails (callers should then leave Color unset).
 */
export async function extractDominantColorTag(dataUrl: string): Promise<string | null> {
  const result = await analyzeGarmentImage(dataUrl);
  return result?.color ?? null;
}

/**
 * True only when one color clearly dominates the garment (so a
 * "Solid" pattern tag is safe), false when it doesn't, null if
 * extraction fails. Which specific pattern something is (striped vs.
 * floral vs. plaid) can't be told from pixels, only that it probably
 * isn't a single flat color.
 */
export async function isLikelySolidColor(dataUrl: string): Promise<boolean | null> {
  const result = await analyzeGarmentImage(dataUrl);
  if (!result) return null;
  return !result.multicolor && result.dominantShare >= 0.8;
}
