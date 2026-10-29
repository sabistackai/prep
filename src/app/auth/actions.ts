"use server";

import { redirect } from "next/navigation";
import type { FormState } from "@/components/form";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { isPin, nannyEmail, normalizePhone } from "@/lib/phone";
import { pinPassword } from "@/lib/pin";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

// Parent: email + password -------------------------------------------------

export async function parentSignIn(_: FormState, formData: FormData): Promise<FormState> {
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: String(formData.get("email")).trim(),
    password: String(formData.get("password")),
  });
  if (error) return { error: "That email and password don't match." };
  redirect("/");
}

export async function parentSignUp(_: FormState, formData: FormData): Promise<FormState> {
  const password = String(formData.get("password"));
  if (password.length < 8) return { error: "Use at least 8 characters for your password." };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: String(formData.get("email")).trim(),
    password,
    options: { emailRedirectTo: `${siteUrl}/auth/confirm?next=/onboarding` },
  });
  if (error) return { error: error.message };
  if (!data.session) return { ok: "Check your email and tap the link to finish signing up." };
  redirect("/onboarding");
}

export async function createHousehold(_: FormState, formData: FormData): Promise<FormState> {
  const name = String(formData.get("household")).trim();
  const displayName = String(formData.get("display_name")).trim();
  const rawPhone = String(formData.get("phone") ?? "").trim();
  if (!name || !displayName) return { error: "Fill in both names." };

  const phone = rawPhone ? normalizePhone(rawPhone) : null;
  if (rawPhone && !phone) return { error: "That phone number doesn't look right. Try 0803 000 0000." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("create_household", {
    p_name: name,
    p_display_name: displayName,
    p_phone: phone ?? undefined,
  });
  if (error) return { error: error.message };
  redirect("/parent/settings#children");
}

// Nanny: phone + 6-digit PIN -------------------------------------------------

const PIN_PAUSED = "Too many wrong PINs. Sign-in is paused for 15 minutes.";
const PIN_LOCKED = "Sign-in is locked after too many wrong PINs. Ask Madam or Oga to send you a new setup link.";

export async function nannySignIn(_: FormState, formData: FormData): Promise<FormState> {
  const phone = normalizePhone(String(formData.get("phone")));
  const pin = String(formData.get("pin")).trim();
  if (!phone || !isPin(pin)) return { error: "Enter your phone number and your 6-digit PIN." };

  // Counted before the check, so parallel guesses can't get past the limit.
  const admin = createAdminClient();
  const { data: state, error: limitError } = await admin.rpc("pin_attempt_start", { p_phone: phone });
  if (limitError) return { error: "Couldn't sign you in right now. Please try again." };
  if (state === "paused") return { error: PIN_PAUSED };
  if (state === "locked") return { error: PIN_LOCKED };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: nannyEmail(phone),
    password: pinPassword(phone, pin),
  });
  if (error) {
    const { data: after } = await admin.rpc("pin_attempt_failed", { p_phone: phone });
    if (after === "paused") return { error: PIN_PAUSED };
    if (after === "locked") return { error: PIN_LOCKED };
    return { error: "That phone number and PIN don't match." };
  }

  await admin.rpc("pin_attempts_reset", { p_phone: phone });
  redirect("/nanny");
}

// Nanny opens the one-time setup link and chooses a PIN. Creates (or, on a
// reset, updates) her Supabase Auth user, links it to her member row and signs her in.
export async function completeNannySetup(_: FormState, formData: FormData): Promise<FormState> {
  const token = String(formData.get("token"));
  const pin = String(formData.get("pin")).trim();
  const confirm = String(formData.get("confirm")).trim();
  if (!isPin(pin)) return { error: "Your PIN must be exactly 6 numbers." };
  if (pin !== confirm) return { error: "The two PINs don't match. Try again." };

  const admin = createAdminClient();
  const { data: member } = await admin
    .from("members")
    .select("id, user_id, phone, setup_token_expires_at")
    .eq("setup_token", token)
    .eq("role", "nanny")
    .maybeSingle();

  if (!member || !member.phone) return { error: "This setup link isn't valid. Ask for a new one." };
  if (member.setup_token_expires_at && new Date(member.setup_token_expires_at) < new Date()) {
    return { error: "This setup link has expired. Ask for a new one." };
  }

  const email = nannyEmail(member.phone);
  const password = pinPassword(member.phone, pin);
  let userId = member.user_id;
  if (userId) {
    const { error } = await admin.auth.admin.updateUserById(userId, { email, password });
    if (error) return { error: "Couldn't save your PIN. Please try again." };
  } else {
    const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    if (error || !data.user) {
      return { error: "This phone number is already set up. Ask for the link to be reset." };
    }
    userId = data.user.id;
  }

  const { error: linkError } = await admin
    .from("members")
    .update({ user_id: userId, setup_token: null, setup_token_expires_at: null })
    .eq("id", member.id);
  if (linkError) return { error: "Couldn't finish setup. Please try again." };
  await admin.rpc("pin_attempts_reset", { p_phone: member.phone });

  const supabase = await createClient();
  await supabase.auth.signInWithPassword({ email, password });
  redirect("/nanny");
}

export async function signOut() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  const isNanny = data.user?.email?.endsWith("@nanny.prep.app");
  await supabase.auth.signOut();
  redirect(isNanny ? "/nanny/login" : "/login");
}
