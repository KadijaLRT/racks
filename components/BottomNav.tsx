"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Shirt, Sparkles, Compass, User } from "lucide-react";

const CORE_TABS = [
  { href: "/", label: "Home", icon: Home },
  { href: "/closet", label: "Closet", icon: Shirt },
  { href: "/looks", label: "Looks", icon: Sparkles },
  { href: "/discover", label: "Discover", icon: Compass },
  { href: "/profile", label: "Profile", icon: User },
];

export default function BottomNav() {
  const pathname = usePathname() || "";

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-cream/95 backdrop-blur border-t border-clay-100 pb-safe">
      <div className="max-w-md mx-auto flex justify-around px-2 py-2">
        {(CORE_TABS || []).map(({ href, label, icon: Icon }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className="flex flex-col items-center gap-1 px-4 py-1.5 rounded-xl min-w-[64px]"
            >
              <Icon
                size={22}
                strokeWidth={active ? 2.4 : 1.8}
                className={active ? "text-emerald-600" : "text-stone-400"}
              />
              <span
                className={`text-[11px] ${
                  active ? "text-emerald-700 font-medium" : "text-stone-400"
                }`}
              >
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
