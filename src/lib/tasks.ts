import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

// Open tasks (RLS shows a nanny only theirs), ones done in the last `doneDays`,
// and a member-name lookup for "From Mrs Okafor".
export async function loadTasks(supabase: SupabaseClient<Database>, doneDays: number) {
  const since = new Date(Date.now() - doneDays * 86_400_000).toISOString();
  const [{ data: open }, { data: done }, { data: names }] = await Promise.all([
    supabase.from("tasks").select("*").is("done_at", null).order("due_at", { nullsFirst: false }).order("created_at"),
    supabase.from("tasks").select("*").gte("done_at", since).order("done_at", { ascending: false }).limit(20),
    supabase.from("member_names").select("id, role, display_name"),
  ]);
  const name = (id: string | null) => names?.find((m) => m.id === id)?.display_name ?? "someone";
  return { open: open ?? [], done: done ?? [], members: names ?? [], name };
}
