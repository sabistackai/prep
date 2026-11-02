"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// `also`: other paths that belong to this tab (e.g. Activities under Schedule).
export type Tab = { href: string; label: string; also?: string[] };

const matches = (path: string, href: string) => path === href || path.startsWith(`${href}/`);

// Bottom tab bar for phones. The tab with the longest matching path is active, so
// /nanny/today lights up Today, not the /nanny tab.
// Active tab: primary text on a primary-soft pill (spec 7).
export function TabNav({ tabs }: { tabs: Tab[] }) {
  const path = usePathname();
  let active: string | null = null;
  let best = -1;
  for (const tab of tabs) {
    for (const href of [tab.href, ...(tab.also ?? [])]) {
      if (matches(path, href) && href.length > best) {
        best = href.length;
        active = tab.href;
      }
    }
  }

  return (
    <nav className="fixed inset-x-0 bottom-0 z-10 border-t border-border bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
      <ul className="mx-auto flex max-w-2xl px-2">
        {tabs.map((tab) => {
          const isActive = tab.href === active;
          return (
            <li key={tab.href} className="flex-auto">
              <Link
                href={tab.href}
                aria-current={isActive ? "page" : undefined}
                className="flex min-h-14 items-center justify-center text-[13px] font-bold min-[360px]:text-sm"
              >
                <span
                  className={`rounded-full px-2 py-1.5 sm:px-4 ${
                    isActive ? "bg-primary-soft text-primary" : "text-muted hover:text-text"
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
