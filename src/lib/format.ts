import { CHILD_COLORS } from "@/lib/brand";

export const WEEKDAYS = [
  { n: 1, short: "Mon", long: "Monday" },
  { n: 2, short: "Tue", long: "Tuesday" },
  { n: 3, short: "Wed", long: "Wednesday" },
  { n: 4, short: "Thu", long: "Thursday" },
  { n: 5, short: "Fri", long: "Friday" },
  { n: 6, short: "Sat", long: "Saturday" },
  { n: 7, short: "Sun", long: "Sunday" },
] as const;

// Routine grid colours, assigned to outfits in their sort order (the brand data palette).
export const OUTFIT_COLORS = CHILD_COLORS;

export function weekdayName(n: number) {
  return WEEKDAYS.find((d) => d.n === n)?.long ?? "";
}

// "18:30:00" -> "6:30 PM"
export function formatTime(t: string | null | undefined) {
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  const suffix = h >= 12 ? "PM" : "AM";
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${suffix}`;
}

// "18:30:00" -> "18:30" for <input type="time">
export function timeInput(t: string | null | undefined) {
  return t ? t.slice(0, 5) : "";
}

// Lines or commas -> trimmed, non-empty list.
export function parseList(value: FormDataEntryValue | null) {
  return String(value ?? "")
    .split(/[\n,]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

const dueFormat = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
  timeZone: "Africa/Lagos",
});

// ISO timestamp -> "Sat 6:00 PM" (Lagos time)
export function formatDue(iso: string) {
  return dueFormat.format(new Date(iso)).replace(",", "");
}

// Today's date in Lagos as "2026-10-30", optionally shifted by whole days.
export function lagosDate(addDays = 0) {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Lagos" }).format(new Date());
  const d = new Date(`${today}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + addDays);
  return d.toISOString().slice(0, 10);
}

// "2026-11-10" -> "Mon 10 Nov"
export function formatDay(isoDate: string) {
  return new Date(`${isoDate}T12:00:00Z`)
    .toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" })
    .replace(",", "");
}
