import type { ReactNode } from "react";
import { AppShell } from "@/components/app-shell";
import { requireNanny } from "@/lib/auth";

const tabs = [
  { href: "/nanny", label: "Prep" },
  { href: "/nanny/tasks", label: "Tasks" },
  { href: "/nanny/alerts", label: "Alerts" },
];

export default async function NannyLayout({ children }: { children: ReactNode }) {
  const { member } = await requireNanny();
  return (
    <AppShell who={member.display_name} tabs={tabs}>
      {children}
    </AppShell>
  );
}
