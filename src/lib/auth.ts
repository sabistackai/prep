import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// The signed-in user and their member row (null if signed out or not yet in a household).
export const getSession = cache(async () => {
  const supabase = await createClient();
  // Verified on this server against the project's signing keys: no Auth round trip.
  const { data } = await supabase.auth.getClaims();
  const user = data ? { id: data.claims.sub } : null;
  if (!user) return { supabase, user: null, member: null };

  const { data: member } = await supabase.from("members").select("*").eq("user_id", user.id).maybeSingle();
  return { supabase, user, member };
});

export async function requireParent() {
  const { supabase, user, member } = await getSession();
  if (!user) redirect("/login");
  if (!member) redirect("/onboarding");
  if (member.role !== "parent") redirect("/nanny");
  return { supabase, user, member };
}

export async function requireNanny() {
  const { supabase, user, member } = await getSession();
  if (!user || !member) redirect("/nanny/login");
  if (member.role !== "nanny") redirect("/parent");
  return { supabase, user, member };
}
