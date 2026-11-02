import Link from "next/link";
import { copyCareDay, deleteCareItem, saveCareItem, setCareItemActive } from "@/app/parent/actions";
import { ActionForm, SubmitButton } from "@/components/form";
import { ScheduleNav } from "@/components/schedule-nav";
import { Card, Field, inputClass, labelClass, PageHeader } from "@/components/ui";
import { requireParent } from "@/lib/auth";
import { CARE_KINDS, careKind } from "@/lib/care";
import { formatTime, isoWeekday, lagosDate, timeInput, WEEKDAYS } from "@/lib/format";
import type { Tables } from "@/lib/database.types";

type Child = Pick<Tables<"children">, "id" | "name" | "color">;
type Item = Tables<"care_items">;

const TITLES = ["Breakfast", "Lunch", "Dinner", "Snack", "Bath", "Nap", "Homework", "Bedtime", "Medicine", "Brush teeth"];

function ItemFields({ item }: { item?: Item }) {
  return (
    <>
      <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-3">
        <Field label="Type">
          <select name="kind" defaultValue={item?.kind ?? "meal"} className={inputClass}>
            {CARE_KINDS.map((k) => (
              <option key={k.value} value={k.value}>
                {k.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Time">
          <input name="at_time" type="time" required defaultValue={timeInput(item?.at_time) || "13:00"}
            className={`${inputClass} tabular-nums`} />
        </Field>
      </div>
      <Field label="What">
        <input name="title" list="care-titles" required maxLength={80} defaultValue={item?.title}
          placeholder="Lunch" className={inputClass} />
      </Field>
      <Field label="Details" hint="Optional. The food, the dose, anything to remember.">
        <input name="details" maxLength={300} defaultValue={item?.details ?? ""} placeholder="Rice and stew, then a banana"
          className={inputClass} />
      </Field>
      <label className="flex min-h-11 items-center gap-3 text-sm">
        <input type="checkbox" name="school_days_only" defaultChecked={item?.school_days_only} className="size-5 accent-primary" />
        Not on holidays (for example homework)
      </label>
    </>
  );
}

function DayPicker({ name, checked, exclude }: { name: string; checked: number[]; exclude?: number }) {
  return (
    <div className="flex flex-wrap gap-2">
      {WEEKDAYS.filter((d) => d.n !== exclude).map((d) => (
        <label key={d.n}
          className="flex min-h-11 min-w-11 cursor-pointer items-center justify-center rounded-full border border-border px-3 text-sm font-semibold has-[:checked]:border-primary has-[:checked]:bg-primary-soft has-[:checked]:text-primary">
          <input type="checkbox" name={name} value={d.n} defaultChecked={checked.includes(d.n)} className="sr-only" />
          {d.short}
        </label>
      ))}
    </div>
  );
}

function ItemRow({ item }: { item: Item }) {
  const kind = careKind(item.kind);
  return (
    <li className={item.active ? "" : "opacity-60"}>
      <details>
        <summary className="flex min-h-12 cursor-pointer list-none items-center gap-3 py-1">
          <span className="w-[4.5rem] shrink-0 font-bold tabular-nums text-primary">{formatTime(item.at_time)}</span>
          <span aria-hidden className="w-6 text-center">{kind.icon}</span>
          <span className="min-w-0 flex-1">
            <span className="font-semibold">{item.title}</span>
            {!item.active && <span className="ml-2 text-xs text-warning">Paused</span>}
            {item.school_days_only && <span className="ml-2 text-xs text-muted">Not on holidays</span>}
            {item.details && <span className="block text-sm text-muted">{item.details}</span>}
          </span>
          <span className="text-sm text-muted">Edit</span>
        </summary>
        <ActionForm action={saveCareItem} className="mb-2 mt-2 space-y-3 rounded-[10px] border border-border p-3">
          <input type="hidden" name="id" value={item.id} />
          <ItemFields item={item} />
          <SubmitButton>Save</SubmitButton>
        </ActionForm>
        <div className="mb-3 flex flex-wrap gap-2">
          <form action={setCareItemActive}>
            <input type="hidden" name="id" value={item.id} />
            <input type="hidden" name="active" value={String(!item.active)} />
            <SubmitButton variant="secondary">{item.active ? "Pause" : "Resume"}</SubmitButton>
          </form>
          <form action={deleteCareItem}>
            <input type="hidden" name="id" value={item.id} />
            <SubmitButton variant="danger">Delete</SubmitButton>
          </form>
        </div>
      </details>
    </li>
  );
}

export default async function SchedulePage({ searchParams }: { searchParams: Promise<{ day?: string }> }) {
  const { supabase } = await requireParent();
  const { day: dayParam } = await searchParams;
  const today = isoWeekday(lagosDate());
  const day = Number(dayParam) >= 1 && Number(dayParam) <= 7 ? Number(dayParam) : today;

  const [{ data: kids }, { data: items }, { data: household }] = await Promise.all([
    supabase.from("children").select("id, name, color").order("sort"),
    supabase.from("care_items").select("*").order("at_time").order("title"),
    supabase.from("households").select("care_lead_minutes").single(),
  ]);

  if (!kids?.length) {
    return (
      <>
        <PageHeader title="Schedule" />
        <ScheduleNav active="care" />
        <Card>
          <p className="text-sm text-muted">
            Add the children first.{" "}
            <Link href="/parent/settings#children" className="font-semibold text-primary hover:underline">Add children</Link>
          </p>
        </Card>
      </>
    );
  }

  const all = items ?? [];
  const dayName = WEEKDAYS.find((d) => d.n === day)!.long;
  const lead = household?.care_lead_minutes ?? 30;

  return (
    <>
      <PageHeader
        title="Schedule"
        subtitle={`Each day has its own schedule. The nanny is reminded ${lead} minutes before each item, and you're told if it isn't ticked by its time.`}
      />
      <ScheduleNav active="care" />
      <datalist id="care-titles">
        {TITLES.map((t) => <option key={t} value={t} />)}
      </datalist>

      <nav aria-label="Day" className="mb-4 grid grid-cols-7 gap-1">
        {WEEKDAYS.map((d) => {
          const count = all.filter((i) => i.weekday === d.n).length;
          const active = d.n === day;
          return (
            <Link key={d.n} href={`/parent/schedule?day=${d.n}`} aria-current={active ? "page" : undefined}
              className={`flex min-h-14 flex-col items-center justify-center rounded-[10px] border text-sm font-bold ${
                active ? "border-primary bg-primary-soft text-primary" : "border-border bg-surface text-text hover:border-primary"
              }`}>
              {d.short}
              <span className={`text-xs font-semibold ${active ? "text-primary" : "text-muted"}`}>
                {count || "–"}
                {d.n === today && <span className="sr-only"> (today)</span>}
              </span>
            </Link>
          );
        })}
      </nav>

      <h2 className="mb-3 font-display text-xl font-semibold">
        {dayName}
        {day === today && <span className="ml-2 text-sm font-semibold text-muted">Today</span>}
      </h2>

      <div className="space-y-4">
        {kids.map((k: Child) => {
          const mine = all.filter((i) => i.child_id === k.id && i.weekday === day);
          return (
            <Card key={k.id}>
              <h3 className="mb-1 flex items-center gap-2 font-display text-lg font-semibold">
                <span aria-hidden className="size-3 rounded-full" style={{ background: k.color }} />
                {k.name}
              </h3>
              {mine.length ? (
                <ul className="divide-y divide-border">
                  {mine.map((i) => <ItemRow key={i.id} item={i} />)}
                </ul>
              ) : (
                <p className="py-2 text-sm text-muted">Nothing on {dayName} yet.</p>
              )}
            </Card>
          );
        })}
      </div>

      <Card className="mt-6">
        <h2 className="mb-3 font-display text-lg font-semibold">Add to the schedule</h2>
        <ActionForm action={saveCareItem} className="space-y-3">
          <fieldset>
            <legend className="mb-1.5 text-sm font-bold">For</legend>
            <div className="flex flex-wrap gap-2">
              {kids.map((k) => (
                <label key={k.id}
                  className="flex min-h-11 cursor-pointer items-center gap-2 rounded-full border border-border px-4 text-sm font-semibold has-[:checked]:border-primary has-[:checked]:bg-primary-soft has-[:checked]:text-primary">
                  <input type="checkbox" name="child_id" value={k.id} defaultChecked={kids.length === 1} className="accent-primary" />
                  {k.name}
                </label>
              ))}
            </div>
          </fieldset>
          <ItemFields />
          <fieldset>
            <legend className="mb-1.5 text-sm font-bold">On</legend>
            <DayPicker name="weekday" checked={[day]} />
            <p className="mt-1.5 text-xs text-muted">Pick more days to add the same item to each of them. You can change each day afterwards.</p>
          </fieldset>
          <SubmitButton>Add</SubmitButton>
        </ActionForm>
      </Card>

      <Card className="mt-4">
        <details>
          <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between">
            <span>
              <span className="block font-display text-lg font-semibold">Copy {dayName} to other days</span>
              <span className="block text-sm text-muted">Their schedules are replaced with {dayName}&apos;s.</span>
            </span>
            <span className="text-muted">›</span>
          </summary>
          <ActionForm action={copyCareDay} className="mt-4 space-y-3 border-t border-border pt-4">
            <input type="hidden" name="from" value={day} />
            <Field label="Whose schedule">
              <select name="child_id" className={inputClass}>
                <option value="">Every child</option>
                {kids.map((k) => <option key={k.id} value={k.id}>{k.name}</option>)}
              </select>
            </Field>
            <fieldset>
              <legend className={`mb-1.5 ${labelClass}`}>Copy to</legend>
              <DayPicker name="to" checked={[]} exclude={day} />
            </fieldset>
            <SubmitButton variant="secondary">Copy {dayName}</SubmitButton>
          </ActionForm>
        </details>
      </Card>
    </>
  );
}
