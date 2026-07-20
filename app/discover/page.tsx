import Link from "next/link";
import {
  Heart,
  Sparkles,
  Palette,
  Scissors,
  BarChart3,
  Wand2,
  Luggage,
  User,
  ChevronRight,
} from "lucide-react";
import BottomNav from "@/components/BottomNav";

const CARDS = [
  {
    href: "/wishlist",
    icon: Heart,
    title: "Wishlist",
    blurb: "Check items before you buy them, links, screenshots, cart analysis.",
  },
  {
    href: "/pack",
    icon: Luggage,
    title: "Pack a trip",
    blurb: "One description, a full packing list and outfits.",
  },
  {
    href: "/manifest",
    icon: Wand2,
    title: "Manifest a look",
    blurb: "Dress for what you want to call in, love, confidence, prosperity.",
  },
  {
    href: "/style-profile",
    icon: Sparkles,
    title: "Style DNA",
    blurb: "Describe your style and save inspiration photos.",
  },
  {
    href: "/color",
    icon: Palette,
    title: "Color analysis",
    blurb: "Your seasonal palette, and which colors fit it.",
  },
  {
    href: "/hair",
    icon: Scissors,
    title: "Hair",
    blurb: "Selfie, wigs, or a description, feeds every hairstyle pick.",
  },
  {
    href: "/insights",
    icon: BarChart3,
    title: "Closet insights",
    blurb: "Real patterns and gaps in what you own.",
  },
  {
    href: "/cleanup",
    icon: User,
    title: "Cleanup pass",
    blurb: "Get suggestions for what to keep, donate, sell, or store.",
  },
];

export default function DiscoverPage() {
  return (
    <main className="min-h-screen pb-28 pt-safe bg-cream">
      <div className="max-w-md mx-auto px-4 pt-6 space-y-4">
        <div>
          <h1 className="text-xl font-semibold text-stone-800">Discover</h1>
          <p className="text-sm text-stone-500 mt-0.5">
            Everything about your style, in one place.
          </p>
        </div>

        <div className="space-y-2.5">
          {CARDS.map(({ href, icon: Icon, title, blurb }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-3 bg-white rounded-2xl p-4"
            >
              <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center shrink-0">
                <Icon size={18} className="text-emerald-700" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-stone-700">{title}</p>
                <p className="text-xs text-stone-400 mt-0.5">{blurb}</p>
              </div>
              <ChevronRight size={16} className="text-stone-300 shrink-0" />
            </Link>
          ))}
        </div>
      </div>

      <BottomNav />
    </main>
  );
}
