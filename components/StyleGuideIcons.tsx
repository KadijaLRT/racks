// Original simplified line-art diagrams for the neckline, silhouette,
// sleeve, and back-style quick-pick options. These are schematic
// reference icons (not fashion photography or reproductions of any
// existing chart) — same spirit as a simple how-to diagram, drawn from
// scratch as basic geometric shapes so a person can see roughly what
// each term means without leaving the item editor.

import type { SVGProps, ReactElement } from "react";

const STROKE = "currentColor";

function Svg({ children, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 100 100"
      fill="none"
      stroke={STROKE}
      strokeWidth={3}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      {children}
    </svg>
  );
}

// Small reference head, shared by every neckline icon so the neckline
// curve reads clearly relative to the neck/shoulders.
function Head() {
  return <circle cx={50} cy={14} r={9} />;
}

// --- Necklines -----------------------------------------------------
// Each draws Head() plus a torso outline whose TOP edge (the neckline
// itself) is the only thing that changes between styles. Left shoulder
// point (18,42), right shoulder point (82,42) stay fixed so the shapes
// stay visually comparable.

const NECKLINE_PATHS: Record<string, (props: SVGProps<SVGSVGElement>) => ReactElement> = {
  "Crew Neck": (p) => (
    <Svg {...p}>
      <Head />
      <path d="M18,42 Q50,54 82,42 L85,95 L15,95 Z" />
    </Svg>
  ),
  "V-Neck": (p) => (
    <Svg {...p}>
      <Head />
      <path d="M18,42 L50,74 L82,42 L85,95 L15,95 Z" />
    </Svg>
  ),
  "Scoop Neck": (p) => (
    <Svg {...p}>
      <Head />
      <path d="M18,42 Q50,82 82,42 L85,95 L15,95 Z" />
    </Svg>
  ),
  "Square Neck": (p) => (
    <Svg {...p}>
      <Head />
      <path d="M18,42 L18,58 L82,58 L82,42 L85,95 L15,95 Z" />
    </Svg>
  ),
  Sweetheart: (p) => (
    <Svg {...p}>
      <Head />
      <path d="M18,42 Q32,60 50,50 Q68,60 82,42 L85,95 L15,95 Z" />
    </Svg>
  ),
  Boatneck: (p) => (
    <Svg {...p}>
      <Head />
      <path d="M15,44 L85,44 L85,95 L15,95 Z" />
    </Svg>
  ),
  "Cowl Neck": (p) => (
    <Svg {...p}>
      <Head />
      <path d="M18,42 Q28,54 38,50 Q50,62 62,50 Q72,54 82,42 L85,95 L15,95 Z" />
    </Svg>
  ),
  Halter: (p) => (
    <Svg {...p}>
      <Head />
      <path d="M36,20 L50,44 L64,20" />
      <path d="M15,58 L50,44 L85,58 L85,95 L15,95 Z" />
    </Svg>
  ),
  "Off-the-Shoulder": (p) => (
    <Svg {...p}>
      <Head />
      <path d="M14,58 L86,58 L85,95 L15,95 Z" />
      <path d="M14,58 Q12,40 22,36" />
      <path d="M86,58 Q88,40 78,36" />
    </Svg>
  ),
  "One-Shoulder": (p) => (
    <Svg {...p}>
      <Head />
      <path d="M18,38 L82,60 L85,95 L15,95 Z" />
    </Svg>
  ),
  "Mock Neck": (p) => (
    <Svg {...p}>
      <Head />
      <path d="M36,42 L36,28 L64,28 L64,42 L85,95 L15,95 Z" />
    </Svg>
  ),
  Turtleneck: (p) => (
    <Svg {...p}>
      <Head />
      <path d="M33,42 L33,14 L67,14 L67,42 L85,95 L15,95 Z" />
    </Svg>
  ),
  "Queen Anne": (p) => (
    <Svg {...p}>
      <Head />
      <path d="M20,42 L20,24 Q50,17 80,24 L80,42" />
      <path d="M34,42 Q50,56 66,42 L85,95 L15,95 Z" />
    </Svg>
  ),
  Keyhole: (p) => (
    <Svg {...p}>
      <Head />
      <path d="M18,42 Q50,54 82,42 L85,95 L15,95 Z" />
      <circle cx={50} cy={58} r={5} />
    </Svg>
  ),
  Plunging: (p) => (
    <Svg {...p}>
      <Head />
      <path d="M18,42 L50,88 L82,42 L85,95 L15,95 Z" />
    </Svg>
  ),
  Illusion: (p) => (
    <Svg {...p}>
      <Head />
      <path d="M18,42 Q32,60 50,50 Q68,60 82,42 L85,95 L15,95 Z" />
      <path
        d="M25,42 L45,50 M35,42 L55,52 M45,42 L65,50 M55,42 L75,44"
        strokeWidth={1.5}
        opacity={0.55}
      />
    </Svg>
  ),
  Surplice: (p) => (
    <Svg {...p}>
      <Head />
      <path d="M18,42 L58,78 L50,50 L82,42 L85,95 L15,95 Z" />
    </Svg>
  ),
  "Button-Up": (p) => (
    <Svg {...p}>
      <Head />
      <path d="M18,42 L30,34 L38,42 M82,42 L70,34 L62,42" />
      <path d="M30,34 L38,42 L85,95 L15,95 L62,42 L70,34" />
      <circle cx={50} cy={52} r={1.6} fill={STROKE} />
      <circle cx={50} cy={64} r={1.6} fill={STROKE} />
      <circle cx={50} cy={76} r={1.6} fill={STROKE} />
    </Svg>
  ),
  "Zip-Up": (p) => (
    <Svg {...p}>
      <Head />
      <path d="M18,42 Q50,54 82,42 L85,95 L15,95 Z" />
      <path d="M50,50 L50,90" strokeWidth={2} />
      <rect x={47} y={50} width={6} height={4} fill={STROKE} />
    </Svg>
  ),
  "Tie Neck": (p) => (
    <Svg {...p}>
      <Head />
      <path d="M18,42 Q50,54 82,42 L85,95 L15,95 Z" />
      <path d="M42,44 Q50,58 40,68 M58,44 Q50,58 60,68" strokeWidth={2} />
      <circle cx={44} cy={56} r={3} opacity={0.4} strokeWidth={1.5} />
    </Svg>
  ),
};

export function NecklineIcon({
  type,
  ...props
}: { type: string } & SVGProps<SVGSVGElement>) {
  const render = NECKLINE_PATHS[type];
  if (!render) return null;
  return render(props);
}

// --- Silhouette / hem ------------------------------------------------
// Each draws a simple garment block whose overall shape/hem is the
// distinguishing feature, viewed as a flat torso block, not a neckline.

const SILHOUETTE_PATHS: Record<string, (props: SVGProps<SVGSVGElement>) => ReactElement> = {
  "Crop Top": (p) => (
    <Svg {...p}>
      <path d="M22,18 L78,18 L74,55 L26,55 Z" />
    </Svg>
  ),
  Peplum: (p) => (
    <Svg {...p}>
      <path d="M28,18 L72,18 L68,58 L88,85 L12,85 L32,58 Z" />
    </Svg>
  ),
  Wrap: (p) => (
    <Svg {...p}>
      <path d="M22,18 L78,18 L74,88 L26,88 Z" />
      <path d="M28,18 L68,60 M72,18 L60,80" strokeWidth={2} />
    </Svg>
  ),
  "Asymmetrical Hem": (p) => (
    <Svg {...p}>
      <path d="M22,18 L78,18 L84,70 L18,90 Z" />
    </Svg>
  ),
  "Handkerchief Hem": (p) => (
    <Svg {...p}>
      <path d="M22,18 L78,18 L78,60 L64,85 L50,62 L36,85 L22,60 Z" />
    </Svg>
  ),
  "Lettuce Hem": (p) => (
    <Svg {...p}>
      <path d="M22,18 L78,18 L78,75 Q70,82 62,75 Q54,82 46,75 Q38,82 30,75 Q24,80 22,75 Z" />
    </Svg>
  ),
  "Hi-Low": (p) => (
    <Svg {...p}>
      <path d="M22,18 L78,18 L82,90 Q50,78 18,90 Z" />
    </Svg>
  ),
  "Boxy / Oversized": (p) => (
    <Svg {...p}>
      <path d="M14,20 L86,20 L86,85 L14,85 Z" />
    </Svg>
  ),
  "Corset / Bustier": (p) => (
    <Svg {...p}>
      <path d="M28,18 L72,18 L66,55 L70,85 L30,85 L34,55 Z" />
      <path
        d="M32,28 L68,28 M31,38 L69,38 M32,48 L68,48"
        strokeWidth={1.5}
        opacity={0.6}
      />
    </Svg>
  ),
  Camisole: (p) => (
    <Svg {...p}>
      <path d="M40,14 L40,22 M60,14 L60,22" />
      <path d="M32,22 L68,22 L64,85 L36,85 Z" />
    </Svg>
  ),
  "Tube / Strapless": (p) => (
    <Svg {...p}>
      <path d="M26,24 L74,24 L70,85 L30,85 Z" />
    </Svg>
  ),
  "Smocked / Shirred": (p) => (
    <Svg {...p}>
      <path d="M26,20 L74,20 L70,85 L30,85 Z" />
      <path
        d="M30,30 Q40,26 50,30 Q60,34 70,30 M29,42 Q40,38 50,42 Q60,46 71,42 M29,54 Q40,50 50,54 Q60,58 71,54"
        strokeWidth={1.5}
        opacity={0.6}
      />
    </Svg>
  ),
  Ruched: (p) => (
    <Svg {...p}>
      <path d="M26,20 L74,20 L70,85 L30,85 Z" />
      <path
        d="M32,24 L62,50 M30,38 L64,62 M30,54 L60,76"
        strokeWidth={1.5}
        opacity={0.6}
      />
    </Svg>
  ),
  Bodysuit: (p) => (
    <Svg {...p}>
      <path d="M28,18 L72,18 L68,60 L82,90 L60,90 L50,68 L40,90 L18,90 L32,60 Z" />
    </Svg>
  ),
};

export function SilhouetteIcon({
  type,
  ...props
}: { type: string } & SVGProps<SVGSVGElement>) {
  const render = SILHOUETTE_PATHS[type];
  if (!render) return null;
  return render(props);
}

// --- Sleeve length -----------------------------------------------------
// A single shoulder + arm outline, varying only where the sleeve ends.

function ArmBase({ sleeveEndY, strap }: { sleeveEndY: number | null; strap?: boolean }) {
  return (
    <>
      <path d="M35,15 L65,15 L70,40 L55,40 L58,90 L42,90 L45,40 L30,40 Z" />
      {sleeveEndY !== null ? (
        <path
          d={`M70,40 L${82},${sleeveEndY} L${64},${sleeveEndY + 4} L55,40`}
        />
      ) : null}
      {strap ? <path d="M40,15 L40,5 M60,15 L60,5" /> : null}
    </>
  );
}

const SLEEVE_LENGTH_RENDER: Record<string, (p: SVGProps<SVGSVGElement>) => ReactElement> = {
  Sleeveless: (p) => (
    <Svg {...p}>
      <path d="M35,15 L65,15 L58,90 L42,90 Z" />
    </Svg>
  ),
  "Spaghetti Strap": (p) => (
    <Svg {...p}>
      <path d="M42,15 L58,15 L55,90 L45,90 Z" />
      <path d="M45,15 L45,4 M55,15 L55,4" strokeWidth={2} />
    </Svg>
  ),
  "Cap Sleeve": (p) => (
    <Svg {...p}>
      <ArmBase sleeveEndY={44} />
    </Svg>
  ),
  "Short Sleeve": (p) => (
    <Svg {...p}>
      <ArmBase sleeveEndY={55} />
    </Svg>
  ),
  "Elbow-Length": (p) => (
    <Svg {...p}>
      <ArmBase sleeveEndY={65} />
    </Svg>
  ),
  "Three-Quarter Sleeve": (p) => (
    <Svg {...p}>
      <ArmBase sleeveEndY={78} />
    </Svg>
  ),
  "Long Sleeve": (p) => (
    <Svg {...p}>
      <ArmBase sleeveEndY={92} />
    </Svg>
  ),
};

export function SleeveLengthIcon({
  type,
  ...props
}: { type: string } & SVGProps<SVGSVGElement>) {
  const render = SLEEVE_LENGTH_RENDER[type];
  if (!render) return null;
  return render(props);
}

// --- Sleeve style (construction) ---------------------------------------

const SLEEVE_STYLE_RENDER: Record<string, (p: SVGProps<SVGSVGElement>) => ReactElement> = {
  Dolman: (p) => (
    <Svg {...p}>
      <path d="M35,15 L65,15 L90,55 L70,62 L58,40 L58,90 L42,90 L42,40 L30,62 L10,55 Z" />
    </Svg>
  ),
  Raglan: (p) => (
    <Svg {...p}>
      <path d="M35,15 L65,15 L70,40 L55,40 L58,90 L42,90 L45,40 L30,40 Z" />
      <path d="M50,12 L70,40 M50,12 L30,40" strokeWidth={1.5} opacity={0.6} />
    </Svg>
  ),
  "Kimono Sleeve": (p) => (
    <Svg {...p}>
      <path d="M35,15 L65,15 L92,48 L92,58 L60,45 L58,90 L42,90 L40,45 L8,58 L8,48 Z" />
    </Svg>
  ),
  "Puff / Juliet": (p) => (
    <Svg {...p}>
      <path d="M35,15 L65,15 Q85,25 72,48 Q58,42 55,40 L58,90 L42,90 L45,40 Q42,42 28,48 Q15,25 35,15 Z" />
    </Svg>
  ),
  "Balloon Sleeve": (p) => (
    <Svg {...p}>
      <path d="M35,15 L65,15 L70,40 Q88,55 68,70 L60,64 L58,90 L42,90 L40,64 L32,70 Q12,55 30,40 Z" />
    </Svg>
  ),
  "Lantern Sleeve": (p) => (
    <Svg {...p}>
      <path d="M35,15 L65,15 L70,38 Q84,50 70,60 Q84,68 68,80 L58,90 L42,90 L32,80 Q16,68 30,60 Q16,50 30,38 Z" />
    </Svg>
  ),
  Bishop: (p) => (
    <Svg {...p}>
      <path d="M35,15 L65,15 L74,40 Q86,70 66,84 L60,78 L60,88 L40,88 L40,78 L34,84 Q14,70 26,40 Z" />
    </Svg>
  ),
  "Bell Sleeve": (p) => (
    <Svg {...p}>
      <path d="M35,15 L65,15 L68,45 Q90,75 74,90 L58,90 L56,45 L44,45 L42,90 L26,90 Q10,75 32,45 Z" />
    </Svg>
  ),
  "Trumpet Sleeve": (p) => (
    <Svg {...p}>
      <path d="M35,15 L65,15 L67,35 Q92,68 76,90 L56,90 L54,35 L46,35 L44,90 L24,90 Q8,68 33,35 Z" />
    </Svg>
  ),
  "Flutter Sleeve": (p) => (
    <Svg {...p}>
      <path d="M35,15 L65,15 Q92,30 70,46 Q60,38 55,40 L58,60 L42,60 L45,40 Q40,38 30,46 Q8,30 35,15 Z" />
    </Svg>
  ),
  "Petal Sleeve": (p) => (
    <Svg {...p}>
      <path d="M35,15 L50,15 Q70,25 60,48 L50,38 Z" />
      <path d="M65,15 L50,15 Q30,25 40,48 L50,38 Z" />
      <path d="M50,38 L48,90 L52,90 Z" />
    </Svg>
  ),
  Butterfly: (p) => (
    <Svg {...p}>
      <path d="M35,15 L65,15 Q95,26 65,44 Q58,36 55,40 L58,58 L42,58 L45,40 Q42,36 35,44 Q5,26 35,15 Z" />
    </Svg>
  ),
  "Leg-of-Mutton": (p) => (
    <Svg {...p}>
      <path d="M32,15 L68,15 Q94,32 72,52 Q60,42 58,44 L58,90 L42,90 L42,44 Q40,42 28,52 Q6,32 32,15 Z" />
    </Svg>
  ),
  "Peasant Sleeve": (p) => (
    <Svg {...p}>
      <path d="M35,15 L65,15 Q86,26 72,42 Q66,60 70,76 Q60,80 58,72 L55,40 L45,40 L42,72 Q40,80 30,76 Q34,60 28,42 Q14,26 35,15 Z" />
    </Svg>
  ),
  "Cape Sleeve": (p) => (
    <Svg {...p}>
      <path d="M35,15 L65,15 L94,58 L84,62 L58,32 L58,90 L42,90 L42,32 L16,62 L6,58 Z" />
    </Svg>
  ),
  "Cold-Shoulder": (p) => (
    <Svg {...p}>
      <path d="M35,15 L65,15 L70,40 L60,40 M40,40 L30,40 L45,40" />
      <circle cx={50} cy={40} r={7} />
      <path d="M70,40 L82,55 L64,60 L58,44 M30,40 L18,55 L36,60 L42,44" />
      <path d="M58,44 L58,90 L42,90 L42,44" />
    </Svg>
  ),
};

export function SleeveStyleIcon({
  type,
  ...props
}: { type: string } & SVGProps<SVGSVGElement>) {
  const render = SLEEVE_STYLE_RENDER[type];
  if (!render) return null;
  return render(props);
}

// --- Back style ----------------------------------------------------
// Back-view torso outline (mirrored trapezoid), with the distinguishing
// back detail drawn in the open/cutout area.

const BACK_STYLE_RENDER: Record<string, (p: SVGProps<SVGSVGElement>) => ReactElement> = {
  Racerback: (p) => (
    <Svg {...p}>
      <path d="M20,20 L38,20 L50,45 L62,20 L80,20 L74,90 L26,90 Z" />
    </Svg>
  ),
  "Backless / Open-Back": (p) => (
    <Svg {...p}>
      <path d="M20,20 L80,20 L78,32 Q50,45 22,32 Z" />
      <path d="M22,32 Q50,45 78,32 L74,90 L26,90 Z" opacity={0.35} strokeWidth={1.5} />
    </Svg>
  ),
  "Keyhole Back": (p) => (
    <Svg {...p}>
      <path d="M20,20 L80,20 L74,90 L26,90 Z" />
      <circle cx={50} cy={32} r={7} />
      <path d="M50,39 L50,44" strokeWidth={2} />
    </Svg>
  ),
  "Side Cut-Out": (p) => (
    <Svg {...p}>
      <path d="M20,20 L80,20 L76,50 L82,58 L74,90 L26,90 L18,58 L24,50 Z" />
      <path d="M20,45 L24,50 L18,58 M80,45 L76,50 L82,58" opacity={0.4} strokeWidth={1.5} />
    </Svg>
  ),
  "Caged Back": (p) => (
    <Svg {...p}>
      <path d="M20,20 L38,20 L38,90 M62,20 L80,20 L62,90" />
      <path
        d="M38,30 L62,45 M38,45 L62,60 M38,60 L62,75 M62,30 L38,45 M62,45 L38,60 M62,60 L38,75"
        strokeWidth={1.5}
      />
    </Svg>
  ),
  "Low V-Back": (p) => (
    <Svg {...p}>
      <path d="M20,20 L80,20 L78,30 L50,58 L22,30 Z" />
      <path d="M22,30 L50,58 L78,30 L74,90 L26,90 Z" opacity={0.35} strokeWidth={1.5} />
    </Svg>
  ),
  "Cross-Back": (p) => (
    <Svg {...p}>
      <path d="M20,20 L80,20 L74,90 L26,90 Z" opacity={0.35} strokeWidth={1.5} />
      <path d="M24,22 L76,88 M76,22 L24,88" strokeWidth={2.5} />
    </Svg>
  ),
  "Lace-Up Back": (p) => (
    <Svg {...p}>
      <path d="M20,20 L38,20 L38,90 M62,20 L80,20 L62,90" />
      <path
        d="M38,30 L62,34 M38,42 L62,38 M38,50 L62,54 M38,62 L62,58 M38,70 L62,74 M38,82 L62,78"
        strokeWidth={1.5}
      />
    </Svg>
  ),
  "Zip Back": (p) => (
    <Svg {...p}>
      <path d="M20,20 L80,20 L74,90 L26,90 Z" />
      <path d="M50,22 L50,88" strokeWidth={2} />
      <rect x={47} y={40} width={6} height={4} fill={STROKE} />
    </Svg>
  ),
  "Button Back": (p) => (
    <Svg {...p}>
      <path d="M20,20 L80,20 L74,90 L26,90 Z" />
      <circle cx={50} cy={30} r={1.6} fill={STROKE} />
      <circle cx={50} cy={42} r={1.6} fill={STROKE} />
      <circle cx={50} cy={54} r={1.6} fill={STROKE} />
      <circle cx={50} cy={66} r={1.6} fill={STROKE} />
      <circle cx={50} cy={78} r={1.6} fill={STROKE} />
    </Svg>
  ),
};

export function BackStyleIcon({
  type,
  ...props
}: { type: string } & SVGProps<SVGSVGElement>) {
  const render = BACK_STYLE_RENDER[type];
  if (!render) return null;
  return render(props);
}
