"use server";

import { revalidatePath } from "next/cache";
import type { FormState } from "@/components/form";
import { requireParent } from "@/lib/auth";
import { parseList } from "@/lib/format";
import { normalizePhone } from "@/lib/phone";
import { createAdminClient } from "@/lib/supabase/admin";

function done(ok?: string): FormState {
  revalidatePath("/parent", "layout");
  return ok ? { ok } : null;
}

function str(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

// Tonight's prep ---------------------------------------------------------------

export async function rebuildTonight(_: FormState, formData: FormData): Promise<FormState> {
  const { supabase } = await requireParent();
  const { error } = await supabase.rpc("rebuild_prep_session", { p_session_id: str(formData, "id") });
  if (error) return { error: "Couldn't rebuild the list. Please try again." };
  return done("Tonight's list now matches the routine. Ticked items were kept.");
}

// Children --------------------------------------------------------------------

export async function saveChild(_: FormState, formData: FormData): Promise<FormState> {
  const { supabase, member } = await requireParent();
  const id = str(formData, "id");
  const row = {
    name: str(formData, "name"),
    class_name: str(formData, "class_name") || null,
    color: str(formData, "color") || "#84CC16",
  };
  if (!row.name) return { error: "Enter the child's name." };

  let error;
  if (id) {
    ({ error } = await supabase.from("children").update(row).eq("id", id));
  } else {
    const { count } = await supabase.from("children").select("*", { count: "exact", head: true });
    ({ error } = await supabase.from("children").insert({ ...row, household_id: member.household_id, sort: count ?? 0 }));
  }
  if (error) return { error: error.message };
  return done(id ? "Saved." : `${row.name} added. Their week starts as Uniform on school days.`);
}

export async function deleteChild(formData: FormData) {
  const { supabase } = await requireParent();
  await supabase.from("children").delete().eq("id", str(formData, "id"));
  done();
}

// Routine -----------------------------------------------------------------------

export async function setRoutineDay(childId: string, weekday: number, outfitId: string) {
  const { supabase } = await requireParent();
  const { error } = await supabase
    .from("weekly_routine")
    .upsert({ child_id: childId, weekday, outfit_id: outfitId });
  if (error) throw new Error(error.message);
  revalidatePath("/parent/routine");
}

// Outfits -----------------------------------------------------------------------

export async function saveOutfit(_: FormState, formData: FormData): Promise<FormState> {
  const { supabase, member } = await requireParent();
  const id = str(formData, "id");
  const row = {
    name: str(formData, "name"),
    items: parseList(formData.get("items")),
    is_school: formData.get("is_school") === "on",
  };
  if (!row.name) return { error: "Give the outfit a name." };

  const { error } = id
    ? await supabase.from("outfits").update(row).eq("id", id)
    : await supabase.from("outfits").insert({ ...row, household_id: member.household_id, sort: 100 });
  if (error) {
    return { error: error.code === "23505" ? "There's already an outfit with that name." : error.message };
  }
  return done(id ? "Saved." : `${row.name} added.`);
}

export async function deleteOutfit(formData: FormData) {
  const { supabase } = await requireParent();
  await supabase.from("outfits").delete().eq("id", str(formData, "id"));
  done();
}

// Activities --------------------------------------------------------------------

export async function saveActivity(_: FormState, formData: FormData): Promise<FormState> {
  const { supabase, member } = await requireParent();
  const id = str(formData, "id");
  const row = {
    child_id: str(formData, "child_id"),
    weekday: Number(formData.get("weekday")),
    start_time: str(formData, "start_time"),
    title: str(formData, "title"),
    bring: parseList(formData.get("bring")),
  };
  if (!row.child_id || !row.title || !row.start_time || !(row.weekday >= 1 && row.weekday <= 7)) {
    return { error: "Choose a child, day and time, and give the activity a name." };
  }

  const { error } = id
    ? await supabase.from("activities").update(row).eq("id", id)
    : await supabase.from("activities").insert({ ...row, household_id: member.household_id });
  if (error) return { error: error.message };
  return done(id ? "Saved." : `${row.title} added.`);
}

export async function setActivityActive(formData: FormData) {
  const { supabase } = await requireParent();
  await supabase
    .from("activities")
    .update({ active: formData.get("active") === "true" })
    .eq("id", str(formData, "id"));
  done();
}

export async function deleteActivity(formData: FormData) {
  const { supabase } = await requireParent();
  await supabase.from("activities").delete().eq("id", str(formData, "id"));
  done();
}

// Holidays ----------------------------------------------------------------------

export async function addHoliday(_: FormState, formData: FormData): Promise<FormState> {
  const { supabase, member } = await requireParent();
  const starts_on = str(formData, "starts_on");
  const ends_on = str(formData, "ends_on") || starts_on;
  if (!starts_on) return { error: "Choose the first day of the break." };
  if (ends_on < starts_on) return { error: "The last day can't be before the first day." };

  const { error } = await supabase
    .from("holidays")
    .insert({ household_id: member.household_id, starts_on, ends_on, label: str(formData, "label") || null });
  if (error) return { error: error.message };
  return done("Holiday added. School-day outfits switch to Casual on those dates.");
}

export async function deleteHoliday(formData: FormData) {
  const { supabase } = await requireParent();
  await supabase.from("holidays").delete().eq("id", str(formData, "id"));
  done();
}

// Timings and notifications -------------------------------------------------------

export async function saveSettings(_: FormState, formData: FormData): Promise<FormState> {
  const { supabase, member } = await requireParent();
  const release = str(formData, "prep_release_time");
  const deadline = str(formData, "prep_deadline_time");
  const nudge = str(formData, "prep_nudge_time") || null;
  if (!release || !deadline) return { error: "Set both the release time and the deadline." };
  if (deadline <= release) return { error: "The deadline must be later than the release time." };
  if (nudge && (nudge <= release || nudge >= deadline)) {
    return { error: "The reminder must be between the release time and the deadline." };
  }

  const { error } = await supabase
    .from("households")
    .update({
      prep_release_time: release,
      prep_deadline_time: deadline,
      prep_nudge_time: nudge,
      activity_lead_minutes: Number(formData.get("activity_lead_minutes")),
      leave_buffer_minutes: Number(formData.get("leave_buffer_minutes")),
      notify_parents_all_ready: formData.get("notify_parents_all_ready") === "on",
      notify_parents_activities: formData.get("notify_parents_activities") === "on",
      sms_backup: formData.get("sms_backup") === "on",
    })
    .eq("id", member.household_id);
  if (error) return { error: error.message };
  return done("Settings saved.");
}

export async function saveProfile(_: FormState, formData: FormData): Promise<FormState> {
  const { supabase, member } = await requireParent();
  const display_name = str(formData, "display_name");
  const rawPhone = str(formData, "phone");
  const phone = rawPhone ? normalizePhone(rawPhone) : null;
  if (!display_name) return { error: "Enter your name." };
  if (rawPhone && !phone) return { error: "That phone number doesn't look right. Try 0803 000 0000." };

  const { error } = await supabase.from("members").update({ display_name, phone }).eq("id", member.id);
  if (error) return { error: error.message };
  return done("Saved.");
}

// Nannies -----------------------------------------------------------------------

export async function addNanny(_: FormState, formData: FormData): Promise<FormState> {
  const { supabase } = await requireParent();
  const name = str(formData, "display_name");
  const phone = normalizePhone(str(formData, "phone"));
  if (!name) return { error: "Enter the nanny's name." };
  if (!phone) return { error: "That phone number doesn't look right. Try 0803 000 0000." };

  const { error } = await supabase.rpc("add_nanny", { p_display_name: name, p_phone: phone });
  if (error) return { error: error.message };
  return done(`${name} added. Send them the setup link below.`);
}

export async function resetNannyLink(formData: FormData) {
  const { supabase } = await requireParent();
  await supabase.rpc("reset_nanny_setup", { p_member_id: str(formData, "id") });
  done();
}

export async function removeNanny(formData: FormData) {
  const { supabase } = await requireParent();
  // RLS only lets a parent see nannies in their own household.
  const { data: nanny } = await supabase
    .from("members")
    .select("id, user_id")
    .eq("id", str(formData, "id"))
    .eq("role", "nanny")
    .maybeSingle();
  if (!nanny) return;

  // Deleting the login cascades to the member row; nannies who never finished setup have no login.
  if (nanny.user_id) await createAdminClient().auth.admin.deleteUser(nanny.user_id);
  await supabase.from("members").delete().eq("id", nanny.id);
  done();
}
