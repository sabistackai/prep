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
