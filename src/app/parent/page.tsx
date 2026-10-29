import Link from "next/link";
import { Card, Mono, PageHeader } from "@/components/ui";
import { requireParent } from "@/lib/auth";
import { formatTime } from "@/lib/format";

export default async function TodayPage() {
  const { supabase } = await requireParent();
  const [{ data: household }, { count: children }, { data: nannies }, { count: activities }] = await Promise.all([
    supabase.from("households").select("name, prep_release_time, prep_deadline_time").single(),
    supabase.from("children").select("*", { count: "exact", head: true }),
    supabase.from("members").select("user_id").eq("role", "nanny"),
    supabase.from("activities").select("*", { count: "exact", head: true }),
  ]);

  const steps = [
    { done: (children ?? 0) > 0, label: "Add the children", href: "/parent/settings#children" },
    { done: true, label: "Check each child's week of outfits", href: "/parent/routine" },
    { done: (activities ?? 0) > 0, label: "Add weekend activities", href: "/parent/activities" },
    { done: (nannies ?? []).length > 0, label: "Add the nanny and send the setup link", href: "/parent/settings#nannies" },
    { done: (nannies ?? []).some((n) => n.user_id), label: "Nanny finishes setup on their phone", href: "/parent/settings#nannies" },
  ];
  const remaining = steps.filter((s) => !s.done).length;

  return (
    <>
      <PageHeader title={household?.name ?? "Today"} />

      <Card className="mb-4">
        <h2 className="font-semibold">Tonight&apos;s prep</h2>
        <p className="mt-1 text-sm text-muted">
          The nanny gets tomorrow&apos;s checklist at <Mono>{formatTime(household?.prep_release_time)}</Mono>, due by{" "}
          <Mono>{formatTime(household?.prep_deadline_time)}</Mono>. You&apos;ll see their progress here live.
        </p>
      </Card>

      {remaining > 0 && (
        <Card>
          <h2 className="font-semibold">Getting started</h2>
          <ul className="mt-3 space-y-1">
            {steps.map((s) => (
              <li key={s.label}>
                <Link href={s.href} className="flex min-h-11 items-center gap-3 text-sm">
                  <span
                    className={`grid size-5 place-items-center rounded-full border text-xs ${
                      s.done ? "border-lime bg-lime text-lime-ink" : "border-line"
                    }`}
                  >
                    {s.done ? "✓" : ""}
                  </span>
                  <span className={s.done ? "text-muted line-through" : ""}>{s.label}</span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </>
  );
}
