import type { ReactNode } from "react";
import { AppShell } from "@/components/app-shell";
import { requireParent } from "@/lib/auth";

const tabs = [
  { href: "/parent", label: "Today" },
  { href: "/parent/routine", label: "Routine" },
  { href: "/parent/activities", label: "Activities" },
  { href: "/parent/tasks", label: "Tasks" },
  { href: "/parent/settings", label: "Settings" },
];

export default async function ParentLayout({ children }: { children: ReactNode }) {
  const { member } = await requireParent();
  return (
    <AppShell who={member.display_name} tabs={tabs}>
      {children}
    </AppShell>
  );
}
