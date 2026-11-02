import type { Tables } from "@/lib/database.types";

// Daily care: the kinds of item on a child's schedule, and the state of one day's item.

export const CARE_KINDS = [
  { value: "meal", label: "Meal", icon: "🍽️", hint: "What they're eating" },
  { value: "bath", label: "Bath", icon: "🛁", hint: "Anything to remember" },
  { value: "nap", label: "Nap", icon: "😴", hint: "How long, where" },
  { value: "medicine", label: "Medicine", icon: "💊", hint: "Name and dose" },
  { value: "homework", label: "Homework", icon: "📚", hint: "Subjects, reading" },
  { value: "play", label: "Play or outing", icon: "⚽", hint: "Where, what to take" },
  { value: "bedtime", label: "Bedtime", icon: "🌙", hint: "Routine, story" },
  { value: "other", label: "Other", icon: "•", hint: "Details" },
] as const;

export type CareKind = (typeof CARE_KINDS)[number]["value"];

export function careKind(kind: string) {
  return CARE_KINDS.find((k) => k.value === kind) ?? CARE_KINDS[CARE_KINDS.length - 1];
}

export type CareRow = Pick<
  Tables<"care_log">,
  "id" | "child_id" | "for_date" | "due_at" | "kind" | "title" | "details" | "done_at" | "skipped_at"
>;

export const CARE_ROW_COLUMNS = "id, child_id, for_date, due_at, kind, title, details, done_at, skipped_at";

export type CareState = "done" | "done_late" | "skipped" | "late" | "soon" | "upcoming";

const MINUTE = 60_000;

// Ticked within the minute it was due counts as on time (same rule as the weekly summary).
export function careState(row: Pick<CareRow, "due_at" | "done_at" | "skipped_at">, now: number, leadMinutes = 30): CareState {
  const due = new Date(row.due_at).getTime();
  if (row.skipped_at) return "skipped";
  if (row.done_at) return new Date(row.done_at).getTime() < due + MINUTE ? "done" : "done_late";
  if (now >= due + MINUTE) return "late";
  if (now >= due - leadMinutes * MINUTE) return "soon";
  return "upcoming";
}

// Today's rows in due order (then child order, then title).
export function sortCare<T extends Pick<CareRow, "due_at" | "child_id" | "title">>(rows: T[], childOrder: string[]) {
  return [...rows].sort(
    (a, b) =>
      a.due_at.localeCompare(b.due_at) ||
      childOrder.indexOf(a.child_id) - childOrder.indexOf(b.child_id) ||
      a.title.localeCompare(b.title),
  );
}

// Every item for the day is counted except ones a parent skipped.
export function careTotals(rows: Pick<CareRow, "due_at" | "done_at" | "skipped_at">[], now: number) {
  const states = rows.map((r) => careState(r, now));
  const count = (...s: CareState[]) => states.filter((x) => s.includes(x)).length;
  return {
    total: states.length - count("skipped"),
    done: count("done", "done_late"),
    late: count("late"),
    skipped: count("skipped"),
  };
}
