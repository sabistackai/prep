import Link from "next/link";
import { createTask, deleteTask, markTaskDone, reopenTask } from "@/app/parent/actions";
import { ActionForm, SubmitButton } from "@/components/form";
import { LiveRefresh } from "@/components/live-refresh";
import { TaskCard } from "@/components/task-card";
import { Card, Field, inputClass, labelClass, PageHeader } from "@/components/ui";
import { requireParent } from "@/lib/auth";
import { formatDue } from "@/lib/format";
import { loadTasks } from "@/lib/tasks";
import { MealForm } from "./meal-form";

export default async function ParentTasksPage() {
  const { supabase } = await requireParent();
  const [{ open, done, members, name }, { data: kids }] = await Promise.all([
    loadTasks(supabase, 14),
    supabase.from("children").select("id, name, color").order("sort"),
  ]);
  const nannies = members.filter((m) => m.role === "nanny");
  const many = nannies.length > 1;

  return (
    <>
      <LiveRefresh tables={["tasks"]} />
      <PageHeader title="Tasks" subtitle="The nanny gets each task on their phone straight away." />

      {nannies.length > 0 && !!kids?.length && <MealForm kids={kids} nannies={nannies} />}

      {nannies.length === 0 ? (
        <Card className="mb-6">
          <p className="text-sm text-muted">
            Add a nanny first.{" "}
            <Link href="/parent/settings#nannies" className="font-semibold text-primary hover:underline">
              Add a nanny
            </Link>
          </p>
        </Card>
      ) : (
        <Card className="mb-6">
          <h2 className="mb-3 font-display text-lg font-semibold">New task</h2>
          <ActionForm action={createTask} className="space-y-3">
            <Field label="Task">
              <input name="title" placeholder="Iron Ada's choir robe" required maxLength={200} className={inputClass} />
            </Field>
            {many ? (
              <Field label="For">
                <select name="assigned_to" className={inputClass}>
                  {nannies.map((n) => (
                    <option key={n.id} value={n.id!}>
                      {n.display_name}
                    </option>
                  ))}
                </select>
              </Field>
            ) : (
              <input type="hidden" name="assigned_to" value={nannies[0].id!} />
            )}
            <div className="grid grid-cols-[minmax(0,1fr)_7rem] gap-3">
              <Field label="Due day" hint="Optional">
                <input name="due_date" type="date" className={`${inputClass} tabular-nums`} />
              </Field>
              <Field label="Time" hint="6:00 PM if empty">
                <input name="due_time" type="time" className={`${inputClass} tabular-nums`} />
              </Field>
            </div>
            <SubmitButton>Send to {many ? "nanny" : nannies[0].display_name}</SubmitButton>
          </ActionForm>
        </Card>
      )}

      <h2 className={`mb-2 ${labelClass}`}>Open</h2>
      <div className="mb-6 space-y-2">
        {open.map((t) => (
          <TaskCard key={t.id} task={t} meta={`For ${name(t.assigned_to)} · from ${name(t.created_by)}`}>
            <form action={markTaskDone}>
              <input type="hidden" name="id" value={t.id} />
              <SubmitButton variant="secondary">Mark done</SubmitButton>
            </form>
            <form action={deleteTask}>
              <input type="hidden" name="id" value={t.id} />
              <SubmitButton variant="ghost" className="px-0">
                Delete
              </SubmitButton>
            </form>
          </TaskCard>
        ))}
        {!open.length && (
          <Card>
            <p className="text-sm text-muted">No open tasks.</p>
          </Card>
        )}
      </div>

      {!!done.length && (
        <>
          <h2 className={`mb-2 ${labelClass}`}>Done in the last 2 weeks</h2>
          <div className="space-y-2">
            {done.map((t) => (
              <TaskCard key={t.id} task={t} meta={`✓ ${name(t.done_by)} · ${formatDue(t.done_at!)}`}>
                <form action={reopenTask}>
                  <input type="hidden" name="id" value={t.id} />
                  <SubmitButton variant="ghost" className="px-0">
                    Not done? Reopen
                  </SubmitButton>
                </form>
              </TaskCard>
            ))}
          </div>
        </>
      )}
    </>
  );
}
