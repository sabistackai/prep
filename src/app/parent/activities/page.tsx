import Link from "next/link";
import { deleteActivity, saveActivity, setActivityActive } from "@/app/parent/actions";
import { ActionForm, SubmitButton } from "@/components/form";
import { Card, Field, inputClass, Mono, PageHeader } from "@/components/ui";
import { requireParent } from "@/lib/auth";
import { formatTime, timeInput, WEEKDAYS } from "@/lib/format";
import type { Tables } from "@/lib/database.types";

type Child = Pick<Tables<"children">, "id" | "name" | "color">;

function ActivityFields({ kids, activity }: { kids: Child[]; activity?: Tables<"activities"> }) {
  return (
    <>
      {activity && <input type="hidden" name="id" value={activity.id} />}
      <div className="grid grid-cols-2 gap-3">
        <Field label="Child">
          <select name="child_id" defaultValue={activity?.child_id ?? kids[0]?.id} className={inputClass}>
            {kids.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Day">
          <select name="weekday" defaultValue={activity?.weekday ?? 6} className={inputClass}>
            {WEEKDAYS.map((d) => (
              <option key={d.n} value={d.n}>
                {d.long}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <div className="grid grid-cols-[1fr_8rem] gap-3">
        <Field label="Activity">
          <input name="title" defaultValue={activity?.title} placeholder="Football academy" required className={inputClass} />
        </Field>
        <Field label="Starts">
          <input
            name="start_time"
            type="time"
            defaultValue={timeInput(activity?.start_time) || "08:00"}
            required
            className={`${inputClass} tabular-nums`}
          />
        </Field>
      </div>
      <Field label="What to bring" hint="One per line, or separated by commas.">
        <textarea
          name="bring"
          rows={3}
          defaultValue={activity?.bring.join("\n")}
          placeholder={"Boots\nShin guards\nJersey\nWater bottle"}
          className={`${inputClass} py-2`}
        />
      </Field>
    </>
  );
}

export default async function ActivitiesPage() {
  const { supabase } = await requireParent();
  const [{ data: kids }, { data: activities }] = await Promise.all([
    supabase.from("children").select("id, name, color").order("sort"),
    supabase.from("activities").select("*").order("weekday").order("start_time"),
  ]);

  if (!kids?.length) {
    return (
      <>
        <PageHeader title="Activities" />
        <Card>
          <p className="text-sm text-muted">
            Add the children first.{" "}
            <Link href="/parent/settings#children" className="font-semibold text-primary hover:underline">
              Add children
            </Link>
          </p>
        </Card>
      </>
    );
  }

  const childOf = (id: string) => kids.find((c) => c.id === id);
  const days = WEEKDAYS.filter((d) => activities?.some((a) => a.weekday === d.n));

  return (
    <>
      <PageHeader title="Activities" subtitle="The nanny gets a reminder before each one, with what to pack." />

      <div className="space-y-5">
        {days.map((d) => (
          <section key={d.n}>
            <h2 className="mb-2 text-xs font-extrabold uppercase tracking-[0.12em] text-muted">{d.long}</h2>
            <ul className="space-y-2">
              {activities!
                .filter((a) => a.weekday === d.n)
                .map((a) => {
                  const child = childOf(a.child_id);
                  return (
                    <li key={a.id}>
                      <Card className={a.active ? "" : "opacity-60"}>
                        <details>
                          <summary className="flex cursor-pointer list-none items-start gap-3">
                            <Mono>
                              <span className="text-primary">{formatTime(a.start_time)}</span>
                            </Mono>
                            <span className="flex-1">
                              <span className="font-semibold">{a.title}</span>
                              <span className="ml-2 inline-flex items-center gap-1.5 text-sm text-muted">
                                <span className="size-2 rounded-full" style={{ background: child?.color }} />
                                {child?.name}
                              </span>
                              {!a.active && <span className="ml-2 text-xs text-warning">Paused</span>}
                              {a.bring.length > 0 && (
                                <span className="mt-1 block text-sm text-muted">Bring: {a.bring.join(", ")}</span>
                              )}
                            </span>
                            <span className="text-sm text-muted">Edit</span>
                          </summary>

                          <ActionForm action={saveActivity} className="mt-4 space-y-3 border-t border-border pt-4">
                            <ActivityFields kids={kids} activity={a} />
                            <SubmitButton>Save</SubmitButton>
                          </ActionForm>
                          <div className="mt-3 flex flex-wrap gap-2">
                            <form action={setActivityActive}>
                              <input type="hidden" name="id" value={a.id} />
                              <input type="hidden" name="active" value={String(!a.active)} />
                              <SubmitButton variant="secondary">{a.active ? "Pause" : "Resume"}</SubmitButton>
                            </form>
                            <form action={deleteActivity}>
                              <input type="hidden" name="id" value={a.id} />
                              <SubmitButton variant="danger">Delete</SubmitButton>
                            </form>
                          </div>
                        </details>
                      </Card>
                    </li>
                  );
                })}
            </ul>
          </section>
        ))}
      </div>

      <Card className="mt-6">
        <h2 className="mb-3 font-display text-lg font-semibold">Add an activity</h2>
        <ActionForm action={saveActivity} className="space-y-3">
          <ActivityFields kids={kids} />
          <SubmitButton>Add activity</SubmitButton>
        </ActionForm>
      </Card>
    </>
  );
}
