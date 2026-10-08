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
  Pink: [236, 112, 152],
  Rose: [190, 95, 115],
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

interface GarmentAnalysis {
  color: string | null;
  multicolor: boolean;
  // Share (0-1) of garment pixels belonging to the dominant color.
  dominantShare: number;
}

type RGB = [number, number, number];
type Lab = [number, number, number];

// sRGB -> CIELAB (D65). Distances in Lab track how different two colors
// actually look, which plain RGB distance does not: it treats a dark red
// and a dark olive as close, and a light pink and a light gray as close.
function rgbToLab([r8, g8, b8]: RGB): Lab {
  const lin = (c: number) => {
    const v = c / 255;
    return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  const r = lin(r8), g = lin(g8), b = lin(b8);
  const x = (r * 0.4124564 + g * 0.3575761 + b * 0.1804375) / 0.95047;
  const y = r * 0.2126729 + g * 0.7151522 + b * 0.072175;
  const z = (r * 0.0193339 + g * 0.119192 + b * 0.9503041) / 1.08883;
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const fx = f(x), fy = f(y), fz = f(z);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

const labDist = (a: Lab, b: Lab) =>
  Math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2);

const chromaOf = (lab: Lab) => Math.sqrt(lab[1] ** 2 + lab[2] ** 2);

const REF_LAB: [string, Lab][] = Object.entries(COLOR_REFERENCE).map(
  ([name, rgb]) => [name, rgbToLab(rgb)]
);

const NEUTRAL_NAMES = new Set(["Black", "Charcoal", "Gray", "Silver", "White", "Ivory", "Cream"]);

// Picks the closest named color for a garment color in Lab. Lightness is
// weighted down (lighting and shadow change it constantly, hue barely
// moves), and near-gray colors are only allowed to match neutral names,
// so a dim beige or a shaded white can't come out as Olive or Rose.
function nameForLab(lab: Lab): string | null {
  const [L, a, b] = lab;
  const chroma = chromaOf(lab);
  if (chroma < 11) {
    // Near-gray: name by lightness alone. Phone cameras expose for the
    // whole scene, so a white dress on a dark rug photographs as light
    // gray; anything clearly light is White, not Silver. A slight warm
    // tint on a light color reads as Ivory/Cream.
    if (L < 24) return "Black";
    if (L < 40) return "Charcoal";
    if (L < 66) return "Gray";
    if (b > 11) return L > 82 ? "Ivory" : "Cream";
    return "White";
  }
  let best: string | null = null;
  let bestScore = Infinity;
  for (const [name, ref] of REF_LAB) {
    const refNeutral = NEUTRAL_NAMES.has(name);
    if (chroma > 24 && refNeutral) continue;
    const dl = (L - ref[0]) * 0.55;
    const score = Math.sqrt(dl * dl + (a - ref[1]) ** 2 + (b - ref[2]) ** 2);
    if (score < bestScore) {
      bestScore = score;
      best = name;
    }
  }
  return best;
}

interface Cluster {
  weight: number;
  sum: Lab;
  centroid: Lab;
}

// Weighted greedy clustering in Lab: every pixel joins the nearest
// cluster within `threshold` (deltaE), otherwise starts a new one.
function clusterLab(pixels: { lab: Lab; w: number }[], threshold: number): Cluster[] {
  const clusters: Cluster[] = [];
  for (const { lab, w } of pixels) {
    let target: Cluster | null = null;
    let bestD = threshold;
    for (const c of clusters) {
      const d = labDist(lab, c.centroid);
      if (d <= bestD) {
        bestD = d;
        target = c;
      }
    }
    if (!target) {
      target = { weight: 0, sum: [0, 0, 0], centroid: lab };
      clusters.push(target);
    }
    target.weight += w;
    target.sum[0] += lab[0] * w;
    target.sum[1] += lab[1] * w;
    target.sum[2] += lab[2] * w;
    target.centroid = [
      target.sum[0] / target.weight,
      target.sum[1] / target.weight,
      target.sum[2] / target.weight,
    ];
  }
  return clusters.sort((a, b) => b.weight - a.weight);
}

function analyzePixelData(data: Uint8ClampedArray, size: number): GarmentAnalysis | null {
  const border = Math.max(2, Math.round(size * 0.1));
  const borderPx: { lab: Lab; w: number }[] = [];
  const inner: { lab: Lab; w: number }[] = [];
  const mid = (size - 1) / 2;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      if (data[i + 3] < 200) continue;
      const lab = rgbToLab([data[i], data[i + 1], data[i + 2]]);
      const isBorder = x < border || y < border || x >= size - border || y >= size - border;
      if (isBorder) {
        borderPx.push({ lab, w: 1 });
      } else {
        // Garments sit in the middle of the frame: pixels near the
        // center count more than ones near the edges.
        const dist = Math.hypot(x - mid, y - mid) / (mid * 1.414);
        inner.push({ lab, w: 1.2 - dist });
      }
    }
  }
  if (inner.length < 30) return null;

  // Background = the dominant colors along the border (a tile floor or
  // rug gives a few). Interior pixels close to one of them are dropped.
  const totalBorder = borderPx.length;
  const centerPx = inner.filter((_, idx) => {
    // inner is row-major minus the border ring, so recover coordinates
    // from the weight: weight is highest at the center.
    return inner[idx].w > 0.85;
  });
  let bgClusters = clusterLab(borderPx, 20)
    .filter((c) => c.weight >= Math.max(3, totalBorder * 0.07))
    .slice(0, 5);
  // A garment that touches the edge of the frame (a long dress, a tall
  // boot) puts its own color on the border too. The colors that make up
  // most of the border are always background; any smaller border color
  // that also fills a big part of the center is the garment, so keep it.
  let covered = 0;
  bgClusters = bgClusters.filter((c) => {
    const isCore = covered < totalBorder * 0.6;
    covered += c.weight;
    if (isCore || centerPx.length === 0) return true;
    const hits = centerPx.filter((p) => labDist(p.lab, c.centroid) <= 22).length;
    return hits / centerPx.length < 0.22;
  });
  let foreground = inner.filter(
    (p) => !bgClusters.some((c) => labDist(p.lab, c.centroid) <= 22)
  );
  // A white product-photo backdrop is only stripped when the border is
  // white; on a dark rug white is the garment.
  const whiteBackdrop = bgClusters.some((c) => c.centroid[0] > 92 && chromaOf(c.centroid) < 6);
  if (whiteBackdrop) foreground = foreground.filter((p) => p.lab[0] < 96);

  const innerWeight = inner.reduce((s, p) => s + p.w, 0);
  const fgWeight = foreground.reduce((s, p) => s + p.w, 0);
  // If subtracting the background removed nearly everything, the
  // garment matches its surroundings: use the whole interior instead.
  if (fgWeight < innerWeight * 0.07 || foreground.length < 25) foreground = inner;

  const clusters = clusterLab(foreground, 15);
  const total = clusters.reduce((s, c) => s + c.weight, 0);
  const top = clusters[0];
  if (!top || total === 0) return null;

  // Shading splits one fabric color into a lit and a shadowed cluster
  // with the same hue. Fold clusters that differ mostly in lightness
  // back into the dominant one before judging Multicolor.
  const sameFabric = (c: Cluster) => {
    const dChroma = labDist([0, c.centroid[1], c.centroid[2]], [0, top.centroid[1], top.centroid[2]]);
    // Dark neutrals vary a lot in lightness (black fabric next to its
    // own shadow on the floor) without being a second color.
    const bothNeutral = chromaOf(c.centroid) < 14 && chromaOf(top.centroid) < 14;
    return dChroma < 14 && Math.abs(c.centroid[0] - top.centroid[0]) < (bothNeutral ? 52 : 38);
  };
  const dominantWeight = clusters.filter(sameFabric).reduce((s, c) => s + c.weight, 0);
  const dominantShare = dominantWeight / total;

  const rival = clusters.find(
    (c) => !sameFabric(c) && c.weight / total >= 0.27 && labDist(c.centroid, top.centroid) > 38
  );
  const multicolor = Boolean(rival) && dominantShare < 0.72;

  // Name the color from the brightest-weighted core of the dominant
  // fabric, not an average that shadows have dragged darker.
  const core = clusters.filter(sameFabric);
  const coreWeight = core.reduce((s, c) => s + c.weight, 0);
  const coreLab: Lab = [0, 0, 0];
  for (const c of core) {
    coreLab[0] += c.centroid[0] * c.weight;
    coreLab[1] += c.centroid[1] * c.weight;
    coreLab[2] += c.centroid[2] * c.weight;
  }
  coreLab[0] /= coreWeight;
  coreLab[1] /= coreWeight;
  coreLab[2] /= coreWeight;

  return {
    color: multicolor ? "Multicolor" : nameForLab(coreLab),
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
          const SIZE = 72;
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
