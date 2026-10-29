"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export type Tab = { href: string; label: string };

// Bottom tab bar for phones; the root tab (e.g. /parent) only matches exactly.
// Active tab: primary text on a primary-soft pill (spec 7).
export function TabNav({ tabs }: { tabs: Tab[] }) {
  const path = usePathname();
  const root = tabs[0]?.href;

  return (
    <nav className="fixed inset-x-0 bottom-0 z-10 border-t border-border bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
      <ul className="mx-auto flex max-w-2xl px-2">
        {tabs.map((tab) => {
          const active = tab.href === root ? path === root : path.startsWith(tab.href);
          return (
            <li key={tab.href} className="flex-auto">
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className="flex min-h-14 items-center justify-center text-[13px] font-bold min-[360px]:text-sm"
              >
                <span
                  className={`rounded-full px-2 py-1.5 sm:px-4 ${
                    active ? "bg-primary-soft text-primary" : "text-muted hover:text-text"
                  }`}
                >
                  {tab.label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
