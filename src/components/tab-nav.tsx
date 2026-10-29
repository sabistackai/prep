"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export type Tab = { href: string; label: string };

// Bottom tab bar for phones; the root tab (e.g. /parent) only matches exactly.
export function TabNav({ tabs }: { tabs: Tab[] }) {
  const path = usePathname();
  const root = tabs[0]?.href;

  return (
    <nav className="fixed inset-x-0 bottom-0 z-10 border-t border-line bg-canvas/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
      <ul className="mx-auto flex max-w-2xl">
        {tabs.map((tab) => {
          const active = tab.href === root ? path === root : path.startsWith(tab.href);
          return (
            <li key={tab.href} className="flex-1">
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-14 items-center justify-center text-sm font-semibold ${
                  active ? "text-lime" : "text-muted hover:text-ink"
                }`}
              >
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
