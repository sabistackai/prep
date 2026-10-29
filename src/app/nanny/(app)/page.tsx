import Link from "next/link";
import { LiveRefresh } from "@/components/live-refresh";
import { NannyTask } from "@/components/nanny-task";
import { PrepBoard } from "@/components/prep-board";
import { Card, labelClass, Mono, PageHeader } from "@/components/ui";
import { requireNanny } from "@/lib/auth";
import { dayName, loadPrep } from "@/lib/prep";
import { loadTasks } from "@/lib/tasks";

// Home: tonight's prep, then open tasks, so nothing depends only on a push arriving.
export default async function NannyPrepPage() {
  const { supabase } = await requireNanny();
  const [{ overview, kids, items }, tasks] = await Promise.all([loadPrep(supabase), loadTasks(supabase, 0)]);
  const session = overview?.session;

  return (
    <>
      <LiveRefresh tables={["tasks"]} />
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

      {tasks.open.length > 0 && (
        <section className="mt-6">
          <h2 className={`mb-2 ${labelClass}`}>Tasks</h2>
          <div className="space-y-2">
            {tasks.open.map((t) => (
              <NannyTask key={t.id} task={t} from={tasks.name(t.created_by)} />
            ))}
          </div>
        </section>
      )}
    </>
  );
}
