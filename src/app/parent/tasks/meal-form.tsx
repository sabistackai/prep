import { createMealTasks } from "@/app/parent/actions";
import { ActionForm, SubmitButton } from "@/components/form";
import { Card, Field, inputClass, labelClass } from "@/components/ui";
import { lagosDate } from "@/lib/format";
import type { Tables } from "@/lib/database.types";

type Child = Pick<Tables<"children">, "id" | "name" | "color">;
type Nanny = { id: string | null; display_name: string | null };

const MEALS = ["Breakfast", "Lunch", "Dinner", "Snack"];

// One meal on one day, with its own time and food for each child. Each child with a
// time and food becomes a separate task, so the nanny ticks them off one by one.
export function MealForm({ kids, nannies }: { kids: Child[]; nannies: Nanny[] }) {
  return (
    <Card className="mb-6">
      <details>
        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between">
          <span>
            <span className="block font-display text-lg font-semibold">Add a meal</span>
            <span className="block text-sm text-muted">Set the time and food for each child.</span>
          </span>
          <span className="text-muted">›</span>
        </summary>

        <ActionForm action={createMealTasks} className="mt-4 space-y-3 border-t border-border pt-4">
          <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-3">
            <Field label="Meal">
              <select name="meal" defaultValue="Lunch" className={inputClass}>
                {MEALS.map((m) => (
                  <option key={m}>{m}</option>
                ))}
              </select>
            </Field>
            <Field label="Day">
              <input
                name="due_date"
                type="date"
                min={lagosDate()}
                defaultValue={lagosDate()}
                required
                className={`${inputClass} tabular-nums`}
              />
            </Field>
          </div>

          {nannies.length > 1 ? (
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

          <div className="space-y-3">
            <p className={labelClass}>Leave a child empty to skip them</p>
            {kids.map((k) => (
              <fieldset key={k.id} className="space-y-2 rounded-[10px] border border-border p-3">
                <legend className="flex items-center gap-2 px-1 text-sm font-bold">
                  <span className="size-2.5 rounded-full" style={{ background: k.color }} />
                  {k.name}
                </legend>
                <div className="grid grid-cols-[7rem_minmax(0,1fr)] gap-3">
                  <Field label="Time">
                    <input name={`time_${k.id}`} type="time" className={`${inputClass} tabular-nums`} />
                  </Field>
                  <Field label="Eating">
                    <input name={`food_${k.id}`} placeholder="Rice and stew" maxLength={150} className={inputClass} />
                  </Field>
                </div>
              </fieldset>
            ))}
          </div>

          <SubmitButton>Send meal</SubmitButton>
        </ActionForm>
      </details>
    </Card>
  );
}
