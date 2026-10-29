import Link from "next/link";
import { Card, PageHeader } from "@/components/ui";
import { requireParent } from "@/lib/auth";
import { OUTFIT_COLORS } from "@/lib/format";
import { RoutineGrid } from "./routine-grid";

export default async function RoutinePage() {
  const { supabase } = await requireParent();
  const [{ data: children }, { data: outfits }, { data: routine }] = await Promise.all([
    supabase.from("children").select("id, name, class_name, color").order("sort"),
    supabase.from("outfits").select("id, name").order("sort").order("name"),
    supabase.from("weekly_routine").select("child_id, weekday, outfit_id"),
  ]);

  if (!children?.length) {
    return (
      <>
        <PageHeader title="Routine" />
        <Card>
          <p className="text-sm text-muted">
            Add the children first, then set each one&apos;s outfit for every day of the week.{" "}
            <Link href="/parent/settings#children" className="font-semibold text-primary hover:underline">
              Add children
            </Link>
          </p>
        </Card>
      </>
    );
  }

  return (
    <>
      <PageHeader title="Routine" subtitle="Tap a day to change the outfit. Hold it to pick one directly." />

      <div className="space-y-4">
        {children.map((child) => (
          <Card key={child.id}>
            <RoutineGrid
              child={child}
              outfits={outfits ?? []}
              initial={Object.fromEntries(
                (routine ?? []).filter((r) => r.child_id === child.id).map((r) => [r.weekday, r.outfit_id]),
              )}
            />
          </Card>
        ))}
      </div>

      <ul className="mt-5 flex flex-wrap gap-x-4 gap-y-2 text-sm text-muted">
        {(outfits ?? []).map((o, i) => (
          <li key={o.id} className="flex items-center gap-2">
            <span className="size-2.5 rounded-full" style={{ background: OUTFIT_COLORS[i % OUTFIT_COLORS.length] }} />
            {o.name}
          </li>
        ))}
        <li>
          <Link href="/parent/settings#outfits" className="font-semibold text-primary hover:underline">
            Edit outfits
          </Link>
        </li>
      </ul>
    </>
  );
}
