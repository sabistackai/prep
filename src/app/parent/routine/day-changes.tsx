import { removeDayChange, saveDayChange } from "@/app/parent/actions";
import { ActionForm, SubmitButton } from "@/components/form";
import { Card, Field, inputClass, labelClass } from "@/components/ui";
import { formatDay, lagosDate } from "@/lib/format";
import type { Tables } from "@/lib/database.types";

type Child = Pick<Tables<"children">, "id" | "name" | "color">;
type Outfit = Pick<Tables<"outfits">, "id" | "name">;
type Change = Pick<Tables<"overrides">, "id" | "child_id" | "on_date" | "outfit_id" | "extra_items" | "note">;

// "Change one day" form plus the upcoming changes, grouped by date.
export function DayChanges({ kids, outfits, changes }: { kids: Child[]; outfits: Outfit[]; changes: Change[] }) {
  const days = [...new Set(changes.map((c) => c.on_date))].sort();
  const name = (id: string) => kids.find((k) => k.id === id)?.name ?? "";
  const outfitName = (id: string | null) => outfits.find((o) => o.id === id)?.name;

  return (
    <section className="mb-6 space-y-3">
      <Card>
        <details>
          <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between">
            <span>
              <span className="block font-display text-lg font-semibold">Change one day</span>
              <span className="block text-sm text-muted">Sports day, a trip, something extra to pack.</span>
            </span>
            <span className="text-muted">›</span>
          </summary>

          <ActionForm action={saveDayChange} className="mt-4 space-y-3 border-t border-border pt-4">
            <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-3">
              <Field label="Day">
                <input
                  name="on_date"
                  type="date"
                  min={lagosDate()}
                  defaultValue={lagosDate(1)}
                  required
                  className={`${inputClass} tabular-nums`}
                />
              </Field>
              <Field label="What's it for?" hint="Optional">
                <input name="note" placeholder="Inter-house sports" maxLength={60} className={inputClass} />
              </Field>
            </div>

            <fieldset>
              <legend className="mb-1.5 text-sm font-bold">Children</legend>
              <div className="flex flex-wrap gap-2">
                {kids.map((k) => (
                  <label
                    key={k.id}
                    className="flex min-h-11 cursor-pointer items-center gap-2 rounded-full border border-border px-4 text-sm font-semibold has-[:checked]:border-primary has-[:checked]:bg-primary-soft has-[:checked]:text-primary"
                  >
                    <input type="checkbox" name="child_id" value={k.id} defaultChecked className="accent-primary" />
                    {k.name}
                  </label>
                ))}
              </div>
            </fieldset>

            <Field label="Outfit">
              <select name="outfit_id" defaultValue="" className={inputClass}>
                <option value="">Their usual outfit</option>
                {outfits.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Also pack" hint="One per line, or separated by commas.">
              <textarea name="extra_items" rows={2} placeholder={"Water bottle\nHouse badge"} className={`${inputClass} py-2`} />
            </Field>
            <SubmitButton>Save change</SubmitButton>
          </ActionForm>
        </details>
      </Card>

      {days.length > 0 && (
        <div className="space-y-2">
          <h2 className={labelClass}>Coming up</h2>
          {days.map((day) => (
            <Card key={day}>
              <p className="font-display text-lg font-semibold">{formatDay(day)}</p>
              <ul className="mt-1 divide-y divide-border">
                {changes
                  .filter((c) => c.on_date === day)
                  .map((c) => (
                    <li key={c.id} className="flex items-start justify-between gap-3 py-2">
                      <span className="min-w-0 text-sm">
                        <span className="font-semibold">{name(c.child_id)}</span>
                        {c.note && <span className="text-muted"> · {c.note}</span>}
                        <span className="block text-muted">
                          {[
                            outfitName(c.outfit_id) ? `Wears ${outfitName(c.outfit_id)}` : null,
                            c.extra_items.length ? `Pack ${c.extra_items.join(", ")}` : null,
                          ]
                            .filter(Boolean)
                            .join(". ")}
                        </span>
                      </span>
                      <form action={removeDayChange}>
                        <input type="hidden" name="id" value={c.id} />
                        <SubmitButton variant="ghost" className="min-h-9 px-2">
                          Remove
                        </SubmitButton>
                      </form>
                    </li>
                  ))}
              </ul>
            </Card>
          ))}
        </div>
      )}
    </section>
  );
}
