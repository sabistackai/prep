import { LiveRefresh } from "@/components/live-refresh";
import { NannyTask } from "@/components/nanny-task";
import { TaskCard } from "@/components/task-card";
import { Card, labelClass, PageHeader } from "@/components/ui";
import { requireNanny } from "@/lib/auth";
import { formatDue } from "@/lib/format";
import { loadTasks } from "@/lib/tasks";

export default async function NannyTasksPage() {
  const { supabase } = await requireNanny();
  const { open, done, name } = await loadTasks(supabase, 7);

  return (
    <>
      <LiveRefresh tables={["tasks"]} />
      <PageHeader title="Tasks" />
      <div className="mb-6 space-y-2">
        {open.map((t) => (
          <NannyTask key={t.id} task={t} from={name(t.created_by)} />
        ))}
        {!open.length && (
          <Card>
            <p className="text-muted">No tasks right now. New tasks will show up here.</p>
          </Card>
        )}
      </div>

      {!!done.length && (
        <>
          <h2 className={`mb-2 ${labelClass}`}>Done this week</h2>
          <div className="space-y-2">
            {done.map((t) => (
              <TaskCard key={t.id} task={t} meta={`✓ Done ${formatDue(t.done_at!)}`} />
            ))}
          </div>
        </>
      )}
    </>
  );
}
