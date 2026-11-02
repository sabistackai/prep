import Link from "next/link";

// Daily care and Activities share the Schedule tab.
export function ScheduleNav({ active }: { active: "care" | "activities" }) {
  const base = "flex min-h-11 flex-1 items-center justify-center rounded-full text-sm font-bold";
  return (
    <nav className="mb-5 flex gap-1 rounded-full border border-border bg-surface p-1" aria-label="Schedule">
      <Link href="/parent/schedule" aria-current={active === "care" ? "page" : undefined}
        className={`${base} ${active === "care" ? "bg-primary-soft text-primary" : "text-muted hover:text-text"}`}>
        Daily care
      </Link>
      <Link href="/parent/activities" aria-current={active === "activities" ? "page" : undefined}
        className={`${base} ${active === "activities" ? "bg-primary-soft text-primary" : "text-muted hover:text-text"}`}>
        Activities
      </Link>
    </nav>
  );
}
