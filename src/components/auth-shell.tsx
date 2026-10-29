import type { ReactNode } from "react";
import { PrepLogo } from "@/components/brand/prep-logo";
import { ForgetOffline } from "@/components/forget-offline";

export function AuthShell({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center px-4 py-10">
      <ForgetOffline />
      <div className="mb-10">
        <PrepLogo size={40} tagline />
      </div>
      <h1 className="font-display text-3xl font-semibold tracking-tight">{title}</h1>
      {subtitle && <p className="mt-2 text-sm text-muted">{subtitle}</p>}
      <div className="mt-8">{children}</div>
    </main>
  );
}
