import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Tables } from "@/lib/database.types";

export type PrepOverview = {
  session: Pick<Tables<"prep_sessions">, "id" | "for_date" | "status" | "deadline_at" | "completed_at"> | null;
  release_time: string;
  deadline_time: string;
  tomorrow: string;
};

// Tonight's session (if released), its items and the household's children.
export async function loadPrep(supabase: SupabaseClient<Database>) {
  const [{ data: overview }, { data: kids }] = await Promise.all([
    supabase.rpc("prep_overview"),
    supabase.from("children").select("id, name, color").order("sort"),
  ]);
  const o = overview as PrepOverview | null;

  const { data: items } = o?.session
    ? await supabase
        .from("prep_items")
        .select("id, child_id, label, group_label, sort, checked_at")
        .eq("session_id", o.session.id)
    : { data: [] };

  return { overview: o, kids: kids ?? [], items: items ?? [] };
}

// "2026-10-30" -> "Friday"
export function dayName(isoDate: string) {
  return new Date(`${isoDate}T12:00:00Z`).toLocaleDateString("en-NG", { weekday: "long", timeZone: "UTC" });
}
