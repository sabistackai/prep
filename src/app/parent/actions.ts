"use server";

import { revalidatePath } from "next/cache";
import type { FormState } from "@/components/form";
import { requireParent } from "@/lib/auth";
import { childColor } from "@/lib/brand";
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
  };
  if (!row.name) return { error: "Enter the child's name." };

  let error;
  if (id) {
    ({ error } = await supabase
      .from("children")
      .update({ ...row, color: str(formData, "color") || childColor(0) })
      .eq("id", id));
  } else {
    // New children get the brand palette in order (theme spec 3).
    const { count } = await supabase.from("children").select("*", { count: "exact", head: true });
    ({ error } = await supabase.from("children").insert({
      ...row,
      color: childColor(count ?? 0),
      household_id: member.household_id,
      sort: count ?? 0,
    }));
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
  const careLead = Number(formData.get("care_lead_minutes"));
  if (!(careLead >= 0 && careLead <= 240)) return { error: "The daily care reminder must be 0 to 240 minutes before." };

  const { error } = await supabase
    .from("households")
    .update({
      prep_release_time: release,
      prep_deadline_time: deadline,
      prep_nudge_time: nudge,
      activity_lead_minutes: Number(formData.get("activity_lead_minutes")),
      care_lead_minutes: Number(formData.get("care_lead_minutes")),
      notify_parents_all_ready: formData.get("notify_parents_all_ready") === "on",
      notify_parents_activities: formData.get("notify_parents_activities") === "on",
      notify_parents_care_late: formData.get("notify_parents_care_late") === "on",
      notify_parents_weekly: formData.get("notify_parents_weekly") === "on",
    })
    .eq("id", member.household_id);
  if (error) return { error: error.message };
  return done("Settings saved.");
}

export async function saveProfile(_: FormState, formData: FormData): Promise<FormState> {
  const { supabase, member } = await requireParent();
  const display_name = str(formData, "display_name");
  if (!display_name) return { error: "Enter your name." };

  const { error } = await supabase.from("members").update({ display_name }).eq("id", member.id);
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

// Tasks -------------------------------------------------------------------------

export async function createTask(_: FormState, formData: FormData): Promise<FormState> {
  const { supabase } = await requireParent();
  const title = str(formData, "title");
  const date = str(formData, "due_date");
  const time = str(formData, "due_time");
  if (!title) return { error: "Say what the task is." };
  if (!date && time) return { error: "Pick a day for the due time, or clear the time." };

  const { error } = await supabase.rpc("create_task", {
    p_assigned_to: str(formData, "assigned_to"),
    p_title: title,
    p_due_local: date ? `${date} ${time || "18:00"}` : undefined,
  });
  if (error) return { error: error.message };
  return done("Sent. It's on the nanny's phone now.");
}

// One task per child with a time and food, e.g. "Ada's lunch: rice and stew".
export async function createMealTasks(_: FormState, formData: FormData): Promise<FormState> {
  const { supabase } = await requireParent();
  const meal = str(formData, "meal").toLowerCase();
  const date = str(formData, "due_date");
  if (!meal || !date) return { error: "Choose the meal and the day." };

  const { data: kids, error: kidsError } = await supabase.from("children").select("id, name").order("sort");
  if (kidsError) return { error: "Couldn't load the children. Please try again." };

  const meals = [];
  for (const kid of kids ?? []) {
    const time = str(formData, `time_${kid.id}`);
    const food = str(formData, `food_${kid.id}`);
    if (!time && !food) continue;
    if (!time) return { error: `Set a time for ${kid.name}.` };
    if (!food) return { error: `Say what ${kid.name} is eating.` };
    // Checked up front so one child's bad time can't leave the others half sent.
    if (new Date(`${date}T${time}:00+01:00`) <= new Date()) {
      return { error: `${kid.name}'s time has already passed.` };
    }
    meals.push({ title: `${kid.name}'s ${meal}: ${food}`, due: `${date} ${time}` });
  }
  if (!meals.length) return { error: "Add a time and food for at least one child." };

  let sent = 0;
  for (const { title, due } of meals) {
    const { error } = await supabase.rpc("create_task", {
      p_assigned_to: str(formData, "assigned_to"),
      p_title: title,
      p_due_local: due,
    });
    if (error) {
      const message = sent ? `Only ${sent} of ${meals.length} meals were sent. Check the list below.` : error.message;
      revalidatePath("/parent", "layout");
      return { error: message };
    }
    sent++;
  }
  return done(sent === 1 ? "Sent. It's on the nanny's phone now." : `${sent} meals sent. They're on the nanny's phone now.`);
}

export async function markTaskDone(formData: FormData) {
  const { supabase } = await requireParent();
  await supabase.rpc("complete_task", { p_task_id: str(formData, "id") });
  done();
}

export async function reopenTask(formData: FormData) {
  const { supabase } = await requireParent();
  await supabase.from("tasks").update({ done_at: null, done_by: null }).eq("id", str(formData, "id"));
  done();
}

export async function deleteTask(formData: FormData) {
  const { supabase } = await requireParent();
  await supabase.from("tasks").delete().eq("id", str(formData, "id"));
  done();
}

// One-day changes --------------------------------------------------------------

export async function saveDayChange(_: FormState, formData: FormData): Promise<FormState> {
  const { supabase } = await requireParent();
  const { error } = await supabase.rpc("save_day_change", {
    p_on_date: str(formData, "on_date"),
    p_children: formData.getAll("child_id").map(String),
    p_outfit_id: str(formData, "outfit_id") || undefined,
    p_extra_items: parseList(formData.get("extra_items")),
    p_note: str(formData, "note") || undefined,
  });
  if (error) return { error: error.message };
  return done("Saved. If that day's list has already gone out, it's updated and the nanny is told.");
}

export async function removeDayChange(formData: FormData) {
  const { supabase } = await requireParent();
  await supabase.rpc("remove_day_change", { p_override_id: str(formData, "id") });
  done();
}

// Daily care schedule --------------------------------------------------------------

const CARE_KIND_VALUES = new Set(["meal", "bath", "nap", "medicine", "homework", "play", "bedtime", "other"]);

function careFields(formData: FormData) {
  const kind = str(formData, "kind");
  return {
    kind: CARE_KIND_VALUES.has(kind) ? kind : "other",
    title: str(formData, "title"),
    at_time: str(formData, "at_time"),
    details: str(formData, "details") || null,
    school_days_only: formData.get("school_days_only") === "on",
  };
}

// New items can go to several children and several days at once; edits change one item.
export async function saveCareItem(_: FormState, formData: FormData): Promise<FormState> {
  const { supabase, member } = await requireParent();
  const id = str(formData, "id");
  const row = careFields(formData);
  if (!row.title) return { error: "Say what it is, for example Lunch or Bath." };
  if (!row.at_time) return { error: "Set a time." };
  if (row.title.length > 80) return { error: "Keep the name under 80 characters." };
  if ((row.details ?? "").length > 300) return { error: "Keep the details under 300 characters." };

  if (id) {
    const { error } = await supabase.from("care_items").update(row).eq("id", id);
    if (error) return { error: "Couldn't save. Please try again." };
    return done("Saved. Today's list is updated if it's for today.");
  }

  const children = formData.getAll("child_id").map(String).filter(Boolean);
  const days = formData.getAll("weekday").map(Number).filter((d) => d >= 1 && d <= 7);
  if (!children.length) return { error: "Pick at least one child." };
  if (!days.length) return { error: "Pick at least one day." };

  const rows = children.flatMap((child_id) =>
    days.map((weekday) => ({ ...row, child_id, weekday, household_id: member.household_id })),
  );
  const { error } = await supabase.from("care_items").insert(rows);
  if (error) return { error: "Couldn't add it. Please try again." };
  return done(rows.length === 1 ? `${row.title} added.` : `${row.title} added ${rows.length} times.`);
}

export async function setCareItemActive(formData: FormData) {
  const { supabase } = await requireParent();
  await supabase
    .from("care_items")
    .update({ active: formData.get("active") === "true" })
    .eq("id", str(formData, "id"));
  done();
}

export async function deleteCareItem(formData: FormData) {
  const { supabase } = await requireParent();
  await supabase.from("care_items").delete().eq("id", str(formData, "id"));
  done();
}

export async function copyCareDay(_: FormState, formData: FormData): Promise<FormState> {
  const { supabase } = await requireParent();
  const from = Number(formData.get("from"));
  const to = formData.getAll("to").map(Number).filter((d) => d !== from);
  if (!to.length) return { error: "Pick the days to copy to." };

  const { data, error } = await supabase.rpc("copy_care_day", {
    p_from: from,
    p_to: to,
    p_child: str(formData, "child_id") || undefined,
  });
  if (error) return { error: error.message };
  return done(`Copied to ${to.length} ${to.length === 1 ? "day" : "days"} (${data ?? 0} items).`);
}

// Take one of today's items off for the day, or put it back.
export async function skipCare(formData: FormData) {
  const { supabase } = await requireParent();
  await supabase.rpc("skip_care", { p_id: str(formData, "id"), p_skip: formData.get("skip") === "true" });
  done();
}

// Care cards and emergency contacts ------------------------------------------------

const CARD_FIELDS = [
  ["allergies", 500],
  ["avoid_foods", 500],
  ["conditions", 500],
  ["medicines", 500],
  ["doctor_name", 100],
  ["doctor_phone", 30],
  ["hospital", 150],
  ["blood_group", 10],
  ["notes", 1000],
] as const;

export async function saveCareCard(_: FormState, formData: FormData): Promise<FormState> {
  const { supabase } = await requireParent();
  const child_id = str(formData, "child_id");
  const card: Record<string, string | null> = {};
  for (const [field, max] of CARD_FIELDS) {
    const value = str(formData, field);
    if (value.length > max) return { error: `That's too long. Keep each box under ${max} characters.` };
    card[field] = value || null;
  }
  const { error } = await supabase.from("care_cards").upsert({ child_id, ...card });
  if (error) return { error: "Couldn't save the care card. Please try again." };
  return done("Care card saved. The nanny can see it on their phone.");
}

export async function saveContact(_: FormState, formData: FormData): Promise<FormState> {
  const { supabase, member } = await requireParent();
  const id = str(formData, "id");
  const row = { name: str(formData, "name"), relation: str(formData, "relation") || null, phone: str(formData, "phone") };
  if (!row.name || !row.phone) return { error: "Enter a name and a phone number." };
  if (row.name.length > 80 || row.phone.length > 30 || (row.relation ?? "").length > 60) {
    return { error: "That's too long." };
  }

  const { error } = id
    ? await supabase.from("emergency_contacts").update(row).eq("id", id)
    : await supabase.from("emergency_contacts").insert({ ...row, household_id: member.household_id });
  if (error) return { error: "Couldn't save the contact. Please try again." };
  return done(id ? "Saved." : `${row.name} added.`);
}

export async function deleteContact(formData: FormData) {
  const { supabase } = await requireParent();
  await supabase.from("emergency_contacts").delete().eq("id", str(formData, "id"));
  done();
}
