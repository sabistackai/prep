import type { ReactNode } from "react";
import { signOut } from "@/app/auth/actions";
import { PrepLogo } from "@/components/brand/prep-logo";
import { TabNav, type Tab } from "@/components/tab-nav";

export function AppShell({ who, tabs, children }: { who: string; tabs: Tab[]; children: ReactNode }) {
  return (
    <div className="mx-auto min-h-dvh max-w-2xl px-4 pb-24">
      <header className="flex items-center justify-between py-4">
        <PrepLogo size={24} />
        <form action={signOut} className="flex items-center gap-3 text-sm text-muted">
          <span className="font-semibold">{who}</span>
          <button type="submit" className="min-h-11 hover:text-text">
            Sign out
          </button>
        </form>
      </header>
      <main>{children}</main>
      <TabNav tabs={tabs} />
    </div>
  );
}
