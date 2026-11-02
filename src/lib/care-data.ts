import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { CARE_ROW_COLUMNS, type CareRow } from "@/lib/care";
import type { Database, Tables } from "@/lib/database.types";
import { lagosDate } from "@/lib/format";

// Today's daily-care rows (Lagos date) and the household's children.
export async function loadCareToday(supabase: SupabaseClient<Database>) {
  const date = lagosDate();
  const [{ data: rows }, { data: kids }] = await Promise.all([
    supabase.from("care_log").select(CARE_ROW_COLUMNS).eq("for_date", date),
    supabase.from("children").select("id, name, color").order("sort"),
  ]);
  return { date, rows: (rows ?? []) as CareRow[], kids: kids ?? [] };
}

export type CareCard = Tables<"care_cards">;
export type Contact = Tables<"emergency_contacts">;

// Care cards by child, plus the household's emergency contacts.
export async function loadCareCards(supabase: SupabaseClient<Database>) {
  const [{ data: cards }, { data: contacts }] = await Promise.all([
    supabase.from("care_cards").select("*"),
    supabase.from("emergency_contacts").select("*").order("sort").order("name"),
  ]);
  const card = (childId: string) => cards?.find((c) => c.child_id === childId) ?? null;
  return { card, contacts: contacts ?? [] };
}

// What a nanny must not miss, in one line: "Allergic to peanuts. Avoid: pork."
export function careAlert(card: CareCard | null) {
  if (!card) return null;
  const parts = [
    card.allergies && `Allergies: ${card.allergies}`,
    card.avoid_foods && `Avoid: ${card.avoid_foods}`,
  ].filter(Boolean);
  return parts.length ? parts.join(". ") : null;
}
