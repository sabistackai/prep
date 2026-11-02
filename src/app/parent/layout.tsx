import type { ReactNode } from "react";
import { AppShell } from "@/components/app-shell";
import { requireParent } from "@/lib/auth";

const tabs = [
  { href: "/parent", label: "Dashboard", also: ["/parent/week"] },
  { href: "/parent/schedule", label: "Schedule", also: ["/parent/activities"] },
  { href: "/parent/routine", label: "Outfits" },
  { href: "/parent/tasks", label: "Tasks" },
  { href: "/parent/settings", label: "Settings", also: ["/parent/care"] },
];

export default async function ParentLayout({ children }: { children: ReactNode }) {
  const { member } = await requireParent();
  return (
    <AppShell who={member.display_name} tabs={tabs}>
      {children}
    </AppShell>
  );
}
