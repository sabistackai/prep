import Link from "next/link";
import { PrepBoard } from "@/components/prep-board";
import { Card, Mono, PageHeader } from "@/components/ui";
import { requireNanny } from "@/lib/auth";
import { dayName, loadPrep } from "@/lib/prep";

export default async function NannyPrepPage() {
  const { supabase } = await requireNanny();
  const { overview, kids, items } = await loadPrep(supabase);
  const session = overview?.session;

  return (
    <>
      <PageHeader title={session ? `Prep for ${dayName(session.for_date)}` : "Tonight's prep"} />

      {session ? (
        <PrepBoard session={session} items={items} kids={kids} canTick />
      ) : (
        <Card>
          <p>
            {overview?.tomorrow ? `${overview.tomorrow}'s` : "Tomorrow's"} checklist arrives at{" "}
            <Mono>{overview?.release_time}</Mono>. It&apos;s due by <Mono>{overview?.deadline_time}</Mono>.
          </p>
          <p className="mt-3 text-sm text-muted">
            Make sure{" "}
            <Link href="/nanny/notifications" className="font-semibold text-primary hover:underline">
              notifications are on
            </Link>{" "}
            so you don&apos;t miss it.
          </p>
        </Card>
      )}
    </>
  );
}
